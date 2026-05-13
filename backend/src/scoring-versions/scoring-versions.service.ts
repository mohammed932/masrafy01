/**
 * Hydrates the active `ScoringConfig` value object that the matching engine consumes,
 * exposes the activation contract for the super_admin endpoint, and runs the boot-time
 * integrity check that refuses to serve `/apply` when the registry has no active row.
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AuditEventType, Prisma } from '@prisma/client';
import { AuditEventWriter } from '@/audit/audit-event.writer';
import {
  ScoringVersionConcurrentPromotionException,
  ScoringVersionNoActiveException,
  ScoringVersionNotFoundException,
} from '@/common/errors/domain.exceptions';
import type { ScoringConfig } from '@/matching/types';
import {
  ScoringEngineVersionRepository,
  ScoringVersionNotFoundError,
  type ScoringEngineVersionRow,
} from './scoring-versions.repository';

const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-z0-9-]+)?$/;

export interface ActivationResult {
  previousVersion: string | null;
  newVersion: string;
  activatedAt: string;
}

interface WeightsDiffEntry {
  code: string;
  previousValue: number | null;
  newValue: number | null;
  delta: number | 'added' | 'removed';
}

@Injectable()
export class ScoringEngineVersionService implements OnModuleInit {
  private readonly logger = new Logger(ScoringEngineVersionService.name);

  constructor(
    private readonly repo: ScoringEngineVersionRepository,
    private readonly audit: AuditEventWriter,
  ) {}

  async onModuleInit(): Promise<void> {
    const active = await this.repo.findActive();
    if (!active) {
      this.logger.error('No active scoring engine version — /apply will fail closed.');
      throw new ScoringVersionNoActiveException();
    }
    this.logger.log(`Active scoring engine version: ${active.version}`);
  }

  /** Hot-path read — invoked once per apply request. No caching (R-015). */
  async getActiveConfig(): Promise<ScoringConfig> {
    const row = await this.repo.findActive();
    if (!row) throw new ScoringVersionNoActiveException();
    return this.toConfig(row);
  }

  async getConfigByVersion(version: string): Promise<ScoringConfig> {
    const row = await this.repo.findByVersion(version);
    if (!row) throw new ScoringVersionNotFoundException(version);
    return this.toConfig(row);
  }

  async activate(
    targetVersion: string,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<ActivationResult> {
    if (!SEMVER_PATTERN.test(targetVersion)) {
      throw new ScoringVersionNotFoundException(targetVersion);
    }

    try {
      const { previous, next } = await this.repo.activate(targetVersion, actor.id, async (tx, prev, nxt) => {
        const diff = prev ? this.diffWeights(prev, nxt) : [];
        const bumpKind = prev ? this.classifyBump(prev, nxt) : 'major';
        await this.audit.write(
          {
            actorId: actor.id,
            targetId: null,
            eventType: AuditEventType.SCORING_ENGINE_VERSION_PROMOTED,
            sourceIp: actor.sourceIp,
            correlationId: actor.correlationId,
            payload: {
              previousVersion: prev?.version ?? null,
              newVersion: nxt.version,
              weightsDiff: diff.slice(0, 5),
              thresholdChange: prev
                ? JSON.stringify(prev.weightsConfig.thresholds) !==
                  JSON.stringify(nxt.weightsConfig.thresholds)
                : true,
              bumpKind,
            },
          },
          tx,
        );
      });

      return {
        previousVersion: previous?.version ?? null,
        newVersion: next.version,
        activatedAt: next.activatedAt.toISOString(),
      };
    } catch (err) {
      if (err instanceof ScoringVersionNotFoundError) {
        throw new ScoringVersionNotFoundException(err.version);
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        (err.code === 'P2034' || err.message.includes('serialization'))
      ) {
        throw new ScoringVersionConcurrentPromotionException();
      }
      if (err instanceof Error && err.message.includes('40001')) {
        throw new ScoringVersionConcurrentPromotionException();
      }
      throw err;
    }
  }

  private toConfig(row: ScoringEngineVersionRow): ScoringConfig {
    return {
      version: row.version,
      weights: row.weightsConfig.weights,
      thresholds: row.weightsConfig.thresholds,
      factorCatalog: row.weightsConfig.factorCatalog,
      legacy: row.weightsConfig.legacy ?? false,
    };
  }

  private diffWeights(prev: ScoringEngineVersionRow, next: ScoringEngineVersionRow): WeightsDiffEntry[] {
    const prevW = prev.weightsConfig.weights;
    const nextW = next.weightsConfig.weights;
    const codes = new Set<string>([...Object.keys(prevW), ...Object.keys(nextW)]);
    const out: WeightsDiffEntry[] = [];
    for (const code of codes) {
      const previousValue = prevW[code] ?? null;
      const newValue = nextW[code] ?? null;
      if (previousValue === null && newValue !== null) {
        out.push({ code, previousValue: null, newValue, delta: 'added' });
      } else if (previousValue !== null && newValue === null) {
        out.push({ code, previousValue, newValue: null, delta: 'removed' });
      } else if (previousValue !== null && newValue !== null && previousValue !== newValue) {
        out.push({ code, previousValue, newValue, delta: newValue - previousValue });
      }
    }
    return out.sort((a, b) => Math.abs(numericDelta(b.delta)) - Math.abs(numericDelta(a.delta)));
  }

  private classifyBump(
    prev: ScoringEngineVersionRow,
    next: ScoringEngineVersionRow,
  ): 'major' | 'minor' | 'patch' {
    const prevCodes = new Set(Object.keys(prev.weightsConfig.weights));
    const nextCodes = new Set(Object.keys(next.weightsConfig.weights));

    const removedCode = [...prevCodes].some((c) => !nextCodes.has(c));
    const thresholdChanged =
      JSON.stringify(prev.weightsConfig.thresholds) !==
      JSON.stringify(next.weightsConfig.thresholds);
    if (removedCode || thresholdChanged) return 'major';

    const addedCode = [...nextCodes].some((c) => !prevCodes.has(c));
    const weightChanged = [...prevCodes].some(
      (c) => prev.weightsConfig.weights[c] !== next.weightsConfig.weights[c],
    );
    if (addedCode || weightChanged) return 'minor';

    return 'patch';
  }
}

function numericDelta(d: number | 'added' | 'removed'): number {
  if (d === 'added' || d === 'removed') return Number.POSITIVE_INFINITY;
  return d;
}
