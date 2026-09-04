/**
 * Changing a surrogate product's PROOF while bank programs read it.
 *
 * A bank's stored income table is keyed by the proof it was written against. Moving that out
 * from under it leaves live programs quoting rows no applicant can match — or resolving
 * `rule_unconfigured` — with nothing on any screen saying it happened.
 *
 * The catalog-name write has refused this since v17.0.0 (`INCOME_PROOF_IN_USE`). The product
 * write shipped WITHOUT it, on a comment claiming the check was "enforced one level down by
 * `assertIncomeProofMatchesName`". That was wrong: that function runs only when a BANK
 * PROGRAM is saved, so nothing ran as a consequence of the product write and an operator
 * could repoint every program under every linked name with a 200 and no warning.
 *
 * The blocked set is TWO HOPS — product → linked names → programs — because a product is
 * read by names and names are read by programs. Every program counts, not only the ones on
 * their own amounts: a program on `amounts: 'catalog'` would silently start reading a
 * different fact, which is the same break one step further away.
 */
import { describe, expect, it, vi } from 'vitest';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';

// A COMPLETE pipeline: `withStoredStructure` overlays this onto a figures-only write, and
// validation holds the result to having an output. A stub without one fails as
// `PRODUCT_RULE_INVALID / no_output` and would hide whatever the test meant to assert.
const STEPS = {
  strategy: 'steps',
  steps: [{ id: 'a', op: 'constant', value: '1000' }],
  gates: [],
  output: { kind: 'monthlyIncome', from: 'a' },
};

function makeService(opts: { names: string[]; programs: string[]; rule?: unknown }) {
  const enums = {
    findSurrogateProduct: vi.fn(async (key: string) => ({
      id: key,
      key,
      labelAr: key,
      labelEn: key,
      incomeRule: opts.rule ?? STEPS,
      valueSources: {},
      surrogateProductKey: null,
    })),
    listSurrogateProducts: vi.fn(async () => [
      { key: 'compound_owner', labelAr: 'c', labelEn: 'c', active: true, sortOrder: 0, incomeRule: STEPS, usedBy: opts.names },
    ]),
    programNamesLinkedTo: vi.fn(async () => opts.names),
    programsUnderName: vi.fn(async () =>
      opts.programs.map((programCode) => ({ programCode, strategy: 'steps', ownAmounts: true })),
    ),
    setSurrogateProductIncomeRule: vi.fn(async () => ({
      id: 'x', key: 'compound_owner', labelAr: 'c', labelEn: 'c',
      incomeRule: null, valueSources: {}, surrogateProductKey: null,
    })),
    surrogateFactRegistry: vi.fn(async () => []),
    questionOptionCodes: vi.fn(async () => []),
    getActiveMembers: vi.fn(async () => []),
    isActiveMember: vi.fn(async () => true),
  };
  const audit = { create: vi.fn(async () => undefined) };
  // (prisma, repo, audit, enums) — positional, so a ctor change fails here loudly rather
  // than silently handing the service the wrong collaborator.
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
  return { service, enums };
}

const ACTOR = { id: 'staff_1', sourceIp: null };
const codeOf = (e: unknown): string => (e instanceof DomainException ? e.code : String(e));

describe('a surrogate product whose proof is in use', () => {
  it('refuses a proof CHANGE while programs read it', async () => {
    const { service } = makeService({
      names: ['compound_owner'],
      programs: ['ABK-COMPOUND-GUARANTEE', 'CAE-COMPOUND-GUARANTEE'],
    });
    await expect(
      service.setSurrogateProductIncomeRule(
        'compound_owner',
        { incomeRule: { strategy: 'declared' } } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.INCOME_PROOF_IN_USE);
  });

  it('refuses a CLEAR for the same reason', async () => {
    // `incomeRule: null` would leave every program under every linked name resolving
    // `rule_unconfigured` — inheriting from nothing.
    const { service } = makeService({
      names: ['compound_owner'],
      programs: ['ABK-COMPOUND-GUARANTEE'],
    });
    await expect(
      service.setSurrogateProductIncomeRule('compound_owner', { incomeRule: null } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.INCOME_PROOF_IN_USE);
  });

  it('names every affected program across ALL linked names', async () => {
    const { service } = makeService({
      names: ['compound_owner', 'another_name'],
      programs: ['ABK-COMPOUND-GUARANTEE'],
    });
    const error = await service
      .setSurrogateProductIncomeRule(
        'compound_owner',
        { incomeRule: { strategy: 'declared' } } as never,
        ACTOR,
      )
      .catch((e: unknown) => e);
    // Two hops: two names × one program each. A one-hop check would have named neither.
    expect((error as DomainException).meta).toMatchObject({
      programCodes: ['ABK-COMPOUND-GUARANTEE', 'ABK-COMPOUND-GUARANTEE'],
    });
  });

  it('allows a proof change when nothing reads it yet', async () => {
    const { service } = makeService({ names: [], programs: [] });
    await expect(
      service.setSurrogateProductIncomeRule(
        'compound_owner',
        { incomeRule: { strategy: 'declared' } } as never,
        ACTOR,
      ),
    ).resolves.toBeDefined();
  });

  it('allows a FIGURES-only save while programs read it', async () => {
    // The whole point of the screen. Only the PROOF is guarded — editing the amounts every
    // bank starts from must stay possible on a live product.
    const { service, enums } = makeService({
      names: ['compound_owner'],
      programs: ['ABK-COMPOUND-GUARANTEE'],
    });
    await expect(
      service.setSurrogateProductIncomeRule(
        'compound_owner',
        { incomeRule: { strategy: 'steps' } } as never,
        ACTOR,
      ),
    ).resolves.toBeDefined();
    expect(enums.setSurrogateProductIncomeRule).toHaveBeenCalled();
  });

  it('404s a product key nobody has, naming the product not a program name', async () => {
    const { service, enums } = makeService({ names: [], programs: [] });
    enums.findSurrogateProduct.mockResolvedValueOnce(null as never);
    await expect(
      service.setSurrogateProductIncomeRule('nope', { incomeRule: null } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND);
  });
});
