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
  IncomeRuleBandsInvalidException,
  IncomeRuleDbrOverrideInvalidException,
  IncomeRuleDuplicateKeyException,
  IncomeRuleEmptyException,
  IncomeRuleIncomeInvalidException,
  IncomeRuleUnknownKeyException,
  ProgramRangeInvalidException,
  InvalidQualitativeReviewCeilingException,
  InvalidVariableRateConfigurationException,
  NoneTransferUnsafeException,
  ProgramCodeAlreadyInUseException,
  ProgramNameKeyBasisMismatchException,
  ProgramNameKeyNotInCategoryException,
  ProgramHasEstimatedValuesException,
  ProgramNameKeyUnknownException,
  ValueSourcePathUnknownException,
  ValueSourceValueInvalidException,
  QualitativeReviewCeilingBelowBaseException,
  UnknownEnumerationKeyException,
} from '../common/errors/domain.exceptions';
import { CreateBankProgramDto, type ProgramType } from './dto/create-bank-program.dto';
import { asLoanCategory } from '@/common/loan-category.util';
import { basisOfProgramType } from '@/common/income-basis.util';
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
import {
  estimatedPaths,
  newlyEstimatedPaths,
  pruneValueSources,
  validateValueSources,
  type MarkableProgramConfig,
  type ValueSourceMap,
  type ValueSourceViolation,
} from './validation/value-sources.validator';
import {
  collectIncomeRuleWarnings,
  stripForeignMethodConfig,
  validateIncomeRule,
  type IncomeRuleValidationContext,
  type IncomeRuleViolation,
  type IncomeRuleWarning,
} from './validation/income-rule.validator';
import { DuplicateBankProgramDto } from './dto/duplicate-bank-program.dto';
import { normalizeIncomeAssumption } from '@/matching/pipeline/income-rule-normalize';
import { quoteProgram } from '@/matching/pipeline/quote';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import { toBankProgramSnapshot } from './bank-program-snapshot.mapper';
import {
  IncomeRuleCheckDto,
  type IncomeRuleCheckResponseDto,
} from './dto/income-rule-check.dto';
import {
  KEY_TABLE_REGISTRY,
  KEY_TABLE_STRATEGIES,
  type ApplicantProfile,
  type BankProgramSnapshot,
  type IncomeAssumptionConfig,
} from '@/matching/types';
import { ERROR_CODES } from '../common/errors/error-codes';

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

    // The rule AS IT WILL BE STORED, not as it arrived: `runCrossConfigChecks`
    // validates this exact object, so the save can never persist a shape nothing
    // checked (see `persistableIncomeAssumption`).
    const persistedRule = this.persistableIncomeAssumption(dto);

    // Cross-config + registry validation.
    await this.runCrossConfigChecks(dto, { incomeAssumption: persistedRule });

    // Resolve the program code: auto-generated when the admin doesn't supply one
    // (A33 — codes are never hand-typed). The generation loop already guarantees
    // uniqueness; this check still guards an explicitly-supplied code.
    const programCode = dto.programCode ?? (await this.generateProgramCode(dto));

    // Uniqueness check (defense-in-depth above Prisma's unique constraint).
    const existing = await this.repo.findByProgramCode(programCode);
    if (existing) {
      throw new ProgramCodeAlreadyInUseException(programCode);
    }

    const warnings = this.incomeRuleWarnings({ dto, persisted: persistedRule });

    // Feature 011 — markers are validated on create too. A program created WITH an
    // estimate SAVES fine (FR-034) but must not be born LIVE: programs are created
    // active by default, so without this a create would walk straight past the
    // activation gate `toggle` enforces and ship an unconfirmed number.
    const markerConfig = { ...dto, incomeAssumption: persistedRule };
    // No `previousConfig`: a program being created has no past, so no marker on it
    // can be stale — every unknown path here really is a client error.
    throwOnValueSourceViolation(validateValueSources(dto.valueSources, markerConfig));
    const persistedSources = pruneValueSources(dto.valueSources, markerConfig);
    const createdWithEstimates = estimatedPaths(persistedSources).length > 0;

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
          // Inactive when it carries an unconfirmed number (FR-033). The admin
          // switches it on from the detail page once the bank has confirmed, which is
          // the same gate every other program passes through.
          active: !createdWithEstimates,
          isShariaCompliant: dto.isShariaCompliant ?? false,
          operatorNotes: dto.operatorNotes,
          operatorTips: dto.operatorTips,
          requiredDocuments: dto.requiredDocuments,
          tenor: dto.tenor,
          loanLimits: dto.loanLimits,
          pricing: dto.pricing,
          eligibility: dto.eligibility,
          performanceCriteria: dto.performanceCriteria ?? null,
          incomeAssumption: persistedRule,
          fees: dto.fees,
          valueSources: persistedSources,
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

    return this.toResponse(program, [], {
      warnings,
      ...(createdWithEstimates ? { deactivatedByEstimate: true } : {}),
    });
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
    // A copy inherits `source.productCategory` (below), so that is the category
    // the possibly-new name has to be assigned to. `DuplicateBankProgramDto`
    // carries no category of its own.
    const programNameKey = dto.programNameKey ?? source.programNameKey ?? '';
    await this.assertProgramNameKey(programNameKey, source.productCategory, {
      // Same grandfather rule as `update()`: a straight copy that keeps the
      // source's name and category is not moving anything. The copy also inherits
      // `source.programType`, so an unchanged name is an unchanged basis too.
      skipProgramNameCategoryCheck: programNameKey === source.programNameKey,
      skipProgramNameBasisCheck: programNameKey === source.programNameKey,
      programType: source.programType as ProgramType,
    });

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
          // The markers travel WITH the numbers they describe (FR-033). Omitting
          // them laundered every team-estimated figure into a copy the activation
          // gate no longer blocked: same guessed rate, `valueSources: {}`, and the
          // copy could be switched live on it and never appeared on the waiting
          // list. A duplicate is the same unconfirmed data under a new code.
          valueSources: source.valueSources as JsonBlob,
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
    opts: {
      skipProgramNameCategoryCheck?: boolean;
      /** The (name, income basis) pair is unchanged — see `assertProgramNameKey`. */
      skipProgramNameBasisCheck?: boolean;
      /**
       * The income rule to validate. ALWAYS the shape that is about to be persisted
       * (`persistableIncomeAssumption`), never the raw DTO: the two differ — the raw
       * body may carry a legacy table the normalizer turns into bands, and the
       * canonical bands are what the engine reads. Validating the raw body let an
       * unchecked shape reach the database and rejected legacy shapes the strip was
       * written to preserve, so the save path and the check endpoint (US3, which
       * validates the normalized draft) disagreed about the same rule.
       */
      incomeAssumption?: IncomeAssumptionConfig;
    } = {},
  ): Promise<void> {
    // A program names one predefined program from the catalog, never free text —
    // and names one the catalog sells on this program's income basis.
    await this.assertProgramNameKey(dto.programNameKey, dto.productCategory, {
      ...opts,
      programType: dto.programType,
    });
    // No category CONSTRAINS the program type (v16.0.0). Both bases are legal under
    // every category the catalog offers, and which one this program uses is its own
    // `programType` — the category no longer implies it. What DOES constrain it is
    // the catalog NAME, checked above: a name is marked payslip / no-payslip /
    // both, per loan type, by the operator who created it.

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

    // FR-006 … FR-012 (feature 011) — the income rule's rows, bands, keys and
    // DBR override. Validated for EVERY program type, not only
    // `income_surrogate`: a rule that the program's type currently hides is
    // ignored and reported rather than deleted (FR-001 edge case), and a table
    // saved with a duplicate key or a zero income would be just as broken the day
    // someone re-typed the program.
    const ruleViolation = await validateIncomeRule(
      opts.incomeAssumption ??
        this.persistableIncomeAssumption(dto as CreateBankProgramDto | UpdateBankProgramDto),
      this.incomeRuleContext(),
    );
    if (ruleViolation) throw incomeRuleException(ruleViolation);

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
   * (Program catalog → Programs) AND that name must be assigned to the loan
   * category the program is being saved under (Program catalog → Loan
   * categories). Kept out of `validateAgainstRegistry` on purpose: that helper
   * collapses every miss into the generic `UNKNOWN_ENUMERATION_KEY`, and these
   * deserve their own codes so the admin form can point at the right page.
   *
   * Check order is deliberate: unknown and deprecated both win over
   * not-in-category. Telling an operator a name "isn't offered under Mortgage"
   * when the name no longer exists at all sends them to the wrong screen.
   */
  private async assertProgramNameKey(
    programNameKey: string,
    productCategory: string,
    opts: {
      skipProgramNameCategoryCheck?: boolean;
      /**
       * The program's own income basis, from its `programType`. Omitted skips the
       * basis half — the duplicate path passes it, the create/update paths always
       * have it.
       */
      programType?: ProgramType;
      /** The (name, basis) pair is unchanged — see the grandfather note below. */
      skipProgramNameBasisCheck?: boolean;
    } = {},
  ): Promise<void> {
    if (await this.enums.isActiveMember('program_name', programNameKey)) {
      // Grandfathered: the pair is unchanged, so this save is not MOVING the
      // program into an unassigned pair — it is editing a rate or a fee on a
      // program that already sits there. Blocking it would mean an operator's
      // catalog edit silently freezes unrelated programs (`update()` is a
      // full-replacement PUT, so every save re-runs every check).
      if (opts.skipProgramNameCategoryCheck) return;
      const assigned = await this.enums.memberCategories('program_name', programNameKey);
      if (!(assigned as readonly string[]).includes(productCategory)) {
        throw new ProgramNameKeyNotInCategoryException({
          programNameKey,
          productCategory,
          assignedCategories: [...assigned],
        });
      }
      // Then the INCOME BASIS half of the same pairing rule: a no-payslip program
      // may only name a catalog entry sold that way under this loan type, and a
      // payslip program only one sold against a payslip. Checked after the
      // category, and only once that passed — "not offered under Mortgage" and
      // "not sold without a payslip here" send the operator to two different
      // switches, and the first is the one that has to be fixed first.
      //
      // Grandfathered on the same rule and for the same reason: an operator
      // untickings a basis in the catalog must not freeze every program already
      // saved against it.
      const category = asLoanCategory(productCategory);
      if (!opts.programType || opts.skipProgramNameBasisCheck || !category) return;
      const basis = basisOfProgramType(opts.programType);
      const allowed = await this.enums.memberIncomeBases('program_name', programNameKey, category);
      // Empty means the pair carries no basis at all, which the writers make
      // unreachable — but a row predating the column would read that way, and
      // refusing every save on it would strand the program. Unknown is not "no".
      if (allowed.length === 0 || allowed.includes(basis)) return;
      throw new ProgramNameKeyBasisMismatchException({
        programNameKey,
        productCategory,
        basis,
        allowedBases: [...allowed],
      });
    }
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

  // --- Feature 011 — income-rule plumbing ---------------------------------

  /**
   * Registry lookups for the rule validator. Injected rather than imported into the
   * validator so that module stays pure and the rule-CHECK endpoint (US3) can
   * validate an unsaved draft through the same code path.
   */
  private incomeRuleContext(): IncomeRuleValidationContext {
    return {
      isActiveMember: (type, key) =>
        this.enums.isActiveMember(type as Parameters<typeof this.enums.isActiveMember>[0], key),
      activeMembers: async (type) => {
        const members = await this.enums.getActiveMembers(
          type as Parameters<typeof this.enums.getActiveMembers>[0],
        );
        return members.map((m) => m.key);
      },
    };
  }

  /**
   * What actually gets persisted for `incomeAssumption`.
   *
   * Two steps, in this order and for different reasons:
   *
   *   1. `stripForeignMethodConfig` — drop configuration belonging to a method other
   *      than the selected one (FR-011), so the stored blob says what the form shows.
   *      It deliberately declines to strip when the save carries NO canonical shape
   *      for the selected method, which is the mis-typed-seed case: three seeded
   *      programs hold a legacy table under a type that hides it, and stripping
   *      would destroy them on the first unrelated save.
   *   2. `normalizeIncomeAssumption` — write the CANONICAL shape (FR-014), so the
   *      legacy shapes converge to one truth as programs are saved, without a
   *      migration and without the engine keeping two readers.
   */
  private persistableIncomeAssumption(
    dto: CreateBankProgramDto | UpdateBankProgramDto,
  ): IncomeAssumptionConfig {
    const stripped = stripForeignMethodConfig(
      dto.incomeAssumption as unknown as IncomeAssumptionConfig,
    );
    return normalizeIncomeAssumption(stripped);
  }

  /** FR-001 edge case + FR-013 — reported, never a rejection. */
  private incomeRuleWarnings(args: {
    dto: CreateBankProgramDto | UpdateBankProgramDto;
    persisted: IncomeAssumptionConfig;
  }): Array<{ code: string; meta?: Record<string, unknown> }> {
    const warnings = collectIncomeRuleWarnings({
      config: args.persisted,
      programType: args.dto.programType,
      productCategory: args.dto.productCategory,
      programRequiredDocuments: args.dto.requiredDocuments ?? [],
    });
    return warnings.map(toWarningPayload);
  }

  // --- Response mapping ---------------------------------------------------

  private toResponse(
    program: Awaited<ReturnType<BankProgramRepository['create']>>,
    deprecatedKeys: DeprecatedKeyDescriptor[],
    extra: {
      warnings?: Array<{ code: string; meta?: Record<string, unknown> }>;
      deactivatedByEstimate?: boolean;
    } = {},
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
      // FR-014 — the admin form NEVER sees a legacy blob. Normalizing on the way out
      // (as well as on the way in) means a program written before this feature opens
      // in the new editors correctly without having been re-saved first; without it
      // the form would render an empty table over a rule that is really there, and
      // the next save would persist that emptiness.
      incomeAssumption: normalizeIncomeAssumption(
        program.incomeAssumption as unknown as IncomeAssumptionConfig,
      ) as unknown as Record<string, unknown>,
      fees: program.fees as Record<string, unknown>,
      valueSources: (program.valueSources ?? {}) as Record<string, 'team_estimated'>,
      deprecatedKeys,
      warnings: extra.warnings ?? [],
      ...(extra.deactivatedByEstimate ? { deactivatedByEstimate: true } : {}),
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
          programType: r.programType as BankProgramListRowDto['programType'],
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
    // FR-021 — reported on the READ, not only after a save: a rule that has gone
    // stale did so because someone edited the REGISTRY, on a different screen,
    // possibly months ago. The admin has to see it when they open the program,
    // before a customer meets it.
    const warnings = await this.incomeRuleReadWarnings(program);
    return this.toResponse(program, deprecatedKeys, { warnings });
  }

  /**
   * Warnings a plain READ of one program can raise about its income rule.
   *
   * Two kinds, both non-blocking:
   *
   *   - the rule is configured but this program's type/category hides it (FR-001
   *     edge case) — the same check the save path runs, repeated here so the
   *     condition is visible without editing anything;
   *   - `dead_registry_key`: a saved `keyTable` row names a key the registry no
   *     longer carries (FR-021 edge case). This one lives HERE rather than in the
   *     questionnaire's publish warnings because it is per-program and its fix is
   *     per-program: open this program, re-pick that row.
   */
  private async incomeRuleReadWarnings(
    program: Awaited<ReturnType<BankProgramRepository['create']>>,
  ): Promise<Array<{ code: string; meta?: Record<string, unknown> }>> {
    const rule = normalizeIncomeAssumption(
      program.incomeAssumption as unknown as IncomeAssumptionConfig,
    );
    const warnings = collectIncomeRuleWarnings({
      config: rule,
      programType: program.programType,
      productCategory: program.productCategory,
      programRequiredDocuments: program.requiredDocuments,
    }).map(toWarningPayload);

    const registry =
      KEY_TABLE_REGISTRY[rule.strategy as (typeof KEY_TABLE_STRATEGIES)[number]] ?? null;
    if (registry === null || !rule.keyTable?.length) return warnings;

    const active = new Set(
      (
        await this.enums.getActiveMembers(
          registry as Parameters<PlatformEnumerationsRepository['getActiveMembers']>[0],
        )
      ).map((m) => m.key),
    );
    for (const row of rule.keyTable) {
      if (active.has(row.key)) continue;
      warnings.push({
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: {
          reason: 'dead_registry_key',
          programCode: program.programCode,
          registry,
          key: row.key,
        },
      });
    }
    return warnings;
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

    // Fetched BEFORE the cross-config pass so the catalog-assignment check can
    // be skipped when the (name, category) pair is untouched — see
    // `assertProgramNameKey`. The rule is "you may not MOVE a program into an
    // unassigned pair", not "you may not save one that is already there".
    const existing = await this.repo.findByProgramCode(programCode);
    if (!existing) {
      throw new BankProgramNotFoundException({ programCode });
    }
    const persistedRule = this.persistableIncomeAssumption(dto);
    await this.runCrossConfigChecks(dto, {
      skipProgramNameCategoryCheck:
        dto.programNameKey === existing.programNameKey &&
        dto.productCategory === existing.productCategory,
      // The basis half grandfathers on (name, basis), not (name, category): moving
      // a program to another loan type does not change how it proves income, and
      // an unchanged pair here is a save that is not adopting a new basis.
      skipProgramNameBasisCheck:
        dto.programNameKey === existing.programNameKey &&
        dto.programType === existing.programType,
      incomeAssumption: persistedRule,
    });

    const warnings = this.incomeRuleWarnings({ dto, persisted: persistedRule });

    // Feature 011 — the value-source markers (FR-032 … FR-035).
    //
    // Validated against the INCOMING configuration, not the stored one: the admin
    // marks a number in the same save that introduces it, and checking against the
    // database would reject the first marker on every new field.
    const markerConfig = { ...dto, incomeAssumption: persistedRule };
    // The STORED configuration is passed too, so a marker whose row this save deletes
    // is recognised as stale rather than unknown. Without it the rejection below fired
    // first and `pruneValueSources` could never run — the admin was left with a marker
    // whose control had disappeared with its row, and a program that would never save
    // again.
    throwOnValueSourceViolation(
      validateValueSources(dto.valueSources, markerConfig, {
        // NORMALIZED, because that is the shape the admin form was given (`toResponse`
        // normalizes on the way out) and therefore the shape its marker paths address.
        previousConfig: {
          ...(existing as unknown as MarkableProgramConfig),
          incomeAssumption: normalizeIncomeAssumption(
            existing.incomeAssumption as unknown as IncomeAssumptionConfig,
          ),
        },
      }),
    );
    // ABSENT means "leave the stored map alone", NOT "clear it".
    //
    // `valueSources` is the one optional field on an otherwise full-replacement PUT, so
    // a client that never learned about it — a script, an older admin build mid-deploy,
    // a partial-update integration — used to erase every marker on the program by
    // saying nothing. That silently opened the activation gate: `toggle()` reads the
    // STORED map, found it empty, and let an unconfirmed number go live (FR-033). An
    // omitted field must never be the most destructive input a request can carry.
    //
    // When it IS sent it is pruned AFTER validation: deleting a table row that carried
    // a marker is a legal edit, and refusing it would trap the admin — the only escape
    // would be to un-mark a number they can no longer see.
    const persistedSources =
      dto.valueSources === undefined
        ? ((existing.valueSources ?? {}) as ValueSourceMap)
        : pruneValueSources(dto.valueSources, markerConfig);

    // FR-035 — introducing an estimate on a LIVE program switches it off, in the SAME
    // transaction as the save. Only NEWLY added markers count: re-saving a program
    // that already carried one must not keep re-deactivating it, or editing an
    // unrelated field on a known-unconfirmed program would fight the gate every time.
    const addedEstimates = newlyEstimatedPaths({
      before: existing.valueSources,
      after: persistedSources,
    });
    const deactivatedByEstimate = existing.active && addedEstimates.length > 0;

    // FR-038 — every marker change is audited with the editor's identity. Computed
    // here so the event names exactly what moved rather than the whole map.
    const stillEstimated = new Set(estimatedPaths(persistedSources));
    const removedEstimates = estimatedPaths(existing.valueSources).filter(
      (path) => !stillEstimated.has(path),
    );

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
          incomeAssumption: persistedRule,
          fees: dto.fees,
          valueSources: persistedSources,
          // The forced deactivation rides on the SAME compare-and-swap write as the
          // save (FR-035). A second update would leave a window in which the program
          // is live with a number nobody has confirmed — which is the exact state the
          // gate exists to make impossible.
          ...(deactivatedByEstimate ? { active: false } : {}),
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

      // FR-038 — one event per marker change, carrying the editor and the paths.
      // Append-only audit (Principle VI), not a feed for a screen: "who marked this,
      // and when" has to be answerable after the fact, and only an event answers it.
      if (addedEstimates.length > 0 || removedEstimates.length > 0) {
        await this.audit.create(
          {
            actorId: actor.id,
            targetId: null,
            bankProgramId: next.id,
            eventType: AuditEventType.BANK_PROGRAM_VALUE_SOURCE_CHANGED,
            sourceIp: actor.sourceIp,
            payload: {
              programCode: next.programCode,
              added: addedEstimates,
              removed: removedEstimates,
            },
          },
          tx,
        );
      }

      // FR-035 — recorded separately from an ordinary toggle so "why did this go
      // dark?" names the paths and the editor instead of reading as a flipped switch.
      if (deactivatedByEstimate) {
        await this.audit.create(
          {
            actorId: actor.id,
            targetId: null,
            bankProgramId: next.id,
            eventType: AuditEventType.BANK_PROGRAM_DEACTIVATED_BY_ESTIMATE,
            sourceIp: actor.sourceIp,
            payload: {
              programCode: next.programCode,
              paths: addedEstimates,
            },
          },
          tx,
        );
      }

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
    return this.toResponse(updated, deprecatedKeys, { warnings, deactivatedByEstimate });
  }

  // --- INCOME RULE CHECK (feature 011, US3) --------------------------------

  /**
   * Run a sample applicant against the ON-SCREEN income rule (FR-026 – FR-031).
   *
   * Persists NOTHING — no application, no lead, no offer (FR-029).
   *
   * The parity guarantee (FR-030 / SC-007) is STRUCTURAL, not asserted: this loads
   * the saved program's snapshot, overlays only the draft `incomeAssumption`, and
   * calls the SAME `quoteProgram` the admin simulator and the customer preview call.
   * Any second implementation of "income → DBR → affordable installment → max loan"
   * would be a divergence waiting to happen — v13.0.0 recorded that lesson when
   * preview and apply derived the asked set differently.
   */
  async checkIncomeRule(
    programCode: string,
    dto: IncomeRuleCheckDto,
  ): Promise<IncomeRuleCheckResponseDto> {
    const program = await this.repo.findByProgramCode(programCode);
    if (!program) throw new BankProgramNotFoundException({ programCode });

    // The SAME validator the save path runs. A rule that could not be saved must not
    // silently "work" here, or the panel would be reassuring the admin about a
    // configuration the server is about to reject (contracts § 2).
    const draft = normalizeIncomeAssumption(
      dto.incomeAssumption as unknown as IncomeAssumptionConfig,
    );
    const violation = await validateIncomeRule(draft, this.incomeRuleContext());
    if (violation) throw incomeRuleException(violation);

    const snapshot: BankProgramSnapshot = {
      ...toBankProgramSnapshot(program),
      // The overlay, and the ONLY thing overlaid: pricing, fees, tenor, limits and
      // the DBR band table all stay as saved, so the figures the panel shows are this
      // program's figures rather than a hypothetical program's.
      incomeAssumption: draft,
      // Forced so an INACTIVE program can still be checked. An admin configures a
      // rule precisely while the program is off — refusing to check it then would
      // make the panel useless exactly when it is needed (and `quoteProgram` does
      // not read `active` anyway; this keeps the snapshot honest).
      active: true,
      // Feature 011 exists for surrogate rules, and `quoteProgram` only consults the
      // rule for this type. Checking a rule on a program still typed `income_proof`
      // must show what the rule DOES, not what the program's type currently ignores —
      // the mis-typed seeds are exactly that case, and the save path already warns
      // about it separately.
      programType: 'income_surrogate',
    };

    const profile = this.sampleProfile(dto.sample);
    // Resolved once and handed to the quote. The panel reports the provenance AND the
    // figures, and running the resolver twice over the same draft is both wasted work
    // (it re-normalizes the blob and re-resolves the DBR cap) and a second chance for
    // the two halves of one screen to disagree.
    const resolution = resolveAssumedIncome({
      profile,
      income: draft,
      eligibility: snapshot.eligibility,
    });
    const outcome = quoteProgram({ profile, program: snapshot, incomeResolution: resolution });

    if (!outcome.ok) {
      return {
        // `null`, never `'0'` (FR-031).
        resolvedIncomeEGP: null,
        origin: resolution.origin,
        ...(resolution.unresolvedReason ? { unresolvedReason: resolution.unresolvedReason } : {}),
        dbrCapPercent: resolution.dbrCapPercent.toFixed(4),
        dbrCapSource: resolution.dbrCapSource,
        affordableInstallmentEGP: null,
        estimatedLoanAmountEGP: null,
        qualifies: false,
        unavailableReason: outcome.unavailable.reason,
        ...(resolution.matchedRow ? { matchedRow: resolution.matchedRow } : {}),
      };
    }

    const { quote } = outcome;
    // The most this income supports at this program's cap, from the quote's own
    // figures: income × cap ÷ 100 − obligations. Not a second formula — the same
    // expression `quoteProgram` uses internally to decide whether to shrink an offer.
    const affordableInstallment = quote.recognisedIncomeEGP
      .mul(quote.dbrCapPercent)
      .div(100)
      .minus(profile.obligations.existingMonthlyObligationsEGP);

    return {
      resolvedIncomeEGP: quote.recognisedIncomeEGP.toFixed(2),
      origin: quote.incomeResolution?.origin ?? resolution.origin,
      dbrCapPercent: quote.dbrCapPercent.toFixed(4),
      dbrCapSource: quote.dbrCapSource,
      affordableInstallmentEGP: affordableInstallment.greaterThan(0)
        ? affordableInstallment.toFixed(2)
        : '0.00',
      estimatedLoanAmountEGP: quote.maxAffordableAmountEGP.toFixed(2),
      // Derived from the quote's OWN figures only — no eligibility rule is consulted,
      // so gating cannot re-enter the platform through this panel (FR-027, A33).
      // `offeredAmountEGP` is what the applicant would actually be offered after the
      // program ceiling and the affordability loop; if it still covers what they
      // asked for, the rule supports the request.
      qualifies:
        quote.offeredAmountEGP.greaterThan(0) &&
        quote.cashToCustomerEGP.greaterThanOrEqualTo(profile.requestedAmountEGP),
      ...(quote.incomeResolution?.matchedRow
        ? { matchedRow: quote.incomeResolution.matchedRow }
        : resolution.matchedRow
          ? { matchedRow: resolution.matchedRow }
          : {}),
    };
  }

  /**
   * The sample applicant, as an `ApplicantProfile`.
   *
   * Every fact is passed through EXACTLY as typed — the panel is a dry run of what a
   * real applicant would get, so approximating here would make FR-030 parity a
   * coincidence. Absent facts stay `undefined`, which is what lets an admin
   * deliberately reproduce the `SURROGATE_FACT_MISSING` outcome.
   */
  private sampleProfile(sample: IncomeRuleCheckDto['sample']): ApplicantProfile {
    const dec = (v?: string): Decimal | undefined => (v !== undefined ? new Decimal(v) : undefined);
    return {
      age: sample.age,
      loanPurpose: 'personal',
      requestedAmountEGP: new Decimal(sample.requestedAmountEGP),
      requestedCurrency: 'EGP',
      preferredTenorMonths: sample.tenorMonths,
      priority: 'lowest_installment',
      employment: {
        employmentType: 'salaried',
        monthlyNetSalaryEGP: new Decimal(sample.declaredMonthlySalaryEGP ?? '0'),
        monthsInJob: sample.monthsInJob ?? 0,
        yearsInPractice: sample.yearsInPractice,
        professorRank: sample.professorRank,
        militaryGrade: sample.militaryGrade,
        salaryTransferType: 'payroll',
        companyName: '',
        companyType: '',
      },
      obligations: {
        existingMonthlyObligationsEGP: new Decimal(sample.existingMonthlyObligationsEGP),
        hasCurrentLoan: new Decimal(sample.existingMonthlyObligationsEGP).greaterThan(0),
        hasPreviousRejection: false,
      },
      assets: {
        cdAtABKValueEGP: dec(sample.cdValueEGP),
        totalDepositsAtABKValueEGP: dec(sample.totalDepositsEGP),
        bankStatementBalanceEGP: dec(sample.bankStatementBalanceEGP),
        creditCardLimitEGP: dec(sample.creditCardLimitEGP),
        carInstallmentEGP: dec(sample.carInstallmentEGP),
        autoLoanAtOtherBankEGP: dec(sample.carLoanAmountEGP),
      },
    };
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

    // FR-033 — a program holding team-estimated numbers cannot GO LIVE.
    //
    // Only on the way ON: switching a program OFF is never blocked (FR-034), because
    // the whole point of the marker is that the team can keep working on a program
    // they have not confirmed with the bank. Blocking the off-switch would also trap
    // an already-live program that a save had just flagged.
    //
    // Every path is named, not the first: the admin has ONE conversation with the
    // bank, and revealing the numbers one at a time costs a round trip each.
    if (active) {
      const paths = estimatedPaths(existing.valueSources);
      if (paths.length > 0) throw new ProgramHasEstimatedValuesException({ paths });
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

// --- Feature 011 — violation → typed exception -----------------------------

/**
 * One place mapping rule violations to typed exceptions, so the save path and the
 * US3 rule-check endpoint reject an identical draft identically. Two mappers would
 * be two vocabularies, and the panel's whole promise is that a rule which cannot be
 * saved does not silently "work" there (contracts § 2).
 */
function incomeRuleException(violation: IncomeRuleViolation): Error {
  switch (violation.kind) {
    case 'empty':
      return new IncomeRuleEmptyException({ strategy: violation.strategy });
    case 'incomeInvalid':
      return new IncomeRuleIncomeInvalidException({
        ...(violation.index !== undefined ? { index: violation.index } : {}),
        ...(violation.key !== undefined ? { key: violation.key } : {}),
        incomeEGP: violation.incomeEGP,
      });
    case 'duplicateKey':
      return new IncomeRuleDuplicateKeyException({ key: violation.key });
    case 'unknownKey':
      return new IncomeRuleUnknownKeyException({
        key: violation.key,
        registry: violation.registry,
        activeKeys: violation.activeKeys,
      });
    case 'bandsInvalid':
      return new IncomeRuleBandsInvalidException({
        index: violation.index,
        reason: violation.reason,
      });
    case 'dbrOverrideInvalid':
      return new IncomeRuleDbrOverrideInvalidException({ value: violation.value });
  }
}

/**
 * Marker violation → its own typed exception.
 *
 * Two codes, not one: a path this program has never carried and a value that is not
 * `team_estimated` are different mistakes with different fixes, and collapsing them
 * told the admin to reload a program whose paths were all fine.
 */
function throwOnValueSourceViolation(violation: ValueSourceViolation | undefined): void {
  if (!violation) return;
  if (violation.kind === 'invalidValue') {
    throw new ValueSourceValueInvalidException({ path: violation.path, value: violation.value });
  }
  throw new ValueSourcePathUnknownException({ path: violation.path });
}

/** Warning → the `{ code, meta }` payload the admin resolves through i18n (A22). */
function toWarningPayload(warning: IncomeRuleWarning): {
  code: string;
  meta?: Record<string, unknown>;
} {
  switch (warning.kind) {
    case 'ruleIgnoredForProgramType':
      return {
        // Reuses the surrogate-binding code rather than minting a twelfth: both say
        // "this income rule will not be read as configured", and the meta's `reason`
        // is what tells the admin which fix applies.
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: {
          reason: 'rule_ignored_for_program_type',
          programType: warning.programType,
          productCategory: warning.productCategory,
          strategy: warning.strategy,
        },
      };
    case 'requiredDocumentsMissing':
      return {
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: { reason: 'required_documents_missing', missing: warning.missing },
      };
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
