/**
 * Which questions an applicant is put in front of: the ones the PROGRAM they picked asks
 * (v32.0.0 — a question carries no loan type; operator decision 2026-10-29: "questions in app
 * show per selected program not loan category ... make assignment to program only").
 *
 * A program here is a catalog program NAME under one loan type, and it asks:
 *   - the FIXED questions (`question.fixedServedOn`, the admin's): the `every_name` ones on every
 *     program, the `income_proof` ones on every program that sells a payslip programme, the
 *     `income_surrogate` ones on every program that sells a no-payslip one (v32.1.0);
 *   - the money and debt questions every quote reads (the core below);
 *   - what a bank programme filed under the name IN THIS LOAN TYPE reads (NEEDED) — on both
 *     income bases, because a payslip programme's cap table reads facts exactly as a no-payslip
 *     programme's calculation does;
 *   - what the operator TICKED for it (`program_name_question_addition`);
 *   - and the show-when source of anything kept.
 * There is no other list in between. Until v32.0.0 a loan-type assignment
 * (`question_loan_category`) bounded all of this from above and silently dropped what it did not
 * hold; it is gone, and so are the per-name SKIPS, which only ever made sense against it.
 *
 * READ LIVE, and NOT frozen into the snapshot. The inputs are derived from
 * `surrogate_product_ask`, `bank_program.incomeAssumption`, `bank_program.loanLimits` and
 * `platform_enumeration.incomeRule` — none of it questionnaire content — and `factsReadBy` says
 * in its own docstring why a stored copy is the wrong shape: "DERIVED, never stored. The rule
 * already names each fact it reads, so a second list saying which questions the product needs
 * could only ever drift out of step with it." A frozen copy would be that second list, and it
 * would go stale in the direction that RAISES a ceiling: editing a cap table publishes no
 * questionnaire version, so the stale copy would keep hiding a question the cap started
 * reading, `maxLoanByFact` would miss, and `onNoMatch: 'useProgramMax'` would quote above the
 * bank's own table with nothing reporting it. The ticks and the program's ORDER
 * (`program_name_question_order`, `orderServed` below) are read live with the rest, for the
 * same reason: they belong to the program, not to questionnaire content.
 *
 * Pure, and structural about the question rows for the reason `question-visibility.ts` is: the
 * frozen snapshot and the live `question` table are different shapes and both have to fit.
 */

import { enabledWhenGate } from './question-visibility';
import {
  ALL_FIXED_SIDES,
  fixedCodesServed,
  fixedServedHere,
  type FixedServedOn,
} from './fixed-questions';
import {
  DEBT_TYPES_QUESTION_CODE,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  MONEY_FIELD_BINDING_SPECS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
  PRIORITY_QUESTION_CODE,
} from '@/matching/pipeline/money-field-bindings';

/**
 * Questions no program may ever narrow away, whatever any ask board says.
 *
 * Each one moves money for EVERY program, so hiding one does not narrow a questionnaire — it
 * changes a quote:
 *
 *   - the money bindings are the requested amount, the tenor, the declared salary and the
 *     stated obligations total (that last one no longer asked since 2026-10-26 — listed so a
 *     stored row still reads as core). They are the debt-burden ratio's own inputs, and the
 *     mobile reads them to fill the application — a snapshot missing one the flow needs
 *     leaves Finish dead with nothing on screen saying why.
 *   - `current_loans` is the branch source whose PRESENCE in the asked set is what separates
 *     "this snapshot never asked about itemised debts, use the stated lump sum" from "it asked
 *     and got no answer". Drop it and every applicant silently re-routes.
 *   - each `obligation_*` amount is a term of that sum, and `credit_card_total_limit` is
 *     counted at 5% of the limit by every program while ALSO being the one fact
 *     `card_limit_share` reads. It is the clearest case for this list existing at all: a
 *     product genuinely reads it, and it still must not be product-scoped.
 *
 * Derived from the existing constants, never typed out, so a new obligation item is covered by
 * the change that adds it.
 */
export const NEVER_PRODUCT_SCOPED_QUESTION_CODES: ReadonlySet<string> = new Set<string>([
  ...Object.values(MONEY_FIELD_BINDING_SPECS).map((spec) => spec.questionCode),
  DEBT_TYPES_QUESTION_CODE,
  ...Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE),
]);

