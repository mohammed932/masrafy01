/**
 * The UNSAVED-pick layer of `/program-catalog/:key` step 3.
 *
 * PURE — no Angular, no `$localize`, no HTTP. Everything here is a set comparison, and it
 * is worth its own module for one reason: step 3 used to write to the server on every tap
 * ("Saves automatically"), and it now holds a draft that a Save button commits. The thing
 * a draft layer gets structurally wrong is silent — a pending edit that reports itself as
 * saved, or an edit the operator undid by hand that keeps asking to be saved — so the
 * comparison is the part worth exercising.
 *
 * WHY A DRAFT PER LOAN TYPE, not one flat set. The template is stored per (name, LOAN
 * TYPE) and the endpoint replaces ONE category's set per call, so a four-tab edit is four
 * writes. A single draft would either lose the other tabs' edits on a tab switch or make
 * "what is unsaved?" unanswerable per tab, which is exactly what the rail's counts render.
 *
 * WHY AN ENTRY IS ABSENT RATHER THAN EQUAL. A draft entry exists only while it DIFFERS
 * from the row on screen: an operator who ticks a question and unticks it again has
 * changed nothing, and a bar that still offers to save it is offering to write the set
 * the server already holds.
 */
import { LOAN_CATEGORIES, type LoanCategory } from '@core/loan-category';

/** Pending pick sets, keyed by loan type. Absent = that type reads the saved row. */
export type PickDraft = Partial<Record<LoanCategory, readonly string[]>>;

/** The saved sets, as the server row carries them. */
export type StoredPicks = Partial<Record<LoanCategory, readonly string[]>>;

/**
 * Order-insensitive, because order is not a decision anybody makes on this screen: a
 * tick appends and an untick filters, so the only way two sets differ in order alone is
 * a write from somewhere else — and re-posting the same membership in a new order is not
 * a change worth a Save button.
 */
export function sameCodeSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((code) => seen.has(code));
}

/** Add or remove one code. Appends, so a fresh pick lands at the end of the set. */
export function togglePick(codes: readonly string[], code: string): readonly string[] {
  return codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
}

/** How many questions moved between two sets — added plus removed, not the net. */
export function pickDiffCount(next: readonly string[], before: readonly string[]): number {
  const had = new Set(before);
  const has = new Set(next);
  const added = next.filter((c) => !had.has(c)).length;
  const removed = before.filter((c) => !has.has(c)).length;
  return added + removed;
}

/**
 * Which loan types hold an edit the server does not have yet, in the platform's order —
 * which is also the order the writes go out in, so a partial failure is reportable.
 */
export function dirtyPickCategories(
  draft: PickDraft,
  stored: StoredPicks,
): readonly LoanCategory[] {
  return LOAN_CATEGORIES.filter((category) => {
    const next = draft[category];
    return next !== undefined && !sameCodeSet(next, stored[category] ?? []);
  });
}

/** Every question moved across every loan type — what the unsaved bar counts. */
export function pendingPickChanges(draft: PickDraft, stored: StoredPicks): number {
  return dirtyPickCategories(draft, stored).reduce(
    (sum, category) => sum + pickDiffCount(draft[category] ?? [], stored[category] ?? []),
    0,
  );
}
