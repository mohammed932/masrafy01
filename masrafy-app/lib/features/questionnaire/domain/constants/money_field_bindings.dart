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

/// Debt-type option code → the NUMERIC question capturing its instalment.
const Map<String, String> kObligationItemQuestionByDebtType = {
  'car_loan': 'obligation_car_loan',
  'credit_cards': 'obligation_credit_card',
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
