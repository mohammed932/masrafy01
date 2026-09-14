/**
 * ONE PLAN IS A ROW. The five plan tables, projected into the table a bank's card prints.
 *
 * The product page used to render the five grids as five collapsed free-form editors, each
 * keyed by the same deposit bands and each saying so in its own words:
 *
 *     > Interest rate               20 row(s), by Down payment (% of the price) · ...
 *     > Longest term                 3 row(s), by Down payment (% of the price)
 *     > Share of the price financed  6 row(s), by Down payment (% of the price) · ...
 *
 * Nothing on that screen said what an operator actually holds in their head — "put 20% down
 * and the rate is 10%, we lend over 60 months, we finance 80%, and not under a million". It
 * took four disclosures and a mental join to read one plan, and a plan added to one table and
 * forgotten in another was invisible.
 *
 * ─── THE GRIDS ARE THE STATE. THE ROWS ARE A PROJECTION ───────────────────────
 *
 * Nothing here is stored. `planRowsFrom` derives the table from the five grids on every read
 * and every writer below returns a new `PlanDefaults`, so there is no second copy of the
 * plans to drift out of step with the thing the engine reads. That is what lets the fused
 * table hold BY CONSTRUCTION rather than by a spec, which this repo's testing policy would
 * not have.
 *
 * ─── THE WRITE-BACK IS MINIMAL, AND THAT IS NOT TIDINESS ──────────────────────
 *
 * `valueSources` marks a figure an estimate by its PATH, and a grid cell has no key to be
 * addressed by, so the path is an INDEX: `planDefaults.rateByFact.cells.7.value`. Twenty-three
 * of them are seeded on the one product that has plans. So a writer that re-emitted every
 * grid in a tidy normal form — expanding `maxMonthsByFact`'s single "40% and above → 84" cell
 * into the three rows the rate table happens to state — would silently move what every later
 * marker describes, and the FR-033 activation gate would start calling published figures
 * guesses and guesses published.
 *
 * So: stored cells are reused BY REFERENCE and keep their index; a changed figure replaces
 * one cell in place; a newly stated one is APPENDED; and the only index-shifting act is
 * clearing a figure, which is the same act today's "Remove row" already is. A covering band
 * is never split behind the operator's back — `splitPlanCell` is a verb they press.
 *
 * `planGridsFrom`-shaped writers therefore return the CALLER'S OWN object when nothing moved,
 * which is what lets the host set its dirty flag from `next !== stored` instead of on every
 * keystroke.
 *
 * ─── A MIRROR MUST NEVER OUT-REFUSE THE SERVER ────────────────────────────────
 *
 * `planRowsErrorFor` is `factGridErrorFor` over each present grid and NOTHING more. Band
 * gaps, a row the rate prices but the financed share refuses, a deposit and a share that do
 * not total 100 — every one of those is ADVICE (`planRowsAdviceFor`), never a gate. The
 * server accepts all of them, and a mirror that refuses what the server accepts tells an
 * operator their table is unsavable with nothing to fix.
 */

import { factGridErrorFor } from './fact-grid.rules';
import type {
  FactGridAxis,
  FactGridCell,
  FactGridConfig,
  FactGridError,
  FactGridKey,
  FactGridValueKind,
} from './fact-grid.rules';
import { DOWN_PAYMENT_PERCENT_FACT_KEY } from './fact-grid.rules';
import type { PlanDefaults } from '../../features/bank-programs/bank-programs.types';

export type PlanSlotKey = keyof PlanDefaults;

/**
 * The five, in the order they read across the table.
 *
 * Rate, then the two ends of the term, then what is financed, then the floor — the order a
 * bank's own card prints them in, and the order the sentence above is spoken in.
 */
export const PLAN_SLOTS: readonly PlanSlotKey[] = [
  'rateByFact',
  'maxMonthsByFact',
  'minMonthsByFact',
  'ltvCeilingByFact',
  'minAmountByFact',
];

export function planSlotValueKind(slot: PlanSlotKey): FactGridValueKind {
  switch (slot) {
    case 'rateByFact':
      return 'ratePercent';
    case 'maxMonthsByFact':
    case 'minMonthsByFact':
      return 'months';
    case 'ltvCeilingByFact':
      return 'sharePercent';
    case 'minAmountByFact':
      return 'amountEGP';
  }
}

/** Which end of the term a `months` slot states — one word in four labels, not a free string. */
export function planSlotMonthsBound(slot: PlanSlotKey): 'max' | 'min' {
  return slot === 'minMonthsByFact' ? 'min' : 'max';
}

/** A deposit band, as the row is keyed. `toExclusive: null` means "and above". */
export interface PlanBand {
  readonly fromInclusive: string;
  readonly toExclusive: string | null;
}

/**
 * One column: a slot, plus what its cells state on the axes BEYOND the deposit.
 *
 * `extra` is positional over `axes[1..]`, `null` meaning the explicit wildcard. Nothing here
 * is hardcoded — the columns a table shows are the key combinations its own cells already
 * hold, so `china` / `electric` / `owned_by_me` never appear in admin source.
 */
export interface PlanColumn {
  readonly slot: PlanSlotKey;
  readonly extra: readonly (string | null)[];
  /** True for the column every extra axis leaves wildcard — rendered first, labelled "Any". */
  readonly isBase: boolean;
}

