import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuditEventType } from '../common/audit/audit-event-types';
import { AuditEventRepository } from '../audit/audit-event.repository';
import { PlatformEnumerationsRepository } from '../platform-enumerations/platform-enumerations.repository';
import {
  BankProgramHasOffersException,
  BankProgramNotFoundException,
  ConflictStaleDataException,
  DeprecatedEnumerationKeyException,
  DerivationArithmeticMismatchException,
  EnumerationRegistryUnavailableException,
  InvalidQualitativeReviewCeilingException,
  InvalidVariableRateConfigurationException,
  NoneTransferUnsafeException,
  ProgramCodeAlreadyInUseException,
  QualitativeReviewCeilingBelowBaseException,
  UnknownEnumerationKeyException,
} from '../common/errors/domain.exceptions';
import { CreateBankProgramDto } from './dto/create-bank-program.dto';
import { UpdateBankProgramDto } from './dto/update-bank-program.dto';
import {
  BankProgramListRowDto,
  BankProgramResponseDto,
  DeprecatedKeyDescriptor,
} from './dto/bank-program.response.dto';
import { ListBankProgramsQuery } from './dto/list-bank-programs.query';
import { BankProgramRepository, type JsonBlob } from './bank-programs.repository';
import {
  validateAgainstRegistry,
  validateDerivationArithmetic,
  ValidationContext,
} from './validation/cross-config.validators';

/**
 * Bank-program orchestration service.
 *
 * Phase 3 (US1) implements `create()` end-to-end.
 * Later phases extend `update()`, `toggle()`, `clone()`, `delete()`, `list()`, `findOne()`.
 *
 * Spec anchors (US1 only):
 *   FR-011a — variable-rate consistency
 *   FR-003a — qualitative-review ceiling rules
 *   FR-008s — derivation arithmetic guard
 *   FR-010 / FR-010c — enumeration validation + deprecated-key surface
 *   FR-012 — programCode uniqueness
 *   FR-031 — audit event emit
 */
