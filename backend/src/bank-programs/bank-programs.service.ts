import { Injectable } from '@nestjs/common';
import type { BankProgramType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../infra/prisma/prisma.service';
import { AuditEventType } from '../common/audit/audit-event-types';
import { AuditEventRepository } from '../audit/audit-event.repository';
import {
  PlatformEnumerationsRepository,
  type ProgramNameIncomeRuleRow,
  type ProgramUnderName,
} from '../platform-enumerations/platform-enumerations.repository';
import {
  SetProgramNameIncomeRuleDto,
  type ProgramNameIncomeRuleResponseDto,
} from './dto/program-name-income-rule.dto';
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
  IncomeRuleFactUnavailableException,
  ProductRuleInvalidException,
  IncomeRuleDuplicateKeyException,
  IncomeRuleEmptyException,
  IncomeRuleIncomeInvalidException,
  IncomeRuleUnknownKeyException,
  ProgramRangeInvalidException,
  InvalidQualitativeReviewCeilingException,
  InvalidVariableRateConfigurationException,
  NoneTransferUnsafeException,
  ProgramCodeAlreadyInUseException,
  ProgramNameKeyNotInCategoryException,
  ProgramNameIncomeProofMismatchException,
  ProgramNameIncomeProofMissingException,
  IncomeProofInUseException,
  ProgramHasEstimatedValuesException,
  ProgramNameKeyUnknownException,
  ValueSourcePathUnknownException,
  ValueSourceValueInvalidException,
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
import {
  catalogIncomeRulePaths,
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
import {
  effectiveIncomeRule,
  stripCatalogStructure,
  stripInheritedAmounts,
} from '@/matching/pipeline/income-rule-inherit';
import { quoteProgram } from '@/matching/pipeline/quote';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import { toBankProgramSnapshot } from './bank-program-snapshot.mapper';
import {
  IncomeRuleCheckDto,
  IncomeRuleDraftCheckDto,
  type IncomeRuleCheckResponseDto,
} from './dto/income-rule-check.dto';
import {
  KEY_TABLE_REGISTRY,
  KEY_TABLE_STRATEGIES,
  factKeyOf,
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
/**
 * Stands in for the identity fields a DRAFT program has not got.
 *
 * A quote reads none of them, but the snapshot type requires all four, and a blank string
 * in a log line reads as data loss. This says what it is.
 */
const DRAFT_PROGRAM_SENTINEL = '(draft)';

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
    // A marker no longer decides whether a new program is born live: the control that
    // set one is gone from both screens, so this could only ever have been triggered by
    // an API caller — and would have created an inactive program for a reason no operator
    // could see or clear.
    const createdWithEstimates = false;

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
      // source's name and category is not moving anything.
      skipProgramNameCategoryCheck: programNameKey === source.programNameKey,
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
      /**
       * The income proof this program already had under this same name. Present only
       * on `update()`, and only to grandfather an UNCHANGED pair — see
       * `assertIncomeProofMatchesName`.
       */
      storedIncomeProof?: string;
    } = {},
  ): Promise<void> {
    // A program names one predefined program from the catalog, never free text.
    await this.assertProgramNameKey(dto.programNameKey, dto.productCategory, opts);
    const persistedRule =
      opts.incomeAssumption ??
      this.persistableIncomeAssumption(dto as CreateBankProgramDto | UpdateBankProgramDto);
    // One name, one income proof.
    await this.assertIncomeProofMatchesName({
      programNameKey: dto.programNameKey,
      programType: dto.programType,
      strategy: persistedRule.strategy,
      storedIncomeProof: opts.storedIncomeProof,
    });
    // Nothing constrains the income BASIS (v16.4.0). No category implies it (v16.0.0),
    // and the catalog name no longer carries a payslip / no-payslip tick either: the
    // bank picks it on this program (`programType`), which is the only place it is
    // stated. The catalog counts what banks picked and enforces nothing.

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
      const baseMax = dto.loanLimits.maxAmountEGP;
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
    //
    // Validated as the ENGINE will see it: a program on catalog amounts stores no
    // table of its own, so validating the persisted blob would report `INCOME_RULE_EMPTY`
    // for the case the screen defaults to. The merge is also what makes the check
    // meaningful — a catalog table with a dead key must fail the bank's save too,
    // because it is the bank's quote that breaks.
    const ruleViolation = await validateIncomeRule(
      effectiveIncomeRule(persistedRule, await this.catalogIncomeRuleFor(dto.programNameKey)),
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
    opts: { skipProgramNameCategoryCheck?: boolean } = {},
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
      return;
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

  /**
   * ONE catalog program name states ONE income proof, and every surrogate program
   * filed under it reads that one. A bank wanting a different proof is selling a
   * different product and needs a different name; what a bank may change is the
   * FIGURES.
   *
   * Scoped to `income_surrogate` deliberately. A payslip program is quoted off the
   * salary the applicant declared and reaches the rule only when there is none, so
   * holding it to the name's proof would reject saves no quote depends on — and the
   * catalog is full of names carrying both kinds (`doctor` has two surrogate programs
   * and one payslip car program).
   *
   * Two ways to fail, and they send the operator to different screens: the name says
   * nothing yet (fix the catalog) or it says something else (fix one of the two).
   */
  /**
   * A no-payslip program cannot GO LIVE unless its catalog name states the proof it reads.
   *
   * The save-time check (`assertIncomeProofMatchesName`) deliberately grandfathers an
   * unchanged (name, proof) pair, because `update()` is a full-replacement PUT and refusing
   * it would make the fixing save the failing save — a program that predates the rule would
   * be frozen out of every edit, including the one that would fix it. That mercy is right
   * for an edit and wrong for a customer: whatever an operator is allowed to keep working
   * on, a program quoting to the public must actually have a table behind it.
   *
   * So the same two refusals are checked again here, where nothing is grandfathered. Same
   * codes, deliberately — the operator's problem and its fix are identical, and a second
   * error code for one sentence is a second thing to translate and keep in step (A25).
   *
   * ON the way on only. Switching a program OFF is never refused, for the same reason
   * FR-034 gives above: the off-switch is how an operator responds to a problem.
   */
  private async assertActivatable(existing: {
    programType: string;
    programNameKey: string | null;
    incomeAssumption: unknown;
  }): Promise<void> {
    // A payslip program consults no proof, so its name states none and none is required.
    if (existing.programType !== 'income_surrogate') return;

    // No name at all is the same problem one step earlier, and the same sentence answers
    // it: there is nothing stating what this program reads its income from.
    const programNameKey = existing.programNameKey;
    if (programNameKey === null) {
      throw new ProgramNameIncomeProofMissingException({ programNameKey: '' });
    }

    const catalogRule = await this.catalogIncomeRuleFor(programNameKey);
    if (catalogRule === undefined) {
      throw new ProgramNameIncomeProofMissingException({ programNameKey });
    }
    const strategy = normalizeIncomeAssumption(
      existing.incomeAssumption as IncomeAssumptionConfig,
    )?.strategy;
    if (strategy === undefined || catalogRule.strategy !== strategy) {
      throw new ProgramNameIncomeProofMismatchException({
        programNameKey,
        expected: catalogRule.strategy,
        got: strategy ?? 'none',
      });
    }
  }

  private async assertIncomeProofMatchesName(args: {
    programNameKey: string;
    programType: BankProgramType;
    strategy: string;
    storedIncomeProof?: string;
  }): Promise<void> {
    if (args.programType !== 'income_surrogate') return;
    // Grandfathered: this save changes neither the name nor the proof, so it is not
    // MOVING the program onto a proof it may not read — it is editing a rate or a fee
    // on a program that already reads it. `update()` is a full-replacement PUT, so
    // every save re-runs every check, and without this a program that predates the
    // rule would be frozen out of every edit including the one that would fix it.
    if (args.storedIncomeProof === args.strategy) return;

    const catalogRule = await this.catalogIncomeRuleFor(args.programNameKey);
    if (catalogRule === undefined) {
      throw new ProgramNameIncomeProofMissingException({ programNameKey: args.programNameKey });
    }
    if (catalogRule.strategy !== args.strategy) {
      throw new ProgramNameIncomeProofMismatchException({
        programNameKey: args.programNameKey,
        expected: catalogRule.strategy,
        got: args.strategy,
      });
    }
  }

  /** One name's catalog rule, or `undefined` when the name states none. */
  private async catalogIncomeRuleFor(
    programNameKey: string,
  ): Promise<IncomeAssumptionConfig | undefined> {
    return (await this.enums.programNameIncomeRules()).get(programNameKey);
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
      surrogateFacts: () => this.enums.surrogateFactRegistry(),
      questionOptionCodes: (questionCode) => this.enums.questionOptionCodes(questionCode),
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
   *   3. `stripCatalogStructure` — the catalog's own half of a product rule never
   *      reaches the program row; see the note at the call.
   *   4. `stripInheritedAmounts` — a program on CATALOG amounts stores none of its
   *      own. Without this the screen's pre-filled copy would be persisted, and the
   *      program would keep quoting those figures after the catalog moved: the
   *      inheritance would be a one-time copy wearing the label of a link.
   */
  private persistableIncomeAssumption(
    dto: CreateBankProgramDto | UpdateBankProgramDto,
  ): IncomeAssumptionConfig {
    const stripped = stripForeignMethodConfig(
      dto.incomeAssumption as unknown as IncomeAssumptionConfig,
    );
    // 4. `stripCatalogStructure` — a product rule's steps / gates / output belong to the
    //    catalog NAME. The wizard posts back the merged object it was rendering, which is
    //    right for the screen and wrong to keep: stored, the link becomes a one-time copy
    //    and the bank keeps running a pipeline the catalog has since changed.
    return stripCatalogStructure(stripInheritedAmounts(normalizeIncomeAssumption(stripped)));
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
      incomeAssumption: persistedRule,
      // The proof this program already reads under this same name. Handed over only
      // when the NAME is unchanged: moving a program to another name is exactly the
      // case the proof check exists for, and a stored proof carried across that move
      // would wave it through.
      ...(dto.programNameKey === existing.programNameKey
        ? {
            storedIncomeProof: normalizeIncomeAssumption(
              existing.incomeAssumption as unknown as IncomeAssumptionConfig,
            ).strategy,
          }
        : {}),
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
    // FR-035's auto-deactivation is gone with the marker control. It took a LIVE program
    // off air the moment a save introduced a guessed number — correct while an operator
    // could mark and unmark one, and a program silently going dark for an invisible reason
    // now that they cannot.
    const deactivatedByEstimate = false;

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

  // --- CATALOG PROGRAM NAME: the ONE income proof --------------------------

  /** Read a catalog name's rule, and who is reading it. */
  async getProgramNameIncomeRule(
    programNameKey: string,
  ): Promise<ProgramNameIncomeRuleResponseDto> {
    const name = await this.enums.findProgramName(programNameKey);
    if (!name) {
      const active = await this.enums.getActiveMembers('program_name');
      throw new ProgramNameKeyUnknownException({
        programNameKey,
        activeKeys: active.map((m) => m.key),
      });
    }
    return this.toProgramNameIncomeRuleResponse(name);
  }

  /**
   * Set (or clear) what a catalog program name reads its income from, and the figures
   * every bank filed under it starts from.
   *
   * Three refusals, in this order, because they send the operator to different places:
   *
   *   1. the rule itself does not validate — the SAME `validateIncomeRule` the bank's
   *      own save runs, so a table the catalog accepts can never be one a program is
   *      then refused for
   *   2. the PROOF is changing while surrogate programs read the old one
   *      (`INCOME_PROOF_IN_USE`) — their tables are keyed by it, so letting this
   *      through would leave live programs quoting rows no applicant can match, with
   *      nothing on screen to say it happened
   *   3. the rule is being CLEARED while programs still take its figures — same
   *      refusal, because inheriting from nothing is how a configured program starts
   *      resolving `rule_unconfigured`
   *
   * Order 1 before 2 is deliberate: an operator fixing a typo in a table should get the
   * typo back, not a lecture about who else reads the proof.
   */
  async setProgramNameIncomeRule(
    programNameKey: string,
    dto: SetProgramNameIncomeRuleDto,
    actor: { id: string; sourceIp: string | null },
  ): Promise<ProgramNameIncomeRuleResponseDto> {
    const name = await this.enums.findProgramName(programNameKey);
    if (!name) {
      const active = await this.enums.getActiveMembers('program_name');
      throw new ProgramNameKeyUnknownException({
        programNameKey,
        activeKeys: active.map((m) => m.key),
      });
    }

    // `amounts` is dropped rather than rejected: it says whose figures a BANK PROGRAM
    // uses, and a name's figures are its own by definition. A client that sends it is
    // being redundant, not wrong.
    const incoming = dto.incomeRule as unknown as IncomeAssumptionConfig | null;
    let rule: IncomeAssumptionConfig | null = null;
    if (incoming !== null) {
      rule = normalizeIncomeAssumption(stripForeignMethodConfig(incoming));
      delete rule.amounts;
    }

    if (rule !== null) {
      // A catalog name states the STRUCTURE and, at most, starting figures — the banks under
      // it fill their own in. Held to a bank's completeness standard, the compound frame
      // (four derivations, each one bank's) could never be saved at all.
      const violation = await validateIncomeRule(rule, this.incomeRuleContext(), {
        figuresRequired: false,
      });
      if (violation) throw incomeRuleException(violation);
    }

    const programs = await this.enums.programsUnderName(programNameKey);
    const proofChanged = (name.incomeRule?.strategy ?? null) !== (rule?.strategy ?? null);
    if (proofChanged) {
      // Every surrogate program under the name is affected, not only the ones that
      // typed their own table: a program on catalog amounts would silently start
      // reading a different fact, which is the same break one step further away.
      const blocked = programs.map((p) => p.programCode);
      if (blocked.length > 0) {
        throw new IncomeProofInUseException({ programNameKey, programCodes: blocked });
      }
    }

    // Markers are validated against the INCOMING rule and then pruned to it, exactly as
    // a program's are: the operator marks a figure in the same save that introduces it,
    // and a marker whose row this save deletes is stale rather than unknown.
    const submitted = dto.valueSources ?? {};
    const allowed = catalogIncomeRulePaths(rule);
    const previously = catalogIncomeRulePaths(name.incomeRule);
    for (const [path, value] of Object.entries(submitted)) {
      if (value !== 'team_estimated') {
        throw new ValueSourceValueInvalidException({ path, value: String(value) });
      }
      if (!allowed.has(path) && !previously.has(path)) {
        throw new ValueSourcePathUnknownException({ path });
      }
    }
    const valueSources: Record<string, 'team_estimated'> = {};
    for (const path of Object.keys(submitted)) {
      if (allowed.has(path)) valueSources[path] = 'team_estimated';
    }

    const saved = await this.enums.setProgramNameIncomeRule(
      programNameKey,
      rule,
      valueSources,
      actor.id,
    );
    await this.audit.create({
      // `targetId` is a FK to STAFF_ACCOUNT — it means "the staff member this event was
      // done to", not "the row this event was about". An enumeration id here is a FK
      // violation, which is how the whole save came back INTERNAL_ERROR after the rule
      // had already been written. The name's id travels in the payload, exactly as
      // every other `PLATFORM_ENUMERATION_UPDATED` writer sends it.
      actorId: actor.id,
      targetId: null,
      bankProgramId: null,
      eventType: AuditEventType.PLATFORM_ENUMERATION_UPDATED,
      sourceIp: actor.sourceIp,
      payload: {
        type: 'program_name',
        key: programNameKey,
        id: name.id,
        // Keyed `incomeRule` to match the column and the other assignment axes
        // (`questions.<category>`, `incomeBasis.<category>`). The STRATEGY is written
        // out separately because it is the part a reader of the log cares about — a
        // whole-blob diff buries "this name stopped reading academic rank".
        changes: {
          incomeRule: {
            before: name.incomeRule?.strategy ?? null,
            after: rule?.strategy ?? null,
            figuresChanged:
              JSON.stringify(name.incomeRule ?? null) !== JSON.stringify(rule ?? null),
          },
        },
      },
    });

    return this.toProgramNameIncomeRuleResponse(saved, programs);
  }

  private async toProgramNameIncomeRuleResponse(
    name: ProgramNameIncomeRuleRow,
    programs?: ProgramUnderName[],
  ): Promise<ProgramNameIncomeRuleResponseDto> {
    const under = programs ?? (await this.enums.programsUnderName(name.key));
    return {
      programNameKey: name.key,
      labelAr: name.labelAr,
      labelEn: name.labelEn,
      // Normalized on the way OUT, like a program's rule, so the screen's marker paths
      // address the same shape the engine reads.
      incomeRule: name.incomeRule === null ? null : normalizeIncomeAssumption(name.incomeRule),
      valueSources: name.valueSources,
      programs: under.map((p) => ({ programCode: p.programCode, ownAmounts: p.ownAmounts })),
    };
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
    return this.runIncomeRuleCheck(program, dto);
  }

  /**
   * The same check with no saved program behind it — the CREATE wizard's panel.
   *
   * The wizard used to render the panel and disable its button, because the check needs a
   * rate and a term and there was no row to read them from. So the operator typed an entire
   * grade table and could not learn what it paid until after saving it — which is the one
   * moment the rule stops being cheap to get wrong.
   *
   * The draft's four blobs stand in for the row, and go through `toBankProgramSnapshot` like
   * any other program: a second snapshot builder is exactly the divergence the parity note
   * on `runIncomeRuleCheck` is about, so the draft is shaped INTO a row rather than mapped
   * around one. Nothing is persisted, here or anywhere on this path.
   */
  async checkIncomeRuleDraft(dto: IncomeRuleDraftCheckDto): Promise<IncomeRuleCheckResponseDto> {
    const p = dto.program;
    const draftRow = {
      // Identity a quote never reads, but the snapshot type requires. Named rather than
      // blanked so anything that does surface one of these in a log says "draft" out loud.
      id: DRAFT_PROGRAM_SENTINEL,
      programCode: DRAFT_PROGRAM_SENTINEL,
      bankName: DRAFT_PROGRAM_SENTINEL,
      friendlyName: DRAFT_PROGRAM_SENTINEL,
      bank: null,
      version: 0,
      createdAt: new Date(0),
      requiredDocuments: [],
      performanceCriteria: null,
      programNameKey: p.programNameKey ?? null,
      programType: p.programType,
      productCategory: p.productCategory,
      isShariaCompliant: p.isShariaCompliant ?? false,
      active: true,
      tenor: p.tenor,
      loanLimits: p.loanLimits,
      pricing: p.pricing,
      eligibility: p.eligibility,
      fees: p.fees,
      // Replaced by the draft rule inside `runIncomeRuleCheck` — supplied only so the
      // mapper has the field it expects.
      incomeAssumption: dto.incomeAssumption,
    };
    return this.runIncomeRuleCheck(
      draftRow as unknown as Parameters<typeof toBankProgramSnapshot>[0],
      dto,
    );
  }

  private async runIncomeRuleCheck(
    program: Parameters<typeof toBankProgramSnapshot>[0],
    dto: { incomeAssumption: IncomeRuleCheckDto['incomeAssumption']; sample: IncomeRuleCheckDto['sample'] },
  ): Promise<IncomeRuleCheckResponseDto> {

    // The catalog's figures are merged into the DRAFT before anything reads it. A
    // draft on `amounts: 'catalog'` carries no table of its own, so validating or
    // quoting it as sent would report `rule_unconfigured` for a program that is in
    // fact configured — the panel would fail on exactly the setup the screen defaults
    // to. Merged here rather than in the mapper because the mapper's copy is discarded:
    // the draft REPLACES `incomeAssumption` on the snapshot two statements down.
    const catalogRules = await this.enums.programNameIncomeRules();
    const draft = normalizeIncomeAssumption(
      effectiveIncomeRule(
        dto.incomeAssumption as unknown as IncomeAssumptionConfig,
        program.programNameKey === null ? undefined : catalogRules.get(program.programNameKey),
      ),
    );
    // The SAME validator the save path runs. A rule that could not be saved must not
    // silently "work" here, or the panel would be reassuring the admin about a
    // configuration the server is about to reject (contracts § 2).
    const violation = await validateIncomeRule(draft, this.incomeRuleContext());
    if (violation) throw incomeRuleException(violation);

    const snapshot: BankProgramSnapshot = {
      // No catalog map: whatever income rule the mapper resolves is replaced by the
      // draft below, so reading the catalog twice would be work with no reader.
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

    const profile = this.sampleProfile(dto.sample, draft.strategy);
    // Resolved once and handed to the quote. The panel reports the provenance AND the
    // figures, and running the resolver twice over the same draft is both wasted work
    // (it re-normalizes the blob and re-resolves the DBR cap) and a second chance for
    // the two halves of one screen to disagree.
    // A product rule may ask a lookup value for its registry parent (a compound's
    // category). Read here so the panel reproduces exactly what a quote would do — the
    // panel is the operator's only way to see a `factParentTable` step resolve, and a panel
    // that skipped the map would report `no_matching_row` for a correctly configured rule.
    const parentKeyByValue = await this.enums.enumerationParentKeys();
    const resolution = resolveAssumedIncome({
      profile,
      income: draft,
      eligibility: snapshot.eligibility,
      programBankName: snapshot.bankName,
      parentKeyByValue,
    });
    const outcome = quoteProgram({
      profile,
      program: snapshot,
      incomeResolution: resolution,
      parentKeyByValue,
    });

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
  private sampleProfile(
    sample: IncomeRuleCheckDto['sample'],
    strategy: string,
  ): ApplicantProfile {
    const dec = (v?: string): Decimal | undefined => (v !== undefined ? new Decimal(v) : undefined);
    // A registry fact's sample answer lands under the key the RULE reads, and only
    // there. The shape is decided by what parses, not by a second lookup of the fact's
    // bound question: the resolver reads a choice or a number, and a value that is a
    // clean decimal is a number by every reading either side could make.
    const factKey = factKeyOf(strategy);
    const factValue = sample.factValue;
    const singleFact =
      factKey !== null && factValue !== undefined && factValue !== ''
        ? { [factKey]: sampleFactValue(factValue) }
        : undefined;

    // A STEP PIPELINE reads many facts, so the panel sends them by key. Merged with the
    // single-fact field rather than replacing it: an eleven-method rule reads exactly one
    // fact and its form should not start asking for a key. The keyed map wins on a clash —
    // it is the more specific statement, and the only one that can name what it means.
    const keyedFacts = Object.entries(sample.facts ?? {}).flatMap(([key, raw]) =>
      raw === undefined || raw === '' ? [] : [[key, sampleFactValue(raw)] as const],
    );
    const surrogateFacts =
      singleFact === undefined && keyedFacts.length === 0
        ? undefined
        : { ...(singleFact ?? {}), ...Object.fromEntries(keyedFacts) };
    return {
      age: sample.age,
      loanPurpose: 'personal',
      requestedAmountEGP: new Decimal(sample.requestedAmountEGP),
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
      ...(surrogateFacts ? { surrogateFacts } : {}),
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

    // FR-033's estimated-value block is GONE, by decision.
    //
    // It refused to put a program live while any of its numbers was marked "the team
    // guessed this". The marker was only ever settable on the income-rule tables, and
    // that control has been removed from both screens — so the gate could no longer be
    // cleared by anyone, and the three programs still carrying a stored marker would
    // have been frozen off air permanently.
    //
    // The column, the DTO field and the path validator all stay, so restoring this is a
    // UI change rather than a migration. `PROGRAM_HAS_ESTIMATED_VALUES` keeps its entry
    // in both locale dictionaries for the same reason.
    if (active) {
      await this.assertActivatable(existing);
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
    case 'factUnavailable':
      return new IncomeRuleFactUnavailableException({
        factKey: violation.factKey,
        availableFacts: violation.availableFacts,
      });
    case 'productRuleInvalid':
      return new ProductRuleInvalidException({
        reason: violation.reason,
        ...(violation.stepId !== undefined ? { stepId: violation.stepId } : {}),
        ...(violation.gateId !== undefined ? { gateId: violation.gateId } : {}),
        ...(violation.detail !== undefined ? { detail: violation.detail } : {}),
      });
  }
}

/**
 * One sample answer, read as the resolver will read it.
 *
 * A clean decimal string is a NUMBER; anything else is an option code. Deciding here
 * rather than from the fact's bound question keeps the dry run a pure function of its
 * body — and the two cannot disagree in a way that matters: a numeric fact whose sample
 * is not a number resolves to `no_matching_band` either way, which is the honest answer
 * to "what does this rule do with that".
 */
function sampleFactValue(
  raw: string,
): { kind: 'choice'; optionCode: string } | { kind: 'numeric'; value: Decimal } {
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return { kind: 'numeric', value: new Decimal(raw) };
  }
  return { kind: 'choice', optionCode: raw };
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
