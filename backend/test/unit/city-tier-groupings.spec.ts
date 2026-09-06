/**
 * City tiers: two banks, one governorate list, different groupings (spec §10.1).
 *
 * ABK Doctors (Clinic Owners) tiers cities as "Cairo & Alex" against everything else. The
 * Arabic DOCTOR sheet tiers EIGHT governorates against everything else. Neither grouping is a
 * union of the other's classes, which is why a two-option `city_tier` question cannot serve
 * both banks and the list has to be the governorates themselves with the tier as the parent.
 *
 * The migration files the 27 rows into three classes, cut so that BOTH banks' groupings are
 * unions of whole classes. This asserts exactly that: each bank fills its own figure against
 * the classes it groups together, and one applicant reads each bank's correct row from the one
 * list — with no per-bank parent axis anywhere.
 *
 * The parent map here mirrors `20260901120000_city_tier_axis` as corrected by
 * `20260905090000_giza_secondary_tier`. If someone re-files a governorate, this test is where
 * the two banks stop agreeing.
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  evaluateProductRule,
  type ProductRule,
  type ProductRuleContext,
} from '../../src/matching/pipeline/product-rule';
import type { SurrogateFactValue } from '../../src/matching/types';

const MAJOR = 'city_tier_major';
const SECONDARY = 'city_tier_secondary';
const OTHER = 'city_tier_other';

/** As the migrations file them (`20260901120000`, corrected by `20260905090000`). */
const TIER_OF: Record<string, string> = {
  cairo: MAJOR,
  alexandria: MAJOR,
  // Giza sits with the other main governorates, NOT with Cairo and Alexandria. It was filed
  // under MAJOR until 2026-09-05, which put it on ABK's 1,500,000 row when that sheet tiers
  // it at 500,000 — the one governorate where the two banks' groupings had been collapsed
  // into each other. See `20260905090000_giza_secondary_tier`.
  giza: SECONDARY,
  assiut: SECONDARY,
  minya: SECONDARY,
  qalyubia: SECONDARY,
  gharbia: SECONDARY,
  dakahlia: SECONDARY,
  tanta: OTHER,
  aswan: OTHER,
  luxor: OTHER,
};

function quote(keyTable: { key: string; incomeEGP: string }[], governorate: string): string | null {
  const rule: ProductRule = {
    strategy: 'steps',
    steps: [{ id: 'cap', op: 'factParentTable', fact: 'property_governorate' }],
    stepParams: { cap: { keyTable } },
    output: { kind: 'monthlyIncome', from: 'cap' },
  };
  const facts: Record<string, SurrogateFactValue> = {
    property_governorate: { kind: 'choice', optionCode: governorate },
  };
  const ctx: ProductRuleContext = { facts, parentKeyByValue: TIER_OF };
  const out = evaluateProductRule(rule, ctx);
  return out.ok ? out.valueEGP.toString() : null;
}

/** ABK: Cairo & Alex against everything else — one figure repeated on two classes. */
const ABK = [
  { key: MAJOR, incomeEGP: '1500000' },
  { key: SECONDARY, incomeEGP: '500000' },
  { key: OTHER, incomeEGP: '500000' },
];

/** The Arabic sheet: eight governorates against everything else. */
const ARABIC_BANK = [
  { key: MAJOR, incomeEGP: '2000000' },
  { key: SECONDARY, incomeEGP: '2000000' },
  { key: OTHER, incomeEGP: '750000' },
];

describe('city tiers serve two banks that group cities differently', () => {
  it('reads each bank its own figure for one applicant in Cairo', () => {
    expect(quote(ABK, 'cairo')).toBe('1500000');
    expect(quote(ARABIC_BANK, 'cairo')).toBe('2000000');
  });

  it('separates the two banks exactly where their groupings differ — Assiut', () => {
    // Assiut is "other" to ABK and "major" to the Arabic sheet. This one applicant is the
    // whole argument for three classes rather than two.
    expect(quote(ABK, 'assiut')).toBe('500000');
    expect(quote(ARABIC_BANK, 'assiut')).toBe('2000000');
  });

  it('separates them on Giza too, which is why three classes are enough', () => {
    // Giza is the second cell where the two sheets disagree: bottom to ABK, top to the
    // Arabic bank — exactly the membership Assiut has, in BOTH groupings. That is what makes
    // them one class rather than two, and what makes a fourth class unnecessary. If a future
    // bank splits them, THAT is when `city_tier_secondary` gets divided (spec §10.1's
    // non-destructive procedure), not before.
    expect(quote(ABK, 'giza')).toBe('500000');
    expect(quote(ARABIC_BANK, 'giza')).toBe('2000000');
    expect(quote(ABK, 'giza')).toBe(quote(ABK, 'assiut'));
    expect(quote(ARABIC_BANK, 'giza')).toBe(quote(ARABIC_BANK, 'assiut'));
  });

  it('agrees on a governorate neither bank tiers up — Aswan', () => {
    expect(quote(ABK, 'aswan')).toBe('500000');
    expect(quote(ARABIC_BANK, 'aswan')).toBe('750000');
  });

  it('lets a bank repeat one figure across whole classes, which is what a union is', () => {
    expect(quote(ABK, 'assiut')).toBe(quote(ABK, 'aswan'));
    expect(quote(ARABIC_BANK, 'cairo')).toBe(quote(ARABIC_BANK, 'gharbia'));
  });

  it('stops with a stated reason when a bank left a class out', () => {
    // Never a substituted figure: a missing class row is `no_matching_row`, which stops the
    // rule and reports itself (§5.6 makes it a WARNING at save, not a refusal).
    expect(quote([{ key: MAJOR, incomeEGP: '1500000' }], 'aswan')).toBeNull();
  });
});