/** Where a rendered figure comes from, and what typing in it does. */
export type PlanCellOrigin =
  /** A stored cell whose band IS this row. */
  | { readonly kind: 'exact'; readonly cellIndex: number }
  /**
   * A stored cell whose band covers several rows — rendered ONCE, spanning them. The honest
   * rendering of "one ceiling from 40% up", and it is what stops a keystroke here reading as
   * an edit to one row while quietly moving three.
   */
  | {
      readonly kind: 'covering';
      readonly cellIndex: number;
      readonly band: PlanBand;
      readonly span: number;
      readonly isFirstRow: boolean;
    }
  /** Nothing is stated here. Blank is a real answer, never zero. */
  | { readonly kind: 'blank' };

export interface PlanCell {
  readonly value: string;
  readonly origin: PlanCellOrigin;
}

export interface PlanRow {
  readonly band: PlanBand;
  /** One per `PlanTable.columns`, positionally. */
  readonly cells: readonly PlanCell[];
}

export interface PlanTable {
  readonly rows: readonly PlanRow[];
  readonly columns: readonly PlanColumn[];
  /** Present slots, in `PLAN_SLOTS` order. A slot with no grid contributes no column. */
  readonly slots: readonly PlanSlotKey[];
  /** Per present slot, its axes beyond the deposit, in stored order. */
  readonly extraAxes: Readonly<Partial<Record<PlanSlotKey, readonly FactGridAxis[]>>>;
  readonly onNoMatch: Readonly<Partial<Record<PlanSlotKey, 'useFallback' | 'reject'>>>;
}

/** Why the stored shape cannot be drawn as one table. */
export type PlanIncompatibleReason =
  | 'no_plans'
  | 'not_keyed_by_deposit'
  | 'deposit_via_class'
  | 'key_on_deposit_axis'
  | 'wildcard_deposit'
  | 'band_on_extra_axis'
  | 'overlapping_bands'
  | 'edge_not_numeric'
  | 'too_many_bands';

/**
 * How many deposit bands the fused table will draw before handing back to the free-form list.
 *
 * A card with more steps than this is not a card any more, and the fused table's whole value
 * is that a plan fits on one line of a page somebody can scan.
 */
export const MAX_PLAN_ROWS = 32;

const OPEN = Number.POSITIVE_INFINITY;

interface Edge {
  readonly n: number;
  /** The spelling a stored cell already uses, so a rewrite never invents a new one. */
  readonly text: string;
}

interface Placed {
  readonly cellIndex: number;
  readonly from: number;
  readonly to: number;
  readonly extra: readonly (string | null)[];
  readonly value: string;
}

