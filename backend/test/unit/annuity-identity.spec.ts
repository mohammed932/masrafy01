/**
 * The annuity round trip: PV(PMT(P, r, n), r, n) ≈ P.
 *
 * `calculateMonthlyInstallment` and `calculateMaxLoanFromDbr` are inverses of
 * each other — the first asks "what does this loan cost per month", the second
 * "what loan does this monthly payment buy". If they ever disagree, the
 * calculator and the offer cards start quoting different loans from the same
 * salary, and nothing else in the suite would catch it.
 *
 * Inputs are generated from a fixed-seed LCG rather than `Math.random`, so a
 * failure is reproducible from the seed alone.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { calculateMonthlyInstallment } from '../../src/matching/pipeline/pmt';
import { calculateMaxLoanFromDbr } from '../../src/matching/pipeline/dbr';
import { expectDecimalClose } from '../helpers/decimal';

/** Deterministic [0,1) generator — numeric-recipes LCG. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * The inversion, expressed the way the app uses it: an applicant whose whole
 * income may go to debt (cap 100%, no obligations) can afford exactly `payment`
 * per month, so the loan that payment buys is the present value.
 */
function presentValue(payment: Decimal, annualRatePercent: Decimal, tenorMonths: number): Decimal {
  return calculateMaxLoanFromDbr({
    monthlyIncomeEGP: payment,
    existingMonthlyObligationsEGP: new Decimal(0),
    dbrCapPercent: new Decimal(100),
    annualRatePercent,
    tenorMonths,
  });
}

describe('annuity identity', () => {
  it('recovers the principal across 50 random (amount, rate, tenor) triples', () => {
    const rand = lcg(20260804);

    for (let i = 0; i < 50; i++) {
      const principal = new Decimal(Math.round(10_000 + rand() * 4_990_000));
      const annualRate = new Decimal((1 + rand() * 39).toFixed(4)); // 1% … 40%
      const tenorMonths = 6 + Math.floor(rand() * 355); // 6 … 360 months

      const payment = calculateMonthlyInstallment(principal, annualRate, tenorMonths);
      const recovered = presentValue(payment, annualRate, tenorMonths);

      // The payment is rounded to the piastre before inversion, so the recovered
      // principal drifts by up to half a piastre per month of the term.
      const tolerance = new Decimal('0.01').mul(tenorMonths);
      expectDecimalClose(recovered, principal, tolerance);
    }
  });

  it('holds at a zero rate, where the annuity degenerates to amount ÷ tenor', () => {
    const principal = new Decimal('1200000');
    const payment = calculateMonthlyInstallment(principal, new Decimal(0), 60);

    expect(payment.toFixed(2)).toBe('20000.00');
    expect(presentValue(payment, new Decimal(0), 60).toFixed(2)).toBe('1200000.00');
  });

  it('is monotonic: the same payment buys more over a longer term', () => {
    const payment = new Decimal('20000');
    const rate = new Decimal('26');

    let previous = presentValue(payment, rate, 12);
    for (const tenor of [24, 36, 48, 60, 84, 120]) {
      const current = presentValue(payment, rate, tenor);
      expect(current.greaterThan(previous)).toBe(true);
      previous = current;
    }
  });

  it('is monotonic: the same payment buys less at a higher rate', () => {
    const payment = new Decimal('20000');

    let previous = presentValue(payment, new Decimal('1'), 60);
    for (const rate of ['5', '10', '18', '26', '35']) {
      const current = presentValue(payment, new Decimal(rate), 60);
      expect(current.lessThan(previous)).toBe(true);
      previous = current;
    }
  });
});
