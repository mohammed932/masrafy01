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
 *   2. **One sheet's two terms are ONE way.** `auto_loan_crosssell` is App. A §4, "3 × the car
 *      instalment OR 10% of the auto loan, whichever is less" — one sentence a bank fills both
 *      halves of. It declares `waysAre: 'combined'`, `waysOfRule` folds its heads into one way
 *      whose slots are the UNION, and both ABK programs name that way and keep filling both
 *      boxes. `combine` cannot be the flag: the compound product carries `'lower'` too.
 *   3. **Every product-backed program names exactly one way.** Absent `waysAre` reads as
 *      exclusive (a product that forgot to say is asked, not folded); a single-way product's
 *      one way is `primary`; and `surrogateProductKey` on the validator is what scopes the rule
 *      to programs under a product, so a hand-wired pipeline on an unlinked name is never asked.
 *      Byte-stability (§5.4) holds because the flag is emitted only on a template with two or
 *      more ways.
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

/** What the save path passes: the product the rule is read from. Absent = not product-backed. */
const asCompound = { surrogateProductKey: 'compound_owner' } as const;
const asCrossSell = { surrogateProductKey: 'auto_loan_crosssell' } as const;

const SINGLE: ProductTemplate = {
  version: 1,
  outputKind: 'monthlyIncome',
  primary: { kind: 'flatAmount' },
  conditions: [],
};

// ---------------------------------------------------------------------------
// The form declares it
// ---------------------------------------------------------------------------

