import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { PlatformEnumeration, Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
} from './platform-enumerations.repository';

export interface CreateEnumerationInput {
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  parentKey?: string | null;
  sortOrder?: number;
  createdBy: string;
}

export interface EnumerationTypeStats {
  type: string;
  total: number;
  active: number;
  deprecated: number;
}

/**
 * Domain row returned to services / controllers — keeps Prisma's
 * `PlatformEnumeration` row type confined to this repository
 * (Constitution Principle X / A8).
 */
export interface EnumerationRow {
  id: string;
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  systemOnly: boolean;
  deprecatedAt: Date | null;
  parentKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain patch for `updateById` — translated to Prisma update input inside the repo. */
export interface EnumerationUpdatePatch {
  labelAr?: string;
  labelEn?: string;
  parentKey?: string | null;
  sortOrder?: number;
  active?: boolean;
  /** When `true` AND `deprecatedAt` is currently null, the repository stamps `deprecatedAt = now`
   *  and forces `active = false`. */
  deprecate?: true;
  updatedBy: string;
}

const ALL_TYPES: readonly EnumerationType[] = [
  'transfer_type',
  'employment_type',
  'property_type',
  'professor_rank',
  'military_grade',
  'product_category',
  'company_type',
  'required_document',
  'currency',
  'governorate',
  'program_name',
];

interface CacheEntry {
  members: EnumerationMember[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute

@Injectable()
export class PostgresPlatformEnumerationsRepository
  extends PlatformEnumerationsRepository
  implements OnModuleInit
{
  private readonly logger = new Logger(PostgresPlatformEnumerationsRepository.name);
  private readonly cache: Map<EnumerationType, CacheEntry> = new Map();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.platformEnumeration.count();
    if (count === 0) {
      throw new Error(
        'PlatformEnumeration table is empty. Run `npx prisma migrate deploy` to apply the seed.',
      );
    }
    this.logger.log(`PlatformEnumerations registry loaded (${count} members across DB).`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.prisma.platformEnumeration.findFirst({ select: { id: true } });
      return true;
    } catch {
      return false;
    }
  }

  async isActiveMember(type: EnumerationType, key: string): Promise<boolean> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: { active: true, deprecatedAt: true },
    });
    return Boolean(row && row.active && row.deprecatedAt === null);
  }

  async isDeprecatedMember(type: EnumerationType, key: string): Promise<boolean> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: { deprecatedAt: true },
    });
    return Boolean(row && row.deprecatedAt !== null);
  }

  async getActiveMembers(type: EnumerationType): Promise<EnumerationMember[]> {
    const cached = this.cache.get(type);
    if (cached && cached.expiresAt > Date.now()) return cached.members;

    const rows = await this.prisma.platformEnumeration.findMany({
      where: { type, active: true, deprecatedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
    const members: EnumerationMember[] = rows.map(toEnumerationMember);
    this.cache.set(type, { members, expiresAt: Date.now() + CACHE_TTL_MS });
    return members;
  }

  invalidateCache(type?: EnumerationType): void {
    if (type) this.cache.delete(type);
    else this.cache.clear();
  }

  // ---- Admin CRUD --------------------------------------------------------
  // Admin-side read/write methods. Cache is invalidated by the caller after
  // a successful mutation so the read-cache cannot serve stale rows.

  async findAllOrdered(filter?: { type?: string }): Promise<EnumerationRow[]> {
    const rows = await this.prisma.platformEnumeration.findMany({
      where: filter?.type ? { type: filter.type } : undefined,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { key: 'asc' }],
    });
    return rows.map(toEnumerationRow);
  }

  /**
   * How many bank programs (and distinct banks) each `program_name` archetype is
   * currently used by — the number that tells an operator whether a catalog
   * entry is load-bearing before they deprecate it.
   *
   * The `bank_program` read lives here rather than in `BankProgramRepository`
   * because bank-programs already depends on this module; importing back would
   * close a cycle. Still a repository, so Principle X holds.
   */
  async countProgramNameUsage(): Promise<Map<string, { programs: number; banks: number }>> {
    const rows = await this.prisma.bankProgram.findMany({
      where: { programNameKey: { not: null } },
      select: { programNameKey: true, bankId: true },
    });
    const acc = new Map<string, { programs: number; banks: Set<string> }>();
    for (const r of rows) {
      const key = r.programNameKey;
      if (!key) continue;
      const entry = acc.get(key) ?? { programs: 0, banks: new Set<string>() };
      entry.programs += 1;
      if (r.bankId) entry.banks.add(r.bankId);
      acc.set(key, entry);
    }
    return new Map(
      [...acc].map(([key, v]) => [key, { programs: v.programs, banks: v.banks.size }]),
    );
  }

  async listTypeStats(): Promise<EnumerationTypeStats[]> {
    const rows = await this.prisma.platformEnumeration.groupBy({
      by: ['type'],
      _count: { _all: true },
      orderBy: { type: 'asc' },
    });
    const out: EnumerationTypeStats[] = [];
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

  async findByTypeAndKey(type: string, key: string): Promise<EnumerationRow | null> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
    });
    return row ? toEnumerationRow(row) : null;
  }

  async findById(id: string): Promise<EnumerationRow | null> {
    const row = await this.prisma.platformEnumeration.findUnique({ where: { id } });
    return row ? toEnumerationRow(row) : null;
  }

  async insert(input: CreateEnumerationInput): Promise<EnumerationRow> {
    const row = await this.prisma.platformEnumeration.create({
      data: {
        type: input.type,
        key: input.key,
        labelAr: input.labelAr,
        labelEn: input.labelEn,
        parentKey: input.parentKey ?? null,
        sortOrder: input.sortOrder ?? 0,
        active: true,
        systemOnly: false,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      },
    });
    return toEnumerationRow(row);
  }

  async updateById(id: string, patch: EnumerationUpdatePatch): Promise<EnumerationRow> {
    const data: Prisma.PlatformEnumerationUpdateInput = { updatedBy: patch.updatedBy };
    if (patch.labelAr !== undefined) data.labelAr = patch.labelAr;
    if (patch.labelEn !== undefined) data.labelEn = patch.labelEn;
    if (patch.parentKey !== undefined) data.parentKey = patch.parentKey;
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

    if (patch.deprecate === true) {
      data.deprecatedAt = new Date();
      data.active = false;
    } else if (patch.active !== undefined) {
      data.active = patch.active;
    }

    const row = await this.prisma.platformEnumeration.update({ where: { id }, data });
    return toEnumerationRow(row);
  }

  static readonly KNOWN_TYPES = ALL_TYPES;
}

// ---- Boundary mapper (Prisma row -> domain row) --------------------------

function toEnumerationRow(row: PlatformEnumeration): EnumerationRow {
  return {
    id: row.id,
    type: row.type,
    key: row.key,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    active: row.active,
    systemOnly: row.systemOnly,
    deprecatedAt: row.deprecatedAt,
    parentKey: row.parentKey,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEnumerationMember(row: PlatformEnumeration): EnumerationMember {
  return {
    type: row.type as EnumerationType,
    key: row.key,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    parentKey: row.parentKey,
    active: row.active,
    deprecated: row.deprecatedAt !== null,
  };
}
