/**
 * The friendly form, and the calculation it compiles to.
 *
 * Two invariants are pinned here, and they are the two that decide whether the layer is
 * safe to put in front of live money:
 *
 *   1. Every starter shape compiles to a rule the EXISTING save-time validation accepts,
 *      with no change to that validation. If a shape needed the validator relaxed, the
 *      form would be authoring rules the rest of the platform does not trust.
 *   2. Step ids are a function of the SHAPE. A bank's figures and its estimate markers are
 *      keyed by them, so an id that moves when the form is edited is a number that
 *      disappears while the program still reads as configured.
 */
import { describe, expect, it } from 'vitest';
import {
  I_SCORE_FACT_KEY,
  SLOT,
  compileTemplate,
  sourceSlot,
  templateParamKeys,
  validateTemplate,
  type ProductTemplate,
} from '@/matching/pipeline/product-template';
import { evaluateProductRule, paramKeysOf } from '@/matching/pipeline/product-rule';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import type { SurrogateFactValue } from '@/matching/types';
import { Decimal } from '@prisma/client/runtime/library';

const base = (over: Partial<ProductTemplate> = {}): ProductTemplate => ({
  version: 1,
  outputKind: 'monthlyIncome',
  primary: { kind: 'choiceTable', fact: 'military_grade' },
  conditions: [],
  ...over,
});

const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });
const numeric = (value: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(value) });

const withFigures = (rule: ProductRule, stepParams: ProductRule['stepParams']): ProductRule => ({
  ...rule,
  stepParams,
});

describe('the shape decides the ids', () => {
  it('names the one derivation `primary`, and that is where the figures hang', () => {
    const rule = compileTemplate(base());
    expect(rule.steps?.map((s) => s.id)).toEqual([SLOT.primary]);
    expect(rule.output).toEqual({ kind: 'monthlyIncome', from: SLOT.primary });
  });

  it('KEEPS the first column on the bare id when a second column is added', () => {
    // The whole reason a second column can be turned on for a live product: the figures a
    // bank already typed stay under the id they were typed against. If the first column
    // took a suffix too, every bank's table would be orphaned by one tick.
    const before = templateParamKeys(base());
    const after = templateParamKeys(
      base({ secondColumn: { fact: 'bank_relationship', branches: ['ntb', 'xsell'] } }),
    );
    expect(before.every((key) => after.includes(key))).toBe(true);
    expect(after).toContain('primary__xsell');
    expect(after).not.toContain('primary__ntb');
  });

  it('keeps every existing id when a second way to reach the figure is added', () => {
    const before = templateParamKeys(base());
    const after = templateParamKeys(
      base({ alternative: { kind: 'classTable', fact: 'compound_name' } }),
    );
    expect(before.every((key) => after.includes(key))).toBe(true);
    expect(after).toContain(SLOT.alt);
  });

  it('compiles the same template to byte-identical steps every time', () => {
    const template = base({
      alternative: { kind: 'shareOf', fact: 'amount_paid' },
      combine: 'lower',
      iScore: true,
      uplift: { fact: 'is_premier', whenOption: 'yes', otherwiseOption: 'no' },
      conditions: [
        { id: 'months_owned', measure: { of: 'fact', fact: 'months_owned' }, test: { op: 'atLeast' }, reasonCode: 'CONTRACT_TOO_NEW' },
      ],
    });
    expect(JSON.stringify(compileTemplate(template))).toBe(JSON.stringify(compileTemplate(template)));
  });

  it('does not depend on the order the facts were ticked in', () => {
    const a = compileTemplate(base({
      primary: { kind: 'shareOf', fact: 'zzz_amount' },
      alternative: { kind: 'multipleOf', fact: 'aaa_amount' },
    }));
    const b = compileTemplate(base({
      primary: { kind: 'shareOf', fact: 'zzz_amount' },
      alternative: { kind: 'multipleOf', fact: 'aaa_amount' },
    }));
    expect(a.steps?.map((s) => s.id)).toEqual(b.steps?.map((s) => s.id));
    // Sources are emitted sorted, so the SET of facts decides the list, not the ticking.
    expect(a.steps?.slice(0, 2).map((s) => s.id)).toEqual([sourceSlot('aaa_amount'), sourceSlot('zzz_amount')]);
  });
});

