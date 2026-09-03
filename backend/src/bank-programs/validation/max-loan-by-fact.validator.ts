/**
 * Save-time checks on a program's maximum-loan table (`loanLimits.maxLoanByFact`).
 *
 * Shape is the DTO's question; whether the table can actually be READ is this module's.
 * Same split, and the same injected context, as `income-rule.validator.ts`: the registry
 * lookups arrive as functions so this module stays pure and the admin's what-if panel can
 * validate an unsaved draft through the identical code path a save takes.
 *
 * What is checked, and why each one is a save-time refusal rather than a runtime surprise:
 *
 *   · the fact exists                 an unknown fact matches nothing, so EVERY applicant
 *                                     falls to `onNoMatch` — a table that reads as
 *                                     configured and caps nobody.
 *   · rows match the fact's TYPE      a choice fact read with band edges, or a numeric one
 *                                     read with option codes, is the same silent nothing.
 *   · option codes are real           a mistyped code is one row that never fires, which on
 *                                     a `reject` table is a customer with no card.
 *   · bands do not gap or overlap     the half-open `[from, to)` convention the whole
 *                                     platform uses, enforced here as it is on income bands:
 *                                     a gap resolves to nothing, an overlap makes
 *                                     first-match silently decide.
 *   · the column fact is a CHOICE     a second axis keyed by a number has no branches.
 *
 * What is deliberately NOT checked: whether every option code has a row. A partial table is
 * a legitimate state — that is what `onNoMatch` is for — and the admin surfaces the gap as
 * a warning on the program screen, the same posture `validateStepFigures` takes with parent
 * keys.
 */

import { Prisma } from '@prisma/client';
import type {
  MaxLoanByFactConfig,
  MaxLoanByFactRow,
} from '../../matching/pipeline/max-loan-by-fact';
import type { MaxLoanAdjustment } from '../../matching/pipeline/max-loan-adjustments';
import { PRESENCE_FACT_LOOKUP_KEY } from '@/matching/pipeline/fact-value';
import {
  DERIVED_FACT_KEYS,
  derivedFactOptionCodes,
  isDerivedFactKey,
} from '../../matching/pipeline/surrogate-fact-registry';
import type { IncomeRuleValidationContext } from './income-rule.validator';

export const MAX_LOAN_BY_FACT_REASONS = [
  'adjustment_unknown_fact',
  'adjustment_fact_not_choice',
  'adjustment_unknown_option',
  'adjustment_share_over_100',
  'adjustment_duplicate',
  'unknown_fact',
  'unknown_column_fact',
  'column_fact_not_choice',
  'row_key_on_numeric_fact',
  'via_not_applicable',
  'band_on_choice_fact',
  'row_missing_key',
  'unknown_row_key',
  'unknown_column_key',
  'duplicate_row',
  'band_edges_inverted',
  'bands_gap',
  'bands_overlap',
] as const;

export type MaxLoanByFactReason = (typeof MAX_LOAN_BY_FACT_REASONS)[number];

export interface MaxLoanByFactViolation {
  reason: MaxLoanByFactReason;
  /** The row this is about, 0-based, when one row owns the problem. */
  index?: number;
  /** The offending key / fact, for the message. */
  detail?: string;
  /** What was allowed instead, so a rejection can name the alternatives. */
  allowed?: readonly string[];
}

function decimalOf(raw: string | null | undefined): Prisma.Decimal | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  try {
    const value = new Prisma.Decimal(raw);
    return value.isFinite() ? value : null;
  } catch {
    return null;
  }
}

/**
 * The option codes a fact may be keyed by.
 *
 * A DERIVED fact has no registry row and no question — its codes are a closed list the
 * engine owns (`bank_relationship` is `ntb` / `xsell`), so it is answered from there.
 */
async function optionCodesFor(
  factKey: string,
  questionCode: string | undefined,
  ctx: IncomeRuleValidationContext,
  factType?: string,
): Promise<readonly string[]> {
  const derived = derivedFactOptionCodes(factKey);
  if (derived !== null) return derived;
  // A TEXT-bound fact is read for PRESENCE only, so the one key it can ever be looked up by
  // is the reserved one. Checked like any other list, so a bank that typed a real option
  // code against a text question is refused at save rather than at a customer.
  if (factType === 'TEXT') return [PRESENCE_FACT_LOOKUP_KEY];
  if (questionCode === undefined) return [];
  return ctx.questionOptionCodes(questionCode);
}

/**
 * Bands, checked as one ordered run.
 *
 * Sorted by lower edge first, so an operator who typed the rows out of order gets the
 * gap/overlap answer rather than a spurious one about ordering — the table is read
 * first-match at runtime, but a correctly-covering table resolves identically whatever
 * order it is written in.
 */
