import { EMPLOYMENT_BUCKET_BY_OPTION } from './base-question-set';

/**
 * Employment-type grouping — applicant vocabulary → bank vocabulary.
 *
 * The questionnaire asks the applicant a DETAILED question (government employee,
 * private-sector employee, business owner, freelancer, retired) because that is
 * what a person can answer about themselves. A bank program, on the other hand,
 * writes its rules against the COARSE buckets it underwrites in — `salaried`,
 * `self_employed`, `retired`.
 *
 * Without this mapping the two vocabularies never meet: every seeded program
 * accepts `['salaried']` or `['salaried','self_employed']`, while a real applicant
 * arrives as `government_employee` or `business_owner` and matches nothing.
 *
 * Both vocabularies are real `employment_type` registry keys — this only decides
 * which one the MATCHING rules read. The detailed key stays on the application
 * snapshot untouched, so admin screens still show what the applicant actually said.
 */

/**
 * The buckets a bank may write a rule against — the RANGE of `coarseEmploymentType`, not
 * its domain.
 *
 * Exported because a bank-facing setting keyed by employment (`dbrCapPercentByEmploymentType`)
 * has to refuse a key the engine will never look up: a cap filed under `business_owner`
 * reads as configured on the screen and is dead at quote time, which is the worst pair of
 * properties a setting can have.
 *
 * `retired` is its own bucket, never folded into `salaried`, deliberately (a pension has its
 * own age and income rules).
 */
export const COARSE_EMPLOYMENT_TYPES = ['salaried', 'self_employed', 'retired'] as const;

export type CoarseEmploymentType = (typeof COARSE_EMPLOYMENT_TYPES)[number];

export function isCoarseEmploymentType(value: string): value is CoarseEmploymentType {
  return (COARSE_EMPLOYMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Detailed answer → the bucket bank programs underwrite in.
 *
 * The job answers the questionnaire offers come from the fixed question set
 * (`EMPLOYMENT_ANSWERS` in `base-question-set.ts`), each with its bucket stated beside it, so
 * a new job cannot be added without one. The rows before them are the vocabulary the mobile
 * app sends (`private_employee`, `business_owner`) and stays readable for stored applications.
 */
const COARSE_BY_DETAILED: Readonly<Record<string, string>> = {
  government_employee: 'salaried',
  private_employee: 'salaried',
  business_owner: 'self_employed',
  freelancer: 'self_employed',
  ...EMPLOYMENT_BUCKET_BY_OPTION,
};

/**
 * Buckets that carry their own underwriting rules — `retired` is deliberately NOT
 * folded into `salaried`: age and income rules differ for a pension.
 */
export function coarseEmploymentType(detailed: string): string {
  return COARSE_BY_DETAILED[detailed] ?? detailed;
}

/**
 * True when the engine knows which bucket an answer belongs to — a detailed code it maps, or a
 * bucket itself. An option the questionnaire offers outside this set passes through
 * `coarseEmploymentType` unchanged, misses every per-employment row (DBR cap, rate, ceiling,
 * term) and is quietly priced on the programme default, so the questionnaire refuses to offer
 * one (`engine-contract.ts`).
 */
export function isKnownEmploymentType(code: string): boolean {
  return code in COARSE_BY_DETAILED || isCoarseEmploymentType(code);
}

/**
 * Self-employed applicants face the stricter age / minimum-income band
 * (`selfEmployedMinAge`, `selfEmployedMinMonthlyIncomeEGP`). Decided on the COARSE
 * bucket so a freelancer is treated like a business owner, and a government
 * employee is not punished for not literally answering "salaried".
 */
export function isSelfEmployedBucket(detailed: string): boolean {
  return coarseEmploymentType(detailed) === 'self_employed';
}
