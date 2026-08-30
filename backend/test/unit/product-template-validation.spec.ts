/**
 * The template layer against the EXISTING save-time validation.
 *
 * The claim being pinned is the one that decides whether this is a layer on top or a fork:
 * every shape the form can produce must be a rule `validateIncomeRule` already accepts,
 * with no change to that function. If a starter needed the validator relaxed, the form
 * would be authoring rules the rest of the platform does not trust.
 *
 * The second half pins the fence on `RuleStep.optional` — the one engine change — because
 * without it that flag is a way to make a REQUIRED answer silently vanish.
 */
import { describe, expect, it } from 'vitest';
import {
  blankTemplate,
  templateStarters,
  type TemplateStarter,
} from '@/matching/pipeline/product-template-starters';
import {
  MAX_WAYS,
  compileTemplate,
  validateTemplate,
  type ProductTemplate,
} from '@/matching/pipeline/product-template';
import { validateIncomeRule } from '@/bank-programs/validation/income-rule.validator';
import type { IncomeRuleValidationContext } from '@/bank-programs/validation/income-rule.validator';
import type { IncomeAssumptionConfig } from '@/matching/types';
import type { ProductRule } from '@/matching/pipeline/product-rule';

/**
 * Every fact the starters could name exists and is answerable. The point of these cases is
 * the SHAPE, so the registry is permissive on purpose — a missing fact is
 * `INCOME_RULE_FACT_UNAVAILABLE`, which is a different test.
 */
const ctx: IncomeRuleValidationContext = {
  isActiveMember: async () => true,
  activeMembers: async () => ['a', 'b'],
  surrogateFacts: async () => [
    { key: 'military_grade', questionCode: 'military_grade', type: 'SINGLE_SELECT' },
    { key: 'compound_name', questionCode: 'compound_name', type: 'SINGLE_SELECT' },
    { key: 'i_score', questionCode: 'i_score', type: 'NUMERIC' },
    { key: 'amount_paid', questionCode: 'amount_paid', type: 'NUMERIC' },
    { key: 'years_in_practice', questionCode: 'years_in_practice', type: 'NUMERIC' },
  ],
  questionOptionCodes: async () => ['a', 'b'],
};

/** A starter with its fact filled in — the state right after the operator picks one. */
function filled(starter: TemplateStarter): ProductTemplate {
  const template = blankTemplate(starter);
  if (template.primary.kind === 'flatAmount') return template;
  const fact =
    template.primary.kind === 'choiceTable'
      ? 'military_grade'
      : template.primary.kind === 'classTable'
        ? 'compound_name'
        : 'amount_paid';
  return {
    ...template,
    primary: { ...template.primary, fact },
    ...(template.outputKind === 'maxAmount' ? { baselineDbrPercent: '50' } : {}),
  };
}

const asConfig = (rule: ProductRule): IncomeAssumptionConfig =>
  rule as unknown as IncomeAssumptionConfig;

describe('every starter compiles to a rule the existing validation accepts', () => {
  it.each(templateStarters().map((s) => [s.key, s] as const))('%s', async (_key, starter) => {
    const rule = compileTemplate(filled(starter));
    // `figuresRequired: false` is what a CATALOG write already uses: a product's figures are
    // its banks' to fill, and holding the frame to a bank's completeness would make a
    // multi-bank product unsavable. Same call the product endpoint makes.
    const violation = await validateIncomeRule(asConfig(rule), ctx, { figuresRequired: false });
    expect(violation).toBeUndefined();
  });

  it('accepts the whole form at once — two ways, two columns, a bonus, I-Score and a condition', async () => {
    const rule = compileTemplate({
      version: 1,
      outputKind: 'maxAmount',
      baselineDbrPercent: '50',
      primary: { kind: 'shareOf', fact: 'amount_paid' },
      alternative: { kind: 'classTable', fact: 'compound_name' },
      combine: 'lower',
      secondColumn: { fact: 'military_grade', branches: ['a', 'b'] },
      uplift: { fact: 'military_grade', whenOption: 'a', otherwiseOption: 'b' },
      iScore: true,
      conditions: [
        {
          id: 'down_payment',
          measure: { of: 'fact', fact: 'amount_paid' },
          test: { op: 'atLeastShareOf', fact: 'amount_paid' },
          reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
        },
        {
          id: 'ownership',
          measure: { of: 'fact', fact: 'military_grade' },
          test: { op: 'oneOf', expect: ['a'] },
          reasonCode: 'OWNERSHIP_NOT_CONFIRMED',
        },
      ],
    });
    expect(await validateIncomeRule(asConfig(rule), ctx, { figuresRequired: false })).toBeUndefined();
  });
});

