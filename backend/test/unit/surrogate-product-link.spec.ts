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
 *
 *  - a SWITCHED-OFF product resolves to a `withheld` marker, never to an omission. An
 *    omission is what a single-fact product needs to fall through to the applicant's
 *    declared payslip, so spelling the off state as "no rule" would re-price the program
 *    off a figure no bank agreed to lend against.
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

/** A live product row, as `effectiveProgramNameRule` reads one. */
const live = (rule: IncomeAssumptionConfig | undefined, key = 'p') => ({
  key,
  active: true,
  deprecatedAt: null,
  rule,
});
const off = (rule: IncomeAssumptionConfig | undefined, key = 'p') => ({
  key,
  active: false,
  deprecatedAt: null,
  rule,
});

describe('effectiveProgramNameRule', () => {
  it('is undefined when neither side states a rule, so the map omits the key', () => {
    // Load-bearing: an omitted key is what makes `PROGRAM_NAME_INCOME_PROOF_MISSING` fire.
    // Returning an empty object instead would read downstream as a configured rule.
    expect(effectiveProgramNameRule(null, undefined)).toBeUndefined();
  });

  it('returns the name’s own rule when it links to nothing', () => {
    // Every payslip name, and every no-payslip name that predates the archetypes.
    expect(effectiveProgramNameRule(OWN, undefined)).toEqual({ rule: OWN });
  });

  it('returns the product’s rule when the name states none', () => {
    // The SAME object, not a copy: callers memoise on identity.
    expect(effectiveProgramNameRule(null, live(PRODUCT))?.rule).toBe(PRODUCT);
  });

  it('returns the PRODUCT when both are present — replace, never merge', () => {
    const result = effectiveProgramNameRule(OWN, live(PRODUCT));
    expect(result?.rule).toBe(PRODUCT);
    // The specific thing a merge would have produced: the product's structure carrying the
    // name's figures. If this ever passes, someone has added a third inheritance level.
    expect((result?.rule as { keyTable?: unknown }).keyTable).toBeUndefined();
  });

  it('treats undefined and null on the name side identically', () => {
    // The column is nullable and Prisma can hand back either spelling for "no rule".
    expect(effectiveProgramNameRule(undefined, live(PRODUCT))?.rule).toBe(PRODUCT);
    expect(effectiveProgramNameRule(undefined, undefined)).toBeUndefined();
  });

  it('withholds when the product is switched off, and still carries its rule', () => {
    // The marker is what the quote refuses on. The rule travels because switching a
    // product off is a decision about what QUOTES, not about what is configured — the
    // admin save path still merges the catalog's figures exactly as before.
    const result = effectiveProgramNameRule(null, off(PRODUCT, 'compound'));
    expect(result).toEqual({
      withheld: 'surrogate_product_retired',
      productKey: 'compound',
      rule: PRODUCT,
    });
  });

  it('withholds a switched-off product that holds NO rule', () => {
    // Otherwise an off-and-ruleless product reads as an absent link, and the withholding
    // never fires for exactly the product nobody has finished setting up.
    expect(effectiveProgramNameRule(null, off(undefined, 'half'))).toEqual({
      withheld: 'surrogate_product_retired',
      productKey: 'half',
    });
  });

  it('lets an OFF product beat the name’s own grandfathered rule', () => {
    // THE TRAP this variant exists for. If the name's rule won here, switching the product
    // off would revive a table nobody chose in that moment — and on a legacy single-fact
    // name that table is live, so the program would go on quoting.
    const result = effectiveProgramNameRule(OWN, off(PRODUCT));
    expect(result && 'withheld' in result).toBe(true);
  });

  it('withholds on a DEPRECATED product even while its active flag reads true', () => {
    // `updateById` sets both on a deprecate, but only one on a re-activate, so the two
    // spellings of "not live" must both be read or a deprecated product quotes on.
    const result = effectiveProgramNameRule(null, {
      key: 'p',
      active: true,
      deprecatedAt: new Date(),
      rule: PRODUCT,
    });
    expect(result && 'withheld' in result).toBe(true);
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
    active: true,
    deprecatedAt: null,
    ...over,
  });
  const productRow = (over: Record<string, unknown>) => ({
    type: 'surrogate_product',
    surrogateProductKey: null,
    active: true,
    deprecatedAt: null,
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
    expect(map.get('compound_owner')).toEqual({ rule: PRODUCT });
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
    expect(map.get('shared')).toEqual({ rule: PRODUCT });
    expect(map.size).toBe(1);
  });

  it('leaves an unlinked name on its own rule', async () => {
    const repo = repoOver([
      nameRow({ key: 'professor', incomeRule: OWN }),
      productRow({ key: 'academic_rank', incomeRule: PRODUCT }),
    ]);
    const map = await repo.programNameIncomeRules();
    expect(map.get('professor')).toEqual({ rule: OWN });
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

  it('withholds for every name on a switched-off product', async () => {
    const repo = repoOver([
      nameRow({ key: 'compound_owner', surrogateProductKey: 'compound' }),
      nameRow({ key: 'compound_owner_4', surrogateProductKey: 'compound' }),
      productRow({ key: 'compound', incomeRule: PRODUCT, active: false }),
    ]);
    const map = await repo.programNameIncomeRules();
    for (const key of ['compound_owner', 'compound_owner_4']) {
      expect(map.get(key)).toEqual({
        withheld: 'surrogate_product_retired',
        productKey: 'compound',
        rule: PRODUCT,
      });
    }
  });

  it('finds a switched-off product that holds no rule at all', async () => {
    // The products map has to take EVERY product row, not only the ones with a rule —
    // otherwise this reads as a dangling link and the name quietly keeps its own state.
    const repo = repoOver([
      nameRow({ key: 'name', surrogateProductKey: 'half', incomeRule: OWN }),
      productRow({ key: 'half', incomeRule: null, active: false }),
    ]);
    const map = await repo.programNameIncomeRules();
    const resolution = map.get('name');
    expect(resolution).toMatchObject({
      withheld: 'surrogate_product_retired',
      productKey: 'half',
    });
    // And it carries NO rule: the product is what the name reads, so the name's own
    // grandfathered table is not revived underneath a switched-off product.
    expect(resolution?.rule).toBeUndefined();
  });
});
