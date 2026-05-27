import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import cuid from 'cuid';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';

const LOCK_KEY = 'stale-lead-scan:lock';
const LOCK_TTL_SECONDS = 3300; // 55 min — less than 60-min cron interval
const STALE_HOURS = 48;
const SYSTEM_ACTOR_ID = 'clsysactor00000000000000000000';

export interface StaleLeadScanResult {
  acquired: boolean;
  scannedAt: string;
  candidatesEvaluated: number;
  flagged: number;
  alreadyFlaggedSkipped: number;
}

@Injectable()
export class StaleLeadScanner {
  private readonly logger = new Logger(StaleLeadScanner.name);
  private readonly instanceId = randomUUID();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditEventWriter,
  ) {
    this.logger.log(`[StaleLeadScanner] cron registered (0 * * * *) instance=${this.instanceId}`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runHourly(): Promise<void> {
    const result = await this.scan();
    if (!result.acquired) {
      this.logger.debug(`[StaleLeadScanner] skipped (lock held by another instance)`);
      return;
    }
    this.logger.log({
      msg: 'STALE_LEAD_SCAN_COMPLETED',
      candidates: result.candidatesEvaluated,
      flagged: result.flagged,
      skipped: result.alreadyFlaggedSkipped,
    });
  }

  async scan(): Promise<StaleLeadScanResult> {
    const scannedAt = new Date();
    const acquired = await this.redis.raw.set(
      LOCK_KEY,
      this.instanceId,
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );
    if (acquired !== 'OK') {
      return {
        acquired: false,
        scannedAt: scannedAt.toISOString(),
        candidatesEvaluated: 0,
        flagged: 0,
        alreadyFlaggedSkipped: 0,
      };
    }

    try {
      const cutoff = new Date(scannedAt.getTime() - STALE_HOURS * 60 * 60 * 1000);

      const candidates = await this.prisma.application.findMany({
        where: {
          leadStatus: { in: ['needs_first_contact', 'document_collection'] },
          OR: [
            { activities: { none: {} } },
            { activities: { every: { occurredAt: { lt: cutoff } } } },
          ],
        },
        select: { id: true, assignedAgentStaffId: true, createdAt: true },
        take: 500,
      });

      let flagged = 0;
      let alreadyFlaggedSkipped = 0;

      for (const app of candidates) {
        const recentFlag = await this.prisma.activity.findFirst({
          where: {
            applicationId: app.id,
            activityType: 'STALE_LEAD_FLAGGED',
            occurredAt: { gt: new Date(scannedAt.getTime() - 60 * 60 * 1000) },
          },
          select: { id: true },
        });
        if (recentFlag) {
          alreadyFlaggedSkipped += 1;
          continue;
        }

        const lastActivity = await this.prisma.activity.findFirst({
          where: { applicationId: app.id },
          orderBy: { occurredAt: 'desc' },
          select: { occurredAt: true },
        });
        const referenceTime = lastActivity?.occurredAt ?? app.createdAt;
        const hoursSinceLastActivity = Math.floor(
          (scannedAt.getTime() - referenceTime.getTime()) / (60 * 60 * 1000),
        );

        const activityId = cuid();
        const correlationId = randomUUID();
        await this.prisma.$transaction(async (tx) => {
          await tx.activity.create({
            data: {
              id: activityId,
              applicationId: app.id,
              actorStaffId: SYSTEM_ACTOR_ID,
              actorRole: 'system',
              activityType: 'STALE_LEAD_FLAGGED',
              reason: 'NO_ACTIVITY_48H',
              note: null,
              durationMinutes: null,
              outcomeFlags: [],
              followUpAt: null,
              attachedDocumentIds: [],
              meta: { hoursSinceLastActivity },
              correlationId,
            },
          });
          await this.audit.write(
            {
              actorId: null,
              targetId: app.assignedAgentStaffId ?? null,
              eventType: AuditEventType.MANAGER_ATTENTION_REQUESTED,
              sourceIp: null,
              correlationId,
              payload: {
                applicationId: app.id,
                activityId,
                reason: 'no_activity_48h',
                hoursSinceLastActivity,
                assignedAgentStaffId: app.assignedAgentStaffId ?? null,
              },
            },
            tx,
          );
        });
        flagged += 1;
      }

      return {
        acquired: true,
        scannedAt: scannedAt.toISOString(),
        candidatesEvaluated: candidates.length,
        flagged,
        alreadyFlaggedSkipped,
      };
    } finally {
      try {
        const holder = await this.redis.raw.get(LOCK_KEY);
        if (holder === this.instanceId) {
          await this.redis.raw.del(LOCK_KEY);
        }
      } catch (err) {
        this.logger.warn(
          `[StaleLeadScanner] lock release best-effort failure: ${(err as Error).message}`,
        );
      }
    }
  }
}