/**
 * The part of the core a PRODUCT-ONLY name still asks (2026-09-24, reversing part of the
 * 2026-09-23 decision that emptied it).
 *
 *   - what the applicant already owes: `current_loans` and every amount it unlocks. Every bank
 *     sheet behind these names states a DBR (ABK 50%, CAE 50/40, EGBank 50%; spec App. A/B), and
 *     a DBR is "income × cap − obligations" — with the debts unasked, the engine counted them as
 *     zero and lent the full cap to anyone who owes money.
 *   - the loan duration. The plan tables and caps give a CEILING per band, not a term; unasked,
 *     the app sent the longest one, which is the lowest instalment and the most generous DBR.
 *
 * Since 2026-10-26 every one of these is also a FIXED question asked on every name
 * (`question.fixedServedOn = every_name`, `fixed-questions.ts`), which is core on these names
 * ahead of this list — together with the time in the job and the residence. This list stays the
 * floor for the day the admin deletes one of them.
 *
 * Still NOT asked on those names: the declared salary (the product works the income out), the
 * other income and the bank statement (operator decision, 2026-10-26), the requested amount
 * where the product derives it, and — also 2026-10-26, reversing the 2026-09-24 entry that put
 * it here — `employment_status` with every follow-up gated on it: the applicant picked the
 * program before the questionnaire, and the pick is the answer. Its per-applicant-type rows
 * (CAE compound 40% DBR, ABK card-to-loan 84 months for the self-employed) then read the app's
 * `salaried` default; the operator chose that knowing it.
 *
 * Plus, where the name has MORE THAN ONE programme in the loan type, what the applicant cares
 * about most (`PRIORITY_QUESTION_CODE`, 2026-10-13) — see `isCore` below. It moves no money; it
 * decides which offer is shown first, so it is worth a question exactly when there is more than
 * one offer to order. A past rejection stays unasked here: it is an eligibility input apply
 * skips. (On 2026-10-26 no programme under these names priced on time in the job or the salary
 * transfer either — no seniority or years-in-job table, every transfer table one `none` row at
 * the base rate — so asking them moved no quote.)
 */
export const ASKED_EVEN_WHEN_PRODUCT_ONLY: ReadonlySet<string> = new Set<string>([
  DEBT_TYPES_QUESTION_CODE,
  ...Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE),
  MONEY_FIELD_BINDINGS.tenor_months,
]);

/**
 * Never removed by the gate clean-up (pass A below), even when every question behind them has
 * been dropped: the engine reads their OWN answer. `employment_status` gates `military_grade`,
 * and on every payslip name pass A used to drop it the moment the grade dropped — the app then
 * sent `salaried` for everyone.
 */
const NEVER_A_GATE_ONLY_SOURCE: ReadonlySet<string> = new Set<string>([
  ...NEVER_PRODUCT_SCOPED_QUESTION_CODES,
  EMPLOYMENT_TYPE_QUESTION_CODE,
]);

/** A question, in the shape BOTH the frozen snapshot and the live pool can supply. */
export interface ScopableQuestion {
  code: string;
  enabledWhen: unknown;
  /**
   * FIXED (`question.fixedServedOn`, frozen as `fixedServedOn`, v31.0.0): core on every program
   * (`every_name`), on every income-proof one (`income_proof`) or on every surrogate one
   * (`income_surrogate`, v32.1.0), and never unticked. Absent or `null` = an ordinary question —
   * every snapshot published before then.
   */
  fixedServedOn?: FixedServedOn | null;
}

/**
 * Everything the rule needs about one request, assembled once per read.
 *
 * Question CODES rather than fact keys, so the pure rule never has to know how a fact resolves
 * to a question — the derived bank axes have no registry binding at all, and the assembler is
 * the one place that knows it.
 */
