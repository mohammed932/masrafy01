/**
 * THE FIXED QUESTION SET — what every income-proof (payslip) programme is quoted from, owned
 * in CODE (operator decision, 2026-10-15; the client's "أسئلة إثبات الدخل" sheet).
 *
 * WHY IN CODE AND NOT ON MANAGE VALUES. Every answer here means something to the engine or the
 * app, and that meaning lives in code: a job answer is a DBR/term bucket and a group that
 * decides which follow-up questions appear, an I-Score band is a slice of the bureau table, a
 * transfer answer is a rate-table key. An answer added from a screen would arrive with a code
 * nothing has ever seen and be priced on silent defaults (the programme maximum, the first
 * column, the base rate). So the answer lists below are the only place a fixed question's
 * answers come from: a new one is a release, and the release is what gives it its meaning —
 * the types make that a compile error to forget (`EmploymentAnswer` needs a bucket and a
 * group, `IScoreBandAnswer` a range, `TransferAnswer` a rate-table key).
 *
 * WHAT THE ADMIN MAY STILL CHANGE: wording only — the question, its helper text and its
 * answers' labels, in both languages — and where it sits in the order. Everything listed here
 * (type, unit, bounds, max length, required, show-when rule, the answers themselves, the loan
 * types it is asked in) is enforced by the engine-input contract (`engine-contract.ts`,
 * `shapeFixed`) on every questionnaire write, and by the program-name lock
 * (`questionLockReason`, reason `base`) on every per-name untick.
 *
 * WHERE IT IS SERVED (`question-scope.ts`): an `income_proof` question is asked on every
 * (program name, loan type) that sells a payslip programme — and on a name with no programme
 * yet, since a name created from the admin is payslip-only (v30.8.0) — whatever any untick
 * says. An `every_name` question is asked on every name, payslip or not.
 *
 * A LEAF MODULE on purpose: `employment-type.ts`, `iscore.ts`, the questionnaire's scope rule
 * and contract, the seed and `check:questionnaire` all read it, so it imports nothing that
 * could import one of them back.
 */
import {
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
} from './money-field-bindings';
import { I_SCORE_FACT_KEY } from './product-template';

/**
 * The four retail loan types (Principle II), spelled out here because the engine may not import
 * the Prisma runtime — the same literals as the `LoanCategory` enum, so the two assign freely.
 */
export type LoanCategory = 'personal' | 'car' | 'mortgage' | 'business';

// ---- Answer meanings ------------------------------------------------------------------------

/** The bucket a bank programme underwrites in (`COARSE_EMPLOYMENT_TYPES`). */
export type EmploymentBucket = 'salaried' | 'self_employed' | 'retired';

/**
 * Which follow-up questions a job answer opens (the client's sheet):
 *   `employee` → can you transfer your salary, can you provide a payroll statement
 *   `employer` → commercial register older than 18 months, tax card
 *   `doctor`   → years working as a doctor
 *   `none`     → nothing more
 */
export type JobGroup = 'employee' | 'employer' | 'doctor' | 'none';

export interface EmploymentAnswer {
  readonly code: string;
  readonly bucket: EmploymentBucket;
  readonly group: JobGroup;
}

/**
 * The job list, in the client's order. Five codes are the answers `employment_status` already
 * offered (kept so stored answers and installed apps keep reading); the rest are new.
 *
 * The lawyer's "nature of work" is three ANSWERS here, not a follow-up question: the sheet
 * opens the employer questions for "employer group OR lawyer with another business", and a
 * show-when rule can watch only one question.
 *
 * Buckets: every ambiguous answer (doctor, other) is `self_employed`, the stricter row on all
 * five programmes that key on employment (CE39 DBR, the two CAE car terms, PL_TO_CARD term,
 * the CAE compound DBR) — so nobody is quoted above what their bank would write.
 */
