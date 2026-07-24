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
import { PrismaClient } from '@prisma/client';

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

interface SeedOption {
  labelEn: string;
  labelAr: string;
  /** Stable option code; defaults to slug(labelEn). Set for enum-backed options. */
  code?: string;
  /** Seed-only desirability hint (0..100). Becomes the program's per-answer points. */
  points?: number;
}
interface SeedQuestion {
  code: string;
  questionEn: string;
  questionAr: string;
  isRequired?: boolean; // default true
  /** When set, options are expanded from the active `platform_enumeration`
   *  members of this type at seed time — single source of truth (e.g. governorate),
   *  so mobile still gets the list inside the one questionnaire snapshot call. */
  optionsFromEnum?: string;
  options: SeedOption[];
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
  { labelEn: 'Government employee', labelAr: 'موظف حكومي', points: 100 },
  { labelEn: 'Private sector employee', labelAr: 'موظف قطاع خاص', points: 85 },
  { labelEn: 'Business owner / company owner', labelAr: 'صاحب عمل / شركة', points: 70 },
  { labelEn: 'Freelancer', labelAr: 'عمل حر', points: 45 },
  { labelEn: 'Retired', labelAr: 'متقاعد', points: 55 },
];

const YESNO = (yesPoints?: number, noPoints?: number): SeedOption[] => [
  { labelEn: 'Yes', labelAr: 'نعم', ...(yesPoints != null ? { points: yesPoints } : {}) },
  { labelEn: 'No', labelAr: 'لا', ...(noPoints != null ? { points: noPoints } : {}) },
];

const AGE_Q: SeedQuestion = {
  code: 'your_age', questionEn: 'Your age', questionAr: 'عمرك',
  options: [
    { labelEn: '21 – 30', labelAr: '21 – 30', points: 70 },
    { labelEn: '31 – 45', labelAr: '31 – 45', points: 100 },
    { labelEn: '46 – 60', labelAr: '46 – 60', points: 75 },
    { labelEn: 'More than 60', labelAr: 'أكثر من 60', points: 35 },
  ],
};
const SALARY_TRANSFER_Q: SeedQuestion = {
  code: 'salary_transfer', questionEn: 'Is your salary transferred to a bank account?', questionAr: 'هل يتم تحويل راتبك إلى حساب بنكي؟',
  options: [
    { labelEn: 'Yes', labelAr: 'نعم', points: 100 },
    { labelEn: 'No', labelAr: 'لا', points: 20 },
  ],
};

