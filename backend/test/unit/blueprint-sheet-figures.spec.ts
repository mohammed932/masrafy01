/**
 * The published sheets, quoted through the rules the library compiles.
 *
 * These are the §13 acceptance figures of the surrogate-programs spec, and they are the only
 * test here that would catch the whole layer being subtly wrong: a blueprint can compile, pass
 * every validator, produce plausible steps, and still read the wrong column, band the wrong
 * way, or apply an adjustment in an order that moves the answer.
 *
 * Every number typed below is a BANK's figure, supplied here as that bank's `stepParams` —
 * which is exactly where it lives in production. No figure appears in a blueprint.
 */
import { describe, expect, it } from 'vitest';
import { compileTemplate, SLOT } from '@/matching/pipeline/product-template';
import { evaluateProductRule } from '@/matching/pipeline/product-rule';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import { productBlueprint } from '@/bank-programs/blueprints/product-blueprints';
import { resolveMaxLoanByFact } from '@/matching/pipeline/max-loan-by-fact';
import type { SurrogateFactValue } from '@/matching/types';
import { Decimal } from '@prisma/client/runtime/library';

const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });
const number = (value: string): SurrogateFactValue => ({
  kind: 'numeric',
  value: new Decimal(value),
});

function quote(
  blueprintKey: string,
  stepParams: ProductRule['stepParams'],
  facts: Record<string, SurrogateFactValue>,
  parentKeyByValue?: Record<string, string>,
): string | { miss: string } {
  const rule = compileTemplate(productBlueprint(blueprintKey)!.template!);
  const outcome = evaluateProductRule(
    { ...rule, stepParams },
    {
      facts,
      ...(parentKeyByValue ? { parentKeyByValue } : {}),
    },
  );
  return outcome.ok ? outcome.valueEGP.toString() : { miss: outcome.reason };
}

describe('§13.5 — armed forces, a table by grade', () => {
  it('quotes a Major the figure filed against that grade', () => {
    // The grade the sheet publishes and the seeded list did not have. `grade_major` is the
    // row key the library added; before it, this applicant had no row at all.
    expect(
      quote(
        'armed_forces_grades',
        {
          primary: {
            keyTable: [
              { key: 'grade_major_general', incomeEGP: '75000' },
              { key: 'grade_major', incomeEGP: '30000' },
              { key: 'grade_first_lieutenant', incomeEGP: '18000' },
            ],
          },
        },
        { military_grade: choice('grade_major') },
      ),
    ).toBe('30000');
  });

  it('reports a stated reason for a grade this bank left blank, never a zero', () => {
    expect(
      quote(
        'armed_forces_grades',
        { primary: { keyTable: [{ key: 'grade_major', incomeEGP: '30000' }] } },
        { military_grade: choice('grade_colonel') },
      ),
    ).toEqual({ miss: 'no_matching_row' });
  });
});

