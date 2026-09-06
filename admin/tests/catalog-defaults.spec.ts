/**
 * The product's defaults, and the write path that lost two of them.
 *
 * The evidence these are pinned against is a live row. `ABK-PERSONAL-7110` (ABK,
 * `compound_owner_4` → product `compound_owner`, built through the wizard) saved:
 *
 *     cond__unitworthenough   {}                                      product: minValue 1000000
 *     cond__paidenough__bound {scalar:{unit:'percent',value:''}}       product: 30%
 *
 * Two shapes for one state — "this bank stated nothing" — because `patch()` guarded on a
 * TOP-LEVEL empty string and a `scalar`'s top-level value is an object. Neither failed
 * loudly: `stepIsConfigured` reads both as unconfigured. So the tests below assert the
 * literals, not a paraphrase of them.
 *
 * The second half pins the slot walk. The box the operator types 30% into writes
 * `cond__paidenough__bound` — the gate's BOUND STEP — not `cond__paidenough`. A walk that
 * keyed gate slots by the gate id would look for a default under a key the product never
 * uses and report the one slot this module exists for as having none.
 */
import { describe, expect, it } from 'vitest';
import { mergeFigure, writeFigure } from '../src/app/shared/income-rule/figure-write';
import {
  defaultFor,
  figureIsBlank,
  slotShapes,
  slotsMissingDefault,
  withAllDefaults,
  withDefault,
} from '../src/app/shared/income-rule/catalog-defaults';
import { wayOwnedSlots } from '../src/app/shared/income-rule/product-rule-ways';
import type {
  RuleGate,
  RuleStep,
  StepFigures,
} from '../src/app/features/bank-programs/bank-programs.types';

/**
 * The real `compound_owner` rule, trimmed to the ways and conditions these tests exercise.
 * Step ids, ops and the gate's `right` are copied from the stored product row, because the
 * whole point is that the walk agrees with what is actually in the database.
 */
const STEPS: RuleStep[] = [
  { id: 'src__unit_contract_price', op: 'factNumber', fact: 'unit_contract_price' },
  { id: 'src__unit_paid_to_date', op: 'factNumber', fact: 'unit_paid_to_date' },
  { id: 'primary', op: 'factParentTable', fact: 'compound_name' },
  { id: 'primary__top_up', op: 'factParentTable', fact: 'compound_name' },
  {
    id: 'primary_pick',
    op: 'pickByFact',
    fact: 'loan_is_topup',
    branches: ['new_loan', 'top_up'],
    of: [{ step: 'primary' }, { step: 'primary__top_up' }],
  },
  {
    id: 'alt__unit_paid_to_date',
    op: 'percentOf',
    of: { step: 'src__unit_paid_to_date' },
  },
  {
    id: 'alt__unit_paid_to_date__top_up',
    op: 'percentOf',
    of: { step: 'src__unit_paid_to_date' },
  },
  {
    id: 'alt__unit_paid_to_date_pick',
    op: 'pickByFact',
    fact: 'loan_is_topup',
    branches: ['new_loan', 'top_up'],
    of: [{ step: 'alt__unit_paid_to_date' }, { step: 'alt__unit_paid_to_date__top_up' }],
  },
  {
    id: 'basis',
    op: 'coalesce',
    of: [{ step: 'primary_pick' }, { step: 'alt__unit_paid_to_date_pick' }],
  },
  {
    id: 'cond__paidenough__bound',
    op: 'percentOf',
    of: { step: 'src__unit_contract_price' },
  },
];

const GATES: RuleGate[] = [
  {
    id: 'cond__ownedlongenough',
    kind: 'number',
    op: 'gte',
    left: { fact: 'unit_months_owned' },
    reasonCode: 'CONTRACT_TOO_NEW',
  },
  {
    id: 'cond__paidenough',
    kind: 'number',
    op: 'gte',
    left: { fact: 'unit_paid_to_date' },
    right: { step: 'cond__paidenough__bound' },
    reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
  },
  {
    id: 'cond__unitworthenough',
    kind: 'number',
    op: 'gte',
    left: { fact: 'unit_contract_price' },
    reasonCode: 'UNIT_PRICE_BELOW_MIN',
  },
];

