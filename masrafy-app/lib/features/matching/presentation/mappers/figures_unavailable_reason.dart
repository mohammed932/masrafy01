/// Backend "no figures" reason code → the sentence the customer reads.
///
/// Principle III: the API returns a stable CODE and never English, so the whole
/// vocabulary is localized here. Every code has an entry — including the two feature
/// 011 added — and anything unrecognised falls back to the generic line rather than
/// rendering a raw token like `SURROGATE_FACT_MISSING` on a customer's screen.
///
/// **The program stays LISTED and stays RANKED** (FR-022, FR-024). A reason replaces
/// the FIGURES, never the card: a bank that silently disappears reads as "this bank
/// doesn't exist for me" when the truth is something the applicant can act on. And a
/// program with no figures is never shown as `0` — the two feature 011 reasons exist
/// precisely so "we haven't asked you this yet" and "your answer isn't in this bank's
/// table" can be said out loud instead of being mistaken for an income of nothing
/// (FR-020, FR-023).
///
/// Mirrors `FIGURES_UNAVAILABLE_REASONS` in `backend/src/matching/types.ts`.
library;

import 'package:app/l10n/generated/app_localizations.dart';

/// The reason codes this app knows how to explain.
class FiguresUnavailableReasons {
  const FiguresUnavailableReasons._();

  static const String noRecognisedIncome = 'NO_RECOGNISED_INCOME';
  static const String obligationsExceedAllowance =
      'OBLIGATIONS_EXCEED_ALLOWANCE';
  static const String belowProgramMinAmount = 'BELOW_PROGRAM_MIN_AMOUNT';
  static const String ageAtMaturity = 'AGE_AT_MATURITY';
  static const String programMisconfigured = 'PROGRAM_MISCONFIGURED';

  /// Feature 011 — the rule's fact was never asked, or was skipped.
  static const String surrogateFactMissing = 'SURROGATE_FACT_MISSING';

  /// Feature 011 — the fact was answered, but no row or band covers it.
  static const String surrogateNoMatchingRow = 'SURROGATE_NO_MATCHING_ROW';

  /// Every code, so a test can assert none is left without a sentence.
  static const List<String> all = [
    noRecognisedIncome,
    obligationsExceedAllowance,
    belowProgramMinAmount,
    ageAtMaturity,
    programMisconfigured,
    surrogateFactMissing,
    surrogateNoMatchingRow,
  ];
}

/// The localized sentence for a backend reason code.
String figuresUnavailableLabel(AppLocalizations l10n, String? reasonCode) {
  switch (reasonCode) {
    case FiguresUnavailableReasons.noRecognisedIncome:
      return l10n.reason_no_recognised_income;
    case FiguresUnavailableReasons.obligationsExceedAllowance:
      return l10n.reason_obligations_exceed_allowance;
    case FiguresUnavailableReasons.belowProgramMinAmount:
      return l10n.reason_below_program_min_amount;
    case FiguresUnavailableReasons.ageAtMaturity:
      return l10n.reason_age_at_maturity;
    case FiguresUnavailableReasons.programMisconfigured:
      return l10n.reason_program_misconfigured;
    case FiguresUnavailableReasons.surrogateFactMissing:
      return l10n.reason_surrogate_fact_missing;
    case FiguresUnavailableReasons.surrogateNoMatchingRow:
      return l10n.reason_surrogate_no_matching_row;
    default:
      // A code this build predates. The generic line is honest and says nothing
      // false; printing the token would leak an internal identifier onto the screen.
      return l10n.results_unavailable_generic;
  }
}
