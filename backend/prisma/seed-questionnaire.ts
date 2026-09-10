/**
 * Seed — full 4-category loan questionnaire (Personal, Mortgage, Car, Business)
 * + ACTIVE per-program per-answer point sets + published version snapshots, so
 * the dynamic-questionnaire + matching flow runs end-to-end. Idempotent.
 * Run via:  npx tsx prisma/seed-questionnaire.ts
 *
 * MVP model:
 *  - Questions + answers are PURE CONTENT (label + order only). No engine fields.
 *  - No eligibility gates, and no scoring: a question is asked, priced or read by an
 *    income rule — never weighted.
 */
import { I_SCORE_FACT_KEY } from '../src/matching/pipeline/product-template';
import { Prisma, PrismaClient, type QuestionType } from '@prisma/client';
import { bankSlug } from '../src/matching/pipeline/bank-relationship';
import {
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  DEBT_TYPE_OPTION_CODES,
  MONEY_FIELD_BINDINGS,
  MONEY_FIELD_BINDING_KEYS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
  OBLIGATION_ITEM_QUESTION_CODES,
} from '../src/matching/pipeline/money-field-bindings';
/** The four retail loan categories, as this seed's configs key them. */
type SeedCategory = 'personal' | 'mortgage' | 'car' | 'business';

/** Recorded as the author on every row this seed writes. */
const SEED_ACTOR = 'seed-system';

/**
 * NUMERIC content bounds, as authored below. The unit is optional: a bureau score has
 * no unit, and the interface it was lifted from required one — which nothing ever
 * caught, because `prisma/` is outside the `tsc` include.
 */
interface SeedNumericRules {
  minValue: string;
  maxValue: string;
  step?: string;
  unitEn?: string;
  unitAr?: string;
}

const prisma = new PrismaClient();

type Category = SeedCategory;

// Active platform-enumeration members → seed options (code = enum key). Cached
// per type so a category seed reads each list at most once.
const _enumOptionsCache = new Map<string, SeedOption[]>();
async function enumOptions(type: string, client: PrismaClient): Promise<SeedOption[]> {
  const cached = _enumOptionsCache.get(type);
  if (cached) return cached;
  const rows = await client.platformEnumeration.findMany({
    where: { type, active: true },
    orderBy: { sortOrder: 'asc' },
  });
  const opts: SeedOption[] = rows.map((r) => ({
    code: r.key,
    labelEn: r.labelEn,
    labelAr: r.labelAr,
  }));
  _enumOptionsCache.set(type, opts);
  return opts;
}

// Active `bank` registry rows → seed options (Principle II — banks are DATA, so
// the option list follows whatever the admin registered; no hardcoded bank
// branch anywhere). Cached because the merge reads it once per referencing
// question. `code` slugs the English name: it is a join key
// (`ApplicationAnswer.selectedOptionCode`, a surrogate fact's table), so a
// bank renamed in the registry seeds a NEW option code and the old one simply
// deactivates — stored answers keep pointing at the name that was picked.
let _bankOptionsCache: SeedOption[] | null = null;
async function bankOptions(client: PrismaClient): Promise<SeedOption[]> {
  if (_bankOptionsCache) return _bankOptionsCache;
  const rows = await client.bank.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { nameEnglish: 'asc' }],
    select: { nameEnglish: true, nameArabic: true },
  });
  const opts: SeedOption[] = rows.map((b) => ({
    // The ENGINE's slug, not this file's generic one. A bank-backed answer is compared
    // against `BankProgramSnapshot.bankName` at quote time (`bank_relationship`), so the
    // two sides have to be one function — they agree today, and this is what keeps them
    // agreeing when a bank is renamed.
    code: bankSlug(b.nameEnglish),
    labelEn: b.nameEnglish,
    labelAr: b.nameArabic,
  }));
  if (rows.length === 0) {
    console.warn(
      '[seed-questionnaire] bank registry is empty — bank-backed questions get only the "Another bank" option. Run `npm run seed:banks`, then re-run this seed.',
    );
  }
  // Escape hatch: the registry only holds partner banks, so an applicant banking
  // elsewhere still has an answer and the question never dead-ends.
  opts.push({ code: 'another_bank', labelEn: 'Another bank', labelAr: 'بنك آخر' });
  _bankOptionsCache = opts;
  return opts;
}

interface SeedOption {
  labelEn: string;
  labelAr: string;
  /** Stable option code. Authored options pin it explicitly because the code is a
   *  join key: mobile answer mappers, stored `ApplicationAnswer.selectedOptionCode`
   *  and an income rule's key table all reference it, so it must survive a copy
   *  edit. Only options built at seed time fall back to slug(labelEn). */
  code?: string;
}
interface SeedQuestion {
  code: string;
  /** Defaults to SINGLE_SELECT. Feature 010: all four types are real. */
  type?: QuestionType;
  /** NUMERIC only — CONTENT bounds + display unit, never scoring (A33). */
  numeric?: SeedNumericRules;
  questionEn: string;
  questionAr: string;
  /** Sub-label under the question. Authored where the figure asked for is not the
   *  one the applicant would assume — e.g. a credit-card LIMIT rather than its
   *  minimum payment, or a total that counts that limit at a discount. */
  helperTextEn?: string;
  helperTextAr?: string;
  isRequired?: boolean; // default true
  /** When set, options are expanded from the active `platform_enumeration`
   *  members of this type at seed time — single source of truth (e.g. governorate),
   *  so mobile still gets the list inside the one questionnaire snapshot call. */
  optionsFromEnum?: string;
  /** When set, options are expanded from the active `bank` registry rows at seed
   *  time (+ an "Another bank" escape hatch) — same single-source-of-truth reason
   *  as `optionsFromEnum`. */
  optionsFromBanks?: true;
  /** Branch rule — the question renders only when the SOURCE question (which must
   *  come EARLIER in the pool and be a choice type) was answered with (or, for
   *  `not_equals`, without) `optionCode`. Mirrors `Question.enabledWhen`. */
  enabledWhen?: SeedEnabledWhen;
  options: SeedOption[];
}
interface SeedEnabledWhen {
  questionCode: string;
  operator: 'equals' | 'not_equals';
  optionCode: string;
}
interface SeedGroup {
  code: string;
  titleEn: string;
  titleAr: string;
  questions: SeedQuestion[];
}
interface CategoryConfig {
  category: Category;
  groups: SeedGroup[];
}

// Employment codes used across categories. Points = desirability to a lender
// (stable salaried income scores highest; irregular income lowest).
const EMPLOYMENT_OPTIONS: SeedOption[] = [
  { code: 'government_employee', labelEn: 'Government job', labelAr: 'موظف حكومي' },
  { code: 'private_sector_employee', labelEn: 'Private company job', labelAr: 'موظف قطاع خاص' },
  { code: 'business_owner_company_owner', labelEn: 'I own a business or company', labelAr: 'صاحب عمل / شركة' },
  { code: 'freelancer', labelEn: 'I work for myself', labelAr: 'عمل حر' },
  { code: 'retired', labelEn: 'Retired', labelAr: 'متقاعد' },
];

const YESNO = (): SeedOption[] => [
  { code: 'yes', labelEn: 'Yes', labelAr: 'نعم' },
  { code: 'no', labelEn: 'No', labelAr: 'لا' },
];

// `your_age` used to live here. It is gone: age is a mandatory signup field
// (`birthday`, Principle XXXVII) and is DERIVED via `getApplicantAge()` for every
// caller, so asking it again could only ever produce a second, self-reported age
// that disagrees with the verified one — and the band answer would have been the
// one scored. Re-running this seed deactivates the row and republishes without it.
// A customer can carry several obligations at once, so this is MULTI_SELECT.
// Shared across categories so the global merge never unions a Yes/No variant
// into the loan-kind list.
const CURRENT_LOANS_Q: SeedQuestion = {
  code: 'current_loans', type: 'MULTI_SELECT',
  questionEn: 'Do you pay back any loans right now?', questionAr: 'هل لديك قروض أو التزامات حالية؟',
  options: [
    { code: 'none', labelEn: 'None', labelAr: 'لا يوجد' },
    { code: 'personal_loan', labelEn: 'Personal loan', labelAr: 'قرض شخصي' },
    { code: 'car_loan', labelEn: 'Car loan', labelAr: 'قرض سيارة' },
    { code: 'mortgage', labelEn: 'Home loan', labelAr: 'قرض عقاري' },
    { code: 'credit_cards', labelEn: 'Credit cards', labelAr: 'بطاقات ائتمان' },
    { code: 'other', labelEn: 'Something else', labelAr: 'أخرى' },
  ],
};

// Asks HOW, not just whether. A yes/no could only ever produce `payroll` or
// `none`, which left every bank rule written against a salary/income transfer
// letter unmatchable. The option codes ARE the `transfer_type` registry keys the
// programs are configured with — see `TRANSFER_TYPE_BY_ANSWER` on the mobile side.
const SALARY_TRANSFER_Q: SeedQuestion = {
  code: 'salary_transfer', questionEn: 'How does your pay reach the bank?', questionAr: 'كيف يصل راتبك إلى البنك؟',
  options: [
    // The two letters are different products, so each label names the document:
    // one commits the basic salary, the other the applicant's whole income.
    { code: 'payroll', labelEn: 'My employer already sends my salary to the bank', labelAr: 'تحويل راتب' },
    { code: 'salary_transfer_letter', labelEn: 'My employer signs a letter to transfer my salary', labelAr: 'خطاب تحويل راتب' },
    { code: 'income_transfer_letter', labelEn: 'My employer signs a letter to transfer my whole income', labelAr: 'خطاب تحويل دخل' },
    { code: 'no_salary_transfer', labelEn: 'Nothing is sent to the bank', labelAr: 'بدون تحويل راتب' },
  ],
};

// ONE band set for the down payment, shared by car + mortgage. Authored once
// because the pool is GLOBAL and dedupes by code while UNIONing options: two
// per-category band sets (10/20/30 vs 20/40) merged into one 8-option list where
// "Less than 20%", "10% – 20%" and "20% – 30%" sat side by side and no applicant
// could tell which one they were in.
const DOWN_PAYMENT_OPTIONS: SeedOption[] = [
  { code: 'no_down_payment', labelEn: 'Nothing up front', labelAr: 'بدون دفعة مقدمة' },
  { code: 'less_than_10', labelEn: 'Less than 10%', labelAr: 'أقل من 10%' },
  { code: '10_20', labelEn: '10% – 20%', labelAr: '10% – 20%' },
  { code: '20_30', labelEn: '20% – 30%', labelAr: '20% – 30%' },
  { code: '30_40', labelEn: '30% – 40%', labelAr: '30% – 40%' },
  { code: 'more_than_40', labelEn: 'More than 40%', labelAr: 'أكثر من 40%' },
];

/**
 * The car's price and the down payment, as AMOUNTS the applicant types.
 *
 * The car flow used to ask both as ranges and the app guessed a midpoint — a 400,000 stand-in
 * for "less than 500,000". Suez Canal Bank reads the down payment ITSELF as proof of income
 * (`income = down payment ÷ 3.6`) and caps the loan at a share of the price, so a midpoint is
 * not an approximation of the answer, it is a different customer's quote. Both are exact.
 *
 * CAR ONLY. Mortgage keeps `DOWN_PAYMENT_Q` below: its property value is still a bucket, and
 * one question cannot be a percentage there and an amount here.
 *
 * No `step`: `answer-validation.ts` refuses a value off the step, and a dealer's price is
 * whatever the quotation says.
 */
const CAR_PRICE_Q: SeedQuestion = {
  code: 'car_price',
  type: 'NUMERIC',
  questionEn: "What is the car's price?",
  questionAr: 'ما سعر السيارة؟',
  helperTextEn: 'The price on the quotation, in pounds.',
  helperTextAr: 'السعر المذكور في عرض السعر، بالجنيه.',
  numeric: { minValue: '10000', maxValue: '50000000', unitEn: 'EGP', unitAr: 'جنيه' },
  options: [],
};

const CAR_DOWN_PAYMENT_Q: SeedQuestion = {
  code: 'car_down_payment',
  type: 'NUMERIC',
  questionEn: 'How much will you pay up front?',
  questionAr: 'كم ستدفع مقدمًا؟',
  helperTextEn: 'The amount, not a percentage — some banks read it as proof of your income.',
  helperTextAr: 'المبلغ وليس النسبة — بعض البنوك تعتبره دليلاً على دخلك.',
  numeric: { minValue: '0', maxValue: '50000000', unitEn: 'EGP', unitAr: 'جنيه' },
  options: [],
};

/**
 * What the applicant has saved, and how they are buying — the Green Finance pair.
 *
 * OPTIONAL, both of them: they are read by one product, and a required question is enforced
 * for everyone the category shows it to. An unanswered buyer type reads the first column
 * (instalments), which is what `pickByFact` does with a missing answer.
 *
 * Authored HERE rather than minted by the blueprint, and that is load-bearing: this seed
 * deactivates every question outside its own pool, and `seed:blueprints` skips a product that
 * already holds a calculation without reviving anything — so a blueprint-minted question is
 * switched off by the next `prisma:seed` and the product quietly stops quoting.
 */
