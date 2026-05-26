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
  leadsSubmittedToBank: number;
  submittedToBank: number;
  approvedByBank: number;
  valueFundedEGP: string | null;
  callCount: number;
  callMinutes: number;
  shortCallCount: number;
  stuckLeadsCount: number;
  speedToFirstContactMs: number | null;
  cycleTimeMs: number | null;
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
        leads_submitted: bigint;
        submitted: bigint;
        approved: bigint;
        value_funded: string | null;
        call_count: bigint;
        call_minutes: bigint;
        short_calls: bigint;
        stuck_leads: bigint;
        speed_first_contact_ms: number | null;
        cycle_time_ms: number | null;
        last_activity_at: Date | null;
      }>
    >`
      WITH window_activity AS (
        SELECT "actorStaffId", "applicationId", "activityType", "reason",
               "durationMinutes", "occurredAt"
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
      agent_leads_submitted AS (
        SELECT a."assignedAgentStaffId" AS staff_id,
               COUNT(DISTINCT a.id)::bigint AS leads_submitted
          FROM application a
          JOIN activity act ON act."applicationId" = a.id
         WHERE a."assignedAgentStaffId" IS NOT NULL
           AND a."erasedAt" IS NULL
           AND act."activityType" = 'SUBMITTED_TO_BANK'
           AND act."actorRole" != 'system'
           AND act."occurredAt" >= now() - (${windowDays} || ' days')::interval
         GROUP BY a."assignedAgentStaffId"
      ),
      agent_value_funded AS (
        SELECT a."assignedAgentStaffId" AS staff_id,
               SUM(bo."effectiveLoanAmountEGP")::text AS value_funded
          FROM bank_offer_decision bod
          JOIN bank_offer bo ON bo.id = bod."bankOfferId"
          JOIN application a ON a.id = bo."applicationId"
         WHERE bod."outcome" = 'approved'
           AND bod."recordedAt" >= now() - (${windowDays} || ' days')::interval
           AND a."assignedAgentStaffId" IS NOT NULL
           AND a."erasedAt" IS NULL
           AND bo."erasedAt" IS NULL
         GROUP BY a."assignedAgentStaffId"
      ),
      first_contact_per_app AS (
        SELECT a.id AS application_id,
               a."assignedAgentStaffId" AS staff_id,
               a."assignedAt" AS assigned_at,
               MIN(act."occurredAt") AS first_contact_at
          FROM application a
          JOIN activity act ON act."applicationId" = a.id
         WHERE a."assignedAgentStaffId" IS NOT NULL
           AND a."assignedAt" IS NOT NULL
           AND a."assignedAt" >= now() - (${windowDays} || ' days')::interval
           AND a."erasedAt" IS NULL
           AND act."actorStaffId" = a."assignedAgentStaffId"
           AND act."actorRole" != 'system'
           AND act."activityType" IN ('CALLED_USER', 'SENT_WHATSAPP', 'SENT_EMAIL')
           AND act."occurredAt" >= a."assignedAt"
         GROUP BY a.id, a."assignedAgentStaffId", a."assignedAt"
      ),
      agent_speed AS (
        SELECT staff_id,
               AVG(EXTRACT(EPOCH FROM (first_contact_at - assigned_at)) * 1000)::double precision AS speed_ms
          FROM first_contact_per_app
         GROUP BY staff_id
      ),
      first_submit_per_app AS (
        SELECT a.id AS application_id,
               a."assignedAgentStaffId" AS staff_id,
               a."assignedAt" AS assigned_at,
               MIN(act."occurredAt") AS submitted_at
          FROM application a
          JOIN activity act ON act."applicationId" = a.id
         WHERE a."assignedAgentStaffId" IS NOT NULL
           AND a."assignedAt" IS NOT NULL
           AND a."assignedAt" >= now() - (${windowDays} || ' days')::interval
           AND a."erasedAt" IS NULL
           AND act."activityType" = 'SUBMITTED_TO_BANK'
           AND act."actorRole" != 'system'
           AND act."occurredAt" >= a."assignedAt"
         GROUP BY a.id, a."assignedAgentStaffId", a."assignedAt"
      ),
      agent_cycle AS (
        SELECT staff_id,
               AVG(EXTRACT(EPOCH FROM (submitted_at - assigned_at)) * 1000)::double precision AS cycle_ms
          FROM first_submit_per_app
         GROUP BY staff_id
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
        UNION SELECT staff_id FROM agent_assigned
        UNION SELECT staff_id FROM agent_stuck
        UNION SELECT staff_id FROM agent_leads_submitted
        UNION SELECT staff_id FROM agent_value_funded
        UNION SELECT staff_id FROM agent_speed
        UNION SELECT staff_id FROM agent_cycle
      )
      SELECT
        s.staff_id,
        COALESCE(ass.leads, 0)::bigint AS leads_assigned,
        COALESCE(ls.leads_submitted, 0)::bigint AS leads_submitted,
        COALESCE(o.submitted, 0)::bigint AS submitted,
        COALESCE(o.approved, 0)::bigint AS approved,
        vf.value_funded,
        COALESCE(o.call_count, 0)::bigint AS call_count,
        COALESCE(o.call_minutes, 0)::bigint AS call_minutes,
        COALESCE(o.short_calls, 0)::bigint AS short_calls,
        COALESCE(st.stuck, 0)::bigint AS stuck_leads,
        sp.speed_ms AS speed_first_contact_ms,
        cy.cycle_ms AS cycle_time_ms,
        o.last_activity_at
      FROM all_staff s
      LEFT JOIN agent_outcomes o ON o.staff_id = s.staff_id
      LEFT JOIN agent_assigned ass ON ass.staff_id = s.staff_id
      LEFT JOIN agent_stuck st ON st.staff_id = s.staff_id
      LEFT JOIN agent_leads_submitted ls ON ls.staff_id = s.staff_id
      LEFT JOIN agent_value_funded vf ON vf.staff_id = s.staff_id
      LEFT JOIN agent_speed sp ON sp.staff_id = s.staff_id
      LEFT JOIN agent_cycle cy ON cy.staff_id = s.staff_id
    `;
    return rows.map((r) => ({
      actorStaffId: r.staff_id,
      leadsAssigned: Number(r.leads_assigned),
      leadsSubmittedToBank: Number(r.leads_submitted),
      submittedToBank: Number(r.submitted),
      approvedByBank: Number(r.approved),
      valueFundedEGP: r.value_funded ?? null,
      callCount: Number(r.call_count),
      callMinutes: Number(r.call_minutes),
      shortCallCount: Number(r.short_calls),
      stuckLeadsCount: Number(r.stuck_leads),
      speedToFirstContactMs: r.speed_first_contact_ms ?? null,
      cycleTimeMs: r.cycle_time_ms ?? null,
      lastActivityAt: r.last_activity_at,
    }));
  }

  /**
   * Mobile Phase-1 funnel — pure audit_event counts so the analytics page
   * can render conversion without any extra tables. Stages emit in the
   * order a real user traverses them; clients render dropoff between
   * adjacent stages.
   */
  async aggregateFunnel(windowDays: number): Promise<Array<{ stage: string; count: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ stage: string; count: bigint }>
    >`
      WITH stages AS (
        SELECT 'catalog' AS stage, COUNT(*) AS count
          FROM "audit_event"
         WHERE "eventType" = 'CATALOG_VIEWED'
           AND "occurredAt" >= now() - (${windowDays}::int || ' days')::interval
        UNION ALL
        SELECT 'questionnaire', COUNT(*)
          FROM "audit_event"
         WHERE "eventType" = 'QUESTIONNAIRE_STARTED'
           AND "occurredAt" >= now() - (${windowDays}::int || ' days')::interval
        UNION ALL
        SELECT 'apply', COUNT(*)
          FROM "audit_event"
         WHERE "eventType" = 'APPLICATION_CREATED'
           AND "occurredAt" >= now() - (${windowDays}::int || ' days')::interval
        UNION ALL
        SELECT 'offers_viewed', COUNT(*)
          FROM "audit_event"
         WHERE "eventType" = 'OFFERS_VIEWED'
           AND "occurredAt" >= now() - (${windowDays}::int || ' days')::interval
        UNION ALL
        SELECT 'docs_uploaded', COUNT(DISTINCT "targetId")
          FROM "audit_event"
         WHERE "eventType" = 'DOCUMENT_UPLOADED'
           AND "occurredAt" >= now() - (${windowDays}::int || ' days')::interval
        UNION ALL
        SELECT 'offer_selected', COUNT(*)
          FROM "audit_event"
         WHERE "eventType" = 'APPLICATION_USER_PROCEEDED'
           AND "occurredAt" >= now() - (${windowDays}::int || ' days')::interval
      )
      SELECT stage, count FROM stages
    `;
    const order = ['catalog', 'questionnaire', 'apply', 'offers_viewed', 'docs_uploaded', 'offer_selected'];
    const map = new Map(rows.map((r) => [r.stage, Number(r.count)]));
    return order.map((stage) => ({ stage, count: map.get(stage) ?? 0 }));
  }
}