export const EMPLOYMENT_ANSWERS: readonly EmploymentAnswer[] = [
  { code: 'military_officer', bucket: 'salaried', group: 'employee' },
  { code: 'teacher', bucket: 'salaried', group: 'employee' },
  { code: 'university_professor', bucket: 'salaried', group: 'employee' },
  { code: 'doctor', bucket: 'self_employed', group: 'doctor' },
  { code: 'banker', bucket: 'salaried', group: 'employee' },
  { code: 'engineer', bucket: 'self_employed', group: 'employer' },
  { code: 'accountant', bucket: 'self_employed', group: 'employer' },
  { code: 'lawyer_employee', bucket: 'salaried', group: 'employee' },
  { code: 'lawyer_with_business', bucket: 'self_employed', group: 'employer' },
  { code: 'lawyer_private_office', bucket: 'self_employed', group: 'none' },
  { code: 'private_sector_employee', bucket: 'salaried', group: 'employee' },
  { code: 'government_employee', bucket: 'salaried', group: 'employee' },
  { code: 'retired', bucket: 'retired', group: 'none' },
  { code: 'business_owner_company_owner', bucket: 'self_employed', group: 'employer' },
  { code: 'freelancer', bucket: 'self_employed', group: 'none' },
  { code: 'other', bucket: 'self_employed', group: 'none' },
];

/** Job answer → bucket. */
export const EMPLOYMENT_BUCKET_BY_OPTION: Readonly<Record<string, EmploymentBucket>> =
  Object.fromEntries(EMPLOYMENT_ANSWERS.map((a) => [a.code, a.bucket]));

/** The job answers in one follow-up group, in list order. */
export function jobGroupCodes(group: JobGroup): readonly string[] {
  return EMPLOYMENT_ANSWERS.filter((a) => a.group === group).map((a) => a.code);
}

/**
 * One I-Score band: the bureau scores it covers, `[from, to)` with `null` an open end — the
 * shape of the shared table's own bands (`platformIScoreTiers`), so a band and a table row
 * compare edge to edge. `no_score` is the bureau's N/A.
 */
export interface IScoreBandAnswer {
  readonly code: string;
  readonly range: { readonly from: string | null; readonly to: string | null } | 'no_score';
}

/** The four bands the client asks, edges exactly where the shared table's classes break. */
export const I_SCORE_BANDS: readonly IScoreBandAnswer[] = [
  { code: 'no_score', range: 'no_score' },
  { code: 'below_521', range: { from: null, to: '521' } },
  { code: 'from_521_to_625', range: { from: '521', to: '626' } },
  { code: 'above_625', range: { from: '626', to: null } },
];

/** One answer to "can you transfer your salary if approved?" and the rate-table key it reads as. */
export interface TransferAnswer {
  readonly code: string;
  /** A `transfer_type` registry key — what `rateByTransferType` tables are keyed by. */
  readonly transferType: string;
}

/**
 * Yes reads as a salary-transfer LETTER: the customer commits to moving their salary on
 * approval, which is what the letter is — not a payroll arrangement they already have. The
 * conservative reading too: a bank's letter rate is never better than its payroll rate.
 */
export const TRANSFER_ANSWERS: readonly TransferAnswer[] = [
  { code: 'yes', transferType: 'salary_transfer_letter' },
  { code: 'no', transferType: 'none' },
];

export const TRANSFER_TYPE_BY_OPTION: Readonly<Record<string, string>> = Object.fromEntries(
  TRANSFER_ANSWERS.map((a) => [a.code, a.transferType]),
);

/** The 27 governorates, as the `governorate` registry keys them. Labels come from that list. */
export const RESIDENCE_GOVERNORATE_CODES: readonly string[] = [
  'cairo',
  'giza',
  'alexandria',
  'qalyubia',
  'port_said',
  'suez',
  'dakahlia',
  'sharqia',
  'gharbia',
  'menofia',
  'beheira',
  'kafr_el_sheikh',
  'damietta',
  'ismailia',
  'fayoum',
  'beni_suef',
  'minya',
  'assiut',
  'sohag',
  'qena',
  'luxor',
  'aswan',
  'red_sea',
  'new_valley',
  'matrouh',
  'north_sinai',
  'south_sinai',
];

