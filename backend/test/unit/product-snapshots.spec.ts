/**
 * Every live no-payslip product, quoted from its STORED form and figures (a static snapshot,
 * `fixtures/product-snapshots.ts`), through the same compiler and engine the platform runs.
 *
 * Two things per product:
 *   1. its form is valid and every figure it stores still has a box to live in (no orphans);
 *   2. sample applicants get the amounts the figures say — worked out by hand from the
 *      tables, not by running the engine and copying what it printed.
 *
 * A change to a live product is expected to fail here until the snapshot and the expected
 * amounts are updated together — that is the point: every money move is a reviewed edit.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  compileTemplate,
  templateParamKeys,
  validateTemplate,
} from '@/matching/pipeline/product-template';
import { evaluateProductRule } from '@/matching/pipeline/product-rule';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import { stripUnchosenWays } from '@/matching/pipeline/income-rule-inherit';
import type { IncomeAssumptionConfig, SurrogateFactValue } from '@/matching/types';
import { PRODUCT_SNAPSHOTS, SHARED_CLASSES } from './fixtures/product-snapshots';

const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });
const number = (value: string): SurrogateFactValue => ({
  kind: 'numeric',
  value: new Decimal(value),
});

type Facts = Record<string, SurrogateFactValue>;
type Outcome = string | { miss: string; gate?: string };

/** One product, one applicant, one way (as a bank program that sells that way would quote). */
function quote(key: string, facts: Facts, wayId?: string): Outcome {
  const snap = PRODUCT_SNAPSHOTS[key];
  if (!snap) throw new Error(`no snapshot for ${key}`);
  const compiled = compileTemplate(snap.template) as unknown as IncomeAssumptionConfig;
  const config = { ...compiled, stepParams: snap.stepParams, ...(wayId ? { wayId } : {}) };
  const rule = stripUnchosenWays(config, config) as unknown as ProductRule;
  const out = evaluateProductRule(rule, { facts, parentKeyByValue: SHARED_CLASSES });
  if (out.ok) return out.valueEGP.toString();
  return {
    miss: out.reason,
    ...(out.gateReasonCode !== undefined ? { gate: out.gateReasonCode } : {}),
  };
}

describe('every live product: a valid form, and no figure without a box', () => {
  for (const [key, snap] of Object.entries(PRODUCT_SNAPSHOTS)) {
    it(key, () => {
      expect(validateTemplate(snap.template)).toBeUndefined();
      const boxes = new Set(templateParamKeys(snap.template));
      const orphans = Object.keys(snap.stepParams).filter((id) => !boxes.has(id));
      expect(orphans).toEqual([]);
      expect((compileTemplate(snap.template).steps ?? []).length).toBeGreaterThan(0);
    });
  }
});

describe('Egyptian Armed Forces — a monthly income by grade', () => {
  it('a Colonel counts as earning 45,000', () => {
    expect(quote('armed_forces_grades', { military_grade: choice('grade_colonel') })).toBe('45000');
  });
  it('a Major General counts as earning 75,000', () => {
    expect(quote('armed_forces_grades', { military_grade: choice('grade_major_general') })).toBe(
      '75000',
    );
  });
});

describe('University Professors — by rank, a column per university type', () => {
  it('a professor at a private university: 150,000', () => {
    expect(
      quote('academic_rank_table', {
        academic_rank: choice('professor'),
        university_type: choice('uni_private'),
      }),
    ).toBe('150000');
  });
  it('a lecturer at a government university: 35,000', () => {
    expect(
      quote('academic_rank_table', {
        academic_rank: choice('lecturer'),
        university_type: choice('uni_government'),
      }),
    ).toBe('35000');
  });
});

describe('Doctors — Clinic Owners — years by range, a column per governorate group', () => {
  const doctor = (years: string, governorate: string) =>
    quote('doctors_clinic_owner', {
      years_in_practice: number(years),
      practice_governorate: choice(governorate),
    });
  it('9 years in Cairo (main group): 134,000', () => {
    expect(doctor('9', 'cairo')).toBe('134000');
  });
  it('9 years in Giza (second group, same figures): 134,000', () => {
    expect(doctor('9', 'giza')).toBe('134000');
  });
  it('9 years in Aswan (rest of Egypt): 100,000', () => {
    expect(doctor('9', 'aswan')).toBe('100000');
  });
  it('15 years and up in Aswan: 240,000', () => {
    expect(doctor('22', 'aswan')).toBe('240000');
  });
  it('under 2 years falls in no range', () => {
    expect(doctor('1', 'cairo')).toEqual({ miss: 'no_matching_band' });
  });
});

describe('Doctors — In Practice — no default amounts (each bank states its own)', () => {
  it('quotes nothing from the product alone', () => {
    expect(
      quote('doctors_in_practice', {
        years_in_practice: number('6'),
        hospital_sector: choice('private_hospital'),
      }),
    ).toEqual({ miss: 'rule_unconfigured' });
  });
});

describe('PL Cross Sell to Credit Card — half the card limit', () => {
  it('a 100,000 limit counts as 50,000', () => {
    expect(quote('card_limit_share', { credit_card_limit: number('100000') })).toBe('50000');
  });
});