export interface NarrowingScope {
  programNameKey: string;
  /** Every question bound to a `surrogate_fact`. Outside this set, a question is nobody's. */
  factBoundQuestionCodes: readonly string[];
  /**
   * Bound to a fact the PLATFORM owns — a reserved key: the bureau score, the car figures, the
   * derived bank axes. NOT core (v32.0.0: with no loan type left to bound it, a car figure would be
   * asked of every personal applicant); it is asked where a programme reads it, a tick puts it, or
   * it is fixed. Read here only so such a question keeps its OWN requiredness where a programme
   * reads it (`extraRequired`).
   */
  platformQuestionCodes: readonly string[];
  /**
   * Bound to a fact something in scope reads: a rule, a cap table or a refusal of a programme
   * filed under this name IN THE REQUESTED LOAN TYPE, or a declared ask of the product the name
   * quotes off. Per loan type since v32.0.0: a union over the name's other loan types would ask a
   * mortgage applicant what only the name's personal programme reads.
   */
  neededQuestionCodes: readonly string[];
  /**
   * The part of `neededQuestionCodes` the programmes themselves read — without the product's
   * declared asks. NOT read by the narrowing; read by the engine-input contract, which holds a
   * loan type to what its programmes actually read, exactly as `check:question-scope` does.
   * Absent = not computed.
   */
  programReadQuestionCodes?: readonly string[];
  /**
   * PRODUCT-ONLY (operator decision, 2026-09-23; narrowed 2026-09-24): the name quotes off a
   * surrogate product and EVERY active programme under it in this loan type is
   * `income_surrogate` (and there is at least one). The core is then the `every_name` and
   * `income_surrogate` fixed questions and `ASKED_EVEN_WHEN_PRODUCT_ONLY` — plus what the product
   * and its programmes read.
   * The app's own fallback (`apply_mapping.dart`) still covers the rest: no declared income (the
   * product works it out) and, for a car, the amount as price minus down payment. Absent = false,
   * which is every payslip or mixed name.
   */
  productOnly?: boolean;
  /**
   * An INCOME-PROOF programme is sold under this name in the requested loan type, or none is sold
   * there yet (a name created from the admin is payslip-only, v30.8.0). The fixed question set's
   * `income_proof` part — the declared salary, other income, bank statement and requested amount —
   * is then served here, and locked against an untick. Absent = false.
   */
  incomeProof?: boolean;
  /**
   * A SURROGATE (no-payslip) programme is sold under this name in the requested loan type, or
   * none is sold there yet and a no-payslip product is linked to the name (v32.1.0). The fixed
   * questions marked `income_surrogate` are then served here, and locked against an untick.
   * Absent = false.
   */
  incomeSurrogate?: boolean;
  /**
   * How many active programmes under the name an applicant of THIS loan type is quoted on. Read
   * only by the product-only core: the priority question orders offers, so it is asked there when
   * there is more than one. Absent = unknown, read as one.
   */
  programCount?: number;
  /**
   * Questions a programme under this name reads through a REFUSAL that is skipped when the
   * answer is missing — today the vehicle-age limit, which cannot refuse a car whose model year
   * nobody gave. Served and required wherever the program is, whatever their core clause (a
   * platform fact keeps its own requiredness otherwise). Absent = none.
   */
  mustAnswerQuestionCodes?: readonly string[];
  /**
   * Questions the operator TICKED for this name under the requested loan type
   * (`program_name_question_addition`). Kept even when nothing reads them, and never REQUIRED
   * because they were ticked: a question keeps its own requiredness. Absent = none.
   */
  addedQuestionCodes?: readonly string[];
  /**
   * The program's own ORDER under the requested loan type (`program_name_question_order`), as
   * question codes in position order. Read by the serve path only (`orderServed`); the narrowing
   * never looks at it. Absent or empty = the pool's order.
   */
  orderedQuestionCodes?: readonly string[];
}

/**
 * Why a question cannot be unticked for a program name.
 *
 *   - `engine`: every quote reads it — the money bindings, the debts and their amounts,
 *     employment type (the allow-lists and the per-type debt-burden cap). A fact the platform
 *     owns (I-Score, the car figures) is no longer one (v32.0.0): with no loan type to bound it,
 *     it is asked where a programme reads it (`program`), it is fixed (`base`) or it is ticked.
 *   - `base`: it is a FIXED question (`question.fixedServedOn`, `fixed-questions.ts`) and this
 *     path serves it — any name for an `every_name` question, an income-proof name for an
 *     `income_proof` one, a surrogate name for an `income_surrogate` one.
 *   - `program`: a bank programme under the name reads it, through its income rule, a cap,
 *     rate, tenor or fee table, its I-Score table, or a refusal that needs the answer.
 */
export type QuestionLockReason = 'engine' | 'base' | 'program';

/** The lock inputs, available with or without a name that has programmes behind it. */
export type QuestionLockScope = Partial<
  Pick<
    NarrowingScope,
    'neededQuestionCodes' | 'mustAnswerQuestionCodes' | 'incomeProof' | 'incomeSurrogate'
  >