describe('the fence on an optional answer', () => {
  const rule = (steps: ProductRule['steps'], from: string): IncomeAssumptionConfig =>
    asConfig({ strategy: 'steps', steps, gates: [], output: { kind: 'monthlyIncome', from } });

  it('accepts one whose skip a coalesce can absorb', async () => {
    const violation = await validateIncomeRule(
      rule(
        [
          { id: 'src', op: 'factNumber', fact: 'i_score', optional: true },
          { id: 'band', op: 'bandTable', of: { step: 'src' } },
          { id: 'factor', op: 'coalesce', of: [{ step: 'band' }, { const: '100' }] },
        ],
        'factor',
      ),
      ctx,
      { figuresRequired: false },
    );
    expect(violation).toBeUndefined();
  });

  it('refuses one nothing can absorb — the answer would just disappear', async () => {
    const violation = await validateIncomeRule(
      rule(
        [
          { id: 'src', op: 'factNumber', fact: 'i_score', optional: true },
          { id: 'band', op: 'bandTable', of: { step: 'src' } },
        ],
        'band',
      ),
      ctx,
      { figuresRequired: false },
    );
    expect(violation).toMatchObject({ reason: 'optional_step_not_skippable', stepId: 'src' });
  });

  it('refuses one whose only fallback depends on the SAME missing answer', async () => {
    // A coalesce whose other candidate is another step reading the same fact is no fallback
    // at all: the absence unsets both, and the rule ends `rule_unconfigured` anyway.
    const violation = await validateIncomeRule(
      rule(
        [
          { id: 'src', op: 'factNumber', fact: 'i_score', optional: true },
          { id: 'band', op: 'bandTable', of: { step: 'src' } },
          { id: 'other', op: 'bandTable', of: { step: 'src' } },
          { id: 'factor', op: 'coalesce', of: [{ step: 'band' }, { step: 'other' }] },
        ],
        'factor',
      ),
      ctx,
      { figuresRequired: false },
    );
    expect(violation).toMatchObject({ reason: 'optional_step_not_skippable' });
  });

  it('refuses the flag on an op that reads no answer, where it does nothing at all', async () => {
    const violation = await validateIncomeRule(
      rule(
        [
          { id: 'src', op: 'constant', optional: true },
          { id: 'factor', op: 'coalesce', of: [{ step: 'src' }, { const: '100' }] },
        ],
        'factor',
      ),
      ctx,
      { figuresRequired: false },
    );
    expect(violation).toMatchObject({ reason: 'optional_step_not_skippable', detail: 'constant' });
  });

  it('leaves a rule that uses no optional step alone', async () => {
    const violation = await validateIncomeRule(
      rule([{ id: 'a', op: 'factChoiceTable', fact: 'military_grade' }], 'a'),
      ctx,
      { figuresRequired: false },
    );
    expect(violation).toBeUndefined();
  });

  it('refuses `skipUnset` on an op that has no blank member to skip', async () => {
    // The same reasoning as the `optional` fence: the flag changes what a COMPARISON does
    // with an unconfigured member, so anywhere else it does nothing — and a flag that does
    // nothing is one the next operator reads and believes.
    const violation = await validateIncomeRule(
      rule(
        [
          { id: 'a', op: 'factChoiceTable', fact: 'military_grade' },
          { id: 'b', op: 'coalesce', of: [{ step: 'a' }, { const: '1' }], skipUnset: true },
        ],
        'b',
      ),
      ctx,
      { figuresRequired: false },
    );
    expect(violation).toMatchObject({
      reason: 'skip_unset_not_applicable',
      stepId: 'b',
      detail: 'coalesce',
    });
  });
});

