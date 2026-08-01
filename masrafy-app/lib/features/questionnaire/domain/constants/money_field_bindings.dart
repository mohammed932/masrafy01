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

/// `obligations.existingMonthlyObligationsEGP` — current monthly installments.
const String kExistingObligationsQuestion = 'current_installments';

/// Every bound question code, for completeness checks before submitting.
const List<String> kMoneyFieldQuestionCodes = [
  kRequestedAmountQuestion,
  kTenorMonthsQuestion,
  kMonthlyIncomeQuestion,
  kExistingObligationsQuestion,
];
