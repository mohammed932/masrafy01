/**
 * Service for the scoring-engine evaluation view.
 * Enforces the 180-day window cap (FR-023a).
 *
 * Headline philosophy: managers see one health verdict; analysts drill down
 * into per-tier reality + per-day drift trend. Distribution remains for the
 * analyst section.
 */
import { Injectable } from '@nestjs/common';
import type { ApprovalTier } from '@prisma/client';
import { AnalyticsWindowTooLargeException } from '@/common/errors/domain.exceptions';
import {
  ScoringAnalyticsRepository,
  type DistributionBucket,
  type DriftPoint,
  type TierAccuracyRow,
} from './scoring-analytics.repository';

export const MAX_WINDOW_DAYS = 180;
const SAMPLE_SIZE_THRESHOLD = 30;
const HEALTHY_GAP = 0.10;
const DRIFTING_GAP = 0.20;

const TIER_ORDER: readonly ApprovalTier[] = [
  'excellent',
  'good',
  'moderate',
  'low',
  'very_low',
];

export type HealthStatus = 'healthy' | 'drifting' | 'broken';

export interface TierEvaluation {
  tier: ApprovalTier;
  offerCount: number;
  decisionCount: number;
  predictedApprovalRate: number | null;
  actualApprovalRate: number | null;
  gap: number | null;
  sampleSizeTrustworthy: boolean;
  status: 'aligned' | 'soft' | 'harsh' | 'unknown';
}

export interface TierDriftSeries {
  tier: ApprovalTier;
  series: Array<{ date: string; rate: number | null; decisions: number }>;
  deltaFromOldest: number | null;
}

export interface ModelHealth {
  status: HealthStatus;
  headline: string;
  bandSpread: number | null;
  worstGap: number | null;
  worstTier: ApprovalTier | null;
  decisionsInWindow: number;
}

export interface AnalyticsResponse {
  windowDays: number;
  engineVersion: string | null;
  health: ModelHealth;
  tiers: TierEvaluation[];
  drift: TierDriftSeries[];
  distribution: DistributionBucket[];
  tierAccuracy: TierAccuracyRow[];
  thresholds: {
    sampleSizeTrustworthy: number;
    healthyGap: number;
    driftingGap: number;
  };
}

@Injectable()
export class ScoringAnalyticsService {
  constructor(private readonly repo: ScoringAnalyticsRepository) {}

  async getAnalytics(windowDays: number): Promise<AnalyticsResponse> {
    if (!Number.isInteger(windowDays) || windowDays < 1) windowDays = 30;
    if (windowDays > MAX_WINDOW_DAYS) {
      throw new AnalyticsWindowTooLargeException(MAX_WINDOW_DAYS);
    }
    const [distribution, tierAccuracy, drift] = await Promise.all([
      this.repo.aggregateDistribution(windowDays),
      this.repo.aggregateByTier(windowDays),
      this.repo.aggregateDriftByDay(windowDays),
    ]);

    const tiers = this.buildTierEvaluations(tierAccuracy);
    const driftSeries = this.buildDriftSeries(drift, windowDays);
    const health = this.buildModelHealth(tiers);

    return {
      windowDays,
      engineVersion: null,
      health,
      tiers,
      drift: driftSeries,
      distribution,
      tierAccuracy,
      thresholds: {
        sampleSizeTrustworthy: SAMPLE_SIZE_THRESHOLD,
        healthyGap: HEALTHY_GAP,
        driftingGap: DRIFTING_GAP,
      },
    };
  }

