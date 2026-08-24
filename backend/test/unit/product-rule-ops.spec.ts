/**
 * The product-rule op registry — one test per op, plus the four miss reasons.
 *
 * Everything here is pure arithmetic over a fact bag; nothing touches money policy.
 * The point of the suite is that a product assembled from these ops can only ever
 * produce a figure or a STATED reason — never a substituted zero (FR-020).
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  evaluateProductRule,
  factsReadBy,
  paramKeysOf,
  type ProductRule,
  type ProductRuleContext,
} from '../../src/matching/pipeline/product-rule';
import type { SurrogateFactValue } from '../../src/matching/types';

const num = (value: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(value) });
const pick = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });

function ctx(
  facts: Record<string, SurrogateFactValue>,
  parentKeyByValue?: Record<string, string>,
): ProductRuleContext {
  return parentKeyByValue ? { facts, parentKeyByValue } : { facts };
}

function income(steps: ProductRule['steps'], stepParams: ProductRule['stepParams'], from: string): ProductRule {
  return { strategy: 'steps', steps, stepParams, output: { kind: 'monthlyIncome', from } };
}

describe('product rule — ops', () => {
  it('constant returns the bank figure', () => {
    const rule = income([{ id: 'cap', op: 'constant' }], { cap: { valueEGP: '4500000' } }, 'cap');
    const out = evaluateProductRule(rule, ctx({}));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('4500000');
  });

  it('factNumber passes a numeric answer through exactly — no bucketing', () => {
    const rule = income([{ id: 'price', op: 'factNumber', fact: 'unit_price' }], {}, 'price');
    const out = evaluateProductRule(rule, ctx({ unit_price: num('3000000.55') }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('3000000.55');
  });

  it('factChoiceTable reads the picked option code', () => {
    const rule = income(
      [{ id: 'cap', op: 'factChoiceTable', fact: 'unit_type' }],
      { cap: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }, { key: 'villa', incomeEGP: '4000000' }] } },
      'cap',
    );
    const out = evaluateProductRule(rule, ctx({ unit_type: pick('villa') }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.valueEGP.toString()).toBe('4000000');
      expect(out.matchedRow).toEqual({ key: 'villa' });
    }
  });

  it('factParentTable maps the picked value to its registry parent', () => {
    const rule = income(
      [{ id: 'cap', op: 'factParentTable', fact: 'compound_name' }],
      { cap: { keyTable: [{ key: 'compound_class_a', incomeEGP: '6000000' }, { key: 'compound_class_c', incomeEGP: '2000000' }] } },
      'cap',
    );
    const out = evaluateProductRule(
      rule,
      ctx({ compound_name: pick('mivida') }, { mivida: 'compound_class_a' }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('6000000');
  });

  it('factParentTable reports no_matching_row for a value filed under no parent', () => {
    const rule = income(
      [{ id: 'cap', op: 'factParentTable', fact: 'compound_name' }],
      { cap: { keyTable: [{ key: 'compound_class_c', incomeEGP: '2000000' }] } },
      'cap',
    );
    const out = evaluateProductRule(rule, ctx({ compound_name: pick('unfiled') }, { mivida: 'compound_class_a' }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('no_matching_row');
  });

  it('bandTable finds the half-open band a computed value falls in', () => {
    const rule = income(
      [
        { id: 'dpAmount', op: 'factNumber', fact: 'dp_amount' },
        { id: 'cap', op: 'bandTable', of: { step: 'dpAmount' } },
      ],
      {
        cap: {
          bands: [
            { fromInclusive: '250000', toExclusive: '500000', incomeEGP: '750000' },
            { fromInclusive: '500000', toExclusive: '1000000', incomeEGP: '1000000' },
            { fromInclusive: '1000000', toExclusive: null, incomeEGP: '1500000' },
          ],
        },
      },
      'cap',
    );
    const out = evaluateProductRule(rule, ctx({ dp_amount: num('600000') }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('1000000');
  });

  it('bandTable BELOW the first edge is a stated miss, never the top row (source bug #1)', () => {
    const rule = income(
      [
        { id: 'dpAmount', op: 'factNumber', fact: 'dp_amount' },
        { id: 'cap', op: 'bandTable', of: { step: 'dpAmount' } },
      ],
      {
        cap: {
          bands: [
            { fromInclusive: '250000', toExclusive: '500000', incomeEGP: '750000' },
            { fromInclusive: '1500000', toExclusive: null, incomeEGP: '1500000' },
          ],
        },
      },
      'cap',
    );
    const out = evaluateProductRule(rule, ctx({ dp_amount: num('150000') }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('no_matching_band');
  });

  it('percentOf, upliftPercent and multiply', () => {
    const build = (op: 'percentOf' | 'upliftPercent' | 'multiply', value: string): ProductRule =>
      income(
        [
          { id: 'base', op: 'constant' },
          { id: 'out', op, of: { step: 'base' } },
        ],
        { base: { valueEGP: '1000000' }, out: { scalar: { value, unit: op === 'multiply' ? 'multiplier' : 'percent' } } },
        'out',
      );

    const pct = evaluateProductRule(build('percentOf', '50'), ctx({}));
    const uplift = evaluateProductRule(build('upliftPercent', '10'), ctx({}));
    const mult = evaluateProductRule(build('multiply', '4'), ctx({}));

    expect(pct.ok && pct.valueEGP.toString()).toBe('500000');
    expect(uplift.ok && uplift.valueEGP.toString()).toBe('1100000');
    expect(mult.ok && mult.valueEGP.toString()).toBe('4000000');
  });

  it('sum, subtract, minOf and maxOf', () => {
    const rule = income(
      [
        { id: 'a', op: 'constant' },
        { id: 'b', op: 'constant' },
        { id: 'sum', op: 'sum', of: [{ step: 'a' }, { step: 'b' }] },
        { id: 'diff', op: 'subtract', of: [{ step: 'a' }, { step: 'b' }] },
        { id: 'lo', op: 'minOf', of: [{ step: 'a' }, { step: 'b' }] },
        { id: 'hi', op: 'maxOf', of: [{ step: 'a' }, { step: 'b' }] },
      ],
      { a: { valueEGP: '300' }, b: { valueEGP: '700' } },
      'sum',
    );

    for (const [from, expected] of [
      ['sum', '1000'],
      ['diff', '-400'],
      ['lo', '300'],
      ['hi', '700'],
    ] as const) {
      const out = evaluateProductRule({ ...rule, output: { kind: 'monthlyIncome', from } }, ctx({}));
      expect(out.ok && out.valueEGP.toString(), from).toBe(expected);
    }
  });

  it('subtract does NOT floor at zero — the rule author clamps with maxOf', () => {
    const rule = income(
      [
        { id: 'a', op: 'constant' },
        { id: 'b', op: 'constant' },
        { id: 'diff', op: 'subtract', of: [{ step: 'a' }, { step: 'b' }] },
        { id: 'zero', op: 'constant' },
        { id: 'clamped', op: 'maxOf', of: [{ step: 'diff' }, { step: 'zero' }] },
      ],
      { a: { valueEGP: '100' }, b: { valueEGP: '400' }, zero: { valueEGP: '0' } },
      'clamped',
    );
    const out = evaluateProductRule(rule, ctx({}));
    expect(out.ok && out.valueEGP.toString()).toBe('0');
  });
});

describe('product rule — misses', () => {
  const capOnUnitType = (): ProductRule =>
    income(
      [{ id: 'cap', op: 'factChoiceTable', fact: 'unit_type' }],
      { cap: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] } },
      'cap',
    );

  it('fact_not_answered names the fact', () => {
    const out = evaluateProductRule(capOnUnitType(), ctx({}));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe('fact_not_answered');
      expect(out.factKey).toBe('unit_type');
      expect(out.stepId).toBe('cap');
    }
  });

  it('no_matching_row when the answer has no row', () => {
    const out = evaluateProductRule(capOnUnitType(), ctx({ unit_type: pick('twin_house') }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('no_matching_row');
  });

  it('rule_unconfigured when the bank never filled the table in', () => {
    const rule = income([{ id: 'cap', op: 'factChoiceTable', fact: 'unit_type' }], {}, 'cap');
    const out = evaluateProductRule(rule, ctx({ unit_type: pick('apartment') }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('rule_unconfigured');
  });

  it('a forward step reference fails closed rather than reading zero', () => {
    const rule = income(
      [
        { id: 'first', op: 'multiply', of: { step: 'later' } },
        { id: 'later', op: 'constant' },
      ],
      { later: { valueEGP: '10' }, first: { scalar: { value: '2', unit: 'multiplier' } } },
      'first',
    );
    const out = evaluateProductRule(rule, ctx({}));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('rule_unconfigured');
  });

  it('an empty rule and a missing output are rule_unconfigured, not a zero', () => {
    expect(evaluateProductRule({ strategy: 'steps' }, ctx({})).ok).toBe(false);
    const orphan = income([{ id: 'cap', op: 'constant' }], { cap: { valueEGP: '1' } }, 'nope');
    const out = evaluateProductRule(orphan, ctx({}));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.stepId).toBe('nope');
  });
});

describe('product rule — gates', () => {
  const withGate = (gate: NonNullable<ProductRule['gates']>[number], params: ProductRule['stepParams']): ProductRule => ({
    strategy: 'steps',
    steps: [
      { id: 'price', op: 'factNumber', fact: 'unit_price' },
      { id: 'dpPct', op: 'factNumber', fact: 'dp_pct' },
      { id: 'dpAmount', op: 'percentOf', of: { step: 'price' } },
    ],
    stepParams: { dpAmount: { scalar: { value: '20', unit: 'percent' } }, ...params },
    gates: [gate],
    output: { kind: 'maxAmount', from: 'dpAmount' },
  });

  it('a number gate passes above its floor and refuses below it', () => {
    const rule = withGate(
      { id: 'dpFloor', kind: 'number', op: 'gte', left: { step: 'dpAmount' }, reasonCode: 'DOWN_PAYMENT_BELOW_MIN' },
      { dpFloor: { minValue: '250000' } },
    );
    const facts = { unit_price: num('3000000'), dp_pct: num('20') };
    const pass = evaluateProductRule(rule, ctx(facts));
    expect(pass.ok).toBe(true);
    if (pass.ok) expect(pass.gates).toEqual([{ id: 'dpFloor', reasonCode: 'DOWN_PAYMENT_BELOW_MIN', passed: true }]);

    const low = evaluateProductRule(rule, ctx({ unit_price: num('1000000'), dp_pct: num('20') }));
    expect(low.ok).toBe(false);
    if (!low.ok) {
      expect(low.reason).toBe('gate_failed');
      expect(low.gateReasonCode).toBe('DOWN_PAYMENT_BELOW_MIN');
      // The step trace survives a refusal, so the check panel can show the figures — and
      // carries only the steps this configuration READS. `dpPct` is in the list but nothing
      // reads it here (`dpAmount` scales `price` by the bank's own scalar), so it is not
      // evaluated and cannot demand its fact on a bank's behalf.
      expect(low.steps.map((s) => s.id)).toEqual(['price', 'dpAmount']);
    }
  });

  it('does not demand a fact for a step only an UNCONFIGURED gate would read', () => {
    // The compound frame's real failure: `monthsOwned` is read only by the two
    // ownership-duration gates, and a bank that turns on neither still made every applicant
    // answer the optional question the step reads — so one skipped answer refused all five
    // programs, including the ones that never look at it.
    const rule: ProductRule = {
      strategy: 'steps',
      steps: [
        { id: 'cap', op: 'constant' },
        { id: 'monthsOwned', op: 'factNumber', fact: 'months_owned' },
      ],
      stepParams: { cap: { valueEGP: '500000' } },
      gates: [
        {
          id: 'ownedFor',
          kind: 'number',
          op: 'gte',
          left: { step: 'monthsOwned' },
          reasonCode: 'CONTRACT_TOO_NEW',
        },
      ],
      output: { kind: 'maxAmount', from: 'cap' },
    };

    // The gate carries no figure, so the step it reads is never evaluated and the missing
    // answer costs nothing.
    const off = evaluateProductRule(rule, ctx({}));
    expect(off.ok).toBe(true);
    if (off.ok) expect(off.steps.map((s) => s.id)).toEqual(['cap']);

    // A bank that DOES state the requirement still demands the answer.
    const on = evaluateProductRule(
      { ...rule, stepParams: { ...rule.stepParams, ownedFor: { minValue: '18' } } },
      ctx({}),
    );
    expect(on.ok).toBe(false);
    if (!on.ok) expect(on.reason).toBe('fact_not_answered');
  });

  it('numberByKey compares against the bank row for another answer', () => {
    const rule = withGate(
      {
        id: 'priceFloor',
        kind: 'numberByKey',
        op: 'gte',
        left: { step: 'price' },
        keyedBy: 'contract_year',
        reasonCode: 'UNIT_PRICE_BELOW_MIN',
      },
      {
        priceFloor: {
          keyTable: [
            { key: '2024', incomeEGP: '3000000' },
            { key: 'before2021', incomeEGP: '1000000' },
          ],
        },
      },
    );
    const base = { unit_price: num('2000000'), dp_pct: num('20') };
    const old = evaluateProductRule(rule, ctx({ ...base, contract_year: pick('before2021') }));
    const recent = evaluateProductRule(rule, ctx({ ...base, contract_year: pick('2024') }));
    expect(old.ok).toBe(true);
    expect(recent.ok).toBe(false);
    if (!recent.ok) expect(recent.gateReasonCode).toBe('UNIT_PRICE_BELOW_MIN');
  });

  it('a choice gate compares option codes, and neq inverts it', () => {
    const rule = withGate(
      {
        id: 'bestUnit',
        kind: 'choice',
        op: 'eq',
        fact: 'best_unit_confirmed',
        expect: ['yes'],
        reasonCode: 'MULTI_UNIT_NOT_CONFIRMED',
      },
      // `applies: true` — a choice gate has no figure of its own, so this IS the bank
      // turning it on. Without it the catalog's condition is offered and not applied.
      { bestUnit: { applies: true } },
    );
    const base = { unit_price: num('3000000'), dp_pct: num('20') };
    expect(evaluateProductRule(rule, ctx({ ...base, best_unit_confirmed: pick('yes') })).ok).toBe(true);
    expect(evaluateProductRule(rule, ctx({ ...base, best_unit_confirmed: pick('unconfirmed') })).ok).toBe(false);
  });

  it('an unanswered gate fact is fact_not_answered, not a refusal', () => {
    const gate = {
      id: 'bestUnit',
      kind: 'choice' as const,
      op: 'eq' as const,
      fact: 'best_unit_confirmed',
      expect: ['yes'],
      reasonCode: 'MULTI_UNIT_NOT_CONFIRMED' as const,
    };
    const answers = { unit_price: num('3000000'), dp_pct: num('20') };

    const applied = evaluateProductRule(withGate(gate, { bestUnit: { applies: true } }), ctx(answers));
    expect(applied.ok).toBe(false);
    if (!applied.ok) {
      expect(applied.reason).toBe('fact_not_answered');
      expect(applied.factKey).toBe('best_unit_confirmed');
    }

    // The SAME missing answer on a bank that did not turn the gate on is not a problem at
    // all: the condition is the catalog's offer, not this bank's policy.
    expect(evaluateProductRule(withGate(gate, {}), ctx(answers)).ok).toBe(true);
  });
});

describe('product rule — derived metadata', () => {
  const rule: ProductRule = {
    strategy: 'steps',
    steps: [
      { id: 'price', op: 'factNumber', fact: 'unit_price' },
      { id: 'cap', op: 'factChoiceTable', fact: 'unit_type' },
      { id: 'ceiling', op: 'minOf', of: [{ step: 'cap' }, { fact: 'other_cap' }, { const: '9' }] },
    ],
    gates: [
      { id: 'g1', kind: 'choice', op: 'eq', fact: 'joint_unit', expect: ['no'], reasonCode: 'OWNERSHIP_NOT_CONFIRMED' },
      {
        id: 'g2',
        kind: 'numberByKey',
        op: 'gte',
        left: { fact: 'unit_price' },
        keyedBy: 'contract_year',
        reasonCode: 'UNIT_PRICE_BELOW_MIN',
      },
    ],
    output: { kind: 'maxAmount', from: 'ceiling' },
  };

  it('factsReadBy walks steps, refs and gates — and dedupes', () => {
    expect(factsReadBy(rule).sort()).toEqual(
      ['contract_year', 'joint_unit', 'other_cap', 'unit_price', 'unit_type'].sort(),
    );
  });

  it('paramKeysOf is the legal stepParams key set — steps AND gates', () => {
    expect(paramKeysOf(rule)).toEqual(['price', 'cap', 'ceiling', 'g1', 'g2']);
  });
});

describe('product rule — a factor read from an answer', () => {
  it('percentOf takes its percentage from a SECOND input when the step names one', () => {
    // The compound down payment: the CUSTOMER'S percentage of the CUSTOMER'S price. No bank
    // figure exists for it, which is why a params-only factor could not express it.
    const rule = income(
      [
        { id: 'price', op: 'factNumber', fact: 'unit_price' },
        { id: 'pct', op: 'factNumber', fact: 'dp_pct' },
        { id: 'dpAmount', op: 'percentOf', of: [{ step: 'price' }, { step: 'pct' }] },
      ],
      {},
      'dpAmount',
    );
    const out = evaluateProductRule(rule, ctx({ unit_price: num('3000000'), dp_pct: num('20') }));
    expect(out.ok && out.valueEGP.toString()).toBe('600000');
  });

  it('a second input WINS over a stated scalar — the two are never combined', () => {
    const rule = income(
      [
        { id: 'base', op: 'constant' },
        { id: 'factor', op: 'constant' },
        { id: 'out', op: 'multiply', of: [{ step: 'base' }, { step: 'factor' }] },
      ],
      {
        base: { valueEGP: '1000' },
        factor: { valueEGP: '3' },
        out: { scalar: { value: '99', unit: 'multiplier' } },
      },
      'out',
    );
    expect(evaluateProductRule(rule, ctx({})).ok && '3000').toBe('3000');
    const out = evaluateProductRule(rule, ctx({}));
    expect(out.ok && out.valueEGP.toString()).toBe('3000');
  });

  it('an unanswered factor is a stated miss, not a silent fall-back to the scalar', () => {
    const rule = income(
      [
        { id: 'price', op: 'factNumber', fact: 'unit_price' },
        { id: 'dpAmount', op: 'percentOf', of: [{ step: 'price' }, { fact: 'dp_pct' }] },
      ],
      { dpAmount: { scalar: { value: '20', unit: 'percent' } } },
      'dpAmount',
    );
    const out = evaluateProductRule(rule, ctx({ unit_price: num('3000000') }));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.reason).toBe('fact_not_answered');
      expect(out.factKey).toBe('dp_pct');
    }
  });
});

describe('product rule — coalesce (the bank picks its derivation)', () => {
  /** The shared compound frame: three cap derivations, one chosen per bank. */
  const frame = (stepParams: NonNullable<ProductRule['stepParams']>): ProductRule => ({
    strategy: 'steps',
    steps: [
      { id: 'price', op: 'factNumber', fact: 'unit_price' },
      { id: 'dpPct', op: 'factNumber', fact: 'dp_pct' },
      { id: 'dpAmount', op: 'percentOf', of: [{ step: 'price' }, { step: 'dpPct' }] },
      { id: 'capByType', op: 'factChoiceTable', fact: 'unit_type' },
      { id: 'capByBand', op: 'bandTable', of: { step: 'dpAmount' } },
      { id: 'capByPercent', op: 'percentOf', of: { step: 'dpAmount' } },
      {
        id: 'capBasis',
        op: 'coalesce',
        of: [{ step: 'capByType' }, { step: 'capByBand' }, { step: 'capByPercent' }],
      },
    ],
    stepParams,
    output: { kind: 'maxAmount', from: 'capBasis' },
  });

  const applicant = ctx({
    unit_price: num('3000000'),
    dp_pct: num('20'),
    unit_type: pick('apartment'),
  });

  it('takes the one derivation the bank configured', () => {
    const byType = evaluateProductRule(
      frame({ capByType: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] } }),
      applicant,
    );
    expect(byType.ok && byType.valueEGP.toString()).toBe('2000000');

    const byBand = evaluateProductRule(
      frame({
        capByBand: {
          bands: [
            { fromInclusive: '250000', toExclusive: '1000000', incomeEGP: '1000000' },
            { fromInclusive: '1000000', toExclusive: null, incomeEGP: '1500000' },
          ],
        },
      }),
      applicant,
    );
    expect(byBand.ok && byBand.valueEGP.toString()).toBe('1000000');

    const byPercent = evaluateProductRule(
      frame({ capByPercent: { scalar: { value: '50', unit: 'percent' } } }),
      applicant,
    );
    expect(byPercent.ok && byPercent.valueEGP.toString()).toBe('300000');
  });

  it('does NOT ask for an answer a declined derivation would have needed', () => {
    // No `unit_type` answer at all. A bank on the percent derivation must still quote: the
    // unit-type step is unconfigured, so it never reads the fact.
    const out = evaluateProductRule(
      frame({ capByPercent: { scalar: { value: '50', unit: 'percent' } } }),
      ctx({ unit_price: num('3000000'), dp_pct: num('20') }),
    );
    expect(out.ok && out.valueEGP.toString()).toBe('300000');
  });

  it('a CONFIGURED derivation that cannot resolve stops the rule — no falling through', () => {
    // The bank sells on unit type and the applicant's type has no row. Falling through to
    // the percent derivation would price them off a rule this bank does not sell.
    const out = evaluateProductRule(
      frame({
        capByType: { keyTable: [{ key: 'villa', incomeEGP: '4000000' }] },
        capByPercent: { scalar: { value: '50', unit: 'percent' } },
      }),
      applicant,
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('no_matching_row');
  });

  it('every derivation blank is rule_unconfigured, never a zero', () => {
    const out = evaluateProductRule(frame({}), applicant);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('rule_unconfigured');
  });

  it('an unset step read by anything OTHER than a coalesce fails closed', () => {
    const rule: ProductRule = {
      strategy: 'steps',
      steps: [
        { id: 'blank', op: 'constant' },
        { id: 'doubled', op: 'multiply', of: { step: 'blank' } },
      ],
      stepParams: { doubled: { scalar: { value: '2', unit: 'multiplier' } } },
      output: { kind: 'monthlyIncome', from: 'doubled' },
    };
    const out = evaluateProductRule(rule, ctx({}));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('rule_unconfigured');
  });
});

