/**
 * The N-axis grid's pure decisions, split out from the editor that renders them.
 *
 * Split for the reason `max-loan-by-fact.rules.ts` and `income-rule.rules.ts` were: the thing
 * that decides whether Save is refused has to be exercisable without a browser. Importing it
 * from the component pulls Angular's JIT compiler into a unit test, which is how `rowVia`
 * went untested long enough to be dropped on a whole release.
 *
 * ─── A MIRROR MUST NEVER OUT-REFUSE THE SERVER ────────────────────────────────
 *
 * This restates `backend/src/bank-programs/validation/fact-grid.validator.ts`. The two can
 * drift, and the direction that matters is one-way: a mirror that refuses something the
 * server would accept tells the operator their table is unsavable with nothing to fix, which
 * is the `productRuleHasError` defect this repo has already shipped once. So every check here
 * that needs information the browser does not reliably hold — whether a fact is numeric while
 * the registry is still loading, say — fails towards ACCEPTING and lets the server answer.
 */

/** Mirrors the backend `FactGridAxis`. */
export interface FactGridAxis {
  factKey: string;
  via?: 'answer' | 'parentClass';
}

/**
 * What one cell states on one axis. `null` is an EXPLICIT wildcard — "whatever the answer" —
 * and an object stating neither a key nor an edge is a half-typed cell that matches nothing.
 * The two are different on purpose; see the backend's `FactGridKey`.
 */
export type FactGridKey =
  | { key: string }
  | { fromInclusive?: string; toExclusive?: string | null }
  | null;

export interface FactGridCell {
  keys: FactGridKey[];
  value: string;
}

export interface FactGridConfig {
  axes: FactGridAxis[];
  cells: FactGridCell[];
  onNoMatch: 'useFallback' | 'reject';
}

/** What the figure in a cell means — the only thing that differs between the grids. */
export type FactGridValueKind = 'ratePercent' | 'months' | 'sharePercent' | 'amountEGP';

/** The subset of the backend's reasons this editor can see before a save. */
export type FactGridError =
  | 'AXES_EMPTY'
  | 'AXIS_DUPLICATE'
  | 'AXIS_MISSING_FACT'
  | 'CELLS_EMPTY'
  | 'CELL_ARITY'
  | 'CELL_ALL_WILDCARD'
  | 'CELL_KEY_INVALID'
  | 'CELL_VALUE_INVALID';

export const MAX_GRID_AXES = 4;

/** An empty grid in the shape the editor starts from: one axis, one cell, falling back to the program's own figure for an answer no row covers. */
export function emptyFactGrid(): FactGridConfig {
  return { axes: [{ factKey: '' }], cells: [{ keys: [null], value: '' }], onNoMatch: 'useFallback' };
}

function keyIsStated(key: FactGridKey): boolean {
  if (key === null) return false;
  if ('key' in key) return typeof key.key === 'string' && key.key !== '';
  const from = key.fromInclusive;
  const to = key.toExclusive;
  return (
    (typeof from === 'string' && from.trim() !== '') || (typeof to === 'string' && to.trim() !== '')
  );
}

function keyShapeValid(key: FactGridKey): boolean {
  // `null` is the wildcard and is always valid. An object that states nothing is half-typed:
  // it matches no applicant at runtime, so it is a table an operator meant to finish.
  return key === null || keyIsStated(key);
}

function valueValid(raw: string, kind: FactGridValueKind): boolean {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (kind === 'ratePercent') return n <= 999.9999;
  // Mirrors the server's own bound exactly. A share above 100 is not a share, and the
  // engine's ceiling reader answers `null` above it — so the refusal has to be here, where
  // the operator can still see the box they typed it in.
  if (kind === 'sharePercent') return n <= 100;
  if (kind === 'amountEGP') return n <= 99999999999.99;
  return Number.isInteger(n) && n <= 480;
}

/**
 * The first thing wrong with this grid, or `null`.
 *
 * FIRST rather than all of them, matching `maxLoanByFactErrorFor`: the editor shows one
 * sentence under the table, and a list of eight would be a wall an operator scrolls past.
 */
