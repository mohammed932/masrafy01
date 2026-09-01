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
 * WHY A MODULE OF ITS OWN. Two of the three things here are only wrong in states a
 * component test cannot reach: the ORDER of the two writes when a product is being made
 * alongside the name, and what a RETRY does after the first of those two succeeded. Both
 * live in `savePlan`, both are pure, and neither is exercisable through a form. The same
 * argument `catalog-board.ts` makes for itself.
 *
 * The three steps map one-to-one onto the three answers: how its income is PROVED, what it is
 * CALLED, and — only when the first answer is "surrogate" — which CALCULATION it quotes from.
 *
 * THE BASIS IS ASKED FIRST, and that order is load-bearing rather than cosmetic. Everything the
 * third step shows branches on it, so asking it last meant an operator on the board's `All` chip
 * typed two labels and a sort order before anything on screen said which KIND of program was
 * being made. It also makes arriving from a chip honest: the chip answers question one, so the
 * screen opens on question two with the answer sitting behind it, changeable — rather than
 * opening on a question that is already answered, which reads as a step to skip.
 */

/** Which product a surrogate name takes its calculation from, as the operator answered it. */
export type ProductChoice =
  /** One that already exists, picked from the list. */
  | { readonly kind: 'existing'; readonly key: string }
  /** One to be made here: a shape, and the two labels it will be filed under. */
  | {
      readonly kind: 'new';
      readonly shape: string;
      readonly labelEn: string;
      readonly labelAr: string;
    };

export interface NewNameDraft {
  readonly labelEn: string;
  readonly labelAr: string;
  /**
   * `null` is the UNANSWERED state and is deliberately reachable: on a step of its own a
   * pre-answered question reads as skippable, and the whole point of this screen is that
   * the two bases are peers. Seeded from the board's `?basis=` chip when there is one.
   */
  readonly basis: IncomeBasis | null;
  readonly product: ProductChoice | null;
  /**
   * A product this flow ALREADY created, on an attempt whose second write failed.
   *
   * Carried so a retry cannot mint a second one. It is not the same thing as
   * `product: {kind:'existing'}` — that is a choice the operator made, this is a fact about
   * what has already been written — but it collapses to the same plan, which is the point.
   */
  readonly madeProductKey: string | null;
}

/**
 * Why Save is refused, as a CODE.
 *
 * A code and not a sentence, because this module is unit-tested under bare jsdom where
 * `$localize` does not exist — and because the page is the thing that knows how much room the
 * action bar has. The page owns the words; this owns the rule.
 */
export type NewNameBlock = 'labels' | 'labels_key' | 'basis' | 'product' | null;

/**
 * The last of the three steps, named once. `stepBlock` and `stepStatuses` both already
 * hardcoded it, and the action bar now needs the same number to know that its primary is
 * the CREATE action rather than a move.
 */
export const LAST_STEP = 2;

/**
 * The first unanswered thing, in step order.
 *
 * In STEP ORDER and not by severity: the action bar names one reason, and naming the last
 * of three missing answers sends the operator to the end of a form they have not started.
 */
export function blockReason(draft: NewNameDraft): NewNameBlock {
  // The basis leads because the FORM leads with it. Reported after the labels it would name a
  // field two steps away from the one on screen, which is the same defect as naming the last of
  // three missing answers.
  if (draft.basis === null) return 'basis';
  if (draft.labelEn.trim() === '' || draft.labelAr.trim() === '') return 'labels';
  // The key is minted from the English label, so a label with no latin letter or digit slugs
  // to the empty string and the server refuses it as VALIDATION_FAILED. Caught HERE, before
  // the click: the drawer this screen replaces only discovered it after Save, which reports a
  // field the operator did fill in.
  if (slugify(draft.labelEn) === '') return 'labels_key';
  if (draft.basis === 'no_payslip' && !productSettled(draft)) return 'product';
  return null;
}

/**
 * Why THIS step cannot be left yet — the same codes, scoped to one step.
 *
 * Separate from `blockReason` because the two answer different questions and the screen needs
 * both: `blockReason` is why the whole thing cannot be CREATED, and this is why the operator
 * cannot move on from where they are standing. Reporting the global reason on every step named
 * a field that was two steps away and not on screen ("Give it a name in both languages", read
 * while looking at the two income-basis cards), and it left the action bar with nothing
 * clickable on step 1 — a dead end on the first screen of a create flow.
 *
 * `null` means this step is answered, which is what makes the bar's primary a live "Next".
 */
export function stepBlock(draft: NewNameDraft, step: number): NewNameBlock {
  if (step === 0) return draft.basis === null ? 'basis' : null;
  if (step === 1) {
    if (draft.labelEn.trim() === '' || draft.labelAr.trim() === '') return 'labels';
    return slugify(draft.labelEn) === '' ? 'labels_key' : null;
  }
  return draft.basis === 'no_payslip' && !productSettled(draft) ? 'product' : null;
}

/**
 * What the action bar refuses, on the step the operator is standing on.
 *
 * The two rules above answer different questions and the bar needs whichever one its own
 * button is about: on the last step the button CREATES, so it must name why the whole draft
 * is refused; on every earlier step it MOVES, so it names only why this step cannot be left.
 *
 * Without the split the last step had a live dead button: `stepBlock` is `null` for a payslip
 * draft on step 3 whatever the labels say (step 3 asks nothing on that branch), so the bar
 * offered an enabled control whose click could neither save nor move.
 */