describe('product rule — pickByFact (a second column)', () => {
  const twoColumns = (params: ProductRule['stepParams']): ProductRule =>
    income(
      [
        { id: 'standard', op: 'factChoiceTable', fact: 'unit_type' },
        { id: 'topUp', op: 'factChoiceTable', fact: 'unit_type' },
        {
          id: 'cap',
          op: 'pickByFact',
          fact: 'bank_relationship',
          branches: ['ntb', 'xsell'],
          of: [{ step: 'standard' }, { step: 'topUp' }],
        },
      ],
      params,
      'cap',
    );

  const BOTH = {
    standard: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] },
    topUp: { keyTable: [{ key: 'apartment', incomeEGP: '3000000' }] },
  };

  it('reads the column the answer names', () => {
    const out = evaluateProductRule(
      twoColumns(BOTH),
      ctx({ unit_type: pick('apartment'), bank_relationship: pick('xsell') }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('3000000');
  });

  it('reads the first column for the other answer', () => {
    const out = evaluateProductRule(
      twoColumns(BOTH),
      ctx({ unit_type: pick('apartment'), bank_relationship: pick('ntb') }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('2000000');
  });

  it('falls back to the first CONFIGURED column when this bank sells no second one', () => {
    // The bank stated one column and an applicant arrives on the other branch. A refusal here
    // would punish the customer for a product the bank simply does not offer.
    const out = evaluateProductRule(
      twoColumns({ standard: BOTH.standard }),
      ctx({ unit_type: pick('apartment'), bank_relationship: pick('xsell') }),
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('2000000');
  });

  it('falls back to the first column when the fact was not answered', () => {
    // The question behind a segment is optional. An unanswered one is NOT `fact_not_answered`
    // here: it means "quote them as a new customer", which is the honest default.
    const out = evaluateProductRule(twoColumns(BOTH), ctx({ unit_type: pick('apartment') }));
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.valueEGP.toString()).toBe('2000000');
  });

  it('is unset — not a refusal — when the bank configured neither column', () => {
    // Which is what lets an outer `coalesce` move on to this bank's real derivation.
    const out = evaluateProductRule(twoColumns({}), ctx({ unit_type: pick('apartment') }));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('rule_unconfigured');
  });

  it('a CONFIGURED column that cannot resolve still stops the rule', () => {
    // The bank's table has no row for this answer. Falling through to the other column would
    // quote a figure the bank never stated for this unit.
    const out = evaluateProductRule(
      twoColumns(BOTH),
      ctx({ unit_type: pick('duplex'), bank_relationship: pick('xsell') }),
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe('no_matching_row');
  });

  it('reports the fact it reads, so the missing-answers list can name it', () => {
    expect(factsReadBy(twoColumns(BOTH))).toContain('bank_relationship');
  });
});

describe('product rule — a gate compares two ANSWERS', () => {
  it('walks the right-hand side when reporting the facts a rule reads', () => {
    // A fact reachable only from a gate's right side used to be invisible to `factsReadBy`,
    // which both hid it from `missingFactKeys` and let it pass the save-time availability
    // check unseen.
    const rule: ProductRule = {
      strategy: 'steps',
      steps: [{ id: 'paid', op: 'factNumber', fact: 'paid_amount' }],
      gates: [
        {
          id: 'paidOverAsk',
          kind: 'number',
          op: 'gte',
          left: { step: 'paid' },
          right: { fact: 'requested_amount' },
          reasonCode: 'GATE_NOT_MET',
        },
      ],
      stepParams: {},
      output: { kind: 'monthlyIncome', from: 'paid' },
    };
    expect(factsReadBy(rule)).toContain('requested_amount');
  });
});
