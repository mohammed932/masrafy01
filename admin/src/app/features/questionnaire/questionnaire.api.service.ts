import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

export type LoanCategory = 'personal' | 'car' | 'mortgage' | 'business';
export const LOAN_CATEGORIES: LoanCategory[] = ['personal', 'car', 'mortgage', 'business'];

export interface ScoringFactor {
  id: string;
  category: LoanCategory;
  code: string;
  kind: 'DIRECT' | 'COMPUTED';
  labelAr: string;
  labelEn: string;
}

export type WeightSetStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED' | 'REJECTED';

export interface ScoringWeightSet {
  id: string;
  bankProgramId: string;
  status: WeightSetStatus;
  versionNumber: number;
  weights: Record<string, number>;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
}

export interface ProgramWeights {
  active: ScoringWeightSet | null;
  draft: ScoringWeightSet | null;
  pending: ScoringWeightSet | null;
}

export interface QuestionnaireVersionRow {
  id: string;
  category: LoanCategory;
  versionNumber: number;
  isActive: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
}

/** Admin API for Feature 009 (questionnaire + scoring weights maker-checker). */
@Injectable({ providedIn: 'root' })
export class QuestionnaireApiService {
  private readonly http = inject(HttpClient);
  private base(): string {
    return environment.apiBaseUrl;
  }

  // ---- Scoring weights (maker-checker) ----------------------------------
  listFactors(category: LoanCategory): Promise<ScoringFactor[]> {
    return this.get<ScoringFactor[]>(`/scoring/factors/${category}`);
  }

  programWeights(programId: string): Promise<ProgramWeights> {
    return this.get<ProgramWeights>(`/scoring/programs/${programId}/weights`);
  }

  saveDraft(programId: string, weights: Record<string, number>): Promise<ScoringWeightSet> {
    return this.post<ScoringWeightSet>(`/scoring/programs/${programId}/weights/draft`, { weights });
  }

  submitWeights(programId: string): Promise<ScoringWeightSet> {
    return this.post<ScoringWeightSet>(`/scoring/programs/${programId}/weights/submit`, {});
  }

  pendingInbox(): Promise<ScoringWeightSet[]> {
    return this.get<ScoringWeightSet[]>(`/scoring/weights/pending`);
  }

  approveWeights(setId: string): Promise<ScoringWeightSet> {
    return this.post<ScoringWeightSet>(`/scoring/weights/${setId}/approve`, {});
  }

  rejectWeights(setId: string, reason: string): Promise<ScoringWeightSet> {
    return this.post<ScoringWeightSet>(`/scoring/weights/${setId}/reject`, { reason });
  }

  weightsHistory(programId: string): Promise<ScoringWeightSet[]> {
    return this.get<ScoringWeightSet[]>(`/scoring/programs/${programId}/weights/history`);
  }

  // ---- Questionnaire versions -------------------------------------------
  versionHistory(category: LoanCategory): Promise<QuestionnaireVersionRow[]> {
    return this.get<QuestionnaireVersionRow[]>(`/questionnaire/versions/${category}/history`);
  }

  publish(category: LoanCategory): Promise<QuestionnaireVersionRow> {
    return this.post<QuestionnaireVersionRow>(`/questionnaire/versions/${category}/publish`, {});
  }

  // ---- HTTP helpers ------------------------------------------------------
  private async get<T>(path: string): Promise<T> {
    const res = await firstValueFrom(this.http.get<SuccessEnvelope<T>>(`${this.base()}${path}`));
    return res.data;
  }
  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await firstValueFrom(this.http.post<SuccessEnvelope<T>>(`${this.base()}${path}`, body));
    return res.data;
  }
}
