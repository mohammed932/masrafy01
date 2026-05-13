import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { RedisService } from '@/infra/redis/redis.service';

const ALIAS_SALT = 'masrafy-alias-salt';
const ALIAS_TTL_SECONDS = 15 * 60;

@Injectable()
export class AliasResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getAliasMap(analystSub: string): Promise<Record<string, string>> {
    const key = `alias:${analystSub}`;
    const cached = await this.redis.raw.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as Record<string, string>;
      } catch {
        // fall through to recompute
      }
    }

    const distinct = await this.prisma.activity.findMany({
      distinct: ['actorStaffId'],
      select: { actorStaffId: true },
      orderBy: { actorStaffId: 'asc' },
    });

    const ordered = [...distinct]
      .map((d) => d.actorStaffId)
      .filter((id): id is string => Boolean(id) && id !== 'clsysactor00000000000000000000');

    ordered.sort((a, b) => {
      const ha = this.deterministicHash(analystSub, a);
      const hb = this.deterministicHash(analystSub, b);
      return ha.localeCompare(hb);
    });

    const map: Record<string, string> = {};
    ordered.forEach((staffId, idx) => {
      map[staffId] = this.aliasForIndex(idx);
    });
    map['clsysactor00000000000000000000'] = 'System';

    await this.redis.raw.set(key, JSON.stringify(map), 'EX', ALIAS_TTL_SECONDS);
    return map;
  }

  private deterministicHash(analystSub: string, staffId: string): string {
    return createHash('sha256').update(`${analystSub}|${ALIAS_SALT}|${staffId}`).digest('hex');
  }

  private aliasForIndex(idx: number): string {
    if (idx < 26) return `Agent ${String.fromCharCode(65 + idx)}`;
    const first = Math.floor(idx / 26) - 1;
    const second = idx % 26;
    return `Agent ${String.fromCharCode(65 + first)}${String.fromCharCode(65 + second)}`;
  }
}
