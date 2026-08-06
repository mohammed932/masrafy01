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
// Constitution Principle X (Repository Pattern Mandatory): this service no
// longer imports the `Prisma` namespace at runtime. Isolation-level options
// are sourced from a local string-literal mirror; every read/write inside a
// `$transaction` callback goes through a repository method that accepts an
// optional `tx?: Prisma.TransactionClient`. The only remaining Prisma touch
// points are the `Decimal` value type and the domain `JsonValueInput`
// exported by the repository.
import { IsolationLevel } from '../common/transaction/isolation-level';
import { AuditEventType } from '../common/audit/audit-event-types';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import { PrismaService } from '../infra/prisma/prisma.service';
import {
  ApplicationRepository,
  type CreateBankOfferInput,
  type JsonValueInput,
} from './application.repository';
import { EngineService } from '../matching/engine.service';
import { BankProgramRepository } from '../bank-programs/bank-programs.repository';
import { toBankProgramSnapshot } from '../bank-programs/bank-program-snapshot.mapper';
import { SavedOfferRepository } from '../saved-offers/saved-offer.repository';
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
import { CustomerProfileCompletenessService } from '@/customer-auth/customer-profile-completeness.service';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { WeightedApprovalScoringService } from '@/scoring/weighted-approval.service';
import {
  toSelectedAnswers,
  type ScorableAnswer,
} from '@/matching/scoring/answer-to-selected';
import { loadActiveScoringConfig } from './adapters/active-scoring-config.adapter';
import type { LoanCategory, DecisionOutcome } from '@prisma/client';
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
import type {
  ApplicationDecisionStatus,
  ApplicationOfferDto,
  ApplicationsListResponse,
} from './dto/applications-list-response.dto';
import { ApplicationStatus } from './dto/enums';

