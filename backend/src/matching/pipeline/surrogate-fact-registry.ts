/**
 * The shape of an operator-managed surrogate income FACT, as the pure engine reads it.
 *
 * Lives in `matching/` rather than in the enumerations repository so that Principle V
 * holds: the engine imports nothing from the DB layer, and the repository — which
 * already depends on this module — imports the shape from here. The dependency
 * direction is the same one `money-field-bindings.ts` and `surrogate-fact-bindings.ts`
 * established; only the CONTENT moved out of code and into rows.
 *
 * What is here is the contract, not the data. Which facts exist is a question only the
 * registry can answer (`PlatformEnumerationsRepository#surrogateFactRegistry`), and
 * every caller passes the answer in.
 */

import { BANK_RELATIONSHIP_CODES, BANK_RELATIONSHIP_FACT_KEY } from './bank-relationship';

/**
 * The question types a fact may be bound to, and what each one makes the bank's table.
 *
 * SINGLE_SELECT → a key table, one row per option ("Colonel → 45 000").
 * NUMERIC       → a band table, `[from, to)` over the answer ("8–12 years → 30 000").
 *
 * TEXT and MULTI_SELECT are excluded and must stay excluded. A free-text answer is not
 * a key any bank can enumerate in advance (A33 already forbids scoring text by keyword
 * for the same reason), and a multi-pick answer has no single value to look up — taking
 * the first would invent an answer the applicant did not give.
 */
export const BINDABLE_QUESTION_TYPES = ['SINGLE_SELECT', 'NUMERIC'] as const;

export type BindableQuestionType = (typeof BINDABLE_QUESTION_TYPES)[number];

/** Narrowing guard — Prisma's `QuestionType` is wider than what may be bound. */
export function isBindableQuestionType(type: string): type is BindableQuestionType {
  return (BINDABLE_QUESTION_TYPES as readonly string[]).includes(type);
}

/**
 * One registry fact, reduced to what resolving a quote needs: which question answers
 * it, and which shape the bank's table therefore takes.
 *
 * Labels are deliberately absent. The engine renders nothing (Principle III), and
 * carrying them would invite a resolver branch keyed on an English string.
 */
export interface SurrogateFactBinding {
  /** The fact key — also the `fact:<key>` half of an income rule's strategy token. */
  key: string;
  questionCode: string;
  type: BindableQuestionType;
}

// ---------------------------------------------------------------------------
// Derived facts
// ---------------------------------------------------------------------------

/**
 * Facts the PLATFORM computes rather than the operator registering.
 *
 * A registry fact is one stored answer, read the same way by every program. A derived fact
 * is computed per QUOTE, because its value depends on the program being quoted and not only
 * on the applicant — `bank_relationship` is a different answer at every bank.
 *
 * Kept as a closed code list on purpose: each one is arithmetic the engine performs, so
 * adding one is a code change with a test, exactly like adding an op. What is data is which
 * COLUMN a bank fills, not whether the platform can work out who its own customers are.
 *
 * Consequences a caller must respect:
 *   · save-time validation accepts these keys without a registry row (there is none);
 *   · `surrogateFactsFromAnswers` must never emit one, or an operator who registered a
 *     fact under the same key would let a customer answer overwrite a computed value.
 */
export const DERIVED_FACT_KEYS = [BANK_RELATIONSHIP_FACT_KEY] as const;

export type DerivedFactKey = (typeof DERIVED_FACT_KEYS)[number];

export function isDerivedFactKey(key: string): key is DerivedFactKey {
  return (DERIVED_FACT_KEYS as readonly string[]).includes(key);
}

/**
 * The option codes a derived choice fact can produce — the legal `branches` of a
 * `pickByFact` step that reads it. `null` for a derived fact that is not a choice.
 */
export function derivedFactOptionCodes(key: string): readonly string[] | null {
  return key === BANK_RELATIONSHIP_FACT_KEY ? BANK_RELATIONSHIP_CODES : null;
}
