/**
 * WHICH POOL QUESTION MAY BECOME A SURROGATE FACT — and, for every refusal, the reason an
 * operator reads on the card rather than a 422 they have to interpret.
 *
 * `BINDABLE_QUESTION_TYPES` already answers the mechanical half: a fact is looked up either
 * by an option code (`SINGLE_SELECT`) or by a number falling in a band (`NUMERIC`), and
 * TEXT and MULTI_SELECT are neither. That check is enforced in four places already and is
 * not restated here.
 *
 * This file is the DOMAIN half, and every entry is a question that passes the type check
 * and must still be refused. They are all NUMERIC, so nothing else catches them:
 *
 *   `money_binding`  — the four questions the money fields are bound to. `monthly_income`
 *                      is the load-bearing one: binding it as a fact would let a no-payslip
 *                      rule read the applicant's DECLARED PAYSLIP, which is the exact
 *                      figure the withheld rule of a switched-off product exists to keep
 *                      out of a quote ("a figure no bank agreed to lend against"). The
 *                      other three are the loan being asked for, not a property of the
 *                      applicant: keying an income off the amount requested is circular.
 *
 *   `obligation_item` — the itemised debt questions. The scoring editor already hides these
 *                      for the stated reason that debt burden is only meaningful as a
 *                      total; a bank pricing an income off ONE of the applicant's debts is
 *                      the same error with money on it. `credit_card_total_limit` is the
 *                      deliberate exception and is NOT refused: it already IS the platform
 *                      fact `credit_card_limit`, seeded `systemOnly`, and refusing it would
 *                      refuse a fact the platform ships.
 *
 *   `bank_axis`      — the three per-bank relationship questions. Caught by the type check
 *                      too (all MULTI_SELECT), but named here so the card can say WHY: the
 *                      answer is a set read once per bank and the fact is DERIVED, so a
 *                      registry row under one of those keys would be created, bound,
 *                      audited, rendered — and never emitted, because
 *                      `surrogateFactsFromAnswers` skips derived keys.
 *
 *   `debt_types`     — the multi-pick that unlocks the obligation items. Same story.
 *
 * The two RESERVED KEY families are checked separately, against the derived key rather than
 * against the question: `DERIVED_FACT_KEYS` for the reason just given, and `i_score`, which
 * is one platform-wide fact compiled into every rule that uses it.
 */
import { BANK_AXES } from './bank-relationship';
import {
  CREDIT_CARD_LIMIT_QUESTION_CODE,
  DEBT_TYPES_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  OBLIGATION_ITEM_QUESTION_CODES,
} from './money-field-bindings';
import { DERIVED_FACT_KEYS } from './surrogate-fact-registry';
import { I_SCORE_FACT_KEY } from './product-template';

/** Why a question that is otherwise the right TYPE still cannot be a fact. */
export type FactQuestionIneligibleReason =
  | 'money_binding'
  | 'obligation_item'
  | 'bank_axis'
  | 'debt_types';

const MONEY_BINDING_CODES: readonly string[] = Object.values(MONEY_FIELD_BINDINGS);

/**
 * The itemised debt questions, less the credit-card limit.
 *
 * Filtered rather than listed, so adding a debt type adds its question here for free —
 * the alternative is a hand-copied list that silently stops covering the fifth one.
 */
const OBLIGATION_CODES: readonly string[] = OBLIGATION_ITEM_QUESTION_CODES.filter(
  (code) => code !== CREDIT_CARD_LIMIT_QUESTION_CODE,
);

const BANK_AXIS_CODES: readonly string[] = BANK_AXES.map((axis) => axis.questionCode);

/**
 * `undefined` when the question may be bound (subject to the type check, which is
 * elsewhere), otherwise the reason it may not.
 */
export function factQuestionIneligibleReason(
  questionCode: string,
): FactQuestionIneligibleReason | undefined {
  if (MONEY_BINDING_CODES.includes(questionCode)) return 'money_binding';
  if (OBLIGATION_CODES.includes(questionCode)) return 'obligation_item';
  if (BANK_AXIS_CODES.includes(questionCode)) return 'bank_axis';
  if (questionCode === DEBT_TYPES_QUESTION_CODE) return 'debt_types';
  return undefined;
}

/** Every code the door is shut on, for a refusal's `meta` and for the tests. */
export const FACT_INELIGIBLE_QUESTION_CODES: readonly string[] = [
  ...MONEY_BINDING_CODES,
  ...OBLIGATION_CODES,
  ...BANK_AXIS_CODES,
  DEBT_TYPES_QUESTION_CODE,
];

/**
 * Fact keys nothing may be created under.
 *
 * A derived key belongs to the platform's own per-bank computation and is skipped by the
 * answer→fact mapper; `i_score` is one fact for the whole platform. A row under either
 * looks configured on every screen and can never carry an answer.
 */
export const RESERVED_FACT_KEYS: readonly string[] = [...DERIVED_FACT_KEYS, I_SCORE_FACT_KEY];

export function isReservedFactKey(factKey: string): boolean {
  return RESERVED_FACT_KEYS.includes(factKey);
}
