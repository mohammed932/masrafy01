/**
 * A cap keyed by the CLASS an answer is filed under, rather than by the answer.
 *
 * The problem it solves, from the sheets: one bank caps "Cairo & Alexandria" against
 * everywhere else, another caps eight named governorates against everywhere else, and
 * neither bank's "everywhere else" is the other's. The platform's answer is one granular
 * list — 27 governorates — filed under three tiers, so each bank's own grouping is a union
 * of whole tiers. A cap that can only match the answer's own option code cannot read that
 * list: the bank would have to spell all 27 codes into its table, and the next governorate
 * added would be silently uncapped.
 *
 * The two failure directions pinned below are the ones that only appear on a customer: a
 * value filed under nothing must land on the bank's stated `onNoMatch`, never on "no cap";
 * and an axis with no class to walk must be refused at SAVE, never accepted into a table
 * that then caps nobody.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { resolveMaxLoanByFact } from '../../src/matching/pipeline/max-loan-by-fact';
import type { MaxLoanByFactConfig } from '../../src/matching/pipeline/max-loan-by-fact';
import type { SurrogateFactValue } from '../../src/matching/types';
import { validateMaxLoanByFact } from '../../src/bank-programs/validation/max-loan-by-fact.validator';
import type { IncomeRuleValidationContext } from '../../src/bank-programs/validation/income-rule.validator';

const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });

/** Two of the platform's 27 governorates, and where each is filed. */
const FILED: Record<string, string> = {
  cairo: 'city_tier_major',
  alexandria: 'city_tier_major',
  tanta: 'city_tier_other',
};

/**
 * ABK 7's city cap, as two tier rows instead of twenty-seven governorate rows.
 *
 * `practice_governorate` — where the doctor WORKS. Not the mortgage `governorate` question
 * and its `property_governorate` fact, which asks where the property being financed is; the
 * doctors product read that one until 2026-09-05, so a personal-loan doctor was never asked
 * at all and this cap read nothing.
 */
const BY_TIER: MaxLoanByFactConfig = {
  factKey: 'practice_governorate',
  rowVia: 'parentClass',
  columnFactKey: 'loan_is_topup',
  onNoMatch: 'useProgramMax',
  rows: [
    { rowKey: 'city_tier_major', columnKey: 'new_loan', maxAmountEGP: '1500000' },
    { rowKey: 'city_tier_major', columnKey: 'top_up', maxAmountEGP: '2000000' },
    { rowKey: 'city_tier_other', columnKey: 'new_loan', maxAmountEGP: '500000' },
    { rowKey: 'city_tier_other', columnKey: 'top_up', maxAmountEGP: '750000' },
  ],
};

describe('a cap keyed by the class', () => {
  it.each([
    ['cairo', 'new_loan', '1500000'],
    ['alexandria', 'new_loan', '1500000'],
    ['tanta', 'new_loan', '500000'],
    ['cairo', 'top_up', '2000000'],
    ['tanta', 'top_up', '750000'],
  ])('caps %s on a %s at %s', (governorate, relationship, expected) => {
    const result = resolveMaxLoanByFact({
      config: BY_TIER,
      facts: {
        practice_governorate: choice(governorate as string),
        loan_is_topup: choice(relationship as string),
      },
      parentKeyByValue: FILED,
    });
    expect(result.matched).toBe(true);
    if (result.matched) expect(result.maxAmountEGP.toString()).toBe(expected);
  });

  it('adding a governorate to the list caps it without touching the bank table', () => {
    // The whole reason the axis exists. A new value filed under an existing tier reads that
    // tier's row on day one — no bank edit, no orphaned figure, no uncapped applicant.
    //
    // Deliberately NOT giza: a real governorate whose tier one bank disagreed about is the
    // worst possible stand-in for "any value, any tier", and this test used to assert giza
    // in the top tier, i.e. it pinned the bug `20260905090000_giza_secondary_tier` fixed.
    const result = resolveMaxLoanByFact({
      config: BY_TIER,
      facts: { practice_governorate: choice('port_said'), loan_is_topup: choice('new_loan') },
      parentKeyByValue: { ...FILED, port_said: 'city_tier_major' },
    });
    expect(result.matched && result.maxAmountEGP.toString()).toBe('1500000');
  });

  it('lands a value filed under NO class on the stated no-match action', () => {
    // Never "no cap": here the class IS the row being read, so there is nothing to fall back
    // to, and the bank's own answer decides. `factParentTable` reads it the same way.
    const result = resolveMaxLoanByFact({
      config: BY_TIER,
      facts: { practice_governorate: choice('somewhere_new'), loan_is_topup: choice('new_loan') },
      parentKeyByValue: FILED,
    });
    expect(result).toEqual({
      matched: false,
      action: 'useProgramMax',
      reason: 'no_matching_row',
    });
  });

  it('reports a REFUSAL when that is what the bank chose for an unfiled value', () => {
    const result = resolveMaxLoanByFact({
      config: { ...BY_TIER, onNoMatch: 'reject' },
      facts: { practice_governorate: choice('somewhere_new'), loan_is_topup: choice('new_loan') },
      parentKeyByValue: FILED,
    });
    expect(result).toEqual({ matched: false, action: 'reject', reason: 'no_matching_row' });
  });

  it('separates "never asked" from "asked, and filed under nothing"', () => {
    // Different admin actions: one is a question the category does not ask, the other is a
    // value somebody has to file. The reason has to say which.
    expect(resolveMaxLoanByFact({ config: BY_TIER, facts: {}, parentKeyByValue: FILED })).toEqual({
      matched: false,
      action: 'useProgramMax',
      reason: 'fact_not_answered',
    });
  });

  it('reads a class-keyed COLUMN, and falls through to the shared row when unfiled', () => {
    const config: MaxLoanByFactConfig = {
      factKey: 'years_band',
      columnFactKey: 'property_governorate',
      columnVia: 'parentClass',
      onNoMatch: 'useProgramMax',
      rows: [
        { rowKey: 'senior', columnKey: 'city_tier_major', maxAmountEGP: '2000000' },
        { rowKey: 'senior', maxAmountEGP: '750000' },
      ],
    };
    const cairo = resolveMaxLoanByFact({
      config,
      facts: { years_band: choice('senior'), property_governorate: choice('cairo') },
      parentKeyByValue: FILED,
    });
    const unfiled = resolveMaxLoanByFact({
      config,
      facts: { years_band: choice('senior'), property_governorate: choice('somewhere_new') },
      parentKeyByValue: FILED,
    });
    expect(cairo.matched && cairo.maxAmountEGP.toString()).toBe('2000000');
    // A column is not a requirement — the column-agnostic row prices the applicant.
    expect(unfiled.matched && unfiled.maxAmountEGP.toString()).toBe('750000');
  });

  it('reads an answer-keyed table exactly as before when no axis says otherwise', () => {
    const plain: MaxLoanByFactConfig = {
      factKey: 'property_type',
      onNoMatch: 'useProgramMax',
      rows: [{ rowKey: 'villa', maxAmountEGP: '4000000' }],
    };
    // The class map is present and deliberately ignored: an answer-keyed table must not
    // start walking parents because a map happened to be in scope.
    const result = resolveMaxLoanByFact({
      config: plain,
      facts: { property_type: choice('villa') },
      parentKeyByValue: { villa: 'city_tier_major' },
    });
    expect(result.matched && result.maxAmountEGP.toString()).toBe('4000000');
  });
});

