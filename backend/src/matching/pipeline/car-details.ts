/**
 * The car the applicant is buying, derived from what they answered.
 *
 * Pure module: no Nest, no Prisma (Constitution Principle V). One function, `withGridFacts`,
 * takes a `now: Date` with a real-time default — the same posture `customer-auth/age.util.ts`
 * already takes for the applicant's own age: nothing here calls `Date.now()` buried inside
 * logic a test cannot see, the moment is always an explicit, overridable input, and a caller
 * that never overrides it gets real time for free.
 *
 * ─── Why this exists, and why it is ONE function ──────────────────────────────
 *
 * `carDetails` decides two things now: the down-payment percentage the rate cascade bands on,
 * and the LTV ceiling `quote.ts` caps the amount with. Apply built it from a request BODY and
 * preview never built it at all, so the same applicant could be priced differently on the two
 * paths — the drift A33 names in terms ("preview and apply deriving the same engine input
 * differently — one shared function each"). This is that function; both call it.
 *
 * ─── Answers win, the body is the fallback ────────────────────────────────────
 *
 * Same precedence as every other fact on the profile: a validated ANSWER beats a body field,
 * because the body is a client's copy of it and the two are free to disagree. The body path
 * stays for the mobile builds that predate the numeric questions.
 *
 * ─── Absent is absent ─────────────────────────────────────────────────────────
 *
 * `undefined` unless BOTH figures are known. Never a zero: a zero price would make every LTV
 * cap zero and a zero down payment would price a customer who told us nothing as one who has
 * nothing (FR-044).
 */
import { Decimal } from '@prisma/client/runtime/library';

import type { CarDetails, SurrogateFactValue } from '../types';

/** The price the applicant states, as the registry knows it. */
export const CAR_PRICE_FACT_KEY = 'car_price';

/** The down payment the applicant states — read as income by the no-payslip auto products. */
export const CAR_DOWN_PAYMENT_FACT_KEY = 'car_down_payment';

function numericFact(
  byKey: Readonly<Record<string, SurrogateFactValue>> | undefined,
  key: string,
): Decimal | undefined {
  const value = byKey?.[key];
  if (value === undefined || value.kind !== 'numeric') return undefined;
  return value.value.isFinite() ? value.value : undefined;
}

/**
 * The car figures for the engine, from the answers when they are there and from the request
 * body otherwise.
 */
export function carDetailsFrom(
  byKey: Readonly<Record<string, SurrogateFactValue>> | undefined,
  body?: CarDetails | undefined,
): CarDetails | undefined {
  const carValueEGP = numericFact(byKey, CAR_PRICE_FACT_KEY);
  const downPaymentEGP = numericFact(byKey, CAR_DOWN_PAYMENT_FACT_KEY);
  if (carValueEGP !== undefined && downPaymentEGP !== undefined) {
    return { carValueEGP, downPaymentEGP };
  }
  return body;
}

/**
 * The share of the purchase the applicant is putting down, as a GRID AXIS.
 *
 * The rate cascade has banded on this number since feature 002 (`rateByDownPaymentPercent`),
 * but only as a fixed field on `ApplicantContext`. A grid axis names a FACT, so the same
 * figure needs a key — and it is the same figure, from the same single Decimal division, not
 * a second one (Principle I: two divisions of the same two numbers is a drift waiting to
 * happen, and this one decides a price).
 */
export const CAR_DOWN_PAYMENT_PERCENT_FACT_KEY = 'car_down_payment_percent';

/**
 * The term the loan is repaid over, as a GRID AXIS.
 *
 * Every bank's auto card prices tenor against something else — a down payment, an origin —
 * and a grid cannot read a term it has no key for. It is the CLAMPED term, not the requested
 * one, for the reason FR-008o.3 states.
 */
export const TENOR_MONTHS_FACT_KEY = 'tenor_months';

/**
 * Facts the ENGINE computes per quote rather than reading from an answer.
 *
 * Reserved so an operator cannot author a question under one of these keys and have a
 * customer's answer silently overwrite a figure the engine works out — the same guarantee
 * `DERIVED_FACT_KEYS` gives the bank axes, and for the same reason.
 *
 * They are deliberately NOT reported by the fact-reader surfaces: those exist to answer
 * "which QUESTION must this applicant be asked", and neither of these has a question. A grid
 * naming one demands nothing of the questionnaire.
 */
/**
 * The three the VEHICLE rules read, plus the condition question that was already asked.
 *
 * Platform facts like `car_price`: a bank's model-year table, its origin rows and its
 * insurance column belong to any car programme that states one, so none of them is a
 * product's to repoint or delete (`RESERVED_FACT_KEYS`).
 */
export const CAR_MODEL_YEAR_FACT_KEY = 'car_model_year';
export const CAR_ORIGIN_FACT_KEY = 'car_origin';
export const CAR_INSURANCE_FACT_KEY = 'car_insurance';
export const VEHICLE_CONDITION_FACT_KEY = 'vehicle_condition';
/**
 * What the car runs on. A platform fact like the four above, and for the same reason: a bank
 * that prices an electric car differently states that on its own programme, and the answer
 * belongs to every car programme rather than to one product.
 *
 * Deliberately NOT an option on `car_origin`. That question asks where the car was BUILT, and
 * a list mixing eleven countries with a drivetrain is one question answering two things — the
 * shape `isCore`'s fourth clause and the origin question's own docblock both argue against.
 */
