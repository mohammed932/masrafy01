/// Which questionnaire answer feeds which economic input — the mobile mirror of
/// `backend/src/matching/pipeline/money-field-bindings.ts`.
///
/// These are CODE CONSTANTS on both sides on purpose: Anti-Pattern A33 forbids
/// scoring / eligibility / profile-mapping fields on `Question`, so the binding
/// can never live on the question row. Renaming a bound question code is
/// therefore a code change on both platforms — the accepted residual limit
/// recorded in the feature-010 spec.
///
/// Each bound question is NUMERIC, so the applicant states the real figure. The
/// bucket→midpoint maps these replaced quoted a customer asking for 500 000 on
/// 300 000; a missing bound answer is NEVER substituted with a default (FR-044)
/// — the flow blocks instead.
library;

/// `requestedAmountEGP` — the principal the applicant asked for.
const String kRequestedAmountQuestion = 'amount_requested';

/// `preferredTenorMonths` — repayment period, already expressed in months.
const String kTenorMonthsQuestion = 'repayment_period_months';

/// `employment.monthlyNetSalaryEGP` — monthly income.
const String kMonthlyIncomeQuestion = 'monthly_income';

/// `obligations.existingMonthlyObligationsEGP` — the applicant's total monthly
/// instalments.
///
/// DERIVED, not typed: it is the sum of [kObligationItemQuestionByDebtType], so
/// the field renders read-only and the applicant never recalls a lump sum. The
/// backend re-sums it and rejects a disagreement (`OBLIGATIONS_TOTAL_MISMATCH`),
/// so editing it in flight cannot buy affordability.
const String kExistingObligationsQuestion = 'current_installments';

/// Every bound question code, for completeness checks before submitting.
const List<String> kMoneyFieldQuestionCodes = [
  kRequestedAmountQuestion,
  kTenorMonthsQuestion,
  kMonthlyIncomeQuestion,
  kExistingObligationsQuestion,
];

// ---- Itemised obligations ---------------------------------------------------
//
// The applicant ticks WHICH debts he carries in one MULTI_SELECT, and each pick
// unlocks its own amount question through the snapshot's existing `enabledWhen`
// branching — so this needs no new question type and no new widget. The mapping
// below mirrors `OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE` on the backend, which is
// also what the seed and publish validation read.

/// The MULTI_SELECT whose picks decide which amount questions are asked.
///
/// The pool's PRE-EXISTING "Do you pay back any loans right now?" — not a new
/// question. Option codes are that question's own (note `credit_cards`, plural).
const String kDebtTypesQuestion = 'current_loans';

/// The explicit "I have none" pick, so no-debt is a STATED answer. An empty
/// multi-select is indistinguishable from an untouched one, and that difference
/// decides whether obligations resolve to a real 0 or to "no figures".
const String kDebtTypeNoneOption = 'none';

/// The pick whose amount question states a LIMIT rather than an instalment.
const String kCreditCardDebtTypeOption = 'credit_cards';

/// Total credit limit across EVERY card the applicant holds, at every bank.
///
/// A card has no fixed monthly payment, and an undrawn limit is money that can be
/// drawn tomorrow, so the minimum payment on today's statement understates what a
/// bank underwrites against. The limit is stated instead and discounted by
/// [kCreditCardLimitMonthlyPercent].
const String kCreditCardLimitQuestion = 'credit_card_total_limit';

/// Share of the stated card limit that counts as a monthly commitment. Mirrors
/// `CREDIT_CARD_LIMIT_MONTHLY_PERCENT` on the backend — the server re-derives the
/// same total and rejects a disagreement (`OBLIGATIONS_TOTAL_MISMATCH`), so the
/// two constants must move together.
const double kCreditCardLimitMonthlyPercent = 5;

/// Debt-type option code → the NUMERIC question capturing its monthly figure.
const Map<String, String> kObligationItemQuestionByDebtType = {
  'car_loan': 'obligation_car_loan',
  kCreditCardDebtTypeOption: kCreditCardLimitQuestion,
  'personal_loan': 'obligation_personal_loan',
  'mortgage': 'obligation_mortgage',
  'other': 'obligation_other',
};

/// Every per-debt amount question code.
final List<String> kObligationItemQuestionCodes =
    kObligationItemQuestionByDebtType.values.toList(growable: false);

/// The amount question a debt-type pick unlocks, or `null` for `none`/unknown.
String? obligationItemQuestionFor(String debtTypeOptionCode) =>
    kObligationItemQuestionByDebtType[debtTypeOptionCode];

/// The monthly commitment one stated per-debt figure contributes.
///
/// Identity for every debt whose answer already IS a monthly instalment; for
/// credit cards the stated figure is a limit, so it is discounted (150,000 of
/// limit → 7,500 a month). An unmapped pick passes through at face value rather
/// than dropping out of the total.
///
/// Rounded to two decimals so it lands on the server's `Decimal(18, 2)` column
/// and matches the `ROUND_HALF_UP` the backend applies to the same product.
double obligationMonthlyAmountFor(String debtTypeOptionCode, double statedEGP) {
  if (debtTypeOptionCode != kCreditCardDebtTypeOption) return statedEGP;
  return double.parse(
    (statedEGP * kCreditCardLimitMonthlyPercent / 100).toStringAsFixed(2),
  );
}
