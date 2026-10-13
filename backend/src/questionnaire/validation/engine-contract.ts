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
 *      in the pool, and the answers it offers. Its wording stays editable. A question is locked
 *      for one of two reasons, derived — never ticked by hand, so it can be neither forgotten
 *      nor removed by mistake:
 *        - `engine`: every quote reads it — the four money figures, the debts and their amounts,
 *          the job type, what the app reads by code — or the platform owns the fact it answers
 *          (I-Score, the car figures).
 *        - `program`: a live bank programme reads it, through its calculation or a table.
 *      Whether an answer may be ADDED is its own flag (`optionsFixed`): never to a question the
 *      engine or the app maps answer by answer (a debt with no amount question, a job type with
 *      no bucket, a priority with no sort key means nothing anywhere); freely to one a table
 *      reads (the table may just lack the row, which the programme already reports).
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
  MONEY_FIELD_BINDING_KEYS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
  PRIORITY_QUESTION_CODE,
  obligationItemQuestionFor,
} from '@/matching/pipeline/money-field-bindings';
import { isKnownEmploymentType } from '@/matching/pipeline/employment-type';
import { narrowAskedQuestions, type NarrowingScope } from './question-scope';

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
export const APP_MAPPED_QUESTIONS_BY_CATEGORY: Readonly<Record<LoanCategory, readonly string[]>> = {
  personal: [
    EMPLOYMENT_TYPE_QUESTION_CODE,
    PRIORITY_QUESTION_CODE,
    'job_tenure',
    'salary_transfer',
    'prior_rejection',
  ],
  car: [EMPLOYMENT_TYPE_QUESTION_CODE, PRIORITY_QUESTION_CODE, 'job_tenure', 'salary_transfer'],
  // The mortgage mapper ALSO reads `job_tenure`, `salary_transfer`, `prior_rejection`,
  // `in_compound` and `registration_status`, and they are left off on purpose (2026-10-13,
  // v30.10.0): no mortgage programme moves money on any of them (every transfer table is one
  // `none` row, eligibility is skipped on apply, the other three are stored and read by
  // nothing), and the two mortgage names skip them to ask the client's eleven questions. Every
  // mortgage applicant is quoted on the mapper's defaults. A mortgage programme that starts
  // pricing on one puts it back here in the same change.
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

/** Asked in EVERY loan type on sale: the money figures and the debt-type pick (`check:money`). */
const ASKED_IN_EVERY_LOAN_TYPE: readonly string[] = [
  ...MONEY_FIELD_BINDING_KEYS.map((key) => MONEY_FIELD_BINDINGS[key]),
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
          gate.optionCode === debtType;
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

export type EngineLockReason = 'engine' | 'program';

export interface EngineLock {
  readonly reason: EngineLockReason;
  /**
   * No answer may be ADDED: the engine or the app maps this question's answers one by one, so a
   * new one would mean nothing anywhere. False where a table reads it (a programme's, or the
   * platform's own car and I-Score tables): the table may just lack the row, which the
   * programme already reports as a stated reason.
   */
  readonly optionsFixed: boolean;
  /** The program names whose programmes read it — empty for an `engine` lock. Sorted. */
  readonly programNameKeys: readonly string[];
}

/** Which questions are locked, and why. An `engine` reason wins over a `program` one. */
export function engineLocks(ctx: EngineContractContext): ReadonlyMap<string, EngineLock> {
  const out = new Map<string, EngineLock>();
  for (const code of ctx.platformQuestionCodes) {
    out.set(code, { reason: 'engine', optionsFixed: false, programNameKeys: [] });
  }
  for (const code of ENGINE_INPUT_QUESTION_CODES) {
    out.set(code, { reason: 'engine', optionsFixed: true, programNameKeys: [] });
  }
  const readers = new Map<string, Set<string>>();
  for (const flow of ctx.flows) {
    if (flow.programNameKey === null) continue;
    for (const code of flow.scope?.neededByCategory?.[flow.category] ?? []) {
      if (out.has(code)) continue;
      const names = readers.get(code) ?? new Set<string>();
      names.add(flow.programNameKey);
      readers.set(code, names);
    }
  }
  for (const [code, names] of readers) {
    out.set(code, { reason: 'program', optionsFixed: false, programNameKeys: [...names].sort() });
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
  | 'option_added';

/** Whether `lock` refuses `change`. Everything is refused except adding an answer where allowed. */
export function isRefusedForLock(lock: EngineLock, change: EngineLockedChange): boolean {
  return change !== 'option_added' || lock.optionsFixed;
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
  return out;
}

/** Whether two show-when rules are the same rule (`null` and absent are the same: none). */
export function sameGate(a: unknown, b: unknown): boolean {
  const x = gateOf(a);
  const y = gateOf(b);
  if (x === null || y === null) return x === y;
  return (
    x.questionCode === y.questionCode && x.operator === y.operator && x.optionCode === y.optionCode
  );
}

/** Two units, trimmed, empty and absent alike — the editor trims and blanks; a seed may not. */
export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim() === (b ?? '').trim();
}

function gateOf(
  enabledWhen: unknown,
): { questionCode: string; operator: string; optionCode: string } | null {
  if (enabledWhen === null || typeof enabledWhen !== 'object') return null;
  const rule = enabledWhen as { questionCode?: unknown; operator?: unknown; optionCode?: unknown };
  if (typeof rule.questionCode !== 'string' || typeof rule.optionCode !== 'string') return null;
  return {
    questionCode: rule.questionCode,
    operator: typeof rule.operator === 'string' ? rule.operator : 'equals',
    optionCode: rule.optionCode,
  };
}
