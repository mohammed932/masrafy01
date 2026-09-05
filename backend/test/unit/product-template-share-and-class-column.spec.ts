/**
 * The two shapes the sheets state and the layer could not say, and the one refusal each.
 *
 *   1. HALVING on joint ownership. Two sheets say the imputed income is shared between the
 *      owners; the form carried one `uplift` and `upliftPercent` only adds. A bonus is not a
 *      share, and there was no second field.
 *   2. A column keyed by a CLASS. One sheet tiers Cairo & Alexandria against everywhere
 *      else; another tiers eight governorates against everywhere else. The platform's answer
 *      is one list of 27 governorates filed under three tiers, and a column matching option
 *      codes cannot read that list at all.
 *
 * What is pinned below is mostly what does NOT move: every template that predates these two
 * fields must compile to byte-identical steps under identical ids, or a bank's typed figures
 * are orphaned by an upgrade nobody asked for (§5.4).
 */
import { describe, expect, it } from 'vitest';
import {
  SLOT,
  compileTemplate,
  shareKindOf,
  shareScopeOf,
  sourceSlot,
  templateParamKeys,
  validateTemplate,
  type ProductTemplate,
} from '@/matching/pipeline/product-template';
import { evaluateProductRule } from '@/matching/pipeline/product-rule';
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

const quote = (
  rule: ProductRule,
  stepParams: ProductRule['stepParams'],
  facts: Record<string, SurrogateFactValue>,
  parentKeyByValue?: Record<string, string>,
) =>
  evaluateProductRule(
    { ...rule, stepParams },
    {
      facts,
      ...(parentKeyByValue ? { parentKeyByValue } : {}),
    },
  );

const GRADE_TABLE = { keyTable: [{ key: 'rank_major', incomeEGP: '30000' }] };

describe('a share of the figure, when one answer is given', () => {
  const jointly = base({
    share: {
      fact: 'joint_ownership',
      whenOption: 'joint_yes',
      otherwiseOption: 'joint_no',
      scope: 'income',
    },
  });

  it('halves the figure for the answer that says so', () => {
    const rule = compileTemplate(jointly);
    const result = quote(
      rule,
      { primary: GRADE_TABLE, [SLOT.shareOn]: { scalar: { value: '50', unit: 'percent' } } },
      { military_grade: choice('rank_major'), joint_ownership: choice('joint_yes') },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.valueEGP.toString()).toBe('15000');
  });

  it.each([
    ['the other answer', { joint_ownership: choice('joint_no') }],
    ['no answer at all', {}],
  ])('leaves the figure alone on %s', (_label, extra) => {
    const rule = compileTemplate(jointly);
    const result = quote(
      rule,
      { primary: GRADE_TABLE, [SLOT.shareOn]: { scalar: { value: '50', unit: 'percent' } } },
      { military_grade: choice('rank_major'), ...extra },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.valueEGP.toString()).toBe('30000');
  });

  it('leaves the figure alone when this bank states no percentage', () => {
    // A bank that does not halve anything must quote its standard column, not nothing.
    const rule = compileTemplate(jointly);
    const result = quote(
      rule,
      { primary: GRADE_TABLE },
      { military_grade: choice('rank_major'), joint_ownership: choice('joint_yes') },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.valueEGP.toString()).toBe('30000');
  });

  it('applies AFTER the uplift, so the same form always gives the same piastre', () => {
    // Rounding does not commute. +10% then halve is not halve then +10%, and the emission
    // order is what makes the answer a property of the form rather than of the tick order.
    const rule = compileTemplate(
      base({
        uplift: {
          fact: 'multi_unit',
          whenOption: 'multi_yes',
          otherwiseOption: 'multi_no',
          scope: 'income',
        },
        share: { fact: 'joint_ownership', whenOption: 'joint_yes', otherwiseOption: 'joint_no' },
      }),
    );
    const ids = rule.steps?.map((step) => step.id) ?? [];
    expect(ids.indexOf(SLOT.share)).toBeGreaterThan(ids.indexOf(SLOT.uplift));

    const result = quote(
      rule,
      {
        primary: { keyTable: [{ key: 'rank_major', incomeEGP: '30001' }] },
        [SLOT.upliftOn]: { scalar: { value: '10', unit: 'percent' } },
        [SLOT.shareOn]: { scalar: { value: '50', unit: 'percent' } },
      },
      {
        military_grade: choice('rank_major'),
        multi_unit: choice('multi_yes'),
        joint_ownership: choice('joint_yes'),
      },
    );
    // 30001 → +10% = 33001.10 → 50% = 16500.55. Both orders agree on THIS figure, and that
    // is the point of asserting the step order above rather than hunting for a pair that
    // diverges: `percentOf` rounds to two decimals at every hop, so which order is taken has
    // to be a property of the form. Pinning the order is what makes the figure reproducible;
    // pinning only the figure would pass under either order.
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.valueEGP.toString()).toBe('16500.55');
  });

  it('emits NOTHING when it halves the ceiling instead of the income', () => {
    // The cap is a bank setting (`loanLimits.maxLoanAdjustments`); emitting it here as well
    // would halve twice on any bank that configured both.
    const rule = compileTemplate(
      base({
        share: {
          fact: 'joint_ownership',
          whenOption: 'joint_yes',
          otherwiseOption: 'joint_no',
          scope: 'maxLoan',
        },
      }),
    );
    expect(rule.steps?.map((step) => step.id)).toEqual([SLOT.primary]);
  });

  it('reads an unstated scope as the income, and refuses one it does not know', () => {
    expect(shareScopeOf({ fact: 'j', whenOption: 'a', otherwiseOption: 'b' })).toBe('income');
    expect(
      validateTemplate(
        base({
          share: {
            fact: 'j',
            whenOption: 'a',
            otherwiseOption: 'b',
            scope: 'sideways' as never,
          },
        }),
      ),
    ).toEqual({ reason: 'unknown_adjustment_scope', detail: 'sideways' });
  });

  it('refuses one answer meaning both halved and not', () => {
    expect(
      validateTemplate(base({ share: { fact: 'j', whenOption: 'same', otherwiseOption: 'same' } })),
    ).toEqual({ reason: 'share_same_option', detail: 'same' });
  });
});