function numberOf(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

function bandOf(
  key: FactGridKey | undefined,
): { from: number; to: number; fromText: string } | null {
  if (key === null || key === undefined) return null;
  if ('key' in key) return null;
  const from = numberOf(key.fromInclusive, 0);
  const to =
    key.toExclusive === null || key.toExclusive === undefined
      ? OPEN
      : numberOf(key.toExclusive, OPEN);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return { from, to, fromText: key.fromInclusive ?? '0' };
}

function extraOf(keys: readonly FactGridKey[]): readonly (string | null)[] | null {
  const out: (string | null)[] = [];
  for (let i = 1; i < keys.length; i += 1) {
    const key = keys[i];
    if (key === null || key === undefined) {
      out.push(null);
      continue;
    }
    // A BAND on an extra axis cannot become a column: a column is one key, and a range is a
    // second dimension of rows. Such a table keeps the free-form editor.
    if (!('key' in key)) return null;
    out.push(key.key);
  }
  return out;
}

function sameExtra(a: readonly (string | null)[], b: readonly (string | null)[]): boolean {
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

type Projection = { ok: true; table: PlanTable } | { ok: false; reason: PlanIncompatibleReason };

function project(grids: PlanDefaults | null): Projection {
  if (grids === null) return { ok: false, reason: 'no_plans' };
  const present = PLAN_SLOTS.filter((slot) => grids[slot] !== undefined);
  if (present.length === 0) return { ok: false, reason: 'no_plans' };

  const placed = new Map<PlanSlotKey, readonly Placed[]>();
  const edges: Edge[] = [];
  const pushEdge = (n: number, text: string): void => {
    if (!edges.some((e) => e.n === n)) edges.push({ n, text });
  };

  for (const slot of present) {
    const grid = grids[slot];
    if (grid === undefined) continue;
    const first = grid.axes[0];
    if (first === undefined || first.factKey !== DOWN_PAYMENT_PERCENT_FACT_KEY) {
      return { ok: false, reason: 'not_keyed_by_deposit' };
    }
    if (first.via === 'parentClass') return { ok: false, reason: 'deposit_via_class' };

    const rows: Placed[] = [];
    for (let index = 0; index < grid.cells.length; index += 1) {
      const cell = grid.cells[index];
      if (cell === undefined) continue;
      const key = cell.keys[0];
      if (key === null || key === undefined) return { ok: false, reason: 'wildcard_deposit' };
      if ('key' in key) return { ok: false, reason: 'key_on_deposit_axis' };
      const band = bandOf(key);
      if (band === null) return { ok: false, reason: 'edge_not_numeric' };
      const extra = extraOf(cell.keys);
      if (extra === null) return { ok: false, reason: 'band_on_extra_axis' };
      rows.push({ cellIndex: index, from: band.from, to: band.to, extra, value: cell.value });
      pushEdge(band.from, band.fromText);
      pushEdge(band.to, key.toExclusive ?? '');
    }

    // Two figures for one (row, column) is a cell this table cannot hold. A DUPLICATE is
    // caught by the same test, which is the point: the free-form editor shows both.
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i];
        const b = rows[j];
        if (a === undefined || b === undefined) continue;
        if (!sameExtra(a.extra, b.extra)) continue;
        if (a.from < b.to && b.from < a.to) return { ok: false, reason: 'overlapping_bands' };
      }
    }
    placed.set(slot, rows);
  }

  edges.sort((a, b) => a.n - b.n);
  if (edges.length < 2) return { ok: false, reason: 'no_plans' };
  const rowCount = edges.length - 1;
  if (rowCount > MAX_PLAN_ROWS) return { ok: false, reason: 'too_many_bands' };

  const bands: PlanBand[] = [];
  for (let i = 0; i < rowCount; i += 1) {
    const lo = edges[i];
    const hi = edges[i + 1];
    if (lo === undefined || hi === undefined) continue;
    bands.push({ fromInclusive: lo.text, toExclusive: hi.n === OPEN ? null : hi.text });
  }

  // Columns: the key combinations each slot's cells already hold, base first, then named
  // ones in first-appearance order — the order the bank's own card lists them.
  const columns: PlanColumn[] = [];
  const extraAxes: Partial<Record<PlanSlotKey, readonly FactGridAxis[]>> = {};
  const onNoMatch: Partial<Record<PlanSlotKey, 'useFallback' | 'reject'>> = {};
  for (const slot of present) {
    const grid = grids[slot];
    if (grid === undefined) continue;
    extraAxes[slot] = grid.axes.slice(1);
    onNoMatch[slot] = grid.onNoMatch;
    const width = Math.max(grid.axes.length - 1, 0);
    const base: (string | null)[] = new Array(width).fill(null) as (string | null)[];
    const seen: Array<readonly (string | null)[]> = [];
    const rows = placed.get(slot) ?? [];
    // The base column is always drawn, stated or not: it is where a figure that prices
    // everybody goes, and a table with only named cases has to be able to grow one.
    seen.push(base);
    for (const row of rows) {
      if (!seen.some((s) => sameExtra(s, row.extra))) seen.push(row.extra);
    }
    for (const extra of seen) {
      columns.push({ slot, extra, isBase: extra.every((k) => k === null) });
    }
  }

  const rows: PlanRow[] = bands.map((band, rowIndex) => {
    const lo = edges[rowIndex]?.n ?? 0;
    const hi = edges[rowIndex + 1]?.n ?? OPEN;
    const cells = columns.map((column): PlanCell => {
      const match = (placed.get(column.slot) ?? []).find(
        (p) => sameExtra(p.extra, column.extra) && p.from <= lo && p.to >= hi,
      );
      if (match === undefined) return { value: '', origin: { kind: 'blank' } };
      const exact = match.from === lo && match.to === hi;
      if (exact)
        return { value: match.value, origin: { kind: 'exact', cellIndex: match.cellIndex } };
      let span = 0;
      let firstRow = rowIndex;
      for (let i = 0; i < bands.length; i += 1) {
        const a = edges[i]?.n ?? 0;
        const b = edges[i + 1]?.n ?? OPEN;
        if (match.from <= a && match.to >= b) {
          if (span === 0) firstRow = i;
          span += 1;
        }
      }
      const grid = grids[column.slot];
      const storedKey = grid?.cells[match.cellIndex]?.keys[0];
      const coveringBand: PlanBand =
        storedKey !== null && storedKey !== undefined && !('key' in storedKey)
          ? {
              fromInclusive: storedKey.fromInclusive ?? '0',
              toExclusive: storedKey.toExclusive ?? null,
            }
          : { fromInclusive: String(match.from), toExclusive: null };
      return {
        value: match.value,
        origin: {
          kind: 'covering',
          cellIndex: match.cellIndex,
          band: coveringBand,
          span,
          isFirstRow: firstRow === rowIndex,
        },
      };
    });
    return { band, cells };
  });

  return { ok: true, table: { rows, columns, slots: present, extraAxes, onNoMatch } };
}

/** The fused table, or `null` when the stored shape cannot be drawn as one. */
export function planRowsFrom(grids: PlanDefaults | null): PlanTable | null {
  const result = project(grids);
  return result.ok ? result.table : null;
}

/** Why not — the sentence above the free-form list. `null` when the table was drawn. */
export function planRowsWhyNot(grids: PlanDefaults | null): PlanIncompatibleReason | null {
  const result = project(grids);
  return result.ok ? null : result.reason;
}

/**
 * The first thing that blocks Save, or `null`.
 *
 * `factGridErrorFor` over each present grid and nothing more — see the header. The fused
 * table adds no refusal of its own.
 */
export function planRowsErrorFor(
  grids: PlanDefaults | null,
): { slot: PlanSlotKey; error: FactGridError } | null {
  if (grids === null) return null;
  for (const slot of PLAN_SLOTS) {
    const grid = grids[slot];
    if (grid === undefined) continue;
    const error = factGridErrorFor(grid, planSlotValueKind(slot));
    if (error !== null) return { slot, error };
  }
  return null;
}

/** Advice. Never a gate — the server accepts every one of these. */
export type PlanAdvice =
  /** A band the rate prices, that a table which REFUSES a miss states nothing for. */
  | { readonly kind: 'refused'; readonly rowIndex: number; readonly slot: PlanSlotKey }
  /** The deposit and the financed share do not add up to the whole price. */
  | { readonly kind: 'share_total'; readonly rowIndex: number; readonly total: string }
  /** A band with no rate at all: nobody in it is quoted. */
  | { readonly kind: 'no_rate'; readonly rowIndex: number };

