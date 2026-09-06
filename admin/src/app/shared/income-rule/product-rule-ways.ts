/**
 * The WAYS a product offers of reaching its figure — the client mirror of the backend's
 * `matching/pipeline/product-rule-ways.ts`.
 *
 * NO Angular: pure functions, so the editor, the save gate and the wizard's switch
 * confirmation all read one derivation. Three readings of "which slots belong to this way"
 * is three chances for the screen to promise something the save then refuses.
 *
 * ─── A WAY IS NOT ONE SLOT ────────────────────────────────────────────────────
 *
 * With a second column configured — the compound guarantee has one — the members of the
 * `basis` coalesce are `pickByFact` steps, and each pick spreads into as many COLUMNS as the
 * product has branches. FABMISR's compound program stores `alt` AND `alt__top_up`: one way,
 * two columns. The way's NAME is the first column's id, because the first column keeps the
 * bare head id — which is what a bank's figures have always been filed under.
 *
 * The split cannot be read off the strings: `alt__unit_paid_to_date` is a way HEAD (the third
 * and later ways are named after the fact they read) and `alt__top_up` is a COLUMN. Only the
 * rule says which is which.
 *
 * ─── EVERY PRODUCT OFFERS AT LEAST ONE WAY, AND A PROGRAM NAMES EXACTLY ONE ───
 *
 * A single-way product's way is its head (`primary`, or `primary_pick` behind a second
 * column). A `'combined'` product's heads are the TERMS of one way — the auto cross-sell's
 * "3 × the instalment or 10% of the loan, whichever is less" is one sentence a bank fills
 * both halves of — and fold into ONE way whose slots are the union. Only an `'exclusive'`
 * product lists rivals, and absent reads as exclusive. So `picksBetweenWays` (two or more) is
 * the whole test for "does this program have a choice to make", and exactly one way means
 * "its one way is named for it" — the wizard records it without asking.
 */

import { stepIsConfigured, stepRefs } from '@features/bank-programs/bank-programs.types';
import type { RuleStep, StepFigures } from '@features/bank-programs/bank-programs.types';

/** The `coalesce` every multi-way product compiles to, and the comparison it may wrap. */
const BASIS = 'basis';
const BASIS_COMBINE = 'basis_combine';
const PRIMARY = 'primary';
const PRIMARY_PICK = 'primary_pick';

/** The catalog's statement of how the ways relate. Absent reads as `'exclusive'`. */
export type WaysAre = 'exclusive' | 'combined' | null | undefined;

export interface RuleWay {
  /** The slot a bank's figures hang off — `primary`, `alt`, `alt__<fact>`. Never the pick. */
  id: string;
  /** The head, every column of it, and its pick. Everything this way owns. */
  slots: string[];
  /**
   * The steps the EDITOR renders this way as: the `pickByFact` when the way is split into
   * columns, else the head itself. A combined way spans one row per TERM, which is why this
   * is a list — both the cross-sell's rows are the one way.
   */
  rowIds: string[];
}

function refIds(step: RuleStep | undefined): string[] {
  if (step === undefined) return [];
  return stepRefs(step).flatMap((ref) => ('step' in ref ? [ref.step] : []));
}

/**
 * Every way this rule offers, in the order the product declares them.
 *
 * MULTI-WAY: read off `basis` with `basis_combine` dropped, which covers both spellings at
 * once — a product that states no `combine` emits `coalesce [ ...ways ]` and no comparison.
 *
 * ONE WAY: no `basis` step is emitted, so the way IS the head — `primary_pick` behind a second
 * column, else `primary`. Named rather than empty, because every surrogate program records
 * the way it sells and a one-way product has exactly one to record. A hand-wired pipeline
 * naming no `primary` offers no way, and is asked for none.
 *
 * COMBINED: the heads are TERMS of one method. They collapse to ONE way whose id is the first
 * head's and whose slots are the UNION — the union is what a catalog-amounts program inherits
 * by, and the first head's slots alone would drop `alt` from the cross-sell.
 */
export function waysOfRule(steps: readonly RuleStep[], waysAre: WaysAre = null): RuleWay[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const basis = byId.get(BASIS);

  const heads: string[] =
    basis !== undefined && basis.op === 'coalesce'
      ? refIds(basis).filter((head) => head !== BASIS_COMBINE)
      : byId.has(PRIMARY_PICK)
        ? [PRIMARY_PICK]
        : byId.has(PRIMARY)
          ? [PRIMARY]
          : [];

  const ways: RuleWay[] = [];
  for (const head of heads) {
    const step = byId.get(head);
    if (step === undefined) continue;
    if (step.op !== 'pickByFact') {
      ways.push({ id: head, slots: [head], rowIds: [head] });
      continue;
    }
    const columns = refIds(step);
    const [first] = columns;
    if (first === undefined) continue;
    ways.push({ id: first, slots: [...columns, head], rowIds: [head] });
  }

  if (waysAre === 'combined' && ways.length >= 2) {
    const [first] = ways;
    if (first === undefined) return ways;
    return [
      {
        id: first.id,
        slots: [...new Set(ways.flatMap((way) => way.slots))],
        rowIds: ways.flatMap((way) => way.rowIds),
      },
    ];
  }
  return ways;
}