describe('what a class-keyed axis is refused for', () => {
  const OPTIONS: Record<string, string[]> = {
    q_governorate: ['cairo', 'alexandria', 'tanta'],
    q_property_type: ['apartment', 'twin', 'villa'],
  };
  const ctx: IncomeRuleValidationContext = {
    isActiveMember: async () => true,
    activeMembers: async () => [],
    surrogateFacts: async () => [
      { key: 'property_governorate', questionCode: 'q_governorate', type: 'SINGLE_SELECT' },
      { key: 'property_type', questionCode: 'q_property_type', type: 'SINGLE_SELECT' },
      { key: 'down_payment_paid', questionCode: 'q_down_payment', type: 'NUMERIC' },
    ],
    questionOptionCodes: async (questionCode) => OPTIONS[questionCode] ?? [],
  };
  const reasonOf = async (config: MaxLoanByFactConfig): Promise<string | undefined> =>
    (await validateMaxLoanByFact(config, ctx))?.reason;

  it('accepts class keys without checking them against the answer list', async () => {
    // Deliberately unchecked, the same posture `validateStepFigures` takes with a
    // `factParentTable`'s keys: classes live in another list an operator moves values
    // between, so a stale key must not block the save that a lookup fix makes correct.
    expect(
      await reasonOf({
        factKey: 'property_governorate',
        rowVia: 'parentClass',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'city_tier_major', maxAmountEGP: '1500000' }],
      }),
    ).toBeUndefined();
  });

  it('still checks the keys of an ANSWER-keyed table', async () => {
    expect(
      await reasonOf({
        factKey: 'property_governorate',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'city_tier_major', maxAmountEGP: '1500000' }],
      }),
    ).toBe('unknown_row_key');
  });

  it('refuses a class-keyed axis on a NUMERIC fact', async () => {
    // Nothing to walk: a number is not filed under anything. Left legal it would match no
    // row and cap every applicant by `onNoMatch`, which reads as a policy nobody chose.
    expect(
      await reasonOf({
        factKey: 'down_payment_paid',
        rowVia: 'parentClass',
        onNoMatch: 'useProgramMax',
        rows: [{ fromInclusive: '0', toExclusive: null, maxAmountEGP: '1' }],
      }),
    ).toBe('via_not_applicable');
  });

  it('refuses a class-keyed axis on a DERIVED fact, on either side', async () => {
    // The platform computes those answers, so there is no registry row and no class.
    expect(
      await reasonOf({
        factKey: 'bank_relationship',
        rowVia: 'parentClass',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'ntb', maxAmountEGP: '1' }],
      }),
    ).toBe('via_not_applicable');
    expect(
      await reasonOf({
        factKey: 'property_governorate',
        columnFactKey: 'bank_relationship',
        columnVia: 'parentClass',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'cairo', maxAmountEGP: '1' }],
      }),
    ).toBe('via_not_applicable');
  });
});
