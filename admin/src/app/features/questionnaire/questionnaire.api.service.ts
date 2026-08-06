import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';
import { SKIP_TOAST_INTERCEPTOR } from '@core/interceptors/toast.interceptor';

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

/** A question shown in the weights editor, with whatever its type is scored by. */
export interface WeightableQuestion {
  code: string;
  labelAr: string;
  labelEn: string;
  /** Decides which scoring control the editor renders (every type scores, v14.0.0). */
  type: QuestionType;
  /**
   * Loan categories that ASK this question (lowercase). A program scoring on a
   * question outside its own category is configuring something its applicants
   * never see — the editor warns, it does not block.
   */
  categories: string[];
  /** Both choice types. Empty for NUMERIC / TEXT. */
  options: WeightableOption[];
  /** NUMERIC only — seeds the band edges so the admin does not invent them. */
  numericMinValue: string | null;
  numericMaxValue: string | null;
  numericUnitAr: string | null;
  numericUnitEn: string | null;
  /** TEXT only. */
  textMaxLength: number | null;
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

/** How a MULTI_SELECT question combines the scores of the options that were picked. */
export const MULTI_SELECT_AGGREGATIONS = ['AVERAGE', 'SUM_CAPPED', 'MAX', 'MIN'] as const;
export type MultiSelectAggregation = (typeof MULTI_SELECT_AGGREGATIONS)[number];

/**
 * One NUMERIC scoring band. Half-open `[from, to)` so two adjacent bands never
 * both claim an edge value; `from: null` = −∞, `to: null` = +∞. Edges are decimal
 * STRINGS — these are money values (Principle I).
 */
export interface NumericScoreBand {
  from: string | null;
  to: string | null;
  score: number;
}

/**
 * Two-level scoring: per-question weights (sum 100) plus the rule each question's
 * TYPE is scored by (v14.0.0). The three rule maps are optional so a weight set
 * saved before v14.0.0 still parses.
 */
export interface ProgramScoringWeights {
  questionWeights: Record<string, number>;
  answerScores: Record<string, Record<string, number>>;
  multiSelectRules?: Record<string, { aggregation: MultiSelectAggregation }>;
  numericBands?: Record<string, NumericScoreBand[]>;
  textRules?: Record<string, { answeredScore: number }>;
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
 * Feature 010 — the four question types are all real, and since v14.0.0 all four
 * are scoreable: each resolves to one 0–100 answer score by its own rule (option
 * scores, multi-select aggregation, numeric bands, text presence).
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
  /**
   * Which loan categories this question is asked for. The pool stays global — one
   * canonical question list — and this narrows who gets asked. Empty means parked:
   * the question is kept and editable but asked for no category.
   */
  categories: LoanCategory[];
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
  /** Registry fact, not a simulation output — Islamic-finance program. */
  isShariaCompliant: boolean;
  programFriendlyName: string;
  /**
   * Always `true` — eligibility gating is dropped for MVP (Principle V / A33), so
   * this carries no information and MUST NOT be rendered as a per-program verdict.
   */
  eligible: boolean;
  monthlyInstallmentEGP: string | null;
  effectiveRatePercent: string | null;
  /**
   * Borrowing ceiling for the simulated applicant: income × DBR cap − existing
   * obligations, present-valued over the term. Independent of the amount asked
   * for. Populated even when the program could not be quoted, in which case it
   * reads `0.00` alongside `OBLIGATIONS_EXCEED_ALLOWANCE`.
   */
  maxAffordableAmountEGP: string | null;
  figures: SimulationFigures | null;
  /** Why `figures` is null — `MONEY_FIGURE_MISSING` while answers are partial. */
  figuresUnavailableReason: string | null;
  approvalProbability: number; // 0..1
  approvalTier: string;
  /** Per-answer contributions behind the score, biggest first (Principle V). */
  approvalFactors: SimulationFactors;
  rejectionReasons: string[];
  requiredDocuments: string[];
  usedDefaultWeights: boolean;
}

/**
 * Why the score is what it is. `code` is the OPTION code for a single pick and
 * the QUESTION code for the other three types (multi / numeric / text — no one
 * option to name); `impact` is that answer's share of the score in points, and
 * the impacts sum to the displayed percentage.
 */
export interface SimulationFactors {
  positive: SimulationFactorImpact[];
  negative: SimulationFactorImpact[];
}
export interface SimulationFactorImpact {
  code: string;
  /**
   * The question the impact came from. Needed to label the row: `code` is an
   * OPTION code for a single pick, and option codes repeat across questions
   * (`yes` many times over), so the pair is what identifies an answer.
   */
  questionCode?: string;
  impact: number;
}

/** Full money block for one simulated program. Decimal strings, never floats. */
export interface SimulationFigures {
  offeredAmountEGP: string;
  cashToCustomerEGP: string;
  totalFeesEGP: string;
  monthlyInstallmentEGP: string;
  effectiveTenorMonths: number;
  effectiveRatePercent: string;
  totalPayableEGP: string;
  totalCostOfCreditEGP: string;
  dbrPercent: string;
  dbrCapPercent: string;
  dbrBandIndex: number | null;
  maxAffordableAmountEGP: string;
  bindingConstraint: string;
  fees: { adminFeeEGP: string; stampDutyEGP: string; lifeInsuranceEGP: string };
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

/**
 * One simulated answer. Exactly one value key is populated, matching the
 * question's type — the API rejects any other combination (feature 010, R8).
 */
export interface SimulatedAnswer {
  questionCode: string;
  optionCode?: string;
  optionCodes?: string[];
  textValue?: string;
  numericValue?: string;
}

export interface CreateQuestionBody {
  /** Omitted by the flat editor — the server places the question (see backend). */
  groupId?: string;
  questionAr: string;
  questionEn: string;
  /** Omitted → appended to the end of the pool. Order is set by drag, not typed. */
  displayOrder?: number;
  isRequired?: boolean;
  /** Defaults to SINGLE_SELECT server-side when omitted. */
  type?: QuestionType;
  /** Sent only for NUMERIC; the server rejects rules on the wrong type. */
  numeric?: Partial<NumericRules> | null;
  /** Sent only for TEXT. No binding field exists — money bindings are code constants (A33). */
  text?: Partial<TextRules> | null;
  /** Omitted → the server assigns all four categories, so nothing is born invisible. */
  categories?: LoanCategory[];
  /** Show this question only when the source answer matches. Omit for always-on. */
  enabledWhen?: EnabledWhenRule;
}

/**
 * A branch rule: show the question when the source CHOICE question was answered
 * with (`equals`) or without (`not_equals`) the named option.
 *
 * The server requires the source to be a choice question with a strictly LOWER
 * `displayOrder` — no forward references — and a multi-pick answer satisfies
 * `equals` when ANY picked code matches.
 */
export interface EnabledWhenRule {
  questionCode: string;
  operator: 'equals' | 'not_equals';
  optionCode: string;
}

/** One row of a bulk reassignment: the array REPLACES that question's set. */
export interface QuestionCategoryAssignment {
  questionId: string;
  categories: LoanCategory[];
}
export interface CreateOptionBody {
  labelAr: string;
  labelEn: string;
  /** Omitted → appended after the question's existing options. */
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
  /** `null` CLEARS the branch, making the question unconditional again. */
  enabledWhen?: EnabledWhenRule | null;
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
  /**
   * Run the full engine + per-bank approval scoring for a sample applicant.
   *
   * `answers: []` is a legal empty-answer run: the preview path forces
   * `isRequired: false`, so it returns every active program in the category with
   * its `usedDefaultWeights` flag — and a probability of 0 that callers must not
   * render. `silent` suppresses the toast for speculative probes (the dashboard
   * dry run against an instance whose questionnaire is not published yet).
   */
  simulateMatching(
    category: LoanCategory,
    answers: SimulatedAnswer[],
    opts: { silent?: boolean } = {},
  ): Promise<SimulationResult> {
    return this.post<SimulationResult>(
      `/matching/simulate`,
      { category, answers },
      opts.silent === true ? new HttpContext().set(SKIP_TOAST_INTERCEPTOR, true) : undefined,
    );
  }

