/**
 * Seed — the COLLATERAL products: the compound-ownership guarantee, and the loan against a
 * car the applicant already owns.
 *
 * These are the products whose ceiling is derived from a thing the applicant OWNS rather than
 * from an income. Nothing in this file is code the engine branches on: it is seven bank
 * programs, two catalog rules, fifteen facts and two lookup lists — data, in the shapes
 * `matching/pipeline/product-rule.ts` evaluates (Principle II / A1).
 *
 * Run:  npm run seed:collateral        (add --dry to print the plan and write nothing)
 *
 * ─── What it writes, in this order, because each step needs the one before ────
 *
 *   1. LOOKUPS — `compound_category` and `compound` (each row filed under its category with
 *      `parentKey`). First, because the questionnaire expands one of its option lists from
 *      them (`optionsFromEnum`), so a question published before these rows exist would carry
 *      no options at all. The car pack needs no lookup: its age buckets are a closed list
 *      authored on the question itself.
 *   2. QUESTIONNAIRE — delegates to `seedQuestionnaire()`, which owns the ONE global pool
 *      and publishes a snapshot. The gate and the packs are authored there, not here: a
 *      second publisher is how two snapshots come to disagree about what was asked.
 *   3. FACTS — a `surrogate_fact` row per pack question, bound to it. This is what carries
 *      an answer into `ApplicantProfile.surrogateFacts` with no mapping code on either
 *      client. The binding lives on the FACT, never on the question (A33).
 *   4. CATALOG NAMES + RULES — the two products' step pipelines, stated ONCE. Validated
 *      through the same `validateIncomeRule` the admin save runs, so this seed cannot plant
 *      a rule no operator could have saved.
 *   5. BANK PROGRAMS — seven rows whose ONLY product-rule content is `stepParams`: figures.
 *      Adding another bank is another entry in `BANK_FIGURES` and nothing else. Two of the
 *      seven state no figures at all and quote off the catalog's defaults
 *      (`amounts: 'catalog'`), which is what proves the inheritance actually merges.
 *
 * ─── One ordering wrinkle, and why it is not a bug ────────────────────────────
 *
 * `seedQuestionnaire()` also builds each program's scoring weight set, from the catalog's
 * question template — and on a FIRST run the two new names have no template yet, because a
 * template references question IDs that step 2 has only just created. So the first pass ends
 * with the seven programs carrying no ACTIVE weight set, which means a 0% score.
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
 * Two of those derivations come in a PAIR — a standard column and a higher one for a customer
 * the bank already has — chosen by a `pickByFact` step over the derived `bank_relationship`
 * fact. A bank that does not sell the second column leaves it blank and the pick falls back
 * to the first, so the pair is free for the banks that have no such offer.
 *
 * ─── Accepted gaps, stated rather than faked ──────────────────────────────────
 *
 *   - **The X-SELL TENOR exception.** FABMISR raises its 72-month cap to 84 for a
 *     cross-sell customer. The tenor cap comes from the rate cascade, whose applicant
 *     context carries no facts, so a segment cannot reach it — the cross-sell CAP column IS
 *     seeded (`capByPaidBandXsell`), the tenor half is not.
 *   - **Who is a cross-sell customer.** Answered by the applicant ("which of these banks do
 *     you already use?") and derived per program, rather than read from a CRM the platform
 *     has no access to. An applicant who skips the question is quoted as new to every bank —
 *     the standard column — never refused.
 *   - **Fraud checks and document lists** are informational in the source design and are not
 *     modelled as rule steps; they belong to `requiredDocuments` and operator notes.
 *   - **The car product carries no gates.** A minimum car value or a maximum age would each
 *     need a new `GATE_REASON_CODES` value, which is a five-surface change (A25); the demo
 *     states its policy in the advance table instead, where an older car simply borrows less.
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
  'self_employed_licence',
  'business_years',
  'owned_car_value',
  'owned_car_age',
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
  self_employed_licence: { en: 'Trade or practice licence', ar: 'رخصة تجارية أو مهنية' },
  business_years: { en: 'Years in business', ar: 'مدة النشاط التجاري' },
  owned_car_value: { en: 'Car value', ar: 'قيمة السيارة' },
  owned_car_age: { en: 'Car age', ar: 'عمر السيارة' },
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
    //
    // Two of them come in a PAIR: a standard column and a higher one for a customer the
    // bank already has. The uplift is not one percentage — 2M → 3M on an apartment but
    // 4M → 4.5M on a villa — so it is a second table, and `pickByFact` says which column
    // this applicant reads. A bank that does not sell the second column leaves it blank and
    // the pick falls back to the first, so the pair costs the other banks nothing.
    { id: 'capByUnitType', op: 'factChoiceTable', fact: 'compound_unit_type' },
    { id: 'capByUnitTypeTopUp', op: 'factChoiceTable', fact: 'compound_unit_type' },
    {
      id: 'capByUnitTypeForSegment',
      op: 'pickByFact',
      fact: 'bank_relationship',
      branches: ['ntb', 'xsell'],
      of: [{ step: 'capByUnitType' }, { step: 'capByUnitTypeTopUp' }],
    },

    { id: 'capByCompoundClass', op: 'factParentTable', fact: 'compound_name' },

    { id: 'capByPaidBand', op: 'bandTable', of: { step: 'dpAmount' } },
    { id: 'capByPaidBandXsell', op: 'bandTable', of: { step: 'dpAmount' } },
    {
      id: 'capByPaidBandForSegment',
      op: 'pickByFact',
      fact: 'bank_relationship',
      branches: ['ntb', 'xsell'],
      of: [{ step: 'capByPaidBand' }, { step: 'capByPaidBandXsell' }],
    },

    { id: 'capByPaidPercent', op: 'percentOf', of: { step: 'dpAmount' } },
    {
      id: 'capBasis',
      op: 'coalesce',
      of: [
        { step: 'capByUnitTypeForSegment' },
        { step: 'capByCompoundClass' },
        { step: 'capByPaidBandForSegment' },
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
    // `expect` as an ALLOW-LIST, the same way the two self-employed gates use it: a customer
    // who owns ONE unit has nothing to confirm, and refusing them for an unanswered
    // comparison against units they do not have is a refusal about the questionnaire rather
    // than about the applicant.
    {
      id: 'strongestUnitConfirmed',
      kind: 'choice',
      op: 'eq',
      fact: 'compound_best_unit_confirmed',
      expect: ['yes', 'single_unit'],
      reasonCode: 'MULTI_UNIT_NOT_CONFIRMED',
    },
    // The two self-employed conditions. `expect` is an ALLOW-LIST, which is what lets one
    // gate serve both the requirement and the applicant it does not apply to: "I'm not
    // self-employed" passes, so a salaried applicant is never refused for a licence this
    // bank would never have asked them for.
    {
      id: 'selfEmployedLicence',
      kind: 'choice',
      op: 'eq',
      fact: 'self_employed_licence',
      expect: ['yes', 'not_self_employed'],
      reasonCode: 'SELF_EMPLOYED_DOCS_MISSING',
    },
    {
      id: 'businessYears',
      kind: 'choice',
      op: 'eq',
      fact: 'business_years',
      expect: ['two_or_more', 'not_self_employed'],
      reasonCode: 'BUSINESS_TOO_NEW',
    },
  ],
  output: {
    kind: 'maxAmount',
    from: 'ceiling',
    // All four banks calibrated their tables against a 50% debt-burden cap. A bank that caps
    // an applicant tighter gets `applicable ÷ 50` of the ceiling with no third setting.
    baselineDbrPercent: '50',
  },

  // ─── The DEFAULTS a new bank starts from ─────────────────────────────────────
  //
  // A bank configuring this product does not start from a blank pipeline: the wizard seeds
  // its editor from these figures, and its first keystroke detaches the program onto its own
  // copy of the whole set (`seedFromCatalog` / `detachFromCatalog`). So a default is worth
  // stating wherever the platform can state a STARTING amount without asserting a policy.
  //
  // Defaulted — every step whose input is a closed option list, so a wrong key is refused at
  // save rather than discovered as a `no_matching_row` on a customer:
  //
  //   · `capByUnitType` + `capByUnitTypeTopUp`  the two columns of the commonest derivation
  //   · `capByPaidPercent`                      a percentage of what has been paid
  //
  // NOT defaulted, and each for a reason that would cost a real applicant a quote:
  //
  //   · **Every GATE.** A gate default is LIVE for any bank on `amounts: 'catalog'`
  //     (`isGateConfigured` reads the merged figures), so it would hand a bank a refusal
  //     rule it never chose. A failed gate is a stated refusal; an inherited example has to
  //     quote, not explain itself.
  //   · **`capByCompoundClass`** is a `factParentTable`, whose parent keys are deliberately
  //     NOT validated at save. A default with one dead class would save clean and then quote
  //     nothing for whoever picked that compound.
  //   · **The band tables** (`capByPaidBand`, `capByPaidBandXsell`, `requiredDpPct`). A
  //     value outside every band is `no_matching_band`, which STOPS the rule — it does not
  //     skip the step — so a defaulted band table plus one applicant below its floor kills a
  //     quote another derivation could have priced. It would also have the platform
  //     asserting an amount tier no bank stated.
  //   · **`multiUnitFactor` / `jointFactor`.** A NEUTRAL table (every row 100) would change
  //     no figure and still cost quotes: a CONFIGURED table reads its fact, and both facts
  //     answer optional questions, so an applicant who skipped one would be refused
  //     (`fact_not_answered`) by a table that was only ever going to multiply by 1. Left
  //     blank, `{const: '100'}` in the structure above answers for them. A bank that HAS a
  //     policy states it — which is a figure, not a default.
  stepParams: {
    capByUnitType: {
      keyTable: [
        { key: 'apartment', incomeEGP: '2000000.00' },
        { key: 'twin_townhouse', incomeEGP: '3000000.00' },
        { key: 'villa', incomeEGP: '4000000.00' },
      ],
    },
    capByUnitTypeTopUp: {
      keyTable: [
        { key: 'apartment', incomeEGP: '3000000.00' },
        { key: 'twin_townhouse', incomeEGP: '3500000.00' },
        { key: 'villa', incomeEGP: '4500000.00' },
      ],
    },
    capByPaidPercent: { scalar: { value: '50', unit: 'percent' } },
  },
};

/**
 * The car frame — what the applicant's own car supports.
 *
 * One derivation, so no `coalesce`: the banks selling this agree that the ceiling is a share
 * of what the car is worth, and disagree only about the share. That share is a TABLE rather
 * than a scalar because it falls with the car's age, and a table keyed by a closed option list
 * is a figure a bank can be wrong about at save time rather than on a customer.
 *
 * No gates. A minimum value or a maximum age would each need a new `GATE_REASON_CODES` value
 * across five surfaces (A25); an older car borrowing a smaller share says the same thing with
 * figures the bank already has to state.
 */
