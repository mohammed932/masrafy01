import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { SuccessEnvelope } from '@core/auth/auth.types';
import { SKIP_TOAST_INTERCEPTOR } from '@core/interceptors/toast.interceptor';
import type { LoanCategory } from '@core/loan-category';
import type { QuestionType, SimulatedAnswer } from '../questionnaire/questionnaire.api.service';

/**
 * Feature 013 — the Loan Engine admin API (`/api/admin/loan-engine`).
 * Mirrors `backend/src/bank-programs/loan-engine/dto/loan-engine.dto.ts`.
 */

export const LOAN_ENGINE_EFFECTS = [
  'rate',
  'cap',
  'financed_share',
  'min_amount',
  'min_term',
  'max_term',
  'extra_income',
] as const;
export type LoanEngineEffect = (typeof LOAN_ENGINE_EFFECTS)[number];

/** The closed list the engine refuses with (`product-rule.ts`'s GATE_REASON_CODES). */
export const GATE_REASON_CODES = [
  'GATE_NOT_MET',
  'BUSINESS_TOO_NEW',
  'SELF_EMPLOYED_DOCS_MISSING',
  'DOWN_PAYMENT_BELOW_MIN',
  'UNIT_PRICE_BELOW_MIN',
  'CONTRACT_TOO_NEW',
  'CONTRACT_TOO_OLD',
  'OWNERSHIP_NOT_CONFIRMED',
  'MULTI_UNIT_NOT_CONFIRMED',
  'LOAN_TOO_NEW',
] as const;
export type GateReasonCode = (typeof GATE_REASON_CODES)[number];

export type NumberOp = 'lt' | 'lte' | 'gte' | 'gt' | 'eq' | 'between' | 'range';

/** One answer criterion, in the operator's words. `custom` only ever comes BACK from the server. */
export type Criterion =
  | { op: 'lt' | 'lte' | 'gte' | 'gt' | 'eq'; a: string }
  | { op: 'between' | 'range'; a: string; b: string }
  | { op: 'custom'; a?: string; aInclusive: boolean; b?: string; bInclusive: boolean }
  | { option: string }
  | { answered: true };

export type EffectReadOnlyReason =
  | 'inherited_plan'
  | 'multi_axis'
  | 'class_axis'
  | 'other_fact'
  | 'two_axis_cap'
  | 'not_numeric';

export type NoMatch = 'useFallback' | 'reject' | 'useProgramMax';

export interface EffectRow {
  criterion: Criterion | null;
  value: string;
}

export interface EffectState {
  editable: boolean;
  readOnlyReason?: EffectReadOnlyReason;
  otherFactKey?: string;
  rows: EffectRow[];
  onNoMatch: NoMatch | null;
}

export interface ProgramConditionView {
  id: string;
  reasonCode: GateReasonCode;
  anyOf: { questionCode: string | null; factKey: string; criterion: Criterion | null }[];
}

export interface LoanEngineProgramSlice {
  programCode: string;
  bankName: string;
  friendlyName: string;
  category: LoanCategory;
  version: number;
  programNameKey: string | null;
  effects: Record<LoanEngineEffect, EffectState>;
  conditions: ProgramConditionView[];
}

export interface LoanEngineQuestionSummary {
  questionCode: string;
  type: QuestionType;
  labelAr: string;
  labelEn: string;
  categories: LoanCategory[];
  factKey: string | null;
  readingProgramCount: number;
}

export interface LoanEngineOption {
  code: string;
  labelAr: string;
  labelEn: string;
}

export interface LoanEngineQuestionDetail {
  questionCode: string;
  type: QuestionType;
  labelAr: string;
  labelEn: string;
  categories: LoanCategory[];
  factKey: string | null;
  options: LoanEngineOption[];
  programs: LoanEngineProgramSlice[];
}

export interface PutEffectBody {
  expectedVersion: number;
  rows: EffectRow[];
  onNoMatch?: NoMatch;
}

export interface ConditionBody {
  id: string;
  reasonCode: GateReasonCode;
  anyOf: { questionCode: string; criterion: Criterion }[];
}

export interface ConditionsResult {
  changed: boolean;
  program: LoanEngineProgramSlice;
  requiredQuestionCodes: string[];
  requiredUnderProgramName: string | null;
}

/** One unsaved draft, priced by the simulator in memory only (US3). */
export interface LoanEngineOverride {
  programCode: string;
  target: LoanEngineEffect | 'conditions';
  questionCode?: string;
  rows?: EffectRow[];
  onNoMatch?: NoMatch;
  conditions?: ConditionBody[];
}

export interface TriedProgram {
  programCode: string;
  figures: {
    effectiveRatePercent: string;
    offeredAmountEGP: string;
    effectiveTenorMonths: number;
  } | null;
  figuresUnavailableReason: string | null;
  gateReasonCode?: string | null;
}

@Injectable({ providedIn: 'root' })
export class LoanEngineApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/loan-engine`;

  questions(category?: LoanCategory): Promise<LoanEngineQuestionSummary[]> {
    const q = category === undefined ? '' : `?category=${encodeURIComponent(category)}`;
    return this.get<LoanEngineQuestionSummary[]>(`/questions${q}`);
  }

  question(code: string): Promise<LoanEngineQuestionDetail> {
    return this.get<LoanEngineQuestionDetail>(`/questions/${encodeURIComponent(code)}`);
  }

  putEffect(
    questionCode: string,
    programCode: string,
    effect: LoanEngineEffect,
    body: PutEffectBody,
  ): Promise<{ changed: boolean; program: LoanEngineProgramSlice }> {
    return this.put(
      `/questions/${encodeURIComponent(questionCode)}/programs/${encodeURIComponent(programCode)}/effects/${effect}`,
      body,
    );
  }

  putConditions(
    programCode: string,
    body: { expectedVersion: number; conditions: ConditionBody[] },
  ): Promise<ConditionsResult> {
    return this.put(`/programs/${encodeURIComponent(programCode)}/conditions`, body);
  }

  /**
   * The admin simulator with the Loan Engine's unsaved drafts. Errors are shown in place
   * by the caller, so the global toast is skipped.
   */
  async tryAnswers(
    category: LoanCategory,
    answers: SimulatedAnswer[],
    overrides: LoanEngineOverride[],
  ): Promise<TriedProgram[]> {
    const res = await firstValueFrom(
      this.http.post<SuccessEnvelope<{ matches: TriedProgram[] }>>(
        `${environment.apiBaseUrl}/matching/simulate`,
        { category, answers, ...(overrides.length > 0 ? { programOverrides: overrides } : {}) },
        { context: new HttpContext().set(SKIP_TOAST_INTERCEPTOR, true) },
      ),
    );
    return res.data.matches;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await firstValueFrom(this.http.get<SuccessEnvelope<T>>(`${this.base}${path}`));
    return res.data;
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await firstValueFrom(
      this.http.put<SuccessEnvelope<T>>(`${this.base}${path}`, body, {
        context: new HttpContext().set(SKIP_TOAST_INTERCEPTOR, true),
      }),
    );
    return res.data;
  }
}
