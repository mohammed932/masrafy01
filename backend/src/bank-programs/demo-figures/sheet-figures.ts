/**
 * The published sheets, as figures — the catalog defaults and the catalog names that sell them.
 *
 * Pure data. No Nest, no Prisma, no clock. Every number here is transcribed from
 * `docs/surrogate-income-templates-implementation-spec.md`, and each entry names the appendix
 * it came from so a reader can check it against the sheet.
 *
 * ─── Why this is a seed and not a blueprint ───────────────────────────────────
 *
 * `product-blueprints.ts` carries the MECHANISM of each predefined product and, deliberately,
 * not one figure: "Every figure on every sheet is a BANK's figure and belongs in that bank's
 * program." That rule is right and is not weakened here. What this file holds is the operator's
 * data — the same rows an operator would type on `/program-catalog/products/:key` — expressed
 * once so a demo database can be rebuilt from nothing.
 *
 * ─── Why the two-column tables are CATALOG defaults ──────────────────────────
 *
 * The richest two-column tables in the source material (professor government/private, doctor
 * years × governorate tier) come from four Arabic sheets whose BANK is not identified —
 * spec §10.8 says in terms that they must not be seeded under a guessed name. A product's own
 * default figures are the one home that misattributes nothing: the product screen renders every
 * column filled, no bank claims the numbers, and a bank put on `amounts: 'catalog'` inherits
 * them if it ever wants to.
 *
 * ─── The key that surprises ──────────────────────────────────────────────────
 *
 * The unit type's option code is `twin_or_town_house`, not the registry key `twin_house`. A
 * `factChoiceTable` matches the code of the answer the applicant PICKED, so the question's own
 * option codes are the authority — the validator refuses anything else, which is how this was
 * found.
 *
 * ─── The conditions, and what stating them here means ───────────────────────
 *
 * A gate applies only when its figures are present, so a catalog default is a condition LIVE
 * for every bank that puts itself on `amounts: 'catalog'`. That is worth thinking about, and
 * having thought about it they ARE stated, for two reasons.
 *
 * A bank on `amounts: 'catalog'` has said "sell this product as the catalog configures it".
 * The tables it inherits are the catalog's, so inheriting the conditions with them is the same
 * sentence — and the editor says exactly that on the row ("On by default for every bank").
 * Nor are these one bank's invention: every compound sheet in the source material states an
 * ownership floor, a paid share and a unit-price floor, so a product offering three conditions
 * and filling none of them reads as unfinished when it is only unopinionated.
 *
 * What is stated is the FLOOR each sheet publishes, never the strictest of them. A bank that
 * applies a tighter one states it on its own program, which is where all three are stated
 * today as well.
 *
 * `cond__paidenough__bound` is the non-obvious member: it is a STEP (a `percentOf`), not a gate
 * param, but the gate comparing against it counts as configured the moment the step is, so it
 * belongs to this decision rather than to the tables.
 */

import { LoanCategory } from '@prisma/client';

/** A path into a program's or a product's config that is an estimate, not a published figure. */
export type EstimatedPaths = readonly string[];

export interface CatalogFigureSet {
  /** `surrogate_product` key. */
  productKey: string;
  /** Where the numbers came from, printed by the command and stored on nothing. */
  sheet: string;
  /**
   * Ceiling products only — the debt-burden percentage the ceiling was worked out at, which is
   * what lets the engine turn it back into a monthly figure. Written on the TEMPLATE, before
   * the figures, because a template write recompiles the steps.
   */
  baselineDbrPercent?: string;
  /** `incomeRule.stepParams`, keyed by the slot ids `compileTemplate` emits. */
  stepParams: Record<string, unknown>;
  /** Rooted at `incomeRule.`, exactly as the catalog write expects them. */
  estimated?: EstimatedPaths;
}

export interface ProgramNameSpec {
  key: string;
  labelEn: string;
  labelAr: string;
  /** The product this name takes its calculation from. */
  productKey: string;
  categories: LoanCategory[];
  /** The scored-question shortlist, per category. Advisory — but a name without one reads empty. */
  questionCodes: string[];
}

