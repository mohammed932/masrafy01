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
import { matchesRequestedScope } from '../bank-programs/program-scope';
import { ProgramNameScopeService } from '@/platform-enumerations/program-name-scope.service';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
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
import { CustomerProfileCompletenessService } from '@/customer-auth/customer-profile-completeness.service';
import { QuestionnaireService, type ResolvedAnswer } from '@/questionnaire/questionnaire.service';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  DEBT_TYPES_QUESTION_CODE,
  resolveObligations,
  type ObligationsResolution,
} from '@/matching/pipeline/money-field-bindings';
import {
  surrogateFactsFromAnswers,
  surrogateOptionPick,
  type SurrogateFacts,
} from '@/matching/pipeline/surrogate-facts-from-answers';
import type { LoanCategory, DecisionOutcome } from '@prisma/client';
import type { ApplicantProfile, BankProgramSnapshot, Offer } from '../matching/types';
import { MATCHING_ENGINE_VERSION } from '../matching/types';
import type { ApplyRequestDto } from './dto/apply.dto';
import type { ApplyResponse, UnavailableProgramDto } from './dto/apply-response.dto';
import type {
  ApplicationDecisionStatus,
  ApplicationDetailResponse,
  ApplicationListItemDto,
  ApplicationOfferDto,
  ApplicationsListResponse,
} from './dto/applications-list-response.dto';
import { ApplicationStatus } from './dto/enums';

/**
 * The persisted BankOffer columns a response projection reads. Named (rather
 * than restated inline) so the list AND the single-application detail read can
 * both hand a row to the same projection without a second copy of the shape.
 */
type PersistedOfferRow = {
  id: string;
  programCode: string;
  programVersion: number;
  bankName: string;
  bankIsFeatured: boolean;
  isShariaCompliant: boolean;
  programFriendlyName: string;
  effectiveRatePercent: Decimal;
  monthlyInstallmentEGP: Decimal;
  requestedLoanAmountEGP: Decimal;
  effectiveLoanAmountEGP: Decimal;
  requestedTenorMonths: number;
  effectiveTenorMonths: number;
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
  /** How the rate was charged. `null` on offers predating the column — not `flat`. */
  rateBasis?: string | null;
  /** Feature 011 — frozen provenance. `null` on offers predating the columns. */
  incomeOrigin?: string | null;
  incomeSurrogateStrategy?: string | null;
  /** What the applicant's collateral supported. `null` unless the program prices off it. */
  collateralCeilingEGP?: Decimal | null;
};

