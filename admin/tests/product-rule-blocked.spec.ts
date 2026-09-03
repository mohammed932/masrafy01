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