describe('two ways of reaching the figure', () => {
  const template = base({
    primary: { kind: 'choiceTable', fact: 'unit_type' },
    alternative: { kind: 'classTable', fact: 'compound_name' },
    combine: 'lower',
  });
  const rule = compileTemplate(template);
  const facts = { unit_type: choice('villa'), compound_name: choice('mivida') };
  const parents = { mivida: 'class_a' };

  it('takes the LOWER when this bank filled in both', () => {
    const out = evaluateProductRule(
      withFigures(rule, {
        primary: { keyTable: [{ key: 'villa', incomeEGP: '4000000' }] },
        alt: { keyTable: [{ key: 'class_a', incomeEGP: '6000000' }] },
      }),
      { facts, parentKeyByValue: parents },
    );
    expect(out.ok && out.valueEGP.toString()).toBe('4000000');
  });

  it('quotes the one way a bank DID fill in, rather than nothing', () => {
    // `minOf` alone fails closed on a blank member, so the comparison is wrapped in a
    // `coalesce`. Without that wrapper a bank selling only one of the two ways would quote
    // nothing at all — which is the state the whole `coalesce` design exists to avoid.
    const out = evaluateProductRule(
      withFigures(rule, { alt: { keyTable: [{ key: 'class_a', incomeEGP: '6000000' }] } }),
      { facts, parentKeyByValue: parents },
    );
    expect(out.ok && out.valueEGP.toString()).toBe('6000000');
  });
});

describe('two CEILING tables, keyed by two different answers', () => {
  /**
   * The compound guarantee as the operator picks it from the create screen: a ceiling from the
   * KIND of unit (apartment / villa / standalone) and a ceiling from the CLASS the compound is
   * filed under (AA / AB / A / B / C). Both are a loan amount in EGP — the same unit — which is
   * the one condition the design spec keeps `minOf` for; a ceiling that caps a real income is a
   * program setting instead (`loanLimits.maxLoanByFact`).
   */
  const template = base({
    outputKind: 'maxAmount',
    baselineDbrPercent: '50',
    primary: { kind: 'choiceTable', fact: 'unit_type' },
    alternatives: [{ kind: 'classTable', fact: 'compound_name' }],
    combine: 'lower',
  });
  const rule = compileTemplate(template);
  const facts = { unit_type: choice('villa'), compound_name: choice('mivida') };
  const parents = { mivida: 'class_aa' };

  it('emits the two table slots plus the wrapped comparison, and nothing else', () => {
    expect(rule.steps?.map((s) => s.id)).toEqual([
      SLOT.primary,
      SLOT.alt,
      SLOT.basisCombine,
      SLOT.basis,
    ]);
    const combine = rule.steps?.find((s) => s.id === SLOT.basisCombine);
    expect(combine?.op).toBe('minOf');
    expect(combine?.skipUnset).toBe(true);
    expect(rule.output).toEqual({
      kind: 'maxAmount',
      from: SLOT.basis,
      baselineDbrPercent: '50',
    });
  });

  it('quotes the lower of the two ceilings when a bank states both', () => {
    const out = evaluateProductRule(
      withFigures(rule, {
        primary: { keyTable: [{ key: 'villa', incomeEGP: '3000000' }] },
        alt: { keyTable: [{ key: 'class_aa', incomeEGP: '6000000' }] },
      }),
      { facts, parentKeyByValue: parents },
    );
    expect(out.ok && out.valueEGP.toString()).toBe('3000000');
  });

  it('adding the class table does not move the unit-type figures', () => {
    // The reason a live product can be given a second way at all: `primary` keeps its id, so
    // every bank's unit-type table stays exactly where it was typed.
    const oneWay = templateParamKeys(
      base({
        outputKind: 'maxAmount',
        baselineDbrPercent: '50',
        primary: { kind: 'choiceTable', fact: 'unit_type' },
      }),
    );
    expect(oneWay).toContain(SLOT.primary);
    expect(templateParamKeys(template)).toContain(SLOT.primary);
  });
});

