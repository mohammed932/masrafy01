import { Injectable } from '@nestjs/common';
import type { StaffRole } from '@/common/enums/staff-role.enum';
import { AnalyticsWindowTooLargeException } from '@/common/errors/domain.exceptions';
import { LeadAnalyticsRepository } from './lead-analytics.repository';
import { AliasResolverService } from './alias-resolver.service';

const MAX_WINDOW_DAYS = 180;
const DEFAULT_WINDOW_DAYS = 30;
const STALE_AGENT_THRESHOLD_DAYS = 3;
const SLOW_FIRST_CONTACT_MS = 60 * 60 * 1000; // 1 hour
const SYSTEM_STAFF_ID = 'clsysactor00000000000000000000';

export interface AgentActivitySummaryItem {
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

export interface AgentActivitySummary {
  windowDays: number;
  generatedAt: string;
  rows: AgentActivitySummaryItem[];
  agents: AgentRollupRow[];
  team: TeamRollup;
  thresholds: {
    slowFirstContactMs: number;
    staleAgentDays: number;
  };
}

@Injectable()
export class LeadAnalyticsService {
  constructor(
    private readonly repo: LeadAnalyticsRepository,
    private readonly aliases: AliasResolverService,
  ) {}

  async getFunnel(
    windowDays = DEFAULT_WINDOW_DAYS,
  ): Promise<{ windowDays: number; stages: Array<{ stage: string; count: number }> }> {
    if (windowDays > MAX_WINDOW_DAYS || windowDays <= 0) {
      throw new AnalyticsWindowTooLargeException(MAX_WINDOW_DAYS);
    }
    const stages = await this.repo.aggregateFunnel(windowDays);
    return { windowDays, stages };
  }

  async getActivitySummary(
    analystSub: string,
    role: StaffRole,
    windowDays = DEFAULT_WINDOW_DAYS,
  ): Promise<AgentActivitySummary> {
    if (windowDays > MAX_WINDOW_DAYS || windowDays <= 0) {
      throw new AnalyticsWindowTooLargeException(MAX_WINDOW_DAYS);
    }

    const [rawActivity, outcomes, aliasMap] = await Promise.all([
      this.repo.aggregateActivityByAgent(windowDays),
      this.repo.aggregateOutcomesByAgent(windowDays),
      this.aliases.getAliasMap(analystSub),
    ]);

    const exposeRealIds = role === 'super_admin' || role === 'sales_manager';
    const now = Date.now();
    const staleCutoffMs = STALE_AGENT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    const totalsByStaff = new Map<string, number>();
    const activityCountByStaffAndType = new Map<string, Map<string, number>>();
    for (const r of rawActivity) {
      totalsByStaff.set(r.actorStaffId, (totalsByStaff.get(r.actorStaffId) ?? 0) + r.count);
      const byType = activityCountByStaffAndType.get(r.actorStaffId) ?? new Map<string, number>();
      byType.set(r.activityType, r.count);
      activityCountByStaffAndType.set(r.actorStaffId, byType);
    }

    const outcomeByStaff = new Map(outcomes.map((o) => [o.actorStaffId, o]));
    const staffIds = new Set<string>([...totalsByStaff.keys(), ...outcomeByStaff.keys()]);

    const agents: AgentRollupRow[] = [];
    for (const staffId of staffIds) {
      if (staffId === SYSTEM_STAFF_ID) continue;
      const o = outcomeByStaff.get(staffId);
      const totalActivities = totalsByStaff.get(staffId) ?? 0;
      const byType = activityCountByStaffAndType.get(staffId) ?? new Map<string, number>();
      const callCount = o?.callCount ?? 0;
      const callMinutes = o?.callMinutes ?? 0;
      const leadsAssigned = o?.leadsAssigned ?? 0;
      const leadsSubmittedToBank = o?.leadsSubmittedToBank ?? 0;
      const approved = o?.approvedByBank ?? 0;
      const lastActivityAt = o?.lastActivityAt ?? null;
      const speedMs = o?.speedToFirstContactMs ?? null;
      const cycleMs = o?.cycleTimeMs ?? null;
      const isStale =
        leadsAssigned > 0 &&
        (lastActivityAt === null || now - lastActivityAt.getTime() > staleCutoffMs);

      agents.push({
        actorStaffId: exposeRealIds ? staffId : null,
        agentAlias: aliasMap[staffId] ?? 'Agent ?',
        isSystem: false,
        results: {
          leadsAssigned,
          loansApproved: approved,
          valueFundedEGP: o?.valueFundedEGP ?? null,
          conversionRate: leadsAssigned > 0 ? approved / leadsAssigned : null,
        },
        pipeline: {
          leadsSubmittedToBank,
          submittedActivityCount: o?.submittedToBank ?? 0,
          bankApprovalRate: leadsSubmittedToBank > 0 ? approved / leadsSubmittedToBank : null,
          avgSpeedToFirstContactMs: speedMs,
          avgCycleTimeMs: cycleMs,
          stuckLeadsCount: o?.stuckLeadsCount ?? 0,
          slowFirstContact: speedMs !== null && speedMs > SLOW_FIRST_CONTACT_MS,
        },
        activity: {
          totalActivities,
          callCount,
          callMinutes,
          avgCallMinutes: callCount > 0 ? callMinutes / callCount : null,
          shortCallCount: o?.shortCallCount ?? 0,
          whatsappCount: byType.get('SENT_WHATSAPP') ?? 0,
          documentReviewedCount: byType.get('REVIEWED_DOCUMENTS') ?? 0,
          documentReceivedCount: byType.get('RECEIVED_DOCUMENTS') ?? 0,
        },
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        isStale,
      });
    }

    const team: TeamRollup = agents.reduce<TeamRollup>(
      (acc, a) => {
        acc.leadsAssigned += a.results.leadsAssigned;
        acc.leadsSubmittedToBank += a.pipeline.leadsSubmittedToBank;
        acc.loansApproved += a.results.loansApproved;
        acc.totalActivities += a.activity.totalActivities;
        acc.totalCallMinutes += a.activity.callMinutes;
        if (a.results.valueFundedEGP !== null) {
          const cur = acc.valueFundedEGP === null ? 0 : Number(acc.valueFundedEGP);
          const next = Number(a.results.valueFundedEGP);
          acc.valueFundedEGP = (cur + next).toString();
        }
        return acc;
      },
      {
        leadsAssigned: 0,
        leadsSubmittedToBank: 0,
        loansApproved: 0,
        valueFundedEGP: null,
        conversionRate: null,
        bankApprovalRate: null,
        totalActivities: 0,
        totalCallMinutes: 0,
      },
    );
    team.conversionRate = team.leadsAssigned > 0 ? team.loansApproved / team.leadsAssigned : null;
    team.bankApprovalRate =
      team.leadsSubmittedToBank > 0 ? team.loansApproved / team.leadsSubmittedToBank : null;

    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      rows: rawActivity
        .filter((r) => r.actorStaffId !== SYSTEM_STAFF_ID)
        .map((r) => ({
          agentAlias: aliasMap[r.actorStaffId] ?? 'Agent ?',
          activityType: r.activityType,
          count: r.count,
          totalDurationMinutes: r.totalDurationMinutes,
        })),
      agents,
      team,
      thresholds: {
        slowFirstContactMs: SLOW_FIRST_CONTACT_MS,
        staleAgentDays: STALE_AGENT_THRESHOLD_DAYS,
      },
    };
  }
}
