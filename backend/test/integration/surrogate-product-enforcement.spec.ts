/**
 * A catalog program name sold without a payslip must say where its income comes from.
 *
 * Three refusals, and each guards a state that is silent rather than loud if it gets
 * through — the failure is a live, offerable name that quotes nothing, discovered by a
 * customer:
 *
 *  - SURROGATE_PRODUCT_REQUIRED  a no-payslip name with neither a link nor a rule of its
 *                                own. Raised on CREATE, on the basis write, and on an
 *                                UNLINK, because all three can reach the same state and
 *                                the order they arrive in must not decide validity.
 *  - ENUMERATION_PARENT_UNKNOWN  a link naming a product that is not live. There is no
 *                                foreign key (the reachable unique is `(type, key)`), so
 *                                without this a typo saves 200 and surfaces as
 *                                `rule_unconfigured` on a customer.
 *  - SURROGATE_PRODUCT_IN_USE    retiring a product names still link to. Load-bearing:
 *                                the read path resolves a link WITHOUT checking the
 *                                product's active flag, deliberately, so retiring one
 *                                cannot blank the income of names already on it. That is
 *                                only safe because this stops the retire.
 *
 * GRANDFATHERING is pinned too, and it is not a loophole: a legacy no-payslip name that
 * states its own rule must stay savable, or the edit that would link it is the edit being
 * refused.
 */
import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import {
  CreateEnumerationDto,
  UpdateEnumerationDto,
} from '@/platform-enumerations/dto/enumeration.dto';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';
import { fakeTypeDefinitions } from '../helpers/enumeration-type-defs';

interface FakeRow {
  id: string;
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  systemOnly: boolean;
  deprecatedAt: Date | null;
  parentKey: string | null;
  surrogateProductKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

function row(over: Partial<FakeRow> & Pick<FakeRow, 'id' | 'type' | 'key'>): FakeRow {
  return {
    labelAr: over.key,
    labelEn: over.key,
    active: true,
    systemOnly: false,
    deprecatedAt: null,
    parentKey: null,
    surrogateProductKey: null,
    sortOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

function fixture(): FakeRow[] {
  return [
    row({ id: 'p1', type: 'surrogate_product', key: 'compound_owner' }),
    row({ id: 'p2', type: 'surrogate_product', key: 'declared_income' }),
    row({ id: 'p3', type: 'surrogate_product', key: 'retired_one', active: false }),
    // Linked: takes its calculation from `compound_owner`, holds none of its own.
    row({ id: 'n1', type: 'program_name', key: 'compound_owner', surrogateProductKey: 'compound_owner' }),
    // Legacy: no link, but states its own rule. Must stay savable.
    row({ id: 'n2', type: 'program_name', key: 'professor' }),
    // Neither linked nor grandfathered — the state the refusal exists for.
    row({ id: 'n4', type: 'program_name', key: 'blank_name' }),
    row({ id: 'g1', type: 'governorate', key: 'cairo' }),
  ];
}

/** Which `program_name` keys hold a rule of their own — the grandfather set. */
const OWN_RULE_KEYS = new Set(['professor']);

function makeRepo(rows: FakeRow[], bases: Record<string, string[]> = {}) {
  return {
    rows,
    // A COPY, like Prisma: `update()` snapshots the row before writing and diffs it for
    // the audit. Returning the same mutable object the fake `updateById` then mutates
    // makes every change read as a no-op.
    findById: vi.fn(async (id: string) => {
      const found = rows.find((r) => r.id === id);
      return found ? { ...found } : null;
    }),
    findByTypeAndKey: vi.fn(
      async (type: string, key: string) =>
        rows.find((r) => r.type === type && r.key === key) ?? null,
    ),
    getActiveMembers: vi.fn(async (type: string) =>
      rows
        .filter((r) => r.type === type && r.active && r.deprecatedAt === null)
        .map((r) => ({ key: r.key })),
    ),
    typeDefinitions: vi.fn(async () => fakeTypeDefinitions()),
    countChildren: vi.fn(async () => 0),
    programNamesLinkedTo: vi.fn(async (productKey: string) =>
      rows.filter((r) => r.type === 'program_name' && r.surrogateProductKey === productKey).map((r) => r.key),
    ),
    // Mirrors the real read: a linked name carries NULL here.
    findProgramName: vi.fn(async (key: string) =>
      OWN_RULE_KEYS.has(key) ? { key, incomeRule: { strategy: 'declared' } } : { key, incomeRule: null },
    ),
    incomeBasesOf: vi.fn(async (id: string) => bases[id] ?? {}),
    setIncomeBases: vi.fn(async () => 1),
    insert: vi.fn(async (input: Record<string, unknown>) => {
      const created = row({
        id: 'new',
        type: input.type as string,
        key: input.key as string,
        surrogateProductKey: (input.surrogateProductKey as string | null) ?? null,
      });
      rows.push(created);
      return created;
    }),
    updateById: vi.fn(async (id: string, patch: Record<string, unknown>) => {
      const target = rows.find((r) => r.id === id);
      if (target && patch.surrogateProductKey !== undefined) {
        target.surrogateProductKey = patch.surrogateProductKey as string | null;
      }
      return target as FakeRow;
    }),
    invalidateCache: vi.fn(),
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  const audit = { write: vi.fn(async () => undefined) };
  const service = new PlatformEnumerationsAdminService(audit as never, repo as never);
  return { service, audit };
}

const ACTOR = { staffId: 'staff_1', sourceIp: null };
const codeOf = (e: unknown): string => (e instanceof DomainException ? e.code : String(e));

describe('creating a no-payslip catalog name', () => {
  it('refuses one that names no surrogate product', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.create(
        {
          type: 'program_name',
          key: 'new_thing',
          labelAr: 'ج',
          labelEn: 'New',
          incomeBases: ['no_payslip'],
        } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_REQUIRED);
  });

  it('names the live products in the refusal, so the fix is on screen', async () => {
    const { service } = makeService(makeRepo(fixture()));
    const error = await service
      .create(
        { type: 'program_name', key: 'x', labelAr: 'x', labelEn: 'x', incomeBases: ['no_payslip'] } as never,
        ACTOR,
      )
      .catch((e: unknown) => e);
    const meta = (error as DomainException).meta as { activeProducts: string[] };
    expect(meta.activeProducts).toEqual(['compound_owner', 'declared_income']);
    // The deactivated one is not offered as a fix that would then be refused.
    expect(meta.activeProducts).not.toContain('retired_one');
  });

  it('accepts one that names a live product', async () => {
    const { service } = makeService(makeRepo(fixture()));
    const created = await service.create(
      {
        type: 'program_name',
        key: 'new_thing',
        labelAr: 'ج',
        labelEn: 'New',
        incomeBases: ['no_payslip'],
        surrogateProductKey: 'declared_income',
      } as never,
      ACTOR,
    );
    expect(created.surrogateProductKey).toBe('declared_income');
  });

  it('refuses a product that is not live', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.create(
        {
          type: 'program_name',
          key: 'x',
          labelAr: 'x',
          labelEn: 'x',
          incomeBases: ['no_payslip'],
          surrogateProductKey: 'retired_one',
        } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_UNKNOWN);
  });

  it('lets a payslip name through with no product at all', async () => {
    const { service } = makeService(makeRepo(fixture()));
    const created = await service.create(
      { type: 'program_name', key: 'plain', labelAr: 'p', labelEn: 'p', incomeBases: ['payslip'] } as never,
      ACTOR,
    );
    expect(created.surrogateProductKey).toBeNull();
  });

  it('refuses a product link on a type that has no such axis', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.create(
        { type: 'governorate', key: 'giza', labelAr: 'ج', labelEn: 'Giza', surrogateProductKey: 'declared_income' } as never,
        ACTOR,
      ),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.ENUMERATION_PARENT_NOT_APPLICABLE);
  });
});