describe('§13.6 — professors, a table by rank with a second column', () => {
  const FIGURES = {
    // One sheet publishes one column; the other publishes government and private.
    primary: {
      keyTable: [
        { key: 'dean', incomeEGP: '100000' },
        { key: 'professor', incomeEGP: '50000' },
        { key: 'junior_staff', incomeEGP: '12000' },
      ],
    },
    [`${SLOT.primary}__uni_private`]: {
      keyTable: [
        { key: 'dean', incomeEGP: '300000' },
        { key: 'professor', incomeEGP: '150000' },
        { key: 'junior_staff', incomeEGP: '20000' },
      ],
    },
  };

  it.each([
    ['a Dean at a government university', 'dean', 'uni_government', '100000'],
    ['a Dean at a private one', 'dean', 'uni_private', '300000'],
    ['junior staff, government', 'junior_staff', 'uni_government', '12000'],
    ['junior staff, private', 'junior_staff', 'uni_private', '20000'],
  ])('quotes %s at %s', (_label, rank, university, expected) => {
    expect(
      quote('academic_rank_table', FIGURES, {
        academic_rank: choice(rank as string),
        university_type: choice(university as string),
      }),
    ).toBe(expected);
  });

  it('falls back to the standard column when the applicant was not asked', () => {
    // A column is not a requirement. The sheet with one column is the same product.
    expect(quote('academic_rank_table', FIGURES, { academic_rank: choice('professor') })).toBe(
      '50000',
    );
  });

  it('falls back to the standard column when this bank publishes only one', () => {
    expect(
      quote(
        'academic_rank_table',
        { primary: FIGURES.primary },
        { academic_rank: choice('dean'), university_type: choice('uni_private') },
      ),
    ).toBe('100000');
  });

  it('stops with a stated reason when a bank filled a column only half way', () => {
    // Worth pinning because it surprises: the columns are separate steps and every configured
    // one is evaluated, so a rank missing from the PRIVATE column stops the rule even for an
    // applicant the government column could price. That is the engine's existing posture —
    // a bank that stated a table is not quoted as though it had not — and the admin's
    // key-table editor is where it is caught, with its "N keys have no row" warning.
    //
    // The alternative would be worse: skipping a column a bank did fill would quote the other
    // one silently, which is a figure nobody authored for that customer.
    expect(
      quote(
        'academic_rank_table',
        {
          primary: FIGURES.primary,
          [`${SLOT.primary}__uni_private`]: {
            keyTable: [{ key: 'dean', incomeEGP: '300000' }],
          },
        },
        { academic_rank: choice('professor'), university_type: choice('uni_government') },
      ),
    ).toEqual({ miss: 'no_matching_row' });
  });
});

describe('§13.7 — a share of a competitor card limit', () => {
  it('halves a 60,000 limit into a 30,000 assumed income', () => {
    expect(
      quote(
        'card_limit_share',
        { primary: { scalar: { value: '50', unit: 'percent' } } },
        { credit_card_limit: number('60000') },
      ),
    ).toBe('30000');
  });
});

describe('§13.12 — doctors, half-open bands and a tier column', () => {
  // The sheet's own brackets, which the blueprint offers to the form.
  const EDGES = productBlueprint('years_in_practice_bands')!.suggestedBands![0]!.edges;
  const band = (incomes: string[]) => ({
    bands: EDGES.map((edge, index) => ({ ...edge, incomeEGP: incomes[index]! })),
  });
  const FIGURES = {
    primary: band(['30000', '60000', '80000', '120000', '180000', '300000']),
    [`${SLOT.primary}__city_tier_other`]: band([
      '20000',
      '40000',
      '55000',
      '80000',
      '120000',
      '200000',
    ]),
  };
  const FILED = { cairo: 'city_tier_major', tanta: 'city_tier_other' };

  it('puts EXACTLY five years in the 5–8 row, not in 3–5', () => {
    // The half-open convention, which is the whole reason the edges are stated as edges.
    expect(
      quote(
        'years_in_practice_bands',
        FIGURES,
        { years_in_practice: number('5'), property_governorate: choice('cairo') },
        FILED,
      ),
    ).toBe('60000');
  });

  it('reads the column of the TIER a governorate is filed under', () => {
    expect(
      quote(
        'years_in_practice_bands',
        FIGURES,
        { years_in_practice: number('12'), property_governorate: choice('tanta') },
        FILED,
      ),
    ).toBe('80000');
  });

  it('prices a governorate added to the list later with no bank edit at all', () => {
    // The point of a class-keyed column: a new value filed under an existing tier reads that
    // tier's figures on day one.
    expect(
      quote(
        'years_in_practice_bands',
        FIGURES,
        { years_in_practice: number('12'), property_governorate: choice('giza') },
        { ...FILED, giza: 'city_tier_major' },
      ),
    ).toBe('120000');
  });

  it('reports a stated reason below the first bracket, never a substituted zero', () => {
    expect(
      quote(
        'years_in_practice_bands',
        FIGURES,
        { years_in_practice: number('2'), property_governorate: choice('cairo') },
        FILED,
      ),
    ).toEqual({ miss: 'no_matching_band' });
  });

  it('caps the loan by tier and relationship, off the same one list', () => {
    // §13.21: the same applicant, Cairo then Tanta, on a new loan.
    const cap = productBlueprint('years_in_practice_bands')!.cap!;
    const config = {
      factKey: cap.factKey,
      columnFactKey: cap.columnFactKey!,
      rowVia: cap.rowVia!,
      onNoMatch: cap.onNoMatch,
      rows: [
        { rowKey: 'city_tier_major', columnKey: 'new_loan', maxAmountEGP: '1500000' },
        { rowKey: 'city_tier_major', columnKey: 'top_up', maxAmountEGP: '2000000' },
        { rowKey: 'city_tier_secondary', columnKey: 'new_loan', maxAmountEGP: '500000' },
        { rowKey: 'city_tier_other', columnKey: 'new_loan', maxAmountEGP: '500000' },
      ],
    };
    const cairo = resolveMaxLoanByFact({
      config,
      facts: { property_governorate: choice('cairo'), loan_is_topup: choice('new_loan') },
      parentKeyByValue: FILED,
    });
    const tanta = resolveMaxLoanByFact({
      config,
      facts: { property_governorate: choice('tanta'), loan_is_topup: choice('new_loan') },
      parentKeyByValue: FILED,
    });
    expect(cairo.matched && cairo.maxAmountEGP.toString()).toBe('1500000');
    expect(tanta.matched && tanta.maxAmountEGP.toString()).toBe('500000');
  });
});

