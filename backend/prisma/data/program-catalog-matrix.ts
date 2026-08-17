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
// Question shortlists
//
// Built from a per-category spine plus per-archetype deltas, because the spine
// is where the argument actually lives: every set answers "can they pay, will
// they keep paying, and what is this specific product's own risk?". The deltas
// are the archetype's disagreement with that spine, and reading them next to it
// is how a reviewer sees the disagreement.
// ---------------------------------------------------------------------------

/**
 * Salaried personal spine. Payroll routing carries real weight here: a salary
 * transferred to the lending bank is the cheapest collection mechanism in the
 * market, which is why it is priced.
 */
const PERSONAL_SALARIED = [
  'monthly_income',
  'current_installments',
  'current_loans',
  'employment_status',
  'job_tenure',
  'salary_transfer',
  'employer_approved',
  'amount_requested',
  'active_account',
] as const;

/**
 * Self-employed personal spine. Drops the three payroll questions — an owner has
 * no employer to sign a transfer letter, so scoring them penalises the segment
 * for its own definition — and replaces them with the signals that do exist:
 * other income streams and prior credit history.
 */
const PERSONAL_SELF_EMPLOYED = [
  'monthly_income',
  'additional_income',
  'current_installments',
  'current_loans',
  'employment_status',
  'amount_requested',
  'active_account',
  'prior_rejection',
] as const;

/**
 * Car spine. The asset is half the credit decision — its price sets the
 * exposure, the down payment sets the loss-given-default, and condition + model
 * year set what the collateral is still worth at month 48.
 */
const CAR_SPINE = [
  'vehicle_price',
  'down_payment',
  'vehicle_condition',
  'model_year',
  'monthly_income',
  'current_installments',
  'amount_requested',
  'repayment_period_months',
  'employment_status',
] as const;

/**
 * Mortgage spine. Registration status is the one that actually kills deals in
 * Egypt: an unregistered unit cannot carry a clean mortgage, whatever the
 * borrower earns.
 */
const MORTGAGE_SPINE = [
  'property_value',
  'down_payment',
  'property_type',
  'registration_status',
  'monthly_income',
  'current_installments',
  'amount_requested',
  'repayment_period_months',
  'employment_status',
  'job_tenure',
] as const;

/**
 * Business spine. Personal-employment questions are not asked under `business`
 * at all — the company is the borrower, so its age, formality (commercial + tax
 * registration), banking footprint and existing facilities replace them.
 *
 * Turnover rides on `monthly_income`, not on `monthly_revenue`: the dedicated
 * revenue question is soft-deleted and has left the pool, so naming it here
 * would seed a suggestion the board immediately flags. If the questionnaire team
 * brings it back, it belongs at the head of this list.
 */
const BUSINESS_SPINE = [
  'monthly_income',
  'business_age',
  'activity_type',
  'registered',
  'tax_registration',
  'business_account',
  'current_facilities',
  'financing_purpose',
  'amount_requested',
  'repayment_period_months',
  'current_installments',
] as const;

/**
 * Suggested questions per (program name, loan category).
 *
 * Only pairs the name is offered under are listed. A category that is missing
 * here reads as "not configured", which is the day-one state and not an error —
 * unlike an empty category ASSIGNMENT above, which means "parked".
 */
export const CATALOG_QUESTION_TEMPLATE: Record<
  string,
  Partial<Record<CatalogCategory, readonly string[]>>