function validateBands(
  rows: readonly { index: number; row: MaxLoanByFactRow }[],
): MaxLoanByFactViolation | undefined {
  const edges: Array<{ index: number; from: Prisma.Decimal; to: Prisma.Decimal | null }> = [];
  for (const { index, row } of rows) {
    const from = decimalOf(row.fromInclusive) ?? new Prisma.Decimal(0);
    const to = decimalOf(row.toExclusive);
    if (to !== null && to.lessThanOrEqualTo(from)) {
      return { reason: 'band_edges_inverted', index };
    }
    edges.push({ index, from, to });
  }
  const ordered = [...edges].sort((a, b) => a.from.comparedTo(b.from));
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (previous === undefined || current === undefined) continue;
    if (previous.to === null) {
      // An open-ended band with anything above it swallows that row entirely.
      return { reason: 'bands_overlap', index: current.index };
    }
    if (previous.to.lessThan(current.from)) return { reason: 'bands_gap', index: current.index };
    if (previous.to.greaterThan(current.from)) {
      return { reason: 'bands_overlap', index: current.index };
    }
  }
  return undefined;
}

/**
 * Can this table be read? `undefined` when it can.
 *
 * One violation, fail-fast, matching `validateIncomeRule`: the admin fixes one thing and
 * saves again, and a list of twelve consequences of one mistyped fact key helps nobody.
 */
export async function validateMaxLoanByFact(
  config: MaxLoanByFactConfig | undefined,
  ctx: IncomeRuleValidationContext,
): Promise<MaxLoanByFactViolation | undefined> {
  if (!config) return undefined;

  const registry = await ctx.surrogateFacts();
  const byKey = new Map(registry.map((f) => [f.key, f]));
  const knownKeys = [...byKey.keys(), ...registry.map((f) => f.key)];

  const isKnown = (key: string): boolean => byKey.has(key) || isDerivedFactKey(key);
  if (!isKnown(config.factKey)) {
    return { reason: 'unknown_fact', detail: config.factKey, allowed: [...new Set(knownKeys)] };
  }

  const binding = byKey.get(config.factKey);
  // A derived fact is a choice by construction — the only one today is `bank_relationship`,
  // whose codes `derivedFactOptionCodes` owns.
  const isNumericFact = binding !== undefined && binding.type === 'NUMERIC';

  // A class-keyed axis walks the answer up to the class it is filed under, so it means
  // something only where the answer IS a filed list value. On a numeric axis there is
  // nothing to walk, and on a derived fact the platform computes the answer, so there is no
  // registry row and no class. Left legal, neither fails: they match no row and land on
  // `onNoMatch` for every applicant, which reads as a bank policy nobody chose.
  if (config.rowVia === 'parentClass' && (isNumericFact || isDerivedFactKey(config.factKey))) {
    return { reason: 'via_not_applicable', detail: config.factKey };
  }
  if (
    config.columnVia === 'parentClass' &&
    config.columnFactKey !== undefined &&
    isDerivedFactKey(config.columnFactKey)
  ) {
    return { reason: 'via_not_applicable', detail: config.columnFactKey };
  }

  if (config.columnFactKey !== undefined) {
    if (!isKnown(config.columnFactKey)) {
      return {
        reason: 'unknown_column_fact',
        detail: config.columnFactKey,
        allowed: [...new Set(knownKeys)],
      };
    }
    const columnBinding = byKey.get(config.columnFactKey);
    // KEY-SHAPED, which is every type but NUMERIC: a column is matched by a key, and a
    // multi-pick or a text presence offers one (`fact-value.ts`) while a number does not.
    if (columnBinding !== undefined && columnBinding.type === 'NUMERIC') {
      return { reason: 'column_fact_not_choice', detail: config.columnFactKey };
    }
  }

  // A class-keyed axis's keys are CLASSES, and they are deliberately NOT checked here — the
  // same posture `validateStepFigures` takes with a `factParentTable`'s keys. Classes live in
  // another list that an operator moves values between, so a stale key would block the save
  // that a lookup fix elsewhere makes correct. It surfaces as a warning on the screen instead.
  const rowCodes =
    isNumericFact || config.rowVia === 'parentClass'
      ? []
      : await optionCodesFor(config.factKey, binding?.questionCode, ctx, binding?.type);
  const columnCodes =
    config.columnFactKey === undefined || config.columnVia === 'parentClass'
      ? []
      : await optionCodesFor(
          config.columnFactKey,
          byKey.get(config.columnFactKey)?.questionCode,
          ctx,
          byKey.get(config.columnFactKey)?.type,
        );

  const seen = new Set<string>();
  for (const [index, row] of config.rows.entries()) {
    const hasBand = row.fromInclusive !== undefined || row.toExclusive !== undefined;
    if (isNumericFact) {
      if (row.rowKey !== undefined) return { reason: 'row_key_on_numeric_fact', index };
      if (!hasBand) return { reason: 'row_missing_key', index };
    } else {
      if (hasBand) return { reason: 'band_on_choice_fact', index };
      if (row.rowKey === undefined) return { reason: 'row_missing_key', index };
      if (rowCodes.length > 0 && !rowCodes.includes(row.rowKey)) {
        return { reason: 'unknown_row_key', index, detail: row.rowKey, allowed: rowCodes };
      }
    }

    if (row.columnKey !== undefined) {
      if (config.columnFactKey === undefined) {
        return { reason: 'unknown_column_key', index, detail: row.columnKey };
      }
      if (columnCodes.length > 0 && !columnCodes.includes(row.columnKey)) {
        return {
          reason: 'unknown_column_key',
          index,
          detail: row.columnKey,
          allowed: columnCodes,
        };
      }
    }

    // One cell, one figure. A repeated (row, column) pair is first-match-wins at runtime,
    // which makes the second row invisible and the table look configured.
    const cell = `${row.rowKey ?? `${row.fromInclusive ?? ''}..${row.toExclusive ?? ''}`}|${row.columnKey ?? '_'}`;
    if (seen.has(cell)) return { reason: 'duplicate_row', index, detail: cell };
    seen.add(cell);
  }

  if (isNumericFact) {
    // Per column: two columns each state their own run of bands, and a gap in one is not a
    // gap in the other.
    // Indices stay the ORIGINAL row numbers, so an error names the row the operator is
    // looking at rather than its position inside a filtered subset.
    const indexed = config.rows.map((row, index) => ({ index, row }));
    const columns = new Set(config.rows.map((r) => r.columnKey ?? '_'));
    for (const column of columns) {
      const violation = validateBands(indexed.filter((r) => (r.row.columnKey ?? '_') === column));
      if (violation) return violation;
    }
  }

  return undefined;
}

