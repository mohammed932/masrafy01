import { Injectable } from '@nestjs/common';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  EnumerationKeyDuplicateException,
  EnumerationSystemOnlyException,
  NotFoundException,
} from '@/common/errors/domain.exceptions';
import {
  PostgresPlatformEnumerationsRepository,
  type EnumerationRow,
  type EnumerationUpdatePatch,
} from './postgres-platform-enumerations.repository';
import type { CreateEnumerationDto, UpdateEnumerationDto } from './dto/enumeration.dto';

export interface AdminActor {
  staffId: string;
  sourceIp: string | null;
}

@Injectable()
export class PlatformEnumerationsAdminService {
  constructor(
    private readonly audit: AuditEventWriter,
    private readonly repo: PostgresPlatformEnumerationsRepository,
  ) {}

  async listAll(filter?: { type?: string }): Promise<EnumerationRow[]> {
    return this.repo.findAllOrdered(filter);
  }

  /**
   * Program-catalog usage: archetype key → how many bank programs instantiate it
   * and across how many banks. Feeds the catalog board so an entry is never
   * deprecated blind.
   */
  async programNameUsage(): Promise<Map<string, { programs: number; banks: number }>> {
    return this.repo.countProgramNameUsage();
  }

  async listTypes(): Promise<
    Array<{ type: string; total: number; active: number; deprecated: number }>
  > {
    return this.repo.listTypeStats();
  }

  async create(input: CreateEnumerationDto, actor: AdminActor): Promise<EnumerationRow> {
    const existing = await this.repo.findByTypeAndKey(input.type, input.key);
    if (existing) {
      throw new EnumerationKeyDuplicateException({ type: input.type, key: input.key });
    }
    const created = await this.repo.insert({
      type: input.type,
      key: input.key,
      labelAr: input.labelAr,
      labelEn: input.labelEn,
      parentKey: input.parentKey ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdBy: actor.staffId,
    });
    this.repo.invalidateCache(input.type as never);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_CREATED,
      sourceIp: actor.sourceIp,
      payload: { type: created.type, key: created.key, id: created.id },
    });
    return created;
  }

  async update(
    id: string,
    patch: UpdateEnumerationDto,
    actor: AdminActor,
  ): Promise<EnumerationRow> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException();

    if (existing.systemOnly && (patch.active !== undefined || patch.deprecate !== undefined)) {
      throw new EnumerationSystemOnlyException({ type: existing.type, key: existing.key });
    }

    const repoPatch: EnumerationUpdatePatch = { updatedBy: actor.staffId };
    let eventType:
      | AuditEventType.PLATFORM_ENUMERATION_UPDATED
      | AuditEventType.PLATFORM_ENUMERATION_DEACTIVATED
      | AuditEventType.PLATFORM_ENUMERATION_DEPRECATED =
      AuditEventType.PLATFORM_ENUMERATION_UPDATED;

    if (patch.labelAr !== undefined) repoPatch.labelAr = patch.labelAr;
    if (patch.labelEn !== undefined) repoPatch.labelEn = patch.labelEn;
    if (patch.parentKey !== undefined) repoPatch.parentKey = patch.parentKey;
    if (patch.sortOrder !== undefined) repoPatch.sortOrder = patch.sortOrder;

    if (patch.deprecate === true && existing.deprecatedAt === null) {
      repoPatch.deprecate = true;
      eventType = AuditEventType.PLATFORM_ENUMERATION_DEPRECATED;
    } else if (patch.active !== undefined && patch.deprecate !== true) {
      repoPatch.active = patch.active;
      if (patch.active === false) eventType = AuditEventType.PLATFORM_ENUMERATION_DEACTIVATED;
    }

    const updated = await this.repo.updateById(id, repoPatch);
    this.repo.invalidateCache(existing.type as never);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType,
      sourceIp: actor.sourceIp,
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
    existing: EnumerationRow,
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
    if (patch.parentKey !== undefined && patch.parentKey !== existing.parentKey) {
      changes.parentKey = { from: existing.parentKey, to: patch.parentKey };
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
