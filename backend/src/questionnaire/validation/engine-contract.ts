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
 *      engine reads keeps its type, its unit, its required flag, its show-when rule, its place
 *      in the pool, and the answers it offers. Its wording stays editable — all but the
 *      quantities in it (`wordingNumberBreaks`, v30.12.0): "Less than 6 months" may become
 *      "Under 6 months", never "Under 12 months", because the engine reads the CODE and the
 *      applicant picks by the WORDS. A question is locked for one of these reasons, derived —
 *      never ticked by hand, so it can be neither forgotten nor removed by mistake:
 *        - `engine`: every quote reads it — the four money figures, the debts and their amounts,
 *          the job type, what the app reads by code — or the platform owns the fact it answers
 *          (I-Score, the car figures).
 *        - `program`: a live bank programme reads it, through its calculation or a table.
 *        - `base`: it is in the FIXED QUESTION SET (`base-question-set.ts`, v30.11.0) — the
 *          client's income-proof questions, owned in code. On top of everything above, such a
 *          question keeps its bounds, its text length and the loan types it is asked in
 *          (`shapeFixed`): only its wording (question, helper text, answer labels) and its
 *          place in the order change. An engine question in the set keeps reason `engine` and
 *          gains `shapeFixed`.
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
 * "Asked in a loan type" means an ORDINARY row there. An OPT-IN row is asked only by the names
 * that added it (never core, never served without a name), so counting one as "asked" would let
 * a question every applicant needs quietly become one only some names are asked.
 *
 * Paths are walked per (loan type, program name), the way `check:question-scope` walks them,
 * plus the applicant who picked NO name: a mortgage applicant is held to what the name's
 * MORTGAGE programmes read, never to the union over every loan type the name is sold under.
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
  PRIORITY_QUESTION_CODE,
  obligationItemQuestionFor,
  type MoneyFieldBinding,
} from '@/matching/pipeline/money-field-bindings';
import { sortCategories } from '@/common/loan-category.util';
import { sameQuantities, wordingQuantities } from './wording-numbers';
import { Decimal } from '@prisma/client/runtime/library';
import { BASE_QUESTIONS, baseQuestion } from '@/matching/pipeline/base-question-set';
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

/**
 * Questions the MOBILE APP reads by code to fill the apply request, per loan type — one line
 * per `*_apply_mapper.dart`: the job type, the order offers are ranked in, months in the job or
 * the business, where the salary is paid, a past rejection, and the mortgage's property. The
 * server takes those fields from the request body, so it never sees one break: a question that
 * stops being asked, or an answer the app has no arm for, is sent as the app's default (24
 * months, `none`, an apartment, the fastest-approval order, `salaried`) with nothing anywhere
 * saying so. Per loan type because each mapper reads its own set — the car mapper reads no
 * property question, and holding car to one would make an accidental tick impossible to undo.
 * Mirrors the mappers: a code a mapper starts reading is added here in the same change.
 */
//
// Time in the job and the salary transfer are NOT here any more (v30.11.0): `job_tenure` and
// `salary_transfer` left the pool for the fixed question set's `months_in_current_job` and
// `can_transfer_salary`, which the server reads itself (`engine-inputs-from-answers.ts`) —
// the app's own copy is a fallback for an older build — and which the fixed-set lock already
// holds to their answers and their loan types.
export const APP_MAPPED_QUESTIONS_BY_CATEGORY: Readonly<Record<LoanCategory, readonly string[]>> = {
  personal: [EMPLOYMENT_TYPE_QUESTION_CODE, PRIORITY_QUESTION_CODE, 'prior_rejection'],
  car: [EMPLOYMENT_TYPE_QUESTION_CODE, PRIORITY_QUESTION_CODE],
  // The mortgage mapper ALSO reads `prior_rejection`, which is left off on purpose (2026-10-13,
  // v30.10.0): no mortgage programme moves money on it (eligibility is skipped on apply), and
  // the two mortgage names skip it to ask the client's questions. A mortgage programme that
  // starts pricing on it puts it back here in the same change.
  mortgage: [
    EMPLOYMENT_TYPE_QUESTION_CODE,
    PRIORITY_QUESTION_CODE,
    'property_type',
    'property_value',
    'down_payment',
  ],
  business: [PRIORITY_QUESTION_CODE, 'business_age', 'prior_rejection'],
};

