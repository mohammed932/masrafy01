/**
 * Hard delete on the program-name catalog.
 *
 * Delete is not a second flavour of deprecate. Deprecating parks a name that IS
 * in use — the row survives to explain the keys bank programs and applications
 * still carry, and the picker simply stops offering it. Delete removes the row
 * and cascades its per-category assignments, which is only safe while NOTHING
 * names the key.
 *
 * That safety cannot be delegated to the database: neither
 * `bank_program.programNameKey` nor `application.programNameKey` carries an FK
 * (the catalog's unique key is the composite `(type, key)`), so Postgres would
 * take the row and leave both columns pointing at a name that no longer exists —
 * exactly the ghost rows A26 forbids. The guard lives in the service, and this
 * spec is what keeps it there.
 */
import { describe, expect, it, vi } from 'vitest';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { AuditEventType } from '@/common/audit/audit-event-types';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { DomainException } from '@/common/errors/domain.exceptions';

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
 * Stands in for `PostgresPlatformEnumerationsRepository`. `refs` is keyed by
 * catalog KEY, not id — mirroring the real reference columns, which is the whole
 * reason the check exists.
 */
function makeRepo(
  rows: FakeRow[],
  refs: Record<string, { programs: number; applications: number }> = {},
) {
  return {
    rows,
    findById: vi.fn(async (id: string) => rows.find((r) => r.id === id) ?? null),
    countProgramNameReferences: vi.fn(
      async (key: string) => refs[key] ?? { programs: 0, applications: 0 },
    ),
    deleteById: vi.fn(async (id: string) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    }),
    invalidateCache: vi.fn(function (this: void, type?: string) {
      return type;
    }),
  };
}

function makeService(repo: ReturnType<typeof makeRepo>) {
  const audit = { write: vi.fn(async () => undefined) };
  const service = new PlatformEnumerationsAdminService(audit as never, repo as never);
  return { service, audit };
}

const ACTOR = { staffId: 'stf_1', sourceIp: '127.0.0.1' };

describe('program-name delete', () => {
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

  it('refuses while bank programs still name the key, and reports both counts', async () => {
    const rows = [row({ id: 'pn_1', type: 'program_name', key: 'doctor' })];
    const repo = makeRepo(rows, { doctor: { programs: 3, applications: 0 } });
    const { service } = makeService(repo);

    await expect(service.remove('pn_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_IN_USE,
      meta: { key: 'doctor', programs: 3, applications: 0 },
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
    const repo = makeRepo(rows, { doctor: { programs: 0, applications: 12 } });
    const { service } = makeService(repo);

    await expect(service.remove('pn_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_IN_USE,
      meta: { programs: 0, applications: 12 },
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
   * Only `program_name` has an exhaustive, checkable reference list. A currency or
   * transfer type is named by key from places no single count covers, so deleting
   * one would dangle silently — the endpoint says so instead of guessing.
   */
  it('refuses any other enumeration type', async () => {
    const rows = [row({ id: 'cur_1', type: 'currency', key: 'EGP' })];
    const repo = makeRepo(rows);
    const { service } = makeService(repo);

    await expect(service.remove('cur_1', ACTOR)).rejects.toMatchObject({
      code: ERROR_CODES.ENUMERATION_DELETE_NOT_SUPPORTED,
      meta: { type: 'currency' },
    });
    expect(repo.countProgramNameReferences).not.toHaveBeenCalled();
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
    const repo = makeRepo(rows, { doctor: { programs: 1, applications: 0 } });
    const { service, audit } = makeService(repo);

    await expect(service.remove('pn_1', ACTOR)).rejects.toBeInstanceOf(DomainException);
    expect(audit.write).not.toHaveBeenCalled();
  });
});
