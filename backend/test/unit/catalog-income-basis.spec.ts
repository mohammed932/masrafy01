/**
 * The catalog seed's income BASIS — exactly one per (program name, loan category).
 *
 * The rule this pins is a product statement, not an implementation detail: the catalog
 * says what a name is FOR, and "for both" says nothing. The seed used to mark the six
 * fact-carrying names BOTH ways on the argument that other banks also sell them the
 * ordinary way — true, and about BANKS, which state their own basis on their own program
 * (`bank_program.programType`, the only place it is enforced). The catalog answering the
 * same question with two answers left every admin control showing a value it could not
 * express, and gave the operator nothing to correct.
 *
 * Two failure modes are worth a test rather than a re-read of the matrix:
 *
 *   - A pair emitted for a category axis 1 does not assign. The basis lives on the
 *     `platform_enumeration_loan_category` ROW, so a pair with no row has nowhere to be
 *     written and the seed can only report it as a note. Deriving the map from the
 *     assignment map makes that unrepresentable; this holds it that way.
 *   - `business` drifting to `payslip`. Every seeded business program is
 *     `income_surrogate` (a company's revenue is not a salary), so a payslip mark there
 *     would put the catalog's stated intent in contradiction with every fact counted
 *     beside it on the same board.
 */
import { describe, expect, it } from 'vitest';
import {
  CATALOG_CATEGORY_ASSIGNMENTS,
  CATALOG_INCOME_BASIS,
  NO_PAYSLIP_FACT,
  SELF_EMPLOYED_ARCHETYPES,
  catalogIncomeBasis,
  type CatalogCategory,
} from '../../prisma/data/program-catalog-matrix';

const BASES = ['payslip', 'no_payslip'] as const;

describe('catalog income basis', () => {
  it('gives every assigned pair exactly one basis, and only assigned pairs', () => {
    expect(Object.keys(CATALOG_INCOME_BASIS).sort()).toEqual(
      Object.keys(CATALOG_CATEGORY_ASSIGNMENTS).sort(),
    );

    for (const [key, categories] of Object.entries(CATALOG_CATEGORY_ASSIGNMENTS)) {
      const byCategory = CATALOG_INCOME_BASIS[key] ?? {};
      // Same set both ways: no pair the catalog does not offer, no offered pair
      // left without an answer.
      expect([...Object.keys(byCategory)].sort()).toEqual([...categories].sort());
      for (const category of categories) {
        expect(BASES).toContain(byCategory[category]);
      }
    }
  });

  it('never sells a business product against a payslip', () => {
    for (const [key, categories] of Object.entries(CATALOG_CATEGORY_ASSIGNMENTS)) {
      if (!categories.includes('business')) continue;
      expect(CATALOG_INCOME_BASIS[key]?.business).toBe('no_payslip');
    }
  });

  it('carries a self-employed archetype’s basis across every category it reaches', () => {
    for (const key of SELF_EMPLOYED_ARCHETYPES) {
      const categories = CATALOG_CATEGORY_ASSIGNMENTS[key] ?? [];
      expect(categories.length).toBeGreaterThan(0);
      for (const category of categories) {
        expect(CATALOG_INCOME_BASIS[key]?.[category]).toBe('no_payslip');
      }
    }
  });

  it('prices a salaried fact-carrying name off its fact on personal, off payroll elsewhere', () => {
    // Uniformed and government staff: the grade / rank table is the PERSONAL product.
    // The car loan is written against the same payroll department's certificate, so
    // widening the mark there would assert a product nobody has decided to sell.
    for (const key of ['armed_forces', 'police', 'govt_employee']) {
      expect(NO_PAYSLIP_FACT[key]).toBeDefined();
      expect(SELF_EMPLOYED_ARCHETYPES.has(key)).toBe(false);
      expect(catalogIncomeBasis(key, 'personal')).toBe('no_payslip');
      expect(catalogIncomeBasis(key, 'car')).toBe('payslip');
      expect(catalogIncomeBasis(key, 'mortgage')).toBe('payslip');
    }
  });

  it('leaves an ordinary salaried name on a payslip everywhere it is retail', () => {
    for (const key of ['bankers', 'private_sector', 'pensioner', 'youth']) {
      for (const category of ['personal', 'car', 'mortgage'] as CatalogCategory[]) {
        expect(catalogIncomeBasis(key, category)).toBe('payslip');
      }
    }
  });

  it('answers for a name the matrix has never heard of', () => {
    // The seed only writes pairs it has a row for, but the function is also what axis 1
    // stamps a NEWLY created pair with — including for a key an operator added.
    expect(catalogIncomeBasis('some_name_an_admin_typed', 'personal')).toBe('payslip');
    expect(catalogIncomeBasis('some_name_an_admin_typed', 'business')).toBe('no_payslip');
  });
});
