/**
 * Adjustments that act on the CAP rather than on the income.
 *
 * Pure module: no Nest, no Prisma, no clock, no randomness (Constitution Principle V).
 *
 * ─── Why a scope is mandatory ─────────────────────────────────────────────────
 *
 * Two lines on one ABK sheet, read literally, adjust the loan amount and not the assumed
 * income:
 *
 *   "Program loan AMOUNTS can be increased by 10% in case applicants provide more than one
 *    residential unit"
 *   "Applicants owning apartments in high end compounds will be eligible for Villas MAXIMUM
 *    LOAN AMOUNT"
 *
 * and one FABMISR line adjusts BOTH: "jointly-owned (husband & wife) accepted at 50% of
 * imputed income AND 50% of the loan amount".
 *
 * Whether an adjustment lifts the income, the cap, or both changes the answer whenever the
 * other side binds. Worked, with the ABK figures — a villa owner who has paid 20,000,000, so
 * 15% = 3,000,000, against a Villa NTB cap of 4,000,000:
 *
 *   +10% on both sides     min(3,300,000 · 4,400,000) = 3,300,000
 *   +10% on the cap only   min(3,000,000 · 4,400,000) = 3,000,000
 *
 * 300,000 on one applicant, and the high-end override swings 50%. So there is no default
 * scope and none is inferred: an adjustment inside the income rule lifts the income, and one
 * here lifts the cap, and a bank that means both states both.
 *
 * ─── Ordering ─────────────────────────────────────────────────────────────────
 *
 * Applied in DECLARED order, and the order is part of the configuration for the same reason
 * it is inside the rule: `percentOf` rounds to two decimals at every step, multiplication
 * commutes but the rounding does not, and the same program must always produce the same
 * figure to the piastre.
 *
 * When an adjustment applies to BOTH sides it commutes with `min`, so ordering is only ever
 * ambiguous when the scope is — which is exactly why the scope is stated.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { SurrogateFactValue } from '../types';

export const MAX_LOAN_ADJUSTMENT_KINDS = ['upliftPercent', 'sharePercent'] as const;

export type MaxLoanAdjustmentKind = (typeof MAX_LOAN_ADJUSTMENT_KINDS)[number];

/**
 * One adjustment to the program's cap.
 *
 * `upliftPercent` ADDS the percentage ("+10% for a second unit"); `sharePercent` TAKES the
 * percentage ("50% on joint ownership"). Two kinds rather than one signed number, because
 * the sheets say "increased by 10%" and "accepted at 50%" and an operator should type what
 * the sheet says.
 *
 * It applies only when `whenFactKey` is answered with `whenOptionCode`. Any other answer,
 * and an unanswered fact, mean NO adjustment — never "for everyone", which is what an
 * absent `otherwise` branch would silently produce.
 */
export interface MaxLoanAdjustment {
  kind: MaxLoanAdjustmentKind;
  /** Decimal string. `upliftPercent`: 0…1000. `sharePercent`: (0…100]. */
  percent: string;
  whenFactKey: string;
  whenOptionCode: string;
}

function toDecimal(raw: string): Decimal | null {
  try {
    const value = new Decimal(raw);
    return value.isFinite() ? value : null;
  } catch {
    return null;
  }
}

/** Rounded to piastres at every step, exactly as `percentOf` does inside a rule. */
function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export interface MaxLoanAdjustmentApplied {
  kind: MaxLoanAdjustmentKind;
  percent: string;
  whenFactKey: string;
}

/**
 * The program's cap after every adjustment that applies to this applicant.
 *
 * Reports WHICH applied alongside the figure: a cap that moved without saying why is a
 * number an operator cannot reconcile against the sheet.
 */
export function applyMaxLoanAdjustments(args: {
  cap: Decimal;
  adjustments: readonly MaxLoanAdjustment[];
  facts: Readonly<Record<string, SurrogateFactValue>>;
}): { cap: Decimal; applied: MaxLoanAdjustmentApplied[] } {
  let cap = args.cap;
  const applied: MaxLoanAdjustmentApplied[] = [];

  for (const adjustment of args.adjustments) {
    const answer = args.facts[adjustment.whenFactKey];
    if (answer === undefined || answer.kind !== 'choice') continue;
    if (answer.optionCode !== adjustment.whenOptionCode) continue;

    const percent = toDecimal(adjustment.percent);
    // An unreadable or non-positive percentage is treated as NOT CONFIGURED rather than as a
    // cap of zero or an untouched one: silently zeroing a cap is a blank card, and silently
    // ignoring it is a quote above the bank's policy. Neither is a figure to guess at, so the
    // save-time validator refuses both and this is the belt to that brace.
    if (percent === null || percent.lessThanOrEqualTo(0)) continue;

    cap =
      adjustment.kind === 'upliftPercent'
        ? round2(cap.mul(percent.div(100).plus(1)))
        : round2(cap.mul(percent).div(100));
    applied.push({
      kind: adjustment.kind,
      percent: adjustment.percent,
      whenFactKey: adjustment.whenFactKey,
    });
  }

  return { cap, applied };
}
