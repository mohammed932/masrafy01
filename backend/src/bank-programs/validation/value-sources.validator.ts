import type { IncomeAssumptionConfig } from '@/matching/types';

/**
 * Feature 011 — which dot-paths on a bank program may carry a value-source marker,
 * and the scan that turns a stored map into "these numbers are team-estimated"
 * (FR-032, FR-033, research R8).
 *
 * **The allow-list is DERIVED, never hand-written.** It is computed by walking the
 * program's own configuration and collecting every path whose leaf is a number (or a
 * decimal string, which is how money is stored). A number the admin can type IS such
 * a leaf, so the list is exhaustive by construction — and it stays exhaustive when a
 * new field is added to a config blob, which a hand-picked list would not.
 *
 * That matters more than it looks. A number OUTSIDE the list cannot be marked, and a
 * number that cannot be marked can never block activation — so a partial list would
 * silently exempt whatever it omitted, and the gate would quietly stop covering the
 * fields nobody remembered. The failure would be invisible: the admin marks what they
 * can see, the program goes live, and the unmarked guess ships.
 *
 * Pure module — no Nest, no Prisma — so the service maps rejections to typed
 * exceptions and this stays unit-testable on plain objects.
 */

/** The only value a marker can hold. Absence means "the bank stated this". */
export const TEAM_ESTIMATED = 'team_estimated' as const;

export type ValueSourceMap = Record<string, typeof TEAM_ESTIMATED>;

/**
 * The config blobs a marker may point into. `programType`, `currencies`, names and
 * flags are deliberately absent: they are not numbers a bank quotes, so "did the bank
 * state this?" is not a question about them.
 */
export const MARKABLE_CONFIG_ROOTS = [
  'incomeAssumption',
  'pricing',
  'fees',
  'loanLimits',
  'tenor',
  'eligibility',
  'performanceCriteria',
] as const;

export type MarkableConfigRoot = (typeof MARKABLE_CONFIG_ROOTS)[number];

/** The program's configuration, as the paths are addressed against it. */
export type MarkableProgramConfig = Partial<Record<MarkableConfigRoot, unknown>>;

/** A decimal string — how every money and rate value is stored (Principle I). */
const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

function isNumericLeaf(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  // Money and rates arrive from JSONB as strings and must be markable as themselves —
  // treating only `number` as numeric would exempt every EGP figure on the program,
  // which is most of what an admin actually estimates.
  return typeof value === 'string' && DECIMAL_STRING.test(value.trim()) && value.trim() !== '';
}

/**
 * Every markable path on this program.
 *
 * Objects recurse by key. Arrays recurse by INDEX — except a `keyTable`, whose rows
 * are addressed by their registry KEY (`incomeAssumption.keyTable.general.incomeEGP`,
 * per the contract): an index would silently re-point at a different grade the moment
 * a row was reordered or removed, and reordering is a first-class action in the editor.
 */
export function markablePaths(config: MarkableProgramConfig): Set<string> {
  const paths = new Set<string>();

  const walk = (value: unknown, prefix: string, inKeyTable: boolean): void => {
    if (value === null || value === undefined) return;

    if (isNumericLeaf(value)) {
      paths.add(prefix);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        if (inKeyTable) {
          const key = (entry as { key?: unknown })?.key;
          // A row with no key cannot be addressed stably; it is also a row the
          // validator rejects on save, so skipping it here loses nothing.
          if (typeof key !== 'string' || key.length === 0) return;
          walk(entry, `${prefix}.${key}`, false);
          return;
        }
        walk(entry, `${prefix}.${index}`, false);
      });
      return;
    }

    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(child, prefix === '' ? key : `${prefix}.${key}`, key === 'keyTable');
      }
    }
  };

  for (const root of MARKABLE_CONFIG_ROOTS) {
    walk(config[root], root, false);
  }

  return paths;
}

export type ValueSourceViolation =
  | { kind: 'unknownPath'; path: string }
  /**
   * The path is markable but the VALUE is not `team_estimated`. Reported apart from
   * `unknownPath` because the two send the admin to different places: "reload the
   * program" fixes nothing when the path is fine and the value is junk.
   */
  | { kind: 'invalidValue'; path: string; value: string };

