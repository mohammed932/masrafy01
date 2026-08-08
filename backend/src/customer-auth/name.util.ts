/**
 * Splits a provider-supplied full name (Google) into first + last.
 * First token → firstName; remainder → lastName (empty string when absent).
 */
export function splitFullName(full: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = (full ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return { firstName: '', lastName: '' };
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1),
  };
}

/**
 * Prefers the provider's own `given_name` / `family_name` over splitting the
 * display name on the first space. Google already knows where the boundary is,
 * so "Mohammed Mokhtar Ali" no longer lands as first="Mohammed",
 * last="Mokhtar Ali" when the claims say otherwise. Falls back to
 * {@link splitFullName} when either claim is absent.
 */
export function resolveSocialName(identity: {
  givenName?: string | null;
  familyName?: string | null;
  fullName?: string | null;
}): { firstName: string; lastName: string } {
  const given = (identity.givenName ?? '').trim();
  const family = (identity.familyName ?? '').trim();
  if (given && family) return { firstName: given, lastName: family };
  const split = splitFullName(identity.fullName);
  return {
    firstName: given || split.firstName,
    lastName: family || split.lastName,
  };
}
