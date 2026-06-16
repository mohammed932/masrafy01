import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { ScoringRepository } from './scoring.repository';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import {
  computeProbability,
  defaultWeights,
  tierFor,
  type ApprovalTier,
  type SubScores,
  type Weights,
} from '@/matching/scoring/approval-probability.scorer';
import type { ApprovalFactors } from '@/matching/types';

/**
 * Per-question weighted approval scoring (Constitution V v5.0.0).
 *
 * THE single place that turns answers + a bank program's ACTIVE weight set into
 * an approval probability. Both the mobile preview (`matching-preview`) and the
 * persisted apply flow (`applications`) call this — no duplicated formula
 * (Anti-Pattern A25).
 *
 *   probability = Σ ( selectedOption.scoreValue × questionWeight ) / 100
 *
 * - Sub-scores: the selected option's admin-set `scoreValue` (0..1), keyed by
 *   the answer's `questionCode`.
 * - Weights: the program's ACTIVE `ScoringWeightSet` (keyed by `questionCode`);
 *   falls back to an equal code-default split across the category's scored
 *   questions so no program is ever left unscored.
 * - DBR is NOT part of the probability (v5.0.0) — it is an eligibility gate only.
 */
@Injectable()
export class WeightedApprovalScoringService {
  constructor(
    private readonly scoring: ScoringRepository,
    private readonly questionnaire: QuestionnaireRepository,
  ) {}

  /**
   * Sub-scores keyed by `questionCode`, from each answer's selected option
   * `scoreValue`. Non-scoring answers carry a null scoreValue → contribute 0
   * (and are dropped from a program's weight set, so they don't matter).
   */
  buildSubScores(
    answers: ReadonlyArray<{ questionCode: string; scoreValue: string | number | null }>,
  ): SubScores {
    const subScores: SubScores = {};
    for (const a of answers) {
      subScores[a.questionCode] = a.scoreValue != null ? Number(a.scoreValue) : 0;
    }
    return subScores;
  }

  /**
   * Score one program for one applicant. Returns the 0..100 score, 0..1
   * probability, tier, the per-question contribution breakdown, and whether the
   * code-default weight set was used.
   */
  async scoreProgram(args: {
    programId: string | null;
    category: LoanCategory;
    subScores: SubScores;
  }): Promise<{
    score: number;
    probability: number;
    tier: ApprovalTier;
    usedDefault: boolean;
    factors: ApprovalFactors;
  }> {
    const active = args.programId ? await this.scoring.activeSet(args.programId) : null;
    const usedDefault = active === null;
    let weights: Weights;
    if (active) {
      weights = active.weights as Record<string, number>;
    } else {
      const scored = await this.questionnaire.scoredQuestions(args.category);
      weights = defaultWeights(scored.map((q) => q.code));
    }

    const probability = computeProbability(weights, args.subScores);
    return {
      score: Math.round(probability * 100),
      probability: Number(probability.toFixed(4)),
      tier: tierFor(probability),
      usedDefault,
      factors: buildFactorBreakdown(weights, args.subScores),
    };
  }
}

/**
 * Transparency breakdown persisted on the offer: each question's earned points
 * (subScore × weight) as a positive impact, biggest first. Mirrors the
 * `ApprovalFactors` shape the admin/mobile already read.
 */
function buildFactorBreakdown(weights: Weights, subScores: SubScores): ApprovalFactors {
  const positive = Object.entries(weights)
    .map(([code, weight]) => {
      const sub = subScores[code] ?? 0;
      return { code, impact: Math.round(Math.max(0, Math.min(1, sub)) * weight) };
    })
    .filter((f) => f.impact > 0)
    .sort((a, b) => b.impact - a.impact);
  return { positive, negative: [] };
}
