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
import type { BlueprintCap } from '../blueprints/product-blueprint.types';
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
  'cap_fact_not_product',
  'cap_row_not_declared',
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

// --- the product's declared grid -------------------------------------------

/**
 * The cells a product's blueprint declares, as two sets.
 *
 * A row is named by its option code, or — on a banded cap — by its edges in the same
 * `from..to` spelling the duplicate-cell check above uses, so one table cannot be read two
 * ways depending on which check is looking at it. A cap with no `columnKeys` has ONE
 * implicit column, and every stored row belongs to it.
 */
function declaredOf(shape: BlueprintCap): { rows: Set<string>; columns: Set<string> } {
  const rows =
    shape.rowKeys ??
    (shape.bands ?? []).map((band) => bandId(band.fromInclusive, band.toExclusive));
  return { rows: new Set(rows), columns: new Set(shape.columnKeys ?? []) };
}

function bandId(fromInclusive: string | undefined, toExclusive: string | null | undefined): string {
  return `${fromInclusive ?? ''}..${toExclusive ?? ''}`;
}

/** How a stored row names its own cell — the option code, or the band's edges. */
function rowIdOf(row: MaxLoanByFactRow): string {
  return row.rowKey ?? bandId(row.fromInclusive, row.toExclusive);
}

/** `row|column`, or just the row when the cap declares no second axis. */
function cellId(rowId: string, columnKey: string | undefined): string {
  return columnKey === undefined ? rowId : `${rowId}|${columnKey}`;
}

/**
 * Do this program's AXES agree with the product's?
 *
 * The axes are the product's to state and the amounts are the bank's — that is the whole of
 * the product-driven cap. A program keyed by a different fact, or reading the answer where
 * the product reads the class it is filed under, is not a variant of the product's grid: it
 * is a second grid wearing the same product's name, and every figure typed into it is filed
 * under keys the product screen cannot show.
 *
 * `onNoMatch` IS NOT COMPARED, deliberately. `ABK-PER-DOCTORS_CLINIC` stores `reject` where
 * its blueprint declares `useProgramMax` (`demo-figures/sheet-programs.ts`), because that
 * programme's city question is required and an application arriving on an older snapshot
 * with no answer must be refused rather than quoted the best cell in the table — 2,000,000,
 * frozen onto an immutable offer (Principle I / A6). What happens to an applicant with no
 * row is the BANK's decision about its own money; the blueprint's value is the seeded
 * starting point, never a constraint.
 *
 * `detail` names the AXIS that disagrees (`factKey` · `columnFactKey` · `rowVia` ·
 * `columnVia`) and `allowed` carries what the product declares for it, so the message can
 * say both halves. An absent declaration is an empty `allowed`, never a fabricated token.
 */
export function validateCapAgainstProduct(
  config: MaxLoanByFactConfig | undefined,
  shape: BlueprintCap | undefined,
): MaxLoanByFactViolation | undefined {
  if (config === undefined || shape === undefined) return undefined;
  const axes: ReadonlyArray<{ axis: string; stored?: string; declared?: string }> = [
    { axis: 'factKey', stored: config.factKey, declared: shape.factKey },
    { axis: 'columnFactKey', stored: config.columnFactKey, declared: shape.columnFactKey },
    // Normalised on both sides: `answer` is the default and what every stored table means,
    // so an omitted `rowVia` and an explicit `'answer'` are the same axis and must not read
    // as a disagreement.
    { axis: 'rowVia', stored: config.rowVia ?? 'answer', declared: shape.rowVia ?? 'answer' },
    {
      axis: 'columnVia',
      stored: config.columnVia ?? 'answer',
      declared: shape.columnVia ?? 'answer',
    },
  ];
  for (const { axis, stored, declared } of axes) {
    if (stored === declared) continue;
    return {
      reason: 'cap_fact_not_product',
      detail: axis,
      allowed: declared === undefined ? [] : [declared],
    };
  }
  return undefined;
}

