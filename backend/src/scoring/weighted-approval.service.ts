import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { ScoringRepository } from './scoring.repository';
import {
  answerScoreFor,
  askedWeightSum,
  computeProbability,
  emptyScoring,
  normalizeWeights,
  tierFor,
  type ApprovalTier,
  type ProgramScoring,
  type SelectedAnswer,
} from '@/matching/scoring/approval-probability.scorer';
import type { ApprovalFactors } from '@/matching/types';

/**
 * Two-level weighted approval scoring (Constitution V — v8.0.0, all types v14.0.0).
 *
 * THE single place that turns a customer's answers + a bank program's ACTIVE
 * weight set into an approval probability. Both the mobile preview
 * (`matching-preview`) and the persisted apply flow (`applications`) call this —
 * no duplicated formula (Anti-Pattern A25).
 *
 *   probability = Σ_answered(questionWeight × answerScore/100) ÷ Σ_asked(questionWeight)
 *
 * - Scoring: the program's ACTIVE `ScoringWeightSet` — per-question weights
 *   (sum 100) + the per-type rules that turn one answer into a 0..100 score
 *   (option scores, multi-select aggregation, numeric bands, text presence).
 *   Legacy single-level rows are upgraded on read (`normalizeWeights`). No
 *   ACTIVE set → 0, flagged `usedDefault`.
 * - The denominator is the weight this program placed on the questions the
 *   applicant was ASKED (Constitution V, v13.0.0), so programs that score on
 *   different question sets stay comparable. Callers MUST pass the asked set;
 *   both paths derive it where they already resolve answers.
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
    /** Questions this applicant was shown — the scoring denominator. */
    askedQuestionCodes: readonly string[];
  }): Promise<{
    score: number;
    probability: number;
    tier: ApprovalTier;
    usedDefault: boolean;
    factors: ApprovalFactors;
  }> {
    const active = args.programId ? await this.scoring.activeSet(args.programId) : null;
    const usedDefault = active === null;
    const scoring: ProgramScoring = active ? normalizeWeights(active.weights) : emptyScoring();

    const probability = computeProbability(scoring, args.answers, args.askedQuestionCodes);
    return {
      score: Math.round(probability * 100),
      probability: Number(probability.toFixed(4)),
      tier: tierFor(probability),
      usedDefault,
      factors: buildFactorBreakdown(scoring, args.answers, args.askedQuestionCodes),
    };
  }
}

/**
 * Transparency breakdown persisted on the offer: each selected answer's
 * contribution as a positive impact, biggest first. Mirrors the
 * `ApprovalFactors` shape the admin/mobile already read.
 *
 * Divides by the SAME asked-weight denominator the score used, so the impacts
 * still add up to the displayed score. Answers to questions outside the asked
 * set earned nothing and are omitted rather than listed at zero.
 *
 * The answer score comes from `answerScoreFor` — the same function the formula
 * used. Deriving it twice is how a breakdown starts disagreeing with the score
 * it is meant to explain, and there are now four type-specific derivations to
 * disagree about.
 */
function buildFactorBreakdown(
  scoring: ProgramScoring,
  answers: readonly SelectedAnswer[],
  askedQuestionCodes: readonly string[],
): ApprovalFactors {
  const asked = new Set(askedQuestionCodes);
  const denominator = askedWeightSum(scoring, asked);
  if (denominator <= 0) return { positive: [], negative: [] };

  const positive = answers
    .filter((a) => asked.has(a.questionCode))
    .map((a) => {
      const weight = scoring.questionWeights[a.questionCode] ?? 0;
      const score = answerScoreFor(scoring, a) ?? 0;
      return {
        code: factorCode(a),
        questionCode: a.questionCode,
        impact: Math.round((weight * score) / denominator),
      };
    })
    .filter((f) => f.impact > 0)
    .sort((a, b) => b.impact - a.impact);
  return { positive, negative: [] };
}

/**
 * The stable code a factor row is labelled with. A single pick keeps its OPTION
 * code, unchanged from before v14.0.0 so existing offers and the admin factor
 * catalog still read the same. The other three types have no one option to name
 * — several picks, a number, a string — so they are labelled by QUESTION code.
 */
function factorCode(answer: SelectedAnswer): string {
  return answer.kind === 'option' ? answer.optionCode : answer.questionCode;
}
