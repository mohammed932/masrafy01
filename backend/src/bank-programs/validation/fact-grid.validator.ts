/**
 * Save-time checks for an N-axis grid (`pricing.rateByFact`, `tenor.maxMonthsByFact`).
 *
 * The DTO validates sizes and the closed `onNoMatch` set; everything that needs the whole
 * table or the fact registry is here, which is this folder's existing split.
 *
 * WHY THESE CHECKS AND NOT OTHERS. Each one refuses a table that would save cleanly, render
 * correctly, and then quote the wrong number — or no number — at a customer:
 *
 *   · an axis naming a fact the registry cannot serve resolves to nothing, so every cell
 *     misses and the whole grid silently becomes its `onNoMatch`;
 *   · `parentClass` on a NUMERIC axis can never match: a number is filed under no class, so
 *     the axis yields no key for anybody;
 *   · a cell whose keys do not line up with the axes is read positionally and would compare
 *     a tenor against a model year;
 *   · an ALL-WILDCARD cell matches every applicant alive, so whatever figure sits beside it
 *     becomes the program's price — the exact failure `max-loan-by-fact.ts` avoids by
 *     refusing to treat an empty row as "any";
 *   · a tenor grid keyed on the term is circular: the term is what it computes.
 */
import { FACT_GRID_NO_MATCH_ACTIONS } from '../../matching/pipeline/fact-grid';
import type { FactGridConfig, FactGridKey } from '../../matching/pipeline/fact-grid';
import { isGridOnlyFactKey, TENOR_MONTHS_FACT_KEY } from '../../matching/pipeline/car-details';
import { isDerivedFactKey } from '../../matching/pipeline/surrogate-fact-registry';
import type { SurrogateFactBinding } from '../../matching/pipeline/surrogate-fact-registry';

export type FactGridViolationReason =
  | 'axes_empty'
  | 'axes_too_many'
  | 'axis_duplicate'
  | 'axis_fact_unavailable'
  | 'axis_class_on_numeric'
  | 'axis_circular'
  | 'cells_empty'
  | 'cell_arity_mismatch'
  | 'cell_all_wildcard'
  | 'cell_key_invalid'
  | 'cell_value_invalid'
  | 'no_match_invalid';

export interface FactGridViolation {
  reason: FactGridViolationReason;
  /** `pricing.rateByFact` or `tenor.maxMonthsByFact` — the field an operator must go and fix. */
  fieldPath: string;
  factKey?: string;
  cellIndex?: number;
  availableFacts?: string[];
}

const MAX_AXES = 4;

/** What the figure in a cell means, which is the only thing that differs between the two grids. */
export type FactGridValueKind = 'ratePercent' | 'months';

function keyShapeValid(key: FactGridKey): boolean {
  if (key === null) return true;
  if (typeof key !== 'object') return false;
  if ('key' in key) return typeof key.key === 'string' && key.key !== '';
  const from = (key as { fromInclusive?: unknown }).fromInclusive;
  const to = (key as { toExclusive?: unknown }).toExclusive;
  const hasFrom = typeof from === 'string' && from.trim() !== '';
  const hasTo = typeof to === 'string' && to.trim() !== '';
  // At least one edge, or it is the half-typed cell that matches nothing — which is a table
  // an operator meant to fill, not a wildcard they meant to state.
  return hasFrom || hasTo;
}

function valueValid(raw: unknown, kind: FactGridValueKind): boolean {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (kind === 'ratePercent') return n <= 999.9999;
  return Number.isInteger(n) && n <= 480;
}

export function validateFactGrid(args: {
  config: FactGridConfig;
  fieldPath: string;
  valueKind: FactGridValueKind;
  registry: readonly SurrogateFactBinding[];
}): FactGridViolation | undefined {
  const { config, fieldPath, valueKind, registry } = args;
  const fail = (
    reason: FactGridViolationReason,
    extra: Omit<FactGridViolation, 'reason' | 'fieldPath'> = {},
  ): FactGridViolation => ({ reason, fieldPath, ...extra });

  if (!FACT_GRID_NO_MATCH_ACTIONS.includes(config.onNoMatch)) return fail('no_match_invalid');

  const axes = config.axes;
  if (!Array.isArray(axes) || axes.length === 0) return fail('axes_empty');
  if (axes.length > MAX_AXES) return fail('axes_too_many');

  const seen = new Set<string>();
  for (const axis of axes) {
    const factKey = axis?.factKey;
    if (typeof factKey !== 'string' || factKey === '') {
      return fail('axis_fact_unavailable', { availableFacts: registry.map((f) => f.key) });
    }
    // Two axes on one fact is a table an operator cannot read back: both would resolve to
    // the same answer and the second would only ever narrow the first.
    if (seen.has(factKey)) return fail('axis_duplicate', { factKey });
    seen.add(factKey);

    // A tenor ceiling keyed on the term computes the thing it is deciding.
    if (valueKind === 'months' && factKey === TENOR_MONTHS_FACT_KEY) {
      return fail('axis_circular', { factKey });
    }

    // The engine's own per-quote facts and the per-bank derived axes need no registry row —
    // that is what makes them derived — so they are legal without one.
    if (isGridOnlyFactKey(factKey) || isDerivedFactKey(factKey)) continue;

    const fact = registry.find((f) => f.key === factKey);
    if (fact === undefined) {
      return fail('axis_fact_unavailable', {
        factKey,
        availableFacts: registry.map((f) => f.key),
      });
    }
    if (axis.via === 'parentClass' && fact.type === 'NUMERIC') {
      return fail('axis_class_on_numeric', { factKey });
    }
  }

  const cells = config.cells;
  if (!Array.isArray(cells) || cells.length === 0) return fail('cells_empty');

  for (const [cellIndex, cell] of cells.entries()) {
    const keys = cell?.keys;
    if (!Array.isArray(keys) || keys.length !== axes.length) {
      return fail('cell_arity_mismatch', { cellIndex });
    }
    let named = 0;
    for (const key of keys) {
      if (!keyShapeValid(key)) return fail('cell_key_invalid', { cellIndex });
      if (key !== null) named += 1;
    }
    if (named === 0) return fail('cell_all_wildcard', { cellIndex });
    if (!valueValid(cell.value, valueKind)) return fail('cell_value_invalid', { cellIndex });
  }

  return undefined;
}