describe('moving a name to the no-payslip basis', () => {
  it('refuses when nothing says how the income is worked out', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.setIncomeBases('n4', 'personal' as never, ['no_payslip'] as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_REQUIRED);
  });

  it('does not write the basis when it refuses', async () => {
    const rows = fixture();
    const repo = makeRepo(rows);
    const { service } = makeService(repo);
    await service.setIncomeBases('n4', 'personal' as never, ['no_payslip'] as never, ACTOR).catch(() => undefined);
    // The dialog writes the basis FIRST and relies on a refusal leaving the row untouched.
    expect(repo.setIncomeBases).not.toHaveBeenCalled();
  });

  it('allows it for a linked name', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.setIncomeBases('n1', 'personal' as never, ['no_payslip'] as never, ACTOR),
    ).resolves.toBeDefined();
  });

  it('allows it for a legacy name that states its own rule — grandfathered', async () => {
    // `professor` predates the archetypes and holds its own rule. Refusing here would make
    // it UNFIXABLE: the edit that would link it is the edit being refused.
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.setIncomeBases('n2', 'personal' as never, ['no_payslip'] as never, ACTOR),
    ).resolves.toBeDefined();
  });

  it('leaves the payslip basis alone', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(
      service.setIncomeBases('n4', 'personal' as never, ['payslip'] as never, ACTOR),
    ).resolves.toBeDefined();
  });
});

describe('retiring a surrogate product', () => {
  it('refuses while catalog names still link to it', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(service.update('p1', { active: false } as never, ACTOR)).rejects.toSatisfy(
      (e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_IN_USE,
    );
  });

  it('names which names to move, because they are on another screen', async () => {
    const { service } = makeService(makeRepo(fixture()));
    const error = await service.update('p1', { active: false } as never, ACTOR).catch((e: unknown) => e);
    expect((error as DomainException).meta).toMatchObject({
      key: 'compound_owner',
      names: ['compound_owner'],
    });
  });

  it('allows retiring one nothing links to', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(service.update('p2', { active: false } as never, ACTOR)).resolves.toBeDefined();
  });

  it('refuses a deprecate for the same reason as a deactivate', async () => {
    const { service } = makeService(makeRepo(fixture()));
    await expect(service.update('p1', { deprecate: true } as never, ACTOR)).rejects.toSatisfy(
      (e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_IN_USE,
    );
  });
});

