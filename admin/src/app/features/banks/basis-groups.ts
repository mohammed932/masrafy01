import type { ProgramType } from '@core/income-basis';

/**
 * A program with just enough on it to be filed by income basis. Declared structurally
 * rather than as `BankProgramSummary` so the split can be exercised in a unit test
 * without building a whole wire row — and so a second caller with its own row type
 * (the programs list, should it ever group too) needs no adapter.
 */
export interface HasProgramType {
  programType?: ProgramType | null;
}

/** The basis a group is filed under. `unknown` is a real bucket — see `splitByBasis`. */
export type BasisGroupKey = ProgramType | 'unknown';

/**
 * Presentation order. Income proof first — it is what most desks read — then surrogate,
 * then anything the backend said nothing about. Fixed in code, never derived from the
 * data: a bank whose first program happens to be surrogate must not get a different
 * reading order from the bank next to it.
 */
export const BASIS_GROUP_ORDER: readonly BasisGroupKey[] = [
  'income_proof',
  'income_surrogate',
  'unknown',
];

/**
 * File programs under their income basis, in `BASIS_GROUP_ORDER`, dropping every group
 * that holds nothing.
 *
 * Two decisions worth stating. An absent or null `programType` lands under `unknown`
 * and is NEVER folded into `income_proof`: the field is optional on the wire, and
 * defaulting would state a fact nobody sent, on the safer-sounding side of the pair.
 * And an empty group is dropped rather than rendered empty — a heading over no cards
 * reads as a list that failed to load, and a bank selling one way only should see one
 * heading, not one plus an apology.
 *
 * Order within a group is the caller's, untouched.
 */
export function splitByBasis<T extends HasProgramType>(
  items: readonly T[],
): { key: BasisGroupKey; items: T[] }[] {
  return BASIS_GROUP_ORDER.map((key) => ({
    key,
    items: items.filter((p) => (p.programType ?? 'unknown') === key),
  })).filter((g) => g.items.length > 0);
}
