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
 * absent is NEVER substituted with a default: the quote yields no figures
 * (`MONEY_FIGURE_MISSING`, FR-044).
 *
 * `existing_obligations` is special: its answer is DERIVED, not typed. See
 * `resolveObligations` below — the applicant states each debt separately and the
 * total is summed, because one lump sum recalled from memory is the least
 * reliable input in the flow and the one with the largest effect on DBR.
 *
 * Mirrored on mobile by the four `*_apply_mapper.dart` files.
 */
import { Decimal } from '@prisma/client/runtime/library';

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

// ---- Itemised obligations ---------------------------------------------------
//
// The applicant picks WHICH debts he carries in one MULTI_SELECT, and each picked
// option unlocks its own NUMERIC amount question through the questionnaire's
// existing `enabledWhen` branching (`question-visibility.ts` already matches an
// option code against a multi-pick answer). So this needs no new question type,
// no new table and no schema change — only the mapping below, which is the
// single source of truth shared by the seed, the sum, and publish validation.
//
// Deliberately code constants, not columns: A33 forbids profile-mapping fields on
// `Question`, and the four bindings above are already code for the same reason.

/**
 * The MULTI_SELECT whose picks decide which amount questions are asked.
 *
 * This is the pool's PRE-EXISTING "Do you pay back any loans right now?" — not a
 * new question. It already asks exactly this, with exactly these option codes, so
 * introducing a second debt-type multi-select would ask the applicant the same
 * thing twice. The option codes below are therefore that question's codes
 * verbatim (note `credit_cards`, plural, as authored).
 */
export const DEBT_TYPES_QUESTION_CODE = 'current_loans';

/**
 * The explicit "I have none" pick. Present so "no debts" is a STATED answer
 * rather than an empty one — an empty multi-select is indistinguishable from an
 * unanswered question, and that difference decides whether obligations resolve
 * to a real `0` or to "no figures".
 */
export const DEBT_TYPE_NONE_OPTION = 'none';

/** Debt-type option code → the NUMERIC question that captures its instalment. */
export const OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE = Object.freeze({
  car_loan: 'obligation_car_loan',
  credit_cards: 'obligation_credit_card',
  personal_loan: 'obligation_personal_loan',
  mortgage: 'obligation_mortgage',
  other: 'obligation_other',
} as const);

export type DebtTypeOptionCode = keyof typeof OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE;
export type ObligationItemQuestionCode =
  (typeof OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE)[DebtTypeOptionCode];

export const DEBT_TYPE_OPTION_CODES = Object.keys(
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
) as readonly DebtTypeOptionCode[];

export const OBLIGATION_ITEM_QUESTION_CODES = Object.values(
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
) as readonly ObligationItemQuestionCode[];

/** The itemised amount question a debt-type pick unlocks, if the pick is known. */
export function obligationItemQuestionFor(
  debtTypeOptionCode: string,
): ObligationItemQuestionCode | undefined {
  return debtTypeOptionCode in OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE
    ? OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE[debtTypeOptionCode as DebtTypeOptionCode]
    : undefined;
}

export interface ObligationsResolution {
  /** Authoritative monthly obligations — what DBR is computed on. */
  totalEGP: Decimal;
  /** Whether the total came from itemised answers rather than a stated lump sum. */
  itemised: boolean;
  /** The item questions that carried a value, biggest-first ordering not implied. */
  itemisedCodes: readonly string[];
  /**
   * Derived from the debt-type picks when itemised, else from `total > 0`. A debt
   * whose instalment is currently 0 still means a loan is on book, which the
   * lump-sum derivation could never express.
   */
  hasCurrentLoan: boolean;
  /**
   * Set when the client also submitted `current_installments` and it disagrees
   * with the itemised sum. Returned rather than thrown: this module is pure, the
   * same way `quoteProgram` reports `unavailable` instead of raising. Callers
   * raise `OBLIGATIONS_TOTAL_MISMATCH`.
   */
  statedTotalMismatch: { statedEGP: Decimal; computedEGP: Decimal } | null;
}

/** Sums to the cent, so a mismatch below this is float noise, not disagreement. */
const TOTAL_TOLERANCE = new Decimal('0.01');

/**
 * Resolve the applicant's monthly obligations from questionnaire answers.
 *
 * Itemised path (the debt-type question was asked and answered): the total is the
 * SUM of the visible per-debt answers. It is authoritative — a client-submitted
 * `current_installments` is only cross-checked against it, never preferred, so
 * editing the total cannot buy affordability.
 *
 * Fallback path (the snapshot serves no debt-type question, i.e. it predates this
 * feature, or a historical application's answers): read `current_installments`
 * directly, exactly as before. An un-republished questionnaire keeps working.
 *
 * Returns `null` when neither path yields a figure — callers must then produce no
 * figures rather than substitute a default (FR-044).
 */
export function resolveObligations(args: {
  /** Every NUMERIC answer by question code, already validated. */
  readonly numericByCode: ReadonlyMap<string, string>;
  /** The debt-type picks, or `undefined` when that question was not asked. */
  readonly pickedDebtTypes?: readonly string[];
}): ObligationsResolution | null {
  const { numericByCode, pickedDebtTypes } = args;
  const statedRaw = numericByCode.get(MONEY_FIELD_BINDINGS.existing_obligations);
  const stated = statedRaw !== undefined ? new Decimal(statedRaw) : null;

  if (pickedDebtTypes === undefined) {
    if (stated === null) return null;
    return {
      totalEGP: stated,
      itemised: false,
      itemisedCodes: [],
      hasCurrentLoan: stated.greaterThan(0),
      statedTotalMismatch: null,
    };
  }

  // Only picks that map to an amount question can contribute. `none` maps to
  // nothing by construction, so picking it sums to a real, stated zero.
  const itemisedCodes: string[] = [];
  let total = new Decimal(0);
  for (const pick of pickedDebtTypes) {
    const itemCode = obligationItemQuestionFor(pick);
    if (itemCode === undefined) continue;
    const raw = numericByCode.get(itemCode);
    if (raw === undefined) continue;
    itemisedCodes.push(itemCode);
    total = total.plus(new Decimal(raw));
  }

  const carriesDebt = pickedDebtTypes.some(
    (pick) => pick !== DEBT_TYPE_NONE_OPTION && obligationItemQuestionFor(pick) !== undefined,
  );

  return {
    totalEGP: total,
    itemised: true,
    itemisedCodes,
    hasCurrentLoan: carriesDebt,
    statedTotalMismatch:
      stated !== null && stated.minus(total).abs().greaterThan(TOTAL_TOLERANCE)
        ? { statedEGP: stated, computedEGP: total }
        : null,
  };
}