export const CAR_FUEL_TYPE_FACT_KEY = 'car_fuel_type';

/**
 * Who is selling the car. A platform fact like the five above, and for the same reason: the
 * dealer decides the TERM on one bank's card ("Chinese cars 60 months, except through
 * Ghabbour & Mansour, 84"), and that rule belongs to any car programme stating it rather
 * than to one product.
 *
 * Deliberately NOT an option on `car_origin`: that question asks where the car was BUILT.
 * A Chinese car bought from Ghabbour is two facts, and a single list could carry only one.
 */
export const CAR_DEALER_FACT_KEY = 'car_dealer';

export const VEHICLE_FACT_KEYS: readonly string[] = [
  CAR_MODEL_YEAR_FACT_KEY,
  CAR_ORIGIN_FACT_KEY,
  CAR_INSURANCE_FACT_KEY,
  VEHICLE_CONDITION_FACT_KEY,
  CAR_FUEL_TYPE_FACT_KEY,
  CAR_DEALER_FACT_KEY,
];

/**
 * How old the car is, in whole years — `car_model_year` read against the CLOCK rather than
 * against another answer, which is what makes it engine-derived rather than platform-owned
 * like the six facts above.
 *
 * A GRID axis and not a fixed field on `ApplicantProfile`, for the same reason
 * `car_down_payment_percent` is one: a used-car age ceiling is a BANK'S table, keyed by
 * origin and dealer exactly like the term ceiling next to it, and a fixed field would need
 * its own clamp wired through every reader instead of reusing the grid machinery every other
 * vehicle rule already goes through.
 */
export const CAR_AGE_YEARS_FACT_KEY = 'car_age_years';

export const GRID_ONLY_FACT_KEYS: readonly string[] = [
  CAR_DOWN_PAYMENT_PERCENT_FACT_KEY,
  TENOR_MONTHS_FACT_KEY,
  CAR_AGE_YEARS_FACT_KEY,
];

export function isGridOnlyFactKey(key: string): boolean {
  return GRID_ONLY_FACT_KEYS.includes(key);
}

/**
 * The ANSWERS each engine-derived key is computed from.
 *
 * A grid-only key has no question behind it by design, so every reader that counts facts
 * skips it — which also hid what it depends on: a rate table keyed on the down-payment share
 * needs the car's price and the deposit asked, and nothing said so. This is that dependency,
 * written once beside the keys it describes, from the same computations `withGridFacts` and
 * `computeDownPaymentPercent` perform. `tenor_months` is absent: the platform supplies the
 * term, no applicant answer feeds it.
 */
export const DERIVED_FACT_INPUTS: Readonly<Record<string, readonly string[]>> = {
  [CAR_DOWN_PAYMENT_PERCENT_FACT_KEY]: [CAR_PRICE_FACT_KEY, CAR_DOWN_PAYMENT_FACT_KEY],
  [CAR_AGE_YEARS_FACT_KEY]: [CAR_MODEL_YEAR_FACT_KEY],
};

/**
 * The applicant's answered facts plus the three the engine derives, ready for a grid.
 *
 * Written LAST so a computed value always wins: if an operator ever does register a fact
 * under one of these keys, the engine's own figure is the one that prices the loan.
 *
 * `now` carries a real-time default and is never read except here — see the module header.
 * Whole years only, by calendar year rather than by day: the sheets this reads against print
 * "model 2015" and "8 years back", not a birthday-precision age, and a whole-year count is
 * also the only one that cannot flip an applicant's eligibility mid-quote between the moment
 * a rate is picked and the moment a term is picked.
 */
export function withGridFacts(
  facts: Readonly<Record<string, SurrogateFactValue>>,
  derived: { downPaymentPercent?: number | undefined; tenorMonths?: number | undefined },
  now: Date = new Date(),
): Readonly<Record<string, SurrogateFactValue>> {
  const out: Record<string, SurrogateFactValue> = { ...facts };
  if (derived.downPaymentPercent !== undefined && Number.isFinite(derived.downPaymentPercent)) {
    out[CAR_DOWN_PAYMENT_PERCENT_FACT_KEY] = {
      kind: 'numeric',
      value: new Decimal(derived.downPaymentPercent),
    };
  }
  if (derived.tenorMonths !== undefined && Number.isFinite(derived.tenorMonths)) {
    out[TENOR_MONTHS_FACT_KEY] = { kind: 'numeric', value: new Decimal(derived.tenorMonths) };
  }
  const modelYear = facts[CAR_MODEL_YEAR_FACT_KEY];
  if (modelYear !== undefined && modelYear.kind === 'numeric' && modelYear.value.isFinite()) {
    const ageYears = now.getFullYear() - modelYear.value.toNumber();
    // Next year's model is sold from the autumn before, so one year ahead is a new car: age 0.
    // Anything further ahead is no car at all, and gets NO age — the quote refuses it wherever
    // an age limit applies (`quote.ts`, 1a½), rather than letting a typo like 2100 read as a
    // car too young for any limit to catch.
    if (Number.isFinite(ageYears) && ageYears >= -1) {
      out[CAR_AGE_YEARS_FACT_KEY] = { kind: 'numeric', value: new Decimal(Math.max(0, ageYears)) };
    }
  }
  return out;
}
