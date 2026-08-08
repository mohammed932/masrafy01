import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSocialName } from '../../src/customer-auth/name.util';
import { GooglePeopleService } from '../../src/customer-auth/social/google-people.service';

/**
 * Google social prefill (name from the ID token claims, birthday from the
 * People API). Both feed the Complete-Profile screen, so a wrong value here is
 * a wrong date of birth on a loan application — and age is derived from it
 * (Principle XXXVII / A31).
 */
describe('resolveSocialName', () => {
  it('prefers given_name / family_name over splitting the display name', () => {
    expect(
      resolveSocialName({
        givenName: 'Mohammed',
        familyName: 'Mokhtar Ali',
        fullName: 'Mohammed Mokhtar Ali',
      }),
    ).toEqual({ firstName: 'Mohammed', lastName: 'Mokhtar Ali' });
  });

  it('falls back to splitting the full name when a claim is missing', () => {
    expect(
      resolveSocialName({ givenName: null, familyName: null, fullName: 'Mona Hassan Fouad' }),
    ).toEqual({ firstName: 'Mona', lastName: 'Hassan Fouad' });
  });

  it('fills only the missing half from the split', () => {
    expect(
      resolveSocialName({ givenName: 'Mona', familyName: '', fullName: 'Mona Hassan Fouad' }),
    ).toEqual({ firstName: 'Mona', lastName: 'Hassan Fouad' });
  });

  it('returns empty strings when the provider supplied nothing', () => {
    expect(resolveSocialName({ givenName: null, familyName: null, fullName: null })).toEqual({
      firstName: '',
      lastName: '',
    });
  });
});

describe('GooglePeopleService.fetchBirthday', () => {
  const SUB = '1234567890';
  const service = new GooglePeopleService();

  const stubFetch = (
    body: unknown,
    init: { ok?: boolean; status?: number } = {},
  ): ReturnType<typeof vi.fn> => {
    const fn = vi.fn().mockResolvedValue({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the primary birthday as a UTC calendar date', async () => {
    stubFetch({
      resourceName: `people/${SUB}`,
      birthdays: [
        { metadata: { primary: false }, date: { year: 1980, month: 1, day: 2 } },
        { metadata: { primary: true }, date: { year: 1995, month: 6, day: 15 } },
      ],
    });

    const result = await service.fetchBirthday({
      accessToken: 'token',
      expectedProviderUserId: SUB,
    });

    expect(result?.toISOString()).toBe('1995-06-15T00:00:00.000Z');
  });

  it('skips year-less entries rather than guessing a year', async () => {
    // Google hides the year by default — a guessed one would be a fabricated age.
    stubFetch({
      resourceName: `people/${SUB}`,
      birthdays: [
        { metadata: { primary: true }, date: { month: 6, day: 15 } },
        { metadata: { primary: false }, date: { year: 1990, month: 3, day: 4 } },
      ],
    });

    const result = await service.fetchBirthday({
      accessToken: 'token',
      expectedProviderUserId: SUB,
    });

    expect(result?.toISOString()).toBe('1990-03-04T00:00:00.000Z');
  });

  it('rejects a response whose subject does not match the verified ID token', async () => {
    stubFetch({
      resourceName: 'people/999',
      birthdays: [{ metadata: { primary: true }, date: { year: 1995, month: 6, day: 15 } }],
    });

    await expect(
      service.fetchBirthday({ accessToken: 'token', expectedProviderUserId: SUB }),
    ).resolves.toBeNull();
  });

  it('rejects an overflowing calendar date', async () => {
    stubFetch({
      resourceName: `people/${SUB}`,
      birthdays: [{ metadata: { primary: true }, date: { year: 1995, month: 2, day: 31 } }],
    });

    await expect(
      service.fetchBirthday({ accessToken: 'token', expectedProviderUserId: SUB }),
    ).resolves.toBeNull();
  });

  it('resolves to null when the scope was declined (403)', async () => {
    stubFetch({}, { ok: false, status: 403 });

    await expect(
      service.fetchBirthday({ accessToken: 'token', expectedProviderUserId: SUB }),
    ).resolves.toBeNull();
  });

  it('never throws when the request itself fails', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fn);

    await expect(
      service.fetchBirthday({ accessToken: 'token', expectedProviderUserId: SUB }),
    ).resolves.toBeNull();
  });

  it('has no birthday to report when the account carries none', async () => {
    stubFetch({ resourceName: `people/${SUB}` });

    await expect(
      service.fetchBirthday({ accessToken: 'token', expectedProviderUserId: SUB }),
    ).resolves.toBeNull();
  });
});
