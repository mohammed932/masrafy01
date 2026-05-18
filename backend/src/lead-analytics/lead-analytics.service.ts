import { Injectable } from '@nestjs/common';
import type { StaffRole } from '@prisma/client';
import { AnalyticsWindowTooLargeException } from '@/common/errors/domain.exceptions';
import { LeadAnalyticsRepository } from './lead-analytics.repository';
import { AliasResolverService } from './alias-resolver.service';

const MAX_WINDOW_DAYS = 180;
const DEFAULT_WINDOW_DAYS = 30;
const STALE_AGENT_THRESHOLD_DAYS = 3;
const SYSTEM_STAFF_ID = 'clsysactor00000000000000000000';

export interface AgentActivitySummaryItem {
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
  rows: AgentActivitySummaryItem[];
  agents: AgentRollupRow[];
  team: TeamRollup;
}

@Injectable()
export class LeadAnalyticsService {
  constructor(
    private readonly repo: LeadAnalyticsRepository,
    private readonly aliases: AliasResolverService,
  ) {}

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
    for (const r of rawActivity) {
      totalsByStaff.set(r.actorStaffId, (totalsByStaff.get(r.actorStaffId) ?? 0) + r.count);
    }

    const outcomeByStaff = new Map(outcomes.map((o) => [o.actorStaffId, o]));
    const staffIds = new Set<string>([...totalsByStaff.keys(), ...outcomeByStaff.keys()]);

    const agents: AgentRollupRow[] = [];
    for (const staffId of staffIds) {
      const o = outcomeByStaff.get(staffId);
      const totalActivities = totalsByStaff.get(staffId) ?? 0;
      const isSystem = staffId === SYSTEM_STAFF_ID;
      const callCount = o?.callCount ?? 0;
      const callMinutes = o?.callMinutes ?? 0;
      const leadsAssigned = o?.leadsAssigned ?? 0;
      const submitted = o?.submittedToBank ?? 0;
      const approved = o?.approvedByBank ?? 0;
      const lastActivityAt = o?.lastActivityAt ?? null;
      const isStale =
        !isSystem &&
        leadsAssigned > 0 &&
        (lastActivityAt === null || now - lastActivityAt.getTime() > staleCutoffMs);

      agents.push({
        actorStaffId: exposeRealIds ? staffId : null,
        agentAlias: aliasMap[staffId] ?? 'Agent ?',
        isSystem,
        leadsAssigned,
        submittedToBank: submitted,
        approvedByBank: approved,
        submissionRate: leadsAssigned > 0 ? submitted / leadsAssigned : null,
        conversionRate: leadsAssigned > 0 ? approved / leadsAssigned : null,
        callCount,
        callMinutes,
        avgCallMinutes: callCount > 0 ? callMinutes / callCount : null,
        shortCallCount: o?.shortCallCount ?? 0,
        stuckLeadsCount: o?.stuckLeadsCount ?? 0,
        lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
        isStale,
        totalActivities,
      });
    }

    const team: TeamRollup = agents.reduce<TeamRollup>(
      (acc, a) => {
        if (a.isSystem) return acc;
        acc.leadsAssigned += a.leadsAssigned;
        acc.submittedToBank += a.submittedToBank;
        acc.approvedByBank += a.approvedByBank;
        acc.totalActivities += a.totalActivities;
        acc.totalCallMinutes += a.callMinutes;
        return acc;
      },
      {
        leadsAssigned: 0,
        submittedToBank: 0,
        approvedByBank: 0,
        conversionRate: null,
        totalActivities: 0,
        totalCallMinutes: 0,
      },
    );
    team.conversionRate =
      team.leadsAssigned > 0 ? team.approvedByBank / team.leadsAssigned : null;

    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      rows: rawActivity.map((r) => ({
        agentAlias: aliasMap[r.actorStaffId] ?? 'Agent ?',
        activityType: r.activityType,
        count: r.count,
        totalDurationMinutes: r.totalDurationMinutes,
      })),
      agents,
      team,
    };
  }
}
