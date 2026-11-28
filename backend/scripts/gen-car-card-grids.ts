/**
 * ONE-OFF (v37.0.0): re-key every seeded car programme onto the car pricing card's axes and write
 * `src/bank-programs/demo-figures/car-card-grids.ts`. Reads the live rows, maps each card-slot
 * grid's cells onto (deposit, brand, fuel, category), then runs them through the admin card's own
 * `carPricingFromGrids` → `carPricingToGrids`, so what the seeds write is exactly what the card
 * would save. Kept for the record; the generated file is hand-edited from now on.
 *
 *   npx tsx scripts/gen-car-card-grids.ts
 */
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import {
  carPricingFromGrids,
  carPricingToGrids,
  type CarPricing,
  type CarPricingGrids,
} from '../../admin/src/app/shared/ui/car-pricing/car-pricing.rules';

type Key = { key: string } | { fromInclusive?: string; toExclusive?: string | null } | null;
type Cell = { keys: Key[]; value: string };
type Grid = { axes: Array<{ factKey: string; via?: string }>; cells: Cell[]; onNoMatch: string };
type Band = { from: string; to: string | null };

const ORIGIN_TO_CATEGORY: Record<string, string> = {
  germany: 'european', france: 'european', italy: 'european', spain: 'european', czechia: 'european',
  uk: 'european', sweden: 'european', japan: 'japanese', korea: 'korean', usa: 'american', china: 'chinese',
};
const CATEGORIES = ['american', 'european', 'korean', 'japanese', 'chinese'];
const SLOTS: Array<[keyof CarPricingGrids, 'pricing' | 'tenor' | 'fees', number]> = [
  ['rateByFact', 'pricing', 1],
  ['maxMonthsByFact', 'tenor', 1],
  ['carInsuranceRateByFact', 'fees', 1],
  ['maxVehicleAgeYearsByFact', 'tenor', 1],
];

const isBand = (k: Key): k is { fromInclusive?: string; toExclusive?: string | null } =>
  k !== null && typeof k === 'object' && !('key' in k);
const num = (v: string | null | undefined, open: number): number => (v === null || v === undefined ? open : Number(v));

interface Options {
  /** Drop the fuel key (the programme is sold on one fuel, enforced by a condition). */
  dropFuel?: boolean;
  /** Bands to use when the programme has no rate grid. */
  bands?: Band[];
  /** Flat rate written on every band when the programme has no rate grid. */
  flatRate?: string;
}

