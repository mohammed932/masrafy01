/**
 * Read-only aggregate queries for the scoring-engine evaluation view.
 * - Distribution histogram: 10-point buckets over `bank_offer.approvalScore` (analyst drill-down).
 * - Per-tier accuracy: predicted vs actual approval rate per tier (manager headline).
 * - Drift trend: per-day approval rate per tier — catches policy shift over time.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';
import type { ApprovalTier } from '@prisma/client';

export interface DistributionBucket {
  bucket: number; // 0..10 (the integer-divided score / 10)
  count: number;
}

export interface TierAccuracyRow {
  tier: ApprovalTier;
  offerCount: number;
  decisionCount: number;
  predictedApprovalRate: number | null;
  actualApprovalRate: number | null;
}

export interface DriftPoint {
  date: string; // ISO date (YYYY-MM-DD)
  tier: ApprovalTier;
  actualApprovalRate: number | null;
  decisionCount: number;
}

@Injectable()
export class ScoringAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateDistribution(windowDays: number): Promise<DistributionBucket[]> {
    const rows = await this.prisma.$queryRaw<Array<{ bucket: number; count: bigint }>>`
      SELECT ("approvalScore" / 10)::int AS bucket, COUNT(*)::bigint AS count
        FROM bank_offer
       WHERE "createdAt" >= now() - (${windowDays} || ' days')::interval
         AND "erasedAt" IS NULL
       GROUP BY 1
       ORDER BY 1
    `;
    return rows.map((r) => ({ bucket: Number(r.bucket), count: Number(r.count) }));
  }

  async aggregateByTier(windowDays: number): Promise<TierAccuracyRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        tier: ApprovalTier;
        offer_count: bigint;
        decision_count: bigint;
        predicted_rate: number | null;
        actual_rate: number | null;
      }>
    >`
      SELECT bo."approvalTier" AS tier,
             COUNT(*)::bigint AS offer_count,
             COUNT(bod.id)::bigint AS decision_count,
             AVG(bo."approvalProbabilityPercent") / 100.0 AS predicted_rate,
             CASE
               WHEN COUNT(bod.id) = 0 THEN NULL
               ELSE AVG(CASE WHEN bod."outcome" = 'approved' THEN 1.0 ELSE 0.0 END)
             END AS actual_rate
        FROM bank_offer bo
        LEFT JOIN bank_offer_decision bod ON bod."bankOfferId" = bo.id
       WHERE bo."createdAt" >= now() - (${windowDays} || ' days')::interval
         AND bo."erasedAt" IS NULL
       GROUP BY bo."approvalTier"
    `;
    return rows.map((r) => ({
      tier: r.tier,
      offerCount: Number(r.offer_count),
      decisionCount: Number(r.decision_count),
      predictedApprovalRate: r.predicted_rate !== null ? Number(r.predicted_rate) : null,
      actualApprovalRate: r.actual_rate !== null ? Number(r.actual_rate) : null,
    }));
  }

  async aggregateDriftByDay(windowDays: number): Promise<DriftPoint[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        bucket_date: Date;
        tier: ApprovalTier;
        actual_rate: number | null;
        decision_count: bigint;
      }>
    >`
      SELECT
        DATE_TRUNC('day', bod."recordedAt") AS bucket_date,
        bo."approvalTier" AS tier,
        AVG(CASE WHEN bod."outcome" = 'approved' THEN 1.0 ELSE 0.0 END) AS actual_rate,
        COUNT(*)::bigint AS decision_count
      FROM bank_offer_decision bod
      JOIN bank_offer bo ON bo.id = bod."bankOfferId"
      WHERE bod."recordedAt" >= now() - (${windowDays} || ' days')::interval
        AND bo."erasedAt" IS NULL
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `;
    return rows.map((r) => ({
      date: r.bucket_date.toISOString().slice(0, 10),
      tier: r.tier,
      actualApprovalRate: r.actual_rate !== null ? Number(r.actual_rate) : null,
      decisionCount: Number(r.decision_count),
    }));
  }
}
