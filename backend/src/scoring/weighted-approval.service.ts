import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { ScoringRepository } from './scoring.repository';
import {
  computeProbability,
  normalizeWeights,
  tierFor,
  type ApprovalTier,
  type ProgramScoring,
  type SelectedAnswer,
} from '@/matching/scoring/approval-probability.scorer';
import type { ApprovalFactors } from '@/matching/types';

/**
 * Two-level weighted approval scoring (Constitution V — v8.0.0).
 *
 * THE single place that turns a customer's selected answers + a bank program's
 * ACTIVE weight set into an approval probability. Both the mobile preview
 * (`matching-preview`) and the persisted apply flow (`applications`) call this —
 * no duplicated formula (Anti-Pattern A25).
 *
 *   probability = Σ_question ( questionWeight/100 × pickedAnswerScore/100 )
 *
 * - Scoring: the program's ACTIVE `ScoringWeightSet` — per-question weights
 *   (sum 100) + per-answer scores (0..100). Legacy single-level rows are
 *   upgraded on read (`normalizeWeights`). No ACTIVE set → 0 (`very_low`).
 * - There is no eligibility gating (dropped for MVP).
 */
@Injectable()
export class WeightedApprovalScoringService {
  constructor(private readonly scoring: ScoringRepository) {}

  /**
   * Score one program for one applicant. Returns the 0..100 score, 0..1
   * probability, tier, the per-answer contribution breakdown, and whether the
   * program had no ACTIVE weight set.
   */
  async scoreProgram(args: {
    programId: string | null;
    category: LoanCategory;
    answers: readonly SelectedAnswer[];
  }): Promise<{
    score: number;
    probability: number;
    tier: ApprovalTier;
    usedDefault: boolean;
    factors: ApprovalFactors;
  }> {
    const active = args.programId ? await this.scoring.activeSet(args.programId) : null;
    const usedDefault = active === null;
    const scoring: ProgramScoring = active
      ? normalizeWeights(active.weights)
      : { questionWeights: {}, answerScores: {} };

    const probability = computeProbability(scoring, args.answers);
    return {
      score: Math.round(probability * 100),
      probability: Number(probability.toFixed(4)),
      tier: tierFor(probability),
      usedDefault,
      factors: buildFactorBreakdown(scoring, args.answers),
    };
  }
}

/**
 * Transparency breakdown persisted on the offer: each selected answer's
 * contribution (`questionWeight/100 × score`, in points out of 100) as a
 * positive impact, biggest first. Mirrors the `ApprovalFactors` shape the
 * admin/mobile already read.
 */
function buildFactorBreakdown(
  scoring: ProgramScoring,
  answers: readonly SelectedAnswer[],
): ApprovalFactors {
  const positive = answers
    .map((a) => {
      const weight = scoring.questionWeights[a.questionCode] ?? 0;
      const score = scoring.answerScores[a.questionCode]?.[a.optionCode] ?? 0;
      return { code: a.optionCode, impact: Math.round((weight / 100) * score) };
    })
    .filter((f) => f.impact > 0)
    .sort((a, b) => b.impact - a.impact);
  return { positive, negative: [] };
}
