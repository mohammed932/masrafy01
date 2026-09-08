/**
 * One name, one income proof — the INHERITANCE half.
 *
 * A catalog program name states the proof and the figures every bank filed under it
 * starts from; a bank either takes those figures (`amounts: 'catalog'`) or types its
 * own (`amounts: 'own'`, and what every row written before the field existed means).
 *
 * Four things are pinned, each of which fails silently if it breaks:
 *
 *   1. An inheriting program is quoted off the CATALOG's table, and editing the catalog
 *      moves it. That is the difference between a link and a one-time copy, and a copy
 *      is exactly the drift the catalog exists to end.
 *   2. A program on its OWN figures ignores the catalog's TABLES entirely — the number a
 *      bank typed must never be silently replaced by someone else's. Two fields are
 *      deliberately outside that rule and are pinned as such: the debt-burden cap and the
 *      I-Score tier table are the product's DEFAULTS, read only where the bank states
 *      none of its own.
 *   3. ABSENT `amounts` reads as `'own'`. The stored book predates the field; a default
 *      of `'catalog'` would re-point every program at tables it has never quoted from.
 *   4. Inheriting from a name that states NOTHING resolves to a stated reason, never a
 *      figure and never a zero (FR-020).
 *
 * Plus the strip: a program on catalog amounts must STORE no table, or the link is a
 * copy wearing a link's label.
 */
import { describe, expect, it } from 'vitest';
import {
  withStoredStructure,
  effectiveIncomeRule,
  inheritsCatalogAmounts,
  stripCatalogStructure,
  stripInheritedAmounts,
} from '@/matching/pipeline/income-rule-inherit';
import { stripForeignMethodConfig } from '@/bank-programs/validation/income-rule.validator';
import { normalizeIncomeAssumption } from '@/matching/pipeline/income-rule-normalize';
import type { IncomeAssumptionConfig } from '@/matching/types';

/** The `professor` catalog rule, as the seed writes it. */
const CATALOG: IncomeAssumptionConfig = {
  strategy: 'byProfessorRank',
  keyTable: [
    { key: 'lecturer', incomeEGP: '12000' },
    { key: 'assistant_professor', incomeEGP: '18000' },
    { key: 'professor', incomeEGP: '25000' },
  ],
};

describe('catalog amounts — inherited', () => {
  it('quotes off the catalog table', () => {
    const program: IncomeAssumptionConfig = { strategy: 'byProfessorRank', amounts: 'catalog' };

    const effective = effectiveIncomeRule(program, CATALOG);

    expect(effective.keyTable).toEqual(CATALOG.keyTable);
    expect(effective.strategy).toBe('byProfessorRank');
  });

  it('follows a catalog edit — the link is live, not a copy', () => {
    const program: IncomeAssumptionConfig = { strategy: 'byProfessorRank', amounts: 'catalog' };
    const edited: IncomeAssumptionConfig = {
      ...CATALOG,
      keyTable: [{ key: 'lecturer', incomeEGP: '13000' }],
    };

    expect(effectiveIncomeRule(program, CATALOG).keyTable?.[0]?.incomeEGP).toBe('12000');
    expect(effectiveIncomeRule(program, edited).keyTable?.[0]?.incomeEGP).toBe('13000');
  });

  it('keeps the BANK’s policy while inheriting the figures', () => {
    // The whole reason policy is not inherited: a bank on the catalog's table may still
    // cap the debt burden its own way and demand its own documents.
    const program: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      amounts: 'catalog',
      dbrCapPercentOverride: '45',
      requiredDocuments: ['syndicate_card'],
      combinationRule: 'greater_of',
    };

    const effective = effectiveIncomeRule(program, {
      ...CATALOG,
      // Even if a catalog rule somehow carried policy, the program's wins.
      dbrCapPercentOverride: '60',
    });

    expect(effective.dbrCapPercentOverride).toBe('45');
    expect(effective.requiredDocuments).toEqual(['syndicate_card']);
    expect(effective.combinationRule).toBe('greater_of');
  });

  it('reads the catalog’s debt-burden cap only where the bank states none', () => {
    // The other half of the rule above, and the direction that decides what a live quote
    // does: a product states the cap once and every bank under it that has said nothing
    // reads it. `requiredDocuments` and `combinationRule` are NOT like that — they stay
    // the bank's, blank or not.
    const silent: IncomeAssumptionConfig = { strategy: 'byProfessorRank', amounts: 'catalog' };
    const catalog: IncomeAssumptionConfig = {
      ...CATALOG,
      dbrCapPercentOverride: '60',
      requiredDocuments: ['syndicate_card'],
      combinationRule: 'greater_of',
    };

    const effective = effectiveIncomeRule(silent, catalog);

    expect(effective.dbrCapPercentOverride).toBe('60');
    expect(effective.requiredDocuments).toBeUndefined();
    expect(effective.combinationRule).toBeUndefined();
  });

  it('drops a table the program left behind when it switched to catalog amounts', () => {
    // A blob mid-migration: `amounts` flipped but the old rows are still there. Quoting
    // them would be the program silently keeping numbers it no longer claims.
    const program: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      amounts: 'catalog',
      keyTable: [{ key: 'lecturer', incomeEGP: '99999' }],
    };

    expect(effectiveIncomeRule(program, CATALOG).keyTable).toEqual(CATALOG.keyTable);
  });

  it('inherits a LEGACY figure shape too', () => {
    // A catalog rule seeded from a legacy program can still carry `rankIncomeMap`.
    // Inheriting `keyTable` only would hand the resolver a rule with no table at all.
    const legacyCatalog: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      rankIncomeMap: { lecturer: '9000' },
    };
    const program: IncomeAssumptionConfig = { strategy: 'byProfessorRank', amounts: 'catalog' };

    const effective = normalizeIncomeAssumption(effectiveIncomeRule(program, legacyCatalog));

    expect(effective.keyTable).toEqual([{ key: 'lecturer', incomeEGP: '9000' }]);
  });
});

