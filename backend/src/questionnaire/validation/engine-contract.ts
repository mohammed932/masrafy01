/**
 * The ENGINE-INPUT CONTRACT: what the questionnaire must keep asking for the loan engine to
 * quote accurately, and the edits nobody may make to a question the engine reads.
 *
 * WHY IT EXISTS. Questions are admin-authored, and every write auto-publishes. Before this, the
 * only things standing between an admin edit and a wrong quote were warnings (a health chip on
 * the editor) and CLI scripts nobody runs on a live edit (`check:money`,
 * `check:question-scope`, `check:questionnaire`). An admin could retype the loan-term question,
 * hide it behind a branch, take the income question off a loan type or add a debt type no
 * amount question exists for — every one of them accepted, and every one of them quoted on a
 * figure nobody gave (the longest term, a zero debt, the programme maximum).
 *
 * Two halves, both pure:
 *
 *   1. THE LOCK (`engineLocks` + `isRefusedForLock` + `lockedChangesBetween`). A question the
 *      engine reads keeps its type, its unit, its show-when rule, its place in the pool, and the
 *      answers it offers. Whether it is REQUIRED is the admin's (v31.1.0, operator decision
 *      2026-10-27): an applicant who skips an optional one is quoted without that answer. Its wording stays editable — all but the
 *      quantities in it (`wordingNumberBreaks`, v30.12.0): "Less than 6 months" may become
 *      "Under 6 months", never "Under 12 months", because the engine reads the CODE and the
 *      applicant picks by the WORDS. A question is locked for one of these reasons, derived —
 *      never ticked by hand, so it can be neither forgotten nor removed by mistake:
 *        - `engine`: every quote reads it — the four money figures, the debts and their amounts,
 *          the job type, the months in the job and the salary transfer the server reads itself
 *          — or the platform owns the fact it answers (I-Score, the car figures).
 *        - `program`: a live bank programme reads it, through its calculation or a table.
 *      A FIXED question (`question.fixedServedOn`, the admin's since v31.0.0) is held by its
 *      own rules besides while it is fixed (`fixed-questions.ts`, applied by
 *      `EngineContractService`): gated only on a fixed question, and switched off only by a
 *      super admin's confirmed delete — the one write that may switch off a question this lock
 *      holds. The mark itself is the admin's both ways.
 *      No answer may be ADDED to a locked question, whoever reads it (v30.12.0, operator
 *      decision). Until then a question only a table read could gain one, on the reasoning that
 *      the table might just lack the row — but nothing checks that a new answer has a row, and
 *      one without is quoted on whatever the table does with a stranger. A new answer to an
 *      engine question is a release now. The Manage-values lists that ARE some questions'
 *      answers (compounds, club branches, grades — `syncMirroredOptions`) are not questionnaire
 *      writes and stay open: each bank's table states what an unlisted value gets.
 *
 *   2. THE RATCHET (`engineContractViolations` + `introducedViolations`). The invariants the
 *      warnings and the scripts already stated, evaluated on the questionnaire a write WOULD
 *      leave behind, compared with the one it leaves today. A write that adds a violation is
 *      refused; one that leaves an existing violation where it was is not. Refusing on the
 *      absolute state instead would freeze the whole editor on the first standing problem —
 *      including the edit that might be fixing it.
 *
 * Paths are walked per (loan type, program name), the way `check:question-scope` walks them: a
 * mortgage applicant is held to what the name's MORTGAGE programmes read, never to the union
 * over every loan type the name is sold under. A question carries no loan type since v32.0.0,
 * so there is no "asked in the loan type" to hold any more — what a path SERVES is the whole of
 * it (`question-scope.ts`).
 */
