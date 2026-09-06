/**
 * The catalog's FOUR curated axes — everything the platform states about a
 * program NAME, as opposed to about one bank's leaflet:
 *
 *   1. which loan categories the name may be OFFERED under;
 *   2. which questions it SUGGESTS scoring on, per category (advisory);
 *   3. the income BASIS of each offered pair — payslip or not (intent);
 *   4. the income RULE — HOW the income is worked out when there is no payslip.
 *
 * Axes 1 and 2 are the file's originals; 3 arrived in v16.5.0 and 4 with the move
 * of the rule off `bank_program.incomeAssumption`. The last is the only one that
 * moves money, and it is why five names were ADDED rather than the existing ones
 * annotated: `professional` was carrying a rank table, no table, and a
 * bank-statement percentage at once, which is a name that has stopped naming
 * anything. See `CATALOG_INCOME_RULE` at the foot of this file.
 *
 * Both axes shipped WIDE OPEN and EMPTY respectively:
 *   - `20260807100000_program_name_loan_category_assignment` backfilled every
 *     name to all four categories, deliberately, so narrowing could never hide a
 *     valid pick before an operator chose to narrow it.
 *   - `20260808090000_program_name_question_template` seeded the template empty,
 *     deliberately, so nothing became an unattributed default.
 * "All four, always" and "no suggestion, ever" are both safe, and both wrong as
 * a picture of the product. This file is the operator's first pass over them.
 *
 * DEV DATA, like `bank-program-matrix.ts`: plausible Egyptian-market posture,
 * not contracted policy. A real bank's product owner re-cuts it.
 *
 * ── Axis 1: categories ──────────────────────────────────────────────────────
 * A name is a NAME (Principle II) — never bank logic — so the question is only
 * "can this archetype legitimately be sold as this product?":
 *
 *   WHO-the-borrower-is names (Doctor, Bankers, Pensioners …) travel across
 *   products, bounded by what the segment can actually qualify for. Salaried
 *   segments reach personal + car + mortgage. Segments that own the practice
 *   they work in (Doctor, Professionals, Pharmacy) reach business too. Segments
 *   with a structural cap do not: a pensioner cannot amortise a 20-year
 *   mortgage inside their remaining tenor, and a thin-file youth applicant is
 *   not a mortgage or a commercial-lending proposition.
 *
 *   WHAT-is-financed names (New Car, Home Purchase, Working Capital) are the
 *   product, so they sit in exactly one category — with two deliberate
 *   exceptions where the Egyptian market genuinely books the same purchase
 *   twice: a used car at a small ticket is routinely written as a personal
 *   loan, and home finishing is a personal loan as often as it is a mortgage
 *   top-up. Equipment Finance reaches `car` because a commercial vehicle is
 *   equipment.
 *
 * The result is the intended MIX — four-category names, three, two and one — not
 * a uniform grid. A uniform grid is what the backfill already gave us.
 *
 * ── Axis 2: question template ───────────────────────────────────────────────
 * ADVISORY ONLY. It pre-ticks step 1 of the per-bank-program scoring wizard and
 * is read by nothing at runtime; `scoring_weight_set.weights.questionWeights`
 * stays the sole authority on what a program actually scores. The archetype says
 * WHICH questions, each bank says HOW MUCH.
 *
 * So the sets here are chosen as a credit-committee shortlist, not as a
 * questionnaire: capacity (income, existing obligations, amount, tenor),
 * stability (employment shape, tenure, payroll routing), and the product's own
 * risk driver (the car's age, the property's registration, the company's age).
 * Three things are kept OUT on purpose:
 *
 *   - Preference questions (`priority_factor`, `needs_consultant`,
 *     `needs_assistance`) — routing signals for a salesperson, not credit
 *     signals. Weighting them prices a customer's shopping style.
 *   - The itemised `obligation_*` breakdown — `current_installments` already
 *     carries the same money once. Ticking both double-counts a borrower's debts
 *     against them, and the itemised rows exist to compute DBR, not to rank.
 *   - Anything the category does not ask. A suggestion outside the asked set is
 *     kept and flagged rather than pruned by the service, which is right — but
 *     shipping one deliberately would just seed the board with warnings.
 *
 * Each set runs 8–15 questions: enough that a weight is a real opinion, few
 * enough that a 100-point budget is still divisible into meaningful shares. The
 * long end is where the product carries its own risk questions (a mortgage's
 * property block) on top of the borrower's.
 */

export type CatalogCategory = 'personal' | 'car' | 'mortgage' | 'business';

