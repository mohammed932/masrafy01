import { canonicalCategories, type LoanCategory } from '@core/loan-category';
import type { IncomeBasis } from '@core/income-basis';
import { slugify } from '@shared/lookups/slug';
import type { WizardStepStatus } from '@shared/ui/wizard-steps.component';

/**
 * Keys a catalog name must never mint, because a row holding one is unreachable.
 *
 * `/program-catalog/new` and `/program-catalog/products` are literal segments declared before
 * the single-segment `:key`, so a name keyed `new` or `products` resolves to those screens and
 * its own page can never be opened. The route order is what makes the screens work; this is
 * what stops the route order from eating a row. `products` has been reachable-and-unopenable
 * since the products section moved here — this closes it for both.
 */
export const RESERVED_NAME_KEYS: ReadonlySet<string> = new Set(['new', 'products']);

/**
 * The decisions behind "add a program name", separated from the screen that asks them.
 *
 * WHY A MODULE OF ITS OWN. Several of the things here are only wrong in states a component
 * test cannot reach: what a RETRY does after the first of two writes has already landed, and
 * what the second write's body is. All of it is pure, and none of it is exercisable through a
 * form.
 *
 * THE FLOW IS WHAT A NAME NEEDS TO BE SELLABLE, in the order the decisions depend on each
 * other: what it is called · which loan types it is offered under · what those loan types'
 * applicants are asked. It used to stop before the loan types, and a name was born PARKED —
 * offered nowhere, pickable by no bank — with the rest of the setup on two other screens in
 * two other sections.
 *
 * INCOME PROOF ONLY (v30.8.0). The flow used to open on a second question — how does the bank
 * prove the income? — and a Surrogate answer grew a step that linked the new name to one of
 * the platform's calculations. That door is closed rather than pre-answered: a surrogate
 * program is not something an operator assembles. Each one carries its own questions and its
 * own equation for the income, both written in code, and the names that sell them are put in
 * with them by the seeds (`seed:blueprints`, the catalog seed, `seed:sheet-figures`). A name
 * made here is sold against a payslip, so there is no basis to ask and no calculation to pick.
 */

/**
 * The steps, in order — a FIXED list. The one conditional step (`calculation`, walked only by
 * a surrogate name) went with the Surrogate answer.
 */
export type NewNameStepId = 'program' | 'offered' | 'asks';

export const NEW_NAME_STEP_ORDER: readonly NewNameStepId[] = ['program', 'offered', 'asks'];

/** The position of `id` in the list, or `-1`. */
export function stepIndexOf(ids: readonly NewNameStepId[], id: NewNameStepId): number {
  return ids.indexOf(id);
}

/**
 * The step at that position, clamped into range — never `undefined`.
 *
 * What a pasted `?step=9` resolves to.
 */
export function stepIdAt(ids: readonly NewNameStepId[], index: number): NewNameStepId {
  const at = Math.min(Math.max(index, 0), ids.length - 1);
  return ids[at] ?? 'program';
}

export function isLastStep(ids: readonly NewNameStepId[], id: NewNameStepId): boolean {
  return ids[ids.length - 1] === id;
}

export interface NewNameDraft {
  /**
   * Questions a validated loan type (personal / car / mortgage) still needs before it can be
   * priced, summed over the loan types on. Absent or 0 = nothing missing — and 0 when the
   * pool could not be read, so a failed read never refuses a name it cannot judge.
   */
  readonly coreMissing?: number;
  readonly labelEn: string;
  readonly labelAr: string;
  /**
   * The loan types the name is offered under, written in the SAME insert as the row itself.
   *
   * REQUIRED here, where the server still accepts none. A name offered under nothing is a
   * name no bank's program picker can reach, and the step after this one is per loan type —
   * with none ticked it would render nothing at all, which is the "a step you can open onto
   * nothing reads as broken rather than as pending" defect this screen already guards
   * elsewhere. A name can still be parked later, on its own page, deliberately.
   */
  readonly offered: readonly LoanCategory[];
}

/**
 * Why Save is refused, as a CODE.
 *
 * A code and not a sentence, because this module is unit-tested under bare jsdom where
 * `$localize` does not exist — and because the page is the thing that knows how much room the
 * action bar has. The page owns the words; this owns the rule.
 */
export type NewNameBlock = 'labels' | 'labels_key' | 'offered' | 'core' | null;

/**
 * The first unanswered thing, in step order.
 *
 * In STEP ORDER and not by severity: the action bar names one reason, and naming the last of
 * three missing answers sends the operator to the end of a form they have not started.
 */