export function factGridErrorFor(
  config: FactGridConfig | null,
  kind: FactGridValueKind,
): FactGridError | null {
  if (config === null) return null;

  const axes = config.axes ?? [];
  if (axes.length === 0) return 'AXES_EMPTY';

  const seen = new Set<string>();
  for (const axis of axes) {
    if (!axis.factKey) return 'AXIS_MISSING_FACT';
    if (seen.has(axis.factKey)) return 'AXIS_DUPLICATE';
    seen.add(axis.factKey);
  }

  const cells = config.cells ?? [];
  if (cells.length === 0) return 'CELLS_EMPTY';

  for (const cell of cells) {
    const keys = cell.keys ?? [];
    if (keys.length !== axes.length) return 'CELL_ARITY';
    if (!keys.every(keyShapeValid)) return 'CELL_KEY_INVALID';
    // Every axis a wildcard means this cell prices EVERY applicant at whatever figure sits
    // beside it — the failure `max-loan-by-fact` avoids by refusing to read an empty row as
    // "any". With one axis it is also the only way to say "one flat figure", which is what
    // `onNoMatch` is for, so it is refused there too.
    if (!keys.some(keyIsStated)) return 'CELL_ALL_WILDCARD';
    if (!valueValid(cell.value, kind)) return 'CELL_VALUE_INVALID';
  }

  return null;
}

/** A cell with one key per axis, so adding an axis cannot leave the rows mis-aligned. */
export function cellForAxes(axes: readonly FactGridAxis[], value = ''): FactGridCell {
  return { keys: axes.map(() => null), value };
}

/**
 * Re-shape every cell to the axis count.
 *
 * Called whenever an axis is added or removed. Keys are matched POSITIONALLY, so removing
 * axis 1 of 3 shifts axis 2's keys left — which is what an operator watching the column
 * disappear expects, and the alternative (keying by fact) silently keeps a key belonging to
 * an axis that is gone.
 */
export function withAxisCount(config: FactGridConfig, removedIndex?: number): FactGridConfig {
  const width = config.axes.length;
  return {
    ...config,
    cells: config.cells.map((cell) => {
      const keys =
        removedIndex === undefined
          ? [...cell.keys]
          : cell.keys.filter((_, i) => i !== removedIndex);
      while (keys.length < width) keys.push(null);
      return { ...cell, keys: keys.slice(0, width) };
    }),
  };
}

/**
 * The terms a customer can actually pick that this grid states no price for.
 *
 * The coverage question, and it is the one thing a table cannot answer by looking at it. The
 * questionnaire offers `repayment_period_months` on a 6-month grid over 6…120 — 20 reachable
 * values — while a bank's card prints three or four bands. ADIB's Card B covers 16 of the 20;
 * the other four (6, 30, 66 and 90 months) are a fact about the SHEET, not about this design,
 * and naming them gives the operator a specific question to take back to the bank.
 *
 * Only meaningful for an axis whose fact is the term, so the caller says which axis that is.
 */
export function uncoveredTenors(
  config: FactGridConfig,
  tenorAxisIndex: number,
  reachable: readonly number[],
): number[] {
  const axis = config.axes[tenorAxisIndex];
  if (axis === undefined) return [];
  return reachable.filter((months) => {
    return !config.cells.some((cell) => {
      const key = cell.keys[tenorAxisIndex];
      // A wildcard on the term axis covers every term this cell's other axes allow.
      if (key === null || key === undefined) return true;
      if ('key' in key) return false;
      const from = key.fromInclusive === undefined ? null : Number(key.fromInclusive);
      const to =
        key.toExclusive === undefined || key.toExclusive === null ? null : Number(key.toExclusive);
      if (from !== null && Number.isFinite(from) && months < from) return false;
      if (to !== null && Number.isFinite(to) && months >= to) return false;
      return from !== null || to !== null;
    });
  });
}

/** Every term the questionnaire lets a customer ask for: 6…120 in 6-month steps. */
export const REACHABLE_TENOR_MONTHS: readonly number[] = Array.from(
  { length: 20 },
  (_, i) => (i + 1) * 6,
);