>;

/**
 * `null` = the operator may untick it. The one rule serve, apply, preview and admin share.
 * `fixedServedOn` is the question's own mark (`question.fixedServedOn`); absent = not fixed.
 */
export function questionLockReason(
  code: string,
  scope: QuestionLockScope,
  fixedServedOn: FixedServedOn | null = null,
): QuestionLockReason | null {
  const outside = lockReasonOutsideFixedSet(code, scope);
  if (outside === 'engine') return 'engine';
  if (fixedServedHere(fixedServedOn, scope)) return 'base';
  return outside;
}

/**
 * `questionLockReason` without the fixed set: `engine`, `program` or `null`. For a caller that
 * reports the fixed set per loan type on its own (the admin's program-name board) and still
 * needs the program lock of a fixed question in the loan types the set does not bind.
 */
export function lockReasonOutsideFixedSet(
  code: string,
  scope: QuestionLockScope,
): Exclude<QuestionLockReason, 'base'> | null {
  if (NEVER_A_GATE_ONLY_SOURCE.has(code)) return 'engine';
  if (
    (scope.neededQuestionCodes ?? []).includes(code) ||
    (scope.mustAnswerQuestionCodes ?? []).includes(code)
  ) {
    return 'program';
  }
  return null;
}

export type NarrowingDisabledReason = 'no_name' | 'empty_result';

export interface NarrowingDecision {
  /** The picked NAME narrowed the list. False = no name, or a name whose rule kept nothing. */
  narrowed: boolean;
  /**
   * Serve these — in EVERY path, narrowed or not. With narrowing off it is the BASELINE (the
   * fixed questions and the money core), so a caller never falls back to the raw list.
   */
  keep: ReadonlySet<string>;
  /** Kept AND required BECAUSE a program in scope reads the answer. */
  extraRequired: ReadonlySet<string>;
  dropped: readonly string[];
  /** Kept only so a surviving question's gate stays evaluable. */
  gateSourcesRetained: readonly string[];
  /** Gate-only sources dropped because every question behind them dropped. */
  gateSourcesDropped: readonly string[];
  disabledReason: NarrowingDisabledReason | null;
}

/** Who is gated on whom, inside the list. A gate pointing outside it is DANGLING — it never
 * hides its target and it must not scope anything either. */
function gateMaps(questions: readonly ScopableQuestion[]): {
  byCode: ReadonlyMap<string, ScopableQuestion>;
  dependentsOf: ReadonlyMap<string, readonly string[]>;
} {
  const byCode = new Map(questions.map((q) => [q.code, q]));
  const dependentsOf = new Map<string, string[]>();
  for (const q of questions) {
    const gate = enabledWhenGate(q);
    if (gate === null || !byCode.has(gate.questionCode)) continue;
    const list = dependentsOf.get(gate.questionCode);
    if (list) list.push(q.code);
    else dependentsOf.set(gate.questionCode, [q.code]);
  }
  return { byCode, dependentsOf };
}

/**
 * Pass B: put back the in-list gate source of anything still kept, to a fixpoint. Returns the
 * sources it put back. Then the post-condition, asserted rather than trusted: a future edit that
 * reorders the passes must fail here and not by making a required question mandatory for every
 * applicant.
 */
function closeOverGates(
  questions: readonly ScopableQuestion[],
  byCode: ReadonlyMap<string, ScopableQuestion>,
  keep: Set<string>,
): string[] {
  const retained: string[] = [];
  for (let round = 0; round < questions.length; round += 1) {
    let changed = false;
    for (const q of questions) {
      if (!keep.has(q.code)) continue;
      const gate = enabledWhenGate(q);
      if (gate === null || !byCode.has(gate.questionCode)) continue;
      if (keep.has(gate.questionCode)) continue;
      keep.add(gate.questionCode);
      retained.push(gate.questionCode);
      changed = true;
    }
    if (!changed) break;
  }
  for (const q of questions) {
    if (!keep.has(q.code)) continue;
    const gate = enabledWhenGate(q);
    if (gate === null || !byCode.has(gate.questionCode)) continue;
    if (!keep.has(gate.questionCode)) {
      throw new Error(
        `question-scope: ${q.code} kept while its gate source ${gate.questionCode} was dropped`,
      );
    }
  }
  return retained;
}

