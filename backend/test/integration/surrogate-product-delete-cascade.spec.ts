/**
 * Deleting a surrogate product is destructive AND confirmed, never destructive and silent.
 *
 * The shape that matters: WITHOUT `cascade` the refusal names every row that would be
 * destroyed — the linked catalog names and the bank program codes under them — so the
 * operator confirms against a list rather than against a count they have to take on trust.
 * A product nothing points at deletes on the first call, because there is nothing to confirm.
 *
 * WHAT SURVIVES is the other half, and it is why a hard delete is safe enough to offer at
 * all: `bank_offer` carries `programCode` as a plain column with NO foreign key and holds
 * its own frozen copy of every figure it quoted (Principle I / A6), so a customer's issued
 * offer goes on reading exactly what it read the day it was made. The catalog NAMES survive
 * too, unlinked — a name is what banks sell, and the usual next move after retiring a
 * calculation is to point those names at another one.
 *
 * ORDER is asserted rather than assumed. Reversed, the product row would go first and every
 * link would be left dangling — the exact state migration `20260825090000` RAISEs on, and
 * one that reads at the engine seam as "no rule" rather than as an error.
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

function makeService(opts: { names: string[]; programs: string[]; exists?: boolean }) {
  const calls: string[] = [];
  const enums = {
    findSurrogateProduct: vi.fn(async (key: string) =>
      opts.exists === false ? null : { id: `id_${key}`, key, labelAr: key, labelEn: key, incomeRule: STEPS, valueSources: {}, surrogateProductKey: null },
    ),
    listSurrogateProducts: vi.fn(async () => [
      { key: 'other', labelAr: 'o', labelEn: 'o', active: true, sortOrder: 0, incomeRule: STEPS, usedBy: [] },
    ]),
    programNamesLinkedTo: vi.fn(async () => {
      calls.push('programNamesLinkedTo');
      return opts.names;
    }),
    programsUnderName: vi.fn(async () =>
      opts.programs.map((programCode) => ({ programCode, strategy: 'steps', ownAmounts: true })),
    ),
    deleteSurrogateProductCascade: vi.fn(async () => {
      calls.push('deleteSurrogateProductCascade');
    }),
  };
  const audit = { create: vi.fn(async () => undefined) };
  // (prisma, repo, audit, enums) — positional, so a ctor change fails here loudly.
  const service = new BankProgramsService({} as never, {} as never, audit as never, enums as never);
  return { service, enums, audit, calls };
}

describe('deleting a surrogate product', () => {
  it('refuses without cascade, naming the names AND the programs that would go', async () => {
    const { service, enums } = makeService({
      names: ['compound_owner'],
      programs: ['ABK-COMPOUND', 'CIB-COMPOUND'],
    });
    await expect(service.deleteSurrogateProduct('compound_owner', { cascade: false }, ACTOR))
      .rejects.toSatisfy((e: unknown) => {
        if (codeOf(e) !== ERROR_CODES.SURROGATE_PRODUCT_IN_USE) return false;
        const meta = (e as DomainException).meta as Record<string, unknown>;
        // Both lists, and the `count` both locale strings interpolate.
        return (
          JSON.stringify(meta.names) === JSON.stringify(['compound_owner']) &&
          JSON.stringify(meta.programCodes) === JSON.stringify(['ABK-COMPOUND', 'CIB-COMPOUND']) &&
          meta.count === 1
        );
      });
    expect(enums.deleteSurrogateProductCascade).not.toHaveBeenCalled();
  });

  it('refuses without cascade even when the linked name has no programs yet', async () => {
    // The NAME is destroyed-adjacent too (its link goes), so a product with a name and no
    // programs is still a confirmation, not a silent delete.
    const { service, enums } = makeService({ names: ['doctor'], programs: [] });
    await expect(
      service.deleteSurrogateProduct('years_in_practice', { cascade: false }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_IN_USE);
    expect(enums.deleteSurrogateProductCascade).not.toHaveBeenCalled();
  });

  it('deletes on the FIRST call when nothing points at it', async () => {
    const { service, enums } = makeService({ names: [], programs: [] });
    const result = await service.deleteSurrogateProduct('unused', { cascade: false }, ACTOR);
    expect(result).toEqual({ key: 'unused', deletedNames: [], deletedPrograms: [] });
    expect(enums.deleteSurrogateProductCascade).toHaveBeenCalledWith('unused', [], []);
  });

  it('cascades, handing the repository exactly what it resolved', async () => {
    const { service, enums } = makeService({
      names: ['compound_owner'],
      programs: ['ABK-COMPOUND', 'CIB-COMPOUND'],
    });
    const result = await service.deleteSurrogateProduct('compound_owner', { cascade: true }, ACTOR);
    expect(enums.deleteSurrogateProductCascade).toHaveBeenCalledWith(
      'compound_owner',
      ['compound_owner'],
      ['ABK-COMPOUND', 'CIB-COMPOUND'],
    );
    expect(result.deletedPrograms).toEqual(['ABK-COMPOUND', 'CIB-COMPOUND']);
  });

  it('resolves what would go BEFORE deleting anything', async () => {
    // Not decoration: the audit payload and the refusal both name that set, and resolving it
    // after the delete would name nothing.
    const { service, calls } = makeService({ names: ['n'], programs: ['P'] });
    await service.deleteSurrogateProduct('p', { cascade: true }, ACTOR);
    expect(calls).toEqual(['programNamesLinkedTo', 'deleteSurrogateProductCascade']);
  });

  it('audits the delete with both lists', async () => {
    const { service, audit } = makeService({ names: ['n'], programs: ['P'] });
    await service.deleteSurrogateProduct('p', { cascade: true }, ACTOR);
    expect(audit.create).toHaveBeenCalledOnce();
    const payload = audit.create.mock.calls[0]?.[0] as { payload: Record<string, unknown> };
    expect(payload.payload).toMatchObject({
      type: 'surrogate_product',
      key: 'p',
      names: ['n'],
      programCodes: ['P'],
    });
  });

  it('404s for a product key nobody has, before touching anything', async () => {
    const { service, enums } = makeService({ names: [], programs: [], exists: false });
    await expect(
      service.deleteSurrogateProduct('ghost', { cascade: true }, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_NOT_FOUND);
    expect(enums.deleteSurrogateProductCascade).not.toHaveBeenCalled();
  });
});
