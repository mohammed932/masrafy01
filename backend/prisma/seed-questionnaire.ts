/**
 * Seed — full 4-category loan questionnaire (Personal, Mortgage, Car, Business)
 * + ACTIVE per-program per-answer point sets + published version snapshots, so
 * the dynamic-questionnaire + matching flow runs end-to-end. Idempotent.
 * Run via:  npx tsx prisma/seed-questionnaire.ts
 *
 * MVP model:
 *  - Questions + answers are PURE CONTENT (label + order only). No engine fields.
 *  - Scoring is per bank program, per ANSWER OPTION: `ScoringWeightSet.weights`
 *    is `{ optionCode: points }`. Approval probability =
 *    Σ(points of the picked answers) / max-achievable points. No eligibility gates.
 *  - Options carry an OPTIONAL seed-only `points` hint (0..100 desirability). Each
 *    program gets those points scaled by a per-program multiplier so programs
 *    differ; the banking expert tunes them later in the admin editor.
 */
import { Prisma, PrismaClient, type QuestionType } from '@prisma/client';
import { MONEY_FIELD_BINDINGS } from '../src/matching/pipeline/money-field-bindings';

const prisma = new PrismaClient();
const SEED_ACTOR = 'seed-system';

type Category = 'personal' | 'mortgage' | 'car' | 'business';

/** Per-program multipliers applied to the seed `points` so programs rank differently. */
const PROGRAM_POINT_MULTIPLIERS = [1.0, 0.85, 1.15, 0.95];

/**
 * Neutral score (0–100) given to every answer of a non-financial / content
 * question (loan purpose, governorate, vehicle condition…). Flat → the question
 * contributes a constant, never unfairly ranking one applicant over another, but
 * it is never 0 so no answer reads as "0".
 */
const NEUTRAL_SCORE = 50;

/** Equal question weights summing to exactly 100 (remainder spread over the first
 *  questions). Every question gets a non-zero share; no per-question tuning. */
