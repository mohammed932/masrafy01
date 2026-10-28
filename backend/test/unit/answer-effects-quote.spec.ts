/**
 * Answer offer effects inside `quoteProgram` — the one place preview, apply and the loan
 * calculator all price an offer (v31.2.0, v31.3.0).
 *
 * Baseline (no effects): `programFixture` — 24% reducing, 6…84 months, max 1 000 000, DBR 50% —
 * quoted for `profileFixture` — 20 000 salary, 300 000 over 60 months.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { quoteProgram } from '../../src/matching/pipeline/quote';
import type { AnswerEffect } from '../../src/matching/pipeline/answer-effects';
import type { ApplicantProfile, BankProgramSnapshot, Quote } from '../../src/matching/types';
import { profileFixture, programFixture } from '../helpers/matching';

const NO_BANK_STATEMENT: AnswerEffect = {
  questionCode: 'has_bank_statement',
  optionCode: 'no',
  incomeProofOnly: true,
  maxLoanPercent: '-20',
  ratePoints: '2',
  maxTenorMonths: 48,
};

const UNDER_12_MONTHS: AnswerEffect = {
  questionCode: 'months_in_current_job',
  range: { fromInclusive: null, toExclusive: '12' },
  value: '6',
  incomeProofOnly: false,
  maxLoanPercent: '-10',
  ratePoints: '1',
};

function quote(
  profile: ApplicantProfile,
  program: BankProgramSnapshot = programFixture(),
  effects?: AnswerEffect[],
): Quote {
  const outcome = quoteProgram({
    profile: effects === undefined ? profile : { ...profile, answerEffects: effects },
    program,
  });
  if (!outcome.ok) throw new Error(`no figures: ${JSON.stringify(outcome.unavailable)}`);
  return outcome.quote;
}

/** An applicant whose income never binds, so the program's own cap is what decides. */
const RICH = (requested: string, tenor = 60): ApplicantProfile =>
  profileFixture({
    requestedAmountEGP: new Decimal(requested),
    preferredTenorMonths: tenor,
    employment: { ...profileFixture().employment, monthlyNetSalaryEGP: new Decimal('1000000') },
  } as never);

describe('no answer effects — the bank offer is untouched', () => {
  it('an empty effect list quotes byte-identically to no list at all', () => {
    const profile = profileFixture();
    const without = quoteProgram({ profile, program: programFixture() });
    const empty = quoteProgram({ profile: { ...profile, answerEffects: [] }, program: programFixture() });
    expect(empty).toEqual(without);
  });

  it('records no effects on the offer trace', () => {
    expect(quote(profileFixture()).cascadeTrace.answerEffects).toBeUndefined();
  });
});

describe('the rate', () => {
  it('"No bank statement" adds 2 points: 24% → 26%, and the instalment rises', () => {
    const base = quote(profileFixture());
    const moved = quote(profileFixture(), programFixture(), [NO_BANK_STATEMENT]);
    expect(base.effectiveRatePercent.toFixed(4)).toBe('24.0000');
    expect(moved.effectiveRatePercent.toFixed(4)).toBe('26.0000');
    expect(moved.monthlyInstallmentEGP.greaterThan(base.monthlyInstallmentEGP)).toBe(true);
  });
});

describe('the term', () => {
  it('a 48-month ceiling shortens a 60-month request to 48', () => {
    const moved = quote(profileFixture(), programFixture(), [NO_BANK_STATEMENT]);
    expect(moved.effectiveTenorMonths).toBe(48);
  });

  it('never lengthens a shorter request', () => {
    const profile = profileFixture({ preferredTenorMonths: 36 } as never);
    expect(quote(profile, programFixture(), [NO_BANK_STATEMENT]).effectiveTenorMonths).toBe(36);
  });

  it("never pushes the term under the program's floor", () => {
    const tooShort: AnswerEffect = { questionCode: 'q', incomeProofOnly: false, maxTenorMonths: 3 };
    expect(quote(profileFixture(), programFixture(), [tooShort]).effectiveTenorMonths).toBe(6);
  });
});

describe('the max loan', () => {
  it("a −20% effect cuts the program's 1 000 000 cap to 800 000", () => {
    const base = quote(RICH('950000'));
    const moved = quote(RICH('950000'), programFixture(), [
      { questionCode: 'q', incomeProofOnly: false, maxLoanPercent: '-20' },
    ]);
    expect(base.cashToCustomerEGP.toFixed(2)).toBe('950000.00');
    expect(moved.cashToCustomerEGP.toFixed(2)).toBe('800000.00');
    expect(moved.maxAffordableAmountEGP.toFixed(2)).toBe('800000.00');
  });

  it('a +10% effect raises it to 1 100 000 — the admin may beat the bank', () => {
    const base = quote(RICH('1050000'));
    const moved = quote(RICH('1050000'), programFixture(), [
      { questionCode: 'q', incomeProofOnly: false, maxLoanPercent: '10' },
    ]);
    expect(base.cashToCustomerEGP.toFixed(2)).toBe('1000000.00');
    expect(moved.cashToCustomerEGP.toFixed(2)).toBe('1050000.00');
    expect(moved.maxAffordableAmountEGP.toFixed(2)).toBe('1100000.00');
  });
});

describe('several effects at once', () => {
  it('caps compound, rate points add up, and the shortest term wins', () => {
    const moved = quote(RICH('950000'), programFixture(), [
      NO_BANK_STATEMENT, // −20%, +2, 48
      { ...UNDER_12_MONTHS, ratePoints: '-0.5' }, // −10%, −0.5
    ]);
    // 1 000 000 × 0.8 = 800 000; × 0.9 = 720 000.
    expect(moved.maxAffordableAmountEGP.toFixed(2)).toBe('720000.00');
    expect(moved.effectiveRatePercent.toFixed(4)).toBe('25.5000');
    expect(moved.effectiveTenorMonths).toBe(48);
  });

  it('records every effect it applied on the offer trace, in order', () => {
    const moved = quote(profileFixture(), programFixture(), [NO_BANK_STATEMENT, UNDER_12_MONTHS]);
    expect(moved.cascadeTrace.answerEffects).toEqual([NO_BANK_STATEMENT, UNDER_12_MONTHS]);
  });
});

describe('which programs an effect reaches', () => {
  const surrogate = programFixture({ programType: 'income_surrogate' } as never);

  it('an income-proof question never moves a no-payslip program', () => {
    const base = quoteProgram({ profile: profileFixture(), program: surrogate });
    const withEffect = quoteProgram({
      profile: { ...profileFixture(), answerEffects: [NO_BANK_STATEMENT] },
      program: surrogate,
    });
    expect(withEffect).toEqual(base);
  });

  it('a question asked on every program moves a no-payslip program too', () => {
    const moved = quote(profileFixture(), surrogate, [UNDER_12_MONTHS]);
    expect(moved.effectiveRatePercent.toFixed(4)).toBe('25.0000');
    expect(moved.cascadeTrace.answerEffects).toEqual([UNDER_12_MONTHS]);
  });

  it('on an income-proof program both reach it', () => {
    const moved = quote(profileFixture(), programFixture(), [NO_BANK_STATEMENT, UNDER_12_MONTHS]);
    expect(moved.effectiveRatePercent.toFixed(4)).toBe('27.0000');
  });
});
