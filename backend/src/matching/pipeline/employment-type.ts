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

/** Detailed answer → the bucket bank programs underwrite in. */
const COARSE_BY_DETAILED: Readonly<Record<string, string>> = {
  government_employee: 'salaried',
  private_employee: 'salaried',
  business_owner: 'self_employed',
  freelancer: 'self_employed',
};

/**
 * Buckets that carry their own underwriting rules — `retired` is deliberately NOT
 * folded into `salaried`: age and income rules differ for a pension.
 */
export function coarseEmploymentType(detailed: string): string {
  return COARSE_BY_DETAILED[detailed] ?? detailed;
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
