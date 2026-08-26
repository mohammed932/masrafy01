/**
 * Seed — the COLLATERAL product: a loan against a car the applicant already owns.
 *
 * This is a product whose ceiling is derived from a thing the applicant OWNS rather than from
 * an income. Nothing in this file is code the engine branches on: it is two bank programs, one
 * catalog rule and three facts — data, in the shapes `matching/pipeline/product-rule.ts`
 * evaluates (Principle II / A1).
 *
 * Run:  npm run seed:collateral        (add --dry to print the plan and write nothing)
 *
 * ─── The compound-ownership demo used to live here, and is deliberately gone ──
 *
 * It was the platform's worked example of a no-payslip product, and it was also the reason
 * making one was a release: its nine compound names, its three classes, its ten questions and
 * its ten facts were seed arrays, so "add a product like that" meant editing this file. Since
 * `20260827090000_surrogate_product_authoring` a product AUTHORS all three from its own screen
 * — the list, the question that asks it, and the fact that joins them — so the demo's only
 * remaining job was to teach the old way. `pruneRetiredDemoProducts()` below deletes what it
 * left behind; rebuilding it through the product screen is the feature's acceptance test.
 *
 * The car product stays because a worked example still earns its place: it exercises a step
 * pipeline, a `factChoiceTable` keyed off a question's own options, and the catalog-defaults
 * inheritance — without needing a registry list to exist first.
 *
 * ─── What it writes, in this order, because each step needs the one before ────
 *
 *   1. QUESTIONNAIRE — delegates to `seedQuestionnaire()`, which owns the ONE global pool
 *      and publishes a snapshot. The pack is authored there, not here: a second publisher is
 *      how two snapshots come to disagree about what was asked.
 *   2. FACTS — a `surrogate_fact` row per pack question, bound to it. This is what carries
 *      an answer into `ApplicantProfile.surrogateFacts` with no mapping code on either
 *      client. The binding lives on the FACT, never on the question (A33).
 *   3. CATALOG NAME + RULE — the product's step pipeline, stated ONCE. Validated through the
 *      same `validateIncomeRule` the admin save runs, so this seed cannot plant a rule no
 *      operator could have saved.
 *   4. BANK PROGRAMS — rows whose ONLY product-rule content is `stepParams`: figures. Adding
 *      another bank is another entry in `BANK_FIGURES` and nothing else. One of the two
 *      states no figures at all and quotes off the catalog's defaults (`amounts: 'catalog'`),
 *      which is what proves the inheritance actually merges.
 *
 * No lookup step: the car pack needs none, because its age buckets are a closed list authored
 * on the question itself. A product that DOES need a list gets it from the product screen now.
 *
 * ─── One ordering wrinkle, and why it is not a bug ────────────────────────────
 *
 * `seedQuestionnaire()` also builds each program's scoring weight set, from the catalog's
 * question template — and on a FIRST run the new name has no template yet, because a template
 * references question IDs that step 1 has only just created. So the first pass ends with the
 * programs carrying no ACTIVE weight set, which means a 0% score.
 *
 * The seed says so and names the fix (`npm run seed:weights`), and a second run of this file
 * converges just as well. The alternative — writing the template before the questions exist —
 * is not orderable, and inlining a third copy of the weight-set builder here would be a
 * second author for a set the questionnaire seed owns.
 *
 * ─── Accepted gaps, stated rather than faked ──────────────────────────────────
 *
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
import { incomeRuleValidationContext } from './data/income-rule-validation-context';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

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
  'owned_car_value',
  'owned_car_age',
  'employment_status',
];

const FACT_LABELS: Readonly<Record<string, { en: string; ar: string }>> = {
  owned_car_value: { en: 'Car value', ar: 'قيمة السيارة' },
  owned_car_age: { en: 'Car age', ar: 'عمر السيارة' },
  employment_status: { en: 'Employment status', ar: 'حالة العمل' },
};

// ---------------------------------------------------------------------------
// 4. The two catalog rules
// ---------------------------------------------------------------------------


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
 * The two car banks: one stating its own advance table, one quoting off the catalog's defaults.
 *
 * Every number here is from §7 of the source design. What is NOT here is any statement about
 * HOW the ceiling is derived — that is the catalog's frame; a bank only says which of its
 * derivations it fills in, by filling one in.
 */
