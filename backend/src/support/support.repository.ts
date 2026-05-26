import { Injectable } from '@nestjs/common';
import type { Prisma, SupportConfig, SupportRequest, SupportChannel, SupportStatus } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

export interface CreateSupportRequestInput {
  channel: SupportChannel;
  applicationId?: string | null;
  customerId?: string | null;
  mobileClientId?: string | null;
  note?: string | null;
}

export interface ListSupportRequestsQuery {
  status?: SupportStatus;
  channel?: SupportChannel;
  assignedStaffId?: string;
  pageSize: number;
  pageIndex: number;
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

  async createRequest(input: CreateSupportRequestInput): Promise<SupportRequest> {
    return this.prisma.supportRequest.create({
      data: {
        channel: input.channel,
        applicationId: input.applicationId ?? null,
        customerId: input.customerId ?? null,
        mobileClientId: input.mobileClientId ?? null,
        note: input.note ?? null,
      },
    });
  }

  async findRequestById(id: string): Promise<SupportRequest | null> {
    return this.prisma.supportRequest.findUnique({ where: { id } });
  }

  async list(query: ListSupportRequestsQuery): Promise<{ rows: SupportRequest[]; total: number }> {
    const where: Prisma.SupportRequestWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;
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
    return { rows, total };
  }

  async assign(id: string, staffId: string): Promise<SupportRequest> {
    return this.prisma.supportRequest.update({
      where: { id },
      data: { assignedStaffId: staffId, status: 'in_progress' },
    });
  }

  async resolve(id: string): Promise<SupportRequest> {
    return this.prisma.supportRequest.update({
      where: { id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
  }
}
