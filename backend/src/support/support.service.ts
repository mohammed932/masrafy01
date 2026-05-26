import { Injectable } from '@nestjs/common';
import { AuditEventType, SupportChannel, SupportStatus } from '@prisma/client';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  SupportConfigNotFoundException,
  SupportRequestAlreadyResolvedException,
  SupportRequestNotFoundException,
} from '@/common/errors/domain.exceptions';
import { SupportRepository } from './support.repository';
import type { SupportContactResponseDto, SupportRequestResponseDto } from './dto/support.dto';

export interface SupportRequestContext {
  sourceIp: string | null;
  correlationId: string;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly repo: SupportRepository,
    private readonly audit: AuditEventWriter,
  ) {}

  async getMobileContact(): Promise<SupportContactResponseDto> {
    const cfg = await this.repo.getConfig();
    if (!cfg) throw new SupportConfigNotFoundException();
    return {
      phone: cfg.phone,
      email: cfg.email,
      whatsappUrl: cfg.whatsappUrl,
      hoursAr: cfg.hoursAr,
      hoursEn: cfg.hoursEn,
    };
  }

  async createMobileRequest(args: {
    channel: SupportChannel;
    applicationId?: string;
    note?: string;
    customerId?: string | null;
    mobileClientId: string;
    ctx: SupportRequestContext;
  }): Promise<SupportRequestResponseDto> {
    const row = await this.repo.createRequest({
      channel: args.channel,
      applicationId: args.applicationId ?? null,
      customerId: args.customerId ?? null,
      mobileClientId: args.mobileClientId,
      note: args.note ?? null,
    });
    await this.audit.write({
      actorId: null,
      targetId: row.id,
      eventType: AuditEventType.SUPPORT_REQUEST_CREATED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: {
        supportRequestId: row.id,
        channel: row.channel,
        applicationId: row.applicationId,
        customerId: row.customerId,
      },
    });
    return this.toDto(row);
  }

  async listAdmin(query: {
    status?: SupportStatus;
    channel?: SupportChannel;
    assignedStaffId?: string;
    pageIndex: number;
    pageSize: number;
  }) {
    const result = await this.repo.list(query);
    return {
      rows: result.rows.map((r) => this.toDto(r)),
      total: result.total,
    };
  }

  async detailAdmin(id: string): Promise<SupportRequestResponseDto> {
    const row = await this.repo.findRequestById(id);
    if (!row) throw new SupportRequestNotFoundException({ id });
    return this.toDto(row);
  }

  async assignAdmin(args: {
    id: string;
    staffId: string;
    actorStaffId: string;
    ctx: SupportRequestContext;
  }): Promise<SupportRequestResponseDto> {
    const existing = await this.repo.findRequestById(args.id);
    if (!existing) throw new SupportRequestNotFoundException({ id: args.id });
    if (existing.status === 'resolved') {
      throw new SupportRequestAlreadyResolvedException({ id: args.id });
    }
    const row = await this.repo.assign(args.id, args.staffId);
    await this.audit.write({
      actorId: args.actorStaffId,
      targetId: args.id,
      eventType: AuditEventType.SUPPORT_REQUEST_ASSIGNED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { supportRequestId: args.id, assignedStaffId: args.staffId },
    });
    return this.toDto(row);
  }

  async resolveAdmin(args: {
    id: string;
    actorStaffId: string;
    ctx: SupportRequestContext;
  }): Promise<SupportRequestResponseDto> {
    const existing = await this.repo.findRequestById(args.id);
    if (!existing) throw new SupportRequestNotFoundException({ id: args.id });
    if (existing.status === 'resolved') {
      throw new SupportRequestAlreadyResolvedException({ id: args.id });
    }
    const row = await this.repo.resolve(args.id);
    await this.audit.write({
      actorId: args.actorStaffId,
      targetId: args.id,
      eventType: AuditEventType.SUPPORT_REQUEST_RESOLVED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { supportRequestId: args.id, applicationId: existing.applicationId },
    });
    return this.toDto(row);
  }

  async getConfigAdmin(): Promise<SupportContactResponseDto> {
    return this.getMobileContact();
  }

  async updateConfigAdmin(args: {
    actorStaffId: string;
    patch: Partial<{
      phone: string;
      email: string;
      whatsappUrl: string;
      hoursAr: string;
      hoursEn: string;
    }>;
    ctx: SupportRequestContext;
  }): Promise<SupportContactResponseDto> {
    const updated = await this.repo.updateConfig(args.actorStaffId, args.patch);
    await this.audit.write({
      actorId: args.actorStaffId,
      targetId: null,
      eventType: AuditEventType.SUPPORT_CONFIG_UPDATED,
      sourceIp: args.ctx.sourceIp,
      correlationId: args.ctx.correlationId,
      payload: { fields: Object.keys(args.patch) },
    });
    return {
      phone: updated.phone,
      email: updated.email,
      whatsappUrl: updated.whatsappUrl,
      hoursAr: updated.hoursAr,
      hoursEn: updated.hoursEn,
    };
  }

  private toDto(row: {
    id: string;
    channel: SupportChannel;
    status: SupportStatus;
    createdAt: Date;
    resolvedAt: Date | null;
    applicationId: string | null;
    customerId: string | null;
    assignedStaffId: string | null;
    note: string | null;
  }): SupportRequestResponseDto {
    return {
      id: row.id,
      channel: row.channel,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString(),
      applicationId: row.applicationId ?? undefined,
      customerId: row.customerId ?? undefined,
      assignedStaffId: row.assignedStaffId ?? undefined,
      note: row.note ?? undefined,
    };
  }
}
