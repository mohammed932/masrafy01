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
import { Prisma, AuditEventType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import { ApplicationRepository, type CreateBankOfferInput } from './application.repository';
import { EngineService } from '../matching/engine.service';
import { BankProgramRepository } from '../bank-programs/bank-programs.repository';
import { AuditEventWriter } from '../audit/audit-event.writer';
import { IdempotencyKeyMismatchException } from '../common/errors/domain.exceptions';
import type { ApplicantProfile, BankProgramSnapshot, Offer } from '../matching/types';
import type { ApplyRequestDto } from './dto/apply.dto';
import type { ApplyResponse } from './dto/apply-response.dto';

export interface ApplyContext {
  mobileClientId: string;
  idempotencyKey?: string;
  payloadHash?: string | null;
  sourceIp?: string | null;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly repo: ApplicationRepository,
    private readonly engine: EngineService,
    private readonly programsRepo: BankProgramRepository,
    private readonly audit: AuditEventWriter,
  ) {}

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

    const profile = this.buildProfile(dto);
    const result = this.engine.run({ profile, programs: snapshots, correlationId });

    const offerInputs: CreateBankOfferInput[] = result.offers.map((o) => this.toOfferInput(o));

    const summaryJson: Prisma.InputJsonValue = {
      programsCheckedCount: result.programsChecked,
      eligibleProgramsCount: result.eligibleCount,
      engineDurationMs: result.engineDurationMs,
      bestRatePercent: result.offers[0]?.effectiveRatePercent.toFixed(4) ?? null,
      bestInstallmentEGP: result.offers[0]?.monthlyInstallmentEGP.toFixed(2) ?? null,
    };

    const noMatchJson: Prisma.InputJsonValue | undefined =
      result.status === 'no_match'
        ? (JSON.parse(
            JSON.stringify({
              primaryReason: result.primaryReason ?? null,
              details: result.noMatchDetails ?? [],
              suggestions: result.suggestions ?? [],
            }),
          ) as Prisma.InputJsonValue)
        : undefined;

    const applicationId = await this.repo.persistMatch({
      application: {
        mobileClientId: ctx.mobileClientId,
        submissionCorrelationId: correlationId,
        idempotencyKey: ctx.idempotencyKey ?? null,
        payloadHash: ctx.payloadHash ?? null,
        status: result.status === 'matched' ? 'matched' : 'no_match',
        priority: dto.priority,
        requestedAmountEGP: new Prisma.Decimal(dto.requestedAmountEGP),
        requestedCurrency: dto.requestedCurrency ?? 'EGP',
        preferredTenorMonths: dto.preferredTenorMonths,
        loanPurpose: dto.loanPurpose,
        age: dto.age,
        isGuest: dto.isGuest ?? false,
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
        await this.audit.write(
          {
            actorId: null,
            targetId: null,
            eventType: 'MATCHING_ENGINE_RUN',
            sourceIp: ctx.sourceIp ?? null,
            correlationId,
            payload: {
              applicationId: applicationIdInTx,
              programsCheckedCount: result.programsChecked,
              eligibleProgramsCount: result.eligibleCount,
              durationMs: result.engineDurationMs,
            },
          },
          tx,
        );
        await this.audit.write(
          {
            actorId: null,
            targetId: null,
            eventType: result.status === 'matched' ? 'APPLICATION_MATCHED' : 'APPLICATION_NO_MATCH',
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
            programFriendlyName: o.programFriendlyName,
            currency: o.currency,
            effectiveRatePercent: o.effectiveRatePercent.toFixed(4),
            monthlyInstallmentEGP: o.monthlyInstallmentEGP.toFixed(2),
            requestedLoanAmountEGP: o.requestedLoanAmountEGP.toFixed(2),
            effectiveLoanAmountEGP: o.effectiveLoanAmountEGP.toFixed(2),
            requestedTenorMonths: o.requestedTenorMonths,
            effectiveTenorMonths: o.effectiveTenorMonths,
            approvalProbabilityPercent: o.approvalProbabilityPercent.toNumber(),
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

  private toOfferInput(offer: Offer): CreateBankOfferInput {
    return {
      programCode: offer.programCode,
      programVersion: offer.programVersion,
      bankName: offer.bankName,
      programFriendlyName: offer.programFriendlyName,
      currency: offer.currency,
      effectiveRatePercent: new Prisma.Decimal(offer.effectiveRatePercent.toString()),
      monthlyInstallmentEGP: new Prisma.Decimal(offer.monthlyInstallmentEGP.toString()),
      requestedLoanAmountEGP: new Prisma.Decimal(offer.requestedLoanAmountEGP.toString()),
      effectiveLoanAmountEGP: new Prisma.Decimal(offer.effectiveLoanAmountEGP.toString()),
      requestedTenorMonths: offer.requestedTenorMonths,
      effectiveTenorMonths: offer.effectiveTenorMonths,
      feesBreakdown: offer.feesBreakdown as unknown as Prisma.InputJsonValue,
      approvalProbabilityPercent: new Prisma.Decimal(offer.approvalProbabilityPercent),
      requiredDocuments: offer.requiredDocuments,
      matchReasons: offer.matchReasons,
      cascadeTrace: offer.cascadeTrace as unknown as Prisma.InputJsonValue,
      qualitativeReviewBadge: offer.qualitativeReviewBadge,
      selfDeclared: offer.selfDeclared,
      maxLoanAvailableEGP: offer.maxLoanAvailableEGP
        ? new Prisma.Decimal(offer.maxLoanAvailableEGP.toString())
        : null,
    };
  }

  private profileToJson(profile: ApplicantProfile): Prisma.InputJsonValue {
    return JSON.parse(
      JSON.stringify(profile, (_k, v) => (v instanceof Decimal ? v.toString() : v)),
    ) as Prisma.InputJsonValue;
  }

  private toSnapshot(
    p: Awaited<ReturnType<BankProgramRepository['findAllActive']>>[number],
  ): BankProgramSnapshot {
    return {
      id: p.id,
      programCode: p.programCode,
      bankName: p.bankName,
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
