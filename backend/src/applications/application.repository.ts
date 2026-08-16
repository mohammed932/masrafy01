/**
 * Application repository — thin Prisma data-access layer.
 * Constitution Principle X: services NEVER touch Prisma directly.
 *
 * Writes use a single $transaction (Application + BankOffers + AuditEvents) so
 * an offer-creation failure cannot leave an orphan application row.
 */

import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type ApplicationPriority,
  type ApplicationStatus as PrismaApplicationStatus,
  type LeadStatus as PrismaLeadStatus,
  type ApprovalTier,
  type BankProgramType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../infra/prisma/prisma.service';
import { ApplicationStatus, LeadStatus } from './dto/enums';

/** Domain JSON value type — exposed to services / DTOs.
 *  Internally cast at the Prisma boundary inside this repository. */
export type JsonValueInput = object | unknown[] | string | number | boolean | null;

export interface CreateApplicationInput {
  submissionCorrelationId: string;
  idempotencyKey?: string | null;
  payloadHash?: string | null;
  status: ApplicationStatus;
  priority: ApplicationPriority;
  requestedAmountEGP: Decimal;
  preferredTenorMonths: number;
  loanPurpose: string;
  age: number;
  applicantUserId: string;
  category?: string | null;
  /** Catalog `program_name` the applicant narrowed to; null = whole category. */
  programNameKey?: string | null;
  /** Income basis the applicant narrowed to; null = both bases. */
  programType?: BankProgramType | null;
  questionnaireVersionId?: string | null;
  applicantProfile: JsonValueInput;
  summary: JsonValueInput;
  noMatchSummary?: JsonValueInput;
  engineDurationMs?: number;
  programsCheckedCount: number;
  eligibleProgramsCount: number;
}

export interface CreateBankOfferInput {
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
  feesBreakdown: JsonValueInput;
  approvalProbabilityPercent: Decimal;
  approvalScore: number;
  approvalTier: ApprovalTier;
  approvalFactors: JsonValueInput;
  /** No ACTIVE weight set at match time — "not rated", not a bad fit. */
  approvalUsedDefault: boolean;
  engineVersion: string;
  requiredDocuments: string[];
  matchReasons: string[];
  cascadeTrace: JsonValueInput;
  qualitativeReviewBadge: boolean;
  selfDeclared: boolean;
  maxLoanAvailableEGP?: Decimal | null;
  /** The DBR verdict, frozen with the offer (see `BankOffer.dbrPercent`). */
  dbrPercent?: Decimal | null;
  dbrCapPercent?: Decimal | null;
  /**
   * Feature 011 — which income the quote ran on, and the surrogate method that
   * produced it. Written ONCE at creation and never updated (Principle I / A6):
   * editing the program's rule later must not rewrite an immutable offer's meaning.
   * `null` = the rule was not consulted, which is NOT the same as `declared`.
   */
  incomeOrigin?: string | null;
  incomeSurrogateStrategy?: string | null;
}

export interface PersistMatchInput {
  application: CreateApplicationInput;
  offers: CreateBankOfferInput[];
  /**
   * Questionnaire answers submitted with the application (Principle XXXVII /
   * FR-013). Persisted as a `QuestionnaireAnswer` row in the SAME transaction
   * as the application + offers — a failure rolls all of them back together.
   * PII (e.g. National ID) is NOT included; that lives in Documents.
   */
  questionnaire?: { customerId: string; payloadJson: JsonValueInput };
  /**
   * Feature 009 — dynamic questionnaire answers persisted as `application_answer`
   * rows in the SAME apply transaction (atomic with the application + offers).
   *
   * Feature 010 — typed: `selectedOptionCodes` is canonical for both choice types,
   * while `selectedOptionId`/`selectedOptionCode` stay populated for single choice
   * so the scorer and the admin answer views are untouched (FR-045). `textValue`
   * and `numericValue` carry the two value types.
   */
  dynamicAnswers?: Array<{
    questionId: string;
    questionCode: string;
    selectedOptionCodes: string[];
    selectedOptionId: string | null;
    selectedOptionCode: string | null;
    textValue: string | null;
    /** Decimal string — never a JS number (Principle I). */
    numericValue: string | null;
  }>;
  txCallback?: (tx: Prisma.TransactionClient, applicationId: string) => Promise<void>;
}

/**
 * Mapped domain type exposed to other features that only need to verify
 * who owns an application (customer link + device link). Avoids leaking
 * raw Prisma row shape across feature boundaries.
 */
export interface ApplicationOwnership {
  id: string;
  applicantUserId: string;
}

/**
 * Mapped domain type for the offer-selection flow's pre-write read.
 * Intra-feature (`applications`) so we expose the minimal projection
 * the service needs to enforce ownership + status invariants.
 */
export interface ApplicationOfferSelectionSnapshot {
  id: string;
  applicantUserId: string;
  status: PrismaApplicationStatus;
  userProceededAt: Date | null;
  userSelectedBankOfferId: string | null;
}