const YES_NO: readonly string[] = ['yes', 'no'];

// ---- Codes ----------------------------------------------------------------------------------

export const MONTHS_IN_JOB_QUESTION_CODE = 'months_in_current_job';
export const I_SCORE_BAND_QUESTION_CODE = 'i_score_band';
export const CAN_TRANSFER_SALARY_QUESTION_CODE = 'can_transfer_salary';
export const ADDITIONAL_INCOME_QUESTION_CODE = 'additional_income';
export const OTHER_INCOME_QUESTION_CODE = 'other_income_monthly';
/** The registry fact the other-income amount is bound to — what `additionalIncome.sources` names. */
export const OTHER_INCOME_FACT_KEY = 'other_income_monthly';

/**
 * The questions this set REPLACED (v30.11.0). Switched off, never deleted — answers stored
 * against them stay on their applications, and an application stored before the change is
 * still read through them (`engine-inputs-from-answers.ts`).
 */
export const LEGACY_JOB_TENURE_QUESTION_CODE = 'job_tenure';
export const LEGACY_SALARY_TRANSFER_QUESTION_CODE = 'salary_transfer';
export const LEGACY_I_SCORE_QUESTION_CODE = I_SCORE_FACT_KEY;

/** The old tenure buckets → months, the values the app always sent for them. */
export const LEGACY_JOB_TENURE_MONTHS: Readonly<Record<string, number>> = {
  less_than_6_months: 3,
  '6_months_to_1_year': 9,
  '1_to_3_years': 24,
  more_than_3_years: 48,
};

/** The old "how does your pay reach the bank" answers → their rate-table key. */
export const LEGACY_TRANSFER_TYPE_BY_OPTION: Readonly<Record<string, string>> = {
  payroll: 'payroll',
  salary_transfer_letter: 'salary_transfer_letter',
  income_transfer_letter: 'income_transfer_letter',
  no_salary_transfer: 'none',
};

// ---- The set --------------------------------------------------------------------------------

export type BaseQuestionServedOn = 'income_proof' | 'every_name';

/**
 * A show-when rule. `equals` names one answer, `in` several (stored as `optionCodes`); `in`
 * is what lets a follow-up open for a whole job group from the one job question.
 */
export interface BaseGate {
  readonly questionCode: string;
  readonly operator: 'equals' | 'in';
  readonly optionCodes: readonly string[];
}

export interface BaseNumericRules {
  /** Decimal strings, as the question columns hold them; `null` = unbounded / no step. */
  readonly minValue: string | null;
  readonly maxValue: string | null;
  readonly step: string | null;
  readonly unitEn: string | null;
  readonly unitAr: string | null;
}

interface BaseQuestionCommon {
  readonly code: string;
  /** Every loan type it must be asked in — an ORDINARY row in each, never opt-in. */
  readonly categories: readonly LoanCategory[];
  readonly servedOn: BaseQuestionServedOn;
  /** `null` = asked unconditionally. */
  readonly gate: BaseGate | null;
  /** The registry fact the answer is bound to, or `null` when no fact reads it. */
  readonly factKey: string | null;
}

/** Every base question is REQUIRED wherever it is shown — the lock refuses making one optional. */
export type BaseQuestion = BaseQuestionCommon &
  (
    | { readonly type: 'NUMERIC'; readonly numeric: BaseNumericRules }
    | { readonly type: 'TEXT'; readonly maxLength: number }
    | { readonly type: 'SINGLE_SELECT' | 'MULTI_SELECT'; readonly options: readonly string[] }
  );

const ALL: readonly LoanCategory[] = ['personal', 'car', 'mortgage', 'business'];
/** The loan types a payslip programme is sold under today. Business has none yet. */
const PAYSLIP: readonly LoanCategory[] = ['personal', 'car', 'mortgage'];

