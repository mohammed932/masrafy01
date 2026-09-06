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

// --- the product's declared grid --------------------------------------------------------
//
// When a program's catalog name resolves to a surrogate product whose blueprint declares a
// cap, the table stops being built row by row: the axes and the keys are the product's, in
// the order its sheet prints them, and the bank types only the amounts. Everything below is
// the projection between that declared grid and the flat `rows[]` the engine reads.
//
// The shape carries NO money. Amounts come from the product's own `capDefaults` — figures an
// operator typed once on the product screen — or from what this bank has already stored.

/** The blueprint's declared grid. Mirrors the backend `BlueprintCap` exactly. */
export interface ProductCapShape {
  readonly factKey: string;
  readonly columnFactKey?: string;
  readonly rowVia?: MaxLoanByFactVia;
  readonly columnVia?: MaxLoanByFactVia;
  readonly onNoMatch: 'useProgramMax' | 'reject';
  /** Row keys in the order the sheet prints them... */
  readonly rowKeys?: readonly string[];
  /** ...or the brackets, when the row axis is a number. */
  readonly bands?: readonly { fromInclusive: string; toExclusive: string | null }[];
  readonly columnKeys?: readonly string[];
}

/** One cell of the declared grid, before any amount is put in it. */
export interface CapCell {
  readonly rowKey?: string;
  readonly fromInclusive?: string;
  readonly toExclusive?: string | null;
  readonly columnKey?: string;
}

/** One cell with whatever amount it currently holds. */
export interface CapGridCell {
  readonly cell: CapCell;
  readonly amount: string;
}

/**
 * Every cell the product declares, in declared order.
 *
 * Row-major: all of one row's columns together, so the grid reads the way the sheet prints
 * it and a caller can chunk by `columnKeys.length` without re-deriving the order.
 *
 * A shape with neither `rowKeys` nor `bands` declares no grid at all and yields nothing —
 * which is what keeps a product that only names its axes out of the product-driven path.
 */
export function capCellsOf(shape: ProductCapShape): CapCell[] {
  const columns: (string | undefined)[] =
    shape.columnKeys && shape.columnKeys.length > 0 ? [...shape.columnKeys] : [undefined];
  const rows: CapCell[] = shape.rowKeys
    ? shape.rowKeys.map((rowKey) => ({ rowKey }))
    : (shape.bands ?? []).map((band) => ({
        fromInclusive: band.fromInclusive,
        toExclusive: band.toExclusive,
      }));
  return rows.flatMap((row) =>
    columns.map((columnKey) => (columnKey === undefined ? { ...row } : { ...row, columnKey })),
  );
}

/** The cell id, through the SAME expression the duplicate check uses. */
function capCellId(cell: CapCell): string {
  return cellOf({ ...cell, maxAmountEGP: '' });
}

/**
 * The declared grid filled in, plus every stored row that falls outside it.
 *
 * `unlisted` is the guarantee that no typed figure is ever hidden. A blueprint whose
 * `rowKeys` change later, a row written by an older seed, a key the question no longer
 * carries — all of them keep their amount, on screen and editable, instead of disappearing
 * from a grid that looks complete. The orphan lane is lifted from `income-key-table`'s
 * `displayRows`, which exists for the same reason.
 *
 * `defaults` fills a cell only where this bank has stored nothing. A bank that typed a zero-
 * length string is treated as having stored nothing, because that is what a cleared box is.
 */
export function capGridFrom(
  shape: ProductCapShape,
  config: MaxLoanByFactConfig | null,
  defaults: readonly MaxLoanByFactRow[] = [],
): { declared: CapGridCell[]; unlisted: MaxLoanByFactRow[] } {
  const stored = new Map((config?.rows ?? []).map((row) => [capCellId(row), row]));
  const fallback = new Map(defaults.map((row) => [capCellId(row), row]));

  const declared = capCellsOf(shape).map((cell) => {
    const id = capCellId(cell);
    const own = stored.get(id)?.maxAmountEGP ?? '';
    const amount = own !== '' ? own : (fallback.get(id)?.maxAmountEGP ?? '');
    return { cell, amount };
  });

  const declaredIds = new Set(declared.map((entry) => capCellId(entry.cell)));
  const unlisted = (config?.rows ?? []).filter((row) => !declaredIds.has(capCellId(row)));
  return { declared, unlisted };
}

