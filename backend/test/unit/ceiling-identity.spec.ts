/**
 * Ceiling → income → max loan: the round trip, and the source design's golden vectors.
 *
 * A collateral product states a borrowing CEILING, not an income. The engine converts
 * it into the instalment that ceiling implies and lets the existing DBR machinery spend
 * it. Two properties make that conversion trustworthy, and this file is both of them:
 *
 *   1. **Lossless.** With no obligations and the applicable cap equal to the baseline
 *      the ceiling was calibrated against, the affordability ceiling comes back EXACTLY
 *      equal to the ceiling. Anything else means the conversion is inventing or losing
 *      money, and the customer is shown a figure the bank's own table contradicts.
 *
 *   2. **Closed form.** For every input, the four-step implementation equals
 *      `min(ceiling, ceiling × ratio − PV(obligations))` where `ratio = applicableCap ÷
 *      baselineCap`. That identity is derived by hand in §3.1 of the source design; a
 *      divergence is a bug in the step implementation, not in the identity.
 *
 * The expected figures in the golden-vector tables are the source document's own,
 * quoted to the EGP. They were produced by a separate prototype, so they are held to
 * ±1 EGP — not because our arithmetic is approximate (it is exact and asserted exactly
 * in the round-trip test) but because theirs was float.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { ceilingToIncome } from '../../src/matching/pipeline/product-rule-ceiling';
import { calculateMaxLoanFromDbr } from '../../src/matching/pipeline/dbr';
import { monthlyInstallmentRaw } from '../../src/matching/pipeline/pmt';

const TENOR = 60;

/** The affordability ceiling a collateral program yields, end to end. */
function maxLoanFor(args: {
  ceilingEGP: string;
  ratePercent: string;
  baselineDbrPercent: string;
  applicableDbrPercent: string;
  obligationsEGP: string;
  tenorMonths?: number;
}): Decimal {
  const tenorMonths = args.tenorMonths ?? TENOR;
  const converted = ceilingToIncome({
    ceilingEGP: new Decimal(args.ceilingEGP),
    annualRatePercent: new Decimal(args.ratePercent),
    tenorMonths,
    baselineDbrPercent: new Decimal(args.baselineDbrPercent),
  });
  if (converted === null) throw new Error('conversion refused');

  const uncapped = calculateMaxLoanFromDbr({
    monthlyIncomeEGP: converted.recognisedIncomeEGP,
    existingMonthlyObligationsEGP: new Decimal(args.obligationsEGP),
    dbrCapPercent: new Decimal(args.applicableDbrPercent),
    annualRatePercent: new Decimal(args.ratePercent),
    tenorMonths,
  });
  // The program maximum is clamped to the ceiling by `quoteProgram`; mirrored here so
  // the figure under test is the one a customer would be shown.
  const ceiling = new Decimal(args.ceilingEGP);
  return uncapped.greaterThan(ceiling) ? ceiling : uncapped;
}

/** Present value of an obligation stream — the source design's `PV(...)`. */
function presentValue(monthlyEGP: string, ratePercent: string, tenorMonths = TENOR): Decimal {
  return calculateMaxLoanFromDbr({
    monthlyIncomeEGP: new Decimal(monthlyEGP),
    existingMonthlyObligationsEGP: new Decimal(0),
    dbrCapPercent: new Decimal(100),
    annualRatePercent: new Decimal(ratePercent),
    tenorMonths,
  });
}

const BANKS = [
  { bank: 'ABK', ceilingEGP: '2000000', ratePercent: '25.5', installment: 59290, maxLoanB: 1662677 },
  { bank: 'EGBank', ceilingEGP: '2000000', ratePercent: '25', installment: 58703, maxLoanB: 1659300 },
  { bank: 'FABMISR', ceilingEGP: '1000000', ratePercent: '25', installment: 29351, maxLoanB: 659300 },
  { bank: 'CAE', ceilingEGP: '300000', ratePercent: '25', installment: 8805, maxLoanB: 0 },
] as const;

describe('ceiling → income conversion', () => {
  it('is lossless: no obligations and cap == baseline returns the ceiling EXACTLY', () => {
    for (const { bank, ceilingEGP, ratePercent } of BANKS) {
      const maxLoan = maxLoanFor({
        ceilingEGP,
        ratePercent,
        baselineDbrPercent: '50',
        applicableDbrPercent: '50',
        obligationsEGP: '0',
      });
      expect(maxLoan.toString(), bank).toBe(new Decimal(ceilingEGP).toString());
    }
  });

  it('is lossless at every tenor and cap the platform allows', () => {
    for (const tenorMonths of [6, 12, 36, 60, 84, 120]) {
      for (const cap of ['30', '40', '45', '50', '65']) {
        const maxLoan = maxLoanFor({
          ceilingEGP: '1750000',
          ratePercent: '23.75',
          baselineDbrPercent: cap,
          applicableDbrPercent: cap,
          obligationsEGP: '0',
          tenorMonths,
        });
        expect(maxLoan.toString(), `${tenorMonths}mo @ ${cap}%`).toBe('1750000');
      }
    }
  });

  it('reports the instalment the ceiling implies (source table A)', () => {
    for (const { bank, ceilingEGP, ratePercent, installment } of BANKS) {
      const converted = ceilingToIncome({
        ceilingEGP: new Decimal(ceilingEGP),
        annualRatePercent: new Decimal(ratePercent),
        tenorMonths: TENOR,
        baselineDbrPercent: new Decimal('50'),
      });
      expect(converted, bank).not.toBeNull();
      const drift = converted!.installmentAtCeilingEGP.minus(installment).abs();
      expect(drift.lessThanOrEqualTo(new Decimal('1')), `${bank} drift ${drift.toString()}`).toBe(true);
    }
  });

  it('refuses rather than substituting a figure', () => {
    const base = {
      ceilingEGP: new Decimal('1000000'),
      annualRatePercent: new Decimal('25'),
      tenorMonths: 60,
      baselineDbrPercent: new Decimal('50'),
    };
    expect(ceilingToIncome({ ...base, ceilingEGP: new Decimal(0) })).toBeNull();
    expect(ceilingToIncome({ ...base, ceilingEGP: new Decimal('-1') })).toBeNull();
    expect(ceilingToIncome({ ...base, tenorMonths: 0 })).toBeNull();
    expect(ceilingToIncome({ ...base, baselineDbrPercent: new Decimal(0) })).toBeNull();
    expect(ceilingToIncome({ ...base, baselineDbrPercent: new Decimal('101') })).toBeNull();
    expect(ceilingToIncome({ ...base, annualRatePercent: new Decimal('-1') })).toBeNull();
  });

  it('handles a zero rate without dividing by zero', () => {
    const maxLoan = maxLoanFor({
      ceilingEGP: '1200000',
      ratePercent: '0',
      baselineDbrPercent: '50',
      applicableDbrPercent: '50',
      obligationsEGP: '0',
    });
    expect(maxLoan.toString()).toBe('1200000');
  });
});