const EGP = { unitEn: 'EGP', unitAr: 'جنيه' } as const;
const money = (
  minValue: string,
  maxValue: string,
  step: string | null = null,
): BaseNumericRules => ({
  minValue,
  maxValue,
  step,
  ...EGP,
});

const groupGate = (group: JobGroup): BaseGate => {
  const codes = jobGroupCodes(group);
  return {
    questionCode: EMPLOYMENT_TYPE_QUESTION_CODE,
    operator: codes.length === 1 ? 'equals' : 'in',
    optionCodes: codes,
  };
};

const debtGate = (debtType: string): BaseGate => ({
  questionCode: DEBT_TYPES_QUESTION_CODE,
  operator: 'equals',
  optionCodes: [debtType],
});

/**
 * In the client's order. The money questions and the debts keep today's live bounds exactly
 * (`check:questionnaire` proves the rows equal this list); they are `income_proof` and not
 * `every_name` because a no-payslip name deliberately asks neither the declared salary nor the
 * lump sum (`ASKED_EVEN_WHEN_PRODUCT_ONLY`).
 */
export const BASE_QUESTIONS: readonly BaseQuestion[] = [
  {
    code: EMPLOYMENT_TYPE_QUESTION_CODE,
    type: 'SINGLE_SELECT',
    options: EMPLOYMENT_ANSWERS.map((a) => a.code),
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: MONTHS_IN_JOB_QUESTION_CODE,
    type: 'NUMERIC',
    numeric: { minValue: '0', maxValue: '600', step: '1', unitEn: 'months', unitAr: 'شهر' },
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: 'years_as_doctor',
    type: 'NUMERIC',
    numeric: { minValue: '0', maxValue: '60', step: '1', unitEn: 'years', unitAr: 'سنة' },
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: groupGate('doctor'),
    factKey: null,
  },
  {
    code: 'commercial_register_18m',
    type: 'SINGLE_SELECT',
    options: YES_NO,
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: groupGate('employer'),
    factKey: null,
  },
  {
    code: 'has_tax_card',
    type: 'SINGLE_SELECT',
    options: YES_NO,
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: groupGate('employer'),
    factKey: null,
  },
  {
    code: CAN_TRANSFER_SALARY_QUESTION_CODE,
    type: 'SINGLE_SELECT',
    options: TRANSFER_ANSWERS.map((a) => a.code),
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: groupGate('employee'),
    factKey: null,
  },
  {
    code: 'can_provide_payroll',
    type: 'SINGLE_SELECT',
    options: YES_NO,
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: groupGate('employee'),
    factKey: null,
  },
  {
    code: 'residence_governorate',
    type: 'SINGLE_SELECT',
    options: RESIDENCE_GOVERNORATE_CODES,
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: 'residence_area',
    type: 'TEXT',
    maxLength: 120,
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: I_SCORE_BAND_QUESTION_CODE,
    type: 'SINGLE_SELECT',
    options: I_SCORE_BANDS.map((b) => b.code),
    categories: ALL,
    servedOn: 'every_name',
    gate: null,
    factKey: I_SCORE_FACT_KEY,
  },
  {
    code: MONEY_FIELD_BINDINGS.requested_amount,
    type: 'NUMERIC',
    numeric: money('10000', '20000000', '1000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: MONEY_FIELD_BINDINGS.tenor_months,
    type: 'NUMERIC',
    numeric: { minValue: '6', maxValue: '300', step: '6', unitEn: 'months', unitAr: 'شهر' },
    categories: ALL,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: MONEY_FIELD_BINDINGS.monthly_income,
    type: 'NUMERIC',
    numeric: money('1000', '5000000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: DEBT_TYPES_QUESTION_CODE,
    type: 'MULTI_SELECT',
    options: [
      DEBT_TYPE_NONE_OPTION,
      'personal_loan',
      'car_loan',
      'mortgage',
      'credit_cards',
      'other',
    ],
    categories: ALL,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE.car_loan,
    type: 'NUMERIC',
    numeric: money('0', '5000000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: debtGate('car_loan'),
    factKey: null,
  },
  {
    code: OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE.credit_cards,
    type: 'NUMERIC',
    numeric: money('0', '20000000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: debtGate('credit_cards'),
    factKey: null,
  },
  {
    code: OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE.personal_loan,
    type: 'NUMERIC',
    numeric: money('0', '5000000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: debtGate('personal_loan'),
    factKey: null,
  },
  {
    code: OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE.mortgage,
    type: 'NUMERIC',
    numeric: money('0', '5000000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: debtGate('mortgage'),
    factKey: null,
  },
  {
    code: OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE.other,
    type: 'NUMERIC',
    numeric: money('0', '5000000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: debtGate('other'),
    factKey: null,
  },
  {
    code: MONEY_FIELD_BINDINGS.existing_obligations,
    type: 'NUMERIC',
    numeric: money('0', '5000000'),
    categories: ALL,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: ADDITIONAL_INCOME_QUESTION_CODE,
    type: 'SINGLE_SELECT',
    options: YES_NO,
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
  {
    code: OTHER_INCOME_QUESTION_CODE,
    type: 'NUMERIC',
    numeric: money('1', '5000000'),
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: {
      questionCode: ADDITIONAL_INCOME_QUESTION_CODE,
      operator: 'equals',
      optionCodes: ['yes'],
    },
    factKey: OTHER_INCOME_FACT_KEY,
  },
  {
    code: 'has_bank_statement',
    type: 'SINGLE_SELECT',
    options: YES_NO,
    categories: PAYSLIP,
    servedOn: 'income_proof',
    gate: null,
    factKey: null,
  },
];

const BY_CODE: ReadonlyMap<string, BaseQuestion> = new Map(BASE_QUESTIONS.map((q) => [q.code, q]));

/** The base question with this code, or `undefined` when it is not in the set. */
export function baseQuestion(code: string): BaseQuestion | undefined {
  return BY_CODE.get(code);
}

export function isBaseQuestionCode(code: string): boolean {
  return BY_CODE.has(code);
}

/** Every base code. */
export const BASE_QUESTION_CODES: readonly string[] = BASE_QUESTIONS.map((q) => q.code);

/**
 * The base codes a path must serve: the every-name ones always, the income-proof ones when the
 * (name, loan type) sells a payslip programme.
 */
export function baseCodesServed(incomeProof: boolean): ReadonlySet<string> {
  return new Set(
    BASE_QUESTIONS.filter((q) => q.servedOn === 'every_name' || incomeProof).map((q) => q.code),
  );
}

/** The ACTIVE answer codes a base choice question must offer — exactly these, no more. */
export function baseOptionCodes(q: BaseQuestion): readonly string[] {
  return q.type === 'SINGLE_SELECT' || q.type === 'MULTI_SELECT' ? q.options : [];
}

/**
 * The gate as `question.enabledWhen` stores it: one answer as `optionCode` (the shape every
 * reader has always understood), several as `optionCodes` under `in`.
 */
export function baseGateJson(
  gate: BaseGate | null,
): { questionCode: string; operator: string; optionCode?: string; optionCodes?: string[] } | null {
  if (gate === null) return null;
  if (gate.operator === 'equals') {
    return {
      questionCode: gate.questionCode,
      operator: 'equals',
      optionCode: gate.optionCodes[0] ?? '',
    };
  }
  return { questionCode: gate.questionCode, operator: 'in', optionCodes: [...gate.optionCodes] };
}

/** The bureau-score range a band answer covers, `no_score` for N/A, `undefined` for no band. */
export function iScoreBandRange(code: string): IScoreBandAnswer['range'] | undefined {
  return I_SCORE_BANDS.find((b) => b.code === code)?.range;
}