/**
 * Save-time checks on the adjustments that act on the cap.
 *
 * Same posture as the table above: shape is the DTO's question, readability is this
 * module's. Four things, each one a silent nothing at runtime otherwise:
 *
 *   · the fact exists and is a CHOICE   an adjustment gated on a number has no answer to
 *                                       compare, so it would never apply.
 *   · the option code is real           a mistyped code is an adjustment that never fires,
 *                                       which reads on screen as configured.
 *   · a share is at most 100%           "accepted at 150% of the loan amount" is not a share
 *                                       and is almost certainly a mistyped uplift.
 *   · no two adjustments repeat         the same (kind, fact, option) twice compounds the
 *                                       percentage, which no sheet ever means.
 */
export async function validateMaxLoanAdjustments(
  adjustments: readonly MaxLoanAdjustment[] | undefined,
  ctx: IncomeRuleValidationContext,
): Promise<MaxLoanByFactViolation | undefined> {
  if (!adjustments || adjustments.length === 0) return undefined;

  const registry = await ctx.surrogateFacts();
  const byKey = new Map(registry.map((f) => [f.key, f]));
  const knownKeys = [...new Set([...byKey.keys(), ...DERIVED_FACT_KEYS])];

  const seen = new Set<string>();
  for (const [index, adjustment] of adjustments.entries()) {
    const binding = byKey.get(adjustment.whenFactKey);
    const derived = isDerivedFactKey(adjustment.whenFactKey);
    if (binding === undefined && !derived) {
      return {
        reason: 'adjustment_unknown_fact',
        index,
        detail: adjustment.whenFactKey,
        allowed: knownKeys,
      };
    }
    if (binding !== undefined && binding.type === 'NUMERIC') {
      return { reason: 'adjustment_fact_not_choice', index, detail: adjustment.whenFactKey };
    }

    const codes = await optionCodesFor(
      adjustment.whenFactKey,
      binding?.questionCode,
      ctx,
      binding?.type,
    );
    if (codes.length > 0 && !codes.includes(adjustment.whenOptionCode)) {
      return {
        reason: 'adjustment_unknown_option',
        index,
        detail: adjustment.whenOptionCode,
        allowed: codes,
      };
    }

    if (adjustment.kind === 'sharePercent') {
      const percent = decimalOf(adjustment.percent);
      if (percent === null || percent.greaterThan(100)) {
        return { reason: 'adjustment_share_over_100', index, detail: adjustment.percent };
      }
    }

    const signature = `${adjustment.kind}|${adjustment.whenFactKey}|${adjustment.whenOptionCode}`;
    if (seen.has(signature)) {
      return { reason: 'adjustment_duplicate', index, detail: signature };
    }
    seen.add(signature);
  }

  return undefined;
}
