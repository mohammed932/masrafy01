import { Injectable } from '@nestjs/common';
import type { PlatformEnumeration } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  EnumerationKeyDuplicateException,
  EnumerationSystemOnlyException,
  NotFoundException,
} from '@/common/errors/domain.exceptions';
import { PostgresPlatformEnumerationsRepository } from './postgres-platform-enumerations.repository';
import type { CreateEnumerationDto, UpdateEnumerationDto } from './dto/enumeration.dto';

export interface AdminActor {
  staffId: string;
  sourceIp: string | null;
  correlationId: string;
}

@Injectable()
export class PlatformEnumerationsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditEventWriter,
    private readonly repo: PostgresPlatformEnumerationsRepository,
  ) {}

  async listAll(filter?: { type?: string }): Promise<PlatformEnumeration[]> {
    return this.prisma.platformEnumeration.findMany({
      where: filter?.type ? { type: filter.type } : undefined,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { key: 'asc' }],
    });
  }

  async listTypes(): Promise<Array<{ type: string; total: number; active: number; deprecated: number }>> {
    const rows = await this.prisma.platformEnumeration.groupBy({
      by: ['type'],
      _count: { _all: true },
      orderBy: { type: 'asc' },
    });
    const out: Array<{ type: string; total: number; active: number; deprecated: number }> = [];
    for (const r of rows) {
      const [active, deprecated] = await Promise.all([
        this.prisma.platformEnumeration.count({
          where: { type: r.type, active: true, deprecatedAt: null },
        }),
        this.prisma.platformEnumeration.count({
          where: { type: r.type, deprecatedAt: { not: null } },
        }),
      ]);
      out.push({ type: r.type, total: r._count._all, active, deprecated });
    }
    return out;
  }

  async create(input: CreateEnumerationDto, actor: AdminActor): Promise<PlatformEnumeration> {
    const existing = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type: input.type, key: input.key } },
    });
    if (existing) {
      throw new EnumerationKeyDuplicateException({ type: input.type, key: input.key });
    }
    const created = await this.prisma.platformEnumeration.create({
      data: {
        type: input.type,
        key: input.key,
        labelAr: input.labelAr,
        labelEn: input.labelEn,
        parentKey: input.parentKey ?? null,
        sortOrder: input.sortOrder ?? 0,
        active: true,
        systemOnly: false,
        createdBy: actor.staffId,
        updatedBy: actor.staffId,
      },
    });
    this.repo.invalidateCache(input.type as never);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: 'PLATFORM_ENUMERATION_CREATED',
      sourceIp: actor.sourceIp,
      correlationId: actor.correlationId,
      payload: { type: created.type, key: created.key, id: created.id },
    });
    return created;
  }

  async update(
    id: string,
    patch: UpdateEnumerationDto,
    actor: AdminActor,
  ): Promise<PlatformEnumeration> {
    const existing = await this.prisma.platformEnumeration.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException();

    if (existing.systemOnly && (patch.active !== undefined || patch.deprecate !== undefined)) {
      throw new EnumerationSystemOnlyException({ type: existing.type, key: existing.key });
    }

    const data: Record<string, unknown> = { updatedBy: actor.staffId };
    let eventType: 'PLATFORM_ENUMERATION_UPDATED' | 'PLATFORM_ENUMERATION_DEACTIVATED' | 'PLATFORM_ENUMERATION_DEPRECATED' =
      'PLATFORM_ENUMERATION_UPDATED';

    if (patch.labelAr !== undefined) data.labelAr = patch.labelAr;
    if (patch.labelEn !== undefined) data.labelEn = patch.labelEn;
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

    if (patch.deprecate === true && existing.deprecatedAt === null) {
      data.deprecatedAt = new Date();
      data.active = false;
      eventType = 'PLATFORM_ENUMERATION_DEPRECATED';
    } else if (patch.active !== undefined && patch.deprecate !== true) {
      data.active = patch.active;
      if (patch.active === false) eventType = 'PLATFORM_ENUMERATION_DEACTIVATED';
    }

    const updated = await this.prisma.platformEnumeration.update({ where: { id }, data });
    this.repo.invalidateCache(existing.type as never);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType,
      sourceIp: actor.sourceIp,
      correlationId: actor.correlationId,
      payload: {
        type: existing.type,
        key: existing.key,
        id: existing.id,
        changes: this.diffChanges(existing, patch),
      },
    });
    return updated;
  }

  private diffChanges(
    existing: PlatformEnumeration,
    patch: UpdateEnumerationDto,
  ): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (patch.labelAr !== undefined && patch.labelAr !== existing.labelAr) {
      changes.labelAr = { from: existing.labelAr, to: patch.labelAr };
    }
    if (patch.labelEn !== undefined && patch.labelEn !== existing.labelEn) {
      changes.labelEn = { from: existing.labelEn, to: patch.labelEn };
    }
    if (patch.active !== undefined && patch.active !== existing.active) {
      changes.active = { from: existing.active, to: patch.active };
    }
    if (patch.sortOrder !== undefined && patch.sortOrder !== existing.sortOrder) {
      changes.sortOrder = { from: existing.sortOrder, to: patch.sortOrder };
    }
    if (patch.deprecate === true && existing.deprecatedAt === null) {
      changes.deprecated = { from: false, to: true };
    }
    return changes;
  }
}
