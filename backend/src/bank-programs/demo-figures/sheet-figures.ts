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
 * The unit type's option code is the registry key `twin_house` — the question is minted
 * mirrored to the `property_type` list. A `factChoiceTable` matches the code of the answer the
 * applicant PICKED, so the question's own option codes are the authority and the validator
 * refuses anything else. (`twin_or_town_house`, the label slug an early hand-made question
 * carried, was dropped on 2026-09-23 — a database built from the seeds never has it.)
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
  /**
   * The loan duration every bank program under this product falls back to.
   *
   * Declared only where the sheets agree on one. It is INHERITED, not copied, so a product
   * stating months its banks do not all lend over would be re-pricing their book — and a
   * bank that genuinely differs states its own and is untouched.
   *
   * Written INDEPENDENTLY of the figures plan below: the figures are skipped on a product
   * that already holds some (an operator may have typed them), but a duration nobody has
   * ever stated is not an operator's work to protect. It is still idempotent — it writes
   * only when the stored pair differs.
   */
  tenorDefaults?: { minMonths: number; maxMonths: number };
  /**
   * The PLAN tables every bank program selling this product falls back to — the rate, the
   * longest term, the financed share and the floor, each keyed by the share the applicant
   * puts down.
   *
   * INHERITED like `tenorDefaults` above, but only by a program that has SAID SO
   * (`plansSource: 'product'`). A blank grid on a program already means "this bank does not
   * price by that", so inheriting by absence would hand every program under this product a
   * table it never chose.
   *
   * Written independently of the figures plan below, and idempotent: it writes only when the
   * stored blob differs.
   */
  planDefaults?: Record<string, unknown>;
  /**
   * The I-SCORE TIER TABLE every bank program under this product falls back to.
   *
   * Written INDEPENDENTLY of the figures plan below and on exactly the terms the duration
   * and the plans are: the figures are skipped on a product that already holds some, because
   * an operator may have typed them, but tiers nobody has ever stated are not somebody's
   * work to protect. Idempotent — it writes only when the stored table differs.
   *
   * Its own field rather than a `stepParams` slot, because that is where the tiers stopped
   * living at v30.3.0: they are a column now, so a seed that still wrote the slot would
   * plant a figure keyed by a step id nothing emits.
   */
  iScoreDefaults?: Record<string, unknown>;
  /**
   * The LOAN SIZE every bank program under this product falls back to when it states none.
   *
   * Written independently of the figures plan below and on exactly the terms the duration,
   * the plans and the tiers are: a size nobody has ever stated is not somebody's work to
   * protect. Idempotent — it writes only when the stored pair differs.
   */
  loanAmountDefaults?: { minAmountEGP: string; maxAmountEGP: string };
  /**
   * Rooted at `incomeRule.`, exactly as the catalog write expects them. (An I-Score tier path
   * would be rooted at `iScoreDefaults.`, the column it is about — none is seeded since
   * v30.4.0: the shared I-Score classes replace the per-product table.)
   */
  estimated?: EstimatedPaths;
}