import type { LoanCategory } from '@prisma/client';
import {
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  DEBT_TYPE_OPTION_CODES,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  ASKED_MONEY_FIELD_BINDING_KEYS,
  MONEY_FIELD_BINDING_KEYS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
  obligationItemQuestionFor,
  type MoneyFieldBinding,
} from '@/matching/pipeline/money-field-bindings';
import { sortCategories } from '@/common/loan-category.util';
import { sameQuantities, wordingQuantities } from './wording-numbers';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CAN_TRANSFER_SALARY_QUESTION_CODE,
  I_SCORE_BAND_QUESTION_CODE,
  MONTHS_IN_JOB_QUESTION_CODE,
  OTHER_INCOME_QUESTION_CODE,
} from '@/matching/pipeline/base-question-set';
import type { FixedServedOn } from './fixed-questions';
import { isKnownEmploymentType } from '@/matching/pipeline/employment-type';
import { narrowAskedQuestions, type NarrowingScope } from './question-scope';
import { enabledWhenGate } from './question-visibility';

// ---- The engine's own inputs ----------------------------------------------

/**
 * Every question the engine reads on EVERY quote, with the type its reader expects. Derived
 * from the binding constants, never typed out: a new obligation item is covered by the change
 * that adds it.
 */
const ENGINE_INPUT_TYPES: ReadonlyMap<string, string> = new Map<string, string>([
  ...MONEY_FIELD_BINDING_KEYS.map((key) => [MONEY_FIELD_BINDINGS[key], 'NUMERIC'] as const),
  [DEBT_TYPES_QUESTION_CODE, 'MULTI_SELECT'],
  ...Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE).map((code) => [code, 'NUMERIC'] as const),
  [EMPLOYMENT_TYPE_QUESTION_CODE, 'SINGLE_SELECT'],
]);

// The questions the MOBILE APP read by code to fill the apply request — the order offers are
// ranked in, a past rejection, the business's age, the mortgage's property — were held here
// per loan type until v31.0.0, when all six were switched off: nothing prices them, and the app
// sends its defaults unasked (the fastest-approval order, no rejection, 24 months, an
// apartment). The job left before them (v30.18.0); the time in the job and the salary transfer
// are read by the server itself (`engine-inputs-from-answers.ts`) and are listed below.

/**
 * The questions the SERVER reads by code beside the bindings above
 * (`engine-inputs-from-answers.ts`): the months in the job, and the salary transfer, whose
 * answers map one by one to a rate-table key (`TRANSFER_TYPE_BY_OPTION`). Locked like the
 * engine's own inputs, so no answer without a meaning can be added to them — the fixed-set lock
 * used to hold them, and since v31.0.0 a fixed question is otherwise the admin's to edit.
 */
const SERVER_READ_QUESTION_CODES: readonly string[] = [
  MONTHS_IN_JOB_QUESTION_CODE,
  CAN_TRANSFER_SALARY_QUESTION_CODE,
];

/**
 * The engine's own inputs, by code: locked with `optionsFixed`, because the engine maps each of
 * their answers one by one.
 */
export const ENGINE_INPUT_QUESTION_CODES: ReadonlySet<string> = new Set([
  ...ENGINE_INPUT_TYPES.keys(),
  ...SERVER_READ_QUESTION_CODES,
]);

/**
 * Every question code the engine reads BY CODE today — the four money figures it asks, the
 * debts, the two the server reads itself, the I-Score band and the other income. Deleting one
 * of them is allowed (a super admin's confirmed delete of a fixed question), and changes quotes;
 * `check:questionnaire` warns while one is switched off.
 */
export const ENGINE_READ_CODES: readonly string[] = [
  ...ASKED_MONEY_FIELD_BINDING_KEYS.map((key) => MONEY_FIELD_BINDINGS[key]),
  DEBT_TYPES_QUESTION_CODE,
  ...Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE),
  ...SERVER_READ_QUESTION_CODES,
  I_SCORE_BAND_QUESTION_CODE,
  OTHER_INCOME_QUESTION_CODE,
];

/** The debt-type pick each obligation amount question is shown for. */
const DEBT_TYPE_BY_ITEM: ReadonlyMap<string, string> = new Map(
  Object.entries(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE).map(([debtType, item]) => [item, debtType]),
);

