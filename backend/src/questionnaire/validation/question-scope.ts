/**
 * The SECOND axis narrowing which questions an applicant is put in front of: the catalog
 * PROGRAM NAME they picked.
 *
 * The first axis is the loan category (`question_loan_category`, frozen into the snapshot as
 * `categories`, read by `askedFor`). This one narrows inside it: of the questions the category
 * asks, serve the ones a program behind the picked name can actually be quoted from, plus a
 * core every quote needs. It applies to BOTH income bases — a payslip program's cap table
 * reads facts exactly as a no-payslip program's calculation does, so there is one rule.
 *
 * The operator adjusts it per name with two lists, both read live with the rest of this axis:
 * questions the name SKIPS (`program_name_question_exclusion`, bounded by `questionLockReason`)
 * and questions it ADDS (`program_name_question_addition`). An added question the category
 * does not ask of everyone sits in it as an OPT-IN row (frozen as `optInCategories`), which
 * this rule serves only where a name added it or a programme under the name reads it. So the
 * axis is still a NARROWING of the category's frozen set — never a widening of it.
 *
 * READ LIVE, and NOT frozen into the snapshot. That is the opposite of the category axis and
 * it is deliberate. The category assignment is questionnaire content, so freezing it is what
 * stops a reassignment rewriting what an older version asked. This axis is derived from
 * `surrogate_product_ask`, `bank_program.incomeAssumption`, `bank_program.loanLimits` and
 * `platform_enumeration.incomeRule` — none of it questionnaire content, and `factsReadBy` says
 * in its own docstring why a stored copy is the wrong shape: "DERIVED, never stored. The rule
 * already names each fact it reads, so a second list saying which questions the product needs
 * could only ever drift out of step with it." A frozen copy would be that second list, and it
 * would go stale in the direction that RAISES a ceiling: editing a cap table publishes no
 * questionnaire version, so the stale copy would keep hiding a question the cap started
 * reading, `maxLoanByFact` would miss, and `onNoMatch: 'useProgramMax'` would quote above the
 * bank's own table with nothing reporting it.
 *
 * Pure, and structural about the question rows for the reason `question-visibility.ts` is: the
 * frozen snapshot and the live `question` table are different shapes and both have to fit.
 */

import { enabledWhenGate } from './question-visibility';
import {
  DEBT_TYPES_QUESTION_CODE,
  EMPLOYMENT_TYPE_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  MONEY_FIELD_BINDING_SPECS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
} from '@/matching/pipeline/money-field-bindings';

/**
 * Questions no program may ever narrow away, whatever any ask board says.
 *
 * Each one moves money for EVERY program, so hiding one does not narrow a questionnaire — it
 * changes a quote:
 *
 *   - the four money bindings are the requested amount, the tenor, the declared salary and the
 *     stated obligations total. They are the debt-burden ratio's own inputs, and the mobile
 *     walks this exact list to decide whether Finish may be enabled — a snapshot missing one
 *     leaves that button dead forever with nothing on screen saying why.
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
 *   - `employment_status`, for the per-applicant-type rows (CAE compound 40% DBR, ABK card-to-
 *     loan 84 months for the self-employed).
 *
 * Still NOT asked on those names: the declared salary (the product works the income out), the
 * requested amount where the product derives it, and the stated lump sum (the itemised amounts
 * above are the figure).
 */
