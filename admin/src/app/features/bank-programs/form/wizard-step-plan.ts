/**
 * The bank-program wizard's step ORDER, and the two lookups that let the page hold step IDS
 * in its signals while the rail and the template still work in indices.
 *
 * Pure: no Angular, no `$localize`. The `WizardStep` objects (labels, form groups) stay on the
 * page; this module owns only which steps exist for which program and how an id maps to a
 * position — the half that has to be right when the list changes SHAPE under the operator.
 *
 * FIVE STEPS, AND WHY NOT EIGHT. Three of the eight were not steps. `income` asked ONE
 * question and owned no control; `documents` held two optional fields and carried no
 * validator at all, so it could never be the thing that blocked a save — a step structurally
 * incapable of failing; and `terms` was four numbers that the pricing step's own band table
 * then cross-references ("loans under X fall outside every band"), a sentence that spanned a
 * step boundary and could not be checked without navigating. Each is now a CARD on the step
 * it belongs to. What survives as a step is what an operator can be blocked on: who the
 * program is, how the figure is worked out, what it costs, who qualifies, and the read-back.
 *
 * WHY THE LIST IS CONDITIONAL. A surrogate program works its figure out from a product's
 * calculation, and the operator picks the method BEFORE typing the amounts it governs — so it
 * gets a `calculation` step between Program and Amount & pricing. A payslip program has no
 * calculation and stays at four steps. The step exists iff the program is `income_surrogate`,
 * which is the one synchronous boolean the income block was already gated on. Not on the
 * catalog rule: that is fetched, so the step would materialise behind an operator who had
 * already walked past it, and a surrogate name on a single-fact method still needs its
 * income editor.
 *
 * WHY IDS IN STATE. `programType` has exactly two writers — the income cards' pick and the
 * edit-load hydration — so the list can only reshape while the operator stands on `program`
 * or before they have navigated at all. Holding the CURRENT step as an id makes that reshape
 * a no-op for the page; holding the FURTHEST-reached step as an id needs one more rule, below.
 */

export type StepId = 'program' | 'calculation' | 'money' | 'requirements' | 'review';

/** Every step there is, in canonical order. The payslip list is a subsequence of this. */
export const STEP_ORDER: readonly StepId[] = [
  'program',
  'calculation',
  'money',
  'requirements',
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
 * This is what keeps "furthest step reached" honest when the list shrinks. Only `calculation`
 * can vanish, and it sits second, so today the fallback always resolves to `program` at index
 * 0 — the operator lands on the step they are already standing on, which is the whole point:
 * a plain `findIndex` answers `-1`, and clamping that to `0` would be right by accident here
 * and wrong the moment a second conditional step is added further down the list. Never `-1`:
 * `program` is on every list.
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