/** How the engine itself reads one of its own inputs — what the engine-rules view says. */
export type EngineInputReader =
  /** One of the four money figures every quote is built on. */
  | { readonly kind: 'money_input'; readonly binding: MoneyFieldBinding }
  /** The debt-type pick: which amount questions are asked, and what is summed. */
  | { readonly kind: 'debt_types' }
  /** One debt's amount, shown when that debt is ticked. */
  | { readonly kind: 'obligation_amount'; readonly debtType: string }
  /** The job type: the bucket a programme's DBR, term and rate tables are keyed by. */
  | { readonly kind: 'employment_type' };

/** The engine's own reading of `code`, or `null` when it is not one of the engine's inputs. */
export function engineInputReaderOf(code: string): EngineInputReader | null {
  const binding = MONEY_FIELD_BINDING_KEYS.find((key) => MONEY_FIELD_BINDINGS[key] === code);
  if (binding !== undefined) return { kind: 'money_input', binding };
  if (code === DEBT_TYPES_QUESTION_CODE) return { kind: 'debt_types' };
  const debtType = DEBT_TYPE_BY_ITEM.get(code);
  if (debtType !== undefined) return { kind: 'obligation_amount', debtType };
  if (code === EMPLOYMENT_TYPE_QUESTION_CODE) return { kind: 'employment_type' };
  return null;
}

/**
 * The money figures and the debt-type pick (`check:money`) — never gated. Not the stated
 * obligations total: the debts it summed are asked instead (2026-10-26).
 */
const ASKED_OF_EVERY_APPLICANT: readonly string[] = [
  ...ASKED_MONEY_FIELD_BINDING_KEYS.map((key) => MONEY_FIELD_BINDINGS[key]),
  DEBT_TYPES_QUESTION_CODE,
];

/**
 * Asked with no show-when rule: the money figures, the debt-type pick and the job type. A rule
 * on any of them hides it from somebody, and that applicant is then quoted on the longest term,
 * no income, no debts, or as `salaried`.
 */
const NEVER_GATED: ReadonlySet<string> = new Set([
  ...ASKED_OF_EVERY_APPLICANT,
  EMPLOYMENT_TYPE_QUESTION_CODE,
]);

/** Served under every program name (`check:questionnaire` 2). */
const SERVED_UNDER_EVERY_NAME: readonly string[] = [
  DEBT_TYPES_QUESTION_CODE,
  ...Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE),
  MONEY_FIELD_BINDINGS.tenor_months,
];

// ---- Shapes ---------------------------------------------------------------

/**
 * One question as the contract reads it — buildable from the live pool AND from a frozen
 * snapshot, so a rollback is judged by the same rules as an edit.
 */
export interface ContractQuestion {
  readonly id: string;
  readonly code: string;
  readonly type: string;
  readonly isActive: boolean;
  readonly isRequired: boolean;
  readonly enabledWhen: unknown;
  /** ACTIVE option codes. */
  readonly optionCodes: readonly string[];
  /** The numeric unit, ar and en — what a figure IS (EGP a month, months). */
  readonly unitAr: string | null;
  readonly unitEn: string | null;
  /** The numeric bounds as decimal strings; `null` = unbounded / no step. */
  readonly numericMin: string | null;
  readonly numericMax: string | null;
  readonly numericStep: string | null;
  /** A text question's length cap; `null` = none. */
  readonly textMaxLength: number | null;
  /**
   * FIXED (`question.fixedServedOn`, v31.0.0): core wherever it is served, so the narrowing
   * this contract walks serves it as serve and apply do. Absent = not fixed.
   */
  readonly fixedServedOn?: FixedServedOn | null;
  /**
   * What the applicant reads — judged only for the quantities in it (`wordingNumberBreaks`).
   * Absent where the caller has no wording to give; then nothing about wording is judged.
   */
  readonly wording?: ContractWording;
}

/** A question's wording, ar and en, and its ACTIVE answers' labels by code. */
export interface ContractWording {
  readonly questionAr: string;
  readonly questionEn: string;
  readonly helperTextAr: string | null;
  readonly helperTextEn: string | null;
  readonly optionLabels: Readonly<
    Record<string, { readonly labelAr: string; readonly labelEn: string }>
  >;
}

