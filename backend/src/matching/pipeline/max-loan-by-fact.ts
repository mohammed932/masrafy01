/**
 * A bank's MAXIMUM LOAN, keyed by an answer the applicant gave.
 *
 * Pure module: no Nest, no Prisma, no clock, no randomness (Constitution Principle V).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Nine of the source program sheets print a second table under the heading
 * "Loan Amount — Maximum": ABK Compound Owner by property type × NTB/Top-up, ABK CDs
 * Holder by CD tier, ABK Doctors by city × NTB/Top-up, the Arabic doctor / professor /
 * compound sheets by governorate tier, degree and unit-price bracket, the Arabic salaried
 * sheet by company coding, CAE Teachers by school type, FABMISR Al Ahly by branch.
 *
 * It reads as "take the lower of two ways to reach the figure" and it is NOT that. It is
 * the program's own ceiling, keyed by an answer, and it belongs to the bank program rather
 * than to the income calculation for three reasons:
 *
 *   1. It is where the banks put it. A cap on the loan amount is not part of guessing an
 *      income.
 *   2. Three of those sheets have NO surrogate rule to hang a second path on — the Arabic
 *      salaried program reads a real payslip, and CAE Teachers / FABMISR Al Ahly are a real
 *      income plus a ceiling. A `minOf` inside the rule cannot reach them at all.
 *   3. `minOf` could not express it anyway when the two sides are in different units. A
 *      ceiling converts to an income-equivalent only with the rate and the tenor, which the
 *      rule does not have — which is exactly why `quote.ts` does that conversion downstream.
 *
 * ─── Why capping downstream gives the same answer ─────────────────────────────
 *
 * The map from a recognised income to a loan amount is monotonically increasing
 * (`installment = income × DBR − obligations`, `loan = installment × the annuity factor`).
 * Under a monotonic map `min` commutes with the map, so capping the AMOUNT afterwards is
 * the same figure as capping the INCOME beforehand. There is no ordering trap here, and
 * the two configurations of one bank's program must agree to the piastre.
 *
 * ─── Why `onNoMatch` is mandatory ────────────────────────────────────────────
 *
 * A compound filed under `Other`, or a governorate nobody tiered, must not silently become
 * "no cap" — a quote far above the bank's policy — nor "cap zero", which is a blank card
 * with no stated reason. So the bank says which, per program, and neither is a default the
 * platform picks on its behalf. `useProgramMax` is the seeded default: the program's own
 * `maxAmountEGP` still applies, exactly as it did before a cap table was added.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { SurrogateFactValue } from '../types';

/**
 * What happens to an applicant whose answer this table has no row for.
 *
 * Never inferred. See the file header — both silent readings are wrong in a direction that
 * only shows up on a real customer.
 */
export const MAX_LOAN_NO_MATCH_ACTIONS = ['useProgramMax', 'reject'] as const;

export type MaxLoanNoMatchAction = (typeof MAX_LOAN_NO_MATCH_ACTIONS)[number];

/**
 * One cell of the bank's cap table.
 *
 * A row is keyed EITHER by an option code (`rowKey`, for a choice fact — a property type, a
 * school type, a company coding) OR by a half-open numeric band (`fromInclusive` /
 * `toExclusive`, for a number fact — a CD tier, a down-payment bracket, a unit price). The
 * band edges follow `IncomeBand` exactly: `[fromInclusive, toExclusive)`, `toExclusive: null`
 * marking the open-ended last band, so 500,000 lands in `500K–1M` and never in `250K–500K`.
 *
 * `columnKey` is the second axis when the program declares one. A row that states no
 * `columnKey` applies to EVERY column, which is what lets a bank fill one figure against
 * both NTB and Top-up without typing it twice.
 */
export interface MaxLoanByFactRow {
  rowKey?: string;
  fromInclusive?: string;
  toExclusive?: string | null;
  columnKey?: string;
  /** Decimal string, > 0. Arrives from JSONB as a string — never a float (Principle I). */
  maxAmountEGP: string;
}

/**
 * The whole table, as one bank program states it.
 *
 * `factKey` and `columnFactKey` name FACTS, not questions: the engine reads
 * `ApplicantProfile.surrogateFacts` plus the derived facts, and a fact is what a question is
 * bound to. The spec this implements calls them `questionKey` / `columnQuestionKey`; they
 * are the same axis named from the other end, and the fact key is the one the engine can
 * actually look up.
 */
export interface MaxLoanByFactConfig {
  factKey: string;
  columnFactKey?: string;
  /**
   * Whether a row (or a column) is keyed by the ANSWER's own option code — the default, and
   * what every stored table means — or by the CLASS the answer is filed under.
   *
   * The platform's answer to "every bank tiers the same list differently" is one granular
   * list filed under classes: 27 governorates under three city tiers, hundreds of compounds
   * under six classes. A cap keyed by the answer cannot read that: one sheet caps Cairo &
   * Alexandria together against everywhere else, and spelling all 27 codes into the table
   * would leave the next governorate added silently uncapped.
   *
   * An answer filed under NO class yields no key and therefore no row, which lands on
   * `onNoMatch` — the bank's own stated choice — rather than on a silent "no cap".
   */
  rowVia?: 'answer' | 'parentClass';
  columnVia?: 'answer' | 'parentClass';
  rows: MaxLoanByFactRow[];
  onNoMatch: MaxLoanNoMatchAction;
}

