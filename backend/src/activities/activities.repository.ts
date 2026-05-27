import { Injectable } from '@nestjs/common';
import type { Activity } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

// Append-only at the repository layer (R-001 — primary defence).
// NO update* / delete* methods may be added here. DB trigger is layer 2.

export interface CreateActivityInput {
  id: string;
  applicationId: string;
  actorStaffId: string;
  actorRole: string;
  activityType: string;
  reason: string;
  note: string | null;
  durationMinutes: number | null;
  outcomeFlags: readonly string[];
  followUpAt: Date | null;
  attachedDocumentIds: readonly string[];
  meta: Prisma.InputJsonValue | null;
  correlationId: string;
}

export interface FindManyByApplicationOpts {
  cursor?: string;
  limit?: number;
}

@Injectable()
export class ActivitiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateActivityInput, tx?: Prisma.TransactionClient): Promise<Activity> {
    const client = tx ?? this.prisma;
    return client.activity.create({
      data: {
        id: input.id,
        applicationId: input.applicationId,
        actorStaffId: input.actorStaffId,
        actorRole: input.actorRole,
        activityType: input.activityType,
        reason: input.reason,
        note: input.note,
        durationMinutes: input.durationMinutes,
        outcomeFlags: [...input.outcomeFlags],
        followUpAt: input.followUpAt,
        attachedDocumentIds: [...input.attachedDocumentIds],
        meta: input.meta ?? Prisma.JsonNull,
        correlationId: input.correlationId,
      },
    });
  }

  async findManyByApplication(
    applicationId: string,
    opts: FindManyByApplicationOpts = {},
  ): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      where: { applicationId },
      orderBy: { occurredAt: 'desc' },
      take: opts.limit ?? 25,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
  }

  async findById(id: string): Promise<Activity | null> {
    return this.prisma.activity.findUnique({ where: { id } });
  }

  async findRemindersForStaff(staffId: string, windowHours: number): Promise<Activity[]> {
    const windowMs = windowHours * 60 * 60 * 1000;
    const horizon = new Date(Date.now() + windowMs);
    return this.prisma.activity.findMany({
      where: {
        actorStaffId: staffId,
        followUpAt: { not: null, lte: horizon },
      },
      orderBy: { followUpAt: 'asc' },
    });
  }

  async countByApplication(applicationId: string): Promise<number> {
    return this.prisma.activity.count({ where: { applicationId } });
  }

  /**
   * Cross-feature read: returns the distinct actor staff IDs that have
   * ever logged an activity, in ascending ID order. Consumed by
   * `LeadAnalyticsModule`'s `AliasResolverService` to build the analyst-
   * scoped agent alias map (system actor is filtered by the caller).
   */
  async findDistinctActorStaffIds(): Promise<string[]> {
    const rows = await this.prisma.activity.findMany({
      distinct: ['actorStaffId'],
      select: { actorStaffId: true },
      orderBy: { actorStaffId: 'asc' },
    });
    return rows.map((r) => r.actorStaffId).filter((id): id is string => Boolean(id));
  }
}
