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
}
