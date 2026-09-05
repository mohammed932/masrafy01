/**
 * Saving the friendly form must not throw away figures a bank has already typed.
 *
 * THE SINGLE MOST DANGEROUS THING about compiling a form. A bank's numbers, and its
 * estimated-value markers, are keyed by STEP ID. Untick "another way to reach the figure"
 * and the recompile stops emitting that step — every figure filed under it is orphaned, and
 * the program still reads as configured while it quotes nothing, or quotes off a derivation
 * nobody chose.
 *
 * The operator cannot see it happening: they are looking at three plain questions, and the
 * figures belong to banks on another screen. So the save is REFUSED and the refusal names
 * the programs. Reconciling instead would mean guessing which new box a number belonged in,
 * and a wrong guess here is a wrong quote frozen onto an immutable offer (Principle I).
 */
import { describe, expect, it, vi } from 'vitest';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import { SetSurrogateProductTemplateDto } from '@/bank-programs/dto/program-name-income-rule.dto';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import type { ProductTemplate } from '@/matching/pipeline/product-template';

const ACTOR = { id: 'staff_1', sourceIp: null };

const oneWay: ProductTemplate = {
  version: 1,
  outputKind: 'monthlyIncome',
  primary: { kind: 'choiceTable', fact: 'military_grade' },
  conditions: [],
};

const twoWays: ProductTemplate = {
  ...oneWay,
  alternative: { kind: 'classTable', fact: 'compound_name' },
};

/**
 * Only what this path touches. A full fake of the repository would be a second
 * implementation of it, and the parts it would have to model are the parts under test.
 */
function build(opts: {
  storedRule?: Record<string, unknown> | null;
  /**
   * A product whose calculation was written in the raw step editor holds a rule and NO form.
   * Every other case here is one the form authored, so it holds both.
   */
  handBuilt?: boolean;
  figureKeys?: Array<{ programCode: string; keys: string[] }>;
}) {
  const written: Array<{ rule: unknown; template: unknown }> = [];
  const enums = {
    findSurrogateProduct: vi.fn(async () => ({
      id: 'pe_1',
      key: 'demo',
      labelAr: 'demo',
      labelEn: 'demo',
      incomeRule: (opts.storedRule ?? null) as never,
      templateSpec: opts.handBuilt === true ? null : (oneWay as never),
      valueSources: {},
      surrogateProductKey: null,
    })),
    programFigureKeysUnderProduct: vi.fn(async () => opts.figureKeys ?? []),
    setSurrogateProductIncomeRule: vi.fn(async (_k: string, rule: unknown, _v: unknown, _a: string, template: unknown) => {
      written.push({ rule, template });
      return {} as never;
    }),
    programNamesLinkedTo: vi.fn(async () => []),
    programsUnderName: vi.fn(async () => []),
    programNameLabels: vi.fn(async () => new Map()),
    listSurrogateProducts: vi.fn(async () => [
      { key: 'demo', labelAr: 'demo', labelEn: 'demo', active: true, sortOrder: 0, incomeRule: null, usedBy: [] },
    ]),
    // The rule validator's registry. Permissive: the shape is what is under test here.
    surrogateFactRegistry: vi.fn(async () => [
      { key: 'military_grade', questionCode: 'military_grade', type: 'SINGLE_SELECT' as const },
      { key: 'compound_name', questionCode: 'compound_name', type: 'SINGLE_SELECT' as const },
    ]),
    questionOptionCodes: vi.fn(async () => ['a', 'b']),
    getActiveMembers: vi.fn(async () => ['a', 'b']),
    isActiveMember: vi.fn(async () => true),
  };
  const audit = { create: vi.fn(async () => undefined) };

  const service = new BankProgramsService(
    {} as never,
    // The program repository, stubbed down to the one read the detail projection makes:
    // every write here returns that projection, and it now reports which programs cap by
    // one of the product's answers.
    { capFactsByProgram: async () => [] } as never,
    audit as never,
    enums as never,
    {} as never,
    { asksByProduct: async () => new Map() } as never,
  );
  return { service, enums, audit, written };
}