describe('three or more ways of reaching the figure', () => {
  // One product, sold by banks that key their ceiling off different things: a share of what
  // has been paid, a table by unit type, a table by the class the compound is filed under.
  // Modelled as three products it is the same product three times, and the operator has to
  // know which one their bank is on.
  const template = base({
    outputKind: 'maxAmount',
    primary: { kind: 'shareOf', fact: 'amount_paid' },
    alternatives: [
      { kind: 'choiceTable', fact: 'unit_type' },
      { kind: 'classTable', fact: 'compound_name' },
    ],
    combine: 'lower',
  });
  const rule = compileTemplate(template);
  const classSlot = `${SLOT.alt}__compound_name`;
  const facts = {
    amount_paid: numeric('20000000'),
    unit_type: choice('apartment'),
    compound_name: choice('mivida'),
  };
  const parents = { mivida: 'class_a' };

  it('gives the first two ways the ids they already had, and names the third by its fact', () => {
    // The data-loss guard. A third way must not renumber the first two: their ids are what a
    // bank's figures and its estimate markers are keyed by. An index would move `alt` the
    // moment a way in front of it was removed.
    const twoWays = templateParamKeys(
      base({
        outputKind: 'maxAmount',
        primary: { kind: 'shareOf', fact: 'amount_paid' },
        alternatives: [{ kind: 'choiceTable', fact: 'unit_type' }],
        combine: 'lower',
      }),
    );
    const threeWays = templateParamKeys(template);
    expect(twoWays.every((key) => threeWays.includes(key))).toBe(true);
    expect(threeWays).toContain(SLOT.primary);
    expect(threeWays).toContain(SLOT.alt);
    expect(threeWays).toContain(classSlot);
  });

  it('reads `alternative` and a one-entry `alternatives` as the same product', () => {
    // Two spellings of one shape, which is the whole reason the new field needs no version
    // bump and no recompile: an existing row compiles to what it always did.
    const legacy = compileTemplate(
      base({ alternative: { kind: 'classTable', fact: 'compound_name' } }),
    );
    const current = compileTemplate(
      base({ alternatives: [{ kind: 'classTable', fact: 'compound_name' }] }),
    );
    expect(JSON.stringify(current)).toBe(JSON.stringify(legacy));
  });

  it('takes the lowest of the ways THIS bank filled in, ignoring the ones it left blank', () => {
    // The regression `skipUnset` exists for. Wrapping `minOf` in a `coalesce` was enough at
    // two ways; at three, a bank filling two of them leaves the comparison unconfigured and
    // the coalesce falls through to the FIRST way alone — dropping the clamp the bank's
    // other table was there to apply.
    const out = evaluateProductRule(
      withFigures(rule, {
        primary: { scalar: { value: '15', unit: 'percent' } },
        alt: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] },
      }),
      { facts, parentKeyByValue: parents },
    );
    // 15% of 20,000,000 is 3,000,000; the unit-type ceiling is 2,000,000; the class table is
    // this bank's blank, and must not turn the answer into 3,000,000.
    expect(out.ok && out.valueEGP.toString()).toBe('2000000');
  });

  it('quotes the one way a bank filled in when the other two are blank', () => {
    const out = evaluateProductRule(
      withFigures(rule, { [classSlot]: { keyTable: [{ key: 'class_a', incomeEGP: '6000000' }] } }),
      { facts, parentKeyByValue: parents },
    );
    expect(out.ok && out.valueEGP.toString()).toBe('6000000');
  });

  it('takes the lowest when a bank filled in all three', () => {
    const out = evaluateProductRule(
      withFigures(rule, {
        primary: { scalar: { value: '15', unit: 'percent' } },
        alt: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] },
        [classSlot]: { keyTable: [{ key: 'class_a', incomeEGP: '6000000' }] },
      }),
      { facts, parentKeyByValue: parents },
    );
    expect(out.ok && out.valueEGP.toString()).toBe('2000000');
  });

  it('does NOT demand the answer behind a way this bank declined', () => {
    // The second regression. `src__amount_paid` is a bare `factNumber`, and an unanswered
    // fact is FATAL rather than skippable — so a bank whose ceiling comes from the compound
    // class used to lose every quote from an applicant who skipped an optional question that
    // bank never reads.
    const out = evaluateProductRule(
      withFigures(rule, { [classSlot]: { keyTable: [{ key: 'class_a', incomeEGP: '6000000' }] } }),
      {
        facts: { compound_name: choice('mivida') },
        parentKeyByValue: parents,
      },
    );
    expect(out.ok && out.valueEGP.toString()).toBe('6000000');
  });

  it('still refuses when a way this bank DID fill in cannot resolve', () => {
    // The line `skipUnset` must not cross: it absorbs "this bank stated nothing", never "the
    // applicant did not answer". Falling through here would price the applicant off a
    // derivation this bank does not sell.
    const out = evaluateProductRule(
      withFigures(rule, {
        alt: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] },
        [classSlot]: { keyTable: [{ key: 'class_a', incomeEGP: '6000000' }] },
      }),
      { facts: { compound_name: choice('mivida') }, parentKeyByValue: parents },
    );
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('fact_not_answered');
  });
});

