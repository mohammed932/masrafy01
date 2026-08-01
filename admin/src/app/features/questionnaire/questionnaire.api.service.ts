import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';

// Loan-category set + labels now live in @core/loan-category (shared across
// questionnaire, banks, and the bank-program form). Imported locally (this file
// uses the `LoanCategory` type in its method signatures) and re-exported so the
// existing questionnaire importers keep their import path unchanged.
import {
  LOAN_CATEGORIES,
  categoryLabel,
  isLoanCategory,
  type LoanCategory,
} from '@core/loan-category';
export { LOAN_CATEGORIES, categoryLabel, isLoanCategory, type LoanCategory };

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
  versionNumber: number;
  isActive: boolean;
  publishedAt: string | null;
  publishedBy: string | null;
}

/**
 * Feature 010 — a non-blocking publish warning (FR-049). Publishing SUCCEEDS with
 * warnings: blocking it would strand the admin while a money binding is renamed.
 * The consequence of ignoring one is that quotes for affected applicants return
 * `MONEY_FIGURE_MISSING` instead of a defaulted zero (FR-044).
 *
 * `code` is a backend error code, so it renders through the same
 * `error-codes.{ar-EG,en-US}.json` files as any typed error (Principle III).
 */
export interface PublishWarning {
  code: string;
  meta: Record<string, unknown>;
}

export type PublishResult = QuestionnaireVersionRow & { warnings?: PublishWarning[] };

export interface OptionRow {
  id: string;
  code: string;
  labelAr: string;
  labelEn: string;
  displayOrder: number;
  isActive: boolean;
}

/**
 * Feature 010 — the four question types are all real. Only `SINGLE_SELECT` is
 * scoreable (R9 / A33): the approval formula needs one picked answer score per
 * question, which multi-pick, text and number cannot supply.
 */
export const QUESTION_TYPES = ['SINGLE_SELECT', 'MULTI_SELECT', 'TEXT', 'NUMERIC'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const CHOICE_QUESTION_TYPES: readonly QuestionType[] = ['SINGLE_SELECT', 'MULTI_SELECT'];

export function isChoiceQuestionType(type: QuestionType): boolean {
  return CHOICE_QUESTION_TYPES.includes(type);
}

/** NUMERIC rules — CONTENT bounds + display unit. Money crosses as decimal strings. */
export interface NumericRules {
  minValue: string | null;
  maxValue: string | null;
  step: string | null;
  unitAr: string | null;
  unitEn: string | null;
}

/** TEXT rules. Free text may carry PII (Principle VI) — never logged. */
export interface TextRules {
  maxLength: number;
}

export interface QuestionRow {
  id: string;
  groupId: string;
  code: string;
  /** A question stored before feature 010 reads as SINGLE_SELECT (FR-045). */
  type: QuestionType;
  questionAr: string;
  questionEn: string;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  enabledWhen: { questionCode: string; operator: string; optionCode: string } | null;
  numericMinValue: string | null;
  numericMaxValue: string | null;
  numericStep: string | null;
  numericUnitAr: string | null;
  numericUnitEn: string | null;
  textMaxLength: number | null;
  options: OptionRow[];
}
export interface GroupTreeRow {
  id: string;
  code: string;
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
  titleAr: string;
  titleEn: string;
  displayOrder: number;
}
export interface CreateQuestionBody {
  groupId: string;
  questionAr: string;
  questionEn: string;
  displayOrder: number;
  isRequired?: boolean;
  /** Defaults to SINGLE_SELECT server-side when omitted. */
  type?: QuestionType;
  /** Sent only for NUMERIC; the server rejects rules on the wrong type. */
  numeric?: Partial<NumericRules> | null;
  /** Sent only for TEXT. No binding field exists — money bindings are code constants (A33). */
  text?: Partial<TextRules> | null;
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
  type?: QuestionType;
  numeric?: Partial<NumericRules> | null;
  text?: Partial<TextRules> | null;
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

  // ---- Scoring weights (direct save, assign + score) ---------------------
  /** The GLOBAL question pool WITH answer options (the assign + per-answer scoring grid). */
  weightableQuestions(): Promise<WeightableQuestion[]> {
    return this.get<WeightableQuestion[]>(`/scoring/questions`);
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

  // ---- Questionnaire authoring (one global pool) ------------------------
  tree(): Promise<GroupTreeRow[]> {
    return this.get<GroupTreeRow[]>(`/questionnaire/tree`);
  }

  /**
   * Which of the four money bindings currently resolve to no active NUMERIC
   * question. Read-only — publishes nothing, so the editor can poll it after any
   * edit and render a standing banner rather than a per-save toast.
   */
  bindingWarnings(): Promise<PublishWarning[]> {
    return this.get<PublishWarning[]>(`/questionnaire/binding-warnings`);
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

  versionHistory(): Promise<QuestionnaireVersionRow[]> {
    return this.get<QuestionnaireVersionRow[]>(`/questionnaire/versions/history`);
  }

  /**
   * Publish the pool. Succeeds even when it returns `warnings[]` — the caller
   * surfaces them as a non-blocking notice, never as a failure.
   */
  publish(): Promise<PublishResult> {
    return this.post<PublishResult>(`/questionnaire/versions/publish`, {});
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