export function barBlock(draft: NewNameDraft, step: number): NewNameBlock {
  if (step >= LAST_STEP) return blockReason(draft);
  const own = stepBlock(draft, step);
  if (own !== null) return own;
  // A move also needs somewhere to land. Step 3 has nothing to show before the basis is
  // answered — `stepStatuses` disables it for that reason — and an operator CAN stand on step
  // 2 with no basis (the rail never locks the name, and `?step=2` lands there). Without this
  // the footer offered a live Next whose click was a silent no-op.
  return step + 1 >= LAST_STEP && draft.basis === null ? 'basis' : null;
}

/** Whether step 3's surrogate branch has an answer the server would accept. */
export function productSettled(draft: NewNameDraft): boolean {
  if (draft.madeProductKey !== null) return true;
  const choice = draft.product;
  if (choice === null) return false;
  if (choice.kind === 'existing') return choice.key !== '';
  return choice.shape !== '' && choice.labelEn.trim() !== '' && choice.labelAr.trim() !== '';
}

/**
 * The rail, per step: [1] how the income is proved · [2] what it is called · [3] where the
 * figure comes from.
 *
 * Step 3 is `done` on the payslip basis rather than hidden or skipped. A hidden step makes
 * the two paths different LENGTHS, which is the inconsistency this screen exists to remove:
 * the operator sees the same three steps either way, and the payslip answer is "the bank
 * reads the payslip, there is nothing to set up" — an answer, stated.
 *
 * Only step 3 ever disables. The NAME does not depend on the basis, so locking it behind the
 * first answer would turn a reorder into a gate and stop an operator jotting the labels they
 * came here with.
 *
 * Nothing here is ever `invalid`. `invalid` means the operator entered something wrong;
 * every state this form can be in is merely unfinished, and painting an untouched step red
 * on arrival is how a creation flow reads as a failing one.
 */
export function stepStatuses(
  draft: NewNameDraft,
): readonly { readonly status: WizardStepStatus; readonly disabled: boolean }[] {
  const named =
    draft.labelEn.trim() !== '' && draft.labelAr.trim() !== '' && slugify(draft.labelEn) !== '';
  return [
    { status: draft.basis !== null ? 'done' : 'todo', disabled: false },
    { status: named ? 'done' : 'todo', disabled: false },
    {
      status: draft.basis === 'payslip' || productSettled(draft) ? 'done' : 'todo',
      // Unreachable until the basis is answered — step 3 has no content to show before
      // then, and a step you can open onto nothing reads as broken rather than as pending.
      disabled: draft.basis === null,
    },
  ];
}

/** How the name links to a calculation, once the draft is settled. */
export type PlannedLink =
  /** Payslip: the bank reads the payslip and the name states no calculation. */
  | { readonly kind: 'none' }
  | { readonly kind: 'existing'; readonly key: string }
  /** The product this same plan creates one write earlier. */
  | { readonly kind: 'made' };

export interface SavePlan {
  /**
   * Written FIRST when present. The order is forced by the server, not chosen here:
   * `assertSurrogateProductForBases` refuses a no-payslip name while nothing says how its
   * income is worked out, and `resolveSurrogateProductKey` requires a LIVE product row — so
   * the product has to exist before the name that points at it.
   */
  readonly product: { readonly labelEn: string; readonly labelAr: string } | null;
  readonly incomeBases: readonly IncomeBasis[];
  readonly link: PlannedLink;
  /**
   * The shape to seed the calculation screen with, when a product is being made.
   *
   * It travels as a query param and NOT as a written template: `blankTemplate()` leaves
   * `fact: ''` on purpose so `validateTemplate` reports `mechanism_needs_fact`, so a write
   * here would be refused. The product is born with no calculation and the operator is put
   * in front of the form for it.
   */
  readonly shape: string | null;
}

/**
 * What to write, in order.
 *
 * Returns a plan rather than performing it so the ordering and the retry rule can be read
 * — and tested — without a network. Callers must not reorder it.
 *
 * `incomeBases` is sent on every plan even though a create with no `categories` stores none
 * of it: it is what `SURROGATE_PRODUCT_REQUIRED` reads on the way in, and dropping it would
 * turn the server's one guard against a name that quotes nothing into a no-op. What
 * actually persists is decided later by `bornBasisFlags`, off the LINK. The two agree; both
 * are load-bearing.
 */
export function savePlan(draft: NewNameDraft): SavePlan {
  if (draft.basis !== 'no_payslip') {
    return { product: null, incomeBases: ['payslip'], link: { kind: 'none' }, shape: null };
  }
  // A product this flow already wrote wins over the form above it: the operator is retrying
  // after a half-applied attempt, and re-reading the form would mint a second product under
  // the same name.
  if (draft.madeProductKey !== null) {
    return {
      product: null,
      incomeBases: ['no_payslip'],
      link: { kind: 'existing', key: draft.madeProductKey },
      shape: draft.product?.kind === 'new' ? draft.product.shape : null,
    };
  }
  const choice = draft.product;
  if (choice !== null && choice.kind === 'new') {
    return {
      product: { labelEn: choice.labelEn, labelAr: choice.labelAr },
      incomeBases: ['no_payslip'],
      link: { kind: 'made' },
      shape: choice.shape,
    };
  }
  return {
    product: null,
    incomeBases: ['no_payslip'],
    // `blockReason` refuses an unsettled draft before this is ever reached, so the empty
    // key is unreachable rather than a silent default.
    link: { kind: 'existing', key: choice?.kind === 'existing' ? choice.key : '' },
    shape: null,
  };
}