export function blockReason(draft: NewNameDraft): NewNameBlock {
  if (draft.labelEn.trim() === '' || draft.labelAr.trim() === '') return 'labels';
  // The key is minted from the English label, so a label with no latin letter or digit slugs
  // to the empty string and the server refuses it as VALIDATION_FAILED. Caught HERE, before
  // the click: the drawer this screen replaces only discovered it after Save, which reports a
  // field the operator did fill in.
  if (slugify(draft.labelEn) === '') return 'labels_key';
  if (draft.offered.length === 0) return 'offered';
  // Adding NOTHING is still a real answer (the loan types already ask what they ask) — but a
  // personal, car or mortgage loan type that does not ask what the quote reads cannot be
  // priced, so a name offered under one would be sellable and quote nothing.
  if ((draft.coreMissing ?? 0) > 0) return 'core';
  return null;
}

/**
 * Why THIS step cannot be left yet — the same codes, scoped to one step.
 *
 * Separate from `blockReason` because the two answer different questions and the screen needs
 * both: `blockReason` is why the whole thing cannot be CREATED, and this is why the operator
 * cannot move on from where they are standing. Reporting the global reason on every step named
 * a field that was two steps away and not on screen, and it left the action bar with nothing
 * clickable on the first step of a create flow.
 *
 * `null` means this step is answered, which is what makes the bar's primary a live "Next".
 */
export function stepBlock(draft: NewNameDraft, step: NewNameStepId): NewNameBlock {
  switch (step) {
    case 'program':
      // Reported in the order they are read: both labels, then whether the English one can
      // become a key.
      if (draft.labelEn.trim() === '' || draft.labelAr.trim() === '') return 'labels';
      return slugify(draft.labelEn) === '' ? 'labels_key' : null;
    case 'offered':
      return draft.offered.length === 0 ? 'offered' : null;
    case 'asks':
      return (draft.coreMissing ?? 0) > 0 ? 'core' : null;
  }
}

/**
 * What the action bar refuses, on the step the operator is standing on.
 *
 * The two rules above answer different questions and the bar needs whichever one its own
 * button is about: on the last step the button CREATES, so it must name why the whole draft
 * is refused; on every earlier step it MOVES, so it names only why this step cannot be left.
 *
 * Without the split the last step had a live dead button — `stepBlock` is `null` there
 * whatever the rest of the draft says, so the bar offered an enabled control whose click
 * could neither save nor move.
 */
export function barBlock(
  draft: NewNameDraft,
  step: NewNameStepId,
  ids: readonly NewNameStepId[],
): NewNameBlock {
  if (isLastStep(ids, step)) return blockReason(draft);
  return stepBlock(draft, step);
}

/** Whether a step is answered, and whether it can be opened at all. */
export interface NewNameStepState {
  readonly status: WizardStepStatus;
  readonly disabled: boolean;
}

/**
 * The rail, per step id.
 *
 * A total `Record` and not a positional tuple, so a status is looked up by the step it belongs
 * to rather than by where that step happens to sit.
 *
 * Nothing is ever `disabled`. Every later step used to wait for the income basis, because the
 * basis decided whether a calculation step existed at all; with one basis there is nothing to
 * wait for. The labels gate nothing either — locking the loan types behind them would turn an
 * order into a gate and stop an operator setting up the parts they came here with.
 *
 * Nothing here is ever `invalid`. `invalid` means the operator entered something wrong; every
 * state this form can be in is merely unfinished, and painting an untouched step red on
 * arrival is how a creation flow reads as a failing one.
 *
 * `asks` is `done` as soon as it has something to render, and that is not a shrug: add-only
 * means "these loan types already ask what they ask, add more if this program needs them" is
 * an answer, stated — the same argument the deleted payslip source step used to make.
 */
export function stepStatuses(
  draft: NewNameDraft,
): Readonly<Record<NewNameStepId, NewNameStepState>> {
  const named =
    draft.labelEn.trim() !== '' && draft.labelAr.trim() !== '' && slugify(draft.labelEn) !== '';
  return {
    program: { status: named ? 'done' : 'todo', disabled: false },
    offered: { status: draft.offered.length > 0 ? 'done' : 'todo', disabled: false },
    asks: {
      status: draft.offered.length > 0 && (draft.coreMissing ?? 0) === 0 ? 'done' : 'todo',
      disabled: false,
    },
  };
}

export interface SavePlan {
  /**
   * Always `['payslip']`, and sent anyway rather than left to the server's default: it is what
   * the server writes as each category row's own basis flags, and a create leaning on a
   * default would change meaning the day the default did.
   */
  readonly incomeBases: readonly IncomeBasis[];
  /** Canonically ordered, so one set always serialises one way. */
  readonly categories: readonly LoanCategory[];
}

/**
 * What the first write says. ONE write for the name, its loan types AND their income basis.
 *
 * No product link — and not an empty one: `surrogateProductKey` is ABSENT from every create
 * this screen sends. `''` is refused by the DTO and `null` means UNLINK on a patch, so a body
 * carrying either would fail on a name that is fine or say something nobody meant; with the
 * Surrogate answer gone there is nothing it could carry anyway.
 */
export function savePlan(draft: NewNameDraft): SavePlan {
  return { incomeBases: ['payslip'], categories: canonicalCategories([...draft.offered]) };
}