export function planRowsAdviceFor(table: PlanTable): readonly PlanAdvice[] {
  const out: PlanAdvice[] = [];
  const columnsOf = (slot: PlanSlotKey): number[] =>
    table.columns.flatMap((c, i) => (c.slot === slot ? [i] : []));
  const stated = (row: PlanRow, slot: PlanSlotKey): boolean =>
    columnsOf(slot).some((i) => (row.cells[i]?.value ?? '') !== '');

  table.rows.forEach((row, rowIndex) => {
    const hasRate = table.slots.includes('rateByFact') ? stated(row, 'rateByFact') : true;
    if (table.slots.includes('rateByFact') && !hasRate) {
      out.push({ kind: 'no_rate', rowIndex });
      return;
    }
    for (const slot of table.slots) {
      if (slot === 'rateByFact') continue;
      // Only a table that REFUSES a miss turns a priced customer away. One that falls back
      // leaves the program's own figure standing, which is a stated choice, not a hole.
      if (table.onNoMatch[slot] !== 'reject') continue;
      if (!stated(row, slot)) out.push({ kind: 'refused', rowIndex, slot });
    }
    const ltvBase = table.columns.findIndex((c) => c.slot === 'ltvCeilingByFact' && c.isBase);
    const share = ltvBase < 0 ? '' : (row.cells[ltvBase]?.value ?? '');
    if (share !== '') {
      const total = Number(row.band.fromInclusive) + Number(share);
      if (Number.isFinite(total) && Math.abs(total - 100) > 0.001) {
        out.push({ kind: 'share_total', rowIndex, total: String(total) });
      }
    }
  });
  return out;
}

// ─── WRITERS ─────────────────────────────────────────────────────────────────
// Every one returns a new `PlanDefaults` — or the CALLER'S OWN object when nothing moved,
// which is what lets the host avoid marking the form dirty on a keystroke that changed
// nothing. Stored cells are reused by reference wherever they are untouched.

function withSlot(
  grids: PlanDefaults | null,
  slot: PlanSlotKey,
  grid: FactGridConfig | undefined,
): PlanDefaults | null {
  const next: PlanDefaults = { ...(grids ?? {}) };
  if (grid === undefined) delete next[slot];
  else next[slot] = grid;
  // An object with no table left is `null`, never `{}` — two spellings of "states no plans"
  // is how one of them stops being recognised.
  return Object.keys(next).length === 0 ? null : next;
}

function keysFor(band: PlanBand, extra: readonly (string | null)[]): FactGridKey[] {
  const head: FactGridKey = { fromInclusive: band.fromInclusive, toExclusive: band.toExclusive };
  return [head, ...extra.map((code): FactGridKey => (code === null ? null : { key: code }))];
}

/**
 * Type a figure into one cell.
 *
 * Blank CLEARS — it drops the cell, which is the one act that moves a later cell's index, and
 * it is the same act the free-form editor's own Remove row already is. Never a zero.
 */
export function setPlanFigure(
  grids: PlanDefaults | null,
  table: PlanTable,
  rowIndex: number,
  columnIndex: number,
  raw: string,
): PlanDefaults | null {
  const column = table.columns[columnIndex];
  const row = table.rows[rowIndex];
  if (grids === null || column === undefined || row === undefined) return grids;
  const grid = grids[column.slot];
  if (grid === undefined) return grids;
  const origin = row.cells[columnIndex]?.origin;
  if (origin === undefined) return grids;

  if (origin.kind === 'blank') {
    if (raw.trim() === '') return grids;
    // APPENDED, never spliced in: appending moves no existing index, so every estimate
    // marker on this table keeps describing the figure it was written about.
    const cells = [...grid.cells, { keys: keysFor(row.band, column.extra), value: raw }];
    return withSlot(grids, column.slot, { ...grid, cells });
  }

  const index = origin.cellIndex;
  const current = grid.cells[index];
  if (current === undefined) return grids;
  if (current.value === raw) return grids;

  if (raw.trim() === '') {
    const cells = grid.cells.filter((_, i) => i !== index);
    return withSlot(grids, column.slot, cells.length === 0 ? undefined : { ...grid, cells });
  }
  const cells = grid.cells.map((cell, i) => (i === index ? { ...cell, value: raw } : cell));
  return withSlot(grids, column.slot, { ...grid, cells });
}

/**
 * Move ONE boundary between two bands, across every table at once.
 *
 * The deposit column shows one number per row — its lower edge — because the upper edge IS
 * the next row's lower one. Editing it rewrites `fromInclusive` on every cell that starts
 * there AND `toExclusive` on every cell that ends there, in all five tables. One keystroke,
 * both sides, no index moved, and a half-typed band is unreachable — which is the safety the
 * five separate editors could not give.
 */
export function setPlanBandEdge(
  grids: PlanDefaults | null,
  table: PlanTable,
  rowIndex: number,
  raw: string,
): PlanDefaults | null {
  const row = table.rows[rowIndex];
  if (grids === null || row === undefined) return grids;
  if (raw.trim() === '') return grids;
  const oldEdge = Number(row.band.fromInclusive);
  if (!Number.isFinite(oldEdge)) return grids;

  let next: PlanDefaults | null = grids;
  for (const slot of table.slots) {
    const grid = next?.[slot];
    if (grid === undefined) continue;
    let moved = false;
    const cells = grid.cells.map((cell) => {
      const key = cell.keys[0];
      if (key === null || key === undefined || 'key' in key) return cell;
      const from = numberOf(key.fromInclusive, 0);
      const to =
        key.toExclusive === null || key.toExclusive === undefined
          ? OPEN
          : numberOf(key.toExclusive, OPEN);
      if (from === oldEdge) {
        moved = true;
        return { ...cell, keys: [{ ...key, fromInclusive: raw }, ...cell.keys.slice(1)] };
      }
      if (to === oldEdge) {
        moved = true;
        return { ...cell, keys: [{ ...key, toExclusive: raw }, ...cell.keys.slice(1)] };
      }
      return cell;
    });
    if (moved) next = withSlot(next, slot, { ...grid, cells });
  }
  return next;
}