describe('a product declares whether its ways are alternatives', () => {
  it('reads an absent flag as exclusive, so a product that forgot to say is asked, not folded', () => {
    expect(waysAreOf({ ...CROSSSELL, waysAre: undefined })).toBe('exclusive');
    expect(waysAreOf({ ...COMPOUND, waysAre: undefined })).toBe('exclusive');
  });

  it('has the auto cross-sell state that its two terms are one way', () => {
    expect(CROSSSELL.waysAre).toBe('combined');
    expect(waysAreOf(CROSSSELL)).toBe('combined');
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
    expect(waysOfRule(COMPOUND_RULE).length).toBeGreaterThanOrEqual(2);
    expect((compileTemplate(CROSSSELL) as ProductRule).waysAre).toBe('combined');
  });

  it('leaves a single-way product compiling byte-identically, with no flag at all', () => {
    // The default flipped to exclusive, so byte-stability (§5.4) is carried by the compiler
    // instead: nothing is emitted unless the template has two or more ways to relate.
    expect((compileTemplate(SINGLE) as ProductRule).waysAre).toBeUndefined();
    expect(compileTemplate({ ...COMPOUND, waysAre: undefined })).toEqual(
      compileTemplate({ ...COMPOUND, waysAre: 'exclusive' }),
    );
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

  it("names a one-way product's single way `primary`, so a program can record it", () => {
    const single = compileTemplate(SINGLE) as ProductRule;
    expect(waysOfRule(single)).toEqual([{ id: 'primary', slots: ['primary'] }]);
  });

  it('finds no way at all in a hand-wired pipeline that names no `primary`', () => {
    const single = compileTemplate(SINGLE) as ProductRule;
    const renamed: ProductRule = {
      ...single,
      steps: single.steps.map((step) => (step.id === 'primary' ? { ...step, id: 'lump' } : step)),
      output: { ...single.output, from: 'lump' },
    };
    expect(waysOfRule(renamed)).toEqual([]);
  });

  it("folds a combined product's two heads into ONE way whose slots are the UNION", () => {
    // The union is what a catalog-amounts program inherits by. The first head's slots alone
    // would drop `alt` and quote 3 × the instalment with the 10% clamp silently gone.
    expect(waysOfRule(compileTemplate(CROSSSELL) as ProductRule)).toEqual([
      { id: 'primary', slots: ['primary', 'alt'] },
    ]);
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
  // Platform-owned; every income product's rule reads it since `iScore: true` went universal.
  { key: 'i_score', questionCode: 'i_score', type: 'NUMERIC' },
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
    expect(await validateIncomeRule(fabmisr(), ctx, asCompound)).toBeUndefined();
  });

  it('refuses a program that has not said which way it sells', async () => {
    const violation = await validateIncomeRule(fabmisr({ wayId: undefined }), ctx, asCompound);
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
      asCompound,
    );
    expect(violation).toEqual({
      kind: 'incomeWayConflict',
      wayId: 'alt',
      alsoFilled: ['alt__unit_paid_to_date'],
    });
  });

  it('refuses a way id the product does not offer, by name, with the real list', async () => {
    // A real sentence, not a `PRODUCT_RULE_INVALID` reason: a stale id is now the NORMAL result
    // of changing the program name, and a reason would ship its English token into the Arabic UI.
    const violation = await validateIncomeRule(fabmisr({ wayId: 'alt__nothing' }), ctx, asCompound);
    expect(violation).toEqual({
      kind: 'incomeWayUnknown',
      wayId: 'alt__nothing',
      wayIds: [
        'primary',
        'alt',
        'alt__unit_paid_to_date',
        'alt__owned_unit_type',
        'alt__unit_down_payment',
      ],
    });
  });

  /** The ABK cross-sell as it stands: both terms filled, the one way named or not. */
  const crossSell = (wayId?: string): IncomeAssumptionConfig =>
    asConfig({
      ...(compileTemplate(CROSSSELL) as ProductRule),
      amounts: 'own',
      ...(wayId === undefined ? {} : { wayId }),
      stepParams: {
        primary: { scalar: { value: '3', unit: 'multiplier' } },
        alt: { scalar: { value: '10', unit: 'percent' } },
      },
    });

  it('still lets the one sheet that pairs two ways fill both — as ONE named way', async () => {
    // App. A §4. Operator decision: the whole sentence is the method. Both boxes stay filled,
    // and the program names the one way that holds them.
    expect(await validateIncomeRule(crossSell('primary'), autoCtx, asCrossSell)).toBeUndefined();
  });

  it('asks the cross-sell for its one way like any other program', async () => {
    expect(await validateIncomeRule(crossSell(), autoCtx, asCrossSell)).toEqual({
      kind: 'incomeWayRequired',
      wayIds: ['primary'],
    });
  });

  it('refuses a TERM of the combined way named as if it were a way of its own', async () => {
    // `alt` is a SLOT of the one way, not its id — exactly the value a careless backfill would
    // write, and what `wayOwnedSlots` would answer with an empty set for.
    expect(await validateIncomeRule(crossSell('alt'), autoCtx, asCrossSell)).toEqual({
      kind: 'incomeWayUnknown',
      wayId: 'alt',
      wayIds: ['primary'],
    });
  });

  /** A single-way product: one `shareOf` over a number the applicant states. */
  const single = (wayId?: string): IncomeAssumptionConfig =>
    asConfig({
      ...(compileTemplate({
        version: 1,
        outputKind: 'monthlyIncome',
        primary: { kind: 'shareOf', fact: 'auto_loan_amount' },
        conditions: [],
      }) as ProductRule),
      amounts: 'own',
      ...(wayId === undefined ? {} : { wayId }),
      stepParams: { primary: { scalar: { value: '10', unit: 'percent' } } },
    });

  it("asks a single-way product's program for its one way, and accepts `primary`", async () => {
    expect(await validateIncomeRule(single(), autoCtx, { surrogateProductKey: 'x' })).toEqual({
      kind: 'incomeWayRequired',
      wayIds: ['primary'],
    });
    expect(
      await validateIncomeRule(single('primary'), autoCtx, { surrogateProductKey: 'x' }),
    ).toBeUndefined();
  });

  it('never asks a pipeline that no surrogate product stands behind', async () => {
    // A `steps` rule hand-wired on an UNLINKED catalog name offers a calculation, not a
    // catalogue of ways. The save path passes no `surrogateProductKey` for it, and it is held
    // to nothing — however many heads it happens to have.
    expect(await validateIncomeRule(single(), autoCtx)).toBeUndefined();
    expect(await validateIncomeRule(fabmisr({ wayId: undefined }), ctx)).toBeUndefined();
    expect(await validateIncomeRule(crossSell(), autoCtx)).toBeUndefined();
  });

  it('still refuses a way named on a pipeline that offers none, product or not', async () => {
    // Deliberately outside the product gate: it cannot leak onto a payslip program (wrong
    // strategy), and it is what catches a program dragged onto a raw-pipeline name.
    const base = compileTemplate({
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'shareOf', fact: 'auto_loan_amount' },
      conditions: [],
    }) as ProductRule;
    const noWay = asConfig({
      ...base,
      steps: base.steps.map((step) => (step.id === 'primary' ? { ...step, id: 'lump' } : step)),
      output: { ...base.output, from: 'lump' },
      amounts: 'own',
      wayId: 'primary',
      stepParams: { lump: { scalar: { value: '10', unit: 'percent' } } },
    });
    const expected = { kind: 'productRuleInvalid', reason: 'way_not_applicable', detail: 'primary' };
    expect(await validateIncomeRule(noWay, autoCtx)).toEqual(expected);
    expect(await validateIncomeRule(noWay, autoCtx, { surrogateProductKey: 'x' })).toEqual(expected);
  });

  it('says nothing about ways on a CATALOG write, which states them and picks none', async () => {
    // `figuresRequired: false` is the axis that exempts the catalog write, the raw step
    // editor, the template compile and the blueprint seed — in one gate, so none of them can
    // start refusing, product-backed or not.
    const catalog = asConfig({ ...COMPOUND_RULE, stepParams: {} });
    expect(
      await validateIncomeRule(catalog, ctx, { figuresRequired: false, ...asCompound }),
    ).toBeUndefined();
  });
});

