/**
 * "What would each down payment give?" — the admin simulator's plan-row read-out.
 *
 * A car program that keys its figures on the down payment (the plans table) quotes ONE row for
 * the applicant's deposit. The operator's next question is the customer's: how much should they
 * put down? This answers it by quoting the same applicant again at the START of every deposit
 * row the program states, through the same `quoteAt` the real quote used — so a row can never
 * disagree with what the program would quote at that deposit (the income a down-payment product
 * works out moves with it, and is re-derived per row).
 *
 * Admin simulator only. Pure: no Prisma, no Nest; the caller supplies the quote function.
 */
import { Decimal } from '@prisma/client/runtime/library';
import type { ApplicantProfile, BankProgramSnapshot, QuoteOutcome } from '@/matching/types';
import {
  CAR_DOWN_PAYMENT_FACT_KEY,
  CAR_DOWN_PAYMENT_PERCENT_FACT_KEY,
  CAR_PRICE_FACT_KEY,
} from '@/matching/pipeline/car-details';

export interface DepositRow {
  /** Where the row starts, as a percent of the car's price. */
  fromPercent: string;
  /** The applicant's own deposit falls in this row. */
  current: boolean;
  effectiveRatePercent: string | null;
  maxAffordableAmountEGP: string | null;
  monthlyInstallmentEGP: string | null;
  /** Why this row quotes nothing (a reason code), else null. */
  unavailableReason: string | null;
}

interface GridLike {
  axes?: readonly { factKey: string }[];
  cells?: readonly { keys: readonly unknown[] }[];
}

/** The deposit rows a program states: every distinct start on a down-payment-first table. */
export function depositRowStarts(program: BankProgramSnapshot): Decimal[] {
  const grids: (GridLike | undefined)[] = [
    program.pricing?.rateByFact as GridLike | undefined,
    program.loanLimits?.ltvCeilingByFact as GridLike | undefined,
    program.loanLimits?.minAmountByFact as GridLike | undefined,
    program.tenor?.maxMonthsByFact as GridLike | undefined,
    program.tenor?.minMonthsByFact as GridLike | undefined,
  ];
  const starts = new Map<string, Decimal>();
  for (const grid of grids) {
    if (grid?.axes?.[0]?.factKey !== CAR_DOWN_PAYMENT_PERCENT_FACT_KEY) continue;
    for (const cell of grid.cells ?? []) {
      const key = cell.keys[0] as { fromInclusive?: string; fromExclusive?: string } | null;
      const raw = key?.fromInclusive ?? key?.fromExclusive;
      if (raw === undefined || raw === null) continue;
      try {
        const value = new Decimal(raw);
        starts.set(value.toString(), value);
      } catch {
        // an unparseable edge is no row
      }
    }
  }
  return [...starts.values()].sort((a, b) => a.comparedTo(b));
}

/**
 * One row per deposit start, or `undefined` when the program states no deposit rows or the
 * applicant gave no car price (there is nothing to take a share of).
 */
export function depositRowsFor(args: {
  profile: ApplicantProfile;
  program: BankProgramSnapshot;
  quoteAt: (profile: ApplicantProfile) => QuoteOutcome | null;
}): DepositRow[] | undefined {
  const starts = depositRowStarts(args.program);
  if (starts.length === 0) return undefined;
  const facts = args.profile.surrogateFacts ?? {};
  const price = facts[CAR_PRICE_FACT_KEY];
  if (price === undefined || price.kind !== 'numeric' || price.value.lessThanOrEqualTo(0)) {
    return undefined;
  }
  const own = facts[CAR_DOWN_PAYMENT_FACT_KEY];
  const ownPercent =
    own !== undefined && own.kind === 'numeric' ? own.value.dividedBy(price.value).times(100) : null;

  return starts.map((start, i) => {
    const next = starts[i + 1];
    const down = price.value.times(start).dividedBy(100).toDecimalPlaces(2);
    const profile: ApplicantProfile = {
      ...args.profile,
      // The car's amount is its price less the deposit, as the app derives it.
      requestedAmountEGP: price.value.minus(down),
      surrogateFacts: { ...facts, [CAR_DOWN_PAYMENT_FACT_KEY]: { kind: 'numeric', value: down } },
      ...(args.profile.carDetails
        ? { carDetails: { ...args.profile.carDetails, downPaymentEGP: down } }
        : {}),
    };
    const outcome = args.quoteAt(profile);
    const current =
      ownPercent !== null &&
      ownPercent.greaterThanOrEqualTo(start) &&
      (next === undefined || ownPercent.lessThan(next));
    if (outcome === null || !outcome.ok) {
      return {
        fromPercent: start.toString(),
        current,
        effectiveRatePercent: null,
        maxAffordableAmountEGP: null,
        monthlyInstallmentEGP: null,
        unavailableReason: outcome === null ? null : outcome.unavailable.reason,
      };
    }
    return {
      fromPercent: start.toString(),
      current,
      effectiveRatePercent: outcome.quote.effectiveRatePercent.toFixed(4),
      maxAffordableAmountEGP: outcome.quote.maxAffordableAmountEGP.toFixed(2),
      monthlyInstallmentEGP: outcome.quote.monthlyInstallmentEGP.toFixed(2),
      unavailableReason: null,
    };
  });
}