describe('§13.9 + §13.8 — the compound guarantee, four ways and the lower of them', () => {
  const CLASSES = { mivida: 'compound_tier_aa', al_rehab: 'compound_tier_c' };
  const BY_CLASS = {
    primary: {
      keyTable: [
        { key: 'compound_tier_aa', incomeEGP: '6000000' },
        { key: 'compound_tier_c', incomeEGP: '2000000' },
      ],
    },
  };
  const BY_PAID = {
    [`${SLOT.alt}__unit_paid_to_date`]: { scalar: { value: '15', unit: 'percent' as const } },
  };
  const BY_UNIT_TYPE = {
    [`${SLOT.alt}__owned_unit_type`]: {
      keyTable: [
        { key: 'apartment', incomeEGP: '2000000' },
        { key: 'villa', incomeEGP: '4000000' },
      ],
    },
  };

  it('reads the class the compound is filed under', () => {
    // §13.8: pick Mivida → class AA → 6,000,000, off a table of six rows however many
    // compounds the list holds.
    expect(
      quote('compound_owner_ceiling', BY_CLASS, { compound_name: choice('mivida') }, CLASSES),
    ).toBe('6000000');
  });

  it('takes the LOWER when a bank fills two ways', () => {
    // §13.9: 15% of 20,000,000 paid is 3,000,000; the Villa ceiling is 4,000,000. The
    // customer gets 3,000,000.
    expect(
      quote(
        'compound_owner_ceiling',
        { ...BY_PAID, ...BY_UNIT_TYPE },
        {
          unit_paid_to_date: number('20000000'),
          owned_unit_type: choice('villa'),
        },
      ),
    ).toBe('3000000');
  });

  it('quotes the one way a bank filled, and never demands the answers of the others', () => {
    // A bank that only prices by class must not be refused because the applicant did not
    // state what they have paid.
    expect(
      quote('compound_owner_ceiling', BY_CLASS, { compound_name: choice('al_rehab') }, CLASSES),
    ).toBe('2000000');
  });

  it('halves the ceiling for a jointly owned unit, and only then', () => {
    const figures = {
      ...BY_PAID,
      [SLOT.shareOn]: { scalar: { value: '50', unit: 'percent' as const } },
    };
    const sole = quote('compound_owner_ceiling', figures, {
      unit_paid_to_date: number('20000000'),
      unit_joint_ownership: choice('joint_sole'),
    });
    const shared = quote('compound_owner_ceiling', figures, {
      unit_paid_to_date: number('20000000'),
      unit_joint_ownership: choice('joint_shared'),
    });
    expect(sole).toBe('3000000');
    expect(shared).toBe('1500000');
  });

  it('refuses an applicant who has not owned the unit long enough, naming why', () => {
    const rule = compileTemplate(productBlueprint('compound_owner_ceiling')!.template!);
    const outcome = evaluateProductRule(
      {
        ...rule,
        stepParams: { ...BY_PAID, cond__ownedlongenough: { minValue: '18' } },
      },
      {
        facts: {
          unit_paid_to_date: number('20000000'),
          unit_months_owned: number('6'),
        },
      },
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('gate_failed');
      expect(outcome.gates?.find((gate) => !gate.passed)?.reasonCode).toBe('CONTRACT_TOO_NEW');
    }
  });

  it('leaves that condition inert for a bank that did not turn it on', () => {
    // A gate applies only when the bank filled its figure — so one sheet's 18-month rule is
    // not silently applied to the three banks that publish no such condition.
    expect(
      quote('compound_owner_ceiling', BY_PAID, {
        unit_paid_to_date: number('20000000'),
        unit_months_owned: number('6'),
      }),
    ).toBe('3000000');
  });
});

