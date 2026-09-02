/**
 * Money earned beside the basic figure, counted at the bank's own weight (spec §10.11).
 *
 * The sheet this exists for states four weights and one ceiling:
 *
 *   rents 50% · certificate returns 75% · fixed allowances 100% · variable 75%
 *   and the total may not exceed 100% of the basic income
 *
 * What is worth pinning, in order of how expensive getting it wrong is:
 *
 *   · the CEILING is a share of the basic figure, and it binds. Without it a bank that
 *     counts rent doubles the income of anyone with a large enough property.
 *   · an unanswered source contributes nothing and never a refusal. Every one of these
 *     questions is optional; treating a blank as missing would refuse every applicant who
 *     has no rent, which is most of them.
 *   · the ORDER against the debt-burden band. `dbrBands` are keyed by income, so a figure
 *     that crosses a band edge because of counted rent must be capped on the band it lands
 *     in, not the one it started in.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';

import {
  additionalIncomeFactKeys,
  resolveAdditionalIncome,
  type AdditionalIncomeConfig,
} from '../../src/matching/pipeline/additional-income';
import type { SurrogateFactValue } from '../../src/matching/types';

const num = (value: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(value) });

/** The Arabic COMPOUND sheet, as written. */
const SHEET: AdditionalIncomeConfig = {
  sources: [
    { factKey: 'rental_income_monthly', percent: '50' },
    { factKey: 'cd_returns_monthly', percent: '75' },
    { factKey: 'fixed_allowances_monthly', percent: '100' },
    { factKey: 'variable_allowances_monthly', percent: '75' },
  ],
  capPercentOfBasic: '100',
};

function resolve(
  facts: Record<string, SurrogateFactValue>,
  basic: string,
  config: AdditionalIncomeConfig = SHEET,
) {
  return resolveAdditionalIncome({ config, facts, basicIncomeEGP: new Decimal(basic) });
}

describe('additional income', () => {
  it('counts each source at its own weight', () => {
    // 10 000 rent → 5 000 · 4 000 CD → 3 000 · 2 000 fixed → 2 000 · 4 000 variable → 3 000
    const out = resolve(
      {
        rental_income_monthly: num('10000'),
        cd_returns_monthly: num('4000'),
        fixed_allowances_monthly: num('2000'),
        variable_allowances_monthly: num('4000'),
      },
      '50000',
    );
    expect(out.weightedEGP.toString()).toBe('13000');
    expect(out.addedEGP.toString()).toBe('13000');
    expect(out.capped).toBe(false);
    expect(out.counted).toHaveLength(4);
  });

  it('holds the total to the bank ceiling, measured on the basic figure', () => {
    // 60 000 of rent is 30 000 counted, against a basic of 20 000 and a 100% ceiling.
    const out = resolve({ rental_income_monthly: num('60000') }, '20000');
    expect(out.weightedEGP.toString()).toBe('30000');
    expect(out.addedEGP.toString()).toBe('20000');
    expect(out.capped).toBe(true);
  });

  it('adds nothing for a source the applicant left blank', () => {
    const out = resolve({ cd_returns_monthly: num('4000') }, '50000');
    expect(out.addedEGP.toString()).toBe('3000');
    expect(out.counted.map((c) => c.factKey)).toEqual(['cd_returns_monthly']);
  });

  it('adds nothing, and refuses nothing, when the applicant answered none of them', () => {
    const out = resolve({}, '50000');
    expect(out.addedEGP.toString()).toBe('0');
    expect(out.capped).toBe(false);
  });

  it('adds nothing when the bank states no policy', () => {
    const out = resolveAdditionalIncome({
      config: undefined,
      facts: { rental_income_monthly: num('10000') },
      basicIncomeEGP: new Decimal('50000'),
    });
    expect(out.addedEGP.toString()).toBe('0');
  });

  it('counts everything when the bank states no ceiling', () => {
    const { capPercentOfBasic: _dropped, ...uncapped } = SHEET;
    const out = resolve({ rental_income_monthly: num('60000') }, '20000', uncapped);
    expect(out.addedEGP.toString()).toBe('30000');
    expect(out.capped).toBe(false);
  });

  it('ignores a choice answer rather than reading an option code as money', () => {
    const out = resolve(
      { rental_income_monthly: { kind: 'choice', optionCode: 'yes' } },
      '50000',
    );
    expect(out.addedEGP.toString()).toBe('0');
  });

  it('counts nothing for a weight outside (0, 100] — the direction that cannot over-quote', () => {
    const out = resolve({ rental_income_monthly: num('10000') }, '50000', {
      sources: [{ factKey: 'rental_income_monthly', percent: '150' }],
    });
    expect(out.addedEGP.toString()).toBe('0');
  });

  it('rounds each source to piastres, once, with banker rounding', () => {
    // 1 234.57 at 75% = 925.9275 → 925.93 (half-even on the hundredth).
    const out = resolve({ cd_returns_monthly: num('1234.57') }, '50000');
    expect(out.addedEGP.toString()).toBe('925.93');
  });

  it('reports every fact it reads, so the check panel can ask for them', () => {
    expect(additionalIncomeFactKeys(SHEET)).toEqual([
      'rental_income_monthly',
      'cd_returns_monthly',
      'fixed_allowances_monthly',
      'variable_allowances_monthly',
    ]);
    expect(additionalIncomeFactKeys(undefined)).toEqual([]);
  });
});