/**
 * Loan categories each `program_name` may be OFFERED under. The array IS the set
 * — a key present with fewer categories than today NARROWS it.
 *
 * A key absent from this map is left exactly as it is: this is one operator's
 * pass over the catalog, not a definition of it, and names an admin added
 * through the board must survive a re-run untouched.
 */
export const CATALOG_CATEGORY_ASSIGNMENTS: Readonly<Record<string, readonly CatalogCategory[]>> = {
  // ── Four: the borrower owns the practice they work in, so the business line is
  // a real product for them. Their fee income is not on a payslip either, which is
  // what the NO-PAYSLIP basis is for — but that is a per-program property, not a
  // category, so it shows up as the `years_in_practice` fact ticked on the name,
  // not as a fifth entry here (v16.0.0).
  doctor: ['personal', 'car', 'mortgage', 'business'],
  professional: ['personal', 'car', 'mortgage', 'business'],
  // The practice-OWNING doctor, split out from `doctor` because the two are one
  // name carrying two income rules (axis 4): a salaried clinic doctor reads a
  // payslip, an owner is priced off years in practice. Same reach as `doctor` —
  // owning the practice never narrows what the owner may borrow for.
  doctor_practice: ['personal', 'car', 'mortgage', 'business'],

  // ── Three: salaried segments. Everything a payroll reaches, nothing more —
  // uniformed and government staff are barred from trading, and a bank's own
  // staff borrow as employees.
  // Uniformed staff are also sold WITHOUT a payslip, priced off their GRADE — three
  // live ABK programs do exactly that, as `personal` + `income_surrogate`. Again a
  // basis, not a category: the `military_grade` fact carries it.
  armed_forces: ['personal', 'car', 'mortgage'],
  police: ['personal', 'car', 'mortgage'],
  // University staff sit under this archetype, and an academic rank prices the same
  // way a military grade does.
  govt_employee: ['personal', 'car', 'mortgage'],
  bankers: ['personal', 'car', 'mortgage'],
  private_sector: ['personal', 'car', 'mortgage'],

  // Three: a pharmacy is a licensed business, and the owner borrows both ways.
  // Mortgage is out — the premises are financed as commercial real estate, which
  // this platform does not sell.
  pharmacy: ['personal', 'car', 'business'],

  // Three: university teaching staff, split out of `professional` because an
  // academic RANK prices them and a lawyer's fee income does not. Salaried, so
  // the payroll reach applies — the rank table is the personal-loan basis, and
  // the same university issues a payroll certificate for the car and the flat.
  professor: ['personal', 'car', 'mortgage'],

  // Three: business owners underwritten on bank statements, split out of
  // `professional` for the same reason — turnover is not a fee. Mortgage is out
  // for the pharmacy's reason: an owner's premises are commercial real estate.
  self_employed: ['personal', 'car', 'business'],

  // Three: the affluent tier. Documented income, large tickets, qualitative
  // review. No business line — this is a private-banking borrower, not a company.
  wealth_tier: ['personal', 'car', 'mortgage'],

  // ── Two: structurally capped segments.
  // A mortgage has to amortise inside the borrower's remaining earning tenor;
  // a pension does not stretch that far, and a car does.
  pensioner: ['personal', 'car'],
  // A playing career is the same cap seen from the other end: it ends around 35,
  // so a 20-year mortgage outlives the income that services it. The club contract
  // is a real payslip, which is why this is not a no-payslip name.
  athlete: ['personal', 'car'],
  // Thin file, short tenure, no collateral story. Small-ticket personal and
  // entry car finance are exactly where a youth programme belongs.
  youth: ['personal', 'car'],

  // ── Two: product names the market genuinely books twice.
  used_car: ['car', 'personal'],
  home_finishing: ['mortgage', 'personal'],
  equipment_finance: ['business', 'car'],

  // ── One: the name IS the product. Widening these would be assignment noise,
  // not reach — a "Home Purchase" personal loan is not a thing at these tickets.
  new_car: ['car'],
  home_purchase: ['mortgage'],
  working_capital: ['business'],
};