describe('what a recompile keeps', () => {
  // Pinned as a pure statement of the rule the service applies, so the intent survives a
  // refactor of the service itself: figures the new shape still has a box for are kept,
  // figures whose box is gone are dropped, and the boxes are the compiled param keys.
  const keysOf = (template: ProductTemplate): Set<string> =>
    new Set(compileTemplate(template).steps?.map((s) => s.id) ?? []);

  it('keeps the first way when a second is added', () => {
    const one = keysOf({
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'choiceTable', fact: 'military_grade' },
      conditions: [],
    });
    const two = keysOf({
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'choiceTable', fact: 'military_grade' },
      alternative: { kind: 'classTable', fact: 'compound_name' },
      conditions: [],
    });
    expect([...one].every((id) => two.has(id))).toBe(true);
  });

  it('drops the second way when it is removed — which is what the refusal is for', () => {
    const two = keysOf({
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'choiceTable', fact: 'military_grade' },
      alternative: { kind: 'classTable', fact: 'compound_name' },
      conditions: [],
    });
    const one = keysOf({
      version: 1,
      outputKind: 'monthlyIncome',
      primary: { kind: 'choiceTable', fact: 'military_grade' },
      conditions: [],
    });
    expect(two.has('alt')).toBe(true);
    expect(one.has('alt')).toBe(false);
  });
});

describe('the ways list', () => {
  const base = (over: Partial<ProductTemplate>): ProductTemplate => ({
    version: 1,
    outputKind: 'monthlyIncome',
    primary: { kind: 'choiceTable', fact: 'military_grade' },
    conditions: [],
    ...over,
  });

  it('refuses a template that spells its ways BOTH ways', () => {
    // The order decides slot ids, and there is no order that reconciles two lists nobody
    // wrote as one. Guessing here is a bank's figure landing in another bank's box.
    expect(
      validateTemplate(
        base({
          alternative: { kind: 'classTable', fact: 'compound_name' },
          alternatives: [{ kind: 'numberBand', fact: 'years_in_practice' }],
        }),
      ),
    ).toEqual({ reason: 'ways_double_spelled' });
  });

  it('refuses the same way listed twice', () => {
    expect(
      validateTemplate(
        base({
          alternatives: [
            { kind: 'classTable', fact: 'compound_name' },
            { kind: 'classTable', fact: 'compound_name' },
          ],
        }),
      ),
    ).toEqual({ reason: 'duplicate_way', detail: 'classTable|compound_name' });
  });

  it('refuses two DIFFERENT ways that would land on one slot', () => {
    // Past the first two, a way is named by the fact it reads — so two ways reading one fact
    // collide even though neither is the same mechanism as the other.
    expect(
      validateTemplate(
        base({
          alternatives: [
            { kind: 'numberBand', fact: 'years_in_practice' },
            { kind: 'classTable', fact: 'compound_name' },
            { kind: 'choiceTable', fact: 'compound_name' },
          ],
        }),
      ),
    ).toEqual({ reason: 'duplicate_way', detail: 'alt__compound_name' });
  });

  it('refuses more ways than the cap', () => {
    const tooMany = Array.from({ length: MAX_WAYS }, (_, i) => ({
      kind: 'numberBand' as const,
      fact: `fact_${i}`,
    }));
    expect(validateTemplate(base({ alternatives: tooMany }))).toEqual({
      reason: 'too_many_ways',
      detail: String(MAX_WAYS + 1),
    });
  });

  it('accepts three ways, and they compile to a rule the save-time validation takes', async () => {
    const template = base({
      outputKind: 'maxAmount',
      primary: { kind: 'shareOf', fact: 'amount_paid' },
      alternatives: [
        { kind: 'choiceTable', fact: 'military_grade' },
        { kind: 'classTable', fact: 'compound_name' },
      ],
      combine: 'lower',
    });
    expect(validateTemplate(template)).toBeUndefined();
    expect(
      await validateIncomeRule(asConfig(compileTemplate(template)), ctx, {
        figuresRequired: false,
      }),
    ).toBeUndefined();
  });
});
