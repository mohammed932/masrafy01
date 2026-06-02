import { Injectable } from '@nestjs/common';
import { LoanCategory, ScoringFactorKind } from '@prisma/client';
import { ScoringRepository } from './scoring.repository';
import {
  computeProbability,
  dbrComfortFromPercents,
  defaultWeights,
  tierFor,
  type ApprovalTier,
  type SubScores,
  type Weights,
} from '@/matching/scoring/approval-probability.scorer';
import type { ApprovalFactors } from '@/matching/types';

/**
 * Per-bank weighted approval scoring (Constitution V v4.1.0).
 *
 * THE single place that turns answers + a bank program's ACTIVE weight set into
 * an approval probability. Both the mobile preview (`matching-preview`) and the
 * persisted apply flow (`applications`) call this — no duplicated formula
 * (Anti-Pattern A25).
 *
 *   probability = Σ ( subScore[factor] × weight[factor] ) / 100
 *
 * - DIRECT factors: subScore = the selected option's admin-set `scoreValue`.
 * - COMPUTED factors: subScore = computed in code here (Principle V — formula
 *   stays code). `debt_burden` is the only one today.
 * - Weights: the program's ACTIVE `ScoringWeightSet`; falls back to an equal
 *   code-default split so no program is ever left unscored (Spec §5.5.4).
 */
@Injectable()
export class WeightedApprovalScoringService {
  constructor(private readonly scoring: ScoringRepository) {}

  /**
   * DIRECT sub-scores keyed by factor code, from answers that carry their
   * question's `scoringFactorCode` and the selected option's `scoreValue`.
   * Display-only / arithmetic answers (null factor code) are ignored.
   */
  buildDirectSubScores(
    answers: ReadonlyArray<{
      scoringFactorCode: string | null;
      scoreValue: string | number | null;
    }>,
  ): SubScores {
    const subScores: SubScores = {};
    for (const a of answers) {
      if (!a.scoringFactorCode) continue;
      subScores[a.scoringFactorCode] = a.scoreValue != null ? Number(a.scoreValue) : 0;
    }
    return subScores;
  }

  /**
   * Score one program for one applicant. `directSubScores` come from the
   * answers; COMPUTED factors are filled here from `computed`. Returns the
   * 0..100 score, 0..1 probability, tier, the factor-contribution breakdown,
   * and whether the code-default weight set was used.
   */
  async scoreProgram(args: {
    programId: string | null;
    category: LoanCategory;
    directSubScores: SubScores;
    computed?: { dbrPercent?: number | null; dbrCapPercent?: number | null };
  }): Promise<{
    score: number;
    probability: number;
    tier: ApprovalTier;
    usedDefault: boolean;
    factors: ApprovalFactors;
  }> {
    const factors = await this.scoring.activeFactors(args.category);
    const factorCodes = factors.map((f) => f.code);

    const subScores: SubScores = { ...args.directSubScores };
    for (const f of factors) {
      if (f.kind !== ScoringFactorKind.COMPUTED) continue;
      subScores[f.code] = computeComputedFactor(f.code, args.computed);
    }

    const active = args.programId ? await this.scoring.activeSet(args.programId) : null;
    const usedDefault = active === null;
    const weights: Weights = active
      ? (active.weights as Record<string, number>)
      : defaultWeights(factorCodes);

    const probability = computeProbability(weights, subScores);
    return {
      score: Math.round(probability * 100),
      probability: Number(probability.toFixed(4)),
      tier: tierFor(probability),
      usedDefault,
      factors: buildFactorBreakdown(weights, subScores),
    };
  }
}

/**
 * COMPUTED factor computers (Principle V — the formula lives in code). Unknown
 * COMPUTED codes contribute 0 (the factor is defined but not yet implemented),
 * which is safe: a 0 sub-score just removes that factor's points.
 */
function computeComputedFactor(
  code: string,
  computed: { dbrPercent?: number | null; dbrCapPercent?: number | null } | undefined,
): number {
  switch (code) {
    case 'debt_burden':
      return dbrComfortFromPercents(
        computed?.dbrPercent ?? Number.NaN,
        computed?.dbrCapPercent ?? Number.NaN,
      );
    default:
      return 0;
  }
}

/**
 * Transparency breakdown persisted on the offer: each factor's earned points
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