const money = (key: string, incomeEGP: string) => ({ key, incomeEGP });
const percent = (value: string) => ({ scalar: { value, unit: 'percent' as const } });
const times = (value: string) => ({ scalar: { value, unit: 'multiplier' as const } });

/** The bands a table of ranges is keyed by, paired with one figure each. */
function bands(
  edges: ReadonlyArray<{ fromInclusive: string; toExclusive: string | null }>,
  amounts: readonly string[],
): { bands: Array<{ fromInclusive: string; toExclusive: string | null; incomeEGP: string }> } {
  return {
    bands: edges.map((edge, index) => ({
      fromInclusive: edge.fromInclusive,
      toExclusive: edge.toExclusive,
      // Every edge is paired by construction below; a mismatch is a programming error here,
      // not an operator's, so it fails loudly rather than writing an empty figure the
      // validator would then refuse with a message about a band.
      incomeEGP: amounts[index] ?? unpaired(index),
    })),
  };
}

function unpaired(index: number): never {
  throw new Error(`sheet-figures: band ${index} has no figure`);
}

/** The Arabic DOCTOR sheet's own brackets — 2–5 · 5–8 · 8–12 · 12–15 · above 15. */
const ARABIC_DOCTOR_EDGES = [
  { fromInclusive: '2', toExclusive: '5' },
  { fromInclusive: '5', toExclusive: '8' },
  { fromInclusive: '8', toExclusive: '12' },
  { fromInclusive: '12', toExclusive: '15' },
  { fromInclusive: '15', toExclusive: null },
] as const;

/** The down-payment brackets one compound sheet bands its ceiling by (App. B, FABMISR). */
export const DOWN_PAYMENT_EDGES = [
  { fromInclusive: '250000', toExclusive: '500000' },
  { fromInclusive: '500000', toExclusive: '1000000' },
  { fromInclusive: '1000000', toExclusive: '1500000' },
  { fromInclusive: '1500000', toExclusive: null },
] as const;

/** ABK's own brackets for years in practice — 3–5 · 5–8 · 8–11 · 11–14 · 14–20 · 20+. */
export const ABK_PRACTICE_EDGES = [
  { fromInclusive: '3', toExclusive: '5' },
  { fromInclusive: '5', toExclusive: '8' },
  { fromInclusive: '8', toExclusive: '11' },
  { fromInclusive: '11', toExclusive: '14' },
  { fromInclusive: '14', toExclusive: '20' },
  { fromInclusive: '20', toExclusive: null },
] as const;

/**
 * Catalog defaults, one entry per product that has a calculation.
 *
 * Every key of every list gets a row, not only the keys a sheet happens to name: a table short
 * of its own option list renders "N keys have no row" on the editor, and an applicant whose key
 * is missing is answered `no_matching_row`, which stops the rule.
 */
