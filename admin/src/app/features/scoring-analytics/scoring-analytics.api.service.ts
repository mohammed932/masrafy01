import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';
import type { ApprovalTier } from '../applications/list/components/approval-pill.component';

export interface DistributionBucket {
  bucket: number;
  count: number;
}

export interface TierAccuracyRow {
  tier: ApprovalTier;
  offerCount: number;
  decisionCount: number;
  predictedApprovalRate: number | null;
  actualApprovalRate: number | null;
}

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

export interface AnalyticsThresholds {
  sampleSizeTrustworthy: number;
  healthyGap: number;
  driftingGap: number;
}

export interface ScoringAnalyticsData {
  windowDays: number;
  engineVersion: string | null;
  health: ModelHealth;
  tiers: TierEvaluation[];
  drift: TierDriftSeries[];
  distribution: DistributionBucket[];
  tierAccuracy: TierAccuracyRow[];
  thresholds: AnalyticsThresholds;
}

@Injectable({ providedIn: 'root' })
export class ScoringAnalyticsApiService {
  private readonly http = inject(HttpClient);

  async get(windowDays: number): Promise<ScoringAnalyticsData> {
    const params = new HttpParams().set('windowDays', String(windowDays));
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<ScoringAnalyticsData>>(
        `${environment.apiBaseUrl}/scoring-analytics`,
        { params },
      ),
    );
    return res.data;
  }
}
