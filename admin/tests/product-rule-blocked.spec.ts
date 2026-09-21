/**
 * The client-side mirror of the server's product-rule refusals.
 *
 * Both cases here are ones where the mirror used to out-refuse the server — it disabled Save
 * on a rule the engine quotes correctly, which is the worst direction for a mirror to be
 * wrong in: the operator is told their figures are unsavable and has nothing to fix. The
 * server carries the identical corrections in `validateProductRule`.
 */
import { describe, expect, it } from 'vitest';
import { productRuleHasError } from '../src/app/shared/income-rule/income-rule.rules';
import type { RuleStep, StepFigures } from '../src/app/features/bank-programs/bank-programs.types';

const NO_FIGURES: Record<string, StepFigures> = {};

describe('productRuleHasError', () => {
  it('accepts a coalesce whose blank step sits beside a literal', () => {
    // The I-Score shape every blueprint-built product carries: no band table means the
    // factor falls back to 100%, so the list is not empty — the literal always resolves.
    const steps: RuleStep[] = [
      { id: 'basis', op: 'constant' },
      { id: 'iscore_band', op: 'bandTable', of: { step: 'basis' } },
      { id: 'iscore_factor', op: 'coalesce', of: [{ step: 'iscore_band' }, { const: '100' }] },
      { id: 'out', op: 'percentOf', of: [{ step: 'basis' }, { step: 'iscore_factor' }] },
    ];
    expect(
      productRuleHasError({ steps, gates: [], figures: { basis: { valueEGP: '1000' } } }),
    ).toBe(false);
  });

  it('still refuses a coalesce whose every candidate is a blank step', () => {
    const steps: RuleStep[] = [
      { id: 'a', op: 'factChoiceTable', fact: 'x' },
      { id: 'b', op: 'factChoiceTable', fact: 'y' },
      { id: 'basis', op: 'coalesce', of: [{ step: 'a' }, { step: 'b' }] },
    ];
    expect(productRuleHasError({ steps, gates: [], figures: NO_FIGURES })).toBe(true);
  });

  it('reads a pick as reaching a figure only through a filled column', () => {
    const steps: RuleStep[] = [
      { id: 'a', op: 'factChoiceTable', fact: 'x' },
      { id: 'b', op: 'factChoiceTable', fact: 'x' },
      {
        id: 'pick',
        op: 'pickByFact',
        fact: 'rel',
        branches: ['ntb', 'xsell'],
        of: [{ step: 'a' }, { step: 'b' }],
      },
      { id: 'basis', op: 'coalesce', of: [{ step: 'pick' }] },
    ];
    // A pick states no figures of its own, so it reads as configured — without the recursion
    // the empty columns beneath it would pass unnoticed.
    expect(productRuleHasError({ steps, gates: [], figures: NO_FIGURES })).toBe(true);
    expect(
      productRuleHasError({
        steps,
        gates: [],
        figures: { a: { keyTable: [{ key: 'villa', incomeEGP: '10' }] } },
      }),
    ).toBe(false);
  });
});

describe('band tables are judged by their SHAPE, not just their presence', () => {
  // The fixture was the four compiled I-Score steps until v30.3.0, because that slot was the
  // only one `coverAll` applied to. It is a plain band slot now: no STEP demands total
  // coverage any more, and the tier table that does is program-level policy checked by the
  // wizard's own `iScoreTiersError` (and by `incomeBandsErrorFor`'s own spec).
  const STEPS: RuleStep[] = [
    { id: 'basis', op: 'constant' },
    { id: 'share_band', op: 'bandTable', of: { step: 'basis' } },
    { id: 'share_factor', op: 'coalesce', of: [{ step: 'share_band' }, { const: '100' }] },
    { id: 'out', op: 'percentOf', of: [{ step: 'basis' }, { step: 'share_factor' }] },
  ];
  const FILLED: StepFigures = { valueEGP: '1000' };
  const tiers = (rows: Array<[string, string | null, string]>): StepFigures => ({
    bands: rows.map(([fromInclusive, toExclusive, incomeEGP]) => ({
      fromInclusive,
      toExclusive,
      incomeEGP,
    })),
  });

  it('accepts a well-formed range table', () => {
    expect(
      productRuleHasError({
        steps: STEPS,
        gates: [],
        figures: {
          basis: FILLED,
          share_band: tiers([
            ['0', '550', '80'],
            ['550', '700', '100'],
            ['700', null, '110'],
          ]),
        },
      }),
    ).toBe(false);
  });

  it('refuses a figure left blank, which the server answers INCOME_RULE_INCOME_INVALID', () => {
    // Found by clearing one box in a browser: the row had figures, so `stepIsConfigured` read
    // it as configured, Continue stayed enabled and the refusal arrived three steps later.
    expect(
      productRuleHasError({
        steps: STEPS,
        gates: [],
        figures: { basis: FILLED, share_band: tiers([['0', null, '']]) },
      }),
    ).toBe(true);
  });

  it('does NOT demand total coverage of a step band table', () => {
    // The inversion this file used to assert. On a STEP, a value past the end is
    // `no_matching_band` — a stated reason the customer is told — so a table that starts
    // above zero or closes its top is legal. Only the I-SCORE tier table must answer every
    // value, because its figure multiplies rather than supplies, and that table is no longer
    // a step: it is checked by `iScoreTiersError` on the wizard's Requirements step.
    expect(
      productRuleHasError({
        steps: STEPS,
        gates: [],
        figures: { basis: FILLED, share_band: tiers([['550', null, '100']]) },
      }),
    ).toBe(false);
    expect(
      productRuleHasError({
        steps: STEPS,
        gates: [],
        figures: { basis: FILLED, share_band: tiers([['0', '900', '100']]) },
      }),
    ).toBe(false);
  });

  it('leaves an EMPTY band table alone — an optional slot this bank has not filled', () => {
    expect(
      productRuleHasError({ steps: STEPS, gates: [], figures: { basis: FILLED } }),
    ).toBe(false);
  });

  it('does not demand total coverage of an ordinary range table', () => {
    // A years table closing its top band is legal and common.
    const years: RuleStep[] = [
      { id: 'src__years', op: 'factNumber', fact: 'years_in_practice' },
      { id: 'primary', op: 'bandTable', of: { step: 'src__years' } },
    ];
    expect(
      productRuleHasError({
        steps: years,
        gates: [],
        figures: {
          primary: tiers([
            ['3', '5', '12000'],
            ['5', '8', '30000'],
          ]),
        },
      }),
    ).toBe(false);
  });
});