export const CATALOG_FIGURES: readonly CatalogFigureSet[] = [
  {
    productKey: 'armed_forces_grades',
    sheet: 'App. A §11 — Egyptian Armed Forces',
    stepParams: {
      primary: {
        keyTable: [
          money('grade_major_general', '75000'),
          money('grade_brigadier_general', '60000'),
          money('grade_colonel', '45000'),
          money('grade_lt_colonel', '40000'),
          money('grade_major', '30000'),
          money('grade_captain', '28000'),
          money('grade_first_lieutenant', '18000'),
          // The three generic grades the list carried before the sheets' seven were added.
          // Their figures are the ones this repo already ships for them in
          // `CATALOG_INCOME_RULE.armed_forces`, so no row is invented and none is left blank.
          money('general', '40000'),
          money('senior_officer', '25000'),
          money('officer', '15000'),
        ],
      },
    },
  },

  {
    productKey: 'academic_rank_table',
    sheet: 'App. C PROFESSOR (both columns) · App. A §10 (section head)',
    stepParams: {
      primary: {
        keyTable: [
          money('junior_staff', '12000'),
          money('assistant_teacher', '20000'),
          money('lecturer', '35000'),
          money('assistant_professor', '50000'),
          money('professor', '100000'),
          money('professor_section_head', '75000'),
          money('dean', '150000'),
        ],
      },
      primary__uni_private: {
        keyTable: [
          money('junior_staff', '20000'),
          money('assistant_teacher', '30000'),
          money('lecturer', '50000'),
          money('assistant_professor', '75000'),
          money('professor', '150000'),
          // The only rank no sheet prints in this column: the Arabic sheet has no section head
          // and the ABK sheet prints one column. Placed between professor and dean, which is
          // where every sheet that ranks them puts it, and marked as an estimate.
          money('professor_section_head', '200000'),
          money('dean', '300000'),
        ],
      },
    },
    estimated: [
      'incomeRule.stepParams.primary__uni_private.keyTable.professor_section_head.incomeEGP',
    ],
  },

  {
    productKey: 'years_in_practice_bands',
    sheet: 'App. C DOCTOR — years × governorate tier',
    stepParams: {
      // The sheet's "major governorates" are Cairo, Giza, Alexandria, Assiut, Minya, Qalyubia,
      // Gharbia and Dakahlia — the union of the platform's `major` and `secondary` classes. So
      // this bank fills the SAME figures against both, which is the granularity rule of §10.1
      // doing its job: one global list, each bank's own grouping expressed as whole classes.
      primary: bands(ARABIC_DOCTOR_EDGES, ['42500', '81000', '134000', '195000', '320000']),
      primary__city_tier_secondary: bands(ARABIC_DOCTOR_EDGES, [
        '42500',
        '81000',
        '134000',
        '195000',
        '320000',
      ]),
      primary__city_tier_other: bands(ARABIC_DOCTOR_EDGES, [
        '32000',
        '60000',
        '100000',
        '150000',
        '240000',
      ]),
    },
  },

  {
    productKey: 'card_limit_share',
    sheet: 'App. A §6 — net monthly income is half the competitor card limit',
    stepParams: { primary: percent('50') },
  },

  {
    productKey: 'auto_loan_crosssell',
    sheet: 'App. A §4 — three times the instalment or 10% of the loan, whichever is less',
    stepParams: { primary: times('3'), alt: percent('10') },
  },

  {
    productKey: 'pledged_collateral_share',
    sheet: 'App. A §3 — 30% of the free amount of the collateral',
    stepParams: { primary: percent('30') },
  },

  {
    productKey: 'compound_owner',
    sheet:
      'spec §7 (class table) · App. B FABMISR (down-payment brackets) · App. A §2 + CAE (share of paid)',
    // Every compound sheet in the source material states a 50% debt burden, and a ceiling has
    // to be told which one it was worked out at or the engine cannot turn it back into a
    // monthly figure.
    baselineDbrPercent: '50',
    stepParams: {
      primary: {
        keyTable: [
          money('compound_tier_aa', '6000000'),
          money('compound_tier_ab', '5000000'),
          money('compound_tier_a', '4000000'),
          money('compound_tier_b', '3000000'),
          money('compound_tier_c', '2000000'),
          money('compound_tier_other', '2000000'),
        ],
      },
      // The top-up column of the class table is the spec's own worked example (§7), not a
      // published sheet — every figure in it is marked an estimate below.
      primary__top_up: {
        keyTable: [
          money('compound_tier_aa', '7000000'),
          money('compound_tier_ab', '5500000'),
          money('compound_tier_a', '4500000'),
          money('compound_tier_b', '3500000'),
          money('compound_tier_c', '2500000'),
          money('compound_tier_other', '2000000'),
        ],
      },
      // The brackets read the DOWN PAYMENT, which is the figure the sheet prints them
      // against; the share below reads everything paid to date. Two facts, deliberately —
      // the same customer sits in a different bracket depending on which is read.
      alt: bands(DOWN_PAYMENT_EDGES, ['750000', '1000000', '1250000', '1500000']),
      alt__top_up: bands(DOWN_PAYMENT_EDGES, ['1250000', '1500000', '1750000', '2000000']),
      alt__unit_paid_to_date: percent('15'),
      alt__unit_paid_to_date__top_up: percent('15'),
      // A share of the down payment alone is the fifth way, and NO sheet in the source
      // material states a percentage for it — App. A §2 and App. B CAE both take their
      // share of everything paid. Left blank on purpose: a blank way means "this bank does
      // not lend this way", and a guessed percentage here would be inherited by every bank
      // put on `amounts: 'catalog'` as though a sheet had published it.
      alt__owned_unit_type: {
        keyTable: [
          money('apartment', '2000000'),
          money('twin_or_town_house', '3000000'),
          money('villa', '4000000'),
        ],
      },
      alt__owned_unit_type__top_up: {
        keyTable: [
          money('apartment', '3000000'),
          money('twin_or_town_house', '3500000'),
          money('villa', '4500000'),
        ],
      },
      // Joint ownership shares the imputed ceiling between the owners — App. B FABMISR states
      // 50% of the imputed income and 50% of the loan amount. No figure is filed for it any
      // more: the applicant states the percentage of the unit they own, so a half-owner
      // reaches the sheet's 50% and every other share is priced as what it is.
      // App. A §2 — "property purchase date not less than 18 months".
      cond__ownedlongenough: { minValue: '18' },
      // App. C COMPOUND — "at least 30% of the unit value paid, including the down payment".
      cond__paidenough__bound: percent('30'),
      // App. B EG Bank — the minimum unit price by contract year, of which this is the
      // earliest (before 2021). A bank pricing to a later year states its own, and EG Bank's
      // own program does.
      cond__unitworthenough: { minValue: '1000000' },
    },
    estimated: [
      'incomeRule.stepParams.primary__top_up.keyTable.compound_tier_aa.incomeEGP',
      'incomeRule.stepParams.primary__top_up.keyTable.compound_tier_ab.incomeEGP',
      'incomeRule.stepParams.primary__top_up.keyTable.compound_tier_a.incomeEGP',
      'incomeRule.stepParams.primary__top_up.keyTable.compound_tier_b.incomeEGP',
      'incomeRule.stepParams.primary__top_up.keyTable.compound_tier_c.incomeEGP',
      'incomeRule.stepParams.primary__top_up.keyTable.compound_tier_other.incomeEGP',
      'incomeRule.stepParams.alt__unit_paid_to_date__top_up.scalar.value',
      'incomeRule.stepParams.alt__owned_unit_type__top_up.keyTable.apartment.incomeEGP',
      'incomeRule.stepParams.alt__owned_unit_type__top_up.keyTable.twin_or_town_house.incomeEGP',
      'incomeRule.stepParams.alt__owned_unit_type__top_up.keyTable.villa.incomeEGP',
    ],
  },

  {
    productKey: 'school_stage_ceiling',
    sheet: 'App. B — CAE Teachers, Predefined Limit (codes 0760-22 / 0760-23)',
    // The sheet waives the income check and prints no percentage; a ceiling still needs one.
    baselineDbrPercent: '50',
    stepParams: {
      primary: {
        keyTable: [
          money('stage_primary', '100000'),
          money('stage_preparatory', '200000'),
          money('stage_secondary', '300000'),
        ],
      },
      primary__school_international: {
        keyTable: [
          money('stage_primary', '200000'),
          money('stage_preparatory', '400000'),
          money('stage_secondary', '600000'),
        ],
      },
    },
    estimated: ['incomeRule.output.baselineDbrPercent'],
  },
];