describe('golden vectors — source design §10', () => {
  it('table B: obligations of 10 000 a month, cap 50%', () => {
    for (const { bank, ceilingEGP, ratePercent, maxLoanB } of BANKS) {
      const maxLoan = maxLoanFor({
        ceilingEGP,
        ratePercent,
        baselineDbrPercent: '50',
        applicableDbrPercent: '50',
        obligationsEGP: '10000',
      });
      const drift = maxLoan.minus(maxLoanB).abs();
      expect(drift.lessThanOrEqualTo(new Decimal('1')), `${bank} drift ${drift.toString()}`).toBe(true);
    }
  });

  it('table C: CAE self-employed — the 40/50 cap haircut consumes the ceiling', () => {
    const maxLoan = maxLoanFor({
      ceilingEGP: '300000',
      ratePercent: '25',
      baselineDbrPercent: '50',
      applicableDbrPercent: '40',
      obligationsEGP: '10000',
    });
    expect(maxLoan.toString()).toBe('0');
    // Same applicant, salaried: still zero — CAE's ceiling is 8 805 a month against a
    // 10 000 obligation, so the cap variation is not what decides it.
    const salaried = maxLoanFor({
      ceilingEGP: '300000',
      ratePercent: '25',
      baselineDbrPercent: '50',
      applicableDbrPercent: '50',
      obligationsEGP: '10000',
    });
    expect(salaried.toString()).toBe('0');
  });

  it('a tighter applicable cap haircuts the ceiling in proportion', () => {
    // ABK's ceiling at a 40% cap against a 50% baseline: 80% of the ceiling.
    const maxLoan = maxLoanFor({
      ceilingEGP: '2000000',
      ratePercent: '25.5',
      baselineDbrPercent: '50',
      applicableDbrPercent: '40',
      obligationsEGP: '0',
    });
    expect(maxLoan.toString()).toBe('1600000');
  });
});

describe('closed form (§3.1) matches the step implementation', () => {
  const CASES = [
    { ceilingEGP: '2000000', ratePercent: '25.5', baseline: '50', applicable: '50', obligations: '0' },
    { ceilingEGP: '2000000', ratePercent: '25.5', baseline: '50', applicable: '50', obligations: '10000' },
    { ceilingEGP: '1000000', ratePercent: '25', baseline: '50', applicable: '40', obligations: '5000' },
    { ceilingEGP: '6000000', ratePercent: '19.75', baseline: '65', applicable: '45', obligations: '23500' },
    { ceilingEGP: '750000', ratePercent: '30', baseline: '40', applicable: '40', obligations: '1234.56' },
    { ceilingEGP: '300000', ratePercent: '25', baseline: '50', applicable: '40', obligations: '10000' },
    { ceilingEGP: '4500000', ratePercent: '0', baseline: '50', applicable: '50', obligations: '9000' },
  ] as const;

  it.each(CASES)(
    'ceiling $ceilingEGP @ $ratePercent% cap $applicable/$baseline obl $obligations',
    ({ ceilingEGP, ratePercent, baseline, applicable, obligations }) => {
      const stepwise = maxLoanFor({
        ceilingEGP,
        ratePercent,
        baselineDbrPercent: baseline,
        applicableDbrPercent: applicable,
        obligationsEGP: obligations,
      });

      const ratio = new Decimal(applicable).div(baseline);
      const closed = new Decimal(ceilingEGP)
        .mul(ratio)
        .minus(presentValue(obligations, ratePercent));
      const expected = Decimal.max(
        0,
        Decimal.min(new Decimal(ceilingEGP), closed),
      ).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);

      // Within a piastre: the two routes round in different places (the step route
      // rounds the reverse annuity once, the closed form rounds the present value).
      expect(stepwise.minus(expected).abs().lessThanOrEqualTo(new Decimal('0.02'))).toBe(true);
    },
  );

  it('the annuity round trip itself is lossless for arbitrary instalments', () => {
    for (const emi of ['1', '8805.4', '59290.35', '123456.78', '1000000']) {
      for (const rate of ['0', '18.5', '25.5', '30']) {
        const principal = presentValue(emi, rate);
        const back = monthlyInstallmentRaw(principal, new Decimal(rate), TENOR);
        expect(back.minus(new Decimal(emi)).abs().lessThanOrEqualTo(new Decimal('0.01')), `${emi}@${rate}`).toBe(true);
      }
    }
  });
});
