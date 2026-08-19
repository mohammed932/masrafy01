/**
 * Seed — the COLLATERAL products: the compound-ownership guarantee, and the
 * club-membership loan.
 *
 * These are the first products whose ceiling is derived from a thing the applicant OWNS
 * rather than from an income. Nothing in this file is code the engine branches on: it is
 * five bank programs, two catalog rules, eleven facts and three lookup lists — data, in the
 * shapes `matching/pipeline/product-rule.ts` evaluates (Principle II / A1).
 *
 * Run:  npm run seed:collateral        (add --dry to print the plan and write nothing)
 *
 * ─── What it writes, in this order, because each step needs the one before ────
 *
 *   1. LOOKUPS — `compound_category`, `compound` (each row filed under its category with
 *      `parentKey`), `club_class`. First, because the questionnaire expands two of its
 *      option lists from them (`optionsFromEnum`), so a question published before these
 *      rows exist would carry no options at all.
 *   2. QUESTIONNAIRE — delegates to `seedQuestionnaire()`, which owns the ONE global pool
 *      and publishes a snapshot. The gate and the packs are authored there, not here: a
 *      second publisher is how two snapshots come to disagree about what was asked.
 *   3. FACTS — a `surrogate_fact` row per pack question, bound to it. This is what carries
 *      an answer into `ApplicantProfile.surrogateFacts` with no mapping code on either
 *      client. The binding lives on the FACT, never on the question (A33).
 *   4. CATALOG NAMES + RULES — the two products' step pipelines, stated ONCE. Validated
 *      through the same `validateIncomeRule` the admin save runs, so this seed cannot plant
 *      a rule no operator could have saved.
 *   5. BANK PROGRAMS — five rows whose ONLY product-rule content is `stepParams`: figures.
 *      Adding a sixth bank is another entry in `BANK_FIGURES` and nothing else.
 *
 * ─── One ordering wrinkle, and why it is not a bug ────────────────────────────
 *
 * `seedQuestionnaire()` also builds each program's scoring weight set, from the catalog's
 * question template — and on a FIRST run the two new names have no template yet, because a
 * template references question IDs that step 2 has only just created. So the first pass ends
 * with the five programs carrying no ACTIVE weight set, which means a 0% score.
 *
 * The seed says so and names the fix (`npm run seed:weights`), and a second run of this file
 * converges just as well. The alternative — writing the template before the questions exist —
 * is not orderable, and inlining a third copy of the weight-set builder here would be a
 * second author for a set the questionnaire seed owns.
 *
 * ─── The one frame, four derivations ──────────────────────────────────────────
 *
 * The four banks selling the compound product derive their ceiling from four different
 * things — the unit TYPE, the compound's CLASS, a band over the amount already PAID, and a
 * PERCENTAGE of that amount. The catalog states all four and closes with a `coalesce`; each
 * bank fills exactly the one it uses and leaves the others blank. Their conditions differ
 * the same way, so every gate is offered by the catalog and turned on per bank.
 *
 * ─── Accepted gaps, stated rather than faked ──────────────────────────────────
 *
 *   - **X-SELL.** The source design's FABMISR cross-sell column and its tenor exception key
 *     off a CRM flag this platform has no source for. Only the NTB figures are seeded; the
 *     column is not invented.
 *   - **DBR by employment.** CAE caps salaried applicants at 50% and self-employed at 40%.
 *     `eligibility.dbrBands` are keyed by INCOME, so a per-employment cap is not expressible
 *     today and CAE is seeded at its baseline 50. The mechanism that would spend it works —
 *     `ceiling-identity.spec.ts` proves the haircut is exactly `applicable ÷ baseline` — so
 *     this is one missing setting, not a missing behaviour.
 *   - **Fraud checks and document lists** are informational in the source design and are not
 *     modelled as rule steps; they belong to `requiredDocuments` and operator notes.
 */
import { Prisma, PrismaClient, type LoanCategory } from '@prisma/client';
import {
  validateIncomeRule,
  type IncomeRuleValidationContext,
} from '../src/bank-programs/validation/income-rule.validator';
import { PRODUCT_RULE_STRATEGY, type IncomeAssumptionConfig } from '../src/matching/types';
import { seedQuestionnaire } from './seed-questionnaire';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

// ---------------------------------------------------------------------------
// 1. Lookups
// ---------------------------------------------------------------------------

interface SeedLookup {
  type: string;
  key: string;
  labelEn: string;
  labelAr: string;
  /** The registry's generic single-parent scope. A compound is filed under its class. */
  parentKey?: string;
  sortOrder: number;
}

/**
 * The five compound classes, and the compounds filed under them.
 *
 * `parentKey` is the load-bearing part: a bank keys its cap table by CLASS (five rows) while
 * the customer picks a NAME, and `factParentTable` walks one to the other. It replaces the
 * source prototype's client-side substring match against a hardcoded list of "high-end"
 * compound names — mixed-script, case-sensitive, and wrong for any name not on the list.
 *
 * The list is deliberately short and obviously incomplete: adding a compound is an operator
 * action on Manage values, and seeding two hundred would present curated demo data as a
 * market register. `other` exists so a customer whose compound is not listed can still
 * answer, and is filed under the lowest class rather than under nothing — a value with no
 * parent resolves to `no_matching_row`, which would read to them as a broken program.
 */
