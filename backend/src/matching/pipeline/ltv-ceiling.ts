/**
 * The share of a car's price a program will finance.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Every auto sheet states the same pair twice over: a down payment the customer puts in and
 * the share the bank then finances (60% down → 40% financed). Until now the platform stored
 * `loanLimits.ltvCeilingPercent` and READ IT NOWHERE — a program could state 40% and the
 * engine would happily quote the whole price against it.
 *
 * The cap belongs here and not in the income rule, for the reason spec §10.2 gives about
 * every other "take the lower" line on a sheet: it is a ceiling on the AMOUNT, not a second
 * way of guessing the income, and the two are in different units until the rate and the tenor
 * exist. `quote.ts` folds it in beside the program's flat maximum, its fact-keyed cap table
 * and the collateral ceiling, and the lowest of them wins.
 *
 * ─── Absent means absent ──────────────────────────────────────────────────────
 *
 * `null` — never zero — whenever the program states no percentage, states one outside
 * (0, 100], or the applicant told us nothing about a car. A zero cap would be a blank card
 * with no stated reason, and a car-shaped cap must not reach a personal loan.
 */
import { Decimal } from '@prisma/client/runtime/library';

import type { CarDetails, LoanLimitsConfig } from '../types';

const ONE_HUNDRED = new Decimal(100);

function toDecimalOrNull(value: string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The most this program will lend against this car, or `null` when the pair does not apply.
 *
 * Rounded to the piastre like every other money figure the quote carries (Principle I).
 */
export function ltvCeilingFor(
  loanLimits: Pick<LoanLimitsConfig, 'ltvCeilingPercent'> | undefined,
  carDetails: CarDetails | undefined,
): Decimal | null {
  const percent = toDecimalOrNull(loanLimits?.ltvCeilingPercent);
  if (percent === null || percent.lessThanOrEqualTo(0) || percent.greaterThan(ONE_HUNDRED)) {
    return null;
  }
  const price = carDetails?.carValueEGP;
  if (price === undefined || !price.isFinite() || price.lessThanOrEqualTo(0)) return null;
  return price.mul(percent).div(ONE_HUNDRED).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
}