> = {
  // ── Doctors: hospital salary plus a private clinic. Both halves are scored —
  // the payroll one because most consultants still have one, `additional_income`
  // because the clinic is usually the larger half.
  doctor: {
    personal: [...PERSONAL_SALARIED, 'additional_income'],
    car: [...CAR_SPINE, 'additional_income', 'salary_transfer'],
    mortgage: [...MORTGAGE_SPINE, 'additional_income', 'salary_transfer'],
    business: [...BUSINESS_SPINE],
  },

  // ── Professionals (lawyers, engineers, accountants): the same two-sided
  // income, tilted self-employed.
  professional: {
    personal: [...PERSONAL_SELF_EMPLOYED],
    car: [...CAR_SPINE, 'additional_income'],
    mortgage: [...MORTGAGE_SPINE, 'additional_income'],
    business: [...BUSINESS_SPINE],
  },

  // ── Doctors who own the practice: `doctor` minus the payroll half. There is no
  // employer to route a salary or sign a consent letter, so the self-employed
  // spine carries the personal side and `additional_income` stops being the
  // second half of the income — it IS the income, and `monthly_income` in the
  // spine already asks for it.
  doctor_practice: {
    personal: [...PERSONAL_SELF_EMPLOYED],
    car: [...CAR_SPINE, 'additional_income'],
    mortgage: [...MORTGAGE_SPINE, 'additional_income'],
    business: [...BUSINESS_SPINE],
  },

  // ── Professors: `govt_employee`'s shape, because a public university IS the
  // government payroll — `salary_bank_name` included for the same reason (an
  // academic's salary moves between banks by decree). What differs is the rule,
  // not the questions.
  professor: {
    personal: [...PERSONAL_SALARIED, 'salary_bank', 'salary_bank_name'],
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'employer_approved'],
    mortgage: [...MORTGAGE_SPINE, 'salary_transfer', 'employer_approved'],
  },

  // ── Self-employed owners: `professional`'s sets. The two were one name until
  // the income rule forced them apart, and the credit questions genuinely are the
  // same — it is only the figure the bank works the income out FROM that differs
  // (a bank statement rather than a fee history).
  self_employed: {
    personal: [...PERSONAL_SELF_EMPLOYED],
    car: [...CAR_SPINE, 'additional_income'],
    business: [...BUSINESS_SPINE],
  },

  // ── Athletes: salaried on a club contract, but with a career shorter than the
  // loan. `job_tenure` therefore reads the opposite way to every other salaried
  // segment — long tenure is a career closer to its end — so the spine's answer
  // is kept and the weight is left to the bank, which is the division of labour
  // this whole axis assumes.
  athlete: {
    personal: [...PERSONAL_SALARIED, 'additional_income'],
    car: [...CAR_SPINE, 'salary_transfer', 'additional_income'],
  },

  // ── Wealth tier: the questions that still discriminate at a 5m ticket. Payroll
  // routing does not — a private-banking customer transfers what they choose —
  // so it is dropped in favour of the asset and liability picture.
  wealth_tier: {
    personal: [...PERSONAL_SALARIED, 'additional_income', 'prior_rejection'],
    car: [...CAR_SPINE, 'additional_income'],
    mortgage: [...MORTGAGE_SPINE, 'additional_income'],
  },

  // ── Pharmacy: a licensed retail business. On the personal side the owner is
  // self-employed; on the business side the licence and the turnover carry it.
  pharmacy: {
    personal: [...PERSONAL_SELF_EMPLOYED],
    car: [...CAR_SPINE, 'additional_income'],
    business: [...BUSINESS_SPINE, 'prior_rejection'],
  },

  // ── Uniformed segments: income is stable and deduction at source is the whole
  // credit story, so payroll routing and employer consent lead. `salary_bank` is
  // added because these payrolls sit with a small set of banks, which decides
  // whether the deduction is even operable.
  armed_forces: {
    personal: [...PERSONAL_SALARIED, 'salary_bank'],
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'employer_approved'],
    mortgage: [...MORTGAGE_SPINE, 'salary_transfer', 'employer_approved'],
  },
  police: {
    personal: [...PERSONAL_SALARIED, 'salary_bank'],
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'employer_approved'],
    mortgage: [...MORTGAGE_SPINE, 'salary_transfer', 'employer_approved'],
  },

  // ── Government: same shape, plus which bank holds the payroll — government
  // salaries move between banks by decree, not by the employee's choice.
  govt_employee: {
    personal: [...PERSONAL_SALARIED, 'salary_bank', 'salary_bank_name'],
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'employer_approved'],
    mortgage: [...MORTGAGE_SPINE, 'salary_transfer', 'employer_approved'],
  },

  // ── Bankers: the one salaried segment with a readable card footprint, and
  // card behaviour is the closest thing to a bureau score on this platform. The
  // footprint is read off `current_loans` — the standalone card questions are
  // gone (the multi-select already carries a `credit_cards` pick, and the card
  // LIMIT it reveals is what the 5% monthly commitment is computed from).
  bankers: {
    personal: [...PERSONAL_SALARIED],
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'current_loans'],
    mortgage: [...MORTGAGE_SPINE, 'salary_transfer', 'additional_income'],
  },

  // ── Private sector: the volume segment, and the one with real employer
  // dispersion — tenure and a prior rejection are the separators.
  private_sector: {
    personal: [...PERSONAL_SALARIED, 'prior_rejection'],
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'prior_rejection'],
    mortgage: [...MORTGAGE_SPINE, 'salary_transfer', 'additional_income'],
  },

  // ── Pensioners: no employer, so no tenure and no employer consent. The pension
  // credit itself is the payroll question, age is a tenor constraint rather than
  // a risk grade, and any second income matters more than usual.
  pensioner: {
    personal: [
      'monthly_income',
      'salary_transfer',
      'additional_income',
      'current_installments',
      'current_loans',
      'amount_requested',
      'active_account',
    ],
    car: [...CAR_SPINE, 'salary_transfer', 'additional_income'],
  },

  // ── Youth: thin file. Nothing historic to lean on, so the set leans on what a
  // young applicant does have — a first job's tenure, a routed salary, and
  // whatever card behaviour exists.
  youth: {
    personal: [
      'monthly_income',
      'employment_status',
      'job_tenure',
      'salary_transfer',
      'current_installments',
      'current_loans',
      'amount_requested',
      'active_account',
    ],
    car: [...CAR_SPINE, 'job_tenure', 'salary_transfer', 'current_loans'],
  },

  // ── New car: the asset is the least of the worries (it is new, and it is worth
  // what the invoice says), so the spine is joined by the repayment questions.
  new_car: {
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'wants_insurance'],
  },

  // ── Used car: the mirror image. `model_year` and `vehicle_condition` already
  // lead the spine and are the whole reason this archetype is priced apart; the
  // personal-loan route is the small-ticket booking, where the car stops being
  // collateral and the borrower carries the deal alone.
  used_car: {
    car: [...CAR_SPINE, 'salary_transfer', 'job_tenure', 'current_loans'],
    personal: [...PERSONAL_SALARIED],
  },

  // ── Home purchase: the largest and longest exposure on the platform. Location
  // and compound status are collateral-quality questions, not preferences.
  home_purchase: {
    mortgage: [
      ...MORTGAGE_SPINE,
      'in_compound',
      'governorate',
      'salary_transfer',
      'additional_income',
    ],
  },

  // ── Home finishing: a fraction of the ticket against a unit the borrower
  // already holds, so the property questions thin out to the one that decides
  // whether it can be pledged at all, and the personal route carries the purpose
  // question instead.
  home_finishing: {
    mortgage: [...MORTGAGE_SPINE, 'salary_transfer'],
    personal: [...PERSONAL_SALARIED, 'loan_purpose'],
  },

  // ── Working capital: a revolving need. Existing facilities and the company's
  // age do most of the work; the purpose question separates a genuine cycle gap
  // from a loss being funded.
  working_capital: {
    business: [...BUSINESS_SPINE, 'prior_rejection'],
  },

  // ── Equipment finance: asset-backed lending on the business side, and an
  // ordinary secured car deal when the equipment happens to have wheels.
  equipment_finance: {
    business: [...BUSINESS_SPINE],
    car: [...CAR_SPINE, 'current_loans'],
  },
};

