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
 * test cannot reach: which steps exist for which income basis, what a RETRY does after the
 * first of two writes has already landed, and what the second write's body is. All of it is
 * pure, and none of it is exercisable through a form.
 *
 * THE FLOW IS WHAT A NAME NEEDS TO BE SELLABLE, in the order the decisions depend on each
 * other: what it is (type + name) · where the figure comes from (surrogate only) · which loan
 * types it is offered under · what those loan types' applicants are asked. It used to stop
 * after the second of those, and a name was born PARKED — offered nowhere, pickable by no
 * bank — with the rest of the setup on two other screens in two other sections.
 *
 * THE BASIS LEADS, and that order is load-bearing rather than cosmetic: it decides whether
 * there is a calculation step at all. It shares a step with the labels because on its own it
 * was two cards and nothing else, and the labels were two fields and nothing else — two
 * screens for four fields, one of which the board's own chip had usually already answered.
 */

/**
 * Which product a surrogate name takes its calculation from.
 *
 * ONE VARIANT, because there is one answer: a product that exists. This screen used to be
 * able to MAKE one on the way through — a `{kind:'new'}` carrying the ways and two more
 * labels — and that door is closed: the eleven predefined products are put in by
 * `npm run seed:blueprints`, and an operator's decision about a product is whether it is
 * switched on. A wrapper object rather than a bare string, kept deliberately: `null` is
 * "unanswered" and `{key:''}` is "the picker is open with nothing chosen", and collapsing
 * the two is how an unanswered step comes to read as answered.
 */
export type ProductChoice = { readonly kind: 'existing'; readonly key: string };

/**
 * The steps, in canonical order. `calculation` is the only conditional one.
 *
 * A CONDITIONAL LIST, where this screen used to insist on a fixed one. The old argument —
 * "a hidden step makes the two paths different LENGTHS, which is the inconsistency this
 * screen exists to remove" — was written when the payslip branch of that step had a FACT to
 * state ("the bank reads the payslip"). It has no decision and no control, so as a step it
 * was a screen that could not be answered, could not be wrong, and could not be skipped. The
 * fact survives as a line on step ①, beside the card that states it. The bank-program wizard
 * reached the same conclusion first and ships a `calculation` step that exists iff the
 * program is surrogate; the two now read the same.
 */
export type NewNameStepId = 'program' | 'calculation' | 'offered' | 'asks';

export const NEW_NAME_STEP_ORDER: readonly NewNameStepId[] = [
  'program',
  'calculation',
  'offered',
  'asks',
];

/**
 * The steps a name of this basis walks.
 *
 * An UNANSWERED basis walks the PAYSLIP list, one rule in one direction: an unanswered basis
 * already plans the payslip write in `savePlan`, so the rail GROWS 3 → 4 when the operator
 * picks no-payslip. It can only grow while they are standing on `program`, which is the one
 * id present in both lists, so the reshape moves nobody.
 */
export function newNameStepIds(basis: IncomeBasis | null): readonly NewNameStepId[] {
  return basis === 'no_payslip'
    ? NEW_NAME_STEP_ORDER
    : NEW_NAME_STEP_ORDER.filter((id) => id !== 'calculation');
}

/** The position of `id` in that basis's list, or `-1`. */
export function stepIndexOf(ids: readonly NewNameStepId[], id: NewNameStepId): number {
  return ids.indexOf(id);
}

/**
 * The step at that position, clamped into range — never `undefined`.
 *
 * What a pasted `?step=9` resolves to, and what keeps the page's own index arithmetic honest
 * when the list is one shorter than the operator's last visit.
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
   * `null` is the UNANSWERED state and is deliberately reachable: a pre-answered question
   * reads as skippable, and the two bases are peers. Seeded from the board's `?basis=` chip
   * when there is one.
   */
  readonly basis: IncomeBasis | null;
  readonly product: ProductChoice | null;
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
export type NewNameBlock = 'labels' | 'labels_key' | 'basis' | 'product' | 'offered' | 'core' | null;

/**
 * The first unanswered thing, in step order.
 *
 * In STEP ORDER and not by severity: the action bar names one reason, and naming the last of
 * four missing answers sends the operator to the end of a form they have not started.
 */
