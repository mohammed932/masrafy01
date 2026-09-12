/**
 * An N-AXIS TABLE keyed by answers the applicant gave, producing one figure.
 *
 * Pure module: no Nest, no Prisma, no clock, no randomness (Constitution Principle V).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Every bank's auto-finance card prices on more than one thing at once. ADIB's used-car
 * card is a grid: down payment down the side, tenor band across the top, and two columns in
 * every cell for "with insurance" and "without". Its vehicle-age card is another: model year
 * against country of origin against the down payment the origin demands. The platform could
 * express neither, because the pricing cascade resolves ONE dimension and returns
 * (`cascade.evaluator.ts`), so filling two levels gets you the first one and nothing else.
 *
 * ─── Why it is a generalisation and not a new idea ────────────────────────────
 *
 * `max-loan-by-fact.ts` is already this table at exactly two axes, and it has been quoting
 * real money for versions. Everything load-bearing about it is kept verbatim here — the
 * half-open `[fromInclusive, toExclusive)` bands, the `parentClass` walk, first-match-wins
 * in declared order, more-specific-before-less-specific, a figure that is unreadable or
 * non-positive SKIPPED rather than read as zero, and an `onNoMatch` the bank must state.
 *
 * The two shared predicates (`keyMatchesAnswer`, `viaClass`) live HERE and are imported back
 * by `max-loan-by-fact.ts`, so there is one of each. A second copy is how a cap table and a
 * rate grid come to disagree about what a multi-pick answer matches — silently, on one
 * customer, in money.
 *
 * ─── Why the axes are FACTS and not named fields ──────────────────────────────
 *
 * A shape naming its axes (`downPaymentRows`, `tenorColumns`, `insuranceColumns`) reads
 * better on the one card it was drawn from and needs a code change for the next one — and
 * the next one is already here, because ADIB keys some rows on the country the car was
 * built in. A fact key is the one axis vocabulary the platform already has, so a bank can
 * state a grid over anything its applicants are asked (Principle II / A1). The readable
 * headers are the admin editor's job, not the storage format's.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { SurrogateFactValue } from '../types';
import { factAnswerHasKey, factLookupKeys } from './fact-value';

/**
 * What happens to an applicant no cell matches.
 *
 * Never inferred, for the reason `MAX_LOAN_NO_MATCH_ACTIONS` gives: both silent readings are
 * wrong in a direction that only shows up on a real customer. `useFallback` hands the
 * decision back to whatever the caller would have done without a grid — for a rate, the rest
 * of the pricing cascade. `reject` is a stated refusal.
 *
 * A `—` printed on a bank's card is a refusal, not an invitation to guess, which is why
 * `reject` has to be available on a RATE grid and not only on a cap.
 */
export const FACT_GRID_NO_MATCH_ACTIONS = ['useFallback', 'reject'] as const;
export type FactGridNoMatchAction = (typeof FACT_GRID_NO_MATCH_ACTIONS)[number];

/** One axis of the grid: the fact it reads, and whether it reads the answer or its class. */
export interface FactGridAxis {
  factKey: string;
  /**
   * `answer` (the default) keys on the option code itself; `parentClass` keys on the class
   * the answer is filed under — 27 governorates under three city tiers, hundreds of
   * compounds under six classes. See `MaxLoanByFactConfig.rowVia`, which this mirrors.
   */
  via?: 'answer' | 'parentClass';
}

/**
 * What one cell states on one axis.
 *
 * `null` is an EXPLICIT wildcard: "this cell applies whatever the answer on this axis". An
 * object stating neither a `key` nor a band edge is a half-typed cell and matches NOTHING —
 * the two are different on purpose, because `max-loan-by-fact.ts` cannot tell them apart and
 * has to treat the empty one as a non-match to avoid pricing every applicant at whatever
 * figure sat beside it. Here the operator can say which they meant.
 */
export type FactGridKey =
  | { key: string }
  | { fromInclusive?: string; toExclusive?: string | null }
  | null;

/** One cell: its key per axis, positionally, and the figure it yields. */
export interface FactGridCell {
  keys: FactGridKey[];
  /** Decimal string. Arrives from JSONB as a string — never a float (Principle I). */
  value: string;
}

export interface FactGridConfig {
  axes: FactGridAxis[];
  cells: FactGridCell[];
  onNoMatch: FactGridNoMatchAction;
}

export type FactGridResolution =
  | {
      matched: true;
      value: Decimal;
      cellIndex: number;
      /** Per axis, the key that matched — frozen onto the offer so the cell is re-readable. */
      keys: Readonly<Record<string, string>>;
    }
  | {
      matched: false;
      action: FactGridNoMatchAction;
      /**
       * `fact_not_answered` means at least one axis was never asked or was skipped, and it
       * is reported even when the bank chose `useFallback`: "we did not ask you" and "your
       * answer is not in my table" are two different admin actions, and collapsing them is
       * the defect `quote.ts` still carries on the cap side.
       */
      reason: 'fact_not_answered' | 'no_matching_row';
      /** The axes with no answer, so a client can say which questions to go back and answer. */
      missingFactKeys: readonly string[];
    };

export function toGridDecimal(raw: string | null | undefined): Decimal | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  try {
    const value = new Decimal(raw);
    return value.isFinite() ? value : null;
  } catch {
    return null;
  }
}

/**
 * Does this cell's key match the answer on that axis?
 *
 * Shared with `max-loan-by-fact.ts`, whose rows adapt into a `FactGridKey`. The cross-kind
 * cases are deliberate and are what the cap table has always done: a key-shaped cell never
 * matches a numeric answer, and a band never matches a choice. Both are a mis-keyed table
 * rather than a near miss, and answering "no" sends them to `onNoMatch`, where the bank has
 * already said what should happen.
 */