describe('own amounts — the catalog’s tables never touched', () => {
  it('ignores the catalog when `amounts` is explicit', () => {
    const program: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      amounts: 'own',
      keyTable: [{ key: 'lecturer', incomeEGP: '22000' }],
    };

    expect(effectiveIncomeRule(program, CATALOG)).toBe(program);
  });

  it('still reads the product’s debt-burden cap, and yields to the bank’s own', () => {
    const silent: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      amounts: 'own',
      keyTable: [{ key: 'lecturer', incomeEGP: '22000' }],
    };
    const catalog: IncomeAssumptionConfig = { ...CATALOG, dbrCapPercentOverride: '40' };

    expect(effectiveIncomeRule(silent, catalog).dbrCapPercentOverride).toBe('40');
    // The bank's tables are untouched either way — only the cap arrived.
    expect(effectiveIncomeRule(silent, catalog).keyTable).toEqual(silent.keyTable);
    expect(
      effectiveIncomeRule({ ...silent, dbrCapPercentOverride: '35' }, catalog)
        .dbrCapPercentOverride,
    ).toBe('35');
  });

  it('reads the product’s I-Score tiers for a bank that states none, and no other slot', () => {
    // The one per-slot exception. A blank way or condition means "this bank does not sell
    // that way" and must stay blank; a blank I-Score table has never meant a decline — the
    // compiled rule answers it with a literal 100% — so it reads the product's tiers.
    const productRule: IncomeAssumptionConfig = {
      strategy: 'steps',
      stepParams: {
        primary: { keyTable: [{ key: 'lecturer', incomeEGP: '30000' }] },
        iscore_band: {
          bands: [
            { fromInclusive: '0', toExclusive: '700', incomeEGP: '90' },
            { fromInclusive: '700', toExclusive: null, incomeEGP: '110' },
          ],
        },
      },
    } as unknown as IncomeAssumptionConfig;
    const bank: IncomeAssumptionConfig = {
      strategy: 'steps',
      amounts: 'own',
      stepParams: { primary: { keyTable: [{ key: 'lecturer', incomeEGP: '40000' }] } },
    } as unknown as IncomeAssumptionConfig;

    const effective = effectiveIncomeRule(bank, productRule);

    expect(effective.stepParams?.iscore_band).toEqual(productRule.stepParams?.iscore_band);
    // The bank's own figure, not the product's: only the tier slot was filled in.
    expect(effective.stepParams?.primary).toEqual(bank.stepParams?.primary);
  });

  it('leaves a bank’s OWN I-Score tiers alone', () => {
    const productRule: IncomeAssumptionConfig = {
      strategy: 'steps',
      stepParams: {
        iscore_band: { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '100' }] },
      },
    } as unknown as IncomeAssumptionConfig;
    const bank: IncomeAssumptionConfig = {
      strategy: 'steps',
      amounts: 'own',
      stepParams: {
        iscore_band: { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '80' }] },
      },
    } as unknown as IncomeAssumptionConfig;

    // Deep equality, not identity: `mergeProductRuleStructure` already rebuilds the object
    // for any pair of product rules, so there is no same-object path to assert here.
    expect(effectiveIncomeRule(bank, productRule)).toEqual(bank);
    expect(effectiveIncomeRule(bank, productRule).stepParams?.iscore_band).toEqual(
      bank.stepParams?.iscore_band,
    );
  });

  it('ignores the catalog when `amounts` is ABSENT — every pre-existing row', () => {
    const legacyRow: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      keyTable: [{ key: 'lecturer', incomeEGP: '22000' }],
    };

    expect(inheritsCatalogAmounts(legacyRow)).toBe(false);
    // Same object back: the common path allocates nothing and stays referentially stable.
    expect(effectiveIncomeRule(legacyRow, CATALOG)).toBe(legacyRow);
  });
});