const LOOKUPS: readonly SeedLookup[] = [
  { type: 'compound_category', key: 'cat_aa', labelEn: 'Class AA', labelAr: 'الفئة AA', sortOrder: 1 },
  { type: 'compound_category', key: 'cat_ab', labelEn: 'Class AB', labelAr: 'الفئة AB', sortOrder: 2 },
  { type: 'compound_category', key: 'cat_a', labelEn: 'Class A', labelAr: 'الفئة A', sortOrder: 3 },
  { type: 'compound_category', key: 'cat_b', labelEn: 'Class B', labelAr: 'الفئة B', sortOrder: 4 },
  { type: 'compound_category', key: 'cat_c', labelEn: 'Class C', labelAr: 'الفئة C', sortOrder: 5 },

  { type: 'compound', key: 'mivida', labelEn: 'Mivida', labelAr: 'ميفيدا', parentKey: 'cat_aa', sortOrder: 1 },
  { type: 'compound', key: 'new_giza', labelEn: 'New Giza', labelAr: 'نيو جيزة', parentKey: 'cat_aa', sortOrder: 2 },
  { type: 'compound', key: 'sodic_east', labelEn: 'SODIC East', labelAr: 'سوديك إيست', parentKey: 'cat_aa', sortOrder: 3 },
  { type: 'compound', key: 'mountain_view_icity', labelEn: 'Mountain View iCity', labelAr: 'ماونتن فيو آي سيتي', parentKey: 'cat_ab', sortOrder: 4 },
  { type: 'compound', key: 'palm_hills', labelEn: 'Palm Hills', labelAr: 'بالم هيلز', parentKey: 'cat_ab', sortOrder: 5 },
  { type: 'compound', key: 'madinaty', labelEn: 'Madinaty', labelAr: 'مدينتي', parentKey: 'cat_a', sortOrder: 6 },
  { type: 'compound', key: 'al_rehab', labelEn: 'Al Rehab', labelAr: 'الرحاب', parentKey: 'cat_b', sortOrder: 7 },
  { type: 'compound', key: 'dreamland', labelEn: 'Dreamland', labelAr: 'دريم لاند', parentKey: 'cat_b', sortOrder: 8 },
  { type: 'compound', key: 'other', labelEn: 'Another compound', labelAr: 'كومباوند آخر', parentKey: 'cat_c', sortOrder: 9 },

  { type: 'club_class', key: 'class_1', labelEn: 'Class 1', labelAr: 'الدرجة الأولى', sortOrder: 1 },
  { type: 'club_class', key: 'class_2', labelEn: 'Class 2', labelAr: 'الدرجة الثانية', sortOrder: 2 },
  { type: 'club_class', key: 'class_3', labelEn: 'Class 3', labelAr: 'الدرجة الثالثة', sortOrder: 3 },
];

// ---------------------------------------------------------------------------
// 3. Facts
// ---------------------------------------------------------------------------

/**
 * Fact key → the question that answers it.
 *
 * Keys are the question codes, deliberately: a fact and its question are one concept, and a
 * second naming scheme would be a translation layer to keep in step (the same reasoning
 * `FR-017` applies to a key table's keys and a question's option codes).
 *
 * `employment_status` is the pool's EXISTING question, not a new one. One bank's
 * down-payment floor differs for a business owner, and the fact registry is how a rule reads
 * an answer it did not introduce.
 */
const FACT_QUESTION_CODES: readonly string[] = [
  'compound_name',
  'compound_unit_type',
  'compound_unit_price',
  'compound_dp_percent',
  'compound_contract_year',
  'compound_months_since_purchase',
  'compound_fully_settled',
  'compound_joint_unit',
  'compound_multi_unit',
  'compound_best_unit_confirmed',
  'club_class',
  'employment_status',
];

const FACT_LABELS: Readonly<Record<string, { en: string; ar: string }>> = {
  compound_name: { en: 'Compound', ar: 'الكومباوند' },
  compound_unit_type: { en: 'Unit type', ar: 'نوع الوحدة' },
  compound_unit_price: { en: 'Unit contract price', ar: 'سعر الوحدة بالعقد' },
  compound_dp_percent: { en: 'Share of price paid', ar: 'نسبة المدفوع من السعر' },
  compound_contract_year: { en: 'Contract year', ar: 'سنة العقد' },
  compound_months_since_purchase: { en: 'Months since contract', ar: 'شهور منذ العقد' },
  compound_fully_settled: { en: 'Unit fully paid off', ar: 'الوحدة مسددة بالكامل' },
  compound_joint_unit: { en: 'Sole or shared ownership', ar: 'ملكية فردية أو مشتركة' },
  compound_multi_unit: { en: 'Owns another unit', ar: 'يملك وحدة أخرى' },
  compound_best_unit_confirmed: { en: 'Strongest unit confirmed', ar: 'تأكيد أفضل وحدة' },
  club_class: { en: 'Club membership class', ar: 'درجة عضوية النادي' },
  employment_status: { en: 'Employment status', ar: 'حالة العمل' },
};

// ---------------------------------------------------------------------------
// 4. The two catalog rules
// ---------------------------------------------------------------------------