export const BANK_FIGURES: readonly BankFigures[] = [
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
const SURROGATE_PRODUCT_TYPE = 'surrogate_product';

/** Every write is "the listed set IS the set", so a re-run converges. */
async function main(): Promise<void> {
  const actorId = await resolveSeedActor();
  if (!actorId) {
    console.error('[seed-collateral] no active super_admin found — run `npx prisma db seed` first.');
    return;
  }

  // The questionnaire owns the pool and the publish. A second publisher is how two
  // snapshots come to disagree about what was asked.
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
    `[seed-collateral] ${factsWritten} facts, ` +
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
 * The two retired demo products — club membership, and compound ownership — deleted.
 *
 * Dropping them from the arrays above stops them being WRITTEN; it does not remove what
 * earlier runs already wrote, and an upsert-only seed leaves a retired product live on every
 * database it ever reached. So the retirement is stated here, by explicit key — never by
 * pattern, which would be one typo away from deleting a product an operator authored.
 *
 * Order is the foreign keys': `application_answer.questionId` is `onDelete: Restrict`, so a
 * demo application that answered one of these questions blocks the question's delete until its
 * answers go first. Everything else cascades — a question takes its options, its category
 * assignments and its catalog tick-list (`platform_enumeration_question` cascades from BOTH
 * sides) with it; a program takes its weight sets; the catalog name takes its loan-category
 * rows.
 *
 * The compound product adds one shape the club product did not have: it is a LINKED pair, a
 * `program_name` whose calculation lives on a `surrogate_product` row (v18.4.0). Both are
 * listed, and the order between them does not matter — `surrogateProductKey` carries no FK,
 * for the reasons `schema.prisma` states — but leaving either behind is worse than leaving
 * neither: an orphan name quotes nothing, and an orphan product is offered in a picker as a
 * calculation nobody sells.
 *
 * The two `enumeration_type_def` rows (`compound`, `compound_category`) are NOT here. That
 * table has no seed-side writer at all, so its rows are retired by the migration that owns it
 * (`20260827090000_surrogate_product_authoring`), which also refuses to run if anybody added
 * values of those kinds beyond the demo's own.
 *
 * What deliberately STAYS: past `bank_offer` rows (they hold a snapshot and reference the
 * program by code, not by FK — Principle I / A6), and archived questionnaire snapshots that
 * still contain the questions as they were asked. Both are history, and history is readable.
 *
 * On the compound pack's question list: `owns_compound_unit` is the GATE the rest were
 * `enabledWhen`-branched on, and `self_employed_licence` / `business_years` are not named
 * "compound" yet belong to it just as squarely — both were branched on that same gate and both
 * were read only by the compound rule's own gates.
 */
const RETIRED_COMPOUND_QUESTION_CODES = [
  'owns_compound_unit',
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
] as const;

/** The nine compound names and the three classes they were filed under. */
const RETIRED_COMPOUND_VALUES: readonly { type: string; key: string }[] = [
  { type: 'compound', key: 'mivida' },
  { type: 'compound', key: 'new_giza' },
  { type: 'compound', key: 'sodic_east' },
  { type: 'compound', key: 'mountain_view_icity' },
  { type: 'compound', key: 'palm_hills' },
  { type: 'compound', key: 'madinaty' },
  { type: 'compound', key: 'al_rehab' },
  { type: 'compound', key: 'dreamland' },
  { type: 'compound', key: 'other' },
  { type: 'compound_category', key: 'compound_class_a' },
  { type: 'compound_category', key: 'compound_class_b' },
  { type: 'compound_category', key: 'compound_class_c' },
];

const RETIRED_QUESTION_CODES = [
  'has_club_membership',
  'club_class',
  ...RETIRED_COMPOUND_QUESTION_CODES,
] as const;
const RETIRED_GROUP_CODES = ['club_membership_details', 'compound_unit_details'] as const;
const RETIRED_PROGRAM_CODES = [
  'ABK-CLUB-MEMBERSHIP',
  'CIB-CLUB-MEMBERSHIP',
  'ABK-COMPOUND-GUARANTEE',
  'EGB-COMPOUND-GUARANTEE',
  'FAB-COMPOUND-GUARANTEE',
  'CAE-COMPOUND-GUARANTEE',
  'NBE-COMPOUND-GUARANTEE',
] as const;
const RETIRED_ENUMERATIONS: readonly { type: string; key: string }[] = [
  { type: PROGRAM_NAME_TYPE, key: 'club_member' },
  { type: FACT_TYPE, key: 'club_class' },
  { type: 'club_class', key: 'class_1' },
  { type: 'club_class', key: 'class_2' },
  { type: 'club_class', key: 'class_3' },
  // The linked pair. Both halves, for the reason stated above.
  { type: PROGRAM_NAME_TYPE, key: 'compound_owner' },
  { type: SURROGATE_PRODUCT_TYPE, key: 'compound_owner' },
  // One fact per pack question. `employment_status` is NOT here — it is the pool's own
  // question and the car product reads the fact keyed off it.
  ...RETIRED_COMPOUND_QUESTION_CODES.filter((code) => code !== 'owns_compound_unit').map(
    (key) => ({ type: FACT_TYPE, key }),
  ),
  ...RETIRED_COMPOUND_VALUES,
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
      `[seed-collateral] pruned retired demo data: ${programs.count} programs, ` +
        `${questions.count} questions (${answers.count} stored answers), ${groups.count} groups, ` +
        `${enums.count} registry rows.`,
    );
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

    // TWO ROWS, and which one carries the calculation is the whole point.
    //
    // The RULE goes on the `surrogate_product` archetype. The catalog NAME gets a
    // pointer and holds NULL of its own — a name that also kept a copy is not linked,
    // it is forked, and `programNameIncomeRules()` would then have two answers with
    // nothing to say which the engine read. `valueSources` is cleared on the name for
    // the same reason: a marker map addressing a rule the row no longer has is an
    // orphan that `setProgramNameIncomeRule`'s carry-forward would resurrect.
    //
    // Written here AND by migration `20260825090000_surrogate_product_link`, the same
    // deliberate duplication `20260823130000` accepted: the migration is what makes a
    // database that never runs this seed correct, and this seed is what makes a
    // database rebuilt from scratch correct.
    await prisma.platformEnumeration.upsert({
      where: {
        idx_platform_enumeration_type_key: { type: SURROGATE_PRODUCT_TYPE, key: product.key },
      },
      update: {
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        incomeRule: product.rule as unknown as Prisma.InputJsonValue,
        // RE-ACTIVATED on purpose. The same run re-points the catalog name at this product
        // below, and a name linked to an INACTIVE product is a state the admin cannot
        // reach or repair: `resolveSurrogateProductKey` would refuse the very link the
        // seed just wrote, while `programNameIncomeRules()` ignores the flag and goes on
        // quoting. Leaving `active` out meant a re-seed after a deactivate produced
        // exactly that, and reported success.
        active: true,
        deprecatedAt: null,
        updatedBy: actorId,
      },
      create: {
        type: SURROGATE_PRODUCT_TYPE,
        key: product.key,
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        incomeRule: product.rule as unknown as Prisma.InputJsonValue,
        createdBy: actorId,
        updatedBy: actorId,
      },
      select: { id: true },
    });

    const row = await prisma.platformEnumeration.upsert({
      where: { idx_platform_enumeration_type_key: { type: PROGRAM_NAME_TYPE, key: product.key } },
      update: {
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        surrogateProductKey: product.key,
        incomeRule: Prisma.DbNull,
        valueSources: {},
        updatedBy: actorId,
      },
      create: {
        type: PROGRAM_NAME_TYPE,
        key: product.key,
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        surrogateProductKey: product.key,
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
      requiresCollateral: figures.catalogKey === 'car_owner',
      // The club-membership and compound-ownership demo products were deleted; both FLAGS
      // stay on the model because a real program may still require one, and both fire nowhere
      // today (`skipEligibility` is set on every production path). Nothing seeded here does.
      requiresCompoundProperty: false,
      requiresClubMembership: false,
      requiresExistingLoan: false,
      requiresFRMUVerification: false,
      requiresQualitativeReview: false,
      requiresNoDocuments: false,
    } as unknown as Prisma.InputJsonValue,
    incomeAssumption: {
      strategy: PRODUCT_RULE_STRATEGY,
      // Default `'own'`: a bank that disagrees with the catalog about any figure states its
      // own. A bank marked `'catalog'` carries no figures at all — the link is
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
  return incomeRuleValidationContext(prisma);
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
