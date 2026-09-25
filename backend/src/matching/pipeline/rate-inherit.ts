/**
 * The INTEREST RATE a bank program quotes at, resolved through the surrogate product its
 * catalog name links to.
 *
 * The third sibling of `tenor-inherit.ts` and `loan-amount-inherit.ts`, and deliberately
 * drawn from the same template: a price is a STATEMENT ABOUT THE PRODUCT rather than a
 * figure every operator retypes, a bank that prices differently states its own and wins,
 * and a malformed blob reads as absent rather than throwing inside the loop every quote is
 * built from.
 *
 * ONE STATEMENT, NOT THREE FIELDS, and this is where it differs from the two months and the
 * two amounts. Those inherit a PAIR whose halves are the same kind of thing; this inherits
 * a rate, the BASIS it is charged on, and — when the product prices off a reset rule — the
 * disclosure that goes with it. They travel together because a percentage on its own does
 * not say what the customer pays: the same rate over the same tenor buys 22–29% more loan
 * on a declining balance than flat (`rate-basis.ts`), and WHICH of the two figures prices
 * the loan is decided by `isVariableRate`. A rate from the product on a basis from the bank
 * is a price neither of them published.
 *
 * NOT THE RATE TABLES. Every `rateBy*` map and `rateByFact` grid sits ABOVE the flat rate in
 * `PRICING_CASCADE_ORDER`; this is the bottom of that cascade, and the tables stay the
 * bank's own (or the product's, through `plansSource` — `plan-inherit.ts`). A program priced
 * entirely by a table that refuses on no-match never reaches this figure at all, which is
 * why its save path does not demand one.
 *
 * It runs in `toBankProgramSnapshot`, which is already the single Prisma-row → engine
 * snapshot mapping, so the engine receives one finished `PricingConfig` and cannot tell a
 * rate the bank typed from one it is reading off the product.
 */

import type { PricingConfig } from '@/matching/types';
import type { RateBasis } from '@/matching/pipeline/rate-basis';

/**
 * A product's stated price: the rate, on the basis it is charged, with the disclosure when
 * it resets.
 *
 * `isVariableRate` selects which figure is the price — `currentEffectiveRatePercent` when it
 * is `true` and `baseRatePercent` when it is `false` — the same reading the pricing cascade
 * takes at its own bottom level, so the product and the program are priced by one rule.
 *
 * DECIMAL STRINGS, never numbers: a rate is read straight into `Prisma.Decimal` by
 * everything downstream (Principle I).
 */
export interface RateDefaults {
  readonly isVariableRate: boolean;
  /** The price when `isVariableRate` is `false`. Absent otherwise, never an empty string. */
  readonly baseRatePercent?: string;
  /** The price when `isVariableRate` is `true`. Absent otherwise. */
  readonly currentEffectiveRatePercent?: string;
  /** What the reset is tied to, for a variable rate. Never the price itself. */
  readonly variableRateNote?: string;
  /**
   * How the rate is charged. Absent reads as `reducing` through `rateBasisOf`, exactly as an
   * absent basis on a program does — never read this field directly.
   */
  readonly rateBasis?: RateBasis;
}

/**
 * A bank program's pricing as it is STORED, which is not quite the shape the engine reads.
 *
 * `isVariableRate` is required on `PricingConfig` and optional here, and the asymmetry is
 * the point: a row written before this field existed carries no answer, and a snapshot is
 * supposed to have been resolved by the time the engine sees it. Every table on the config
 * is carried through untouched — they are a different level of the cascade.
 */
export type StoredPricing = Omit<PricingConfig, 'isVariableRate'> & {
  readonly isVariableRate?: boolean;
  /**
   * The disclosure that goes with a variable rate. Stored on the blob and NOT on
   * `PricingConfig` — the engine prices off the figure and has never read this string — but
   * named here because it is part of the statement being inherited, and a merge that dropped
   * it would leave a product's reset rule behind while its rate moved.
   */
  readonly variableRateNote?: string;
};

/**
 * The keys the product's statement REPLACES, rather than merges with.
 *
 * Named once, here, because `effectiveRate` strips exactly these and `asRateDefaults` builds
 * exactly these — two lists would be two chances for a stale figure to survive a merge.
 */
const REPLACED_KEYS = [
  'isVariableRate',
  'baseRatePercent',
  'currentEffectiveRatePercent',
  'variableRateNote',
  'rateBasis',
] as const;

/** A rate nobody stated: absent, null, or an empty string. */
function isBlankRate(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === '';
}

/**
 * Does this program state a price of its own?
 *
 * ONE FIGURE DECIDES IT — the one its own `isVariableRate` selects — because that is the
 * one the cascade would quote. A program marked variable with a stale `baseRatePercent`
 * left behind is priced by `currentEffectiveRatePercent`, so a blank there is a blank price
 * however much is written in the other box; the save path refuses that combination on both
 * sides (`InvalidVariableRateConfigurationException`), so it should not exist, and reading
 * the OTHER box here would hide the broken half behind a number that looks deliberate.
 *
 * The TABLES are deliberately not consulted. A program priced by a grid still falls through
 * to this figure for anyone the grid does not cover unless it refuses on no-match, so
 * "has a table" is not "states a price" — `aRateGridPrices` is the separate question, asked
 * where it belongs, on the save path.
 */
export function statesOwnRate(pricing: StoredPricing | undefined): boolean {
  if (pricing === undefined) return false;
  return !isBlankRate(
    pricing.isVariableRate === true ? pricing.currentEffectiveRatePercent : pricing.baseRatePercent,
  );
}