function convert(code: string, row: Record<string, any>, opts: Options = {}): { grids: CarPricingGrids; dropped: string[]; pricing: CarPricing } {
  const dropped: string[] = [];
  const rate: Grid | undefined = row.pricing?.rateByFact;
  const bands: Band[] =
    opts.bands ??
    [...new Map(
      (rate?.cells ?? [])
        .map((c) => c.keys[rate!.axes.findIndex((a) => a.factKey === 'car_down_payment_percent')])
        .filter(isBand)
        .map((b) => [`${b.fromInclusive}|${b.toExclusive ?? ''}`, { from: b.fromInclusive!, to: b.toExclusive ?? null }] as const),
    ).values()].sort((a, b) => Number(a.from) - Number(b.from));

  // (band index, brand, fuel, category, slot) → value
  const cells = new Map<string, string>();
  const put = (bi: number, brand: string | null, fuel: string | null, cat: string | null, slot: string, value: string) => {
    const id = JSON.stringify([bi, brand, fuel, cat, slot]);
    const prev = cells.get(id);
    if (prev !== undefined && prev !== value) {
      dropped.push(`${slot} ${JSON.stringify([bands[bi], brand, fuel, cat])}: ${prev} vs ${value} → ${Math.min(+prev, +value)}`);
      cells.set(id, String(Math.min(+prev, +value)));
    } else cells.set(id, value);
  };

  for (const [slot, blob] of SLOTS) {
    const g: Grid | undefined = row[blob]?.[slot];
    if (!g) continue;
    for (const cell of g.cells) {
      let brand: string | null = null, fuel: string | null = null, cat: string | null = null;
      let band: { fromInclusive?: string; toExclusive?: string | null } | null = null;
      let skip = '';
      g.axes.forEach((axis, i) => {
        const k = cell.keys[i] ?? null;
        if (k === null) return;
        const key = 'key' in k ? k.key : null;
        switch (axis.factKey) {
          case 'car_down_payment_percent': band = k as never; break;
          case 'what_brand_is_the_car': if (axis.via === 'parentClass') cat = key; else brand = key; break;
          case 'car_category': cat = key; break;
          case 'car_origin': cat = ORIGIN_TO_CATEGORY[key ?? ''] ?? null; if (cat === null) skip = `origin ${key}`; break;
          case 'car_fuel_type':
            if (key === 'electric') fuel = opts.dropFuel ? null : 'electric';
            else if (key !== 'petrol_diesel') skip = `fuel ${key}`;
            break;
          case 'do_you_want_insurance_on_the_car': if (key !== 'without_insurance') skip = `insurance ${key}`; break;
          case 'what_kind_of_car_is_it': if (key !== 'economy') skip = `class ${key}`; break;
          case 'car_dealer': skip = `dealer ${key}`; break;
          case 'tenor_months': {
            const b = k as { fromInclusive?: string };
            if (b.fromInclusive !== '25') skip = 'term band';
            break;
          }
          default: skip = `axis ${axis.factKey}`;
        }
      });
      if (skip) { dropped.push(`${slot} cell dropped (${skip}) = ${cell.value}`); continue; }
      if ([brand, fuel, cat].filter(Boolean).length > 1) {
        dropped.push(`${slot} cell with two exceptions dropped ${JSON.stringify([brand, fuel, cat])} = ${cell.value}`);
        continue;
      }
      const from = band === null ? -1 : num((band as any).fromInclusive, 0);
      const to = band === null ? Infinity : num((band as any).toExclusive, Infinity);
      bands.forEach((b, bi) => {
        const bf = Number(b.from), bt = num(b.to, Infinity);
        if (band === null || (bf >= from && bt <= to)) put(bi, brand, fuel, cat, slot, cell.value);
      });
    }
  }
  if (!rate && opts.flatRate) bands.forEach((_, bi) => put(bi, null, null, null, 'rateByFact', opts.flatRate!));

  // Every category with one value and no row → that value is the row, the rest stay exceptions.
  for (const [slot] of SLOTS) {
    bands.forEach((_, bi) => {
      if (cells.has(JSON.stringify([bi, null, null, null, slot]))) return;
      const vals = CATEGORIES.map((c) => cells.get(JSON.stringify([bi, null, null, c, slot])));
      if (vals.some((v) => v === undefined)) return;
      const count = new Map<string, number>();
      for (const v of vals) count.set(v!, (count.get(v!) ?? 0) + 1);
      const common = [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      cells.set(JSON.stringify([bi, null, null, null, slot]), common);
      for (const c of CATEGORIES) if (cells.get(JSON.stringify([bi, null, null, c, slot])) === common) cells.delete(JSON.stringify([bi, null, null, c, slot]));
    });
  }

  const raw: Record<string, Grid> = {};
  for (const [id, value] of cells) {
    const [bi, brand, fuel, cat, slot] = JSON.parse(id) as [number, string | null, string | null, string | null, string];
    const b = bands[bi]!;
    const g = (raw[slot] ??= {
      axes: [{ factKey: 'car_down_payment_percent' }, { factKey: 'what_brand_is_the_car' }, { factKey: 'car_fuel_type' }, { factKey: 'what_brand_is_the_car', via: 'parentClass' }],
      cells: [],
      onNoMatch: slot === 'rateByFact' ? 'reject' : 'useFallback',
    });
    g.cells.push({
      keys: [b.to === null ? { fromInclusive: b.from } : { fromInclusive: b.from, toExclusive: b.to }, brand && { key: brand }, fuel && { key: fuel }, cat && { key: cat }],
      value,
    });
  }
  const pricing = carPricingFromGrids(raw as never);
  if (pricing === null) throw new Error(`${code}: not in the card's shape`);
  return { grids: carPricingToGrids(pricing), dropped, pricing };
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const rows = await prisma.bankProgram.findMany({
    where: { programCode: { in: ['ADIB-CAR-6681', 'CRE-CAR-3743', 'NATIONAL-CAR-C483', 'CAE-CAR-NEW_CAR', 'CAE-CAR-USED_CAR', 'CAE-CAR-EV'] } },
  });
  const by = new Map(rows.map((r) => [r.programCode, r as unknown as Record<string, any>]));
  const ltvBands = (code: string): Band[] =>
    (by.get(code)!.loanLimits.ltvCeilingByFact.cells as Cell[]).map((c) => {
      const b = c.keys[0] as { fromInclusive: string; toExclusive?: string | null };
      return { from: b.fromInclusive, to: b.toExclusive ?? null };
    });
  const out: Record<string, ReturnType<typeof convert>> = {
    SCB_CARD: convert('CRE-CAR-3743', by.get('CRE-CAR-3743')!),
    NATIONAL: convert('NATIONAL-CAR-C483', by.get('NATIONAL-CAR-C483')!),
    ADIB_USED: convert('ADIB-CAR-6681', by.get('ADIB-CAR-6681')!, { bands: ltvBands('ADIB-CAR-6681') }),
    CAE_NEW: convert('CAE-CAR-NEW_CAR', by.get('CAE-CAR-NEW_CAR')!, { bands: ltvBands('CAE-CAR-NEW_CAR'), flatRate: by.get('CAE-CAR-NEW_CAR')!.pricing.baseRatePercent }),
    CAE_USED: convert('CAE-CAR-USED_CAR', by.get('CAE-CAR-USED_CAR')!, { bands: ltvBands('CAE-CAR-USED_CAR'), flatRate: by.get('CAE-CAR-USED_CAR')!.pricing.baseRatePercent }),
    CAE_EV: convert('CAE-CAR-EV', by.get('CAE-CAR-EV')!, { bands: ltvBands('CAE-CAR-EV'), flatRate: by.get('CAE-CAR-EV')!.pricing.baseRatePercent, dropFuel: true }),
  };
  // The demo: a new-car card an operator can read at a glance.
  const demo: CarPricing = {
    bands: [{ from: '10', to: '20' }, { from: '20', to: '50' }, { from: '50', to: null }],
    rows: [{ rate: '20' }, { rate: '18' }, { rate: '15', interestFreeYears: '2' }],
    exceptions: [
      { kind: 'brand', value: 'bmw', bands: 'all', figures: { rate: '9' } },
      { kind: 'category', value: 'european', bands: 'all', figures: { maxYears: '7' } },
      { kind: 'category', value: 'chinese', bands: 'all', figures: { oldestCar: '3' } },
    ],
  };
  const files: Record<string, CarPricingGrids> = { CAR_PRICING_DEMO: carPricingToGrids(demo) };
  for (const [k, v] of Object.entries(out)) {
    files[k] = v.grids;
    console.log(`\n== ${k}`);
    console.log(JSON.stringify(v.pricing));
    for (const d of v.dropped) console.log('  dropped:', d);
  }
  const body = Object.entries(files)
    .map(([k, v]) => `export const ${k}: CarCardGrids = ${JSON.stringify(v, null, 2)};`)
    .join('\n\n');
  writeFileSync(
    'src/bank-programs/demo-figures/car-card-grids.ts',
    `/**\n * The seeded car programmes on the car pricing card's axes (v37.0.0) — deposit, brand, fuel, the\n * brand's category. Generated once from the live rows by \`scripts/gen-car-card-grids.ts\` through\n * the admin card's own conversion, so each reads back on the card exactly; hand-edited from now on.\n */\nimport type { FactGridDto } from '../dto/sub-configs/fact-grid.dto';\n\nexport interface CarCardGrids {\n  rateByFact?: FactGridDto;\n  maxMonthsByFact?: FactGridDto;\n  carInsuranceRateByFact?: FactGridDto;\n  interestFreeYearsByFact?: FactGridDto;\n  maxVehicleAgeYearsByFact?: FactGridDto;\n}\n\n${body}\n`,
  );
  await prisma.$disconnect();
}

void main();