/** Why no row was found — what the admin has to act on, and they are different actions. */
export type MaxLoanNoMatchReason =
  /** The applicant was never asked the fact, or skipped it. */
  | 'fact_not_answered'
  /** They answered, and the bank's table has no row for that answer. */
  | 'no_matching_row';

export type MaxLoanByFactResolution =
  | { matched: true; maxAmountEGP: Decimal; rowIndex: number }
  | { matched: false; action: MaxLoanNoMatchAction; reason: MaxLoanNoMatchReason };

function toDecimal(raw: string | null | undefined): Decimal | null {
  if (raw === null || raw === undefined || raw.trim() === '') return null;
  try {
    const value = new Decimal(raw);
    return value.isFinite() ? value : null;
  } catch {
    return null;
  }
}

/**
 * Does this row's key match the answer?
 *
 * A row that states neither a `rowKey` nor a band edge matches NOTHING. Deliberately: an
 * empty row is a half-typed one, and treating it as a wildcard would cap every applicant at
 * whatever figure happened to sit beside it.
 */
function rowMatches(row: MaxLoanByFactRow, answer: SurrogateFactValue): boolean {
  if (answer.kind === 'choice') {
    return row.rowKey !== undefined && row.rowKey === answer.optionCode;
  }
  const from = toDecimal(row.fromInclusive);
  const to = toDecimal(row.toExclusive);
  if (from === null && to === null) return false;
  if (from !== null && answer.value.lessThan(from)) return false;
  if (to !== null && answer.value.greaterThanOrEqualTo(to)) return false;
  return true;
}

/**
 * One answer as the axis reads it: itself, or the class it is filed under.
 *
 * `undefined` out means "this axis cannot be read for this applicant" — either there was no
 * answer, or there was one and it is filed under nothing. The caller decides which of those
 * matters; for the ROW axis both end at `onNoMatch`, and for the COLUMN axis both fall
 * through to the column-agnostic rows, exactly as an unanswered second axis already did.
 */
function viaClass(
  answer: SurrogateFactValue | undefined,
  via: 'answer' | 'parentClass' | undefined,
  parentKeyByValue: Readonly<Record<string, string>> | undefined,
): SurrogateFactValue | undefined {
  if (answer === undefined) return undefined;
  if (via !== 'parentClass') return answer;
  // Only a choice has a class. A numeric axis keyed by class is refused at save, so this is
  // belt-and-braces rather than a reachable shape.
  if (answer.kind !== 'choice') return undefined;
  const parentKey = parentKeyByValue?.[answer.optionCode];
  return parentKey === undefined ? undefined : { kind: 'choice', optionCode: parentKey };
}

/**
 * The bank's cap for this applicant, or why there is none.
 *
 * Two passes, and the order is the whole of the second-axis rule: a row that names THIS
 * applicant's column wins over a column-agnostic row, so a bank can state one figure for
 * both columns and then override just one of them without deleting the shared row.
 *
 * Within a pass it is first-match-wins in declared order, the same idiom `bandFor` and
 * `factChoiceTable` already use, so a table read in the admin grid top to bottom resolves
 * the way it looks.
 */
export function resolveMaxLoanByFact(args: {
  config: MaxLoanByFactConfig;
  facts: Readonly<Record<string, SurrogateFactValue>>;
  /** The class each list value is filed under. Only read when an axis says `parentClass`. */
  parentKeyByValue?: Readonly<Record<string, string>>;
}): MaxLoanByFactResolution {
  const { config, facts, parentKeyByValue } = args;
  const rawAnswer = facts[config.factKey];
  if (rawAnswer === undefined) {
    return { matched: false, action: config.onNoMatch, reason: 'fact_not_answered' };
  }
  // A class-keyed axis reads the class, so the answer is REPLACED by it before any row is
  // compared. An unfiled value has no class: no row can match, and `onNoMatch` decides —
  // which is the same reading `factParentTable` takes, where the class is also the key.
  const answer = viaClass(rawAnswer, config.rowVia, parentKeyByValue);
  if (answer === undefined) {
    return { matched: false, action: config.onNoMatch, reason: 'no_matching_row' };
  }

  const rawColumn = config.columnFactKey === undefined ? undefined : facts[config.columnFactKey];
  const columnAnswer = viaClass(rawColumn, config.columnVia, parentKeyByValue);
  const columnCode =
    columnAnswer !== undefined && columnAnswer.kind === 'choice'
      ? columnAnswer.optionCode
      : undefined;

  const passes: Array<(row: MaxLoanByFactRow) => boolean> =
    config.columnFactKey === undefined
      ? [(row) => row.columnKey === undefined]
      : [
          (row) => columnCode !== undefined && row.columnKey === columnCode,
          (row) => row.columnKey === undefined,
        ];

  for (const inThisPass of passes) {
    for (const [rowIndex, row] of config.rows.entries()) {
      if (!inThisPass(row)) continue;
      if (!rowMatches(row, answer)) continue;
      const maxAmountEGP = toDecimal(row.maxAmountEGP);
      // A row whose figure is unreadable or non-positive is treated as NOT CONFIGURED
      // rather than as a cap of zero: zero would be a blank card with no stated reason,
      // which is the exact failure `onNoMatch` exists to make the bank choose about.
      if (maxAmountEGP === null || maxAmountEGP.lessThanOrEqualTo(0)) continue;
      return { matched: true, maxAmountEGP, rowIndex };
    }
  }

  return { matched: false, action: config.onNoMatch, reason: 'no_matching_row' };
}
