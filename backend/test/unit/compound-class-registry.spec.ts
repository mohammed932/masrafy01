/**
 * The seeded compound class list, and the bank figures keyed by it.
 *
 * This spec exists because of a specific near-miss: the class list went from five tiers to
 * three, and `collateral-product-check.ts` — the only thing that quotes the real rows — used
 * one applicant whose compound is worth 2 000 000 under BOTH schemes. A migration that
 * re-filed every compound onto the wrong tier would have shipped green.
 *
 * These assertions are on the seed's own arrays, so they cost no database and they fail on
 * the edit rather than on a customer. The one that matters most is the LAST: `Class A` is the
 * TOP tier, and `cat_a` used to be the middle one — the amounts must be asserted by name,
 * descending, once, in code.
 */
import { describe, expect, it } from 'vitest';
import {
  BANK_FIGURES,
  COMPOUND_CLASS_KEYS,
  LOOKUPS,
  RETIRED_COMPOUND_CLASS_KEYS,
} from '../../prisma/seed-collateral-products';

const classRows = LOOKUPS.filter((row) => row.type === 'compound_category');
const compoundRows = LOOKUPS.filter((row) => row.type === 'compound');
const classKeys = new Set(classRows.map((row) => row.key));

/** EG Bank is the only program that keys a table by class. */
const egBank = BANK_FIGURES.find((f) => f.programCode === 'EGB-COMPOUND-GUARANTEE');
const capTable = egBank?.stepParams?.capByCompoundClass?.keyTable ?? [];

describe('compound classes — the registry side', () => {
  it('states exactly three classes, and they are the exported keys', () => {
    expect(classRows).toHaveLength(3);
    expect([...classKeys].sort()).toEqual([...COMPOUND_CLASS_KEYS].sort());
  });

  it('gives every class both labels', () => {
    for (const row of classRows) {
      expect(row.labelEn.length).toBeGreaterThan(0);
      expect(row.labelAr.length).toBeGreaterThan(0);
    }
  });

  it('never reuses a retired key — a key whose meaning changed must not be recycled', () => {
    // `cat_a` was the MIDDLE tier; "Class A" is now the TOP one. Reusing it would make every
    // half-applied migration state individually plausible and jointly wrong.
    for (const key of RETIRED_COMPOUND_CLASS_KEYS) {
      expect(classKeys.has(key)).toBe(false);
    }
  });

  it('files every compound under one of them', () => {
    expect(compoundRows.length).toBeGreaterThan(0);
    for (const row of compoundRows) {
      expect(row.parentKey, `${row.key} has no class`).toBeDefined();
      expect(classKeys.has(row.parentKey as string), `${row.key} → ${row.parentKey}`).toBe(true);
    }
  });

  it('leaves no class empty — a tier no compound reaches is a figure nobody can quote', () => {
    for (const key of classKeys) {
      expect(compoundRows.some((row) => row.parentKey === key), `${key} has no compounds`).toBe(true);
    }
  });
});

describe('compound classes — the bank figures keyed by them', () => {
  it("covers every class, and only classes, in EG Bank's cap table", () => {
    expect(capTable.map((r) => r.key).sort()).toEqual([...classKeys].sort());
  });

  it('states 6M / 4M / 2M, strictly descending', () => {
    // By NAME and by ORDER. The amounts are the whole product decision, and "A is the top
    // tier" is exactly the sentence a reused key would have silently inverted.
    const byKey = new Map(capTable.map((r) => [r.key, r.incomeEGP]));
    expect(byKey.get('compound_class_a')).toBe('6000000.00');
    expect(byKey.get('compound_class_b')).toBe('4000000.00');
    expect(byKey.get('compound_class_c')).toBe('2000000.00');

    const amounts = [...COMPOUND_CLASS_KEYS].map((key) => Number(byKey.get(key)));
    for (let i = 1; i < amounts.length; i += 1) {
      expect(amounts[i - 1]).toBeGreaterThan(amounts[i] as number);
    }
  });

  it("never exceeds the program's own maximum", () => {
    // The top tier has to be reachable; a ceiling above `maxAmountEGP` is a figure the bank
    // would never write, and the clamp would hide the mistake.
    const max = Number(egBank?.maxAmountEGP ?? '0');
    for (const cell of capTable) expect(Number(cell.incomeEGP)).toBeLessThanOrEqual(max);
  });
});