  private buildTierEvaluations(rows: TierAccuracyRow[]): TierEvaluation[] {
    const byTier = new Map(rows.map((r) => [r.tier, r]));
    return TIER_ORDER.map((tier) => {
      const r = byTier.get(tier);
      const predicted = r?.predictedApprovalRate ?? null;
      const actual = r?.actualApprovalRate ?? null;
      const decisionCount = r?.decisionCount ?? 0;
      const gap = predicted !== null && actual !== null ? predicted - actual : null;
      let status: TierEvaluation['status'] = 'unknown';
      if (actual === null || decisionCount === 0) status = 'unknown';
      else if (gap === null) status = 'unknown';
      else if (Math.abs(gap) <= HEALTHY_GAP) status = 'aligned';
      else if (gap > 0) status = 'soft';
      else status = 'harsh';
      return {
        tier,
        offerCount: r?.offerCount ?? 0,
        decisionCount,
        predictedApprovalRate: predicted,
        actualApprovalRate: actual,
        gap,
        sampleSizeTrustworthy: decisionCount >= SAMPLE_SIZE_THRESHOLD,
        status,
      };
    });
  }

  private buildDriftSeries(points: DriftPoint[], windowDays: number): TierDriftSeries[] {
    const series = new Map<ApprovalTier, Map<string, { rate: number | null; decisions: number }>>();
    for (const t of TIER_ORDER) series.set(t, new Map());
    for (const p of points) {
      series.get(p.tier)?.set(p.date, { rate: p.actualApprovalRate, decisions: p.decisionCount });
    }

    const daysAxis = this.buildDaysAxis(windowDays);
    return TIER_ORDER.map((tier) => {
      const byDate = series.get(tier) ?? new Map();
      const filled = daysAxis.map((d) => {
        const v = byDate.get(d);
        return { date: d, rate: v?.rate ?? null, decisions: v?.decisions ?? 0 };
      });
      const oldest = filled.find((x) => x.rate !== null)?.rate ?? null;
      const newest = [...filled].reverse().find((x) => x.rate !== null)?.rate ?? null;
      const delta = oldest !== null && newest !== null ? newest - oldest : null;
      return {
        tier,
        series: filled,
        deltaFromOldest: delta,
      };
    });
  }

  private buildDaysAxis(windowDays: number): string[] {
    const cap = Math.min(windowDays, 30);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const out: string[] = [];
    for (let i = cap - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  private buildModelHealth(tiers: TierEvaluation[]): ModelHealth {
    const decisionsInWindow = tiers.reduce((acc, t) => acc + t.decisionCount, 0);
    const ratesByTier = new Map(
      tiers
        .filter((t) => t.actualApprovalRate !== null && t.sampleSizeTrustworthy)
        .map((t) => [t.tier, t.actualApprovalRate as number]),
    );
    const excellent = ratesByTier.get('excellent');
    const veryLow = ratesByTier.get('very_low');
    const bandSpread =
      excellent !== undefined && veryLow !== undefined ? excellent - veryLow : null;

    let worstTier: ApprovalTier | null = null;
    let worstGap: number | null = null;
    for (const t of tiers) {
      if (t.gap === null || !t.sampleSizeTrustworthy) continue;
      const abs = Math.abs(t.gap);
      if (worstGap === null || abs > worstGap) {
        worstGap = abs;
        worstTier = t.tier;
      }
    }

    if (decisionsInWindow === 0) {
      return {
        status: 'drifting',
        headline: 'Not enough bank decisions yet to evaluate the model.',
        bandSpread: null,
        worstGap: null,
        worstTier: null,
        decisionsInWindow,
      };
    }

    let status: HealthStatus = 'healthy';
    let headline = 'Model predictions match bank outcomes.';
    if (worstGap !== null && worstGap > DRIFTING_GAP) {
      status = 'broken';
      headline = `Model is off by more than ${Math.round(worstGap * 100)} points on ${worstTier ?? 'a tier'}. Tune weights.`;
    } else if (worstGap !== null && worstGap > HEALTHY_GAP) {
      status = 'drifting';
      headline = `Model drifting on ${worstTier ?? 'a tier'} (${Math.round(worstGap * 100)}-point gap).`;
    }
    if (bandSpread !== null && bandSpread < 0.2) {
      status = status === 'broken' ? 'broken' : 'drifting';
      headline = `Score bands barely separate winners from losers (spread ${Math.round(bandSpread * 100)} pts).`;
    }

    return {
      status,
      headline,
      bandSpread,
      worstGap,
      worstTier,
      decisionsInWindow,
    };
  }
}