@Injectable()
export class BankProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: BankProgramRepository,
    private readonly audit: AuditEventRepository,
    private readonly enums: PlatformEnumerationsRepository,
  ) {}

  // --- CREATE (US1) --------------------------------------------------------

  async create(
    dto: CreateBankProgramDto,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<BankProgramResponseDto> {
    // Fail-closed registry availability check.
    if (!(await this.enums.isAvailable())) {
      throw new EnumerationRegistryUnavailableException();
    }

    // Cross-config + registry validation.
    await this.runCrossConfigChecks(dto);

    // Uniqueness check (defense-in-depth above Prisma's unique constraint).
    const existing = await this.repo.findByProgramCode(dto.programCode);
    if (existing) {
      throw new ProgramCodeAlreadyInUseException(dto.programCode);
    }

    // Persist + emit audit in one transaction.
    const program = await this.prisma.$transaction(async (tx) => {
      const created = await this.repo.create(
        {
          programCode: dto.programCode,
          bankName: dto.bankName,
          bankId: dto.bankId,
          friendlyName: dto.friendlyName,
          friendlyNameAr: dto.friendlyNameAr,
          programType: dto.programType,
          productCategory: dto.productCategory,
          currencies: dto.currencies,
          active: true,
          operatorNotes: dto.operatorNotes,
          operatorTips: dto.operatorTips,
          requiredDocuments: dto.requiredDocuments,
          tenor: dto.tenor,
          loanLimits: dto.loanLimits,
          pricing: dto.pricing,
          eligibility: dto.eligibility,
          performanceCriteria: dto.performanceCriteria ?? null,
          incomeAssumption: dto.incomeAssumption,
          fees: dto.fees,
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
          eventType: AuditEventType.BANK_PROGRAM_CREATED,
          sourceIp: actor.sourceIp,
          correlationId: actor.correlationId,
          payload: {
            programCode: created.programCode,
            friendlyName: created.friendlyName,
            bankName: created.bankName,
            productCategory: created.productCategory,
            active: created.active,
          },
        },
        tx,
      );

      return created;
    });

    return this.toResponse(program, []);
  }

  // --- Cross-config + registry validation ---------------------------------

  private async runCrossConfigChecks(
    dto: CreateBankProgramDto | UpdateBankProgramDto,
  ): Promise<void> {
    // FR-011a — variable-rate consistency.
    const { isVariableRate, baseRatePercent, currentEffectiveRatePercent } = dto.pricing;
    if (isVariableRate) {
      if (!currentEffectiveRatePercent || currentEffectiveRatePercent.length === 0) {
        throw new InvalidVariableRateConfigurationException(
          'currentEffectiveRate',
          'currentEffectiveRate is REQUIRED when isVariableRate=true',
        );
      }
      if (baseRatePercent && baseRatePercent.length > 0) {
        throw new InvalidVariableRateConfigurationException(
          'baseRate',
          'baseRate MUST be empty when isVariableRate=true',
        );
      }
    } else {
      if (!baseRatePercent || baseRatePercent.length === 0) {
        throw new InvalidVariableRateConfigurationException(
          'baseRate',
          'baseRate is REQUIRED when isVariableRate=false',
        );
      }
      if (currentEffectiveRatePercent && currentEffectiveRatePercent.length > 0) {
        throw new InvalidVariableRateConfigurationException(
          'currentEffectiveRate',
          'currentEffectiveRate MUST be empty when isVariableRate=false',
        );
      }
    }

    // FR-003a — qualitative-review ceiling rules.
    const qrMax = dto.loanLimits.qualitativeReviewMaxEGP;
    if (qrMax) {
      if (!dto.eligibility.requiresQualitativeReview) {
        throw new InvalidQualitativeReviewCeilingException();
      }
      const baseMax = dto.loanLimits.perCurrency?.['EGP']?.maxAmount;
      if (!baseMax) {
        throw new QualitativeReviewCeilingBelowBaseException({
          qualitativeReviewMaxEGP: qrMax,
          maxEGP: '0',
        });
      }
      const qrDec = new Decimal(qrMax);
      const baseDec = new Decimal(baseMax);
      if (!qrDec.greaterThan(baseDec)) {
        throw new QualitativeReviewCeilingBelowBaseException({
          qualitativeReviewMaxEGP: qrMax,
          maxEGP: baseMax,
        });
      }
    }

    // FR-008s — derivation arithmetic.
    const mismatch = validateDerivationArithmetic(dto.pricing);
    if (mismatch) {
      throw new DerivationArithmeticMismatchException(mismatch);
    }

    // Feature 008 — 'none' transfer-type safety: an applicant with no salary
    // transfer is higher-risk. Allow only when explicitly priced (rate band
    // for 'none' present) OR backed by collateral.
    if (dto.eligibility.acceptedTransferTypes?.includes('none')) {
      const hasNoneRate =
        dto.pricing.rateByTransferType != null &&
        Object.prototype.hasOwnProperty.call(dto.pricing.rateByTransferType, 'none');
      const requiresCollateral = dto.eligibility.requiresCollateral === true;
      if (!hasNoneRate && !requiresCollateral) {
        throw new NoneTransferUnsafeException();
      }
    }

    // FR-010 / FR-010c — enumeration key validation.
    const ctx: ValidationContext = {
      isActiveMember: (type, key) => this.enums.isActiveMember(type, key),
      isDeprecatedMember: (type, key) => this.enums.isDeprecatedMember(type, key),
    };
    const result = await validateAgainstRegistry(dto, ctx);
    if (result.unknownKey) {
      const active = await this.enums.getActiveMembers(result.unknownKey.enumerationType);
      throw new UnknownEnumerationKeyException({
        enumerationType: result.unknownKey.enumerationType,
        offendingKey: result.unknownKey.key,
        activeMembers: active.map((m) => m.key),
      });
    }
    if (result.deprecatedKey) {
      throw new DeprecatedEnumerationKeyException({
        enumerationType: result.deprecatedKey.enumerationType,
        deprecatedKey: result.deprecatedKey.key,
      });
    }
  }

  // --- Response mapping ---------------------------------------------------

  private toResponse(
    program: Awaited<ReturnType<BankProgramRepository['create']>>,
    deprecatedKeys: DeprecatedKeyDescriptor[],
  ): BankProgramResponseDto {
    return {
      id: program.id,
      programCode: program.programCode,
      friendlyName: program.friendlyName,
      friendlyNameAr: program.friendlyNameAr ?? null,
      bankName: program.bankName,
      programType: program.programType as BankProgramResponseDto['programType'],
      productCategory: program.productCategory,
      currencies: program.currencies,
      active: program.active,
      isShariaCompliant: program.isShariaCompliant,
      version: program.version,
      operatorNotes: program.operatorNotes ?? null,
      operatorTips: program.operatorTips,
      requiredDocuments: program.requiredDocuments,
      tenor: program.tenor as Record<string, unknown>,
      loanLimits: program.loanLimits as Record<string, unknown>,
      pricing: program.pricing as Record<string, unknown>,
      eligibility: program.eligibility as Record<string, unknown>,
      performanceCriteria: (program.performanceCriteria as Record<string, unknown>) ?? null,
      incomeAssumption: program.incomeAssumption as Record<string, unknown>,
      fees: program.fees as Record<string, unknown>,
      deprecatedKeys,
      createdAt: program.createdAt.toISOString(),
      updatedAt: program.updatedAt.toISOString(),
    };
  }

  // --- LIST (US2) ----------------------------------------------------------

  async list(query: ListBankProgramsQuery): Promise<{
    rows: BankProgramListRowDto[];
    pagination: { page: number; pageSize: number; totalCount: number };
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const { rows, totalCount } = await this.repo.findManyPaged({
      page,
      pageSize,
      search: query.search,
      bankName: query.bankName,
      active: query.active,
      productCategory: query.productCategory,
      acceptedEmploymentType: query.employmentType,
    });

    // Compute deprecated-key count per row in parallel.
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const deprecatedKeyCount = await this.countDeprecatedKeys(r);
        const pricing = r.pricing as {
          isVariableRate?: boolean;
          baseRatePercent?: string;
          currentEffectiveRatePercent?: string;
        };
        return {
          id: r.id,
          programCode: r.programCode,
          friendlyName: r.friendlyName,
          bankName: r.bankName,
          productCategory: r.productCategory,
          active: r.active,
          isShariaCompliant: r.isShariaCompliant,
          currencies: r.currencies,
          baseRatePercent: pricing?.baseRatePercent ?? null,
          currentEffectiveRatePercent: pricing?.currentEffectiveRatePercent ?? null,
          deprecatedKeyCount,
          version: r.version,
          updatedAt: r.updatedAt.toISOString(),
        } satisfies BankProgramListRowDto;
      }),
    );

    return {
      rows: enriched,
      pagination: { page, pageSize, totalCount },
    };
  }

  // --- FIND ONE (US2) ------------------------------------------------------

  async findOne(programCode: string): Promise<BankProgramResponseDto> {
    const program = await this.repo.findByProgramCode(programCode);
    if (!program) {
      throw new BankProgramNotFoundException({ programCode });
    }
    const deprecatedKeys = await this.collectDeprecatedKeys(program);
    return this.toResponse(program, deprecatedKeys);
  }

  // --- UPDATE (US3) --------------------------------------------------------

  async update(
    programCode: string,
    dto: UpdateBankProgramDto,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<BankProgramResponseDto> {
    if (!(await this.enums.isAvailable())) {
      throw new EnumerationRegistryUnavailableException();
    }
    await this.runCrossConfigChecks(dto);

    const existing = await this.repo.findByProgramCode(programCode);
    if (!existing) {
      throw new BankProgramNotFoundException({ programCode });
    }

    // FR-019 — programCode immutable; ignore any submitted change.
    const before = existing;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await this.repo.updateWithVersion(
        existing.id,
        dto.version,
        {
          bankName: dto.bankName,
          ...((dto as { bankId?: string }).bankId !== undefined
            ? { bankId: (dto as { bankId?: string }).bankId ?? null }
            : {}),
          friendlyName: dto.friendlyName,
          friendlyNameAr: dto.friendlyNameAr ?? null,
          programType: dto.programType,
          productCategory: dto.productCategory,
          currencies: dto.currencies,
          operatorNotes: dto.operatorNotes ?? null,
          operatorTips: dto.operatorTips ?? [],
          requiredDocuments: dto.requiredDocuments ?? [],
          tenor: dto.tenor,
          loanLimits: dto.loanLimits,
          pricing: dto.pricing,
          eligibility: dto.eligibility,
          performanceCriteria: dto.performanceCriteria ?? null,
          incomeAssumption: dto.incomeAssumption,
          fees: dto.fees,
        },
        actor.id,
      );
      if (!next) {
        const fresh = await this.repo.findByProgramCode(programCode);
        throw new ConflictStaleDataException({
          submittedVersion: dto.version,
          currentVersion: fresh?.version ?? -1,
        });
      }

      const diff = computeStructuralDiff(before, next);
      await this.audit.create(
        {
          actorId: actor.id,
          targetId: null,
          bankProgramId: next.id,
          eventType: AuditEventType.BANK_PROGRAM_UPDATED,
          sourceIp: actor.sourceIp,
          correlationId: actor.correlationId,
          payload: {
            programCode: next.programCode,
            diff,
          },
        },
        tx,
      );

      // Rate-update sister event (FR-031).
      const beforePricing = before.pricing as {
        baseRatePercent?: string;
        currentEffectiveRatePercent?: string;
        isVariableRate?: boolean;
      } | null;
      const afterPricing = next.pricing as {
        baseRatePercent?: string;
        currentEffectiveRatePercent?: string;
        isVariableRate?: boolean;
      };
      const beforeRate = beforePricing?.isVariableRate
        ? beforePricing?.currentEffectiveRatePercent
        : beforePricing?.baseRatePercent;
      const afterRate = afterPricing?.isVariableRate
        ? afterPricing?.currentEffectiveRatePercent
        : afterPricing?.baseRatePercent;
      if (beforeRate !== afterRate) {
        await this.audit.create(
          {
            actorId: actor.id,
            targetId: null,
            bankProgramId: next.id,
            eventType: AuditEventType.BANK_PROGRAM_RATE_UPDATED,
            sourceIp: actor.sourceIp,
            correlationId: actor.correlationId,
            payload: {
              programCode: next.programCode,
              beforeEffectiveRate: beforeRate ?? null,
              afterEffectiveRate: afterRate ?? null,
              isVariableRate: afterPricing.isVariableRate ?? false,
            },
          },
          tx,
        );
      }

      return next;
    });

    const deprecatedKeys = await this.collectDeprecatedKeys(updated);
    return this.toResponse(updated, deprecatedKeys);
  }

  // --- TOGGLE (US3) --------------------------------------------------------

  async toggle(
    programCode: string,
    active: boolean,
    version: number,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<BankProgramResponseDto> {
    const existing = await this.repo.findByProgramCode(programCode);
    if (!existing) {
      throw new BankProgramNotFoundException({ programCode });
    }
    const before = existing.active;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await this.repo.toggleWithVersion(existing.id, version, active, actor.id);
      if (!next) {
        const fresh = await this.repo.findByProgramCode(programCode);
        throw new ConflictStaleDataException({
          submittedVersion: version,
          currentVersion: fresh?.version ?? -1,
        });
      }
      await this.audit.create(
        {
          actorId: actor.id,
          targetId: null,
          bankProgramId: next.id,
          eventType: AuditEventType.BANK_PROGRAM_TOGGLED,
          sourceIp: actor.sourceIp,
          correlationId: actor.correlationId,
          payload: {
            programCode: next.programCode,
            before: before ? 'active' : 'inactive',
            after: next.active ? 'active' : 'inactive',
          },
        },
        tx,
      );
      return next;
    });
    const deprecatedKeys = await this.collectDeprecatedKeys(updated);
    return this.toResponse(updated, deprecatedKeys);
  }

  // --- CLONE (US4) ---------------------------------------------------------

  async clone(
    sourceProgramCode: string,
    newProgramCode: string,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<BankProgramResponseDto> {
    const source = await this.repo.findByProgramCode(sourceProgramCode);
    if (!source) {
      throw new BankProgramNotFoundException({ programCode: sourceProgramCode });
    }
    const conflict = await this.repo.findByProgramCode(newProgramCode);
    if (conflict) {
      throw new ProgramCodeAlreadyInUseException(newProgramCode);
    }

    const cloned = await this.prisma.$transaction(async (tx) => {
      const created = await this.repo.create(
        {
          programCode: newProgramCode,
          bankName: source.bankName,
          friendlyName: source.friendlyName,
          friendlyNameAr: source.friendlyNameAr,
          programType: source.programType,
          productCategory: source.productCategory,
          currencies: source.currencies,
          active: source.active,
          operatorNotes: source.operatorNotes,
          operatorTips: source.operatorTips,
          requiredDocuments: source.requiredDocuments,
          tenor: source.tenor as JsonBlob,
          loanLimits: source.loanLimits as JsonBlob,
          pricing: source.pricing as JsonBlob,
          eligibility: source.eligibility as JsonBlob,
          performanceCriteria: (source.performanceCriteria ?? null) as JsonBlob,
          incomeAssumption: source.incomeAssumption as JsonBlob,
          fees: source.fees as JsonBlob,
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
          eventType: AuditEventType.BANK_PROGRAM_CLONED,
          sourceIp: actor.sourceIp,
          correlationId: actor.correlationId,
          payload: {
            sourceProgramCode: source.programCode,
            newProgramCode: created.programCode,
          },
        },
        tx,
      );
      return created;
    });
    return this.toResponse(cloned, []);
  }

  // --- DELETE (US5) --------------------------------------------------------

  async deleteByCode(
    programCode: string,
    actor: { id: string; sourceIp: string | null; correlationId: string },
  ): Promise<void> {
    const program = await this.repo.findByProgramCode(programCode);
    if (!program) {
      throw new BankProgramNotFoundException({ programCode });
    }
    const offers = await this.repo.countOffersReferencing(programCode);
    if (offers > 0) {
      throw new BankProgramHasOffersException({ programCode, offerCount: offers });
    }
    await this.prisma.$transaction(async (tx) => {
      await this.audit.create(
        {
          actorId: actor.id,
          targetId: null,
          bankProgramId: null,
          eventType: AuditEventType.BANK_PROGRAM_DELETED,
          sourceIp: actor.sourceIp,
          correlationId: actor.correlationId,
          payload: {
            programCode: program.programCode,
            friendlyName: program.friendlyName,
            bankName: program.bankName,
            deletedAt: new Date().toISOString(),
          },
        },
        tx,
      );
      await this.repo.delete(program.id);
    });
  }

  // --- Deprecated-key surface (FR-010c) ------------------------------------

  private async countDeprecatedKeys(
    program: Awaited<ReturnType<BankProgramRepository['create']>>,
  ): Promise<number> {
    const keys = await this.collectDeprecatedKeys(program);
    return keys.length;
  }

  private async collectDeprecatedKeys(
    program: Awaited<ReturnType<BankProgramRepository['create']>>,
  ): Promise<DeprecatedKeyDescriptor[]> {
    const found: DeprecatedKeyDescriptor[] = [];
    const checks: Array<{
      fieldPath: string;
      key: string;
      type: Parameters<PlatformEnumerationsRepository['isDeprecatedMember']>[0];
    }> = [];

    const tenor = program.tenor as {
      maxMonthsBySalaryCategory?: Record<string, number>;
      maxMonthsByEmploymentType?: Record<string, number>;
    } | null;
    if (tenor?.maxMonthsBySalaryCategory) {
      for (const k of Object.keys(tenor.maxMonthsBySalaryCategory)) {
        checks.push({
          fieldPath: `tenor.maxMonthsBySalaryCategory.${k}`,
          key: k,
          type: 'salary_category',
        });
      }
    }
    if (tenor?.maxMonthsByEmploymentType) {
      for (const k of Object.keys(tenor.maxMonthsByEmploymentType)) {
        checks.push({
          fieldPath: `tenor.maxMonthsByEmploymentType.${k}`,
          key: k,
          type: 'employment_type',
        });
      }
    }

    const ll = program.loanLimits as Record<string, unknown> | null;
    if (ll && typeof ll === 'object') {
      for (const dim of [
        'maxByPropertyType',
        'maxByCityTier',
        'maxByTransferType',
        'maxBySalaryCategory',
        'maxByEmploymentType',
      ] as const) {
        const map = ll[dim] as Record<string, string> | undefined;
        if (!map) continue;
        const type = (
          {
            maxByPropertyType: 'property_type',
            maxByCityTier: 'city_tier',
            maxByTransferType: 'transfer_type',
            maxBySalaryCategory: 'salary_category',
            maxByEmploymentType: 'employment_type',
          } as const
        )[dim];
        for (const k of Object.keys(map)) {
          checks.push({ fieldPath: `loanLimits.${dim}.${k}`, key: k, type });
        }
      }
    }

    for (const c of checks) {
      if (await this.enums.isDeprecatedMember(c.type, c.key)) {
        found.push({ fieldPath: c.fieldPath, key: c.key, enumerationType: c.type });
      }
    }

    return found;
  }
}

