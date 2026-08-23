/**
 * Save-time validation of a step pipeline, and the catalog / bank split around it.
 *
 * Two properties, both of which fail silently if they are not held:
 *
 *   1. **The pipeline is refused at SAVE, not at quote.** A step reading a fact the
 *      registry cannot serve, a reference to a step that does not exist yet, a gate with
 *      no bound — every one of those saves clean and then reports "no figures" to every
 *      applicant, which reads as a broken product rather than an unfinished one.
 *
 *   2. **Structure is the catalog's, figures are the bank's, and neither can store the
 *      other's half.** A bank row carrying its own copy of the steps would go on running
 *      yesterday's pipeline after the catalog changed the product; a catalog row losing
 *      its steps on its own save would destroy the product outright.
 */

import { describe, expect, it } from 'vitest';
import {
  stripForeignMethodConfig,
  validateIncomeRule,
} from '@/bank-programs/validation/income-rule.validator';
import {
  effectiveIncomeRule,
  stripCatalogStructure,
  stripInheritedAmounts,
} from '@/matching/pipeline/income-rule-inherit';
import { markablePaths } from '@/bank-programs/validation/value-sources.validator';
import { PRODUCT_RULE_STRATEGY, type IncomeAssumptionConfig } from '@/matching/types';
import type { SurrogateFactBinding } from '@/matching/pipeline/surrogate-fact-registry';

const UNIT_TYPE: SurrogateFactBinding = {
  key: 'compound_unit_type',
  questionCode: 'compound_unit_type',
  type: 'SINGLE_SELECT',
};
const UNIT_PRICE: SurrogateFactBinding = {
  key: 'compound_unit_price',
  questionCode: 'compound_unit_price',
  type: 'NUMERIC',
};
const CONTRACT_YEAR: SurrogateFactBinding = {
  key: 'compound_contract_year',
  questionCode: 'compound_contract_year',
  type: 'SINGLE_SELECT',
};

const DP_PERCENT: SurrogateFactBinding = {
  key: 'compound_dp_percent',
  questionCode: 'compound_dp_percent',
  type: 'NUMERIC',
};

const FACTS = [UNIT_TYPE, UNIT_PRICE, CONTRACT_YEAR, DP_PERCENT];
const UNIT_TYPE_OPTIONS = ['apartment', 'twin_townhouse', 'villa'];

function ctx(facts: readonly SurrogateFactBinding[] = FACTS, options = UNIT_TYPE_OPTIONS) {
  return {
    isActiveMember: async () => true,
    activeMembers: async () => [],
    surrogateFacts: async () => facts,
    questionOptionCodes: async () => options,
  };
}

/** The ABK compound rule, valid, as the catalog states it plus the bank's figures. */
function abkRule(over: Partial<IncomeAssumptionConfig> = {}): IncomeAssumptionConfig {
  return {
    strategy: PRODUCT_RULE_STRATEGY,
    steps: [
      { id: 'price', op: 'factNumber', fact: 'compound_unit_price' },
      { id: 'capByType', op: 'factChoiceTable', fact: 'compound_unit_type' },
      { id: 'uplifted', op: 'upliftPercent', of: { step: 'capByType' } },
      { id: 'amountMax', op: 'constant' },
      { id: 'ceiling', op: 'minOf', of: [{ step: 'uplifted' }, { step: 'amountMax' }] },
      { id: 'dpAmount', op: 'percentOf', of: { step: 'price' } },
    ],
    gates: [
      {
        id: 'dpFloor',
        kind: 'number',
        op: 'gte',
        left: { step: 'dpAmount' },
        reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
      },
    ],
    output: { kind: 'maxAmount', from: 'ceiling', baselineDbrPercent: '50' },
    stepParams: {
      capByType: {
        keyTable: [
          { key: 'apartment', incomeEGP: '2000000' },
          { key: 'villa', incomeEGP: '4000000' },
        ],
      },
      uplifted: { scalar: { value: '10', unit: 'percent' } },
      amountMax: { valueEGP: '4500000' },
      dpAmount: { scalar: { value: '20', unit: 'percent' } },
      dpFloor: { minValue: '250000' },
    },
    ...over,
  };
}

