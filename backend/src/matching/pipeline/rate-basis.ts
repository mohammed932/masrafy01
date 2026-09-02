/**
 * How a program's quoted rate is charged — reducing balance, or flat.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Every figure the engine has ever quoted was an annuity over a REDUCING balance: interest
 * on what is still owed, recomputed each month. That is what `pmt.ts` implements, and for
 * every sheet that says `DEC` it is right.
 *
 * The ten ABK sheets print a bare percentage and do not say which basis it is. A flat rate
 * charges interest on the ORIGINAL principal for the whole tenor, so the same instalment
 * buys a very different loan:
 *
 *   instalment 10 000/month, 25% per year
 *   ───────────────────────────────────────────────
 *    36 months   flat 205 714   reducing 251 514
 *    60 months   flat 266 667   reducing 340 700
 *    84 months   flat 305 455   reducing 395 075
 *    96 months   flat 320 000   reducing 413 690
 *
 * 22–29% of the loan amount, in the direction of offering MORE than the bank will approve
 * if a flat sheet is read as reducing. So the basis is a per-program setting, and a program
 * that does not state one keeps the behaviour every stored program was configured under.
 *
 * ─── Absent means reducing, and that is not a guess ───────────────────────────
 *
 * Every program in the book predates this field and every one of them was priced by the
 * reducing annuity. Reading absence as `reducing` is therefore what makes an untouched
 * program quote the same figure it quoted yesterday. A default of `flat` would silently
 * re-price the entire catalogue.
 *
 * An UNKNOWN string reads as `reducing` too — same reason, and it must never throw inside
 * a quote: a bad row would take out every program in the loop rather than the one that
 * carries it. The DTO refuses an unknown value at the boundary, which is where a typo is
 * fixable.
 */

/** The closed list. A third basis is a formula, not a label — see `pmt.ts`. */
export const RATE_BASES = ['reducing', 'flat'] as const;

export type RateBasis = (typeof RATE_BASES)[number];

/** What a program that states nothing is priced at. See the header. */
export const DEFAULT_RATE_BASIS: RateBasis = 'reducing';

export function isRateBasis(value: unknown): value is RateBasis {
  return typeof value === 'string' && (RATE_BASES as readonly string[]).includes(value);
}

/**
 * The one reader. Anything that is not exactly `'flat'` is the reducing annuity, so the
 * engine, the offer projection and the admin can never disagree about what a stored row
 * meant.
 */
export function rateBasisOf(pricing: { rateBasis?: string } | undefined | null): RateBasis {
  return pricing?.rateBasis === 'flat' ? 'flat' : DEFAULT_RATE_BASIS;
}
