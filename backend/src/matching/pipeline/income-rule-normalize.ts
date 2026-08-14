/**
 * Legacy → canonical income-rule upgrade, on READ. Pure function, no Nest, no
 * Prisma, no clock (Constitution Principle V).
 *
 * Feature 011 defines ONE canonical self-describing rule shape (FR-014). Three
 * seeded programs still carry the shapes that predate it — `incomeTable` on
 * `ABK-DOCTORS-PRACTICE`, `rankIncomeMap` on `ABK-PROFESSORS`, `gradeIncomeMap`
 * on `ABK-MILITARY` — and every environment holds rows written before this
 * deploy. Rather than a data migration, the rule is upgraded where it is read:
 * exactly the `normalizeWeights` precedent (constitution v8.0.0, "legacy
 * single-level rows upgrade on read"), which shipped without one.
 *
 * The conversion is REQUIRED to be output-identical (FR-015 / SC-009). Where the
 * legacy and canonical shapes disagree about semantics, the legacy meaning wins
 * and the canonical shape is built to reproduce it:
 *
 *   rankIncomeMap / gradeIncomeMap  → keyTable, insertion order preserved
 *   incomeTable (years)             → bands, toExclusive = maxYears + 1
 *   incomeTable (minCDValueEGP)     → bands chained on the NEXT row's edge
 *   the five scalar keys            → scalar { value, unit }
 *
 * Idempotent: an already-canonical blob is returned unchanged.
 *
 * A migration was rejected for a third reason beyond cost: a normalizer is needed
 * anyway for any row written while a deploy is in flight, and having both means
 * two truths about what the rule is (research R1).
 */

import type { IncomeAssumptionConfig, IncomeBand, IncomeKeyTableRow } from '../types';

/**
 * `maxYears` is INCLUSIVE in the legacy table and the values are whole years, so
 * the half-open equivalent of `[0, 5]` is `[0, 6)`. Using `maxYears` itself as
 * the exclusive edge would silently drop every applicant sitting exactly on a
 * band's upper year — the single most likely value in a 0–5 band.
 */
const YEARS_INCLUSIVE_TO_EXCLUSIVE = 1;

/** The scalar keys, and the unit each one's arithmetic is expressed in. */
const SCALAR_LEGACY_KEYS = [
  { key: 'carInstallmentMultiplier', unit: 'multiplier' },
  { key: 'carLoanAmountPercent', unit: 'percent' },
  { key: 'creditCardLimitMultiplier', unit: 'multiplier' },
  { key: 'bankStatementPercent', unit: 'percent' },
  // `byTotalDeposits` prefers `cdIncomePercentOfDeposits` and falls back to
  // `cdIncomePercent`; `byCDValue` reads `cdIncomePercent` only.
  { key: 'cdIncomePercentOfDeposits', unit: 'percent' },
  { key: 'cdIncomePercent', unit: 'percent' },
] as const satisfies ReadonlyArray<{ key: keyof IncomeAssumptionConfig; unit: string }>;

/**
 * True when the blob already speaks canonical. Detected by KEY PRESENCE, not by
 * truthiness: an empty `keyTable: []` is a canonical rule that happens to be
 * empty (and the save path rejects it — `INCOME_RULE_EMPTY`), not a legacy row to
 * be re-derived. The same distinction `normalizeWeights` had to make.
 */
function isCanonical(config: IncomeAssumptionConfig): boolean {
  return 'keyTable' in config || 'bands' in config || 'scalar' in config;
}

export function normalizeIncomeAssumption(
  config: IncomeAssumptionConfig | null | undefined,
): IncomeAssumptionConfig {
  // A program with no rule at all behaves as `declared`, which is what every
  // `income_proof` program is. Returning a partial object here would make every
  // downstream `strategy` read optional for no gain.
  if (!config || typeof config !== 'object') return { strategy: 'declared' };
  if (isCanonical(config)) return withRepairedBands(config);

  const carried = carryPolicyFields(config);

  switch (config.strategy) {
    case 'byProfessorRank':
      return withKeyTable(config, carried, config.rankIncomeMap);

    case 'byMilitaryGrade':
      return withKeyTable(config, carried, config.gradeIncomeMap);

    case 'byYearsInJob':
    case 'byYearsInPractice': {
      const bands = yearBands(config.incomeTable);
      return bands ? { ...config, ...carried, bands } : { ...config, ...carried };
    }

    case 'byCDValue':
    case 'byTotalDeposits': {
      // These two accept BOTH shapes. A legacy row carries the percent-of-value
      // scalar and MUST keep producing the same figure (FR-015), so bands are
      // synthesised only where a value table actually exists.
      const bands = valueBands(config.incomeTable);
      if (bands) return { ...config, ...carried, bands };
      return { ...config, ...carried, ...scalarFor(config) };
    }

    case 'byCarInstallment':
    case 'byCarLoanAmount':
    case 'byCreditCardLimit':
    case 'byBankStatementPercent':
      return { ...config, ...carried, ...scalarFor(config) };

    case 'declared':
    default:
      return { ...config, ...carried };
  }
}

