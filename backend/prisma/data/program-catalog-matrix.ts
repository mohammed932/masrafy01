/**
 * The catalog's two ASSIGNMENT axes, curated — which loan categories each
 * predefined program name may be offered under, and which questions that name
 * suggests scoring on under each of those categories.
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
export const CATALOG_CATEGORY_ASSIGNMENTS: Readonly<
  Record<string, readonly CatalogCategory[]>
> = {
  // ── Four: the borrower owns the practice they work in, so the business line is
  // a real product for them. Their fee income is not on a payslip either, which is
  // what the NO-PAYSLIP basis is for — but that is a per-program property, not a
  // category, so it shows up as the `years_in_practice` fact ticked on the name,
  // not as a fifth entry here (v16.0.0).
  doctor: ['personal', 'car', 'mortgage', 'business'],
  professional: ['personal', 'car', 'mortgage', 'business'],

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

  // ── Two: structurally capped segments.
  // A mortgage has to amortise inside the borrower's remaining earning tenor;
  // a pension does not stretch that far, and a car does.
  pensioner: ['personal', 'car'],
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
// What survives is the FACT, appended to the archetype's `personal` set. That single
// code is what marks the name as sellable without a payslip: the admin catalog derives
// "sold without a payslip" from the overlap of a name's ticked questions with the four
// surrogate facts, and the bank-program wizard offers only fact-carrying names when the
// admin picks the no-payslip basis. Three live ABK programs (`ABK-MILITARY`,
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
const NO_PAYSLIP_FACT: Readonly<Record<string, readonly string[]>> = {
  armed_forces: ['military_grade'],
  police: ['military_grade'],
  govt_employee: ['academic_rank'],
  doctor: ['years_in_practice'],
  professional: ['years_in_practice'],
  pharmacy: ['years_in_practice'],
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
