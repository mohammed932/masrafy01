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

  /**
   * Insert many events in ONE statement.
   *
   * `createMany` returns no rows, which is why this answers a count rather than
   * `AuditEvent[]` — no caller of the bulk path needs the rows back, and pretending
   * otherwise would mean a second read purely to satisfy a signature.
   *
   * Exists because a bulk write's audit was N sequential round trips: `setParentKeysBulk`
   * already had that shape at up to 500 rows, and the pasted-values endpoint would have
   * copied it.
   */
  async createMany(inputs: readonly CreateAuditInput[], tx?: Prisma.TransactionClient): Promise<number> {
    if (inputs.length === 0) return 0;
    const client = tx ?? this.prisma;
    const { count } = await client.auditEvent.createMany({
      data: inputs.map((input) => ({
        actorId: input.actorId,
        targetId: input.targetId,
        bankProgramId: input.bankProgramId ?? undefined,
        eventType: toPrismaAuditEventType(input.eventType),
        sourceIp: input.sourceIp ?? undefined,
        payload: input.payload as Prisma.JsonObject,
      })),
    });
    return count;
  }

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
