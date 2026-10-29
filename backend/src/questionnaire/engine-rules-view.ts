/**
 * THE LOAN ENGINE'S RULES, as the admin reads them (`GET /admin/questionnaire/engine-rules`).
 *
 * The OWNER'S questions — the fixed income-proof set the client handed over («أسئلة إثبات الدخل»,
 * `BASE_QUESTIONS`), and only those, in the client's order (v30.13.0: the operator asked for the
 * tab to list what came from the owner, as the owner gave it). Every one of them carries an
 * engine lock (`engine-contract.ts`); the other questions the engine reads stay locked all the
 * same, and their answers are reworded — under the same numbers check — on the Questions tab.
 *
 * Each with WHO reads it and, per answer, WHAT the answer means where the server owns that meaning:
 *   - the job answers' bucket (`EMPLOYMENT_ANSWERS`), the I-Score bands' score range
 *     (`I_SCORE_BANDS`), the transfer answers' rate-table key (`TRANSFER_ANSWERS`) — all in
 *     `base-question-set.ts`, where an answer cannot be written without its meaning;
 *   - the debt amount a debt-type answer asks for (`OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE`);
 *   - the follow-up questions an answer opens or hides (every other question's show-when rule).
 * What the APP turns an answer into (months, a property value, a sort key) lives in the app's
 * mappers and is NOT copied here — a third copy of those figures would drift; the reader says
 * "the app maps each answer" instead.
 *
 * Each answer also carries what its wording has to keep (`wording-numbers.ts`): the hint the
 * admin sees before typing, from the same function the contract refuses with.
 *
 * Pure: structural input, structured output, no sentences (the admin's catalog holds those,
 * Principle III) and no Prisma rows (A8).
 */
import {
  hasAnyLever,
  type AnswerEffectLevers,
  type NumberEffectRange,
} from '@/matching/pipeline/answer-effects';
import type { LoanCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CAN_TRANSFER_SALARY_QUESTION_CODE,
  EMPLOYMENT_BUCKET_BY_OPTION,
  I_SCORE_BAND_QUESTION_CODE,
  MONTHS_IN_JOB_QUESTION_CODE,
  TRANSFER_TYPE_BY_OPTION,
  iScoreBandRange,
  type EmploymentBucket,
} from '@/matching/pipeline/base-question-set';
import type { FixedServedOn } from './validation/fixed-questions';
import {
  CREDIT_CARD_DEBT_TYPE_OPTION,
  CREDIT_CARD_LIMIT_MONTHLY_PERCENT,
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  obligationItemQuestionFor,
  type MoneyFieldBinding,
} from '@/matching/pipeline/money-field-bindings';
import type {
  EngineReaderViews,
  LabelledKey,
  QuestionEngineLockView,
} from './engine-contract.service';
import { engineInputReaderOf } from './validation/engine-contract';
import { enabledWhenGate } from './validation/question-visibility';
import { wordingQuantities } from './validation/wording-numbers';

// ---- Output (the response body) ---------------------------------------------------------------

/** A question named by its code and both wordings. */
export interface QuestionRef {
  code: string;
  questionAr: string;
  questionEn: string;
}

/** Who reads a question, and how. A question usually has several. */
export type EngineReader =
  /** One of the four money figures every quote is built on. */
  | { kind: 'money_input'; binding: MoneyFieldBinding }
  /** The debt-type pick: which amounts are asked, and what is summed. */
  | { kind: 'debt_types' }
  /** One debt's amount; a card LIMIT counts at `monthlyPercent` % of it a month. */
  | { kind: 'obligation_amount'; debtType: string; monthlyPercent: string | null }
  /** The job type: the bucket programmes' DBR, term and rate tables are keyed by. */
  | { kind: 'employment_type' }
  /** Read by the server off the answers (`engine-inputs-from-answers.ts`). */
  | { kind: 'server_input'; input: 'months_in_job' | 'salary_transfer' }
  /**
   * The mobile app mapped each answer into the application it sends. Retired with the six
   * questions it named (v31.0.0): never produced now, kept so an older admin bundle still reads.
   */
  | { kind: 'app_mapping'; categories: LoanCategory[] }
  /** It answers a fact the platform owns (I-Score, the car figures). */
  | { kind: 'platform_fact'; facts: LabelledKey[] }
  /** In the fixed question set: asked on every program (`every_name`) or every payslip one. */
  | { kind: 'fixed_set'; servedOn: FixedServedOn }
  /** Live bank programmes read it, under these program names and loan types. */
  | { kind: 'programs'; programNames: (LabelledKey & { categories: LoanCategory[] })[] };