export const ASKED_EVEN_WHEN_PRODUCT_ONLY: ReadonlySet<string> = new Set<string>([
  DEBT_TYPES_QUESTION_CODE,
  ...Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE),
  MONEY_FIELD_BINDINGS.tenor_months,
  EMPLOYMENT_TYPE_QUESTION_CODE,
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
   * In this category as an OPT-IN row (`question_loan_category.optIn`, frozen as
   * `optInCategories`): asked only where the picked name ADDS it or a programme under the name
   * reads it — never through the core, and never with no name. Absent = an ordinary row.
   */
  optIn?: boolean;
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
  /** Bound to a fact at least one LIVE (non-detached) product ask points at. */
  askScopedQuestionCodes: readonly string[];
  /** Bound to a fact the platform owns — a reserved key. Never a product's to narrow. */
  platformQuestionCodes: readonly string[];
  /** Bound to a fact something in scope reads: a rule, a cap table, or a declared ask. */
  neededQuestionCodes: readonly string[];
  /**
   * PRODUCT-ONLY (operator decision, 2026-09-23; narrowed 2026-09-24): the name quotes off a
   * surrogate product and EVERY active programme under it is `income_surrogate`. The core is
   * then `ASKED_EVEN_WHEN_PRODUCT_ONLY` — debts, duration, employment type — plus what the
   * product and its programmes read. The app's own fallback (`apply_mapping.dart`) still covers
   * the rest: no declared income (the product works it out) and, for a car, the amount as price
   * minus down payment. Absent = false, which is every payslip or mixed name.
   */
  productOnly?: boolean;
  /**
   * Questions a programme under this name reads through a REFUSAL that is skipped when the
   * answer is missing — today the vehicle-age limit, which cannot refuse a car whose model year
   * nobody gave. Required wherever served, whatever their core clause (a platform fact keeps
   * its own requiredness otherwise). Absent = none.
   */
  mustAnswerQuestionCodes?: readonly string[];
  /**
   * Questions the operator UNTICKED for this name under the requested loan type
   * (`program_name_question_exclusion`). Subtracted after the core and the needed set are
   * built, EXCEPT a locked one (`questionLockReason`): the quote's own inputs cannot be
   * unticked, and a fact a programme started reading after the untick brings its question
   * back on its own. Absent = none.
   */
  excludedQuestionCodes?: readonly string[];
  /**
   * Questions the operator TICKED for this name under the requested loan type
   * (`program_name_question_addition`) — the mirror of `excludedQuestionCodes`. Kept even when
   * nothing reads them and even when the row is OPT-IN, and never REQUIRED because they were
   * added: a question keeps its own requiredness. An addition beats an exclusion of the same
   * question (the writes keep the two apart anyway). Absent = none.
   */
  addedQuestionCodes?: readonly string[];
}

/**
 * Why a question cannot be unticked for a program name.
 *
 *   - `engine`: every quote reads it — the money bindings, the debts and their amounts,
 *     employment type (the allow-lists and the per-type debt-burden cap), or a fact the
 *     platform owns (I-Score, the car figures).
 *   - `program`: a bank programme under the name reads it, through its income rule, a cap,
 *     rate, tenor or fee table, its I-Score table, or a refusal that needs the answer.
 */
export type QuestionLockReason = 'engine' | 'program';

/** The lock inputs, available with or without a name that has programmes behind it. */
export type QuestionLockScope = Pick<NarrowingScope, 'platformQuestionCodes'> &
  Partial<Pick<NarrowingScope, 'neededQuestionCodes' | 'mustAnswerQuestionCodes'>>;

/** `null` = the operator may untick it. The one rule serve, apply, preview and admin share. */
export function questionLockReason(
  code: string,
  scope: QuestionLockScope,
): QuestionLockReason | null {
  if (NEVER_A_GATE_ONLY_SOURCE.has(code) || scope.platformQuestionCodes.includes(code)) {
    return 'engine';
  }
  if (
    (scope.neededQuestionCodes ?? []).includes(code) ||
    (scope.mustAnswerQuestionCodes ?? []).includes(code)
  ) {
    return 'program';
  }
  return null;
}

export type NarrowingDisabledReason = 'no_name' | 'no_programs' | 'empty_result';

