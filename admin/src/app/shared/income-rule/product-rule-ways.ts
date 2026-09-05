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
 */

import { stepIsConfigured, stepRefs } from '@features/bank-programs/bank-programs.types';
import type { RuleStep, StepFigures } from '@features/bank-programs/bank-programs.types';

/** The `coalesce` every multi-way product compiles to, and the comparison it may wrap. */
const BASIS = 'basis';
const BASIS_COMBINE = 'basis_combine';

export interface RuleWay {
  /** The slot a bank's figures hang off — `primary`, `alt`, `alt__<fact>`. Never the pick. */
  id: string;
  /** The head, every column of it, and its pick. */
  slots: string[];
  /**
   * The step the EDITOR renders this way as: the `pickByFact` when the way is split into
   * columns, else the head itself. A pick states no figures of its own, so its columns are
   * the row's slots and the pick is the row.
   */
  rowId: string;
}

function refIds(step: RuleStep | undefined): string[] {
  if (step === undefined) return [];
  return stepRefs(step).flatMap((ref) => ('step' in ref ? [ref.step] : []));
}

/**
 * Every way this rule offers, in the order the product declares them.
 *
 * Read off `basis` with `basis_combine` dropped, which covers both spellings at once: a
 * product that states no `combine` emits `coalesce [ ...ways ]` and no comparison at all.
 * EMPTY for a one-way product, which emits no `basis` step — and has nothing to choose
 * between.
 */
export function waysOfRule(steps: readonly RuleStep[]): RuleWay[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const basis = byId.get(BASIS);
  if (basis === undefined || basis.op !== 'coalesce') return [];

  const ways: RuleWay[] = [];
  for (const head of refIds(basis)) {
    if (head === BASIS_COMBINE) continue;
    const step = byId.get(head);
    if (step === undefined) continue;
    if (step.op !== 'pickByFact') {
      ways.push({ id: head, slots: [head], rowId: head });
      continue;
    }
    const columns = refIds(step);
    const [first] = columns;
    if (first === undefined) continue;
    ways.push({ id: first, slots: [...columns, head], rowId: head });
  }
  return ways;
}

/**
 * Editor row id → the way it is, for every row that is one.
 *
 * Built from `waysOfRule` rather than from the step alone, because "is this step a way?" is
 * not a property of the step: only membership of the `basis` coalesce decides it, and every
 * other step in the rule — the sources, the adjustments, the conditions — is a step too.
 */
export function wayIdByRow(steps: readonly RuleStep[]): Map<string, string> {
  return new Map(waysOfRule(steps).map((way) => [way.rowId, way.id]));
}

/** Every step id one way owns, or nothing when the rule offers no such way. */
export function wayOwnedSlots(steps: readonly RuleStep[], wayId: string): Set<string> {
  return new Set(waysOfRule(steps).find((way) => way.id === wayId)?.slots ?? []);
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
): string[] {
  const byId = new Map(steps.map((step) => [step.id, step]));
  return waysOfRule(steps)
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
 * Does this product hold its ways as alternatives a bank picks exactly one of?
 *
 * `waysAre` is the catalog's statement, carried on the rule. Absent reads as combined — the
 * auto cross-sell pairs its two ways on one sheet and both its programs fill both, so
 * `combine` could never have been the flag: that product carries `'lower'` too.
 */
export function waysAreExclusive(
  waysAre: 'exclusive' | null | undefined,
  steps: readonly RuleStep[],
): boolean {
  return waysAre === 'exclusive' && waysOfRule(steps).length >= 2;
}