  createQuestion(body: CreateQuestionBody): Promise<QuestionRow> {
    return this.post<QuestionRow>(`/questionnaire/questions`, body);
  }

  /**
   * Rewrite the flat pool order. `ids` must be EVERY active question id, in the
   * order they should be asked — the server rejects a partial list, because a
   * partial rewrite would leave untouched questions colliding on `displayOrder`.
   */
  reorderQuestions(ids: string[]): Promise<GroupTreeRow[]> {
    return this.post<GroupTreeRow[]>(`/questionnaire/questions/reorder`, { ids });
  }

  updateQuestion(id: string, body: UpdateQuestionBody): Promise<QuestionRow> {
    return this.patch<QuestionRow>(`/questionnaire/questions/${id}`, body);
  }

  deleteQuestion(id: string): Promise<QuestionRow> {
    return this.del<QuestionRow>(`/questionnaire/questions/${id}`);
  }

  /**
   * Replace which loan categories ONE question is asked for. The array is the new
   * set, not a delta; `[]` parks the question. Auto-publishes, like every other
   * questionnaire write.
   */
  setQuestionCategories(id: string, categories: LoanCategory[]): Promise<QuestionRow> {
    return this.put<QuestionRow>(`/questionnaire/questions/${id}/categories`, { categories });
  }

  /**
   * Reassign many questions at once (the column actions). One request rather than
   * N: the server does it in one transaction and publishes ONE new version, where
   * a loop would churn a version per question. Returns the refreshed tree.
   */
  setQuestionCategoriesBulk(assignments: QuestionCategoryAssignment[]): Promise<GroupTreeRow[]> {
    return this.post<GroupTreeRow[]>(`/questionnaire/questions/categories`, { assignments });
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
  private async post<T>(path: string, body: unknown, context?: HttpContext): Promise<T> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<T>>(`${this.base()}${path}`, body, { context }),
    );
    return res.data;
  }
  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await firstValueFrom(
      this.http.put<SuccessEnvelope<T>>(`${this.base()}${path}`, body),
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