/**
 * Narrowing OFF — no program to narrow by: no name was sent, or the name's rule kept nothing.
 * The BASELINE is served, never the whole pool (v32.0.0, when the loan-type list it used to fall
 * back to was retired): the fixed questions — every kind, since with no program there is no
 * income basis to tell them apart — and the money and debt questions every quote reads, closed
 * over gates like the narrowed path. Every bank programme has a name and the app makes the
 * applicant pick one whenever there is one to pick, so this is the floor of a path nobody walks
 * today, not a questionnaire anyone is served.
 */
function off(
  reason: NarrowingDisabledReason,
  questions: readonly ScopableQuestion[],
): NarrowingDecision {
  const keep = new Set(
    questions
      .filter(
        (q) =>
          fixedServedHere(q.fixedServedOn, ALL_FIXED_SIDES) ||
          NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(q.code),
      )
      .map((q) => q.code),
  );
  const gateSourcesRetained = closeOverGates(questions, gateMaps(questions).byCode, keep);
  return {
    narrowed: false,
    keep,
    extraRequired: new Set<string>(),
    dropped: questions.filter((q) => !keep.has(q.code)).map((q) => q.code),
    gateSourcesRetained,
    gateSourcesDropped: [],
    disabledReason: reason,
  };
}

/**
 * Which of the questions this program asks, and which of them its programmes make required.
 *
 * CORE — asked whatever the program — is the FIXED questions this path serves
 * (`question.fixedServedOn`, the admin's, `fixed-questions.ts`): the `every_name` ones on every
 * program, the `income_proof` ones wherever a payslip programme is sold under the name in this
 * loan type, the `income_surrogate` ones wherever a no-payslip one is. They are core on product-only names too, can never be unticked, and pass A never
 * drops one. Beside them, on a name that is not product-only, the money and debt codes — the set
 * above — the floor for the day the admin deletes one of them.
 *
 * Any other question is asked only when a programme under the name in this loan type reads it
 * (NEEDED, or a refusal that needs its answer), the operator ticked it for the program, or a kept
 * question branches off it.
 *
 * Gone from the core: "bound to no fact" and "bound to a fact no product asks" (v31.5.0, operator,
 * 2026-10-28: "for now the questions in the system are just the fixed questions"), and "bound to a
 * fact the platform owns" (v32.0.0): the loan-type assignment was what kept the car figures off a
 * personal applicant's screen, and with it gone that clause would ask every applicant the price of
 * a car. A car program gets them from its ticks and from what its programmes read.
 *
 * The operator's TICKED questions are kept whatever reads them and survive pass A.
 *
 * Then the gate passes, and their order is load-bearing. `isQuestionVisible` SHOWS a question
 * whose gate source is missing, so dropping a source while a question behind it survives would
 * make that question unconditionally visible and, if required, mandatory for everyone with no
 * way to reach it. Pass A drops a gate-only source once everything behind it has gone; pass B
 * puts back the source of anything still kept. They cannot fight — A needs every dependent
 * dropped, B fires only when one is kept — and B runs last, so the post-condition asserted at
 * the end is what the caller gets.
 *
 * Both passes are fixpoints rather than single sweeps. Every gate source on this database
 * happens to be core today, so a single sweep would pass every test written against it and
 * break the first time a chain exists.
 */
