/**
 * A key-order-stable JSON string, for COMPARING two blobs that mean the same thing.
 *
 * `JSON.stringify` preserves insertion order, so two objects with identical content
 * serialise differently the moment one of them was rebuilt — which is exactly what
 * happens to a rule that passed through a merge (`{...incoming, steps, gates, output}`
 * against a stored `{strategy, steps, gates, output, stepParams}`). Compared that way, a
 * no-op save reports itself as a change and the audit log stops meaning anything.
 *
 * Recursive, because a `keyTable` row and a band are objects too. Arrays keep their order:
 * a band table's order is load-bearing (the lookup is first-match), so two tables that
 * differ only in order are genuinely different.
 */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
}
