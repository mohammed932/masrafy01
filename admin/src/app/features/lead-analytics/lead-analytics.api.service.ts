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

export interface AgentRollupRow {
  actorStaffId: string | null;
  agentAlias: string;
  isSystem: boolean;
  leadsAssigned: number;
  submittedToBank: number;
  approvedByBank: number;
  submissionRate: number | null;
  conversionRate: number | null;
  callCount: number;
  callMinutes: number;
  avgCallMinutes: number | null;
  shortCallCount: number;
  stuckLeadsCount: number;
  lastActivityAt: string | null;
  isStale: boolean;
  totalActivities: number;
}

export interface TeamRollup {
  leadsAssigned: number;
  submittedToBank: number;
  approvedByBank: number;
  conversionRate: number | null;
  totalActivities: number;
  totalCallMinutes: number;
}

export interface AgentActivitySummary {
  windowDays: number;
  generatedAt: string;
  rows: AgentActivitySummaryRow[];
  agents: AgentRollupRow[];
  team: TeamRollup;
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
