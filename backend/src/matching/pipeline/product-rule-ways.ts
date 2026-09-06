/**
 * The WAYS a product offers of reaching its figure, read off the compiled rule.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
 *
 * ─── Why the rule and not the form ────────────────────────────────────────────
 *
 * `product-template.ts` is where a way is AUTHORED, and `waySlot` is what names it. But the
 * two places that have to act on "which way is this bank selling" hold a compiled rule and
 * never a template:
 *
 *   · `validateIncomeRule` is handed the effective `IncomeAssumptionConfig` and refuses the
 *     save from it;
 *   · `effectiveIncomeRule` runs inside `toBankProgramSnapshot` and prunes the catalog's
 *     figures from it.
 *
 * Reaching back to `templateSpec` from either would be a second read of the same fact, free
 * to disagree — and a calculation authored through the raw step editor has no template at
 * all, so it would answer nothing. Deriving from the rule is safe by construction: the rule
 * is what `compileTemplate` produced from those very functions.
 *
 * ─── A WAY IS NOT ONE SLOT, and that is the whole trap ────────────────────────
 *
 * With a second column configured — the compound guarantee has one — `emitMechanism` returns
 * the `pickByFact` id, so the members of `basis_combine` are `primary_pick`, `alt_pick`,
 * `alt__<fact>_pick`, and each pick spreads into as many COLUMNS as the product has branches.
 * FABMISR's compound program stores `alt` AND `alt__top_up`: one way, two columns. An
 * enforcement counting `stepParams` keys would refuse the one program that is already right.
 *
 * Lexical derivation is impossible for the same reason and it is worth stating, because it
 * is the obvious shortcut: `alt__unit_paid_to_date` is a way HEAD (the third and later ways
 * are named after the fact they read) while `alt__top_up` is a COLUMN of the `alt` way. The
 * two are indistinguishable as strings and only the rule says which is which.
 *
 * ─── EVERY PRODUCT OFFERS AT LEAST ONE WAY, AND A PROGRAM NAMES EXACTLY ONE ───
 *
 * A single-way product's way is its head (`primary`, or `primary_pick` behind a second
 * column). A `'combined'` product's heads are the TERMS of one way — the auto cross-sell's
 * "3 × the instalment or 10% of the loan, whichever is less" is one sentence a bank fills
 * both halves of — and fold into ONE way whose slots are the union. Only an `'exclusive'`
 * product lists rivals. So `waysOfRule(rule).length >= 2` is the whole test for "does this
 * program have a choice to make", and `length === 1` for "its one way is named for it".
 *
 * The EVALUATOR reads none of this. `emitBasis`'s `minOf(skipUnset)` + `coalesce` already
 * returns the filled way's figure, or the fold of a combined product's terms; `waysAre` and
 * `wayId` are read only where a save is refused and where the catalog's figures are pruned.
 * That is the property that makes the grouping safe to change without moving a quote.
 */

import { SLOT } from './product-template';
import type { ProductRule, RuleStep, StepParams, ValueRef } from './product-rule';
import { isStepConfigured } from './product-rule';

/** One way of reaching the figure, and every step id filed under it. */
export interface RuleWay {
  /**
   * The slot a bank's figures for this way hang off — `primary`, `alt`, `alt__<fact>`.
   *
   * Never the pick id: the pick states no figures, and the bare head is what has been stable
   * since the product shipped. This is what a bank program's `wayId` names.
   */
  id: string;
  /** The head, every column of it, and its pick. Everything this way owns. */
  slots: string[];
}

function refsOf(of: RuleStep['of']): readonly ValueRef[] {
  if (of === undefined) return [];
  return Array.isArray(of) ? of : [of];
}

function stepRefIds(step: RuleStep | undefined): string[] {
  if (step === undefined) return [];
  return refsOf(step.of).flatMap((ref) => ('step' in ref ? [ref.step] : []));
}

