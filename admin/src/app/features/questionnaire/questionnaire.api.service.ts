import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

export type LoanCategory = 'personal' | 'car' | 'mortgage' | 'business';
export const LOAN_CATEGORIES: LoanCategory[] = ['personal', 'car', 'mortgage', 'business'];

/**
 * Friendly, localized label for a loan category. Single source for both the
 * questionnaire overview and the editor tab strip so naming stays consistent
 * (`car` → "Auto Loan"). Arabic lands in messages.ar-EG.xlf on extraction.
 */
export function categoryLabel(cat: LoanCategory): string {
  switch (cat) {
    case 'personal':
      return $localize`:@@loan.cat.personal:Personal Loan`;
    case 'car':
      return $localize`:@@loan.cat.car:Auto Loan`;
    case 'mortgage':
      return $localize`:@@loan.cat.mortgage:Mortgage`;
    case 'business':
      return $localize`:@@loan.cat.business:Business Loan`;
  }
}

/** One answer option that can carry per-program points. */
export interface WeightableOption {
  code: string;
  labelAr: string;
  labelEn: string;
}

/** A question (with its options) shown in the per-answer weights editor. */
export interface WeightableQuestion {
  code: string;
  labelAr: string;
  labelEn: string;
  options: WeightableOption[];
}

/** Bank + program identity for labelling a per-program weight set. */
export interface ProgramMeta {
  programCode: string;
  friendlyName: string;
  friendlyNameAr: string | null;
  bankName: string;
  category: string;
}

export type WeightSetStatus = 'ACTIVE' | 'ARCHIVED';

/** Two-level scoring (v8): per-question weights (sum 100) + per-answer scores (0–100). */
export interface ProgramScoringWeights {
  questionWeights: Record<string, number>;
  answerScores: Record<string, Record<string, number>>;
}

export interface ScoringWeightSet {
  id: string;
  bankProgramId: string;
  status: WeightSetStatus;
  versionNumber: number;
  /** Two-level: questionWeights (sum 100) + answerScores (0–100). */
  weights: ProgramScoringWeights;
  createdBy: string;
  createdAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export interface ProgramWeights {
  program: ProgramMeta;
  active: ScoringWeightSet | null;
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
}
export interface CreateOptionBody {
  labelAr: string;
  labelEn: string;
  displayOrder: number;
}

/** Group edits — title/order only; `code` and `category` are immutable (A33). */
export interface UpdateGroupBody {
  titleAr?: string;
  titleEn?: string;
  displayOrder?: number;
}
/** Question edits — `code` and `category` are immutable (A33). */
export interface UpdateQuestionBody {
  questionAr?: string;
  questionEn?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
}
/** Option edits — `code` is immutable (A33). */
export interface UpdateOptionBody {
  labelAr?: string;
  labelEn?: string;
  displayOrder?: number;
  isActive?: boolean;
}

/** Admin API for Feature 009 (questionnaire + per-question scoring weights, v5.0.0). */
@Injectable({ providedIn: 'root' })
export class QuestionnaireApiService {
  private readonly http = inject(HttpClient);
  private base(): string {
    return environment.apiBaseUrl;
  }

  // ---- Scoring weights (direct save, per-answer points) ------------------
  /** Category questions WITH their answer options (the per-answer weighting grid). */
  weightableQuestions(category: LoanCategory): Promise<WeightableQuestion[]> {
    return this.get<WeightableQuestion[]>(`/scoring/questions/${category}`);
  }

  programWeights(programId: string): Promise<ProgramWeights> {
    return this.get<ProgramWeights>(`/scoring/programs/${programId}/weights`);
  }

  /** Save two-level scoring (v8): question weights (sum 100) + answer scores (0–100). */
  saveWeights(programId: string, weights: ProgramScoringWeights): Promise<ScoringWeightSet> {
    return this.post<ScoringWeightSet>(`/scoring/programs/${programId}/weights`, { weights });
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
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<T>>(`${this.base()}${path}`, body),
    );
    return res.data;
  }
  private async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await firstValueFrom(
      this.http.patch<SuccessEnvelope<T>>(`${this.base()}${path}`, body),
    );
    return res.data;
  }
  private async del<T>(path: string): Promise<T> {
    const res = await firstValueFrom(this.http.delete<SuccessEnvelope<T>>(`${this.base()}${path}`));
    return res.data;
  }
}
