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
 *   2. A program on its OWN figures ignores the catalog entirely — the number a bank
 *      typed must never be silently replaced by someone else's.
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

describe('own amounts — never touched by the catalog', () => {
  it('ignores the catalog when `amounts` is explicit', () => {
    const program: IncomeAssumptionConfig = {
      strategy: 'byProfessorRank',
      amounts: 'own',
      keyTable: [{ key: 'lecturer', incomeEGP: '22000' }],
    };

    expect(effectiveIncomeRule(program, CATALOG)).toBe(program);
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