describe('validateProductRule — the pipeline itself', () => {
  it('accepts a complete rule', async () => {
    expect(await validateIncomeRule(abkRule(), ctx())).toBeUndefined();
  });

  it('refuses a rule with no steps or no output', async () => {
    const noSteps = await validateIncomeRule({ strategy: PRODUCT_RULE_STRATEGY }, ctx());
    expect(noSteps).toEqual({ kind: 'productRuleInvalid', reason: 'no_steps' });

    const noOutput = await validateIncomeRule(abkRule({ output: undefined }), ctx());
    expect(noOutput).toEqual({ kind: 'productRuleInvalid', reason: 'no_output' });
  });

  it('refuses an output naming a step the pipeline does not have', async () => {
    const violation = await validateIncomeRule(
      abkRule({ output: { kind: 'maxAmount', from: 'nope' } }),
      ctx(),
    );
    expect(violation).toMatchObject({ reason: 'unknown_output_step', stepId: 'nope' });
  });

  it('refuses a baseline DBR outside (0, 100]', async () => {
    for (const baselineDbrPercent of ['0', '-5', '101', 'abc']) {
      const violation = await validateIncomeRule(
        abkRule({ output: { kind: 'maxAmount', from: 'ceiling', baselineDbrPercent } }),
        ctx(),
      );
      expect(violation, baselineDbrPercent).toMatchObject({ reason: 'bad_baseline_dbr' });
    }
  });

  it('refuses an unknown op and a duplicate step id', async () => {
    const badOp = await validateIncomeRule(
      abkRule({ steps: [{ id: 'x', op: 'divideBy' as never }], gates: [], stepParams: {} }),
      ctx(),
    );
    expect(badOp).toMatchObject({ reason: 'unknown_op', stepId: 'x' });

    const dupe = await validateIncomeRule(
      abkRule({
        steps: [
          { id: 'a', op: 'constant' },
          { id: 'a', op: 'constant' },
        ],
        gates: [],
        stepParams: { a: { valueEGP: '1' } },
      }),
      ctx(),
    );
    expect(dupe).toMatchObject({ reason: 'duplicate_step_id', stepId: 'a' });
  });

  it('refuses a forward or self reference — the quote would read nothing', async () => {
    const forward = await validateIncomeRule(
      abkRule({
        steps: [
          { id: 'first', op: 'multiply', of: { step: 'later' } },
          { id: 'later', op: 'constant' },
        ],
        gates: [],
        stepParams: { later: { valueEGP: '10' }, first: { scalar: { value: '2', unit: 'multiplier' } } },
        output: { kind: 'maxAmount', from: 'later' },
      }),
      ctx(),
    );
    expect(forward).toMatchObject({ reason: 'unknown_step_reference', stepId: 'first' });

    const self = await validateIncomeRule(
      abkRule({
        steps: [{ id: 'loop', op: 'multiply', of: { step: 'loop' } }],
        gates: [],
        stepParams: { loop: { scalar: { value: '2', unit: 'multiplier' } } },
        output: { kind: 'maxAmount', from: 'loop' },
      }),
      ctx(),
    );
    expect(self).toMatchObject({ reason: 'forward_reference', stepId: 'loop' });
  });

  it('refuses a fact the registry cannot serve, naming the alternatives', async () => {
    const violation = await validateIncomeRule(
      abkRule({
        steps: [{ id: 'cap', op: 'factChoiceTable', fact: 'taxi_licence_class' }],
        stepParams: { cap: { keyTable: [{ key: 'a', incomeEGP: '1' }] } },
        gates: [],
        output: { kind: 'maxAmount', from: 'cap' },
      }),
      ctx(),
    );
    expect(violation).toMatchObject({ kind: 'factUnavailable', factKey: 'taxi_licence_class' });
  });

  it('refuses figures for a step the pipeline does not declare', async () => {
    const violation = await validateIncomeRule(
      abkRule({ stepParams: { ...abkRule().stepParams, ghostStep: { valueEGP: '1' } } }),
      ctx(),
    );
    expect(violation).toMatchObject({ reason: 'unknown_param_key', stepId: 'ghostStep' });
  });

  it('refuses subtract with the wrong number of inputs, and an input-less op', async () => {
    const badSubtract = await validateIncomeRule(
      abkRule({
        steps: [
          { id: 'a', op: 'constant' },
          { id: 'bad', op: 'subtract', of: [{ step: 'a' }] },
        ],
        stepParams: { a: { valueEGP: '5' } },
        gates: [],
        output: { kind: 'maxAmount', from: 'bad' },
      }),
      ctx(),
    );
    expect(badSubtract).toMatchObject({ reason: 'wrong_ref_count', stepId: 'bad', detail: '2' });

    const noInput = await validateIncomeRule(
      abkRule({
        steps: [{ id: 'bad', op: 'minOf' }],
        stepParams: {},
        gates: [],
        output: { kind: 'maxAmount', from: 'bad' },
      }),
      ctx(),
    );
    expect(noInput).toMatchObject({ reason: 'wrong_ref_count', stepId: 'bad' });
  });
});