export interface ProgramNameSpec {
  key: string;
  labelEn: string;
  labelAr: string;
  /** The product this name takes its calculation from. */
  productKey: string;
  categories: LoanCategory[];
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

/**
 * The I-Score tiers, and the reason they are the same three rows on every product.
 *
 * Spec §10.10 in terms: "the design record's 80% / 100% / 110% is an illustration, not a bank's
 * table. The prototypes all carry a single 100% Standard row, i.e. no bank has supplied one yet."
 * So there is nothing per-product to transcribe — one illustration, stated once, marked an
 * estimate everywhere it lands, replaced per product or per bank the day a sheet arrives.
 *
 * COVERAGE IS TOTAL and the validator now demands it (`validateBands`' `coverAll`): the lowest
 * tier opens at 0 and the top one is open-ended, because the tiers multiply a figure the rule has
 * already produced — a score the table misses is `no_matching_band`, which kills the quote rather
 * than shrinking it.
 */
// NO PRODUCT STATES AN I-SCORE TABLE since v30.4.0. The illustration this seed used to write on
// nine products (0/550/700 → 80/100/110, then the six classes at 80/80/100/100/110/110) is
// gone: the I-Score classes on Manage values ARE the shared table every program reads when
// neither it nor its product states one (`iscore_shared_table`). A product or a bank that
// scores differently types its own on its screen.

/** The number a savings sheet divides by — see `sheet-programs.ts#divisor`. */
const divisor = (value: string) => ({ scalar: { value, unit: 'multiplier' as const } });

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
/** A half-open deposit band, as a grid key. `null` on the upper edge means "and above". */
export function dpBand(
  from: string,
  to: string | null,
): { fromInclusive: string; toExclusive: string | null } {
  return { fromInclusive: from, toExclusive: to };
}

/**
 * Suez Canal Bank's auto card, as the plan tables the one merged programme reads.
 *
 * The DEPOSIT is the axis every one of them keys on, which is what makes them one card
 * rather than four unrelated tables: a row says "put this much down and here is the rate, the
 * term, the share we finance, the floor, and whether you must insure it".
 *
 * EVERY RATE HERE IS AN ILLUSTRATION. No Suez Canal slide publishes a profit rate — the
 * programme's own `baseRatePercent` has been a stated placeholder since the sheet was loaded
 * — so all twenty rate cells are marked `team_estimated`, and so are the three term ceilings,
 * because §4.2 prints 6–84 months for every tier and shortening two of them is this team's
 * illustration too. The shares, the floor and the band edges are the sheet's own and are NOT
 * marked: claiming a published figure is a guess is the same defect as the reverse. The list
 * lives in this product's `estimated` below, generated from these tables rather than typed.
 *
 * ─── The rate grid's three axes, and the order they resolve in ────────────────
 *
 * Deposit, then where the car was built, then what it runs on. A cell naming the ORIGIN
 * outranks one naming the FUEL (`specificity` weights axis 0 highest and counts down), so a
 * Chinese electric car is priced by the Chinese row. That is a stated order, not an accident,
 * and it is the conservative one: the origin premium is the larger adjustment.
 *
 * The bare `[band, null, null]` row is what prices everybody the two named rows do not reach
 * — including an applicant who skipped the optional origin or fuel question. Without it those
 * applicants would fall to `onNoMatch` and be refused for not answering something optional.
 */
const SCB_AUTO_PLANS: Record<string, unknown> = {
  rateByFact: {
    axes: [
      { factKey: 'car_down_payment_percent' },
      { factKey: 'car_origin' },
      { factKey: 'car_fuel_type' },
    ],
    cells: [
      [dpBand('20', '30'), '10', '12', '9'],
      [dpBand('30', '40'), '9', '11', '8'],
      [dpBand('40', '50'), '8', '10', '7'],
      [dpBand('50', '60'), '7', '9', '6'],
      [dpBand('60', null), '6', '8', '5'],
    ].flatMap(([band, base, china, green]) => [
      { keys: [band, null, null], value: base },
      { keys: [band, { key: 'china' }, null], value: china },
      { keys: [band, null, { key: 'electric' }], value: green },
      { keys: [band, null, { key: 'hybrid' }], value: green },
    ]),
    // A deposit below the lowest tier is a loan this bank does not write, and a rate is the
    // one figure there is no safe fallback for.
    onNoMatch: 'reject',
  },

  /**
   * The share financed, and the ONE place the 20% tier's home-ownership rule now lives.
   *
   * It was a programme-wide gate (`cond__homeowned`) on the tier that carried it. Merged into
   * one programme that gate would refuse a renter putting 60% down, whom this bank accepts —
   * so the rule moves onto the axis it was always about: the 20–30% band states rows for an
   * owner and for a relative's home and NONE for a renter, and `reject` therefore binds in
   * that band alone. Every other band names no owner at all and prices everybody.
   */
  ltvCeilingByFact: {
    axes: [{ factKey: 'car_down_payment_percent' }, { factKey: 'home_ownership' }],
    cells: [
      { keys: [dpBand('20', '30'), { key: 'owned_by_me' }], value: '80' },
      { keys: [dpBand('20', '30'), { key: 'owned_by_relative' }], value: '80' },
      { keys: [dpBand('30', '40'), null], value: '70' },
      { keys: [dpBand('40', '50'), null], value: '60' },
      { keys: [dpBand('50', '60'), null], value: '50' },
      { keys: [dpBand('60', null), null], value: '40' },
    ],
    onNoMatch: 'reject',
  },

  /** App. §4.2 — 6–84 months across the card; the shortest tier is held to less. */
  maxMonthsByFact: {
    axes: [{ factKey: 'car_down_payment_percent' }],
    cells: [
      { keys: [dpBand('20', '30')], value: '60' },
      { keys: [dpBand('30', '40')], value: '72' },
      { keys: [dpBand('40', null)], value: '84' },
    ],
    // A term CEILING has a safe fallback and a rate does not: the programme's own 6–84 still
    // applies, which is what every programme without a table does.
    onNoMatch: 'useFallback',
  },

  /**
   * App. §4.2 — the 20% tier alone starts at a million; the rest start at 100,000.
   *
   * Stated only where it DIFFERS. The floor composes by `max` against the programme's own, so
   * a band that says nothing leaves the 100,000 standing — four identical rows would be four
   * places to change one number.
   */
  minAmountByFact: {
    axes: [{ factKey: 'car_down_payment_percent' }],
    cells: [{ keys: [dpBand('20', '30')], value: '1000000' }],
    onNoMatch: 'useFallback',
  },

  /**
   * COMPREHENSIVE COVER, and the deposit is what decides whether the bank demands it.
   *
   * App. §4.2 and the master review's own summary of this card: *"Insurance mandatory per DP
   * tier — SCB: N/A at 60/50/40, YES at 30/20"*. So the two lowest deposits carry a row and
   * the three above carry none — and an ABSENT row is the statement, not an oversight: the
   * reader treats a miss as "this bank requires no cover at that deposit", which is the whole
   * mechanism. Nothing in code knows that this bank's edge is 40%.
   *
   * This closes half of the loss the v30.0.0 merge had to state. The other half stands: the
   * car-insurance POLICY is still in `requiredDocuments`, which is one array per programme and
   * is therefore still demanded of everyone. A document list cannot be band-scoped; a cost
   * table can.
   *
   * THE PERCENTAGE IS THE TEAM'S AND IS MARKED. No slide on this card publishes a premium —
   * the sheets say only that cover is mandatory on those two tiers — so 1% is an illustration
   * and both cells are in `estimated` below, exactly as all twenty rate cells are. The band
   * EDGES are the sheet's own and are not marked.
   */
  carInsuranceRateByFact: {
    axes: [{ factKey: 'car_down_payment_percent' }],
    cells: [
      { keys: [dpBand('20', '30')], value: '1' },
      { keys: [dpBand('30', '40')], value: '1' },
    ],
    // Stated because the shape demands one, and never read: `car-insurance.ts` treats every
    // miss as "no cover required". `useFallback` is the honest spelling of that — a `reject`
    // here would mean a table of COSTS refusing an applicant the rate and share tables have
    // already priced.
    onNoMatch: 'useFallback',
  },

  // `minMonthsByFact` is deliberately ABSENT. Every tier on this card starts at 6 months,
  // which is already the product's own `tenorDefaults.minMonths` — a table stating 6 five
  // times would add no information and would shadow the product's floor if it ever moved.
  // The field exists for a bank whose card really does differ.
};

export const CATALOG_FIGURES: readonly CatalogFigureSet[] = [
  {
    productKey: 'armed_forces_grades',
    sheet: 'App. A §11 — Egyptian Armed Forces',
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
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
    estimated: [],
  },

  {
    productKey: 'academic_rank_table',
    sheet: 'App. C PROFESSOR (both columns) · App. A §10 (section head)',
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
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
    // The clinic-owner product, because that is the shape this sheet has: one income table
    // banded by years and keyed by a governorate tier. The in-practice product states no
    // second column, so these figures could not be filed under it without inventing one.
    //
    // No catalog default for `doctors_in_practice`, deliberately: no sheet in the source
    // material publishes a plain years table, so a default there would be a figure nobody
    // said. Each bank states its own, which its card says.
    productKey: 'doctors_clinic_owner',
    sheet: 'App. C DOCTOR — years × governorate tier',
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
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
    estimated: [],
  },

  {
    // The in-practice doctors product states no years table on purpose — no sheet in the
    // source material publishes a plain one, so a default here would be a figure nobody said
    // and each bank types its own (its product card says so). It reaches this list anyway for
    // the I-Score tiers, which are the platform's illustration rather than any bank's figure,
    // and which every rule-bearing product states identically.
    productKey: 'doctors_in_practice',
    sheet: "spec §10.10 — I-Score tiers only; the years table is each bank's own",
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
    stepParams: {},
    estimated: [],
  },

  {
    productKey: 'card_limit_share',
    sheet: 'App. A §6 — net monthly income is half the competitor card limit',
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
    stepParams: {
      primary: percent('50'),
    },
    estimated: [],
  },

  {
    productKey: 'auto_loan_crosssell',
    sheet: 'App. A §4 — three times the instalment or 10% of the loan, whichever is less',
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
    stepParams: {
      primary: times('3'),
      alt: percent('10'),
    },
    estimated: [],
  },

  {
    productKey: 'pledged_collateral_share',
    sheet: 'App. A §3 — 30% of the free amount of the collateral',
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
    stepParams: {
      primary: percent('30'),
    },
    estimated: [],
  },

  {
    productKey: 'compound_owner',
    sheet:
      'spec §7 (class table) · App. B FABMISR (down-payment brackets) · App. A §2 + CAE (share of paid)',
    // Every compound sheet in the source material states a 50% debt burden, and a ceiling has
    // to be told which one it was worked out at or the engine cannot turn it back into a
    // monthly figure.
    baselineDbrPercent: '50',
    // NO `iScoreDefaults`, and this is the one product that is deliberately without.
    //
    // It carried an `iscore_band` slot here until v30.3.0 and that slot was INERT: this
    // product holds no calculation on a seeded database — it is cap-only, and its
    // programmes read a ceiling out of `loanLimits.maxLoanByFact` — so there was no
    // `iscore_applied` step for the figure to reach, and it was an orphan nothing
    // multiplied. Moving it to the column would turn that dead figure LIVE: the
    // defaults-only resolution carries `iScoreDefaults` to every programme under the
    // name, and CAE-PER-COMPOUND_OWNER would start scaling its applicant's declared
    // salary by 80% or 110% against an illustration no bank supplied. Measured on the
    // real database: a dry seed run reported `iscore compound_owner would state 3
    // tier(s)`, and it is the only line this change added to that run.
    //
    // And so NO `I_SCORE_ESTIMATED` markers either. They were left in on the belief that a
    // marker with no figure behind it is pruned; a figures write that STATES markers refuses
    // one naming a table the product does not hold (`VALUE_SOURCE_PATH_UNKNOWN`), which is
    // what every database built from the seeds did with this product until 2026-09-23.
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
      // The bracket way's second column is X-SELL — the client holds another product — which
      // is what the FABMISR sheet prints, and spec §10.3 is explicit that this is a DIFFERENT
      // question from new-loan/top-up. It was filed under `alt__top_up` until 2026-09-09, so
      // these four figures were read as a top-up row.
      alt__other_product_held: bands(DOWN_PAYMENT_EDGES, [
        '1250000',
        '1500000',
        '1750000',
        '2000000',
      ]),
      alt__unit_paid_to_date: percent('15'),
      // `alt__unit_paid_to_date__top_up` was here at 15% — byte-identical to the standard
      // column above it, so the column stated nothing. That way now carries no column at all,
      // which is the honest shape: a slot every bank is expected to fill, holding the figure
      // beside it, reads as a policy nobody actually has.
      // A share of the down payment alone is the fifth way, and NO sheet in the source
      // material states a percentage for it — App. A §2 and App. B CAE both take their
      // share of everything paid. Left blank on purpose: a blank way means "this bank does
      // not lend this way", and a guessed percentage here would be inherited by every bank
      // put on `amounts: 'catalog'` as though a sheet had published it.
      alt__owned_unit_type: {
        keyTable: [
          money('apartment', '2000000'),
          money('twin_house', '3000000'),
          money('villa', '4000000'),
        ],
      },
      alt__owned_unit_type__top_up: {
        keyTable: [
          money('apartment', '3000000'),
          money('twin_house', '3500000'),
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
      'incomeRule.stepParams.alt__owned_unit_type__top_up.keyTable.apartment.incomeEGP',
      'incomeRule.stepParams.alt__owned_unit_type__top_up.keyTable.twin_house.incomeEGP',
      'incomeRule.stepParams.alt__owned_unit_type__top_up.keyTable.villa.incomeEGP',
    ],
  },

  {
    productKey: 'down_payment_income',
    sheet:
      'App. §4.3 — the down payment read as 36 months of saving at 10% of income; ' +
      'App. §5.2 — savings ÷ 36 ÷ 10% for an instalment buyer, ÷ 60 ÷ 20% for a cash buyer',
    // Six of Suez Canal Bank's seven auto programmes lend over 6–84 months — all five
    // down-payment tiers and Micro Mobility — so the months are a property of the product
    // rather than something six operators happened to type the same way. Those six state
    // nothing of their own and read this; `SCB-CAR-GREEN_POWER` lends to 120 and states its
    // own, which is the case the whole mechanism exists to get right.
    tenorDefaults: { minMonths: 6, maxMonths: 84 },
    // The loan size the programmes selling this product fall back to — the operator's figures
    // (2026-09-23), so a seeded database quotes the same range the admin screens were set to.
    loanAmountDefaults: { minAmountEGP: '300000', maxAmountEGP: '2500000' },
    planDefaults: SCB_AUTO_PLANS,
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
    stepParams: {
      // The catalog default IS the published formula: `income = down payment ÷ 3.6`. One
      // bank sells it today and states the same figure on its own programmes, exactly as the
      // auto cross-sell does — a bank that inherits gets the sheet's arithmetic, not a guess.
      primary: divisor('3.6'),
      // The savings way, both columns. A default for EVERY way is the compound precedent: a
      // program on catalog amounts is pruned to the one way it picked before it quotes.
      // The instalment column's default is 6 on the operator's instruction (2026-09-20) — the
      // sheet's own arithmetic there is ÷ 3.6, so a bank that wants the sheet's figure states it.
      // The cash column is 10, the operator's figure (2026-09-23), not the sheet's ÷ 12.
      alt: divisor('6'),
      alt__cash_buyer: divisor('10'),
    },
    // THE PLAN FIGURES THIS TEAM INVENTED, marked as such — and only those.
    //
    // Twenty rates because no Suez Canal slide publishes a profit rate at all, and three term
    // ceilings because App. §4.2 prints 6–84 months for EVERY tier: shortening the shortest
    // deposits to 60 and 72 is this team's illustration, not the bank's policy.
    //
    // Deliberately NOT marked: the five financed shares (§4.2 prints 60% down → 40% financed
    // and its four siblings), the 1,000,000 floor on the 20% tier (§4.2 again), and every band
    // EDGE — all published, and marking a stated figure as a guess is the same defect as the
    // reverse. The edges ARE markable paths (`fromInclusive` / `toExclusive` are numeric
    // leaves), which is why they are excluded by being listed out rather than by a wildcard.
    //
    // Addressed by cell INDEX, because a grid cell has no key to be addressed by. Inserting a
    // cell shifts what each of these describes, so the list is generated from the tables above
    // rather than typed by hand.
    estimated: [
      'planDefaults.rateByFact.cells.0.value',
      'planDefaults.rateByFact.cells.1.value',
      'planDefaults.rateByFact.cells.2.value',
      'planDefaults.rateByFact.cells.3.value',
      'planDefaults.rateByFact.cells.4.value',
      'planDefaults.rateByFact.cells.5.value',
      'planDefaults.rateByFact.cells.6.value',
      'planDefaults.rateByFact.cells.7.value',
      'planDefaults.rateByFact.cells.8.value',
      'planDefaults.rateByFact.cells.9.value',
      'planDefaults.rateByFact.cells.10.value',
      'planDefaults.rateByFact.cells.11.value',
      'planDefaults.rateByFact.cells.12.value',
      'planDefaults.rateByFact.cells.13.value',
      'planDefaults.rateByFact.cells.14.value',
      'planDefaults.rateByFact.cells.15.value',
      'planDefaults.rateByFact.cells.16.value',
      'planDefaults.rateByFact.cells.17.value',
      'planDefaults.rateByFact.cells.18.value',
      'planDefaults.rateByFact.cells.19.value',
      'planDefaults.maxMonthsByFact.cells.0.value',
      'planDefaults.maxMonthsByFact.cells.1.value',
      'planDefaults.maxMonthsByFact.cells.2.value',
      // NOT the cover percentage: the sheets never state what cover costs, but the operator
      // typed both figures on the product screen (2026-09-23), which clears the estimate mark,
      // and the seed states what the database holds.
    ],
  },

  {
    productKey: 'school_stage_ceiling',
    sheet: 'App. B — CAE Teachers, Predefined Limit (codes 0760-22 / 0760-23)',
    // The sheet waives the income check and prints no percentage; a ceiling still needs one.
    baselineDbrPercent: '50',
    // The illustrative tiers, the same three rows on every product (§10.10), every
    // figure marked an estimate. A COLUMN since v30.3.0, not a rule slot.
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
 * One catalog name per product that has a calculation.
 *
 * The RULE is that a name is offered only under a loan type whose applicants are already
 * asked every question its product reads — a name offered anywhere else is a program that
 * quotes nothing. The two Suez Canal `car` names that sold `down_payment_income` were removed
 * with their programmes (migration `remove_down_payment_income_programs`); the product is sold
 * again through `car_buyers_program`, the name the operator created in its place.
 *
 * `compound_owner_4` is here because no other seed creates it: without it the four compound
 * programmes had no name to be filed under on a database built from the seeds, and the
 * product read "No catalog name sells this yet". On a database that already has it, it is
 * reused and left as it is.
 *
 * Cap-only products (`club_branch_cap`, …) have no name here and cannot have one: they work
 * out no income, so the catalog refuses the link (`SURROGATE_PRODUCT_CAP_ONLY`). A bank sells
 * one by capping its own programme by the answer — `FAB-PER-CLUB_MEMBERSHIP` does.
 */
export const PROGRAM_NAMES: readonly ProgramNameSpec[] = [
  {
    key: 'armed_forces_no_payslip',
    labelEn: 'Armed Forces',
    labelAr: 'القوات المسلحة',
    productKey: 'armed_forces_grades',
    categories: [LoanCategory.personal],
  },
  {
    key: 'university_professors',
    labelEn: 'University Professors',
    labelAr: 'أساتذة الجامعات',
    productKey: 'academic_rank_table',
    categories: [LoanCategory.personal],
  },
  {
    key: 'doctors_clinic_owner',
    labelEn: 'Doctors — Clinic Owners',
    labelAr: 'الأطباء — أصحاب العيادات',
    productKey: 'doctors_clinic_owner',
    categories: [LoanCategory.personal],
  },
  {
    // TWO doctor names, one per product, and the applicant picking between them is what tells
    // the two ABK programmes apart — the job an ownership question and two gate conditions
    // used to do inside one product. The name a doctor picks narrows the programmes their
    // application is matched against, so the two labels have to read unmistakably in both
    // locales; nothing else enforces the choice.
    //
    // The KEY is reused rather than minted: it is immutable, `ABK-PER-DOCTORS_PRACTICE`
    // already files under it, and a fresh key would strand that programme mid-deploy.
    key: 'doctors_in_practice',
    labelEn: 'Doctors — In Practice',
    labelAr: 'الأطباء — الممارسة',
    productKey: 'doctors_in_practice',
    categories: [LoanCategory.personal],
  },
  {
    key: 'pl_to_card',
    labelEn: 'Personal Loan against a Credit Card',
    labelAr: 'تمويل شخصي مقابل بطاقة ائتمان',
    productKey: 'card_limit_share',
    categories: [LoanCategory.personal],
  },
  {
    key: 'pl_to_auto_loan',
    labelEn: 'Personal Loan against a Car Loan',
    labelAr: 'تمويل شخصي مقابل قرض سيارة',
    productKey: 'auto_loan_crosssell',
    categories: [LoanCategory.personal],
  },
  {
    key: 'cds_holder',
    labelEn: 'Certificate & Deposit Holders',
    labelAr: 'حاملو الشهادات والودائع',
    productKey: 'pledged_collateral_share',
    categories: [LoanCategory.personal],
  },
  {
    key: 'teachers_predefined',
    labelEn: 'Teachers — Predefined Limit',
    labelAr: 'المعلمون — حد محدد مسبقًا',
    productKey: 'school_stage_ceiling',
    categories: [LoanCategory.personal],
  },
  {
    key: 'compound_owner_4',
    labelEn: 'Compound Owner',
    labelAr: 'مالك وحدة في كومباوند',
    productKey: 'compound_owner',
    categories: [LoanCategory.personal],
  },
  {
    // The operator's own name and labels (2026-09-23), kept verbatim — the key is what the
    // four programmes in `car-buyers-programs.ts` are filed under.
    key: 'car_buyers_program',
    labelEn: 'Car Buyers Program',
    labelAr: 'شراء سيارة',
    productKey: 'down_payment_income',
    categories: [LoanCategory.car],
  },
];

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
