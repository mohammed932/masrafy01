/**
 * WHICH FACT KEY MAY BE MINTED — and nothing about which QUESTION may become a fact.
 *
 * This file used to hold a second list: questions that were the right TYPE and still
 * refused — the declared salary and the three other money-field bindings, the itemised
 * debts, the per-bank relationship axes, the debt-types multi-pick. That list is GONE, on
 * the operator's explicit call: every question in the pool is now tickable on a product's
 * ask board, so the board no longer shows an operator a card they may not use.
 *
 * What replaced each refusal, so none of them is silently lost:
 *
 *   the four money bindings — a fact bound to `monthly_income` reads the DECLARED payslip,
 *     and a no-payslip rule that reads it is quoting off a figure no bank agreed to lend
 *     against. Nothing in the engine stops that any more; it is a decision the operator
 *     makes per product, and the product's own screen is where it is visible.
 *
 *   the itemised debts — a bank pricing an income off ONE of the applicant's debts is
 *     still a strange rule, and it is now a rule an operator may write.
 *
 *   the bank axes and `current_loans` — MULTI_SELECT, which is bindable since the ask board
 *     opened: the fact is keyed by the SAME option codes, several at a time, and read by
 *     the bank's own row order (`fact-value.ts`). A registry fact under the axis QUESTION is
 *     not the platform's derived `bank_relationship` fact — different keys, different
 *     readers — so the two do not collide.
 *
 * The two RESERVED KEY families below are a different rule and they STAY. They are checked
 * against the derived KEY rather than against the question, and a row under either would be
 * created, bound, audited, rendered — and never carry an answer, because the mapper that
 * fills the applicant profile skips those keys by contract.
 */
import { DERIVED_FACT_KEYS } from './surrogate-fact-registry';
import { I_SCORE_FACT_KEY } from './product-template';

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
