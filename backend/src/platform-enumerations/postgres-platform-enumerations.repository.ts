import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
} from './platform-enumerations.repository';

const ALL_TYPES: readonly EnumerationType[] = [
  'salary_category',
  'transfer_type',
  'employment_type',
  'loan_purpose',
  'property_type',
  'city_tier',
  'professor_rank',
  'military_grade',
  'product_category',
  'customer_program_tier',
  'performance_tier',
  'company_type',
  'required_document',
  'currency',
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
    const members: EnumerationMember[] = rows.map((r) => ({
      type: r.type as EnumerationType,
      key: r.key,
      labelAr: r.labelAr,
      labelEn: r.labelEn,
      active: r.active,
      deprecated: r.deprecatedAt !== null,
    }));
    this.cache.set(type, { members, expiresAt: Date.now() + CACHE_TTL_MS });
    return members;
  }

  invalidateCache(type?: EnumerationType): void {
    if (type) this.cache.delete(type);
    else this.cache.clear();
  }

  static readonly KNOWN_TYPES = ALL_TYPES;
}