/**
 * The questions every applicant is asked, whatever the product — the income, the request and
 * the obligations block. Shared by every name below so a demo card is never empty.
 */
const CORE_QUESTIONS = [
  'monthly_income',
  'amount_requested',
  'repayment_period_months',
  'current_loans',
  'current_installments',
  'credit_card_total_limit',
  'employment_status',
  'job_tenure',
  'i_score',
];

/**
 * One catalog name per product that has a calculation.
 *
 * `personal` only, and that is not a shortcut: every question these products read is already
 * asked of personal-loan applicants, and a name offered under a loan type whose applicants are
 * never asked its facts is a program that quotes nothing.
 *
 * `compound_owner_4` is absent on purpose — it already exists, is already no-payslip and is
 * already linked to `compound_owner`. Its scored questions are set by the command.
 */
export const PROGRAM_NAMES: readonly ProgramNameSpec[] = [
  {
    key: 'armed_forces_no_payslip',
    labelEn: 'Armed Forces',
    labelAr: 'القوات المسلحة',
    productKey: 'armed_forces_grades',
    categories: [LoanCategory.personal],
    questionCodes: [...CORE_QUESTIONS, 'military_grade'],
  },
  {
    key: 'university_professors',
    labelEn: 'University Professors',
    labelAr: 'أساتذة الجامعات',
    productKey: 'academic_rank_table',
    categories: [LoanCategory.personal],
    questionCodes: [...CORE_QUESTIONS, 'academic_rank', 'is_the_university_government_or_private'],
  },
  {
    key: 'doctors_in_practice',
    // The key is narrower than the name on purpose: it is immutable (both ABK doctor
    // programmes file their `programNameKey` under it), and the name covers what the
    // catalog actually sells — the clinic-owner sheet and the in-practice one.
    labelEn: 'Doctors',
    labelAr: 'الأطباء',
    productKey: 'years_in_practice_bands',
    categories: [LoanCategory.personal],
    questionCodes: [...CORE_QUESTIONS, 'years_in_practice', 'governorate'],
  },
  {
    key: 'pl_to_card',
    labelEn: 'Personal Loan against a Credit Card',
    labelAr: 'تمويل شخصي مقابل بطاقة ائتمان',
    productKey: 'card_limit_share',
    categories: [LoanCategory.personal],
    questionCodes: [...CORE_QUESTIONS, 'existing_bank_products'],
  },
  {
    key: 'pl_to_auto_loan',
    labelEn: 'Personal Loan against a Car Loan',
    labelAr: 'تمويل شخصي مقابل قرض سيارة',
    productKey: 'auto_loan_crosssell',
    categories: [LoanCategory.personal],
    questionCodes: [
      ...CORE_QUESTIONS,
      'obligation_car_loan',
      'how_much_was_the_car_loan_when_it_started',
    ],
  },
  {
    key: 'cds_holder',
    labelEn: 'Certificate & Deposit Holders',
    labelAr: 'حاملو الشهادات والودائع',
    productKey: 'pledged_collateral_share',
    categories: [LoanCategory.personal],
    questionCodes: [
      ...CORE_QUESTIONS,
      'how_much_is_the_certificate_or_deposit_you_would_pledge',
      'how_many_months_ago_was_it_issued',
    ],
  },
  {
    key: 'teachers_predefined',
    labelEn: 'Teachers — Predefined Limit',
    labelAr: 'المعلمون — حد محدد مسبقًا',
    productKey: 'school_stage_ceiling',
    categories: [LoanCategory.personal],
    questionCodes: [
      ...CORE_QUESTIONS,
      'which_stage_do_you_teach',
      'is_the_school_international_or_national',
    ],
  },
];