/** The product's stored `stepParams`, verbatim for the slots under test. */
const CATALOG: Record<string, StepFigures> = {
  primary: {
    keyTable: [
      { key: 'compound_tier_aa', incomeEGP: '6000000' },
      { key: 'compound_tier_a', incomeEGP: '4000000' },
    ],
  },
  primary__top_up: {
    keyTable: [
      { key: 'compound_tier_aa', incomeEGP: '7000000' },
      { key: 'compound_tier_a', incomeEGP: '4500000' },
    ],
  },
  alt__unit_paid_to_date: { scalar: { unit: 'percent', value: '15' } },
  alt__unit_paid_to_date__top_up: { scalar: { unit: 'percent', value: '15' } },
  cond__ownedlongenough: { minValue: '18' },
  cond__unitworthenough: { minValue: '1000000' },
  cond__paidenough__bound: { scalar: { unit: 'percent', value: '30' } },
};

/** What `ABK-PERSONAL-7110` actually saved. */
const SEVEN_ONE_ONE_ZERO: Record<string, StepFigures> = {
  cond__ownedlongenough: { minValue: '18' },
  cond__unitworthenough: {},
  alt__unit_paid_to_date: { scalar: { unit: 'percent', value: '15' } },
  cond__paidenough__bound: { scalar: { unit: 'percent', value: '' } },
  alt__unit_paid_to_date__top_up: { scalar: { unit: 'percent', value: '15' } },
};

const SHAPES = slotShapes(STEPS, GATES);

/**
 * The slots 7110 can be offered a default for: the one way it sells, plus every slot no way
 * owns (the conditions). Derived through `wayOwnedSlots` rather than by hand — a second
 * derivation is exactly what this argument exists to prevent.
 */
const OWNED = (() => {
  const owned = wayOwnedSlots(STEPS, 'alt__unit_paid_to_date');
  const everyWaySlot = new Set<string>([
    ...wayOwnedSlots(STEPS, 'primary'),
    ...wayOwnedSlots(STEPS, 'alt__unit_paid_to_date'),
  ]);
  for (const id of SHAPES.keys()) if (!everyWaySlot.has(id)) owned.add(id);
  return owned;
})();

describe('mergeFigure', () => {
  it('drops a scalar whose value was cleared — the shape 7110 stored', () => {
    const cleared = mergeFigure(
      { scalar: { unit: 'percent', value: '30' } },
      { scalar: { value: '', unit: 'percent' } },
    );
    expect(cleared).toBeNull();
  });

  it('drops a cleared bound, as the old inline guard already did', () => {
    expect(mergeFigure({ minValue: '1000000' }, { minValue: '' })).toBeNull();
  });

  it('treats whitespace as cleared', () => {
    expect(mergeFigure({ minValue: '18' }, { minValue: '   ' })).toBeNull();
  });

  it('keeps the other fields when one is cleared', () => {
    expect(mergeFigure({ minValue: '1', maxValue: '9' }, { minValue: '' })).toEqual({
      maxValue: '9',
    });
  });

  it('keeps an empty table — the editors write one mid-edit', () => {
    expect(mergeFigure({ keyTable: [{ key: 'a', incomeEGP: '1' }] }, { keyTable: [] })).toEqual({
      keyTable: [],
    });
  });

  it('turning a condition off leaves nothing, not {}', () => {
    expect(mergeFigure({ applies: true }, { applies: undefined })).toBeNull();
  });
});

describe('writeFigure', () => {
  it('removes the key when the slot states nothing', () => {
    const next = writeFigure(
      { cond__unitworthenough: { minValue: '1000000' }, other: { minValue: '2' } },
      'cond__unitworthenough',
      { minValue: '' },
    );
    expect('cond__unitworthenough' in next).toBe(false);
    expect(next['other']).toEqual({ minValue: '2' });
  });

  it('never mutates the map it was given', () => {
    const before: Record<string, StepFigures> = { a: { minValue: '1' } };
    writeFigure(before, 'a', { minValue: '' });
    expect(before['a']).toEqual({ minValue: '1' });
  });
});

describe('slotShapes', () => {
  const shapes = SHAPES;

  it("puts the gate's box on its BOUND STEP, not on the gate", () => {
    expect(shapes.get('cond__paidenough__bound')).toEqual({
      id: 'cond__paidenough__bound',
      shape: 'scalar',
      rowId: 'cond__paidenough',
    });
    expect(shapes.has('cond__paidenough')).toBe(false);
  });

  it('gives a plain number gate a minmax box of its own', () => {
    expect(shapes.get('cond__unitworthenough')?.shape).toBe('minmax');
    expect(shapes.get('cond__ownedlongenough')?.shape).toBe('minmax');
  });

  it("carries both columns of a pick, each under its own key, on the pick's row", () => {
    expect(shapes.get('primary')).toEqual({
      id: 'primary',
      shape: 'keyTable',
      rowId: 'primary_pick',
    });
    expect(shapes.get('primary__top_up')?.rowId).toBe('primary_pick');
    expect(shapes.has('primary_pick')).toBe(false);
  });

  it('skips the arithmetic that states no figure', () => {
    expect(shapes.has('src__unit_paid_to_date')).toBe(false);
    expect(shapes.has('basis')).toBe(false);
  });
});

