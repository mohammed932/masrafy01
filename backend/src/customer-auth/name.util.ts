/**
 * Splits a provider-supplied full name (Google / Apple) into first + last.
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