/** The name that already exists, and the questions it should show as scoring on. */
export const EXISTING_COMPOUND_NAME = {
  key: 'compound_owner_4',
  categories: [LoanCategory.personal],
  questionCodes: [
    ...CORE_QUESTIONS,
    'which_compound_is_your_unit_in',
    'what_kind_of_unit_do_you_own',
    'how_much_have_you_paid_for_the_unit_so_far',
    'what_is_the_contract_price_of_the_unit',
    'how_many_months_ago_did_you_sign_the_contract',
    'do_you_own_the_unit_with_someone_else',
    'do_you_own_more_than_one_unit',
  ],
} as const;

/**
 * The compounds the source material names, and the class each is filed under.
 *
 * Only these. A class decides a price, so filing the other sixty by guesswork is exactly what
 * §10.1 forbids — the command reports how many are left in the catch-all instead, and the
 * class board is where somebody who knows moves them.
 */
export const COMPOUND_CLASSES: Readonly<Record<string, string>> = {
  mivida: 'compound_tier_aa',
  palm_hills: 'compound_tier_aa',
  new_giza: 'compound_tier_aa',
  sodic_east: 'compound_tier_aa',
  emaar_mivida: 'compound_tier_aa',
  mountain_view_icity: 'compound_tier_ab',
  hyde_park: 'compound_tier_ab',
  madinaty: 'compound_tier_b',
  al_rehab: 'compound_tier_c',
  dreamland: 'compound_tier_c',
};