// ---------------------------------------------------------------------------
// The NO-PAYSLIP fact, per archetype (constitution v16.0.0)
//
// v15.0.0 built a whole sixth `fast` question set per archetype here — the personal
// set minus the four payslip questions, plus the fact. v16.0.0 deleted that category:
// no payslip is an income BASIS carried by `bank_program.programType`, not a product
// the customer picks, so there is no separate set to build.
//
// What survives is the FACT — the figure a bank's table looks the assumed income up BY,
// which is a different statement from "this name is sold without a payslip" (that one is
// stored, see axis 3 below, and this map is its input). Live ABK programs
// (`ABK-MILITARY`, `ABK-PROFESSORS` and the two `ABK-PER-DOCTORS_*` sheets) are
// `personal` + `income_surrogate` and read exactly these facts.
//
// NOTE (v25.0.0): this map used to do a second job — a loop below appended each fact to
// the archetype's `personal` set in `CATALOG_QUESTION_TEMPLATE`, so that the question
// behind it got ASKED. That template is deleted (`platform_enumeration_question`), and
// it never made a question asked anyway: what a loan type asks is
// `question_loan_category`, written by `seed-questionnaire.ts`, and what a no-payslip
// PRODUCT reads is `surrogate_product_ask`. The template only pre-ticked a scoring
// wizard that no longer exists. So this map now states one thing — which fact each
// archetype's rule is keyed by — and `catalogIncomeBasis` below is its only reader.
// ---------------------------------------------------------------------------

/** The fact each archetype's banks look an assumed income up by. */
export const NO_PAYSLIP_FACT: Readonly<Record<string, readonly string[]>> = {
  armed_forces: ['military_grade'],
  police: ['military_grade'],
  govt_employee: ['academic_rank'],
  doctor: ['years_in_practice'],
  professional: ['years_in_practice'],
  pharmacy: ['years_in_practice'],
  // The three names split out of `professional` / `doctor` so that one name could
  // state one income rule (axis 4). Each names the fact its own rule reads, which
  // is what makes the question ASKED — the rule can be configured either way, but
  // an unasked fact resolves to `fact_not_answered` and quotes nothing.
  professor: ['academic_rank'],
  doctor_practice: ['years_in_practice'],
  self_employed: ['years_in_practice'],
  // `athlete` and `wealth_tier` are deliberately absent: a club contract and a
  // wealth-tier salary are both documented, so both are payslip products and
  // there is no fact to ask.
};

// ---------------------------------------------------------------------------
// Axis 3: the income basis — EXACTLY ONE per (name, category)
// ---------------------------------------------------------------------------

export type CatalogIncomeBasis = 'payslip' | 'no_payslip';

/**
 * Archetypes whose income never appears on a payslip WHATEVER they borrow for:
 * they own the practice they work in, so there is no employer to issue one. This
 * is the same rule `seed-bank-programs.ts#skeletonFor` prices off — kept as one
 * statement rather than two copies that can drift (A25).
 */
export const SELF_EMPLOYED_ARCHETYPES: ReadonlySet<string> = new Set([
  'doctor',
  'professional',
  'pharmacy',
  // Split out of the two above when the income rule moved onto the name (axis 4).
  // Both are self-employed BY DEFINITION rather than by archetype — the first owns
  // the practice, the second is underwritten on its turnover — so they belong here
  // more squarely than the two names they came from.
  'doctor_practice',
  'self_employed',
  // `professor` is NOT here: a university pays a salary. Its no-payslip basis on
  // the personal product comes from the `academic_rank` FACT (rule 3), not from
  // the archetype, which is exactly the distinction rules 2 and 3 draw.
]);

/**
 * The basis one (name, category) pair is sold on. ONE, never both.
 *
 * Until now the seed marked the six fact-carrying names as BOTH bases, on the
 * argument that other banks also sell them the ordinary way. That argument is
 * about BANKS, and a bank states its own basis on its own program — the catalog
 * answers a different question ("what is this name FOR?"), which has one answer.
 * Marking both made every catalog name read as undecided and gave the admin
 * screens a value their controls could no longer express.
 *
 * Three rules, most specific first:
 *
 *   1. `business` is never a payslip product. A company's revenue is not a salary,
 *      and every seeded business program is `income_surrogate` accordingly.
 *   2. A self-employed archetype carries its basis across every category it
 *      reaches — a doctor financing a car is still a doctor.
 *   3. A name with a curated no-payslip FACT is sold that way under the categories
 *      the fact map covers (`personal`), and the ordinary way elsewhere: a
 *      uniformed borrower is priced off their grade on a personal loan, and off a
 *      payroll certificate on the car loan the same payroll department issues.
 *
 * Rule 3 deliberately disagrees with `skeletonFor`, which books
 * armed_forces / police / govt_employee as `income_proof`. That is intent vs
 * fact, and v16.4.0 made them separate on purpose: this says what the name is
 * for, the catalog board counts what banks actually did, and the two are allowed
 * to differ. Nothing enforces either against the other (v16.4.1).
 */
export function catalogIncomeBasis(key: string, category: CatalogCategory): CatalogIncomeBasis {
  if (category === 'business') return 'no_payslip';
  if (SELF_EMPLOYED_ARCHETYPES.has(key)) return 'no_payslip';
  return NO_PAYSLIP_FACT[key] && category === 'personal' ? 'no_payslip' : 'payslip';
}