describe('no catalog rule', () => {
  it('leaves an inheriting program with NO table, so the resolver states a reason', () => {
    const program: IncomeAssumptionConfig = { strategy: 'byProfessorRank', amounts: 'catalog' };

    const effective = effectiveIncomeRule(program, undefined);

    // Not a zero, not a fallback to `declared`: a rule with a strategy and no table,
    // which `lookupKey` reports as `rule_unconfigured`.
    expect(effective.strategy).toBe('byProfessorRank');
    expect(effective.keyTable).toBeUndefined();
    expect(effective.bands).toBeUndefined();
    expect(effective.scalar).toBeUndefined();
  });
});

describe('what gets STORED', () => {
  it('strips every figure from a program on catalog amounts', () => {
    const submitted: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      amounts: 'catalog',
      // The screen pre-fills the editor from the catalog so the operator can see what
      // they are accepting. That copy must not be kept.
      keyTable: CATALOG.keyTable,
      dbrCapPercentOverride: '45',
    };

    const stored = stripInheritedAmounts(submitted);

    expect(stored.keyTable).toBeUndefined();
    expect(stored.amounts).toBe('catalog');
    expect(stored.strategy).toBe('byProfessorRank');
    // Policy is the bank's and survives.
    expect(stored.dbrCapPercentOverride).toBe('45');
  });

  it('strips the legacy figure keys too', () => {
    const submitted: IncomeAssumptionConfig = {
      strategy: 'byBankStatementPercent',
      amounts: 'catalog',
      scalar: { value: '30.0', unit: 'percent' },
      bankStatementPercent: '30.0',
    };

    const stored = stripInheritedAmounts(submitted);

    expect(stored.scalar).toBeUndefined();
    expect(stored.bankStatementPercent).toBeUndefined();
  });

  it('leaves a program on its own amounts alone', () => {
    const own: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      amounts: 'own',
      keyTable: [{ key: 'lecturer', incomeEGP: '22000' }],
    };

    expect(stripInheritedAmounts(own)).toBe(own);
  });
});

/**
 * The WHOLE persistence chain, not one link of it.
 *
 * Every case above calls `stripInheritedAmounts` directly, and that is precisely how the
 * link came to be dropped on every real save while this file stayed green:
 * `stripForeignMethodConfig` runs FIRST, rebuilds the rule from a fixed field list, and did
 * not copy `amounts`. So by the time `stripInheritedAmounts` saw the blob the flag was
 * already gone, it read `undefined` as "own amounts", and a program the operator had put on
 * the catalog's table persisted as a bare `{ strategy }` — no table, no link, and
 * `rule_unconfigured` from the resolver.
 *
 * These cases run the chain `persistableIncomeAssumption` runs, in its order, so a future
 * strip inserted anywhere in it has to keep the flag alive to stay green.
 */