describe('linking a name that already states its own rule', () => {
  it('refuses rather than silently discarding the rule', async () => {
    // A row holding BOTH is a fork: the engine quotes the product's copy while the name's
    // own page still reads the stale one, with nothing to reveal the disagreement.
    const { service } = makeService(makeRepo(fixture(), { n2: { personal: ['payslip'] } as never }));
    await expect(
      service.update('n2', { surrogateProductKey: 'declared_income' } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.PROGRAM_NAME_HAS_OWN_RULE);
  });

  it('writes nothing when it refuses', async () => {
    // Absorbing the rule was tried first and left the name UNFIXABLE — with the rule gone,
    // unlinking hits SURROGATE_PRODUCT_REQUIRED and there is no way back.
    const repo = makeRepo(fixture(), { n2: { personal: ['payslip'] } as never });
    const { service } = makeService(repo);
    await service
      .update('n2', { surrogateProductKey: 'declared_income' } as never, ACTOR)
      .catch(() => undefined);
    expect(repo.updateById).not.toHaveBeenCalled();
  });

  it('names the strategy that is in the way, so the operator knows what they are clearing', async () => {
    const { service } = makeService(makeRepo(fixture(), { n2: { personal: ['payslip'] } as never }));
    const error = await service
      .update('n2', { surrogateProductKey: 'declared_income' } as never, ACTOR)
      .catch((e: unknown) => e);
    expect((error as DomainException).meta).toMatchObject({ key: 'professor', strategy: 'declared' });
  });

  it('allows linking a name that states no rule of its own', async () => {
    const { service } = makeService(makeRepo(fixture(), { n4: { personal: ['payslip'] } as never }));
    await expect(
      service.update('n4', { surrogateProductKey: 'declared_income' } as never, ACTOR),
    ).resolves.toBeDefined();
  });
});

describe('unlinking', () => {
  it('refuses to unlink a no-payslip name that would then quote nothing', async () => {
    const { service } = makeService(makeRepo(fixture(), { n1: { personal: ['no_payslip'] } as never }));
    await expect(
      service.update('n1', { surrogateProductKey: null } as never, ACTOR),
    ).rejects.toSatisfy((e: unknown) => codeOf(e) === ERROR_CODES.SURROGATE_PRODUCT_REQUIRED);
  });

  it('allows unlinking once the name is back on the payslip basis', async () => {
    const { service } = makeService(makeRepo(fixture(), { n1: { personal: ['payslip'] } as never }));
    await expect(service.update('n1', { surrogateProductKey: null } as never, ACTOR)).resolves.toBeDefined();
  });

  it('audits the move in the same scalar shape a parentKey change writes', async () => {
    const { service, audit } = makeService(makeRepo(fixture(), { n1: { personal: ['payslip'] } as never }));
    await service.update('n1', { surrogateProductKey: 'declared_income' } as never, ACTOR);
    const payload = audit.write.mock.calls[0]?.[0] as { payload: { changes: Record<string, unknown> } };
    expect(payload.payload.changes).toMatchObject({
      surrogateProductKey: { from: 'compound_owner', to: 'declared_income' },
    });
  });
});

describe('the wire contract for the key', () => {
  const bad = (dto: object, cls: typeof CreateEnumerationDto | typeof UpdateEnumerationDto) =>
    validateSync(plainToInstance(cls, dto) as object).length > 0;

  it('refuses an empty string on create — "not linked" has one spelling', () => {
    // Stored, `''` is a link that resolves to nothing while looking set.
    expect(bad({ type: 'program_name', key: 'k', labelAr: 'a', labelEn: 'b', surrogateProductKey: '' }, CreateEnumerationDto)).toBe(true);
  });

  it('refuses an explicit null on create — a new row cannot be born unlinked-on-purpose', () => {
    expect(bad({ type: 'program_name', key: 'k', labelAr: 'a', labelEn: 'b', surrogateProductKey: null }, CreateEnumerationDto)).toBe(true);
  });

  it('accepts an absent key on create', () => {
    expect(bad({ type: 'program_name', key: 'k', labelAr: 'a', labelEn: 'b' }, CreateEnumerationDto)).toBe(false);
  });

  it('ACCEPTS an explicit null on patch — unlink is a real operator action', () => {
    // The one place this differs from `parentKey`, which has a bulk endpoint to carry its
    // unfile and so refuses `null` here.
    expect(bad({ surrogateProductKey: null }, UpdateEnumerationDto)).toBe(false);
  });

  it('still refuses an empty string on patch', () => {
    expect(bad({ surrogateProductKey: '' }, UpdateEnumerationDto)).toBe(true);
  });

  it('accepts an absent key on patch — a label edit must not touch the link', () => {
    expect(bad({ labelEn: 'Renamed' }, UpdateEnumerationDto)).toBe(false);
  });
});
