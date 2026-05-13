/**
 * Read-only aggregate queries for the analyst page.
 * - Distribution histogram: 10-point buckets over `bank_offer.approvalScore`.
 * - Per-tier accuracy: LEFT JOIN against `bank_offer_decision` (empty at launch).
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
  approvalRate: number | null;
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
        approval_rate: number | null;
      }>
    >`
      SELECT bo."approvalTier" AS tier,
             COUNT(*)::bigint AS offer_count,
             COUNT(bod.id)::bigint AS decision_count,
             CASE
               WHEN COUNT(bod.id) = 0 THEN NULL
               ELSE AVG(CASE WHEN bod."outcome" = 'approved' THEN 1.0 ELSE 0.0 END)
             END AS approval_rate
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
      approvalRate: r.approval_rate !== null ? Number(r.approval_rate) : null,
    }));
  }
}
