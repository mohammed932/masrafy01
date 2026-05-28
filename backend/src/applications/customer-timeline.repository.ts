/**
 * CustomerTimeline repository — feature-local Prisma access for the
 * mobile customer-facing milestone timeline.
 *
 * Constitution Principle X (A5): services NEVER touch Prisma directly.
 * Lives next to `customer-timeline.service.ts` because the reads are
 * tightly coupled to that service's render contract (status transitions
 * from audit log + a single bank-response activity lookup at the tail).
 * Avoids forcing the applications module to import activities/audit
 * repositories that would otherwise create cross-feature coupling.
 */

import { Injectable } from '@nestjs/common';
import type { AuditEventType as PrismaAuditEventType } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AuditEventType } from '@/common/audit/audit-event-types';

export interface ApplicationTimelineHeader {
  id: string;
  mobileClientId: string;
  createdAt: Date;
}

/** Domain shape returned by `findLeadStatusTransitions` — service stays Prisma-free. */
export interface LeadStatusTransition {
  occurredAt: Date;
  payload: Record<string, unknown> | null;
}

/** Domain shape returned by `findLatestBankResponseActivity`. */
export interface BankResponseActivity {
  reason: string;
  meta: Record<string, unknown> | null;
}

@Injectable()
export class CustomerTimelineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findApplicationHeader(applicationId: string): Promise<ApplicationTimelineHeader | null> {
    const row = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, mobileClientId: true, createdAt: true },
    });
    if (!row) return null;
    return { id: row.id, mobileClientId: row.mobileClientId, createdAt: row.createdAt };
  }

  /**
   * Returns lead-status-change audit events for the given application,
   * ordered by `occurredAt` ascending so the timeline renders in event
   * order. Maps the Prisma row to the domain `LeadStatusTransition` shape.
   */
  async findLeadStatusTransitions(applicationId: string): Promise<LeadStatusTransition[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        eventType:
          AuditEventType.APPLICATION_LEAD_STATUS_CHANGED as unknown as PrismaAuditEventType,
        payload: { path: ['applicationId'], equals: applicationId },
      },
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true, payload: true },
    });
    return rows.map((r) => ({
      occurredAt: r.occurredAt,
      payload: (r.payload as Record<string, unknown> | null) ?? null,
    }));
  }

  async findLatestBankResponseActivity(
    applicationId: string,
  ): Promise<BankResponseActivity | null> {
    const row = await this.prisma.activity.findFirst({
      where: { applicationId, activityType: 'BANK_RESPONDED' },
      orderBy: { occurredAt: 'desc' },
      select: { reason: true, meta: true },
    });
    if (!row) return null;
    return {
      reason: row.reason,
      meta: (row.meta as Record<string, unknown> | null) ?? null,
    };
  }
}
