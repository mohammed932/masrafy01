/**
 * Applications service — orchestrates the apply flow.
 *
 *   1. Idempotency replay short-circuit (same key + same body → return cached row).
 *   2. Resolve active programs → hydrate snapshots.
 *   3. Run engine (pure, synchronous).
 *   4. Persist application + offers + audit events in a single transaction.
 *   5. Project to the spec response envelope (PII masked for admin reads).
 */

import { Injectable } from '@nestjs/common';
// Constitution Principle X carve-out: `Prisma.TransactionIsolationLevel` is a
// runtime value (enum-like) required by `$transaction` orchestration — kept here
// as the only allowed Prisma touchpoint in this service. All other former Prisma
// types (Decimal, InputJsonValue, JsonValue) have been replaced by domain
// equivalents from `@prisma/client/runtime/library` (Decimal) and the local
// `JsonValueInput` exported by the repository.
import { Prisma } from '@prisma/client';
import { AuditEventType } from '../common/audit/audit-event-types';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import cuid from 'cuid';
import { PrismaService } from '../infra/prisma/prisma.service';
import {
  ApplicationRepository,
  type CreateBankOfferInput,
  type JsonValueInput,
} from './application.repository';
import { EngineService } from '../matching/engine.service';
import { BankProgramRepository } from '../bank-programs/bank-programs.repository';
import { AuditEventWriter } from '../audit/audit-event.writer';
import {
  IdempotencyKeyMismatchException,
  NotFoundException,
  ForbiddenException,
  BankOfferNotFoundException,
  OfferNotForApplicationException,
  AlreadyProceededException,
  ApplicationNotMatchedException,
} from '../common/errors/domain.exceptions';
import { ScoringEngineVersionService } from '../scoring-versions/scoring-versions.service';
import { StaffAccountRepository } from '@/users/staff-account.repository';
import { loadActiveScoringConfig } from './adapters/active-scoring-config.adapter';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  Offer,
  ScoringConfig,
} from '../matching/types';
import type { ApplyRequestDto } from './dto/apply.dto';
import type {
  ApplyResponse,
  ApprovalProbabilityResponseDto,
  ApprovalTierLiteral,
} from './dto/apply-response.dto';
import { ApplicationStatus } from './dto/enums';