describe('validateProductRule — the bank’s figures', () => {
  const withParams = (stepParams: IncomeAssumptionConfig['stepParams']) =>
    validateIncomeRule(abkRule({ stepParams }), ctx());

  it('reuses the single-fact row checks, and names the step', async () => {
    const base = abkRule().stepParams!;

    // A step outside every `coalesce` that the bank left entirely blank is reported as the
    // unfinished step it is, naming it — not as a table-level "empty", which read as though
    // a table existed and had no rows.
    const empty = await withParams({ ...base, capByType: {} });
    expect(empty).toMatchObject({ reason: 'unconfigured_step', stepId: 'capByType' });

    const dupe = await withParams({
      ...base,
      capByType: {
        keyTable: [
          { key: 'apartment', incomeEGP: '1' },
          { key: 'apartment', incomeEGP: '2' },
        ],
      },
    });
    expect(dupe).toMatchObject({ kind: 'duplicateKey', key: 'apartment', stepId: 'capByType' });

    const zero = await withParams({
      ...base,
      capByType: { keyTable: [{ key: 'apartment', incomeEGP: '0' }] },
    });
    expect(zero).toMatchObject({ kind: 'incomeInvalid', key: 'apartment', stepId: 'capByType' });
  });

  it('checks a choice step’s keys against the BOUND QUESTION’S options', async () => {
    const violation = await withParams({
      ...abkRule().stepParams!,
      capByType: { keyTable: [{ key: 'penthouse', incomeEGP: '3000000' }] },
    });
    expect(violation).toMatchObject({
      kind: 'unknownKey',
      key: 'penthouse',
      registry: 'compound_unit_type',
      stepId: 'capByType',
    });
  });

  it('refuses a non-positive or unparseable scalar', async () => {
    for (const value of ['0', '-1', 'ten']) {
      const violation = await withParams({
        ...abkRule().stepParams!,
        uplifted: { scalar: { value, unit: 'percent' } },
      });
      expect(violation, value).toMatchObject({ reason: 'bad_scalar', stepId: 'uplifted' });
    }
    // An EMPTY factor is not a bad factor — it is a step the bank has not filled in, and it
    // is reported as that.
    const blank = await withParams({
      ...abkRule().stepParams!,
      uplifted: { scalar: { value: '', unit: 'percent' } },
    });
    expect(blank).toMatchObject({ reason: 'unconfigured_step', stepId: 'uplifted' });
  });

  it('accepts a constant of ZERO — the idiom for clamping a subtraction', async () => {
    const rule = abkRule({
      steps: [
        { id: 'a', op: 'constant' },
        { id: 'b', op: 'constant' },
        { id: 'diff', op: 'subtract', of: [{ step: 'a' }, { step: 'b' }] },
        { id: 'zero', op: 'constant' },
        { id: 'ceiling', op: 'maxOf', of: [{ step: 'diff' }, { step: 'zero' }] },
      ],
      gates: [],
      stepParams: { a: { valueEGP: '100' }, b: { valueEGP: '400' }, zero: { valueEGP: '0' } },
      output: { kind: 'maxAmount', from: 'ceiling' },
    });
    expect(await validateIncomeRule(rule, ctx())).toBeUndefined();
  });

  it('runs the SAME band checks a single-fact rule gets', async () => {
    const banded = (bands: unknown) =>
      validateIncomeRule(
        abkRule({
          steps: [
            { id: 'price', op: 'factNumber', fact: 'compound_unit_price' },
            { id: 'ceiling', op: 'bandTable', of: { step: 'price' } },
          ],
          gates: [],
          stepParams: { ceiling: { bands } as never },
          output: { kind: 'maxAmount', from: 'ceiling' },
        }),
        ctx(),
      );

    expect(await banded([])).toMatchObject({ reason: 'unconfigured_step', stepId: 'ceiling' });
    expect(
      await banded([
        { fromInclusive: '0', toExclusive: '100', incomeEGP: '5' },
        { fromInclusive: '200', toExclusive: null, incomeEGP: '9' },
      ]),
    ).toMatchObject({ kind: 'bandsInvalid', stepId: 'ceiling' });
    expect(
      await banded([
        { fromInclusive: '0', toExclusive: '100', incomeEGP: '5' },
        { fromInclusive: '100', toExclusive: null, incomeEGP: '9' },
      ]),
    ).toBeUndefined();
  });
});