/**
 * Does this program have a CHOICE to make — two or more rival ways?
 *
 * The whole test, replacing a flag check: a single-way product and a combined product both
 * answer one way, and one way is recorded, never picked. Deliberately the same arithmetic the
 * server's `waysOfRule(rule).length >= 2` runs, so the Save gate cannot out-refuse it.
 */
export function picksBetweenWays(steps: readonly RuleStep[], waysAre: WaysAre): boolean {
  return waysOfRule(steps, waysAre).length >= 2;
}

/**
 * The amount fields wait for the method: true only while a program with a CHOICE has not yet
 * made it. Inert by construction for a payslip program (no steps), a single-way product and a
 * combined product — none of them has anything to pick.
 */
export function mustPickWayFirst(
  steps: readonly RuleStep[],
  waysAre: WaysAre,
  wayId: string | null | undefined,
): boolean {
  return (
    picksBetweenWays(steps, waysAre) && (wayId === null || wayId === undefined || wayId === '')
  );
}

/**
 * How a multi-head product folds its heads — `'lower'` for `minOf`, `'higher'` for `maxOf`,
 * `null` when there is no `basis_combine` at all (one way, or a bare coalesce).
 *
 * Read for the WORDS only: "the lower of A and B" is how a combined way is named to an
 * operator. The evaluator never consults this.
 */
export function combineOfRule(steps: readonly RuleStep[]): 'lower' | 'higher' | null {
  const combine = steps.find((step) => step.id === BASIS_COMBINE);
  if (combine === undefined) return null;
  if (combine.op === 'minOf') return 'lower';
  if (combine.op === 'maxOf') return 'higher';
  return null;
}

/**
 * Editor row id → the way it is, for every row that is one.
 *
 * Built from `waysOfRule` rather than from the step alone, because "is this step a way?" is
 * not a property of the step: only membership of the `basis` coalesce (or being the lone
 * head) decides it, and every other step in the rule — the sources, the adjustments, the
 * conditions — is a step too. Both rows of a combined way map to the one way.
 */
export function wayIdByRow(
  steps: readonly RuleStep[],
  waysAre: WaysAre = null,
): Map<string, string> {
  return new Map(
    waysOfRule(steps, waysAre).flatMap((way) => way.rowIds.map((row) => [row, way.id] as const)),
  );
}

/** Every step id one way owns, or nothing when the rule offers no such way. */
export function wayOwnedSlots(
  steps: readonly RuleStep[],
  wayId: string,
  waysAre: WaysAre = null,
): Set<string> {
  return new Set(waysOfRule(steps, waysAre).find((way) => way.id === wayId)?.slots ?? []);
}

/**
 * Which ways hold a figure.
 *
 * A pick is never asked: it states no figures of its own and `stepIsConfigured` answers
 * `true` for it unconditionally, so asking would report every way as filled.
 */
export function filledWayIds(
  steps: readonly RuleStep[],
  figures: Readonly<Record<string, StepFigures>>,
  waysAre: WaysAre = null,
): string[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  return waysOfRule(steps, waysAre)
    .filter((way) =>
      way.slots.some((slot) => {
        const step = byId.get(slot);
        if (step === undefined || step.op === 'pickByFact') return false;
        return stepIsConfigured(step, figures[slot]);
      }),
    )
    .map((way) => way.id);
}

/**
 * The slots a bank may be offered a figure for: the way it sells, plus every slot no way owns.
 *
 * ONE OWNER, and this file is it. `catalog-defaults.ts` states in its own doc that
 * `product-rule-ways.ts` owns this union — and it was open-coded twice anyway, in the rule
 * editor and in the wizard, which had already drifted apart by a term. Two derivations of
 * "which slots belong to this bank" is how a default for a way the operator has ruled out
 * gets offered on a screen that has already pruned it.
 *
 * `undefined` means "no narrowing": a product with one way — or one combined way — has every
 * slot in play, and so does one whose ways this rule does not describe.
 *
 * A `null` wayId on a product WITH a choice narrows to the slots no way owns — the conditions
 * and the sources — and never to nothing. The bank has not picked a way yet; that is a reason
 * to withhold the ways' figures, not a reason to withhold the conditions' as well.
 */
export function ownedSlotIdsFor(
  steps: readonly RuleStep[],
  allSlotIds: Iterable<string>,
  waysAre: WaysAre,
  wayId: string | null,
): ReadonlySet<string> | undefined {
  if (!picksBetweenWays(steps, waysAre)) return undefined;
  const owned = wayId === null ? new Set<string>() : wayOwnedSlots(steps, wayId, waysAre);
  const everyWaySlot = new Set(waysOfRule(steps, waysAre).flatMap((way) => way.slots));
  for (const id of allSlotIds) if (!everyWaySlot.has(id)) owned.add(id);
  return owned;
}