export interface NarrowingDecision {
  /** The picked NAME narrowed the list. False = no name, no programme, or an empty result. */
  narrowed: boolean;
  /**
   * Serve these — in EVERY path, narrowed or not. With narrowing off it is the whole list minus
   * any OPT-IN question nobody put in scope, so a caller never falls back to the raw list.
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
 * Narrowing OFF. Nothing is narrowed, and the one thing still left out is an OPT-IN question
 * nobody put in scope: with no name — or a name with no programme yet — there is nobody to have
 * added it and nothing reading it. Closed over gates like the narrowed path, so an opt-in
 * question another kept one branches off stays. With no opt-in row in the list this is the
 * whole list, which is what every caller served before `keep` was authoritative here.
 */
function off(
  reason: NarrowingDisabledReason,
  questions: readonly ScopableQuestion[],
): NarrowingDecision {
  const keep = new Set(questions.filter((q) => q.optIn !== true).map((q) => q.code));
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
 * Which of the category's questions this program name is asked, and which of them its programs
 * make required.
 *
 * CORE — asked whatever the name — is four clauses, every one of them derived:
 *
 *   1. bound to no fact. Nothing can name it, so nothing may narrow it. This is what keeps the
 *      tenure, transfer and preference questions, and `priority_factor`, whose loss would drop
 *      all four mobile mappers to their default arm and freeze the wrong offer order onto
 *      immutable rows.
 *   2. bound to a fact the PLATFORM owns (a reserved key: the derived bank axes, the bureau
 *      score, the two car figures).
 *   3. a money or obligation code — the set above.
 *   4. bound to a fact NO product anywhere asks. The conservative clause, and the one that
 *      makes a whole class of breakage unrepresentable: without it, one tick on one product's
 *      board would silently un-ask a question for every OTHER name. With it, a tick can only
 *      ever subtract a question that nothing in scope reads. It is also what keeps
 *      `employment_status` — read by no income rule, but driving the employment allow-lists
 *      and the debt-burden cap for every program — without a hand-written exception.
 *
 * An OPT-IN row is never core; the operator's ADDED questions are kept whatever reads them,
 * survive pass A, and win over an exclusion of the same question.
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
  const askScoped = new Set(scope.askScopedQuestionCodes);
  const platform = new Set(scope.platformQuestionCodes);
  const needed = new Set(scope.neededQuestionCodes);
  const optIn = new Set(questions.filter((q) => q.optIn === true).map((q) => q.code));
  const { byCode, dependentsOf } = gateMaps(questions);
  // Only what this category can serve: an addition whose row has since left the category
  // scopes nothing, exactly as a dangling gate does not.
  const added = new Set((scope.addedQuestionCodes ?? []).filter((code) => byCode.has(code)));

  // An OPT-IN row is never core. Clause 1 alone ("bound to no fact") would otherwise ask an
  // added business question of every name in the category, which is the one thing the opt-in
  // row exists to prevent.
  const isCore = (code: string): boolean =>
    !optIn.has(code) &&
    (scope.productOnly === true
      ? ASKED_EVEN_WHEN_PRODUCT_ONLY.has(code)
      : NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(code) ||
        !factBound.has(code) ||
        platform.has(code) ||
        !askScoped.has(code));

  const keep = new Set<string>();
  for (const q of questions) {
    if (isCore(q.code) || needed.has(q.code) || added.has(q.code)) keep.add(q.code);
  }
  // The operator's unticks, before the gate passes so a gate source whose every dependent was
  // unticked goes with them (pass A), and one a kept question still needs comes back (pass B).
  // An addition of the same question wins: the tick is the later, narrower statement.
  for (const code of scope.excludedQuestionCodes ?? []) {
    if (added.has(code)) continue;
    if (questionLockReason(code, scope) === null) keep.delete(code);
  }

  // ---- pass A: a gate-only source goes once everything behind it has -------
  const gateSourcesDropped: string[] = [];
  for (let round = 0; round < questions.length; round += 1) {
    let changed = false;
    for (const q of questions) {
      if (!keep.has(q.code)) continue;
      // Only a question that exists to gate: no fact of its own, and not in the core list.
      // Nor one the operator added: asking it was the point, not what sits behind it.
      if (factBound.has(q.code) || NEVER_A_GATE_ONLY_SOURCE.has(q.code) || added.has(q.code)) {
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