describe('PL Cross Sell to Auto Loan — both ways, the lower wins', () => {
  it('3 × an 8,000 instalment (24,000) beats 10% of 500,000 (50,000)', () => {
    expect(
      quote('auto_loan_crosssell', {
        car_loan_installment: number('8000'),
        auto_loan_amount: number('500000'),
        car_loan_original_tenor: number('60'),
        car_loan_instalments_paid: number('30'),
        car_loan_down_payment: number('200000'),
      }),
    ).toBe('24000');
  });
  it('10% of a 150,000 loan (15,000) beats 3 × 8,000', () => {
    expect(
      quote('auto_loan_crosssell', {
        car_loan_installment: number('8000'),
        auto_loan_amount: number('150000'),
        car_loan_original_tenor: number('60'),
        car_loan_instalments_paid: number('30'),
        car_loan_down_payment: number('50000'),
      }),
    ).toBe('15000');
  });
});

describe('Liabilities Cross Sell (CDs Holder) — 30% of the pledged amount', () => {
  it('a 1,000,000 certificate counts as 300,000', () => {
    expect(
      quote('pledged_collateral_share', {
        pledged_free_amount: number('1000000'),
        pledged_months_since_issue: number('12'),
      }),
    ).toBe('300000');
  });
});

describe('Teachers — Predefined Limit — by stage, a column per school type', () => {
  it('secondary, national school: 300,000', () => {
    expect(
      quote('school_stage_ceiling', {
        school_stage: choice('stage_secondary'),
        school_type: choice('school_national'),
      }),
    ).toBe('300000');
  });
});

describe('Club Membership — by branch', () => {
  it('New Cairo: 750,000', () => {
    expect(
      quote('club_branch_cap', {
        club_membership: choice('yes'),
        club_branch: choice('branch_new_cairo'),
      }),
    ).toBe('750000');
  });
  it('Main branch: 160,000', () => {
    expect(
      quote('club_branch_cap', {
        club_membership: choice('yes'),
        club_branch: choice('branch_main'),
      }),
    ).toBe('160000');
  });
});

describe('Car Buyers — down payment or savings, each bank picks one way', () => {
  it('by down payment: 360,000 ÷ 3.6 = 100,000', () => {
    expect(quote('down_payment_income', { car_down_payment: number('360000') }, 'primary')).toBe(
      '100000',
    );
  });
  it('by savings, paying in instalments: 600,000 ÷ 6 = 100,000', () => {
    expect(
      quote(
        'down_payment_income',
        { total_savings: number('600000'), green_buyer_type: choice('instalment_buyer') },
        'alt',
      ),
    ).toBe('100000');
  });
  it('by savings, paying cash: 600,000 ÷ 10 = 60,000', () => {
    expect(
      quote(
        'down_payment_income',
        { total_savings: number('600000'), green_buyer_type: choice('cash_buyer') },
        'alt',
      ),
    ).toBe('60000');
  });
});

describe('Compound Owner — four ways, a share of the unit, three rules', () => {
  const owner = (over: Facts = {}): Facts => ({
    owns_compound_unit: choice('yes'),
    compound_name: choice('mivida'),
    loan_is_topup: choice('new_loan'),
    owned_unit_type: choice('apartment'),
    unit_down_payment: number('1000000'),
    holds_other_product: choice('other_product_none'),
    unit_paid_to_date: number('3000000'),
    unit_contract_price: number('8000000'),
    unit_months_owned: number('24'),
    unit_owned_share_pct: number('100'),
    ...over,
  });

  it('by compound class: Mivida (AA), a new loan, owned outright → 6,000,000', () => {
    expect(quote('compound_owner', owner(), 'primary')).toBe('6000000');
  });
  it('by compound class: Madinaty (B), a top-up → 3,500,000', () => {
    expect(
      quote(
        'compound_owner',
        owner({ compound_name: choice('madinaty'), loan_is_topup: choice('top_up') }),
        'primary',
      ),
    ).toBe('3500000');
  });
  it('owning half the unit halves it: 3,000,000', () => {
    expect(quote('compound_owner', owner({ unit_owned_share_pct: number('50') }), 'primary')).toBe(
      '3000000',
    );
  });
  it('by down payment: 1,000,000 and nothing else held here → 1,250,000', () => {
    expect(quote('compound_owner', owner(), 'alt')).toBe('1250000');
  });
  it('by down payment, already holding a product here → 1,750,000', () => {
    expect(
      quote('compound_owner', owner({ holds_other_product: choice('other_product_held') }), 'alt'),
    ).toBe('1750000');
  });
  it('by what was paid: 15% of 3,000,000 = 450,000', () => {
    expect(quote('compound_owner', owner(), 'alt__unit_paid_to_date')).toBe('450000');
  });
  it('by kind of unit: a villa, a top-up → 4,500,000', () => {
    expect(
      quote(
        'compound_owner',
        owner({ owned_unit_type: choice('villa'), loan_is_topup: choice('top_up') }),
        'alt__owned_unit_type',
      ),
    ).toBe('4500000');
  });
  it('a contract signed 12 months ago is turned away (under 18)', () => {
    expect(quote('compound_owner', owner({ unit_months_owned: number('12') }), 'primary')).toEqual({
      miss: 'gate_failed',
      gate: 'CONTRACT_TOO_NEW',
    });
  });
  it('2,000,000 paid of an 8,000,000 contract is turned away (under 30%)', () => {
    expect(
      quote('compound_owner', owner({ unit_paid_to_date: number('2000000') }), 'primary'),
    ).toEqual({ miss: 'gate_failed', gate: 'DOWN_PAYMENT_BELOW_MIN' });
  });
  it('a 900,000 contract is turned away (under 1,000,000)', () => {
    expect(
      quote(
        'compound_owner',
        owner({ unit_contract_price: number('900000'), unit_paid_to_date: number('500000') }),
        'primary',
      ),
    ).toEqual({ miss: 'gate_failed', gate: 'UNIT_PRICE_BELOW_MIN' });
  });
});
