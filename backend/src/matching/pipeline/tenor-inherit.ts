/**
 * The loan duration a bank program quotes over, resolved through the surrogate product
 * its catalog name links to.
 *
 * The sibling of `income-rule-inherit.ts` and deliberately much smaller than it. The
 * income rule inherits STRUCTURE, figures, a debt-burden cap and one band slot, each on
 * its own terms; a duration is two integers and inherits whole or not at all.
 *
 * It runs in `toBankProgramSnapshot`, which is already the single Prisma-row → engine
 * snapshot mapping, so the engine receives one finished `TenorConfig` and cannot tell a
 * term the bank typed from one it is reading off the product.
 */

import type { TenorConfig } from '@/matching/types';

/**
 * A product's stated duration. Both months or neither — there is no half of this.
 *
 * A floor from the product and a ceiling from the bank is a range neither of them stated,
 * so the save paths on both sides refuse a half-stated pair and this type cannot express
 * one.
 */
export interface TenorDefaults {
  readonly minMonths: number;
  readonly maxMonths: number;
}

/**
 * A bank program's duration as it is STORED, which is not the same shape the engine reads.
 *
 * `minMonths`/`maxMonths` are optional here and required on `TenorConfig`, and the
 * asymmetry is the point: absent is how a program says "I state no duration of my own,
 * read the product's", and a snapshot is supposed to have been resolved by the time the
 * engine sees it. The per-applicant ceilings are carried through untouched.
 */
export type StoredTenor = Omit<TenorConfig, 'minMonths' | 'maxMonths'> & {
  readonly minMonths?: number;
  readonly maxMonths?: number;
};

/** A month nobody stated: absent, null, or not a finite number. */
function isBlankMonths(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value);
}

/**
 * Does this program state a duration of its own?
 *
 * ALL-OR-NOTHING, and a half-stated pair counts as STATED rather than blank. The save path
 * refuses that pair outright, so it should not exist — but if one ever reaches here, the
 * honest reading is "this bank tried to say something", and quietly completing it from the
 * product would hide the broken half behind a number that looks deliberate. Left alone it
 * surfaces as `tenor.minMonths` / `tenor.maxMonths` in `quoteProgram`'s problems, which is
 * a stated misconfiguration an operator can act on.
 */
export function statesOwnTenor(tenor: StoredTenor | undefined): boolean {
  if (tenor === undefined) return false;
  return !isBlankMonths(tenor.minMonths) || !isBlankMonths(tenor.maxMonths);
}

/**
 * The duration this program quotes over: its own when it states one, the product's when it
 * does not.
 *
 * The bank's own ALWAYS wins. This is a default, not a ceiling on what a bank may say —
 * `SCB-CAR-GREEN_POWER` lends over 120 months against a product that states 84, and that
 * is the case the whole mechanism exists to get right.
 *
 * NEVER a merge of the two sides. A min from one and a max from the other is a range
 * neither of them stated; see `statesOwnTenor`.
 *
 * The per-applicant ceilings (`maxMonthsByEmploymentType`, `maxMonthsByFact`) are the
 * bank's alone and are carried through in every branch. A blank grid there is a stated
 * "this bank does not cap by that", not "nobody has said yet" — the same distinction that
 * keeps `SLOTS_INHERITED_WHEN_BLANK` to one member.
 *
 * Returns the SAME object when nothing is inherited, so the common path — every program on
 * this platform today — allocates nothing and stays referentially stable, matching the
 * convention `income-rule-inherit.ts` follows throughout.
 *
 * Both sides blank returns the program's own shape UNCHANGED rather than inventing months.
 * A loan with no term cannot be priced, and `quoteProgram` already reports that as
 * `tenor.maxMonths`; filling in a guess here would turn "nobody has set this up" into a
 * number (FR-020).
 */
export function effectiveTenor(
  program: StoredTenor | undefined,
  productDefault: TenorDefaults | undefined,
): StoredTenor | undefined {
  if (program !== undefined && statesOwnTenor(program)) return program;
  if (productDefault === undefined) return program;
  return {
    ...(program ?? {}),
    minMonths: productDefault.minMonths,
    maxMonths: productDefault.maxMonths,
  };
}

/**
 * Read a product's stored `tenorDefaults` blob, or `undefined` when it states none.
 *
 * The ONE place the blob is given a shape, so no caller has to decide what a half-written
 * one means. A pair that is not two finite numbers reads as ABSENT rather than throwing:
 * this runs inside the map every quote is built from, and refusing to build the book
 * because one product's column is malformed would take down every other bank with it. The
 * program then falls through to its own duration, or to the stated misconfiguration.
 */
export function asTenorDefaults(raw: unknown): TenorDefaults | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const { minMonths, maxMonths } = raw as { minMonths?: unknown; maxMonths?: unknown };
  if (typeof minMonths !== 'number' || !Number.isFinite(minMonths)) return undefined;
  if (typeof maxMonths !== 'number' || !Number.isFinite(maxMonths)) return undefined;
  return { minMonths, maxMonths };
}