describe('a column keyed by the class an answer is filed under', () => {
  const byTier = base({
    primary: { kind: 'numberBand', fact: 'years_in_practice' },
    secondColumn: {
      fact: 'property_governorate',
      branches: ['city_tier_major', 'city_tier_other'],
      branchOn: 'parentClass',
    },
  });
  const FILED = { cairo: 'city_tier_major', tanta: 'city_tier_other' };
  const FIGURES = {
    primary: { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '120000' }] },
    [`${SLOT.primary}__city_tier_other`]: {
      bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '40000' }],
    },
  };

  it('reads the column of the class, not of the answer', () => {
    const rule = compileTemplate(byTier);
    const cairo = quote(
      rule,
      FIGURES,
      {
        years_in_practice: { kind: 'numeric', value: new Decimal('12') },
        property_governorate: choice('cairo'),
      },
      FILED,
    );
    const tanta = quote(
      rule,
      FIGURES,
      {
        years_in_practice: { kind: 'numeric', value: new Decimal('12') },
        property_governorate: choice('tanta'),
      },
      FILED,
    );
    expect(cairo.ok && cairo.valueEGP.toString()).toBe('120000');
    expect(tanta.ok && tanta.valueEGP.toString()).toBe('40000');
  });

  it('prices a value filed under NO class from the standard column', () => {
    // A column is not a requirement. The alternative — refusing — would blank the card of
    // an applicant the first column can price, over a lookup gap on an unrelated screen.
    const rule = compileTemplate(byTier);
    const result = quote(
      rule,
      FIGURES,
      {
        years_in_practice: { kind: 'numeric', value: new Decimal('12') },
        property_governorate: choice('somewhere_new'),
      },
      FILED,
    );
    expect(result.ok && result.valueEGP.toString()).toBe('120000');
  });

  it('keeps the first column on the bare id, exactly as an answer-keyed column does', () => {
    const plain = templateParamKeys(
      base({ primary: { kind: 'numberBand', fact: 'years_in_practice' } }),
    );
    const tiered = templateParamKeys(byTier);
    expect(plain.every((key) => tiered.includes(key))).toBe(true);
  });

  it('refuses a branching rule it cannot read', () => {
    expect(
      validateTemplate(
        base({
          secondColumn: {
            fact: 'property_governorate',
            branches: ['a', 'b'],
            branchOn: 'sideways' as never,
          },
        }),
      ),
    ).toEqual({ reason: 'second_column_branch_on_invalid', detail: 'sideways' });
  });
});

describe('what an upgrade must not move', () => {
  it.each([
    ['a plain table', base()],
    [
      'two ways',
      base({ alternatives: [{ kind: 'numberBand', fact: 'years_in_practice' }], combine: 'lower' }),
    ],
    [
      'a second column',
      base({ secondColumn: { fact: 'bank_relationship', branches: ['ntb', 'xsell'] } }),
    ],
    ['an uplift', base({ uplift: { fact: 'm', whenOption: 'y', otherwiseOption: 'n' } })],
    ['the bureau score', base({ iScore: true })],
  ])('compiles %s byte-identically with a blueprint key attached', (_label, template) => {
    // `blueprintKey` is provenance for the SCREEN. If it reached a slot id or an operand,
    // every product created from the library would be keyed differently from the same
    // product built by hand.
    const without = compileTemplate(template);
    const with_ = compileTemplate({ ...template, blueprintKey: 'armed_forces_grades' });
    expect(JSON.stringify(with_)).toBe(JSON.stringify(without));
  });

  it('compiles a template with no share exactly as it did before the field existed', () => {
    const rule = compileTemplate(base({ iScore: true }));
    expect(rule.steps?.some((step) => step.id === SLOT.share)).toBe(false);
    expect(rule.steps?.some((step) => step.id === SLOT.shareOn)).toBe(false);
  });

  it('omits `branchOn` from a column keyed by the answer', () => {
    // Not `branchOn: 'answer'`: the absent field is what every stored rule holds, and an
    // added field is a different blob to `stableJson`, which is what decides whether a
    // no-op save is logged as a change.
    const rule = compileTemplate(
      base({ secondColumn: { fact: 'bank_relationship', branches: ['ntb', 'xsell'] } }),
    );
    const pick = rule.steps?.find((step) => step.op === 'pickByFact');
    expect(pick).toBeDefined();
    expect(Object.hasOwn(pick as object, 'branchOn')).toBe(false);
  });
});