/**
 * The basis for every pair the category axis assigns — derived, not typed, so a
 * pair can never appear here that axis 1 does not offer.
 */
export const CATALOG_INCOME_BASIS: Readonly<
  Record<string, Partial<Record<CatalogCategory, CatalogIncomeBasis>>>
> = Object.fromEntries(
  Object.entries(CATALOG_CATEGORY_ASSIGNMENTS).map(([key, categories]) => [
    key,
    Object.fromEntries(categories.map((c) => [c, catalogIncomeBasis(key, c)])),
  ]),
);

// ---------------------------------------------------------------------------
// Axis 4: the income rule — HOW a name's income is worked out, stated ONCE
// ---------------------------------------------------------------------------

/**
 * One catalog name's income rule, in the canonical shape
 * `bank_program.incomeAssumption` already carries.
 *
 * Structural, and typed HERE rather than imported from
 * `src/matching/types.ts`: `prisma/` seeds a database and must not depend on the
 * Nest application (nothing else under `prisma/data/` does). The shapes are
 * checked against the real type by the migration that writes the same literals
 * and by the PR-2 validator, not by this file.
 *
 * Every figure is a Decimal STRING (Principle I / A3). A number here would round
 * through a float on its way into JSONB and quietly move an income.
 */
export interface CatalogIncomeRule {
  strategy: string;
  /** Choice facts: the answer the customer picks → the income the bank assigns. */
  keyTable?: ReadonlyArray<{ key: string; incomeEGP: string }>;
  /** Numeric facts: half-open `[fromInclusive, toExclusive)`, `null` = open end. */
  bands?: ReadonlyArray<{ fromInclusive: string; toExclusive: string | null; incomeEGP: string }>;
  /** One number and the unit its arithmetic is expressed in. */
  scalar?: { value: string; unit: 'percent' | 'multiplier' };
}

/**
 * The rule each catalog name is quoted on.
 *
 * ── WHY THIS AXIS EXISTS ────────────────────────────────────────────────────
 * The rule that turns "assistant professor" into 18 000 EGP used to live on each
 * bank's own program. That made one name mean several things at one bank: ABK
 * filed its professors (a rank table), its footballers (no table) and its wealth
 * tier (no table) all under `professional`, and its salaried clinic doctors and
 * its practice-owning doctors both under `doctor`. Whoever opened the catalog saw
 * a name; whoever opened the program saw a rule; nothing reconciled them.
 *
 * So the rule is stated once, per name, here — and five names were ADDED
 * (`professor`, `doctor_practice`, `self_employed`, `athlete`, `wealth_tier`)
 * because a name that has to hold two rules is a name that is too coarse.
 *
 * ── WHAT A KEY'S ABSENCE MEANS ──────────────────────────────────────────────
 * Absent = NULL = "nobody has decided". Present with `{strategy:'declared'}` =
 * "an operator decided this name is quoted off the income the applicant typed".
 * Both quote the same figure; only the catalog counters and the operator screens
 * read the difference, which is why the second is written out rather than left
 * absent.
 *
 * ABSENT is no longer a neutral state. Since the income proof became the NAME's
 * property, absent means "nobody has decided", and a surrogate program filed under
 * such a name is REFUSED (`PROGRAM_NAME_INCOME_PROOF_MISSING`). So every name that
 * already carries a surrogate program has to appear below — including the four whose
 * answer is `declared`, which is a decision, not a blank.
 *
 * Nothing is absent any more that a surrogate program is filed under. Run
 * `scripts/income-proof-conflicts.ts` after changing this file — it reports every name
 * a program reads that states nothing, and every name two programs disagree about.
 *
 * ── FIGURES ARE COPIES ──────────────────────────────────────────────────────
 * Every value below is verbatim from the program that carries it today
 * (`src/bank-programs/seeds/catalogs/*.ts`). Not one may move: an income that
 * moves is a loan amount that moves, and an offer already written is immutable
 * (Principle I, FR-015). The two edges of the `doctor_practice` band table are
 * load-bearing for that reason — see the comment on ABK-DOCTORS-PRACTICE.
 */
