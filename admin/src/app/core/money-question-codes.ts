/**
 * The questions the engine reads by CODE CONSTANT — a mirror of the backend's
 * `matching/pipeline/money-field-bindings.ts` (`MONEY_FIELD_BINDINGS`,
 * `DEBT_TYPES_QUESTION_CODE`) and `product-template.ts` (`I_SCORE_FACT_KEY`).
 * One place on the admin side, so a screen that builds a sample applicant never
 * hand-types a code (A33); change the backend constant and this file together (A25).
 */
export const MONEY_QUESTION_CODES = {
  requestedAmount: 'amount_requested',
  tenorMonths: 'repayment_period_months',
  monthlyIncome: 'monthly_income',
  existingObligations: 'current_installments',
} as const;

export const DEBT_TYPES_QUESTION_CODE = 'current_loans';
/** The "no debts" option of the debt-types question. */
export const NO_DEBTS_OPTION_CODE = 'none';
export const I_SCORE_QUESTION_CODE = 'i_score';