describe('validateProductRule — gates', () => {
  // `dpFloor` is dropped from the base figures: a gate with another id would leave them
  // stray, and this block is about the GATE, not about the stray-figure check.
  const withGate = (gate: unknown, params: Record<string, unknown> = {}) => {
    const { dpFloor: _dropped, ...figures } = abkRule().stepParams!;
    return validateIncomeRule(
      abkRule({ gates: [gate] as never, stepParams: { ...figures, ...(params as never) } }),
      ctx(),
    );
  };

  it('refuses a reason code no locale dictionary has a sentence for — even when unapplied', async () => {
    const violation = await withGate({
      id: 'weird',
      kind: 'number',
      op: 'gte',
      left: { step: 'dpAmount' },
      reasonCode: 'BECAUSE_I_SAID_SO',
    });
    expect(violation).toMatchObject({ reason: 'unknown_gate_reason', gateId: 'weird' });
  });

  it('a gate the bank never turned on is not a violation — it does not apply', async () => {
    const violation = await withGate(
      {
        id: 'dpFloor',
        kind: 'number',
        op: 'gte',
        left: { step: 'dpAmount' },
        reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
      },
      { dpFloor: {} },
    );
    expect(violation).toBeUndefined();
  });

  it('refuses an inverted between window', async () => {
    const violation = await withGate(
      {
        id: 'window',
        kind: 'number',
        op: 'between',
        left: { step: 'price' },
        reasonCode: 'CONTRACT_TOO_NEW',
      },
      { window: { minValue: '120', maxValue: '18' } },
    );
    expect(violation).toMatchObject({ reason: 'gate_bounds_missing', detail: 'min>max' });
  });

  it('refuses an empty expect list on a choice gate the bank applies', async () => {
    const violation = await withGate(
      {
        id: 'joint',
        kind: 'choice',
        op: 'eq',
        fact: 'compound_contract_year',
        expect: [],
        reasonCode: 'OWNERSHIP_NOT_CONFIRMED',
      },
      { joint: { applies: true } },
    );
    expect(violation).toMatchObject({ reason: 'gate_expect_empty', gateId: 'joint' });
  });

  it('accepts a numberByKey gate with a table, and refuses it empty', async () => {
    const gate = {
      id: 'priceFloor',
      kind: 'numberByKey',
      op: 'gte',
      left: { step: 'price' },
      keyedBy: 'compound_contract_year',
      reasonCode: 'UNIT_PRICE_BELOW_MIN',
    };
    expect(
      await withGate(gate, { priceFloor: { keyTable: [{ key: '2024', incomeEGP: '3000000' }] } }),
    ).toBeUndefined();
    // No table = the bank did not turn this gate on, which is not a violation.
    expect(await withGate(gate, { priceFloor: {} })).toBeUndefined();
  });

  it('accepts a bound of ZERO — "no minimum for this segment" is a real policy', async () => {
    const violation = await withGate(
      {
        id: 'dpFloor',
        kind: 'number',
        op: 'gte',
        left: { step: 'dpAmount' },
        reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
      },
      { dpFloor: { minValue: '0' } },
    );
    expect(violation).toBeUndefined();
  });
});

