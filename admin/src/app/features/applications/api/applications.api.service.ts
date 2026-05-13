import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { SuccessEnvelope, PaginatedEnvelope } from '@core/auth/auth.types';
import type { ApprovalTier, BestOfferSummary } from '../list/components/approval-pill.component';
import type { TierFilter } from '../list/components/tier-filter-chips.component';

export interface FactorImpact {
  code: string;
  impact: number;
}

export interface ApprovalProbability {
  score: number;
  tier: ApprovalTier;
  tierLabelCode: string;
  factors: { positive: FactorImpact[]; negative: FactorImpact[]; legacy?: boolean };
  engineVersion: string;
}

export interface AdminApplicationRow {
  id: string;
  status: string;
  priority: string;
  requestedAmountEGP: string;
  requestedCurrency: string;
  loanPurpose: string;
  age: number;
  createdAt: string;
  eligibleProgramsCount: number;
  programsCheckedCount: number;
  maskedApplicant: Record<string, unknown>;
  bestOffer: BestOfferSummary | null;
}

export interface AdminApplicationOffer {
  programCode: string;
  programVersion: number;
  bankName: string;
  programFriendlyName: string;
  currency: string;
  effectiveRatePercent: string;
  monthlyInstallmentEGP: string;
  effectiveTenorMonths: number;
  approvalProbability: ApprovalProbability;
  requiredDocuments: string[];
  matchReasons: string[];
  cascadeTrace: unknown;
  qualitativeReviewBadge: boolean;
  selfDeclared: boolean;
}

export type LeadStatus =
  | 'needs_first_contact'
  | 'document_collection'
  | 'ready_for_submission'
  | 'submitted_to_bank'
  | 'bank_decided';

export interface AdminApplicationDetail {
  id: string;
  status: string;
  priority: string;
  requestedAmountEGP: string;
  requestedCurrency: string;
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
  applicantProfile: Record<string, unknown>;
  offers: AdminApplicationOffer[];
  leadStatus?: LeadStatus;
  assignedAgentStaffId?: string | null;
  assignedAt?: string | null;
}

export interface AttachedDocumentSummary {
  id: string;
  documentType: string;
  status: 'uploaded' | 'verified' | 'rejected' | 'erased';
  uploadedBySource: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ActivityRow {
  id: string;
  applicationId: string;
  actorStaffId: string | null;
  actorRole: string;
  activityType: string;
  reason: string;
  note: string | null;
  durationMinutes: number | null;
  outcomeFlags: string[];
  followUpAt: string | null;
  attachedDocumentIds: string[];
  attachedDocuments?: AttachedDocumentSummary[];
  meta: Record<string, unknown> | null;
  correlationId: string;
  occurredAt: string;
}

export interface ActivityListResponse {
  activities: ActivityRow[];
}

export interface CreateActivityRequest {
  activityType: string;
  reason: string;
  note?: string;
  durationMinutes?: number;
  outcomeFlags?: string[];
  followUpAt?: string;
  attachedDocuments?: Array<{
    documentId: string;
    documentType: string;
    s3Key: string;
    mimeType: string;
    sizeBytes: number;
    originalFilename: string;
    uploadedBySource: string;
  }>;
  meta?: Record<string, unknown>;
}

export interface CreateActivityResponse {
  activityId: string;
  correlationId: string;
  newLeadStatus: LeadStatus | null;
  previousLeadStatus: LeadStatus | null;
}

export interface PresignedUploadResponse {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
  expiresAt: string;
  maxSizeBytes: number;
}

export interface RequestUploadUrlBody {
  applicationId: string;
  documentType: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  uploadedBySource: string;
}

@Injectable({ providedIn: 'root' })
export class ApplicationsApiService {
  private readonly http = inject(HttpClient);

  private base(): string {
    return environment.apiBaseUrl;
  }

  async list(opts: { tier?: TierFilter; cursor?: string; limit?: number } = {}): Promise<{
    rows: readonly AdminApplicationRow[];
    nextCursor: string | null;
  }> {
    let params = new HttpParams();
    if (opts.tier) params = params.set('tier', opts.tier);
    if (opts.cursor) params = params.set('cursor', opts.cursor);
    if (opts.limit) params = params.set('limit', String(opts.limit));
    const res = await firstValueFrom(
      this.http.get<PaginatedEnvelope<AdminApplicationRow>>(`${this.base()}/applications`, {
        params,
      }),
    );
    return {
      rows: res.data,
      nextCursor: (res as unknown as { pagination?: { nextCursor: string | null } }).pagination
        ?.nextCursor ?? null,
    };
  }

  async getById(id: string): Promise<AdminApplicationDetail> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<AdminApplicationDetail>>(`${this.base()}/applications/${id}`),
    );
    return res.data;
  }

  async listActivities(
    applicationId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ rows: ActivityRow[]; nextCursor: string | null }> {
    let params = new HttpParams();
    if (opts.cursor) params = params.set('cursor', opts.cursor);
    if (opts.limit) params = params.set('limit', String(opts.limit));
    const res = await firstValueFrom(
      this.http.get<{
        success: true;
        data: ActivityListResponse;
        pagination?: { nextCursor: string | null };
      }>(`${this.base()}/applications/${applicationId}/activities`, { params }),
    );
    return {
      rows: res.data.activities,
      nextCursor: res.pagination?.nextCursor ?? null,
    };
  }

  async createActivity(
    applicationId: string,
    body: CreateActivityRequest,
  ): Promise<CreateActivityResponse> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<CreateActivityResponse>>(
        `${this.base()}/applications/${applicationId}/activities`,
        body,
      ),
    );
    return res.data;
  }

  async requestUploadUrl(body: RequestUploadUrlBody): Promise<PresignedUploadResponse> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<PresignedUploadResponse>>(
        `${this.base()}/documents/upload-url`,
        body,
      ),
    );
    return res.data;
  }

  async getDownloadUrl(documentId: string): Promise<{ downloadUrl: string; expiresAt: string }> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<{ downloadUrl: string; expiresAt: string }>>(
        `${this.base()}/documents/${documentId}/download`,
      ),
    );
    return res.data;
  }

  async putToS3(uploadUrl: string, file: File): Promise<void> {
    await firstValueFrom(
      this.http.put(uploadUrl, file, {
        headers: { 'Content-Type': file.type },
      }),
    );
  }
}
