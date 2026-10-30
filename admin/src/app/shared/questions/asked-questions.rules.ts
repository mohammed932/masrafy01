import { fixedAskedOn, type FixedServedOn, type IncomeBasis } from '@core/income-basis';
import { canonicalCategories, type LoanCategory } from '@core/loan-category';
import type { EnabledWhenLike } from './enabled-when';

/**
 * Which questions a program asks beyond the fixed ones, and what a tick on its board writes.
 *
 * A question carries no loan type (v32.0.0). A program — a catalog name under one loan type —
 * asks the FIXED questions, the money and debt questions every quote reads, what a bank program
 * filed under it reads, and what the operator TICKED for it (`program_name_question_addition`).
 * These boards edit the last of those four, for one program at a time.
 *
 * WHY A MODULE OF ITS OWN: the GATE CLOSURE. Some questions appear only after a specific answer
 * to another one (`enabledWhen`). Ticking such a question on a program whose applicants are not
 * asked its SOURCE does not break — the server shows a question whose rule it cannot evaluate,
 * so the branch quietly stops branching and the question becomes unconditional for everyone.
 * Nothing on screen would say so. A tick therefore brings its gate source chain with it
 * (`addableQuestions`), transitively — two-level chains exist — and the server closes it again
 * on save.
 *
 * Pure: no Angular, no `$localize`. The words belong to the screens — `categoryLabel()` calls
 * `$localize` in its body, which does not exist under the bare jsdom the specs run in.
 */

/** A question from the global pool, in the shape these boards reason about. */
export interface AskableQuestion {
  readonly id: string;
  readonly code: string;
  readonly labelEn: string;
  readonly labelAr: string;
  /** A switched-off question is asked of nobody, so it is never offered as a tick. */
  readonly isActive: boolean;
  /**
   * Required questions are the ones that can break something: an application already in
   * progress under the program has to answer one before it can be submitted, so the board
   * confirms those and ticks the rest silently.
   */
  readonly isRequired: boolean;
  /**
   * A FIXED question (`fixedServedOn` set): asked on every program of its side, never ticked or
   * unticked per program. Absent on a bare fixture or an older server — read as not fixed.
   */
  readonly fixed?: boolean;
  /**
   * Which side a fixed question is asked on (`fixedServedOn`, v32.1.0): every program, income-
   * proof ones only or surrogate ones only. Absent with `fixed` (a bare fixture, an older
   * server) — read as every program.
   */
  readonly fixedOn?: FixedServedOn;
  /**
   * A question surrogate (no-payslip) products ask — the server's `surrogateSide`. The rest are
   * income-proof questions. (The Questions library lists both on one list since v32.1.0.) Absent
   * on a bare fixture or an older server — read as income-proof.
   */
  readonly surrogateSide?: boolean;
  /** `enabledWhen.questionCode` — the question this one branches off, or `null`. */
  readonly gateSourceCode: string | null;
  /** Wording + code + answer labels, already lower-cased. What search matches. */
  readonly haystack: string;
  /** `SINGLE_SELECT` | `MULTI_SELECT` | `NUMERIC` | `TEXT`. Absent on a bare fixture. */
  readonly type?: string;
  /** The questionnaire section it sits in — the boards group their cards by this. */
  readonly groupKey?: string;
  readonly groupEn?: string;
  readonly groupAr?: string;
  /** Active answer labels, in order — a card previews the first few. */
  readonly optionsEn?: readonly string[];
  readonly optionsAr?: readonly string[];
}

/** What an applicant of one name is served in one loan type — counted server-side. */
export interface ServedCount {
  readonly category: LoanCategory;
  readonly servedTotal: number;
  readonly servedRequired: number;
  /** Codes of the questions served, when the endpoint sends them. */
  readonly servedQuestionCodes?: readonly string[];
  /** Which of the served questions the admin marked fixed. Absent on an older server. */
  readonly fixedQuestionCodes?: readonly string[];
  /**
   * The served questionnaire itself, one entry per page the app shows, in the program's own
   * order — the app renders one step per group. Absent on an older server.
   */
  readonly pages?: readonly ServedPage[];
}

