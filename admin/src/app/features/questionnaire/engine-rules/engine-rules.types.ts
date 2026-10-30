import type { AnswerEffectLevers, NumberEffectRange } from '../answer-effect';
import type { LoanCategory } from '@core/loan-category';
import type { FixedServedOn, QuestionEngineLock } from '../questionnaire.api.service';

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
  | { kind: 'fixed_set'; servedOn: FixedServedOn }
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
  | { kind: 'hides'; questions: QuestionRef[] }
  /** The admin's offer effect on this answer (v31.2.0). */
  | ({ kind: 'offer_effect' } & AnswerEffectLevers);

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
  /** The engine-input lock, or `null` for a fixed question nothing reads by code or table. */
  lock: QuestionEngineLock | null;
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
  /** When it is asked; `null` = always. Every question here is mandatory — this is WHEN. */
  askedWhen: AskedWhen | null;
  /**
   * Program questions that answer it: where a program asks one of them, this one is not asked
   * (never the same thing twice). Absent on an older server: read as none.
   */
  answeredBy?: QuestionRef[];
  /**
   * Whether a no-payslip (surrogate) program asks it: `always`; `unless_derived` — the loan
   * amount, unless the program works it out from the car price and down payment; `never` — the
   * declared income.
   */
  noPayslip: NoPayslipAsk;
  /**
   * Where it is asked (`question.fixedServedOn`): every program, income-proof ones only, or
   * surrogate ones only (`income_surrogate`, v32.1.0). Absent on an older server — read as
   * asked on every income-proof program.
   */
  fixedServedOn?: FixedServedOn | null;
  options: EngineRuleOption[];
  /** A Number question's offer ranges (v31.3.0); absent on an older server. */
  numberEffects?: NumberEffectRange[];
}

export type NoPayslipAsk = 'always' | 'unless_derived' | 'never';

/** A follow-up's show-when rule, named: the question it hangs on and the answers that open it. */
export interface AskedWhen {
  question: QuestionRef;
  /** `true` = asked for every answer EXCEPT these. */
  except: boolean;
  answers: { code: string; labelAr: string; labelEn: string }[];
}

export interface EngineRulesView {
  questions: EngineRuleQuestion[];
}