/**
 * Mapped domain type for the offer-selection flow's read of bank-offer
 * ownership inside the offer-selection transaction. Intra-feature
 * because BankOffer queries live in the applications feature.
 */
export interface BankOfferOwnershipSnapshot {
  id: string;
  applicationId: string;
  erasedAt: Date | null;
}

@Injectable()
export class ApplicationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async persistMatch(input: PersistMatchInput): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.application.create({
        // Local enum values mirror Prisma's exactly; cast at the boundary.
        data: input.application as unknown as Prisma.ApplicationUncheckedCreateInput,
      });
      if (input.offers.length > 0) {
        await tx.bankOffer.createMany({
          data: input.offers.map((o) => ({
            ...o,
            applicationId: created.id,
            // Domain `JsonValueInput` -> Prisma `InputJsonValue` boundary cast.
            feesBreakdown: o.feesBreakdown as unknown as Prisma.InputJsonValue,
            approvalFactors: o.approvalFactors as unknown as Prisma.InputJsonValue,
            cascadeTrace: o.cascadeTrace as unknown as Prisma.InputJsonValue,
          })),
        });
      }
      if (input.questionnaire) {
        await tx.questionnaireAnswer.create({
          data: {
            customerId: input.questionnaire.customerId,
            applicationId: created.id,
            payloadJson: input.questionnaire.payloadJson as unknown as Prisma.InputJsonValue,
          },
        });
      }
      if (input.dynamicAnswers && input.dynamicAnswers.length > 0) {
        await tx.applicationAnswer.createMany({
          data: input.dynamicAnswers.map((a) => ({
            applicationId: created.id,
            questionId: a.questionId,
            questionCode: a.questionCode,
            selectedOptionCodes: a.selectedOptionCodes,
            selectedOptionId: a.selectedOptionId,
            selectedOptionCode: a.selectedOptionCode,
            textValue: a.textValue,
            numericValue: a.numericValue === null ? null : new Prisma.Decimal(a.numericValue),
          })),
        });
      }
      if (input.txCallback) {
        await input.txCallback(tx, created.id);
      }
      return created.id;
    });
  }

  async findById(id: string) {
    return this.prisma.application.findUnique({
      where: { id },
      // All offers for one application are created in the same transaction, so
      // `createdAt` (Postgres `now()`) is identical across rows and cannot rank
      // them — order by the engine's own score, matching the original ranking.
      include: {
        bankOffers: {
          where: { erasedAt: null },
          orderBy: [{ approvalScore: 'desc' }, { createdAt: 'asc' }],
          // The bank's verdict on the offer the applicant committed to. Admins
          // triage on "what loan did this person actually take, and what came
          // back" — without it the detail page could only show candidates.
          include: { decision: true },
        },
        // Identity + contact of the applicant behind this application, surfaced
        // to admins on the detail page. Only the fields already exposed by
        // GET /admin/customers/:id are read; `profilePhotoKey` drives a
        // `hasProfilePhoto` flag (the image is served via the presigned
        // applicant-documents route, never as a raw key).
        applicantCustomer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            birthday: true,
            governorate: true,
            city: true,
            address: true,
            locale: true,
            registrationPath: true,
            isVerified: true,
            isActive: true,
            mobileVerifiedAt: true,
            createdAt: true,
            lastLoginAt: true,
            profilePhotoKey: true,
          },
        },
        // The applicant's real questionnaire responses (Feature 009). Labels are
        // resolved from the frozen version snapshot via `questionnaireVersionId`;
        // these rows carry the picked codes. Surfaced on the admin detail page in
        // place of the derived `applicantProfile` blob.
        dynamicAnswers: true,
      },
    });
  }

  /**
   * Customer's own "applied" applications — those where the user proceeded
   * with a specific offer (Feature 008 user-intent gate). Includes the
   * selected offer's bank decision (if any) so the caller can derive an
   * Applied/Approved/Rejected status without a second query.
   */
  async findAppliedByCustomer(customerId: string) {
    return this.prisma.application.findMany({
      where: {
        applicantUserId: customerId,
        userSelectedBankOfferId: { not: null },
        status: { not: 'erased' as PrismaApplicationStatus },
      },
      orderBy: { userProceededAt: 'desc' },
      include: {
        bankOffers: {
          where: { erasedAt: null },
          include: { decision: true },
        },
      },
    });
  }

  /**
   * ONE application by id, same shape as {@link findAppliedByCustomer} — the
   * read behind the Applications screen's "View offer" tap, which fetches the
   * offer fresh instead of reopening the row the client cached when it drew the
   * list (a decision, a saved-offer toggle, or an erased offer can land in
   * between). Ownership is deliberately NOT filtered here: the service tells
   * "no such application" (404) apart from "not yours" (403), exactly as
   * `selectOffer` does.
   */
  async findAppliedById(id: string) {
    return this.prisma.application.findFirst({
      where: {
        id,
        status: { not: 'erased' as PrismaApplicationStatus },
      },
      include: {
        bankOffers: {
          where: { erasedAt: null },
          include: { decision: true },
        },
      },
    });
  }

  /**
   * Cross-feature read: returns just the fields needed to enforce
   * customer + device ownership. Used by the documents feature so the
   * documents service does not need direct Prisma access.
   */
  async findOwnershipById(id: string): Promise<ApplicationOwnership | null> {
    const row = await this.prisma.application.findUnique({
      where: { id },
      select: { id: true, applicantUserId: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      applicantUserId: row.applicantUserId,
    };
  }

  async findByIdempotencyKey(applicantUserId: string, idempotencyKey: string) {
    return this.prisma.application.findFirst({
      where: { applicantUserId, idempotencyKey },
      include: {
        bankOffers: {
          where: { erasedAt: null },
          orderBy: [{ approvalScore: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async findManyAdmin(params: {
    status?: ApplicationStatus[];
    leadStatus?: LeadStatus[];
    loanPurpose?: string;
    tier?: 'high' | 'medium';
    cursor?: string;
    limit?: number;
    /**
     * Feature 008 user-intent gate: defaults to true — admin triage only sees
     * applications where the applicant explicitly selected an offer and
     * proceeded. Set false to inspect pre-proceed funnel.
     */
    onlyProceeded?: boolean;
  }) {
    const where: Prisma.ApplicationWhereInput = {};
    const onlyProceeded = params.onlyProceeded ?? true;
    if (onlyProceeded) where.userProceededAt = { not: null };
    if (params.status?.length)
      where.status = { in: params.status as unknown as PrismaApplicationStatus[] };
    if (params.leadStatus?.length)
      where.leadStatus = { in: params.leadStatus as unknown as PrismaLeadStatus[] };
    if (params.loanPurpose) where.loanPurpose = params.loanPurpose;

    if (params.tier === 'high') {
      where.bankOffers = { some: { approvalTier: 'excellent', erasedAt: null } };
    } else if (params.tier === 'medium') {
      where.AND = [
        { bankOffers: { some: { approvalTier: 'good', erasedAt: null } } },
        { bankOffers: { none: { approvalTier: 'excellent', erasedAt: null } } },
      ];
    }

    return this.prisma.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 25,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        bankOffers: {
          where: { erasedAt: null },
          orderBy: [{ approvalScore: 'desc' }, { createdAt: 'asc' }],
          include: { decision: true },
        },
        // Applicant name for the admin list rows (no longer anonymous).
        applicantCustomer: { select: { firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Read the minimal projection used by the offer-selection flow (Constitution
   * Principle X — services may not call `tx.application.findUnique` directly).
   * Accepts an optional `tx` so the service can call inside a
   * `$transaction(async (tx) => …)` callback.
   */
  async findForOfferSelection(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ApplicationOfferSelectionSnapshot | null> {
    const client = tx ?? this.prisma;
    const row = await client.application.findUnique({
      where: { id },
      select: {
        id: true,
        applicantUserId: true,
        status: true,
        userProceededAt: true,
        userSelectedBankOfferId: true,
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      applicantUserId: row.applicantUserId,
      status: row.status,
      userProceededAt: row.userProceededAt,
      userSelectedBankOfferId: row.userSelectedBankOfferId,
    };
  }

  /**
   * Read the minimal projection of a BankOffer used by the offer-selection
   * flow to enforce (a) the offer exists and isn't erased, (b) the offer
   * belongs to the application. BankOffer queries live in this repository
   * because the applications feature owns the BankOffer table.
   */
  async findBankOfferOwnership(
    bankOfferId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<BankOfferOwnershipSnapshot | null> {
    const client = tx ?? this.prisma;
    const row = await client.bankOffer.findUnique({
      where: { id: bankOfferId },
      select: { id: true, applicationId: true, erasedAt: true },
    });
    if (!row) return null;
    return {
      id: row.id,
      applicationId: row.applicationId,
      erasedAt: row.erasedAt,
    };
  }

  /**
   * Write helper for the offer-selection flow — sets the user-selected
   * bank offer and the user-proceeded timestamp atomically. Intended to
   * be called inside the service's `$transaction` callback.
   */
  async markOfferSelected(
    input: {
      applicationId: string;
      bankOfferId: string;
      proceededAt: Date;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.application.update({
      where: { id: input.applicationId },
      data: {
        userSelectedBankOfferId: input.bankOfferId,
        userProceededAt: input.proceededAt,
      },
    });
  }

  /** Light read of the current lead status — existence guard + audit `from`. */
  async findLeadStatus(id: string): Promise<{ id: string; leadStatus: LeadStatus } | null> {
    const row = await this.prisma.application.findUnique({
      where: { id },
      select: { id: true, leadStatus: true },
    });
    if (!row) return null;
    return { id: row.id, leadStatus: row.leadStatus as unknown as LeadStatus };
  }

  /** Set the sales pipeline status (admin-managed). */
  async updateLeadStatus(
    id: string,
    leadStatus: LeadStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.application.update({
      where: { id },
      data: { leadStatus: leadStatus as unknown as PrismaLeadStatus },
    });
  }
}
