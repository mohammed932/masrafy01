/**
 * Machine keys minted from an English label, client-side.
 *
 * A MIRROR, never the authority: every key this produces is sent as a proposal and the server
 * decides (`KEY_PATTERN` on the enumeration DTOs, `uniqueSlug` on the questionnaire's). It
 * exists because two screens have to WRITE a key rather than merely preview one — a list and
 * its values are created together, and a value cannot name a class whose key has not been
 * minted yet.
 *
 * Shared rather than copied for the reason a third copy would prove: the enumeration edit
 * dialog and the product screen both slug labels, and two rules would put `new_giza` under one
 * and `newgiza` under the other for the same typed words.
 */

/** Lowercase, non-alphanumeric → `_`, trimmed of leading/trailing `_`, ≤64. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/**
 * `slugify`, made unique against keys already taken.
 *
 * Falls back to the base after 98 tries rather than looping: a hundred values whose labels all
 * slug identically is a data-entry problem, and the server's own refusal says so more clearly
 * than a key with a random tail would.
 */
export function uniqueSlug(label: string, taken: ReadonlySet<string>): string {
  const base = slugify(label);
  if (base === '' || !taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}