/**
 * Add a band at the TOP of the card, which is the only end a tier is ever added at.
 *
 * Two halves, and the second is the one that makes the band EXIST: every open-ended cell is
 * closed at the new edge, and a COPY of it is appended above starting there. Closing alone
 * would only move the card's ceiling down — the new band would hold no cell in any table, so
 * nothing would derive a row for it and it would vanish on the next read.
 *
 * A copy rather than a blank, for the reason `addPlanCase` copies too: an operator adding a
 * tier means to edit its figures, not to type five of them from nothing — and on a table that
 * refuses a miss, a blank band turns away every customer who lands in it.
 */
export function appendPlanBand(
  grids: PlanDefaults | null,
  table: PlanTable,
  fromInclusive: string,
): PlanDefaults | null {
  if (grids === null) return grids;
  const edge = Number(fromInclusive);
  if (!Number.isFinite(edge)) return grids;
  let next: PlanDefaults | null = grids;
  for (const slot of table.slots) {
    const grid = next?.[slot];
    if (grid === undefined) continue;
    const added: FactGridCell[] = [];
    let moved = false;
    const cells = grid.cells.map((cell) => {
      const key = cell.keys[0];
      if (key === null || key === undefined || 'key' in key) return cell;
      const to =
        key.toExclusive === null || key.toExclusive === undefined
          ? OPEN
          : numberOf(key.toExclusive, OPEN);
      const from = numberOf(key.fromInclusive, 0);
      if (to !== OPEN || from >= edge) return cell;
      moved = true;
      added.push({
        keys: [{ fromInclusive, toExclusive: null }, ...cell.keys.slice(1)],
        value: cell.value,
      });
      return { ...cell, keys: [{ ...key, toExclusive: fromInclusive }, ...cell.keys.slice(1)] };
    });
    if (moved) next = withSlot(next, slot, { ...grid, cells: [...cells, ...added] });
  }
  return next;
}

/**
 * Delete a band, and CLOSE THE HOLE it leaves.
 *
 * The band above it is widened downward (or, for the lowest band, the one above is dropped
 * to this one's floor), because a card with a gap in the middle prices nobody in it and the
 * operator asked to remove a tier, not to punch a hole.
 */
export function removePlanBand(
  grids: PlanDefaults | null,
  table: PlanTable,
  rowIndex: number,
): PlanDefaults | null {
  const row = table.rows[rowIndex];
  if (grids === null || row === undefined) return grids;
  if (table.rows.length < 2) return grids;
  const lo = Number(row.band.fromInclusive);
  const hi = row.band.toExclusive === null ? OPEN : Number(row.band.toExclusive);
  /** The lowest band merges upward; every other one merges down into its neighbour below. */
  const mergeDown = rowIndex > 0;

  let next: PlanDefaults | null = grids;
  for (const slot of table.slots) {
    const grid = next?.[slot];
    if (grid === undefined) continue;
    const kept: FactGridCell[] = [];
    for (const cell of grid.cells) {
      const key = cell.keys[0];
      if (key === null || key === undefined || 'key' in key) {
        kept.push(cell);
        continue;
      }
      const from = numberOf(key.fromInclusive, 0);
      const to =
        key.toExclusive === null || key.toExclusive === undefined
          ? OPEN
          : numberOf(key.toExclusive, OPEN);
      if (from === lo && to === hi) continue; // the band itself
      if (mergeDown && to === lo) {
        kept.push({
          ...cell,
          keys: [{ ...key, toExclusive: row.band.toExclusive ?? undefined }, ...cell.keys.slice(1)],
        });
        continue;
      }
      if (!mergeDown && from === hi) {
        kept.push({
          ...cell,
          keys: [{ ...key, fromInclusive: row.band.fromInclusive }, ...cell.keys.slice(1)],
        });
        continue;
      }
      kept.push(cell);
    }
    next = withSlot(next, slot, kept.length === 0 ? undefined : { ...grid, cells: kept });
  }
  return next;
}

/**
 * Turn one covering figure into one per band it covers.
 *
 * The one act that deliberately moves later cell indexes in its table, which is why it is a
 * verb an operator presses rather than something the write-back does behind them.
 */
export function splitPlanCell(
  grids: PlanDefaults | null,
  table: PlanTable,
  rowIndex: number,
  columnIndex: number,
): PlanDefaults | null {
  const column = table.columns[columnIndex];
  const origin = table.rows[rowIndex]?.cells[columnIndex]?.origin;
  if (grids === null || column === undefined || origin === undefined) return grids;
  if (origin.kind !== 'covering') return grids;
  const grid = grids[column.slot];
  if (grid === undefined) return grids;
  const stored = grid.cells[origin.cellIndex];
  if (stored === undefined) return grids;

  const covered = table.rows.filter((row) => {
    const from = Number(row.band.fromInclusive);
    const to = row.band.toExclusive === null ? OPEN : Number(row.band.toExclusive);
    const cFrom = Number(origin.band.fromInclusive);
    const cTo = origin.band.toExclusive === null ? OPEN : Number(origin.band.toExclusive);
    return cFrom <= from && cTo >= to;
  });
  if (covered.length < 2) return grids;

  const replacements = covered.map((row) => ({
    keys: keysFor(row.band, column.extra),
    value: stored.value,
  }));
  const cells = [
    ...grid.cells.slice(0, origin.cellIndex),
    ...replacements,
    ...grid.cells.slice(origin.cellIndex + 1),
  ];
  return withSlot(grids, column.slot, { ...grid, cells });
}