// ---------------------------------------------------------------------------
// The NO-PAYSLIP fact, per archetype (constitution v16.0.0)
//
// v15.0.0 built a whole sixth `fast` question set per archetype here — the personal
// set minus the four payslip questions, plus the fact. v16.0.0 deleted that category:
// no payslip is an income BASIS carried by `bank_program.programType`, not a product
// the customer picks, so there is no separate set to build.
//
// What survives is the FACT, appended to the archetype's `personal` set — the figure a
// bank's table looks the assumed income up BY, which is a different statement from "this
// name is sold without a payslip" (that one is stored, see axis 3 below, and this map is
// one of its inputs). The fact has to be ASKED for any table keyed on it to resolve, and
// what it does here is get it asked. Three live ABK programs (`ABK-MILITARY`,
// `ABK-PROFESSORS`, `ABK-DOCTORS-PRACTICE`) are `personal` + `income_surrogate` and read
// exactly these facts.
//
// The four payslip questions are NOT dropped, unlike the old `fast` delta: the same name
// under `personal` is still sold the ordinary way by other banks, and the payslip
// questions score those programs. A no-payslip applicant simply skips them — an
// asked-but-unanswered question keeps its weight in the denominator and earns nothing
// (Principle V, v13.0.0), which is the honest outcome.
//
// `car` is surrogate-CAPABLE too, and deliberately left alone: seeding a tick there
// would assert a product decision nobody has made. It is one click on the catalog
// screen when a bank actually sells it.
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

/**
 * Folded into the template map above rather than typed into each `personal` array, so a
 * later edit to a name's personal set cannot silently drop the fact that makes the name
 * sellable without a payslip.
 */
for (const [key, facts] of Object.entries(NO_PAYSLIP_FACT)) {
  const personal = CATALOG_QUESTION_TEMPLATE[key]?.personal;
  if (!personal) continue;
  const missing = facts.filter((code) => !personal.includes(code));
  if (missing.length === 0) continue;
  (CATALOG_QUESTION_TEMPLATE[key] as Record<string, readonly string[]>).personal = [
    ...personal,
    ...missing,
  ];
}

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
 * `doctor` and `professional` are deliberately ABSENT. After the split, every
 * program still filed under them carries `declared` — there is nothing to state,
 * and stating it would claim a decision nobody made.
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
