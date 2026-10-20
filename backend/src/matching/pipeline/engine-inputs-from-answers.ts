/**
 * Questionnaire answers → the three EMPLOYMENT inputs the engine reads, in ONE place.
 *
 * Pure (Principle V), and read by BOTH `applications.service.ts#buildProfile` and
 * `matching-preview.service.ts#buildProfile`: preview and apply deriving the same engine input
 * differently is a review block (A33). Until v30.11.0 they did — apply took the job type, the
 * months in the job and the salary transfer from the request body the phone filled in, and
 * preview priced every applicant as a salaried employee with no transfer and no months in the
 * job, so a self-employed applicant was shown one figure and offered another.
 *
 * Read off the FIXED QUESTION SET (`base-question-set.ts`), whose answers mean exactly one
 * thing each:
 *
 *   `employment_status`       the job answer itself — the bucket is applied downstream by
 *                             `coarseEmploymentType`, which knows every code the set offers
 *   `months_in_current_job`   a number of months, floored
 *   `can_transfer_salary`     yes → a salary-transfer letter, no → none (`TRANSFER_ANSWERS`)
 *
 * and, for an application answered before the set existed, the two questions it replaced —
 * the tenure buckets (`job_tenure`) and the transfer arrangement (`salary_transfer`) — read the
 * way the app always read them.
 *
 * An UNANSWERED input stays `undefined`, never defaulted here: each caller states its own
 * fallback (apply: the request body; preview: what it always assumed), so this function can
 * never invent a figure nobody gave.
 */
import { EMPLOYMENT_TYPE_QUESTION_CODE } from './money-field-bindings';
import {
  CAN_TRANSFER_SALARY_QUESTION_CODE,
  LEGACY_JOB_TENURE_MONTHS,
  LEGACY_JOB_TENURE_QUESTION_CODE,
  LEGACY_SALARY_TRANSFER_QUESTION_CODE,
  LEGACY_TRANSFER_TYPE_BY_OPTION,
  MONTHS_IN_JOB_QUESTION_CODE,
  TRANSFER_TYPE_BY_OPTION,
} from './base-question-set';

/** The validated answers, as the two callers already hold them for `surrogateFactsFromAnswers`. */
export interface EmploymentAnswerMaps {
  /** Every SINGLE_SELECT answer by question code — the option code picked. */
  readonly optionByCode: ReadonlyMap<string, string>;
  /** Every NUMERIC answer by question code, as the validated decimal string. */
  readonly numericByCode: ReadonlyMap<string, string>;
}

export interface EmploymentInputs {
  /** The job answer (a detailed code; `coarseEmploymentType` buckets it). */
  employmentType?: string;
  monthsInJob?: number;
  /** A `transfer_type` key — what `rateByTransferType` tables are keyed by. */
  salaryTransferType?: string;
}

export function employmentInputsFromAnswers(answers: EmploymentAnswerMaps): EmploymentInputs {
  const out: EmploymentInputs = {};

  const job = answers.optionByCode.get(EMPLOYMENT_TYPE_QUESTION_CODE);
  if (job !== undefined) out.employmentType = job;

  const months = monthsInJobOf(answers);
  if (months !== undefined) out.monthsInJob = months;

  const transfer = transferTypeOf(answers);
  if (transfer !== undefined) out.salaryTransferType = transfer;

  return out;
}

function monthsInJobOf(answers: EmploymentAnswerMaps): number | undefined {
  const typed = answers.numericByCode.get(MONTHS_IN_JOB_QUESTION_CODE);
  if (typed !== undefined) {
    const value = Math.floor(Number(typed));
    if (Number.isFinite(value) && value >= 0) return value;
  }
  const bucket = answers.optionByCode.get(LEGACY_JOB_TENURE_QUESTION_CODE);
  return bucket === undefined ? undefined : LEGACY_JOB_TENURE_MONTHS[bucket];
}

function transferTypeOf(answers: EmploymentAnswerMaps): string | undefined {
  const picked = answers.optionByCode.get(CAN_TRANSFER_SALARY_QUESTION_CODE);
  if (picked !== undefined) return TRANSFER_TYPE_BY_OPTION[picked];
  const legacy = answers.optionByCode.get(LEGACY_SALARY_TRANSFER_QUESTION_CODE);
  return legacy === undefined ? undefined : LEGACY_TRANSFER_TYPE_BY_OPTION[legacy];
}
