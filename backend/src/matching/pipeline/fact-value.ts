/**
 * HOW AN ANSWERED FACT IS READ AS A KEY — one function, every reader.
 *
 * A fact is looked up either by a key (a row in the bank's table) or by a number (a band).
 * Three of the four answer shapes are key-shaped, and each carries a different number of
 * candidate keys:
 *
 *   `choice`   → the one option picked.
 *   `choices`  → every option picked, in the order the applicant gave them.
 *   `presence` → the single reserved key `PRESENCE_FACT_LOOKUP_KEY`.
 *   `numeric`  → none. A number is read by `bandFor`, never by a key.
 *
 * THE MULTI-PICK RULE, stated once here rather than at each reader: the bank's table is
 * read TOP TO BOTTOM and the FIRST row whose key the applicant picked wins. That makes
 * row order the operator's way of saying which answer outranks which — a table read in the
 * admin grid resolves the way it looks, which is the idiom `bandFor`, `factChoiceTable` and
 * `resolveMaxLoanByFact` already share. It is deliberately NOT "the first code the applicant
 * picked": pick order is an artefact of how the customer tapped, so it would make one
 * applicant's figure depend on something nobody decided, and it is NOT "the lowest figure",
 * because a key table's figures are not always money (a percentage, a multiplier) and
 * comparing them across units is meaningless.
 *
 * A fact with no candidate keys reads as unconfigured at a key-shaped reader rather than as
 * a miss: "this answer cannot be looked up in a table" is a shape mismatch the operator
 * fixes on the rule, not a customer who answered outside the bank's rows.
 */
import type { SurrogateFactValue } from '../types';

/**
 * The key a TEXT-backed fact is looked up by.
 *
 * One reserved key, because presence is the ONLY thing a text answer tells a bank. A bank
 * states its figure against this key and gets "they answered" — which is what makes a text
 * question usable as a fact at all without inventing keyword matching (A33).
 */
export const PRESENCE_FACT_LOOKUP_KEY = 'answered';

/** Every key this answer may be looked up by, in the order they should be tried. */
export function factLookupKeys(answer: SurrogateFactValue): readonly string[] {
  switch (answer.kind) {
    case 'choice':
      return [answer.optionCode];
    case 'choices':
      return answer.optionCodes;
    case 'presence':
      return [PRESENCE_FACT_LOOKUP_KEY];
    case 'numeric':
      return [];
  }
}

/** Whether a table row's key is one this answer can be read by. */
export function factAnswerHasKey(answer: SurrogateFactValue, key: string): boolean {
  return factLookupKeys(answer).includes(key);
}

/**
 * The first row of the bank's table this answer can be read by, in TABLE order.
 *
 * Table order, never answer order — see the multi-pick rule above.
 */
export function matchFactRow<T>(
  rows: readonly T[],
  answer: SurrogateFactValue,
  keyOf: (row: T) => string | undefined,
): T | undefined {
  const keys = factLookupKeys(answer);
  if (keys.length === 0) return undefined;
  return rows.find((row) => {
    const key = keyOf(row);
    return key !== undefined && keys.includes(key);
  });
}
