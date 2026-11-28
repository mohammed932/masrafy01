import type { FactGridAxis, FactGridBand, FactGridCell, FactGridConfig } from '@shared/ui/fact-grid.rules';

/**
 * The car pricing card (v37.0.0) — what an operator types, and the five grids the engine reads.
 *
 * The card is rows by down payment (a band: a lower edge and an optional upper one) with a rate
 * and up to four more figures, plus exceptions: a category, a brand or "electric", on all bands
 * or some, setting any figure. Underneath, every figure is ONE grid on the same four axes
 * (`CAR_PRICING_AXES` — mirrors the backend's): the deposit, the brand, the fuel, the brand's
 * category. An earlier axis outranks every later one, so per figure a brand exception beats
 * electric, electric beats a category, and all three beat the row. Nothing here names a bank,
 * a brand or a category — they arrive as list values.
 */

export type CarFigure = 'rate' | 'maxYears' | 'insurance' | 'interestFreeYears' | 'oldestCar';

export const CAR_FIGURES: readonly CarFigure[] = [
  'rate',
  'maxYears',
  'insurance',
  'interestFreeYears',
  'oldestCar',
];

export interface CarBand {
  from: string;
  to: string | null;
}

export type CarExceptionKind = 'category' | 'brand' | 'electric';

export interface CarException {
  kind: CarExceptionKind;
  /** The category or brand list value; `null` for electric. */
  value: string | null;
  bands: 'all' | number[];
  figures: Partial<Record<CarFigure, string>>;
}

export interface CarPricing {
  bands: CarBand[];
  rows: Array<Partial<Record<CarFigure, string>>>;
  exceptions: CarException[];
}

/** The five slots the card owns — every other plan slot is left as the form found it. */
export interface CarPricingGrids {
  rateByFact?: FactGridConfig;
  maxMonthsByFact?: FactGridConfig;
  carInsuranceRateByFact?: FactGridConfig;
  interestFreeYearsByFact?: FactGridConfig;
  maxVehicleAgeYearsByFact?: FactGridConfig;
}

export const CAR_PRICING_SLOTS = [
  'rateByFact',
  'maxMonthsByFact',
  'carInsuranceRateByFact',
  'interestFreeYearsByFact',
  'maxVehicleAgeYearsByFact',
] as const satisfies ReadonlyArray<keyof CarPricingGrids>;

const SLOT_OF: Record<CarFigure, keyof CarPricingGrids> = {
  rate: 'rateByFact',
  maxYears: 'maxMonthsByFact',
  insurance: 'carInsuranceRateByFact',
  interestFreeYears: 'interestFreeYearsByFact',
  oldestCar: 'maxVehicleAgeYearsByFact',
};

/** Mirrors the backend's `CAR_PRICING_AXES` (`plan-inherit.ts`). */
export const CAR_PRICING_AXES: readonly FactGridAxis[] = [
  { factKey: 'car_down_payment_percent' },
  { factKey: 'what_brand_is_the_car' },
  { factKey: 'car_fuel_type' },
  { factKey: 'what_brand_is_the_car', via: 'parentClass' },
];

/** The fuel answer an "electric" exception keys on. */
export const ELECTRIC_FUEL = 'electric';

const NUMBER = /^\d+(\.\d+)?$/;

export function emptyCarPricing(): CarPricing {
  return { bands: [{ from: '0', to: null }], rows: [{}], exceptions: [] };
}

/** True when any card slot holds a grid. */
export function hasCarPricingGrids(grids: CarPricingGrids | null | undefined): boolean {
  return CAR_PRICING_SLOTS.some((slot) => grids?.[slot] !== undefined);
}

// ── Card → grids ──────────────────────────────────────────────────────────────────────────────

function bandKey(band: CarBand): FactGridBand {
  return band.to === null || band.to === ''
    ? { fromInclusive: band.from }
    : { fromInclusive: band.from, toExclusive: band.to };
}

/** What the grid stores for a figure: years become months for the term, the rest as typed. */
function stored(figure: CarFigure, value: string): string {
  if (figure !== 'maxYears') return value;
  const months = Number(value) * 12;
  return String(Math.round(months));
}

function exceptionKeys(ex: CarException): [FactGridCell['keys'][1], FactGridCell['keys'][2], FactGridCell['keys'][3]] {
  if (ex.kind === 'brand') return [{ key: ex.value ?? '' }, null, null];
  if (ex.kind === 'electric') return [null, { key: ELECTRIC_FUEL }, null];
  return [null, null, { key: ex.value ?? '' }];
}

function bandIndexes(ex: CarException, bandCount: number): number[] {
  return ex.bands === 'all' ? Array.from({ length: bandCount }, (_, i) => i) : [...ex.bands].sort((a, b) => a - b);
}