/** One page of the app's questionnaire: a group, its questions in the order served. */
export interface ServedPage {
  readonly code: string;
  readonly titleAr: string;
  readonly titleEn: string;
  readonly displayOrder: number;
  readonly questions: readonly ServedQuestion[];
}

/** A question as the customer snapshot serves it — `isRequired` already folds in the name. */
export interface ServedQuestion {
  readonly code: string;
  readonly type: string;
  readonly questionAr: string;
  readonly questionEn: string;
  readonly helperTextAr?: string | null;
  readonly helperTextEn?: string | null;
  readonly isRequired: boolean;
  readonly displayOrder: number;
  readonly enabledWhen: EnabledWhenLike | null;
  readonly options: readonly {
    readonly code: string;
    readonly labelAr: string;
    readonly labelEn: string;
    readonly displayOrder: number;
  }[];
}

/**
 * The gate sources a tick would have to bring with it, nearest first.
 *
 * Walks `enabledWhen` upward until it reaches a question the program asks already (`asked`,
 * question codes), or the end of the chain. A cycle is impossible through the server's own
 * guards but is bounded here anyway — a pure function that can hang is worse than one that
 * stops early, and the bound costs a `Set`.
 */
export function gateChainFor(
  pool: readonly AskableQuestion[],
  question: AskableQuestion,
  asked: ReadonlySet<string>,
): readonly AskableQuestion[] {
  const byCode = new Map(pool.map((q) => [q.code, q]));
  const out: AskableQuestion[] = [];
  const seen = new Set<string>([question.id]);
  let at: AskableQuestion | undefined = question;
  while (at?.gateSourceCode != null) {
    const source: AskableQuestion | undefined = byCode.get(at.gateSourceCode);
    // A gate naming a question the pool does not carry scopes nothing — the pool editor's
    // own guards own that case, and refusing here would block a tick over somebody else's
    // broken row.
    if (source === undefined || seen.has(source.id) || asked.has(source.code)) break;
    seen.add(source.id);
    out.push(source);
    at = source;
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// The minimum a program must ask to be QUOTABLE
// ---------------------------------------------------------------------------------------

/**
 * The four money answers the engine cannot price without (`MONEY_FIELD_BINDINGS` on the
 * backend — a missing one yields no figures, never a default). Mirrored here as codes because
 * the admin has no endpoint that lists them; a code renamed on the backend is a code change on
 * both sides, which is the same accepted limit the backend constant records. What the applicant
 * owes is asked through the debt-type pick (`current_loans`) and an amount per debt. Every
 * program asks these whatever else it does (the server's core), fixed or not.
 */
const MONEY_CORE: readonly string[] = [
  'monthly_income',
  'amount_requested',
  'repayment_period_months',
  'current_loans',
];

/**
 * Per loan type, the answers a quote reads beyond the money four.
 *
 * `car`: price and down payment cap the loan by the share the bank finances. Since v32.0.0 they
 * are not fixed: a car program asks them because it TICKED them (or because a bank program
 * under it reads them), so a new car program is held until both are ticked. `personal` and
 * `mortgage` need only the money four. `business` is deliberately not validated here — nothing
 * on the platform sells a business program off a checklist this short, and inventing one would
 * refuse a name over a rule nobody stated.
 */
export const CORE_QUESTION_CODES: Readonly<Partial<Record<LoanCategory, readonly string[]>>> = {
  personal: MONEY_CORE,
  car: [...MONEY_CORE, 'car_price', 'car_down_payment'],
  mortgage: MONEY_CORE,
};

export type CoreState =
  /** Every program asks it already — fixed, or one of the money four. */
  | 'asked'
  /** Ticked for this program. */
  | 'picked'
  /** In the pool and switched on, but not ticked — a tick fixes it. */
  | 'not_asked'
  /** Not in the pool, or switched off — no tick here can fix it. */
  | 'unavailable';

export interface CoreCheck {
  readonly code: string;
  readonly label: string;
  readonly state: CoreState;
  /** The pool row to tick, when a tick can fix it. */
  readonly questionId: string | null;
  readonly isRequired: boolean;
}

/** Is this loan type one the checklist covers? */
export function isValidatedCategory(category: LoanCategory): boolean {
  return CORE_QUESTION_CODES[category] !== undefined;
}

/**
 * A fixed question a program of `basis` asks: fixed, and on that side (v32.1.0) — a
 * surrogate-only one is not asked on a payslip name, nor an income-proof-only one on a
 * no-payslip name.
 */
export function fixedAskedHere(q: AskableQuestion, basis: IncomeBasis): boolean {
  return q.fixed === true && fixedAskedOn(q.fixedOn ?? 'every_name', basis);
}

/**
 * One loan type's checklist, in the order the codes are listed above. `ticked` = question ids.
 * For a name made in Add program, which is payslip-only (v30.8.0): a fixed question counts as
 * asked where a payslip program asks it.
 */
export function coreChecks(
  pool: readonly AskableQuestion[],
  category: LoanCategory,
  ticked: ReadonlySet<string>,
  isAr: boolean,
): readonly CoreCheck[] {
  const byCode = new Map(pool.map((q) => [q.code, q]));
  return (CORE_QUESTION_CODES[category] ?? []).map((code): CoreCheck => {
    const q = byCode.get(code);
    if (q === undefined || !q.isActive) {
      return { code, label: code, state: 'unavailable', questionId: null, isRequired: false };
    }
    const label = (isAr ? q.labelAr : q.labelEn) || code;
    // Fixed for surrogate programs only (v32.1.0): a payslip program never asks it, and a fixed
    // question cannot be ticked — only its "Asked on" in Questionnaire can change that.
    if (q.fixed === true && !fixedAskedHere(q, 'payslip')) {
      return { code, label, state: 'unavailable', questionId: null, isRequired: q.isRequired };
    }
    const state: CoreState =
      fixedAskedHere(q, 'payslip') || MONEY_CORE.includes(code)
        ? 'asked'
        : ticked.has(q.id)
          ? 'picked'
          : 'not_asked';
    return { code, label, state, questionId: q.id, isRequired: q.isRequired };
  });
}

/**
 * Checks that would leave a program unquotable, across every loan type the name is offered
 * under. `not_asked` and `unavailable` both block; only the first can be fixed by a tick.
 * Empty pool (unread) yields nothing — a failed read must not refuse a name it cannot judge.
 */
export function coreProblems(
  pool: readonly AskableQuestion[],
  offered: readonly LoanCategory[],
  ticked: ReadonlyMap<LoanCategory, ReadonlySet<string>>,
  isAr: boolean,
): readonly { readonly category: LoanCategory; readonly missing: readonly CoreCheck[] }[] {
  if (pool.length === 0) return [];
  return canonicalCategories(offered)
    .filter(isValidatedCategory)
    .map((category) => ({
      category,
      missing: coreChecks(pool, category, ticked.get(category) ?? new Set<string>(), isAr).filter(
        (c) => c.state === 'not_asked' || c.state === 'unavailable',
      ),
    }))
    .filter((p) => p.missing.length > 0);
}

// ---- What the server locks ---------------------------------------------------------------

/**
 * Why a program may not tick or untick a question — the server's `questionLockReason`, never a
 * list kept here (A33: which questions are which comes from the server alone).
 *
 *   - `engine`: every quote reads it — the money and debt questions, asked on every program.
 *   - `base`: a fixed question, asked on every program of its side — an income-proof-only one
 *     where the name sells a payslip programme, a surrogate-only one where it sells a no-payslip
 *     one (v32.1.0). Changed on Questionnaire, never per program.
 *   - `program`: a bank program under the name, in that loan type, reads it.
 */
export type QuestionLockReason = 'engine' | 'base' | 'program';

/** One lock, as the program-name question-scope endpoint sends it. */
export interface ServerLock {
  readonly code: string;
  readonly reason: QuestionLockReason;
  /**
   * `base` and `program` locks: the loan types where the lock holds for this name — for a fixed
   * question every loan type it is offered under on its side (an income-proof-only one where it
   * sells a payslip programme, a surrogate-only one where it sells a no-payslip one), for a
   * bank's read the loan types that bank's programs are filed in.
   * Absent = every loan type.
   */
  readonly categories?: readonly LoanCategory[];
}

/**
 * Which reason wins when two locks hold for one code in one loan type. `base` first: it is the
 * one statement the board draws in a section of its own, and a question asked on every
 * income-proof program is fixed whoever else reads it.
 */
const LOCK_RANK: Readonly<Record<QuestionLockReason, number>> = { base: 0, engine: 1, program: 2 };

/**
 * The locks that hold in ONE loan type, keyed by question code. An entry holds when it names no
 * loan types or names this one — so a lock scoped to personal does not lock the question on the
 * car tab, where the name may sell no payslip programme, or no programme reads it.
 */
export function lockMapFor(
  locks: readonly ServerLock[],
  category: LoanCategory,
): ReadonlyMap<string, QuestionLockReason> {
  const out = new Map<string, QuestionLockReason>();
  for (const lock of locks) {
    if (lock.categories !== undefined && !lock.categories.includes(category)) continue;
    const held = out.get(lock.code);
    if (held === undefined || LOCK_RANK[lock.reason] < LOCK_RANK[held]) {
      out.set(lock.code, lock.reason);
    }
  }
  return out;
}

/** Added ids another added question branches off — they cannot be unticked before it is. */
export function gateHeldAdditions(
  pool: readonly AskableQuestion[],
  added: ReadonlySet<string>,
): ReadonlySet<string> {
  const byCode = new Map(pool.map((q) => [q.code, q]));
  const held = new Set<string>();
  for (const q of pool) {
    if (!added.has(q.id) || q.gateSourceCode === null) continue;
    const source = byCode.get(q.gateSourceCode);
    if (source !== undefined && added.has(source.id)) held.add(source.id);
  }
  return held;
}

/** A question a program name may add, with the questions an Add brings along before it. */
export interface AddableQuestion {
  readonly question: AskableQuestion;
  /** Its show-when sources that are not asked yet, nearest first — added with it. */
  readonly chain: readonly AskableQuestion[];
}

/**
 * Every question one program name may tick in one loan type: live, not fixed, not locked by the
 * server (`engine` / `base` — the server refuses those), not in `asked` (codes the name asks
 * already), and on one of the name's income `sides` — a payslip name picks from the income-proof
 * questions, a no-payslip one from the surrogate ones (v31.7.0). A question whose show-when chain
 * runs through one it may not tick is left out, because the server would refuse the whole write.
 *
 * ONE rule for both screens: the create flow passes the fixed questions as `asked`, the name's
 * own page passes what the server serves it.
 */
export function addableQuestions(
  pool: readonly AskableQuestion[],
  asked: ReadonlySet<string>,
  locks: ReadonlyMap<string, QuestionLockReason>,
  sides: ReadonlySet<'payslip' | 'no_payslip'>,
): readonly AddableQuestion[] {
  const blocked = (q: AskableQuestion): boolean =>
    !sides.has(q.surrogateSide === true ? 'no_payslip' : 'payslip') ||
    !q.isActive ||
    q.fixed === true ||
    locks.get(q.code) === 'engine' ||
    locks.get(q.code) === 'base';
  const out: AddableQuestion[] = [];
  for (const q of pool) {
    if (asked.has(q.code) || blocked(q)) continue;
    const chain = gateChainFor(pool, q, asked);
    if (chain.some(blocked)) continue;
    out.push({ question: q, chain });
  }
  return out;
}

/**
 * What to save for one loan type: the ticked ids the pool still holds, sorted — the PUT body.
 * An empty list is a real write (untick everything), so the caller decides whether to skip it;
 * on the create flow an empty set has nothing to replace.
 */
export function additionsToSave(
  pool: readonly AskableQuestion[],
  added: ReadonlySet<string>,
): string[] {
  const known = new Set(pool.map((q) => q.id));
  return [...added].filter((id) => known.has(id)).sort();
}
