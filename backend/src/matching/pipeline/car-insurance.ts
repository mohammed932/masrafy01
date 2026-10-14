/**
 * Comprehensive cover the bank requires on the car, and what it costs per year.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Every auto sheet on this platform states the same condition and the platform could not
 * carry it: below some deposit the bank demands comprehensive cover for the life of the
 * loan, priced as a percent of the CAR'S PRICE and paid every policy year. On a 2,000,000
 * car at 1% that is 20,000 a year, and over five years 100,000 the customer pays and the
 * offer never mentioned. It has lived as prose in `SCB-CAR-DOWN_PAYMENT`'s notes and as the
 * one stated loss of the v30.0.0 five-tier merge.
 *
 * ─── The table IS the rule ────────────────────────────────────────────────────
 *
 * There is no threshold in this file, and there must never be one. A bank that demands
 * cover below half the price states a row for `[0, 50)` and none above it; the bank whose
 * edge is 40% types 40. Suez Canal demands it on its 20% and 30% tiers only, HDB on E2/E3
 * and not on E5/E6, ADIB at every tier with no insured column at 60% at all. One number in
 * code would be wrong for two of those three on the day the second one is seeded
 * (Principle II / A1).
 *
 * The axis is `car_down_payment_percent`, which the engine already derives exactly once
 * (`cascade-adapter.ts`'s `computeDownPaymentPercent`) from the two required numeric
 * questions. Nothing new is asked of the applicant, and nothing can be: the applicant does
 * not know the bank's edge.
 *
 * ─── A cost never refuses ─────────────────────────────────────────────────────
 *
 * `onNoMatch` is deliberately NOT read here. A miss means "this bank states no cover
 * requirement at that deposit" — the band above the edge has no row BY DESIGN, and that
 * absence is the whole mechanism. `quote.ts` makes the same call in prose for the
 * `minAmountByFact` floor. Refusal belongs to the rate and financed-share tables, which are
 * read before this one; a table of COSTS must never be the thing that turns an applicant
 * away.
 *
 * ─── Disclosed, not priced in ─────────────────────────────────────────────────
 *
 * Nothing here reaches `totalFinancedFeesEGP`, the booked principal, the instalment or the
 * debt-burden ratio. The customer pays an insurer, once a policy year, outside the loan.
 * `calculateFees` carries the figures onto the breakdown and adds none of them to anything.
 */
import { Decimal } from '@prisma/client/runtime/library';

import type { CarDetails, SurrogateFactValue } from '../types';
import { resolveFactGrid, type FactGridConfig } from './fact-grid';

const ONE_HUNDRED = new Decimal(100);
const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;
const MONTHS_PER_YEAR = 12;

/**
 * Two outcomes and not four, unlike `ltvByFactFor`.
 *
 * That reader has to tell "no row matched and the bank said fall back" from "no row matched
 * and the bank said refuse", because a share it cannot resolve changes what is quoted. This
 * one cannot refuse and has no fallback to hand back to, so every way of not finding a row
 * is the same statement: this applicant's deposit buys no cover requirement.
 */
export type CarInsuranceOutcome =
  | { kind: 'none' }
  | {
      kind: 'required';
      ratePercent: Decimal;
      annualPremiumEGP: Decimal;
      years: number;
      totalOverTenorEGP: Decimal;
    };

/**
 * Policy years a term buys, always rounded UP.
 *
 * A 30-month loan is covered in its third year and the customer buys a third policy for it.
 * Flooring would under-state what cover costs, and on a disclosure that is the one direction
 * that must not happen — an over-stated figure is a customer who is not surprised at the
 * branch.
 */
function policyYearsFor(tenorMonths: number): number {
  if (!Number.isFinite(tenorMonths) || tenorMonths <= 0) return 0;
  return Math.ceil(tenorMonths / MONTHS_PER_YEAR);
}

export function carInsuranceFor(args: {
  grid: FactGridConfig | undefined;
  facts: Readonly<Record<string, SurrogateFactValue>>;
  carDetails: CarDetails | undefined;
  tenorMonths: number;
  parentKeyByValue?: Readonly<Record<string, string>>;
}): CarInsuranceOutcome {
  const { grid, facts, carDetails, tenorMonths, parentKeyByValue } = args;
  if (grid === undefined) return { kind: 'none' };

  // The base is the CAR'S PRICE and never the loan, guarded the way `ltvCeilingFor` guards
  // it: absent, non-finite or non-positive answers `none` rather than zero, so a car-shaped
  // cost can never reach an applicant who told us about no car.
  const price = carDetails?.carValueEGP;
  if (price === undefined || !price.isFinite() || price.lessThanOrEqualTo(0)) {
    return { kind: 'none' };
  }

  const years = policyYearsFor(tenorMonths);
  if (years <= 0) return { kind: 'none' };

  const hit = resolveFactGrid({
    config: grid,
    facts,
    ...(parentKeyByValue !== undefined ? { parentKeyByValue } : {}),
  });
  if (!hit.matched) return { kind: 'none' };

  // The same window the financed share is held to. A premium outside (0, 100] of the car's
  // price is not a premium, and a table stating one is not a table to guess from.
  if (hit.value.lessThanOrEqualTo(0) || hit.value.greaterThan(ONE_HUNDRED)) {
    return { kind: 'none' };
  }

  // Rounded to the piastre like every other money figure the quote carries (Principle I),
  // and the total is the ROUNDED annual premium times the years — which is what the customer
  // actually pays, one policy at a time, rather than a rounding of the product.
  const annualPremiumEGP = price.mul(hit.value).div(ONE_HUNDRED).toDecimalPlaces(2, ROUND_BANKERS);
  if (annualPremiumEGP.lessThanOrEqualTo(0)) return { kind: 'none' };

  return {
    kind: 'required',
    ratePercent: hit.value,
    annualPremiumEGP,
    years,
    totalOverTenorEGP: annualPremiumEGP.mul(years).toDecimalPlaces(2, ROUND_BANKERS),
  };
}
