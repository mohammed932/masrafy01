/**
 * FIXED QUESTIONS — the questions every program of their loan types is quoted from, owned by the
 * ADMIN as data (v31.0.0, operator decision 2026-10-26). `question.fixedServedOn` says where one
 * is asked: `every_name` on every program of the loan types it is in, `income_proof` on every
 * income-proof (payslip) program of them; `null` is an ordinary question.
 *
 * Until v31.0.0 the set was a list in code (`BASE_QUESTIONS`), and every change to it took a
 * developer and a release. What each ANSWER means to the engine stays in code — the I-Score
 * ranges, the transfer rate keys, the money and debt codes (`base-question-set.ts`,
 * `money-field-bindings.ts`) — and the engine-input lock still holds a question the engine reads
 * (`engine-contract.ts`). Which questions are fixed is the admin's.
 *
 * THE FIXED RULES, enforced on every questionnaire write, rollback included (`fixedRuleBreaks`):
 *   - asked on every program of its loan types (all programs, or the income-proof ones) — never
 *     OPT-IN, never skipped or added per program name (`question-scope.ts`, reason `base`);
 *   - never out of one of its loan types while it is fixed (it may join more);
 *   - its show-when source is itself an active fixed question;
 *   - switched off only through the confirmed delete — a super admin typing its code (the one
 *     bypass of the engine lock and the ratchet, `EngineContractService`). A deleted one keeps
 *     its mark, loan types and answers, so a restore brings it back whole.
 * The mark itself is the admin's both ways (v31.1.0, operator decision 2026-10-27: "everything
 * dynamic"): a question is fixed, un-fixed, moved between `every_name` and `income_proof`, and
 * made optional or required like any other — the rules above hold only while it is fixed.
 *
 * Pure, and structural about the question rows for the reason `question-scope.ts` is: the live
 * pool and the frozen snapshot are different shapes and both have to fit.
 */
import { BANK_AXES } from '@/matching/pipeline/bank-relationship';
import { enabledWhenGate } from './question-visibility';

/** Where a fixed question is asked — the `FixedQuestionServedOn` enum, without the Prisma import. */
export type FixedServedOn = 'every_name' | 'income_proof';

/** A stored or frozen mark as the rules read it. Anything else — absent included — is `null`. */
export function fixedServedOnOf(raw: unknown): FixedServedOn | null {
  return raw === 'every_name' || raw === 'income_proof' ? raw : null;
}

/** Whether a question marked `servedOn` is asked on a path that sells (or not) a payslip programme. */
export function fixedServedHere(
  servedOn: FixedServedOn | null | undefined,
  incomeProof: boolean,
): boolean {
  return servedOn === 'every_name' || (servedOn === 'income_proof' && incomeProof);
}

/**
 * The fixed codes a path must serve, of the questions it can serve: the `every_name` ones
 * always, the `income_proof` ones when the (name, loan type) sells a payslip programme.
 */
export function fixedCodesServed(
  questions: readonly { code: string; fixedServedOn?: FixedServedOn | null }[],
  incomeProof: boolean,
): ReadonlySet<string> {
  return new Set(
    questions.filter((q) => fixedServedHere(q.fixedServedOn, incomeProof)).map((q) => q.code),
  );
}

/** One question as the fixed rules read it — buildable from the live pool and from a snapshot. */
export interface FixedRuleQuestion {
  readonly id: string;
  readonly code: string;
  readonly isActive: boolean;
  readonly enabledWhen: unknown;
  /** Every loan type it is in, OPT-IN rows included. */
  readonly categories: readonly string[];
  /** The opt-in subset of `categories`. */
  readonly optInCategories: readonly string[];
  readonly fixedServedOn: FixedServedOn | null;
}

export type FixedRule =
  /** A fixed question would be switched off outside the confirmed delete. */
  | 'switched_off'
  /** …would sit in a loan type as an opt-in row. */
  | 'opt_in'
  /** …would leave a loan type it is asked in, or turn opt-in there. */
  | 'category_removed'
  /** …would be gated on a question that is not an active fixed question. */
  | 'gate_not_fixed';

export interface FixedRuleBreak {
  readonly questionId: string;
  readonly code: string;
  readonly rule: FixedRule;
  /** The show-when source, on a `gate_not_fixed` break. */
  readonly sourceCode?: string;
}