/** The wording a write would leave. `undefined` = left as it is; `null` clears a helper text. */
export interface ProposedWording {
  readonly questionAr?: string;
  readonly questionEn?: string;
  readonly helperTextAr?: string | null;
  readonly helperTextEn?: string | null;
  readonly optionLabels?: Readonly<
    Record<string, { readonly labelAr?: string; readonly labelEn?: string }>
  >;
}

/** One wording whose quantities a write would change. */
export interface WordingNumberBreak {
  readonly field: 'question' | 'helper' | 'option';
  /** The answer, on an `option` break; `null` otherwise. */
  readonly optionCode: string | null;
  readonly language: 'ar' | 'en';
  readonly was: string;
  readonly now: string;
  /** What `was` states, as written — what has to stay. */
  readonly keep: readonly string[];
  /** What `now` states, as written. */
  readonly found: readonly string[];
}

/** One path an applicant can be quoted on. `programNameKey: null` = a programme with no name. */
export interface ContractFlow {
  readonly category: LoanCategory;
  readonly programNameKey: string | null;
  /** `narrowingScopeFor(name, category)`; `null` with no name, or an unknown or retired name. */
  readonly scope: NarrowingScope | null;
}

/** An ACTIVE registry fact and the question bound to it (`null` = unbound). */
export interface ContractFact {
  readonly key: string;
  readonly questionCode: string | null;
}

/** Everything about the world a questionnaire write cannot change. Read once per write. */
export interface EngineContractContext {
  readonly flows: readonly ContractFlow[];
  readonly facts: readonly ContractFact[];
  /** Questions bound to a fact the platform owns (`isReservedFactKey`). */
  readonly platformQuestionCodes: readonly string[];
}

export type EngineContractRule =
  /** A question every quote reads is switched off or gone. */
  | 'engine_question_off'
  /** …is the wrong type for its reader (a number turned into text, a pick into a number). */
  | 'engine_question_wrong_type'
  /** …has a show-when rule, or a debt amount shown for the wrong debt. */
  | 'engine_question_gated'
  /** …is on, but an applicant's path drops it. */
  | 'engine_question_not_served'
  /** A debt type the applicant can tick has no amount question: it counts as zero. */
  | 'debt_type_unmapped'
  /** A debt type the engine sums is no longer offered. */
  | 'debt_type_missing'
  /** A job type the engine has no bucket for: priced on the programme default. */
  | 'employment_option_unknown'
  /** An active fact is bound to no question, or to one that is switched off. */
  | 'fact_question_off'
  /** A question a live programme reads is switched off. */
  | 'program_question_off'
  /** …is on, but the path of the program it is read under drops it. */
  | 'program_question_not_served';

export interface EngineContractViolation {
  readonly rule: EngineContractRule;
  readonly questionCode: string;
  readonly category?: LoanCategory;
  /** The program name of the path; absent on a loan-type rule and on the no-name path. */
  readonly programNameKey?: string;
  readonly optionCode?: string;
  readonly factKey?: string;
}

// ---- The ratchet ------------------------------------------------------------

/** Identity for the before/after comparison: same rule, same question, same path. */
export function violationKey(v: EngineContractViolation): string {
  return [
    v.rule,
    v.questionCode,
    v.category ?? '',
    v.programNameKey ?? '',
    v.optionCode ?? '',
    v.factKey ?? '',
  ].join('|');
}

