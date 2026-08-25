/**
 * The curated surrogate-product library — the list an operator picks from when a new
 * catalog program name is sold without a payslip.
 *
 * A surrogate product is a NAMED, REUSABLE income calculation. It answers one question:
 * *when there is no payslip, what does the bank read instead?* The catalog name that
 * links to it says what the product is CALLED and who sells it; the bank program below
 * that says what the FIGURES are. Three levels, each answering a different question.
 *
 * CURATED, NOT ONE-PER-NAME, and that is the whole design. Six of the eleven entries in
 * `CATALOG_INCOME_RULE` are `{"strategy":"declared"}` — `athlete`, `wealth_tier`,
 * `professional`, `equipment_finance`, `pharmacy`, `working_capital`. Minting an
 * archetype for each would produce six byte-identical products distinguished only by a
 * catalog name, i.e. a picker where six of the options do the same thing and nothing on
 * screen says so. They share ONE `declared_income` archetype instead.
 *
 * FIGURES ARE NOT RESTATED HERE. Where a shape already exists in `CATALOG_INCOME_RULE`
 * this file names the key and the rule is read from there, so the archetype and the
 * catalog default cannot come to disagree (A25). Only `declared_income`, which has no
 * catalog entry because it has no figures at all, states its own.
 *
 * THE TWO PIPELINE PRODUCTS ARE NOT HERE. `compound_owner` and `car_owner` are seeded by
 * `seed-collateral-products.ts`, which also seeds the questions, facts, lookup values and
 * bank programs they cannot function without — splitting the rule away from those would
 * make either half individually meaningless. This seed reports them as present rather
 * than writing them.
 *
 * ADDING ONE: add an entry here, run `npm run seed:surrogate-products`. It becomes
 * pickable in the admin immediately. That is the point — a new no-payslip product used
 * to be a release.
 */
import { CATALOG_INCOME_RULE, type CatalogIncomeRule } from './program-catalog-matrix';

export interface SurrogateProductSeed {
  readonly key: string;
  readonly labelEn: string;
  readonly labelAr: string;
  readonly sortOrder: number;
  /**
   * Where the calculation comes from.
   *
   * `fromCatalog` names a key in `CATALOG_INCOME_RULE` — the single source for that
   * shape. `rule` is only for an archetype with no catalog entry to borrow.
   */
  readonly fromCatalog?: string;
  readonly rule?: CatalogIncomeRule;
}

/** Seeded by `seed-collateral-products.ts`, reported here, never written here. */
export const PIPELINE_PRODUCT_KEYS = ['compound_owner', 'car_owner'] as const;

export const SURROGATE_PRODUCTS: readonly SurrogateProductSeed[] = [
  {
    key: 'declared_income',
    labelEn: 'Declared income',
    labelAr: 'الدخل المُصرَّح به',
    sortOrder: 10,
    // The only archetype that states its own rule, because it is the absence of one:
    // no table, no bands, no scalar — the applicant's stated income is the figure.
    // Explicit rather than NULL: NULL means "nobody has decided yet", and this is a
    // decision. That distinction is the reason the column is nullable at all.
    rule: { strategy: 'declared' },
  },
  {
    key: 'bank_statement',
    labelEn: 'Share of bank statement turnover',
    labelAr: 'نسبة من حركة كشف الحساب البنكي',
    sortOrder: 20,
    fromCatalog: 'self_employed',
  },
  {
    key: 'years_in_practice',
    labelEn: 'Years in practice',
    labelAr: 'سنوات مزاولة المهنة',
    sortOrder: 30,
    fromCatalog: 'doctor',
  },
  {
    key: 'academic_rank',
    labelEn: 'Academic rank',
    labelAr: 'الدرجة الأكاديمية',
    sortOrder: 40,
    fromCatalog: 'professor',
  },
  {
    key: 'military_rank',
    labelEn: 'Military rank',
    labelAr: 'الرتبة العسكرية',
    sortOrder: 50,
    fromCatalog: 'armed_forces',
  },
];

/**
 * The rule an archetype ships with, or `undefined` when its catalog source is missing.
 *
 * Returns `undefined` rather than throwing or substituting: the seed reports the gap and
 * skips the row, which leaves the archetype absent from the picker. An archetype written
 * with no calculation would be pickable and would quote nothing.
 */
export function surrogateProductRule(product: SurrogateProductSeed): CatalogIncomeRule | undefined {
  if (product.rule !== undefined) return product.rule;
  if (product.fromCatalog === undefined) return undefined;
  return CATALOG_INCOME_RULE[product.fromCatalog];
}
