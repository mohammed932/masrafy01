/**
 * Feature 009 seed — full 4-category loan questionnaire (Personal, Mortgage,
 * Car, Business) + scoring factors + ACTIVE per-program weight sets + published
 * version snapshots, so the dynamic-questionnaire + matching flow runs end-to-end.
 * Idempotent. Run via:  npx tsx prisma/seed-questionnaire.ts
 *
 * Engine wiring per question:
 *  - systemRole (arithmetic, option.numericPoint): SALARY | LOAN_AMOUNT | TENOR
 *    | AGE | CURRENT_INSTALLMENTS  (DOWN_PAYMENT is a no-op in answer-to-profile,
 *    so down-payment is wired as a SCORING factor instead).
 *  - scoringFactorCode (option.scoreValue 0–1): feeds approval probability.
 *  - profileField (option.profileValue): employment.* / obligations.* / loanPurpose.
 *  - display-only: no role/factor/profile (recorded, does not affect matching).
 *
 * Sub-scores (scoreValue) are SENSIBLE DEFAULTS — monotonic by desirability —
 * meant to be tuned by the banking expert via the admin editor. Not final.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SEED_ACTOR = 'seed-system';

type Category = 'personal' | 'mortgage' | 'car' | 'business';

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
    profileValue: r.key,
  }));
  _enumOptionsCache.set(type, opts);
  return opts;
}

interface SeedOption {
  labelEn: string;
  labelAr: string;
  /** Stable option code; defaults to slug(labelEn). Set for enum-backed options. */
  code?: string;
  numericPoint?: number;
  scoreValue?: number;
  profileValue?: string;
}
interface SeedQuestion {
  code: string;
  questionEn: string;
  questionAr: string;
  isRequired?: boolean; // default true
  systemRole?: string;
  scoringFactorCode?: string;
  profileField?: string;
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
interface SeedFactor {
  code: string;
  kind: 'DIRECT' | 'COMPUTED';
  labelEn: string;
  labelAr: string;
  sourceQuestionCode: string | null;
}
interface CategoryConfig {
  category: Category;
  groups: SeedGroup[];
  factors: SeedFactor[];
  weightPresets: Array<Record<string, number>>;
}

// Employment codes used across categories; bank eligibility is aligned to accept these.
const EMPLOYMENT_OPTIONS: SeedOption[] = [
  { labelEn: 'Government employee', labelAr: 'موظف حكومي', profileValue: 'government_employee' },
  { labelEn: 'Private sector employee', labelAr: 'موظف قطاع خاص', profileValue: 'private_employee' },
  { labelEn: 'Business owner / company owner', labelAr: 'صاحب عمل / شركة', profileValue: 'business_owner' },
  { labelEn: 'Freelancer', labelAr: 'عمل حر', profileValue: 'freelancer' },
  { labelEn: 'Retired', labelAr: 'متقاعد', profileValue: 'retired' },
];
const ALL_EMPLOYMENT_CODES = ['government_employee', 'private_employee', 'salaried', 'business_owner', 'freelancer', 'retired'];

const YESNO = (yesScore?: number, noScore?: number): SeedOption[] => [
  { labelEn: 'Yes', labelAr: 'نعم', profileValue: 'true', ...(yesScore != null ? { scoreValue: yesScore } : {}) },
  { labelEn: 'No', labelAr: 'لا', profileValue: 'false', ...(noScore != null ? { scoreValue: noScore } : {}) },
];

const AGE_Q: SeedQuestion = {
  code: 'your_age', questionEn: 'Your age', questionAr: 'عمرك', systemRole: 'AGE',
  options: [
    { labelEn: '21 – 30', labelAr: '21 – 30', numericPoint: 26 },
    { labelEn: '31 – 45', labelAr: '31 – 45', numericPoint: 38 },
    { labelEn: '46 – 60', labelAr: '46 – 60', numericPoint: 52 },
    { labelEn: 'More than 60', labelAr: 'أكثر من 60', numericPoint: 63 },
  ],
};
const SALARY_TRANSFER_Q: SeedQuestion = {
  code: 'salary_transfer', questionEn: 'Is your salary transferred to a bank account?', questionAr: 'هل يتم تحويل راتبك إلى حساب بنكي؟',
  profileField: 'employment.salaryTransferType', scoringFactorCode: 'salary_transferred',
  options: [
    { labelEn: 'Yes', labelAr: 'نعم', profileValue: 'full_transfer', scoreValue: 1.0 },
    { labelEn: 'No', labelAr: 'لا', profileValue: 'no_transfer', scoreValue: 0.2 },
  ],
};
const DEBT_BURDEN_FACTOR: SeedFactor = { code: 'debt_burden', kind: 'COMPUTED', labelEn: 'Debt burden', labelAr: 'عبء الدين', sourceQuestionCode: null };

// ── PERSONAL ────────────────────────────────────────────────────────────────
const PERSONAL: CategoryConfig = {
  category: 'personal',
  factors: [
    { code: 'salary_level', kind: 'DIRECT', labelEn: 'Salary level', labelAr: 'مستوى الدخل', sourceQuestionCode: 'monthly_income' },
    { code: 'job_stability', kind: 'DIRECT', labelEn: 'Job stability', labelAr: 'استقرار الوظيفة', sourceQuestionCode: 'job_tenure' },
    { code: 'salary_transferred', kind: 'DIRECT', labelEn: 'Salary transferred', labelAr: 'تحويل الراتب', sourceQuestionCode: 'salary_transfer' },
    DEBT_BURDEN_FACTOR,
  ],
  weightPresets: [
    { salary_level: 25, job_stability: 20, salary_transferred: 25, debt_burden: 30 },
    { salary_level: 40, job_stability: 15, salary_transferred: 20, debt_burden: 25 },
    { salary_level: 15, job_stability: 30, salary_transferred: 15, debt_burden: 40 },
    { salary_level: 30, job_stability: 25, salary_transferred: 30, debt_burden: 15 },
  ],
  groups: [
    {
      code: 'financing_info', titleEn: 'Financing Information', titleAr: 'معلومات التمويل',
      questions: [
        {
          code: 'amount_requested', questionEn: 'What is the approximate amount you need?', questionAr: 'ما المبلغ التقريبي الذي تحتاجه؟',
          systemRole: 'LOAN_AMOUNT',
          options: [
            { labelEn: 'Less than EGP 50,000', labelAr: 'أقل من 50,000 جنيه', numericPoint: 25000 },
            { labelEn: 'EGP 50,000 – 150,000', labelAr: '50,000 – 150,000 جنيه', numericPoint: 100000 },
            { labelEn: 'EGP 150,000 – 500,000', labelAr: '150,000 – 500,000 جنيه', numericPoint: 325000 },
            { labelEn: 'More than EGP 500,000', labelAr: 'أكثر من 500,000 جنيه', numericPoint: 750000 },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟',
          systemRole: 'TENOR',
          options: [
            { labelEn: 'Less than 3 years', labelAr: 'أقل من 3 سنوات', numericPoint: 24 },
            { labelEn: '3 to 5 years', labelAr: 'من 3 إلى 5 سنوات', numericPoint: 48 },
            { labelEn: '5 to 7 years', labelAr: 'من 5 إلى 7 سنوات', numericPoint: 72 },
            { labelEn: 'More than 7 years', labelAr: 'أكثر من 7 سنوات', numericPoint: 96 },
          ],
        },
        {
          code: 'loan_purpose', questionEn: 'What is the purpose of the loan?', questionAr: 'ما الغرض من القرض؟',
          profileField: 'loanPurpose', isRequired: false,
          options: [
            { labelEn: 'Home finishing / renovation', labelAr: 'تشطيب / تجديد المنزل', profileValue: 'home_finishing' },
            { labelEn: 'Marriage', labelAr: 'زواج', profileValue: 'marriage' },
            { labelEn: 'Purchasing appliances or furniture', labelAr: 'شراء أجهزة أو أثاث', profileValue: 'appliances_furniture' },
            { labelEn: 'Education', labelAr: 'تعليم', profileValue: 'education' },
            { labelEn: 'Debt consolidation / settling obligations', labelAr: 'سداد التزامات', profileValue: 'debt_consolidation' },
            { labelEn: 'Personal project', labelAr: 'مشروع شخصي', profileValue: 'personal_project' },
            { labelEn: 'Other', labelAr: 'أخرى', profileValue: 'other' },
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
          profileField: 'employment.employmentType', options: EMPLOYMENT_OPTIONS,
        },
        {
          code: 'job_tenure', questionEn: 'How long have you been in your current job?', questionAr: 'منذ متى وأنت في وظيفتك الحالية؟',
          scoringFactorCode: 'job_stability', profileField: 'employment.monthsInJob',
          options: [
            { labelEn: 'Less than 6 months', labelAr: 'أقل من 6 أشهر', profileValue: '3', scoreValue: 0.15 },
            { labelEn: '6 months to 1 year', labelAr: 'من 6 أشهر إلى سنة', profileValue: '9', scoreValue: 0.35 },
            { labelEn: '1 to 3 years', labelAr: 'من 1 إلى 3 سنوات', profileValue: '24', scoreValue: 0.6 },
            { labelEn: 'More than 3 years', labelAr: 'أكثر من 3 سنوات', profileValue: '60', scoreValue: 1.0 },
          ],
        },
        {
          code: 'monthly_income', questionEn: 'What is your average monthly income?', questionAr: 'ما متوسط دخلك الشهري؟',
          systemRole: 'SALARY', scoringFactorCode: 'salary_level',
          options: [
            { labelEn: 'Less than EGP 10,000', labelAr: 'أقل من 10,000 جنيه', numericPoint: 7000, scoreValue: 0.2 },
            { labelEn: 'EGP 10,000 – 20,000', labelAr: '10,000 – 20,000 جنيه', numericPoint: 15000, scoreValue: 0.5 },
            { labelEn: 'EGP 20,000 – 40,000', labelAr: '20,000 – 40,000 جنيه', numericPoint: 30000, scoreValue: 0.75 },
            { labelEn: 'More than EGP 40,000', labelAr: 'أكثر من 40,000 جنيه', numericPoint: 55000, scoreValue: 1.0 },
          ],
        },
        SALARY_TRANSFER_Q,
        {
          code: 'salary_bank', questionEn: 'Which bank do you receive your salary through?', questionAr: 'من خلال أي بنك تستلم راتبك؟',
          isRequired: false,
          options: [
            { labelEn: 'A specific bank', labelAr: 'بنك محدد', profileValue: 'specific_bank' },
            { labelEn: 'No specific bank', labelAr: 'لا يوجد بنك محدد', profileValue: 'none' },
          ],
        },
        {
          code: 'employer_approved', questionEn: 'Is your employer approved by banks?', questionAr: 'هل جهة عملك معتمدة لدى البنوك؟',
          isRequired: false, options: [
            { labelEn: 'Yes', labelAr: 'نعم', profileValue: 'yes' },
            { labelEn: 'No', labelAr: 'لا', profileValue: 'no' },
            { labelEn: 'Not sure', labelAr: 'غير متأكد', profileValue: 'unsure' },
          ],
        },
      ],
    },
    {
      code: 'commitments', titleEn: 'Banking Commitments', titleAr: 'الالتزامات البنكية',
      questions: [
        {
          code: 'current_loans', questionEn: 'Do you currently have any loans or obligations?', questionAr: 'هل لديك قروض أو التزامات حالية؟',
          profileField: 'obligations.hasCurrentLoan',
          options: [
            { labelEn: 'None', labelAr: 'لا يوجد', profileValue: 'false' },
            { labelEn: 'Personal loan', labelAr: 'قرض شخصي', profileValue: 'true' },
            { labelEn: 'Car loan', labelAr: 'قرض سيارة', profileValue: 'true' },
            { labelEn: 'Mortgage', labelAr: 'قرض عقاري', profileValue: 'true' },
            { labelEn: 'Credit cards', labelAr: 'بطاقات ائتمان', profileValue: 'true' },
            { labelEn: 'Other', labelAr: 'أخرى', profileValue: 'true' },
          ],
        },
        {
          code: 'current_installments', questionEn: 'Total approximate current monthly installments?', questionAr: 'إجمالي الأقساط الشهرية الحالية تقريبًا؟',
          systemRole: 'CURRENT_INSTALLMENTS',
          options: [
            { labelEn: 'Less than EGP 2,000', labelAr: 'أقل من 2,000 جنيه', numericPoint: 1000 },
            { labelEn: 'EGP 2,000 – 5,000', labelAr: '2,000 – 5,000 جنيه', numericPoint: 3500 },
            { labelEn: 'EGP 5,000 – 10,000', labelAr: '5,000 – 10,000 جنيه', numericPoint: 7500 },
            { labelEn: 'More than EGP 10,000', labelAr: 'أكثر من 10,000 جنيه', numericPoint: 15000 },
          ],
        },
        { code: 'has_credit_card', questionEn: 'Do you have a credit card?', questionAr: 'هل لديك بطاقة ائتمان؟', isRequired: false, options: YESNO() },
        {
          code: 'card_usage', questionEn: 'Average monthly credit card usage?', questionAr: 'متوسط استخدام البطاقة الشهري؟',
          isRequired: false,
          options: [
            { labelEn: 'Less than EGP 5,000', labelAr: 'أقل من 5,000 جنيه', profileValue: 'low' },
            { labelEn: 'EGP 5,000 – 15,000', labelAr: '5,000 – 15,000 جنيه', profileValue: 'medium' },
            { labelEn: 'More than EGP 15,000', labelAr: 'أكثر من 15,000 جنيه', profileValue: 'high' },
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
            { labelEn: 'Lowest monthly installment', labelAr: 'أقل قسط شهري', profileValue: 'lowest_installment' },
            { labelEn: 'Lowest interest rate', labelAr: 'أقل سعر فائدة', profileValue: 'lowest_interest' },
            { labelEn: 'Fastest approval', labelAr: 'أسرع موافقة', profileValue: 'fastest_approval' },
            { labelEn: 'Least documentation required', labelAr: 'أقل أوراق مطلوبة', profileValue: 'least_paperwork' },
            { labelEn: 'Flexible repayment', labelAr: 'سداد مرن', profileValue: 'flexible_repayment' },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Have you ever had a financing application rejected?', questionAr: 'هل سبق رفض طلب تمويل لك؟', isRequired: false, profileField: 'obligations.hasPreviousRejection', options: YESNO() },
        { code: 'needs_consultant', questionEn: 'Do you need assistance from a financing consultant?', questionAr: 'هل تحتاج مساعدة مستشار تمويل؟', isRequired: false, options: YESNO() },
      ],
    },
  ],
};

// ── MORTGAGE ──────────────────────────────────────────────────────────────
const MORTGAGE: CategoryConfig = {
  category: 'mortgage',
  factors: [
    { code: 'salary_level', kind: 'DIRECT', labelEn: 'Salary level', labelAr: 'مستوى الدخل', sourceQuestionCode: 'monthly_income' },
    { code: 'down_payment_strength', kind: 'DIRECT', labelEn: 'Down payment strength', labelAr: 'قوة الدفعة المقدمة', sourceQuestionCode: 'down_payment' },
    { code: 'salary_transferred', kind: 'DIRECT', labelEn: 'Salary transferred', labelAr: 'تحويل الراتب', sourceQuestionCode: 'salary_transfer' },
    DEBT_BURDEN_FACTOR,
  ],
  weightPresets: [
    { salary_level: 25, down_payment_strength: 25, salary_transferred: 20, debt_burden: 30 },
    { salary_level: 35, down_payment_strength: 20, salary_transferred: 20, debt_burden: 25 },
    { salary_level: 20, down_payment_strength: 35, salary_transferred: 15, debt_burden: 30 },
  ],
  groups: [
    {
      code: 'property_financing', titleEn: 'Property & Financing Information', titleAr: 'معلومات العقار والتمويل',
      questions: [
        {
          code: 'property_type', questionEn: 'What type of property would you like to finance?', questionAr: 'ما نوع العقار الذي ترغب في تمويله؟', isRequired: false,
          options: [
            { labelEn: 'Apartment', labelAr: 'شقة', profileValue: 'apartment' },
            { labelEn: 'Villa', labelAr: 'فيلا', profileValue: 'villa' },
            { labelEn: 'Duplex', labelAr: 'دوبلكس', profileValue: 'duplex' },
            { labelEn: 'Commercial shop', labelAr: 'محل تجاري', profileValue: 'commercial_shop' },
            { labelEn: 'Administrative office', labelAr: 'مكتب إداري', profileValue: 'office' },
            { labelEn: 'Other', labelAr: 'أخرى', profileValue: 'other' },
          ],
        },
        { code: 'in_compound', questionEn: 'Is the property within a residential compound?', questionAr: 'هل العقار داخل كمبوند سكني؟', isRequired: false, options: YESNO() },
        {
          code: 'registration_status', questionEn: "What is the property's registration status?", questionAr: 'ما حالة تسجيل العقار؟', isRequired: false,
          options: [
            { labelEn: 'Officially registered', labelAr: 'مسجل رسميًا', profileValue: 'registered' },
            { labelEn: 'Eligible for registration', labelAr: 'قابل للتسجيل', profileValue: 'eligible' },
            { labelEn: 'Not registered', labelAr: 'غير مسجل', profileValue: 'not_registered' },
            { labelEn: 'Not sure', labelAr: 'غير متأكد', profileValue: 'unsure' },
          ],
        },
        {
          // Options expanded from the active `governorate` platform-enumeration
          // members (single source: Manage values), so mobile gets them in the
          // one questionnaire snapshot call.
          code: 'governorate', questionEn: 'In which governorate is the property located?', questionAr: 'في أي محافظة يقع العقار؟', isRequired: false,
          optionsFromEnum: 'governorate', options: [],
        },
        {
          code: 'property_value', questionEn: 'What is the approximate property value?', questionAr: 'ما القيمة التقريبية للعقار؟', systemRole: 'LOAN_AMOUNT',
          options: [
            { labelEn: 'Less than EGP 1 million', labelAr: 'أقل من مليون جنيه', numericPoint: 700000 },
            { labelEn: 'EGP 1 – 3 million', labelAr: '1 – 3 مليون جنيه', numericPoint: 2000000 },
            { labelEn: 'EGP 3 – 5 million', labelAr: '3 – 5 مليون جنيه', numericPoint: 4000000 },
            { labelEn: 'More than EGP 5 million', labelAr: 'أكثر من 5 مليون جنيه', numericPoint: 7000000 },
          ],
        },
        {
          code: 'down_payment', questionEn: 'How much down payment do you have available?', questionAr: 'ما حجم الدفعة المقدمة المتاحة لديك؟', scoringFactorCode: 'down_payment_strength',
          options: [
            { labelEn: 'Less than 10%', labelAr: 'أقل من 10%', scoreValue: 0.2 },
            { labelEn: '10% – 20%', labelAr: '10% – 20%', scoreValue: 0.5 },
            { labelEn: '20% – 30%', labelAr: '20% – 30%', scoreValue: 0.75 },
            { labelEn: 'More than 30%', labelAr: 'أكثر من 30%', scoreValue: 1.0 },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟', systemRole: 'TENOR',
          options: [
            { labelEn: 'Less than 10 years', labelAr: 'أقل من 10 سنوات', numericPoint: 96 },
            { labelEn: '10 – 15 years', labelAr: '10 – 15 سنة', numericPoint: 150 },
            { labelEn: '15 – 20 years', labelAr: '15 – 20 سنة', numericPoint: 210 },
            { labelEn: 'More than 20 years', labelAr: 'أكثر من 20 سنة', numericPoint: 300 },
          ],
        },
        AGE_Q,
      ],
    },
    {
      code: 'income_employment', titleEn: 'Income & Employment Information', titleAr: 'معلومات الدخل والعمل',
      questions: [
        { code: 'employment_status', questionEn: 'What is your employment status?', questionAr: 'ما هي حالتك الوظيفية؟', profileField: 'employment.employmentType', options: EMPLOYMENT_OPTIONS },
        {
          code: 'monthly_income', questionEn: 'What is your average monthly income?', questionAr: 'ما متوسط دخلك الشهري؟', systemRole: 'SALARY', scoringFactorCode: 'salary_level',
          options: [
            { labelEn: 'Less than EGP 15,000', labelAr: 'أقل من 15,000 جنيه', numericPoint: 12000, scoreValue: 0.2 },
            { labelEn: 'EGP 15,000 – 30,000', labelAr: '15,000 – 30,000 جنيه', numericPoint: 22000, scoreValue: 0.5 },
            { labelEn: 'EGP 30,000 – 60,000', labelAr: '30,000 – 60,000 جنيه', numericPoint: 45000, scoreValue: 0.75 },
            { labelEn: 'More than EGP 60,000', labelAr: 'أكثر من 60,000 جنيه', numericPoint: 75000, scoreValue: 1.0 },
          ],
        },
        SALARY_TRANSFER_Q,
        { code: 'additional_income', questionEn: 'Do you have additional sources of income?', questionAr: 'هل لديك مصادر دخل إضافية؟', isRequired: false, options: YESNO() },
        { code: 'active_account', questionEn: 'Do you have an active bank account?', questionAr: 'هل لديك حساب بنكي نشط؟', isRequired: false, options: YESNO() },
      ],
    },
    {
      code: 'credit_status', titleEn: 'Credit Status', titleAr: 'الحالة الائتمانية',
      questions: [
        { code: 'current_loans', questionEn: 'Do you currently have any loans or obligations?', questionAr: 'هل لديك قروض أو التزامات حالية؟', profileField: 'obligations.hasCurrentLoan', options: YESNO() },
        {
          code: 'current_installments', questionEn: 'What is your total current monthly installment amount?', questionAr: 'ما إجمالي قسطك الشهري الحالي؟', systemRole: 'CURRENT_INSTALLMENTS',
          options: [
            { labelEn: 'Less than EGP 5,000', labelAr: 'أقل من 5,000 جنيه', numericPoint: 3000 },
            { labelEn: 'EGP 5,000 – 15,000', labelAr: '5,000 – 15,000 جنيه', numericPoint: 10000 },
            { labelEn: 'EGP 15,000 – 30,000', labelAr: '15,000 – 30,000 جنيه', numericPoint: 22000 },
            { labelEn: 'More than EGP 30,000', labelAr: 'أكثر من 30,000 جنيه', numericPoint: 40000 },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Have you ever had a mortgage application rejected?', questionAr: 'هل سبق رفض طلب تمويل عقاري لك؟', isRequired: false, profileField: 'obligations.hasPreviousRejection', options: YESNO() },
      ],
    },
    {
      code: 'preferences', titleEn: 'Preferences', titleAr: 'التفضيلات',
      questions: [
        {
          code: 'priority_factor', questionEn: 'Most important thing you look for in a mortgage?', questionAr: 'أهم ما تبحث عنه في التمويل العقاري؟', isRequired: false,
          options: [
            { labelEn: 'Lowest monthly installment', labelAr: 'أقل قسط شهري', profileValue: 'lowest_installment' },
            { labelEn: 'Longest repayment period', labelAr: 'أطول مدة سداد', profileValue: 'longest_tenor' },
            { labelEn: 'Lowest down payment', labelAr: 'أقل دفعة مقدمة', profileValue: 'lowest_down_payment' },
            { labelEn: 'Fastest approval', labelAr: 'أسرع موافقة', profileValue: 'fastest_approval' },
            { labelEn: 'Lowest administrative fees', labelAr: 'أقل رسوم إدارية', profileValue: 'lowest_fees' },
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
  factors: [
    { code: 'salary_level', kind: 'DIRECT', labelEn: 'Salary level', labelAr: 'مستوى الدخل', sourceQuestionCode: 'monthly_income' },
    { code: 'down_payment_strength', kind: 'DIRECT', labelEn: 'Down payment strength', labelAr: 'قوة الدفعة المقدمة', sourceQuestionCode: 'down_payment' },
    { code: 'salary_transferred', kind: 'DIRECT', labelEn: 'Salary transferred', labelAr: 'تحويل الراتب', sourceQuestionCode: 'salary_transfer' },
    DEBT_BURDEN_FACTOR,
  ],
  weightPresets: [
    { salary_level: 30, down_payment_strength: 25, salary_transferred: 20, debt_burden: 25 },
    { salary_level: 20, down_payment_strength: 35, salary_transferred: 15, debt_burden: 30 },
    { salary_level: 35, down_payment_strength: 20, salary_transferred: 20, debt_burden: 25 },
  ],
  groups: [
    {
      code: 'vehicle_financing', titleEn: 'Vehicle & Financing Information', titleAr: 'معلومات السيارة والتمويل',
      questions: [
        { code: 'vehicle_condition', questionEn: 'Is the vehicle new or used?', questionAr: 'هل السيارة جديدة أم مستعملة؟', isRequired: false, options: [
          { labelEn: 'New', labelAr: 'جديدة', profileValue: 'new' },
          { labelEn: 'Used', labelAr: 'مستعملة', profileValue: 'used' },
        ] },
        {
          code: 'model_year', questionEn: 'What is the vehicle model year?', questionAr: 'ما سنة موديل السيارة؟', isRequired: false,
          options: [
            { labelEn: 'Current year model', labelAr: 'موديل السنة الحالية', profileValue: 'current' },
            { labelEn: 'Within the last 3 years', labelAr: 'خلال آخر 3 سنوات', profileValue: 'last_3' },
            { labelEn: '3 to 5 years old', labelAr: 'من 3 إلى 5 سنوات', profileValue: '3_5' },
            { labelEn: 'More than 5 years old', labelAr: 'أكثر من 5 سنوات', profileValue: 'over_5' },
          ],
        },
        {
          code: 'vehicle_price', questionEn: 'What is the approximate vehicle price?', questionAr: 'ما السعر التقريبي للسيارة؟', systemRole: 'LOAN_AMOUNT',
          options: [
            { labelEn: 'Less than EGP 500,000', labelAr: 'أقل من 500,000 جنيه', numericPoint: 350000 },
            { labelEn: 'EGP 500,000 – 1 million', labelAr: '500,000 – مليون جنيه', numericPoint: 750000 },
            { labelEn: 'EGP 1 – 2 million', labelAr: '1 – 2 مليون جنيه', numericPoint: 1500000 },
            { labelEn: 'More than EGP 2 million', labelAr: 'أكثر من 2 مليون جنيه', numericPoint: 2500000 },
          ],
        },
        {
          code: 'down_payment', questionEn: 'How much down payment do you have available?', questionAr: 'ما حجم الدفعة المقدمة المتاحة لديك؟', scoringFactorCode: 'down_payment_strength',
          options: [
            { labelEn: 'No down payment', labelAr: 'بدون دفعة مقدمة', scoreValue: 0.1 },
            { labelEn: 'Less than 20%', labelAr: 'أقل من 20%', scoreValue: 0.4 },
            { labelEn: '20% – 40%', labelAr: '20% – 40%', scoreValue: 0.7 },
            { labelEn: 'More than 40%', labelAr: 'أكثر من 40%', scoreValue: 1.0 },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟', systemRole: 'TENOR',
          options: [
            { labelEn: 'Less than 3 years', labelAr: 'أقل من 3 سنوات', numericPoint: 24 },
            { labelEn: '3 – 5 years', labelAr: '3 – 5 سنوات', numericPoint: 48 },
            { labelEn: '5 – 7 years', labelAr: '5 – 7 سنوات', numericPoint: 72 },
            { labelEn: 'More than 7 years', labelAr: 'أكثر من 7 سنوات', numericPoint: 96 },
          ],
        },
        AGE_Q,
      ],
    },
    {
      code: 'employment_income', titleEn: 'Employment & Income', titleAr: 'العمل والدخل',
      questions: [
        { code: 'employment_status', questionEn: 'What is your employment status?', questionAr: 'ما هي حالتك الوظيفية؟', profileField: 'employment.employmentType', options: EMPLOYMENT_OPTIONS },
        {
          code: 'monthly_income', questionEn: 'What is your average monthly income?', questionAr: 'ما متوسط دخلك الشهري؟', systemRole: 'SALARY', scoringFactorCode: 'salary_level',
          options: [
            { labelEn: 'Less than EGP 10,000', labelAr: 'أقل من 10,000 جنيه', numericPoint: 7000, scoreValue: 0.2 },
            { labelEn: 'EGP 10,000 – 25,000', labelAr: '10,000 – 25,000 جنيه', numericPoint: 17000, scoreValue: 0.5 },
            { labelEn: 'EGP 25,000 – 50,000', labelAr: '25,000 – 50,000 جنيه', numericPoint: 37000, scoreValue: 0.75 },
            { labelEn: 'More than EGP 50,000', labelAr: 'أكثر من 50,000 جنيه', numericPoint: 65000, scoreValue: 1.0 },
          ],
        },
        SALARY_TRANSFER_Q,
        { code: 'employer_approved', questionEn: 'Is your employer approved by banks?', questionAr: 'هل جهة عملك معتمدة لدى البنوك؟', isRequired: false, options: [
          { labelEn: 'Yes', labelAr: 'نعم', profileValue: 'yes' },
          { labelEn: 'No', labelAr: 'لا', profileValue: 'no' },
          { labelEn: 'Not sure', labelAr: 'غير متأكد', profileValue: 'unsure' },
        ] },
      ],
    },
    {
      code: 'financial_status', titleEn: 'Financial Status', titleAr: 'الحالة المالية',
      questions: [
        { code: 'current_loans', questionEn: 'Do you currently have obligations or loans?', questionAr: 'هل لديك التزامات أو قروض حالية؟', profileField: 'obligations.hasCurrentLoan', options: YESNO() },
        {
          code: 'current_installments', questionEn: 'What is your total current monthly installment amount?', questionAr: 'ما إجمالي قسطك الشهري الحالي؟', systemRole: 'CURRENT_INSTALLMENTS',
          options: [
            { labelEn: 'Less than EGP 3,000', labelAr: 'أقل من 3,000 جنيه', numericPoint: 1500 },
            { labelEn: 'EGP 3,000 – 7,000', labelAr: '3,000 – 7,000 جنيه', numericPoint: 5000 },
            { labelEn: 'EGP 7,000 – 15,000', labelAr: '7,000 – 15,000 جنيه', numericPoint: 11000 },
            { labelEn: 'More than EGP 15,000', labelAr: 'أكثر من 15,000 جنيه', numericPoint: 20000 },
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
            { labelEn: 'Lowest down payment', labelAr: 'أقل دفعة مقدمة', profileValue: 'lowest_down_payment' },
            { labelEn: 'Lowest monthly installment', labelAr: 'أقل قسط شهري', profileValue: 'lowest_installment' },
            { labelEn: 'Fastest approval', labelAr: 'أسرع موافقة', profileValue: 'fastest_approval' },
            { labelEn: 'Lowest interest rate', labelAr: 'أقل سعر فائدة', profileValue: 'lowest_interest' },
            { labelEn: 'Financing without a guarantor', labelAr: 'تمويل بدون ضامن', profileValue: 'no_guarantor' },
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
  factors: [
    { code: 'revenue_level', kind: 'DIRECT', labelEn: 'Revenue level', labelAr: 'مستوى الإيرادات', sourceQuestionCode: 'monthly_revenue' },
    { code: 'business_tenure', kind: 'DIRECT', labelEn: 'Business tenure', labelAr: 'عمر النشاط', sourceQuestionCode: 'business_age' },
    DEBT_BURDEN_FACTOR,
  ],
  weightPresets: [
    { revenue_level: 45, business_tenure: 25, debt_burden: 30 },
    { revenue_level: 35, business_tenure: 35, debt_burden: 30 },
    { revenue_level: 55, business_tenure: 20, debt_burden: 25 },
  ],
  groups: [
    {
      code: 'business_financing', titleEn: 'Business & Financing Information', titleAr: 'معلومات النشاط والتمويل',
      questions: [
        {
          code: 'activity_type', questionEn: 'What type of business activity do you operate?', questionAr: 'ما نوع النشاط التجاري الذي تديره؟', isRequired: false,
          options: [
            { labelEn: 'Trade', labelAr: 'تجارة', profileValue: 'trade' },
            { labelEn: 'Services', labelAr: 'خدمات', profileValue: 'services' },
            { labelEn: 'Restaurants & Cafés', labelAr: 'مطاعم وكافيهات', profileValue: 'food' },
            { labelEn: 'Manufacturing', labelAr: 'تصنيع', profileValue: 'manufacturing' },
            { labelEn: 'Technology', labelAr: 'تكنولوجيا', profileValue: 'technology' },
            { labelEn: 'Other', labelAr: 'أخرى', profileValue: 'other' },
          ],
        },
        {
          code: 'business_age', questionEn: 'How long has the business been operating?', questionAr: 'منذ متى والنشاط يعمل؟', scoringFactorCode: 'business_tenure',
          options: [
            { labelEn: 'Less than 1 year', labelAr: 'أقل من سنة', scoreValue: 0.3 },
            { labelEn: '1 to 2 years', labelAr: 'من 1 إلى 2 سنة', scoreValue: 0.6 },
            { labelEn: 'More than 2 years', labelAr: 'أكثر من سنتين', scoreValue: 1.0 },
          ],
        },
        {
          code: 'financing_amount', questionEn: 'What is the approximate financing amount required?', questionAr: 'ما مبلغ التمويل التقريبي المطلوب؟', systemRole: 'LOAN_AMOUNT',
          options: [
            { labelEn: 'Less than EGP 250,000', labelAr: 'أقل من 250,000 جنيه', numericPoint: 150000 },
            { labelEn: 'EGP 250,000 – 1 million', labelAr: '250,000 – مليون جنيه', numericPoint: 600000 },
            { labelEn: 'EGP 1 – 5 million', labelAr: '1 – 5 مليون جنيه', numericPoint: 3000000 },
            { labelEn: 'More than EGP 5 million', labelAr: 'أكثر من 5 مليون جنيه', numericPoint: 7000000 },
          ],
        },
        {
          code: 'financing_purpose', questionEn: 'What is the primary purpose of the financing?', questionAr: 'ما الغرض الأساسي من التمويل؟', profileField: 'loanPurpose', isRequired: false,
          options: [
            { labelEn: 'Expansion', labelAr: 'توسع', profileValue: 'expansion' },
            { labelEn: 'Purchasing equipment', labelAr: 'شراء معدات', profileValue: 'equipment' },
            { labelEn: 'Working capital', labelAr: 'رأس مال عامل', profileValue: 'working_capital' },
            { labelEn: 'Opening a new branch', labelAr: 'فتح فرع جديد', profileValue: 'new_branch' },
            { labelEn: 'Settling obligations', labelAr: 'سداد التزامات', profileValue: 'settle_obligations' },
            { labelEn: 'Other', labelAr: 'أخرى', profileValue: 'other' },
          ],
        },
        {
          code: 'repayment_period', questionEn: 'What repayment period suits you?', questionAr: 'ما مدة السداد المناسبة لك؟', systemRole: 'TENOR',
          options: [
            { labelEn: 'Less than 2 years', labelAr: 'أقل من سنتين', numericPoint: 18 },
            { labelEn: '2 – 5 years', labelAr: '2 – 5 سنوات', numericPoint: 42 },
            { labelEn: 'More than 5 years', labelAr: 'أكثر من 5 سنوات', numericPoint: 72 },
          ],
        },
      ],
    },
    {
      code: 'financial_info', titleEn: 'Financial Information', titleAr: 'المعلومات المالية',
      questions: [
        {
          code: 'monthly_revenue', questionEn: 'What is the average monthly business revenue?', questionAr: 'ما متوسط الإيرادات الشهرية للنشاط؟', systemRole: 'SALARY', scoringFactorCode: 'revenue_level',
          options: [
            { labelEn: 'Less than EGP 50,000', labelAr: 'أقل من 50,000 جنيه', numericPoint: 30000, scoreValue: 0.2 },
            { labelEn: 'EGP 50,000 – 200,000', labelAr: '50,000 – 200,000 جنيه', numericPoint: 120000, scoreValue: 0.5 },
            { labelEn: 'EGP 200,000 – 500,000', labelAr: '200,000 – 500,000 جنيه', numericPoint: 350000, scoreValue: 0.75 },
            { labelEn: 'More than EGP 500,000', labelAr: 'أكثر من 500,000 جنيه', numericPoint: 700000, scoreValue: 1.0 },
          ],
        },
        { code: 'business_account', questionEn: 'Do you have a business bank account?', questionAr: 'هل لديك حساب بنكي للنشاط؟', isRequired: false, options: YESNO() },
        { code: 'registered', questionEn: 'Is the business officially registered?', questionAr: 'هل النشاط مسجل رسميًا؟', isRequired: false, options: [
          { labelEn: 'Yes', labelAr: 'نعم', profileValue: 'yes' },
          { labelEn: 'No', labelAr: 'لا', profileValue: 'no' },
          { labelEn: 'Registration in progress', labelAr: 'التسجيل جارٍ', profileValue: 'in_progress' },
        ] },
        { code: 'tax_registration', questionEn: 'Do you have a tax or commercial registration?', questionAr: 'هل لديك سجل ضريبي أو تجاري؟', isRequired: false, options: YESNO() },
      ],
    },
    {
      code: 'obligations_credit', titleEn: 'Obligations & Credit Status', titleAr: 'الالتزامات والحالة الائتمانية',
      questions: [
        { code: 'current_facilities', questionEn: 'Does the business currently have financing facilities or loans?', questionAr: 'هل لدى النشاط تسهيلات أو قروض حالية؟', profileField: 'obligations.hasCurrentLoan', options: YESNO() },
        {
          code: 'current_installments', questionEn: 'Total current monthly financial obligation amount?', questionAr: 'إجمالي الالتزام المالي الشهري الحالي؟', systemRole: 'CURRENT_INSTALLMENTS',
          options: [
            { labelEn: 'Less than EGP 10,000', labelAr: 'أقل من 10,000 جنيه', numericPoint: 6000 },
            { labelEn: 'EGP 10,000 – 50,000', labelAr: '10,000 – 50,000 جنيه', numericPoint: 30000 },
            { labelEn: 'More than EGP 50,000', labelAr: 'أكثر من 50,000 جنيه', numericPoint: 70000 },
          ],
        },
        { code: 'prior_rejection', questionEn: 'Has a financing request for the business ever been rejected?', questionAr: 'هل سبق رفض طلب تمويل للنشاط؟', isRequired: false, profileField: 'obligations.hasPreviousRejection', options: YESNO() },
      ],
    },
    {
      code: 'preferences', titleEn: 'Preferences & Support', titleAr: 'التفضيلات والدعم',
      questions: [
        {
          code: 'priority_factor', questionEn: 'Most important thing in business financing?', questionAr: 'أهم ما تبحث عنه في تمويل النشاط؟', isRequired: false,
          options: [
            { labelEn: 'Fast approval', labelAr: 'موافقة سريعة', profileValue: 'fastest_approval' },
            { labelEn: 'Flexible repayment', labelAr: 'سداد مرن', profileValue: 'flexible_repayment' },
            { labelEn: 'Highest financing amount', labelAr: 'أعلى مبلغ تمويل', profileValue: 'highest_amount' },
            { labelEn: 'Lowest interest rate', labelAr: 'أقل سعر فائدة', profileValue: 'lowest_interest' },
            { labelEn: 'Least documentation required', labelAr: 'أقل أوراق مطلوبة', profileValue: 'least_paperwork' },
          ],
        },
        { code: 'needs_consultation', questionEn: 'Do you need consultation from a business financing expert?', questionAr: 'هل تحتاج استشارة خبير تمويل أعمال؟', isRequired: false, options: YESNO() },
      ],
    },
  ],
};

const CONFIGS: CategoryConfig[] = [PERSONAL, MORTGAGE, CAR, BUSINESS];

export async function seedQuestionnaire(): Promise<void> {
  for (const cfg of CONFIGS) {
    await seedCategory(cfg);
  }
  await alignEligibility();
  console.log('seed-questionnaire: done for', CONFIGS.map((c) => c.category).join(', '));
}

async function seedCategory(cfg: CategoryConfig): Promise<void> {
  const { category } = cfg;

  // 1) Map DIRECT scoring factors → their source question, used to re-key the
  //    weight presets onto questionCodes (v5.0.0 — no ScoringFactor table).
  const questionByFactor = new Map(
    cfg.factors
      .filter((f) => f.kind === 'DIRECT' && f.sourceQuestionCode)
      .map((f) => [f.code, f.sourceQuestionCode as string]),
  );

  // 2) Groups + questions + options. Track config codes so stale rows from a
  //    previous seed (renamed labels → new slugs) get deactivated, not left as
  //    duplicates. `isActive: true` on update reactivates anything previously off.
  const groupCodes: string[] = [];
  const questionCodes: string[] = [];
  let gOrder = 0;
  let qOrder = 0;
  for (const g of cfg.groups) {
    gOrder += 1;
    groupCodes.push(g.code);
    const group = await prisma.questionGroup.upsert({
      where: { uniq_question_group_category_code: { category, code: g.code } },
      update: { titleEn: g.titleEn, titleAr: g.titleAr, displayOrder: gOrder, isActive: true },
      create: { category, code: g.code, titleEn: g.titleEn, titleAr: g.titleAr, displayOrder: gOrder },
    });
    for (const q of g.questions) {
      qOrder += 1;
      questionCodes.push(q.code);
      const question = await prisma.question.upsert({
        where: { uniq_question_category_code: { category, code: q.code } },
        update: {
          groupId: group.id, questionEn: q.questionEn, questionAr: q.questionAr, displayOrder: qOrder,
          isRequired: q.isRequired ?? true, isActive: true,
          systemRole: (q.systemRole as never) ?? null, isScored: !!q.scoringFactorCode, profileField: q.profileField ?? null,
        },
        create: {
          groupId: group.id, category, code: q.code, type: 'SINGLE_SELECT',
          questionEn: q.questionEn, questionAr: q.questionAr, displayOrder: qOrder, isRequired: q.isRequired ?? true,
          systemRole: (q.systemRole as never) ?? null, isScored: !!q.scoringFactorCode, profileField: q.profileField ?? null,
        },
      });
      const optionCodes: string[] = [];
      let oOrder = 0;
      const optionList = q.optionsFromEnum ? await enumOptions(q.optionsFromEnum) : q.options;
      for (const o of optionList) {
        oOrder += 1;
        const code = o.code ?? slug(o.labelEn);
        optionCodes.push(code);
        await prisma.questionOption.upsert({
          where: { uniq_question_option_question_code: { questionId: question.id, code } },
          update: { labelEn: o.labelEn, labelAr: o.labelAr, displayOrder: oOrder, isActive: true, numericPoint: o.numericPoint ?? null, scoreValue: o.scoreValue ?? null, profileValue: o.profileValue ?? null },
          create: { questionId: question.id, code, labelEn: o.labelEn, labelAr: o.labelAr, displayOrder: oOrder, numericPoint: o.numericPoint ?? null, scoreValue: o.scoreValue ?? null, profileValue: o.profileValue ?? null },
        });
      }
      // Deactivate stale options under this question (dropped from config).
      await prisma.questionOption.updateMany({
        where: { questionId: question.id, code: { notIn: optionCodes } },
        data: { isActive: false },
      });
    }
  }
  // Deactivate stale questions + groups (dropped/renamed) for this category.
  await prisma.question.updateMany({ where: { category, code: { notIn: questionCodes } }, data: { isActive: false } });
  await prisma.questionGroup.updateMany({ where: { category, code: { notIn: groupCodes } }, data: { isActive: false } });

  // 3) Publish snapshot
  await publishVersion(category);

  // 4) Differentiated ACTIVE weight set per active program in this category
  const programs = await prisma.bankProgram.findMany({ where: { active: true, productCategory: category }, select: { id: true } });
  for (let i = 0; i < programs.length; i++) {
    const p = programs[i]!;
    const weights = toQuestionWeights(cfg.weightPresets[i % cfg.weightPresets.length]!, questionByFactor);
    const existingActive = await prisma.scoringWeightSet.findFirst({ where: { bankProgramId: p.id, status: 'ACTIVE' } });
    if (existingActive) {
      await prisma.scoringWeightSet.update({ where: { id: existingActive.id }, data: { weights } });
      continue;
    }
    const last = await prisma.scoringWeightSet.findFirst({ where: { bankProgramId: p.id }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
    await prisma.scoringWeightSet.create({
      data: { bankProgramId: p.id, status: 'ACTIVE', versionNumber: (last?.versionNumber ?? 0) + 1, weights, createdBy: SEED_ACTOR, approvedBy: 'seed-approver', approvedAt: new Date() },
    });
  }

  console.log(`  ${category}: ${cfg.groups.length} groups, ${cfg.factors.length} factors, ${programs.length} weight sets.`);
}

/** Align every active program's accepted lists with the questionnaire's option
 *  codes (additive) so answers pass eligibility:
 *   - acceptedEmploymentTypes ← full employment code set
 *   - acceptedTransferTypes   ← add `full_transfer` (the "Yes, salary transferred"
 *     answer). `no_transfer` is intentionally NOT added, so transfer-requiring
 *     programs still reject a no-transfer applicant. */
async function alignEligibility(): Promise<void> {
  // Categories whose questionnaire does NOT ask job tenure → programs there must
  // not gate on minMonthsInJob (can't be answered, so it can't reject).
  const NO_JOB_TENURE = new Set<string>(['mortgage', 'car', 'business']);
  const programs = await prisma.bankProgram.findMany({ where: { active: true }, select: { id: true, productCategory: true, eligibility: true, tenor: true } });
  for (const p of programs) {
    const elig = (p.eligibility ?? {}) as Record<string, unknown>;
    const emp = Array.isArray(elig.acceptedEmploymentTypes) ? (elig.acceptedEmploymentTypes as string[]) : [];
    const transfer = Array.isArray(elig.acceptedTransferTypes) ? (elig.acceptedTransferTypes as string[]) : [];
    const next: Record<string, unknown> = {
      ...elig,
      acceptedEmploymentTypes: Array.from(new Set([...emp, ...ALL_EMPLOYMENT_CODES])),
      acceptedTransferTypes: Array.from(new Set([...transfer, 'full_transfer'])),
    };
    if (NO_JOB_TENURE.has(p.productCategory.toLowerCase())) next.minMonthsInJob = 0;

    const data: Record<string, unknown> = { eligibility: next };
    // Correct mis-seeded mortgage tenor cap (84mo) so realistic 10–30y requests match.
    if (p.productCategory.toLowerCase() === 'mortgage') {
      const tenor = (p.tenor ?? {}) as Record<string, unknown>;
      if (Number(tenor.maxMonths ?? 0) < 120) data.tenor = { ...tenor, maxMonths: 300 };
    }
    await prisma.bankProgram.update({ where: { id: p.id }, data: data as never });
  }
  console.log(`  aligned employment + transfer (+ job-tenure relax) on ${programs.length} programs.`);
}

async function publishVersion(category: Category): Promise<void> {
  const groups = await prisma.questionGroup.findMany({ where: { category, isActive: true }, orderBy: { displayOrder: 'asc' } });
  const snapshotGroups = [];
  for (const g of groups) {
    const questions = await prisma.question.findMany({ where: { groupId: g.id, isActive: true }, orderBy: { displayOrder: 'asc' } });
    const qOut = [];
    for (const q of questions) {
      const options = await prisma.questionOption.findMany({ where: { questionId: q.id, isActive: true }, orderBy: { displayOrder: 'asc' } });
      qOut.push({
        code: q.code, type: q.type, questionAr: q.questionAr, questionEn: q.questionEn,
        helperTextAr: q.helperTextAr, helperTextEn: q.helperTextEn, isRequired: q.isRequired,
        displayOrder: q.displayOrder, enabledWhen: q.enabledWhen ?? null, systemRole: q.systemRole,
        isScored: q.isScored, profileField: q.profileField,
        options: options.map((o) => ({
          code: o.code, labelAr: o.labelAr, labelEn: o.labelEn, displayOrder: o.displayOrder,
          numericMin: o.numericMin?.toString() ?? null, numericMax: o.numericMax?.toString() ?? null,
          numericPoint: o.numericPoint?.toString() ?? null, scoreValue: o.scoreValue?.toString() ?? null,
          profileValue: o.profileValue ?? null,
        })),
      });
    }
    snapshotGroups.push({ code: g.code, titleAr: g.titleAr, titleEn: g.titleEn, displayOrder: g.displayOrder, questions: qOut });
  }
  const last = await prisma.questionnaireVersion.findFirst({ where: { category }, orderBy: { versionNumber: 'desc' }, select: { versionNumber: true } });
  const versionNumber = (last?.versionNumber ?? 0) + 1;
  await prisma.questionnaireVersion.updateMany({ where: { category, isActive: true }, data: { isActive: false } });
  await prisma.questionnaireVersion.create({
    data: { category, versionNumber, isActive: true, publishedAt: new Date(), publishedBy: SEED_ACTOR, snapshot: { category, versionNumber, groups: snapshotGroups } },
  });
}

function slug(label: string): string {
  return label.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '_').slice(0, 60) || 'opt';
}

/**
 * Re-key a factor-keyed weight preset onto question codes (v5.0.0). Factors with
 * no source question (COMPUTED, e.g. `debt_burden`) are dropped, then the
 * remaining weights are renormalized to sum exactly 100 (integers; the rounding
 * remainder lands on the largest weight).
 */
function toQuestionWeights(
  preset: Record<string, number>,
  questionByFactor: Map<string, string>,
): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const [factorCode, pts] of Object.entries(preset)) {
    const questionCode = questionByFactor.get(factorCode);
    if (!questionCode) continue; // dropped COMPUTED factor (e.g. debt_burden)
    raw[questionCode] = (raw[questionCode] ?? 0) + pts;
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total === 0) return raw;
  const out: Record<string, number> = {};
  for (const [code, pts] of Object.entries(raw)) out[code] = Math.round((pts * 100) / total);
  // Fix the rounding drift so the set sums to exactly 100.
  const drift = 100 - Object.values(out).reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    const largest = Object.entries(out).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (largest) out[largest] += drift;
  }
  return out;
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
