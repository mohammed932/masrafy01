/**
 * Hard delete on the platform enumeration registry — every type whose readers can
 * be counted, not just the program-name catalog.
 *
 * Delete is not a second flavour of deprecate. Deprecating parks a value that IS
 * in use — the row survives to explain the keys bank programs, applications and
 * profiles still carry, and every picker simply stops offering it. Delete removes
 * the row and cascades its per-category assignments, which is only safe while
 * NOTHING names the key.
 *
 * That safety cannot be delegated to the database: no enumeration key carries an
 * FK anywhere (the registry's unique key is the composite `(type, key)`), so
 * Postgres would take the row and leave every reader pointing at a value that no
 * longer exists — exactly the ghost rows A26 forbids. The guard lives in the
 * service, and this spec is what keeps it there.
 */
import { describe, expect, it, vi } from 'vitest';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { AuditEventType } from '@/common/audit/audit-event-types';
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
    sortOrder: 0,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  };
}

/**
 * Types the real `countReferences` enumerates the readers of. Everything else
 * returns `null` there, which is a refusal rather than a zero.
 */
const COUNTABLE = new Set([
  'program_name',
  'product_category',
  'required_document',
  'governorate',
  'employment_type',
  'transfer_type',
  'surrogate_fact',
]);

/**
 * Stands in for `PostgresPlatformEnumerationsRepository`. `refs` is keyed by
 * registry KEY, not id — mirroring the real reference columns, which is the whole
 * reason the check exists.
 */
function makeRepo(
  rows: FakeRow[],
  refs: Record<string, Array<{ source: string; count: number }>> = {},
) {
  return {
    rows,
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    countReferences: vi.fn(async (type: string, key: string) =>
      COUNTABLE.has(type) ? (refs[key] ?? []) : null,
    ),
    deleteById: vi.fn(async (id: string) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    }),
    invalidateCache: vi.fn(function (this: void, type?: string) {
      return type;
    }),
    // Read after every value write, to decide whether a question mirrors this list. None of
    // these builtins does, so the sync stops there — which is what these specs assert about
    // by NOT expecting a publish.
    typeDefinitions: vi.fn(async () => fakeTypeDefinitions()),
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  const audit = { write: vi.fn(async () => undefined) };
  const questionnaire = { syncMirroredOptions: vi.fn(async () => false) };
  const service = new PlatformEnumerationsAdminService(
    audit as never,
    repo as never,
    questionnaire as never,
  );
  return { service, audit, questionnaire };
}

const ACTOR = { staffId: 'stf_1', sourceIp: '127.0.0.1' };

