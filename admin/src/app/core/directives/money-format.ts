/**
 * The money field's pure formatting rules — no Angular, deliberately.
 *
 * `MoneyInputDirective` is the one value accessor behind every amount field in the admin
 * (A27), so these rules deserve tests; importing the directive to reach them drags Angular's
 * JIT into a test about string formatting, which is why the repo's specs import pure modules
 * only. Same reason the directive re-exports them: no caller has to know they moved.
 */
/** Strip to a canonical numeric string: digits with at most one decimal point, no separators. */
export function toRaw(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot) + '.' + cleaned.slice(dot + 1).replace(/\./g, '');
}

/** "1000000" → "1,000,000"; keeps any decimal part intact. */
export function group(value: string): string {
  const raw = toRaw(value);
  if (raw === '') return '';
  const dot = raw.indexOf('.');
  const intPart = dot === -1 ? raw : raw.slice(0, dot);
  const fracPart = dot === -1 ? null : raw.slice(dot + 1);
  const intGrouped = intPart === '' ? '0' : Number(intPart).toLocaleString('en-US');
  return fracPart === null ? intGrouped : `${intGrouped}.${fracPart}`;
}

/**
 * What the field SHOWS for a raw value, under the grouping setting the caller declared.
 *
 * Pure and exported so the two branches are testable without a TestBed: the directive is
 * the only value accessor for every money field in the admin (A27), and "does a percentage
 * stay ungrouped" is exactly the kind of thing that should fail a test rather than a screen.
 */
export function displayValue(raw: string, grouping: boolean): string {
  return grouping ? group(raw) : toRaw(raw);
}

/**
 * Read-only counterpart of what the directive renders, for summary lines and
 * static labels that sit beside a money field ("20000000.00" → "20,000,000").
 * `en-US` digits deliberately: the editable field shows the same, and one screen
 * must not mix two digit systems. Trailing fraction zeros are dropped — money
 * bounds are authored in whole units and ".00" is noise outside an input.
 */
export function formatGroupedNumber(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('en-US', { maximumFractionDigits: 4 })
    : value;
}
