/**
 * Service for the analyst distribution + per-tier accuracy view.
 * Enforces the 180-day window cap (FR-023a).
 */
import { Injectable } from '@nestjs/common';
import { AnalyticsWindowTooLargeException } from '@/common/errors/domain.exceptions';
import {
  ScoringAnalyticsRepository,
  type DistributionBucket,
  type TierAccuracyRow,
} from './scoring-analytics.repository';

export const MAX_WINDOW_DAYS = 180;

export interface AnalyticsResponse {
  windowDays: number;
  distribution: DistributionBucket[];
  tierAccuracy: TierAccuracyRow[];
}

@Injectable()
export class ScoringAnalyticsService {
  constructor(private readonly repo: ScoringAnalyticsRepository) {}

  async getAnalytics(windowDays: number): Promise<AnalyticsResponse> {
    if (!Number.isInteger(windowDays) || windowDays < 1) {
      windowDays = 30;
    }
    if (windowDays > MAX_WINDOW_DAYS) {
      throw new AnalyticsWindowTooLargeException(MAX_WINDOW_DAYS);
    }
    const [distribution, tierAccuracy] = await Promise.all([
      this.repo.aggregateDistribution(windowDays),
      this.repo.aggregateByTier(windowDays),
    ]);
    return { windowDays, distribution, tierAccuracy };
  }
}