/** What one answer means to the engine, where the server owns the meaning. */
export type AnswerMeaning =
  /** A job answer, and the bucket the programmes price it as. */
  | { kind: 'job'; bucket: EmploymentBucket }
  /** An I-Score band: the bureau scores it covers, both ends included; `null` = open. */
  | { kind: 'iscore_band'; from: string | null; to: string | null }
  /** The bureau's "no score". */
  | { kind: 'iscore_none' }
  /** The salary-transfer answer, and the rate-table row it reads. */
  | { kind: 'transfer'; transferType: LabelledKey }
  /** A debt type, and the amount question it asks. */
  | { kind: 'debt_amount'; question: QuestionRef }
  /** "No debts": the applicant's monthly debts are zero, stated. */
  | { kind: 'no_debts' }
  /** Picking it shows these follow-up questions. */
  | { kind: 'opens'; questions: QuestionRef[] }
  /** Picking it hides these questions (shown for every other answer). */
  | { kind: 'hides'; questions: QuestionRef[] }
  /** The admin's offer effect on this answer (v31.2.0) — what picking it does to every offer. */
  | ({ kind: 'offer_effect' } & AnswerEffectLevers);

export interface EngineRuleOption {
  id: string;
  code: string;
  labelAr: string;
  labelEn: string;
  displayOrder: number;
  meanings: AnswerMeaning[];
  /** What each label states and has to keep, as written (`wording-numbers.ts`). */
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
  lock: QuestionEngineLockView | null;
  readers: EngineReader[];
  numeric: {
    minValue: string | null;
    maxValue: string | null;
    step: string | null;
    unitAr: string | null;
    unitEn: string | null;
  } | null;
  text: { maxLength: number } | null;
  /** The Manage-values list whose values ARE its answers — they are edited there, not here. */
  mirroredList: LabelledKey | null;
  /**
   * When it is asked: a follow-up only once another question's answer opens it; `null` = it is
   * always asked. Every question listed is mandatory — this is WHEN, never WHETHER.
   */
  askedWhen: AskedWhen | null;
  /** Retired with `answeredBy` (v31.0.0): always empty, kept on the wire one release. */
  answeredBy: QuestionRef[];
  /**
   * Whether a NO-PAYSLIP program asks it — the admin's Surrogate tab. Every income-proof program
   * asks the whole set.
   */
  noPayslip: NoPayslipAsk;
  /** ACTIVE answers, in their order. */
  options: EngineRuleOption[];
  /** A Number question's offer ranges (v31.3.0), in order; empty for every other type. */
  numberEffects: NumberEffectRange[];
}

/**
 * How a no-payslip program asks a fixed question:
 *   - `always`: the set's every-name part (`servedOn: 'every_name'`);
 *   - `unless_derived`: the requested amount, served on a product-only name unless that name works
 *     it out from the car price and down payment (`narrowingScopeFor`, the `productOnly` push);
 *   - `never`: the declared-income part — monthly income, other income and its amount, the bank
 *     statement — which the product works out or does without; and the job with its five
 *     follow-ups, which the program the applicant picked before the questionnaire answers.
 */
export type NoPayslipAsk = 'always' | 'unless_derived' | 'never';

/** The show-when rule of a follow-up, named: the question it hangs on and the answers that open it. */
export interface AskedWhen {
  question: QuestionRef;
  /** `true` = asked for every answer EXCEPT these (a `not_equals` rule). */
  except: boolean;
  answers: { code: string; labelAr: string; labelEn: string }[];
}

export interface EngineRulesView {
  questions: EngineRuleQuestion[];
}

// ---- Input ------------------------------------------------------------------------------------

export interface EngineRulesInputQuestion {
  id: string;
  code: string;
  type: string;
  questionAr: string;
  questionEn: string;
  helperTextAr: string | null;
  helperTextEn: string | null;
  isRequired: boolean;
  displayOrder: number;
  enabledWhen: unknown;
  numeric: EngineRuleQuestion['numeric'];
  text: EngineRuleQuestion['text'];
  /** FIXED (`question.fixedServedOn`, v31.0.0); `null` = an ordinary question, not listed. */
  fixedServedOn: FixedServedOn | null;
  /** ACTIVE answers. */
  options: readonly {
    id: string;
    code: string;
    labelAr: string;
    labelEn: string;
    displayOrder: number;
    /** The admin's offer effect, when the answer carries one (v31.2.0). */
    effect?: AnswerEffectLevers;
  }[];
  /** A Number question's offer ranges (v31.3.0). */
  numberEffects?: readonly NumberEffectRange[];
}