const TOTAL_SAVINGS_Q: SeedQuestion = {
  code: 'total_savings',
  type: 'NUMERIC',
  questionEn: 'How much have you saved in total?',
  questionAr: 'كم إجمالي مدخراتك؟',
  helperTextEn: 'Cash, deposits and certificates you can show statements for.',
  helperTextAr: 'النقد والودائع والشهادات التي يمكنك تقديم كشوف بها.',
  isRequired: false,
  numeric: { minValue: '0', maxValue: '100000000', unitEn: 'EGP', unitAr: 'جنيه' },
  options: [],
};

const GREEN_BUYER_TYPE_Q: SeedQuestion = {
  code: 'green_buyer_type',
  questionEn: 'Are you paying in instalments or in cash?',
  questionAr: 'هل تشتري بالتقسيط أم نقدًا؟',
  isRequired: false,
  options: [
    // Codes stated rather than slugged: they are the `pickByFact` branches a bank's second
    // column is keyed by, and a reworded label must not move a column.
    { code: 'instalment_buyer', labelEn: 'Paying in instalments', labelAr: 'بالتقسيط' },
    { code: 'cash_buyer', labelEn: 'Paying cash', labelAr: 'نقدًا' },
  ],
};

const DOWN_PAYMENT_Q: SeedQuestion = {
  code: 'down_payment',
  questionEn: 'How much money can you pay up front?',
  questionAr: 'ما حجم الدفعة المقدمة المتاحة لديك؟',
  options: DOWN_PAYMENT_OPTIONS,
};

// The questions below are asked for MORE THAN ONE category and are therefore
// authored ONCE and referenced from each config. Inlining them per category let
// the same code drift apart in wording — and since the merge keeps
// FIRST-SEEN content, the drift was silent: whichever config came first won.
const JOB_TENURE_Q: SeedQuestion = {
  code: 'job_tenure', questionEn: 'How long have you been in this job?', questionAr: 'منذ متى وأنت في وظيفتك الحالية؟',
  options: [
    { code: 'less_than_6_months', labelEn: 'Less than 6 months', labelAr: 'أقل من 6 أشهر' },
    { code: '6_months_to_1_year', labelEn: '6 months to 1 year', labelAr: 'من 6 أشهر إلى سنة' },
    { code: '1_to_3_years', labelEn: '1 to 3 years', labelAr: 'من 1 إلى 3 سنوات' },
    { code: 'more_than_3_years', labelEn: 'More than 3 years', labelAr: 'أكثر من 3 سنوات' },
  ],
};

// ── Feature 011 — the surrogate-income FACTS ────────────────────────────────
//
// Three questions the income-surrogate rules read (FR-016 … FR-018). Before them,
// six of the ten methods could be configured perfectly and still resolve to nothing
// for every customer alive, because no question ever asked the fact they look up.
//
// **The English labels are LOAD-BEARING.** `slug.util.ts` derives a question's
// immutable `code` from its English label and A33 forbids hand-typing codes, so each
// label is chosen such that its slug IS the binding constant in
// `matching/pipeline/surrogate-fact-bindings.ts`. "Your military grade" would slug to
// `your_military_grade`, the fact would silently never bind, and only a publish
// warning would say so. `test/unit/surrogate-binding-codes.spec.ts` asserts the
// equality rather than trusting it.
//
// These are the questions behind the NO-PAYSLIP basis. There is no no-payslip CATEGORY to
// assign them to (v16.0.0): whether a bank reads a payslip or works an income out from one
// of these facts is that program's own `programType`, not the product the customer picked.
//
// Which categories reference them here IS the configuration of where no-payslip programs
// can be sold — a category whose applicants are never asked any of the four cannot have a
// working one, and nothing else in the codebase asserts a list. `personal` and `car` are
// the seeded DEFAULT, not a rule: assigning `military_grade` to `mortgage` on the admin
// questionnaire screen is all it takes to sell no-payslip mortgages, and the seed must not
// be re-run to allow it.
//
// Assignment lives ONLY in `question_loan_category`, never a `category` column (A33,
// v12.0.0), and happens by which CategoryConfig references the question below. Publish
// warns only when a fact is asked by NO category at all (`not_asked_by_any_category`) —
// then no program anywhere could read it.
//
// **Both selects share ONE gate**, and that is an accepted limit rather than an
// oversight: `enabledWhen` holds a single `optionCode` (not a list) and
// `EMPLOYMENT_OPTIONS` has no option separating a soldier from a professor. So a
// government employee is asked both and skips the one that does not apply — which
// FR-020 already defines as a stated reason, never a zero. Splitting
// `government_employee` into military / academic / civil would ripple into every
// category's employment scoring and three other questionnaires for a cosmetic gain
// (research R11).
//
// None is REQUIRED. A required fact question would block apply for every applicant
// the fact does not describe, which is the opposite of what these are for.

const MILITARY_GRADE_Q: SeedQuestion = {
  // = slugify('Military grade') = the `military_grade` binding constant.
  code: 'military_grade',
  questionEn: 'Military grade',
  questionAr: 'الرتبة العسكرية',
  helperTextEn: 'Some banks set an assumed income from your grade. Skip this if it does not apply.',
  helperTextAr: 'بعض البنوك تحدد دخلًا مفترضًا حسب رتبتك. تجاوز هذا السؤال إن لم ينطبق عليك.',
  isRequired: false,
  enabledWhen: {
    questionCode: 'employment_status',
    operator: 'equals',
    optionCode: 'government_employee',
  },
  // Option codes ARE the active `military_grade` registry keys, generated rather
  // than hand-typed (FR-017, research R3). That makes the admin's table keys and the
  // customer's answers ONE list by construction, so a rename shows up on the other
  // side as a publish warning instead of a silent non-match. Matching by LABEL could
  // never work: there are two of them, ar and en.
  optionsFromEnum: 'military_grade',
  options: [],
};

const ACADEMIC_RANK_Q: SeedQuestion = {
  // = slugify('Academic rank') = the `academic_rank` binding constant. The REGISTRY
  // is called `professor_rank`; the QUESTION is not, because a lecturer is not a
  // professor and would not answer a question that says so.
  code: 'academic_rank',
  questionEn: 'Academic rank',
  questionAr: 'الدرجة العلمية',
  helperTextEn: 'Some banks set an assumed income from your rank. Skip this if it does not apply.',
  helperTextAr: 'بعض البنوك تحدد دخلًا مفترضًا حسب درجتك العلمية. تجاوز هذا السؤال إن لم ينطبق عليك.',
  isRequired: false,
  // UNGATED, unlike the military grade above, and the difference is not a preference.
  //
  // It used to carry `enabledWhen: employment_status = government_employee`, copied from
  // the grade question. That is right for a grade — the armed forces are the state, so an
  // officer answers `government_employee` or is answering wrongly — and it is wrong here:
  // a professor at a PRIVATE university is not a government employee, answers
  // `private_sector_employee`, is salaried, passes `ABK-PER-PROFESSORS`'s
  // `acceptedEmploymentTypes` — and was never shown the one question that product reads,
  // while the product's second column (`uni_government` / `uni_private`) exists precisely
  // to price them differently. `enabledWhen` carries ONE option code, so "government or
  // private employee" cannot be expressed as a gate; the honest gate is none.
  //
  // The cost is one more optional question for every personal and car applicant, which is
  // the posture `years_in_practice` below already takes with the same helper sentence.
  optionsFromEnum: 'professor_rank',
  options: [],
};

const YEARS_IN_PRACTICE_Q: SeedQuestion = {
  // = slugify('Years in practice') = the `years_in_practice` binding constant.
  code: 'years_in_practice',
  type: 'NUMERIC',
  questionEn: 'Years in practice',
  questionAr: 'سنوات الممارسة',
  helperTextEn: 'How long you have practised your profession, if you have one.',
  helperTextAr: 'عدد سنوات ممارستك لمهنتك، إن كانت لديك مهنة.',
  isRequired: false,
  // UNGATED: this population spans `freelancer` and `business_owner_company_owner`,
  // and one `enabledWhen` cannot express two options. Optional, so an applicant it
  // does not describe simply leaves it blank.
  numeric: { minValue: '0', maxValue: '60', step: '1', unitEn: 'years', unitAr: 'سنة' },
  options: [],
};

// Where the applicant WORKS, which is not where the property is.
//
// A SEPARATE question from the mortgage `governorate`, deliberately, and the two reasons are
// both structural. (1) `mergeSeedPool` takes a question's `groupCode` from the FIRST config
// that names it, so referencing `governorate` here would move it out of the mortgage
// `property_financing` step for mortgage applicants too. (2) `isRequired` is ONE global
// column, so requiring it here would require it of a mortgage applicant — and for a doctor
// buying a flat in Cairo with a clinic in Giza, one answer cannot be true of both.
//
// REQUIRED, on the operator's call: ABK's clinic-owner cap is keyed by the city tier, and an
// unanswered fact means `onNoMatch` — which is the programme maximum, i.e. the best cell in
// the table for everyone who skipped. The cost is that every Personal and Auto applicant
// answers it, not only doctors; there is no per-product required flag.
const PRACTICE_GOVERNORATE_Q: SeedQuestion = {
  code: 'practice_governorate',
  questionEn: 'Which governorate do you work in?',
  questionAr: 'في أي محافظة تعمل؟',
  helperTextEn: 'The governorate your clinic, practice or workplace is in.',
  helperTextAr: 'المحافظة التي تقع بها عيادتك أو مقر عملك.',
  // Stated rather than left to the `default true`: this flag decides whether an application
  // is refused, and it is the one thing on this question somebody will come looking for.
  isRequired: true,
  // Options expanded from the active `governorate` platform-enumeration members, so the
  // option codes ARE the registry keys and `factParentTable` can walk one up to its tier.
  optionsFromEnum: 'governorate',
  options: [],
};

// ── SHEET CONDITIONS — the answers a bank's own rule refuses on ───────────
//
// Each of these exists because a bank's sheet states a condition the platform had no field
// for, so it lived in the programme's `notes` and was enforced against nobody.
//
// EVERY one is REQUIRED and carries an explicit "does not apply to me" option, and that
// PAIRING is the design — not a style choice, and not safe to relax to `isRequired: false`
// in a later edit. A condition is switched on per PROGRAMME and never per applicant
// (`isGateConfigured`), gates AND together, and an unanswered fact behind a live gate is
// FATAL: `choiceFact` answers `fact_not_answered` and `evaluateProductRule` returns before
// the gate's pass/fail is ever computed. So the two obvious shapes are both wrong:
//
//   · OPTIONAL — whoever skips is refused with a missing-answer reason, on a question they
//     may have had no business answering. That is verbatim the defect that retired
//     `owns_practice` below; read its note before touching any of these.
//   · GATED to the population the CONDITION is about — worse. All five SCB down-payment
//     programmes accept EVERY employment type while "24 months in business" applies only to
//     the self-employed, so a gate would hide the question from a salaried applicant the
//     programme still quotes, and then refuse them for not having answered it.
//
// So the exemption lives in the ANSWER, where the engine can read it: the exempting option
// code sits in the condition's own `oneOf` allow-list, a non-applicant passes in one tap,
// and nobody is refused over a question that was never theirs.
//
// They are BUCKETS rather than numbers for the same reason — a NUMERIC question has no
// option list, so it has nowhere to put "does not apply to me". The threshold then lives in
// which codes a bank allow-lists, which is per programme, so a second bank with a different
// floor states a different allow-list instead of needing a new question.

// App. A — every Suez Canal auto sheet requires 24 months of trading from a self-employed
// applicant, and App. B's CAE compound sheet says the same. Three live buckets rather than
// two, so a bank with a 12-month floor allow-lists one more code instead of asking again.
const BUSINESS_MONTHS_Q: SeedQuestion = {
  code: 'business_months',
  questionEn: 'How long has your business been running?',
  questionAr: 'منذ متى بدأ نشاطك التجاري؟',
  helperTextEn: 'Some banks lend against a business only after it has been trading a while.',
  helperTextAr: 'بعض البنوك تمنح التمويل للنشاط التجاري بعد مرور مدة على بدء نشاطه.',
  isRequired: true,
  options: [
    { code: 'under_12m', labelEn: 'Less than a year', labelAr: 'أقل من سنة' },
    { code: '12m_to_24m', labelEn: 'One to two years', labelAr: 'من سنة إلى سنتين' },
    { code: '24m_or_more', labelEn: 'More than two years', labelAr: 'أكثر من سنتين' },
    { code: 'not_self_employed', labelEn: 'I do not run a business', labelAr: 'ليس لدي نشاط تجاري' },
  ],
};

// The same sheets require BOTH documents. The option says both, because a bank that accepts
// one of them states its own allow-list rather than needing the question re-worded.
const SELF_EMPLOYED_LICENCE_Q: SeedQuestion = {
  code: 'self_employed_licence',
  questionEn: 'Do you have a valid commercial register and tax card?',
  questionAr: 'هل لديك سجل تجاري وبطاقة ضريبية ساريان؟',
  isRequired: true,
  options: [
    { code: 'yes', labelEn: 'Yes, both', labelAr: 'نعم، الاثنان' },
    { code: 'no', labelEn: 'No, or only one of them', labelAr: 'لا، أو أحدهما فقط' },
    { code: 'not_self_employed', labelEn: 'I do not run a business', labelAr: 'ليس لدي نشاط تجاري' },
  ],
};