/**
 * A stored row that keys nothing the product declares — the first one, fail-fast like the
 * rest of this module.
 *
 * WARN-ONLY ON A BANK PROGRAM, and that is not squeamishness. The grid is code: editing a
 * blueprint can drop a row key from under a program that has been quoting off it for
 * months, and refusing the save would leave that program unopenable — the operator could
 * not even change a fee on it, let alone fix the row. The engine already answers the
 * undeclared row honestly (it matches an answer nobody can give, so the applicant lands on
 * `onNoMatch`), so nothing is quoted wrongly by leaving it stored.
 *
 * On the PRODUCT's own default amounts it IS a refusal, and the difference is who is
 * typing: those rows are typed against the grid that is on screen at that moment, so a key
 * outside it is a mistake being made now rather than one inherited from a code change.
 */
export function validateCapRowsAgainstProduct(
  config: MaxLoanByFactConfig | undefined,
  shape: BlueprintCap | undefined,
): MaxLoanByFactViolation | undefined {
  if (config === undefined || shape === undefined) return undefined;
  const declared = declaredOf(shape);
  for (const [index, row] of config.rows.entries()) {
    const rowId = rowIdOf(row);
    const rowUnknown = declared.rows.size > 0 && !declared.rows.has(rowId);
    const columnUnknown =
      row.columnKey !== undefined &&
      declared.columns.size > 0 &&
      !declared.columns.has(row.columnKey);
    if (!rowUnknown && !columnUnknown) continue;
    return {
      reason: 'cap_row_not_declared',
      index,
      detail: cellId(rowId, row.columnKey),
      allowed: [...declared.rows],
    };
  }
  return undefined;
}

/** How a stored cap table lines up with the grid the product declares. */
export interface CapGridDiff {
  /** Declared cells with no figure — `rowKey` or `rowKey|columnKey`. */
  missing: string[];
  /** Stored cells keying nothing declared. The other half of the same misalignment. */
  undeclared: string[];
  /** Declared cells that DO carry a figure, and how many there are in all. */
  have: number;
  expected: number;
}

/**
 * The two halves of "does this bank's table cover the product's grid?".
 *
 * A row that states no `columnKey` applies to EVERY column (`resolveMaxLoanByFact`'s second
 * pass), so it covers the whole row — which is exactly how a bank states one figure against
 * both new-loan and top-up without typing it twice, and counting it once per column would
 * report five sixths of a complete table as a gap.
 *
 * A cell whose figure is unreadable or non-positive counts as MISSING, because that is how
 * the engine reads it: the resolver skips such a row and falls through to `onNoMatch`.
 */
export function capGridDiff(config: MaxLoanByFactConfig, shape: BlueprintCap): CapGridDiff {
  const declared = declaredOf(shape);
  const columns = declared.columns.size > 0 ? [...declared.columns] : [undefined];

  const filled = new Set<string>();
  const undeclared: string[] = [];
  for (const row of config.rows) {
    const rowId = rowIdOf(row);
    const amount = decimalOf(row.maxAmountEGP);
    const priced = amount !== null && amount.greaterThan(0);
    const rowUnknown = declared.rows.size > 0 && !declared.rows.has(rowId);
    const columnUnknown =
      row.columnKey !== undefined &&
      declared.columns.size > 0 &&
      !declared.columns.has(row.columnKey);
    if (rowUnknown || columnUnknown) {
      undeclared.push(cellId(rowId, row.columnKey));
      continue;
    }
    if (!priced) continue;
    for (const column of columns) {
      // The row's own column when it names one; every column when it does not.
      if (row.columnKey !== undefined && row.columnKey !== column) continue;
      filled.add(cellId(rowId, column));
    }
  }

  const missing: string[] = [];
  for (const rowId of declared.rows) {
    for (const column of columns) {
      const id = cellId(rowId, column);
      if (!filled.has(id)) missing.push(id);
    }
  }
  const expected = declared.rows.size * columns.length;
  return { missing, undeclared, have: expected - missing.length, expected };
}