describe('I-Score', () => {
  const rule = compileTemplate(base({ iScore: true }));
  const figures = {
    primary: { keyTable: [{ key: 'colonel', incomeEGP: '45000' }] },
    iscore_band: {
      bands: [
        { fromInclusive: '0', toExclusive: '600', incomeEGP: '80' },
        { fromInclusive: '600', toExclusive: '700', incomeEGP: '100' },
        { fromInclusive: '700', toExclusive: null, incomeEGP: '110' },
      ],
    },
  };

  it('applies the bank multiplier when the applicant gave a score', () => {
    const out = evaluateProductRule(withFigures(rule, figures), {
      facts: { military_grade: choice('colonel'), [I_SCORE_FACT_KEY]: numeric('720') },
    });
    expect(out.ok && out.valueEGP.toString()).toBe('49500');
  });

  it('falls back to 100% when the applicant did NOT give one', () => {
    // The reason `RuleStep.optional` exists. Without it `factNumber` answers
    // `fact_not_answered`, the evaluator returns before the `coalesce` is reached, and one
    // skipped optional question kills every quote for the product.
    const out = evaluateProductRule(withFigures(rule, figures), {
      facts: { military_grade: choice('colonel') },
    });
    expect(out.ok && out.valueEGP.toString()).toBe('45000');
  });

  it('falls back to 100% when this bank stated no table', () => {
    const out = evaluateProductRule(
      withFigures(rule, { primary: figures.primary }),
      { facts: { military_grade: choice('colonel'), [I_SCORE_FACT_KEY]: numeric('720') } },
    );
    expect(out.ok && out.valueEGP.toString()).toBe('45000');
  });

  it('still stops when a score falls outside every band the bank stated', () => {
    // `no_matching_band` is NOT skippable, and must not become so: a table that does not
    // cover the range is a bank configuration error, not a customer declining a question.
    const out = evaluateProductRule(
      withFigures(rule, {
        ...figures,
        iscore_band: { bands: [{ fromInclusive: '600', toExclusive: '700', incomeEGP: '100' }] },
      }),
      { facts: { military_grade: choice('colonel'), [I_SCORE_FACT_KEY]: numeric('900') } },
    );
    expect(out.ok).toBe(false);
    expect(!out.ok && out.reason).toBe('no_matching_band');
  });

  it('is applied LAST, after the product own adjustments', () => {
    const withUplift = compileTemplate(
      base({ iScore: true, uplift: { fact: 'is_premier', whenOption: 'yes', otherwiseOption: 'no' } }),
    );
    const ids = withUplift.steps?.map((s) => s.id) ?? [];
    expect(ids.indexOf(SLOT.uplift)).toBeLessThan(ids.indexOf(SLOT.iScoreApplied));
    expect(withUplift.output?.from).toBe(SLOT.iScoreApplied);
  });
});

describe('a bonus percentage when one answer is given', () => {
  const rule = compileTemplate(
    base({ uplift: { fact: 'is_premier', whenOption: 'yes', otherwiseOption: 'no' } }),
  );
  const figures = {
    primary: { keyTable: [{ key: 'colonel', incomeEGP: '40000' }] },
    uplift_on: { scalar: { value: '10', unit: 'percent' as const } },
  };

  it('adds it for the answer that earns it', () => {
    const out = evaluateProductRule(withFigures(rule, figures), {
      facts: { military_grade: choice('colonel'), is_premier: choice('yes') },
    });
    expect(out.ok && out.valueEGP.toString()).toBe('44000');
  });

  it.each([
    ['the answer that does not', { is_premier: choice('no') }],
    ['an answer neither branch names', { is_premier: choice('platinum') }],
    ['no answer at all', {}],
  ])('withholds it for %s', (_label, extra) => {
    // The no-bonus column is emitted FIRST for exactly these three cases: `pickByFact` falls
    // back to the first usable input, so putting the uplifted column first would hand the
    // bonus to everybody the branch list does not mention.
    const out = evaluateProductRule(withFigures(rule, figures), {
      facts: { military_grade: choice('colonel'), ...extra },
    });
    expect(out.ok && out.valueEGP.toString()).toBe('40000');
  });
});