/** Every code some mapper reads. */
export const APP_MAPPED_QUESTION_CODES: readonly string[] = [
  ...new Set(Object.values(APP_MAPPED_QUESTIONS_BY_CATEGORY).flat()),
];

/**
 * The engine's own inputs, by code: locked with `optionsFixed`, because the engine or the app
 * maps each of their answers one by one.
 */
export const ENGINE_INPUT_QUESTION_CODES: ReadonlySet<string> = new Set([
  ...ENGINE_INPUT_TYPES.keys(),
  ...APP_MAPPED_QUESTION_CODES,
]);

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
 * Asked in EVERY loan type on sale: the money figures and the debt-type pick (`check:money`).
 * Not the stated obligations total: the debts it summed are asked instead (2026-10-26).
 */
const ASKED_IN_EVERY_LOAN_TYPE: readonly string[] = [
  ...ASKED_MONEY_FIELD_BINDING_KEYS.map((key) => MONEY_FIELD_BINDINGS[key]),
  DEBT_TYPES_QUESTION_CODE,
];

/**
 * Asked with no show-when rule: the money figures, the debt-type pick and the job type. A rule
 * on any of them hides it from somebody, and that applicant is then quoted on the longest term,
 * no income, no debts, or as `salaried`.
 */
const NEVER_GATED: ReadonlySet<string> = new Set([
  ...ASKED_IN_EVERY_LOAN_TYPE,
  EMPLOYMENT_TYPE_QUESTION_CODE,
]);

/** Served under every program name wherever the loan type asks them (`check:questionnaire` 2). */
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
  /** Every loan type it is in, OPT-IN rows included. */
  readonly categories: readonly LoanCategory[];
  /** The opt-in subset of `categories`. */
  readonly optInCategories: readonly LoanCategory[];
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
  /** `narrowingScopeFor(name, category)`; `null` with no name, or a name nothing is sold under. */
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
  /**
   * The car price and down-payment questions. A loan type that asks both may leave the amount
   * unasked: the app works it out as price minus down payment (`check:money`).
   */
  readonly amountDerivableFrom: readonly string[];
}