describe('a share the APPLICANT states, as a percentage', () => {
  const owned = (over: Partial<ProductTemplate> = {}): ProductTemplate =>
    base({
      share: { kind: 'statedPercent', fact: 'owned_share_pct', scope: 'income' },
      ...over,
    });

  const number = (value: string): SurrogateFactValue => ({
    kind: 'numeric',
    value: new Decimal(value),
  });

  it('scales the figure by the percentage, with no bank figure anywhere', () => {
    const rule = compileTemplate(owned());
    const at = (pct: string) =>
      quote(
        rule,
        { primary: GRADE_TABLE },
        { military_grade: choice('rank_major'), owned_share_pct: number(pct) },
      );
    // 30,000 filed against the grade. The bank states nothing about the share and cannot:
    // the portion is this applicant's answer, so a half-owner reaches the 50% two sheets
    // print and every other share is priced as what it is.
    for (const [pct, expected] of [
      ['100', '30000'],
      ['50', '15000'],
      ['40', '12000'],
    ] as const) {
      const result = at(pct);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.valueEGP.toString()).toBe(expected);
    }
  });

  it('emits ONE step and no `share_on` slot for a bank to fill', () => {
    // A slot with nothing to put in it renders as a box every bank is expected to fill, and
    // a bank that filled it would be stating a policy the applicant already answered.
    const rule = compileTemplate(owned());
    expect(rule.steps?.some((step) => step.id === SLOT.shareOn)).toBe(false);
    expect(templateParamKeys(owned())).not.toContain(SLOT.shareOn);
    const step = rule.steps?.find((s) => s.id === SLOT.share);
    expect(step?.op).toBe('percentOf');
    // One way, so the head is `primary` itself — `basis` only appears where ways combine.
    expect(step?.of).toEqual([{ step: SLOT.primary }, { step: sourceSlot('owned_share_pct') }]);
  });

  it('reads the percentage through the SAME source slot a way that bands it would use', () => {
    // One `factNumber` per fact, whoever reads it. Two would be two steps demanding one
    // answer, and a bank filing figures against the wrong one.
    const rule = compileTemplate(
      owned({ alternatives: [{ kind: 'numberBand', fact: 'owned_share_pct' }] }),
    );
    const sources = rule.steps?.filter((step) => step.id === sourceSlot('owned_share_pct')) ?? [];
    expect(sources).toHaveLength(1);
  });

  it('refuses to quote when the percentage was not answered', () => {
    // `fact_not_answered`, not a skip: the share is read on every quote this product makes,
    // so a missing answer is a question to ask and not a bank that declined a way.
    const result = quote(
      compileTemplate(owned()),
      { primary: GRADE_TABLE },
      { military_grade: choice('rank_major') },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('fact_not_answered');
      expect(result.factKey).toBe('owned_share_pct');
    }
  });

  it('emits NOTHING when it scales the ceiling instead of the income', () => {
    const rule = compileTemplate(
      owned({ share: { kind: 'statedPercent', fact: 'owned_share_pct', scope: 'maxLoan' } }),
    );
    // Not even the source step: a `factNumber` nothing reads is a question asked for no
    // reason, and the cap is scaled by bank configuration (`loanLimits.maxLoanAdjustments`).
    expect(rule.steps?.map((step) => step.id)).toEqual([SLOT.primary]);
  });

  it('reads an absent `kind` as the choice shape, so stored forms are unmoved', () => {
    expect(shareKindOf({ fact: 'j', whenOption: 'a', otherwiseOption: 'b' })).toBe('choice');
    expect(shareKindOf({ kind: 'statedPercent', fact: 'p' })).toBe('statedPercent');
    expect(shareScopeOf({ kind: 'statedPercent', fact: 'p' })).toBe('income');
  });

  it('refuses a share that names no fact, and a kind it does not know', () => {
    expect(validateTemplate(owned({ share: { kind: 'statedPercent', fact: '' } }))).toEqual({
      reason: 'share_needs_fact',
    });
    expect(
      validateTemplate(
        owned({
          share: { kind: 'nonsense', fact: 'p' } as unknown as ProductTemplate['share'],
        }),
      ),
    ).toEqual({ reason: 'unknown_share_kind', detail: 'nonsense' });
  });
});