describe('enumeration delete', () => {
  it('removes a name nothing points at', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.remove('pn_1', ACTOR);

    expect(repo.deleteById).toHaveBeenCalledWith('pn_1');
    expect(rows).toHaveLength(0);
    // The registry cache holds `program_name` members, so a deleted name that
    // stayed cached would keep appearing in the bank-program picker for a minute.
    expect(repo.invalidateCache).toHaveBeenCalledWith('program_name');
  });

  it('refuses while bank programs still name the key, and reports the surface', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows, {
      doctor: [
        { source: 'bank_program', count: 3 },
        { source: 'application', count: 0 },
      ],
    });
    const { service } = makeService(repo);

    await expect(service.remove('pn_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_IN_USE,
      // The empty surface is dropped from the meta: `application: 0` reads as an
      // instruction to go looking for rows there are none of.
      meta: { key: 'doctor', references: 3, usedBy: [{ source: 'bank_program', count: 3 }] },
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  /**
   * The case a program-count-only guard would miss. A name every bank has stopped
   * offering still explains which programs an old application was narrowed to, and
   * deleting the row underneath it makes that unrecoverable.
   */
  it('refuses on applications alone, with no bank programs left', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows, {
      doctor: [
        { source: 'bank_program', count: 0 },
        { source: 'application', count: 12 },
      ],
    });
    const { service } = makeService(repo);

    await expect(service.remove('pn_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_IN_USE,
      meta: { references: 12, usedBy: [{ source: 'application', count: 12 }] },
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  /**
   * Delete is not the catalog's private feature. Every type whose readers are
   * counted gets it — a fact typed by mistake on Manage values is exactly the row
   * that should not become a permanent tombstone in the Deprecated list.
   */
  it('removes an unused value of a non-catalog type', async () => {
    const rows = [row({ id: 'sf_1', type: 'surrogate_fact', key: 'test' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.remove('sf_1', ACTOR);

    expect(repo.countReferences).toHaveBeenCalledWith('surrogate_fact', 'test');
    expect(rows).toHaveLength(0);
    expect(repo.invalidateCache).toHaveBeenCalledWith('surrogate_fact');
  });

  it('refuses a non-catalog value something still reads', async () => {
    const rows = [row({ id: 'sf_1', type: 'surrogate_fact', key: 'taxi_licence' })];
    const repo = makeRepo(rows, { taxi_licence: [{ source: 'bank_program', count: 2 }] });
    const { service } = makeService(repo);

    await expect(service.remove('sf_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_IN_USE,
      meta: { references: 2 },
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('deletes a DEPRECATED name that nothing points at', async () => {
    // The commonest real case: a name retired months ago whose last program was
    // repointed. Deprecation is what makes it deletable-in-principle; the
    // reference count is what makes it deletable now.
    const rows = [
      row({
        id: 'pn_1',
        type: 'program_name',
        key: 'doctor',
        active: false,
        deprecatedAt: new Date('2026-02-01T00:00:00Z'),
      }),
    ];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await service.remove('pn_1', ACTOR);
    expect(rows).toHaveLength(0);
  });

  it('refuses a systemOnly row', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor', systemOnly: true })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await expect(service.remove('pn_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_SYSTEM_ONLY,
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  /**
   * A type whose readers `countReferences` does not enumerate has no checkable
   * reference list — no enumeration key carries an FK, so nothing else could prove
   * the row is unused. The endpoint says so instead of guessing.
   */
  it('refuses a type whose references cannot be counted', async () => {
    const rows = [row({ id: 'pt_1', type: 'property_type', key: 'villa' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await expect(service.remove('pt_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_DELETE_NOT_SUPPORTED,
      meta: { type: 'property_type' },
    });
    expect(repo.deleteById).not.toHaveBeenCalled();
  });

  it('refuses an unknown id', async () => {
    const repo = makeRepo([]);
    const { service } = makeService(repo);

    await expect(service.remove('nope', ACTOR)).rejects.toBeInstanceOf(DomainException);
  });

  /**
   * Once the row is gone the audit event is the ONLY record that the key existed,
   * so it carries the labels rather than just the id — and its own event type,
   * since "deprecated" and "deleted" answer different questions about whether the
   * name can come back.
   */
  it('audits the delete with the labels, under its own event type', async () => {
    const rows = [
      row({
        id: 'pn_1',
        type: 'program_name',
        key: 'doctor',
        labelEn: 'Doctor Loans',
        labelAr: 'قروض الأطباء',
      }),
    ];
    const repo = makeRepo(rows);
    const { service, audit } = makeService(repo);

    await service.remove('pn_1', ACTOR);

    expect(audit.write).toHaveBeenCalledTimes(1);
    expect(audit.write.mock.calls[0]?.[0]).toMatchObject({
      eventType: AuditEventType.PLATFORM_ENUMERATION_DELETED,
      actorId: 'stf_1',
      payload: {
        type: 'program_name',
        key: 'doctor',
        labelEn: 'Doctor Loans',
        labelAr: 'قروض الأطباء',
      },
    });
  });

  it('writes no audit event when the delete is refused', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows, { doctor: [{ source: 'bank_program', count: 1 }] });
    const { service, audit } = makeService(repo);

    await expect(service.remove('pn_1', ACTOR)).rejects.toBeInstanceOf(DomainException);
    expect(audit.write).not.toHaveBeenCalled();
  });
});
