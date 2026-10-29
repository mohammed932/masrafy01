import { Injectable, inject } from '@angular/core';
import type { AnswerEffectBody, NumberEffectRangeBody } from './answer-effect';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
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
  /** What picking it does to every offer (v31.2.0) — see `answer-effect.ts`. Null = nothing. */
  effectMaxLoanPercent?: string | null;
  effectRatePoints?: string | null;
  effectMaxTenorMonths?: number | null;
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
  /** Sub-label under the prompt — where a question says what its figure IS when
   *  the obvious reading is wrong (a card LIMIT, not a balance). */
  helperTextAr: string | null;
  helperTextEn: string | null;
  isRequired: boolean;
  displayOrder: number;
  isActive: boolean;
  /**
   * The show-when rule, as stored. `equals` / `not_equals` carry `optionCode`, `in` carries
   * `optionCodes`. Read it through `@shared/questions/enabled-when`, never field by field.
   */
  enabledWhen: {
    questionCode: string;
    operator: string;
    optionCode?: string;
    optionCodes?: string[];
  } | null;
  numericMinValue: string | null;
  numericMaxValue: string | null;
  numericStep: string | null;
  numericUnitAr: string | null;
  numericUnitEn: string | null;
  textMaxLength: number | null;
  options: OptionRow[];
  /**
   * Set when the loan engine reads this question's answer, so the server refuses anything but
   * its wording (`QUESTION_ENGINE_LOCKED`), and a reword that changes the numbers in it
   * (`ENGINE_WORDING_NUMBERS_CHANGED`). Absent on a server that predates the lock — read as
   * unlocked; the server still refuses.
   */
  engineLock?: QuestionEngineLock | null;
  /**
   * A FIXED question — data the admin owns, both ways (v31.0.0, v31.1.0): asked on every
   * program of its loan types, never skipped or added per program name. Required or not is set
   * like any question's. `every_name` = every program; `income_proof` = income-proof only.
   * `null` = an ordinary question. Absent on an older server — read as not fixed.
   */
  fixedServedOn?: FixedServedOn | null;
  /**
   * A FIXED number question's offer ranges (v31.3.0), as stored — read with
   * `numberRangesOf` (`answer-effect.ts`). Null or absent = none.
   */
  numberEffects?: unknown;
  /**
   * A question surrogate (no-payslip) products ask — a product reads its answer, or it keys a
   * bank's table, or such a question shows only after its answer. Managed from the Program
   * catalog, so the Questions tab lists it only when it is also fixed. Never true of a fixed
   * question. Absent on an older server — read as false.
   */
  surrogateSide?: boolean;
}

/** Where a fixed question is asked: on every program, or on income-proof programs only. */
export type FixedServedOn = 'every_name' | 'income_proof';

/**
 * Why a question is locked. `engine`: every quote reads it, or the platform owns the fact it
 * answers. `program`: the named bank programs read it. `base` is the server's word for a FIXED
 * question (`fixedServedOn` carries that, so read the lock through `engineLockOf`, which drops
 * it). No answer may be added to an engine or program lock (v30.12.0).
 */
export interface QuestionEngineLock {
  reason: 'engine' | 'base' | 'program';
  /** No answer may be added. True on every lock since v30.12.0; kept for older servers. */
  optionsFixed: boolean;
  programNames: { key: string; labelAr: string; labelEn: string }[];
}

/**
 * What deleting a FIXED question would do, read before the admin types its code
 * (`GET …/questions/:id/delete-impact`).
 */
export interface QuestionDeleteImpact {
  code: string;
  fixedServedOn: FixedServedOn | null;
  /** The delete needs the question's code typed back (`?confirmCode=`) — every fixed question. */
  confirmationRequired: boolean;
  /** Questions shown only after this one's answer: each has to be deleted first. */
  blockedBy: { code: string; questionEn: string; questionAr: string }[];
  /** The loan engine works out offers from this answer. */
  engineReads: boolean;
  /** The program names whose bank programs read it. */
  programNames: string[];
  /** The surrogate products that ask it. */
  productAsks: string[];
  /** The server's own names for what would stop working — identifiers, not sentences. */
  wouldBreak: string[];
  /** Answers already given to it. They stay on the applications that hold them. */
  answersStored: number;
}

