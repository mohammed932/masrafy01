import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { ScoringRepository } from './scoring.repository';
import { QuestionnaireRepository } from '@/questionnaire/questionnaire.repository';
import {
  computeProbability,
  maxAchievablePoints,
  tierFor,
  type ApprovalTier,
  type OptionPoints,
  type SelectedAnswer,
} from '@/matching/scoring/approval-probability.scorer';
import type { ApprovalFactors } from '@/matching/types';

/**
 * Per-answer weighted approval scoring (Constitution V — MVP).
 *
 * THE single place that turns a customer's selected answers + a bank program's
 * ACTIVE weight set into an approval probability. Both the mobile preview
 * (`matching-preview`) and the persisted apply flow (`applications`) call this —
 * no duplicated formula (Anti-Pattern A25).
 *
 *   probability = Σ ( points[questionCode][optionCode] ) / maxAchievablePoints
 *
 * - Points: the program's ACTIVE `ScoringWeightSet`, nested questionCode →
 *   optionCode → points (arbitrary scale, no sum constraint). A program with no
 *   ACTIVE set scores 0 (`very_low`).
 * - There is no eligibility gating (dropped for MVP).
 */
@Injectable()
export class WeightedApprovalScoringService {
  constructor(
    private readonly scoring: ScoringRepository,
    private readonly questionnaire: QuestionnaireRepository,
  ) {}

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
    const points: OptionPoints = active ? (active.weights as OptionPoints) : {};

    const questions = await this.questionnaire.questionsWithOptions(args.category);
    const maxPoints = maxAchievablePoints(
      points,
      questions.map((q) => ({ code: q.code, optionCodes: q.options.map((o) => o.code) })),
    );

    const probability = computeProbability(points, args.answers, maxPoints);
    return {
      score: Math.round(probability * 100),
      probability: Number(probability.toFixed(4)),
      tier: tierFor(probability),
      usedDefault,
      factors: buildFactorBreakdown(points, args.answers),
    };
  }
}

/**
 * Transparency breakdown persisted on the offer: each selected answer's earned
 * points as a positive impact, biggest first. Mirrors the `ApprovalFactors`
 * shape the admin/mobile already read.
 */
function buildFactorBreakdown(
  points: OptionPoints,
  answers: readonly SelectedAnswer[],
): ApprovalFactors {
  const positive = answers
    .map((a) => ({ code: a.optionCode, impact: Math.round(points[a.questionCode]?.[a.optionCode] ?? 0) }))
    .filter((f) => f.impact > 0)
    .sort((a, b) => b.impact - a.impact);
  return { positive, negative: [] };
}