/**
 * `combinationRule` / `dbrCapPercentOverride` / `requiredDocuments` are not part
 * of any method's shape — they are policy on top of it, and a legacy row may
 * already carry `combinationRule`. Spread explicitly so a future field cannot be
 * dropped silently by a `switch` branch that forgot it.
 */
/**
 * An ALREADY-canonical blob, with any overlapping band lower edge raised to where
 * the previous band ends.
 *
 * Same repair `yearBands` applies on conversion, and needed here for the same rows:
 * the doctors table was hand-converted into the seed with its legacy overlap intact,
 * so every environment already holds a canonical blob the save path rejects. The
 * conversion-time fix alone would never reach them — `isCanonical` returns those rows
 * untouched.
 *
 * Output-identical by construction: `bandFor` is first-match, so the overlap region
 * has always belonged to the earlier band and raising the later edge moves no value.
 * The SAME array is returned when nothing needed raising, which keeps the normalizer
 * referentially idempotent on a clean rule.
 */
function withRepairedBands(config: IncomeAssumptionConfig): IncomeAssumptionConfig {
  const repaired = repairBandOverlaps(config.bands);
  return repaired === config.bands ? config : { ...config, bands: repaired };
}

function repairBandOverlaps(
  bands: IncomeAssumptionConfig['bands'],
): IncomeAssumptionConfig['bands'] {
  if (!bands?.length) return bands;

  const next: IncomeBand[] = [];
  let changed = false;
  // The previous band's upper edge, as it was WRITTEN — carried as the string so a
  // raised edge reproduces the neighbour's own text rather than a re-formatted number.
  let previousTo: { raw: string; value: number } | null = null;

  for (const band of bands) {
    const from = Number(band.fromInclusive);
    // A non-numeric edge is left exactly as it is: the validator reports it as
    // `edge_not_decimal`, and guessing at a repair would hide the real problem.
    if (previousTo !== null && Number.isFinite(from) && from < previousTo.value) {
      next.push({ ...band, fromInclusive: previousTo.raw });
      changed = true;
    } else {
      next.push(band);
    }

    const rawTo = band.toExclusive;
    const to = rawTo === null || rawTo === undefined ? Number.NaN : Number(rawTo);
    previousTo = rawTo != null && Number.isFinite(to) ? { raw: rawTo, value: to } : null;
  }

  return changed ? next : bands;
}

function carryPolicyFields(config: IncomeAssumptionConfig): Partial<IncomeAssumptionConfig> {
  return {
    ...(config.combinationRule !== undefined ? { combinationRule: config.combinationRule } : {}),
    ...(config.dbrCapPercentOverride !== undefined
      ? { dbrCapPercentOverride: config.dbrCapPercentOverride }
      : {}),
    ...(config.requiredDocuments !== undefined
      ? { requiredDocuments: config.requiredDocuments }
      : {}),
  };
}

function withKeyTable(
  config: IncomeAssumptionConfig,
  carried: Partial<IncomeAssumptionConfig>,
  map: Record<string, string> | undefined,
): IncomeAssumptionConfig {
  if (!map) return { ...config, ...carried };
  const keyTable: IncomeKeyTableRow[] = Object.entries(map).map(([key, incomeEGP]) => ({
    key,
    incomeEGP: String(incomeEGP),
  }));
  return { ...config, ...carried, keyTable };
}

/** Which legacy field is this strategy's single number, and in what unit. */
function scalarFor(config: IncomeAssumptionConfig): Pick<IncomeAssumptionConfig, 'scalar'> {
  for (const candidate of SCALAR_KEYS_FOR_STRATEGY[config.strategy] ?? []) {
    const raw = config[candidate.key];
    if (typeof raw === 'string' && raw.trim() !== '') {
      return { scalar: { value: raw, unit: candidate.unit as 'percent' | 'multiplier' } };
    }
  }
  // No stored number. Deliberately NOT defaulted here: `resolveSurrogateIncome`
  // owns the per-strategy fallbacks (`?? '4'`, `?? '3'`, …) and duplicating them
  // would give the same default two homes — the drift A33 names.
  return {};
}

type ScalarKeySpec = (typeof SCALAR_LEGACY_KEYS)[number];

