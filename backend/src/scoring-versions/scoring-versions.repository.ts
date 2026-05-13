/**
 * Repository for the `scoring_engine_version` registry.
 * Constitution Principle X: services NEVER touch Prisma directly; this file is the single
 * Prisma-touching surface for engine versions.
 */
import { Injectable } from '@nestjs/common';
import type { Prisma, ScoringEngineVersion } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '@/infra/prisma/prisma.service';

const FactorCatalogEntrySchema = z.object({
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
});

const ThresholdsSchema = z.object({
  excellent: z.number().int().min(0).max(100),
  good: z.number().int().min(0).max(100),
  moderate: z.number().int().min(0).max(100),
  low: z.number().int().min(0).max(100),
});

export const WeightsConfigSchema = z.object({
  weights: z.record(z.string(), z.number()),
  thresholds: ThresholdsSchema,
  factorCatalog: z.record(z.string(), FactorCatalogEntrySchema),
  legacy: z.boolean().optional().default(false),
});

export type WeightsConfig = z.infer<typeof WeightsConfigSchema>;

export interface ScoringEngineVersionRow {
  id: string;
  version: string;
  description: string | null;
  weightsConfig: WeightsConfig;
  activatedAt: Date;
  deactivatedAt: Date | null;
  activatedByStaffId: string | null;
  createdAt: Date;
}

@Injectable()
export class ScoringEngineVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(): Promise<ScoringEngineVersionRow | null> {
    const row = await this.prisma.scoringEngineVersion.findFirst({
      where: { deactivatedAt: null },
      orderBy: { activatedAt: 'desc' },
    });
    return row ? this.hydrate(row) : null;
  }

  async findByVersion(version: string): Promise<ScoringEngineVersionRow | null> {
    const row = await this.prisma.scoringEngineVersion.findUnique({ where: { version } });
    return row ? this.hydrate(row) : null;
  }

  /**
   * SERIALIZABLE activation transaction (R-002 layer 2): deactivate the current active row,
   * activate the target row, return both for audit. Caller is responsible for emitting the
   * SCORING_ENGINE_VERSION_PROMOTED audit event inside the same transaction. Postgres
   * serialization-failure (40001) bubbles up unwrapped — service layer maps it to the
   * SCORING_VERSION_CONCURRENT_PROMOTION code.
   */
  async activate(
    targetVersion: string,
    activatedByStaffId: string,
    txCallback?: (
      tx: Prisma.TransactionClient,
      previous: ScoringEngineVersionRow | null,
      next: ScoringEngineVersionRow,
    ) => Promise<void>,
  ): Promise<{ previous: ScoringEngineVersionRow | null; next: ScoringEngineVersionRow }> {
    return this.prisma.$transaction(
      async (tx) => {
        const target = await tx.scoringEngineVersion.findUnique({
          where: { version: targetVersion },
        });
        if (!target) {
          throw new ScoringVersionNotFoundError(targetVersion);
        }

        const previousRaw = await tx.scoringEngineVersion.findFirst({
          where: { deactivatedAt: null },
        });
        const previous = previousRaw ? this.hydrate(previousRaw) : null;

        if (previousRaw && previousRaw.version !== targetVersion) {
          await tx.scoringEngineVersion.update({
            where: { id: previousRaw.id },
            data: { deactivatedAt: new Date() },
          });
        }

        const nextRaw = await tx.scoringEngineVersion.update({
          where: { id: target.id },
          data: { activatedAt: new Date(), deactivatedAt: null, activatedByStaffId },
        });
        const next = this.hydrate(nextRaw);

        if (txCallback) {
          await txCallback(tx, previous, next);
        }

        return { previous, next };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private hydrate(row: ScoringEngineVersion): ScoringEngineVersionRow {
    const parsed = WeightsConfigSchema.parse(row.weightsConfig);
    return {
      id: row.id,
      version: row.version,
      description: row.description,
      weightsConfig: parsed,
      activatedAt: row.activatedAt,
      deactivatedAt: row.deactivatedAt,
      activatedByStaffId: row.activatedByStaffId,
      createdAt: row.createdAt,
    };
  }
}

/** Sentinel error — translated to a DomainException by the service layer. */
export class ScoringVersionNotFoundError extends Error {
  constructor(public readonly version: string) {
    super(`Scoring engine version '${version}' is not registered`);
    this.name = 'ScoringVersionNotFoundError';
  }
}
