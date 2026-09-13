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
  | 'cell_key_on_numeric_axis'
  | 'cell_band_on_choice_axis'
  | 'cell_key_unknown'
  | 'cell_value_invalid'
  | 'no_match_invalid';

export interface FactGridViolation {
  reason: FactGridViolationReason;
  /** The option codes the axis does accept, so a refusal names the alternatives. */
  legalKeys?: string[];
  /** `pricing.rateByFact` or `tenor.maxMonthsByFact` — the field an operator must go and fix. */
  fieldPath: string;
  factKey?: string;
  cellIndex?: number;
  availableFacts?: string[];
}

const MAX_AXES = 4;

/** What the figure in a cell means, which is the only thing that differs between the grids. */
export type FactGridValueKind = 'ratePercent' | 'months' | 'sharePercent' | 'amountEGP';

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
  // A SHARE of something, so at most all of it. Its own kind rather than `ratePercent`,
  // whose ceiling is 999.9999: a financed share typed as a rate would save cleanly, render
  // correctly and then CAP NOTHING, because `ltvCeilingFor` answers `null` for anything
  // above 100. A refusal an operator can still act on beats a silent no-op on a customer.
  if (kind === 'sharePercent') return n <= 100;
  // Money, to the piastre. No integer rule and no 480 ceiling — both belong to `months`.
  if (kind === 'amountEGP') return n <= 99999999999.99;
  return Number.isInteger(n) && n <= 480;
}

export function validateFactGrid(args: {
  config: FactGridConfig;
  fieldPath: string;
  valueKind: FactGridValueKind;
  registry: readonly SurrogateFactBinding[];
  /**
   * The option codes of each axis's bound question, by FACT key.
   *
   * Optional, and absent means "the caller could not look them up" — in which case the
   * unknown-key check is SKIPPED rather than failing everything. A validator that refuses a
   * legal table because its own lookup was unavailable tells an operator their card is
   * unsavable with nothing to fix, which is the direction that must never happen.
   */
  optionCodesByFact?: Readonly<Record<string, readonly string[]>>;
}): FactGridViolation | undefined {
  const { config, fieldPath, valueKind, registry, optionCodesByFact } = args;
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

    // The three checks the two-axis table this generalises has always made
    // (`max-loan-by-fact.validator.ts`: row_key_on_numeric_fact, band_on_choice_fact,
    // unknown_row_key) and which this one shipped without.
    //
    // Every one of them is a table that SAVES cleanly, RENDERS correctly, and then matches
    // nobody: a key on a numeric axis, a band on a choice axis and a mistyped option code all
    // resolve to `no_matching_row`, and under `onNoMatch: 'useFallback'` that silently drops
    // the applicant to the next cascade level — the bank's own printed figure never used,
    // nothing reported, and the fallback rate frozen onto an immutable offer.
    for (const [axisIndex, key] of keys.entries()) {
      if (key === null || key === undefined) continue;
      const axis = axes[axisIndex];
      if (axis === undefined) continue;
      const factKey = axis.factKey;
      // A derived or grid-only axis is a NUMBER by construction and has no option list.
      const numericByConstruction = isGridOnlyFactKey(factKey) || isDerivedFactKey(factKey);
      const bound = registry.find((f) => f.key === factKey);
      const isNumericAxis = numericByConstruction || bound?.type === 'NUMERIC';
      const isChoiceAxis = !numericByConstruction && bound !== undefined && !isNumericAxis;

      if ('key' in key) {
        if (isNumericAxis) return fail('cell_key_on_numeric_axis', { cellIndex, factKey });
        const legal = optionCodesByFact?.[factKey];
        // A CLASS-keyed axis is keyed by the class list, not the answer's own options, so
        // the option codes are not the legal set and the check does not apply.
        if (isChoiceAxis && axis.via !== 'parentClass' && legal !== undefined) {
          if (!legal.includes(key.key)) {
            return fail('cell_key_unknown', { cellIndex, factKey, legalKeys: [...legal] });
          }
        }
      } else if (isChoiceAxis) {
        return fail('cell_band_on_choice_axis', { cellIndex, factKey });
      }
    }

    if (!valueValid(cell.value, valueKind)) return fail('cell_value_invalid', { cellIndex });
  }

  return undefined;
}
