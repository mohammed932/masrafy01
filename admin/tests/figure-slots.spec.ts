/**
 * Which list a product's figures are keyed by.
 *
 * The case worth writing is the one that fails SILENTLY and looks right: a compound NAME
 * list carries no figure of its own — the amount is stated per class the name is filed
 * under — so an implementation that keys off the answer list prints "no default set" against
 * three hundred compounds and invents a defect where there is none.
 */
import { describe, expect, it } from 'vitest';
import {
  keyedSlots,
  listFigureState,
  listTypeOf,
  slotsKeyedByList,
} from '../src/app/shared/income-rule/figure-slots';
import type {
  RegistryFact,
  RuleGate,
  RuleStep,
} from '../src/app/features/bank-programs/bank-programs.types';

function fact(
  key: string,
  over: Partial<NonNullable<RegistryFact['question']>> | null,
): RegistryFact {
  return {
    key,
    label: key,
    ownedBy: 'compound_owner',
    question:
      over === null
        ? null
        : {
            code: `q_${key}`,
            label: key,
            type: 'SINGLE_SELECT',
            active: true,
            options: [],
            parentOptions: [],
            askedIn: [],
            ...over,
          },
  };
}

/** The compound product's shape: a class-keyed pair and an answer-keyed pair, each picked. */
const STEPS: RuleStep[] = [
  { id: 'primary', op: 'factParentTable', fact: 'compound_name' },
  { id: 'primary__top_up', op: 'factParentTable', fact: 'compound_name' },
  {
    id: 'primary_pick',
    op: 'pickByFact',
    fact: 'bank_relationship',
    branches: ['ntb', 'xsell'],
    of: [{ step: 'primary' }, { step: 'primary__top_up' }],
  },
  { id: 'alt', op: 'factChoiceTable', fact: 'owned_unit_type' },
  { id: 'alt__top_up', op: 'factChoiceTable', fact: 'owned_unit_type' },
  {
    id: 'alt_pick',
    op: 'pickByFact',
    fact: 'bank_relationship',
    branches: ['ntb', 'xsell'],
    of: [{ step: 'alt' }, { step: 'alt__top_up' }],
  },
  { id: 'basis', op: 'coalesce', of: [{ step: 'primary_pick' }, { step: 'alt_pick' }] },
];

const FACTS: RegistryFact[] = [
  fact('compound_name', {
    optionsEnumerationType: 'compound',
    parentEnumerationType: 'compound_category',
  }),
  fact('owned_unit_type', { optionsEnumerationType: 'property_type' }),
];