describe('figureIsBlank', () => {
  it('reads both shapes 7110 stored as blank', () => {
    expect(figureIsBlank('minmax', SEVEN_ONE_ONE_ZERO['cond__unitworthenough'])).toBe(true);
    expect(figureIsBlank('scalar', SEVEN_ONE_ONE_ZERO['cond__paidenough__bound'])).toBe(true);
  });

  it('reads a typed figure as not blank', () => {
    expect(figureIsBlank('scalar', SEVEN_ONE_ONE_ZERO['alt__unit_paid_to_date'])).toBe(false);
    expect(figureIsBlank('minmax', SEVEN_ONE_ONE_ZERO['cond__ownedlongenough'])).toBe(false);
  });

  it('an unticked condition is blank; a ticked one is not', () => {
    expect(figureIsBlank('applies', undefined)).toBe(true);
    expect(figureIsBlank('applies', { applies: true })).toBe(false);
  });
});

describe('slotsMissingDefault', () => {
  it('names exactly the two figures 7110 lost', () => {
    const missing = slotsMissingDefault(SHAPES, SEVEN_ONE_ONE_ZERO, CATALOG, {
      ownedSlots: OWNED,
    }).map((slot) => slot.id);
    expect(missing.sort()).toEqual(['cond__paidenough__bound', 'cond__unitworthenough']);
  });

  it('never offers a default for a way this bank does not sell', () => {
    const missing = slotsMissingDefault(SHAPES, {}, CATALOG, { ownedSlots: OWNED }).map(
      (s) => s.id,
    );
    expect(missing).not.toContain('primary');
    expect(missing).not.toContain('primary__top_up');
  });

  it('offers nothing where the product itself states nothing', () => {
    const missing = slotsMissingDefault(SHAPES, SEVEN_ONE_ONE_ZERO, {}, { ownedSlots: OWNED });
    expect(missing).toEqual([]);
  });
});

describe('withDefault / withAllDefaults', () => {
  it('deep-copies, so a later edit cannot reach the product', () => {
    const slot = {
      id: 'primary',
      rowId: 'primary_pick',
      shape: 'keyTable' as const,
      figures: defaultFor(CATALOG, 'primary', 'keyTable')!,
    };
    const next = withDefault({}, slot);
    next['primary']!.keyTable![0]!.incomeEGP = '1';
    expect(CATALOG['primary']!.keyTable![0]!.incomeEGP).toBe('6000000');
  });

  it('fills both of 7110s blanks and reports them by name', () => {
    const missing = slotsMissingDefault(SHAPES, SEVEN_ONE_ONE_ZERO, CATALOG, { ownedSlots: OWNED });
    const { figures, filled } = withAllDefaults(SEVEN_ONE_ONE_ZERO, missing);
    expect(filled.sort()).toEqual(['cond__paidenough__bound', 'cond__unitworthenough']);
    expect(figures['cond__unitworthenough']).toEqual({ minValue: '1000000' });
    expect(figures['cond__paidenough__bound']).toEqual({
      scalar: { unit: 'percent', value: '30' },
    });
  });

  it('leaves every figure the bank typed alone', () => {
    const missing = slotsMissingDefault(SHAPES, SEVEN_ONE_ONE_ZERO, CATALOG, { ownedSlots: OWNED });
    const { figures } = withAllDefaults(SEVEN_ONE_ONE_ZERO, missing);
    expect(figures['alt__unit_paid_to_date']).toEqual({ scalar: { unit: 'percent', value: '15' } });
    expect(figures['cond__ownedlongenough']).toEqual({ minValue: '18' });
  });
});