// App. A §8 — ABK's in-practice doctor programme is "private hospitals only, not
// governmental", and `employment_status` is no proxy for it: a government-hospital doctor is
// salaried and passes that programme's accepted types today.
//
// The third option is the exemption, and it is what makes the question askable of every
// personal and auto applicant: a taxi driver answers it once and no condition can refuse
// them, because the programme's own bands already price only doctors.
const HOSPITAL_SECTOR_Q: SeedQuestion = {
  code: 'hospital_sector',
  questionEn: 'Do you work at a private hospital or a government one?',
  questionAr: 'هل تعمل في مستشفى خاص أم حكومي؟',
  isRequired: true,
  options: [
    { code: 'private_hospital', labelEn: 'A private hospital', labelAr: 'مستشفى خاص' },
    { code: 'government_hospital', labelEn: 'A government hospital', labelAr: 'مستشفى حكومي' },
    { code: 'not_at_a_hospital', labelEn: 'I do not work at a hospital', labelAr: 'لا أعمل في مستشفى' },
  ],
};

// App. A — the 20% down-payment tier is sold only where the home the applicant LIVES in is
// owned by them or by a first-degree relative. Asked of every auto applicant, because
// everybody lives somewhere: all three answers are real and `rented_or_other` is the honest
// no, so this one needs no separate exemption.
const HOME_OWNERSHIP_Q: SeedQuestion = {
  code: 'home_ownership',
  questionEn: 'Do you own the home you live in, or does a close relative?',
  questionAr: 'هل تملك المنزل الذي تسكنه، أو يملكه أحد أقاربك من الدرجة الأولى؟',
  isRequired: true,
  options: [
    { code: 'owned_by_me', labelEn: 'I own it', labelAr: 'أملكه' },
    { code: 'owned_by_relative', labelEn: 'A close relative owns it', labelAr: 'يملكه قريب من الدرجة الأولى' },
    { code: 'rented_or_other', labelEn: 'Rented, or neither', labelAr: 'مستأجر، أو غير ذلك' },
  ],
};

// App. A — both Green Finance programmes are sold only to the owner of a DELIVERED unit in a
// compound the bank has pre-approved. `no_unit` is the exemption for the auto applicant who
// owns no unit at all.
const UNIT_APPROVED_COMPOUND_Q: SeedQuestion = {
  code: 'unit_approved_compound',
  questionEn: 'Is your home in a finished, bank-approved compound?',
  questionAr: 'هل منزلك في كومباوند مكتمل ومعتمد من البنك؟',
  helperTextEn: 'Finished and handed over, in a compound the bank already finances.',
  helperTextAr: 'مكتمل ومستلم، وفي كومباوند يموّله البنك بالفعل.',
  isRequired: true,
  options: [
    { code: 'yes', labelEn: 'Yes', labelAr: 'نعم' },
    { code: 'no', labelEn: 'No, or I am not sure', labelAr: 'لا، أو غير متأكد' },
    { code: 'no_unit', labelEn: 'I do not own a unit', labelAr: 'لا أملك وحدة' },
  ],
};

// ── GATE SOURCES ──────────────────────────────────────────────────────────
//
// These two carry no fact and no condition. Each exists so a question already in the pool
// can be gated on it, which is the only way to stop that question being asked of applicants
// it was never about. Both live in `COLLATERAL_GATES_GROUP`, whose questions sit at
// `displayOrder` 24-26 while every question they gate is at 47+ — checked against the
// database, because `assertEnabledWhenValid` refuses a forward reference and `displayOrder`
// is this pool's array index.
//
// REQUIRED, and they pay for themselves: one tap hides EIGHT compound questions from an
// applicant who owns no unit, one of which is itself required today.
const OWNS_COMPOUND_UNIT_Q: SeedQuestion = {
  code: 'owns_compound_unit',
  questionEn: 'Do you own a unit in a compound?',
  questionAr: 'هل تملك وحدة في كومباوند؟',
  isRequired: true,
  options: YESNO(),
};

const CLUB_MEMBERSHIP_Q: SeedQuestion = {
  code: 'club_membership',
  questionEn: 'Are you a member of a sporting club?',
  questionAr: 'هل أنت عضو في نادٍ رياضي؟',
  isRequired: true,
  options: YESNO(),
};

// `owns_practice` was here, and is retired.
//
// It existed for one job: ABK sells the same mechanism twice — App. A §7 to a doctor who owns
// his clinic and §8 to one employed at a private hospital, at half the income — and while both
// programmes filed under ONE catalog name nothing on the customer path said which was the
// applicant's, so both quoted every doctor and the bigger, wrong one ranked first. Two product
// conditions read this answer and each programme switched on the one it sold.
//
// v25.0.0 split them into two products, each with its own catalog name, so the applicant states
// which programme is theirs by picking it. The question became a second authority on one
// decision, and a harmful one: it was OPTIONAL while an unanswered gate fact is FATAL, so a
// doctor who skipped it was refused by both programmes.
//
// Removing it from this pool is what retires it — `seedQuestionnaire` deactivates every question
// it does not name. Deliberately NOT deleted: `application_answer.questionId` is `RESTRICT`, so
// a question a real customer has answered cannot be, and an archived snapshot still carries it.

// ── COLLATERAL PRODUCTS — the gate, then the pack ─────────────────────────
//
// A collateral product asks about a thing the applicant OWNS, not about their salary. No such
// product is seeded here any more — every one is built by an operator on
// `/surrogate-products/:key`, which writes its own list, question and fact — but the two rules
// that shape one are worth stating, because the screen follows them and a hand-written seed
// that broke them would publish a funnel nobody can walk:
//
//   1. **One cheap GATE in the funnel, required.** "Do you own a car?" is a single tap and it
//      is what decides whether the heavy questions are ever shown — and later, whether the
//      product's card is worth putting in front of this customer at all.
//
//   2. **The pack's questions are OPTIONAL and gated on the gate.** A group is one step in
//      the mobile wizard, and a group whose every question is hidden is dropped from the
//      snapshot entirely — so a non-owner never sees the step, and ten such products do not
//      make the funnel ten steps longer.
//
// None of the pack is REQUIRED, deliberately. A required question would block apply for a
// customer who started answering and changed their mind; skipping it instead leaves the
// program listed with a stated reason and no figures (FR-020), which is the behaviour the
// product asked for.
//
// A pack question reaches the engine because a `surrogate_fact` row is BOUND to it, so its
// answer lands in `ApplicantProfile.surrogateFacts` with no mapping code on either client.
// The binding lives on the FACT, never on the question (A33).

// Which banks the applicant already uses. ONE bank-agnostic question feeding a per-program
// answer: several banks lend more to a customer they already have (a "top-up" or cross-sell
// column), and that is a different answer at every bank. The engine derives it per program
// in `bank-relationship.ts` — this question cannot ask it directly without asking once per
// bank.
//
// MULTI_SELECT, so it is deliberately NOT bindable as a surrogate fact
// (`BINDABLE_QUESTION_TYPES`): a multi-pick has no single value to look up. It is read as a
// SET, which is the one thing a membership test needs.
const EXISTING_BANK_RELATIONSHIPS_Q: SeedQuestion = {
  code: 'existing_bank_relationships',
  type: 'MULTI_SELECT',
  questionEn: 'Which of these banks do you already use?',
  questionAr: 'أي من هذه البنوك تتعامل معه بالفعل؟',
  helperTextEn: 'Some banks offer their existing customers a higher limit.',
  helperTextAr: 'بعض البنوك تمنح عملاءها الحاليين حدًا أعلى.',
  isRequired: false,
  optionsFromBanks: true,
  options: [],
};

// The other two per-bank axes (spec §10.3). Same shape, same mechanism, DIFFERENT question:
// a customer who holds a card at a bank but has no loan there is an existing customer, is
// NOT a top-up, and IS a cross-sell — three answers one question cannot give.
//
// Both are optional and both fall to the bank's standard column when skipped, so adding them
// asks more of nobody: an applicant who answers neither is quoted exactly as before.
const EXISTING_BANK_LOANS_Q: SeedQuestion = {
  code: 'existing_bank_loans',
  type: 'MULTI_SELECT',
  questionEn: 'Do you already have a loan with any of these banks?',
  questionAr: 'هل لديك قرض قائم في أي من هذه البنوك؟',
  helperTextEn: 'Some banks lend more when they are topping up a loan they already gave you.',
  helperTextAr: 'بعض البنوك تمنح مبلغًا أكبر عند زيادة قرض سبق أن منحته لك.',
  isRequired: false,
  optionsFromBanks: true,
  options: [],
};

const EXISTING_BANK_PRODUCTS_Q: SeedQuestion = {
  code: 'existing_bank_products',
  type: 'MULTI_SELECT',
  questionEn: 'Do you hold a card or a deposit with any of these banks?',
  questionAr: 'هل لديك بطاقة أو وديعة في أي من هذه البنوك؟',
  helperTextEn: 'A bank may offer more to someone who already holds another product with it.',
  helperTextAr: 'قد يمنح البنك مبلغًا أكبر لمن لديه منتج آخر لديه بالفعل.',
  isRequired: false,
  optionsFromBanks: true,
  options: [],
};

/**
 * The gates — cheap, and the only part every applicant sees.
 *
 * Named for the collateral packs it was built to front. It now carries one question that is
 * not about collateral at all, and the code stays as it is on purpose: the code is what the
 * stored group row and every archived snapshot are keyed by, so renaming it would orphan both
 * to buy a better word.
 */
const COLLATERAL_GATES_GROUP: SeedGroup = {
  code: 'collateral_gates',
  titleEn: 'What you already own',
  titleAr: 'ما تملكه بالفعل',
  questions: [EXISTING_BANK_RELATIONSHIPS_Q, EXISTING_BANK_LOANS_Q, EXISTING_BANK_PRODUCTS_Q],
};

/**
 * The same group, plus whichever gate sources this loan type actually needs.
 *
 * A FUNCTION rather than one shared const, because the three bank axes belong to all three
 * loan types and the two gate sources do not: `owns_compound_unit` gates eight questions that
 * are personal-only, and `club_membership` gates one asked in personal and car. Referencing
 * them from a shared group would make each a REQUIRED question in a loan type where nothing
 * reads the answers it unlocks — the same defect this change removes from the compound asks,
 * one level up.
 *
 * `mergeSeedPool` dedupes groups by code and unions each question's categories, so all three
 * configs naming `collateral_gates` produce ONE group whose members carry exactly the
 * categories that referenced them.
 */
const collateralGatesGroup = (...gateSources: SeedQuestion[]): SeedGroup => ({
  ...COLLATERAL_GATES_GROUP,
  questions: [...COLLATERAL_GATES_GROUP.questions, ...gateSources],
});

const EMPLOYER_APPROVED_Q: SeedQuestion = {
  code: 'employer_approved',
  questionEn: "Is the place you work at on the banks' approved list?",
  questionAr: 'هل جهة عملك معتمدة لدى البنوك؟',
  isRequired: false,
  options: [
    { code: 'yes', labelEn: 'Yes', labelAr: 'نعم' },
    { code: 'no', labelEn: 'No', labelAr: 'لا' },
    { code: 'not_sure', labelEn: 'I am not sure', labelAr: 'غير متأكد' },
  ],
};

// Asks whether the salary lands at ONE bank, not which one — the options never
// carried a bank name and the registry owns the bank list.
const SALARY_BANK_Q: SeedQuestion = {
  code: 'salary_bank',
  questionEn: 'Do you always get your salary through the same bank?',
  questionAr: 'من خلال أي بنك تستلم راتبك؟',
  isRequired: false,
  options: [
    { code: 'a_specific_bank', labelEn: 'Yes, always the same bank', labelAr: 'بنك محدد' },
    { code: 'no_specific_bank', labelEn: 'No, not always the same bank', labelAr: 'لا يوجد بنك محدد' },
  ],
};

// Follow-up to `salary_bank`: asked ONLY when the applicant said the salary lands
// at one bank. Options come from the `bank` registry, so adding/retiring a bank
// there is the only edit needed (Principle II). It must be assigned to exactly
// the categories `salary_bank` is, or the branch source is unanswerable and the
// server shows the question unconditionally (`isQuestionVisible` never hides a
// dangling rule).
const SALARY_BANK_NAME_Q: SeedQuestion = {
  code: 'salary_bank_name',
  questionEn: 'Which bank do you receive your salary through?',
  questionAr: 'ما هو البنك الذي تستلم راتبك من خلاله؟',
  isRequired: false,
  enabledWhen: { questionCode: 'salary_bank', operator: 'equals', optionCode: 'a_specific_bank' },
  optionsFromBanks: true,
  options: [],
};

const ADDITIONAL_INCOME_Q: SeedQuestion = {
  code: 'additional_income', questionEn: 'Do you get money from anywhere else?', questionAr: 'هل لديك مصادر دخل إضافية؟',
  isRequired: false, options: YESNO(),
};

const ACTIVE_ACCOUNT_Q: SeedQuestion = {
  code: 'active_account', questionEn: 'Do you have a bank account you use?', questionAr: 'هل لديك حساب بنكي نشط؟',
  isRequired: false, options: YESNO(),
};

// `has_credit_card` + `card_usage` used to sit here. Both were removed: the
// commitments step already asks `current_loans` (a multi-select that carries a
// `credit_cards` option) and the credit-card LIMIT, off which the 5% monthly
// commitment is computed. Card presence and card cost were therefore asked
// three times, and the two option-based versions were the least precise.

const PRIOR_REJECTION_Q: SeedQuestion = {
  code: 'prior_rejection', questionEn: 'Has a bank ever said no to you?', questionAr: 'هل سبق رفض طلب تمويل لك؟',
  isRequired: false, options: YESNO(),
};