/**
 * Every fixed rule `after` breaks that `before` keeps — what one write (or rollback) would do.
 *
 * Two halves. TRANSITIONS, for each question fixed and active in `before` and still fixed in
 * `after` (un-fixing is the admin's, v31.1.0): switched off (except `confirmedDeleteId`, the
 * question a super admin confirmed deleting), or out of one of its loan types. STATE, for each
 * question fixed and active in `after`: opt-in, or gated on something other than an active fixed
 * question — reported only where `before` did not
 * already break it, so a standing fault never freezes every edit, the way the engine-input
 * ratchet works. A question switched back ON (a restore) is judged by the state half alone.
 */
export function fixedRuleBreaks(
  before: readonly FixedRuleQuestion[],
  after: readonly FixedRuleQuestion[],
  confirmedDeleteId?: string,
): FixedRuleBreak[] {
  const out: FixedRuleBreak[] = [];
  const afterById = new Map(after.map((q) => [q.id, q]));
  for (const was of before) {
    if (!was.isActive || was.fixedServedOn === null) continue;
    const at = { questionId: was.id, code: was.code };
    const now = afterById.get(was.id);
    // Un-fixed (or gone from a rolled-back version): an ordinary question now, no rule of these.
    if (now === undefined || now.fixedServedOn === null) continue;
    if (!now.isActive) {
      if (was.id !== confirmedDeleteId) out.push({ ...at, rule: 'switched_off' });
      continue;
    }
    const kept = new Set(ordinaryCategories(now));
    if (ordinaryCategories(was).some((c) => !kept.has(c))) {
      out.push({ ...at, rule: 'category_removed' });
    }
  }
  const standing = new Set(stateBreaks(before).map(breakKey));
  for (const b of stateBreaks(after)) {
    if (!standing.has(breakKey(b))) out.push(b);
  }
  return out;
}

/** The rules a questionnaire breaks as it stands: every active fixed question, on its own. */
function stateBreaks(questions: readonly FixedRuleQuestion[]): FixedRuleBreak[] {
  const out: FixedRuleBreak[] = [];
  const active = new Map(questions.filter((q) => q.isActive).map((q) => [q.code, q]));
  for (const q of active.values()) {
    if (q.fixedServedOn === null) continue;
    const at = { questionId: q.id, code: q.code };
    if (q.optInCategories.length > 0) out.push({ ...at, rule: 'opt_in' });
    const gate = enabledWhenGate(q);
    if (gate !== null && (active.get(gate.questionCode)?.fixedServedOn ?? null) === null) {
      out.push({ ...at, rule: 'gate_not_fixed', sourceCode: gate.questionCode });
    }
  }
  return out;
}

function ordinaryCategories(q: FixedRuleQuestion): string[] {
  return q.categories.filter((c) => !q.optInCategories.includes(c));
}

function breakKey(b: FixedRuleBreak): string {
  return `${b.questionId}|${b.rule}|${b.sourceCode ?? ''}`;
}

/**
 * The PROGRAM-CATALOG questions: the ones a no-payslip product asks, which the Questions tab
 * hides and the Program catalog manages — until the admin makes one fixed (v31.1.0), when it is
 * listed on the Questions tab like every fixed question.
 *
 * A question bound to a fact some live product ask points at (`askScoped`, the same set
 * `narrowingScopeFor` calls ask-scoped), a per-bank axis question (`BANK_AXES`), or the
 * show-when source of one of those, to a fixpoint. NEVER a fixed question: several fixed ones
 * are read by a product too (the loan duration, the debts behind `current_loans`, the other
 * income behind `additional_income`), and they stay fixed and listed.
 */
export function surrogateSideCodes(
  active: readonly { code: string; enabledWhen: unknown; fixedServedOn?: FixedServedOn | null }[],
  askScoped: Iterable<string>,
): ReadonlySet<string> {
  const byCode = new Map(active.map((q) => [q.code, q]));
  const fixed = (code: string): boolean => (byCode.get(code)?.fixedServedOn ?? null) !== null;
  const out = new Set<string>();
  for (const code of [...askScoped, ...BANK_AXES.map((axis) => axis.questionCode)]) {
    if (byCode.has(code) && !fixed(code)) out.add(code);
  }
  for (let round = 0; round < active.length; round += 1) {
    let changed = false;
    for (const q of active) {
      if (!out.has(q.code)) continue;
      const gate = enabledWhenGate(q);
      if (gate === null || !byCode.has(gate.questionCode) || out.has(gate.questionCode)) continue;
      if (fixed(gate.questionCode)) continue;
      out.add(gate.questionCode);
      changed = true;
    }
    if (!changed) break;
  }
  return out;
}