/**
 * The price this program quotes at: its own when it states one, the product's when it does
 * not.
 *
 * The bank's own ALWAYS wins. This is a default, not a ceiling on what a bank may charge.
 *
 * NEVER a merge of the two sides. The whole statement is replaced — the flag, both figures,
 * the note and the basis — because half of it from each side is a price neither published:
 * a program left on `isVariableRate: false` by a wizard that no longer asks would otherwise
 * read the product's variable figure as a fixed one, or read nothing at all.
 *
 * The rate TABLES are carried through in every branch. They are a higher level of the
 * pricing cascade and are the bank's own statement (or the product's, by `plansSource`); a
 * blank one there is a stated "this bank does not price by that", not "nobody has said yet".
 *
 * ONE CONSEQUENCE, STATED: a programme that prices everyone by a table of its own and states
 * no flat rate takes the product's BASIS as well, because it states no price here for a basis
 * to qualify. Its table still wins the figure — the cascade reaches it first — but the
 * instalment is computed on the product's basis, which moves it by 22-29% if the two differ.
 * No programme in the book is in that state (the three that state no flat rate are all on
 * `plansSource: 'product'`, priced by the product's own plan table, where taking its basis is
 * exactly right), and a bank that wants its own basis says so by stating its own rate.
 *
 * Returns the SAME object when nothing is inherited, so the common path — every program on
 * this platform today — allocates nothing and stays referentially stable, matching the
 * convention its two siblings follow.
 *
 * Both sides blank returns the program's own shape UNCHANGED rather than inventing a rate.
 * A loan with no price cannot be quoted, and `quoteProgram` already reports that as
 * `pricing.baseRatePercent`; filling in a guess here would turn "nobody has set this up"
 * into a figure no bank published (FR-020).
 */
export function effectiveRate(
  program: StoredPricing | undefined,
  productDefault: RateDefaults | undefined,
): StoredPricing | undefined {
  if (program !== undefined && statesOwnRate(program)) return program;
  if (productDefault === undefined) return program;
  // The five keys are REMOVED before the product's are added, rather than overwritten. The
  // unused figure has to be gone rather than left behind: a program carrying a stale
  // `baseRatePercent` under a product that prices off a reset rule would quote the stale one
  // the moment the flag flipped. Same reason the wizard's own save clears the unused key.
  //
  // The BASIS goes with them, and that is not an oversight: it qualified a figure that is no
  // longer this program's price, and an absent basis reads as `reducing` through
  // `rateBasisOf` — what every program in the book was priced by.
  const tables: Record<string, unknown> = { ...(program ?? {}) };
  for (const key of REPLACED_KEYS) delete tables[key];
  return {
    ...(tables as Omit<StoredPricing, (typeof REPLACED_KEYS)[number]>),
    isVariableRate: productDefault.isVariableRate,
    ...(productDefault.baseRatePercent === undefined
      ? {}
      : { baseRatePercent: productDefault.baseRatePercent }),
    ...(productDefault.currentEffectiveRatePercent === undefined
      ? {}
      : { currentEffectiveRatePercent: productDefault.currentEffectiveRatePercent }),
    ...(productDefault.variableRateNote === undefined
      ? {}
      : { variableRateNote: productDefault.variableRateNote }),
    ...(productDefault.rateBasis === undefined ? {} : { rateBasis: productDefault.rateBasis }),
  };
}

/**
 * Read a product's stored `rateDefaults` blob, or `undefined` when it states none.
 *
 * The ONE place the blob is given a shape, so no caller has to decide what a half-written
 * one means. A blob whose selected figure is missing or malformed reads as ABSENT rather
 * than throwing: this runs inside the map every quote is built from, and refusing to build
 * the book because one product's column is malformed would take down every other bank with
 * it. The program then falls through to its own price, or to the stated misconfiguration.
 *
 * A NUMBER IS REFUSED, not coerced, exactly as `asLoanAmountDefaults` refuses one: a blob
 * carrying `24` instead of `"24.0000"` was written by something that does not know this is
 * a decimal, and accepting it would put the one float on a pricing path (Principle I).
 *
 * The UNUSED figure is dropped rather than carried. A blob that says `isVariableRate: true`
 * and still holds a `baseRatePercent` is a product mid-edit somewhere; keeping the stale box
 * would hand it to a program the moment the flag flipped back.
 */
export function asRateDefaults(raw: unknown): RateDefaults | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const {
    isVariableRate,
    baseRatePercent,
    currentEffectiveRatePercent,
    variableRateNote,
    rateBasis,
  } = raw as {
    isVariableRate?: unknown;
    baseRatePercent?: unknown;
    currentEffectiveRatePercent?: unknown;
    variableRateNote?: unknown;
    rateBasis?: unknown;
  };
  if (typeof isVariableRate !== 'boolean') return undefined;
  const price = isVariableRate ? currentEffectiveRatePercent : baseRatePercent;
  if (!isRateString(price)) return undefined;
  return {
    isVariableRate,
    ...(isVariableRate ? { currentEffectiveRatePercent: price } : { baseRatePercent: price }),
    ...(isVariableRate && typeof variableRateNote === 'string' && variableRateNote.trim() !== ''
      ? { variableRateNote }
      : {}),
    ...(rateBasis === 'flat' || rateBasis === 'reducing' ? { rateBasis } : {}),
  };
}

/** A non-empty string that `Prisma.Decimal` will accept: digits with at most one point. */
function isRateString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && /^\d+(\.\d+)?$/.test(value.trim());
}