/**
 * ONE priority list for all four categories. The pool is global and dedupes by
 * code, so four per-category lists could only ever UNION into one question
 * anyway — and did, badly: eleven options that included both `fastest_approval`
 * ("The fastest answer") and business's `fast_approval` ("Fast Approval"), which
 * is the same choice offered twice. Authored once, the list is a deliberate
 * cross-category set instead of an accident of merge order.
 */
const PRIORITY_FACTOR_Q: SeedQuestion = {
  code: 'priority_factor', questionEn: 'What matters most to you?', questionAr: 'أهم عامل عند اختيار التمويل؟',
  isRequired: false,
  options: [
    { code: 'lowest_monthly_installment', labelEn: 'The smallest payment each month', labelAr: 'أقل قسط شهري' },
    { code: 'lowest_interest_rate', labelEn: 'The lowest interest', labelAr: 'أقل سعر فائدة' },
    { code: 'lowest_down_payment', labelEn: 'The smallest amount up front', labelAr: 'أقل دفعة مقدمة' },
    { code: 'longest_repayment_period', labelEn: 'The longest time to pay', labelAr: 'أطول مدة سداد' },
    { code: 'highest_financing_amount', labelEn: 'The biggest amount', labelAr: 'أعلى مبلغ تمويل' },
    { code: 'fastest_approval', labelEn: 'The fastest answer', labelAr: 'أسرع موافقة' },
    { code: 'least_documentation_required', labelEn: 'The fewest papers', labelAr: 'أقل أوراق مطلوبة' },
    { code: 'flexible_repayment', labelEn: 'Easy ways to pay it back', labelAr: 'سداد مرن' },
  ],
};

const NEEDS_CONSULTANT_Q: SeedQuestion = {
  code: 'needs_consultant', questionEn: 'Do you want help from a loan expert?', questionAr: 'هل تحتاج مساعدة مستشار تمويل؟',
  isRequired: false, options: YESNO(),
};

// ── Feature 010: the four bound money questions ─────────────────────────────
// These carry the real figures the engine prices on. Until now the app mapped a
// bucket answer to a representative midpoint, so a customer asking for 500 000
// was quoted on 300 000. The codes are the ones `MONEY_FIELD_BINDINGS` names —
// the binding lives in code, never on the question (A33).
//
// They are NUMERIC and therefore NOT scoreable (R9): only single choice carries
// answer scores, so these are excluded from every program's weight set below.
/**
 * The credit-bureau score — asked of everyone, answered by whoever wants to.
 *
 * A NUMBER, not a named band, and that is a decision about the FUTURE rather than about the
 * form: today the customer types it, and a real bureau feed will one day send it. Same
 * question, same fact, same bank tables — only the source changes. Stored as a band, every
 * one of those would have to be rewritten.
 *
 * OPTIONAL, and the whole I-Score mechanism is built around that being safe. A bank's
 * multiplier table falls back to 100% when there is no answer, which the compiled rule gets
 * from `RuleStep.optional` — without it one skipped question would stop every quote for the
 * product. `product-template.ts#emitIScore` is where that is guaranteed.
 *
 * ALL FOUR CATEGORIES: a bureau score is a property of the person, not of the loan.
 */
const I_SCORE_QUESTION: { groupCode: string; question: SeedQuestion; categories: readonly Category[] } = {
  groupCode: 'commitments',
  categories: ['personal', 'mortgage', 'car', 'business'],
  question: {
    code: I_SCORE_FACT_KEY,
    type: 'NUMERIC',
    questionEn: 'Your I-Score, if you know it',
    questionAr: 'درجة الآي سكور، إن كنت تعرفها',
    helperTextEn: 'Leave it blank if you would rather not say. It will not count against you.',
    helperTextAr: 'اتركها فارغة إن كنت تفضل عدم ذكرها. لن تُحسب ضدك.',
    isRequired: false,
    // The published Egyptian I-Score range. Bounds are CONTENT — what a person can
    // legitimately type — never scoring (A33).
    numeric: { minValue: '300', maxValue: '900', step: '1' },
    options: [],
  },
};

/**
 * The sources of income a bank may count BESIDE the basic figure, each as its own amount.
 *
 * Four questions and not one, because the bank weighs them differently: one live sheet counts
 * rent at 50%, certificate returns at 75%, fixed allowances at 100% and variable ones at 75%.
 * A single "other income" amount cannot carry four weights, and asking for the weighted total
 * would ask the customer to apply a policy they have never seen.
 *
 * All four are OPTIONAL and gated on the existing yes/no `additional_income`, so an applicant
 * who has none is asked nothing more than they are today. An unanswered source contributes
 * zero and never a refusal (`additional-income.ts`).
 *
 * ALL FOUR CATEGORIES, like the bureau score: rent is a property of the person, not the loan.
 */
