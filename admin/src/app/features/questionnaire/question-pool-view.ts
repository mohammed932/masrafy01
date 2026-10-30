import { ruleCodes } from '@shared/questions/enabled-when';
import type { FixedServedOn, QuestionEngineLock, QuestionRow } from './questionnaire.api.service';

/**
 * How the Questions library reads a question — pure, so the page holds signals and nothing it
 * would have to re-derive.
 *
 * The library is ONE list of every question (v32.1.0, operator decision 2026-10-30: "this
 * screen must be like library for all questions"). It used to split into All / Income proof /
 * Surrogate tabs (v31.8.0–v31.8.1); which programs ask a question is now said by the question
 * itself — its Fixed mark and "Asked on" — and listed by side on the Fixed questions tab only.
 */

/** A fixed question: asked on every program of its side (v31.0.0; un-fixable, v31.1.0). */
export function isFixed(q: Pick<QuestionRow, 'fixedServedOn'>): boolean {
  return q.fixedServedOn != null;
}

/** Where a fixed question is asked, in the words of the form's "Asked on" choice. */
export function servedOnLabel(servedOn: FixedServedOn): string {
  switch (servedOn) {
    case 'income_proof':
      return $localize`:@@qedit.served_proof:Only income-proof programs`;
    case 'income_surrogate':
      return $localize`:@@qedit.served_surrogate:Only surrogate programs`;
    case 'every_name':
      return $localize`:@@qedit.served_both:Both — every program`;
  }
}

/** What that choice means for the programs on the other side. */
export function servedOnHint(servedOn: FixedServedOn): string {
  switch (servedOn) {
    case 'income_proof':
      return $localize`:@@qedit.served_proof_hint:Surrogate programs skip it, because they work out the income another way. Use this for questions about pay or income.`;
    case 'income_surrogate':
      return $localize`:@@qedit.served_surrogate_hint:Income-proof programs skip it. Use this for questions only a program without a payslip needs.`;
    case 'every_name':
      return $localize`:@@qedit.served_every_hint:Income-proof and surrogate programs both ask it.`;
  }
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
 * The library as a TREE (operator, 2026-10-30: "show dependable questions under parent
 * questions"): a follow-up — a question with a show-when rule — hangs under the question whose
 * answer opens it, its own follow-ups under it, and so on.
 *
 * The tree IS the library's order: a question, then its follow-ups (in library order), then the
 * next question. A reorder moves a question among its siblings only, carrying its follow-ups with
 * it, and writes the whole tree back flat — so a source is always asked before what it opens,
 * which is the server's own rule for a show-when source (an earlier question). Until the first
 * reorder the pool may still hold a follow-up far below its source; the tree draws it under the
 * source regardless, and that reorder closes the gap.
 *
 * A rule that cannot hide its question (`gateOpen`: no answer named, a source not in the pool, a
 * loop) does not nest it either — it is drawn where everyone is asked it, at the top level.
 */
export interface PoolTree {
  /** The questions that follow no other, in library order. */
  readonly roots: readonly QuestionRow[];
  /** Each question's follow-ups, in library order. A question with none has no entry. */
  readonly children: ReadonlyMap<string, readonly QuestionRow[]>;
  /** Each follow-up's parent, by id. A top-level question has no entry. */
  readonly parentOf: ReadonlyMap<string, string>;
}

/** The question a rule hangs `q` on, or null — by the rule's source code, never itself. */
function gateSource(q: QuestionRow, byCode: ReadonlyMap<string, QuestionRow>): QuestionRow | null {
  const rule = q.enabledWhen;
  if (!rule?.questionCode || ruleCodes(rule).length === 0) return null;
  const source = byCode.get(rule.questionCode);
  return source !== undefined && source.id !== q.id ? source : null;
}

/** Builds the tree over `rows`, which arrive in the pool's order. */
export function poolTree(rows: readonly QuestionRow[]): PoolTree {
  const byCode = new Map(rows.map((q) => [q.code, q]));
  const roots: QuestionRow[] = [];
  const children = new Map<string, QuestionRow[]>();
  const parentOf = new Map<string, string>();
  for (const q of rows) {
    let parent = gateSource(q, byCode);
    // Walk the sources up: a chain that comes back round (stored data the editor would never
    // write) leaves the question at the top level rather than nowhere.
    const seen = new Set([q.id]);
    for (let p = parent; p !== null; p = gateSource(p, byCode)) {
      if (seen.has(p.id)) {
        parent = null;
        break;
      }
      seen.add(p.id);
    }
    if (parent === null) {
      roots.push(q);
      continue;
    }
    parentOf.set(q.id, parent.id);
    const list = children.get(parent.id);
    if (list) list.push(q);
    else children.set(parent.id, [q]);
  }
  return { roots, children, parentOf };
}

/** The tree written flat, a question before its follow-ups — the order a reorder saves. */
export function flattenTree(
  roots: readonly QuestionRow[],
  children: ReadonlyMap<string, readonly QuestionRow[]>,
): QuestionRow[] {
  const out: QuestionRow[] = [];
  const walk = (q: QuestionRow): void => {
    out.push(q);
    for (const c of children.get(q.id) ?? []) walk(c);
  };
  roots.forEach(walk);
  return out;
}

/** The questions `q` moves among: its parent's follow-ups, or the top level. */
export function siblingsOf(tree: PoolTree, q: Pick<QuestionRow, 'id'>): readonly QuestionRow[] {
  const parentId = tree.parentOf.get(q.id);
  return parentId === undefined ? tree.roots : (tree.children.get(parentId) ?? []);
}

/**
 * The library's order after `q` moves from one place among its siblings to another, follow-ups
 * carried along; null when the move goes nowhere.
 */
export function moveAmongSiblings(
  tree: PoolTree,
  q: Pick<QuestionRow, 'id'>,
  to: number,
): QuestionRow[] | null {
  const siblings = [...siblingsOf(tree, q)];
  const from = siblings.findIndex((s) => s.id === q.id);
  if (from < 0 || to < 0 || to >= siblings.length || from === to) return null;
  const [moved] = siblings.splice(from, 1);
  if (moved === undefined) return null;
  siblings.splice(to, 0, moved);
  const parentId = tree.parentOf.get(q.id);
  if (parentId === undefined) return flattenTree(siblings, tree.children);
  const children = new Map(tree.children);
  children.set(parentId, siblings);
  return flattenTree(tree.roots, children);
}

/** Outline numbers: 1, 2, 3 at the top level; 4.1, 4.2 under question 4; 4.1.1 below that. */
export function outlineLabels(tree: PoolTree): Map<string, string> {
  const labels = new Map<string, string>();
  const walk = (q: QuestionRow, label: string): void => {
    labels.set(q.id, label);
    (tree.children.get(q.id) ?? []).forEach((c, i) => walk(c, `${label}.${i + 1}`));
  };
  tree.roots.forEach((q, i) => walk(q, String(i + 1)));
  return labels;
}

/** The top-level question `id` hangs under (itself, at the top level). */
export function rootIdOf(tree: PoolTree, id: string): string {
  let current = id;
  for (let parent = tree.parentOf.get(current); parent !== undefined; ) {
    current = parent;
    parent = tree.parentOf.get(current);
  }
  return current;
}
