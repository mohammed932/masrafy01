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

/** A question, in the shape BOTH the frozen snapshot and the live pool can supply. */
export interface ScopableQuestion {
  code: string;
  enabledWhen: unknown;
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
}

export type NarrowingDisabledReason = 'no_name' | 'no_programs' | 'empty_result';

export interface NarrowingDecision {
  narrowed: boolean;
  /** Serve these and require the non-core ones. Meaningless when `narrowed` is false. */
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

const OFF = (reason: NarrowingDisabledReason): NarrowingDecision => ({
  narrowed: false,
  keep: new Set<string>(),
  extraRequired: new Set<string>(),
  dropped: [],
  gateSourcesRetained: [],
  gateSourcesDropped: [],
  disabledReason: reason,
});

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
  if (scope === null) return OFF('no_name');

  const factBound = new Set(scope.factBoundQuestionCodes);
  const askScoped = new Set(scope.askScopedQuestionCodes);
  const platform = new Set(scope.platformQuestionCodes);
  const needed = new Set(scope.neededQuestionCodes);

  const isCore = (code: string): boolean =>
    NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(code) ||
    !factBound.has(code) ||
    platform.has(code) ||
    !askScoped.has(code);

  const keep = new Set<string>();
  for (const q of questions) {
    if (isCore(q.code) || needed.has(q.code)) keep.add(q.code);
  }

  // Who is gated on whom. A gate pointing outside this category is DANGLING — it never hides
  // its target and it must not scope anything either.
  const byCode = new Map(questions.map((q) => [q.code, q]));
  const dependentsOf = new Map<string, string[]>();
  for (const q of questions) {
    const gate = enabledWhenGate(q);
    if (gate === null || !byCode.has(gate.questionCode)) continue;
    const list = dependentsOf.get(gate.questionCode);
    if (list) list.push(q.code);
    else dependentsOf.set(gate.questionCode, [q.code]);
  }

  // ---- pass A: a gate-only source goes once everything behind it has -------
  const gateSourcesDropped: string[] = [];
  for (let round = 0; round < questions.length; round += 1) {
    let changed = false;
    for (const q of questions) {
      if (!keep.has(q.code)) continue;
      // Only a question that exists to gate: no fact of its own, and not in the core list.
      if (factBound.has(q.code) || NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(q.code)) continue;
      const dependents = dependentsOf.get(q.code);
      if (dependents === undefined || dependents.length === 0) continue;
      if (dependents.some((code) => keep.has(code))) continue;
      keep.delete(q.code);
      gateSourcesDropped.push(q.code);
      changed = true;
    }
    if (!changed) break;
  }

  // ---- pass B: put back the source of anything still kept ------------------
  const gateSourcesRetained: string[] = [];
  for (let round = 0; round < questions.length; round += 1) {
    let changed = false;
    for (const q of questions) {
      if (!keep.has(q.code)) continue;
      const gate = enabledWhenGate(q);
      if (gate === null || !byCode.has(gate.questionCode)) continue;
      if (keep.has(gate.questionCode)) continue;
      keep.add(gate.questionCode);
      gateSourcesRetained.push(gate.questionCode);
      changed = true;
    }
    if (!changed) break;
  }
  const retainedSet = new Set(gateSourcesRetained);

  // The post-condition, asserted rather than trusted: a future edit that reorders the passes
  // must fail here and not by making a required question mandatory for every applicant.
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

  if (keep.size === 0 && questions.length > 0) return OFF('empty_result');

  const extraRequired = new Set<string>();
  for (const code of keep) {
    // A source pulled back purely to keep a gate evaluable is not a figure any program reads.
    if (!isCore(code) && !retainedSet.has(code)) extraRequired.add(code);
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
