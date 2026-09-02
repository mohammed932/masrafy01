/**
 * The additional-income policy, through the real quote — where the ORDER can go wrong.
 *
 * `additional-income.spec.ts` pins the arithmetic. What is pinned here is the position in the
 * pipeline, which is the half that fails silently:
 *
 *   · the counted extra reaches the debt-burden calculation at all;
 *   · the DBR BAND is chosen on the total. `dbrBands` are keyed by income, so an applicant
 *     whose rent carries them over a band edge must be capped on the band they land in. Read
 *     the other way round they are capped as the person they were before their rent counted,
 *     and nothing on any screen says so;
 *   · a bank that states no policy quotes exactly what it quoted before the feature existed.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';

import { quoteProgram } from '../../src/matching/pipeline/quote';
import type { Quote, QuoteOutcome, SurrogateFactValue } from '../../src/matching/types';
import { profileFixture, programFixture } from '../helpers/matching';

function expectQuoted(outcome: QuoteOutcome): Quote {
  if (!outcome.ok) throw new Error(`expected a quote, got ${outcome.unavailable.reason}`);
  return outcome.quote;
}

const numeric = (value: string): SurrogateFactValue => ({
  kind: 'numeric',
  value: new Decimal(value),
});

/** Rent at half, with the sheet's own ceiling of 100% of the basic figure. */
const RENT_AT_HALF = {
  sources: [{ factKey: 'rental_income_monthly', percent: '50' }],
  capPercentOfBasic: '100',
};

/** A salaried applicant on 20 000, asking for more than they can afford, so DBR binds. */
const applicant = (surrogateFacts: Record<string, SurrogateFactValue> = {}) =>
  profileFixture({
    requestedAmountEGP: new Decimal('3000000'),
    preferredTenorMonths: 60,
    employment: {
      employmentType: 'salaried',
      monthlyNetSalaryEGP: new Decimal('20000'),
      monthsInJob: 48,
      salaryTransferType: 'payroll_cat_a',
      companyName: 'Acme',
      companyType: 'private',
    },
    surrogateFacts,
  });

const program = (additionalIncome?: typeof RENT_AT_HALF, dbrBands?: unknown) =>
  programFixture({
    bankName: 'ABK Egypt',
    loanLimits: { minAmountEGP: '15000', maxAmountEGP: '3000000' },
    fees: { adminFeePercent: '0' },
    eligibility: {
      dbrCapPercent: '50.0000',
      ...(dbrBands ? { dbrBands } : {}),
    },
    incomeAssumption: {
      strategy: 'declared',
      ...(additionalIncome ? { additionalIncome } : {}),
    },
  });

describe('additional income reaches the quote', () => {
  it('lifts what the applicant can borrow by the counted share, and nothing more', () => {
    const without = expectQuoted(
      quoteProgram({ profile: applicant({ rental_income_monthly: numeric('8000') }), program: program() }),
    );
    const with_ = expectQuoted(
      quoteProgram({
        profile: applicant({ rental_income_monthly: numeric('8000') }),
        program: program(RENT_AT_HALF),
      }),
    );

    // 20 000 basic + 4 000 counted = 24 000, i.e. 20% more income and 20% more affordability.
    const ratio = with_.maxAffordableAmountEGP.div(without.maxAffordableAmountEGP);
    expect(ratio.toDecimalPlaces(4).toString()).toBe('1.2');
  });

  it('quotes the same figure as before the feature when the bank states no policy', () => {
    const stated = expectQuoted(
      quoteProgram({ profile: applicant({ rental_income_monthly: numeric('8000') }), program: program() }),
    );
    const silent = expectQuoted(
      quoteProgram({ profile: applicant(), program: program() }),
    );
    expect(stated.maxAffordableAmountEGP.toFixed(2)).toBe(silent.maxAffordableAmountEGP.toFixed(2));
  });

  it('chooses the debt-burden band on the TOTAL, not on the basic figure', () => {
    // The first band runs UP TO AND INCLUDING 23 000 (`resolveDbrCap` compares with `<=`).
    // The basic 20 000 sits inside it; 20 000 + 4 000 of counted rent does not.
    const bands = [
      { upToIncomeEGP: '23000', capPercent: '30.0000' },
      { upToIncomeEGP: null, capPercent: '50.0000' },
    ];
    const quote = expectQuoted(
      quoteProgram({
        profile: applicant({ rental_income_monthly: numeric('8000') }),
        program: program(RENT_AT_HALF, bands),
      }),
    );
    // 50%, not 30%: if this reads 30 the band was picked before the rent was counted.
    expect(quote.dbrCapPercent.toString()).toBe('50');
  });

  it('holds the extra to the bank ceiling', () => {
    // 80 000 of rent is 40 000 counted, against a basic of 20 000 and a 100% ceiling → 20 000.
    const quote = expectQuoted(
      quoteProgram({
        profile: applicant({ rental_income_monthly: numeric('80000') }),
        program: program(RENT_AT_HALF),
      }),
    );
    const doubled = expectQuoted(
      quoteProgram({
        profile: applicant({ rental_income_monthly: numeric('999999') }),
        program: program(RENT_AT_HALF),
      }),
    );
    // Both applicants are capped at twice the basic figure, however much rent they collect.
    expect(quote.maxAffordableAmountEGP.toFixed(2)).toBe(doubled.maxAffordableAmountEGP.toFixed(2));
  });
});
