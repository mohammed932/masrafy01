/**
 * One way per bank program.
 *
 * A surrogate product may state several WAYS of reaching its figure. `compound_owner` states
 * five, because four banks sell the same guarantee off four different mechanisms. Nothing made
 * a program pick one: it filled whatever way slots it liked and `emitBasis` folded every filled
 * way with `minOf(skipUnset)`, so two filled ways silently became "the lower of the two" — a
 * mechanism no published sheet sells, quoted to real applicants.
 *
 * Four properties are pinned here, and each fails silently if it is not held:
 *
 *   1. **A WAY IS NOT ONE SLOT.** With a second column configured a way spans its head, its
 *      columns and its pick — FABMISR's compound program stores `alt` AND `alt__top_up`, which
 *      is one way, and an enforcement counting `stepParams` keys would refuse the one program
 *      that is already right. Nor can it be read lexically: `alt__unit_paid_to_date` is a way
 *      HEAD and `alt__top_up` is a COLUMN, and as strings they are indistinguishable.
 *   2. **The exception survives.** `auto_loan_crosssell` is two ways ONE sheet pairs — App. A
 *      §4, "3 × the car instalment OR 10% of the auto loan, whichever is less" — and both its
 *      ABK programs legitimately fill both. `combine` cannot tell the two situations apart:
 *      both products carry `'lower'`.
 *   3. **Absent means what it has always meant.** Every stored template and every stored rule
 *      predates the flag, so absence has to read as combined and change nothing (§5.4).
 *   4. **Catalog inheritance narrows to the chosen way.** Inheritance is whole-key, and the
 *      compound catalog fills four heads, so a bank on `amounts: 'catalog'` would otherwise
 *      quote the lower of four mechanisms nobody sells.
 */
import { describe, expect, it } from 'vitest';

import { productBlueprint } from '@/bank-programs/blueprints/product-blueprints';
import {
  compileTemplate,
  validateTemplate,
  waysAreOf,
  type ProductTemplate,
} from '@/matching/pipeline/product-template';
import {
  allWaySlots,
  filledWayIds,
  wayOwnedSlots,
  waysAreExclusive,
  waysOfRule,
} from '@/matching/pipeline/product-rule-ways';
import { Decimal } from '@prisma/client/runtime/library';
import { evaluateProductRule } from '@/matching/pipeline/product-rule';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import {
  effectiveIncomeRule,
  stripCatalogStructure,
  stripUnchosenWays,
} from '@/matching/pipeline/income-rule-inherit';
import {
  validateIncomeRule,
  type IncomeRuleValidationContext,
} from '@/bank-programs/validation/income-rule.validator';
import { PRODUCT_RULE_STRATEGY, type IncomeAssumptionConfig } from '@/matching/types';
import type { SurrogateFactBinding } from '@/matching/pipeline/surrogate-fact-registry';

const COMPOUND = productBlueprint('compound_owner')!.template!;
const CROSSSELL = productBlueprint('auto_loan_crosssell')!.template!;

const COMPOUND_RULE = compileTemplate(COMPOUND) as ProductRule;

const asConfig = (rule: unknown): IncomeAssumptionConfig => rule as IncomeAssumptionConfig;

// ---------------------------------------------------------------------------
// The form declares it
// ---------------------------------------------------------------------------

describe('a product declares whether its ways are alternatives', () => {
  it('reads an absent flag as combined, which is what every stored form means', () => {
    expect(waysAreOf(CROSSSELL)).toBe('combined');
    expect(CROSSSELL.waysAre).toBeUndefined();
  });

  it('has the compound guarantee state that they are alternatives', () => {
    expect(waysAreOf(COMPOUND)).toBe('exclusive');
  });

  it('accepts both spellings on a product with more than one way', () => {
    for (const waysAre of ['exclusive', 'combined'] as const) {
      expect(validateTemplate({ ...COMPOUND, waysAre })).toBeUndefined();
    }
  });

  it('refuses a value it does not know', () => {
    const bad = { ...COMPOUND, waysAre: 'either' } as unknown as ProductTemplate;
    expect(validateTemplate(bad)).toEqual({ reason: 'unknown_ways_are', detail: 'either' });
  });

  it('refuses the flag on a one-way product, however it is spelled', () => {
    // A flag that decides nothing is worse than an absent one: the next operator reads it and
    // believes it, and on a bank program it would demand a choice between one thing.
    const oneWay: ProductTemplate = {
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'flatAmount' },
      conditions: [],
    };
    for (const waysAre of ['exclusive', 'combined'] as const) {
      expect(validateTemplate({ ...oneWay, waysAre })).toEqual({
        reason: 'ways_are_not_applicable',
        detail: '1',
      });
    }
  });
});

