/**
 * Approval probability scorer (FR-033, FR-034).
 * Uses SCORING_WEIGHTS to compute a clamped percentage.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { SCORING_WEIGHTS } from '../scoring-weights';
import type { ApplicantProfile, BankProgramSnapshot } from '../types';

export interface ApprovalProbabilityInput {
  profile: ApplicantProfile;
  program: BankProgramSnapshot;
  assumedMonthlyIncomeEGP: Decimal;
  dbrPercent: Decimal;
}

export function calculateApprovalProbability(input: ApprovalProbabilityInput): number {
  const { profile, program, assumedMonthlyIncomeEGP, dbrPercent } = input;
  let score = SCORING_WEIGHTS.BASE;

  if (profile.obligations.hasPreviousRejection) score += SCORING_WEIGHTS.PREVIOUS_REJECTION;

  if (profile.age <= program.eligibility.minAge + 2) score += SCORING_WEIGHTS.AGE_NEAR_MIN;

  if (dbrPercent.greaterThanOrEqualTo(40)) score += SCORING_WEIGHTS.HIGH_DBR;

  const minIncome = new Decimal(program.eligibility.minMonthlyIncomeEGP);
  if (minIncome.greaterThan(0)) {
    const ratio = assumedMonthlyIncomeEGP.div(minIncome);
    if (ratio.lessThan('1.2')) score += SCORING_WEIGHTS.INCOME_NEAR_MIN;
  }

  if (profile.employment.companyType !== 'cat_a') score += SCORING_WEIGHTS.NOT_CAT_A;

  if (profile.assets.cdAtABKValueEGP?.greaterThan(0)) score += SCORING_WEIGHTS.HAS_CD_AT_ABK;

  if (profile.employment.monthsInJob > 36) score += SCORING_WEIGHTS.LONG_TENURE;

  if (profile.employment.salaryTransferType === 'payroll_transfer') {
    score += SCORING_WEIGHTS.PAYROLL_TRANSFER;
  }

  if (program.productCategory === 'bankers') score += SCORING_WEIGHTS.BANKERS_PROGRAM;
  if (program.productCategory === 'pensions') score += SCORING_WEIGHTS.PENSIONS_PROGRAM;

  return Math.max(SCORING_WEIGHTS.CLAMP_MIN, Math.min(SCORING_WEIGHTS.CLAMP_MAX, score));
}
