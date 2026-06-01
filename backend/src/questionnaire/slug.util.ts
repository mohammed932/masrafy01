/**
 * Auto-generates immutable `code` slugs from an English label (Principle V /
 * A33: codes are never hand-typed). Lowercase, alnum + underscore, collisions
 * resolved with a numeric suffix against the provided existing-code set.
 */
export function slugify(label: string): string {
  const base = label
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base.length > 0 ? base.slice(0, 60) : 'item';
}

export function uniqueSlug(label: string, existing: ReadonlySet<string>): string {
  const base = slugify(label);
  if (!existing.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}_${i}`.slice(0, 64);
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}_${Date.now()}`.slice(0, 64);
}