/** A deleted fixed question, kept whole so a super admin can bring it back. */
export interface DeletedFixedQuestion {
  id: string;
  code: string;
  questionEn: string;
  questionAr: string;
  fixedServedOn: FixedServedOn;
}
export type { ServedCount } from '@shared/questions/asked-questions.rules';
import type { ServedCount } from '@shared/questions/asked-questions.rules';
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
  rejectionReasons: string[];
  requiredDocuments: string[];
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
  helperTextAr?: string;
  helperTextEn?: string;
  /** Omitted → appended to the end of the pool. Order is set by drag, not typed. */
  displayOrder?: number;
  isRequired?: boolean;
  /** Defaults to SINGLE_SELECT server-side when omitted. */
  type?: QuestionType;
  /** Sent only for NUMERIC; the server rejects rules on the wrong type. */
  numeric?: Partial<NumericRules> | null;
  /** Sent only for TEXT. No binding field exists — money bindings are code constants (A33). */
  text?: Partial<TextRules> | null;
  /** Show this question only when the source answer matches. Omit for always-on. */
  enabledWhen?: EnabledWhenRule;
  /**
   * Born FIXED, asked where this says. Omitted = an ordinary question. A fixed question's
   * show-when source must be fixed too (`QUESTION_FIXED_GATE_NOT_FIXED`).
   */
  fixedServedOn?: FixedServedOn;
}

/**
 * A branch rule: show the question when the source CHOICE question was answered
 * with (`equals`) or without (`not_equals`) the named option, or with any one of
 * the named options (`in`, 2–50 distinct answer codes of the source).
 *
 * The server requires the source to be a choice question with a strictly LOWER
 * `displayOrder` — no forward references — and a multi-pick answer satisfies
 * `equals` / `in` when ANY picked code matches.
 */
export type EnabledWhenRule =
  | { questionCode: string; operator: 'equals' | 'not_equals'; optionCode: string }
  | { questionCode: string; operator: 'in'; optionCodes: string[] };

export interface CreateOptionBody {
  labelAr: string;
  labelEn: string;
  /** Omitted → appended after the question's existing options. */
  displayOrder?: number;
  /** What picking it does to every offer. Omitted or null = nothing. */
  effect?: AnswerEffectBody | null;
}

/**
 * A whole question — wording, type rules, assignment AND every answer — in one
 * request.
 *
 * Not sugar over `createQuestion` + N × `createOption`: each of those publishes a
 * new questionnaire version, and `GET /v1/questionnaire` serves the active one,
 * so the intermediate versions briefly ask a choice question that has a single
 * answer. The composite writes in one transaction and publishes once. It is also
 * the only path where the server knows the real answer count, so a choice
 * question below two answers is refused instead of published and flagged later.
 */
export interface CreateQuestionWithOptionsBody extends CreateQuestionBody {
  /** Required (≥2) for the choice types, forbidden for NUMERIC / TEXT. */
  options?: CreateOptionBody[];
  /**
   * Take the answers from a registry list instead of stating them.
   *
   * Names an `enumeration_type_def.key`. Each active value becomes an option whose CODE is
   * the enumeration key — the one thing the ordinary path cannot do, since it slugs a label.
   * The engine keys a bank's table by that code, so a question that draws on a list must be
   * created this way or the two are joined by luck.
   *
   * Mutually exclusive with `options`; the server refuses a request carrying both.
   */
  optionsFromEnumerationType?: string;
}

/** What the composite create returns — the row plus the answers it just wrote. */
export type CreatedQuestion = QuestionRow;

/** Question edits — `code` and `category` are immutable (A33). */
export interface UpdateQuestionBody {
  questionAr?: string;
  questionEn?: string;
  /** Empty string CLEARS the sub-label. */
  helperTextAr?: string;
  helperTextEn?: string;
  displayOrder?: number;
  isRequired?: boolean;
  isActive?: boolean;
  type?: QuestionType;
  numeric?: Partial<NumericRules> | null;
  text?: Partial<TextRules> | null;
  /** `null` CLEARS the branch, making the question unconditional again. */
  enabledWhen?: EnabledWhenRule | null;
  /**
   * Make the question FIXED, move it between every program and income-proof ones, or — `null`
   * — make it ordinary again (v31.1.0: the admin's both ways). Omitted = left as it is.
   */
  fixedServedOn?: FixedServedOn | null;
}
/** Option edits — `code` is immutable (A33). */
export interface UpdateOptionBody {
  labelAr?: string;
  labelEn?: string;
  displayOrder?: number;
  isActive?: boolean;
  /** Replaces the whole effect; null clears it; omitted leaves it untouched. */
  effect?: AnswerEffectBody | null;
}

