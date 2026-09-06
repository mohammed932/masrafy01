/**
 * The bank-program wizard's step ORDER, and the two lookups that let the page hold step IDS
 * in its signals while the rail and the template still work in indices.
 *
 * Pure: no Angular, no `$localize`. The `WizardStep` objects (labels, form groups) stay on the
 * page; this module owns only which steps exist for which program and how an id maps to a
 * position — the half that has to be right when the list changes SHAPE under the operator.
 *
 * WHY THE LIST IS CONDITIONAL. A surrogate program works its figure out from a product's
 * calculation, and the operator picks the method BEFORE typing the amounts it governs — so it
 * gets a `calculation` step between Program and Amount. A payslip program has no calculation,
 * and the operator's instruction is that it stays exactly as it was: seven steps, nothing
 * locked, nothing new. So the step exists iff the program is `income_surrogate`, which is the
 * one synchronous boolean the income block was already gated on. Not on the catalog rule:
 * that is fetched, so the step would materialise behind an operator who had already walked
 * past it, and a surrogate name on a single-fact method still needs its income editor.
 *
 * WHY IDS IN STATE. `programType` has exactly two writers — the income step's pick and the
 * edit-load hydration — so the list can only reshape while the operator stands on step 0 or
 * before they have navigated at all. Holding the CURRENT step as an id makes that reshape a
 * no-op for the page; holding the FURTHEST-reached step as an id needs one more rule, below.
 */

export type StepId =
  | 'income'
  | 'program'
  | 'calculation'
  | 'terms'
  | 'pricing'
  | 'eligibility'
  | 'documents'
  | 'review';

/** Every step there is, in canonical order. The payslip list is a subsequence of this. */
export const STEP_ORDER: readonly StepId[] = [
  'income',
  'program',
  'calculation',
  'terms',
  'pricing',
  'eligibility',
  'documents',
  'review',
];

/** The steps a program of this kind walks, in order. */
export function stepIdsFor(surrogate: boolean): readonly StepId[] {
  return surrogate ? STEP_ORDER : STEP_ORDER.filter((id) => id !== 'calculation');
}

/** The position of `id` in `ids`, or `-1` when the list does not carry it. */
export function indexOfStep(ids: readonly { readonly id: StepId }[], id: StepId): number {
  return ids.findIndex((step) => step.id === id);
}

/**
 * The position of `id`, or — when the list no longer carries it — of the nearest EARLIER step
 * in canonical order that it does.
 *
 * This is what keeps "furthest step reached" honest when the list shrinks: an operator who had
 * reached `calculation` on a surrogate program and then switched the basis to payslip must
 * keep `program` unlocked, not be thrown back to `income` (a plain `findIndex` answers `-1`,
 * and clamping that to `0` would silently re-lock five steps). Never `-1`: `income` is on
 * every list.
 */
export function indexOfOrPreceding(ids: readonly { readonly id: StepId }[], id: StepId): number {
  let at = STEP_ORDER.indexOf(id);
  while (at >= 0) {
    const candidate = STEP_ORDER[at];
    const found = candidate === undefined ? -1 : indexOfStep(ids, candidate);
    if (found !== -1) return found;
    at -= 1;
  }
  return 0;
}

/** Is `a` later than `b` in canonical order? For advancing the furthest-reached marker. */
export function isLaterStep(a: StepId, b: StepId): boolean {
  return STEP_ORDER.indexOf(a) > STEP_ORDER.indexOf(b);
}
