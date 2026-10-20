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

/**
 * Did the debt-burden limit size this loan? True when the frozen DBR sits at (or,
 * after rounding, a hair over) its cap: the cascade grew the installment until
 * the applicant's debts hit the bank's share of income, and stopped there.
 *
 * Read from the offer's own two figures rather than `bindingConstraint`, which is
 * null on every offer written before that column and is not on the admin payload.
 */
export function dbrIsAtCap(dbrPercent: string | null, dbrCapPercent: string | null): boolean {
  const dbr = Number(dbrPercent);
  const cap = Number(dbrCapPercent);
  if (dbrPercent === null || dbrCapPercent === null) return false;
  if (!Number.isFinite(dbr) || !Number.isFinite(cap) || cap <= 0) return false;
  return dbr >= cap;
}

/**
 * Are the fees inside the loan amount? The engine FINANCES them (quote.ts,
 * FR-022a): the booked principal is the cash plus the fees, and the offer's
 * `requestedLoanAmountEGP` is the cash. When the two differ the customer walks
 * away with less than the headline — worth a line of its own.
 */
export function cashIsBelowLoan(cashEGP: string, loanEGP: string): boolean {
  const cash = Number(cashEGP);
  const loan = Number(loanEGP);
  if (!Number.isFinite(cash) || !Number.isFinite(loan) || cash <= 0) return false;
  return cash < loan;
}