describe('catalog structure vs bank figures', () => {
  const catalogRule = (): IncomeAssumptionConfig => {
    const full = abkRule();
    const { stepParams: _ignored, ...structure } = full;
    return { ...structure, stepParams: { amountMax: { valueEGP: '3000000' } } };
  };

  it('a bank on its OWN amounts still gets the catalog’s steps', () => {
    const bankRow: IncomeAssumptionConfig = {
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'own',
      stepParams: abkRule().stepParams,
    };
    const effective = effectiveIncomeRule(bankRow, catalogRule());
    expect(effective.steps?.map((s) => s.id)).toEqual([
      'price',
      'capByType',
      'uplifted',
      'amountMax',
      'ceiling',
      'dpAmount',
    ]);
    // Its OWN figures, not the catalog's.
    expect(effective.stepParams?.['amountMax']).toEqual({ valueEGP: '4500000' });
  });

  it('a bank on CATALOG amounts gets the catalog’s figures too', () => {
    const bankRow: IncomeAssumptionConfig = {
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'catalog',
      stepParams: abkRule().stepParams,
    };
    const effective = effectiveIncomeRule(bankRow, catalogRule());
    expect(effective.stepParams?.['amountMax']).toEqual({ valueEGP: '3000000' });
  });

  it('stripInheritedAmounts removes stepParams for a catalog-amounts program', () => {
    const stored = stripInheritedAmounts({
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'catalog',
      stepParams: abkRule().stepParams,
    });
    expect(stored.stepParams).toBeUndefined();
    // And leaves them alone for a bank that states its own.
    const own = stripInheritedAmounts({
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'own',
      stepParams: abkRule().stepParams,
    });
    expect(own.stepParams).toBeDefined();
  });

  it('stripCatalogStructure keeps a bank row from storing the steps', () => {
    const stored = stripCatalogStructure(abkRule());
    expect(stored.steps).toBeUndefined();
    expect(stored.gates).toBeUndefined();
    expect(stored.output).toBeUndefined();
    expect(stored.stepParams).toBeDefined();
  });

  it('stripForeignMethodConfig keeps BOTH halves — the catalog saves through it too', () => {
    const kept = stripForeignMethodConfig(abkRule());
    expect(kept?.steps).toBeDefined();
    expect(kept?.output).toBeDefined();
    expect(kept?.stepParams).toBeDefined();
    // And drops another method's table, as it does for every strategy.
    const withForeign = stripForeignMethodConfig({
      ...abkRule(),
      keyTable: [{ key: 'major', incomeEGP: '20000' }],
    });
    expect(withForeign?.keyTable).toBeUndefined();
  });

  it('missing catalog rule leaves the program as it stands — no substituted structure', () => {
    const bankRow: IncomeAssumptionConfig = {
      strategy: PRODUCT_RULE_STRATEGY,
      amounts: 'own',
      stepParams: abkRule().stepParams,
    };
    expect(effectiveIncomeRule(bankRow, undefined)).toBe(bankRow);
  });
});

describe('estimated-value markers reach a step’s figures', () => {
  it('addresses a step table by step id then registry KEY, with no walker change', () => {
    const paths = markablePaths({ incomeAssumption: abkRule() } as never);
    expect(paths.has('incomeAssumption.stepParams.capByType.keyTable.apartment.incomeEGP')).toBe(true);
    expect(paths.has('incomeAssumption.stepParams.amountMax.valueEGP')).toBe(true);
    expect(paths.has('incomeAssumption.stepParams.dpFloor.minValue')).toBe(true);
  });
});

