import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

export interface AgentActivitySummaryRow {
  agentAlias: string;
  activityType: string;
  count: number;
  totalDurationMinutes: number | null;
}

export interface AgentActivitySummary {
  windowDays: number;
  generatedAt: string;
  rows: AgentActivitySummaryRow[];
}

@Injectable({ providedIn: 'root' })
export class LeadAnalyticsApiService {
  private readonly http = inject(HttpClient);

  async getActivitySummary(windowDays: number): Promise<AgentActivitySummary> {
    const params = new HttpParams().set('windowDays', String(windowDays));
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<AgentActivitySummary>>(
        `${environment.apiBaseUrl}/lead-analytics/activity-summary`,
        { params },
      ),
    );
    return res.data;
  }
}
