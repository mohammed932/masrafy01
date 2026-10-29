import { moveItemInArray } from '@angular/cdk/drag-drop';
import type { IncomeBasis } from '@core/income-basis';
import type { FixedServedOn, QuestionEngineLock, QuestionRow } from './questionnaire.api.service';

/**
 * WHICH TAB OF THE QUESTIONS PAGE LISTS A QUESTION — pure, so the page holds signals and
 * nothing it would have to re-derive.
 *
 * Three tabs (v31.8.1). All, the first: every question in the pool. Then two that split it, and
 * every question on exactly one of those (v31.8.0). Income proof: the FIXED questions and every
 * ordinary one no surrogate product asks. Surrogate: the questions surrogate products ask —
 * which product asks which is still set on the product, in the Program catalog. A fixed
 * question surrogate programs ask too stays on Income proof: one place to edit it.
 */

/** A tab of the Questions page: All, or one of the two halves it splits into. */
export type QuestionTab = 'all' | IncomeBasis;

/** A fixed question: asked on every program of its loan types (v31.0.0; un-fixable, v31.1.0). */
export function isFixed(q: Pick<QuestionRow, 'fixedServedOn'>): boolean {
  return q.fixedServedOn === 'every_name' || q.fixedServedOn === 'income_proof';
}

/** Where a fixed question is asked, in the words of the form's "Asked on" choice. */
export function servedOnLabel(servedOn: FixedServedOn): string {
  return servedOn === 'income_proof'
    ? $localize`:@@qedit.served_proof:Only income-proof programs`
    : $localize`:@@qedit.served_every:Every program`;
}

/** What that choice means for the programs that do not read a payslip. */
export function servedOnHint(servedOn: FixedServedOn): string {
  return servedOn === 'income_proof'
    ? $localize`:@@qedit.served_proof_hint:Surrogate programs skip it, because they work out the income another way. Use this for questions about pay or income.`
    : $localize`:@@qedit.served_every_hint:Income-proof and surrogate programs both ask it.`;
}

/**
 * The tab a question is listed on: `no_payslip` (Surrogate) when a surrogate product asks it,
 * else `payslip` (Income proof). Fixed wins — the server never marks a fixed question
 * `surrogateSide`, and an older server that did would still not split one across two tabs.
 */
export function basisTabOf(q: Pick<QuestionRow, 'fixedServedOn' | 'surrogateSide'>): IncomeBasis {
  return isFixed(q) || q.surrogateSide !== true ? 'payslip' : 'no_payslip';
}

/** The tab a `?basis=` value names; anything else (none, a stale word) is All, the default. */
export function tabOfParam(raw: string | null): QuestionTab {
  return raw === 'payslip' || raw === 'no_payslip' ? raw : 'all';
}

/** Whether `tab` lists the question: All lists every one, the other two their half. */
export function listedOn(
  tab: QuestionTab,
  q: Pick<QuestionRow, 'fixedServedOn' | 'surrogateSide'>,
): boolean {
  return tab === 'all' || basisTabOf(q) === tab;
}

/**
 * The lock the engine puts on a question, or `null`. The server's `base` reason means "fixed",
 * which the row says with its own badge and the form with its own controls — so it is dropped
 * here rather than drawn a second time as a lock.
 */
export function engineLockOf(q: Pick<QuestionRow, 'engineLock'>): QuestionEngineLock | null {
  const lock = q.engineLock ?? null;
  return lock === null || lock.reason === 'base' ? null : lock;
}

/**
 * Move one question within the questions its tab lists, and give back the WHOLE pool in its
 * new order — the reorder endpoint takes every active id or none.
 *
 * `from` and `to` index into `subset`, which is `all` narrowed and still in `all`'s order. The
 * tab's questions trade places among the slots they already hold; a question on the other tab
 * keeps its own slot, so a drag on one tab never moves a question the admin cannot see.
 */
export function reorderWithin<T extends { id: string }>(
  all: readonly T[],
  subset: readonly T[],
  from: number,
  to: number,
): T[] {
  const ids = new Set(subset.map((q) => q.id));
  const slots: number[] = [];
  all.forEach((q, index) => {
    if (ids.has(q.id)) slots.push(index);
  });
  const moved = [...subset];
  moveItemInArray(moved, from, to);
  const next = [...all];
  slots.forEach((slot, i) => {
    const q = moved[i];
    if (q !== undefined) next[slot] = q;
  });
  return next;
}