describe('keyedSlots', () => {
  it('merges a pick’s two columns into one slot when they read the same fact', () => {
    const slots = keyedSlots(STEPS, []);
    const alt = slots.find((s) => s.id === 'alt');
    expect(alt).toEqual({
      id: 'alt',
      secondId: 'alt__top_up',
      rowId: 'alt_pick',
      factKey: 'owned_unit_type',
      axis: 'answer',
    });
  });

  it('never counts a column or a coalesce as a slot of its own', () => {
    const ids = keyedSlots(STEPS, []).map((s) => s.id);
    expect(ids).toEqual(['primary', 'alt']);
  });

  it('reads a parent table as keyed by the class, not the answer', () => {
    const primary = keyedSlots(STEPS, []).find((s) => s.id === 'primary');
    expect(primary?.axis).toBe('class');
    expect(primary?.secondId).toBe('primary__top_up');
  });

  it('does not merge two columns that read different facts', () => {
    const steps: RuleStep[] = [
      { id: 'a', op: 'factChoiceTable', fact: 'owned_unit_type' },
      { id: 'b', op: 'factChoiceTable', fact: 'school_stage' },
      {
        id: 'pick',
        op: 'pickByFact',
        fact: 'bank_relationship',
        branches: ['ntb', 'xsell'],
        of: [{ step: 'a' }, { step: 'b' }],
      },
    ];
    const slots = keyedSlots(steps, []);
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.rowId)).toEqual(['pick', 'pick']);
    expect(slots.map((s) => s.secondId)).toEqual([null, null]);
  });

  it('does not merge a parent table with a choice table', () => {
    const steps: RuleStep[] = [
      { id: 'a', op: 'factParentTable', fact: 'compound_name' },
      { id: 'b', op: 'factChoiceTable', fact: 'compound_name' },
      {
        id: 'pick',
        op: 'pickByFact',
        fact: 'bank_relationship',
        branches: ['ntb', 'xsell'],
        of: [{ step: 'a' }, { step: 'b' }],
      },
    ];
    expect(keyedSlots(steps, []).map((s) => s.axis)).toEqual(['class', 'answer']);
  });

  it('reads a numberByKey gate as a slot keyed by the fact it is keyed by', () => {
    const gates: RuleGate[] = [
      {
        id: 'cond__dp',
        kind: 'numberByKey',
        op: 'gte',
        left: { step: 'basis' },
        keyedBy: 'employment_type',
        reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
      },
    ];
    expect(keyedSlots([], gates)).toEqual([
      {
        id: 'cond__dp',
        secondId: null,
        rowId: 'cond__dp',
        factKey: 'employment_type',
        axis: 'answer',
      },
    ]);
  });

  it('draws a gate’s right-hand key table on the gate’s row, not on its own', () => {
    const steps: RuleStep[] = [{ id: 'req', op: 'factChoiceTable', fact: 'owned_unit_type' }];
    const gates: RuleGate[] = [
      {
        id: 'cond__floor',
        kind: 'number',
        op: 'gte',
        left: { step: 'basis' },
        right: { step: 'req' },
        reasonCode: 'UNIT_PRICE_BELOW_MIN',
      },
    ];
    expect(keyedSlots(steps, gates)).toEqual([
      {
        id: 'req',
        secondId: null,
        rowId: 'cond__floor',
        factKey: 'owned_unit_type',
        axis: 'answer',
      },
    ]);
  });

  it('is empty for a product with no rule', () => {
    expect(keyedSlots([], [])).toEqual([]);
  });
});

describe('listTypeOf', () => {
  it('returns null for a fact the registry does not carry', () => {
    const slot = { id: 'x', secondId: null, rowId: 'x', factKey: 'ghost', axis: 'answer' } as const;
    expect(listTypeOf(slot, FACTS)).toBeNull();
  });

  it('returns null for a fact whose question is backed by no list', () => {
    const slot = { id: 'x', secondId: null, rowId: 'x', factKey: 'yes_no', axis: 'answer' } as const;
    expect(listTypeOf(slot, [fact('yes_no', {})])).toBeNull();
  });

  it('returns null for a fact bound to no question', () => {
    const slot = { id: 'x', secondId: null, rowId: 'x', factKey: 'loose', axis: 'answer' } as const;
    expect(listTypeOf(slot, [fact('loose', null)])).toBeNull();
  });
});

describe('slotsKeyedByList', () => {
  it('gives the answer list its one merged slot', () => {
    const slots = slotsKeyedByList(STEPS, [], FACTS, 'property_type');
    expect(slots.map((s) => s.id)).toEqual(['alt']);
  });

  it('gives the class list the class-keyed slot', () => {
    const slots = slotsKeyedByList(STEPS, [], FACTS, 'compound_category');
    expect(slots.map((s) => s.id)).toEqual(['primary']);
    expect(slots[0]?.axis).toBe('class');
  });

  it('gives the compound NAMES nothing — they are priced by their class', () => {
    expect(slotsKeyedByList(STEPS, [], FACTS, 'compound')).toEqual([]);
  });
});

