import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/** One ready method as the service reads it (Prisma types stay in this file — A8). */
export interface MethodTemplateRow {
  key: string;
  labelEn: string;
  labelAr: string;
  mechanism: unknown;
  figures: unknown;
  placements: unknown;
  source: string;
  sortOrder: number;
  deletedAt: Date | null;
  updatedAt: Date;
}

const SELECT = {
  key: true,
  labelEn: true,
  labelAr: true,
  mechanism: true,
  figures: true,
  placements: true,
  source: true,
  sortOrder: true,
  deletedAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MethodTemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The live methods, in their list order. */
  async listLive(): Promise<MethodTemplateRow[]> {
    return this.prisma.methodTemplate.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { labelEn: 'asc' }],
      select: SELECT,
    });
  }

  /** Live or deleted — a deleted key is still taken, so the seed never puts it back. */
  async findByKey(key: string): Promise<MethodTemplateRow | null> {
    return this.prisma.methodTemplate.findUnique({ where: { key }, select: SELECT });
  }

  async findLiveByLabel(labelEn: string, exceptKey?: string): Promise<MethodTemplateRow | null> {
    return this.prisma.methodTemplate.findFirst({
      where: {
        deletedAt: null,
        labelEn: { equals: labelEn, mode: 'insensitive' },
        ...(exceptKey ? { NOT: { key: exceptKey } } : {}),
      },
      select: SELECT,
    });
  }

  async allKeys(): Promise<Set<string>> {
    const rows = await this.prisma.methodTemplate.findMany({ select: { key: true } });
    return new Set(rows.map((r) => r.key));
  }

  async maxSortOrder(): Promise<number> {
    const row = await this.prisma.methodTemplate.aggregate({ _max: { sortOrder: true } });
    return row._max.sortOrder ?? 0;
  }

  async create(data: {
    key: string;
    labelEn: string;
    labelAr: string;
    mechanism: unknown;
    figures: unknown;
    placements?: unknown;
    source: 'seed' | 'operator';
    sortOrder: number;
    updatedBy?: string;
  }): Promise<MethodTemplateRow> {
    return this.prisma.methodTemplate.create({
      data: {
        ...data,
        mechanism: data.mechanism as Prisma.InputJsonValue,
        figures: data.figures as Prisma.InputJsonValue,
        placements: (data.placements ?? {}) as Prisma.InputJsonValue,
      },
      select: SELECT,
    });
  }

  async update(
    key: string,
    data: {
      labelEn?: string;
      labelAr?: string;
      mechanism?: unknown;
      figures?: unknown;
      placements?: unknown;
      updatedBy?: string;
    },
  ): Promise<MethodTemplateRow> {
    return this.prisma.methodTemplate.update({
      where: { key },
      data: {
        ...(data.labelEn !== undefined ? { labelEn: data.labelEn } : {}),
        ...(data.labelAr !== undefined ? { labelAr: data.labelAr } : {}),
        ...(data.mechanism !== undefined
          ? { mechanism: data.mechanism as Prisma.InputJsonValue }
          : {}),
        ...(data.figures !== undefined ? { figures: data.figures as Prisma.InputJsonValue } : {}),
        ...(data.placements !== undefined
          ? { placements: data.placements as Prisma.InputJsonValue }
          : {}),
        ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
      },
      select: SELECT,
    });
  }

  /** Tombstoned, not removed: the key stays taken so the seed never revives it. */
  async softDelete(key: string, updatedBy?: string): Promise<void> {
    await this.prisma.methodTemplate.update({
      where: { key },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }
}
