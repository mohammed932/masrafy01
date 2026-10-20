import type { LoanCategory } from '@core/loan-category';
import type { QuestionEngineLock } from '../questionnaire.api.service';

/**
 * `GET /admin/questionnaire/engine-rules` — mirrors `backend/src/questionnaire/engine-rules-view.ts`.
 * Structured kinds only: every sentence the admin reads is built here, in its own catalog
 * (`engine-rules.labels.ts`), never sent by the server (Principle III).
 */

export interface LabelledKey {
  key: string;
  labelAr: string;
  labelEn: string;
}

/** A question named by its code and both wordings. */
export interface QuestionRef {
  code: string;
  questionAr: string;
  questionEn: string;
}

export type MoneyBinding =
  | 'requested_amount'
  | 'tenor_months'
  | 'monthly_income'
  | 'existing_obligations';

export type EmploymentBucket = 'salaried' | 'self_employed' | 'retired';

/** Who reads a question, and how. */
export type EngineReader =
  | { kind: 'money_input'; binding: MoneyBinding }
  | { kind: 'debt_types' }
  | { kind: 'obligation_amount'; debtType: string; monthlyPercent: string | null }
  | { kind: 'employment_type' }
  | { kind: 'server_input'; input: 'months_in_job' | 'salary_transfer' }
  | { kind: 'app_mapping'; categories: LoanCategory[] }
  | { kind: 'platform_fact'; facts: LabelledKey[] }
  | { kind: 'fixed_set'; servedOn: 'income_proof' | 'every_name'; categories: LoanCategory[] }
  | { kind: 'programs'; programNames: (LabelledKey & { categories: LoanCategory[] })[] };

/** What one answer means to the engine, where the server owns the meaning. */
export type AnswerMeaning =
  | { kind: 'job'; bucket: EmploymentBucket }
  | { kind: 'iscore_band'; from: string | null; to: string | null }
  | { kind: 'iscore_none' }
  | { kind: 'transfer'; transferType: LabelledKey }
  | { kind: 'debt_amount'; question: QuestionRef }
  | { kind: 'no_debts' }
  | { kind: 'opens'; questions: QuestionRef[] }
  | { kind: 'hides'; questions: QuestionRef[] };

export interface EngineRuleOption {
  id: string;
  code: string;
  labelAr: string;
  labelEn: string;
  displayOrder: number;
  meanings: AnswerMeaning[];
  /** The quantities each label states and has to keep, as written. Empty = none. */
  keep: { ar: string[]; en: string[] };
}

export interface EngineRuleQuestion {
  id: string;
  code: string;
  type: string;
  questionAr: string;
  questionEn: string;
  helperTextAr: string | null;
  helperTextEn: string | null;
  isRequired: boolean;
  /** Loan types that ask it of everyone. */
  categories: LoanCategory[];
  /** Loan types only some program names ask it in. */
  optInCategories: LoanCategory[];
  lock: QuestionEngineLock;
  readers: EngineReader[];
  numeric: {
    minValue: string | null;
    maxValue: string | null;
    step: string | null;
    unitAr: string | null;
    unitEn: string | null;
  } | null;
  text: { maxLength: number } | null;
  /** The Manage-values list whose values ARE its answers — edited there, never here. */
  mirroredList: LabelledKey | null;
  options: EngineRuleOption[];
}

export interface EngineRulesView {
  questions: EngineRuleQuestion[];
}
