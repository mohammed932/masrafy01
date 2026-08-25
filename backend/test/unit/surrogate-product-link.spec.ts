/**
 * The surrogate-product link: a catalog program name takes its income calculation from a
 * named, reusable product instead of holding its own copy.
 *
 * Two things are pinned here, and they fail in different ways:
 *
 *  - `effectiveProgramNameRule` is STRICT REPLACE, not a merge. A merge would give
 *    structure-from-product plus figures-from-name — a third level of inheritance on a
 *    system whose whole story is two — and would quietly make "the calculation is read
 *    from the product every time" false.
 *
 *  - `programNameIncomeRules()` resolves the link with TWO maps. A name and the product it
 *    links to deliberately share a key (`compound_owner` is both a `program_name` and a
 *    `surrogate_product`), because `(type, key)` is the unique. One map keyed by `row.key`
 *    would let whichever row the driver happened to return last silently win — and the two
 *    rows hold DIFFERENT rules, so the bug is a wrong quote, not a crash.
 */
import { describe, expect, it, vi } from 'vitest';
import { effectiveProgramNameRule } from '@/matching/pipeline/income-rule-inherit';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';
import type { IncomeAssumptionConfig } from '@/matching/types';

const PRODUCT: IncomeAssumptionConfig = {
  strategy: 'steps',
  steps: [{ id: 'price', op: 'factNumber', fact: 'compound_unit_price' }],
} as unknown as IncomeAssumptionConfig;

const OWN: IncomeAssumptionConfig = {
  strategy: 'byProfessorRank',
  keyTable: { professor: { incomeEGP: '50000' } },
} as unknown as IncomeAssumptionConfig;

describe('effectiveProgramNameRule', () => {
  it('is undefined when neither side states a rule, so the map omits the key', () => {
    // Load-bearing: an omitted key is what makes `PROGRAM_NAME_INCOME_PROOF_MISSING` fire.
    // Returning an empty object instead would read downstream as a configured rule.
    expect(effectiveProgramNameRule(null, undefined)).toBeUndefined();
  });

  it('returns the name’s own rule when it links to nothing', () => {
    // Every payslip name, and every no-payslip name that predates the archetypes.
    expect(effectiveProgramNameRule(OWN, undefined)).toBe(OWN);
  });

  it('returns the product’s rule when the name states none', () => {
    expect(effectiveProgramNameRule(null, PRODUCT)).toBe(PRODUCT);
  });

  it('returns the PRODUCT when both are present — replace, never merge', () => {
    const result = effectiveProgramNameRule(OWN, PRODUCT);
    expect(result).toBe(PRODUCT);
    // The specific thing a merge would have produced: the product's structure carrying the
    // name's figures. If this ever passes, someone has added a third inheritance level.
    expect((result as { keyTable?: unknown }).keyTable).toBeUndefined();
  });

  it('treats undefined and null on the name side identically', () => {
    // The column is nullable and Prisma can hand back either spelling for "no rule".
    expect(effectiveProgramNameRule(undefined, PRODUCT)).toBe(PRODUCT);
    expect(effectiveProgramNameRule(undefined, undefined)).toBeUndefined();
  });
});

describe('programNameIncomeRules resolves the link', () => {
  function repoOver(rows: unknown[]) {
    const prisma = {
      platformEnumeration: { findMany: vi.fn(async () => rows) },
    };
    return new PostgresPlatformEnumerationsRepository(prisma as never);
  }

  const nameRow = (over: Record<string, unknown>) => ({
    type: 'program_name',
    incomeRule: null,
    surrogateProductKey: null,
    ...over,
  });
  const productRow = (over: Record<string, unknown>) => ({
    type: 'surrogate_product',
    surrogateProductKey: null,
    ...over,
  });

  it('serves the product’s rule for a linked name, under the NAME’s key', async () => {
    const repo = repoOver([
      nameRow({ key: 'compound_owner', surrogateProductKey: 'compound_owner' }),
      productRow({ key: 'compound_owner', incomeRule: PRODUCT }),
    ]);
    const map = await repo.programNameIncomeRules();
    // One entry, not two: a surrogate product is not itself a catalog name.
    expect([...map.keys()]).toEqual(['compound_owner']);
    expect(map.get('compound_owner')).toEqual(PRODUCT);
  });

  it('does not let a same-keyed name and product collide', async () => {
    // THE TRAP. Both rows are keyed `shared`, and they hold different rules. A single map
    // keyed by `row.key` returns whichever came last; the name must win its own key with
    // the PRODUCT's rule, because that is what it links to.
    const repo = repoOver([
      nameRow({ key: 'shared', surrogateProductKey: 'shared' }),
      productRow({ key: 'shared', incomeRule: PRODUCT }),
    ]);
    const map = await repo.programNameIncomeRules();
    expect(map.get('shared')).toEqual(PRODUCT);
    expect(map.size).toBe(1);
  });

  it('leaves an unlinked name on its own rule', async () => {
    const repo = repoOver([
      nameRow({ key: 'professor', incomeRule: OWN }),
      productRow({ key: 'academic_rank', incomeRule: PRODUCT }),
    ]);
    const map = await repo.programNameIncomeRules();
    expect(map.get('professor')).toEqual(OWN);
    // The product is not a name and must not appear in a map of names.
    expect(map.has('academic_rank')).toBe(false);
  });

  it('omits a name whose link dangles rather than inventing a rule', async () => {
    // A pointer that resolves to nothing is not a rule. Omitted, the program below reports
    // `rule_unconfigured` — a stated reason — instead of quoting a figure nobody wrote.
    const repo = repoOver([nameRow({ key: 'orphan', surrogateProductKey: 'gone' })]);
    const map = await repo.programNameIncomeRules();
    expect(map.has('orphan')).toBe(false);
  });

  it('reads a JSON-literal null as no rule, not as a rule', async () => {
    // The JSONB column can hold SQL NULL or the JSON literal `null`, and both mean "no
    // rule". Reading the second as an object is the failure that fails OPEN.
    const repo = repoOver([nameRow({ key: 'blank', incomeRule: null })]);
    expect((await repo.programNameIncomeRules()).has('blank')).toBe(false);
  });
});