/** The violations `after` has and `before` does not — the ones a write would introduce. */
export function introducedViolations(
  before: readonly EngineContractViolation[],
  after: readonly EngineContractViolation[],
): EngineContractViolation[] {
  const existing = new Set(before.map(violationKey));
  const seen = new Set<string>();
  return after.filter((v) => {
    const key = violationKey(v);
    if (existing.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Every way the questionnaire `questions` describes fails the engine on the paths in `ctx`. */
export function engineContractViolations(
  questions: readonly ContractQuestion[],
  ctx: EngineContractContext,
): EngineContractViolation[] {
  const out: EngineContractViolation[] = [];
  const active = questions.filter((q) => q.isActive);
  const byCode = new Map(active.map((q) => [q.code, q]));

  // 1. The engine's own inputs: on, the right type, and shown unconditionally (or, for a debt
  //    amount, shown exactly when its own debt is ticked). Required is the admin's (v31.1.0).
  for (const [code, expectedType] of ENGINE_INPUT_TYPES) {
    const q = byCode.get(code);
    if (q === undefined) {
      out.push({ rule: 'engine_question_off', questionCode: code });
      continue;
    }
    if (q.type !== expectedType)
      out.push({ rule: 'engine_question_wrong_type', questionCode: code });
    const gate = gateOf(q.enabledWhen);
    const debtType = DEBT_TYPE_BY_ITEM.get(code);
    const gateIsRight =
      debtType === undefined
        ? !NEVER_GATED.has(code) || gate === null
        : gate !== null &&
          gate.questionCode === DEBT_TYPES_QUESTION_CODE &&
          gate.operator === 'equals' &&
          gate.optionCodes.length === 1 &&
          gate.optionCodes[0] === debtType;
    if (!gateIsRight) out.push({ rule: 'engine_question_gated', questionCode: code });
  }

  // 2. What the debt-type pick offers: every debt the engine sums, and nothing it cannot.
  const debtTypes = byCode.get(DEBT_TYPES_QUESTION_CODE);
  if (debtTypes !== undefined) {
    for (const optionCode of debtTypes.optionCodes) {
      if (optionCode === DEBT_TYPE_NONE_OPTION) continue;
      if (obligationItemQuestionFor(optionCode) === undefined) {
        out.push({
          rule: 'debt_type_unmapped',
          questionCode: DEBT_TYPES_QUESTION_CODE,
          optionCode,
        });
      }
    }
    for (const optionCode of [DEBT_TYPE_NONE_OPTION, ...DEBT_TYPE_OPTION_CODES]) {
      if (!debtTypes.optionCodes.includes(optionCode)) {
        out.push({ rule: 'debt_type_missing', questionCode: DEBT_TYPES_QUESTION_CODE, optionCode });
      }
    }
  }

  // 3. What the job-type pick offers: only answers the engine can put in a bucket.
  for (const optionCode of byCode.get(EMPLOYMENT_TYPE_QUESTION_CODE)?.optionCodes ?? []) {
    if (!isKnownEmploymentType(optionCode)) {
      out.push({
        rule: 'employment_option_unknown',
        questionCode: EMPLOYMENT_TYPE_QUESTION_CODE,
        optionCode,
      });
    }
  }

  // 4. Facts: every active one bound to a question that is on. Where it is ASKED is the
  //    program's (v32.0.0): a programme that reads it puts it on its own path (rule 5).
  for (const fact of ctx.facts) {
    if (fact.questionCode === null) {
      out.push({ rule: 'fact_question_off', questionCode: '', factKey: fact.key });
      continue;
    }
    if (!byCode.has(fact.questionCode)) {
      out.push({ rule: 'fact_question_off', questionCode: fact.questionCode, factKey: fact.key });
    }
  }

  // 5. Per path — each (loan type, program name) an applicant can be quoted under — what the
  //    narrowing SERVES still holds what the engine and that path's programmes read
  //    (`check:questionnaire` 2, `check:question-scope`). A programme sold under no name has no
  //    path of its own: every active programme carries a name, and the app makes the applicant
  //    pick one whenever there is one to pick.
  for (const flow of ctx.flows) {
    if (flow.programNameKey === null || flow.scope === null) continue;
    const where = { category: flow.category, programNameKey: flow.programNameKey };
    const keep = narrowAskedQuestions(
      active.map((q) => ({
        code: q.code,
        enabledWhen: q.enabledWhen,
        fixedServedOn: q.fixedServedOn ?? null,
      })),
      flow.scope,
    ).keep;
    for (const code of SERVED_UNDER_EVERY_NAME) {
      if (byCode.has(code) && !keep.has(code)) {
        out.push({ rule: 'engine_question_not_served', questionCode: code, ...where });
      }
    }
    for (const code of flow.scope.programReadQuestionCodes ?? []) {
      if (!byCode.has(code)) {
        out.push({ rule: 'program_question_off', questionCode: code, ...where });
      } else if (!keep.has(code)) {
        out.push({ rule: 'program_question_not_served', questionCode: code, ...where });
      }
    }
  }

  return out;
}

// ---- The lock ---------------------------------------------------------------

export type EngineLockReason = 'engine' | 'base' | 'program';

export interface EngineLock {
  /**
   * `engine` or `program` here. `base` (a FIXED question this path serves) is the program-name
   * board's reason (`questionLockReason`); the fixed rules themselves are `fixed-questions.ts`.
   */
  readonly reason: EngineLockReason;
  /**
   * Always `false` since v31.0.0: the registry-only bounds / length / loan-type lock went with
   * the code registry. Kept on the wire one release for an admin bundle built before.
   */
  readonly shapeFixed: boolean;
  /** Always empty since v31.0.0 (see `shapeFixed`). */
  readonly baseCategories: readonly LoanCategory[];
  /**
   * No answer may be ADDED. True on every lock since v30.12.0 (see the header); kept on the wire
   * so an admin bundle built before it still hides "Add answer".
   */
  readonly optionsFixed: boolean;
  /** The program names whose programmes read it — empty for an `engine` lock. Sorted. */
  readonly programNameKeys: readonly string[];
}

/** A program name whose live programmes read a question, and the loan types they are sold in. */
export interface ProgramReader {
  readonly programNameKey: string;
  readonly categories: readonly LoanCategory[];
}

/**
 * Every question a live programme reads, by code, with each program name reading it and the
 * loan types it reads it in — whatever else locks the question. Names sorted, loan types in
 * registry order.
 */
export function programReaders(
  ctx: EngineContractContext,
): ReadonlyMap<string, readonly ProgramReader[]> {
  const byCode = new Map<string, Map<string, Set<LoanCategory>>>();
  for (const flow of ctx.flows) {
    if (flow.programNameKey === null) continue;
    for (const code of flow.scope?.programReadQuestionCodes ?? []) {
      const names = byCode.get(code) ?? new Map<string, Set<LoanCategory>>();
      const categories = names.get(flow.programNameKey) ?? new Set<LoanCategory>();
      categories.add(flow.category);
      names.set(flow.programNameKey, categories);
      byCode.set(code, names);
    }
  }
  const out = new Map<string, ProgramReader[]>();
  for (const [code, names] of byCode) {
    out.set(
      code,
      [...names.keys()].sort().map((programNameKey) => ({
        programNameKey,
        categories: sortCategories([...(names.get(programNameKey) ?? [])]),
      })),
    );
  }
  return out;
}

/**
 * Which questions are locked, and why: an `engine` reason wins over `program`. A FIXED question
 * is locked here only where the engine or a programme reads it; otherwise the admin edits it
 * within the fixed rules (`fixed-questions.ts`, v31.0.0).
 */
export function engineLocks(ctx: EngineContractContext): ReadonlyMap<string, EngineLock> {
  const out = new Map<string, EngineLock>();
  const unshaped = {
    optionsFixed: true,
    shapeFixed: false,
    baseCategories: [],
    programNameKeys: [],
  } as const;
  for (const code of ctx.platformQuestionCodes) {
    out.set(code, { reason: 'engine', ...unshaped });
  }
  for (const code of ENGINE_INPUT_QUESTION_CODES) {
    out.set(code, { reason: 'engine', ...unshaped });
  }
  for (const [code, readers] of programReaders(ctx)) {
    if (out.has(code)) continue;
    out.set(code, {
      reason: 'program',
      optionsFixed: true,
      shapeFixed: false,
      baseCategories: [],
      programNameKeys: readers.map((r) => r.programNameKey),
    });
  }
  return out;
}

/** A change to a locked question, by what it would change. */
export type EngineLockedChange =
  | 'type'
  | 'unit'
  | 'switched_off'
  | 'gate'
  | 'option_removed'
  | 'option_added';

/**
 * Whether `lock` refuses `change`. Every locked change is refused — adding an answer included,
 * on every lock since v30.12.0. (The registry-only bounds / length / loan-type changes went with
 * the code registry in v31.0.0; a fixed question's loan types are the fixed rules' now.)
 */
export function isRefusedForLock(_lock: EngineLock, _change: EngineLockedChange): boolean {
  return true;
}

/**
 * The wordings whose QUANTITIES `after` would change (`wording-numbers.ts`) — the numbers, and
 * the words that scale or measure them. Each language against its own current text; only the
 * fields `after` states, and only answers on both sides (adding or removing one is its own
 * locked change). Answers in code order, so a refusal names the same one every time.
 */
export function wordingNumberBreaks(
  before: ContractWording,
  after: ProposedWording,
): WordingNumberBreak[] {
  const out: WordingNumberBreak[] = [];
  const judge = (
    field: WordingNumberBreak['field'],
    optionCode: string | null,
    language: WordingNumberBreak['language'],
    was: string | null,
    now: string | null | undefined,
  ): void => {
    if (now === undefined) return;
    const a = wordingQuantities(was);
    const b = wordingQuantities(now);
    if (sameQuantities(a, b)) return;
    out.push({
      field,
      optionCode,
      language,
      was: was ?? '',
      now: now ?? '',
      keep: a.written,
      found: b.written,
    });
  };
  judge('question', null, 'en', before.questionEn, after.questionEn);
  judge('question', null, 'ar', before.questionAr, after.questionAr);
  judge('helper', null, 'en', before.helperTextEn, after.helperTextEn);
  judge('helper', null, 'ar', before.helperTextAr, after.helperTextAr);
  const proposed = after.optionLabels ?? {};
  for (const code of Object.keys(proposed).sort()) {
    const was = before.optionLabels[code];
    const now = proposed[code];
    if (was === undefined || now === undefined) continue;
    judge('option', code, 'en', was.labelEn, now.labelEn);
    judge('option', code, 'ar', was.labelAr, now.labelAr);
  }
  return out;
}

/**
 * Every locked change between a question as it is and as it would be — what a ROLLBACK does to
 * a locked question in one go, judged exactly as the same edits made one at a time would be.
 * `before` is the live row; `after` is the frozen one (`undefined` = the version does not ask
 * it at all). A question switched off today and on in the version is not a locked change.
 */
export function lockedChangesBetween(
  before: ContractQuestion,
  after: ContractQuestion | undefined,
): EngineLockedChange[] {
  if (!before.isActive) return [];
  if (after === undefined || !after.isActive) return ['switched_off'];
  const out: EngineLockedChange[] = [];
  if (after.type !== before.type) out.push('type');
  if (!sameGate(before.enabledWhen, after.enabledWhen)) out.push('gate');
  if (
    before.type === 'NUMERIC' &&
    after.type === 'NUMERIC' &&
    (!sameText(before.unitAr, after.unitAr) || !sameText(before.unitEn, after.unitEn))
  ) {
    out.push('unit');
  }
  if (before.optionCodes.some((code) => !after.optionCodes.includes(code))) {
    out.push('option_removed');
  }
  if (after.optionCodes.some((code) => !before.optionCodes.includes(code))) {
    out.push('option_added');
  }
  return out;
}

/**
 * Whether two show-when rules are the same rule (`null` and absent are the same: none). An `in`
 * rule is the same rule whatever order its answers were listed in.
 */
export function sameGate(a: unknown, b: unknown): boolean {
  const x = gateOf(a);
  const y = gateOf(b);
  if (x === null || y === null) return x === y;
  const xs = [...x.optionCodes].sort();
  const ys = [...y.optionCodes].sort();
  return (
    x.questionCode === y.questionCode &&
    x.operator === y.operator &&
    xs.length === ys.length &&
    xs.every((code, i) => code === ys[i])
  );
}

/** Two decimal strings as the same number — `"10000"` and `"10000.00"` alike; `null` = none. */
export function sameDecimal(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  try {
    return new Decimal(a).equals(new Decimal(b));
  } catch {
    return a === b;
  }
}

/** Two units, trimmed, empty and absent alike — the editor trims and blanks; a seed may not. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim() === (b ?? '').trim();
}

/** The stored rule as `question-visibility.ts` reads it — the one reading of that JSON. */
function gateOf(enabledWhen: unknown): ReturnType<typeof enabledWhenGate> {
  return enabledWhenGate({ enabledWhen });
}