const dto = (template: ProductTemplate): SetSurrogateProductTemplateDto =>
  ({ template: template as unknown as Record<string, unknown> }) as SetSurrogateProductTemplateDto;

async function codeOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof DomainException ? error.code : `THREW ${String(error)}`;
  }
}

describe('a recompile that would orphan a bank figure', () => {
  it('is refused, and names the programs and the boxes', async () => {
    const { service } = build({
      storedRule: { strategy: 'steps' },
      // This bank filled in the second way. Dropping it takes their table with it.
      figureKeys: [{ programCode: 'ABK-1', keys: ['primary', 'alt'] }],
    });
    let thrown: DomainException | null = null;
    try {
      await service.setSurrogateProductTemplate('demo', dto(oneWay), ACTOR);
    } catch (error) {
      thrown = error as DomainException;
    }
    expect(thrown?.code).toBe(ERROR_CODES.PRODUCT_TEMPLATE_ORPHANS_FIGURES);
    expect(thrown?.meta).toMatchObject({ programCodes: ['ABK-1'], lostKeys: ['alt'], count: 1 });
  });

  it('is allowed when the dropped box was never filled in', async () => {
    // A bank that declined the second way has nothing under `alt`, so removing it takes
    // nothing. Refusing here would block the operator on a box nobody typed into.
    const { service, written } = build({
      storedRule: { strategy: 'steps' },
      figureKeys: [{ programCode: 'ABK-1', keys: ['primary'] }],
    });
    expect(await codeOf(() => service.setSurrogateProductTemplate('demo', dto(oneWay), ACTOR))).toBeNull();
    expect(written).toHaveLength(1);
  });

  it('is allowed when the shape only GROWS', async () => {
    const { service } = build({
      storedRule: { strategy: 'steps' },
      figureKeys: [{ programCode: 'ABK-1', keys: ['primary'] }],
    });
    expect(await codeOf(() => service.setSurrogateProductTemplate('demo', dto(twoWays), ACTOR))).toBeNull();
  });

  it('carries the stored figures across the recompile, pruned to the boxes that survive', async () => {
    // Without this the form would blank the catalog's own defaults on every save: the
    // compile emits steps and no figures at all.
    const { service, written } = build({
      storedRule: {
        strategy: 'steps',
        stepParams: {
          primary: { keyTable: [{ key: 'a', incomeEGP: '100' }] },
          alt: { keyTable: [{ key: 'b', incomeEGP: '200' }] },
        },
      },
    });
    await service.setSurrogateProductTemplate('demo', dto(oneWay), ACTOR);
    const rule = written[0]?.rule as { stepParams?: Record<string, unknown> };
    expect(Object.keys(rule.stepParams ?? {})).toEqual(['primary']);
  });

  it('stores the form alongside the rule it compiled to', async () => {
    const { service, written } = build({ storedRule: { strategy: 'steps' } });
    await service.setSurrogateProductTemplate('demo', dto(oneWay), ACTOR);
    expect(written[0]?.template).toEqual(oneWay);
  });

  it('refuses to overwrite a calculation that was built by hand', async () => {
    // Using the raw step editor is one-way: it clears the form BECAUSE a form cannot
    // describe an arbitrary step list. Accepting one here would let three plain answers
    // silently replace a pipeline some bank is quoting from.
    const { service, written } = build({ storedRule: { strategy: 'steps' }, handBuilt: true });
    expect(await codeOf(() => service.setSurrogateProductTemplate('demo', dto(oneWay), ACTOR))).toBe(
      ERROR_CODES.PRODUCT_TEMPLATE_NOT_EDITABLE,
    );
    expect(written).toHaveLength(0);
  });

  it('refuses a form the compiler cannot build from, before it writes anything', async () => {
    const { service, written } = build({ storedRule: { strategy: 'steps' } });
    const bad = { ...oneWay, primary: { kind: 'choiceTable' as const, fact: '' } };
    expect(await codeOf(() => service.setSurrogateProductTemplate('demo', dto(bad), ACTOR))).toBe(
      ERROR_CODES.PRODUCT_TEMPLATE_INVALID,
    );
    expect(written).toHaveLength(0);
  });
});
