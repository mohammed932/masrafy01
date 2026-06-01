import { Injectable } from '@nestjs/common';
import type {
  Prisma,
  SupportConfig,
  SupportRequest as PrismaSupportRequest,
  SupportChannel as PrismaSupportChannel,
  SupportStatus as PrismaSupportStatus,
} from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { SupportChannel, SupportStatus } from './dto/enums';

export interface CreateSupportRequestInput {
  channel: SupportChannel;
  applicationId?: string | null;
  customerId?: string | null;
  note?: string | null;
}

export interface ListSupportRequestsQuery {
  status?: SupportStatus;
  channel?: SupportChannel;
  assignedStaffId?: string;
  pageSize: number;
  pageIndex: number;
}

/**
 * Mapped domain row exposed across feature boundaries. Same shape as the
 * Prisma model but with the local enum types — keeps `@prisma/client` out of
 * services / controllers / DTOs (Constitution Principle X).
 */
export interface SupportRequestRow {
  id: string;
  channel: SupportChannel;
  status: SupportStatus;
  applicationId: string | null;
  customerId: string | null;
  assignedStaffId: string | null;
  note: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

@Injectable()
export class SupportRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Config -------------------------------------------------------------

  async getConfig(): Promise<SupportConfig | null> {
    return this.prisma.supportConfig.findUnique({ where: { id: 'singleton' } });
  }

  async updateConfig(
    actorStaffId: string,
    patch: Partial<Pick<SupportConfig, 'phone' | 'email' | 'whatsappUrl' | 'hoursAr' | 'hoursEn'>>,
  ): Promise<SupportConfig> {
    return this.prisma.supportConfig.upsert({
      where: { id: 'singleton' },
      update: { ...patch, updatedBy: actorStaffId },
      create: {
        id: 'singleton',
        phone: patch.phone ?? '',
        email: patch.email ?? '',
        whatsappUrl: patch.whatsappUrl ?? '',
        hoursAr: patch.hoursAr ?? '',
        hoursEn: patch.hoursEn ?? '',
        updatedBy: actorStaffId,
      },
    });
  }

  // ---- Requests -----------------------------------------------------------

  async createRequest(input: CreateSupportRequestInput): Promise<SupportRequestRow> {
    const row = await this.prisma.supportRequest.create({
      data: {
        channel: input.channel as unknown as PrismaSupportChannel,
        applicationId: input.applicationId ?? null,
        customerId: input.customerId ?? null,
        note: input.note ?? null,
      },
    });
    return toSupportRequestRow(row);
  }

  async findRequestById(id: string): Promise<SupportRequestRow | null> {
    const row = await this.prisma.supportRequest.findUnique({ where: { id } });
    return row ? toSupportRequestRow(row) : null;
  }

  async list(
    query: ListSupportRequestsQuery,
  ): Promise<{ rows: SupportRequestRow[]; total: number }> {
    const where: Prisma.SupportRequestWhereInput = {};
    if (query.status) where.status = query.status as unknown as PrismaSupportStatus;
    if (query.channel) where.channel = query.channel as unknown as PrismaSupportChannel;
    if (query.assignedStaffId) where.assignedStaffId = query.assignedStaffId;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supportRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.pageIndex * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.supportRequest.count({ where }),
    ]);
    return { rows: rows.map(toSupportRequestRow), total };
  }

  async assign(id: string, staffId: string): Promise<SupportRequestRow> {
    const row = await this.prisma.supportRequest.update({
      where: { id },
      data: { assignedStaffId: staffId, status: 'in_progress' },
    });
    return toSupportRequestRow(row);
  }

  async resolve(id: string): Promise<SupportRequestRow> {
    const row = await this.prisma.supportRequest.update({
      where: { id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
    return toSupportRequestRow(row);
  }
}

// ---- Boundary mappers (Prisma -> local domain) ---------------------------

function toSupportRequestRow(row: PrismaSupportRequest): SupportRequestRow {
  return {
    id: row.id,
    channel: row.channel as unknown as SupportChannel,
    status: row.status as unknown as SupportStatus,
    applicationId: row.applicationId,
    customerId: row.customerId,
    assignedStaffId: row.assignedStaffId,
    note: row.note,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}
