import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/matching/domain/entities/apply_result_entity.dart';
import 'package:app/features/matching/domain/enums/approval_tier.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Route payload for the offers-list + offer-details screens (Figma `2040:1253`,
/// `2040:1402`).
///
/// Dual role:
///  - From a wizard, [request] is set (via [MatchResultsArgs.fromRequest]) and
///    the results screen runs `/api/v1/apply`, rendering the real offers.
///  - As an offer-details `summary` (saved offers / past applications / tests),
///    [request] is null and [offers] is shown as-is.
///
/// The loan summary (type / amount / duration) is always explicit so both roles
/// render the summary card. Root + nested [MatchOffer] live in this one file on
/// purpose (payload co-location); do not split per-class.
class MatchResultsArgs {
  const MatchResultsArgs({
    required this.loanTypeKey,
    required this.amount,
    required this.durationMonths,
    this.request,
    this.offers = const [],
  });

  /// Language-neutral loan category id: `car` | `mortgage` | `business` |
  /// `personal`. The screens resolve it to a localized label.
  final String loanTypeKey;

  /// Requested principal (EGP) — summary card.
  final double amount;

  /// Requested repayment duration in months — summary card.
  final int durationMonths;

  /// When set, the results screen submits it to `/api/v1/apply` (the wizard
  /// flow). Null for static summaries (saved offers / past applications).
  final ApplyRequest? request;

  /// Static offers shown when [request] is null.
  final List<MatchOffer> offers;

  /// Build the results payload from a wizard-mapped request. Summary fields are
  /// derived from the request so they always mirror the customer's answers.
  factory MatchResultsArgs.fromRequest({
    required ApplyRequest request,
    required String loanTypeKey,
  }) =>
      MatchResultsArgs(
        loanTypeKey: loanTypeKey,
        amount: double.tryParse(request.requestedAmountEGP) ?? 0,
        durationMonths: request.preferredTenorMonths,
        request: request,
      );

  /// Deterministic mock matches (used by widget tests + any static preview).
  factory MatchResultsArgs.mock({
    required String loanTypeKey,
    required double amount,
    required int durationMonths,
  }) {
    final term = durationMonths <= 0 ? 36 : durationMonths;
    return MatchResultsArgs(
      loanTypeKey: loanTypeKey,
      amount: amount,
      durationMonths: term,
      offers: [
        MatchOffer(
          approvalPct: 98,
          termMonths: term,
          ratePct: 9.5,
          monthly: 4620,
          totalLabel: '166K',
          totalInterest: 16320,
          totalLoan: 166320,
          isBestMatch: true,
        ),
        MatchOffer(
          approvalPct: 84,
          termMonths: term,
          ratePct: 10.1,
          monthly: 4720,
          totalLabel: '170K',
          totalInterest: 20320,
          totalLoan: 170320,
        ),
        MatchOffer(
          approvalPct: 72,
          termMonths: term,
          ratePct: 10.1,
          monthly: 4720,
          totalLabel: '170K',
          totalInterest: 20320,
          totalLoan: 170320,
        ),
      ],
    );
  }
}

/// A single bank match rendered by the list + details screens. Display fields
/// ([approvalPct], rate, monthly, totals) feed the existing Figma widgets and
/// are always required. The identity/meta fields ([bankOfferId],
/// [applicationId], [bankName], …) are populated only for real offers (via
/// [MatchOffer.fromEntity]); saved-offer / past-application / mock offers leave
/// them at their defaults, and the details screen's proceed CTA stays inert
/// unless [applicationId] is set.
class MatchOffer {
  const MatchOffer({
    required this.approvalPct,
    required this.termMonths,
    required this.ratePct,
    required this.monthly,
    required this.totalLabel,
    required this.totalInterest,
    required this.totalLoan,
    this.bankOfferId = '',
    this.applicationId = '',
    this.bankName = '',
    this.programCode = '',
    this.programFriendlyName = '',
    this.currency = 'EGP',
    this.tier = ApprovalTier.veryLow,
    this.bankIsFeatured = false,
    this.requiredDocuments = const [],
    this.feesBreakdown,
    this.isBestMatch = false,
  });

  final int approvalPct;
  final int termMonths;

  /// Annual interest rate, e.g. `9.5` → "9.5%".
  final double ratePct;

  /// Monthly installment (EGP).
  final int monthly;

  /// Compact total shown on the list KPI cell, e.g. "166K".
  final String totalLabel;

  /// Total interest paid over the term (EGP) — details "Total interest" tile.
  final int totalInterest;

  /// Total repayable incl. principal + interest (EGP) — details "Total Loan".
  final int totalLoan;

  /// Persisted offer id — the select-offer key sent back to the backend.
  final String bankOfferId;

  /// Owning application id — needed for the select-offer call.
  final String applicationId;

  final String bankName;
  final String programCode;
  final String programFriendlyName;
  final String currency;
  final ApprovalTier tier;
  final bool bankIsFeatured;
  final List<String> requiredDocuments;

  /// Raw engine fee breakdown (shape TBD) — carried for the details screen.
  final Map<String, dynamic>? feesBreakdown;

  final bool isBestMatch;

  /// Build a display offer from a domain [OfferEntity]. Totals are derived on
  /// the entity (installment × term); [isBestMatch] marks the top-ranked row.
  factory MatchOffer.fromEntity(
    OfferEntity e, {
    required String applicationId,
    required bool isBestMatch,
  }) {
    return MatchOffer(
      approvalPct: e.approvalScore,
      termMonths: e.effectiveTenorMonths,
      ratePct: e.effectiveRatePercent,
      monthly: e.monthlyInstallmentEGP.round(),
      totalLabel: _compact(e.totalRepayableEGP),
      totalInterest: e.totalInterestEGP.round(),
      totalLoan: e.totalRepayableEGP.round(),
      bankOfferId: e.bankOfferId,
      applicationId: applicationId,
      bankName: e.bankName,
      programCode: e.programCode,
      programFriendlyName: e.programFriendlyName,
      currency: e.currency,
      tier: e.approvalTier,
      bankIsFeatured: e.bankIsFeatured,
      requiredDocuments: e.requiredDocuments,
      feesBreakdown: e.feesBreakdown,
      isBestMatch: isBestMatch,
    );
  }
}

/// Compact EGP total, e.g. 166320 → "166K", 1_200_000 → "1.2M".
String _compact(num v) {
  if (v >= 1e6) return '${_trim(v / 1e6)}M';
  if (v >= 1e3) return '${_trim(v / 1e3)}K';
  return v.round().toString();
}

/// Drop a trailing ".0": 1.0 → "1", 1.2 → "1.2".
String _trim(double v) {
  final r = (v * 10).round() / 10;
  return r == r.truncateToDouble() ? r.truncate().toString() : r.toString();
}

/// Resolve a language-neutral [loanTypeKey] to its localized noun
/// ("Mortgage", "Car", …). Shared by both offers screens.
String loanTypeLabel(AppLocalizations l, String loanTypeKey) {
  switch (loanTypeKey) {
    case 'car':
      return l.offer_type_car;
    case 'mortgage':
      return l.offer_type_mortgage;
    case 'business':
      return l.offer_type_business;
    case 'personal':
    default:
      return l.offer_type_personal;
  }
}