describe('the persistence chain keeps the link alive', () => {
  /** Exactly what `persistableIncomeAssumption` composes. */
  const persist = (config: IncomeAssumptionConfig): IncomeAssumptionConfig =>
    stripCatalogStructure(
      stripInheritedAmounts(
        normalizeIncomeAssumption(stripForeignMethodConfig(config) as IncomeAssumptionConfig),
      ),
    );

  it('persists the catalog link when the operator typed no figures', () => {
    const stored = persist({ strategy: 'byProfessorRank', amounts: 'catalog' });

    expect(stored.amounts).toBe('catalog');
    expect(inheritsCatalogAmounts(stored)).toBe(true);
    // And the engine finds the catalog's table through it.
    expect(effectiveIncomeRule(stored, CATALOG).keyTable).toEqual(CATALOG.keyTable);
  });

  it('drops a pre-filled copy while keeping the link', () => {
    // The screen seeds the editor from the catalog so the operator sees what they accept.
    // Storing that copy would make the link a one-time snapshot.
    const stored = persist({
      strategy: 'byProfessorRank',
      amounts: 'catalog',
      keyTable: CATALOG.keyTable,
    });

    expect(stored.keyTable).toBeUndefined();
    expect(stored.amounts).toBe('catalog');
  });

  it('persists the figures, and the detachment, once the operator edits one', () => {
    const stored = persist({
      strategy: 'byProfessorRank',
      amounts: 'own',
      keyTable: [
        { key: 'lecturer', incomeEGP: '12000' },
        { key: 'assistant_professor', incomeEGP: '18000' },
        // The edited row. The other two must travel with it, or the bank saves a
        // one-row table and quotes nothing for the ranks it dropped.
        { key: 'professor', incomeEGP: '70000' },
      ],
    });

    expect(stored.amounts).toBe('own');
    expect(stored.keyTable).toHaveLength(3);
    // A later catalog edit cannot reach it.
    expect(effectiveIncomeRule(stored, CATALOG).keyTable?.[2]?.incomeEGP).toBe('70000');
  });

  it('leaves a row written before the field existed on its own figures', () => {
    const stored = persist({
      strategy: 'byProfessorRank',
      keyTable: [{ key: 'professor', incomeEGP: '65000' }],
    });

    expect(stored.amounts).toBeUndefined();
    expect(inheritsCatalogAmounts(stored)).toBe(false);
    expect(stored.keyTable).toHaveLength(1);
  });

  it('keeps the link on a step pipeline, and stores neither half of the structure', () => {
    const stored = persist({
      strategy: 'steps',
      amounts: 'catalog',
      // Both the catalog's structure and a pre-filled figure copy are on the wire.
      steps: [{ id: 'ceiling', op: 'constant' }],
      stepParams: { ceiling: { valueEGP: '500000' } },
    } as unknown as IncomeAssumptionConfig);

    expect(stored.amounts).toBe('catalog');
    // Structure is the catalog's (`stripCatalogStructure`), figures are inherited
    // (`stripInheritedAmounts`) — a bank row stores neither.
    expect(stored.steps).toBeUndefined();
    expect(stored.stepParams).toBeUndefined();
  });

  it('stores a pipeline bank its own figures without the catalog structure', () => {
    const stored = persist({
      strategy: 'steps',
      amounts: 'own',
      steps: [{ id: 'ceiling', op: 'constant' }],
      stepParams: { ceiling: { valueEGP: '500000' } },
    } as unknown as IncomeAssumptionConfig);

    expect(stored.amounts).toBe('own');
    expect(stored.steps).toBeUndefined();
    expect(stored.stepParams).toEqual({ ceiling: { valueEGP: '500000' } });
  });
});

/**
 * The CATALOG's own write, which is the mirror image of the strip above: a bank program
 * must not STORE the structure, and the name's own screen must not have to SEND it.
 *
 * Every one of these fails silently, or fails loudly in the one way nobody sees until an
 * operator tries to save: the compound name's Save answered
 * `PRODUCT_RULE_INVALID / no_steps` on every attempt, because the screen posts figures
 * only and validation holds a `steps` rule to having steps.
 */
