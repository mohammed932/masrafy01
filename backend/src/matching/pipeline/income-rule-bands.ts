/**
 * Half-open income-band lookup. Pure, `Decimal`-only (Constitution Principle I).
 *
 * A band covers `[fromInclusive, toExclusive)`; `toExclusive: null` is the
 * open-ended last band. Edges are compared with `Decimal.gte` / `Decimal.lt` and
 * NEVER coerced through `Number` — a band edge arrives from JSONB as a decimal
 * string, and `Number('10000000000000000001')` is not that number.
 *
 * Two deliberate differences from the v14.0.0 numeric SCORING bands:
 *
 *   1. Income bands need not cover −∞…+∞. A bank's value table may legitimately
 *      start above zero (below its own floor the rule yields nothing), and a
 *      years table starting at 0 and running upward is already complete.
 *   2. A value below the first edge is therefore NOT an error and NOT a zero — it
 *      is `no_matching_band`, which FR-020 requires to be a stated reason. Zero
 *      would read to the customer as "this bank thinks you earn nothing".
 *
 * First match wins, and the list order is authoritative. That is what keeps the
 * lookup byte-identical to the legacy `incomeTable.find(...)` it replaces, whose
 * seeded rows overlap on year 5 (research R1, `income-rule-normalize.ts`).
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { IncomeBand } from '../types';

export type BandLookup =
  | { matched: true; band: IncomeBand; index: number; incomeEGP: Decimal }
  | { matched: false; reason: 'no_bands' | 'no_matching_band' };

/** Tolerant parse: a malformed edge is skipped rather than thrown (Principle V). */
function toDecimalOrNull(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The band a value falls in.
 *
 * Never throws: the engine cannot fail a match on bad configuration (Principle
 * V). A band whose edges or income cannot be parsed is skipped, so a single
 * hand-edited row degrades to "no matching band" for the values it covered
 * instead of taking the whole program's quote down.
 */
export function bandFor(value: Decimal, bands: readonly IncomeBand[] | undefined): BandLookup {
  if (!bands || bands.length === 0) return { matched: false, reason: 'no_bands' };

  for (const [index, band] of bands.entries()) {
    const from = toDecimalOrNull(band.fromInclusive);
    if (from === null) continue;
    if (value.lessThan(from)) continue;

    if (band.toExclusive !== null && band.toExclusive !== undefined) {
      const to = toDecimalOrNull(band.toExclusive);
      // A malformed upper edge is treated as closed-and-unmatched, not as
      // open-ended: reading it as +∞ would hand this band every value above its
      // floor, including ones a later band owns.
      if (to === null) continue;
      if (value.greaterThanOrEqualTo(to)) continue;
    }

    const income = toDecimalOrNull(band.incomeEGP);
    if (income === null) continue;
    return { matched: true, band, index, incomeEGP: income };
  }

  return { matched: false, reason: 'no_matching_band' };
}
