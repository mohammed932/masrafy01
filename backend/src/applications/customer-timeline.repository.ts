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
import type { Activity, AuditEvent, AuditEventType as PrismaAuditEventType } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AuditEventType } from '@/common/audit/audit-event-types';

export interface ApplicationTimelineHeader {
  id: string;
  mobileClientId: string;
  createdAt: Date;
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
   * order.
   */
  async findLeadStatusTransitions(applicationId: string): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: {
        eventType: AuditEventType.APPLICATION_LEAD_STATUS_CHANGED as unknown as PrismaAuditEventType,
        payload: { path: ['applicationId'], equals: applicationId },
      },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async findLatestBankResponseActivity(
    applicationId: string,
  ): Promise<Pick<Activity, 'reason' | 'meta'> | null> {
    return this.prisma.activity.findFirst({
      where: { applicationId, activityType: 'BANK_RESPONDED' },
      orderBy: { occurredAt: 'desc' },
      select: { reason: true, meta: true },
    });
  }
}
