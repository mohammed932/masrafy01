/**
 * WHAT THE FIXED QUESTIONS' ANSWERS MEAN — the meanings the engine and the app read, owned in
 * CODE. Which questions are fixed is not here any more: since v31.0.0 (operator decision,
 * 2026-10-26) that is data the admin owns, `question.fixedServedOn`, held to the fixed rules by
 * `questionnaire/validation/fixed-questions.ts`. Until then this file was the set itself
 * (`BASE_QUESTIONS`, the client's «أسئلة إثبات الدخل» sheet, 2026-10-15) — its shapes, loan types
 * and show-when rules — and every change to it took a developer and a release; a migration
 * (`20261027090000_fixed_questions_are_data`) marked the same 17 questions, plus the five car
 * questions, with the same rows, answers and offers.
 *
 * WHY THE MEANINGS STAY IN CODE. An I-Score band is a slice of the bureau table, a transfer
 * answer is a rate-table key, a job answer a DBR/term bucket. An answer arriving with a code
 * nothing has ever seen is priced on silent defaults (the programme maximum, the first column,
 * the base rate), so a new answer to a question the engine reads is a release, and the release
 * is what gives it its meaning — the types make that a compile error to forget
 * (`IScoreBandAnswer` needs a range, `TransferAnswer` a rate-table key). The engine-input lock
 * refuses adding one from a screen (`engine-contract.ts`: months in the job and the salary
 * transfer are engine inputs, the I-Score band answers a platform fact).
 *
 * NO JOB QUESTION (operator decision, 2026-10-26, v30.18.0): the applicant picks the loan type
 * and then the program (doctors, youth, bankers, …) before the questionnaire starts, and the
 * operator ruled that pick the answer on EVERY name. Unasked, the job reads as the app's
 * `salaried` default (and preview's own fallback), so the programmes that price the job — ABK
 * Home Finishing CE39 DBR, the two CAE car terms, ABK card-to-loan term, the CAE compound DBR —
 * quote everyone on the salaried row. The operator's call, made knowing that.
 * `EMPLOYMENT_ANSWERS` stays: applications answered before then, and the job type an older app
 * build sends, are still bucketed through it.
 *
 * A LEAF MODULE on purpose: `employment-type.ts`, `iscore.ts`, `engine-inputs-from-answers.ts`,
 * the questionnaire's contract and engine-rules view, the seed and `check:questionnaire` all read
 * it, so it imports nothing that could import one of them back.
 */
import { I_SCORE_FACT_KEY } from './product-template';

// ---- Answer meanings ------------------------------------------------------------------------

/** The bucket a bank programme underwrites in (`COARSE_EMPLOYMENT_TYPES`). */
export type EmploymentBucket = 'salaried' | 'self_employed' | 'retired';

export interface EmploymentAnswer {
  readonly code: string;
  readonly bucket: EmploymentBucket;
}

/**
 * The answers the retired job question (`employment_status`, switched off 2026-10-26) offered,
 * in the client's order, each with the bucket it is priced in. No longer asked: kept because
 * applications answered before then, and the job type an older app build still sends, are
 * bucketed through it (`employment-type.ts`).
 *
 * Buckets: every ambiguous answer (doctor, other) is `self_employed`, the stricter row on all
 * five programmes that key on employment (CE39 DBR, the two CAE car terms, PL_TO_CARD term,
 * the CAE compound DBR) — so nobody is quoted above what their bank would write.
 */
export const EMPLOYMENT_ANSWERS: readonly EmploymentAnswer[] = [
  { code: 'military_officer', bucket: 'salaried' },
  { code: 'teacher', bucket: 'salaried' },
  { code: 'university_professor', bucket: 'salaried' },
  { code: 'doctor', bucket: 'self_employed' },
  { code: 'banker', bucket: 'salaried' },
  { code: 'engineer', bucket: 'self_employed' },
  { code: 'accountant', bucket: 'self_employed' },
  { code: 'lawyer_employee', bucket: 'salaried' },
  { code: 'lawyer_with_business', bucket: 'self_employed' },
  { code: 'lawyer_private_office', bucket: 'self_employed' },
  { code: 'private_sector_employee', bucket: 'salaried' },
  { code: 'government_employee', bucket: 'salaried' },
  { code: 'retired', bucket: 'retired' },
  { code: 'business_owner_company_owner', bucket: 'self_employed' },
  { code: 'freelancer', bucket: 'self_employed' },
  { code: 'other', bucket: 'self_employed' },
];

/** Job answer → bucket. */
export const EMPLOYMENT_BUCKET_BY_OPTION: Readonly<Record<string, EmploymentBucket>> =
  Object.fromEntries(EMPLOYMENT_ANSWERS.map((a) => [a.code, a.bucket]));

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

/**
 * The 27 governorates, as the `governorate` registry keys them — the answers the seed gives
 * "Which governorate do you live in?" on a fresh database. Labels come from that list.
 */
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

// ---- Codes ----------------------------------------------------------------------------------

export const MONTHS_IN_JOB_QUESTION_CODE = 'months_in_current_job';
export const I_SCORE_BAND_QUESTION_CODE = 'i_score_band';
export const CAN_TRANSFER_SALARY_QUESTION_CODE = 'can_transfer_salary';
export const ADDITIONAL_INCOME_QUESTION_CODE = 'additional_income';
export const OTHER_INCOME_QUESTION_CODE = 'other_income_monthly';
/** The registry fact the other-income amount is bound to — what `additionalIncome.sources` names. */
export const OTHER_INCOME_FACT_KEY = 'other_income_monthly';

/**
 * The questions the fixed income-proof questions REPLACED (v30.11.0). Switched off, never
 * deleted — answers stored against them stay on their applications, and an application stored
 * before the change is still read through them (`engine-inputs-from-answers.ts`).
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

/** The bureau-score range a band answer covers, `no_score` for N/A, `undefined` for no band. */
export function iScoreBandRange(code: string): IScoreBandAnswer['range'] | undefined {
  return I_SCORE_BANDS.find((b) => b.code === code)?.range;
}