describe('coalesce — the catalog offers derivations, the bank picks one', () => {
  /** The compound frame all four banks share: four cap derivations, one chosen. */
  function frame(stepParams: IncomeAssumptionConfig['stepParams']): IncomeAssumptionConfig {
    return {
      strategy: PRODUCT_RULE_STRATEGY,
      steps: [
        { id: 'price', op: 'factNumber', fact: 'compound_unit_price' },
        { id: 'dpPct', op: 'factNumber', fact: 'compound_dp_percent' },
        { id: 'dpAmount', op: 'percentOf', of: [{ step: 'price' }, { step: 'dpPct' }] },
        { id: 'capByType', op: 'factChoiceTable', fact: 'compound_unit_type' },
        { id: 'capByBand', op: 'bandTable', of: { step: 'dpAmount' } },
        { id: 'capByPercent', op: 'percentOf', of: { step: 'dpAmount' } },
        { id: 'capBasis', op: 'coalesce', of: [
          { step: 'capByType' },
          { step: 'capByBand' },
          { step: 'capByPercent' },
        ] },
      ],
      gates: [],
      output: { kind: 'maxAmount', from: 'capBasis', baselineDbrPercent: '50' },
      stepParams,
    };
  }

  it('accepts a bank that fills exactly ONE derivation and leaves the rest blank', async () => {
    const byType = await validateIncomeRule(
      frame({ capByType: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] } }),
      ctx(),
    );
    expect(byType).toBeUndefined();

    const byPercent = await validateIncomeRule(
      frame({ capByPercent: { scalar: { value: '50', unit: 'percent' } } }),
      ctx(),
    );
    expect(byPercent).toBeUndefined();
  });

  it('refuses a bank that fills NONE of them', async () => {
    const violation = await validateIncomeRule(frame({}), ctx());
    expect(violation).toMatchObject({ reason: 'coalesce_empty', stepId: 'capBasis' });
  });

  /**
   * The real compound frame's first candidate is a `pickByFact` over two columns, and a
   * pick needs no figures of its OWN — `isStepConfigured` answers `true` for it
   * unconditionally, which made this whole guard unreachable for the ONE product it was
   * written for. A bank could save the compound rule with nothing but a down-payment floor
   * and then answer `rule_unconfigured` to every applicant, live and silent.
   */
  function pickFrame(stepParams: IncomeAssumptionConfig['stepParams']): IncomeAssumptionConfig {
    return {
      strategy: PRODUCT_RULE_STRATEGY,
      steps: [
        { id: 'capByType', op: 'factChoiceTable', fact: 'compound_unit_type' },
        { id: 'capByTypeTopUp', op: 'factChoiceTable', fact: 'compound_unit_type' },
        {
          id: 'capForSegment',
          op: 'pickByFact',
          fact: 'bank_relationship',
          branches: ['ntb', 'xsell'],
          of: [{ step: 'capByType' }, { step: 'capByTypeTopUp' }],
        },
        { id: 'capBasis', op: 'coalesce', of: [{ step: 'capForSegment' }] },
      ],
      gates: [],
      output: { kind: 'maxAmount', from: 'capBasis', baselineDbrPercent: '50' },
      stepParams,
    } as IncomeAssumptionConfig;
  }

  it('refuses a bank whose only candidate is a pick with both columns blank', async () => {
    const violation = await validateIncomeRule(pickFrame({}), ctx());
    expect(violation).toMatchObject({ reason: 'coalesce_empty', stepId: 'capBasis' });
  });

  it('accepts the same rule when EITHER column of the pick is filled', async () => {
    const first = await validateIncomeRule(
      pickFrame({ capByType: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] } }),
      ctx(),
    );
    expect(first).toBeUndefined();

    // The second column alone is a real configuration: the pick falls back to whichever
    // column the bank stated, so a bank selling only its existing customers still quotes.
    const second = await validateIncomeRule(
      pickFrame({ capByTypeTopUp: { keyTable: [{ key: 'apartment', incomeEGP: '3000000' }] } }),
      ctx(),
    );
    expect(second).toBeUndefined();
  });

  /**
   * The mixed-ref case, which the guard used to refuse.
   *
   * `multiUnitPct` and `jointPct` in the real compound rule are
   * `coalesce [{step: …}, {const: '100'}]` — the literal IS "this bank states no policy",
   * so there is nothing for the bank to leave blank and nothing to refuse. Testing only
   * "are there any step refs" reported these as producing nothing, and refused all four
   * live compound programs on their own save path while they were quoting correctly.
   */
  function withFallback(stepParams: IncomeAssumptionConfig['stepParams']): IncomeAssumptionConfig {
    const base = frame({ capByType: { keyTable: [{ key: 'apartment', incomeEGP: '2000000' }] } });
    return {
      ...base,
      steps: [
        ...(base.steps ?? []),
        // Stands in for the real rule's `jointFactor`/`multiUnitFactor`: an optional
        // choice table whose coalesce falls back to a literal 100 percent.
        { id: 'policyFactor', op: 'factChoiceTable', fact: 'compound_contract_year' },
        { id: 'policyPct', op: 'coalesce', of: [{ step: 'policyFactor' }, { const: '100' }] },
        { id: 'ceiling', op: 'percentOf', of: [{ step: 'capBasis' }, { step: 'policyPct' }] },
      ],
      output: { kind: 'maxAmount', from: 'ceiling', baselineDbrPercent: '50' },
      stepParams: { ...base.stepParams, ...stepParams },
    };
  }

  it('accepts a coalesce whose fallback is a literal, with the step left blank', async () => {
    expect(await validateIncomeRule(withFallback({}), ctx())).toBeUndefined();
  });

  it('still checks the step in a literal-fallback coalesce when the bank DID fill it', async () => {
    const violation = await validateIncomeRule(
      withFallback({ policyFactor: { keyTable: [{ key: 'not_an_option', incomeEGP: '50' }] } }),
      ctx(),
    );
    // Skipping the emptiness guard must not skip the figures.
    expect(violation).toMatchObject({ kind: 'unknownKey', stepId: 'policyFactor' });
  });

  it('still checks the rows of the derivation that IS filled', async () => {
    const violation = await validateIncomeRule(
      frame({ capByType: { keyTable: [{ key: 'penthouse', incomeEGP: '2000000' }] } }),
      ctx(),
    );
    expect(violation).toMatchObject({ kind: 'unknownKey', key: 'penthouse', stepId: 'capByType' });
  });
});
