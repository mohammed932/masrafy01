/**
 * Switching a surrogate product on and off — the operator's ONE lifecycle action on a
 * product, now that create and delete are gone from the admin.
 *
 * Three things are pinned, and each is a decision somebody could quietly undo:
 *
 *  - it DELEGATES the write to the enumerations admin service. Writing the row here would
 *    be a second implementation of the audit event, the cache invalidation and the retire
 *    guards, free to disagree with the operator's own edit path;
 *  - it is keyed by `key`, never by the registry id. Every other product route is, and no
 *    product DTO carries the id — leaking it into the screens would be a second way to
 *    address one object;
 *  - a CAP-ONLY product's owned FACTS go with it. Such a product guesses no income, so
 *    there is no calculation to withhold: deactivating its fact is what stops the answer
 *    being read, and the bank's own cap table then takes the `onNoMatch` branch it chose.
 *    A rule product's facts are deliberately left alone — its rule is withheld instead,
 *    and flipping the facts too would overwrite a state an operator may have set by hand.
 *
 * `club_branch_cap` and `compound_owner_ceiling` are real blueprint keys, so the cap-only
 * split is exercised through the real predicate rather than a stub of it.
 */
import { describe, expect, it, vi } from 'vitest';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';

const STEPS = {
  strategy: 'steps',
  steps: [{ id: 'a', op: 'constant', value: '1000' }],
  gates: [],
  output: { kind: 'monthlyIncome', from: 'a' },
};

const ACTOR = { id: 'staff_1', sourceIp: null };
const codeOf = (e: unknown): string => (e instanceof DomainException ? e.code : String(e));

function makeService(opts: { exists?: boolean } = {}) {
  const enums = {
    findSurrogateProduct: vi.fn(async (key: string) =>
      opts.exists === false
        ? null
        : { id: `id_${key}`, key, labelAr: key, labelEn: key, incomeRule: STEPS },
    ),
    listSurrogateProducts: vi.fn(async () => [
      { key: 'compound_owner_ceiling', labelAr: 'c', labelEn: 'c', active: true, sortOrder: 0, usedBy: [] },
    ]),
  };
  const enumsAdmin = {
    update: vi.fn(async () => ({ id: 'x' })),
    setFactsActive: vi.fn(async () => ['club_branch']),
  };
  // (prisma, repo, audit, enums, enumsAdmin) — positional, so a ctor change fails loudly.
  const service = new BankProgramsService(
    {} as never,
    {} as never,
    {} as never,
    enums as never,
    enumsAdmin as never,
  );
  return { service, enums, enumsAdmin };
}

describe('switching a surrogate product off', () => {
  it('writes through the admin service, by the row it resolved from the key', async () => {
    const { service, enumsAdmin } = makeService();
    const result = await service.setSurrogateProductActive('compound_owner_ceiling', false, ACTOR);
    expect(enumsAdmin.update).toHaveBeenCalledWith(
      'id_compound_owner_ceiling',
      { active: false },
      { staffId: 'staff_1', sourceIp: null },
    );
    expect(result).toMatchObject({ key: 'compound_owner_ceiling', active: false });
  });

  it('never sends `deprecate`, so the product can always be switched back on', async () => {
    // `updateById` sets `deprecatedAt` on a deprecate and clears it on nothing, so a
    // deprecate issued here would be one-way.
    const { service, enumsAdmin } = makeService();
    await service.setSurrogateProductActive('compound_owner_ceiling', false, ACTOR);
    const patch = enumsAdmin.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(patch).not.toHaveProperty('deprecate');
    expect(Object.keys(patch)).toEqual(['active']);
  });

  it('leaves a RULE product’s facts alone', async () => {
    // Its rule is withheld at the engine seam instead. Two mechanisms for one switch would
    // mean the second one overwriting a per-fact state an operator set by hand.
    const { service, enumsAdmin } = makeService();
    const result = await service.setSurrogateProductActive('compound_owner_ceiling', false, ACTOR);
    expect(enumsAdmin.setFactsActive).not.toHaveBeenCalled();
    expect(result.factsChanged).toEqual([]);
  });

  it('takes a CAP-ONLY product’s owned facts with it, and reports them', async () => {
    const { service, enumsAdmin } = makeService();
    const result = await service.setSurrogateProductActive('club_branch_cap', false, ACTOR);
    // The KEYS the blueprint asks for, not the product key: a cap blueprint creates no
    // product row for its facts to be filed under, so an ownership-keyed flip is inert.
    expect(enumsAdmin.setFactsActive).toHaveBeenCalledWith(['club_branch'], false, {
      staffId: 'staff_1',
      sourceIp: null,
    });
    // Reported, not silent: switching this product off also stopped a question being read,
    // and the operator has to be able to see that.
    expect(result.factsChanged).toEqual(['club_branch']);
  });

  it('never takes a SHARED fact with it', async () => {
    // `school_type` is read by `school_stage_ceiling` as a ceiling's column and by
    // `school_type_cap` as a cap of its own. Turning the cap off must not stop the ceiling
    // product reading the answer, so the cap's switch reaches no fact at all here.
    const { service, enumsAdmin } = makeService();
    await service.setSurrogateProductActive('school_type_cap', false, ACTOR);
    expect(enumsAdmin.setFactsActive).toHaveBeenCalledWith([], false, {
      staffId: 'staff_1',
      sourceIp: null,
    });
  });

  it('restores a cap-only product’s facts when switched back on', async () => {
    const { service, enumsAdmin } = makeService();
    await service.setSurrogateProductActive('club_branch_cap', true, ACTOR);
    expect(enumsAdmin.setFactsActive).toHaveBeenCalledWith(['club_branch'], true, {
      staffId: 'staff_1',
      sourceIp: null,
    });
  });

  it('404s on a key nobody has, naming what would have worked', async () => {
    const { service, enumsAdmin } = makeService({ exists: false });
    await expect(service.setSurrogateProductActive('nope', false, ACTOR)).rejects.toSatisfy(
      (e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND,
    );
    // And nothing was written on the way to the refusal.
    expect(enumsAdmin.update).not.toHaveBeenCalled();
  });
});
