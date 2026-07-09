import { Injectable } from '@nestjs/common';
import { Prisma, type AuditEvent } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AuditEventType } from '@/common/audit/audit-event-types';

/**
 * Domain payload type — kept free of `Prisma.JsonObject` so services do not
 * have to import `@prisma/client` to call `audit.create()`. The repository
 * casts at the Prisma boundary inside `create()`.
 */
export type AuditPayload = Record<string, unknown>;

export interface CreateAuditInput {
  actorId: string | null;
  targetId: string | null;
  bankProgramId?: string | null;
  eventType: AuditEventType;
  sourceIp: string | null;
  payload: AuditPayload;
}

@Injectable()
export class AuditEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAuditInput, tx?: Prisma.TransactionClient): Promise<AuditEvent> {
    const client = tx ?? this.prisma;
    return client.auditEvent.create({
      data: {
        actorId: input.actorId,
        targetId: input.targetId,
        bankProgramId: input.bankProgramId ?? undefined,
        // Local enum mirrors the Prisma enum value-for-value; cast at the
        // Prisma boundary keeps the @prisma/client import contained to the
        // repository (Constitution Principle X).
        eventType: toPrismaAuditEventType(input.eventType),
        sourceIp: input.sourceIp ?? undefined,
        payload: input.payload as Prisma.JsonObject,
      },
    });
  }
}

// ---- Boundary mappers (Prisma <-> local) ---------------------------------

function toPrismaAuditEventType(value: AuditEventType): Prisma.AuditEventCreateInput['eventType'] {
  return value as unknown as Prisma.AuditEventCreateInput['eventType'];
}
