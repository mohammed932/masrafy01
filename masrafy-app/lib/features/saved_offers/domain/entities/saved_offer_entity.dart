import 'package:equatable/equatable.dart';

/// A customer's saved (bookmarked) loan offer — the domain view backing the
/// Saved Offers screen (Figma `4088:153`). Carries the fields the card renders
/// — the bank and program it came from, the term and the money — AND those
/// needed to rebuild a `MatchOffer` / `MatchResultsArgs` when the user taps
/// **View offer** into the existing Offer-Details screen.
class SavedOfferEntity extends Equatable {
  const SavedOfferEntity({
    required this.bankOfferId,
    required this.loanTypeKey,
    required this.bankName,
    required this.programFriendlyName,
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

  /// The bank that wrote this offer — the card's heading. Empty on offers
  /// written before the field was carried.
  final String bankName;

  /// Bank-facing name of the matched program — the card's subheading.
  final String programFriendlyName;
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
        bankName,
        programFriendlyName,
        termMonths,
        ratePct,
        monthly,
        amount,
        totalInterest,
        totalLoan,
        totalLabel,
      ];
}
