import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventRepository } from './audit-event.repository';

/**
 * Sole entry point for writing audit events. Strips known sensitive keys from
 * the payload before insert (defence in depth on top of Pino redaction).
 * Constitution Principle VI + data-model "Audit completeness" invariant.
 */
@Injectable()
export class AuditEventWriter {
  private readonly logger = new Logger(AuditEventWriter.name);

  private static readonly SENSITIVE_KEYS = new Set<string>([
    'password',
    'currentPassword',
    'newPassword',
    'initialPassword',
    'passwordHash',
    'tokenHash',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
  ]);

  constructor(private readonly repo: AuditEventRepository) {}

  async write(
    args: {
      actorId: string | null;
      targetId: string | null;
      bankProgramId?: string | null;
      eventType: AuditEventType;
      sourceIp: string | null;
      correlationId: string;
      payload?: Record<string, unknown>;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const safePayload = this.redact(args.payload ?? {});
    await this.repo.create(
      {
        actorId: args.actorId,
        targetId: args.targetId,
        bankProgramId: args.bankProgramId ?? null,
        eventType: args.eventType,
        sourceIp: args.sourceIp,
        correlationId: args.correlationId,
        payload: safePayload as Prisma.JsonObject,
      },
      tx,
    );
  }

  private redact(input: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (AuditEventWriter.SENSITIVE_KEYS.has(k)) {
        out[k] = '[Redacted]';
        continue;
      }
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        out[k] = this.redact(v as Record<string, unknown>);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