const ADDITIONAL_INCOME_SOURCES: ReadonlyArray<{ key: string; question: SeedQuestion }> = [
  {
    key: 'rental_income_monthly',
    question: {
      code: 'rental_income_monthly',
      type: 'NUMERIC',
      questionEn: 'How much rent do you collect each month?',
      questionAr: 'كم إيجارًا تحصّل شهريًا؟',
      helperTextEn: 'From property you own and rent out.',
      helperTextAr: 'من عقار تملكه وتؤجّره.',
      isRequired: false,
      enabledWhen: { questionCode: 'additional_income', operator: 'equals', optionCode: 'yes' },
      numeric: { minValue: '0', maxValue: '5000000', step: '100', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
  {
    key: 'cd_returns_monthly',
    question: {
      code: 'cd_returns_monthly',
      type: 'NUMERIC',
      questionEn: 'How much do your certificates or deposits pay you each month?',
      questionAr: 'كم تدرّ عليك الشهادات أو الودائع شهريًا؟',
      isRequired: false,
      enabledWhen: { questionCode: 'additional_income', operator: 'equals', optionCode: 'yes' },
      numeric: { minValue: '0', maxValue: '5000000', step: '100', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
  {
    key: 'fixed_allowances_monthly',
    question: {
      code: 'fixed_allowances_monthly',
      type: 'NUMERIC',
      questionEn: 'How much do you get in fixed allowances each month?',
      questionAr: 'كم تتقاضى من بدلات ثابتة شهريًا؟',
      helperTextEn: 'Allowances that are the same every month.',
      helperTextAr: 'البدلات التي لا يتغير مقدارها شهريًا.',
      isRequired: false,
      enabledWhen: { questionCode: 'additional_income', operator: 'equals', optionCode: 'yes' },
      numeric: { minValue: '0', maxValue: '5000000', step: '100', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
  {
    key: 'variable_allowances_monthly',
    question: {
      code: 'variable_allowances_monthly',
      type: 'NUMERIC',
      questionEn: 'How much do you get in allowances that change month to month?',
      questionAr: 'كم تتقاضى من بدلات متغيرة شهريًا؟',
      helperTextEn: 'Overtime, commission, and anything else that varies. Give a typical month.',
      helperTextAr: 'العمل الإضافي والعمولات وما يتغير. اذكر متوسط شهر معتاد.',
      isRequired: false,
      enabledWhen: { questionCode: 'additional_income', operator: 'equals', optionCode: 'yes' },
      numeric: { minValue: '0', maxValue: '5000000', step: '100', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
];

const ADDITIONAL_INCOME_CATEGORIES: readonly Category[] = ['personal', 'mortgage', 'car', 'business'];

/** The group that already asks whether there IS other money — the amounts follow it. */
const ADDITIONAL_INCOME_Q_GROUP = 'employment_income';

const MONEY_QUESTIONS: ReadonlyArray<{ groupCode: string; question: SeedQuestion; categories: readonly Category[] }> = [
  {
    groupCode: 'financing_info',
    categories: ['personal', 'mortgage', 'car', 'business'],
    question: {
      code: MONEY_FIELD_BINDINGS.requested_amount, // amount_requested
      type: 'NUMERIC',
      questionEn: 'How much do you need?',
      questionAr: 'ما المبلغ الذي تحتاجه؟',
      numeric: { minValue: '1000', maxValue: '20000000', step: '1000', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
  {
    groupCode: 'financing_info',
    categories: ['personal', 'mortgage', 'car', 'business'],
    question: {
      code: MONEY_FIELD_BINDINGS.tenor_months, // repayment_period_months
      type: 'NUMERIC',
      questionEn: 'Over how many months do you want to pay it back?',
      questionAr: 'على كم شهر تريد السداد؟',
      numeric: { minValue: '6', maxValue: '120', step: '6', unitEn: 'months', unitAr: 'شهر' },
      options: [],
    },
  },
  {
    groupCode: 'employment_income',
    categories: ['personal', 'mortgage', 'car', 'business'],
    question: {
      code: MONEY_FIELD_BINDINGS.monthly_income, // monthly_income
      type: 'NUMERIC',
      // Wording has to hold for a salaried applicant AND a business owner: this
      // one question is what the business bucket `monthly_revenue` was replaced
      // with, and it feeds the DBR for every category.
      questionEn: 'How much money comes in each month?',
      questionAr: 'ما إجمالي الدخل الشهري؟',
      numeric: { minValue: '1000', maxValue: '5000000', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
  {
    groupCode: 'commitments',
    categories: ['personal', 'mortgage', 'car', 'business'],
    question: {
      code: MONEY_FIELD_BINDINGS.existing_obligations, // current_installments
      type: 'NUMERIC',
      // The TOTAL, and it is DERIVED — summed from the per-debt answers below,
      // not recalled by the applicant. Kept as a real asked question for two
      // reasons: it stays the single bound money figure the engine reads, and it
      // stays the single SCORED obligations question (a total is the only
      // meaningful thing to band — see the assignment filter further down).
      // Zero is legitimate ("I have none"), hence minValue 0.
      //
      // "Commitments", not "payments": the credit-card part of this sum is 5% of
      // a LIMIT, not a payment anyone makes, so the old label would have named the
      // figure something it is not the moment a card is ticked.
      questionEn: 'Your total monthly commitments',
      questionAr: 'إجمالي التزاماتك الشهرية',
      helperTextEn: 'Credit cards count as 5% of your total credit limit.',
      helperTextAr: 'تحتسب البطاقات الائتمانية بنسبة 5% من إجمالي حدك الائتماني.',
      numeric: { minValue: '0', maxValue: '5000000', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
];

/**
 * Itemised obligations — one NUMERIC amount question per debt TYPE, each unlocked
 * by `enabledWhen` against a pick on the pool's EXISTING debt-type multi-select
 * (`current_loans` / `DEBT_TYPES_QUESTION_CODE` — "Do you pay back any loans right
 * now?", authored above as `CURRENT_LOANS_Q`).
 *
 * Reusing that question rather than authoring a second one is deliberate: it
 * already asks precisely this, with precisely these option codes, so a new
 * multi-select would put the same question in front of the applicant twice.
 * Its `none` option is `DEBT_TYPE_NONE_OPTION`, so "no debts" is already a STATED
 * answer — which is what lets obligations resolve to a real `0` instead of "no
 * figures" (an empty multi-select is indistinguishable from an unanswered one).
 *
 * This is why the flow needs no new question type: the branching engine already
 * matches an option code against a multi-pick answer
 * (`question-visibility.ts`), and each amount lands in its own
 * `ApplicationAnswer` row under its own code, so the one-answer-per-question
 * constraint holds untouched.
 *
 * Ordered deliberately: the branch source must have a strictly lower
 * `displayOrder` than every question it guards (`assertEnabledWhenValid`), and
 * the derived total must come last so the applicant sees it settle after the
 * parts. The injection below enforces that ordering explicitly.
 */
/**
 * The three details of an EXISTING car loan that the ABK auto cross-sell prices against.
 *
 * Gated on the same `current_loans = car_loan` pick as the instalment amount, and that gate
 * is safe where the sheet-condition questions above could not be gated: the product itself
 * reads `car_loan_installment` and `auto_loan_amount`, both behind this same gate, so an
 * applicant it hides the question from cannot be quoted by the programme at all. Nobody is
 * refused for an answer they were never asked for.
 *
 * NOT obligation items — nothing here is a monthly payment and none of it reaches the debt
 * burden. They ride the same injection loop only because they share the gate, and they are
 * listed separately so `OBLIGATION_ITEM_QUESTION_CODES` keeps meaning "a debt we subtract".
 */
const CAR_LOAN_DETAIL_QUESTION_CODES = [
  'car_loan_original_tenor',
  'car_loan_instalments_paid',
  'car_loan_down_payment',
] as const;

const OBLIGATION_QUESTIONS: ReadonlyArray<{
  groupCode: string;
  question: SeedQuestion;
  categories: readonly Category[];
}> = [
  ...(
    [
      {
        debtType: 'car_loan',
        questionEn: 'How much is your car loan each month?',
        questionAr: 'كم قسط سيارتك شهريًا؟',
      },
      {
        // The one entry that does NOT ask for an instalment. A card has no fixed
        // monthly payment and an undrawn limit is money that can be drawn
        // tomorrow, so the limit — summed across EVERY card the applicant holds,
        // at every bank — is what the burden is derived from
        // (`CREDIT_CARD_LIMIT_MONTHLY_PERCENT`). Both the question and the helper
        // say "all", because a customer holding a CIB and a QNB card will
        // otherwise state one of them.
        debtType: 'credit_cards',
        questionEn: 'What is the total credit limit of ALL your credit cards?',
        questionAr: 'ما إجمالي الحد الائتماني لجميع بطاقاتك الائتمانية؟',
        helperTextEn:
          'Add up the limit on every card you hold, at every bank — not what you owe. '
          + 'Example: a 100,000 card at CIB plus a 50,000 card at QNB is 150,000. '
          + 'Banks count 5% of this total as a monthly commitment.',
        helperTextAr:
          'اجمع الحد الائتماني لكل بطاقة لديك في كل البنوك — وليس المبلغ المستخدم. '
          + 'مثال: بطاقة بحد 100,000 في CIB مع بطاقة بحد 50,000 في QNB تساوي 150,000. '
          + 'تحتسب البنوك 5% من هذا الإجمالي كالتزام شهري.',
        // A limit is an order of magnitude above an instalment, so it needs its
        // own ceiling: 5 000 000 of instalment is absurd, 5 000 000 of card limit
        // across a portfolio is not.
        maxValue: '20000000',
      },
      {
        debtType: 'personal_loan',
        questionEn: 'How much is your personal loan each month?',
        questionAr: 'كم قسط قرضك الشخصي شهريًا؟',
      },
      {
        debtType: 'mortgage',
        questionEn: 'How much is your mortgage each month?',
        questionAr: 'كم قسط قرضك العقاري شهريًا؟',
      },
      {
        debtType: 'other',
        questionEn: 'How much are your other payments each month?',
        questionAr: 'كم إجمالي التزاماتك الأخرى شهريًا؟',
      },
    ] as ReadonlyArray<{
      debtType: keyof typeof OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE;
      questionEn: string;
      questionAr: string;
      helperTextEn?: string;
      helperTextAr?: string;
      maxValue?: string;
    }>
  ).map(({ debtType, questionEn, questionAr, helperTextEn, helperTextAr, maxValue }) => ({
    groupCode: 'commitments',
    categories: ['personal', 'mortgage', 'car', 'business'] as readonly Category[],
    question: {
      code: OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE[debtType],
      type: 'NUMERIC' as QuestionType,
      questionEn,
      questionAr,
      helperTextEn,
      helperTextAr,
      // Required, so ticking a type and leaving the amount blank is already
      // blocked by the wizard's own `canAdvance` — no extra gate needed.
      isRequired: true,
      // minValue 0 because a card carried at a zero limit (or a loan at a zero
      // instalment) is real. That is exactly why `hasCurrentLoan` is derived from
      // the PICK, not the amount.
      numeric: { minValue: '0', maxValue: maxValue ?? '5000000', unitEn: 'EGP', unitAr: 'جنيه' },
      enabledWhen: {
        questionCode: DEBT_TYPES_QUESTION_CODE,
        operator: 'equals' as const,
        optionCode: debtType,
      },
      options: [],
    },
  })),
  // The car-loan details. Same gate, different job — see `CAR_LOAN_DETAIL_QUESTION_CODES`.
  // Order matters: the tenor comes before the count of instalments paid, because the sheet's
  // rule is "past half its tenor AND at least 12 paid" and the editor's own share condition
  // reads the tenor as its divisor.
  ...(
    [
      {
        code: 'car_loan_original_tenor',
        questionEn: 'Over how many months was the car loan taken?',
        questionAr: 'كم عدد أشهر قرض السيارة الأصلي؟',
        helperTextEn: 'The original term, not what is left to pay.',
        helperTextAr: 'المدة الأصلية للقرض، وليست المدة المتبقية.',
        numeric: { minValue: '6', maxValue: '120', step: '1', unitEn: 'months', unitAr: 'شهر' },
      },
      {
        code: 'car_loan_instalments_paid',
        questionEn: 'How many instalments have you already paid on it?',
        questionAr: 'كم قسطًا سددت منه بالفعل؟',
        numeric: { minValue: '0', maxValue: '120', step: '1', unitEn: 'months', unitAr: 'شهر' },
      },
      {
        code: 'car_loan_down_payment',
        questionEn: 'What did you pay up front on that car?',
        questionAr: 'كم دفعت مقدمًا عند شراء تلك السيارة؟',
        helperTextEn: 'The down payment when you bought it, not what you pay each month.',
        helperTextAr: 'الدفعة المقدمة عند الشراء، وليست القسط الشهري.',
        numeric: { minValue: '0', maxValue: '20000000', unitEn: 'EGP', unitAr: 'جنيه' },
      },
    ] as ReadonlyArray<{
      code: string;
      questionEn: string;
      questionAr: string;
      helperTextEn?: string;
      helperTextAr?: string;
      numeric: SeedNumericRules;
    }>
  ).map(({ code, questionEn, questionAr, helperTextEn, helperTextAr, numeric }) => ({
    groupCode: 'commitments',
    // Personal and car only. The cross-sell is a PERSONAL product; `car` carries it for the
    // same reason it carries every other surrogate fact (an auto loan may be sold off an
    // assumed income). The injection loop intersects this with whoever asks the branch
    // source anyway, so business is dropped there rather than needing to be remembered here.
    categories: ['personal', 'car'] as readonly Category[],
    question: {
      code,
      type: 'NUMERIC' as QuestionType,
      questionEn,
      questionAr,
      helperTextEn,
      helperTextAr,
      // Required, like the instalment beside it: the gate means only somebody who ticked
      // "car loan" is ever shown this, and for them it is not optional information.
      isRequired: true,
      numeric,
      enabledWhen: {
        questionCode: DEBT_TYPES_QUESTION_CODE,
        operator: 'equals' as const,
        optionCode: 'car_loan',
      },
      options: [],
    },
  })),
];

// The amount questions branch off `CURRENT_LOANS_Q`'s option codes, and those codes
// are join keys spread across two files. A rename or a dropped option on either
// side would not fail to compile — it would silently publish amount questions that
// can never become visible, and the applicant would be asked for a total with no
// parts to sum. So assert the two agree at seed time, before anything is written.
{
  const authored = new Set(CURRENT_LOANS_Q.options?.map((o) => o.code ?? slug(o.labelEn)) ?? []);
  const required = [...DEBT_TYPE_OPTION_CODES, DEBT_TYPE_NONE_OPTION];
  const missing = required.filter((code) => !authored.has(code));
  if (CURRENT_LOANS_Q.code !== DEBT_TYPES_QUESTION_CODE) {
    throw new Error(
      `seed-questionnaire: DEBT_TYPES_QUESTION_CODE is '${DEBT_TYPES_QUESTION_CODE}' but the ` +
        `authored debt-type question is '${CURRENT_LOANS_Q.code}'`,
    );
  }
  if (missing.length > 0) {
    throw new Error(
      `seed-questionnaire: '${DEBT_TYPES_QUESTION_CODE}' is missing option(s) ` +
        `${missing.join(', ')} required by OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE`,
    );
  }
}

/**
 * Bucket questions superseded by a MONEY_QUESTIONS entry. Three share the bound
 * code and are therefore REPLACED in place (same code, now NUMERIC, options
 * deactivated); the differently-named ones are dropped from the pool, which
 * deactivates them:
 *  - `repayment_period`   → `repayment_period_months`
 *  - `financing_amount`   → `amount_requested`  (business asked BOTH: one bucket
 *                            "how much does the business need" and the bound
 *                            NUMERIC amount, which is the same question twice)
 *  - `monthly_revenue`    → `monthly_income`    (same duplicate for income)
 * Answers already stored against any of them stay readable (FR-045), because the
 * admin answers view renders from the application's OWN frozen snapshot.
 */
const SUPERSEDED_BUCKET_CODES: ReadonlySet<string> = new Set([
  MONEY_FIELD_BINDINGS.requested_amount,
  MONEY_FIELD_BINDINGS.monthly_income,
  MONEY_FIELD_BINDINGS.existing_obligations,
  'repayment_period',
  'financing_amount',
  'monthly_revenue',
]);

// ── PERSONAL ────────────────────────────────────────────────────────────────
const PERSONAL: CategoryConfig = {
  category: 'personal',
  groups: [
    {
      // Titles here are read by EVERY category (the bound money questions live in
      // this group and in `employment_income` / `commitments`), so they must not
      // say "your loan" to a business owner or "the banks you owe" to someone
      // whose only entry is a single instalment figure.
      code: 'financing_info', titleEn: 'About the financing', titleAr: 'معلومات التمويل',
      questions: [
        {
          code: 'loan_purpose', questionEn: 'What will you use the money for?', questionAr: 'ما الغرض من القرض؟',
          isRequired: false,
          options: [
            // "Finishing" covers تشطيب — fitting out a bare-shell new build, which
            // is a purpose of its own here, not the same as renovating a lived-in home.
            { code: 'home_finishing_renovation', labelEn: 'Finishing or fixing up my home', labelAr: 'تشطيب / تجديد المنزل' },
            { code: 'marriage', labelEn: 'Getting married', labelAr: 'زواج' },
            { code: 'purchasing_appliances_or_furniture', labelEn: 'Buying furniture or appliances', labelAr: 'شراء أجهزة أو أثاث' },
            { code: 'education', labelEn: 'School or study', labelAr: 'تعليم' },
            { code: 'debt_consolidation_settling_obligations', labelEn: 'Paying off what I owe', labelAr: 'سداد التزامات' },
            { code: 'personal_project', labelEn: 'My own project', labelAr: 'مشروع شخصي' },
            { code: 'other', labelEn: 'Something else', labelAr: 'أخرى' },
          ],
        },
      ],
    },
    {
      code: 'employment_income', titleEn: 'Your work and income', titleAr: 'معلومات العمل والدخل',
      questions: [
        {
          code: 'employment_status', questionEn: 'What kind of work do you do?', questionAr: 'ما هي حالتك الوظيفية؟',
          options: EMPLOYMENT_OPTIONS,
        },
        JOB_TENURE_Q,
        SALARY_TRANSFER_Q,
        SALARY_BANK_Q,
        SALARY_BANK_NAME_Q,
        EMPLOYER_APPROVED_Q,
        ADDITIONAL_INCOME_Q,
        ACTIVE_ACCOUNT_Q,
        // Feature 011 — the surrogate facts. That reference is what assigns them to
        // the category in `question_loan_category` (A33 — assignment lives only
        // there), so a mortgage applicant is never asked their army rank. CAR carries
        // the same three, because an auto loan may also be sold with no payslip.
        // `credit_card_total_limit` is the FOURTH fact and is
        // deliberately NOT re-seeded: it already exists in `commitments` feeding the
        // 5% card-limit obligation, and a second copy would ask the same thing twice
        // (research R2).
        MILITARY_GRADE_Q,
        ACADEMIC_RANK_Q,
        YEARS_IN_PRACTICE_Q,
        // The doctors product reads these two as well: WHERE the applicant practises (its
        // second column and its maximum-loan table are both keyed by the city tier that
        // governorate is filed under) and WHETHER they own the practice (which of the two
        // ABK doctor programmes they are for). The reference IS the assignment.
        PRACTICE_GOVERNORATE_Q,
        // The sheet conditions. The reference IS the assignment (`question_loan_category`,
        // A33). Each is required and carries its own "does not apply to me" answer — see the
        // block header where they are declared before changing either.
        BUSINESS_MONTHS_Q,
        SELF_EMPLOYED_LICENCE_Q,
        HOSPITAL_SECTOR_Q,
      ],
    },
    // The reference here IS the assignment (`question_loan_category`, A33) — nothing else in
    // the codebase holds a list of which categories ask this, so widening it is an admin
    // action on the questionnaire screen, never a release.
    collateralGatesGroup(OWNS_COMPOUND_UNIT_Q, CLUB_MEMBERSHIP_Q),
    {
      code: 'commitments', titleEn: 'What you already pay each month', titleAr: 'الالتزامات الشهرية الحالية',
      questions: [CURRENT_LOANS_Q],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات والأهلية',
      questions: [
        PRIORITY_FACTOR_Q,
        PRIOR_REJECTION_Q,
        NEEDS_CONSULTANT_Q,
      ],
    },
  ],
};

// ── MORTGAGE ──────────────────────────────────────────────────────────────
const MORTGAGE: CategoryConfig = {
  category: 'mortgage',
  groups: [
    {
      code: 'property_financing', titleEn: 'About the home', titleAr: 'معلومات العقار والتمويل',
      questions: [
        {
          code: 'property_type', questionEn: 'What kind of place do you want to buy?', questionAr: 'ما نوع العقار الذي ترغب في تمويله؟', isRequired: false,
          options: [
            { code: 'apartment', labelEn: 'Apartment', labelAr: 'شقة' },
            { code: 'villa', labelEn: 'Villa', labelAr: 'فيلا' },
            { code: 'duplex', labelEn: 'Duplex', labelAr: 'دوبلكس' },
            { code: 'commercial_shop', labelEn: 'Shop', labelAr: 'محل تجاري' },
            { code: 'administrative_office', labelEn: 'Office', labelAr: 'مكتب إداري' },
            { code: 'other', labelEn: 'Something else', labelAr: 'أخرى' },
          ],
        },
        { code: 'in_compound', questionEn: 'Is the place inside a compound?', questionAr: 'هل العقار داخل كمبوند سكني؟', isRequired: false, options: YESNO() },
        {
          code: 'registration_status', questionEn: 'Is the property registered with the government?', questionAr: 'ما حالة تسجيل العقار؟', isRequired: false,
          options: [
            { code: 'officially_registered', labelEn: 'Yes, it is registered', labelAr: 'مسجل رسميًا' },
            { code: 'eligible_for_registration', labelEn: 'Not yet, but it can be', labelAr: 'قابل للتسجيل' },
            { code: 'not_registered', labelEn: 'No, it is not', labelAr: 'غير مسجل' },
            { code: 'not_sure', labelEn: 'I am not sure', labelAr: 'غير متأكد' },
          ],
        },
        {
          // Options expanded from the active `governorate` platform-enumeration members.
          code: 'governorate', questionEn: 'Which governorate is the place in?', questionAr: 'في أي محافظة يقع العقار؟', isRequired: false,
          optionsFromEnum: 'governorate', options: [],
        },
        {
          code: 'property_value', questionEn: 'About how much is the place worth?', questionAr: 'ما القيمة التقريبية للعقار؟',
          options: [
            { code: 'less_than_egp_1_million', labelEn: 'Less than 1 million EGP', labelAr: 'أقل من مليون جنيه' },
            { code: 'egp_1_3_million', labelEn: '1 – 3 million EGP', labelAr: '1 – 3 مليون جنيه' },
            { code: 'egp_3_5_million', labelEn: '3 – 5 million EGP', labelAr: '3 – 5 مليون جنيه' },
            { code: 'more_than_egp_5_million', labelEn: 'More than 5 million EGP', labelAr: 'أكثر من 5 مليون جنيه' },
          ],
        },
      ],
    },
    // Shared groups are referenced by CODE, never re-declared with a new code:
    // an `income_employment` of its own held only questions that dedupe into
    // PERSONAL's `employment_income`, so it published as an empty step and sat in
    // the pool as a group nobody is ever asked.
    {
      code: 'financing_info', titleEn: 'About the financing', titleAr: 'معلومات التمويل',
      questions: [DOWN_PAYMENT_Q],
    },
    {
      code: 'employment_income', titleEn: 'Your work and income', titleAr: 'معلومات العمل والدخل',
      questions: [
        { code: 'employment_status', questionEn: 'What kind of work do you do?', questionAr: 'ما هي حالتك الوظيفية؟', options: EMPLOYMENT_OPTIONS },
        JOB_TENURE_Q,
        SALARY_TRANSFER_Q,
        SALARY_BANK_Q,
        SALARY_BANK_NAME_Q,
        EMPLOYER_APPROVED_Q,
        ADDITIONAL_INCOME_Q,
        ACTIVE_ACCOUNT_Q,
        // NONE of the sheet conditions. Every product that reads them is sold as `personal`
        // (the CAE compound) or `car` (the seven Suez Canal auto programmes), so any of them
        // here would be a REQUIRED question no mortgage programme could ever read — which is
        // exactly the defect this change removes from the compound asks.
      ],
    },
    // The reference here IS the assignment (`question_loan_category`, A33) — nothing else in
    // the codebase holds a list of which categories ask this, so widening it is an admin
    // action on the questionnaire screen, never a release.
    COLLATERAL_GATES_GROUP,
    {
      code: 'commitments', titleEn: 'What you already pay each month', titleAr: 'الالتزامات الشهرية الحالية',
      questions: [CURRENT_LOANS_Q],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات',
      questions: [
        PRIORITY_FACTOR_Q,
        PRIOR_REJECTION_Q,
        { code: 'needs_assistance', questionEn: 'Do you want help getting your papers ready?', questionAr: 'هل تحتاج مساعدة في تجهيز المستندات؟', isRequired: false, options: YESNO() },
        NEEDS_CONSULTANT_Q,
      ],
    },
  ],
};

// ── CAR ──────────────────────────────────────────────────────────────────
const CAR: CategoryConfig = {
  category: 'car',
  groups: [
    {
      code: 'vehicle_financing', titleEn: 'About the car', titleAr: 'معلومات السيارة والتمويل',
      questions: [
        { code: 'vehicle_condition', questionEn: 'Is the car new or used?', questionAr: 'هل السيارة جديدة أم مستعملة؟', isRequired: false, options: [
          { code: 'new', labelEn: 'New', labelAr: 'جديدة' },
          { code: 'used', labelEn: 'Used', labelAr: 'مستعملة' },
        ] },
        {
          code: 'model_year', questionEn: "What is the car's model year?", questionAr: 'ما سنة موديل السيارة؟', isRequired: false,
          options: [
            { code: 'current_year_model', labelEn: 'This year model', labelAr: 'موديل السنة الحالية' },
            { code: 'within_the_last_3_years', labelEn: 'Up to 3 years old', labelAr: 'خلال آخر 3 سنوات' },
            { code: '3_to_5_years_old', labelEn: '3 to 5 years old', labelAr: 'من 3 إلى 5 سنوات' },
            { code: 'more_than_5_years_old', labelEn: 'More than 5 years old', labelAr: 'أكثر من 5 سنوات' },
          ],
        },
        CAR_PRICE_Q,
        // The Green Finance pair rides the car flow: a solar loan and an e-bike loan are both
        // sold under `car`, and both are quoted off what the applicant has saved.
        TOTAL_SAVINGS_Q,
        GREEN_BUYER_TYPE_Q,
        // Both Green programmes are sold only against a delivered unit in a pre-approved
        // compound, and the 20% down-payment tier only where the home is owned by the
        // applicant or a first-degree relative. Car only — no other loan type sells them.
        UNIT_APPROVED_COMPOUND_Q,
        HOME_OWNERSHIP_Q,
      ],
    },
    {
      // `down_payment` (the shared percentage bucket) is deliberately NOT here: a car
      // applicant states the amount, and the bucket stays a mortgage question.
      code: 'financing_info', titleEn: 'About the financing', titleAr: 'معلومات التمويل',
      questions: [CAR_DOWN_PAYMENT_Q],
    },
    {
      code: 'employment_income', titleEn: 'Your work and income', titleAr: 'معلومات العمل والدخل',
      questions: [
        { code: 'employment_status', questionEn: 'What kind of work do you do?', questionAr: 'ما هي حالتك الوظيفية؟', options: EMPLOYMENT_OPTIONS },
        JOB_TENURE_Q,
        SALARY_TRANSFER_Q,
        SALARY_BANK_Q,
        SALARY_BANK_NAME_Q,
        EMPLOYER_APPROVED_Q,
        ADDITIONAL_INCOME_Q,
        ACTIVE_ACCOUNT_Q,
        // The surrogate facts, same three references PERSONAL carries. An auto loan
        // is surrogate-CAPABLE (`SURROGATE_CAPABLE_CATEGORIES`): a bank may finance a
        // car off an assumed income worked out from a grade or years in practice, and
        // the fact question has to be ASKED for that table to fire at all — an
        // unasked fact resolves to `SURROGATE_FACT_MISSING`, never a zero (FR-020).
        // The reference IS the assignment (`question_loan_category`, A33); position is
        // cosmetic, since `displayOrder` comes from the global question order and
        // PERSONAL is merged first. `credit_card_total_limit` is the FOURTH fact and
        // needs no reference here: it rides the `commitments` obligation block below,
        // which CAR already asks.
        MILITARY_GRADE_Q,
        ACADEMIC_RANK_Q,
        YEARS_IN_PRACTICE_Q,
        // Same two the doctors product reads. CAR carries them for the reason it carries the
        // three above: an auto loan may be sold off an assumed income, and an unasked fact
        // resolves to `SURROGATE_FACT_MISSING`, never a zero.
        PRACTICE_GOVERNORATE_Q,
        // The sheet conditions. The reference IS the assignment (`question_loan_category`,
        // A33). Each is required and carries its own "does not apply to me" answer — see the
        // block header where they are declared before changing either.
        BUSINESS_MONTHS_Q,
        SELF_EMPLOYED_LICENCE_Q,
        HOSPITAL_SECTOR_Q,
      ],
    },
    collateralGatesGroup(CLUB_MEMBERSHIP_Q),
    {
      code: 'commitments', titleEn: 'What you already pay each month', titleAr: 'الالتزامات الشهرية الحالية',
      questions: [CURRENT_LOANS_Q],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات',
      questions: [
        PRIORITY_FACTOR_Q,
        PRIOR_REJECTION_Q,
        { code: 'wants_insurance', questionEn: 'Do you want car insurance offers?', questionAr: 'هل ترغب في عروض تأمين السيارة؟', isRequired: false, options: YESNO() },
        NEEDS_CONSULTANT_Q,
      ],
    },
  ],
};

// ── BUSINESS ────────────────────────────────────────────────────────────────
const BUSINESS: CategoryConfig = {
  category: 'business',
  groups: [
    {
      code: 'business_financing', titleEn: 'About your business', titleAr: 'معلومات النشاط والتمويل',
      questions: [
        {
          code: 'activity_type', questionEn: 'What kind of work does your business do?', questionAr: 'ما نوع النشاط التجاري الذي تديره؟', isRequired: false,
          options: [
            { code: 'trade', labelEn: 'Buying and selling', labelAr: 'تجارة' },
            { code: 'services', labelEn: 'Services', labelAr: 'خدمات' },
            { code: 'restaurants_cafes', labelEn: 'Food and coffee shops', labelAr: 'مطاعم وكافيهات' },
            { code: 'manufacturing', labelEn: 'Making or producing goods', labelAr: 'تصنيع' },
            { code: 'technology', labelEn: 'Technology', labelAr: 'تكنولوجيا' },
            { code: 'other', labelEn: 'Something else', labelAr: 'أخرى' },
          ],
        },
        {
          code: 'business_age', questionEn: 'How long has your business been open?', questionAr: 'منذ متى والنشاط يعمل؟',
          options: [
            { code: 'less_than_1_year', labelEn: 'Less than 1 year', labelAr: 'أقل من سنة' },
            { code: '1_to_2_years', labelEn: '1 to 2 years', labelAr: 'من 1 إلى 2 سنة' },
            { code: 'more_than_2_years', labelEn: 'More than 2 years', labelAr: 'أكثر من سنتين' },
          ],
        },
        {
          code: 'financing_purpose', questionEn: 'What will the business use the money for?', questionAr: 'ما الغرض الأساسي من التمويل؟', isRequired: false,
          options: [
            { code: 'expansion', labelEn: 'Growing the business', labelAr: 'توسع' },
            { code: 'purchasing_equipment', labelEn: 'Buying equipment', labelAr: 'شراء معدات' },
            { code: 'working_capital', labelEn: 'Day to day running costs', labelAr: 'رأس مال عامل' },
            { code: 'opening_a_new_branch', labelEn: 'Opening a new branch', labelAr: 'فتح فرع جديد' },
            { code: 'settling_obligations', labelEn: 'Paying off what we owe', labelAr: 'سداد التزامات' },
            { code: 'other', labelEn: 'Something else', labelAr: 'أخرى' },
          ],
        },
      ],
    },
    {
      // Declared with no questions of its own on purpose: `amount_requested` and
      // `repayment_period_months` are injected into this group for all four
      // categories below, and that injection throws if the group is not declared
      // here first. Nothing else business-specific belongs in it.
      code: 'financing_info', titleEn: 'About the financing', titleAr: 'معلومات التمويل',
      questions: [],
    },
    {
      code: 'financial_info', titleEn: 'Your business money', titleAr: 'المعلومات المالية',
      questions: [
        { code: 'business_account', questionEn: 'Do you have a bank account for the business?', questionAr: 'هل لديك حساب بنكي للنشاط؟', isRequired: false, options: YESNO() },
        { code: 'registered', questionEn: 'Is your business officially registered?', questionAr: 'هل النشاط مسجل رسميًا؟', isRequired: false, options: [
          { code: 'yes', labelEn: 'Yes', labelAr: 'نعم' },
          { code: 'no', labelEn: 'No', labelAr: 'لا' },
          { code: 'registration_in_progress', labelEn: 'We are registering it now', labelAr: 'التسجيل جارٍ' },
        ] },
        { code: 'tax_registration', questionEn: 'Do you have a tax card or commercial register?', questionAr: 'هل لديك سجل ضريبي أو تجاري؟', isRequired: false, options: YESNO() },
      ],
    },
    {
      code: 'obligations_credit', titleEn: 'Business loans you have', titleAr: 'الالتزامات والحالة الائتمانية',
      questions: [
        { code: 'current_facilities', questionEn: 'Does the business have any loans or credit right now?', questionAr: 'هل لدى النشاط تسهيلات أو قروض حالية؟', options: YESNO() },
      ],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات والدعم',
      questions: [
        PRIORITY_FACTOR_Q,
        PRIOR_REJECTION_Q,
        // `needs_consultation` was a second copy of `needs_consultant` with
        // "business" in the wording — two rows to tick, two rows to score, one
        // question. The shared one covers both.
        NEEDS_CONSULTANT_Q,
      ],
    },
  ],
};


const CONFIGS: CategoryConfig[] = [PERSONAL, MORTGAGE, CAR, BUSINESS];

interface MergedQuestion {
  code: string;
  groupCode: string;
  type: QuestionType;
  numeric?: SeedNumericRules;
  questionEn: string;
  questionAr: string;
  helperTextEn?: string;
  helperTextAr?: string;
  isRequired: boolean;
  enabledWhen?: SeedEnabledWhen;
  options: { code: string; labelEn: string; labelAr: string }[];
}

/** The merged pool: one global deduped question list, in publish order. */
export interface SeedPool {
  groupOrder: string[];
  groupByCode: Map<string, SeedGroup>;
  /** Pool display order. */
  questionOrder: string[];
  questionByCode: Map<string, MergedQuestion>;
  /** questionCode → the categories that ASK it (`question_loan_category`). */
  categoriesByQuestion: Record<string, Set<Category>>;
}

/**
 * Steps 1–1d: merge the four category configs into ONE global deduped pool.
 * Reads only (the bank + enumeration registries back some option lists); writes
 * nothing, so it is safe to call on its own.
 */
export async function mergeSeedPool(client: PrismaClient = prisma): Promise<SeedPool> {
  // Feature 010: questions carry no category. Groups + questions dedupe by code
  // (first config wins for content; option sets are UNIONed by code). Each
  // question remembers which categories it appeared in, so a program can be
  // pre-assigned exactly its own category's questions (the migration's rule).
  const groupOrder: string[] = [];
  const groupByCode = new Map<string, SeedGroup>();
  const questionOrder: string[] = [];
  const questionByCode = new Map<string, MergedQuestion>();
  const categoriesByQuestion: Record<string, Set<Category>> = {};

  for (const cfg of CONFIGS) {
    for (const g of cfg.groups) {
      if (!groupByCode.has(g.code)) {
        groupByCode.set(g.code, g);
        groupOrder.push(g.code);
      }
      for (const q of g.questions) {
        // Feature 010: a bucket question superseded by a bound NUMERIC question
        // never enters the pool. The four money figures come from real numbers.
        if (SUPERSEDED_BUCKET_CODES.has(q.code)) continue;
        (categoriesByQuestion[q.code] ??= new Set()).add(cfg.category);
        const optionList = q.optionsFromBanks
          ? await bankOptions(client)
          : q.optionsFromEnum
            ? await enumOptions(q.optionsFromEnum, client)
            : q.options;
        let mq = questionByCode.get(q.code);
        if (!mq) {
          mq = {
            code: q.code,
            groupCode: g.code,
            type: q.type ?? 'SINGLE_SELECT',
            ...(q.numeric ? { numeric: q.numeric } : {}),
            questionEn: q.questionEn,
            questionAr: q.questionAr,
            ...(q.helperTextEn ? { helperTextEn: q.helperTextEn } : {}),
            ...(q.helperTextAr ? { helperTextAr: q.helperTextAr } : {}),
            isRequired: q.isRequired ?? true,
            ...(q.enabledWhen ? { enabledWhen: q.enabledWhen } : {}),
            options: [],
          };
          questionByCode.set(q.code, mq);
          questionOrder.push(q.code);
        }
        for (const o of optionList) {
          const code = o.code ?? slug(o.labelEn);
          if (!mq.options.some((x) => x.code === code)) {
            mq.options.push({ code, labelEn: o.labelEn, labelAr: o.labelAr });
          }
        }
      }
    }
  }

  // ---- 1b. Inject the four bound NUMERIC money questions --------------------
  // Added after the merge so they cannot be shadowed by a bucket question of the
  // same code, and so they sort to the front of their group (the amount and term
  // are the first things a customer is asked).
  for (const { groupCode, question, categories } of MONEY_QUESTIONS) {
    if (!groupByCode.has(groupCode)) {
      throw new Error(
        `seed-questionnaire: money question '${question.code}' targets unknown group '${groupCode}'`,
      );
    }
    categoriesByQuestion[question.code] = new Set(categories);
    questionByCode.set(question.code, {
      code: question.code,
      groupCode,
      type: question.type ?? 'NUMERIC',
      ...(question.numeric ? { numeric: question.numeric } : {}),
      questionEn: question.questionEn,
      questionAr: question.questionAr,
      ...(question.helperTextEn ? { helperTextEn: question.helperTextEn } : {}),
      ...(question.helperTextAr ? { helperTextAr: question.helperTextAr } : {}),
      isRequired: question.isRequired ?? true,
      options: [],
    });
    questionOrder.unshift(question.code);
  }

  // ---- 1b-ii. The bureau score --------------------------------------------
  // Registered the same way and for the same reason as 1b — a bound NUMERIC question the
  // engine reads through a fact — but NOT `unshift`ed: it is the least important thing in
  // its group and belongs at the end of it, not in front of what the customer came to
  // answer.
  {
    const { groupCode, question, categories } = I_SCORE_QUESTION;
    if (!groupByCode.has(groupCode)) {
      throw new Error(
        `seed-questionnaire: I-Score question targets unknown group '${groupCode}'`,
      );
    }
    categoriesByQuestion[question.code] = new Set(categories);
    questionByCode.set(question.code, {
      code: question.code,
      groupCode,
      type: 'NUMERIC',
      ...(question.numeric ? { numeric: question.numeric } : {}),
      questionEn: question.questionEn,
      questionAr: question.questionAr,
      ...(question.helperTextEn ? { helperTextEn: question.helperTextEn } : {}),
      ...(question.helperTextAr ? { helperTextAr: question.helperTextAr } : {}),
      isRequired: false,
      options: [],
    });
    questionOrder.push(question.code);
  }

  // ---- 1b-iii. The sources of additional income ---------------------------
  // Same registration as the bureau score, and pushed rather than unshifted for the same
  // reason: they sit behind a yes/no the applicant has already answered, and belong after
  // what the customer came to say. They live in the group that already asks whether there
  // IS other money, so the amounts follow the question that reveals them.
  for (const { question } of ADDITIONAL_INCOME_SOURCES) {
    const groupCode = ADDITIONAL_INCOME_Q_GROUP;
    if (!groupByCode.has(groupCode)) {
      throw new Error(
        `seed-questionnaire: additional-income question '${question.code}' targets unknown group '${groupCode}'`,
      );
    }
    // Narrowed to the categories that ask the branch source, exactly like the obligation
    // amounts below: a gated question published where its source is never asked can never
    // become visible, and shows up as a dangling branch in the admin's matrix.
    const sourceCategories = categoriesByQuestion[ADDITIONAL_INCOME_Q.code];
    categoriesByQuestion[question.code] = new Set(
      sourceCategories
        ? ADDITIONAL_INCOME_CATEGORIES.filter((c) => sourceCategories.has(c))
        : ADDITIONAL_INCOME_CATEGORIES,
    );
    questionByCode.set(question.code, {
      code: question.code,
      groupCode,
      type: 'NUMERIC',
      ...(question.numeric ? { numeric: question.numeric } : {}),
      ...(question.enabledWhen ? { enabledWhen: question.enabledWhen } : {}),
      questionEn: question.questionEn,
      questionAr: question.questionAr,
      ...(question.helperTextEn ? { helperTextEn: question.helperTextEn } : {}),
      ...(question.helperTextAr ? { helperTextAr: question.helperTextAr } : {}),
      isRequired: false,
      options: [],
    });
    questionOrder.push(question.code);
  }

  // ---- 1c. Inject the itemised obligations block -----------------------------
  // Registered after 1b so `current_installments` already exists, then the whole
  // block is re-ordered as one unit below.
  for (const { groupCode, question, categories } of OBLIGATION_QUESTIONS) {
    if (!groupByCode.has(groupCode)) {
      throw new Error(
        `seed-questionnaire: obligation question '${question.code}' targets unknown group '${groupCode}'`,
      );
    }
    // Narrow to the categories that actually ask the branch source. `current_loans`
    // is asked by personal / car / mortgage but NOT business, so claiming all four
    // here would publish amount questions into a category where their branch source
    // is never asked — questions that can never become visible, and a dangling
    // branch in the admin's category matrix. Derived rather than hardcoded so that
    // adding the source to a category automatically brings its amounts along.
    const sourceCategories = categoriesByQuestion[DEBT_TYPES_QUESTION_CODE];
    categoriesByQuestion[question.code] = new Set(
      sourceCategories ? categories.filter((c) => sourceCategories.has(c)) : categories,
    );
    questionByCode.set(question.code, {
      code: question.code,
      groupCode,
      type: question.type ?? 'NUMERIC',
      ...(question.numeric ? { numeric: question.numeric } : {}),
      ...(question.enabledWhen ? { enabledWhen: question.enabledWhen } : {}),
      questionEn: question.questionEn,
      questionAr: question.questionAr,
      ...(question.helperTextEn ? { helperTextEn: question.helperTextEn } : {}),
      ...(question.helperTextAr ? { helperTextAr: question.helperTextAr } : {}),
      isRequired: question.isRequired ?? true,
      // Same code fallback as the merge path: every option here pins its code
      // explicitly (it is a join key), but the seed type allows omission.
      options: (question.options ?? []).map((o) => ({
        code: o.code ?? slug(o.labelEn),
        labelEn: o.labelEn,
        labelAr: o.labelAr,
      })),
    });
  }

  // `displayOrder` is this array's index, and `assertEnabledWhenValid` rejects a
  // forward reference — so the branch source MUST precede the questions it
  // guards. Re-seat the block as one contiguous, correctly ordered run rather
  // than relying on the interleaving of two separate injection loops:
  //   debt types → per-debt amounts → derived total
  const obligationBlock: readonly string[] = [
    DEBT_TYPES_QUESTION_CODE,
    ...OBLIGATION_ITEM_QUESTION_CODES,
    // In the block because that splice is the ONLY thing that puts an injected question into
    // `questionOrder` — and a question missing from it is not merely mis-ordered, it is never
    // written and then swept inactive by the `notIn: questionOrder` pass below.
    ...CAR_LOAN_DETAIL_QUESTION_CODES,
    MONEY_FIELD_BINDINGS.existing_obligations,
  ];
  for (let i = questionOrder.length - 1; i >= 0; i--) {
    if (obligationBlock.includes(questionOrder[i]!)) questionOrder.splice(i, 1);
  }
  // Seated immediately AFTER the remaining money questions, not at the very front:
  // an applicant should say what he earns and what he wants before enumerating what
  // he owes, and the derived total then lands right next to the income it is judged
  // against. Still contiguous, so source → parts → total stays intact.
  const lastMoneyIndex = MONEY_FIELD_BINDING_KEYS.map((k) => MONEY_FIELD_BINDINGS[k])
    .filter((code) => !obligationBlock.includes(code))
    .reduce((max, code) => Math.max(max, questionOrder.indexOf(code)), -1);
  questionOrder.splice(lastMoneyIndex + 1, 0, ...obligationBlock);

  return { groupOrder, groupByCode, questionOrder, questionByCode, categoriesByQuestion };
}

export async function seedQuestionnaire(): Promise<void> {
  const pool = await mergeSeedPool(prisma);
  const { groupOrder, groupByCode, questionOrder, questionByCode, categoriesByQuestion } = pool;

  // ---- 2. Upsert the global groups / questions / options (unique by code) ---
  const groupIdByCode = new Map<string, string>();
  let gOrder = 0;
  for (const code of groupOrder) {
    const g = groupByCode.get(code)!;
    gOrder += 1;
    const group = await prisma.questionGroup.upsert({
      where: { code },
      update: { titleEn: g.titleEn, titleAr: g.titleAr, displayOrder: gOrder, isActive: true },
      create: { code, titleEn: g.titleEn, titleAr: g.titleAr, displayOrder: gOrder },
    });
    groupIdByCode.set(code, group.id);
  }
  let qOrder = 0;
  for (const code of questionOrder) {
    const q = questionByCode.get(code)!;
    qOrder += 1;
    // Per-type rule columns: only the owning type keeps them, so a bucket
    // question converted to NUMERIC does not carry stale text rules (and vice versa).
    const typeColumns = {
      type: q.type,
      numericMinValue: q.type === 'NUMERIC' ? (q.numeric?.minValue ?? null) : null,
      numericMaxValue: q.type === 'NUMERIC' ? (q.numeric?.maxValue ?? null) : null,
      numericStep: q.type === 'NUMERIC' ? (q.numeric?.step ?? null) : null,
      numericUnitEn: q.type === 'NUMERIC' ? (q.numeric?.unitEn ?? null) : null,
      numericUnitAr: q.type === 'NUMERIC' ? (q.numeric?.unitAr ?? null) : null,
      textMaxLength: null,
    };
    // Branch rule is authored data too: written on every run (DbNull when the
    // seed dropped it) so a rule removed here also disappears from the row.
    const branchColumn = {
      enabledWhen: q.enabledWhen
        ? (q.enabledWhen as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
    };
    // Authored data like the branch rule: written on every run (null when the seed
    // dropped it) so a helper removed here also disappears from the row.
    const helperColumns = {
      helperTextEn: q.helperTextEn ?? null,
      helperTextAr: q.helperTextAr ?? null,
    };
    const question = await prisma.question.upsert({
      where: { code },
      update: {
        groupId: groupIdByCode.get(q.groupCode)!, questionEn: q.questionEn, questionAr: q.questionAr,
        displayOrder: qOrder, isRequired: q.isRequired, isActive: true,
        ...helperColumns, ...typeColumns, ...branchColumn,
      },
      create: {
        groupId: groupIdByCode.get(q.groupCode)!, code,
        questionEn: q.questionEn, questionAr: q.questionAr, displayOrder: qOrder, isRequired: q.isRequired,
        ...helperColumns, ...typeColumns, ...branchColumn,
      },
    });
    const optionCodes: string[] = [];
    let oOrder = 0;
    for (const o of q.options) {
      oOrder += 1;
      optionCodes.push(o.code);
      await prisma.questionOption.upsert({
        where: { uniq_question_option_question_code: { questionId: question.id, code: o.code } },
        update: { labelEn: o.labelEn, labelAr: o.labelAr, displayOrder: oOrder, isActive: true },
        create: { questionId: question.id, code: o.code, labelEn: o.labelEn, labelAr: o.labelAr, displayOrder: oOrder },
      });
    }
    await prisma.questionOption.updateMany({
      where: { questionId: question.id, code: { notIn: optionCodes } },
      data: { isActive: false },
    });
    // Which loan categories ask this question (v12.0.0). Authored data like the
    // rest of the seed, so it is rewritten on every run: a question moved between
    // category configs must not keep the assignment it had before the move. The
    // set comes from the SAME `categoriesByQuestion` map that pre-assigns each
    // program's scoring below, so the two can never disagree.
    const askedBy = [...(categoriesByQuestion[code] ?? new Set<Category>())];
    await prisma.questionLoanCategory.deleteMany({
      where: { questionId: question.id, category: { notIn: askedBy } },
    });
    if (askedBy.length > 0) {
      await prisma.questionLoanCategory.createMany({
        data: askedBy.map((category) => ({ questionId: question.id, category })),
        skipDuplicates: true,
      });
    }
  }
  // Deactivate stale questions + groups (dropped/renamed across the whole pool).
  await prisma.question.updateMany({ where: { code: { notIn: questionOrder } }, data: { isActive: false } });
  await prisma.questionGroup.updateMany({ where: { code: { notIn: groupOrder } }, data: { isActive: false } });

  // ---- 2a-ii. Put back the ones a live product still reads --------------------
  //
  // The sweep above is right about a question DROPPED from this pool — removing it is how a
  // question is retired. It is wrong about a question a BLUEPRINT minted: those are not in
  // this pool by design (`seed:blueprints` owns them), so every run switched all of them off
  // and the product reading them quietly stopped quoting. `seed:blueprints` does not put them
  // back either — it `skip`s a product that already holds a calculation — so the repair was a
  // manual step somebody had to know about, and the changelog records it being missed and
  // then re-done three times (v24.0.0, v25.0.0, v26.0.0).
  //
  // It is fixed here rather than left as a runbook line because of WHERE the two acts fall:
  // `publishVersion()` runs a few lines below, so a repair applied afterwards leaves the
  // SERVED snapshot short of exactly those questions until somebody republishes by hand.
  //
  // Derived from `surrogate_product_ask` and never hand-typed — a list of codes in this file
  // would be a fourth place to keep in step. `detachedAt IS NULL` is load-bearing: an
  // operator's untick is a tombstone precisely so the seed cannot undo it, and reviving a
  // detached ask's question here would be this seed overruling them.
  const revived = await prisma.question.updateMany({
    where: {
      isActive: false,
      id: {
        in: (
          await prisma.surrogateProductAsk.findMany({
            where: { detachedAt: null, fact: { type: 'surrogate_fact' } },
            select: { fact: { select: { boundQuestionId: true } } },
          })
        )
          .map((ask) => ask.fact.boundQuestionId)
          .filter((id): id is string => id !== null),
      },
    },
    data: { isActive: true },
  });
  if (revived.count > 0) {
    console.log(
      `seed-questionnaire: kept ${revived.count} blueprint question(s) live — a product still reads them.`,
    );
  }

  // ---- 2b. The bureau-score FACT --------------------------------------------
  await upsertIScoreFact();
  await upsertAdditionalIncomeFacts();
  await upsertCarFacts();

  // ---- 3. Publish ONE global snapshot ---------------------------------------
  await publishVersion();

  // ---- 4. Per-program weight sets ------------------------------------------
  console.log(
    `seed-questionnaire: ${groupOrder.length} groups, ${questionOrder.length} questions (global).`,
  );
}

/**
 * The `surrogate_fact` row for the bureau score, bound to the question above.
 *
 * PLATFORM-OWNED — `surrogateProductKey` is deliberately null. Every other fact on that
 * table was authored by one product and belongs to it; this one is a property of the
 * APPLICANT, read by any product whose form ticks "adjust by I-Score". Filing it under
 * whichever product happened to want it first would make it look like that product's, and
 * retiring that product would then read as retiring the score.
 *
 * Idempotent, like the rest of the seed: re-running re-points the binding at whatever the
 * question's id is now, which is what makes it survive a question being recreated.
 */
async function upsertIScoreFact(): Promise<void> {
  const question = await prisma.question.findUnique({
    where: { code: I_SCORE_FACT_KEY },
    select: { id: true },
  });
  if (!question) {
    // Not a throw: the question is written a few lines above, so a miss here means the seed
    // itself is broken, and dying without saying which half would send the next person to
    // the wrong file.
    console.warn(`seed-questionnaire: no '${I_SCORE_FACT_KEY}' question — fact not bound.`);
    return;
  }

  const existing = await prisma.platformEnumeration.findUnique({
    where: { idx_platform_enumeration_type_key: { type: 'surrogate_fact', key: I_SCORE_FACT_KEY } },
    select: { id: true },
  });

  if (existing) {
    await prisma.platformEnumeration.update({
      where: { id: existing.id },
      data: { boundQuestionId: question.id, active: true, deprecatedAt: null, updatedBy: SEED_ACTOR },
    });
    return;
  }

  await prisma.platformEnumeration.create({
    data: {
      type: 'surrogate_fact',
      key: I_SCORE_FACT_KEY,
      labelEn: 'I-Score',
      labelAr: 'الآي سكور',
      sortOrder: 100,
      active: true,
      boundQuestionId: question.id,
      createdBy: SEED_ACTOR,
      updatedBy: SEED_ACTOR,
    },
  });
}

/**
 * The `surrogate_fact` rows for the car's price and its down payment.
 *
 * PLATFORM-OWNED, for the reason the bureau score is (`surrogateProductKey` null): they are
 * properties of the purchase, not of one product. The rate cascade bands on the down-payment
 * percentage for every car program, `quote.ts` caps every car loan at a share of the price,
 * and one no-payslip product reads the down payment as the applicant's income. Filing them
 * under whichever product wanted them first would make retiring that product read as
 * retiring the price.
 *
 * Idempotent like its neighbours: re-running re-points the binding at the question's current
 * id, which is what makes it survive a question being recreated.
 */
async function upsertCarFacts(): Promise<void> {
  const facts = [
    { key: 'car_price', labelEn: 'Car price', labelAr: 'سعر السيارة', sortOrder: 120 },
    {
      key: 'car_down_payment',
      labelEn: 'Car down payment',
      labelAr: 'الدفعة المقدمة للسيارة',
      sortOrder: 121,
    },
  ] as const;

  for (const fact of facts) {
    const question = await prisma.question.findUnique({
      where: { code: fact.key },
      select: { id: true },
    });
    if (!question) {
      // Not a throw, for the reason `upsertIScoreFact` states: the question is written a few
      // hundred lines above, so a miss means the seed itself is broken and dying here would
      // send the next person to the wrong file.
      console.warn(`seed-questionnaire: no '${fact.key}' question — fact not bound.`);
      continue;
    }

    const existing = await prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type: 'surrogate_fact', key: fact.key } },
      select: { id: true },
    });

    if (existing) {
      await prisma.platformEnumeration.update({
        where: { id: existing.id },
        data: {
          boundQuestionId: question.id,
          active: true,
          deprecatedAt: null,
          updatedBy: SEED_ACTOR,
        },
      });
      continue;
    }

    await prisma.platformEnumeration.create({
      data: {
        type: 'surrogate_fact',
        key: fact.key,
        labelEn: fact.labelEn,
        labelAr: fact.labelAr,
        sortOrder: fact.sortOrder,
        active: true,
        boundQuestionId: question.id,
        createdBy: SEED_ACTOR,
        updatedBy: SEED_ACTOR,
      },
    });
  }
}

/**
 * The `surrogate_fact` rows for the additional-income sources, bound to the questions above.
 *
 * PLATFORM-OWNED, like the bureau score and for the same reason: rent is a property of the
 * applicant, read by any bank whose sheet counts it. What is per-BANK is the WEIGHT, and that
 * lives on the bank program (`incomeAssumption.additionalIncome`).
 *
 * Registered as facts rather than read straight off the answers so that one mechanism serves
 * both: the same registry the income rule reads, the same check panel, the same refusal when
 * a bank names a source the questionnaire stopped asking.
 */
async function upsertAdditionalIncomeFacts(): Promise<void> {
  for (const { key, question } of ADDITIONAL_INCOME_SOURCES) {
    const row = await prisma.question.findUnique({
      where: { code: question.code },
      select: { id: true },
    });
    if (!row) {
      // Not a throw, for the reason `upsertIScoreFact` states: the question is written a few
      // hundred lines above, so a miss means the seed itself is broken and dying here would
      // send the next person to the wrong file.
      console.warn(`seed-questionnaire: no '${question.code}' question — fact not bound.`);
      continue;
    }

    const existing = await prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type: 'surrogate_fact', key } },
      select: { id: true },
    });

    if (existing) {
      await prisma.platformEnumeration.update({
        where: { id: existing.id },
        data: { boundQuestionId: row.id, active: true, deprecatedAt: null, updatedBy: SEED_ACTOR },
      });
      continue;
    }

    await prisma.platformEnumeration.create({
      data: {
        type: 'surrogate_fact',
        key,
        labelEn: ADDITIONAL_INCOME_FACT_LABELS[key]?.en ?? key,
        labelAr: ADDITIONAL_INCOME_FACT_LABELS[key]?.ar ?? key,
        sortOrder: 110,
        active: true,
        boundQuestionId: row.id,
        createdBy: SEED_ACTOR,
        updatedBy: SEED_ACTOR,
      },
    });
  }
}

/** Operator-facing names, in both locales — the fact rows carry a label, not a question. */
const ADDITIONAL_INCOME_FACT_LABELS: Record<string, { en: string; ar: string }> = {
  rental_income_monthly: { en: 'Rental income', ar: 'دخل الإيجار' },
  cd_returns_monthly: { en: 'Certificate or deposit returns', ar: 'عائد الشهادات أو الودائع' },
  fixed_allowances_monthly: { en: 'Fixed allowances', ar: 'البدلات الثابتة' },
  variable_allowances_monthly: { en: 'Variable allowances', ar: 'البدلات المتغيرة' },
};

async function publishVersion(): Promise<void> {
  const groups = await prisma.questionGroup.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } });
  const snapshotGroups = [];
  for (const g of groups) {
    const questions = await prisma.question.findMany({ where: { groupId: g.id, isActive: true }, orderBy: { displayOrder: 'asc' } });
    const qOut = [];
    for (const q of questions) {
      const options = await prisma.questionOption.findMany({ where: { questionId: q.id, isActive: true }, orderBy: { displayOrder: 'asc' } });
      // Which categories ask this question is FROZEN here, exactly as
      // `QuestionnaireService.publish()` does it (A33 — never re-derived at read
      // time). Omitting it is not a smaller snapshot, it is a WRONG one: a
      // question with no `categories` key is read as "asked by all four"
      // (pre-v12 compatibility in `askedFor`), so `GET /v1/questionnaire?
      // category=car` served the whole 38-question pool — every mortgage and
      // business question included — to a car applicant.
      const categories = (
        await prisma.questionLoanCategory.findMany({
          where: { questionId: q.id },
          orderBy: { category: 'asc' },
        })
      ).map((c) => c.category);
      qOut.push({
        code: q.code, type: q.type, categories, questionAr: q.questionAr, questionEn: q.questionEn,
        helperTextAr: q.helperTextAr, helperTextEn: q.helperTextEn, isRequired: q.isRequired,
        displayOrder: q.displayOrder, enabledWhen: q.enabledWhen ?? null,
        // Feature 010 — rule blocks, emitted only for the type that owns them.
        ...(q.type === 'NUMERIC'
          ? {
              numeric: {
                minValue: q.numericMinValue?.toFixed(2) ?? null,
                maxValue: q.numericMaxValue?.toFixed(2) ?? null,
                step: q.numericStep?.toFixed(2) ?? null,
                unitAr: q.numericUnitAr,
                unitEn: q.numericUnitEn,
              },
            }
          : {}),
        ...(q.type === 'TEXT' && q.textMaxLength !== null
          ? { text: { maxLength: q.textMaxLength } }
          : {}),
        options: options.map((o) => ({
          code: o.code, labelAr: o.labelAr, labelEn: o.labelEn, displayOrder: o.displayOrder,
        })),
      });
    }
    // Same rule as `QuestionnaireService.publish` — a group whose questions all
    // merged into an earlier group by code carries nothing to ask and would
    // render as a blank wizard step.
    if (qOut.length === 0) continue;
    snapshotGroups.push({ code: g.code, titleAr: g.titleAr, titleEn: g.titleEn, displayOrder: g.displayOrder, questions: qOut });
  }
  const last = await prisma.questionnaireVersion.findFirst({ orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
  const versionNumber = (last?.versionNumber ?? 0) + 1;
  await prisma.questionnaireVersion.updateMany({ where: { isActive: true }, data: { isActive: false } });
  await prisma.questionnaireVersion.create({
    data: { versionNumber, isActive: true, publishedAt: new Date(), publishedBy: SEED_ACTOR, snapshot: { versionNumber, groups: snapshotGroups } },
  });
}

function slug(label: string): string {
  return label.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_').slice(0, 60) || 'opt';
}

// Standalone run: `tsx prisma/seed-questionnaire.ts`. Skipped when imported by
// seed.ts (which owns the prisma lifecycle and chains seedQuestionnaire()).
if (process.argv[1]?.includes('seed-questionnaire')) {
  seedQuestionnaire()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
