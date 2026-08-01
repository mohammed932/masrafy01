import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { resolveDbrCap } from '../../src/matching/pipeline/dbr';
import type { DbrBand } from '../../src/matching/types';

/** The band table from spec.md:126 — the one real banks actually publish. */
const BANDS: DbrBand[] = [
  { upToIncomeEGP: '5000', capPercent: '30.0000' },
  { upToIncomeEGP: '10000', capPercent: '35.0000' },
  { upToIncomeEGP: '20000', capPercent: '40.0000' },
  { upToIncomeEGP: '30000', capPercent: '45.0000' },
  { upToIncomeEGP: null, capPercent: '50.0000' },
];

const resolve = (income: string, bands?: DbrBand[]) =>
  resolveDbrCap({ dbrCapPercent: '50.0000', dbrBands: bands }, new Decimal(income));

describe('resolveDbrCap', () => {
  describe('inclusive upper bounds (FR-017)', () => {
    it.each([
      ['1', '30', 0],
      ['4999.99', '30', 0],
      // Exactly on a bound stays in the LOWER band — this is the whole point of
      // "inclusive", and the case a `<` would silently get wrong.
      ['5000', '30', 0],
      ['5000.01', '35', 1],
      ['10000', '35', 1],
      ['10000.01', '40', 2],
      ['20000', '40', 2],
      ['30000', '45', 3],
      ['30000.01', '50', 4],
      ['1000000', '50', 4],
    ])('income %s → cap %s%% (band %i)', (income, cap, index) => {
      const result = resolve(income, BANDS);
      expect(result.capPercent.toFixed(0)).toBe(cap);
      expect(result.bandIndex).toBe(index);
    });
  });

  describe('scalar fallback (FR-020 — existing programs keep working)', () => {
    it('uses the flat cap when no band table is present', () => {
      const result = resolve('17340');
      expect(result.capPercent.toFixed(4)).toBe('50.0000');
      expect(result.bandIndex).toBeNull();
    });

    it('uses the flat cap for an empty band table', () => {
      const result = resolve('17340', []);
      expect(result.capPercent.toFixed(4)).toBe('50.0000');
      expect(result.bandIndex).toBeNull();
    });

    it('falls back when the table has no open-ended band and income overflows it', () => {
      const truncated: DbrBand[] = [{ upToIncomeEGP: '5000', capPercent: '30.0000' }];
      const result = resolve('9000', truncated);
      expect(result.capPercent.toFixed(4)).toBe('50.0000');
      expect(result.bandIndex).toBeNull();
    });
  });

  it('treats a single open-ended band as a flat cap at index 0', () => {
    const result = resolve('17340', [{ upToIncomeEGP: null, capPercent: '42.0000' }]);
    expect(result.capPercent.toFixed(4)).toBe('42.0000');
    expect(result.bandIndex).toBe(0);
  });

  it('never throws on malformed rows (Principle V — bad config cannot fail a match)', () => {
    const malformed = [
      { upToIncomeEGP: 'not-a-number', capPercent: '30.0000' },
      { upToIncomeEGP: '10000', capPercent: 'oops' },
      { upToIncomeEGP: null, capPercent: '44.0000' },
    ] as DbrBand[];
    const result = resolve('8000', malformed);
    expect(result.capPercent.toFixed(4)).toBe('44.0000');
    expect(result.bandIndex).toBe(2);
  });

  it('resolves on RECOGNISED income, not declared (the ordering bug, quickstart.md:60)', () => {
    // Declared 20 400 at an 85% income assumption is recognised 17 340.
    // Resolving on declared would pick the ≤30 000 band (45%); recognised is
    // the ≤20 000 band (40%). Quoting 45% here overstates affordability.
    const declared = resolve('20400', BANDS);
    const recognised = resolve('17340', BANDS);
    expect(declared.capPercent.toFixed(0)).toBe('45');
    expect(recognised.capPercent.toFixed(0)).toBe('40');
  });
});