describe('the form refuses what it cannot compile', () => {
  it.each([
    ['a version it does not know', base({ version: 2 as 1 }), 'bad_version'],
    ['a mechanism with no fact', base({ primary: { kind: 'choiceTable', fact: '' } }), 'mechanism_needs_fact'],
    ['a second column of one', base({ secondColumn: { fact: 'x', branches: ['ntb'] } }), 'second_column_too_few_branches'],
    ['a bonus whose two answers are the same', base({ uplift: { fact: 'x', whenOption: 'yes', otherwiseOption: 'yes' } }), 'uplift_same_option'],
    ['a baseline DBR on an income product', base({ baselineDbrPercent: '50' }), 'baseline_dbr_on_income'],
    ['a baseline DBR over 100', base({ outputKind: 'maxAmount', baselineDbrPercent: '140' }), 'bad_baseline_dbr'],
    ['two conditions with one id', base({ conditions: [
      { id: 'a', measure: { of: 'fact', fact: 'f' }, test: { op: 'atLeast' }, reasonCode: 'GATE_NOT_MET' },
      { id: 'a', measure: { of: 'fact', fact: 'f' }, test: { op: 'atMost' }, reasonCode: 'GATE_NOT_MET' },
    ] }), 'condition_duplicate_id'],
  ])('refuses %s', (_label, template, reason) => {
    expect(validateTemplate(template)?.reason).toBe(reason);
  });

  it('accepts the shapes it can', () => {
    expect(validateTemplate(base())).toBeUndefined();
    expect(validateTemplate(base({ outputKind: 'maxAmount', baselineDbrPercent: '50' }))).toBeUndefined();
  });
});

describe('conditions', () => {
  it('compares two amounts for a share, because no op divides', () => {
    const rule = compileTemplate(
      base({
        conditions: [{
          id: 'down_payment',
          measure: { of: 'fact', fact: 'amount_paid' },
          test: { op: 'atLeastShareOf', fact: 'unit_price' },
          reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
        }],
      }),
    );
    expect(paramKeysOf(rule)).toContain('cond__down_payment');
    expect(paramKeysOf(rule)).toContain('cond__down_payment__bound');
    const gate = rule.gates?.[0];
    expect(gate).toMatchObject({ kind: 'number', op: 'gte', right: { step: 'cond__down_payment__bound' } });
  });

  it('refuses the applicant when the condition is not met, with its own reason', () => {
    const rule = compileTemplate(
      base({
        conditions: [{
          id: 'months_owned',
          measure: { of: 'fact', fact: 'months_owned' },
          test: { op: 'atLeast' },
          reasonCode: 'CONTRACT_TOO_NEW',
        }],
      }),
    );
    const out = evaluateProductRule(
      withFigures(rule, {
        primary: { keyTable: [{ key: 'colonel', incomeEGP: '40000' }] },
        cond__months_owned: { minValue: '18' },
      }),
      { facts: { military_grade: choice('colonel'), months_owned: numeric('6') } },
    );
    expect(out.ok).toBe(false);
    expect(!out.ok && out.gateReasonCode).toBe('CONTRACT_TOO_NEW');
  });
});

describe('the order the add-ons were ticked in cannot change the figure', () => {
  // `percentOf` rounds to two decimals at EVERY step, so multiplication commutes but the
  // rounding does not: an I-Score of 110% and a bonus of 10% applied in the other sequence
  // differ by piastres. The compiler emits one declared order regardless of how the form
  // object was assembled, which is what makes the same answers always give the same number.
  const ticked = {
    version: 1 as const,
    outputKind: 'monthlyIncome' as const,
    primary: { kind: 'choiceTable' as const, fact: 'military_grade' },
    iScore: true,
    uplift: { fact: 'is_premier', whenOption: 'yes', otherwiseOption: 'no' },
    conditions: [],
  };
  const reordered: ProductTemplate = {
    uplift: ticked.uplift,
    conditions: [],
    outputKind: ticked.outputKind,
    iScore: true,
    primary: ticked.primary,
    version: 1,
  };

  it('compiles to the identical rule', () => {
    expect(JSON.stringify(compileTemplate(ticked))).toBe(JSON.stringify(compileTemplate(reordered)));
  });

  it('and to the identical figure, to the piastre', () => {
    const figures = {
      primary: { keyTable: [{ key: 'colonel', incomeEGP: '40000' }] },
      uplift_on: { scalar: { value: '10', unit: 'percent' as const } },
      iscore_band: { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '110' }] },
    };
    const facts = {
      military_grade: choice('colonel'),
      is_premier: choice('yes'),
      [I_SCORE_FACT_KEY]: numeric('750'),
    };
    const a = evaluateProductRule(withFigures(compileTemplate(ticked), figures), { facts });
    const b = evaluateProductRule(withFigures(compileTemplate(reordered), figures), { facts });
    expect(a.ok && a.valueEGP.toString()).toBe('48400');
    expect(b.ok && b.valueEGP.toString()).toBe(a.ok ? a.valueEGP.toString() : 'n/a');
  });
});
