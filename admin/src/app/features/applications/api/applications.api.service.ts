import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { SuccessEnvelope, PaginatedEnvelope } from '@core/auth/auth.types';
import type { LeadStatus } from '../shared/lead-status';

export interface AdminApplicationRow {
  id: string;
  status: string;
  leadStatus: LeadStatus;
  priority: string;
  requestedAmountEGP: string;
  loanPurpose: string;
  age: number;
  createdAt: string;
  eligibleProgramsCount: number;
  programsCheckedCount: number;
  applicant: { firstName: string; lastName: string } | null;
  maskedApplicant: Record<string, unknown>;
  userProceededAt?: string | null;
  userSelectedBankOfferId?: string | null;
  selectedOfferDecision?: 'approved' | 'rejected' | 'withdrawn' | null;
}

/** Fee lines frozen on the offer at match time. All values are Decimal strings. */
export interface OfferFeesBreakdown {
  adminFeeEGP?: string;
  adminFeeWaived?: boolean;
  stampDutyEGP?: string;
  lifeInsuranceEGP?: string;
  lifeInsuranceWaived?: boolean;
  collateralFeeEGP?: string;
  effectiveRateAfterPenaltiesPercent?: string;
}

/** The bank's verdict on an offer the applicant committed to. */
export interface OfferDecision {
  outcome: 'approved' | 'rejected' | 'withdrawn';
  recordedAt: string;
}

export interface AdminApplicationOffer {
  id: string;
  /** True for the offer the applicant proceeded with (feature 008 gate). */
  isSelected: boolean;
  programCode: string;
  programVersion: number;
  bankName: string;
  bankIsFeatured: boolean;
  isShariaCompliant: boolean;
  programFriendlyName: string;
  effectiveRatePercent: string;
  monthlyInstallmentEGP: string;
  requestedLoanAmountEGP: string;
  effectiveLoanAmountEGP: string;
  requestedTenorMonths: number;
  effectiveTenorMonths: number;
  /** installment × tenor, and the part of it that is not principal. */
  totalPayableEGP: string;
  totalCostOfCreditEGP: string;
  feesBreakdown: OfferFeesBreakdown;
  /**
   * The position this offer held in the ranked list the CUSTOMER was shown,
   * 0-based and dense per application. Frozen at apply time on
   * `bank_offer.rankIndex`; every read of a persisted offer orders by it.
   *
   * Optional because offers written before that column existed carry none. That
   * is the whole reason `offer-order.ts` keeps a deterministic fallback chain —
   * do not delete it as dead code.
   */
  rankIndex?: number;
  requiredDocuments: string[];
  matchReasons: string[];
  cascadeTrace: unknown;
  qualitativeReviewBadge: boolean;
  selfDeclared: boolean;
  maxLoanAvailableEGP?: string;
  dbrPercent: string | null;
  dbrCapPercent: string | null;
  decision: OfferDecision | null;
}

/** Applicant identity + contact, joined from the owning customer account. */
export interface ApplicantIdentity {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  age: number | null;
  governorate: string | null;
  city: string | null;
  address: string | null;
  locale: string;
  registrationPath: 'PHONE' | 'SOCIAL';
  isVerified: boolean;
  isActive: boolean;
  mobileVerifiedAt: string | null;
  memberSince: string;
  lastLoginAt: string | null;
  hasProfilePhoto: boolean;
}

/** One answered question in the applicant's questionnaire (bilingual labels). */
export interface ApplicantAnswerItem {
  questionCode: string;
  questionAr: string;
  questionEn: string;
  answerAr: string | null;
  answerEn: string | null;
}

export interface ApplicantAnswerGroup {
  code: string;
  titleAr: string;
  titleEn: string;
  items: ApplicantAnswerItem[];
}

/** The applicant's real questionnaire responses, from the frozen version snapshot. */
export interface ApplicantQuestionnaire {
  category: string;
  versionNumber: number;
  groups: ApplicantAnswerGroup[];
}

