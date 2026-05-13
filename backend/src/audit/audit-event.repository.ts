import { Injectable } from '@nestjs/common';
import { Prisma, type AuditEvent, type AuditEventType } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface CreateAuditInput {
  actorId: string | null;
  targetId: string | null;
  bankProgramId?: string | null;
  eventType: AuditEventType;
  sourceIp: string | null;
  correlationId: string;
  payload: Prisma.JsonObject;
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
        eventType: input.eventType,
        sourceIp: input.sourceIp ?? undefined,
        correlationId: input.correlationId,
        payload: input.payload,
      },
    });
  }
}
