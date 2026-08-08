/**
 * The applicant picks a loan CATEGORY and a catalog PROGRAM NAME, and only
 * programs inside that pair are matched.
 *
 * Two things are pinned here, and they fail in opposite directions:
 *
 *  1. `matchesRequestedScope` — the filter itself. The interesting cases are the
 *     nulls, because null means "not narrowed" on the REQUEST side and
 *     "instantiates no archetype" on the PROGRAM side. Reading a program's null
 *     as a wildcard silently hands back programs the customer excluded.
 *
 *  2. `ProgramNameScopeService` — the request is REJECTED, never quietly
 *     widened, when the key is stale or is not offered under the chosen
 *     category. An ignored filter returns the whole category and looks like a
 *     successful narrow; an empty result looks like "no bank offers this". Both
 *     are lies the customer cannot act on, so the only honest answer is a typed
 *     error code.
 */
import { describe, expect, it } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { matchesRequestedScope } from '@/bank-programs/program-scope';
import { ProgramNameScopeService } from '@/platform-enumerations/program-name-scope.service';
import type {
  EnumerationMember,
  PlatformEnumerationsRepository,
} from '@/platform-enumerations/platform-enumerations.repository';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';

const program = (productCategory: string, programNameKey: string | null) => ({
  productCategory,
  programNameKey,
});

describe('matchesRequestedScope', () => {
  it('keeps a program matching both halves of the pair', () => {
    expect(matchesRequestedScope(program('personal', 'doctor_loans'), 'personal', 'doctor_loans')).toBe(
      true,
    );
  });

  it('drops a program from another category', () => {
    expect(matchesRequestedScope(program('car', 'doctor_loans'), 'personal', 'doctor_loans')).toBe(
      false,
    );
  });

  it('drops a program of another archetype in the same category', () => {
    expect(matchesRequestedScope(program('personal', 'pharmacy'), 'personal', 'doctor_loans')).toBe(
      false,
    );
  });

  it('compares the category case-insensitively — the column is free text', () => {
    expect(matchesRequestedScope(program('Personal', 'doctor_loans'), 'personal', 'doctor_loans')).toBe(
      true,
    );
  });

  it('with no requested name, keeps every program in the category', () => {
    expect(matchesRequestedScope(program('personal', 'doctor_loans'), 'personal', null)).toBe(true);
    expect(matchesRequestedScope(program('personal', null), 'personal', null)).toBe(true);
  });

  it('with no requested category (legacy submit), narrows on nothing', () => {
    expect(matchesRequestedScope(program('mortgage', 'pharmacy'), null, null)).toBe(true);
  });

  // The asymmetry that makes the nulls worth a test: absent on the request means
  // "not narrowed", absent on the program means "instantiates no archetype".
  it('never treats a pre-catalog program as a wildcard for a requested name', () => {
    expect(matchesRequestedScope(program('personal', null), 'personal', 'doctor_loans')).toBe(false);
  });
});

/** Registry double: one live name offered under personal + car, one parked. */
function fakeRegistry(): PlatformEnumerationsRepository {
  const members: Record<string, { active: boolean; categories: LoanCategory[] }> = {
    doctor_loans: { active: true, categories: [LoanCategory.personal, LoanCategory.car] },
    parked_name: { active: true, categories: [] },
    retired_name: { active: false, categories: [LoanCategory.personal] },
  };
  return {
    isAvailable: async () => true,
    isActiveMember: async (_type, key) => members[key]?.active === true,
    isDeprecatedMember: async (_type, key) => members[key]?.active === false,
    getActiveMembers: async () =>
      Object.entries(members)
        .filter(([, m]) => m.active)
        .map(([key]) => ({ key }) as EnumerationMember),
    memberCategories: async (_type, key) => members[key]?.categories ?? [],
    memberQuestionTemplate: async () => null,
  } as unknown as PlatformEnumerationsRepository;
}

describe('ProgramNameScopeService.assertOfferedUnder', () => {
  const service = new ProgramNameScopeService(fakeRegistry());

  it('accepts a live name assigned to the requested category', async () => {
    await expect(
      service.assertOfferedUnder('doctor_loans', LoanCategory.personal),
    ).resolves.toBeUndefined();
  });

  it('rejects a name that exists but is not offered under this category', async () => {
    const err = await service
      .assertOfferedUnder('doctor_loans', LoanCategory.mortgage)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DomainException);
    expect((err as DomainException).code).toBe(ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY);
    // The set it IS offered under travels with the error, so the app can say
    // where to go instead of only refusing.
    expect((err as DomainException).meta).toMatchObject({
      assignedCategories: [LoanCategory.personal, LoanCategory.car],
    });
  });

  it('rejects a parked name (assigned to nothing) under every category', async () => {
    const err = await service
      .assertOfferedUnder('parked_name', LoanCategory.personal)
      .catch((e: unknown) => e);
    expect((err as DomainException).code).toBe(ERROR_CODES.PROGRAM_NAME_KEY_NOT_IN_CATEGORY);
  });

  it('rejects an unknown key', async () => {
    const err = await service
      .assertOfferedUnder('nope', LoanCategory.personal)
      .catch((e: unknown) => e);
    expect((err as DomainException).code).toBe(ERROR_CODES.PROGRAM_NAME_KEY_UNKNOWN);
  });

  // A deprecated name is only reachable from a stale app screen — the picker
  // renders active members only — so it reports as unknown, whose remedy ("pick
  // again from the list") is the one the customer can actually follow.
  it('reports a deprecated name as unknown, not as a category mismatch', async () => {
    const err = await service
      .assertOfferedUnder('retired_name', LoanCategory.personal)
      .catch((e: unknown) => e);
    expect((err as DomainException).code).toBe(ERROR_CODES.PROGRAM_NAME_KEY_UNKNOWN);
  });
});