/** How many figures a split would turn one figure into — the number the confirm states. */
export function splitPlanCellCount(
  table: PlanTable,
  rowIndex: number,
  columnIndex: number,
): number {
  const origin = table.rows[rowIndex]?.cells[columnIndex]?.origin;
  return origin !== undefined && origin.kind === 'covering' ? origin.span : 0;
}

/**
 * Price one more kind of customer differently — a new column on one table.
 *
 * The new column COPIES the base figure into every band, the `stateOwnTenor` precedent: an
 * operator turning "charge Chinese cars differently" on means to edit the rates, not to type
 * five of them from nothing, and a column of blanks on a table that refuses a miss would turn
 * every Chinese buyer away until it was filled.
 */
export function addPlanCase(
  grids: PlanDefaults | null,
  table: PlanTable,
  slot: PlanSlotKey,
  factKey: string,
  optionCode: string,
): PlanDefaults | null {
  if (grids === null) return grids;
  const grid = grids[slot];
  if (grid === undefined) return grids;

  let axes = grid.axes;
  let cells = grid.cells;
  let axisIndex = axes.findIndex((axis) => axis.factKey === factKey);
  if (axisIndex < 0) {
    axes = [...axes, { factKey }];
    axisIndex = axes.length - 1;
    // Padded at the END, so every existing cell keeps its index and its meaning.
    cells = cells.map((cell) => ({ ...cell, keys: [...cell.keys, null] }));
  }

  const width = axes.length - 1;
  const extra: (string | null)[] = new Array(width).fill(null) as (string | null)[];
  extra[axisIndex - 1] = optionCode;
  if (table.columns.some((c) => c.slot === slot && sameExtra(c.extra, extra))) return grids;

  const baseIndex = table.columns.findIndex((c) => c.slot === slot && c.isBase);
  const appended: FactGridCell[] = [];
  for (const row of table.rows) {
    const value = baseIndex < 0 ? '' : (row.cells[baseIndex]?.value ?? '');
    // A band the base column states nothing for gets no cell either: copying a blank would
    // be a row that prices nobody, and on a table that refuses a miss that is a refusal.
    if (value === '') continue;
    appended.push({ keys: keysFor(row.band, extra), value });
  }
  return withSlot(grids, slot, { ...grid, axes, cells: [...cells, ...appended] });
}

/** How many figures removing a column would delete — the number the confirm states. */
export function planColumnFigureCount(table: PlanTable, columnIndex: number): number {
  return table.rows.filter((row) => (row.cells[columnIndex]?.value ?? '') !== '').length;
}

/** Drop a column, and the axis with it when it was the last case stated on that axis. */
export function removePlanColumn(
  grids: PlanDefaults | null,
  table: PlanTable,
  columnIndex: number,
): PlanDefaults | null {
  const column = table.columns[columnIndex];
  if (grids === null || column === undefined || column.isBase) return grids;
  const grid = grids[column.slot];
  if (grid === undefined) return grids;

  const cells = grid.cells.filter((cell) => {
    const extra = extraOf(cell.keys);
    return extra === null || !sameExtra(extra, column.extra);
  });
  if (cells.length === 0) return withSlot(grids, column.slot, undefined);

  // An axis nothing keys on any more is dropped: it would otherwise sit in the picker as a
  // column an operator cannot see and the server would still validate every cell against.
  let axes = grid.axes;
  let next = cells;
  for (let i = axes.length - 1; i >= 1; i -= 1) {
    const used = next.some((cell) => {
      const key = cell.keys[i];
      return key !== null && key !== undefined && 'key' in key;
    });
    if (used) continue;
    axes = axes.filter((_, j) => j !== i);
    next = next.map((cell) => ({ ...cell, keys: cell.keys.filter((_, j) => j !== i) }));
  }
  return withSlot(grids, column.slot, { ...grid, axes, cells: next });
}

/** What happens to a customer no band covers — never defaulted, per the engine's own rule. */
export function setPlanNoMatch(
  grids: PlanDefaults | null,
  slot: PlanSlotKey,
  onNoMatch: 'useFallback' | 'reject',
): PlanDefaults | null {
  if (grids === null) return grids;
  const grid = grids[slot];
  if (grid === undefined || grid.onNoMatch === onNoMatch) return grids;
  return withSlot(grids, slot, { ...grid, onNoMatch });
}

/** How many figures dropping a whole table would delete. */
export function planSlotFigureCount(grids: PlanDefaults | null, slot: PlanSlotKey): number {
  return grids?.[slot]?.cells.length ?? 0;
}

export function removePlanSlot(grids: PlanDefaults | null, slot: PlanSlotKey): PlanDefaults | null {
  if (grids === null || grids[slot] === undefined) return grids;
  return withSlot(grids, slot, undefined);
}

/**
 * Start a table the product does not state yet, keyed by the deposit and covering the bands
 * the card already has.
 *
 * One cell per band, blank — so the operator types figures rather than deleting a skeleton,
 * and a band they leave blank keeps meaning "each bank's own", which for the floor and the
 * two term ends is the normal answer.
 */
export function addPlanSlot(
  grids: PlanDefaults | null,
  table: PlanTable | null,
  slot: PlanSlotKey,
): PlanDefaults | null {
  if (grids !== null && grids[slot] !== undefined) return grids;
  const first = table?.rows[0]?.band ?? { fromInclusive: '', toExclusive: null };
  const grid: FactGridConfig = {
    axes: [{ factKey: DOWN_PAYMENT_PERCENT_FACT_KEY }],
    cells: [{ keys: keysFor(first, []), value: '' }],
    // Matches `emptyFactGrid()`: a new table refuses a miss until somebody says otherwise.
    onNoMatch: 'reject',
  };
  return withSlot(grids, slot, grid);
}

