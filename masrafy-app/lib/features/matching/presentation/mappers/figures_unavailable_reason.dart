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

  /// A COLLATERAL product's own condition refused — the share paid is short, the
  /// ownership contract is outside the bank's window, the strongest unit was not
  /// confirmed. Which condition is in `gateReasonCode`, and that is the sentence worth
  /// showing: "a condition was not met" is not something a customer can act on.
  static const String productRuleGateFailed = 'PRODUCT_RULE_GATE_FAILED';

  /// Every code, so a test can assert none is left without a sentence.
  static const List<String> all = [
    noRecognisedIncome,
    obligationsExceedAllowance,
    belowProgramMinAmount,
    ageAtMaturity,
    programMisconfigured,
    surrogateFactMissing,
    surrogateNoMatchingRow,
    productRuleGateFailed,
  ];
}

/// The conditions a collateral product can refuse on — the backend's closed
/// `GATE_REASON_CODES`.
///
/// A closed list, and it has to be: a gate's own ID is authored by an operator on the
/// program catalog and could never have a translation, so the engine reports one of these
/// instead and every one has a sentence in both locales (Principle III / A2).
class GateReasonCodes {
  const GateReasonCodes._();

  static const String downPaymentBelowMin = 'DOWN_PAYMENT_BELOW_MIN';
  static const String unitPriceBelowMin = 'UNIT_PRICE_BELOW_MIN';
  static const String contractTooNew = 'CONTRACT_TOO_NEW';
  static const String contractTooOld = 'CONTRACT_TOO_OLD';
  static const String ownershipNotConfirmed = 'OWNERSHIP_NOT_CONFIRMED';
  static const String multiUnitNotConfirmed = 'MULTI_UNIT_NOT_CONFIRMED';
  static const String notMet = 'GATE_NOT_MET';

  static const List<String> all = [
    downPaymentBelowMin,
    unitPriceBelowMin,
    contractTooNew,
    contractTooOld,
    ownershipNotConfirmed,
    multiUnitNotConfirmed,
    notMet,
  ];
}

/// The localized sentence for a backend reason code.
///
/// `gateReasonCode` is consulted FIRST when the reason is a refused collateral condition:
/// the generic line ("a condition your answers don't meet") is true and useless, and the
/// specific one names something the customer can go and change.
String figuresUnavailableLabel(
  AppLocalizations l10n,
  String? reasonCode, {
  String? gateReasonCode,
}) {
  if (reasonCode == FiguresUnavailableReasons.productRuleGateFailed) {
    return gateReasonLabel(l10n, gateReasonCode);
  }
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
    case FiguresUnavailableReasons.productRuleGateFailed:
      // Reachable only when no gate code came with it — a build that predates one of the
      // conditions, or an older application replayed.
      return l10n.gate_not_met;
    default:
      // A code this build predates. The generic line is honest and says nothing
      // false; printing the token would leak an internal identifier onto the screen.
      return l10n.results_unavailable_generic;
  }
}

/// The localized sentence for one refused condition.
///
/// An unrecognised code falls back to the generic line rather than printing the token: a
/// build that predates a condition must not put `MULTI_UNIT_NOT_CONFIRMED` on a customer's
/// screen.
String gateReasonLabel(AppLocalizations l10n, String? gateReasonCode) {
  switch (gateReasonCode) {
    case GateReasonCodes.downPaymentBelowMin:
      return l10n.gate_down_payment_below_min;
    case GateReasonCodes.unitPriceBelowMin:
      return l10n.gate_unit_price_below_min;
    case GateReasonCodes.contractTooNew:
      return l10n.gate_contract_too_new;
    case GateReasonCodes.contractTooOld:
      return l10n.gate_contract_too_old;
    case GateReasonCodes.ownershipNotConfirmed:
      return l10n.gate_ownership_not_confirmed;
    case GateReasonCodes.multiUnitNotConfirmed:
      return l10n.gate_multi_unit_not_confirmed;
    default:
      return l10n.gate_not_met;
  }
}