describe("a condition's switch is never offered as a default", () => {
  const CHOICE_GATE: RuleGate[] = [
    {
      id: 'cond__ownspractice',
      kind: 'choice',
      op: 'in',
      left: { fact: 'owns_practice' },
      expect: ['yes'],
      reasonCode: 'OWNERSHIP_NOT_CONFIRMED',
    },
  ];

  it('is a slot, so the editor still draws it', () => {
    expect(slotShapes([], CHOICE_GATE).get('cond__ownspractice')?.shape).toBe('applies');
  });

  it('but is never a missing default, even when the product turns it on', () => {
    const missing = slotsMissingDefault(
      slotShapes([], CHOICE_GATE),
      {},
      {
        cond__ownspractice: { applies: true },
      },
    );
    expect(missing).toEqual([]);
  });
});

/**
 * The defects an adversarial review confirmed, each pinned to the sequence that produced it.
 */
describe('a pick that is itself another pick&apos;s column', () => {
  /**
   * An income-scoped uplift on a product that already has a second column: `emitUplift`
   * makes the way&apos;s pick a column of the uplift&apos;s pick. The editor draws ONE row — the
   * uplift — and a walk that handled the pick before the column guard yielded the money
   * tables as slots with no box, which the wizard&apos;s fill then wrote.
   */
  const NESTED: RuleStep[] = [
    { id: 'primary', op: 'factChoiceTable', fact: 'academic_rank' },
    { id: 'primary__uni_private', op: 'factChoiceTable', fact: 'academic_rank' },
    {
      id: 'primary_pick',
      op: 'pickByFact',
      fact: 'university_type',
      branches: ['uni_government', 'uni_private'],
      of: [{ step: 'primary' }, { step: 'primary__uni_private' }],
    },
    { id: 'uplift_on', op: 'upliftPercent', of: { step: 'primary_pick' } },
    {
      id: 'uplift',
      op: 'pickByFact',
      fact: 'has_second_job',
      branches: ['no', 'yes'],
      of: [{ step: 'primary_pick' }, { step: 'uplift_on' }],
    },
  ];

  it('yields only the box the editor actually draws', () => {
    expect([...slotShapes(NESTED, []).keys()]).toEqual(['uplift_on']);
  });

  it('so the fill can never write a figure with nothing on screen to review it', () => {
    const missing = slotsMissingDefault(
      slotShapes(NESTED, []),
      {},
      {
        primary: { keyTable: [{ key: 'dean', incomeEGP: '100000' }] },
        primary__uni_private: { keyTable: [{ key: 'dean', incomeEGP: '300000' }] },
        uplift_on: { scalar: { unit: 'percent', value: '10' } },
      },
    );
    expect(missing.map((s) => s.id)).toEqual(['uplift_on']);
  });
});

describe('a gate is asked one bound at a time', () => {
  const BETWEEN: RuleGate[] = [
    {
      id: 'cond__owned',
      kind: 'number',
      op: 'between',
      left: { fact: 'unit_months_owned' },
      reasonCode: 'CONTRACT_TOO_NEW',
    },
  ];
  const SHAPES = slotShapes([], BETWEEN);
  const CAT = { cond__owned: { minValue: '12', maxValue: '60' } };

  it('offers the missing ceiling when only the floor is typed', () => {
    const missing = slotsMissingDefault(SHAPES, { cond__owned: { minValue: '12' } }, CAT);
    expect(missing).toHaveLength(1);
    expect(missing[0]?.figures).toEqual({ maxValue: '60' });
  });

  it('never overwrites the bound the bank typed, even a different one', () => {
    const missing = slotsMissingDefault(SHAPES, { cond__owned: { minValue: '99' } }, CAT);
    expect(missing[0]?.figures).toEqual({ maxValue: '60' });
    const { figures } = withAllDefaults({ cond__owned: { minValue: '99' } }, missing);
    expect(figures['cond__owned']).toEqual({ minValue: '99', maxValue: '60' });
  });

  it('offers nothing when both bounds are typed', () => {
    expect(slotsMissingDefault(SHAPES, CAT, CAT)).toEqual([]);
  });
});

describe('one default, one stored shape', () => {
  it('a per-field blank in the product is not copied through', () => {
    const shapes = slotShapes(
      [],
      [
        {
          id: 'cond__x',
          kind: 'number',
          op: 'between',
          left: { fact: 'f' },
          reasonCode: 'CONTRACT_TOO_NEW',
        },
      ],
    );
    const missing = slotsMissingDefault(shapes, {}, { cond__x: { minValue: '20', maxValue: '' } });
    const { figures } = withAllDefaults({}, missing);
    expect(figures['cond__x']).toEqual({ minValue: '20' });
  });
});
