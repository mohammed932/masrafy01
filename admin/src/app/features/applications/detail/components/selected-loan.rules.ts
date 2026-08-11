/**
 * Display rules for the "Eligible for" card. Pure so they can be tested without
 * an Angular runtime — the card only wraps them in `computed()`.
 *
 * Amounts arrive as Decimal strings from the API and are compared, never
 * summed, here: a comparison cannot lose precision the way arithmetic would
 * (Principle I — money math stays server-side on Decimal).
 */

/**
 * Did the bank fund less than the applicant asked for?
 *
 * `asked` MUST be the application's `requestedAmountEGP`, not the offer's own
 * `requestedLoanAmountEGP` — the latter is a post-cascade figure (a program that
 * caps at 442,902.80 reports exactly that as "requested"), so comparing against
 * it made every DBR-capped loan read as "full amount requested".
 *
 * Returns false when `asked` is missing or unusable: an unknown ask is not
 * evidence of a reduction.
 */
export function wasAmountReduced(effectiveEGP: string, asked: string | null): boolean {
  const askedValue = Number(asked);
  const effectiveValue = Number(effectiveEGP);
  if (!Number.isFinite(askedValue) || askedValue <= 0) return false;
  if (!Number.isFinite(effectiveValue)) return false;
  return effectiveValue < askedValue;
}

/**
 * Is the bank's ceiling worth its own row? A DBR-capped loan IS its ceiling, so
 * printing both repeats the headline one line apart. Rounding leaves the two a
 * piastre apart in practice, hence the 1 EGP slack.
 */
export function ceilingIsInformative(
  maxLoanAvailableEGP: string | null | undefined,
  effectiveEGP: string,
): boolean {
  if (!maxLoanAvailableEGP) return false;
  const ceiling = Number(maxLoanAvailableEGP);
  const effective = Number(effectiveEGP);
  if (!Number.isFinite(ceiling) || !Number.isFinite(effective)) return false;
  return Math.abs(ceiling - effective) >= 1;
}