/**
 * The compound frame — ONE structure, four derivations, offered to every bank.
 *
 * Read it as: work out what has been paid, then let the bank's chosen derivation say what the
 * unit supports, then apply its multi-unit and shared-ownership policies. The bank's own
 * hard maximum is deliberately NOT a step: `loanLimits.maxAmountEGP` already clamps the
 * ceiling in `quoteProgram`, and a second copy on the rule would be a figure to keep in step
 * with the first.
 */
const COMPOUND_RULE: IncomeAssumptionConfig = {
  strategy: PRODUCT_RULE_STRATEGY,
  steps: [
    { id: 'price', op: 'factNumber', fact: 'compound_unit_price' },
    { id: 'dpPct', op: 'factNumber', fact: 'compound_dp_percent' },
    // What the customer has actually handed the developer. Both halves are the customer's
    // own answers — there is no bank figure in it, which is why the factor is a second input.
    { id: 'dpAmount', op: 'percentOf', of: [{ step: 'price' }, { step: 'dpPct' }] },
    { id: 'monthsOwned', op: 'factNumber', fact: 'compound_months_since_purchase' },

    // The four derivations. Each bank fills ONE.
    { id: 'capByUnitType', op: 'factChoiceTable', fact: 'compound_unit_type' },
    { id: 'capByCompoundClass', op: 'factParentTable', fact: 'compound_name' },
    { id: 'capByPaidBand', op: 'bandTable', of: { step: 'dpAmount' } },
    { id: 'capByPaidPercent', op: 'percentOf', of: { step: 'dpAmount' } },
    {
      id: 'capBasis',
      op: 'coalesce',
      of: [
        { step: 'capByUnitType' },
        { step: 'capByCompoundClass' },
        { step: 'capByPaidBand' },
        { step: 'capByPaidPercent' },
      ],
    },

    // Multi-unit policy. The table states BOTH answers, so "no uplift for a single-unit
    // owner" is a row rather than a special case; `{const: '100'}` is what a bank with no
    // multi-unit policy at all falls back to.
    { id: 'multiUnitFactor', op: 'factChoiceTable', fact: 'compound_multi_unit' },
    { id: 'multiUnitPct', op: 'coalesce', of: [{ step: 'multiUnitFactor' }, { const: '100' }] },
    { id: 'afterMultiUnit', op: 'percentOf', of: [{ step: 'capBasis' }, { step: 'multiUnitPct' }] },

    // Shared ownership, the same shape: one bank finances half a jointly owned unit, and
    // the rest state nothing and lend against all of it.
    { id: 'jointFactor', op: 'factChoiceTable', fact: 'compound_joint_unit' },
    { id: 'jointPct', op: 'coalesce', of: [{ step: 'jointFactor' }, { const: '100' }] },
    { id: 'ceiling', op: 'percentOf', of: [{ step: 'afterMultiUnit' }, { step: 'jointPct' }] },

    // One bank's required down payment is itself a band over the unit price (20% above 15
    // million, 40% below 10). Optional, and read only by the gate that compares against it.
    { id: 'requiredDpPct', op: 'bandTable', of: { step: 'price' } },
  ],
  gates: [
    // Four ways to state a down-payment requirement. Every bank turns on exactly the one it
    // applies; the others carry no figures and do not apply.
    {
      id: 'dpPercentFloor',
      kind: 'number',
      op: 'gte',
      left: { step: 'dpPct' },
      reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
    },
    {
      id: 'dpPercentByPrice',
      kind: 'number',
      op: 'gte',
      left: { step: 'dpPct' },
      right: { step: 'requiredDpPct' },
      reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
    },
    {
      id: 'dpAmountFloor',
      kind: 'number',
      op: 'gte',
      left: { step: 'dpAmount' },
      reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
    },
    {
      id: 'dpAmountByEmployment',
      kind: 'numberByKey',
      op: 'gte',
      left: { step: 'dpAmount' },
      keyedBy: 'employment_status',
      reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
    },
    // A minimum unit price that differs by the year the contract was signed.
    {
      id: 'unitPriceFloorByYear',
      kind: 'numberByKey',
      op: 'gte',
      left: { step: 'price' },
      keyedBy: 'compound_contract_year',
      reasonCode: 'UNIT_PRICE_BELOW_MIN',
    },
    // How long the unit must have been owned — shorter when it is paid off, which is a row
    // in the same table rather than a second gate.
    {
      id: 'ownedForMonths',
      kind: 'numberByKey',
      op: 'gte',
      left: { step: 'monthsOwned' },
      keyedBy: 'compound_fully_settled',
      reasonCode: 'CONTRACT_TOO_NEW',
    },
    {
      id: 'ownedForMonthsMax',
      kind: 'number',
      op: 'lte',
      left: { step: 'monthsOwned' },
      reasonCode: 'CONTRACT_TOO_OLD',
    },
    // One bank finances a single unit and prices the strongest one owned.
    {
      id: 'strongestUnitConfirmed',
      kind: 'choice',
      op: 'eq',
      fact: 'compound_best_unit_confirmed',
      expect: ['yes'],
      reasonCode: 'MULTI_UNIT_NOT_CONFIRMED',
    },
  ],
  output: {
    kind: 'maxAmount',
    from: 'ceiling',
    // All four banks calibrated their tables against a 50% debt-burden cap. A bank that caps
    // an applicant tighter gets `applicable ÷ 50` of the ceiling with no third setting.
    baselineDbrPercent: '50',
  },
};

