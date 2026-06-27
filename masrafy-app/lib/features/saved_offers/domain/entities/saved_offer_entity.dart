import 'package:equatable/equatable.dart';

/// A customer's saved (bookmarked) loan offer — the domain view backing the
/// Saved Offers screen (Figma `4088:153`). Carries exactly the fields the card
/// renders AND those needed to rebuild a `MatchOffer` / `MatchResultsArgs` when
/// the user taps **View offer** into the existing Offer-Details screen.
class SavedOfferEntity extends Equatable {
  const SavedOfferEntity({
    required this.bankOfferId,
    required this.loanTypeKey,
    required this.approvalPct,
    required this.termMonths,
    required this.ratePct,
    required this.monthly,
    required this.amount,
    required this.totalInterest,
    required this.totalLoan,
    required this.totalLabel,
  });

  /// Stable id of the underlying immutable BankOffer — the key for remove.
  final String bankOfferId;

  /// Language-neutral loan category: `personal` | `car` | `mortgage` |
  /// `business`. Resolved to a localized label by `loanTypeLabel`.
  final String loanTypeKey;

  /// Approval percent 0–100 → "{pct}% Guarantee Approval".
  final int approvalPct;
  final int termMonths;

  /// Annual interest rate, e.g. `10.1` → "10.1%".
  final double ratePct;

  /// Monthly installment (EGP).
  final int monthly;

  /// Requested principal (EGP) — carried into the details summary.
  final double amount;

  /// Total interest over the term (EGP).
  final int totalInterest;

  /// Total repayable incl. principal + interest (EGP).
  final int totalLoan;

  /// Compact total for the KPI cell, e.g. "170K".
  final String totalLabel;

  @override
  List<Object?> get props => [
        bankOfferId,
        loanTypeKey,
        approvalPct,
        termMonths,
        ratePct,
        monthly,
        amount,
        totalInterest,
        totalLoan,
        totalLabel,
      ];
}
