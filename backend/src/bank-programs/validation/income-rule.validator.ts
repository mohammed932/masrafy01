import { Prisma } from '@prisma/client';
import {
  BAND_STRATEGIES,
  KEY_TABLE_REGISTRY,
  KEY_TABLE_STRATEGIES,
  SCALAR_STRATEGIES,
  type IncomeAssumptionConfig,
  type IncomeAssumptionStrategy,
} from '@/matching/types';
import { legacyScalarKeysFor } from '@/matching/pipeline/income-rule-normalize';
import type { IncomeRuleBandsInvalidReason } from '@/common/errors/domain.exceptions';

/**
 * Feature 011 — income-rule validation (FR-006 … FR-012).
 *
 * Placed beside `dbr-bands.validator.ts` and shaped like it: a pure function
 * returning the FIRST violation as a discriminated union, so the service maps each
 * kind to its typed exception and the validator itself imports no Nest and throws
 * nothing. That is what lets the admin rule-CHECK endpoint (US3) validate a draft
 * with the same code path the save uses, without a transaction or a request.
 *
 * Every violation names the offending ROW — an index for a band, the key for a key
 * table. A bank's grade table runs 10–15 rows, and "the table is invalid" makes the
 * admin re-read all of them.
 *
 * Registry membership is resolved through an injected lookup rather than a repo
 * import, for the same reason `cross-config.validators.ts` takes a
 * `ValidationContext`: the validator stays pure and unit-testable, and the service
 * decides where "active member" comes from.
 */

export type IncomeRuleViolation =
  | { kind: 'empty'; strategy: IncomeAssumptionStrategy }
  | { kind: 'incomeInvalid'; index?: number; key?: string; incomeEGP: string }
  | { kind: 'duplicateKey'; key: string }
  | { kind: 'unknownKey'; key: string; registry: string; activeKeys: string[] }
  | { kind: 'bandsInvalid'; index: number | null; reason: IncomeRuleBandsInvalidReason }
  | { kind: 'dbrOverrideInvalid'; value: string };

/** Non-blocking findings. Reported in `data.warnings`, never a rejection. */
export type IncomeRuleWarning =
  | {
      kind: 'ruleIgnoredForProgramType';
      programType: string;
      productCategory: string;
      strategy: IncomeAssumptionStrategy;
    }
  | { kind: 'requiredDocumentsMissing'; missing: string[] };

export interface IncomeRuleValidationContext {
  /** Whether `key` is an ACTIVE member of `enumerationType`. */
  isActiveMember(enumerationType: string, key: string): Promise<boolean>;
  /** The active members of `enumerationType`, for the rejection's `meta`. */
  activeMembers(enumerationType: string): Promise<readonly string[]>;
}

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

const KEY_STRATEGY_SET = new Set<string>(KEY_TABLE_STRATEGIES);
const BAND_STRATEGY_SET = new Set<string>(BAND_STRATEGIES);
const SCALAR_STRATEGY_SET = new Set<string>(SCALAR_STRATEGIES);

/**
 * `byCDValue` and `byTotalDeposits` are in BAND_STRATEGIES but legally configured
 * either way — bands where an admin authored them, else the legacy percent scalar
 * whose output must not move (FR-015). So "no bands" is only `INCOME_RULE_EMPTY`
 * for the two YEARS methods, which have no scalar form.
 */
const BANDS_REQUIRED_STRATEGIES = new Set<string>(['byYearsInJob', 'byYearsInPractice']);