/** Admin API for Feature 009 (the global questionnaire pool + the matching simulator). */
@Injectable({ providedIn: 'root' })
export class QuestionnaireApiService {
  private readonly http = inject(HttpClient);
  private base(): string {
    return environment.apiBaseUrl;
  }

  // ---- Questionnaire authoring (one global pool) ------------------------
  /** How many questions an applicant of one catalog name is served, per loan type. */
  servedForName(programNameKey: string): Promise<ServedCount[]> {
    return this.get<ServedCount[]>(
      `/questionnaire/served?programNameKey=${encodeURIComponent(programNameKey)}`,
    );
  }

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
   * Run the full pricing engine for a sample applicant.
   *
   * `answers: []` is a legal empty-answer run: the preview path forces
   * `isRequired: false`, so it returns every active program in the category, each
   * carrying either its figures or the reason it could not be quoted. `silent`
   * suppresses the toast for speculative probes (the dashboard dry run against an
   * instance whose questionnaire is not published yet).
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
   * Create a question and its answers together — ONE transaction, ONE published
   * version. Used by the catalog's "New question" dialog, which holds the whole
   * question in a form before it commits anything.
   *
   * Prefer this over `createQuestion` + `createOption` whenever the answers are
   * already known: the split path publishes a version per call, and every
   * intermediate one is live on `GET /v1/questionnaire`.
   */
  createQuestionWithOptions(body: CreateQuestionWithOptionsBody): Promise<CreatedQuestion> {
    return this.post<CreatedQuestion>(`/questionnaire/questions/with-options`, body);
  }

  /**
   * Rewrite the flat pool order — the DEFAULT order: each program keeps its own on its page
   * in the Program catalog (v32.0.0), and a question it never placed sits right after the one
   * it follows here. `ids` must be EVERY active question id, in order — the server rejects a
   * partial list, because a partial rewrite would leave untouched questions colliding on
   * `displayOrder`.
   */
  reorderQuestions(ids: string[]): Promise<GroupTreeRow[]> {
    return this.post<GroupTreeRow[]>(`/questionnaire/questions/reorder`, { ids });
  }

  updateQuestion(id: string, body: UpdateQuestionBody): Promise<QuestionRow> {
    return this.patch<QuestionRow>(`/questionnaire/questions/${id}`, body);
  }

  /**
   * Switch a question off. A FIXED question also needs its code typed back (`confirmCode`) and
   * a super admin — the one write that may stop the engine getting an answer, so it is said
   * twice. An ordinary question takes no code.
   */
  deleteQuestion(id: string, confirmCode?: string): Promise<QuestionRow> {
    const params =
      confirmCode === undefined ? undefined : new HttpParams().set('confirmCode', confirmCode);
    return this.del<QuestionRow>(`/questionnaire/questions/${id}`, params);
  }

  /** What deleting this question would do — read before the confirm field is offered. */
  deleteImpact(id: string): Promise<QuestionDeleteImpact> {
    return this.get<QuestionDeleteImpact>(`/questionnaire/questions/${id}/delete-impact`);
  }

  /**
   * The fixed questions deleted so far — the restore list. `silent` keeps a failed read off
   * the toast: the list is a safety net loaded with the page, not something the admin asked for.
   */
  deletedFixed(opts: { silent?: boolean } = {}): Promise<DeletedFixedQuestion[]> {
    return this.get<DeletedFixedQuestion[]>(
      `/questionnaire/questions/deleted-fixed`,
      opts.silent === true ? new HttpContext().set(SKIP_TOAST_INTERCEPTOR, true) : undefined,
    );
  }

  /**
   * Bring a deleted question back — the ordinary switch-on, judged by the engine contract and
   * published like every write. A fixed one comes back whole: its mark and answers.
   */
  restoreQuestion(id: string): Promise<QuestionRow> {
    return this.updateQuestion(id, { isActive: true });
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

  /** A fixed number question's offer ranges — the whole list, replaced; empty removes them. */
  setNumberEffects(
    questionId: string,
    ranges: readonly NumberEffectRangeBody[],
  ): Promise<{ questionId: string; ranges: unknown }> {
    return this.put(`/questionnaire/questions/${questionId}/number-effects`, { ranges });
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
  private async get<T>(path: string, context?: HttpContext): Promise<T> {
    const res = await firstValueFrom(
      this.http.get<SuccessEnvelope<T>>(`${this.base()}${path}`, { context }),
    );
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
  private async del<T>(path: string, params?: HttpParams): Promise<T> {
    const res = await firstValueFrom(
      this.http.delete<SuccessEnvelope<T>>(`${this.base()}${path}`, { params }),
    );
    return res.data;
  }
}