describe('listFigureState', () => {
  it('says a list carrying its own figures is keyed', () => {
    expect(listFigureState(STEPS, [], FACTS, 'property_type').state).toBe('keyed');
    expect(listFigureState(STEPS, [], FACTS, 'compound_category').state).toBe('keyed');
  });

  it('says the compound names are priced by class rather than unpriced', () => {
    expect(listFigureState(STEPS, [], FACTS, 'compound').state).toBe('byClass');
  });

  it('says a list nothing is keyed by is unpriced', () => {
    const facts = [...FACTS, fact('multi_unit', { optionsEnumerationType: 'yes_no' })];
    expect(listFigureState(STEPS, [], facts, 'yes_no').state).toBe('unpriced');
  });

  it('reports every list as unpriced for a product with no calculation', () => {
    expect(listFigureState([], [], FACTS, 'property_type')).toEqual({
      state: 'unpriced',
      slots: [],
    });
  });
});

/**
 * THE DOCTORS' PRODUCT. Each column is a band table keyed by years in practice — a NUMBER,
 * so no list of its own — while which column is read comes from the city tier the
 * governorate is filed under. So the figures are one table per TIER, and a screen that only
 * ever looked at a column's own keys reported "no amount is keyed by these" over the three
 * tables an operator has to fill in.
 */
const BAND_STEPS: RuleStep[] = [
  { id: 'src__years_in_practice', op: 'factNumber', fact: 'years_in_practice' },
  { id: 'primary', op: 'bandTable', of: { step: 'src__years_in_practice' } },
  { id: 'primary__city_tier_secondary', op: 'bandTable', of: { step: 'src__years_in_practice' } },
  { id: 'primary__city_tier_other', op: 'bandTable', of: { step: 'src__years_in_practice' } },
  {
    id: 'primary_pick',
    op: 'pickByFact',
    fact: 'property_governorate',
    branchOn: 'parentClass',
    branches: ['city_tier_major', 'city_tier_secondary', 'city_tier_other'],
    of: [
      { step: 'primary' },
      { step: 'primary__city_tier_secondary' },
      { step: 'primary__city_tier_other' },
    ],
  },
];

const BAND_FACTS: RegistryFact[] = [
  fact('property_governorate', {
    optionsEnumerationType: 'governorate',
    parentEnumerationType: 'city_tier',
  }),
  fact('years_in_practice', { type: 'NUMERIC' }),
];

describe('a pick whose columns are keyed by no list of their own', () => {
  it('hangs one slot per branch on the class list it branches by', () => {
    const slots = slotsKeyedByList(BAND_STEPS, [], BAND_FACTS, 'city_tier');
    expect(slots.map((s) => s.id)).toEqual([
      'primary',
      'primary__city_tier_secondary',
      'primary__city_tier_other',
    ]);
    expect(slots.every((s) => s.axis === 'class' && s.rowId === 'primary_pick')).toBe(true);
    expect(listFigureState(BAND_STEPS, [], BAND_FACTS, 'city_tier').state).toBe('keyed');
  });

  it('leaves the governorates themselves priced by their class', () => {
    expect(listFigureState(BAND_STEPS, [], BAND_FACTS, 'governorate').state).toBe('byClass');
  });

  it('hangs on the ANSWER list when the pick branches by answer', () => {
    const steps = BAND_STEPS.map((step) =>
      step.id === 'primary_pick'
        ? { ...step, branchOn: 'answer' as const, branches: ['gov_cairo', 'gov_giza', 'gov_other'] }
        : step,
    );
    const slots = slotsKeyedByList(steps, [], BAND_FACTS, 'governorate');
    expect(slots.map((s) => s.axis)).toEqual(['answer', 'answer', 'answer']);
    expect(listFigureState(steps, [], BAND_FACTS, 'city_tier').state).toBe('unpriced');
  });

  it('still attaches a pick’s KEY-TABLE columns by their own keys, not by the branch list', () => {
    // The compound product, unchanged: a column that states its own key set is the finer
    // statement of where its figures go, so the branch fallback must never reach it.
    expect(slotsKeyedByList(STEPS, [], FACTS, 'compound_category').map((s) => s.id)).toEqual([
      'primary',
    ]);
    const relationship = [...FACTS, fact('bank_relationship', { optionsEnumerationType: 'rel' })];
    expect(slotsKeyedByList(STEPS, [], relationship, 'rel')).toEqual([]);
  });
});