/**
 * Every way this rule offers, in the order the product declares them.
 *
 * MULTI-WAY: read off `basis` — the `coalesce` `emitBasis` always emits for two or more ways —
 * with `basis_combine` dropped, because that member is the COMPARISON between the ways and
 * not one of them. Reading `basis` rather than `basis_combine` covers both spellings in one
 * place: a product with no `combine` emits `coalesce [ ...ways ]` and no comparison at all.
 *
 * ONE WAY: `emitBasis` returns the single head directly and emits no `basis` step, so the way
 * IS the head — `primary_pick` when the product has a second column, else `primary`
 * (`waySlot(m, 0)` is `primary` unconditionally). Named rather than empty, because every
 * surrogate program records the way it sells and a one-way product has exactly one to record.
 * A rule naming no `primary` at all — a hand-wired pipeline — offers no way and is asked for
 * none.
 *
 * COMBINED: `waysAre: 'combined'` says the heads are TERMS of one method, not rivals. They
 * collapse to ONE way whose id is the first head's and whose slots are the UNION of every
 * head's. The union is load-bearing, not tidy: a program on `amounts: 'catalog'` inherits by
 * these slots, and the first head's slots alone would drop `alt` from the cross-sell and quote
 * 3 × the instalment with the 10% clamp silently gone.
 */
export function waysOfRule(rule: ProductRule): RuleWay[] {
  const steps = rule.steps ?? [];
  const byId = new Map(steps.map((step) => [step.id, step]));
  const basis = byId.get(SLOT.basis);

  const heads: string[] =
    basis !== undefined && basis.op === 'coalesce'
      ? stepRefIds(basis).filter((head) => head !== SLOT.basisCombine)
      : byId.has(SLOT.primaryPick)
        ? [SLOT.primaryPick]
        : byId.has(SLOT.primary)
          ? [SLOT.primary]
          : [];

  const ways: RuleWay[] = [];
  for (const head of heads) {
    const step = byId.get(head);
    if (step === undefined) continue;
    if (step.op !== 'pickByFact') {
      ways.push({ id: head, slots: [head] });
      continue;
    }
    // The FIRST column keeps the bare head id (`emitMechanism`), so it is the way's name.
    const columns = stepRefIds(step);
    const [first] = columns;
    if (first === undefined) continue;
    ways.push({ id: first, slots: [...columns, head] });
  }

  if (rule.waysAre === 'combined' && ways.length >= 2) {
    const [first] = ways;
    if (first === undefined) return ways;
    return [{ id: first.id, slots: [...new Set(ways.flatMap((way) => way.slots))] }];
  }
  return ways;
}

/**
 * Every step id one way owns, or an EMPTY set when the rule offers no such way.
 *
 * Empty rather than "everything" on an unknown id, so a caller that prunes by this cannot
 * silently keep the whole map when the way it was given has gone.
 */
export function wayOwnedSlots(rule: ProductRule, wayId: string): Set<string> {
  const way = waysOfRule(rule).find((one) => one.id === wayId);
  return new Set(way?.slots ?? []);
}

/** Every step id belonging to ANY way — what pruning to one way removes the rest of. */
export function allWaySlots(rule: ProductRule): Set<string> {
  return new Set(waysOfRule(rule).flatMap((way) => way.slots));
}

/**
 * Which of the product's ways this bank has actually put a figure into.
 *
 * A way counts as filled when ANY of its slots is — a two-column table filled on one column
 * only is still that way, sold to the customers that column is for.
 *
 * The check is `isStepConfigured` per slot rather than "the params map has this key": an
 * empty entry is a box nobody filled, and counting it would refuse an edit over nothing.
 */
export function filledWayIds(rule: ProductRule): string[] {
  const params = rule.stepParams ?? {};
  const byId = new Map((rule.steps ?? []).map((step) => [step.id, step]));
  return waysOfRule(rule)
    .filter((way) =>
      way.slots.some((slot) => {
        const step = byId.get(slot);
        // A pick states no figures of its own and `isStepConfigured` answers `true` for it
        // unconditionally, so asking it would report every way as filled.
        if (step === undefined || step.op === 'pickByFact') return false;
        return isStepConfigured(step, (params[slot] ?? {}) as StepParams);
      }),
    )
    .map((way) => way.id);
}
