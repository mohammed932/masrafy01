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
  approvalRate: number | null;
}

export interface ScoringAnalyticsData {
  windowDays: number;
  distribution: DistributionBucket[];
  tierAccuracy: TierAccuracyRow[];
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