export function blockReason(draft: NewNameDraft): NewNameBlock {
  // The basis leads because the FORM leads with it, and because it decides whether there is
  // a calculation step at all.
  if (draft.basis === null) return 'basis';
  if (draft.labelEn.trim() === '' || draft.labelAr.trim() === '') return 'labels';
  // The key is minted from the English label, so a label with no latin letter or digit slugs
  // to the empty string and the server refuses it as VALIDATION_FAILED. Caught HERE, before
  // the click: the drawer this screen replaces only discovered it after Save, which reports a
  // field the operator did fill in.
  if (slugify(draft.labelEn) === '') return 'labels_key';
  if (draft.basis === 'no_payslip' && !productSettled(draft)) return 'product';
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
      // Three answers on one step, reported in the order they are read down the page: the
      // type card sits above the two label fields.
      if (draft.basis === null) return 'basis';
      if (draft.labelEn.trim() === '' || draft.labelAr.trim() === '') return 'labels';
      return slugify(draft.labelEn) === '' ? 'labels_key' : null;
    case 'calculation':
      // Unreachable on a payslip name — that list carries no such step — so this arm only
      // ever answers for the surrogate branch. Stated rather than left to fall through.
      return draft.basis === 'no_payslip' && !productSettled(draft) ? 'product' : null;
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
  // No "somewhere to land" clause. There used to be one, because the basis sat on a step the
  // operator could walk PAST; it now sits on the first step and `stepBlock('program')` gates
  // every forward move, so the clause guarded nothing. Deleting it is the change.
}

/**
 * Whether the calculation step has an answer the server would accept.
 *
 * `{key:''}` is NOT settled: the picker is on screen with nothing chosen, and the server
 * would refuse it (`SURROGATE_PRODUCT_REQUIRED`) after the click rather than before it.
 */
export function productSettled(draft: NewNameDraft): boolean {
  const choice = draft.product;
  return choice !== null && choice.key !== '';
}

/** Whether a step is answered, and whether it can be opened at all. */
export interface NewNameStepState {
  readonly status: WizardStepStatus;
  readonly disabled: boolean;
}

/**
 * The rail, per step id.
 *
 * A total `Record` and not a positional tuple: the list is conditional now, so an index means
 * different things on the two paths, and `calculation` has to be able to carry a status even
 * on a walk that does not include it.
 *
 * Only `program` is ever reachable before the basis is answered. The name does not depend on
 * the basis — locking the labels behind it would turn a reorder into a gate and stop an
 * operator jotting down the labels they came here with — but everything after it does.
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
  const blind = draft.basis === null;
  return {
    program: { status: !blind && named ? 'done' : 'todo', disabled: false },
    calculation: { status: productSettled(draft) ? 'done' : 'todo', disabled: blind },
    offered: { status: draft.offered.length > 0 ? 'done' : 'todo', disabled: blind },
    asks: {
      status: draft.offered.length > 0 && (draft.coreMissing ?? 0) === 0 ? 'done' : 'todo',
      disabled: blind,
    },
  };
}

/** How the name links to a calculation, once the draft is settled. */
export type PlannedLink =
  /** Payslip: the bank reads the payslip and the name states no calculation. */
  { readonly kind: 'none' } | { readonly kind: 'existing'; readonly key: string };

export interface SavePlan {
  readonly incomeBases: readonly IncomeBasis[];
  readonly link: PlannedLink;
  /** Canonically ordered, so one set always serialises one way. */
  readonly categories: readonly LoanCategory[];
}

/**
 * What the first write says. ONE write for the name, its loan types AND their income basis.
 *
 * Still a plan rather than a call, and still worth its own module for one rule that only
 * fails silently: a PAYSLIP name must send `surrogateProductKey` ABSENT — never `''` and
 * never `null`. `''` is refused by the DTO and `null` means UNLINK on a patch, so a screen
 * that sent either would either fail on a name that is fine or quietly unlink one that is
 * not. `link: {kind:'none'}` is what carries that, and the page omits the field on it.
 *
 * `incomeBases` is load-bearing twice over: it is what `SURROGATE_PRODUCT_REQUIRED` reads on
 * the way in, and it is what the server writes as each category row's own basis flags. Send
 * it on every plan.
 */
export function savePlan(draft: NewNameDraft): SavePlan {
  const categories = canonicalCategories([...draft.offered]);
  if (draft.basis !== 'no_payslip') {
    return { incomeBases: ['payslip'], link: { kind: 'none' }, categories };
  }
  return {
    incomeBases: ['no_payslip'],
    // `blockReason` refuses an unsettled draft before this is ever reached, so the empty
    // key is unreachable rather than a silent default.
    link: { kind: 'existing', key: draft.product?.key ?? '' },
    categories,
  };
}