describe('§13.10 — a ceiling by down-payment bracket, two columns', () => {
  it('quotes the bracket and the column the customer falls in', () => {
    const edges = productBlueprint('compound_owner_ceiling')!.suggestedBands!.find(
      (suggestion) => suggestion.wayIndex === 1,
    )!.edges;
    const rows = (amounts: string[]) => ({
      bands: edges.map((edge, index) => ({ ...edge, incomeEGP: amounts[index]! })),
    });
    const figures = {
      alt: rows(['750000', '1000000', '1250000', '1500000']),
      alt__top_up: rows(['1250000', '1500000', '1750000', '2000000']),
    };
    const ntb = quote('compound_owner_ceiling', figures, {
      unit_paid_to_date: number('1200000'),
      loan_is_topup: choice('new_loan'),
    });
    const xsell = quote('compound_owner_ceiling', figures, {
      unit_paid_to_date: number('1200000'),
      loan_is_topup: choice('top_up'),
    });
    expect(ntb).toBe('1250000');
    expect(xsell).toBe('1750000');
  });
});

describe('§13.22 — a cap with no calculation at all behind it', () => {
  it('caps a real-payslip applicant by how their employer is coded', () => {
    const cap = productBlueprint('company_coding_cap')!.cap!;
    const result = resolveMaxLoanByFact({
      config: {
        factKey: cap.factKey,
        onNoMatch: cap.onNoMatch,
        rows: [
          { rowKey: 'coding_cat_a', maxAmountEGP: '6000000' },
          { rowKey: 'coding_cat_b', maxAmountEGP: '1000000' },
          { rowKey: 'coding_cat_c', maxAmountEGP: '500000' },
        ],
      },
      facts: { employer_coding: choice('coding_cat_b') },
    });
    expect(result.matched && result.maxAmountEGP.toString()).toBe('1000000');
    expect(productBlueprint('company_coding_cap')!.template).toBeNull();
  });

  it('falls back to the program maximum for an answer with no row, never to no cap', () => {
    const result = resolveMaxLoanByFact({
      config: {
        factKey: 'employer_coding',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'coding_cat_a', maxAmountEGP: '6000000' }],
      },
      facts: { employer_coding: choice('coding_cat_c') },
    });
    expect(result).toEqual({
      matched: false,
      action: 'useProgramMax',
      reason: 'no_matching_row',
    });
  });
});