export const CATALOG_INCOME_RULE: Readonly<Record<string, CatalogIncomeRule>> = {
  // SOURCE: ABK-PROFESSORS. `rankIncomeMap` in registry display order.
  professor: {
    strategy: 'byProfessorRank',
    keyTable: [
      { key: 'lecturer', incomeEGP: '12000' },
      { key: 'assistant_professor', incomeEGP: '18000' },
      { key: 'professor', incomeEGP: '25000' },
    ],
  },

  // SOURCE: ABK-DOCTORS-PRACTICE. The lower edge STAYS 6 and the top band STAYS
  // CLOSED at 51: the legacy table overlapped on year 5 and the lookup is
  // first-match, so year 5 has always resolved to 15 000, and opening the top band
  // would start paying a 51-year practitioner 40 000 where today they get no
  // figure at all. This is a copy, not an opportunity to tidy the table.
  doctor_practice: {
    strategy: 'byYearsInPractice',
    bands: [
      { fromInclusive: '0', toExclusive: '6', incomeEGP: '15000' },
      { fromInclusive: '6', toExclusive: '51', incomeEGP: '40000' },
    ],
  },

  // SOURCE: SF-SELF-EMP, whose stored shape is the legacy
  // `{ bankStatementPercent: '30.0' }`. Written canonical here because
  // `normalizeIncomeAssumption` produces the identical figure from either — the
  // same conversion the other seeded rules already had applied to them.
  self_employed: {
    strategy: 'byBankStatementPercent',
    scalar: { value: '30.0', unit: 'percent' },
  },

  // SOURCE: ABK-FOOTBALL. A club contract is a payslip.
  athlete: { strategy: 'declared' },

  // SOURCE: ABK-WEALTH + SF-HIGH-END. Two programs, one rule, and they already
  // agree — which is what makes the name safe to state once.
  wealth_tier: { strategy: 'declared' },

  // ── STATED `declared`, because surrogate programs are already filed here ──────
  //
  // These four names carry `income_surrogate` programs whose rule is `declared`: the
  // bank works with no payslip but names no substitute figure — it lends against the
  // business, and the applicant's own stated income is the number. That is a real
  // configuration (`quote.ts` reads the declared salary and the offer records
  // `origin: 'declared'`), and seven seeded business programs rely on it.
  //
  // Written out rather than left absent because the two are now different answers to
  // a question the API asks: absent means "nobody has decided", which REFUSES the next
  // surrogate program filed under the name (`PROGRAM_NAME_INCOME_PROOF_MISSING`).
  // Every one of these names already has such programs, so leaving them absent would
  // make eleven live programs unsavable on their next unrelated edit.
  //
  // `doctor` is the one with a substitute figure: both its surrogate programs read
  // years in practice and they AGREE on the proof, which is what makes the name safe
  // to state. The FIGURES here are ABK-PER-DOCTOR's, the richer of the two tables;
  // both programs keep their own (`amounts: 'own'`), so this table is what a NEW
  // program under the name starts from and moves no existing quote.
  doctor: {
    strategy: 'byYearsInPractice',
    bands: [
      { fromInclusive: '0', toExclusive: '3', incomeEGP: '18000' },
      { fromInclusive: '3', toExclusive: '8', incomeEGP: '35000' },
      { fromInclusive: '8', toExclusive: '15', incomeEGP: '60000' },
      { fromInclusive: '15', toExclusive: '31', incomeEGP: '90000' },
    ],
  },

  // SOURCE: CIB-PER-PROFESSIONAL + HSBC-PER-PROFESSIONAL as SEEDED — `skeletonFor`
  // types them `income_surrogate` (the archetype is self-employed) with no substitute
  // figure. `seed-surrogate-demo.ts` rewrites both on a dev box; it now files them
  // under `professor` and `self_employed`, whose stated proofs they actually read.
  professional: { strategy: 'declared' },
  // SOURCE: ADIB-BIZ-EQUIPMENT_FINANCE + BM-BIZ-EQUIPMENT_FINANCE, both `declared`.
  equipment_finance: { strategy: 'declared' },
  // SOURCE: BDC-PER-PHARMACY + CIB-BIZ-PHARMACY, both `declared`.
  pharmacy: { strategy: 'declared' },
  // SOURCE: four WORKING_CAPITAL programs (ABK / BDC / CIB / NXT), all `declared`.
  working_capital: { strategy: 'declared' },

  // SOURCE: ABK-MILITARY. An EXISTING name, not one of the five added: no program
  // moves onto or off `armed_forces`, the rule simply moves up from the one
  // program that already carries it. NBE's program under the same name is
  // `income_proof` with a declared salary, so it never consults the rule.
  armed_forces: {
    strategy: 'byMilitaryGrade',
    keyTable: [
      { key: 'officer', incomeEGP: '15000' },
      { key: 'senior_officer', incomeEGP: '25000' },
      { key: 'general', incomeEGP: '40000' },
    ],
  },
};
