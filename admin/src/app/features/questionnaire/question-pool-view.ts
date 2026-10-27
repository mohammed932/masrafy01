import { moveItemInArray } from '@angular/cdk/drag-drop';
import type { FixedServedOn, QuestionEngineLock, QuestionRow } from './questionnaire.api.service';

/**
 * WHAT THE QUESTIONS TAB LISTS — pure, so the page holds signals and nothing it would have to
 * re-derive.
 *
 * The tab shows the FIXED questions and every ordinary question surrogate products do not ask.
 * A question a surrogate product asks is managed from the Program catalog: it stays in the pool
 * (branch rules, the reorder and a `?q=` link still need it), it is only not LISTED here.
 */

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

/** Listed on the Questions tab: every fixed question, and every one no surrogate product asks. */
export function isListed(q: Pick<QuestionRow, 'fixedServedOn' | 'surrogateSide'>): boolean {
  return isFixed(q) || q.surrogateSide !== true;
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
 * Move one LISTED question within the listed questions, and give back the WHOLE pool in its
 * new order — the reorder endpoint takes every active id or none.
 *
 * `from` and `to` index into `subset`, which is `all` narrowed and still in `all`'s order. The
 * listed questions trade places among the slots they already hold; a hidden question keeps its
 * own slot, so a drag on this tab never moves a question the admin cannot see.
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
