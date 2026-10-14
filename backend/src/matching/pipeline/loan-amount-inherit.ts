/**
 * The loan size a bank program lends between, resolved through the surrogate product its
 * catalog name links to.
 *
 * The sibling of `tenor-inherit.ts`, and deliberately its twin: a duration is two integers
 * and a size is two decimals, both inherit whole or not at all, and both are STATEMENTS
 * ABOUT THE PRODUCT rather than pairs every operator retypes. Everything that file says
 * about why the bank's own always wins, why a half-stated pair is left alone, and why a
 * malformed blob reads as absent applies here unchanged.
 *
 * It runs in `toBankProgramSnapshot`, which is already the single Prisma-row → engine
 * snapshot mapping, so the engine receives one finished `LoanLimitsConfig` and cannot tell
 * a size the bank typed from one it is reading off the product.
 */

import type { LoanLimitsConfig } from '@/matching/types';

/**
 * A product's stated loan size. Both amounts or neither — there is no half of this.
 *
 * DECIMAL STRINGS, never numbers: this is money (Principle I), and it is handed to
 * `Prisma.Decimal` unchanged by everything downstream.
 */
export interface LoanAmountDefaults {
  readonly minAmountEGP: string;
  readonly maxAmountEGP: string;
}

/**
 * A bank program's loan size as it is STORED, which is not the same shape the engine reads.
 *
 * `minAmountEGP`/`maxAmountEGP` are optional here and required on `LoanLimitsConfig`, and
 * the asymmetry is the point: absent is how a program says "I state no size of my own, read
 * the product's", and a snapshot is supposed to have been resolved by the time the engine
 * sees it. Every other ceiling on the config — the per-answer floor, the financed share,
 * the qualitative-review ceiling — is carried through untouched.
 */
export type StoredLoanLimits = Omit<LoanLimitsConfig, 'minAmountEGP' | 'maxAmountEGP'> & {
  readonly minAmountEGP?: string;
  readonly maxAmountEGP?: string;
};

/** An amount nobody stated: absent, null, or an empty string. */
function isBlankAmount(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/**
 * Does this program state a size of its own?
 *
 * ALL-OR-NOTHING, and a half-stated pair counts as STATED rather than blank — the same
 * reading `statesOwnTenor` takes, for the same reason. The save path refuses that pair
 * outright, so it should not exist; if one ever reaches here, quietly completing it from
 * the product would hide the broken half behind a number that looks deliberate. Left alone
 * it surfaces in `quoteProgram`'s problems, which is a stated misconfiguration an operator
 * can act on.
 */
export function statesOwnLoanAmounts(limits: StoredLoanLimits | undefined): boolean {
  if (limits === undefined) return false;
  return !isBlankAmount(limits.minAmountEGP) || !isBlankAmount(limits.maxAmountEGP);
}

/**
 * The size this program lends between: its own when it states one, the product's when it
 * does not.
 *
 * The bank's own ALWAYS wins. This is a default, not a ceiling on what a bank may say.
 *
 * NEVER a merge of the two sides. A floor from one and a ceiling from the other is a range
 * neither of them stated; see `statesOwnLoanAmounts`.
 *
 * `minAmountByFact` and every other table on the config are the bank's alone and are
 * carried through in every branch — a blank grid there is a stated "this bank does not
 * floor by that", not "nobody has said yet".
 *
 * Returns the SAME object when nothing is inherited, so the common path — every program on
 * this platform today — allocates nothing and stays referentially stable.
 *
 * Both sides blank returns the program's own shape UNCHANGED rather than inventing amounts:
 * a loan with no size cannot be quoted, and filling in a guess here would turn "nobody has
 * set this up" into a number (FR-020).
 */
export function effectiveLoanAmounts(
  program: StoredLoanLimits | undefined,
  productDefault: LoanAmountDefaults | undefined,
): StoredLoanLimits | undefined {
  if (program !== undefined && statesOwnLoanAmounts(program)) return program;
  if (productDefault === undefined) return program;
  return {
    ...(program ?? {}),
    minAmountEGP: productDefault.minAmountEGP,
    maxAmountEGP: productDefault.maxAmountEGP,
  };
}

/**
 * Read a product's stored `loanAmountDefaults` blob, or `undefined` when it states none.
 *
 * The ONE place the blob is given a shape, so no caller has to decide what a half-written
 * one means. A pair that is not two parseable decimal strings reads as ABSENT rather than
 * throwing: this runs inside the map every quote is built from, and refusing to build the
 * book because one product's column is malformed would take down every other bank with it.
 *
 * A NUMBER IS REFUSED, not coerced. Money is stored as a string on this platform, and a
 * blob carrying `1000000` instead of `"1000000"` was written by something that does not
 * know that — accepting it would let the one float onto a money path (Principle I) and
 * would make the column's contract unenforceable.
 */
export function asLoanAmountDefaults(raw: unknown): LoanAmountDefaults | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const { minAmountEGP, maxAmountEGP } = raw as {
    minAmountEGP?: unknown;
    maxAmountEGP?: unknown;
  };
  if (!isDecimalString(minAmountEGP) || !isDecimalString(maxAmountEGP)) return undefined;
  return { minAmountEGP, maxAmountEGP };
}

/** A non-empty string that `Prisma.Decimal` will accept: digits with at most one point. */
function isDecimalString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()) && value.trim() !== '';
}