// ── PERSONAL ────────────────────────────────────────────────────────────────
const PERSONAL: CategoryConfig = {
  category: 'personal',
  groups: [
    {
      code: 'financing_info', titleEn: 'Financing Information', titleAr: 'معلومات التمويل',
      questions: [
        {
          code: 'amount_requested', questionEn: 'What is the approximate amount you need?', questionAr: 'ما المبلغ التقريبي الذي تحتاجه؟',
          options: [
            { labelEn: 'Less than EGP 50,000', labelAr: 'أقل من 50,000 جنيه' },
            { labelEn: 'EGP 50,000 – 150,000', labelAr: '50,000 – 150,000 جنيه' },
            { labelEn: 'EGP 150,000 – 500,000', labelAr: '150,000 – 500,000 جنيه' },
            { labelEn: 'More than EGP 500,000', labelAr: 'أكثر من 500,000 جنيه' },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { labelEn: 'Less than 3 years', labelAr: 'أقل من 3 سنوات' },
            { labelEn: '3 to 5 years', labelAr: 'من 3 إلى 5 سنوات' },
            { labelEn: '5 to 7 years', labelAr: 'من 5 إلى 7 سنوات' },
            { labelEn: 'More than 7 years', labelAr: 'أكثر من 7 سنوات' },
          ],
        },
        {
          code: 'loan_purpose', questionEn: 'What is the purpose of the loan?', questionAr: 'ما الغرض من القرض؟',
          isRequired: false,
          options: [
            { labelEn: 'Home finishing / renovation', labelAr: 'تشطيب / تجديد المنزل' },
            { labelEn: 'Marriage', labelAr: 'زواج' },
            { labelEn: 'Purchasing appliances or furniture', labelAr: 'شراء أجهزة أو أثاث' },
            { labelEn: 'Education', labelAr: 'تعليم' },
            { labelEn: 'Debt consolidation / settling obligations', labelAr: 'سداد التزامات' },
            { labelEn: 'Personal project', labelAr: 'مشروع شخصي' },
            { labelEn: 'Other', labelAr: 'أخرى' },
          ],
        },
        AGE_Q,
      ],
    },
    {
      code: 'employment_income', titleEn: 'Employment & Income Information', titleAr: 'معلومات العمل والدخل',
      questions: [
        {
          code: 'employment_status', questionEn: 'What is your employment status?', questionAr: 'ما هي حالتك الوظيفية؟',
          options: EMPLOYMENT_OPTIONS,
        },
        {
          code: 'job_tenure', questionEn: 'How long have you been in your current job?', questionAr: 'منذ متى وأنت في وظيفتك الحالية؟',
          options: [
            { labelEn: 'Less than 6 months', labelAr: 'أقل من 6 أشهر', points: 15 },
            { labelEn: '6 months to 1 year', labelAr: 'من 6 أشهر إلى سنة', points: 35 },
            { labelEn: '1 to 3 years', labelAr: 'من 1 إلى 3 سنوات', points: 60 },
            { labelEn: 'More than 3 years', labelAr: 'أكثر من 3 سنوات', points: 100 },
          ],
        },
        {
          code: 'monthly_income', questionEn: 'What is your average monthly income?', questionAr: 'ما متوسط دخلك الشهري؟',
          options: [
            { labelEn: 'Less than EGP 10,000', labelAr: 'أقل من 10,000 جنيه', points: 20 },
            { labelEn: 'EGP 10,000 – 20,000', labelAr: '10,000 – 20,000 جنيه', points: 50 },
            { labelEn: 'EGP 20,000 – 40,000', labelAr: '20,000 – 40,000 جنيه', points: 75 },
            { labelEn: 'More than EGP 40,000', labelAr: 'أكثر من 40,000 جنيه', points: 100 },
          ],
        },
        SALARY_TRANSFER_Q,
        {
          code: 'salary_bank', questionEn: 'Which bank do you receive your salary through?', questionAr: 'من خلال أي بنك تستلم راتبك؟',
          isRequired: false,
          options: [
            { labelEn: 'A specific bank', labelAr: 'بنك محدد' },
            { labelEn: 'No specific bank', labelAr: 'لا يوجد بنك محدد' },
          ],
        },
        {
          code: 'employer_approved', questionEn: 'Is your employer approved by banks?', questionAr: 'هل جهة عملك معتمدة لدى البنوك؟',
          isRequired: false, options: [
            { labelEn: 'Yes', labelAr: 'نعم', points: 100 },
            { labelEn: 'No', labelAr: 'لا', points: 40 },
            { labelEn: 'Not sure', labelAr: 'غير متأكد', points: 65 },
          ],
        },
      ],
    },
    {
      code: 'commitments', titleEn: 'Banking Commitments', titleAr: 'الالتزامات البنكية',
      questions: [
        {
          code: 'current_loans', questionEn: 'Do you currently have any loans or obligations?', questionAr: 'هل لديك قروض أو التزامات حالية؟',
          options: [
            { labelEn: 'None', labelAr: 'لا يوجد', points: 100 },
            { labelEn: 'Personal loan', labelAr: 'قرض شخصي', points: 55 },
            { labelEn: 'Car loan', labelAr: 'قرض سيارة', points: 55 },
            { labelEn: 'Mortgage', labelAr: 'قرض عقاري', points: 50 },
            { labelEn: 'Credit cards', labelAr: 'بطاقات ائتمان', points: 60 },
            { labelEn: 'Other', labelAr: 'أخرى', points: 50 },
          ],
        },
        {
          code: 'current_installments', questionEn: 'Total approximate current monthly installments?', questionAr: 'إجمالي الأقساط الشهرية الحالية تقريبًا؟',
          options: [
            { labelEn: 'Less than EGP 2,000', labelAr: 'أقل من 2,000 جنيه', points: 100 },
            { labelEn: 'EGP 2,000 – 5,000', labelAr: '2,000 – 5,000 جنيه', points: 75 },
            { labelEn: 'EGP 5,000 – 10,000', labelAr: '5,000 – 10,000 جنيه', points: 50 },
            { labelEn: 'More than EGP 10,000', labelAr: 'أكثر من 10,000 جنيه', points: 25 },
          ],
        },
        { code: 'has_credit_card', questionEn: 'Do you have a credit card?', questionAr: 'هل لديك بطاقة ائتمان؟', isRequired: false, options: YESNO() },
        {
          code: 'card_usage', questionEn: 'Average monthly credit card usage?', questionAr: 'متوسط استخدام البطاقة الشهري؟',
          isRequired: false,
          options: [
            { labelEn: 'Less than EGP 5,000', labelAr: 'أقل من 5,000 جنيه' },
            { labelEn: 'EGP 5,000 – 15,000', labelAr: '5,000 – 15,000 جنيه' },
            { labelEn: 'More than EGP 15,000', labelAr: 'أكثر من 15,000 جنيه' },
          ],
        },
      ],
    },
    {
      code: 'preferences', titleEn: 'Preferences & Eligibility', titleAr: 'التفضيلات والأهلية',
      questions: [
        {
          code: 'priority_factor', questionEn: 'Most important factor when choosing financing?', questionAr: 'أهم عامل عند اختيار التمويل؟',
          isRequired: false,
          options: [
            { labelEn: 'Lowest monthly installment', labelAr: 'أقل قسط شهري' },
            { labelEn: 'Lowest interest rate', labelAr: 'أقل سعر فائدة' },
            { labelEn: 'Fastest approval', labelAr: 'أسرع موافقة' },
            { labelEn: 'Least documentation required', labelAr: 'أقل أوراق مطلوبة' },
            { labelEn: 'Flexible repayment', labelAr: 'سداد مرن' },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Have you ever had a financing application rejected?', questionAr: 'هل سبق رفض طلب تمويل لك؟', isRequired: false, options: YESNO(25, 100) },
        { code: 'needs_consultant', questionEn: 'Do you need assistance from a financing consultant?', questionAr: 'هل تحتاج مساعدة مستشار تمويل؟', isRequired: false, options: YESNO() },
      ],
    },
  ],
};

// ── MORTGAGE ──────────────────────────────────────────────────────────────
const MORTGAGE: CategoryConfig = {
  category: 'mortgage',
  groups: [
    {
      code: 'property_financing', titleEn: 'Property & Financing Information', titleAr: 'معلومات العقار والتمويل',
      questions: [
        {
          code: 'property_type', questionEn: 'What type of property would you like to finance?', questionAr: 'ما نوع العقار الذي ترغب في تمويله؟', isRequired: false,
          options: [
            { labelEn: 'Apartment', labelAr: 'شقة' },
            { labelEn: 'Villa', labelAr: 'فيلا' },
            { labelEn: 'Duplex', labelAr: 'دوبلكس' },
            { labelEn: 'Commercial shop', labelAr: 'محل تجاري' },
            { labelEn: 'Administrative office', labelAr: 'مكتب إداري' },
            { labelEn: 'Other', labelAr: 'أخرى' },
          ],
        },
        { code: 'in_compound', questionEn: 'Is the property within a residential compound?', questionAr: 'هل العقار داخل كمبوند سكني؟', isRequired: false, options: YESNO() },
        {
          code: 'registration_status', questionEn: "What is the property's registration status?", questionAr: 'ما حالة تسجيل العقار؟', isRequired: false,
          options: [
            { labelEn: 'Officially registered', labelAr: 'مسجل رسميًا' },
            { labelEn: 'Eligible for registration', labelAr: 'قابل للتسجيل' },
            { labelEn: 'Not registered', labelAr: 'غير مسجل' },
            { labelEn: 'Not sure', labelAr: 'غير متأكد' },
          ],
        },
        {
          // Options expanded from the active `governorate` platform-enumeration members.
          code: 'governorate', questionEn: 'In which governorate is the property located?', questionAr: 'في أي محافظة يقع العقار؟', isRequired: false,
          optionsFromEnum: 'governorate', options: [],
        },
        {
          code: 'property_value', questionEn: 'What is the approximate property value?', questionAr: 'ما القيمة التقريبية للعقار؟',
          options: [
            { labelEn: 'Less than EGP 1 million', labelAr: 'أقل من مليون جنيه' },
            { labelEn: 'EGP 1 – 3 million', labelAr: '1 – 3 مليون جنيه' },
            { labelEn: 'EGP 3 – 5 million', labelAr: '3 – 5 مليون جنيه' },
            { labelEn: 'More than EGP 5 million', labelAr: 'أكثر من 5 مليون جنيه' },
          ],
        },
        {
          code: 'down_payment', questionEn: 'How much down payment do you have available?', questionAr: 'ما حجم الدفعة المقدمة المتاحة لديك؟',
          options: [
            { labelEn: 'Less than 10%', labelAr: 'أقل من 10%', points: 20 },
            { labelEn: '10% – 20%', labelAr: '10% – 20%', points: 50 },
            { labelEn: '20% – 30%', labelAr: '20% – 30%', points: 75 },
            { labelEn: 'More than 30%', labelAr: 'أكثر من 30%', points: 100 },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { labelEn: 'Less than 10 years', labelAr: 'أقل من 10 سنوات' },
            { labelEn: '10 – 15 years', labelAr: '10 – 15 سنة' },
            { labelEn: '15 – 20 years', labelAr: '15 – 20 سنة' },
            { labelEn: 'More than 20 years', labelAr: 'أكثر من 20 سنة' },
          ],
        },
        AGE_Q,
      ],
    },
    {
      code: 'income_employment', titleEn: 'Income & Employment Information', titleAr: 'معلومات الدخل والعمل',
      questions: [
        { code: 'employment_status', questionEn: 'What is your employment status?', questionAr: 'ما هي حالتك الوظيفية؟', options: EMPLOYMENT_OPTIONS },
        {
          code: 'monthly_income', questionEn: 'What is your average monthly income?', questionAr: 'ما متوسط دخلك الشهري؟',
          options: [
            { labelEn: 'Less than EGP 15,000', labelAr: 'أقل من 15,000 جنيه', points: 20 },
            { labelEn: 'EGP 15,000 – 30,000', labelAr: '15,000 – 30,000 جنيه', points: 50 },
            { labelEn: 'EGP 30,000 – 60,000', labelAr: '30,000 – 60,000 جنيه', points: 75 },
            { labelEn: 'More than EGP 60,000', labelAr: 'أكثر من 60,000 جنيه', points: 100 },
          ],
        },
        SALARY_TRANSFER_Q,
        { code: 'additional_income', questionEn: 'Do you have additional sources of income?', questionAr: 'هل لديك مصادر دخل إضافية؟', isRequired: false, options: YESNO(100, 70) },
        { code: 'active_account', questionEn: 'Do you have an active bank account?', questionAr: 'هل لديك حساب بنكي نشط؟', isRequired: false, options: YESNO(100, 40) },
      ],
    },
    {
      code: 'credit_status', titleEn: 'Credit Status', titleAr: 'الحالة الائتمانية',
      questions: [
        { code: 'current_loans', questionEn: 'Do you currently have any loans or obligations?', questionAr: 'هل لديك قروض أو التزامات حالية؟', options: YESNO(40, 100) },
        {
          code: 'current_installments', questionEn: 'What is your total current monthly installment amount?', questionAr: 'ما إجمالي قسطك الشهري الحالي؟',
          options: [
            { labelEn: 'Less than EGP 5,000', labelAr: 'أقل من 5,000 جنيه', points: 100 },
            { labelEn: 'EGP 5,000 – 15,000', labelAr: '5,000 – 15,000 جنيه', points: 70 },
            { labelEn: 'EGP 15,000 – 30,000', labelAr: '15,000 – 30,000 جنيه', points: 45 },
            { labelEn: 'More than EGP 30,000', labelAr: 'أكثر من 30,000 جنيه', points: 20 },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Have you ever had a mortgage application rejected?', questionAr: 'هل سبق رفض طلب تمويل عقاري لك؟', isRequired: false, options: YESNO(25, 100) },
      ],
    },
    {
      code: 'preferences', titleEn: 'Preferences', titleAr: 'التفضيلات',
      questions: [
        {
          code: 'priority_factor', questionEn: 'Most important thing you look for in a mortgage?', questionAr: 'أهم ما تبحث عنه في التمويل العقاري؟', isRequired: false,
          options: [
            { labelEn: 'Lowest monthly installment', labelAr: 'أقل قسط شهري' },
            { labelEn: 'Longest repayment period', labelAr: 'أطول مدة سداد' },
            { labelEn: 'Lowest down payment', labelAr: 'أقل دفعة مقدمة' },
            { labelEn: 'Fastest approval', labelAr: 'أسرع موافقة' },
            { labelEn: 'Lowest administrative fees', labelAr: 'أقل رسوم إدارية' },
          ],
        },
        { code: 'needs_assistance', questionEn: 'Do you need assistance preparing documents?', questionAr: 'هل تحتاج مساعدة في تجهيز المستندات؟', isRequired: false, options: YESNO() },
      ],
    },
  ],
};

// ── CAR ──────────────────────────────────────────────────────────────────
const CAR: CategoryConfig = {
  category: 'car',
  groups: [
    {
      code: 'vehicle_financing', titleEn: 'Vehicle & Financing Information', titleAr: 'معلومات السيارة والتمويل',
      questions: [
        { code: 'vehicle_condition', questionEn: 'Is the vehicle new or used?', questionAr: 'هل السيارة جديدة أم مستعملة؟', isRequired: false, options: [
          { labelEn: 'New', labelAr: 'جديدة' },
          { labelEn: 'Used', labelAr: 'مستعملة' },
        ] },
        {
          code: 'model_year', questionEn: 'What is the vehicle model year?', questionAr: 'ما سنة موديل السيارة؟', isRequired: false,
          options: [
            { labelEn: 'Current year model', labelAr: 'موديل السنة الحالية' },
            { labelEn: 'Within the last 3 years', labelAr: 'خلال آخر 3 سنوات' },
            { labelEn: '3 to 5 years old', labelAr: 'من 3 إلى 5 سنوات' },
            { labelEn: 'More than 5 years old', labelAr: 'أكثر من 5 سنوات' },
          ],
        },
        {
          code: 'vehicle_price', questionEn: 'What is the approximate vehicle price?', questionAr: 'ما السعر التقريبي للسيارة؟',
          options: [
            { labelEn: 'Less than EGP 500,000', labelAr: 'أقل من 500,000 جنيه' },
            { labelEn: 'EGP 500,000 – 1 million', labelAr: '500,000 – مليون جنيه' },
            { labelEn: 'EGP 1 – 2 million', labelAr: '1 – 2 مليون جنيه' },
            { labelEn: 'More than EGP 2 million', labelAr: 'أكثر من 2 مليون جنيه' },
          ],
        },
        {
          code: 'down_payment', questionEn: 'How much down payment do you have available?', questionAr: 'ما حجم الدفعة المقدمة المتاحة لديك؟',
          options: [
            { labelEn: 'No down payment', labelAr: 'بدون دفعة مقدمة', points: 10 },
            { labelEn: 'Less than 20%', labelAr: 'أقل من 20%', points: 40 },
            { labelEn: '20% – 40%', labelAr: '20% – 40%', points: 70 },
            { labelEn: 'More than 40%', labelAr: 'أكثر من 40%', points: 100 },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { labelEn: 'Less than 3 years', labelAr: 'أقل من 3 سنوات' },
            { labelEn: '3 – 5 years', labelAr: '3 – 5 سنوات' },
            { labelEn: '5 – 7 years', labelAr: '5 – 7 سنوات' },
            { labelEn: 'More than 7 years', labelAr: 'أكثر من 7 سنوات' },
          ],
        },
        AGE_Q,
      ],
    },
    {
      code: 'employment_income', titleEn: 'Employment & Income', titleAr: 'العمل والدخل',
      questions: [
        { code: 'employment_status', questionEn: 'What is your employment status?', questionAr: 'ما هي حالتك الوظيفية؟', options: EMPLOYMENT_OPTIONS },
        {
          code: 'monthly_income', questionEn: 'What is your average monthly income?', questionAr: 'ما متوسط دخلك الشهري؟',
          options: [
            { labelEn: 'Less than EGP 10,000', labelAr: 'أقل من 10,000 جنيه', points: 20 },
            { labelEn: 'EGP 10,000 – 25,000', labelAr: '10,000 – 25,000 جنيه', points: 50 },
            { labelEn: 'EGP 25,000 – 50,000', labelAr: '25,000 – 50,000 جنيه', points: 75 },
            { labelEn: 'More than EGP 50,000', labelAr: 'أكثر من 50,000 جنيه', points: 100 },
          ],
        },
        SALARY_TRANSFER_Q,
        { code: 'employer_approved', questionEn: 'Is your employer approved by banks?', questionAr: 'هل جهة عملك معتمدة لدى البنوك؟', isRequired: false, options: [
          { labelEn: 'Yes', labelAr: 'نعم', points: 100 },
          { labelEn: 'No', labelAr: 'لا', points: 40 },
          { labelEn: 'Not sure', labelAr: 'غير متأكد', points: 65 },
        ] },
      ],
    },
    {
      code: 'financial_status', titleEn: 'Financial Status', titleAr: 'الحالة المالية',
      questions: [
        { code: 'current_loans', questionEn: 'Do you currently have obligations or loans?', questionAr: 'هل لديك التزامات أو قروض حالية؟', options: YESNO(40, 100) },
        {
          code: 'current_installments', questionEn: 'What is your total current monthly installment amount?', questionAr: 'ما إجمالي قسطك الشهري الحالي؟',
          options: [
            { labelEn: 'Less than EGP 3,000', labelAr: 'أقل من 3,000 جنيه', points: 100 },
            { labelEn: 'EGP 3,000 – 7,000', labelAr: '3,000 – 7,000 جنيه', points: 70 },
            { labelEn: 'EGP 7,000 – 15,000', labelAr: '7,000 – 15,000 جنيه', points: 45 },
            { labelEn: 'More than EGP 15,000', labelAr: 'أكثر من 15,000 جنيه', points: 20 },
          ],
        },
        { code: 'has_credit_card', questionEn: 'Do you have active credit cards?', questionAr: 'هل لديك بطاقات ائتمان نشطة؟', isRequired: false, options: YESNO() },
      ],
    },
    {
      code: 'preferences', titleEn: 'Preferences', titleAr: 'التفضيلات',
      questions: [
        {
          code: 'priority_factor', questionEn: 'Primary priority when choosing a car loan?', questionAr: 'أهم أولوية عند اختيار تمويل السيارة؟', isRequired: false,
          options: [
            { labelEn: 'Lowest down payment', labelAr: 'أقل دفعة مقدمة' },
            { labelEn: 'Lowest monthly installment', labelAr: 'أقل قسط شهري' },
            { labelEn: 'Fastest approval', labelAr: 'أسرع موافقة' },
            { labelEn: 'Lowest interest rate', labelAr: 'أقل سعر فائدة' },
            { labelEn: 'Financing without a guarantor', labelAr: 'تمويل بدون ضامن' },
          ],
        },
        { code: 'wants_insurance', questionEn: 'Would you like vehicle insurance offers?', questionAr: 'هل ترغب في عروض تأمين السيارة؟', isRequired: false, options: YESNO() },
      ],
    },
  ],
};

// ── BUSINESS ────────────────────────────────────────────────────────────────
const BUSINESS: CategoryConfig = {
  category: 'business',
  groups: [
    {
      code: 'business_financing', titleEn: 'Business & Financing Information', titleAr: 'معلومات النشاط والتمويل',
      questions: [
        {
          code: 'activity_type', questionEn: 'What type of business activity do you operate?', questionAr: 'ما نوع النشاط التجاري الذي تديره؟', isRequired: false,
          options: [
            { labelEn: 'Trade', labelAr: 'تجارة' },
            { labelEn: 'Services', labelAr: 'خدمات' },
            { labelEn: 'Restaurants & Cafés', labelAr: 'مطاعم وكافيهات' },
            { labelEn: 'Manufacturing', labelAr: 'تصنيع' },
            { labelEn: 'Technology', labelAr: 'تكنولوجيا' },
            { labelEn: 'Other', labelAr: 'أخرى' },
          ],
        },
        {
          code: 'business_age', questionEn: 'How long has the business been operating?', questionAr: 'منذ متى والنشاط يعمل؟',
          options: [
            { labelEn: 'Less than 1 year', labelAr: 'أقل من سنة', points: 30 },
            { labelEn: '1 to 2 years', labelAr: 'من 1 إلى 2 سنة', points: 60 },
            { labelEn: 'More than 2 years', labelAr: 'أكثر من سنتين', points: 100 },
          ],
        },
        {
          code: 'financing_amount', questionEn: 'What is the approximate financing amount required?', questionAr: 'ما مبلغ التمويل التقريبي المطلوب؟',
          options: [
            { labelEn: 'Less than EGP 250,000', labelAr: 'أقل من 250,000 جنيه' },
            { labelEn: 'EGP 250,000 – 1 million', labelAr: '250,000 – مليون جنيه' },
            { labelEn: 'EGP 1 – 5 million', labelAr: '1 – 5 مليون جنيه' },
            { labelEn: 'More than EGP 5 million', labelAr: 'أكثر من 5 مليون جنيه' },
          ],
        },
        {
          code: 'financing_purpose', questionEn: 'What is the primary purpose of the financing?', questionAr: 'ما الغرض الأساسي من التمويل؟', isRequired: false,
          options: [
            { labelEn: 'Expansion', labelAr: 'توسع' },
            { labelEn: 'Purchasing equipment', labelAr: 'شراء معدات' },
            { labelEn: 'Working capital', labelAr: 'رأس مال عامل' },
            { labelEn: 'Opening a new branch', labelAr: 'فتح فرع جديد' },
            { labelEn: 'Settling obligations', labelAr: 'سداد التزامات' },
            { labelEn: 'Other', labelAr: 'أخرى' },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟',
          options: [
            { labelEn: 'Less than 2 years', labelAr: 'أقل من سنتين' },
            { labelEn: '2 – 5 years', labelAr: '2 – 5 سنوات' },
            { labelEn: 'More than 5 years', labelAr: 'أكثر من 5 سنوات' },
          ],
        },
      ],
    },
    {
      code: 'financial_info', titleEn: 'Financial Information', titleAr: 'المعلومات المالية',
      questions: [
        {
          code: 'monthly_revenue', questionEn: 'What is the average monthly business revenue?', questionAr: 'ما متوسط الإيرادات الشهرية للنشاط؟',
          options: [
            { labelEn: 'Less than EGP 50,000', labelAr: 'أقل من 50,000 جنيه', points: 20 },
            { labelEn: 'EGP 50,000 – 200,000', labelAr: '50,000 – 200,000 جنيه', points: 50 },
            { labelEn: 'EGP 200,000 – 500,000', labelAr: '200,000 – 500,000 جنيه', points: 75 },
            { labelEn: 'More than EGP 500,000', labelAr: 'أكثر من 500,000 جنيه', points: 100 },
          ],
        },
        { code: 'business_account', questionEn: 'Do you have a business bank account?', questionAr: 'هل لديك حساب بنكي للنشاط؟', isRequired: false, options: YESNO(100, 50) },
        { code: 'registered', questionEn: 'Is the business officially registered?', questionAr: 'هل النشاط مسجل رسميًا؟', isRequired: false, options: [
          { labelEn: 'Yes', labelAr: 'نعم', points: 100 },
          { labelEn: 'No', labelAr: 'لا', points: 40 },
          { labelEn: 'Registration in progress', labelAr: 'التسجيل جارٍ', points: 65 },
        ] },
        { code: 'tax_registration', questionEn: 'Do you have a tax or commercial registration?', questionAr: 'هل لديك سجل ضريبي أو تجاري؟', isRequired: false, options: YESNO(100, 45) },
      ],
    },
    {
      code: 'obligations_credit', titleEn: 'Obligations & Credit Status', titleAr: 'الالتزامات والحالة الائتمانية',
      questions: [
        { code: 'current_facilities', questionEn: 'Does the business currently have financing facilities or loans?', questionAr: 'هل لدى النشاط تسهيلات أو قروض حالية؟', options: YESNO(40, 100) },
        {
          code: 'current_installments', questionEn: 'Total current monthly financial obligation amount?', questionAr: 'إجمالي الالتزام المالي الشهري الحالي؟',
          options: [
            { labelEn: 'Less than EGP 10,000', labelAr: 'أقل من 10,000 جنيه', points: 100 },
            { labelEn: 'EGP 10,000 – 50,000', labelAr: '10,000 – 50,000 جنيه', points: 60 },
            { labelEn: 'More than EGP 50,000', labelAr: 'أكثر من 50,000 جنيه', points: 25 },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Has a financing request for the business ever been rejected?', questionAr: 'هل سبق رفض طلب تمويل للنشاط؟', isRequired: false, options: YESNO(25, 100) },
      ],
    },
    {
      code: 'preferences', titleEn: 'Preferences & Support', titleAr: 'التفضيلات والدعم',
      questions: [
        {
          code: 'priority_factor', questionEn: 'Most important thing in business financing?', questionAr: 'أهم ما تبحث عنه في تمويل النشاط؟', isRequired: false,
          options: [
            { labelEn: 'Fast approval', labelAr: 'موافقة سريعة' },
            { labelEn: 'Flexible repayment', labelAr: 'سداد مرن' },
            { labelEn: 'Highest financing amount', labelAr: 'أعلى مبلغ تمويل' },
            { labelEn: 'Lowest interest rate', labelAr: 'أقل سعر فائدة' },
            { labelEn: 'Least documentation required', labelAr: 'أقل أوراق مطلوبة' },
          ],
        },
        { code: 'needs_consultation', questionEn: 'Do you need consultation from a business financing expert?', questionAr: 'هل تحتاج استشارة خبير تمويل أعمال؟', isRequired: false, options: YESNO() },
      ],
    },
  ],
};

const CONFIGS: CategoryConfig[] = [PERSONAL, MORTGAGE, CAR, BUSINESS];

interface MergedQuestion {
  code: string;
  groupCode: string;
  questionEn: string;
  questionAr: string;
  isRequired: boolean;
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
        (categoriesByQuestion[q.code] ??= new Set()).add(cfg.category);
        const optionList = q.optionsFromEnum ? await enumOptions(q.optionsFromEnum) : q.options;
        let mq = questionByCode.get(q.code);
        if (!mq) {
          mq = {
            code: q.code,
            groupCode: g.code,
            questionEn: q.questionEn,
            questionAr: q.questionAr,
            isRequired: q.isRequired ?? true,
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
    const question = await prisma.question.upsert({
      where: { code },
      update: {
        groupId: groupIdByCode.get(q.groupCode)!, questionEn: q.questionEn, questionAr: q.questionAr,
        displayOrder: qOrder, isRequired: q.isRequired, isActive: true,
      },
      create: {
        groupId: groupIdByCode.get(q.groupCode)!, code, type: 'SINGLE_SELECT',
        questionEn: q.questionEn, questionAr: q.questionAr, displayOrder: qOrder, isRequired: q.isRequired,
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
    const assigned = questionOrder.filter((qc) => categoriesByQuestion[qc]?.has(cat));
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
        options: options.map((o) => ({
          code: o.code, labelAr: o.labelAr, labelEn: o.labelEn, displayOrder: o.displayOrder,
        })),
      });
    }
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
