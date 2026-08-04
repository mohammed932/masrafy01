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
  DbrBandCapOutOfRangeException,
  DbrBandsInvalidException,
  DeprecatedEnumerationKeyException,
  DerivationArithmeticMismatchException,
  EnumerationRegistryUnavailableException,
  ProgramRangeInvalidException,
  InvalidQualitativeReviewCeilingException,
  InvalidVariableRateConfigurationException,
  NoneTransferUnsafeException,
  ProgramCodeAlreadyInUseException,
  ProgramNameKeyUnknownException,
  QualitativeReviewCeilingBelowBaseException,
  UnknownEnumerationKeyException,
} from '../common/errors/domain.exceptions';
import { CreateBankProgramDto } from './dto/create-bank-program.dto';
import { UpdateBankProgramDto } from './dto/update-bank-program.dto';
import {
  buildProgramCodeBase,
  composeProgramCode,
  randomCodeSuffix,
} from './bank-program-code.util';
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
  validateRanges,
  ValidationContext,
} from './validation/cross-config.validators';
import { validateDbrBands } from './validation/dbr-bands.validator';
import { DuplicateBankProgramDto } from './dto/duplicate-bank-program.dto';

/**
 * Bank-program orchestration service.
 *
 * Phase 3 (US1) implements `create()` end-to-end.
 * Later phases extend `update()`, `toggle()`, `delete()`, `list()`, `findOne()`.
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
    actor: { id: string; sourceIp: string | null },
  ): Promise<BankProgramResponseDto> {
    // Fail-closed registry availability check.
    if (!(await this.enums.isAvailable())) {
      throw new EnumerationRegistryUnavailableException();
    }

    // Cross-config + registry validation.
    await this.runCrossConfigChecks(dto);

    // Resolve the program code: auto-generated when the admin doesn't supply one
    // (A33 — codes are never hand-typed). The generation loop already guarantees
    // uniqueness; this check still guards an explicitly-supplied code.
    const programCode = dto.programCode ?? (await this.generateProgramCode(dto));

    // Uniqueness check (defense-in-depth above Prisma's unique constraint).
    const existing = await this.repo.findByProgramCode(programCode);
    if (existing) {
      throw new ProgramCodeAlreadyInUseException(programCode);
    }

    // Persist + emit audit in one transaction.
    const program = await this.prisma.$transaction(async (tx) => {
      const created = await this.repo.create(
        {
          programCode,
          bankName: dto.bankName,
          bankId: dto.bankId,
          friendlyName: dto.friendlyName,
          friendlyNameAr: dto.friendlyNameAr,
          programNameKey: dto.programNameKey,
          programType: dto.programType,
          productCategory: dto.productCategory,
          currencies: dto.currencies,
          active: true,
          isShariaCompliant: dto.isShariaCompliant ?? false,
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

  // --- DUPLICATE (feature 010, FR-013) -------------------------------------

  /**
   * Copy an existing program into a new INACTIVE draft. Every configuration blob
   * is carried verbatim; only the identity fields the admin supplies differ.
   *
   * The copy is created inactive so a half-edited duplicate can never reach the
   * matching engine — the admin activates it from the detail page once reviewed.
   * No cross-config revalidation runs: the source already passed it and nothing
   * that validation looks at changes.
   */
  async duplicate(
    sourceProgramCode: string,
    dto: DuplicateBankProgramDto,
    actor: { id: string; sourceIp: string | null },
  ): Promise<BankProgramResponseDto> {
    const source = await this.repo.findByProgramCode(sourceProgramCode);
    if (!source) {
      throw new BankProgramNotFoundException({ programCode: sourceProgramCode });
    }

    const programCode =
      dto.programCode ??
      (await this.generateProgramCode({
        bankName: source.bankName,
        productCategory: source.productCategory,
      }));

    const existing = await this.repo.findByProgramCode(programCode);
    if (existing) {
      throw new ProgramCodeAlreadyInUseException(programCode);
    }

    // A copy stays the same archetype unless the admin re-classifies it. A
    // pre-catalog source has no archetype, so duplicating it forces a choice.
    const programNameKey = dto.programNameKey ?? source.programNameKey ?? '';
    await this.assertProgramNameKey(programNameKey);

    const program = await this.prisma.$transaction(async (tx) => {
      const created = await this.repo.create(
        {
          programCode,
          bankName: source.bankName,
          bankId: source.bankId,
          friendlyName: dto.friendlyName,
          friendlyNameAr: dto.friendlyNameAr ?? null,
          programNameKey,
          programType: source.programType,
          productCategory: source.productCategory,
          currencies: source.currencies,
          active: false,
          isShariaCompliant: source.isShariaCompliant,
          operatorNotes: source.operatorNotes,
          operatorTips: source.operatorTips,
          requiredDocuments: source.requiredDocuments,
          tenor: source.tenor as JsonBlob,
          loanLimits: source.loanLimits as JsonBlob,
          pricing: source.pricing as JsonBlob,
          eligibility: source.eligibility as JsonBlob,
          performanceCriteria: (source.performanceCriteria as JsonBlob) ?? null,
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
          eventType: AuditEventType.BANK_PROGRAM_CREATED,
          sourceIp: actor.sourceIp,
          payload: {
            programCode: created.programCode,
            friendlyName: created.friendlyName,
            bankName: created.bankName,
            productCategory: created.productCategory,
            active: created.active,
            duplicatedFrom: source.programCode,
          },
        },
        tx,
      );

      return created;
    });

    return this.toResponse(program, []);
  }

  /**
   * Build a readable, unique program code from bank + category, e.g.
   * `ABK-PERSONAL-A3F9`. Retries the random suffix until the code is free;
   * falls back to a timestamp suffix in the (practically impossible) event
   * every attempt collides.
   */
  private async generateProgramCode(dto: {
    bankName: string;
    productCategory: string;
  }): Promise<string> {
    const base = buildProgramCodeBase(dto.bankName, dto.productCategory);
    for (let i = 0; i < 50; i++) {
      const candidate = composeProgramCode(base, randomCodeSuffix());
      if (!(await this.repo.findByProgramCode(candidate))) return candidate;
    }
    return composeProgramCode(base, Date.now().toString(36).toUpperCase());
  }

  // --- Cross-config + registry validation ---------------------------------

  private async runCrossConfigChecks(
    dto: CreateBankProgramDto | UpdateBankProgramDto,
  ): Promise<void> {
    // A program names one predefined program from the catalog, never free text.
    await this.assertProgramNameKey(dto.programNameKey);

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

    // FR-014 (feature 010) — no inverted or empty amount / tenor / age range.
    const rangeViolation = validateRanges(dto);
    if (rangeViolation) {
      throw new ProgramRangeInvalidException(rangeViolation);
    }

    // FR-016 … FR-019 (feature 010) — banded DBR table, when the program uses one.
    const bandViolation = validateDbrBands(dto.eligibility.dbrBands);
    if (bandViolation?.kind === 'capOutOfRange') {
      throw new DbrBandCapOutOfRangeException({
        index: bandViolation.index,
        capPercent: bandViolation.capPercent,
      });
    }
    if (bandViolation?.kind === 'invalid') {
      throw new DbrBandsInvalidException({
        reason: bandViolation.reason,
        index: bandViolation.index,
      });
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

  /**
   * `programNameKey` MUST name a live member of the `program_name` catalog
   * (Manage values → Program names). Kept out of `validateAgainstRegistry` on
   * purpose: that helper collapses every miss into the generic
   * `UNKNOWN_ENUMERATION_KEY`, and this one deserves its own code so the admin
   * form can point at the catalog page.
   */
  private async assertProgramNameKey(programNameKey: string): Promise<void> {
    if (await this.enums.isActiveMember('program_name', programNameKey)) return;
    if (await this.enums.isDeprecatedMember('program_name', programNameKey)) {
      throw new DeprecatedEnumerationKeyException({
        enumerationType: 'program_name',
        deprecatedKey: programNameKey,
      });
    }
    const active = await this.enums.getActiveMembers('program_name');
    throw new ProgramNameKeyUnknownException({
      programNameKey,
      activeKeys: active.map((m) => m.key),
    });
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
      programNameKey: program.programNameKey ?? null,
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
      programNameKey: query.programNameKey,
      isShariaCompliant: query.isShariaCompliant,
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
          programNameKey: r.programNameKey ?? null,
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
    actor: { id: string; sourceIp: string | null },
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
          programNameKey: dto.programNameKey,
          programType: dto.programType,
          productCategory: dto.productCategory,
          currencies: dto.currencies,
          isShariaCompliant: dto.isShariaCompliant ?? false,
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
    actor: { id: string; sourceIp: string | null },
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

  // --- DELETE (US5) --------------------------------------------------------

  async deleteByCode(
    programCode: string,
    actor: { id: string; sourceIp: string | null },
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
      maxMonthsByEmploymentType?: Record<string, number>;
    } | null;
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
        'maxByTransferType',
        'maxByEmploymentType',
      ] as const) {
        const map = ll[dim] as Record<string, string> | undefined;
        if (!map) continue;
        const type = (
          {
            maxByPropertyType: 'property_type',
            maxByTransferType: 'transfer_type',
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
    'programNameKey',
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
