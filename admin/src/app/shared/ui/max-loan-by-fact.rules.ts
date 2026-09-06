/**
 * The maximum-loan table's pure decisions, split out from the editor that renders them.
 *
 * Split for the reason `income-rule.rules.ts` was: the thing that decides whether a bank's
 * typed figures survive an edit, and whether Save is refused, has to be exercisable without
 * a browser. Importing this from the component file pulls Angular's JIT compiler into a unit
 * test, which is how it went untested long enough for `rowVia` to be dropped on a whole
 * release.
 */
/** One cell of the table. Mirrors the backend `MaxLoanByFactRow` exactly. */
export interface MaxLoanByFactRow {
  rowKey?: string;
  fromInclusive?: string;
  toExclusive?: string | null;
  columnKey?: string;
  maxAmountEGP: string;
}

/** Which of the two things a row or column key names. Absent reads as `'answer'`. */
export type MaxLoanByFactVia = 'answer' | 'parentClass';

/** Mirrors the backend `MaxLoanByFactConfig`. */
export interface MaxLoanByFactConfig {
  factKey: string;
  columnFactKey?: string;
  rowVia?: MaxLoanByFactVia;
  columnVia?: MaxLoanByFactVia;
  rows: MaxLoanByFactRow[];
  onNoMatch: 'useProgramMax' | 'reject';
}

/** The subset of the backend's reasons this editor can see before a save. */
export type MaxLoanByFactError =
  | 'NO_ROWS'
  | 'ROW_MISSING_KEY'
  | 'DUPLICATE_ROW'
  | 'AMOUNT_INVALID'
  | 'BANDS_GAP'
  | 'BANDS_OVERLAP'
  | 'VIA_NOT_APPLICABLE'
  | null;

/**
 * The row without its column. Written as a rebuild rather than a rest-destructure so the
 * discarded key needs no throwaway binding, and so an added field has to be listed here
 * deliberately rather than carried by accident.
 */
export function withoutColumn(row: MaxLoanByFactRow): MaxLoanByFactRow {
  const next: MaxLoanByFactRow = { maxAmountEGP: row.maxAmountEGP };
  if (row.rowKey !== undefined) next.rowKey = row.rowKey;
  if (row.fromInclusive !== undefined) next.fromInclusive = row.fromInclusive;
  if (row.toExclusive !== undefined) next.toExclusive = row.toExclusive;
  return next;
}

/**
 * The config with a different ROW fact.
 *
 * Rows are CLEARED, not carried: a row keyed the other way round matches nothing at runtime,
 * so carrying them would leave a table that reads as configured and caps nobody — the exact
 * failure this whole control exists to make impossible.
 *
 * `rowVia` is cleared with them when the new fact has no class to walk up to. Carried
 * blindly it would be `via_not_applicable` at save, and the refusal the operator sees
 * ("check the answer it is keyed by, the rows, and the bands") never mentions the axis.
 */
export function withRowFact(
  config: MaxLoanByFactConfig,
  factKey: string,
  classKeyable: (key: string) => boolean,
): MaxLoanByFactConfig {
  const next: MaxLoanByFactConfig = {
    factKey,
    onNoMatch: config.onNoMatch,
    rows: [],
  };
  if (config.columnFactKey !== undefined) next.columnFactKey = config.columnFactKey;
  if (config.columnVia !== undefined) next.columnVia = config.columnVia;
  if (config.rowVia === 'parentClass' && classKeyable(factKey)) next.rowVia = 'parentClass';
  return next;
}

/**
 * The config with a different SECOND COLUMN, or with none.
 *
 * Written as a rebuild for the reason `withoutColumn` is: an added field has to be listed
 * here deliberately rather than carried by accident. That rule is right and the omission it
 * caused was not — `rowVia` went missing from this rebuild for a whole release, so clearing
 * the second column silently un-keyed ABK's doctors cap from the city tier and re-pointed it
 * at raw governorate codes it could never match.
 */