export interface EngineRulesInput {
  /** Every ACTIVE question — the owner's ones are listed, all of them may be a follow-up. */
  questions: readonly EngineRulesInputQuestion[];
  readers: EngineReaderViews;
  /** The `transfer_type` registry, by key. */
  transferTypes: ReadonlyMap<string, LabelledKey>;
}

// ---- The view -------------------------------------------------------------------------------

export function engineRulesView(input: EngineRulesInput): EngineRulesView {
  // Looked up over the WHOLE pool: an answer may open or hide a question outside the owner's set.
  const byCode = new Map(input.questions.map((q) => [q.code, q]));
  const followUps = followUpsByAnswer(input.questions);
  // The FIXED questions (v31.0.0, the admin's), in the questionnaire's own order.
  const questions = [...input.questions]
    .filter((q) => q.fixedServedOn !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    questions: questions.map((q) => {
      const lock = input.readers.locks.get(q.code) ?? null;
      return {
        id: q.id,
        code: q.code,
        type: q.type,
        questionAr: q.questionAr,
        questionEn: q.questionEn,
        helperTextAr: q.helperTextAr,
        helperTextEn: q.helperTextEn,
        isRequired: q.isRequired,
        lock,
        readers: readersOf(q, input.readers),
        numeric: q.type === 'NUMERIC' ? q.numeric : null,
        text: q.type === 'TEXT' ? q.text : null,
        mirroredList: input.readers.mirroredLists.get(q.id) ?? null,
        askedWhen: askedWhenOf(q, byCode),
        answeredBy: [],
        noPayslip: noPayslipAsk(q),
        numberEffects: q.type === 'NUMERIC' ? [...(q.numberEffects ?? [])] : [],
        options: [...q.options]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((o) => ({
            id: o.id,
            code: o.code,
            labelAr: o.labelAr,
            labelEn: o.labelEn,
            displayOrder: o.displayOrder,
            meanings: [
              ...meaningsOf(q.code, o.code, byCode, followUps, input.transferTypes),
              ...(o.effect !== undefined && hasAnyLever(o.effect)
                ? [{ kind: 'offer_effect' as const, ...o.effect }]
                : []),
            ],
            keep: {
              ar: [...wordingQuantities(o.labelAr).written],
              en: [...wordingQuantities(o.labelEn).written],
            },
          })),
      };
    }),
  };
}

function noPayslipAsk(q: EngineRulesInputQuestion): NoPayslipAsk {
  if (q.fixedServedOn === 'every_name') return 'always';
  return q.code === MONEY_FIELD_BINDINGS.requested_amount ? 'unless_derived' : 'never';
}

export function readersOf(q: EngineRulesInputQuestion, views: EngineReaderViews): EngineReader[] {
  const code = q.code;
  const out: EngineReader[] = [];
  const own = engineInputReaderOf(code);
  if (own !== null) {
    out.push(
      own.kind === 'obligation_amount'
        ? {
            ...own,
            monthlyPercent:
              own.debtType === CREDIT_CARD_DEBT_TYPE_OPTION
                ? CREDIT_CARD_LIMIT_MONTHLY_PERCENT.toString()
                : null,
          }
        : { ...own },
    );
  }
  if (code === MONTHS_IN_JOB_QUESTION_CODE)
    out.push({ kind: 'server_input', input: 'months_in_job' });
  if (code === CAN_TRANSFER_SALARY_QUESTION_CODE) {
    out.push({ kind: 'server_input', input: 'salary_transfer' });
  }
  const facts = views.platformFacts.get(code);
  if (facts !== undefined && facts.length > 0)
    out.push({ kind: 'platform_fact', facts: [...facts] });
  if (q.fixedServedOn !== null) {
    out.push({ kind: 'fixed_set', servedOn: q.fixedServedOn });
  }
  const programs = views.programReaders.get(code);
  if (programs !== undefined && programs.length > 0) {
    out.push({ kind: 'programs', programNames: programs.map((p) => ({ ...p })) });
  }
  return out;
}

