/**
 * Money the applicant earns beside the basic figure, counted at the weight the bank gives it.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
 *
 * ─── Why a weighted table and not one percentage ──────────────────────────────
 *
 * The Arabic COMPOUND sheet does not ask for "other income, capped at X%". It states four
 * different weights and then one cap over the total:
 *
 *   rents                 counted at  50%
 *   certificate returns   counted at  75%
 *   fixed allowances      counted at 100%
 *   variable allowances   counted at  75%
 *   and the total may not exceed 100% of the basic income
 *
 * A single cap cannot express that: an applicant with 20 000 of rent and an applicant with
 * 20 000 of fixed allowance are two different credit decisions at that bank, and one number
 * makes them the same one. So the bank states a percentage PER SOURCE, and the cap is a
 * separate, optional line on top.
 *
 * ─── Where it runs, and why the order is not free ─────────────────────────────
 *
 * After the basic figure — including any I-Score multiplier, which is applied inside the rule
 * — and BEFORE the debt-burden cap is chosen. Both halves matter:
 *
 *   · the cap is a share of the basic figure, so it has to be measured against the figure the
 *     rule actually produced rather than the table row it started from;
 *   · `dbrBands` are keyed BY INCOME, so choosing the band first and then adding income picks
 *     the band of a person who earns less than the one being quoted.
 *
 * ─── What an unanswered source means ──────────────────────────────────────────
 *
 * Nothing, never a refusal. Every source question is optional, and an applicant with no rent
 * has no rent to state — treating the absence as `fact_not_answered` would turn "do you also
 * get money from anywhere else?" into a requirement for every applicant of every program that
 * counts one.
 *
 * ─── What this deliberately does NOT do ───────────────────────────────────────
 *
 * It does not touch a CEILING product. A ceiling is what the applicant's collateral supports,
 * not an opinion about what they earn, so adding rental income to it would quote a unit for
 * more than the unit carries. The caller applies this to an income figure only.
 */

import { Decimal } from '@prisma/client/runtime/library';

import type { SurrogateFactValue } from '../types';

const ZERO = new Decimal(0);
const ONE_HUNDRED = new Decimal(100);
const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

/** One source and the share of it this bank counts. */
export interface AdditionalIncomeSource {
  /** The registry fact holding the monthly amount, as the applicant stated it. */
  factKey: string;
  /** `(0, 100]`. Decimal string like every other money-adjacent figure (Principle I). */
  percent: string;
}

export interface AdditionalIncomeConfig {
  sources: AdditionalIncomeSource[];
  /**
   * The ceiling on the TOTAL, as a percentage of the basic figure. Absent means the bank
   * stated no ceiling — not a ceiling of zero, and not one of a hundred.
   */
  capPercentOfBasic?: string;
}

export interface CountedSource {
  factKey: string;
  /** What the applicant said they receive. */
  statedEGP: Decimal;
  /** What this bank counts of it, before the cap. */
  countedEGP: Decimal;
}

export interface AdditionalIncomeResult {
  /** What to add to the basic figure — already capped. */
  addedEGP: Decimal;
  /** Before the cap, for the surfaces that explain the figure. */
  weightedEGP: Decimal;
  counted: CountedSource[];
  /** `true` when the bank's ceiling, not the applicant's income, decided the figure. */
  capped: boolean;
}

const NOTHING: AdditionalIncomeResult = {
  addedEGP: ZERO,
  weightedEGP: ZERO,
  counted: [],
  capped: false,
};

function toDecimal(value: string | undefined): Decimal | null {
  if (value === undefined || value.trim() === '') return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The stated amount for one source, or `null` when the applicant did not state one.
 *
 * A CHOICE answer is not an amount and is ignored rather than coerced: a source bound to a
 * single-select question is a misconfiguration, and reading its option code as money is how a
 * bank would end up counting the number 1 as one pound.
 */
function statedAmount(fact: SurrogateFactValue | undefined): Decimal | null {
  if (fact === undefined || fact.kind !== 'numeric') return null;
  return fact.value.isFinite() && fact.value.greaterThan(0) ? fact.value : null;
}

/**
 * What the bank adds to the basic figure for this applicant.
 *
 * Returns zeros — never `null` — when the bank counts nothing: "this bank has no additional
 * income policy" and "this applicant stated none" produce the same figure and neither is an
 * error. The caller adds `addedEGP` unconditionally.
 */
export function resolveAdditionalIncome(args: {
  config: AdditionalIncomeConfig | undefined;
  facts: Readonly<Record<string, SurrogateFactValue>>;
  basicIncomeEGP: Decimal;
}): AdditionalIncomeResult {
  const { config, facts, basicIncomeEGP } = args;
  if (!config || config.sources.length === 0) return NOTHING;
  if (!basicIncomeEGP.isFinite() || basicIncomeEGP.lessThanOrEqualTo(0)) return NOTHING;

  const counted: CountedSource[] = [];
  let weighted = ZERO;

  for (const source of config.sources) {
    const stated = statedAmount(facts[source.factKey]);
    if (stated === null) continue;

    const percent = toDecimal(source.percent);
    // A weight outside (0, 100] is refused at save. Reached here it means a stored row was
    // written before that check existed: counted as nothing rather than as everything, which
    // is the direction that cannot over-quote.
    if (percent === null || percent.lessThanOrEqualTo(0) || percent.greaterThan(ONE_HUNDRED)) {
      continue;
    }

    const countedEGP = stated.mul(percent).div(ONE_HUNDRED).toDecimalPlaces(2, ROUND_BANKERS);
    if (countedEGP.lessThanOrEqualTo(0)) continue;

    counted.push({ factKey: source.factKey, statedEGP: stated, countedEGP });
    weighted = weighted.plus(countedEGP);
  }

  if (weighted.lessThanOrEqualTo(0)) return NOTHING;

  const capPercent = toDecimal(config.capPercentOfBasic);
  if (capPercent === null || capPercent.lessThanOrEqualTo(0)) {
    return { addedEGP: weighted, weightedEGP: weighted, counted, capped: false };
  }

  const ceiling = basicIncomeEGP.mul(capPercent).div(ONE_HUNDRED).toDecimalPlaces(2, ROUND_BANKERS);
  if (weighted.lessThanOrEqualTo(ceiling)) {
    return { addedEGP: weighted, weightedEGP: weighted, counted, capped: false };
  }
  return { addedEGP: ceiling, weightedEGP: weighted, counted, capped: true };
}

/** Every fact an additional-income policy reads — for the save-time check and the panels. */
export function additionalIncomeFactKeys(
  config: AdditionalIncomeConfig | undefined,
): readonly string[] {
  return config ? [...new Set(config.sources.map((s) => s.factKey))] : [];
}
