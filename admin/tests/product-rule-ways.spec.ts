/**
 * One way per bank program, client side.
 *
 * Two things are pinned here, and both are ways the screen could silently disagree with the
 * server:
 *
 *   1. **A WAY IS NOT ONE SLOT.** A way whose table is split into columns renders as the
 *      `pickByFact`, and it OWNS its columns — FABMISR's compound program stores `alt` and
 *      `alt__top_up`, which is one way. A derivation that counted figure keys would put a red
 *      "figures under another way" on the one program that is already right. The split cannot
 *      be read off the strings either: `alt__unit_paid_to_date` is a way HEAD and
 *      `alt__top_up` is a COLUMN.
 *   2. **The mirror must not out-refuse the server.** `productRuleHasError` is the Save gate.
 *      Refusing something the API accepts is the worse direction — the operator is told their
 *      figures are unsavable and has nothing to fix (the v22.1.0 dead-Save bug).
 */
import { describe, expect, it } from 'vitest';
import {
  filledWayIds,
  wayIdByRow,
  wayOwnedSlots,
  waysAreExclusive,
  waysOfRule,
} from '../src/app/shared/income-rule/product-rule-ways';
import { productRuleHasError } from '../src/app/shared/income-rule/income-rule.rules';
import type { RuleStep, StepFigures } from '../src/app/features/bank-programs/bank-programs.types';

/**
 * The compound guarantee's shape: three ways, each split into two columns by whether the
 * loan is a top-up, folded with `minOf(skipUnset)` under a `coalesce` — plus a condition and
 * a source step, neither of which is a way.
 */
const COLUMNED: RuleStep[] = [
  { id: 'src__paid', op: 'factNumber', fact: 'paid' },
  { id: 'primary', op: 'factParentTable', fact: 'compound' },
  { id: 'primary__top_up', op: 'factParentTable', fact: 'compound' },
  {
    id: 'primary_pick',
    op: 'pickByFact',
    fact: 'loan_is_topup',
    of: [{ step: 'primary' }, { step: 'primary__top_up' }],
    branches: ['new_loan', 'top_up'],
  },
  { id: 'alt', op: 'bandTable', of: { step: 'src__paid' } },
  { id: 'alt__top_up', op: 'bandTable', of: { step: 'src__paid' } },
  {
    id: 'alt_pick',
    op: 'pickByFact',
    fact: 'loan_is_topup',
    of: [{ step: 'alt' }, { step: 'alt__top_up' }],
    branches: ['new_loan', 'top_up'],
  },
  { id: 'alt__paid', op: 'percentOf', of: { step: 'src__paid' } },
  { id: 'alt__paid__top_up', op: 'percentOf', of: { step: 'src__paid' } },
  {
    id: 'alt__paid_pick',
    op: 'pickByFact',
    fact: 'loan_is_topup',
    of: [{ step: 'alt__paid' }, { step: 'alt__paid__top_up' }],
    branches: ['new_loan', 'top_up'],
  },
  {
    id: 'basis_combine',
    op: 'minOf',
    of: [{ step: 'primary_pick' }, { step: 'alt_pick' }, { step: 'alt__paid_pick' }],
    skipUnset: true,
  },
  {
    id: 'basis',
    op: 'coalesce',
    of: [
      { step: 'basis_combine' },
      { step: 'primary_pick' },
      { step: 'alt_pick' },
      { step: 'alt__paid_pick' },
    ],
  },
];

/** Two ways, no columns, and no comparison — the shape a product with no `combine` emits. */
const PLAIN: RuleStep[] = [
  { id: 'src__inst', op: 'factNumber', fact: 'inst' },
  { id: 'primary', op: 'multiply', of: { step: 'src__inst' } },
  { id: 'alt', op: 'percentOf', of: { step: 'src__inst' } },
  { id: 'basis', op: 'coalesce', of: [{ step: 'primary' }, { step: 'alt' }] },
];

const bands: StepFigures = { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '1' }] };
const pct: StepFigures = { scalar: { value: '15', unit: 'percent' } };

