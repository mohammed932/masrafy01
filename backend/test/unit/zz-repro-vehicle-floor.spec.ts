import { describe, expect, it } from 'vitest';
import { quoteProgram } from '../../src/matching/pipeline/quote';
import { eligibilityFixture, profileFixture, programFixture } from '../helpers/matching';

describe('REPRO: vehicle cap below program floor', () => {
  it('reports AGE_AT_MATURITY', () => {
    const program = programFixture({
      productCategory: 'car',
      tenor: {
        minMonths: 24,
        maxMonths: 84,
        maxMonthsByFact: {
          axes: [{ factKey: 'car_origin' }],
          cells: [{ keys: [{ key: 'china' }], value: '12' }],
          onNoMatch: 'useFallback',
        },
      },
      eligibility: eligibilityFixture({ maxAge: 60, acceptedLoanPurposes: ['car', 'personal'] }),
    });
    const profile = profileFixture({
      age: 34,
      preferredTenorMonths: 60,
      surrogateFacts: { car_origin: { kind: 'choice', optionCode: 'china' } },
    });
    const outcome = quoteProgram({ profile, program });
    console.log('OUTCOME:', JSON.stringify(outcome.ok ? { ok: true, tenor: outcome.quote.effectiveTenorMonths, binding: outcome.quote.bindingConstraint } : outcome.unavailable));
    expect(outcome.ok).toBe(false);
  });

  it('control: vehicle cap ABOVE floor quotes fine', () => {
    const program = programFixture({
      productCategory: 'car',
      tenor: {
        minMonths: 24,
        maxMonths: 84,
        maxMonthsByFact: {
          axes: [{ factKey: 'car_origin' }],
          cells: [{ keys: [{ key: 'china' }], value: '36' }],
          onNoMatch: 'useFallback',
        },
      },
      eligibility: eligibilityFixture({ maxAge: 60, acceptedLoanPurposes: ['car', 'personal'] }),
    });
    const profile = profileFixture({
      age: 34,
      preferredTenorMonths: 60,
      surrogateFacts: { car_origin: { kind: 'choice', optionCode: 'china' } },
    });
    const outcome = quoteProgram({ profile, program });
    console.log('CONTROL:', JSON.stringify(outcome.ok ? { ok: true, tenor: outcome.quote.effectiveTenorMonths, binding: outcome.quote.bindingConstraint } : outcome.unavailable));
    expect(outcome.ok).toBe(true);
  });
});