const CAR_RULE: IncomeAssumptionConfig = {
  strategy: PRODUCT_RULE_STRATEGY,
  steps: [
    { id: 'carValue', op: 'factNumber', fact: 'owned_car_value' },
    { id: 'advancePct', op: 'factChoiceTable', fact: 'owned_car_age' },
    { id: 'ceiling', op: 'percentOf', of: [{ step: 'carValue' }, { step: 'advancePct' }] },
  ],
  gates: [],
  output: { kind: 'maxAmount', from: 'ceiling', baselineDbrPercent: '50' },
  // Defaulted, because the keys are a closed option list: a wrong key is refused at save
  // rather than discovered as a `no_matching_row` on a customer. A bank inheriting these
  // quotes exactly these shares, and typing over one row is what makes them its own.
  stepParams: {
    advancePct: {
      keyTable: [
        { key: 'up_to_3', incomeEGP: '70.00' },
        { key: '3_to_7', incomeEGP: '60.00' },
        { key: 'over_7', incomeEGP: '50.00' },
      ],
    },
  },
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
    key: 'car_owner',
    labelEn: 'Car Ownership Loan',
    labelAr: 'تمويل بضمان السيارة',
    // `car` only: the collateral IS a car, and the applicant who has one to borrow against is
    // the one already in the auto funnel. Widening it is an assignment on the questionnaire
    // screen plus a category here — never a new loan category (A26).
    categories: ['car'],
    rule: CAR_RULE,
    scoresOn: [
      'employment_status',
      'current_loans',
      'amount_requested',
      'repayment_period_months',
      'owned_car_age',
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
  /** The cap for a bucket that differs from the baseline above (e.g. self-employed 40%). */
  dbrCapPercentByEmploymentType?: Record<string, string>;
  requiredDocuments?: string[];
  operatorNotes?: string;
  /**
   * Whose figures this bank quotes off.
   *
   * Absent means `'own'`, which is every bank that states its own derivation. `'catalog'` is
   * a bank that has signed up to the product and stated nothing but a rate and a limit —
   * it quotes off the name's default figures, and stays in step when they change.
   */
  amounts?: 'catalog' | 'own';
  /** Omitted entirely by a bank on catalog amounts: the server would strip it anyway. */
  stepParams?: StepParams;
}

/**
 * The four compound banks, the car bank, and the two that quote off the catalog's defaults.
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
      'Ceiling derived from the unit type, with a higher column for an existing ABK customer. Multi-unit owners get a 10% uplift. Minimum 18 months of ownership, 6 if the unit is paid off. External home visit required when the unit is settled.',
    stepParams: {
      capByUnitType: {
        keyTable: [
          { key: 'apartment', incomeEGP: '2000000.00' },
          { key: 'twin_townhouse', incomeEGP: '3000000.00' },
          { key: 'villa', incomeEGP: '4000000.00' },
        ],
      },
      // The top-up column — what the bank lends against the same unit to a customer it
      // already has. This is what makes `maxAmountEGP` 4 500 000 reachable: the standard
      // column tops out at 4 000 000, and the multi-unit uplift alone reaches 4 400 000.
      capByUnitTypeTopUp: {
        keyTable: [
          { key: 'apartment', incomeEGP: '3000000.00' },
          { key: 'twin_townhouse', incomeEGP: '3500000.00' },
          { key: 'villa', incomeEGP: '4500000.00' },
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
      'Ceiling derived from a band over the amount already paid, with a higher cross-sell column for an existing FABMISR customer. Half the ceiling on a jointly owned unit. Contract no older than 120 months. FCU verification on the ownership contract. The cross-sell TENOR exception (84 months instead of 72) is not modelled: the tenor cap comes from the rate cascade, which reads no facts.',
    stepParams: {
      // The lowest band opens at ZERO, not at the 250 000 floor this bank also states as a
      // gate. Steps run before gates, so a band starting at 250 000 meant anyone below it
      // died at the STEP with `no_matching_band` — an opaque stop — and the gate that exists
      // to say "your down payment is short" never ran at all. Opened at zero, the tier is
      // unreachable in practice (the gate refuses first) and the refusal is the one the
      // customer can act on.
      capByPaidBand: {
        bands: [
          { fromInclusive: '0', toExclusive: '500000', incomeEGP: '750000.00' },
          { fromInclusive: '500000', toExclusive: '1000000', incomeEGP: '1000000.00' },
          { fromInclusive: '1000000', toExclusive: '1500000', incomeEGP: '1250000.00' },
          { fromInclusive: '1500000', toExclusive: null, incomeEGP: '1500000.00' },
        ],
      },
      // The cross-sell column. Same bands over the same paid amount, a tier higher — which
      // is what makes this program's own `maxAmountEGP` of 2 000 000 reachable.
      capByPaidBandXsell: {
        bands: [
          { fromInclusive: '0', toExclusive: '500000', incomeEGP: '1250000.00' },
          { fromInclusive: '500000', toExclusive: '1000000', incomeEGP: '1500000.00' },
          { fromInclusive: '1000000', toExclusive: '1500000', incomeEGP: '1750000.00' },
          { fromInclusive: '1500000', toExclusive: null, incomeEGP: '2000000.00' },
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
    // 50% is the BASELINE the ceiling was calibrated against, and the cap a salaried
    // applicant is measured by. A self-employed one is capped at 40%, stated below: the
    // ceiling→income conversion divides by the baseline and the affordability check
    // multiplies by whichever cap applies, so 40 ÷ 50 cuts this applicant's ceiling to 80%
    // with no third setting to keep in step.
    dbrCapPercent: '50.0000',
    dbrCapPercentByEmploymentType: { self_employed: '40.0000' },
    operatorNotes:
      'Ceiling is 50% of the amount already paid, capped by the program maximum. Finances one unit only — a multi-unit owner must confirm the strongest one. Self-employed applicants are capped at 40% debt burden instead of 50%, and need 100,000 paid, a valid trade or practice licence and two years of business activity. External home visit when the unit is settled.',
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
      // The two self-employed document conditions. Both gates read an answer that includes
      // "I'm not self-employed", so turning them on costs a salaried applicant nothing.
      selfEmployedLicence: { applies: true },
      businessYears: { applies: true },
    },
  },
  {
    bankNameEnglish: 'ABK Egypt',
    programCode: 'ABK-CAR-OWNER',
    friendlyName: 'Car Ownership Loan',
    friendlyNameAr: 'تمويل بضمان السيارة',
    catalogKey: 'car_owner',
    productCategory: 'car',
    ratePercent: '25.5000',
    minAmountEGP: '15000.00',
    maxAmountEGP: '1500000.00',
    tenor: { minMonths: 12, maxMonths: 60 },
    age: { min: 21, max: 60 },
    dbrCapPercent: '50.0000',
    operatorNotes:
      'Ceiling is a share of what the car is worth, falling with the car\u2019s age. Advances more than the catalog on a nearly new car and less on an old one.',
    stepParams: {
      advancePct: {
        keyTable: [
          { key: 'up_to_3', incomeEGP: '75.00' },
          { key: '3_to_7', incomeEGP: '65.00' },
          { key: 'over_7', incomeEGP: '50.00' },
        ],
      },
    },
  },

  // ─── Two banks that stated nothing but a rate and a limit ────────────────────
  //
  // The other five each derive the ceiling from something of their own, which is the hard
  // case and the reason the frame exists. These two are the ORDINARY case: a bank signs up
  // to a product the platform already sells, takes the catalog's figures, and is configured
  // in a rate and a tenor. No `stepParams` at all — the link IS the configuration, and it
  // keeps them in step when the catalog's defaults move.
  {
    bankNameEnglish: 'National Bank of Egypt',
    programCode: 'NBE-COMPOUND-GUARANTEE',
    friendlyName: 'Compound Unit Guarantee',
    friendlyNameAr: 'ضمان وحدة بكمبوند',
    catalogKey: 'compound_owner',
    productCategory: 'personal',
    ratePercent: '27.5000',
    minAmountEGP: '100000.00',
    maxAmountEGP: '3000000.00',
    tenor: { minMonths: 12, maxMonths: 84 },
    age: { min: 21, max: 60 },
    dbrCapPercent: '50.0000',
    operatorNotes: 'Takes the catalog ceilings by unit type. No bank-specific conditions.',
    amounts: 'catalog',
  },
  {
    bankNameEnglish: 'CIB',
    programCode: 'CIB-CAR-OWNER',
    friendlyName: 'Car Ownership Loan',
    friendlyNameAr: 'تمويل بضمان السيارة',
    catalogKey: 'car_owner',
    productCategory: 'car',
    ratePercent: '28.5000',
    minAmountEGP: '15000.00',
    maxAmountEGP: '1000000.00',
    tenor: { minMonths: 12, maxMonths: 48 },
    age: { min: 21, max: 60 },
    dbrCapPercent: '50.0000',
    operatorNotes: 'Takes the catalog advance shares by car age. No bank-specific conditions.',
    amounts: 'catalog',
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
  await pruneRetiredDemoProducts();

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

/**
 * The club-membership demo product, deleted.
 *
 * Dropping it from the arrays above stops it being WRITTEN; it does not remove what earlier
 * runs already wrote, and an upsert-only seed leaves a retired product live on every database
 * it ever reached. So the retirement is stated here, by explicit key — never by pattern, which
 * would be one typo away from deleting a product an operator authored.
 *
 * Order is the foreign keys': `application_answer.questionId` is `onDelete: Restrict`,
 * so a demo application that answered a club question blocks the question's delete until its
 * answers go first. Everything else cascades — a question takes its options, its category
 * assignments and its catalog tick-list with it; a program takes its weight sets; the catalog
 * name takes its loan-category rows.
 *
 * What deliberately STAYS: past `bank_offer` rows (they hold a snapshot and reference the
 * program by code, not by FK — Principle I / A6), and archived questionnaire snapshots that
 * still contain the questions as they were asked. Both are history, and history is readable.
 */
const RETIRED_QUESTION_CODES = ['has_club_membership', 'club_class'] as const;
const RETIRED_GROUP_CODES = ['club_membership_details'] as const;
const RETIRED_PROGRAM_CODES = ['ABK-CLUB-MEMBERSHIP', 'CIB-CLUB-MEMBERSHIP'] as const;
const RETIRED_ENUMERATIONS: readonly { type: string; key: string }[] = [
  { type: PROGRAM_NAME_TYPE, key: 'club_member' },
  { type: FACT_TYPE, key: 'club_class' },
  { type: 'club_class', key: 'class_1' },
  { type: 'club_class', key: 'class_2' },
  { type: 'club_class', key: 'class_3' },
];

async function pruneRetiredDemoProducts(): Promise<void> {
  if (DRY) {
    console.log(
      `[seed-collateral] would delete ${RETIRED_PROGRAM_CODES.length} retired programs, ` +
        `${RETIRED_QUESTION_CODES.length} questions and ${RETIRED_ENUMERATIONS.length} registry rows.`,
    );
    return;
  }

  const answers = await prisma.applicationAnswer.deleteMany({
    where: { questionCode: { in: [...RETIRED_QUESTION_CODES] } },
  });
  const questions = await prisma.question.deleteMany({
    where: { code: { in: [...RETIRED_QUESTION_CODES] } },
  });
  const groups = await prisma.questionGroup.deleteMany({
    where: { code: { in: [...RETIRED_GROUP_CODES] } },
  });
  const programs = await prisma.bankProgram.deleteMany({
    where: { programCode: { in: [...RETIRED_PROGRAM_CODES] } },
  });
  const enums = await prisma.platformEnumeration.deleteMany({
    where: { OR: RETIRED_ENUMERATIONS.map((row) => ({ type: row.type, key: row.key })) },
  });

  const total =
    answers.count + questions.count + groups.count + programs.count + enums.count;
  if (total > 0) {
    console.log(
      `[seed-collateral] retired the club product: ${programs.count} programs, ` +
        `${questions.count} questions (${answers.count} stored answers), ${groups.count} groups, ` +
        `${enums.count} registry rows.`,
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
    // `figuresRequired: false` — same as the catalog endpoint. A catalog rule is allowed to
    // leave a derivation unstated, because a bank may be the one to state it.
    const violation = await validateIncomeRule(product.rule, ctx, { figuresRequired: false });
    if (violation) {
      console.warn(
        `[seed-collateral] ! rule for '${product.key}' rejected: ${JSON.stringify(violation)} — skipped.`,
      );
      continue;
    }

    // And then AGAIN at a bank's standard, because that is the one that actually bites.
    //
    // A program on `amounts: 'catalog'` is validated by its own save with `figuresRequired`
    // defaulting to TRUE, against the merged rule — so a catalog default set that is legal
    // here but incomplete there produces a name whose inheriting banks cannot be saved at
    // all, and nothing in the catalog write would have said so. Checking both standards is
    // the difference between "this rule is well-formed" and "a bank can actually take it".
    const asInherited = await validateIncomeRule(product.rule, ctx);
    if (asInherited) {
      console.warn(
        `[seed-collateral] ! rule for '${product.key}' is valid as a catalog rule but a bank` +
          ` inheriting it could not be saved: ${JSON.stringify(asInherited)} — skipped.`,
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
      ...(figures.dbrCapPercentByEmploymentType !== undefined
        ? { dbrCapPercentByEmploymentType: figures.dbrCapPercentByEmploymentType }
        : {}),
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
      requiresCollateral: figures.catalogKey === 'car_owner',
      // The club-membership demo product was deleted; the FLAG stays on the model because a
      // real program may still require one. Nothing seeded here does.
      requiresClubMembership: false,
      requiresExistingLoan: false,
      requiresFRMUVerification: false,
      requiresQualitativeReview: false,
      requiresNoDocuments: false,
    } as unknown as Prisma.InputJsonValue,
    incomeAssumption: {
      strategy: PRODUCT_RULE_STRATEGY,
      // Default `'own'`: the four compound banks disagree about every figure, so each
      // states its own. A bank marked `'catalog'` carries no figures at all — the link is
      // the configuration, and storing a copy of the defaults beside it would make the
      // link a one-time snapshot wearing a link's label.
      amounts: figures.amounts ?? 'own',
      ...(figures.amounts === 'catalog' ? {} : { stepParams: figures.stepParams ?? {} }),
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