/**
 * The legacy field(s) each scalar strategy may read, in order — and NOTHING ELSE.
 *
 * The list is closed on purpose. Falling through to another method's key was how a
 * `byCarInstallment` program carrying a stray `cdIncomePercent: '3'` (left over from
 * a method switch made before FR-011 stripping existed) resolved to
 * `installment × 3` instead of the documented `× 4` default — a figure in the wrong
 * UNIT, taken from a field that belongs to a different method. When a strategy's own
 * key is absent the answer is "no stored number", which hands the resolver its
 * documented per-strategy default (FR-015: the normalizer moves no figure).
 *
 * `byTotalDeposits` is the one strategy with two, mirroring `resolveSurrogateIncome`
 * exactly: `cdIncomePercentOfDeposits` first, then the shared `cdIncomePercent`.
 */
const SCALAR_KEYS_FOR_STRATEGY: Partial<
  Record<IncomeAssumptionConfig['strategy'], readonly ScalarKeySpec[]>
> = {
  byCarInstallment: [SCALAR_LEGACY_KEYS[0]],
  byCarLoanAmount: [SCALAR_LEGACY_KEYS[1]],
  byCreditCardLimit: [SCALAR_LEGACY_KEYS[2]],
  byBankStatementPercent: [SCALAR_LEGACY_KEYS[3]],
  byTotalDeposits: [SCALAR_LEGACY_KEYS[4], SCALAR_LEGACY_KEYS[5]],
  byCDValue: [SCALAR_LEGACY_KEYS[5]],
};

/**
 * The legacy scalar keys a given strategy owns. Exported for the SAVE path, which
 * must carry a strategy's own legacy number through `stripForeignMethodConfig` —
 * dropping it there substitutes the resolver's default for the bank's figure.
 */
export function legacyScalarKeysFor(
  strategy: IncomeAssumptionConfig['strategy'],
): readonly (keyof IncomeAssumptionConfig)[] {
  return (SCALAR_KEYS_FOR_STRATEGY[strategy] ?? []).map((spec) => spec.key);
}

/** Legacy inclusive `[minYears, maxYears]` rows → half-open bands. */
function yearBands(table: IncomeAssumptionConfig['incomeTable']): IncomeBand[] | undefined {
  if (!table?.length) return undefined;
  const rows = table.filter(
    (r): r is { minYears: number; maxYears: number; incomeEGP?: string; assumedIncomeEGP?: string } =>
      typeof r.minYears === 'number' && typeof r.maxYears === 'number',
  );
  if (rows.length === 0) return undefined;

  // Order preserved, NOT sorted: the legacy lookup is a `find`, so the first
  // matching row wins, and the seeded doctors table overlaps on purpose-by-accident
  // (`0–5` and `5–50` both claim year 5). Re-sorting could reorder equal `minYears`
  // rows and silently pick the other income. `bandFor` is first-match for the same
  // reason, which is what makes the two agree.
  // The legacy rows OVERLAP by accident (the seeded doctors table has `0–5` and
  // `5–50`, both claiming year 5) and the lookup is first-match, so the overlap
  // region always belongs to the EARLIER row. Raising a row's lower edge to its
  // predecessor's upper edge therefore changes no lookup outcome — FR-015 holds —
  // while producing a table the canonical shape can express and the save path can
  // accept. Leaving the overlap in made every un-migrated years program 422 on its
  // next save, with no edit that could fix it.
  let previousTo: number | null = null;
  return rows.map((row) => {
    const to = row.maxYears + YEARS_INCLUSIVE_TO_EXCLUSIVE;
    const from = previousTo !== null && row.minYears < previousTo ? previousTo : row.minYears;
    previousTo = to;
    return {
      fromInclusive: String(from),
      // EVERY row closes at `maxYears + 1`, the LAST one included. Opening the top
      // band here would change behaviour: the doctors seed caps at `maxYears: 50`,
      // so a 51-year practitioner resolves to NOTHING today, and an open top band
      // would start handing them 40 000. A closed last band is a legal canonical
      // table (`bandFor` reports `no_matching_band` above it); an admin who wants it
      // open says so by clearing the edge.
      toExclusive: String(to),
      incomeEGP: String(row.incomeEGP ?? row.assumedIncomeEGP ?? '0'),
    };
  });
}

/** Legacy ascending `minCDValueEGP` rows → bands chained on the next row's edge. */
function valueBands(table: IncomeAssumptionConfig['incomeTable']): IncomeBand[] | undefined {
  if (!table?.length) return undefined;
  const rows = table.filter(
    (r): r is { minCDValueEGP: string; incomeEGP?: string; assumedIncomeEGP?: string } =>
      typeof r.minCDValueEGP === 'string',
  );
  if (rows.length === 0) return undefined;

  return rows.map((row, index) => ({
    fromInclusive: row.minCDValueEGP,
    // Chained, not derived from this row: the legacy shape stores only a lower
    // bound per row, so a row's upper bound IS the next row's lower bound. That
    // is also why the result is gapless by construction.
    toExclusive: index === rows.length - 1 ? null : (rows[index + 1]?.minCDValueEGP ?? null),
    incomeEGP: String(row.incomeEGP ?? row.assumedIncomeEGP ?? '0'),
  }));
}