describe('the flag travels on the compiled rule, and only when it decides something', () => {
  it('is carried, because the two readers hold a rule and never a form', () => {
    expect(COMPOUND_RULE.waysAre).toBe('exclusive');
    expect(waysAreExclusive(COMPOUND_RULE)).toBe(true);
  });

  it('leaves a combined product compiling byte-identically', () => {
    // Absent already reads as combined everywhere, so stating it must add nothing — which is
    // what keeps every template stored before the field existed compiling to the same steps.
    expect(compileTemplate(CROSSSELL)).toEqual(compileTemplate({ ...CROSSSELL, waysAre: 'combined' }));
    expect((compileTemplate(CROSSSELL) as ProductRule).waysAre).toBeUndefined();
  });

  it('adds no step and renames none', () => {
    const before = compileTemplate({ ...COMPOUND, waysAre: undefined });
    const after = compileTemplate(COMPOUND);
    expect(after.steps.map((s) => s.id)).toEqual(before.steps.map((s) => s.id));
    expect(after.gates).toEqual(before.gates);
  });
});

// ---------------------------------------------------------------------------
// What a way owns
// ---------------------------------------------------------------------------

describe('a way is its head, its columns and its pick — never one slot', () => {
  it('names the ways by the slot a bank files figures under', () => {
    expect(waysOfRule(COMPOUND_RULE).map((way) => way.id)).toEqual([
      'primary',
      'alt',
      'alt__unit_paid_to_date',
      'alt__owned_unit_type',
      'alt__unit_down_payment',
    ]);
  });

  it("carries FABMISR's two columns inside the one way they belong to", () => {
    // The program that would be refused by any check counting `stepParams` keys.
    const slots = wayOwnedSlots(COMPOUND_RULE, 'alt');
    expect([...slots].sort()).toEqual(['alt', 'alt__top_up', 'alt_pick']);
  });

  it('does not confuse a way HEAD named after a fact with a COLUMN named after a branch', () => {
    // Indistinguishable as strings; only the rule says which is which.
    expect(wayOwnedSlots(COMPOUND_RULE, 'alt__unit_paid_to_date').has('alt__top_up')).toBe(false);
    expect(waysOfRule(COMPOUND_RULE).some((way) => way.id === 'alt__top_up')).toBe(false);
  });

  it('claims nothing that is not a way', () => {
    const owned = allWaySlots(COMPOUND_RULE);
    for (const slot of [
      'cond__ownedlongenough',
      'cond__paidenough__bound',
      'share',
      'src__unit_paid_to_date',
      'basis',
      'basis_combine',
    ]) {
      expect(owned.has(slot)).toBe(false);
    }
  });

  it('answers with nothing for a way the product does not offer', () => {
    // Empty rather than "everything", so a caller that PRUNES by this cannot silently keep
    // the whole map when the way it was handed has gone.
    expect(wayOwnedSlots(COMPOUND_RULE, 'alt__nothing').size).toBe(0);
  });

  it('finds no ways at all in a one-way product, which is why none can be chosen', () => {
    const single = compileTemplate({
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'flatAmount' },
      conditions: [],
    }) as ProductRule;
    expect(waysOfRule(single)).toEqual([]);
    expect(waysAreExclusive({ ...single, waysAre: 'exclusive' })).toBe(false);
  });
});