/**
 * The grid back as a config, or `null` when nothing is filled in.
 *
 * `null` is load-bearing three ways, and all three are why a blank grid must store NOTHING
 * rather than an empty table: the wire DTO holds `rows` to at least one entry, every amount
 * must be a positive decimal, and the wizard's payload omits the field entirely when the
 * signal is null. So a program on a product that declares a cap, whose bank has not typed a
 * figure, saves byte-identical to what it stores today.
 *
 * Cells are emitted in declared order and blank ones are dropped: a partial table is a
 * legitimate state, which is exactly what `onNoMatch` exists to answer for.
 */
export function capConfigFrom(
  shape: ProductCapShape,
  grid: { declared: readonly CapGridCell[]; unlisted: readonly MaxLoanByFactRow[] },
  onNoMatch: 'useProgramMax' | 'reject',
  storedOrder: readonly MaxLoanByFactRow[] = [],
): MaxLoanByFactConfig | null {
  const rows: MaxLoanByFactRow[] = [];
  for (const entry of grid.declared) {
    if (entry.amount.trim() === '') continue;
    rows.push({ ...entry.cell, maxAmountEGP: entry.amount });
  }
  rows.push(...grid.unlisted.filter((row) => row.maxAmountEGP.trim() !== ''));
  if (rows.length === 0) return null;

  // ROW ORDER IS A STATEMENT, not a rendering detail, so a row that was already stored keeps
  // its place. `fact-value.ts` reads a multi-pick answer top to bottom and the FIRST row
  // whose key the applicant chose wins — "row order is the operator's way of saying which
  // answer outranks which" — and `keyableFacts` admits a MULTI_SELECT fact. Re-emitting in
  // the product's declared order would re-rank an applicant who picked two answers, on a
  // save that merely re-rendered the table. New rows follow, in declared order.
  const rank = new Map(storedOrder.map((row, index) => [cellOf(row), index]));
  // A row the stored table did not have sorts AFTER every one it did, keeping the order this
  // function emitted it in. Ranked with `Infinity` instead, two new rows would compare
  // `Infinity - Infinity` = NaN and the sort would be free to shuffle them.
  const base = rank.size;
  const ranked = rows.map((row, index) => ({ row, at: rank.get(cellOf(row)) ?? base + index }));
  ranked.sort((a, b) => a.at - b.at);
  const ordered = ranked.map((entry) => entry.row);

  const next: MaxLoanByFactConfig = { factKey: shape.factKey, onNoMatch, rows: ordered };
  if (shape.columnFactKey !== undefined) next.columnFactKey = shape.columnFactKey;
  if (shape.rowVia !== undefined) next.rowVia = shape.rowVia;
  if (shape.columnVia !== undefined) next.columnVia = shape.columnVia;
  return next;
}

/**
 * Is a stored table keyed differently from what the product declares?
 *
 * When it is, the editor stays on its free-form controls: re-keying somebody's live table to
 * the product's axes would leave every one of its rows matching nothing at runtime — a table
 * that reads as configured and caps nobody, which is the exact failure `withRowFact` clears
 * rows to avoid. The server refuses this state on the next save and names it; the screen's
 * job is not to hide it.
 */
export function capShapeConflict(
  shape: ProductCapShape,
  config: MaxLoanByFactConfig | null,
): boolean {
  if (config === null) return false;
  return (
    config.factKey !== shape.factKey ||
    (config.columnFactKey ?? null) !== (shape.columnFactKey ?? null) ||
    (config.rowVia ?? 'answer') !== (shape.rowVia ?? 'answer') ||
    (config.columnVia ?? 'answer') !== (shape.columnVia ?? 'answer')
  );
}

/**
 * Declared cells with no amount anywhere.
 *
 * A WARNING, never an error: an answer with no row falls to `onNoMatch`, which is a stated
 * policy and not a defect. Mirrors `missingKeys` in `income-key-table.component.ts`.
 */
export function missingCapCells(
  shape: ProductCapShape,
  config: MaxLoanByFactConfig | null,
  defaults: readonly MaxLoanByFactRow[] = [],
): CapCell[] {
  return capGridFrom(shape, config, defaults)
    .declared.filter((entry) => entry.amount.trim() === '')
    .map((entry) => entry.cell);
}