describe('withStoredStructure — a figures-only catalog write', () => {
  const stored = {
    strategy: 'steps',
    steps: [{ id: 'ceiling', op: 'constant' }],
    gates: [],
    output: { kind: 'maxAmount', from: 'ceiling' },
  } as unknown as IncomeAssumptionConfig;

  it('carries the stored structure onto a write that states none', () => {
    const written = withStoredStructure(
      {
        strategy: 'steps',
        stepParams: { ceiling: { valueEGP: '500000' } },
      } as unknown as IncomeAssumptionConfig,
      stored,
    );

    expect(written.steps).toEqual(stored.steps);
    expect(written.output).toEqual(stored.output);
    // The figures are the ones sent, not the ones stored.
    expect(written.stepParams).toEqual({ ceiling: { valueEGP: '500000' } });
  });

  it('leaves a write that DOES state steps alone, so the seed can change the product', () => {
    const authored = {
      strategy: 'steps',
      steps: [{ id: 'other', op: 'constant' }],
    } as unknown as IncomeAssumptionConfig;

    expect(withStoredStructure(authored, stored).steps).toEqual(authored.steps);
  });

  it('carries nothing when there is nothing stored — a pipeline cannot be created blind', () => {
    const incoming = { strategy: 'steps' } as unknown as IncomeAssumptionConfig;

    expect(withStoredStructure(incoming, null).steps).toBeUndefined();
    expect(
      withStoredStructure(incoming, { strategy: 'declared' } as IncomeAssumptionConfig).steps,
    ).toBeUndefined();
  });

  it('leaves a write that states GATES but no steps alone — the revision is the point', () => {
    const revised = {
      strategy: 'steps',
      gates: [
        { id: 'floor', kind: 'number', op: 'gte', left: { step: 'ceiling' }, reasonCode: 'X' },
      ],
    } as unknown as IncomeAssumptionConfig;

    const written = withStoredStructure(revised, stored);

    // The caller's gates survive; the stored ones do NOT come back. Guarding on `steps`
    // alone answered 200 and discarded exactly this write.
    expect(written.gates).toEqual(revised.gates);
    expect(written.steps).toBeUndefined();
  });

  it('leaves a write that states OUTPUT but no steps alone', () => {
    const revised = {
      strategy: 'steps',
      output: { kind: 'maxAmount', from: 'other', baselineDbrPercent: '40' },
    } as unknown as IncomeAssumptionConfig;

    expect(withStoredStructure(revised, stored).output).toEqual(revised.output);
  });

  it('treats an explicit empty step list as a statement, not as silence', () => {
    const cleared = { strategy: 'steps', steps: [] } as unknown as IncomeAssumptionConfig;

    // A deliberate clear must reach validation and be refused there, not be quietly
    // re-populated with the structure the caller just removed.
    expect(withStoredStructure(cleared, stored).steps).toEqual([]);
  });

  it("carries the name's own policy fields onto a figures-only write", () => {
    // No pipeline screen edits these, and the catalog page posts strategy + stepParams only,
    // so dropping them loses them for good with nothing saying so.
    const withPolicy = {
      ...stored,
      dbrCapPercentOverride: '45',
      requiredDocuments: ['bank_statement'],
    } as unknown as IncomeAssumptionConfig;

    const written = withStoredStructure(
      {
        strategy: 'steps',
        stepParams: { ceiling: { valueEGP: '1' } },
      } as unknown as IncomeAssumptionConfig,
      withPolicy,
    );

    expect(written.dbrCapPercentOverride).toBe('45');
    expect(written.requiredDocuments).toEqual(['bank_statement']);
  });

  it('lets a write that states a policy field change it', () => {
    const withPolicy = {
      ...stored,
      dbrCapPercentOverride: '45',
    } as unknown as IncomeAssumptionConfig;

    const written = withStoredStructure(
      { strategy: 'steps', dbrCapPercentOverride: '50' } as unknown as IncomeAssumptionConfig,
      withPolicy,
    );

    expect(written.dbrCapPercentOverride).toBe('50');
  });

  it('leaves a single-fact rule untouched', () => {
    const rule = {
      strategy: 'byMilitaryGrade',
      keyTable: [{ key: 'colonel', incomeEGP: '30000' }],
    } as unknown as IncomeAssumptionConfig;

    expect(withStoredStructure(rule, stored)).toBe(rule);
  });
});