/**
 * Validate a submitted marker map against the program it is being saved with.
 *
 * Checked against the INCOMING configuration, not the stored one: the admin marks a
 * number in the same save that introduces it, and validating against what is already
 * in the database would reject the first marker on every new field.
 *
 * A path that is markable on NEITHER the incoming nor the previous configuration is
 * rejected — that is a client sending a path this program has never had. A path that
 * WAS markable and no longer is (a band removed, a key-table row renamed, a method
 * switched) is STALE, not invalid: it is left for `pruneValueSources` to drop
 * alongside the number it described. Rejecting stale paths made prune unreachable and
 * trapped the admin — the marker's control had disappeared with its row, so there was
 * no edit that could clear it and the program could never be saved again (research R8).
 */
export function validateValueSources(
  valueSources: ValueSourceMap | null | undefined,
  config: MarkableProgramConfig,
  opts: { previousConfig?: MarkableProgramConfig | null } = {},
): ValueSourceViolation | undefined {
  if (!valueSources) return undefined;
  const entries = Object.entries(valueSources);
  if (entries.length === 0) return undefined;

  const allowed = markablePaths(config);
  // Absent on create, where nothing can be stale because the program has no past.
  const previouslyAllowed = opts.previousConfig
    ? markablePaths(opts.previousConfig)
    : new Set<string>();

  for (const [path, value] of entries) {
    if (value !== TEAM_ESTIMATED) return { kind: 'invalidValue', path, value: String(value) };
    if (allowed.has(path) || previouslyAllowed.has(path)) continue;
    return { kind: 'unknownPath', path };
  }
  return undefined;
}

/**
 * Drop markers whose path no longer exists on the saved configuration.
 *
 * Runs AFTER validation, on the persisted shape: the admin may legitimately delete a
 * table row that carried a marker, and refusing that save would trap them — the only
 * way out would be to un-mark a number they can no longer see. The marker is dropped
 * with the number it described, which is the only reading that keeps the map honest.
 */
export function pruneValueSources(
  valueSources: ValueSourceMap | null | undefined,
  config: MarkableProgramConfig,
): ValueSourceMap {
  if (!valueSources) return {};
  const allowed = markablePaths(config);
  const pruned: ValueSourceMap = {};
  for (const [path, value] of Object.entries(valueSources)) {
    if (value === TEAM_ESTIMATED && allowed.has(path)) pruned[path] = TEAM_ESTIMATED;
  }
  return pruned;
}

/**
 * Every still-standing estimated path, sorted.
 *
 * Returns ALL of them, never the first: FR-033 requires the refusal to name every
 * value, because the admin has ONE conversation with the bank and a one-at-a-time
 * reveal costs a round trip per number.
 */
export function estimatedPaths(valueSources: unknown): string[] {
  if (!valueSources || typeof valueSources !== 'object') return [];
  return Object.entries(valueSources as Record<string, unknown>)
    .filter(([, value]) => value === TEAM_ESTIMATED)
    .map(([path]) => path)
    .sort();
}

/** Whether this program carries any team-estimated number at all. */
export function hasEstimatedValues(valueSources: unknown): boolean {
  return estimatedPaths(valueSources).length > 0;
}

/**
 * The paths this save ADDS relative to what was stored.
 *
 * Drives FR-035: introducing an estimate on a LIVE program switches it off in the same
 * transaction. Only genuinely new markers count — re-saving a program that already
 * carried one must not keep re-deactivating it, or an admin editing an unrelated field
 * on an already-reviewed program would be fighting the gate on every save.
 */
export function newlyEstimatedPaths(args: {
  before: unknown;
  after: ValueSourceMap | null | undefined;
}): string[] {
  const had = new Set(estimatedPaths(args.before));
  return estimatedPaths(args.after).filter((path) => !had.has(path));
}

/** Convenience: the income-rule subset, for a message that names the table rows. */
export function isIncomeRulePath(path: string): boolean {
  return path.startsWith('incomeAssumption.');
}

export type { IncomeAssumptionConfig };
