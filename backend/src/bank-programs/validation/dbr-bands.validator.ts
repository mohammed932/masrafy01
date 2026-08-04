import { Prisma } from '@prisma/client';
import type { DbrBand } from '@/matching/types';

/**
 * Feature 010 — DBR band table validation (FR-016, FR-017, FR-019).
 *
 * A band table is an ordered list of income bands. Each band carries an
 * INCLUSIVE upper bound on recognised monthly income plus the DBR cap that
 * applies at or below it. The final band is open-ended (`upToIncomeEGP: null`).
 *
 * Rules:
 *   - at least one band
 *   - bounds strictly ascending, no duplicates, no gaps (contiguity is implied
 *     by "inclusive upper bound + ordered list", so ascending == gapless)
 *   - exactly one open-ended band, and it MUST be last
 *   - every cap percentage in [1, 100]
 *
 * A band table is authored on the bank program itself (`eligibility.dbrBands`),
 * so this is the single implementation the bank-program service calls.
 */

export type DbrBandsViolation =
  | { kind: 'invalid'; reason: DbrBandsInvalidReason; index: number | null }
  | { kind: 'capOutOfRange'; index: number; capPercent: string };

export type DbrBandsInvalidReason =
  | 'EMPTY'
  | 'NOT_ASCENDING'
  | 'DUPLICATE_BOUND'
  | 'MISSING_OPEN_ENDED_BAND'
  | 'OPEN_ENDED_BAND_NOT_LAST'
  | 'MULTIPLE_OPEN_ENDED_BANDS'
  | 'BOUND_NOT_DECIMAL'
  | 'CAP_NOT_DECIMAL';

const CAP_MIN = new Prisma.Decimal('1');
const CAP_MAX = new Prisma.Decimal('100');

/** Returns the first violation, or `undefined` when the table is valid. */
export function validateDbrBands(bands: DbrBand[] | undefined): DbrBandsViolation | undefined {
  if (bands === undefined) return undefined;
  if (bands.length === 0) return { kind: 'invalid', reason: 'EMPTY', index: null };

  let previousBound: Prisma.Decimal | null = null;
  let openEndedIndex: number | null = null;

  for (const [index, band] of bands.entries()) {
    let cap: Prisma.Decimal;
    try {
      cap = new Prisma.Decimal(band.capPercent);
    } catch {
      return { kind: 'invalid', reason: 'CAP_NOT_DECIMAL', index };
    }
    if (cap.lessThan(CAP_MIN) || cap.greaterThan(CAP_MAX)) {
      return { kind: 'capOutOfRange', index, capPercent: band.capPercent };
    }

    if (band.upToIncomeEGP === null) {
      if (openEndedIndex !== null) {
        return { kind: 'invalid', reason: 'MULTIPLE_OPEN_ENDED_BANDS', index };
      }
      openEndedIndex = index;
      continue;
    }

    // A bounded band after the open-ended one can never be reached.
    if (openEndedIndex !== null) {
      return { kind: 'invalid', reason: 'OPEN_ENDED_BAND_NOT_LAST', index: openEndedIndex };
    }

    let bound: Prisma.Decimal;
    try {
      bound = new Prisma.Decimal(band.upToIncomeEGP);
    } catch {
      return { kind: 'invalid', reason: 'BOUND_NOT_DECIMAL', index };
    }
    if (previousBound !== null) {
      if (bound.equals(previousBound)) {
        return { kind: 'invalid', reason: 'DUPLICATE_BOUND', index };
      }
      if (bound.lessThan(previousBound)) {
        return { kind: 'invalid', reason: 'NOT_ASCENDING', index };
      }
    }
    previousBound = bound;
  }

  if (openEndedIndex === null) {
    return { kind: 'invalid', reason: 'MISSING_OPEN_ENDED_BAND', index: null };
  }
  return undefined;
}
