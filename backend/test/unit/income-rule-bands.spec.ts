/**
 * T013 / FR-007 / FR-031 — half-open `[fromInclusive, toExclusive)` band lookup.
 *
 * The four properties that matter: the lower edge is IN, the upper edge is OUT,
 * the last band may run to +∞, and a value below the first edge is a stated
 * `no_matching_band` rather than a zero. Plus Decimal precision, because a band
 * edge is a decimal string and `Number` would round it.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { bandFor } from '@/matching/pipeline/income-rule-bands';
import type { IncomeBand } from '@/matching/types';

const YEARS: readonly IncomeBand[] = [
  { fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' },
  { fromInclusive: '5', toExclusive: '8', incomeEGP: '30000' },
  { fromInclusive: '8', toExclusive: null, incomeEGP: '45000' },
];

function incomeAt(value: string, bands: readonly IncomeBand[] = YEARS): string | null {
  const result = bandFor(new Decimal(value), bands);
  return result.matched ? result.incomeEGP.toString() : null;
}

describe('bandFor — edge inclusivity', () => {
  it('includes the lower edge', () => {
    expect(incomeAt('5')).toBe('30000');
    expect(incomeAt('8')).toBe('45000');
  });

  it('excludes the upper edge — the value belongs to the NEXT band', () => {
    // The whole point of half-open edges: `4.999…` is band 0, `5` is band 1, and
    // no value is ever in two bands.
    expect(incomeAt('4.9999')).toBe('12000');
    expect(incomeAt('5')).not.toBe('12000');
  });

  it('matches inside a band', () => {
    expect(incomeAt('0')).toBe('12000');
    expect(incomeAt('6')).toBe('30000');
    expect(incomeAt('7.5')).toBe('30000');
  });
});

describe('bandFor — the open-ended last band', () => {
  it('matches any value at or above its floor', () => {
    expect(incomeAt('8')).toBe('45000');
    expect(incomeAt('60')).toBe('45000');
    expect(incomeAt('999999999999')).toBe('45000');
  });

  it('reports no_matching_band when the last band is CLOSED and the value is past it', () => {
    const closed: IncomeBand[] = [{ fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' }];
    const result = bandFor(new Decimal('5'), closed);
    expect(result.matched).toBe(false);
    expect(result.matched === false && result.reason).toBe('no_matching_band');
  });
});

describe('bandFor — misses are stated, never substituted', () => {
  it('reports no_matching_band for a value below the first edge (FR-020)', () => {
    // Income bands need not start at zero: a value table may begin above a bank's
    // own floor, and below it the rule yields NOTHING — not a zero income, which
    // would read to the customer as "this bank thinks you earn nothing".
    const value: IncomeBand[] = [
      { fromInclusive: '100000', toExclusive: '500000', incomeEGP: '3000' },
      { fromInclusive: '500000', toExclusive: null, incomeEGP: '9000' },
    ];
    const result = bandFor(new Decimal('99999.99'), value);
    expect(result.matched).toBe(false);
    expect(result.matched === false && result.reason).toBe('no_matching_band');
  });

  it('reports no_bands for an absent or empty table', () => {
    expect(bandFor(new Decimal('5'), undefined)).toEqual({ matched: false, reason: 'no_bands' });
    expect(bandFor(new Decimal('5'), [])).toEqual({ matched: false, reason: 'no_bands' });
  });
});

describe('bandFor — Decimal, never Number', () => {
  it('keeps precision past what a double can hold', () => {
    const bands: IncomeBand[] = [
      { fromInclusive: '10000000000000000001', toExclusive: null, incomeEGP: '1' },
    ];
    // `Number('10000000000000000001')` is 10000000000000000000, so a Number-based
    // comparison would match the value one below the floor.
    expect(bandFor(new Decimal('10000000000000000000'), bands).matched).toBe(false);
    expect(bandFor(new Decimal('10000000000000000001'), bands).matched).toBe(true);
  });

  it('returns the income as an exact Decimal, not a rounded double', () => {
    const bands: IncomeBand[] = [
      { fromInclusive: '0', toExclusive: null, incomeEGP: '12345.67' },
    ];
    const result = bandFor(new Decimal('1'), bands);
    expect(result.matched && result.incomeEGP.toFixed(2)).toBe('12345.67');
  });

  it('compares fractional edges exactly', () => {
    const bands: IncomeBand[] = [
      { fromInclusive: '0', toExclusive: '0.3', incomeEGP: '100' },
      { fromInclusive: '0.3', toExclusive: null, incomeEGP: '200' },
    ];
    // 0.1 + 0.2 === 0.30000000000000004 in floats; as Decimal it is exactly 0.3
    // and therefore band 1.
    expect(incomeAt(new Decimal('0.1').plus('0.2').toString(), bands)).toBe('200');
  });
});

describe('bandFor — malformed rows degrade, never throw (Principle V)', () => {
  it('skips a band whose lower edge is not a decimal', () => {
    const bands: IncomeBand[] = [
      { fromInclusive: 'not-a-number', toExclusive: '5', incomeEGP: '1000' },
      { fromInclusive: '0', toExclusive: null, incomeEGP: '2000' },
    ];
    expect(incomeAt('1', bands)).toBe('2000');
  });

  it('treats a malformed UPPER edge as closed-and-unmatched, not as open-ended', () => {
    // Reading it as +∞ would hand this band every value above its floor, including
    // values the next band owns.
    const bands: IncomeBand[] = [
      { fromInclusive: '0', toExclusive: 'oops', incomeEGP: '1000' },
      { fromInclusive: '5', toExclusive: null, incomeEGP: '2000' },
    ];
    expect(incomeAt('1', bands)).toBeNull();
    expect(incomeAt('6', bands)).toBe('2000');
  });

  it('skips a band whose income is not a decimal', () => {
    const bands: IncomeBand[] = [
      { fromInclusive: '0', toExclusive: '5', incomeEGP: '' },
      { fromInclusive: '0', toExclusive: null, incomeEGP: '2000' },
    ];
    expect(incomeAt('1', bands)).toBe('2000');
  });
});

describe('bandFor — first match wins', () => {
  it('returns the FIRST matching band when two overlap', () => {
    // Overlap is rejected on save, but the normalizer produces it from the seeded
    // doctors table (`0–5` and `5–50` both claim year 5). First-match is what keeps
    // the canonical lookup byte-identical to the legacy `find` (FR-015).
    const overlapping: IncomeBand[] = [
      { fromInclusive: '0', toExclusive: '6', incomeEGP: '15000' },
      { fromInclusive: '5', toExclusive: '51', incomeEGP: '40000' },
    ];
    expect(incomeAt('5', overlapping)).toBe('15000');
    expect(bandFor(new Decimal('5'), overlapping)).toMatchObject({ index: 0 });
  });

  it('reports the matched band and its index for the check panel (FR-030)', () => {
    const result = bandFor(new Decimal('6'), YEARS);
    expect(result).toMatchObject({
      matched: true,
      index: 1,
      band: { fromInclusive: '5', toExclusive: '8' },
    });
  });
});