describe('a way counts as filled when any of its slots holds a figure', () => {
  const filled = (stepParams: Record<string, unknown>): string[] =>
    filledWayIds({ ...COMPOUND_RULE, stepParams } as ProductRule);

  it('counts one column as the whole way', () => {
    expect(filled({ alt: bands() })).toEqual(['alt']);
    expect(filled({ alt: bands(), alt__top_up: bands() })).toEqual(['alt']);
  });

  it('counts a share the bank stated', () => {
    expect(filled({ alt__unit_paid_to_date: { scalar: { value: '15', unit: 'percent' } } })).toEqual(
      ['alt__unit_paid_to_date'],
    );
  });

  it('ignores an empty box, which is a box nobody filled', () => {
    expect(filled({ alt: {}, primary: { keyTable: [] } })).toEqual([]);
  });

  it('does not read a pick as filled — it states no figures of its own', () => {
    expect(filled({ alt_pick: {}, primary_pick: {} })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The refusals
// ---------------------------------------------------------------------------

const FACTS: SurrogateFactBinding[] = [
  { key: 'compound_name', questionCode: 'compound_name', type: 'SINGLE_SELECT' },
  { key: 'owned_unit_type', questionCode: 'owned_unit_type', type: 'SINGLE_SELECT' },
  { key: 'unit_count_owned', questionCode: 'unit_count_owned', type: 'SINGLE_SELECT' },
  { key: 'unit_paid_to_date', questionCode: 'unit_paid_to_date', type: 'NUMERIC' },
  { key: 'unit_down_payment', questionCode: 'unit_down_payment', type: 'NUMERIC' },
  { key: 'unit_contract_price', questionCode: 'unit_contract_price', type: 'NUMERIC' },
  { key: 'unit_months_owned', questionCode: 'unit_months_owned', type: 'NUMERIC' },
  { key: 'unit_owned_share_pct', questionCode: 'unit_owned_share_pct', type: 'NUMERIC' },
];

const ctx: IncomeRuleValidationContext = {
  isActiveMember: async () => true,
  activeMembers: async () => [],
  surrogateFacts: async () => FACTS,
  questionOptionCodes: async (questionCode) =>
    questionCode === 'owned_unit_type' ? ['apartment', 'twin_or_town_house', 'villa'] : [],
};

function bands(): Record<string, unknown> {
  return { bands: [{ fromInclusive: '250000', toExclusive: null, incomeEGP: '750000' }] };
}

/** The FABMISR program as it stands today: one way, two columns, and every condition off. */
function fabmisr(over: Partial<IncomeAssumptionConfig> = {}): IncomeAssumptionConfig {
  return asConfig({
    ...COMPOUND_RULE,
    amounts: 'own',
    wayId: 'alt',
    stepParams: { alt: bands(), alt__top_up: bands() },
    ...over,
  });
}

describe('a bank program must name exactly one of an exclusive product’s ways', () => {
  it('accepts a program that fills one way across two columns', async () => {
    expect(await validateIncomeRule(fabmisr(), ctx)).toBeUndefined();
  });

  it('refuses a program that has not said which way it sells', async () => {
    const violation = await validateIncomeRule(fabmisr({ wayId: undefined }), ctx);
    expect(violation).toEqual({
      kind: 'incomeWayRequired',
      wayIds: [
        'primary',
        'alt',
        'alt__unit_paid_to_date',
        'alt__owned_unit_type',
        'alt__unit_down_payment',
      ],
    });
  });

  it('refuses figures under a way this program does not sell', async () => {
    const violation = await validateIncomeRule(
      fabmisr({
        stepParams: {
          alt: bands(),
          alt__unit_paid_to_date: { scalar: { value: '15', unit: 'percent' } },
        },
      }),
      ctx,
    );
    expect(violation).toEqual({
      kind: 'incomeWayConflict',
      wayId: 'alt',
      alsoFilled: ['alt__unit_paid_to_date'],
    });
  });

  it('refuses a way id the product does not offer', async () => {
    const violation = await validateIncomeRule(fabmisr({ wayId: 'alt__nothing' }), ctx);
    expect(violation).toEqual({
      kind: 'productRuleInvalid',
      reason: 'way_unknown',
      detail: 'alt__nothing',
    });
  });

  it('refuses a way named on a product that combines its ways', async () => {
    const combined = asConfig({
      ...(compileTemplate(CROSSSELL) as ProductRule),
      amounts: 'own',
      wayId: 'primary',
      stepParams: {
        primary: { scalar: { value: '3', unit: 'multiplier' } },
        alt: { scalar: { value: '10', unit: 'percent' } },
      },
    });
    expect(await validateIncomeRule(combined, autoCtx)).toEqual({
      kind: 'productRuleInvalid',
      reason: 'way_not_applicable',
      detail: 'primary',
    });
  });

  it('still lets the one sheet that pairs two ways fill both', async () => {
    // App. A §4. The exception a global rule would have broken, and the reason `combine`
    // could not be the flag: this product carries `'lower'` too.
    const both = asConfig({
      ...(compileTemplate(CROSSSELL) as ProductRule),
      amounts: 'own',
      stepParams: {
        primary: { scalar: { value: '3', unit: 'multiplier' } },
        alt: { scalar: { value: '10', unit: 'percent' } },
      },
    });
    expect(await validateIncomeRule(both, autoCtx)).toBeUndefined();
  });

  it('says nothing about ways on a CATALOG write, which states them and picks none', async () => {
    // `figuresRequired: false` is the axis that exempts the catalog write, the raw step
    // editor, the template compile and both seeds — in one gate, so none of them can start
    // refusing.
    const catalog = asConfig({ ...COMPOUND_RULE, stepParams: {} });
    expect(await validateIncomeRule(catalog, ctx, { figuresRequired: false })).toBeUndefined();
  });
});

const autoCtx: IncomeRuleValidationContext = {
  isActiveMember: async () => true,
  activeMembers: async () => [],
  surrogateFacts: async () => [
    { key: 'car_loan_installment', questionCode: 'car_loan_installment', type: 'NUMERIC' },
    { key: 'auto_loan_amount', questionCode: 'auto_loan_amount', type: 'NUMERIC' },
  ],
  questionOptionCodes: async () => [],
};

// ---------------------------------------------------------------------------
// Persist, and inherit
// ---------------------------------------------------------------------------

describe('narrowing a rule to the way it sells', () => {
  /**
   * NOT what the save does. A save carrying another way's figures is REFUSED by name
   * (`PROGRAM_INCOME_WAY_CONFLICT`) — the two cannot both happen, because the persist chain
   * produces the object the validator is handed, so a strip there would delete the evidence
   * before the refusal could see it. That was measured, not reasoned about: the refusal
   * answered 200 over HTTP until the strip came back out.
   *
   * What this narrowing is FOR is the inheritance path, where there is nobody to refuse: the
   * catalog fills four heads and a bank on `amounts: 'catalog'` must receive one.
   */
  const narrow = (config: IncomeAssumptionConfig): IncomeAssumptionConfig =>
    stripCatalogStructure(
      stripUnchosenWays(config, effectiveIncomeRule(config, asConfig(COMPOUND_RULE))),
    );

  it('keeps the chosen way, both its columns and everything that is not a way', () => {
    const stored = narrow(
      asConfig({
        strategy: PRODUCT_RULE_STRATEGY,
        amounts: 'own',
        wayId: 'alt',
        stepParams: {
          alt: bands(),
          alt__top_up: bands(),
          cond__ownedlongenough: { minValue: '18' },
        },
      }),
    );
    expect(Object.keys(stored.stepParams ?? {}).sort()).toEqual([
      'alt',
      'alt__top_up',
      'cond__ownedlongenough',
    ]);
  });

  it('drops another way’s head, its columns and its pick', () => {
    const stored = narrow(
      asConfig({
        strategy: PRODUCT_RULE_STRATEGY,
        amounts: 'own',
        wayId: 'primary',
        stepParams: {
          primary: { keyTable: [{ key: 'compound_tier_a', incomeEGP: '4000000' }] },
          alt: bands(),
          alt__top_up: bands(),
          alt_pick: {},
        },
      }),
    );
    expect(Object.keys(stored.stepParams ?? {})).toEqual(['primary']);
  });

  it('touches nothing on a product whose ways combine', () => {
    const combined = asConfig({
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'own',
      stepParams: {
        primary: { scalar: { value: '3', unit: 'multiplier' } },
        alt: { scalar: { value: '10', unit: 'percent' } },
      },
    });
    const effective = effectiveIncomeRule(combined, asConfig(compileTemplate(CROSSSELL)));
    expect(stripUnchosenWays(combined, effective)).toBe(combined);
  });
});

describe('catalog amounts inherit the chosen way only', () => {
  /** The catalog's own defaults, filling FOUR of the five way heads. */
  const catalog = asConfig({
    ...COMPOUND_RULE,
    stepParams: {
      primary: { keyTable: [{ key: 'compound_tier_a', incomeEGP: '4000000' }] },
      alt: bands(),
      alt__unit_paid_to_date: { scalar: { value: '15', unit: 'percent' } },
      alt__owned_unit_type: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] },
      cond__ownedlongenough: { minValue: '18' },
    },
  });

  it('hands a bank one mechanism instead of the lower of four', () => {
    const effective = effectiveIncomeRule(
      asConfig({ strategy: PRODUCT_RULE_STRATEGY, amounts: 'catalog', wayId: 'primary' }),
      catalog,
    );
    expect(Object.keys(effective.stepParams ?? {}).sort()).toEqual([
      'cond__ownedlongenough',
      'primary',
    ]);
  });

  it('still delivers the catalog’s conditions, which is the existing bargain', () => {
    const effective = effectiveIncomeRule(
      asConfig({ strategy: PRODUCT_RULE_STRATEGY, amounts: 'catalog', wayId: 'alt' }),
      catalog,
    );
    expect(effective.stepParams?.['cond__ownedlongenough']).toEqual({ minValue: '18' });
  });

  it('inherits everything when the product does not hold its ways as alternatives', () => {
    const combinedCatalog = asConfig({
      ...(compileTemplate(CROSSSELL) as ProductRule),
      stepParams: {
        primary: { scalar: { value: '3', unit: 'multiplier' } },
        alt: { scalar: { value: '10', unit: 'percent' } },
      },
    });
    const effective = effectiveIncomeRule(
      asConfig({ strategy: PRODUCT_RULE_STRATEGY, amounts: 'catalog' }),
      combinedCatalog,
    );
    expect(Object.keys(effective.stepParams ?? {}).sort()).toEqual(['alt', 'primary']);
  });

  it('narrows nothing when the program has not named a way — a read invents no choice', () => {
    const effective = effectiveIncomeRule(
      asConfig({ strategy: PRODUCT_RULE_STRATEGY, amounts: 'catalog' }),
      catalog,
    );
    expect(Object.keys(effective.stepParams ?? {}).length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

describe('the engine is unchanged: one filled way still returns that way’s figure', () => {
  it('quotes the chosen way and nothing else', () => {
    const rule: ProductRule = {
      ...COMPOUND_RULE,
      wayId: 'alt__unit_paid_to_date',
      stepParams: { alt__unit_paid_to_date: { scalar: { value: '50', unit: 'percent' } } },
    };
    const outcome = evaluateProductRule(rule, {
      facts: {
        unit_paid_to_date: { kind: 'numeric', value: new Decimal('1000000') },
        unit_owned_share_pct: { kind: 'numeric', value: new Decimal('100') },
      },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.valueEGP.toFixed(2)).toBe('500000.00');
  });

  it('scales by the share the applicant owns, which is not a way and survives the prune', () => {
    const rule: ProductRule = {
      ...COMPOUND_RULE,
      wayId: 'alt__unit_paid_to_date',
      stepParams: { alt__unit_paid_to_date: { scalar: { value: '50', unit: 'percent' } } },
    };
    const outcome = evaluateProductRule(rule, {
      facts: {
        unit_paid_to_date: { kind: 'numeric', value: new Decimal('1000000') },
        unit_owned_share_pct: { kind: 'numeric', value: new Decimal('40') },
      },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.valueEGP.toFixed(2)).toBe('200000.00');
  });
});