export function narrowAskedQuestions(
  questions: readonly ScopableQuestion[],
  scope: NarrowingScope | null,
): NarrowingDecision {
  if (scope === null) return off('no_name', questions);

  const factBound = new Set(scope.factBoundQuestionCodes);
  const platform = new Set(scope.platformQuestionCodes);
  const needed = new Set(scope.neededQuestionCodes);
  const mustAnswer = new Set(scope.mustAnswerQuestionCodes ?? []);
  const { byCode, dependentsOf } = gateMaps(questions);
  // Only what the questionnaire still holds: a tick on a question since switched off scopes
  // nothing, exactly as a dangling gate does not.
  const added = new Set((scope.addedQuestionCodes ?? []).filter((code) => byCode.has(code)));
  // The fixed questions this path must serve (their own `fixedServedOn`): core whatever reads
  // them, never unticked (`questionLockReason` says `base`), never dropped by the gate clean-up.
  const base = fixedCodesServed(questions, scope);

  const isCore = (code: string): boolean =>
    base.has(code) ||
    (scope.productOnly === true
      ? ASKED_EVEN_WHEN_PRODUCT_ONLY.has(code) ||
        (code === PRIORITY_QUESTION_CODE && (scope.programCount ?? 1) > 1)
      : NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(code));

  const keep = new Set<string>();
  for (const q of questions) {
    if (isCore(q.code) || needed.has(q.code) || mustAnswer.has(q.code) || added.has(q.code)) {
      keep.add(q.code);
    }
  }

  // ---- pass A: a gate-only source goes once everything behind it has -------
  const gateSourcesDropped: string[] = [];
  for (let round = 0; round < questions.length; round += 1) {
    let changed = false;
    for (const q of questions) {
      if (!keep.has(q.code)) continue;
      // Only a question that exists to gate: no fact of its own, and not in the core list.
      // Nor one the operator added: asking it was the point, not what sits behind it.
      if (
        factBound.has(q.code) ||
        NEVER_A_GATE_ONLY_SOURCE.has(q.code) ||
        added.has(q.code) ||
        base.has(q.code)
      ) {
        continue;
      }
      const dependents = dependentsOf.get(q.code);
      if (dependents === undefined || dependents.length === 0) continue;
      if (dependents.some((code) => keep.has(code))) continue;
      keep.delete(q.code);
      gateSourcesDropped.push(q.code);
      changed = true;
    }
    if (!changed) break;
  }

  // ---- pass B: put back the source of anything still kept, then assert it --------
  const gateSourcesRetained = closeOverGates(questions, byCode, keep);
  const retainedSet = new Set(gateSourcesRetained);

  if (keep.size === 0 && questions.length > 0) return off('empty_result', questions);

  const extraRequired = new Set<string>();
  for (const code of keep) {
    // REQUIRED because a program in scope reads it — so only a NEEDED question. Before
    // additions this was "kept and not core", which is the same set (the keep started as
    // core ∪ needed and only gate sources joined it later); an added question would now slip
    // into that reading and be made mandatory by a tick meant to ASK it.
    // A source pulled back purely to keep a gate evaluable is not a figure any program reads.
    // A PLATFORM-owned fact (I-Score, the car figures) keeps its own requiredness: it was
    // core on every name until product-only names emptied the core, and it is optional by
    // design where it is optional — an unanswered I-Score is a 100% factor, not a refusal.
    if (needed.has(code) && !isCore(code) && !retainedSet.has(code) && !platform.has(code)) {
      extraRequired.add(code);
    }
  }
  for (const code of scope.mustAnswerQuestionCodes ?? []) {
    if (keep.has(code)) extraRequired.add(code);
  }

  return {
    narrowed: true,
    keep,
    extraRequired,
    dropped: questions.filter((q) => !keep.has(q.code)).map((q) => q.code),
    gateSourcesRetained,
    gateSourcesDropped: gateSourcesDropped.filter((code) => !keep.has(code)),
    disabledReason: null,
  };
}

/**
 * One step's questions in the order THIS program asks them (v32.0.0,
 * `program_name_question_order`, read live with the rest of the program — `NarrowingScope.
 * orderedQuestionCodes`).
 *
 * `questions` arrive in the POOL's order (the Questions tab's: `question.displayOrder`, then the
 * code). A question the program placed sorts by its position. One it never placed — a new tick, a
 * new fixed question, a question a bank programme started reading — sits right after the placed
 * question it follows in the pool, so it lands where the Questions tab put it rather than at the
 * end of the step. With no order at all (no name, or a program nobody has ordered) this is the
 * pool's order, unchanged.
 *
 * Within one step only: a step is one screen of the app, and a position across steps means
 * nothing. Shared by the customer read and the admin's served pages, so the screen the operator
 * drags on is the order the applicant gets.
 */
export function orderServed<T extends { code: string }>(
  questions: readonly T[],
  orderedCodes: readonly string[] | undefined,
): T[] {
  if (orderedCodes === undefined || orderedCodes.length === 0) return [...questions];
  const position = new Map(orderedCodes.map((code, index) => [code, index]));
  let anchor = -1;
  const keyed = questions.map((q, poolIndex) => {
    const own = position.get(q.code);
    if (own !== undefined) anchor = own;
    return { q, primary: own ?? anchor, placed: own === undefined ? 1 : 0, poolIndex };
  });
  keyed.sort((a, b) => a.primary - b.primary || a.placed - b.placed || a.poolIndex - b.poolIndex);
  return keyed.map((k) => k.q);
}
