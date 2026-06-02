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
  /** Question this DIRECT factor scores (null for COMPUTED factors). */
  sourceQuestionCode: string | null;
  sourceQuestionLabelEn: string | null;
  sourceQuestionLabelAr: string | null;
}

/** Bank + program identity for labelling a per-program weight set. */
export interface ProgramMeta {
  programCode: string;
  friendlyName: string;
  friendlyNameAr: string | null;
  bankName: string;
  category: string;
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
  program: ProgramMeta;
  active: ScoringWeightSet | null;
  draft: ScoringWeightSet | null;
  pending: ScoringWeightSet | null;
}

/** A pending weight set joined with its program/bank identity (checker inbox). */
export interface PendingWeightSet extends ScoringWeightSet {
  program: ProgramMeta;
}

export interface QuestionnaireVersionRow {
  id: string;
  category: LoanCategory;
  versionNumber: number;
  isActive: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface OptionRow {
  id: string;
  code: string;
  labelAr: string;
  labelEn: string;
  displayOrder: number;
  isActive: boolean;
  numericMin: string | null;
  numericMax: string | null;
  numericPoint: string | null;
  scoreValue: string | null;
  profileValue: string | null;
}
export interface QuestionRow {
  id: string;
  groupId: string;
  code: string;
  questionAr: string;
  questionEn: string;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  systemRole: string | null;
  scoringFactorCode: string | null;
  profileField: string | null;
  enabledWhen: { questionCode: string; operator: string; optionCode: string } | null;
  options: OptionRow[];
}
export interface GroupTreeRow {
  id: string;
  code: string;
  category: LoanCategory;
  titleAr: string;
  titleEn: string;
  displayOrder: number;
  isActive: boolean;
  questions: QuestionRow[];
}

/** One program's outcome in the admin matching simulator. */
export interface SimulationMatch {
  bankProgramId: string | null;
  programCode: string;
  bankName: string;
  bankIsFeatured: boolean;
  programFriendlyName: string;
  eligible: boolean;
  monthlyInstallmentEGP: string | null;
  effectiveRatePercent: string | null;
  approvalProbability: number; // 0..1
  approvalTier: string;
  rejectionReasons: string[];
  requiredDocuments: string[];
  usedDefaultWeights: boolean;
}

export interface SimulationSuggestion {
  code: string;
  magnitude: number;
  programsUnlocked: number;
}

export interface SimulationResult {
  category: LoanCategory;
  matches: SimulationMatch[];
  suggestions: SimulationSuggestion[];
}

export interface CreateGroupBody {
  category: LoanCategory;
  titleAr: string;
  titleEn: string;
  displayOrder: number;
}
export interface CreateQuestionBody {
  groupId: string;
  category: LoanCategory;
  questionAr: string;
  questionEn: string;
  displayOrder: number;
  isRequired?: boolean;
  systemRole?: string;
  scoringFactorCode?: string;
  profileField?: string;
}
export interface CreateOptionBody {
  labelAr: string;
  labelEn: string;
  displayOrder: number;
  numericMin?: number;
  numericMax?: number;
  numericPoint?: number;
  scoreValue?: number;
  profileValue?: string;
}

/** Group edits — title/order only; `code` and `category` are immutable (A33). */
export interface UpdateGroupBody {
  titleAr?: string;
  titleEn?: string;
  displayOrder?: number;
}
/** Question edits — `code`, `category`, `systemRole` are immutable (A33). */
export interface UpdateQuestionBody {
  questionAr?: string;
  questionEn?: string;
  displayOrder?: number;
  isRequired?: boolean;
  scoringFactorCode?: string;
  profileField?: string;
}
/** Option edits — `code` is immutable (A33). */
export interface UpdateOptionBody {
  labelAr?: string;
  labelEn?: string;
  displayOrder?: number;
  numericMin?: number;
  numericMax?: number;
  numericPoint?: number;
  scoreValue?: number;
  profileValue?: string;
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

  pendingInbox(): Promise<PendingWeightSet[]> {
    return this.get<PendingWeightSet[]>(`/scoring/weights/pending`);
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

  // ---- Questionnaire authoring ------------------------------------------
  tree(category: LoanCategory): Promise<GroupTreeRow[]> {
    return this.get<GroupTreeRow[]>(`/questionnaire/tree/${category}`);
  }

  // ---- Matching simulator (admin) ---------------------------------------
  /** Run the full engine + per-bank approval scoring for a sample applicant. */
  simulateMatching(
    category: LoanCategory,
    answers: { questionCode: string; optionCode: string }[],
  ): Promise<SimulationResult> {
    return this.post<SimulationResult>(`/matching/simulate`, { category, answers });
  }

  createGroup(body: CreateGroupBody): Promise<GroupTreeRow> {
    return this.post<GroupTreeRow>(`/questionnaire/groups`, body);
  }

  updateGroup(id: string, body: UpdateGroupBody): Promise<GroupTreeRow> {
    return this.patch<GroupTreeRow>(`/questionnaire/groups/${id}`, body);
  }

  deleteGroup(id: string): Promise<GroupTreeRow> {
    return this.del<GroupTreeRow>(`/questionnaire/groups/${id}`);
  }

  createQuestion(body: CreateQuestionBody): Promise<QuestionRow> {
    return this.post<QuestionRow>(`/questionnaire/questions`, body);
  }

  updateQuestion(id: string, body: UpdateQuestionBody): Promise<QuestionRow> {
    return this.patch<QuestionRow>(`/questionnaire/questions/${id}`, body);
  }

  deleteQuestion(id: string): Promise<QuestionRow> {
    return this.del<QuestionRow>(`/questionnaire/questions/${id}`);
  }

  createOption(questionId: string, body: CreateOptionBody): Promise<OptionRow> {
    return this.post<OptionRow>(`/questionnaire/questions/${questionId}/options`, body);
  }

  updateOption(optionId: string, body: UpdateOptionBody): Promise<OptionRow> {
    return this.patch<OptionRow>(`/questionnaire/options/${optionId}`, body);
  }

  deleteOption(optionId: string): Promise<OptionRow> {
    return this.del<OptionRow>(`/questionnaire/options/${optionId}`);
  }

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
  private async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await firstValueFrom(this.http.patch<SuccessEnvelope<T>>(`${this.base()}${path}`, body));
    return res.data;
  }
  private async del<T>(path: string): Promise<T> {
    const res = await firstValueFrom(this.http.delete<SuccessEnvelope<T>>(`${this.base()}${path}`));
    return res.data;
  }
}
