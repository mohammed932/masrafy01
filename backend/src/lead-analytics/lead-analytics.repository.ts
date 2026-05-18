import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface ActivitySummaryRow {
  actorStaffId: string;
  activityType: string;
  count: number;
  totalDurationMinutes: number | null;
}

export interface AgentOutcomeRow {
  actorStaffId: string;
  leadsAssigned: number;
  submittedToBank: number;
  approvedByBank: number;
  callCount: number;
  callMinutes: number;
  shortCallCount: number;
  stuckLeadsCount: number;
  lastActivityAt: Date | null;
}

const STUCK_LEAD_THRESHOLD_DAYS = 7;

@Injectable()
export class LeadAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateActivityByAgent(windowDays: number): Promise<ActivitySummaryRow[]> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const grouped = await this.prisma.activity.groupBy({
      by: ['actorStaffId', 'activityType'],
      where: {
        occurredAt: { gte: since },
        actorRole: { not: 'system' },
      },
      _count: { _all: true },
      _sum: { durationMinutes: true },
      orderBy: [{ actorStaffId: 'asc' }, { activityType: 'asc' }],
    });
    return grouped.map((g) => ({
      actorStaffId: g.actorStaffId,
      activityType: g.activityType,
      count: g._count._all,
      totalDurationMinutes:
        g.activityType === 'CALLED_USER' ? (g._sum.durationMinutes ?? null) : null,
    }));
  }

  async aggregateOutcomesByAgent(windowDays: number): Promise<AgentOutcomeRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        staff_id: string;
        leads_assigned: bigint;
        submitted: bigint;
        approved: bigint;
        call_count: bigint;
        call_minutes: bigint;
        short_calls: bigint;
        stuck_leads: bigint;
        last_activity_at: Date | null;
      }>
    >`
      WITH window_activity AS (
        SELECT "actorStaffId", "activityType", "reason", "durationMinutes", "occurredAt"
          FROM activity
         WHERE "occurredAt" >= now() - (${windowDays} || ' days')::interval
           AND "actorRole" != 'system'
      ),
      agent_outcomes AS (
        SELECT
          "actorStaffId" AS staff_id,
          COUNT(*) FILTER (WHERE "activityType" = 'SUBMITTED_TO_BANK')::bigint AS submitted,
          COUNT(*) FILTER (WHERE "activityType" = 'BANK_RESPONDED' AND "reason" = 'APPROVED')::bigint AS approved,
          COUNT(*) FILTER (WHERE "activityType" = 'CALLED_USER')::bigint AS call_count,
          COALESCE(SUM("durationMinutes") FILTER (WHERE "activityType" = 'CALLED_USER'), 0)::bigint AS call_minutes,
          COUNT(*) FILTER (
            WHERE "activityType" = 'CALLED_USER'
              AND "durationMinutes" IS NOT NULL
              AND "durationMinutes" < 3
          )::bigint AS short_calls,
          MAX("occurredAt") AS last_activity_at
        FROM window_activity
        GROUP BY "actorStaffId"
      ),
      agent_assigned AS (
        SELECT "assignedAgentStaffId" AS staff_id, COUNT(*)::bigint AS leads
          FROM application
         WHERE "assignedAgentStaffId" IS NOT NULL
           AND "assignedAt" IS NOT NULL
           AND "assignedAt" >= now() - (${windowDays} || ' days')::interval
           AND "erasedAt" IS NULL
         GROUP BY "assignedAgentStaffId"
      ),
      agent_stuck AS (
        SELECT a."assignedAgentStaffId" AS staff_id, COUNT(*)::bigint AS stuck
          FROM application a
          LEFT JOIN LATERAL (
            SELECT MAX("occurredAt") AS last_at
              FROM activity
             WHERE "applicationId" = a.id
          ) la ON true
         WHERE a."assignedAgentStaffId" IS NOT NULL
           AND a."archivedAt" IS NULL
           AND a."erasedAt" IS NULL
           AND a."leadStatus" <> 'bank_decided'
           AND (
             (la.last_at IS NULL AND a."assignedAt" < (now() - (${STUCK_LEAD_THRESHOLD_DAYS} || ' days')::interval))
             OR (la.last_at < (now() - (${STUCK_LEAD_THRESHOLD_DAYS} || ' days')::interval))
           )
         GROUP BY a."assignedAgentStaffId"
      ),
      all_staff AS (
        SELECT staff_id FROM agent_outcomes
        UNION
        SELECT staff_id FROM agent_assigned
        UNION
        SELECT staff_id FROM agent_stuck
      )
      SELECT
        s.staff_id,
        COALESCE(ass.leads, 0)::bigint AS leads_assigned,
        COALESCE(o.submitted, 0)::bigint AS submitted,
        COALESCE(o.approved, 0)::bigint AS approved,
        COALESCE(o.call_count, 0)::bigint AS call_count,
        COALESCE(o.call_minutes, 0)::bigint AS call_minutes,
        COALESCE(o.short_calls, 0)::bigint AS short_calls,
        COALESCE(st.stuck, 0)::bigint AS stuck_leads,
        o.last_activity_at
      FROM all_staff s
      LEFT JOIN agent_outcomes o ON o.staff_id = s.staff_id
      LEFT JOIN agent_assigned ass ON ass.staff_id = s.staff_id
      LEFT JOIN agent_stuck st ON st.staff_id = s.staff_id
    `;
    return rows.map((r) => ({
      actorStaffId: r.staff_id,
      leadsAssigned: Number(r.leads_assigned),
      submittedToBank: Number(r.submitted),
      approvedByBank: Number(r.approved),
      callCount: Number(r.call_count),
      callMinutes: Number(r.call_minutes),
      shortCallCount: Number(r.short_calls),
      stuckLeadsCount: Number(r.stuck_leads),
      lastActivityAt: r.last_activity_at,
    }));
  }
}