export type EngineContractRule =
  /** A question every quote reads is switched off or gone. */
  | 'engine_question_off'
  /** …is the wrong type for its reader (a number turned into text, a pick into a number). */
  | 'engine_question_wrong_type'
  /** …is optional. Skipped, it reads as no figure, or as zero debts. */
  | 'engine_question_optional'
  /** …has a show-when rule, or a debt amount shown for the wrong debt. */
  | 'engine_question_gated'
  /** …is not asked (an ordinary row) in a loan type that is on sale and reads it. */
  | 'engine_question_not_asked'
  /** …is asked in the loan type but an applicant's path drops it. */
  | 'engine_question_not_served'
  /** A debt type the applicant can tick has no amount question: it counts as zero. */
  | 'debt_type_unmapped'
  /** A debt type the engine sums is no longer offered. */
  | 'debt_type_missing'
  /** A job type the engine has no bucket for: priced on the programme default. */
  | 'employment_option_unknown'
  /** An active fact is bound to no question, or to one that is switched off. */
  | 'fact_question_off'
  /** An active fact's question is in no loan type: nobody can answer it. */
  | 'fact_question_not_asked'
  /** A question a live programme reads is switched off. */
  | 'program_question_off'
  /** …is not in the loan type that programme is sold under. */
  | 'program_question_not_asked'
  /** …is in it, but an applicant's path drops it. */
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
  /** In the loan type through ANY row — what a programme's own name can be served. */
  const inCategory = (code: string, category: LoanCategory): boolean =>
    byCode.get(code)?.categories.includes(category) === true;
  /** Asked of EVERY applicant of the loan type: an ordinary row, not an opt-in one. */
  const askedIn = (code: string, category: LoanCategory): boolean => {
    const q = byCode.get(code);
    return (
      q !== undefined && q.categories.includes(category) && !q.optInCategories.includes(category)
    );
  };

  // 1. The engine's own inputs: on, the right type, required, and shown unconditionally (or,
  //    for a debt amount, shown exactly when its own debt is ticked).
  for (const [code, expectedType] of ENGINE_INPUT_TYPES) {
    const q = byCode.get(code);
    if (q === undefined) {
      out.push({ rule: 'engine_question_off', questionCode: code });
      continue;
    }
    if (q.type !== expectedType)
      out.push({ rule: 'engine_question_wrong_type', questionCode: code });
    if (!q.isRequired) out.push({ rule: 'engine_question_optional', questionCode: code });
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

  // 4. Asked of every applicant in every loan type on sale that reads it (`check:money`,
  //    `check:questionnaire` 1, and each loan type's own mapper).
  const categoriesOnSale = [...new Set(ctx.flows.map((f) => f.category))].sort();
  for (const category of categoriesOnSale) {
    for (const code of [
      ...ASKED_IN_EVERY_LOAN_TYPE,
      ...APP_MAPPED_QUESTIONS_BY_CATEGORY[category],
    ]) {
      if (askedIn(code, category)) continue;
      if (
        code === MONEY_FIELD_BINDINGS.requested_amount &&
        ctx.amountDerivableFrom.length > 0 &&
        ctx.amountDerivableFrom.every((c) => askedIn(c, category))
      ) {
        continue;
      }
      out.push({ rule: 'engine_question_not_asked', questionCode: code, category });
    }
    if (askedIn(DEBT_TYPES_QUESTION_CODE, category)) {
      for (const item of DEBT_TYPE_BY_ITEM.keys()) {
        if (!askedIn(item, category)) {
          out.push({ rule: 'engine_question_not_asked', questionCode: item, category });
        }
      }
    }
  }

  // 5. Facts: every active one bound to a question that is on and asked somewhere.
  for (const fact of ctx.facts) {
    if (fact.questionCode === null) {
      out.push({ rule: 'fact_question_off', questionCode: '', factKey: fact.key });
      continue;
    }
    const q = byCode.get(fact.questionCode);
    if (q === undefined) {
      out.push({ rule: 'fact_question_off', questionCode: fact.questionCode, factKey: fact.key });
    } else if (q.categories.length === 0) {
      out.push({
        rule: 'fact_question_not_asked',
        questionCode: fact.questionCode,
        factKey: fact.key,
      });
    }
  }

  // 6. Per path — each (loan type, program name), and each loan type's applicant who picked NO
  //    name — what the narrowing SERVES still holds what the engine, the app and that path's
  //    programmes read (`check:questionnaire` 2, `check:question-scope`). The no-name applicant
  //    is quoted on every programme of the loan type, so is held to the union of their reads.
  const readsInCategory = new Map<LoanCategory, Set<string>>();
  for (const flow of ctx.flows) {
    const reads = readsInCategory.get(flow.category) ?? new Set<string>();
    for (const code of flow.scope?.neededByCategory?.[flow.category] ?? []) reads.add(code);
    readsInCategory.set(flow.category, reads);
  }
  const paths: {
    category: LoanCategory;
    programNameKey?: string;
    scope: NarrowingScope | null;
    reads: readonly string[];
  }[] = [
    ...ctx.flows.flatMap((flow) =>
      flow.programNameKey === null
        ? []
        : [
            {
              category: flow.category,
              programNameKey: flow.programNameKey,
              scope: flow.scope,
              reads: flow.scope?.neededByCategory?.[flow.category] ?? [],
            },
          ],
    ),
    ...categoriesOnSale.map((category) => ({
      category,
      scope: null,
      reads: [...(readsInCategory.get(category) ?? [])].sort(),
    })),
  ];
  for (const path of paths) {
    const { category, programNameKey } = path;
    const where = programNameKey === undefined ? { category } : { category, programNameKey };
    const keep = narrowAskedQuestions(
      active
        .filter((q) => q.categories.includes(category))
        .map((q) => ({
          code: q.code,
          enabledWhen: q.enabledWhen,
          optIn: q.optInCategories.includes(category),
        })),
      path.scope,
    ).keep;
    for (const code of [
      ...SERVED_UNDER_EVERY_NAME,
      ...APP_MAPPED_QUESTIONS_BY_CATEGORY[category],
    ]) {
      if (inCategory(code, category) && !keep.has(code)) {
        out.push({ rule: 'engine_question_not_served', questionCode: code, ...where });
      }
    }
    for (const code of path.reads) {
      if (!byCode.has(code)) {
        out.push({ rule: 'program_question_off', questionCode: code, ...where });
      } else if (!inCategory(code, category)) {
        out.push({ rule: 'program_question_not_asked', questionCode: code, ...where });
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
  readonly reason: EngineLockReason;
  /**
   * In the fixed question set: its bounds, its text length and the loan types in `baseCategories`
   * are locked too — only wording and order may change (`base-question-set.ts`).
   */
  readonly shapeFixed: boolean;
  /** The loan types a `shapeFixed` question may never leave (empty otherwise). */
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
    for (const code of flow.scope?.neededByCategory?.[flow.category] ?? []) {
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
 * Which questions are locked, and why. An `engine` reason wins over `base`, and both over
 * `program`; the fixed set adds `shapeFixed` whatever the reason.
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
  // The fixed set: answers owned in code, and the shape with them.
  for (const q of BASE_QUESTIONS) {
    out.set(q.code, {
      reason: out.get(q.code)?.reason ?? 'base',
      optionsFixed: true,
      shapeFixed: true,
      baseCategories: q.categories,
      programNameKeys: [],
    });
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
  | 'optional'
  | 'switched_off'
  | 'gate'
  | 'option_removed'
  | 'option_added'
  /** A numeric bound or step would change (fixed set only). */
  | 'bounds'
  /** A text question's length cap would change (fixed set only). */
  | 'max_length'
  /** It would leave, or turn opt-in in, a loan type the fixed set asks it in. */
  | 'category_removed';

/**
 * Whether `lock` refuses `change`. Everything is refused — adding an answer included, on every
 * lock since v30.12.0 — except the three shape changes only the fixed set locks.
 */
export function isRefusedForLock(lock: EngineLock, change: EngineLockedChange): boolean {
  switch (change) {
    case 'bounds':
    case 'max_length':
    case 'category_removed':
      return lock.shapeFixed;
    default:
      return true;
  }
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
 * Whether `after` drops `code` from a loan type the fixed set asks it in, that `before` asked it
 * in as an ordinary row — removed, or turned opt-in. A loan type it was never in is no change.
 */
export function baseCategoryRemoved(
  code: string,
  before: Pick<ContractQuestion, 'categories' | 'optInCategories'>,
  after: Pick<ContractQuestion, 'categories' | 'optInCategories'>,
): boolean {
  const ordinary = (q: typeof before, c: LoanCategory): boolean =>
    q.categories.includes(c) && !q.optInCategories.includes(c);
  return (baseQuestion(code)?.categories ?? []).some(
    (c) => ordinary(before, c) && !ordinary(after, c),
  );
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
  if (before.isRequired && !after.isRequired) out.push('optional');
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
  if (
    before.type === 'NUMERIC' &&
    after.type === 'NUMERIC' &&
    (!sameDecimal(before.numericMin, after.numericMin) ||
      !sameDecimal(before.numericMax, after.numericMax) ||
      !sameDecimal(before.numericStep, after.numericStep))
  ) {
    out.push('bounds');
  }
  if (
    before.type === 'TEXT' &&
    after.type === 'TEXT' &&
    before.textMaxLength !== after.textMaxLength
  ) {
    out.push('max_length');
  }
  if (baseCategoryRemoved(before.code, before, after)) out.push('category_removed');
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
