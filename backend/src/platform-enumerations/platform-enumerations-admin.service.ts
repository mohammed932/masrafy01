import { Injectable } from '@nestjs/common';
import { LoanCategory } from '@prisma/client';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  CatalogDefaultsCategoryUnknownException,
  EnumerationKeyDuplicateException,
  EnumerationSystemOnlyException,
  NotFoundException,
} from '@/common/errors/domain.exceptions';
import type { ProgramDefaultsDto } from '@/bank-programs/dto/program-defaults.dto';
import { validateProgramDefaults } from '@/bank-programs/validation/program-defaults.validator';
import {
  PostgresPlatformEnumerationsRepository,
  type EnumerationRow,
  type EnumerationUpdatePatch,
} from './postgres-platform-enumerations.repository';
import type {
  CreateEnumerationDto,
  UpdateCatalogDefaultsDto,
  UpdateEnumerationDto,
} from './dto/enumeration.dto';

/** Feature 010 — catalog defaults only exist on predefined-program members. */
const CATALOG_DEFAULTS_TYPE = 'program_name';

/**
 * The four constitution-locked retail categories (Principle II / A26). A program
 * name serves all of them; only the DEFAULTS inside it are keyed per category.
 */
const LOAN_CATEGORIES: ReadonlySet<string> = new Set<string>(Object.values(LoanCategory));

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

  // --- Feature 010: predefined-program catalog defaults (FR-001 … FR-004) ---

  /** Read the per-category defaults of one `program_name` member. */
  async getCatalogDefaults(key: string): Promise<{ defaults: Record<string, unknown> }> {
    const row = await this.repo.findByTypeAndKey(CATALOG_DEFAULTS_TYPE, key);
    if (!row) throw new NotFoundException();
    return { defaults: row.defaults };
  }

  /**
   * Full replace of a predefined program's defaults (FR-001, FR-002).
   *
   * A program name is category-agnostic — it may be picked under any of the four
   * retail categories — so every key is accepted as long as it IS one of them; a
   * typo'd key would otherwise sit in the row unreachable by prefill. Each
   * per-category value is validated in partial mode, so an admin can supply just
   * a rate or just a tenor (FR-003).
   *
   * FR-007/SC-008: this NEVER touches an already-saved bank program. Programs copy
   * these values on save and are self-contained thereafter (FR-009).
   */
  async updateCatalogDefaults(
    key: string,
    body: UpdateCatalogDefaultsDto,
    actor: AdminActor,
  ): Promise<{ defaults: Record<string, ProgramDefaultsDto> }> {
    const row = await this.repo.findByTypeAndKey(CATALOG_DEFAULTS_TYPE, key);
    if (!row) throw new NotFoundException();

    const validated: Record<string, ProgramDefaultsDto> = {};
    for (const [category, partial] of Object.entries(body.defaults)) {
      if (!LOAN_CATEGORIES.has(category)) {
        throw new CatalogDefaultsCategoryUnknownException({
          category,
          allowed: [...LOAN_CATEGORIES],
        });
      }
      validated[category] = await validateProgramDefaults(partial, `defaults.${category}`);
    }

    await this.repo.updateById(row.id, {
      defaults: validated,
      updatedBy: actor.staffId,
    });
    this.repo.invalidateCache(CATALOG_DEFAULTS_TYPE as never);
    await this.audit.write({
      actorId: actor.staffId,
      targetId: null,
      eventType: AuditEventType.PROGRAM_CATALOG_DEFAULTS_UPDATED,
      sourceIp: actor.sourceIp,
      payload: {
        type: CATALOG_DEFAULTS_TYPE,
        key: row.key,
        id: row.id,
        before: row.defaults,
        after: validated,
      },
    });
    return { defaults: validated };
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