// --- Structural diff helper ------------------------------------------------

interface StructuralDiffEntry {
  fieldPath: string;
  before: unknown;
  after: unknown;
}

function computeStructuralDiff(
  before: Awaited<ReturnType<BankProgramRepository['create']>>,
  after: Awaited<ReturnType<BankProgramRepository['create']>>,
): StructuralDiffEntry[] {
  const entries: StructuralDiffEntry[] = [];
  const topLevelFields: Array<keyof typeof before> = [
    'bankName',
    'friendlyName',
    'friendlyNameAr',
    'programType',
    'productCategory',
    'active',
    'operatorNotes',
  ];
  for (const f of topLevelFields) {
    if (before[f] !== after[f]) {
      entries.push({ fieldPath: String(f), before: before[f], after: after[f] });
    }
  }
  const jsonFields: Array<keyof typeof before> = [
    'currencies',
    'operatorTips',
    'requiredDocuments',
    'tenor',
    'loanLimits',
    'pricing',
    'eligibility',
    'performanceCriteria',
    'incomeAssumption',
    'fees',
  ];
  for (const f of jsonFields) {
    const a = JSON.stringify(before[f]);
    const b = JSON.stringify(after[f]);
    if (a !== b) {
      entries.push({ fieldPath: String(f), before: before[f], after: after[f] });
    }
  }
  return entries;
}