export interface ApplyContext {
  mobileClientId: string;
  idempotencyKey?: string;
  payloadHash?: string | null;
  sourceIp?: string | null;
  /** Constitution v3.0.0 / Principle XIII — the authenticated customer (from
   *  the customer JWT). The mobile API is JWT-only; every apply call carries
   *  a customerId. */
  customerId?: string | null;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ApplicationRepository,
    private readonly engine: EngineService,
    private readonly programsRepo: BankProgramRepository,
    private readonly audit: AuditEventWriter,
    private readonly scoringVersions: ScoringEngineVersionService,
    private readonly staffAccounts: StaffAccountRepository,
  ) {}

  /**
   * Mobile user picks one of the matched offers and proceeds. This is the
   * user-intent gate: until it fires, an application is invisible in the
   * admin triage dashboard. Idempotent for the same (application, offer):
   * a repeat call surfaces ALREADY_PROCEEDED rather than overwriting.
   */
  async selectOffer(input: {
    applicationId: string;
    bankOfferId: string;
    mobileClientId: string;
    sourceIp: string | null;
  }): Promise<{
    applicationId: string;
    bankOfferId: string;
    userProceededAt: string;
    correlationId: string;
  }> {
    const correlationId = randomUUID();
    return this.prisma.$transaction(
      async (tx) => {
        const app = await tx.application.findUnique({
          where: { id: input.applicationId },
          select: {
            id: true,
            mobileClientId: true,
            status: true,
            userProceededAt: true,
            userSelectedBankOfferId: true,
          },
        });
        if (!app) throw new NotFoundException();
        if (app.mobileClientId !== input.mobileClientId) throw new ForbiddenException();
        if (app.status !== 'matched') {
          throw new ApplicationNotMatchedException({
            applicationId: app.id,
            status: app.status,
          });
        }
        if (app.userProceededAt && app.userSelectedBankOfferId) {
          throw new AlreadyProceededException({
            applicationId: app.id,
            userProceededAt: app.userProceededAt.toISOString(),
            userSelectedBankOfferId: app.userSelectedBankOfferId,
          });
        }

        const offer = await tx.bankOffer.findUnique({
          where: { id: input.bankOfferId },
          select: { id: true, applicationId: true, erasedAt: true },
        });
        if (!offer || offer.erasedAt !== null) {
          throw new BankOfferNotFoundException({ bankOfferId: input.bankOfferId });
        }
        if (offer.applicationId !== input.applicationId) {
          throw new OfferNotForApplicationException({
            applicationId: input.applicationId,
            bankOfferId: input.bankOfferId,
          });
        }

        const proceededAt = new Date();
        await tx.application.update({
          where: { id: app.id },
          data: {
            userSelectedBankOfferId: offer.id,
            userProceededAt: proceededAt,
          },
        });

        await this.audit.write(
          {
            actorId: null,
            targetId: app.id,
            eventType: AuditEventType.APPLICATION_USER_PROCEEDED,
            sourceIp: input.sourceIp,
            correlationId,
            payload: {
              applicationId: app.id,
              bankOfferId: offer.id,
              userProceededAt: proceededAt.toISOString(),
            },
          },
          tx,
        );

        return {
          applicationId: app.id,
          bankOfferId: offer.id,
          userProceededAt: proceededAt.toISOString(),
          correlationId,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async assignAgent(input: {
    applicationId: string;
    toAgentStaffId: string;
    reason: string;
    notes: string | null;
    actor: { staffId: string; role: 'super_admin' | 'sales_manager' | 'sales_agent' | 'analyst' };
    correlationId: string;
    sourceIp: string | null;
  }): Promise<{
    applicationId: string;
    activityId: string;
    fromAgentId: string | null;
    toAgentId: string;
    correlationId: string;
  }> {
    const target = await this.staffAccounts.findRoleSummaryById(input.toAgentStaffId);
    if (!target || !target.isActive) throw new NotFoundException();
    if (target.role === 'analyst') throw new ForbiddenException();

    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.application.findUnique({
          where: { id: input.applicationId },
          select: { id: true, assignedAgentStaffId: true },
        });
        if (!existing) throw new NotFoundException();

        const fromAgentId = existing.assignedAgentStaffId;
        await tx.application.update({
          where: { id: input.applicationId },
          data: {
            assignedAgentStaffId: input.toAgentStaffId,
            assignedAt: new Date(),
          },
        });

        const activityId = cuid();
        await tx.activity.create({
          data: {
            id: activityId,
            applicationId: input.applicationId,
            actorStaffId: input.actor.staffId,
            actorRole: input.actor.role,
            activityType: 'LEAD_REASSIGNED',
            reason: input.reason,
            note: input.notes,
            durationMinutes: null,
            outcomeFlags: [],
            followUpAt: null,
            attachedDocumentIds: [],
            meta: {
              fromAgentId: fromAgentId ?? null,
              toAgentId: input.toAgentStaffId,
              reassignReason: input.reason,
            },
            correlationId: input.correlationId,
          },
        });

        await this.audit.write(
          {
            actorId: input.actor.staffId,
            targetId: input.toAgentStaffId,
            eventType: AuditEventType.APPLICATION_REASSIGNED,
            sourceIp: input.sourceIp,
            correlationId: input.correlationId,
            payload: {
              applicationId: input.applicationId,
              activityId,
              fromAgentId: fromAgentId ?? null,
              toAgentId: input.toAgentStaffId,
              reassignReason: input.reason,
            },
          },
          tx,
        );

        return {
          applicationId: input.applicationId,
          activityId,
          fromAgentId,
          toAgentId: input.toAgentStaffId,
          correlationId: input.correlationId,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async apply(dto: ApplyRequestDto, ctx: ApplyContext): Promise<ApplyResponse> {
    const correlationId = randomUUID();

    if (ctx.idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(ctx.mobileClientId, ctx.idempotencyKey);
      if (existing) {
        if (existing.payloadHash && ctx.payloadHash && existing.payloadHash !== ctx.payloadHash) {
          throw new IdempotencyKeyMismatchException({ idempotencyKey: ctx.idempotencyKey });
        }
        return this.toResponse(existing.id, existing, correlationId);
      }
    }

    const activePrograms = await this.programsRepo.findAllActive();
    const snapshots: BankProgramSnapshot[] = activePrograms.map((p) => this.toSnapshot(p));

    const scoringConfig: ScoringConfig = await loadActiveScoringConfig(this.scoringVersions);
    const profile = this.buildProfile(dto);
    const result = this.engine.run({ profile, programs: snapshots, scoringConfig, correlationId });

    const offerInputs: CreateBankOfferInput[] = result.offers.map((o) =>
      this.toOfferInput(o, scoringConfig.version),
    );

    const summaryJson: JsonValueInput = {
      programsCheckedCount: result.programsChecked,
      eligibleProgramsCount: result.eligibleCount,
      engineDurationMs: result.engineDurationMs,
      bestRatePercent: result.offers[0]?.effectiveRatePercent.toFixed(4) ?? null,
      bestInstallmentEGP: result.offers[0]?.monthlyInstallmentEGP.toFixed(2) ?? null,
    };

    const noMatchJson: JsonValueInput | undefined =
      result.status === 'no_match'
        ? (JSON.parse(
            JSON.stringify({
              primaryReason: result.primaryReason ?? null,
              details: result.noMatchDetails ?? [],
              suggestions: result.suggestions ?? [],
            }),
          ) as JsonValueInput)
        : undefined;

    const applicationId = await this.repo.persistMatch({
      application: {
        mobileClientId: ctx.mobileClientId,
        submissionCorrelationId: correlationId,
        idempotencyKey: ctx.idempotencyKey ?? null,
        payloadHash: ctx.payloadHash ?? null,
        status:
          result.status === 'matched' ? ApplicationStatus.matched : ApplicationStatus.no_match,
        priority: dto.priority,
        requestedAmountEGP: new Decimal(dto.requestedAmountEGP),
        requestedCurrency: dto.requestedCurrency ?? 'EGP',
        preferredTenorMonths: dto.preferredTenorMonths,
        loanPurpose: dto.loanPurpose,
        age: dto.age,
        // Authenticated customer overrides DTO `isGuest`. A logged-in mobile
        // user cannot accidentally submit as a guest.
        isGuest: ctx.customerId ? false : (dto.isGuest ?? false),
        applicantUserId: ctx.customerId ?? null,
        applicantProfile: this.profileToJson(profile),
        summary: summaryJson,
        noMatchSummary: noMatchJson,
        engineDurationMs: result.engineDurationMs,
        programsCheckedCount: result.programsChecked,
        eligibleProgramsCount: result.eligibleCount,
      },
      offers: offerInputs,
      txCallback: async (tx, applicationIdInTx) => {
        await this.audit.write(
          {
            actorId: null,
            targetId: null,
            eventType: AuditEventType.APPLICATION_CREATED,
            sourceIp: ctx.sourceIp ?? null,
            correlationId,
            payload: {
              applicationId: applicationIdInTx,
              mobileClientId: ctx.mobileClientId,
              loanPurpose: dto.loanPurpose,
              requestedAmountEGP: dto.requestedAmountEGP,
              requestedCurrency: dto.requestedCurrency ?? 'EGP',
              isGuest: dto.isGuest ?? false,
            },
          },
          tx,
        );
        const bestOffer = result.offers[0];
        await this.audit.write(
          {
            actorId: null,
            targetId: null,
            eventType: AuditEventType.MATCHING_ENGINE_RUN,
            sourceIp: ctx.sourceIp ?? null,
            correlationId,
            payload: {
              applicationId: applicationIdInTx,
              programsCheckedCount: result.programsChecked,
              eligibleProgramsCount: result.eligibleCount,
              durationMs: result.engineDurationMs,
              engineVersion: scoringConfig.version,
              bestOfferScore: bestOffer?.approvalProbability.score ?? null,
              bestOfferTier: bestOffer?.approvalProbability.tier ?? null,
            },
          },
          tx,
        );
        await this.audit.write(
          {
            actorId: null,
            targetId: null,
            eventType:
              result.status === 'matched'
                ? AuditEventType.APPLICATION_MATCHED
                : AuditEventType.APPLICATION_NO_MATCH,
            sourceIp: ctx.sourceIp ?? null,
            correlationId,
            payload: {
              applicationId: applicationIdInTx,
              status: result.status,
              primaryReason: result.primaryReason ?? null,
              offerCount: result.offers.length,
            },
          },
          tx,
        );
      },
    });

    const fresh = await this.repo.findById(applicationId);
    return this.toResponse(applicationId, fresh, correlationId);
  }

  private toResponse(
    applicationId: string,
    row: Awaited<ReturnType<ApplicationRepository['findById']>>,
    correlationId: string,
  ): ApplyResponse {
    if (!row) {
      throw new Error('Application row missing after persist');
    }
    if (row.status === 'matched' && row.bankOffers.length > 0) {
      const sorted = [...row.bankOffers]; // preserved creation order; engine ranking already applied
      const best = sorted[0];
      return {
        success: true,
        data: {
          applicationId,
          correlationId,
          summary: {
            totalProgramsChecked: row.programsCheckedCount,
            eligiblePrograms: row.eligibleProgramsCount,
            bestInstallmentEGP: best ? best.monthlyInstallmentEGP.toFixed(2) : '0.00',
            bestRatePercent: best ? best.effectiveRatePercent.toFixed(4) : '0.0000',
          },
          matchedOffers: sorted.map((o) => ({
            programCode: o.programCode,
            programVersion: o.programVersion,
            bankName: o.bankName,
            bankIsFeatured: o.bankIsFeatured,
            programFriendlyName: o.programFriendlyName,
            currency: o.currency,
            effectiveRatePercent: o.effectiveRatePercent.toFixed(4),
            monthlyInstallmentEGP: o.monthlyInstallmentEGP.toFixed(2),
            requestedLoanAmountEGP: o.requestedLoanAmountEGP.toFixed(2),
            effectiveLoanAmountEGP: o.effectiveLoanAmountEGP.toFixed(2),
            requestedTenorMonths: o.requestedTenorMonths,
            effectiveTenorMonths: o.effectiveTenorMonths,
            approvalProbability: this.projectApprovalProbability(o),
            requiredDocuments: o.requiredDocuments,
            matchReasons: o.matchReasons,
            feesBreakdown: o.feesBreakdown,
            cascadeTrace: o.cascadeTrace,
            qualitativeReviewBadge: o.qualitativeReviewBadge,
            selfDeclared: o.selfDeclared,
            maxLoanAvailableEGP: o.maxLoanAvailableEGP?.toFixed(2),
          })),
        },
      };
    }

    const noMatch = (row.noMatchSummary ?? {}) as {
      primaryReason?: string;
      details?: Array<{ programCode: string; failedChecks: string[] }>;
      suggestions?: Array<{
        code: string;
        magnitude: number;
        programsUnlocked: number;
        suggestedValue?: string;
      }>;
    };
    return {
      success: false,
      code: 'NO_MATCHING_PROGRAMS',
      meta: {
        applicationId,
        correlationId,
        primaryReason: noMatch.primaryReason,
        details: noMatch.details ?? [],
        suggestions: noMatch.suggestions ?? [],
      },
    };
  }

  private toOfferInput(offer: Offer, engineVersion: string): CreateBankOfferInput {
    return {
      programCode: offer.programCode,
      programVersion: offer.programVersion,
      bankName: offer.bankName,
      bankIsFeatured: offer.bankIsFeatured,
      programFriendlyName: offer.programFriendlyName,
      currency: offer.currency,
      effectiveRatePercent: new Decimal(offer.effectiveRatePercent.toString()),
      monthlyInstallmentEGP: new Decimal(offer.monthlyInstallmentEGP.toString()),
      requestedLoanAmountEGP: new Decimal(offer.requestedLoanAmountEGP.toString()),
      effectiveLoanAmountEGP: new Decimal(offer.effectiveLoanAmountEGP.toString()),
      requestedTenorMonths: offer.requestedTenorMonths,
      effectiveTenorMonths: offer.effectiveTenorMonths,
      feesBreakdown: offer.feesBreakdown as unknown as JsonValueInput,
      approvalProbabilityPercent: new Decimal(offer.approvalProbabilityPercent),
      approvalScore: offer.approvalProbability.score,
      approvalTier: offer.approvalProbability.tier,
      approvalFactors: offer.approvalProbability.factors as unknown as JsonValueInput,
      engineVersion,
      requiredDocuments: offer.requiredDocuments,
      matchReasons: offer.matchReasons,
      cascadeTrace: offer.cascadeTrace as unknown as JsonValueInput,
      qualitativeReviewBadge: offer.qualitativeReviewBadge,
      selfDeclared: offer.selfDeclared,
      maxLoanAvailableEGP: offer.maxLoanAvailableEGP
        ? new Decimal(offer.maxLoanAvailableEGP.toString())
        : null,
    };
  }

  /**
   * Project a persisted BankOffer row into the response-side approvalProbability shape
   * defined in feature 004. The factor catalog is NOT looked up here — the API stays
   * locale-agnostic and returns stable codes only. Clients localize via tierLabelCode
   * and the per-offer engine version's factorCatalog (admin only).
   */
  private projectApprovalProbability(row: {
    approvalScore: number;
    approvalTier: string;
    approvalFactors: unknown;
    engineVersion: string;
  }): ApprovalProbabilityResponseDto {
    const tier = row.approvalTier as ApprovalTierLiteral;
    const raw = (row.approvalFactors ?? {}) as {
      positive?: Array<{ code: string; impact: number }>;
      negative?: Array<{ code: string; impact: number }>;
      legacy?: boolean;
    };
    return {
      score: row.approvalScore,
      tier,
      tierLabelCode: `approval.tier.${tier}`,
      factors: {
        positive: raw.positive ?? [],
        negative: raw.negative ?? [],
        ...(raw.legacy === true ? { legacy: true as const } : {}),
      },
      engineVersion: row.engineVersion,
    };
  }

  private profileToJson(profile: ApplicantProfile): JsonValueInput {
    return JSON.parse(
      JSON.stringify(profile, (_k, v) => (v instanceof Decimal ? v.toString() : v)),
    ) as JsonValueInput;
  }

  private toSnapshot(
    p: Awaited<ReturnType<BankProgramRepository['findAllActive']>>[number],
  ): BankProgramSnapshot {
    return {
      id: p.id,
      programCode: p.programCode,
      bankName: p.bankName,
      bankIsFeatured: p.bank?.isFeatured ?? false,
      friendlyName: p.friendlyName,
      programType: p.programType,
      productCategory: p.productCategory,
      currencies: (p.currencies as string[]) ?? [],
      active: p.active,
      version: p.version,
      requiredDocuments: (p.requiredDocuments as string[]) ?? [],
      createdAt: p.createdAt,
      tenor: p.tenor as unknown as BankProgramSnapshot['tenor'],
      loanLimits: p.loanLimits as unknown as BankProgramSnapshot['loanLimits'],
      pricing: p.pricing as unknown as BankProgramSnapshot['pricing'],
      eligibility: p.eligibility as unknown as BankProgramSnapshot['eligibility'],
      incomeAssumption: p.incomeAssumption as unknown as BankProgramSnapshot['incomeAssumption'],
      fees: p.fees as unknown as BankProgramSnapshot['fees'],
      performanceCriteria: p.performanceCriteria as unknown as
        | BankProgramSnapshot['performanceCriteria']
        | undefined,
    };
  }

  private buildProfile(dto: ApplyRequestDto): ApplicantProfile {
    const dec = (v?: string): Decimal | undefined => (v !== undefined ? new Decimal(v) : undefined);
    return {
      age: dto.age,
      loanPurpose: dto.loanPurpose,
      requestedAmountEGP: new Decimal(dto.requestedAmountEGP),
      requestedCurrency: dto.requestedCurrency ?? 'EGP',
      preferredTenorMonths: dto.preferredTenorMonths,
      priority: dto.priority,
      isGuest: dto.isGuest ?? false,
      nationalId: dto.nationalId,
      employment: {
        employmentType: dto.employment.employmentType,
        monthlyNetSalaryEGP: new Decimal(dto.employment.monthlyNetSalaryEGP),
        monthsInJob: dto.employment.monthsInJob,
        yearsInPractice: dto.employment.yearsInPractice,
        professorRank: dto.employment.professorRank,
        militaryGrade: dto.employment.militaryGrade,
        salaryTransferType: dto.employment.salaryTransferType,
        companyName: dto.employment.companyName,
        companyType: dto.employment.companyType,
        bankCategory: dto.employment.bankCategory,
      },
      obligations: {
        existingMonthlyObligationsEGP: new Decimal(dto.obligations.existingMonthlyObligationsEGP),
        hasCurrentLoan: dto.obligations.hasCurrentLoan,
        currentLoanRatePercent: dec(dto.obligations.currentLoanRatePercent),
        monthsOnBookCurrentLoan: dto.obligations.monthsOnBookCurrentLoan,
        bkt1HitWithinMonths: dto.obligations.bkt1HitWithinMonths,
        bkt2HitWithinMonths: dto.obligations.bkt2HitWithinMonths,
        hasPreviousRejection: dto.obligations.hasPreviousRejection,
      },
      assets: {
        cdAtABKValueEGP: dec(dto.assets.cdAtABKValueEGP),
        totalDepositsAtABKValueEGP: dec(dto.assets.totalDepositsAtABKValueEGP),
        bankStatementBalanceEGP: dec(dto.assets.bankStatementBalanceEGP),
        declaredAssetsValueEGP: dec(dto.assets.declaredAssetsValueEGP),
        creditCardLimitEGP: dec(dto.assets.creditCardLimitEGP),
        autoLoanAtOtherBankEGP: dec(dto.assets.autoLoanAtOtherBankEGP),
        autoLoanAtABKEGP: dec(dto.assets.autoLoanAtABKEGP),
        carInstallmentEGP: dec(dto.assets.carInstallmentEGP),
        ownsCompoundProperty: dto.assets.ownsCompoundProperty,
        clubMembership: dto.assets.clubMembership,
      },
      mortgageDetails: dto.mortgageDetails
        ? {
            propertyValueEGP: new Decimal(dto.mortgageDetails.propertyValueEGP),
            downPaymentEGP: new Decimal(dto.mortgageDetails.downPaymentEGP),
            propertyType: dto.mortgageDetails.propertyType,
            isCompound: dto.mortgageDetails.isCompound,
            constructionStage: dto.mortgageDetails.constructionStage,
          }
        : undefined,
      carDetails: dto.carDetails
        ? {
            carValueEGP: new Decimal(dto.carDetails.carValueEGP),
            downPaymentEGP: new Decimal(dto.carDetails.downPaymentEGP),
          }
        : undefined,
    };
  }
}