function equalWeights(questionCodes: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const n = questionCodes.length;
  if (n === 0) return out;
  const base = Math.floor(100 / n);
  let remainder = 100 - base * n;
  for (const code of questionCodes) {
    out[code] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return out;
}

// Active platform-enumeration members → seed options (code = enum key). Cached
// per type so a category seed reads each list at most once.
const _enumOptionsCache = new Map<string, SeedOption[]>();
async function enumOptions(type: string): Promise<SeedOption[]> {
  const cached = _enumOptionsCache.get(type);
  if (cached) return cached;
  const rows = await prisma.platformEnumeration.findMany({
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
// (`ScoringWeightSet.answerScores`, `ApplicationAnswer.selectedOptionCode`), so a
// bank renamed in the registry seeds a NEW option code and the old one simply
// deactivates — stored answers keep pointing at the name that was picked.
let _bankOptionsCache: SeedOption[] | null = null;
async function bankOptions(): Promise<SeedOption[]> {
  if (_bankOptionsCache) return _bankOptionsCache;
  const rows = await prisma.bank.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { nameEnglish: 'asc' }],
    select: { nameEnglish: true, nameArabic: true },
  });
  const opts: SeedOption[] = rows.map((b) => ({
    code: slug(b.nameEnglish),
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
   *  join key: mobile answer mappers, `ScoringWeightSet.answerScores` and stored
   *  `ApplicationAnswer.selectedOptionCode` all reference it, so it must survive a
   *  copy edit. Only options built at seed time fall back to slug(labelEn). */
  code?: string;
  /** Seed-only desirability hint (0..100). Becomes the program's per-answer points. */
  points?: number;
}
interface SeedNumericRules {
  minValue: string;
  maxValue: string;
  step?: string;
  unitEn: string;
  unitAr: string;
}
interface SeedQuestion {
  code: string;
  /** Defaults to SINGLE_SELECT. Feature 010: all four types are real. */
  type?: QuestionType;
  /** NUMERIC only — CONTENT bounds + display unit, never scoring (A33). */
  numeric?: SeedNumericRules;
  questionEn: string;
  questionAr: string;
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
  { code: 'government_employee', labelEn: 'Government job', labelAr: 'موظف حكومي', points: 100 },
  { code: 'private_sector_employee', labelEn: 'Private company job', labelAr: 'موظف قطاع خاص', points: 85 },
  { code: 'business_owner_company_owner', labelEn: 'I own a business or company', labelAr: 'صاحب عمل / شركة', points: 70 },
  { code: 'freelancer', labelEn: 'I work for myself', labelAr: 'عمل حر', points: 45 },
  { code: 'retired', labelEn: 'Retired', labelAr: 'متقاعد', points: 55 },
];

const YESNO = (yesPoints?: number, noPoints?: number): SeedOption[] => [
  { code: 'yes', labelEn: 'Yes', labelAr: 'نعم', ...(yesPoints != null ? { points: yesPoints } : {}) },
  { code: 'no', labelEn: 'No', labelAr: 'لا', ...(noPoints != null ? { points: noPoints } : {}) },
];

const AGE_Q: SeedQuestion = {
  code: 'your_age', questionEn: 'How old are you?', questionAr: 'عمرك',
  options: [
    { code: '21_30', labelEn: '21 – 30', labelAr: '21 – 30', points: 70 },
    { code: '31_45', labelEn: '31 – 45', labelAr: '31 – 45', points: 100 },
    { code: '46_60', labelEn: '46 – 60', labelAr: '46 – 60', points: 75 },
    { code: 'more_than_60', labelEn: 'More than 60', labelAr: 'أكثر من 60', points: 35 },
  ],
};
// A customer can carry several obligations at once, so this is MULTI_SELECT.
// Shared across categories so the global merge never unions a Yes/No variant
// into the loan-kind list.
const CURRENT_LOANS_Q: SeedQuestion = {
  code: 'current_loans', type: 'MULTI_SELECT',
  questionEn: 'Do you pay back any loans right now?', questionAr: 'هل لديك قروض أو التزامات حالية؟',
  options: [
    { code: 'none', labelEn: 'None', labelAr: 'لا يوجد', points: 100 },
    { code: 'personal_loan', labelEn: 'Personal loan', labelAr: 'قرض شخصي', points: 55 },
    { code: 'car_loan', labelEn: 'Car loan', labelAr: 'قرض سيارة', points: 55 },
    { code: 'mortgage', labelEn: 'Home loan', labelAr: 'قرض عقاري', points: 50 },
    { code: 'credit_cards', labelEn: 'Credit cards', labelAr: 'بطاقات ائتمان', points: 60 },
    { code: 'other', labelEn: 'Something else', labelAr: 'أخرى', points: 50 },
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
    { code: 'payroll', labelEn: 'My employer already sends my salary to the bank', labelAr: 'تحويل راتب', points: 100 },
    { code: 'salary_transfer_letter', labelEn: 'My employer signs a letter to transfer my salary', labelAr: 'خطاب تحويل راتب', points: 80 },
    { code: 'income_transfer_letter', labelEn: 'My employer signs a letter to transfer my whole income', labelAr: 'خطاب تحويل دخل', points: 60 },
    { code: 'no_salary_transfer', labelEn: 'Nothing is sent to the bank', labelAr: 'بدون تحويل راتب', points: 20 },
  ],
};

// ── Feature 010: the four bound money questions ─────────────────────────────
// These carry the real figures the engine prices on. Until now the app mapped a
// bucket answer to a representative midpoint, so a customer asking for 500 000
// was quoted on 300 000. The codes are the ones `MONEY_FIELD_BINDINGS` names —
// the binding lives in code, never on the question (A33).
//
// They are NUMERIC and therefore NOT scoreable (R9): only single choice carries
// answer scores, so these are excluded from every program's weight set below.
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
      questionEn: 'How much money do you get each month?',
      questionAr: 'ما دخلك الشهري؟',
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
      // Zero is a legitimate answer, so this must not be a bucket with a
      // "less than X" floor — hence minValue 0.
      questionEn: 'How much do you pay for loans each month?',
      questionAr: 'ما إجمالي أقساطك الشهرية الحالية؟',
      numeric: { minValue: '0', maxValue: '5000000', unitEn: 'EGP', unitAr: 'جنيه' },
      options: [],
    },
  },
];

/**
 * Bucket questions superseded by a MONEY_QUESTIONS entry. Three share the bound
 * code and are therefore REPLACED in place (same code, now NUMERIC, options
 * deactivated); `repayment_period` is superseded by the differently-named
 * `repayment_period_months` and is dropped from the pool, which deactivates it.
 * Answers already stored against any of them stay readable (FR-045).
 */
const SUPERSEDED_BUCKET_CODES: ReadonlySet<string> = new Set([
  MONEY_FIELD_BINDINGS.requested_amount,
  MONEY_FIELD_BINDINGS.monthly_income,
  MONEY_FIELD_BINDINGS.existing_obligations,
  'repayment_period',
]);

// ── PERSONAL ────────────────────────────────────────────────────────────────
const PERSONAL: CategoryConfig = {
  category: 'personal',
  groups: [
    {
      code: 'financing_info', titleEn: 'About your loan', titleAr: 'معلومات التمويل',
      questions: [
        {
          code: 'amount_requested', questionEn: 'About how much do you need?', questionAr: 'ما المبلغ التقريبي الذي تحتاجه؟',
          options: [
            { code: 'less_than_egp_50000', labelEn: 'Less than 50,000 EGP', labelAr: 'أقل من 50,000 جنيه' },
            { code: 'egp_50000_150000', labelEn: '50,000 – 150,000 EGP', labelAr: '50,000 – 150,000 جنيه' },
            { code: 'egp_150000_500000', labelEn: '150,000 – 500,000 EGP', labelAr: '150,000 – 500,000 جنيه' },
            { code: 'more_than_egp_500000', labelEn: 'More than 500,000 EGP', labelAr: 'أكثر من 500,000 جنيه' },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'How long do you want to pay it back?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { code: 'less_than_3_years', labelEn: 'Less than 3 years', labelAr: 'أقل من 3 سنوات' },
            { code: '3_to_5_years', labelEn: '3 to 5 years', labelAr: 'من 3 إلى 5 سنوات' },
            { code: '5_to_7_years', labelEn: '5 to 7 years', labelAr: 'من 5 إلى 7 سنوات' },
            { code: 'more_than_7_years', labelEn: 'More than 7 years', labelAr: 'أكثر من 7 سنوات' },
          ],
        },
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
        AGE_Q,
      ],
    },
    {
      code: 'employment_income', titleEn: 'Your job and pay', titleAr: 'معلومات العمل والدخل',
      questions: [
        {
          code: 'employment_status', questionEn: 'What kind of work do you do?', questionAr: 'ما هي حالتك الوظيفية؟',
          options: EMPLOYMENT_OPTIONS,
        },
        {
          code: 'job_tenure', questionEn: 'How long have you been in this job?', questionAr: 'منذ متى وأنت في وظيفتك الحالية؟',
          options: [
            { code: 'less_than_6_months', labelEn: 'Less than 6 months', labelAr: 'أقل من 6 أشهر', points: 15 },
            { code: '6_months_to_1_year', labelEn: '6 months to 1 year', labelAr: 'من 6 أشهر إلى سنة', points: 35 },
            { code: '1_to_3_years', labelEn: '1 to 3 years', labelAr: 'من 1 إلى 3 سنوات', points: 60 },
            { code: 'more_than_3_years', labelEn: 'More than 3 years', labelAr: 'أكثر من 3 سنوات', points: 100 },
          ],
        },
        {
          code: 'monthly_income', questionEn: 'How much do you usually get each month?', questionAr: 'ما متوسط دخلك الشهري؟',
          options: [
            { code: 'less_than_egp_10000', labelEn: 'Less than 10,000 EGP', labelAr: 'أقل من 10,000 جنيه', points: 20 },
            { code: 'egp_10000_20000', labelEn: '10,000 – 20,000 EGP', labelAr: '10,000 – 20,000 جنيه', points: 50 },
            { code: 'egp_20000_40000', labelEn: '20,000 – 40,000 EGP', labelAr: '20,000 – 40,000 جنيه', points: 75 },
            { code: 'more_than_egp_40000', labelEn: 'More than 40,000 EGP', labelAr: 'أكثر من 40,000 جنيه', points: 100 },
          ],
        },
        SALARY_TRANSFER_Q,
        {
          // Asks whether the salary lands at ONE bank, not which one — the options
          // never carried a bank name and the registry owns the bank list.
          code: 'salary_bank', questionEn: 'Do you always get your salary through the same bank?', questionAr: 'من خلال أي بنك تستلم راتبك؟',
          isRequired: false,
          options: [
            { code: 'a_specific_bank', labelEn: 'Yes, always the same bank', labelAr: 'بنك محدد' },
            { code: 'no_specific_bank', labelEn: 'No, not always the same bank', labelAr: 'لا يوجد بنك محدد' },
          ],
        },
        {
          // Follow-up to `salary_bank`: asked ONLY when the applicant said the
          // salary lands at one bank. Options come from the `bank` registry, so
          // adding/retiring a bank there is the only edit needed (Principle II).
          code: 'salary_bank_name',
          questionEn: 'Which bank do you receive your salary through?',
          questionAr: 'ما هو البنك الذي تستلم راتبك من خلاله؟',
          isRequired: false,
          enabledWhen: { questionCode: 'salary_bank', operator: 'equals', optionCode: 'a_specific_bank' },
          optionsFromBanks: true,
          options: [],
        },
        {
          code: 'employer_approved', questionEn: "Is the place you work at on the banks' approved list?", questionAr: 'هل جهة عملك معتمدة لدى البنوك؟',
          isRequired: false, options: [
            { code: 'yes', labelEn: 'Yes', labelAr: 'نعم', points: 100 },
            { code: 'no', labelEn: 'No', labelAr: 'لا', points: 40 },
            { code: 'not_sure', labelEn: 'I am not sure', labelAr: 'غير متأكد', points: 65 },
          ],
        },
      ],
    },
    {
      code: 'commitments', titleEn: 'What you already owe the banks', titleAr: 'الالتزامات البنكية',
      questions: [
        CURRENT_LOANS_Q,
        {
          code: 'current_installments', questionEn: 'About how much do you pay each month now?', questionAr: 'إجمالي الأقساط الشهرية الحالية تقريبًا؟',
          options: [
            { code: 'less_than_egp_2000', labelEn: 'Less than 2,000 EGP', labelAr: 'أقل من 2,000 جنيه', points: 100 },
            { code: 'egp_2000_5000', labelEn: '2,000 – 5,000 EGP', labelAr: '2,000 – 5,000 جنيه', points: 75 },
            { code: 'egp_5000_10000', labelEn: '5,000 – 10,000 EGP', labelAr: '5,000 – 10,000 جنيه', points: 50 },
            { code: 'more_than_egp_10000', labelEn: 'More than 10,000 EGP', labelAr: 'أكثر من 10,000 جنيه', points: 25 },
          ],
        },
        { code: 'has_credit_card', questionEn: 'Do you have a credit card?', questionAr: 'هل لديك بطاقة ائتمان؟', isRequired: false, options: YESNO() },
        {
          code: 'card_usage', questionEn: 'How much do you spend on your card each month?', questionAr: 'متوسط استخدام البطاقة الشهري؟',
          isRequired: false,
          options: [
            { code: 'less_than_egp_5000', labelEn: 'Less than 5,000 EGP', labelAr: 'أقل من 5,000 جنيه' },
            { code: 'egp_5000_15000', labelEn: '5,000 – 15,000 EGP', labelAr: '5,000 – 15,000 جنيه' },
            { code: 'more_than_egp_15000', labelEn: 'More than 15,000 EGP', labelAr: 'أكثر من 15,000 جنيه' },
          ],
        },
      ],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات والأهلية',
      questions: [
        {
          code: 'priority_factor', questionEn: 'What matters most to you in a loan?', questionAr: 'أهم عامل عند اختيار التمويل؟',
          isRequired: false,
          options: [
            { code: 'lowest_monthly_installment', labelEn: 'The smallest payment each month', labelAr: 'أقل قسط شهري' },
            { code: 'lowest_interest_rate', labelEn: 'The lowest interest', labelAr: 'أقل سعر فائدة' },
            { code: 'fastest_approval', labelEn: 'The fastest answer', labelAr: 'أسرع موافقة' },
            { code: 'least_documentation_required', labelEn: 'The fewest papers', labelAr: 'أقل أوراق مطلوبة' },
            { code: 'flexible_repayment', labelEn: 'Easy ways to pay it back', labelAr: 'سداد مرن' },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Has a bank ever said no to you?', questionAr: 'هل سبق رفض طلب تمويل لك؟', isRequired: false, options: YESNO(25, 100) },
        { code: 'needs_consultant', questionEn: 'Do you want help from a loan expert?', questionAr: 'هل تحتاج مساعدة مستشار تمويل؟', isRequired: false, options: YESNO() },
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
        {
          code: 'down_payment', questionEn: 'How much money can you pay up front?', questionAr: 'ما حجم الدفعة المقدمة المتاحة لديك؟',
          options: [
            { code: 'less_than_10', labelEn: 'Less than 10%', labelAr: 'أقل من 10%', points: 20 },
            { code: '10_20', labelEn: '10% – 20%', labelAr: '10% – 20%', points: 50 },
            { code: '20_30', labelEn: '20% – 30%', labelAr: '20% – 30%', points: 75 },
            { code: 'more_than_30', labelEn: 'More than 30%', labelAr: 'أكثر من 30%', points: 100 },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'How long do you want to pay it back?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { code: 'less_than_10_years', labelEn: 'Less than 10 years', labelAr: 'أقل من 10 سنوات' },
            { code: '10_15_years', labelEn: '10 – 15 years', labelAr: '10 – 15 سنة' },
            { code: '15_20_years', labelEn: '15 – 20 years', labelAr: '15 – 20 سنة' },
            { code: 'more_than_20_years', labelEn: 'More than 20 years', labelAr: 'أكثر من 20 سنة' },
          ],
        },
        AGE_Q,
      ],
    },
    {
      code: 'income_employment', titleEn: 'More about your income and work', titleAr: 'معلومات الدخل والعمل',
      questions: [
        { code: 'employment_status', questionEn: 'What kind of work do you do?', questionAr: 'ما هي حالتك الوظيفية؟', options: EMPLOYMENT_OPTIONS },
        {
          code: 'monthly_income', questionEn: 'How much do you usually get each month?', questionAr: 'ما متوسط دخلك الشهري؟',
          options: [
            { code: 'less_than_egp_15000', labelEn: 'Less than 15,000 EGP', labelAr: 'أقل من 15,000 جنيه', points: 20 },
            { code: 'egp_15000_30000', labelEn: '15,000 – 30,000 EGP', labelAr: '15,000 – 30,000 جنيه', points: 50 },
            { code: 'egp_30000_60000', labelEn: '30,000 – 60,000 EGP', labelAr: '30,000 – 60,000 جنيه', points: 75 },
            { code: 'more_than_egp_60000', labelEn: 'More than 60,000 EGP', labelAr: 'أكثر من 60,000 جنيه', points: 100 },
          ],
        },
        SALARY_TRANSFER_Q,
        { code: 'additional_income', questionEn: 'Do you get money from anywhere else?', questionAr: 'هل لديك مصادر دخل إضافية؟', isRequired: false, options: YESNO(100, 70) },
        { code: 'active_account', questionEn: 'Do you have a bank account you use?', questionAr: 'هل لديك حساب بنكي نشط؟', isRequired: false, options: YESNO(100, 40) },
      ],
    },
    {
      code: 'credit_status', titleEn: 'Your loans and cards', titleAr: 'الحالة الائتمانية',
      questions: [
        CURRENT_LOANS_Q,
        {
          code: 'current_installments', questionEn: 'How much do you pay each month now?', questionAr: 'ما إجمالي قسطك الشهري الحالي؟',
          options: [
            { code: 'less_than_egp_5000', labelEn: 'Less than 5,000 EGP', labelAr: 'أقل من 5,000 جنيه', points: 100 },
            { code: 'egp_5000_15000', labelEn: '5,000 – 15,000 EGP', labelAr: '5,000 – 15,000 جنيه', points: 70 },
            { code: 'egp_15000_30000', labelEn: '15,000 – 30,000 EGP', labelAr: '15,000 – 30,000 جنيه', points: 45 },
            { code: 'more_than_egp_30000', labelEn: 'More than 30,000 EGP', labelAr: 'أكثر من 30,000 جنيه', points: 20 },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Has a bank ever said no to a home loan?', questionAr: 'هل سبق رفض طلب تمويل عقاري لك؟', isRequired: false, options: YESNO(25, 100) },
      ],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات',
      questions: [
        {
          code: 'priority_factor', questionEn: 'What matters most to you in a home loan?', questionAr: 'أهم ما تبحث عنه في التمويل العقاري؟', isRequired: false,
          options: [
            { code: 'lowest_monthly_installment', labelEn: 'The smallest payment each month', labelAr: 'أقل قسط شهري' },
            { code: 'longest_repayment_period', labelEn: 'The longest time to pay', labelAr: 'أطول مدة سداد' },
            { code: 'lowest_down_payment', labelEn: 'The smallest amount up front', labelAr: 'أقل دفعة مقدمة' },
            { code: 'fastest_approval', labelEn: 'The fastest answer', labelAr: 'أسرع موافقة' },
            { code: 'lowest_administrative_fees', labelEn: 'The lowest fees', labelAr: 'أقل رسوم إدارية' },
          ],
        },
        { code: 'needs_assistance', questionEn: 'Do you want help getting your papers ready?', questionAr: 'هل تحتاج مساعدة في تجهيز المستندات؟', isRequired: false, options: YESNO() },
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
        {
          code: 'vehicle_price', questionEn: 'About how much does the car cost?', questionAr: 'ما السعر التقريبي للسيارة؟',
          options: [
            { code: 'less_than_egp_500000', labelEn: 'Less than 500,000 EGP', labelAr: 'أقل من 500,000 جنيه' },
            { code: 'egp_500000_1_million', labelEn: '500,000 – 1 million EGP', labelAr: '500,000 – مليون جنيه' },
            { code: 'egp_1_2_million', labelEn: '1 – 2 million EGP', labelAr: '1 – 2 مليون جنيه' },
            { code: 'more_than_egp_2_million', labelEn: 'More than 2 million EGP', labelAr: 'أكثر من 2 مليون جنيه' },
          ],
        },
        {
          code: 'down_payment', questionEn: 'How much money can you pay up front?', questionAr: 'ما حجم الدفعة المقدمة المتاحة لديك؟',
          options: [
            { code: 'no_down_payment', labelEn: 'Nothing up front', labelAr: 'بدون دفعة مقدمة', points: 10 },
            { code: 'less_than_20', labelEn: 'Less than 20%', labelAr: 'أقل من 20%', points: 40 },
            { code: '20_40', labelEn: '20% – 40%', labelAr: '20% – 40%', points: 70 },
            { code: 'more_than_40', labelEn: 'More than 40%', labelAr: 'أكثر من 40%', points: 100 },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'How long do you want to pay it back?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { code: 'less_than_3_years', labelEn: 'Less than 3 years', labelAr: 'أقل من 3 سنوات' },
            { code: '3_5_years', labelEn: '3 – 5 years', labelAr: '3 – 5 سنوات' },
            { code: '5_7_years', labelEn: '5 – 7 years', labelAr: '5 – 7 سنوات' },
            { code: 'more_than_7_years', labelEn: 'More than 7 years', labelAr: 'أكثر من 7 سنوات' },
          ],
        },
        AGE_Q,
      ],
    },
    {
      code: 'employment_income', titleEn: 'Your job and pay', titleAr: 'العمل والدخل',
      questions: [
        { code: 'employment_status', questionEn: 'What kind of work do you do?', questionAr: 'ما هي حالتك الوظيفية؟', options: EMPLOYMENT_OPTIONS },
        {
          code: 'monthly_income', questionEn: 'How much do you usually get each month?', questionAr: 'ما متوسط دخلك الشهري؟',
          options: [
            { code: 'less_than_egp_10000', labelEn: 'Less than 10,000 EGP', labelAr: 'أقل من 10,000 جنيه', points: 20 },
            { code: 'egp_10000_25000', labelEn: '10,000 – 25,000 EGP', labelAr: '10,000 – 25,000 جنيه', points: 50 },
            { code: 'egp_25000_50000', labelEn: '25,000 – 50,000 EGP', labelAr: '25,000 – 50,000 جنيه', points: 75 },
            { code: 'more_than_egp_50000', labelEn: 'More than 50,000 EGP', labelAr: 'أكثر من 50,000 جنيه', points: 100 },
          ],
        },
        SALARY_TRANSFER_Q,
        { code: 'employer_approved', questionEn: "Is the place you work at on the banks' approved list?", questionAr: 'هل جهة عملك معتمدة لدى البنوك؟', isRequired: false, options: [
          { code: 'yes', labelEn: 'Yes', labelAr: 'نعم', points: 100 },
          { code: 'no', labelEn: 'No', labelAr: 'لا', points: 40 },
          { code: 'not_sure', labelEn: 'I am not sure', labelAr: 'غير متأكد', points: 65 },
        ] },
      ],
    },
    {
      code: 'financial_status', titleEn: 'Your overall money picture', titleAr: 'الحالة المالية',
      questions: [
        CURRENT_LOANS_Q,
        {
          code: 'current_installments', questionEn: 'How much do you pay each month now?', questionAr: 'ما إجمالي قسطك الشهري الحالي؟',
          options: [
            { code: 'less_than_egp_3000', labelEn: 'Less than 3,000 EGP', labelAr: 'أقل من 3,000 جنيه', points: 100 },
            { code: 'egp_3000_7000', labelEn: '3,000 – 7,000 EGP', labelAr: '3,000 – 7,000 جنيه', points: 70 },
            { code: 'egp_7000_15000', labelEn: '7,000 – 15,000 EGP', labelAr: '7,000 – 15,000 جنيه', points: 45 },
            { code: 'more_than_egp_15000', labelEn: 'More than 15,000 EGP', labelAr: 'أكثر من 15,000 جنيه', points: 20 },
          ],
        },
        { code: 'has_credit_card', questionEn: 'Do you use any credit cards?', questionAr: 'هل لديك بطاقات ائتمان نشطة؟', isRequired: false, options: YESNO() },
      ],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات',
      questions: [
        {
          code: 'priority_factor', questionEn: 'What matters most to you in a car loan?', questionAr: 'أهم أولوية عند اختيار تمويل السيارة؟', isRequired: false,
          options: [
            { code: 'lowest_down_payment', labelEn: 'The smallest amount up front', labelAr: 'أقل دفعة مقدمة' },
            { code: 'lowest_monthly_installment', labelEn: 'The smallest payment each month', labelAr: 'أقل قسط شهري' },
            { code: 'fastest_approval', labelEn: 'The fastest answer', labelAr: 'أسرع موافقة' },
            { code: 'lowest_interest_rate', labelEn: 'The lowest interest', labelAr: 'أقل سعر فائدة' },
            { code: 'financing_without_a_guarantor', labelEn: 'No one has to sign for me', labelAr: 'تمويل بدون ضامن' },
          ],
        },
        { code: 'wants_insurance', questionEn: 'Do you want car insurance offers?', questionAr: 'هل ترغب في عروض تأمين السيارة؟', isRequired: false, options: YESNO() },
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
            { code: 'less_than_1_year', labelEn: 'Less than 1 year', labelAr: 'أقل من سنة', points: 30 },
            { code: '1_to_2_years', labelEn: '1 to 2 years', labelAr: 'من 1 إلى 2 سنة', points: 60 },
            { code: 'more_than_2_years', labelEn: 'More than 2 years', labelAr: 'أكثر من سنتين', points: 100 },
          ],
        },
        {
          code: 'financing_amount', questionEn: 'About how much money does the business need?', questionAr: 'ما مبلغ التمويل التقريبي المطلوب؟',
          options: [
            { code: 'less_than_egp_250000', labelEn: 'Less than 250,000 EGP', labelAr: 'أقل من 250,000 جنيه' },
            { code: 'egp_250000_1_million', labelEn: '250,000 – 1 million EGP', labelAr: '250,000 – مليون جنيه' },
            { code: 'egp_1_5_million', labelEn: '1 – 5 million EGP', labelAr: '1 – 5 مليون جنيه' },
            { code: 'more_than_egp_5_million', labelEn: 'More than 5 million EGP', labelAr: 'أكثر من 5 مليون جنيه' },
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
        {
          code: 'repayment_period', questionEn: 'How long do you want to pay it back?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { code: 'less_than_2_years', labelEn: 'Less than 2 years', labelAr: 'أقل من سنتين' },
            { code: '2_5_years', labelEn: '2 – 5 years', labelAr: '2 – 5 سنوات' },
            { code: 'more_than_5_years', labelEn: 'More than 5 years', labelAr: 'أكثر من 5 سنوات' },
          ],
        },
      ],
    },
    {
      code: 'financial_info', titleEn: 'Your business money', titleAr: 'المعلومات المالية',
      questions: [
        {
          code: 'monthly_revenue', questionEn: 'How much money does the business make each month?', questionAr: 'ما متوسط الإيرادات الشهرية للنشاط؟',
          options: [
            { code: 'less_than_egp_50000', labelEn: 'Less than 50,000 EGP', labelAr: 'أقل من 50,000 جنيه', points: 20 },
            { code: 'egp_50000_200000', labelEn: '50,000 – 200,000 EGP', labelAr: '50,000 – 200,000 جنيه', points: 50 },
            { code: 'egp_200000_500000', labelEn: '200,000 – 500,000 EGP', labelAr: '200,000 – 500,000 جنيه', points: 75 },
            { code: 'more_than_egp_500000', labelEn: 'More than 500,000 EGP', labelAr: 'أكثر من 500,000 جنيه', points: 100 },
          ],
        },
        { code: 'business_account', questionEn: 'Do you have a bank account for the business?', questionAr: 'هل لديك حساب بنكي للنشاط؟', isRequired: false, options: YESNO(100, 50) },
        { code: 'registered', questionEn: 'Is your business officially registered?', questionAr: 'هل النشاط مسجل رسميًا؟', isRequired: false, options: [
          { code: 'yes', labelEn: 'Yes', labelAr: 'نعم', points: 100 },
          { code: 'no', labelEn: 'No', labelAr: 'لا', points: 40 },
          { code: 'registration_in_progress', labelEn: 'We are registering it now', labelAr: 'التسجيل جارٍ', points: 65 },
        ] },
        { code: 'tax_registration', questionEn: 'Do you have a tax card or commercial register?', questionAr: 'هل لديك سجل ضريبي أو تجاري؟', isRequired: false, options: YESNO(100, 45) },
      ],
    },
    {
      code: 'obligations_credit', titleEn: 'Business loans you have', titleAr: 'الالتزامات والحالة الائتمانية',
      questions: [
        { code: 'current_facilities', questionEn: 'Does the business have any loans or credit right now?', questionAr: 'هل لدى النشاط تسهيلات أو قروض حالية؟', options: YESNO(40, 100) },
        {
          code: 'current_installments', questionEn: 'How much does the business pay each month now?', questionAr: 'إجمالي الالتزام المالي الشهري الحالي؟',
          options: [
            { code: 'less_than_egp_10000', labelEn: 'Less than 10,000 EGP', labelAr: 'أقل من 10,000 جنيه', points: 100 },
            { code: 'egp_10000_50000', labelEn: '10,000 – 50,000 EGP', labelAr: '10,000 – 50,000 جنيه', points: 60 },
            { code: 'more_than_egp_50000', labelEn: 'More than 50,000 EGP', labelAr: 'أكثر من 50,000 جنيه', points: 25 },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Has a bank ever said no to your business?', questionAr: 'هل سبق رفض طلب تمويل للنشاط؟', isRequired: false, options: YESNO(25, 100) },
      ],
    },
    {
      code: 'preferences', titleEn: 'What matters to you', titleAr: 'التفضيلات والدعم',
      questions: [
        {
          code: 'priority_factor', questionEn: 'What matters most to you in a business loan?', questionAr: 'أهم ما تبحث عنه في تمويل النشاط؟', isRequired: false,
          options: [
            // Sits in the same merged list as `fastest_approval`, so the two must
            // read as a real choice and not as the same sentence twice.
            { code: 'fast_approval', labelEn: 'A quick answer, even if not the fastest', labelAr: 'موافقة سريعة' },
            { code: 'flexible_repayment', labelEn: 'Easy ways to pay it back', labelAr: 'سداد مرن' },
            { code: 'highest_financing_amount', labelEn: 'The biggest amount', labelAr: 'أعلى مبلغ تمويل' },
            { code: 'lowest_interest_rate', labelEn: 'The lowest interest', labelAr: 'أقل سعر فائدة' },
            { code: 'least_documentation_required', labelEn: 'The fewest papers', labelAr: 'أقل أوراق مطلوبة' },
          ],
        },
        { code: 'needs_consultation', questionEn: 'Do you want help from a business loan expert?', questionAr: 'هل تحتاج استشارة خبير تمويل أعمال؟', isRequired: false, options: YESNO() },
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
  isRequired: boolean;
  enabledWhen?: SeedEnabledWhen;
  options: { code: string; labelEn: string; labelAr: string }[];
}

export async function seedQuestionnaire(): Promise<void> {
  // ---- 1. Merge all four category configs into ONE global deduped pool ------
  // Feature 010: questions carry no category. Groups + questions dedupe by code
  // (first config wins for content; option sets are UNIONed by code). Each
  // question remembers which categories it appeared in, so a program can be
  // pre-assigned exactly its own category's questions (the migration's rule).
  const groupOrder: string[] = [];
  const groupByCode = new Map<string, SeedGroup>();
  const questionOrder: string[] = [];
  const questionByCode = new Map<string, MergedQuestion>();
  const pointsByAnswer: Record<string, Record<string, number>> = {};
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
          ? await bankOptions()
          : q.optionsFromEnum
            ? await enumOptions(q.optionsFromEnum)
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
            isRequired: q.isRequired ?? true,
            ...(q.enabledWhen ? { enabledWhen: q.enabledWhen } : {}),
            options: [],
          };
          questionByCode.set(q.code, mq);
          questionOrder.push(q.code);
        }
        for (const o of optionList) {
          const code = o.code ?? slug(o.labelEn);
          // First-seen points win; every answer keeps a non-zero score.
          (pointsByAnswer[q.code] ??= {})[code] ??= o.points ?? NEUTRAL_SCORE;
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
      isRequired: question.isRequired ?? true,
      options: [],
    });
    questionOrder.unshift(question.code);
  }

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
    const question = await prisma.question.upsert({
      where: { code },
      update: {
        groupId: groupIdByCode.get(q.groupCode)!, questionEn: q.questionEn, questionAr: q.questionAr,
        displayOrder: qOrder, isRequired: q.isRequired, isActive: true,
        ...typeColumns, ...branchColumn,
      },
      create: {
        groupId: groupIdByCode.get(q.groupCode)!, code,
        questionEn: q.questionEn, questionAr: q.questionAr, displayOrder: qOrder, isRequired: q.isRequired,
        ...typeColumns, ...branchColumn,
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

  // ---- 3. Publish ONE global snapshot ---------------------------------------
  await publishVersion();

  // ---- 4. Per-program weight sets: each active program is pre-assigned the
  //         questions from its OWN category (equal weights sum 100 + per-answer
  //         scores scaled by a multiplier). Assignment = questionWeights keys. --
  const programs = await prisma.bankProgram.findMany({
    where: { active: true },
    select: { id: true, productCategory: true },
  });
  let setCount = 0;
  for (let i = 0; i < programs.length; i++) {
    const p = programs[i]!;
    const cat = p.productCategory.toLowerCase() as Category;
    // Only SINGLE_SELECT questions are assignable (R9 / A33): the formula needs
    // one picked answer score per question, which NUMERIC/TEXT/MULTI_SELECT
    // cannot supply. Weights still sum to 100 over the assigned set.
    const assigned = questionOrder.filter(
      (qc) =>
        categoriesByQuestion[qc]?.has(cat) &&
        (questionByCode.get(qc)?.type ?? 'SINGLE_SELECT') === 'SINGLE_SELECT',
    );
    if (assigned.length === 0) continue; // no questions for this category → scores 0
    const mult = PROGRAM_POINT_MULTIPLIERS[i % PROGRAM_POINT_MULTIPLIERS.length]!;
    const questionWeights = equalWeights(assigned);
    const answerScores: Record<string, Record<string, number>> = {};
    for (const qc of assigned) {
      answerScores[qc] = {};
      for (const [oCode, pts] of Object.entries(pointsByAnswer[qc] ?? {})) {
        // Floor at 1 so a low base × low multiplier never rounds down to 0.
        answerScores[qc][oCode] = Math.min(100, Math.max(1, Math.round(pts * mult)));
      }
    }
    const weights = { questionWeights, answerScores };
    const existingActive = await prisma.scoringWeightSet.findFirst({ where: { bankProgramId: p.id, status: 'ACTIVE' } });
    if (existingActive) {
      await prisma.scoringWeightSet.update({ where: { id: existingActive.id }, data: { weights } });
      setCount += 1;
      continue;
    }
    const last = await prisma.scoringWeightSet.findFirst({ where: { bankProgramId: p.id }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
    await prisma.scoringWeightSet.create({
      data: { bankProgramId: p.id, status: 'ACTIVE', versionNumber: (last?.versionNumber ?? 0) + 1, weights, createdBy: SEED_ACTOR, approvedBy: SEED_ACTOR, approvedAt: new Date() },
    });
    setCount += 1;
  }

  console.log(
    `seed-questionnaire: ${groupOrder.length} groups, ${questionOrder.length} questions (global), ${setCount} program weight sets.`,
  );
}

async function publishVersion(): Promise<void> {
  const groups = await prisma.questionGroup.findMany({ where: { isActive: true }, orderBy: { displayOrder: 'asc' } });
  const snapshotGroups = [];
  for (const g of groups) {
    const questions = await prisma.question.findMany({ where: { groupId: g.id, isActive: true }, orderBy: { displayOrder: 'asc' } });
    const qOut = [];
    for (const q of questions) {
      const options = await prisma.questionOption.findMany({ where: { questionId: q.id, isActive: true }, orderBy: { displayOrder: 'asc' } });
      qOut.push({
        code: q.code, type: q.type, questionAr: q.questionAr, questionEn: q.questionEn,
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
