import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditEventRepository } from '../../audit/audit-event.repository';
import { PlatformEnumerationsRepository } from '../../platform-enumerations/platform-enumerations.repository';
import {
  EnumerationRegistryUnavailableException,
  SeedRateVerificationFailedException,
} from '../../common/errors/domain.exceptions';
import { BankProgramRepository } from '../bank-programs.repository';
import { abkEgypt2026 } from './catalogs/abk-egypt-2026';
import { salesfloorEgp2026 } from './catalogs/salesfloor-egp-2026';
import { bankNxt2026 } from './catalogs/bank-nxt-2026';
import type { SeedCatalog, SeedRunResult } from './catalog.types';

type CompetitorCatalogName = 'bank-nxt-2026' | 'salesfloor-egp-2026';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: BankProgramRepository,
    private readonly audit: AuditEventRepository,
    private readonly enums: PlatformEnumerationsRepository,
  ) {}

  async seedAbk(actor: { id: string; sourceIp: string | null; correlationId: string }): Promise<SeedRunResult> {
    return this.runCatalog(abkEgypt2026, actor);
  }

  async seedCompetitor(
    name: CompetitorCatalogName,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<SeedRunResult> {
    const catalog = name === 'bank-nxt-2026' ? bankNxt2026 : salesfloorEgp2026;
    return this.runCatalog(catalog, actor);
  }

  /**
   * Transactional + idempotent + rate-verified.
   * On verification failure, the transaction rolls back and SEED_RATE_VERIFICATION_FAILED is thrown.
   */
  private async runCatalog(
    catalog: SeedCatalog,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<SeedRunResult> {
    if (!(await this.enums.isAvailable())) {
      throw new EnumerationRegistryUnavailableException();
    }

    return this.prisma.$transaction(async (tx) => {
      const entries: SeedRunResult['entries'] = [];
      const mismatches: Array<{ programCode: string; expected: string; actual: string }> = [];

      for (const dto of catalog.programs) {
        const existing = await this.repo.findByProgramCode(dto.programCode);
        if (existing) {
          const actual = ratePercentOf(existing.pricing);
          entries.push({ programCode: dto.programCode, status: 'skipped', ratePercent: actual ?? '?' });
          continue;
        }
        const created = await this.repo.create(
          {
            programCode: dto.programCode,
            bankName: dto.bankName,
            friendlyName: dto.friendlyName,
            friendlyNameAr: dto.friendlyNameAr,
            programType: dto.programType,
            productCategory: dto.productCategory,
            currencies: dto.currencies,
            active: true,
            operatorNotes: dto.operatorNotes,
            operatorTips: dto.operatorTips,
            requiredDocuments: dto.requiredDocuments,
            tenor: dto.tenor as unknown as Prisma.InputJsonValue,
            loanLimits: dto.loanLimits as unknown as Prisma.InputJsonValue,
            pricing: dto.pricing as unknown as Prisma.InputJsonValue,
            eligibility: dto.eligibility as unknown as Prisma.InputJsonValue,
            performanceCriteria: (dto.performanceCriteria ?? null) as unknown as Prisma.InputJsonValue,
            incomeAssumption: dto.incomeAssumption as unknown as Prisma.InputJsonValue,
            fees: dto.fees as unknown as Prisma.InputJsonValue,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
          tx,
        );

        await this.audit.create(
          {
            actorId: actor.id,
            targetId: null,
            bankProgramId: created.id,
            eventType: 'BANK_PROGRAM_CREATED',
            sourceIp: actor.sourceIp,
            correlationId: actor.correlationId,
            payload: {
              programCode: created.programCode,
              friendlyName: created.friendlyName,
              bankName: created.bankName,
              productCategory: created.productCategory,
              active: created.active,
              seededFrom: catalog.name,
            } as Prisma.JsonObject,
          },
          tx,
        );

        // FR-033c — verify the rate matches the expected catalog value.
        const expected = catalog.expectedRates[dto.programCode];
        const actual = ratePercentOf(created.pricing);
        if (expected && actual && expected !== actual) {
          mismatches.push({ programCode: dto.programCode, expected, actual });
        }
        this.logger.log(`Seeded ${dto.programCode} at ${actual ?? '?'}% (expected ${expected ?? '?'})`);
        entries.push({ programCode: dto.programCode, status: 'created', ratePercent: actual ?? '?' });
      }

      if (mismatches.length > 0) {
        throw new SeedRateVerificationFailedException({ catalogName: catalog.name, mismatches });
      }

      return { catalogName: catalog.name, entries };
    });
  }
}

function ratePercentOf(pricing: unknown): string | undefined {
  const p = pricing as { isVariableRate?: boolean; baseRatePercent?: string; currentEffectiveRatePercent?: string } | null;
  if (!p) return undefined;
  return p.isVariableRate ? p.currentEffectiveRatePercent : p.baseRatePercent;
}