export interface AdminApplicationDetail {
  id: string;
  status: string;
  leadStatus: LeadStatus;
  priority: string;
  requestedAmountEGP: string;
  preferredTenorMonths: number;
  loanPurpose: string;
  age: number;
  createdAt: string;
  submissionCorrelationId: string;
  engineDurationMs: number | null;
  programsCheckedCount: number;
  eligibleProgramsCount: number;
  summary: unknown;
  noMatchSummary: unknown;
  applicant: ApplicantIdentity | null;
  // Real user-submitted questionnaire responses. `applicantProfile` is kept only
  // for the masked National ID number the documents card reads — not shown as data.
  questionnaire: ApplicantQuestionnaire | null;
  applicantProfile: Record<string, unknown>;
  /** Loan category + catalog archetype that narrowed the matched program set. */
  category: string | null;
  programNameKey: string | null;
  /** The offer the applicant actually committed to; null if they never proceeded. */
  userSelectedBankOfferId: string | null;
  userProceededAt: string | null;
  selectedOffer: AdminApplicationOffer | null;
  offers: AdminApplicationOffer[];
}

/** One National ID side in the applicant-documents view. */
export interface ApplicantDocumentSide {
  id: string;
  status: string;
  uploadedAt: string;
}

/** Applicant document binaries: profile photo (presigned) + National ID sides. */
export interface ApplicantDocuments {
  profilePhoto: { url: string; expiresAt: string } | null;
  nationalId: {
    front: ApplicantDocumentSide | null;
    back: ApplicantDocumentSide | null;
  };
}

@Injectable({ providedIn: 'root' })
export class ApplicationsApiService {
  private readonly http = inject(HttpClient);

  private base(): string {
    return environment.apiBaseUrl;
  }

  async list(
    opts: {
      cursor?: string;
      limit?: number;
      leadStatus?: LeadStatus;
    } = {},
  ): Promise<{
    rows: readonly AdminApplicationRow[];
    nextCursor: string | null;
  }> {
    let params = new HttpParams();
    if (opts.cursor) params = params.set('cursor', opts.cursor);
    if (opts.limit) params = params.set('limit', String(opts.limit));
    if (opts.leadStatus) params = params.set('leadStatus', opts.leadStatus);
    const res = await firstValueFrom(
      this.http.get<PaginatedEnvelope<AdminApplicationRow>>(`${this.base()}/applications`, {
        params,
      }),
    );
    return {
      rows: res.data,
      nextCursor:
        (res as unknown as { pagination?: { nextCursor: string | null } }).pagination?.nextCursor ??
        null,
    };
  }

  async getById(id: string): Promise<AdminApplicationDetail> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<AdminApplicationDetail>>(`${this.base()}/applications/${id}`),
    );
    return res.data;
  }

  /** Set the sales pipeline status of an application (lead). */
  async updateLeadStatus(id: string, leadStatus: LeadStatus): Promise<void> {
    await firstValueFrom(
      this.http.patch<SuccessEnvelope<unknown>>(`${this.base()}/applications/${id}/lead-status`, {
        leadStatus,
      }),
    );
  }

  /**
   * Applicant document binaries — profile photo (presigned) + National ID side
   * metadata. Restricted to super_admin / sales_manager / sales_agent server-
   * side; analysts receive 403 (the UI hides the section for them).
   */
  async getApplicantDocuments(id: string): Promise<ApplicantDocuments> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<ApplicantDocuments>>(
        `${this.base()}/applications/${id}/documents`,
      ),
    );
    return res.data;
  }

  /** Reveal one National ID image — returns a short-lived presigned URL (audited). */
  async revealApplicantDocument(
    id: string,
    documentId: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<{ url: string; expiresAt: string }>>(
        `${this.base()}/applications/${id}/documents/${documentId}/reveal`,
      ),
    );
    return res.data;
  }
}
