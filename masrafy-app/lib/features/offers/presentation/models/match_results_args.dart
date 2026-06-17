import 'package:app/l10n/generated/app_localizations.dart';

/// Route payload for the offers-list + offer-details screens (Figma `2040:1253`,
/// `2040:1402`). Static mock for this iteration — the mobile matching API is not
/// wired yet — so [MatchResultsArgs.mock] fabricates a deterministic set of
/// offers while the loan summary (type / amount / duration) is carried from the
/// questionnaire answers.
///
/// Root + nested [MatchOffer] live in this one file on purpose (payload
/// co-location); do not split per-class.
class MatchResultsArgs {
  const MatchResultsArgs({
    required this.loanTypeKey,
    required this.amount,
    required this.durationMonths,
    required this.offers,
  });

  /// Language-neutral loan category id: `car` | `mortgage` | `business` |
  /// `personal`. The screens resolve it to a localized label.
  final String loanTypeKey;

  /// Requested principal (EGP), derived from the questionnaire.
  final double amount;

  /// Requested repayment duration in months, derived from the questionnaire.
  final int durationMonths;

  /// Ranked matches, best first.
  final List<MatchOffer> offers;

  /// Deterministic mock matches mirroring the Figma frames. Offers themselves
  /// are static (no backend); only the summary reflects the user's answers.
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

/// A single bank match. [approvalPct] drives the "{pct}% Guarantee Approval"
/// heading; the rate / monthly / totals feed both the list KPI row and the
/// details stat grid.
class MatchOffer {
  const MatchOffer({
    required this.approvalPct,
    required this.termMonths,
    required this.ratePct,
    required this.monthly,
    required this.totalLabel,
    required this.totalInterest,
    required this.totalLoan,
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

  final bool isBestMatch;
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