/**
 * The five grids. A figure no row and no exception states writes no grid at all; an exception on
 * "all bands" is written once per band (the grid has no "every band" key that still ranks it).
 */
export function carPricingToGrids(p: CarPricing): CarPricingGrids {
  const out: CarPricingGrids = {};
  for (const figure of CAR_FIGURES) {
    const cells: FactGridCell[] = [];
    p.bands.forEach((band, i) => {
      const value = p.rows[i]?.[figure];
      if (value !== undefined && value !== '') {
        cells.push({ keys: [bandKey(band), null, null, null], value: stored(figure, value) });
      }
    });
    for (const ex of p.exceptions) {
      const value = ex.figures[figure];
      if (value === undefined || value === '') continue;
      const [brand, fuel, category] = exceptionKeys(ex);
      for (const i of bandIndexes(ex, p.bands.length)) {
        const band = p.bands[i];
        if (band === undefined) continue;
        cells.push({ keys: [bandKey(band), brand, fuel, category], value: stored(figure, value) });
      }
    }
    if (cells.length === 0) continue;
    out[SLOT_OF[figure]] = {
      axes: CAR_PRICING_AXES.map((a) => ({ ...a })),
      cells,
      onNoMatch: figure === 'rate' ? 'reject' : 'useFallback',
    };
  }
  return out;
}

// ── Grids → card ──────────────────────────────────────────────────────────────────────────────

function sameAxes(axes: readonly FactGridAxis[]): boolean {
  if (axes.length !== CAR_PRICING_AXES.length) return false;
  return axes.every((a, i) => {
    const want = CAR_PRICING_AXES[i];
    const via = a.via === 'parentClass' ? 'parentClass' : undefined;
    return want !== undefined && a.factKey === want.factKey && via === want.via;
  });
}

function shown(figure: CarFigure, value: string): string {
  if (figure !== 'maxYears') return value;
  const years = Number(value) / 12;
  return Number.isFinite(years) ? String(Number(years.toFixed(4))) : value;
}

type Cls = { kind: 'row' } | { kind: CarExceptionKind; value: string | null };

function classify(keys: FactGridCell['keys']): Cls | null {
  const [, brand, fuel, category] = keys;
  const isKey = (k: unknown): k is { key: string } =>
    k !== null && typeof k === 'object' && typeof (k as { key?: unknown }).key === 'string';
  const set = [brand, fuel, category].filter((k) => k !== null && k !== undefined);
  if (set.length === 0) return { kind: 'row' };
  if (set.length > 1) return null;
  if (isKey(brand)) return { kind: 'brand', value: brand.key };
  if (isKey(fuel)) return fuel.key === ELECTRIC_FUEL ? { kind: 'electric', value: null } : null;
  if (isKey(category)) return { kind: 'category', value: category.key };
  return null;
}

/**
 * The card a set of grids reads as, or `null` when they are not in the card's shape (another
 * axis set, an edge the card cannot type, two exceptions in one cell) — the form then leaves
 * them untouched and says so.
 */
export function carPricingFromGrids(grids: CarPricingGrids | null | undefined): CarPricing | null {
  if (!grids || !hasCarPricingGrids(grids)) return null;
  const figures = CAR_FIGURES.filter((f) => grids[SLOT_OF[f]] !== undefined);

  // The bands: every deposit edge any cell states, in order.
  const bandIds = new Map<string, CarBand>();
  for (const figure of figures) {
    const grid = grids[SLOT_OF[figure]]!;
    if (!sameAxes(grid.axes)) return null;
    for (const cell of grid.cells) {
      const b = cell.keys[0];
      if (b === null || b === undefined || typeof b !== 'object' || 'key' in b) return null;
      if (b.fromExclusive !== undefined || b.toInclusive !== undefined || b.fromInclusive === undefined) return null;
      const band: CarBand = { from: b.fromInclusive, to: b.toExclusive ?? null };
      bandIds.set(`${band.from}|${band.to ?? ''}`, band);
    }
  }
  const bands = [...bandIds.values()].sort((a, b) => Number(a.from) - Number(b.from));
  const indexOf = new Map(bands.map((b, i) => [`${b.from}|${b.to ?? ''}`, i]));
  const rows: CarPricing['rows'] = bands.map(() => ({}));

  // Per exception (kind + value, in order of first sight): band → figures.
  const groups: Array<{ kind: CarExceptionKind; value: string | null; byBand: Map<number, Partial<Record<CarFigure, string>>> }> = [];
  for (const figure of figures) {
    for (const cell of grids[SLOT_OF[figure]]!.cells) {
      const b = cell.keys[0] as FactGridBand;
      const i = indexOf.get(`${b.fromInclusive}|${b.toExclusive ?? ''}`)!;
      const cls = classify(cell.keys);
      if (cls === null) return null;
      const value = shown(figure, cell.value);
      if (cls.kind === 'row') {
        rows[i]![figure] = value;
        continue;
      }
      let g = groups.find((x) => x.kind === cls.kind && x.value === cls.value);
      if (!g) {
        g = { kind: cls.kind, value: cls.value, byBand: new Map() };
        groups.push(g);
      }
      g.byBand.set(i, { ...(g.byBand.get(i) ?? {}), [figure]: value });
    }
  }

  // Bands with the same figures become one exception line.
  const exceptions: CarException[] = [];
  for (const g of groups) {
    const sets = new Map<string, { figures: Partial<Record<CarFigure, string>>; bands: number[] }>();
    for (const [i, f] of [...g.byBand.entries()].sort((a, b) => a[0] - b[0])) {
      const id = CAR_FIGURES.map((k) => f[k] ?? '').join('|');
      const s = sets.get(id) ?? { figures: f, bands: [] };
      s.bands.push(i);
      sets.set(id, s);
    }
    for (const s of sets.values()) {
      exceptions.push({
        kind: g.kind,
        value: g.value,
        bands: s.bands.length === bands.length ? 'all' : s.bands,
        figures: s.figures,
      });
    }
  }
  return { bands, rows, exceptions };
}