// ─── THE CARD: ONE COLUMN PER FIGURE, NOT ONE PER CASE ───────────────────────
//
// The projection above gives one column per (table, key combination), which is faithful and
// too wide to read: Suez Canal's card came out as NINE columns over five rows, and 15 of the
// 20 rate cells were one sentence repeated — "a Chinese car is two points more" — typed out
// per band. Measured on the live rows, not assumed.
//
// So a second, narrower reading sits on top. It never changes what is STORED; it decides how
// a table's cases are best said, and the three answers are the three shapes a real card takes:
//
//   simple     every case is the same move off the base figure, on every band it states.
//              Said ONCE under the column heading ("Chinese +2"), edited once, and the
//              cascade keeps every band in step.
//   condition  the cases are stated exactly where the base is BLANK, all equal. That is not
//              "a different figure for owners" — it is "in this band we lend to owners only",
//              a condition on one row, and the answers it does NOT name are the refusal.
//   detailed   anything else. The cases keep their own columns, because nothing shorter is
//              true, and a summary that is sometimes wrong is worse than a wide table.
//
// The shape is DERIVED on every read and stored nowhere, for the reason the projection is:
// a second record of what a table holds can only drift from the table.

/** One case column, as the constant move off the base figure that it is. */
export interface PlanCase {
  readonly columnIndex: number;
  readonly extra: readonly (string | null)[];
  /** Signed and plain: `base + delta` is this case's figure on every band it states. */
  readonly delta: string;
}

export type PlanSlotShape =
  | { readonly kind: 'simple'; readonly baseColumn: number; readonly cases: readonly PlanCase[] }
  | {
      readonly kind: 'condition';
      readonly baseColumn: number;
      readonly caseColumns: readonly number[];
    }
  | { readonly kind: 'detailed'; readonly columns: readonly number[] };

/**
 * Add two decimal strings without going through a float's last digit.
 *
 * Rates and shares only — the caller is a delta off a base figure, and a delta on a money
 * floor is a case this shape has never met. Six places is past anything a bank prints.
 */
function addDecimal(a: string, b: string): string {
  const n = Number(a) + Number(b);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1e12) return String(n);
  return String(Math.round(n * 1e6) / 1e6);
}

function deltaOf(base: string, value: string): string | null {
  const n = Number(value) - Number(base);
  if (!Number.isFinite(n)) return null;
  return String(Math.round(n * 1e6) / 1e6);
}

export function planSlotShapeOf(table: PlanTable, slot: PlanSlotKey): PlanSlotShape {
  const columns: number[] = [];
  table.columns.forEach((column, index) => {
    if (column.slot === slot) columns.push(index);
  });
  const baseColumn = columns.find((index) => table.columns[index]?.isBase ?? false);
  const cases = columns.filter((index) => index !== baseColumn);
  if (baseColumn === undefined) return { kind: 'detailed', columns };
  if (cases.length === 0) return { kind: 'simple', baseColumn, cases: [] };

  // ① Is every case the same move off the base, everywhere both are stated?
  const uniform: PlanCase[] = [];
  let isUniform = true;
  for (const columnIndex of cases) {
    let delta: string | null = null;
    for (const row of table.rows) {
      const base = row.cells[baseColumn]?.value ?? '';
      const value = row.cells[columnIndex]?.value ?? '';
      if (base === '' && value === '') continue;
      // A case stated where the base is not (or the other way round) is not a move off it.
      if (base === '' || value === '') {
        isUniform = false;
        break;
      }
      const step = deltaOf(base, value);
      if (step === null) {
        isUniform = false;
        break;
      }
      if (delta === null) delta = step;
      else if (delta !== step) {
        isUniform = false;
        break;
      }
    }
    if (!isUniform || delta === null) {
      isUniform = false;
      break;
    }
    const extra = table.columns[columnIndex]?.extra ?? [];
    uniform.push({ columnIndex, extra, delta });
  }
  if (isUniform) return { kind: 'simple', baseColumn, cases: uniform };

  // ② Are the cases a CONDITION — stated only where the base says nothing, and agreeing?
  let isCondition = true;
  let sawOne = false;
  for (const row of table.rows) {
    const base = row.cells[baseColumn]?.value ?? '';
    const stated = cases
      .map((index) => row.cells[index]?.value ?? '')
      .filter((value) => value !== '');
    if (base !== '') {
      if (stated.length > 0) {
        isCondition = false;
        break;
      }
      continue;
    }
    if (stated.length === 0) continue;
    sawOne = true;
    if (new Set(stated).size !== 1) {
      isCondition = false;
      break;
    }
  }
  if (isCondition && sawOne) return { kind: 'condition', baseColumn, caseColumns: cases };

  return { kind: 'detailed', columns };
}

/** The ONE figure a narrowed column shows for a row, and the cell it came from. */
export function planSlotCell(
  table: PlanTable,
  shape: PlanSlotShape,
  rowIndex: number,
): PlanCell | null {
  if (shape.kind === 'detailed') return null;
  const row = table.rows[rowIndex];
  if (row === undefined) return null;
  const base = row.cells[shape.baseColumn];
  if (base !== undefined && base.value !== '') return base;
  if (shape.kind === 'condition') {
    for (const columnIndex of shape.caseColumns) {
      const cell = row.cells[columnIndex];
      if (cell !== undefined && cell.value !== '') return cell;
    }
  }
  return base ?? null;
}