describe('the ways a rule offers', () => {
  it('names them by the slot a bank files figures under, never by the pick', () => {
    expect(waysOfRule(COLUMNED).map((w) => w.id)).toEqual(['primary', 'alt', 'alt__paid']);
    expect(waysOfRule(PLAIN).map((w) => w.id)).toEqual(['primary', 'alt']);
  });

  it('drops the comparison, which is not one of the ways', () => {
    expect(waysOfRule(COLUMNED).some((w) => w.id === 'basis_combine')).toBe(false);
  });

  it('gives a way both its columns and its pick', () => {
    expect([...wayOwnedSlots(COLUMNED, 'alt')].sort()).toEqual(['alt', 'alt__top_up', 'alt_pick']);
  });

  it('does not confuse a way head named after a fact with a column named after a branch', () => {
    expect(wayOwnedSlots(COLUMNED, 'alt__paid').has('alt__top_up')).toBe(false);
    expect(waysOfRule(COLUMNED).some((w) => w.id === 'alt__top_up')).toBe(false);
  });

  it('claims nothing that is not a way', () => {
    const owned = new Set(waysOfRule(COLUMNED).flatMap((w) => w.slots));
    for (const slot of ['src__paid', 'basis', 'basis_combine']) expect(owned.has(slot)).toBe(false);
  });

  it('maps the EDITOR row to the way it is — the pick, when there is one', () => {
    expect([...wayIdByRow(COLUMNED)]).toEqual([
      ['primary_pick', 'primary'],
      ['alt_pick', 'alt'],
      ['alt__paid_pick', 'alt__paid'],
    ]);
    expect([...wayIdByRow(PLAIN)]).toEqual([
      ['primary', 'primary'],
      ['alt', 'alt'],
    ]);
  });

  it('finds no ways in a rule with one — which is why none can be chosen', () => {
    const single: RuleStep[] = [{ id: 'primary', op: 'constant' }];
    expect(waysOfRule(single)).toEqual([]);
    expect(waysAreExclusive('exclusive', single)).toBe(false);
  });

  it('reads an absent flag as combined, which is what every other product means', () => {
    expect(waysAreExclusive(null, COLUMNED)).toBe(false);
    expect(waysAreExclusive('exclusive', COLUMNED)).toBe(true);
  });
});

describe('which ways hold figures', () => {
  it('counts one column as the whole way', () => {
    expect(filledWayIds(COLUMNED, { alt: bands })).toEqual(['alt']);
    expect(filledWayIds(COLUMNED, { alt: bands, alt__top_up: bands })).toEqual(['alt']);
  });

  it('never reads a pick as filled — it states no figures of its own', () => {
    expect(filledWayIds(COLUMNED, { alt_pick: {}, primary_pick: {} })).toEqual([]);
  });

  it('ignores an empty box', () => {
    expect(filledWayIds(COLUMNED, { alt: {}, primary: { keyTable: [] } })).toEqual([]);
  });
});

describe('the Save gate mirrors the server, and no further', () => {
  const figures = { alt: bands, alt__top_up: bands };

  it('accepts one way filled across two columns', () => {
    expect(
      productRuleHasError({
        steps: COLUMNED,
        gates: [],
        figures,
        waysAre: 'exclusive',
        wayId: 'alt',
      }),
    ).toBe(false);
  });

  it('refuses a program that has not picked a way', () => {
    expect(
      productRuleHasError({
        steps: COLUMNED,
        gates: [],
        figures,
        waysAre: 'exclusive',
        wayId: null,
      }),
    ).toBe(true);
  });

  it('refuses figures under a way the program does not sell', () => {
    expect(
      productRuleHasError({
        steps: COLUMNED,
        gates: [],
        figures: { alt: bands, alt__paid: pct },
        waysAre: 'exclusive',
        wayId: 'alt',
      }),
    ).toBe(true);
  });

  it('refuses a way id the product does not offer', () => {
    expect(
      productRuleHasError({
        steps: COLUMNED,
        gates: [],
        figures,
        waysAre: 'exclusive',
        wayId: 'alt__nothing',
      }),
    ).toBe(true);
  });

  it('asks nothing of a product whose ways combine, even with two filled', () => {
    // App. A §4 fills both on purpose. Out-refusing here would disable Save on both live
    // ABK cross-sell programs.
    expect(
      productRuleHasError({
        steps: PLAIN,
        gates: [],
        figures: { primary: { scalar: { value: '3', unit: 'multiplier' } }, alt: pct },
      }),
    ).toBe(false);
  });

  it('asks nothing when the caller states no way at all — every existing caller', () => {
    expect(productRuleHasError({ steps: PLAIN, gates: [], figures: { primary: pct } })).toBe(false);
  });
});