// ── Problems ──────────────────────────────────────────────────────────────────────────────────

export interface CarPricingIssue {
  where: 'band' | 'exception';
  index: number;
  message: string;
}

function badNumber(figure: CarFigure, value: string | undefined): boolean {
  if (value === undefined || value === '') return false;
  if (!NUMBER.test(value)) return true;
  if (figure === 'maxYears') return !Number.isInteger(Number(value) * 12) || Number(value) === 0;
  return false;
}

/** Every problem, where it is — the card shows each under its own line. */
export function carPricingIssues(p: CarPricing): CarPricingIssue[] {
  const issues: CarPricingIssue[] = [];
  p.bands.forEach((band, i) => {
    const add = (message: string): void => void issues.push({ where: 'band', index: i, message });
    const last = i === p.bands.length - 1;
    if (!NUMBER.test(band.from) || Number(band.from) > 100) {
      add($localize`:@@carPricing.err.from:Type the down payment this band starts at (0–100%).`);
      return;
    }
    if (band.to !== null && band.to !== '') {
      if (!NUMBER.test(band.to) || Number(band.to) > 100 || Number(band.to) <= Number(band.from)) {
        add($localize`:@@carPricing.err.to:The band must end above where it starts, at 100% at most.`);
        return;
      }
    } else if (!last) {
      add($localize`:@@carPricing.err.open:Only the last band can be open-ended — type where this one ends.`);
      return;
    }
    const next = p.bands[i + 1];
    if (next && band.to !== null && band.to !== '' && NUMBER.test(next.from) && Number(next.from) < Number(band.to)) {
      add($localize`:@@carPricing.err.overlap:This band overlaps the next one.`);
      return;
    }
    const row = p.rows[i] ?? {};
    if (row.rate === undefined || row.rate === '') {
      add($localize`:@@carPricing.err.rate:Type a rate for this band.`);
      return;
    }
    if (CAR_FIGURES.some((f) => badNumber(f, row[f]))) {
      add($localize`:@@carPricing.err.number:A figure here is not a number (a term in years must come to whole months).`);
    }
  });
  p.exceptions.forEach((ex, i) => {
    const add = (message: string): void => void issues.push({ where: 'exception', index: i, message });
    if (ex.kind !== 'electric' && (ex.value === null || ex.value === '')) {
      add(ex.kind === 'brand'
        ? $localize`:@@carPricing.err.brand:Pick the brand.`
        : $localize`:@@carPricing.err.category:Pick the category.`);
      return;
    }
    if (ex.bands !== 'all' && ex.bands.length === 0) {
      add($localize`:@@carPricing.err.bands:Pick at least one band.`);
      return;
    }
    if (!CAR_FIGURES.some((f) => (ex.figures[f] ?? '') !== '')) {
      add($localize`:@@carPricing.err.figure:Type at least one figure.`);
      return;
    }
    if (CAR_FIGURES.some((f) => badNumber(f, ex.figures[f]))) {
      add($localize`:@@carPricing.err.number:A figure here is not a number (a term in years must come to whole months).`);
    }
  });
  return issues;
}

/** The first problem, for a host's save gate; `null` when the card can be saved. */
export function carPricingProblem(p: CarPricing): string | null {
  return carPricingIssues(p)[0]?.message ?? null;
}
