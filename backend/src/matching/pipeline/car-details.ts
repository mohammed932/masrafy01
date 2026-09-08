/**
 * The car the applicant is buying, derived from what they answered.
 *
 * Pure module: no Nest, no Prisma, no clock (Constitution Principle V).
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