const autoCtx: IncomeRuleValidationContext = {
  isActiveMember: async () => true,
  activeMembers: async () => [],
  surrogateFacts: async () => [
    { key: 'car_loan_installment', questionCode: 'car_loan_installment', type: 'NUMERIC' },
    { key: 'auto_loan_amount', questionCode: 'auto_loan_amount', type: 'NUMERIC' },
    { key: 'i_score', questionCode: 'i_score', type: 'NUMERIC' },
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

  it('touches nothing on a product whose ways combine — the SAME object comes back', () => {
    const combined = asConfig({
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'own',
      wayId: 'primary',
      stepParams: {
        primary: { scalar: { value: '3', unit: 'multiplier' } },
        alt: { scalar: { value: '10', unit: 'percent' } },
      },
    });
    const effective = effectiveIncomeRule(combined, asConfig(compileTemplate(CROSSSELL)));
    expect(stripUnchosenWays(combined, effective)).toBe(combined);
  });

  it('touches nothing on a single-way product either — callers memoise on identity', () => {
    const one = asConfig({
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'own',
      wayId: 'primary',
      stepParams: { primary: { valueEGP: '5000' } },
    });
    const effective = effectiveIncomeRule(one, asConfig(compileTemplate(SINGLE)));
    expect(stripUnchosenWays(one, effective)).toBe(one);
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

  it("inherits BOTH terms of a combined product's one way — the load-bearing union", () => {
    // Operator decision #2 in test form. A grouping that took the first head's slots instead
    // of the union would drop `alt` here and quote 3 × the instalment with the clamp gone.
    const combinedCatalog = asConfig({
      ...(compileTemplate(CROSSSELL) as ProductRule),
      stepParams: {
        primary: { scalar: { value: '3', unit: 'multiplier' } },
        alt: { scalar: { value: '10', unit: 'percent' } },
      },
    });
    for (const wayId of ['primary', undefined]) {
      const effective = effectiveIncomeRule(
        asConfig({
          strategy: PRODUCT_RULE_STRATEGY,
          amounts: 'catalog',
          ...(wayId === undefined ? {} : { wayId }),
        }),
        combinedCatalog,
      );
      expect(Object.keys(effective.stepParams ?? {}).sort()).toEqual(['alt', 'primary']);
    }
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