/**
 * The club frame. One derivation, so no `coalesce` — a product whose banks agree on how the
 * ceiling is derived needs no choice, and offering one would be surface with no purpose.
 */
const CLUB_RULE: IncomeAssumptionConfig = {
  strategy: PRODUCT_RULE_STRATEGY,
  steps: [{ id: 'ceiling', op: 'factChoiceTable', fact: 'club_class' }],
  gates: [],
  output: { kind: 'maxAmount', from: 'ceiling', baselineDbrPercent: '50' },
};

interface CatalogProduct {
  key: string;
  labelEn: string;
  labelAr: string;
  categories: readonly LoanCategory[];
  rule: IncomeAssumptionConfig;
  /**
   * The questions this name SUGGESTS its banks score on — the archetype's house opinion,
   * pre-ticking step 1 of the per-program scoring wizard.
   *
   * Not optional in practice, even though the table is documented as advisory:
   * `ScoringService.saveWeights` refuses a weighted question outside this set
   * (`WEIGHTS_QUESTION_NOT_IN_CATALOG`), so a name with no template has nothing its banks may
   * score on and every one of its programs is offered at 0%. The seed says so out loud when
   * it happens; this is that warning answered rather than left in the log.
   *
   * A collateral product scores on the applicant's standing AND on the collateral itself —
   * the unit type and the share already paid say more about this loan than a payslip would.
   */
  scoresOn: readonly string[];
}

const CATALOG_PRODUCTS: readonly CatalogProduct[] = [
  {
    key: 'compound_owner',
    labelEn: 'Compound Ownership Guarantee',
    labelAr: 'ضمان ملكية الكومباوند',
    // Sold as a personal loan and as a mortgage-style product. Not a new CATEGORY: a
    // collateral product is an income BASIS question, and A26 scope-locks the four.
    categories: ['personal', 'mortgage'],
    rule: COMPOUND_RULE,
    scoresOn: [
      'employment_status',
      'current_loans',
      'amount_requested',
      'repayment_period_months',
      'compound_unit_type',
      'compound_dp_percent',
      'compound_contract_year',
      'compound_fully_settled',
    ],
  },
  {
    key: 'club_member',
    labelEn: 'Club Membership Loan',
    labelAr: 'تمويل عضوية النادي',
    categories: ['personal'],
    rule: CLUB_RULE,
    scoresOn: [
      'employment_status',
      'current_loans',
      'amount_requested',
      'repayment_period_months',
      'club_class',
    ],
  },
];

// ---------------------------------------------------------------------------
// 5. The banks' figures
// ---------------------------------------------------------------------------

type StepParams = NonNullable<IncomeAssumptionConfig['stepParams']>;

interface BankFigures {
  bankNameEnglish: string;
  programCode: string;
  friendlyName: string;
  friendlyNameAr: string;
  catalogKey: string;
  productCategory: string;
  ratePercent: string;
  minAmountEGP: string;
  maxAmountEGP: string;
  tenor: { minMonths: number; maxMonths: number };
  age: { min: number; max: number; selfEmployedMin?: number; selfEmployedMax?: number };
  dbrCapPercent: string;
  requiredDocuments?: string[];
  operatorNotes?: string;
  stepParams: StepParams;
}

/**
 * The four compound banks and the one club bank, as figures.
 *
 * Every number here is from §7 of the source design. What is NOT here is any statement about
 * HOW the ceiling is derived — that is the catalog's frame; a bank only says which of its
 * derivations it fills in, by filling one in.
 */