export function withColumnFact(
  config: MaxLoanByFactConfig,
  columnFactKey: string | null,
  classKeyable: (key: string) => boolean,
): MaxLoanByFactConfig {
  const next: MaxLoanByFactConfig = {
    factKey: config.factKey,
    onNoMatch: config.onNoMatch,
    // Dropping or changing the axis drops every row's column, so no row is left pointing at
    // a column that no longer exists.
    rows: config.rows.map((row) => withoutColumn(row)),
  };
  if (config.rowVia !== undefined) next.rowVia = config.rowVia;
  if (columnFactKey !== null) {
    next.columnFactKey = columnFactKey;
    // A class axis on the OLD column fact says nothing about the new one.
    if (config.columnVia === 'parentClass' && classKeyable(columnFactKey)) {
      next.columnVia = 'parentClass';
    }
  }
  return next;
}

function cellOf(row: MaxLoanByFactRow): string {
  const key = row.rowKey ?? `${row.fromInclusive ?? ''}..${row.toExclusive ?? ''}`;
  return `${key}|${row.columnKey ?? '_'}`;
}

/**
 * Client-side mirror of `validateMaxLoanByFact`, as a pure function so a host can gate its
 * own save on the same verdict the editor shows inline — including while the editor is not
 * rendered, which is every wizard step the admin has left.
 *
 * Deliberately a SUBSET: whether a fact exists and whether an option code is real are the
 * registry's questions, and the registry is the server's. The server re-checks everything on
 * save; this only saves the round trip on what the browser can already see.
 *
 * It must never OUT-refuse the server, and every judgement it cannot make itself is passed
 * IN rather than looked up here: `isNumericFact` is `false` while the registry is still
 * loading, and `axes` defaults to "not derived". Both fail towards accepting. A mirror that
 * refuses what the server accepts tells the operator their figures are unsavable with
 * nothing to fix — the failure `productRuleHasError` shipped with, and which
 * `admin/tests/product-rule-blocked.spec.ts` exists to keep closed.
 *
 * Reading the registry HERE is also what would drag Angular's `$localize` into a unit test:
 * the derived-axis list carries its own labels. Keeping this module free of it is the point
 * of the split.
 */
export function maxLoanByFactErrorFor(
  config: MaxLoanByFactConfig | null,
  isNumericFact: boolean,
  axes: { rowIsDerived?: boolean; columnIsDerived?: boolean } = {},
): MaxLoanByFactError {
  if (config === null) return null;

  // A class axis needs a class to walk up to, and the server refuses one that cannot have
  // it: a NUMERIC answer is filed under nothing, and a derived axis (known here / topping up
  // / holds a product) has no registry row at all. Left unrefused it does not fail loudly —
  // it matches no row and quietly falls through to `onNoMatch`.
  if (config.rowVia === 'parentClass' && (isNumericFact || axes.rowIsDerived === true)) {
    return 'VIA_NOT_APPLICABLE';
  }
  if (config.columnVia === 'parentClass' && axes.columnIsDerived === true) {
    return 'VIA_NOT_APPLICABLE';
  }

  if (config.rows.length === 0) return 'NO_ROWS';

  const seen = new Set<string>();
  for (const row of config.rows) {
    const amount = Number(row.maxAmountEGP);
    if (!Number.isFinite(amount) || amount <= 0) return 'AMOUNT_INVALID';
    if (isNumericFact) {
      if (row.fromInclusive === undefined && row.toExclusive === undefined) {
        return 'ROW_MISSING_KEY';
      }
    } else if (row.rowKey === undefined || row.rowKey === '') {
      return 'ROW_MISSING_KEY';
    }
    const cell = cellOf(row);
    if (seen.has(cell)) return 'DUPLICATE_ROW';
    seen.add(cell);
  }

  if (!isNumericFact) return null;

  // Bands, per column: two columns each state their own run, and a gap in one is not a gap
  // in the other.
  const columns = new Set(config.rows.map((r) => r.columnKey ?? '_'));
  for (const column of columns) {
    const run = config.rows
      .filter((r) => (r.columnKey ?? '_') === column)
      .map((r) => ({
        from: Number(r.fromInclusive ?? '0'),
        to: r.toExclusive === null || r.toExclusive === undefined ? null : Number(r.toExclusive),
      }))
      .sort((a, b) => a.from - b.from);
    for (let i = 1; i < run.length; i += 1) {
      const previous = run[i - 1];
      const current = run[i];
      if (previous === undefined || current === undefined) continue;
      if (previous.to === null) return 'BANDS_OVERLAP';
      if (previous.to < current.from) return 'BANDS_GAP';
      if (previous.to > current.from) return 'BANDS_OVERLAP';
    }
  }
  return null;
}
