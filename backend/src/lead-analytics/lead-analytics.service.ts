import { Injectable } from '@nestjs/common';
import { AnalyticsWindowTooLargeException } from '@/common/errors/domain.exceptions';
import { LeadAnalyticsRepository } from './lead-analytics.repository';
import { AliasResolverService } from './alias-resolver.service';

const MAX_WINDOW_DAYS = 180;
const DEFAULT_WINDOW_DAYS = 30;

export interface AgentActivitySummaryItem {
  agentAlias: string;
  activityType: string;
  count: number;
  totalDurationMinutes: number | null;
}

export interface AgentActivitySummary {
  windowDays: number;
  generatedAt: string;
  rows: AgentActivitySummaryItem[];
}

@Injectable()
export class LeadAnalyticsService {
  constructor(
    private readonly repo: LeadAnalyticsRepository,
    private readonly aliases: AliasResolverService,
  ) {}

  async getActivitySummary(
    analystSub: string,
    windowDays = DEFAULT_WINDOW_DAYS,
  ): Promise<AgentActivitySummary> {
    if (windowDays > MAX_WINDOW_DAYS) {
      throw new AnalyticsWindowTooLargeException(MAX_WINDOW_DAYS);
    }
    if (windowDays <= 0) {
      throw new AnalyticsWindowTooLargeException(MAX_WINDOW_DAYS);
    }
    const rows = await this.repo.aggregateActivityByAgent(windowDays);
    const aliasMap = await this.aliases.getAliasMap(analystSub);
    return {
      windowDays,
      generatedAt: new Date().toISOString(),
      rows: rows.map((r) => ({
        agentAlias: aliasMap[r.actorStaffId] ?? 'Agent ?',
        activityType: r.activityType,
        count: r.count,
        totalDurationMinutes: r.totalDurationMinutes,
      })),
    };
  }
}