const BANK_FIGURES: readonly BankFigures[] = [
  {
    bankNameEnglish: 'ABK Egypt',
    programCode: 'ABK-COMPOUND-GUARANTEE',
    friendlyName: 'Compound Ownership Guarantee',
    friendlyNameAr: 'ضمان ملكية الكومباوند',
    catalogKey: 'compound_owner',
    productCategory: 'personal',
    ratePercent: '25.5000',
    minAmountEGP: '15000.00',
    maxAmountEGP: '4500000.00',
    tenor: { minMonths: 12, maxMonths: 84 },
    age: { min: 21, max: 60, selfEmployedMin: 25, selfEmployedMax: 65 },
    dbrCapPercent: '50.0000',
    operatorNotes:
      'Ceiling derived from the unit type. Multi-unit owners get a 10% uplift. Minimum 18 months of ownership, 6 if the unit is paid off. External home visit required when the unit is settled.',
    stepParams: {
      capByUnitType: {
        keyTable: [
          { key: 'apartment', incomeEGP: '2000000.00' },
          { key: 'twin_townhouse', incomeEGP: '3000000.00' },
          { key: 'villa', incomeEGP: '4000000.00' },
        ],
      },
      // Both answers stated, so "a single-unit owner gets no uplift" is a row.
      multiUnitFactor: {
        keyTable: [
          { key: 'no', incomeEGP: '100.00' },
          { key: 'yes', incomeEGP: '110.00' },
        ],
      },
      dpPercentFloor: { minValue: '15' },
      ownedForMonths: {
        keyTable: [
          { key: 'no', incomeEGP: '18.00' },
          { key: 'yes', incomeEGP: '6.00' },
        ],
      },
    },
  },
  {
    bankNameEnglish: 'EG Bank',
    programCode: 'EGB-COMPOUND-GUARANTEE',
    friendlyName: 'Compound Ownership Guarantee',
    friendlyNameAr: 'ضمان ملكية الكومباوند',
    catalogKey: 'compound_owner',
    productCategory: 'personal',
    ratePercent: '25.0000',
    minAmountEGP: '100000.00',
    maxAmountEGP: '6000000.00',
    tenor: { minMonths: 6, maxMonths: 84 },
    age: { min: 21, max: 60 },
    dbrCapPercent: '50.0000',
    requiredDocuments: ['bank_statement'],
    operatorNotes:
      'Ceiling derived from the compound class. Required down payment is a band over the unit price. Minimum unit price varies by contract year. Bank statement mandatory; home visit and a utility bill when the unit is settled.',
    stepParams: {
      capByCompoundClass: {
        keyTable: [
          { key: 'cat_aa', incomeEGP: '6000000.00' },
          { key: 'cat_ab', incomeEGP: '5000000.00' },
          { key: 'cat_a', incomeEGP: '4000000.00' },
          { key: 'cat_b', incomeEGP: '3000000.00' },
          { key: 'cat_c', incomeEGP: '2000000.00' },
        ],
      },
      // 20% above 15 million, 30% from 10, 40% below. Edges only, so the tiers cannot gap.
      requiredDpPct: {
        bands: [
          { fromInclusive: '0', toExclusive: '10000000', incomeEGP: '40.00' },
          { fromInclusive: '10000000', toExclusive: '15000000', incomeEGP: '30.00' },
          { fromInclusive: '15000000', toExclusive: null, incomeEGP: '20.00' },
        ],
      },
      unitPriceFloorByYear: {
        keyTable: [
          { key: '2024', incomeEGP: '3000000.00' },
          { key: '2023', incomeEGP: '2500000.00' },
          { key: '2022', incomeEGP: '2000000.00' },
          { key: '2021', incomeEGP: '1500000.00' },
          { key: 'before2021', incomeEGP: '1000000.00' },
        ],
      },
    },
  },
  {
    bankNameEnglish: 'FABMISR',
    programCode: 'FAB-COMPOUND-GUARANTEE',
    friendlyName: 'Compound Ownership Guarantee',
    friendlyNameAr: 'ضمان ملكية الكومباوند',
    catalogKey: 'compound_owner',
    productCategory: 'personal',
    ratePercent: '25.0000',
    minAmountEGP: '750000.00',
    maxAmountEGP: '2000000.00',
    tenor: { minMonths: 6, maxMonths: 72 },
    age: { min: 30, max: 90 },
    dbrCapPercent: '50.0000',
    operatorNotes:
      'Ceiling derived from a band over the amount already paid (new-to-bank column only — the cross-sell column needs a CRM flag this platform has no source for). Half the ceiling on a jointly owned unit. Contract no older than 120 months. FCU verification on the ownership contract.',
    stepParams: {
      capByPaidBand: {
        bands: [
          { fromInclusive: '250000', toExclusive: '500000', incomeEGP: '750000.00' },
          { fromInclusive: '500000', toExclusive: '1000000', incomeEGP: '1000000.00' },
          { fromInclusive: '1000000', toExclusive: '1500000', incomeEGP: '1250000.00' },
          { fromInclusive: '1500000', toExclusive: null, incomeEGP: '1500000.00' },
        ],
      },
      jointFactor: {
        keyTable: [
          { key: 'mine_only', incomeEGP: '100.00' },
          { key: 'shared', incomeEGP: '50.00' },
        ],
      },
      dpAmountFloor: { minValue: '250000' },
      ownedForMonthsMax: { maxValue: '120' },
    },
  },
  {
    bankNameEnglish: 'Crédit Agricole Egypt',
    programCode: 'CAE-COMPOUND-GUARANTEE',
    friendlyName: 'Compound Ownership Guarantee',
    friendlyNameAr: 'ضمان ملكية الكومباوند',
    catalogKey: 'compound_owner',
    productCategory: 'personal',
    ratePercent: '25.0000',
    minAmountEGP: '50000.00',
    maxAmountEGP: '3000000.00',
    tenor: { minMonths: 6, maxMonths: 84 },
    age: { min: 21, max: 60, selfEmployedMin: 25, selfEmployedMax: 65 },
    // 50% is the BASELINE the ceiling was calibrated against. The source design also caps
    // self-employed applicants at 40%, which `dbrBands` cannot express (they key off income,
    // not employment) — recorded in this file's header rather than faked with a band.
    dbrCapPercent: '50.0000',
    operatorNotes:
      'Ceiling is 50% of the amount already paid, capped by the program maximum. Finances one unit only — a multi-unit owner must confirm the strongest one. Self-employed applicants need 100,000 paid and two years of business activity. External home visit when the unit is settled.',
    stepParams: {
      capByPaidPercent: { scalar: { value: '50', unit: 'percent' } },
      dpAmountByEmployment: {
        keyTable: [
          { key: 'government_employee', incomeEGP: '0.00' },
          { key: 'private_sector_employee', incomeEGP: '0.00' },
          { key: 'retired', incomeEGP: '0.00' },
          { key: 'business_owner_company_owner', incomeEGP: '100000.00' },
          { key: 'freelancer', incomeEGP: '100000.00' },
        ],
      },
      strongestUnitConfirmed: { applies: true },
    },
  },
  {
    bankNameEnglish: 'ABK Egypt',
    programCode: 'ABK-CLUB-MEMBERSHIP',
    friendlyName: 'Club Membership Loan',
    friendlyNameAr: 'تمويل عضوية النادي',
    catalogKey: 'club_member',
    productCategory: 'personal',
    ratePercent: '30.0000',
    minAmountEGP: '15000.00',
    maxAmountEGP: '500000.00',
    tenor: { minMonths: 12, maxMonths: 48 },
    age: { min: 21, max: 60 },
    dbrCapPercent: '50.0000',
    operatorNotes: 'Ceiling derived from the membership class.',
    stepParams: {
      ceiling: {
        keyTable: [
          { key: 'class_1', incomeEGP: '500000.00' },
          { key: 'class_2', incomeEGP: '300000.00' },
          { key: 'class_3', incomeEGP: '150000.00' },
        ],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

const FACT_TYPE = 'surrogate_fact';
const PROGRAM_NAME_TYPE = 'program_name';

/** Every write is "the listed set IS the set", so a re-run converges. */
async function main(): Promise<void> {
  const actorId = await resolveSeedActor();
  if (!actorId) {
    console.error('[seed-collateral] no active super_admin found — run `npx prisma db seed` first.');
    return;
  }

  await upsertLookups(actorId);

  // The questionnaire owns the pool and the publish. Called AFTER the lookups because two of
  // its questions expand their options from them, and a question published against an empty
  // registry carries no options at all.
  if (DRY) {
    console.log('[seed-collateral] --dry: skipping the questionnaire publish.');
  } else {
    await seedQuestionnaire();
  }

  const factsWritten = await upsertFacts(actorId);
  const rulesWritten = await upsertCatalog(actorId);
  const programs = await upsertPrograms(actorId);

  console.log(
    `[seed-collateral] ${LOOKUPS.length} lookup values, ${factsWritten} facts, ` +
      `${rulesWritten} catalog rules, ${programs.written} programs ` +
      `(${programs.skipped} skipped).`,
  );
  for (const problem of programs.problems) console.warn(`[seed-collateral] ! ${problem}`);
  if (!DRY && programs.written > 0) {
    console.log(
      '[seed-collateral] next: `npm run seed:weights` — a program with no ACTIVE weight set is offered at 0%.',
    );
  }
}

async function upsertLookups(actorId: string): Promise<void> {
  for (const row of LOOKUPS) {
    if (DRY) {
      console.log(`[seed-collateral] would upsert ${row.type}/${row.key}`);
      continue;
    }
    await prisma.platformEnumeration.upsert({
      where: { idx_platform_enumeration_type_key: { type: row.type, key: row.key } },
      // Labels and the parent are refreshed; `active` is NOT forced back on. An operator who
      // deprecated a compound did so deliberately, and a seed re-run must not resurrect it.
      update: {
        labelEn: row.labelEn,
        labelAr: row.labelAr,
        parentKey: row.parentKey ?? null,
        sortOrder: row.sortOrder,
        updatedBy: actorId,
      },
      create: {
        type: row.type,
        key: row.key,
        labelEn: row.labelEn,
        labelAr: row.labelAr,
        parentKey: row.parentKey ?? null,
        sortOrder: row.sortOrder,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
  }
}

/**
 * One `surrogate_fact` row per pack question, bound to it.
 *
 * `systemOnly` is NOT set: unlike the four facts the platform shipped with, these describe a
 * product an operator may reasonably retire, and a row nobody can deactivate is a row that
 * outlives its product.
 */
async function upsertFacts(actorId: string): Promise<number> {
  const questions = await prisma.question.findMany({
    where: { code: { in: [...FACT_QUESTION_CODES] } },
    select: { id: true, code: true, type: true },
  });
  const byCode = new Map(questions.map((q) => [q.code, q]));

  let written = 0;
  for (const code of FACT_QUESTION_CODES) {
    const question = byCode.get(code);
    if (!question) {
      console.warn(
        `[seed-collateral] ! question '${code}' not in the pool — fact skipped. Run \`npm run seed:questionnaire\`.`,
      );
      continue;
    }
    if (question.type !== 'SINGLE_SELECT' && question.type !== 'NUMERIC') {
      // Only these two are bindable: the first gives a key table, the second gives bands, and
      // nothing else is a figure a bank can look a value up against.
      console.warn(`[seed-collateral] ! question '${code}' is ${question.type} — not bindable.`);
      continue;
    }
    const label = FACT_LABELS[code] ?? { en: code, ar: code };
    if (DRY) {
      console.log(`[seed-collateral] would bind fact '${code}' → question '${code}'`);
      continue;
    }
    await prisma.platformEnumeration.upsert({
      where: { idx_platform_enumeration_type_key: { type: FACT_TYPE, key: code } },
      update: { labelEn: label.en, labelAr: label.ar, boundQuestionId: question.id, updatedBy: actorId },
      create: {
        type: FACT_TYPE,
        key: code,
        labelEn: label.en,
        labelAr: label.ar,
        boundQuestionId: question.id,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    written += 1;
  }
  return written;
}

/**
 * The two catalog names, their offered categories, and their rules.
 *
 * Each rule is validated through the SAME `validateIncomeRule` a save runs, with the same
 * registry lookups, so this seed cannot plant a pipeline no operator could have authored. A
 * rejected rule is reported and skipped — never half-written.
 */
async function upsertCatalog(actorId: string): Promise<number> {
  const ctx = ruleContext();
  let written = 0;

  for (const product of CATALOG_PRODUCTS) {
    // `figuresRequired: false` — same as the catalog endpoint. These rules carry the shape
    // and no figures, because the four banks under the compound frame disagree about all of
    // them and each states its own in `BANK_FIGURES`.
    const violation = await validateIncomeRule(product.rule, ctx, { figuresRequired: false });
    if (violation) {
      console.warn(
        `[seed-collateral] ! rule for '${product.key}' rejected: ${JSON.stringify(violation)} — skipped.`,
      );
      continue;
    }
    if (DRY) {
      console.log(`[seed-collateral] would write the '${product.key}' rule (validated clean)`);
      written += 1;
      continue;
    }

    const row = await prisma.platformEnumeration.upsert({
      where: { idx_platform_enumeration_type_key: { type: PROGRAM_NAME_TYPE, key: product.key } },
      update: {
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        incomeRule: product.rule as unknown as Prisma.InputJsonValue,
        updatedBy: actorId,
      },
      create: {
        type: PROGRAM_NAME_TYPE,
        key: product.key,
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        incomeRule: product.rule as unknown as Prisma.InputJsonValue,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: { id: true },
    });

    // The offered set IS the listed set. `noPayslip` on both, because a collateral product
    // reads no payslip by definition — that is the catalog stating its INTENT; each bank's
    // own `programType` remains the only authority on how it actually sells (v16.4.0).
    for (const category of product.categories) {
      await prisma.platformEnumerationLoanCategory.upsert({
        where: {
          pk_platform_enumeration_loan_category: { enumerationId: row.id, category },
        },
        update: { payslip: false, noPayslip: true },
        create: { enumerationId: row.id, category, payslip: false, noPayslip: true },
      });

      // The suggested scoring set, per (name, category). A code the category does not ask is
      // DROPPED from the write rather than written and flagged: the service tolerates that
      // drift because an operator may have ticked ahead of an assignment, but a seed has no
      // such excuse — it would just be shipping the board a warning on day one.
      const asked = await prisma.question.findMany({
        where: {
          code: { in: [...product.scoresOn] },
          isActive: true,
          loanCategories: { some: { category } },
        },
        select: { id: true, code: true },
      });
      const dropped = product.scoresOn.filter((code) => !asked.some((q) => q.code === code));
      if (dropped.length > 0) {
        console.warn(
          `[seed-collateral] ! '${product.key}' (${category}) suggests questions that category does not ask: ${dropped.join(', ')} — dropped.`,
        );
      }
      await prisma.platformEnumerationQuestion.deleteMany({
        where: { enumerationId: row.id, category },
      });
      if (asked.length > 0) {
        await prisma.platformEnumerationQuestion.createMany({
          data: asked.map((q) => ({ enumerationId: row.id, category, questionId: q.id })),
        });
      }
    }
    written += 1;
  }
  return written;
}

async function upsertPrograms(
  actorId: string,
): Promise<{ written: number; skipped: number; problems: string[] }> {
  const banks = await prisma.bank.findMany({ select: { id: true, nameEnglish: true } });
  const bankIdByName = new Map(banks.map((b) => [b.nameEnglish, b.id]));
  const problems: string[] = [];
  let written = 0;
  let skipped = 0;

  for (const figures of BANK_FIGURES) {
    const bankId = bankIdByName.get(figures.bankNameEnglish);
    if (!bankId) {
      problems.push(
        `bank '${figures.bankNameEnglish}' missing — run \`npm run seed:banks\` first; ${figures.programCode} skipped`,
      );
      skipped += 1;
      continue;
    }

    const data = composeProgram(figures, bankId, actorId);
    if (DRY) {
      console.log(`[seed-collateral] would upsert ${figures.programCode}`);
      written += 1;
      continue;
    }

    const existing = await prisma.bankProgram.findUnique({
      where: { programCode: figures.programCode },
      select: { id: true },
    });
    if (existing) {
      const { programCode: _code, createdBy: _createdBy, ...rest } = data;
      await prisma.bankProgram.update({ where: { id: existing.id }, data: rest });
    } else {
      await prisma.bankProgram.create({ data });
    }
    written += 1;
  }

  return { written, skipped, problems };
}

/**
 * One bank's row. The product-rule half is `stepParams` and NOTHING else: the steps, the
 * gates and the output belong to the catalog name and are merged in on every read by
 * `effectiveIncomeRule`. Storing a copy here is what the API refuses and what
 * `stripCatalogStructure` removes.
 */
function composeProgram(
  figures: BankFigures,
  bankId: string,
  actorId: string,
): Prisma.BankProgramUncheckedCreateInput {
  return {
    programCode: figures.programCode,
    bankName: figures.bankNameEnglish,
    bankId,
    friendlyName: figures.friendlyName,
    friendlyNameAr: figures.friendlyNameAr,
    programNameKey: figures.catalogKey,
    // The applicant's payslip is never read: the unit, or the membership, is the capacity.
    programType: 'income_surrogate',
    productCategory: figures.productCategory,
    active: true,
    isShariaCompliant: false,
    requiredDocuments: figures.requiredDocuments ?? [],
    ...(figures.operatorNotes !== undefined ? { operatorNotes: figures.operatorNotes } : {}),
    tenor: figures.tenor as unknown as Prisma.InputJsonValue,
    loanLimits: {
      minAmountEGP: figures.minAmountEGP,
      maxAmountEGP: figures.maxAmountEGP,
    } as unknown as Prisma.InputJsonValue,
    pricing: {
      isVariableRate: false,
      baseRatePercent: figures.ratePercent,
    } as unknown as Prisma.InputJsonValue,
    eligibility: {
      acceptedEmploymentTypes: [],
      ageMin: figures.age.min,
      ageMax: figures.age.max,
      ...(figures.age.selfEmployedMin !== undefined
        ? { ageMinSelfEmployed: figures.age.selfEmployedMin }
        : {}),
      ...(figures.age.selfEmployedMax !== undefined
        ? { ageMaxSelfEmployed: figures.age.selfEmployedMax }
        : {}),
      // ZERO, and deliberately: a collateral product has no income requirement to state, and
      // `checkEligibility` skips the comparison entirely for a rule whose answer is a ceiling.
      minMonthlyIncomeEGP: '0.00',
      minMonthsInJob: 0,
      dbrCapPercent: figures.dbrCapPercent,
      skipDbrCheck: false,
      acceptedTransferTypes: [],
      requiresCD: false,
      requiresAutoLoanAtABK: false,
      requiresAutoLoanAtOtherBank: false,
      requiresCreditCardAtOtherBank: false,
      // The gate the platform already had for this product. It fires nowhere today
      // (`skipEligibility` is set on every production path) — the ownership questions and the
      // rule's own gates are what actually decide — but it is the truthful value.
      requiresCompoundProperty: figures.catalogKey === 'compound_owner',
      requiresCollateral: false,
      requiresClubMembership: figures.catalogKey === 'club_member',
      requiresExistingLoan: false,
      requiresFRMUVerification: false,
      requiresQualitativeReview: false,
      requiresNoDocuments: false,
    } as unknown as Prisma.InputJsonValue,
    incomeAssumption: {
      strategy: PRODUCT_RULE_STRATEGY,
      // Its OWN figures. `'catalog'` would mean "quote off the catalog's starting numbers",
      // and these four banks disagree about every one of them.
      amounts: 'own',
      stepParams: figures.stepParams,
    } as unknown as Prisma.InputJsonValue,
    fees: {
      adminFeePercent: '1.0000',
      stampDutyPercent: '0.0000',
      lifeInsurancePercent: '0.0000',
      lifeInsuranceMandatory: false,
      latePaymentFeePercent: '0.0000',
      payoffCashPercent: '0.0000',
      payoffBuyoutPercent: '0.0000',
    } as unknown as Prisma.InputJsonValue,
    valueSources: {} as Prisma.InputJsonValue,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

/**
 * The registry lookups `validateIncomeRule` needs.
 *
 * Mirrors `BankProgramsService#incomeRuleContext()` — same four questions, same fail-closed
 * answers — because a rule this accepts and that rejects (or the reverse) is a rule the seed
 * can plant and no admin can save.
 */
function ruleContext(): IncomeRuleValidationContext {
  return {
    isActiveMember: async (type, key) =>
      (await prisma.platformEnumeration.count({
        where: { type, key, active: true, deprecatedAt: null },
      })) > 0,
    activeMembers: async (type) =>
      (
        await prisma.platformEnumeration.findMany({
          where: { type, active: true, deprecatedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
          select: { key: true },
        })
      ).map((m) => m.key),
    surrogateFacts: async () => {
      const rows = await prisma.platformEnumeration.findMany({
        where: {
          type: FACT_TYPE,
          active: true,
          deprecatedAt: null,
          boundQuestion: { isActive: true, type: { in: ['SINGLE_SELECT', 'NUMERIC'] } },
        },
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
        select: { key: true, boundQuestion: { select: { code: true, type: true } } },
      });
      return rows.flatMap((row) =>
        row.boundQuestion === null
          ? []
          : [
              {
                key: row.key,
                questionCode: row.boundQuestion.code,
                type: row.boundQuestion.type as 'SINGLE_SELECT' | 'NUMERIC',
              },
            ],
      );
    },
    questionOptionCodes: async (questionCode) =>
      (
        await prisma.questionOption.findMany({
          where: { question: { code: questionCode }, isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
          select: { code: true },
        })
      ).map((o) => o.code),
  };
}

async function resolveSeedActor(): Promise<string | null> {
  const staff = await prisma.staffAccount.findFirst({
    where: { role: 'super_admin', isActive: true },
    select: { id: true },
  });
  return staff?.id ?? null;
}

main()
  .catch((error) => {
    console.error('[seed-collateral] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