function meaningsOf(
  questionCode: string,
  optionCode: string,
  byCode: ReadonlyMap<string, EngineRulesInputQuestion>,
  followUps: ReadonlyMap<string, { opens: string[]; hides: string[] }>,
  transferTypes: ReadonlyMap<string, LabelledKey>,
): AnswerMeaning[] {
  const out: AnswerMeaning[] = [];
  const ref = (code: string): QuestionRef | null => {
    const q = byCode.get(code);
    return q === undefined ? null : { code, questionAr: q.questionAr, questionEn: q.questionEn };
  };

  if (questionCode === EMPLOYMENT_TYPE_QUESTION_CODE) {
    const bucket = EMPLOYMENT_BUCKET_BY_OPTION[optionCode];
    if (bucket !== undefined) out.push({ kind: 'job', bucket });
  }
  const range =
    questionCode === I_SCORE_BAND_QUESTION_CODE ? iScoreBandRange(optionCode) : undefined;
  if (range !== undefined) {
    if (range === 'no_score') out.push({ kind: 'iscore_none' });
    else {
      out.push({
        kind: 'iscore_band',
        from: range.from,
        // The table's bands are `[from, to)`; a score is a whole number, so the band ends at
        // `to − 1` — what the admin reads as "up to".
        to: range.to === null ? null : new Decimal(range.to).minus(1).toString(),
      });
    }
  }
  if (questionCode === CAN_TRANSFER_SALARY_QUESTION_CODE) {
    const key = TRANSFER_TYPE_BY_OPTION[optionCode];
    if (key !== undefined) {
      out.push({
        kind: 'transfer',
        transferType: transferTypes.get(key) ?? { key, labelAr: key, labelEn: key },
      });
    }
  }
  let amountQuestion: string | null = null;
  if (questionCode === DEBT_TYPES_QUESTION_CODE) {
    if (optionCode === DEBT_TYPE_NONE_OPTION) out.push({ kind: 'no_debts' });
    const item = obligationItemQuestionFor(optionCode);
    const question = item === undefined ? null : ref(item);
    if (question !== null) {
      amountQuestion = question.code;
      out.push({ kind: 'debt_amount', question });
    }
  }
  const follow = followUps.get(answerKey(questionCode, optionCode));
  // The debt's own amount question is gated on it too; it is already said above.
  const opens = (follow?.opens ?? []).filter((code) => code !== amountQuestion).map(ref);
  const hides = (follow?.hides ?? []).map(ref);
  const present = (list: (QuestionRef | null)[]): QuestionRef[] =>
    list.filter((r): r is QuestionRef => r !== null);
  if (present(opens).length > 0) out.push({ kind: 'opens', questions: present(opens) });
  if (present(hides).length > 0) out.push({ kind: 'hides', questions: present(hides) });
  return out;
}

/**
 * A question's own show-when rule, named. `null` when it has none, and when the rule hangs on
 * a question that is not in the pool: a dangling rule never hides its question
 * (`isQuestionVisible`), so the question is asked always.
 */
function askedWhenOf(
  q: EngineRulesInputQuestion,
  byCode: ReadonlyMap<string, EngineRulesInputQuestion>,
): AskedWhen | null {
  const gate = enabledWhenGate(q);
  if (gate === null) return null;
  const source = byCode.get(gate.questionCode);
  if (source === undefined) return null;
  const labels = new Map(source.options.map((o) => [o.code, o]));
  return {
    question: { code: source.code, questionAr: source.questionAr, questionEn: source.questionEn },
    except: gate.operator === 'not_equals',
    // An answer since retired keeps its code, so the rule is still said in full.
    answers: gate.optionCodes.map((code) => {
      const o = labels.get(code);
      return { code, labelAr: o?.labelAr ?? code, labelEn: o?.labelEn ?? code };
    }),
  };
}

/**
 * For every answer some show-when rule names: the questions it opens (`equals`, `in`) and the
 * ones it hides (`not_equals` — shown for every OTHER answer). In pool order.
 */
function followUpsByAnswer(
  questions: readonly EngineRulesInputQuestion[],
): ReadonlyMap<string, { opens: string[]; hides: string[] }> {
  const out = new Map<string, { opens: string[]; hides: string[] }>();
  const ordered = [...questions].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code),
  );
  for (const q of ordered) {
    const gate = enabledWhenGate(q);
    if (gate === null) continue;
    for (const optionCode of gate.optionCodes) {
      const key = answerKey(gate.questionCode, optionCode);
      const entry = out.get(key) ?? { opens: [], hides: [] };
      (gate.operator === 'not_equals' ? entry.hides : entry.opens).push(q.code);
      out.set(key, entry);
    }
  }
  return out;
}

function answerKey(questionCode: string, optionCode: string): string {
  return `${questionCode}\u0000${optionCode}`;
}