export interface ApplyContext {
  /** Constitution v4.0.0 / Principle XIII — the authenticated customer (from
   *  the customer JWT). The mobile API is JWT-only and there is no guest mode;
   *  every apply call carries a customerId. */
  customerId: string;
  idempotencyKey?: string;
  payloadHash?: string | null;
  sourceIp?: string | null;
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
    private readonly questionnaire: QuestionnaireService,
    private readonly weightedScoring: WeightedApprovalScoringService,
    private readonly completeness: CustomerProfileCompletenessService,
    private readonly savedOffers: SavedOfferRepository,
  ) {}

  /**
   * Mobile user picks one of the matched offers and proceeds. This is the
   * user-intent gate: until it fires, an application is invisible in the
   * admin triage dashboard. Idempotent for the same (application, offer):
   * a repeat call surfaces ALREADY_PROCEEDED rather than overwriting. It is
   * also the document commitment point: profile photo + National ID are
   * asserted here, not at apply().
   */
  async selectOffer(input: {
    applicationId: string;
    bankOfferId: string;
    customerId: string;
    sourceIp: string | null;
  }): Promise<{
    applicationId: string;
    bankOfferId: string;
    userProceededAt: string;
    correlationId: string;
  }> {
    // Document commitment gate (constitution v9.0.1): profile photo + National
    // ID front/back are required exactly here — proceeding with a bank offer —
    // never at the matching call (`apply()`), which stays document-free so
    // customers can browse matched offers first. The docs screen pre-checks
    // via GET /v1/profile/documents/status (same predicate).
    await this.completeness.assertSelectOfferDocuments(input.customerId);

    const correlationId = randomUUID();
    return this.prisma.$transaction(
      async (tx) => {
        const app = await this.repo.findForOfferSelection(input.applicationId, tx);
        if (!app) throw new NotFoundException();
        if (app.applicantUserId !== input.customerId) throw new ForbiddenException();
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

        const offer = await this.repo.findBankOfferOwnership(input.bankOfferId, tx);
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
        await this.repo.markOfferSelected(
          {
            applicationId: app.id,
            bankOfferId: offer.id,
            proceededAt,
          },
          tx,
        );

        await this.audit.write(
          {
            actorId: null,
            // AuditEvent.targetId FKs to StaffAccount, not Application — the
            // application id goes in the payload instead (see APPLICATION_CREATED
            // / APPLICATION_MATCHED / APPLICATION_NO_MATCH above).
            targetId: null,
            eventType: AuditEventType.APPLICATION_USER_PROCEEDED,
            sourceIp: input.sourceIp,
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
      { isolationLevel: IsolationLevel.Serializable },
    );
  }

  /**
   * The "Applications" screen: every application the customer has proceeded
   * with (Feature 008 user-intent gate), newest first, with the selected
   * offer's current bank decision projected to a display status.
   */
  async listMine(customerId: string): Promise<ApplicationsListResponse> {
    const rows = await this.repo.findAppliedByCustomer(customerId);
    const savedOfferIds = await this.savedOffers.findSavedBankOfferIds(
      customerId,
    );
    const applications = rows.flatMap((row) => {
      const offer = row.bankOffers.find((o) => o.id === row.userSelectedBankOfferId);
      if (!offer || !row.userProceededAt) return [];
      return [
        {
          applicationId: row.id,
          category: row.category,
          requestedAmountEGP: row.requestedAmountEGP.toFixed(2),
          status: this.projectApplicationStatus(offer.decision?.outcome),
          proceededAt: row.userProceededAt.toISOString(),
          offer: this.toOfferDto(offer, savedOfferIds),
        },
      ];
    });
    return { success: true, data: { applications } };
  }

  async apply(dto: ApplyRequestDto, ctx: ApplyContext): Promise<ApplyResponse> {
    const correlationId = randomUUID();
    const savedOfferIds = await this.savedOffers.findSavedBankOfferIds(
      ctx.customerId,
    );

    // No document gate here (constitution v9.0.1): matched offers browse freely.
    // Profile photo + National ID are asserted only at the select-offer
    // commitment point (`selectOffer` → `assertSelectOfferDocuments`).

    if (ctx.idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(ctx.customerId, ctx.idempotencyKey);
      if (existing) {
        if (existing.payloadHash && ctx.payloadHash && existing.payloadHash !== ctx.payloadHash) {
          throw new IdempotencyKeyMismatchException({ idempotencyKey: ctx.idempotencyKey });
        }
        return this.toResponse(
          existing.id,
          existing,
          correlationId,
          savedOfferIds,
        );
      }
    }

    // Feature 009/010 — resolve + validate dynamic questionnaire answers (if
    // sent) against the live GLOBAL questions, for atomic persistence. Scoped to
    // `dto.category`: required-question enforcement lives in `resolveAnswers`, so
    // it must only consider the questions this category actually asks.
    const resolvedQuestionnaire =
      dto.category && dto.questionnaireAnswers && dto.questionnaireAnswers.length > 0
        ? await this.questionnaire.resolveAnswers(dto.questionnaireAnswers, dto.category)
        : undefined;
    const dynamicAnswers = resolvedQuestionnaire?.resolved;

    const activePrograms = await this.programsRepo.findAllActive();
    const snapshots: BankProgramSnapshot[] = activePrograms.map(toBankProgramSnapshot);

    const scoringConfig: ScoringConfig = await loadActiveScoringConfig(this.scoringVersions);
    // Age is DERIVED from the customer's birthday, never sent by the client
    // (Principle XXXVII / A31). It prices money — the age-at-maturity rule
    // shortens the tenor, which moves the installment and the max loan.
    const age = await this.completeness.getApplicantAge(ctx.customerId);
    const profile = this.buildProfile(dto, age);
    // MVP simplification: eligibility gating is dropped on apply — every active
    // program yields an offer, ranked purely by the per-bank approval score.
    // DBR is NOT part of that: affordability shapes the amount offered, so it
    // stays on here. Leaving it off persisted immutable offers at installments
    // the applicant's declared income could never carry.
    const result = this.engine.run({
      profile,
      programs: snapshots,
      scoringConfig,
      skipEligibility: true,
    });

    // Per-bank weighted approval scoring (Constitution V v5.0.0): override each
    // offer's probability/tier with the per-program per-answer approval score
    // from `WeightedApprovalScoringService.scoreProgram`. Same scorer the mobile
    // preview uses. Only runs when the application carries dynamic-questionnaire
    // answers; otherwise the engine's own approval probability is left as-is.
    if (dto.category && resolvedQuestionnaire && dynamicAnswers && dynamicAnswers.length > 0) {
      await this.applyPerBankScoring(
        result.offers,
        dto.category,
        dynamicAnswers,
        resolvedQuestionnaire.askedQuestionCodes,
        snapshots,
      );
    }

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
        // Snapshot of the age the engine actually priced on (derived, not stored
        // on the customer — Principle XXXVII / A31).
        age,
        applicantUserId: ctx.customerId,
        category: dto.category ?? null,
        questionnaireVersionId: dto.questionnaireVersionId ?? null,
        applicantProfile: this.profileToJson(profile),
        summary: summaryJson,
        noMatchSummary: noMatchJson,
        engineDurationMs: result.engineDurationMs,
        programsCheckedCount: result.programsChecked,
        eligibleProgramsCount: result.eligibleCount,
      },
      offers: offerInputs,
      questionnaire: {
        customerId: ctx.customerId,
        payloadJson: this.buildQuestionnairePayload(dto),
      },
      dynamicAnswers,
      txCallback: async (tx, applicationIdInTx) => {
        await this.audit.write(
          {
            actorId: null,
            targetId: null,
            eventType: AuditEventType.APPLICATION_CREATED,
            sourceIp: ctx.sourceIp ?? null,
            payload: {
              applicationId: applicationIdInTx,
              customerId: ctx.customerId,
              loanPurpose: dto.loanPurpose,
              requestedAmountEGP: dto.requestedAmountEGP,
              requestedCurrency: dto.requestedCurrency ?? 'EGP',
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
    return this.toResponse(applicationId, fresh, correlationId, savedOfferIds);
  }

  private toResponse(
    applicationId: string,
    // Only bankOffers + scalar fields are read here, so type against the
    // narrower idempotency-key shape — decoupled from the admin `findById`
    // include (which additionally joins `applicantCustomer`).
    row: Awaited<ReturnType<ApplicationRepository['findByIdempotencyKey']>>,
    correlationId: string,
    savedOfferIds: Set<string>,
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
          matchedOffers: sorted.map((o) => this.toOfferDto(o, savedOfferIds)),
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

  /**
   * Overwrite each offer's approval probability with the per-bank, per-answer
   * approval score (Constitution V v5.0.0). Mutates the offers IN PLACE before
   * they are mapped to BankOffer inputs — the rows are not yet created, so
   * Principle I / A6 (immutable-after-match) is respected. The score is derived
   * by `scoreProgram` from the program's ACTIVE weight set and the customer's
   * answers — of every type, since v14.0.0.
   */
  private async applyPerBankScoring(
    offers: Offer[],
    category: LoanCategory,
    answers: readonly ScorableAnswer[],
    askedQuestionCodes: readonly string[],
    snapshots: BankProgramSnapshot[],
  ): Promise<void> {
    if (offers.length === 0) return;
    // EVERY question type scores (Constitution V, v14.0.0): a single pick, a set
    // of picks, a number in a band, or the presence of free text. The mapping is
    // shared with the preview path so both derive the same answer scores (A25).
    const selectedAnswers = toSelectedAnswers(answers);
    const idByCode = new Map(snapshots.map((s) => [s.programCode, s.id]));

    for (const offer of offers) {
      const { score, tier, factors, usedDefault } = await this.weightedScoring.scoreProgram({
        programId: idByCode.get(offer.programCode) ?? null,
        category,
        answers: selectedAnswers,
        askedQuestionCodes,
      });
      offer.approvalProbability = { score, tier, factors, usedDefault };
      offer.approvalProbabilityPercent = score;
    }
  }

  private toOfferInput(offer: Offer, engineVersion: string): CreateBankOfferInput {
    return {
      programCode: offer.programCode,
      programVersion: offer.programVersion,
      bankName: offer.bankName,
      bankIsFeatured: offer.bankIsFeatured,
      isShariaCompliant: offer.isShariaCompliant,
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
      approvalUsedDefault: offer.approvalProbability.usedDefault ?? false,
      engineVersion,
      requiredDocuments: offer.requiredDocuments,
      matchReasons: offer.matchReasons,
      cascadeTrace: offer.cascadeTrace as unknown as JsonValueInput,
      qualitativeReviewBadge: offer.qualitativeReviewBadge,
      selfDeclared: offer.selfDeclared,
      maxLoanAvailableEGP: offer.maxLoanAvailableEGP
        ? new Decimal(offer.maxLoanAvailableEGP.toString())
        : null,
      dbrPercent: new Decimal(offer.dbrPercent.toString()),
      dbrCapPercent: new Decimal(offer.dbrCapPercent.toString()),
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
    approvalUsedDefault?: boolean;
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
      // Rows predating the column read as false — they were scored against a
      // real weight set, which is the status quo for every backfilled offer.
      usedDefault: row.approvalUsedDefault ?? false,
      engineVersion: row.engineVersion,
    };
  }

  /**
   * Project a persisted BankOffer row into the wire shape shared by the apply
   * response's `matchedOffers[]` and the Applications-list `offer` field —
   * one mapper, two callers (Principle X keeps this the only place that reads
   * these BankOffer columns for a response).
   */
  private toOfferDto(o: {
    id: string;
    programCode: string;
    programVersion: number;
    bankName: string;
    bankIsFeatured: boolean;
    isShariaCompliant: boolean;
    programFriendlyName: string;
    currency: string;
    effectiveRatePercent: Decimal;
    monthlyInstallmentEGP: Decimal;
    requestedLoanAmountEGP: Decimal;
    effectiveLoanAmountEGP: Decimal;
    requestedTenorMonths: number;
    effectiveTenorMonths: number;
    approvalScore: number;
    approvalTier: string;
    approvalFactors: unknown;
    engineVersion: string;
    requiredDocuments: string[];
    matchReasons: string[];
    feesBreakdown: unknown;
    cascadeTrace: unknown;
    qualitativeReviewBadge: boolean;
    selfDeclared: boolean;
    maxLoanAvailableEGP: Decimal | null;
    dbrPercent: Decimal | null;
    dbrCapPercent: Decimal | null;
  }, savedOfferIds: Set<string>): ApplicationOfferDto {
    return {
      bankOfferId: o.id,
      isSaved: savedOfferIds.has(o.id),
      programCode: o.programCode,
      programVersion: o.programVersion,
      bankName: o.bankName,
      bankIsFeatured: o.bankIsFeatured,
      isShariaCompliant: o.isShariaCompliant,
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
      dbrPercent: o.dbrPercent?.toFixed(2),
      dbrCapPercent: o.dbrCapPercent?.toFixed(4),
    };
  }

  /** No decision row yet → still pending with the bank ("applied"). A
   *  `withdrawn` outcome reads as "rejected" — there is no separate pill for
   *  it on the Applications screen. */
  private projectApplicationStatus(
    outcome: DecisionOutcome | undefined,
  ): ApplicationDecisionStatus {
    if (outcome === 'approved') return 'approved';
    if (outcome === 'rejected' || outcome === 'withdrawn') return 'rejected';
    return 'applied';
  }

  /**
   * Builds the questionnaire answer payload persisted alongside the application
   * (Principle XXXVII / FR-013). National ID and other PII are deliberately
   * excluded — those live in Documents / the masked applicant profile.
   */
  private buildQuestionnairePayload(dto: ApplyRequestDto): JsonValueInput {
    return JSON.parse(
      JSON.stringify({
        loanPurpose: dto.loanPurpose,
        requestedAmountEGP: dto.requestedAmountEGP,
        requestedCurrency: dto.requestedCurrency ?? 'EGP',
        preferredTenorMonths: dto.preferredTenorMonths,
        priority: dto.priority,
        employment: dto.employment,
        obligations: dto.obligations,
        assets: dto.assets,
        mortgageDetails: dto.mortgageDetails ?? null,
        carDetails: dto.carDetails ?? null,
      }),
    ) as JsonValueInput;
  }

  private profileToJson(profile: ApplicantProfile): JsonValueInput {
    return JSON.parse(
      JSON.stringify(profile, (_k, v) => (v instanceof Decimal ? v.toString() : v)),
    ) as JsonValueInput;
  }

  private buildProfile(dto: ApplyRequestDto, age: number): ApplicantProfile {
    const dec = (v?: string): Decimal | undefined => (v !== undefined ? new Decimal(v) : undefined);
    return {
      age,
      loanPurpose: dto.loanPurpose,
      requestedAmountEGP: new Decimal(dto.requestedAmountEGP),
      requestedCurrency: dto.requestedCurrency ?? 'EGP',
      preferredTenorMonths: dto.preferredTenorMonths,
      priority: dto.priority,
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
