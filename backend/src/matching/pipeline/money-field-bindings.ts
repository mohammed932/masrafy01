/**
 * Feature 010 — which questionnaire answer feeds which economic input.
 *
 * This is a CODE CONSTANT, deliberately not a column on `Question`.
 * Anti-Pattern A33 forbids scoring / eligibility / profile-mapping fields on
 * `Question` / `QuestionOption`, and Constitution v6.0.0 specifically deleted
 * `Question.profileField` / `Question.systemRole`. Storing the binding would
 * revive exactly that. Renaming a bound question code is therefore a code
 * change — the accepted residual limit recorded in the spec.
 *
 * The four NUMERIC questions named here replace the old bucket→midpoint maps
 * (a customer asking for 500 000 was quoted on 300 000). A bound answer that is
 * absent is NEVER substituted with a default: the quote fails with
 * `MONEY_FIGURE_MISSING` (FR-044).
 *
 * Mirrored on mobile by the four `*_apply_mapper.dart` files.
 */
export const MONEY_FIELD_BINDINGS = {
  requested_amount: 'amount_requested',
  tenor_months: 'repayment_period_months',
  monthly_income: 'monthly_income',
  existing_obligations: 'current_installments',
} as const;

export type MoneyFieldBinding = keyof typeof MONEY_FIELD_BINDINGS;

/** The question code each binding expects, for publish-time validation. */
export type BoundQuestionCode = (typeof MONEY_FIELD_BINDINGS)[MoneyFieldBinding];

export const MONEY_FIELD_BINDING_KEYS = Object.keys(
  MONEY_FIELD_BINDINGS,
) as readonly MoneyFieldBinding[];

/**
 * The engine field each binding lands on, and the bounds the seed applies.
 * `path` is documentation for reviewers (and the `meta.binding` audit trail) —
 * it is not evaluated dynamically.
 */
export const MONEY_FIELD_BINDING_SPECS: Readonly<
  Record<
    MoneyFieldBinding,
    {
      readonly questionCode: BoundQuestionCode;
      readonly path: string;
      readonly unit: 'EGP' | 'months';
      readonly integerOnly: boolean;
    }
  >
> = Object.freeze({
  requested_amount: {
    questionCode: MONEY_FIELD_BINDINGS.requested_amount,
    path: 'requestedAmountEGP',
    unit: 'EGP',
    integerOnly: false,
  },
  tenor_months: {
    questionCode: MONEY_FIELD_BINDINGS.tenor_months,
    path: 'preferredTenorMonths',
    unit: 'months',
    integerOnly: true,
  },
  monthly_income: {
    questionCode: MONEY_FIELD_BINDINGS.monthly_income,
    path: 'employment.monthlyNetSalaryEGP',
    unit: 'EGP',
    integerOnly: false,
  },
  existing_obligations: {
    questionCode: MONEY_FIELD_BINDINGS.existing_obligations,
    path: 'obligations.existingMonthlyObligationsEGP',
    unit: 'EGP',
    integerOnly: false,
  },
});

/** Reverse lookup: question code → binding, for publish-time snapshot checks. */
export function bindingForQuestionCode(code: string): MoneyFieldBinding | undefined {
  return MONEY_FIELD_BINDING_KEYS.find(
    (binding) => MONEY_FIELD_BINDINGS[binding] === code,
  );
}