/** An applied application's row + the offer the customer proceeded with. */
type AppliedApplicationRow = {
  id: string;
  category: LoanCategory | null;
  requestedAmountEGP: Decimal;
  userProceededAt: Date;
};

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
    private readonly questionnaire: QuestionnaireService,
    private readonly completeness: CustomerProfileCompletenessService,
    private readonly savedOffers: SavedOfferRepository,
    private readonly programNames: ProgramNameScopeService,
    private readonly enumerations: PlatformEnumerationsRepository,
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
        this.toApplicationListItem(
          { ...row, userProceededAt: row.userProceededAt },
          offer,
          savedOfferIds,
        ),
      ];
    });
    return { success: true, data: { applications } };
  }

  /**
   * ONE of the customer's applications, read on demand: the Applications
   * screen's "View offer" tap fetches the offer through here instead of
   * reopening the row it cached when it drew the list. Everything on that row
   * can move without the client hearing about it — the bank decision, the
   * saved/heart flag, the offer being erased — and the details screen is where
   * the customer acts on those numbers, so it reads them fresh.
   *
   * Ownership mirrors `selectOffer`: unknown id → 404, someone else's → 403.
   * An application that exists but was never proceeded with has no selected
   * offer to show and reads as 404 too (the list never showed it either).
   */
  async getMine(
    applicationId: string,
    customerId: string,
  ): Promise<ApplicationDetailResponse> {
    const row = await this.repo.findAppliedById(applicationId);
    if (!row) throw new NotFoundException();
    if (row.applicantUserId !== customerId) throw new ForbiddenException();

    const offer = row.bankOffers.find((o) => o.id === row.userSelectedBankOfferId);
    if (!offer || !row.userProceededAt) throw new NotFoundException();

    const savedOfferIds = await this.savedOffers.findSavedBankOfferIds(customerId);
    return {
      success: true,
      data: {
        application: this.toApplicationListItem(
          { ...row, userProceededAt: row.userProceededAt },
          offer,
          savedOfferIds,
        ),
      },
    };
  }

  /**
   * One Applications-screen row — shared by the list and the single-application
   * detail read so the two can never drift (the mobile client parses one shape
   * for both).
   */
  private toApplicationListItem(
    row: AppliedApplicationRow,
    offer: PersistedOfferRow & { decision: { outcome: DecisionOutcome } | null },
    savedOfferIds: Set<string>,
  ): ApplicationListItemDto {
    return {
      applicationId: row.id,
      category: row.category,
      requestedAmountEGP: row.requestedAmountEGP.toFixed(2),
      status: this.projectApplicationStatus(offer.decision?.outcome),
      proceededAt: row.userProceededAt.toISOString(),
      offer: this.toOfferDto(offer, savedOfferIds),
    };
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

    // The applicant's catalog pick, validated before any matching work. An
    // archetype is offered UNDER categories, so a key with no category has
    // nothing to be checked against — rejected rather than quietly matched
    // unscoped, which would return the whole catalog to a customer who asked for
    // one product.
    if (dto.programNameKey) {
      if (!dto.category) {
        throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          field: 'programNameKey',
          reason: 'category_required',
        });
      }
      await this.programNames.assertOfferedUnder(dto.programNameKey, dto.category);
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

    // Only the programs the applicant actually asked about: their loan category,
    // narrowed further by the catalog name they picked and by the income basis
    // they said they can prove. Same filter, same helper, as the preview that
    // showed them this shortlist a screen earlier.
    //
    // The category half is not cosmetic — apply used to run the engine over
    // EVERY active program, so a personal-loan applicant was quoted mortgage and
    // car programs, and each of those offers was persisted immutably (Principle
    // I / A6) with a score computed from personal-loan answers. The income-basis
    // half is the same defect one axis over: a customer who said they have no
    // payslip was quoted payslip programs, and each of those offers was frozen
    // with a figure their answers could never have supported.
    const activePrograms = (await this.programsRepo.findAllActive()).filter((p) =>
      matchesRequestedScope(
        p,
        dto.category ?? null,
        dto.programNameKey ?? null,
        dto.programType ?? null,
      ),
    );
    // One read for the whole book, not one per program: a program on catalog amounts
    // is quoted off its program name's rule, and `toBankProgramSnapshot` may not do IO.
    const catalogRules = await this.enumerations.programNameIncomeRules();
    const snapshots: BankProgramSnapshot[] = activePrograms.map((p) =>
      toBankProgramSnapshot(p, catalogRules),
    );

    // Age is DERIVED from the customer's birthday, never sent by the client
    // (Principle XXXVII / A31). It prices money — the age-at-maturity rule
    // shortens the tenor, which moves the installment and the max loan.
    const age = await this.completeness.getApplicantAge(ctx.customerId);
    const obligations = this.resolveApplicantObligations(dto, resolvedQuestionnaire);
    // Feature 011 — the surrogate income facts, from the SAME mapper preview reads.
    // Answers are the authority here, not the request body: the body's `employment`
    // block is client-supplied, the answers were validated against the published
    // snapshot, and a rule reading two different sources on two surfaces is the drift
    // A33 forbids (FR-019).
    const surrogateFacts = await this.resolveSurrogateFacts(resolvedQuestionnaire);
    const profile = this.buildProfile(dto, age, obligations, surrogateFacts);
    // MVP simplification: eligibility gating is dropped on apply — every active
    // program yields an offer, ordered by the applicant's own stated priority.
    // DBR is NOT part of that: affordability shapes the amount offered, so it
    // stays on here. Leaving it off persisted immutable offers at installments
    // the applicant's declared income could never carry.
    // ONE read for the whole book, outside the per-program loop, exactly like
    // `programNameIncomeRules` above: it is one map for the entire registry, and reading
    // it per program would be a query per program on the apply path.
    const parentKeyByValue = await this.enumerations.enumerationParentKeys();
    const result = this.engine.run({
      profile,
      programs: snapshots,
      skipEligibility: true,
      parentKeyByValue,
    });

    // The rank IS the array position: `result.offers` comes out of `rankOffers`,
    // already sorted by the applicant's own `priority`. Carrying a `rankIndex` field
    // on `Offer` instead would be a second statement of the same fact, free to
    // disagree with the array it describes.
    const offerInputs: CreateBankOfferInput[] = result.offers.map((o, rankIndex) =>
      this.toOfferInput(o, rankIndex),
    );

    // Programs the engine checked but could not quote. `quoteProgram` failing is
    // NOT covered by `skipEligibility` — it returns `eligible: false` with no
    // offer, and `run()` builds `offers` from results that HAVE an offer, so
    // these used to vanish from the customer's list with no reason given. The
    // engine already carried the reason for exactly this purpose; apply just
    // never read `result.results`.
    const unavailablePrograms: UnavailableProgramDto[] = result.results.flatMap((r) => {
      const u = r.unavailable;
      if (!u) return [];
      const program = activePrograms.find((p) => p.programCode === r.programCode);
      return [
        {
          programCode: r.programCode,
          bankName: program?.bankName ?? '',
          programFriendlyName: program?.friendlyName ?? '',
          reason: u.reason,
          ...(u.maxAffordableAmountEGP
            ? { maxAffordableAmountEGP: u.maxAffordableAmountEGP.toFixed(2) }
            : {}),
          ...(u.dbrCapPercent ? { dbrCapPercent: u.dbrCapPercent.toFixed(2) } : {}),
          // WHICH condition refused, and WHICH answers are missing. Both are what turn a card
          // saying "no figures" into one the customer can act on.
          ...(u.gateReasonCode ? { gateReasonCode: u.gateReasonCode } : {}),
          ...(u.missingFactKeys?.length ? { missingFactKeys: u.missingFactKeys } : {}),
        },
      ];
    });

    const summaryJson: JsonValueInput = {
      programsCheckedCount: result.programsChecked,
      eligibleProgramsCount: result.eligibleCount,
      engineDurationMs: result.engineDurationMs,
      bestRatePercent: result.offers[0]?.effectiveRatePercent.toFixed(4) ?? null,
      bestInstallmentEGP: result.offers[0]?.monthlyInstallmentEGP.toFixed(2) ?? null,
      // Persisted so `toResponse` — which serves both the fresh apply and the
      // idempotency replay off the stored row — returns the identical payload.
      unavailablePrograms: unavailablePrograms as unknown as JsonValueInput,
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
        preferredTenorMonths: dto.preferredTenorMonths,
        loanPurpose: dto.loanPurpose,
        // Snapshot of the age the engine actually priced on (derived, not stored
        // on the customer — Principle XXXVII / A31).
        age,
        applicantUserId: ctx.customerId,
        category: dto.category ?? null,
        // The other two thirds of the scope the offers below were matched under.
        // Null means "not narrowed by this axis" — the whole category, or both
        // income bases — never "unknown".
        programNameKey: dto.programNameKey ?? null,
        programType: dto.programType ?? null,
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
            },
          },
          tx,
        );
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
              engineVersion: MATCHING_ENGINE_VERSION,
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

  /**
   * Read the unavailable-program list back out of the persisted summary blob.
   *
   * Tolerant by design: applications matched before this field existed have no
   * key, and an empty list is the correct answer for them — never an error.
   */
  private readUnavailablePrograms(summary: unknown): UnavailableProgramDto[] {
    const list = (summary as { unavailablePrograms?: unknown } | null)?.unavailablePrograms;
    return Array.isArray(list) ? (list as UnavailableProgramDto[]) : [];
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
          unavailablePrograms: this.readUnavailablePrograms(row.summary),
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

  private toOfferInput(offer: Offer, rankIndex: number): CreateBankOfferInput {
    return {
      programCode: offer.programCode,
      programVersion: offer.programVersion,
      bankName: offer.bankName,
      bankIsFeatured: offer.bankIsFeatured,
      isShariaCompliant: offer.isShariaCompliant,
      programFriendlyName: offer.programFriendlyName,
      effectiveRatePercent: new Decimal(offer.effectiveRatePercent.toString()),
      // Frozen with the rate it qualifies: a program re-priced onto the other basis later
      // must not rewrite what this offer meant (Principle I / A6).
      rateBasis: offer.rateBasis,
      monthlyInstallmentEGP: new Decimal(offer.monthlyInstallmentEGP.toString()),
      requestedLoanAmountEGP: new Decimal(offer.requestedLoanAmountEGP.toString()),
      effectiveLoanAmountEGP: new Decimal(offer.effectiveLoanAmountEGP.toString()),
      requestedTenorMonths: offer.requestedTenorMonths,
      effectiveTenorMonths: offer.effectiveTenorMonths,
      feesBreakdown: offer.feesBreakdown as unknown as JsonValueInput,
      rankIndex,
      engineVersion: MATCHING_ENGINE_VERSION,
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
      // Frozen at creation, never updated (Principle I / A6). Nulls are preserved as
      // nulls rather than defaulted to `declared`: on an `income_proof` program with a
      // declared salary the rule was never read, and claiming otherwise would put a
      // decision on the record that the engine did not make.
      incomeOrigin: offer.incomeOrigin,
      incomeSurrogateStrategy: offer.incomeSurrogateStrategy,
      collateralCeilingEGP: offer.collateralCeilingEGP
        ? new Decimal(offer.collateralCeilingEGP.toString())
        : null,
    };
  }

  /**
   * Project a persisted BankOffer row into the wire shape shared by the apply
   * response's `matchedOffers[]` and the Applications-list `offer` field —
   * one mapper, two callers (Principle X keeps this the only place that reads
   * these BankOffer columns for a response).
   */
  private toOfferDto(
    o: PersistedOfferRow,
    savedOfferIds: Set<string>,
  ): ApplicationOfferDto {
    return {
      bankOfferId: o.id,
      isSaved: savedOfferIds.has(o.id),
      programCode: o.programCode,
      programVersion: o.programVersion,
      bankName: o.bankName,
      bankIsFeatured: o.bankIsFeatured,
      isShariaCompliant: o.isShariaCompliant,
      programFriendlyName: o.programFriendlyName,
      effectiveRatePercent: o.effectiveRatePercent.toFixed(4),
      // Read straight off the frozen column. `?? null` rather than a default: an offer
      // written before this column existed named no basis, and answering `reducing` here
      // would put a statement on the record that nobody made — even though that is what
      // the engine priced it at.
      rateBasis: o.rateBasis ?? null,
      monthlyInstallmentEGP: o.monthlyInstallmentEGP.toFixed(2),
      requestedLoanAmountEGP: o.requestedLoanAmountEGP.toFixed(2),
      effectiveLoanAmountEGP: o.effectiveLoanAmountEGP.toFixed(2),
      requestedTenorMonths: o.requestedTenorMonths,
      effectiveTenorMonths: o.effectiveTenorMonths,
      requiredDocuments: o.requiredDocuments,
      matchReasons: o.matchReasons,
      feesBreakdown: o.feesBreakdown,
      cascadeTrace: o.cascadeTrace,
      qualitativeReviewBadge: o.qualitativeReviewBadge,
      selfDeclared: o.selfDeclared,
      maxLoanAvailableEGP: o.maxLoanAvailableEGP?.toFixed(2),
      dbrPercent: o.dbrPercent?.toFixed(2),
      dbrCapPercent: o.dbrCapPercent?.toFixed(4),
      // Feature 011 — read straight off the frozen columns. `?? null` rather than a
      // fallback value: an offer written before these columns existed made no claim
      // about which income it ran on, and inventing `declared` would put one on the
      // record retroactively (contracts/matching-provenance.md § 3).
      incomeOrigin: o.incomeOrigin ?? null,
      incomeSurrogateStrategy: o.incomeSurrogateStrategy ?? null,
      // What the unit or membership supported. Read off the frozen column, so an offer
      // keeps saying what it said the day it was made (Principle I / A6).
      collateralCeilingEGP: o.collateralCeilingEGP?.toFixed(2) ?? null,
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

  /**
   * The applicant's monthly obligations, from the itemised questionnaire answers
   * when they were asked and from the request body otherwise.
   *
   * The SUM is authoritative. `dto.obligations.existingMonthlyObligationsEGP` is
   * only cross-checked against it, never preferred, so editing the total in
   * flight cannot buy affordability — and a disagreement is rejected rather than
   * quietly resolved, because the total is computed on the client too and so a
   * mismatch means a tampered or stale build, not a user slip.
   */
  private resolveApplicantObligations(
    dto: ApplyRequestDto,
    questionnaire: { resolved: ResolvedAnswer[]; askedQuestionCodes: string[] } | undefined,
  ): ObligationsResolution {
    const stated = new Decimal(dto.obligations.existingMonthlyObligationsEGP);
    const statedOnly: ObligationsResolution = {
      totalEGP: stated,
      itemised: false,
      itemisedCodes: [],
      hasCurrentLoan: dto.obligations.hasCurrentLoan,
      statedTotalMismatch: null,
    };
    // No dynamic answers (a category-less legacy submit) → nothing to sum from.
    if (!questionnaire) return statedOnly;

    const numericByCode = new Map<string, string>();
    for (const a of questionnaire.resolved) {
      if (a.numericValue !== null) numericByCode.set(a.questionCode, a.numericValue);
    }
    // `askedQuestionCodes` is the precise "was this snapshot serving the itemised
    // flow" signal. A snapshot that predates it yields `undefined` here, which
    // routes `resolveObligations` down its stated-lump-sum fallback.
    const pickedDebtTypes = questionnaire.askedQuestionCodes.includes(DEBT_TYPES_QUESTION_CODE)
      ? (questionnaire.resolved.find((a) => a.questionCode === DEBT_TYPES_QUESTION_CODE)
          ?.selectedOptionCodes ?? [])
      : undefined;

    const resolved = resolveObligations({ numericByCode, pickedDebtTypes });
    if (!resolved) return statedOnly;
    if (resolved.statedTotalMismatch) {
      throw new DomainException(ERROR_CODES.OBLIGATIONS_TOTAL_MISMATCH, {
        statedEGP: resolved.statedTotalMismatch.statedEGP.toFixed(2),
        computedEGP: resolved.statedTotalMismatch.computedEGP.toFixed(2),
      });
    }
    return resolved;
  }

  /**
   * Feature 011 / FR-018 – FR-020 — the surrogate facts, off the validated answers.
   *
   * Delegates entirely to the shared `surrogateFactsFromAnswers`; the only work here
   * is reshaping `ResolvedAnswer[]` into the two lookup maps it takes. No dynamic
   * answers (a category-less legacy submit) means no facts — and an absent fact is
   * `SURROGATE_FACT_MISSING`, never a substituted zero.
   */
  private async resolveSurrogateFacts(
    questionnaire: { resolved: ResolvedAnswer[]; askedQuestionCodes: string[] } | undefined,
  ): Promise<SurrogateFacts> {
    if (!questionnaire) return { employment: {}, assets: {}, byKey: {} };
    const optionByCode = new Map<string, string>();
    const numericByCode = new Map<string, string>();
    const multiByCode = new Map<string, readonly string[]>();
    const textByCode = new Map<string, string>();
    for (const a of questionnaire.resolved) {
      // The SAME predicate preview applies. Testing `selectedOptionCode !== null`
      // here accepted picks preview would have dropped, so the two paths could bind a
      // fact differently for one set of answers.
      const picked = surrogateOptionPick(a);
      if (picked !== undefined) optionByCode.set(a.questionCode, picked);
      if (a.numericValue !== null) numericByCode.set(a.questionCode, a.numericValue);
      // Multi-picks, for the one question whose answer is a SET rather than a key (which
      // banks the applicant already uses). `surrogateOptionPick` deliberately drops these.
      if (a.type === 'MULTI_SELECT' && a.selectedOptionCodes.length > 0) {
        multiByCode.set(a.questionCode, a.selectedOptionCodes);
      }
      // Text answers, for a fact bound to a TEXT question: only their PRESENCE is read
      // (`registryFactValue`), and the mapper trims before deciding.
      if (a.textValue !== null && a.textValue.trim().length > 0) {
        textByCode.set(a.questionCode, a.textValue);
      }
    }
    // The registry is read per apply, uncached. A quote priced off a fact the operator
    // repointed an hour ago would be wrong in the one direction that matters — the
    // offer freezes it (Principle I) — and one indexed read per application is not a
    // budget worth defending against that.
    const registry = await this.enumerations.surrogateFactRegistry();
    return surrogateFactsFromAnswers(
      { optionByCode, numericByCode, multiByCode, textByCode },
      registry,
    );
  }

  private buildProfile(
    dto: ApplyRequestDto,
    age: number,
    obligations: ObligationsResolution,
    surrogateFacts: SurrogateFacts,
  ): ApplicantProfile {
    const dec = (v?: string): Decimal | undefined => (v !== undefined ? new Decimal(v) : undefined);
    return {
      age,
      loanPurpose: dto.loanPurpose,
      requestedAmountEGP: new Decimal(dto.requestedAmountEGP),
      preferredTenorMonths: dto.preferredTenorMonths,
      priority: dto.priority,
      nationalId: dto.nationalId,
      employment: {
        employmentType: dto.employment.employmentType,
        monthlyNetSalaryEGP: new Decimal(dto.employment.monthlyNetSalaryEGP),
        monthsInJob: dto.employment.monthsInJob,
        // Feature 011 — the ANSWER wins over the request body. The body's copies
        // predate this feature and nothing on the client populated them (the mobile
        // mapper sent an empty asset set entirely); they stay as the fallback for a
        // caller that has no dynamic answers at all, so a legacy or server-to-server
        // submit is not silently stripped of facts it did supply.
        yearsInPractice: surrogateFacts.employment.yearsInPractice ?? dto.employment.yearsInPractice,
        professorRank: surrogateFacts.employment.professorRank ?? dto.employment.professorRank,
        militaryGrade: surrogateFacts.employment.militaryGrade ?? dto.employment.militaryGrade,
        salaryTransferType: dto.employment.salaryTransferType,
        companyName: dto.employment.companyName,
        companyType: dto.employment.companyType,
        bankCategory: dto.employment.bankCategory,
      },
      obligations: {
        // Summed from the per-debt answers, NOT read off the request body — see
        // `resolveApplicantObligations`.
        existingMonthlyObligationsEGP: obligations.totalEGP,
        hasCurrentLoan: obligations.hasCurrentLoan,
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
        // Same precedence as the employment facts above: the validated ANSWER wins,
        // the body is the fallback. This one is why the mobile app sent
        // `const AssetsPayload()` and `byCreditCardLimit` resolved to nothing for
        // every customer — the limit was answered and never left the phone (FR-019).
        creditCardLimitEGP: surrogateFacts.assets.creditCardLimitEGP ?? dec(dto.assets.creditCardLimitEGP),
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
      // Registry facts, keyed. No request-body fallback like the four typed fields
      // above have: an operator-defined fact has never existed on the apply DTO, so
      // there is no legacy caller whose figures could be stripped by leaving it out —
      // and adding one would let a client state a fact the questionnaire never asked.
      surrogateFacts: surrogateFacts.byKey,
      // Not facts: the inputs the engine derives the per-bank columns from, per program.
      ...(surrogateFacts.bankAxisSlugs !== undefined
        ? { bankAxisSlugs: surrogateFacts.bankAxisSlugs }
        : {}),
    };
  }
}
