/**
 * Approval probability scorer (FR-033, FR-034).
 *
 * Output shape upgraded in feature 004: produces a structured
 * `ApprovalProbabilityResult` carrying the score, the tier, and the positive +
 * negative factor lists (sorted by `|impact|` desc). Engine version is NOT
 * stamped here — the orchestrator owns that concern.
 *
 * Pure function. Consumes a `ScoringConfig` value object passed in by the engine
 * orchestrator. NO imports from `scoring-versions/` or `applications/`.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type {
  ApplicantProfile,
  ApprovalFactors,
  ApprovalProbabilityResult,
  ApprovalTier,
  BankProgramSnapshot,
  FactorImpact,
  ScoringConfig,
  ScoringThresholds,
} from '../types';

export interface ApprovalProbabilityInput {
  profile: ApplicantProfile;
  program: BankProgramSnapshot;
  assumedMonthlyIncomeEGP: Decimal;
  dbrPercent: Decimal;
  scoringConfig: ScoringConfig;
}

export function calculateApprovalProbability(
  input: ApprovalProbabilityInput,
): ApprovalProbabilityResult {
  const { profile, program, assumedMonthlyIncomeEGP, dbrPercent, scoringConfig } = input;
  const w = scoringConfig.weights;
  const base = w.BASE ?? 70;
  const clampMin = w.CLAMP_MIN ?? 10;
  const clampMax = w.CLAMP_MAX ?? 95;

  const positive: FactorImpact[] = [];
  const negative: FactorImpact[] = [];

  const apply = (condition: boolean, code: string): void => {
    if (!condition) return;
    const impact = w[code];
    if (impact === undefined || impact === 0) return;
    if (impact > 0) positive.push({ code, impact });
    else negative.push({ code, impact });
  };

  apply(profile.obligations.hasPreviousRejection, 'PREVIOUS_REJECTION');
  apply(profile.age <= program.eligibility.minAge + 2, 'AGE_NEAR_MIN');
  apply(dbrPercent.greaterThanOrEqualTo(40), 'HIGH_DBR');

  const minIncome = new Decimal(program.eligibility.minMonthlyIncomeEGP);
  if (minIncome.greaterThan(0)) {
    const ratio = assumedMonthlyIncomeEGP.div(minIncome);
    apply(ratio.lessThan('1.2'), 'INCOME_NEAR_MIN');
  }

  apply(profile.employment.companyType !== 'cat_a', 'NOT_CAT_A');
  apply(profile.assets.cdAtABKValueEGP?.greaterThan(0) ?? false, 'HAS_CD_AT_ABK');
  apply(profile.employment.monthsInJob > 36, 'LONG_TENURE');
  apply(profile.employment.salaryTransferType === 'payroll_transfer', 'PAYROLL_TRANSFER');
  apply(program.productCategory === 'bankers', 'BANKERS_PROGRAM');
  apply(program.productCategory === 'pensions', 'PENSIONS_PROGRAM');

  const rawSum =
    base +
    positive.reduce((s, f) => s + f.impact, 0) +
    negative.reduce((s, f) => s + f.impact, 0);

  let score = rawSum;
  if (rawSum < clampMin) {
    positive.push({ code: 'CLAMPED_TO_FLOOR', impact: clampMin - rawSum });
    score = clampMin;
  } else if (rawSum > clampMax) {
    positive.push({ code: 'CLAMPED_TO_CEILING', impact: rawSum - clampMax });
    score = clampMax;
  }

  // Sort by |impact| desc — biggest mover first within each array.
  positive.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  negative.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  const factors: ApprovalFactors = { positive, negative };
  const tier = classifyTier(score, scoringConfig.thresholds);
  return { score, tier, factors };
}

/**
 * Pure helper. Inclusive on the upper-tier side: score === 80 → 'excellent'.
 */
export function classifyTier(score: number, thresholds: ScoringThresholds): ApprovalTier {
  if (score >= thresholds.excellent) return 'excellent';
  if (score >= thresholds.good) return 'good';
  if (score >= thresholds.moderate) return 'moderate';
  if (score >= thresholds.low) return 'low';
  return 'very_low';
}
