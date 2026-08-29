/**
 * I-Score is applied BEFORE the DBR cap is chosen — and it is the position of the multiplier
 * INSIDE the rule that guarantees it, not an ordering somebody has to remember.
 *
 * Why it matters: the cap can itself depend on income (`dbrBands`). A multiplier applied at
 * program level would land AFTER `resolveDbrCap` had already picked a band from the
 * un-multiplied figure, and an applicant sitting near a band edge would be handed the wrong
 * cap. The compiler puts it inside the rule; this pins that it stays there.
 *
 * The case is the band edge itself, because that is the only place the two orders differ.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { compileTemplate, I_SCORE_FACT_KEY } from '@/matching/pipeline/product-template';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import type { ApplicantProfile, EligibilityConfig, IncomeAssumptionConfig } from '@/matching/types';

/** Table figure 46 000, multiplier 110% → 50 600, which is over the 50 000 edge. */
const rule = (): IncomeAssumptionConfig => {
  const compiled = compileTemplate({
    version: 1,
    outputKind: 'monthlyIncome',
    primary: { kind: 'choiceTable', fact: 'military_grade' },
    iScore: true,
    conditions: [],
  }) as unknown as IncomeAssumptionConfig;
  return {
    ...compiled,
    stepParams: {
      primary: { keyTable: [{ key: 'colonel', incomeEGP: '46000' }] },
      iscore_band: {
        bands: [
          { fromInclusive: '0', toExclusive: '700', incomeEGP: '100' },
          { fromInclusive: '700', toExclusive: null, incomeEGP: '110' },
        ],
      },
    },
  };
};

/** The cap changes at 50 000 — the whole point of the case. */
const eligibility = (over: Partial<EligibilityConfig> = {}): EligibilityConfig =>
  ({
    dbrCapPercent: '50.0000',
    dbrBands: [
      { upToIncomeEGP: '50000', capPercent: '40.0000' },
      { upToIncomeEGP: null, capPercent: '60.0000' },
    ],
    ...over,
  }) as unknown as EligibilityConfig;

const profile = (facts: Record<string, { kind: 'choice'; optionCode: string } | { kind: 'numeric'; value: Decimal }>, employmentType = 'private_sector_employee'): ApplicantProfile =>
  ({
    age: 35,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal('100000'),
    preferredTenorMonths: 36,
    priority: 'normal',
    employment: { employmentType, monthlyNetSalaryEGP: new Decimal('0') },
    obligations: {},
    assets: {},
    surrogateFacts: facts,
  }) as unknown as ApplicantProfile;

const colonel = { kind: 'choice' as const, optionCode: 'colonel' };

describe('I-Score lands before the DBR band is chosen', () => {
  it('picks the UPPER band, because 46 000 x 110% = 50 600 crosses the edge', () => {
    const out = resolveAssumedIncome({
      profile: profile({ military_grade: colonel, [I_SCORE_FACT_KEY]: { kind: 'numeric', value: new Decimal('720') } }),
      income: rule(),
      eligibility: eligibility(),
    });
    expect(out.incomeEGP.toString()).toBe('50600');
    // If this reads 40%, the multiplier was applied after the cap was resolved.
    expect(out.dbrCapPercent.toString()).toBe('60');
    expect(out.dbrBandIndex).toBe(1);
  });

  it('picks the LOWER band for the same applicant without a score', () => {
    const out = resolveAssumedIncome({
      profile: profile({ military_grade: colonel }),
      income: rule(),
      eligibility: eligibility(),
    });
    // 100% fallback: the figure is the table's, untouched, and it is under the edge.
    expect(out.incomeEGP.toString()).toBe('46000');
    expect(out.dbrCapPercent.toString()).toBe('40');
    expect(out.dbrBandIndex).toBe(0);
  });
});

describe('a cap that depends on who the applicant is', () => {
  it('beats the income bands, whatever they earn', () => {
    // `dbrCapPercentByEmploymentType` sits between the rule override and the income bands,
    // and that order IS the meaning: a bank stating both means "40% for the self-employed,
    // whatever they earn". The engine has honoured this since v18.1.0; until now nothing
    // could write it.
    const out = resolveAssumedIncome({
      profile: profile(
        { military_grade: colonel, [I_SCORE_FACT_KEY]: { kind: 'numeric', value: new Decimal('720') } },
        'business_owner_company_owner',
      ),
      income: rule(),
      eligibility: eligibility({ dbrCapPercentByEmploymentType: { self_employed: '40' } }),
    });
    expect(out.incomeEGP.toString()).toBe('50600');
    expect(out.dbrCapPercent.toString()).toBe('40');
    // Not a band choice: the bucket answered before the table was consulted.
    expect(out.dbrBandIndex).toBeNull();
  });

  it('leaves a salaried applicant on the income bands', () => {
    const out = resolveAssumedIncome({
      profile: profile({ military_grade: colonel, [I_SCORE_FACT_KEY]: { kind: 'numeric', value: new Decimal('720') } }),
      income: rule(),
      eligibility: eligibility({ dbrCapPercentByEmploymentType: { self_employed: '40' } }),
    });
    expect(out.dbrCapPercent.toString()).toBe('60');
    expect(out.dbrBandIndex).toBe(1);
  });
});