export function keyMatchesAnswer(key: FactGridKey, answer: SurrogateFactValue): boolean {
  if (key === null) return true;
  if ('key' in key) {
    // One key, several (a multi-pick), or the presence of a text answer — all decided by
    // `factAnswerHasKey`, so every table on the platform reads a multi-pick the same way.
    return answer.kind !== 'numeric' && factAnswerHasKey(answer, key.key);
  }
  if (answer.kind !== 'numeric') return false;
  const from = toGridDecimal(key.fromInclusive);
  const to = toGridDecimal(key.toExclusive);
  // Neither edge stated — a half-typed cell. Matches nothing; see `FactGridKey`.
  if (from === null && to === null) return false;
  if (from !== null && answer.value.lessThan(from)) return false;
  if (to !== null && answer.value.greaterThanOrEqualTo(to)) return false;
  return true;
}

/**
 * One answer as an axis reads it: itself, or the class it is filed under.
 *
 * `undefined` out means "this axis cannot be read for this applicant" — either there was no
 * answer, or there was one and it is filed under nothing.
 *
 * Shared with `max-loan-by-fact.ts` verbatim, including the multi-pick rule: the FIRST key
 * that is filed under a class is the class read, in the order `factLookupKeys` states, so an
 * applicant whose second pick is unfiled is still priced.
 */
export function viaClass(
  answer: SurrogateFactValue | undefined,
  via: 'answer' | 'parentClass' | undefined,
  parentKeyByValue: Readonly<Record<string, string>> | undefined,
): SurrogateFactValue | undefined {
  if (answer === undefined) return undefined;
  if (via !== 'parentClass') return answer;
  for (const key of factLookupKeys(answer)) {
    const parentKey = parentKeyByValue?.[key];
    if (parentKey !== undefined) return { kind: 'choice', optionCode: parentKey };
  }
  return undefined;
}

/**
 * How specific a cell is: a bitmask over the axes it actually names, axis 0 most significant.
 *
 * Cells are tried most-specific first, so a bank can state one figure across a whole axis and
 * then override a single combination of it without deleting the shared cell. At two axes with
 * the row always named, this is byte-identically `resolveMaxLoanByFact`'s two passes
 * (column-specific, then column-agnostic), which is what makes the delegation below a
 * refactor rather than a rewrite.
 *
 * Axis 0 ranks highest so the order is total and stated rather than incidental: the earlier
 * axes are the ones an operator laid the table out by.
 */
function specificity(cell: FactGridCell, axisCount: number): number {
  let rank = 0;
  for (let i = 0; i < axisCount; i += 1) {
    if (cell.keys[i] !== null && cell.keys[i] !== undefined) rank += 1 << (axisCount - 1 - i);
  }
  return rank;
}

export function resolveFactGrid(args: {
  config: FactGridConfig;
  facts: Readonly<Record<string, SurrogateFactValue>>;
  /** The class each list value is filed under. Only read when an axis says `parentClass`. */
  parentKeyByValue?: Readonly<Record<string, string>>;
}): FactGridResolution {
  const { config, facts, parentKeyByValue } = args;
  const axisCount = config.axes.length;

  // Resolve every axis once. An axis with no answer stays `undefined` and only a wildcard
  // cell can match on it — which is how a bank that priced a whole row regardless of, say,
  // insurance still quotes an applicant who was never asked about insurance.
  const resolved: Array<SurrogateFactValue | undefined> = [];
  const missingFactKeys: string[] = [];
  for (const axis of config.axes) {
    const answer = viaClass(facts[axis.factKey], axis.via, parentKeyByValue);
    resolved.push(answer);
    if (answer === undefined) missingFactKeys.push(axis.factKey);
  }

  const ordered = config.cells
    .map((cell, index) => ({ cell, index, rank: specificity(cell, axisCount) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index);

  for (const { cell, index } of ordered) {
    let hit = true;
    for (let i = 0; i < axisCount; i += 1) {
      const key = cell.keys[i] ?? null;
      if (key === null) continue;
      const answer = resolved[i];
      // A named key on an axis the applicant did not answer cannot match. Never treated as
      // a wildcard: that would price them off a row stated for somebody else.
      if (answer === undefined || !keyMatchesAnswer(key, answer)) {
        hit = false;
        break;
      }
    }
    if (!hit) continue;

    const value = toGridDecimal(cell.value);
    // Unreadable or non-positive is NOT CONFIGURED rather than a figure of zero — a zero
    // rate is not a price and a zero-month ceiling is not a term. Same posture as the cap
    // table, and it means a half-filled grid falls to `onNoMatch` where the bank has said
    // what to do.
    if (value === null || value.lessThanOrEqualTo(0)) continue;

    const keys: Record<string, string> = {};
    for (let i = 0; i < axisCount; i += 1) {
      const axis = config.axes[i];
      const answer = resolved[i];
      if (axis === undefined || answer === undefined) continue;
      keys[axis.factKey] =
        answer.kind === 'numeric' ? answer.value.toString() : factLookupKeys(answer).join('|');
    }
    return { matched: true, value, cellIndex: index, keys };
  }

  return {
    matched: false,
    action: config.onNoMatch,
    reason: missingFactKeys.length > 0 ? 'fact_not_answered' : 'no_matching_row',
    missingFactKeys,
  };
}

/** Every fact key a grid reads — the one place a reader surface should ask. */
export function factsReadByGrid(config: FactGridConfig | undefined): readonly string[] {
  if (config === undefined || !Array.isArray(config.axes)) return [];
  return config.axes.map((axis) => axis.factKey).filter((key) => typeof key === 'string');
}