/**
 * The answers a row's figure is restricted to, as option codes — empty when it applies to
 * everybody.
 *
 * The caller labels them, and derives the REFUSAL from them: an answer this list does not
 * name, on a table that rejects a miss, is a customer the band turns away. That is the
 * sentence the nine-column rendering could not say at all.
 */
export function planSlotOnlyFor(
  table: PlanTable,
  shape: PlanSlotShape,
  rowIndex: number,
): readonly string[] {
  if (shape.kind !== 'condition') return [];
  const row = table.rows[rowIndex];
  if (row === undefined) return [];
  if ((row.cells[shape.baseColumn]?.value ?? '') !== '') return [];
  const out: string[] = [];
  for (const columnIndex of shape.caseColumns) {
    if ((row.cells[columnIndex]?.value ?? '') === '') continue;
    for (const code of table.columns[columnIndex]?.extra ?? []) {
      if (code !== null && !out.includes(code)) out.push(code);
    }
  }
  return out;
}

/** One coordinate of the card, and what the operator wants in it. */
interface CellEdit {
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly value: string;
}

/**
 * Apply several coordinates of ONE table in a single pass.
 *
 * One pass rather than composed `setPlanFigure` calls, because clearing a figure removes its
 * cell and every later index moves — so a second call carrying origins read before the first
 * would edit the wrong figure. Everything else keeps the same guarantees: untouched cells are
 * reused by reference, a new figure is APPENDED, and an unchanged write returns the caller's
 * own object.
 */
function applyCellEdits(
  grids: PlanDefaults | null,
  table: PlanTable,
  slot: PlanSlotKey,
  edits: readonly CellEdit[],
): PlanDefaults | null {
  const grid = grids?.[slot];
  if (grids === null || grid === undefined) return grids;

  const replace = new Map<number, string>();
  const drop = new Set<number>();
  const append: FactGridCell[] = [];
  for (const edit of edits) {
    const row = table.rows[edit.rowIndex];
    const column = table.columns[edit.columnIndex];
    const origin = row?.cells[edit.columnIndex]?.origin;
    if (row === undefined || column === undefined || origin === undefined) continue;
    const raw = edit.value;
    if (origin.kind === 'blank') {
      if (raw.trim() === '') continue;
      append.push({ keys: keysFor(row.band, column.extra), value: raw });
      continue;
    }
    const current = grid.cells[origin.cellIndex]?.value;
    if (current === raw) continue;
    if (raw.trim() === '') drop.add(origin.cellIndex);
    else replace.set(origin.cellIndex, raw);
  }
  if (replace.size === 0 && drop.size === 0 && append.length === 0) return grids;

  const cells = grid.cells
    .map((cell, index) => {
      const next = replace.get(index);
      return next === undefined ? cell : { ...cell, value: next };
    })
    .filter((_, index) => !drop.has(index))
    .concat(append);
  return withSlot(grids, slot, cells.length === 0 ? undefined : { ...grid, cells });
}

/**
 * Type the one figure a narrowed column shows.
 *
 * On a `simple` table the cases FOLLOW: typing 9 where the base was 10 rewrites the Chinese
 * cell to 11 and the electric one to 8 in the same write. Without that, one keystroke would
 * break the uniformity the column was narrowed on and the table would silently widen back to
 * a column per case underneath the operator.
 */
export function setPlanSlotFigure(
  grids: PlanDefaults | null,
  table: PlanTable,
  slot: PlanSlotKey,
  rowIndex: number,
  raw: string,
): PlanDefaults | null {
  if (grids === null) return grids;
  const shape = planSlotShapeOf(table, slot);
  if (shape.kind === 'detailed') return grids;
  const row = table.rows[rowIndex];
  if (row === undefined) return grids;

  const edits: CellEdit[] = [];
  if (shape.kind === 'simple') {
    edits.push({ rowIndex, columnIndex: shape.baseColumn, value: raw });
    for (const plan of shape.cases) {
      edits.push({
        rowIndex,
        columnIndex: plan.columnIndex,
        value: raw.trim() === '' ? '' : addDecimal(raw, plan.delta),
      });
    }
  } else {
    const stated = shape.caseColumns.filter((i) => (row.cells[i]?.value ?? '') !== '');
    if ((row.cells[shape.baseColumn]?.value ?? '') !== '' || stated.length === 0) {
      edits.push({ rowIndex, columnIndex: shape.baseColumn, value: raw });
    } else {
      // A conditional row's figure lives in every case cell the condition names, and they
      // agree by definition — so one box writes all of them, or they stop agreeing and the
      // column widens back into cases the next time it is read.
      for (const columnIndex of stated) edits.push({ rowIndex, columnIndex, value: raw });
    }
  }
  return applyCellEdits(grids, table, slot, edits);
}

/** Move one case off the base, on every band the base states — the whole point of saying it once. */
export function setPlanCaseDelta(
  grids: PlanDefaults | null,
  table: PlanTable,
  slot: PlanSlotKey,
  columnIndex: number,
  delta: string,
): PlanDefaults | null {
  if (grids === null) return grids;
  if (delta.trim() === '' || !Number.isFinite(Number(delta))) return grids;
  const shape = planSlotShapeOf(table, slot);
  if (shape.kind !== 'simple') return grids;
  const edits: CellEdit[] = table.rows.flatMap((row, rowIndex) => {
    const base = row.cells[shape.baseColumn]?.value ?? '';
    if (base === '') return [];
    return [{ rowIndex, columnIndex, value: addDecimal(base, delta) }];
  });
  return applyCellEdits(grids, table, slot, edits);
}
