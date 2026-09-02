/**
 * The rate BASIS — the difference between two products that print the same percentage.
 *
 * Spec §10.6: the four Arabic sheets say `DEC` (declining balance), the ten ABK sheets print
 * a bare percentage and say nothing, and the prototypes defaulted to flat. Reading a flat
 * sheet as declining offers the customer roughly a quarter more loan than the bank will
 * approve, so the figures below are pinned rather than described.
 *
 * Acceptance test 28: same instalment capacity, flat versus declining, 36 to 120 months.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';

import { calculateMaxLoanFromDbr } from '../../src/matching/pipeline/dbr';
import { calculateMonthlyInstallment, maxPrincipalRaw } from '../../src/matching/pipeline/pmt';
import { ceilingToIncome } from '../../src/matching/pipeline/product-rule-ceiling';
import { DEFAULT_RATE_BASIS, rateBasisOf } from '../../src/matching/pipeline/rate-basis';

const RATE = new Decimal(25);
const EMI = new Decimal(10_000);

/** What an instalment of 10 000 at 25% buys, to the pound, on each basis. */
const SHEET_FIGURES: { months: number; flat: number; reducing: number }[] = [
  { months: 36, flat: 205_714, reducing: 251_514 },
  { months: 60, flat: 266_667, reducing: 340_700 },
  { months: 84, flat: 305_455, reducing: 395_075 },
  { months: 96, flat: 320_000, reducing: 413_690 },
];

describe('rate basis', () => {
  it('reads absence as the reducing annuity, never as flat', () => {
    expect(DEFAULT_RATE_BASIS).toBe('reducing');
    expect(rateBasisOf(undefined)).toBe('reducing');
    expect(rateBasisOf({})).toBe('reducing');
    expect(rateBasisOf({ rateBasis: 'nonsense' })).toBe('reducing');
    expect(rateBasisOf({ rateBasis: 'flat' })).toBe('flat');
  });

  describe.each(SHEET_FIGURES)('at $months months', ({ months, flat, reducing }) => {
    it('buys the flat figure on a flat program', () => {
      const principal = maxPrincipalRaw(EMI, RATE, months, 'flat');
      expect(Math.round(principal.toNumber())).toBe(flat);
    });

    it('buys the declining figure on a reducing program', () => {
      const principal = maxPrincipalRaw(EMI, RATE, months, 'reducing');
      expect(Math.round(principal.toNumber())).toBeCloseTo(reducing, -1);
    });

    it('declining is 22-29% more loan than flat — the misquote §10.6 warns about', () => {
      const gap = (reducing - flat) / flat;
      expect(gap).toBeGreaterThan(0.22);
      expect(gap).toBeLessThan(0.3);
    });

    it('the instalment and its inverse agree on both bases', () => {
      for (const basis of ['flat', 'reducing'] as const) {
        const principal = maxPrincipalRaw(EMI, RATE, months, basis);
        const back = calculateMonthlyInstallment(principal, RATE, months, basis);
        expect(back.minus(EMI).abs().lessThan(new Decimal('0.01'))).toBe(true);
      }
    });
  });

  it('a flat program quotes a smaller loan from the same income and cap', () => {
    const args = {
      monthlyIncomeEGP: new Decimal(20_000),
      existingMonthlyObligationsEGP: new Decimal(0),
      dbrCapPercent: new Decimal(50),
      annualRatePercent: RATE,
      tenorMonths: 60,
    };
    const reducing = calculateMaxLoanFromDbr({ ...args, rateBasis: 'reducing' });
    const flat = calculateMaxLoanFromDbr({ ...args, rateBasis: 'flat' });

    // 10 000 of capacity — the SHEET_FIGURES row at 60 months.
    expect(Math.round(flat.toNumber())).toBe(266_667);
    expect(flat.lessThan(reducing)).toBe(true);
    // Omitting the basis must keep quoting what every stored program was priced at.
    expect(calculateMaxLoanFromDbr(args).equals(reducing)).toBe(true);
  });

  it('a collateral ceiling round-trips on a flat program', () => {
    // The ceiling → implied income → max loan round trip is why both directions live in
    // `pmt.ts`. On the wrong basis it comes back as a different amount from the bank table.
    const ceiling = new Decimal(2_000_000);
    const converted = ceilingToIncome({
      ceilingEGP: ceiling,
      annualRatePercent: RATE,
      tenorMonths: 84,
      baselineDbrPercent: new Decimal(50),
      rateBasis: 'flat',
    });
    expect(converted).not.toBeNull();

    const back = calculateMaxLoanFromDbr({
      monthlyIncomeEGP: converted!.recognisedIncomeEGP,
      existingMonthlyObligationsEGP: new Decimal(0),
      dbrCapPercent: new Decimal(50),
      annualRatePercent: RATE,
      tenorMonths: 84,
      rateBasis: 'flat',
    });
    expect(back.toFixed(2)).toBe(ceiling.toFixed(2));
  });

  it('the same ceiling read on the wrong basis is a different loan', () => {
    const ceiling = new Decimal(2_000_000);
    const flat = ceilingToIncome({
      ceilingEGP: ceiling,
      annualRatePercent: RATE,
      tenorMonths: 84,
      baselineDbrPercent: new Decimal(50),
      rateBasis: 'flat',
    });
    const reducing = ceilingToIncome({
      ceilingEGP: ceiling,
      annualRatePercent: RATE,
      tenorMonths: 84,
      baselineDbrPercent: new Decimal(50),
    });
    expect(flat!.installmentAtCeilingEGP.equals(reducing!.installmentAtCeilingEGP)).toBe(false);
  });
});
