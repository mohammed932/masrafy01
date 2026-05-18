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

export interface AgentResultsTier {
  leadsAssigned: number;
  loansApproved: number;
  valueFundedEGP: string | null;
  conversionRate: number | null;
}

export interface AgentPipelineTier {
  leadsSubmittedToBank: number;
  submittedActivityCount: number;
  bankApprovalRate: number | null;
  avgSpeedToFirstContactMs: number | null;
  avgCycleTimeMs: number | null;
  stuckLeadsCount: number;
  slowFirstContact: boolean;
}

export interface AgentActivityTier {
  totalActivities: number;
  callCount: number;
  callMinutes: number;
  avgCallMinutes: number | null;
  shortCallCount: number;
  whatsappCount: number;
  documentReviewedCount: number;
  documentReceivedCount: number;
}

export interface AgentRollupRow {
  actorStaffId: string | null;
  agentAlias: string;
  isSystem: boolean;
  results: AgentResultsTier;
  pipeline: AgentPipelineTier;
  activity: AgentActivityTier;
  lastActivityAt: string | null;
  isStale: boolean;
}

export interface TeamRollup {
  leadsAssigned: number;
  leadsSubmittedToBank: number;
  loansApproved: number;
  valueFundedEGP: string | null;
  conversionRate: number | null;
  bankApprovalRate: number | null;
  totalActivities: number;
  totalCallMinutes: number;
}

export interface AnalyticsThresholds {
  slowFirstContactMs: number;
  staleAgentDays: number;
}

export interface AgentActivitySummary {
  windowDays: number;
  generatedAt: string;
  rows: AgentActivitySummaryRow[];
  agents: AgentRollupRow[];
  team: TeamRollup;
  thresholds: AnalyticsThresholds;
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