function toDecimalOrNull(value: string | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Prisma.Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Validate the canonical rule. Returns the first violation, or `undefined`.
 *
 * Only the SELECTED method's configuration is validated: configuration belonging
 * to another method is stripped before persistence (FR-011), so rejecting on it
 * would refuse a save the server is about to discard anyway.
 */
export async function validateIncomeRule(
  config: IncomeAssumptionConfig | null | undefined,
  ctx: IncomeRuleValidationContext,
): Promise<IncomeRuleViolation | undefined> {
  if (!config) return undefined;
  const strategy = config.strategy;

  // Checked before the method's own shape: an out-of-range override is a policy
  // error independent of which table is configured, and reporting the table first
  // would send the admin to the wrong control.
  const overrideViolation = validateDbrOverride(config.dbrCapPercentOverride);
  if (overrideViolation) return overrideViolation;

  if (KEY_STRATEGY_SET.has(strategy)) {
    return validateKeyTable(config, strategy, ctx);
  }
  if (BAND_STRATEGY_SET.has(strategy)) {
    return validateBands(config, strategy);
  }
  if (SCALAR_STRATEGY_SET.has(strategy)) {
    return validateScalar(config, strategy);
  }
  // `declared` carries no configuration and nothing to check.
  return undefined;
}

function validateDbrOverride(raw: string | undefined): IncomeRuleViolation | undefined {
  if (raw === undefined) return undefined;
  const value = toDecimalOrNull(raw);
  // (0, 100]: zero would cap every applicant at no affordability at all, which is
  // never a policy anyone means to express, and 100 is the legal ceiling.
  if (value === null || value.lessThanOrEqualTo(ZERO) || value.greaterThan(HUNDRED)) {
    return { kind: 'dbrOverrideInvalid', value: raw };
  }
  return undefined;
}

async function validateKeyTable(
  config: IncomeAssumptionConfig,
  strategy: IncomeAssumptionStrategy,
  ctx: IncomeRuleValidationContext,
): Promise<IncomeRuleViolation | undefined> {
  const table = config.keyTable;
  if (!table || table.length === 0) return { kind: 'empty', strategy };

  const registry = KEY_TABLE_REGISTRY[strategy as (typeof KEY_TABLE_STRATEGIES)[number]];
  const seen = new Set<string>();

  for (const row of table) {
    if (seen.has(row.key)) return { kind: 'duplicateKey', key: row.key };
    seen.add(row.key);

    const income = toDecimalOrNull(row.incomeEGP);
    if (income === null || income.lessThanOrEqualTo(ZERO)) {
      return { kind: 'incomeInvalid', key: row.key, incomeEGP: row.incomeEGP };
    }

    // Fails CLOSED (AS-1.9). The engine looks up by key, so a dead key resolves to
    // nothing for every applicant, forever, with nothing on screen to say so.
    if (!(await ctx.isActiveMember(registry, row.key))) {
      const activeKeys = await ctx.activeMembers(registry);
      return { kind: 'unknownKey', key: row.key, registry, activeKeys: [...activeKeys] };
    }
  }

  return undefined;
}

function validateBands(
  config: IncomeAssumptionConfig,
  strategy: IncomeAssumptionStrategy,
): IncomeRuleViolation | undefined {
  const bands = config.bands;
  if (!bands || bands.length === 0) {
    if (BANDS_REQUIRED_STRATEGIES.has(strategy)) return { kind: 'empty', strategy };
    // A value method may legitimately carry the legacy percent scalar INSTEAD of a
    // band table — but only if it actually carries one. The escape hatch used to be
    // unconditional, so a brand-new `byCDValue` program with no bands and no percent
    // saved clean and the resolver then priced every applicant on its hardcoded
    // `?? '3'` — a figure no admin authored, which is the substituted default FR-020
    // exists to forbid. Nothing configured is `INCOME_RULE_EMPTY`, same as any other
    // method with nothing configured.
    return validateScalar(config, strategy, { optional: hasLegacyScalar(config) });
  }

  let previousTo: Prisma.Decimal | null = null;

  for (const [index, band] of bands.entries()) {
    const from = toDecimalOrNull(band.fromInclusive);
    if (from === null) return { kind: 'bandsInvalid', index, reason: 'edge_not_decimal' };

    const income = toDecimalOrNull(band.incomeEGP);
    if (income === null || income.lessThanOrEqualTo(ZERO)) {
      return { kind: 'incomeInvalid', index, incomeEGP: band.incomeEGP };
    }

    const isLast = index === bands.length - 1;
    const to =
      band.toExclusive === null || band.toExclusive === undefined
        ? null
        : toDecimalOrNull(band.toExclusive);

    if (band.toExclusive !== null && band.toExclusive !== undefined && to === null) {
      return { kind: 'bandsInvalid', index, reason: 'edge_not_decimal' };
    }

    // Only the LAST band may be open-ended: a bounded band after an open one can
    // never be reached, and the open one would swallow its range silently.
    if (to === null && !isLast) {
      return { kind: 'bandsInvalid', index, reason: 'open_band_not_last' };
    }
    // A CLOSED last band is legal. It says "above this, the rule yields nothing",
    // which `bandFor` reports as `no_matching_band` — a stated reason, not a zero.
    // Demanding an open top band made every legacy years table unsaveable: the read
    // path closes them at `maxYears + 1` precisely because opening them would start
    // handing an income to applicants who resolve to nothing today (FR-015), so the
    // admin had no edit that satisfied both rules.

    // An empty or inverted band covers nothing, so every value in it falls through
    // to a later band the admin did not intend.
    if (to !== null && to.lessThanOrEqualTo(from)) {
      return { kind: 'bandsInvalid', index, reason: 'unordered' };
    }

    if (previousTo !== null) {
      // Gapless BETWEEN the edges: a band must start exactly where the previous one
      // ended. Anything less is a gap (values resolve to nothing), anything more is
      // an overlap (two rows claim the same value, and first-match silently wins).
      if (from.greaterThan(previousTo)) {
        return { kind: 'bandsInvalid', index, reason: 'gap' };
      }
      if (from.lessThan(previousTo)) {
        return { kind: 'bandsInvalid', index, reason: 'overlap' };
      }
    }
    previousTo = to;
  }

  return undefined;
}

/** Does this blob still carry the strategy's own pre-canonical percentage? */
function hasLegacyScalar(config: IncomeAssumptionConfig): boolean {
  return legacyScalarKeysFor(config.strategy).some((key) => {
    const raw = config[key];
    return typeof raw === 'string' && raw.trim() !== '';
  });
}

function validateScalar(
  config: IncomeAssumptionConfig,
  strategy: IncomeAssumptionStrategy,
  opts: { optional?: boolean } = {},
): IncomeRuleViolation | undefined {
  const scalar = config.scalar;
  if (!scalar) {
    // Optional for the two value methods, which may carry the legacy percent
    // instead; and a legacy scalar reaching the validator has already been
    // normalized into `scalar` by the read path, so its absence here means the
    // admin genuinely configured nothing.
    if (opts.optional) return undefined;
    return { kind: 'empty', strategy };
  }
  const value = toDecimalOrNull(scalar.value);
  if (value === null || value.lessThanOrEqualTo(ZERO)) {
    // Reported as an income problem rather than a band problem: the number IS the
    // rule for a scalar method, and the admin sees one field.
    return { kind: 'incomeInvalid', incomeEGP: scalar.value };
  }
  return undefined;
}

/**
 * Non-blocking findings (FR-001 edge case, FR-013).
 *
 * **A rule on a program whose type hides it is IGNORED and REPORTED, never
 * deleted.** Three seeded programs carry a table while typed `income_proof`
 * (`abk-egypt-2026.ts` against `catalogs/base.ts`), so a strip-on-save rule would
 * have destroyed those tables the first time an admin pressed Save on an unrelated
 * field. The correct fix for a mis-typed program is to change its type, not to
 * lose its configuration — so the warning names the type, and the data stands.
 */
export function collectIncomeRuleWarnings(args: {
  config: IncomeAssumptionConfig | null | undefined;
  programType: string;
  productCategory: string;
  /** The program's own document list, which the method's demands are checked against. */
  programRequiredDocuments: readonly string[];
}): IncomeRuleWarning[] {
  const { config, programType, productCategory, programRequiredDocuments } = args;
  if (!config) return [];
  const warnings: IncomeRuleWarning[] = [];

  const configured = hasMethodConfiguration(config);
  // `programType` ALONE, matching the engine's own gate
  // (`quote.ts#shouldConsultIncomeRule`). This warning answers one question — "is the
  // table I just typed ever read?" — and the type is the whole answer.
  //
  // v15.1.0 also narrowed on a hardcoded surrogate-CAPABLE category list, which made
  // this report a rule as ignored on a category outside that list even though the engine
  // WOULD price off it — a warning that contradicted the runtime. v16.0.0 dropped the
  // list (capability is derived from which categories ask the facts, and is configurable),
  // so the term goes with it. `meta.productCategory` is still reported, because "a grade
  // table on a mortgage" is context the admin wants even when the type is correct.
  const ruleIsRead = programType === 'income_surrogate';
  if (configured && !ruleIsRead) {
    warnings.push({
      kind: 'ruleIgnoredForProgramType',
      programType,
      productCategory,
      strategy: config.strategy,
    });
  }

  // FR-013 — the method declares the documents it demands; the admin sees a
  // non-blocking warning when the program's own list lacks them. Non-blocking on
  // purpose: the document list and the income rule are edited on different screens,
  // and refusing the save would make the second edit impossible until the first.
  const demanded = config.requiredDocuments ?? [];
  if (demanded.length > 0) {
    const have = new Set(programRequiredDocuments);
    const missing = demanded.filter((doc) => !have.has(doc));
    if (missing.length > 0) warnings.push({ kind: 'requiredDocumentsMissing', missing });
  }

  return warnings;
}

/** Whether the rule carries any method configuration at all. */
function hasMethodConfiguration(config: IncomeAssumptionConfig): boolean {
  return Boolean(
    config.keyTable?.length ||
      config.bands?.length ||
      config.scalar ||
      // Legacy shapes count: a mis-typed program carrying one is exactly the case
      // the "ignored, never deleted" rule exists for.
      config.rankIncomeMap ||
      config.gradeIncomeMap ||
      config.incomeTable?.length ||
      // A legacy SCALAR is configuration too. Omitting it let a blob whose only rule
      // was `cdIncomePercent` read as "nothing configured", so the strip returned a
      // bare `{ strategy }` and the bank's percentage was gone.
      legacyScalarKeysFor(config.strategy).some((key) => {
        const raw = config[key];
        return typeof raw === 'string' && raw.trim() !== '';
      }),
  );
}

/**
 * Drop configuration belonging to a method other than the selected one (FR-011).
 *
 * The admin is warned client-side BEFORE the switch clears the old table, so this
 * is the server making the persisted blob honest rather than a surprise: a stored
 * `keyTable` under `strategy: 'byYearsInPractice'` would be invisible in the form
 * and unread by the engine, and would resurface the day someone switched the method
 * back.
 *
 * Legacy fields are dropped alongside, but ONLY when the save carries a canonical
 * shape for the selected method — otherwise a program whose rule has not been
 * re-saved through the new form yet would lose its table to an unrelated edit,
 * which is precisely the FR-001 edge case.
 */
export function stripForeignMethodConfig(
  config: IncomeAssumptionConfig | null | undefined,
): IncomeAssumptionConfig | null | undefined {
  if (!config) return config;
  const strategy = config.strategy;

  const keep: IncomeAssumptionConfig = {
    strategy,
    ...(config.dbrCapPercentOverride !== undefined
      ? { dbrCapPercentOverride: config.dbrCapPercentOverride }
      : {}),
    ...(config.requiredDocuments !== undefined
      ? { requiredDocuments: config.requiredDocuments }
      : {}),
    ...(config.combinationRule !== undefined ? { combinationRule: config.combinationRule } : {}),
  };

  if (KEY_STRATEGY_SET.has(strategy) && config.keyTable) {
    keep.keyTable = config.keyTable;
  } else if (BAND_STRATEGY_SET.has(strategy) && config.bands) {
    keep.bands = config.bands;
  }

  // The two value methods keep a scalar alongside bands as their legacy form.
  //
  // `!keep.bands?.length`, NOT `!keep.bands`: the admin form always emits `bands` for
  // a band shape, so a legacy `byCDValue` program with no bands authored posts
  // `bands: []` — which is truthy. Testing the reference dropped the configured
  // percentage on every unrelated save and handed the program to the resolver's
  // hardcoded default (3% instead of the bank's own figure), silently re-quoting
  // every applicant on it.
  if (SCALAR_STRATEGY_SET.has(strategy) || (BAND_STRATEGY_SET.has(strategy) && !keep.bands?.length)) {
    if (config.scalar) keep.scalar = config.scalar;
    // The strategy's OWN legacy key travels with it — never another method's, which
    // is what `legacyScalarKeysFor` exists to bound. Dropping it here was the second
    // half of the same defect: a blob carrying only `cdIncomePercent` lost its
    // percentage entirely and fell back to the resolver's default.
    for (const legacyKey of legacyScalarKeysFor(strategy)) {
      const raw = config[legacyKey];
      if (typeof raw === 'string' && raw.trim() !== '') {
        (keep as unknown as Record<string, unknown>)[legacyKey] = raw;
      }
    }
  }

  // Nothing canonical for this method: carry the whole blob through untouched
  // rather than emit a rule with no configuration. This is the mis-typed-seed case
  // — the data survives, `collectIncomeRuleWarnings` reports it, and the engine
  // reads it through the normalizer.
  const gotCanonical = Boolean(keep.keyTable || keep.bands || keep.scalar);
  if (!gotCanonical && hasMethodConfiguration(config)) return config;

  return keep;
}
