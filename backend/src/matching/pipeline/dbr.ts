/**
 * Debt Burden Ratio — pure functions.
 * DBR = (existing obligations + new EMI) / monthly income × 100
 *
 * `calculateMaxLoanFromDbr` rounds DOWN to the program's amount-step multiple
 * (FR-008p.1), and floors to ≤ the applicant-requested amount (FR-008o.1) only
 * when a requested amount is supplied — omitting it yields the uncapped
 * affordability ceiling the calculator and the offer cards report.
 *
 * Caps are `Decimal`, never `number`: the value arrives from JSONB as a decimal
 * string, and a `number` annotation reads as float money math (Principle I).
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { DbrBand, DbrSetting } from '../types';
import { coarseEmploymentType } from './employment-type';
import { maxPrincipalRaw } from './pmt';
import { DEFAULT_RATE_BASIS, type RateBasis } from './rate-basis';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

export interface DbrInput {
  monthlyIncomeEGP: Decimal;
  existingMonthlyObligationsEGP: Decimal;
  newMonthlyInstallmentEGP: Decimal;
}

export interface DbrResult {
  dbrPercent: Decimal;
  withinCap: boolean;
}

export interface DbrCapResolution {
  capPercent: Decimal;
  /** Index of the band that matched; `null` when the scalar cap was used. */
  bandIndex: number | null;
  /**
   * Feature 011 / FR-012 — whether the cap came from the program's own setting or
   * from the income rule's `dbrCapPercentOverride`. Reported rather than derived
   * because every surface that shows a DBR figure has to say which policy it
   * measured against: an admin looking at 45% cannot otherwise tell whether the
   * program says 45 or the rule does.
   */
  source: 'program_default' | 'rule_override';
}

/**
 * Resolve the applicable DBR cap for a recognised income (FR-016 … FR-020).
 *
 * MUST be called with the SAME income figure every other quote figure keys off
 * (`quoteProgram` step 3 — the declared salary, or a surrogate when none was
 * declared). Resolving the band on one income and the ratio on another is the
 * ordering bug this feature exists to prevent: it hands the applicant a cap
 * belonging to an income they were never measured against.
 *
 * Upper bounds are INCLUSIVE, so an income of exactly 10 000 against
 * `[≤5 000: 30, ≤10 000: 35, open: 50]` resolves band 1 at 35%.
 *
 * Never throws (Principle V — the engine cannot fail a match on bad config).
 * A missing, empty, or malformed band table falls back to the scalar cap with
 * `bandIndex: null`, which is exactly the pre-feature behaviour (FR-020).
 * Well-formed tables are guaranteed by `validateDbrBands` at write time; this
 * tolerance only covers legacy or hand-edited rows.
 */
export function resolveDbrCap(
  setting: DbrSetting,
  recognisedIncomeEGP: Decimal,
  /**
   * Feature 011 / FR-012 — the income rule's `dbrCapPercentOverride`, passed ONLY
   * when the recognised income is surrogate-derived. The caller decides that
   * (`income-resolver.ts` reads `origin`), not this function: a surrogate figure is
   * the bank's own estimate of capacity, so a bank may cap it differently from a
   * payslip it has actually seen — but a declared salary on a surrogate program is
   * still a payslip figure and gets the program's own cap.
   *
   * Wins over both the scalar and the band table when present. It is the most
   * specific statement of policy available: per program AND per income rule.
   */
  ruleOverridePercent?: string,
  /**
   * The applicant's DETAILED employment answer, for a program that caps by bucket.
   *
   * Passed raw and folded here, so the caller never has to know that
   * `business_owner_company_owner` is a `self_employed` for underwriting purposes.
   */
  employmentType?: string,
): DbrCapResolution {
  const override = toDecimalOrNull(ruleOverridePercent);
  // Bounds are re-checked here rather than trusted: the save path validates the
  // override (`INCOME_RULE_DBR_OVERRIDE_INVALID`), but a hand-edited or legacy
  // JSONB row reaching the engine with `0` would silently cap every applicant at
  // zero affordability, and Principle V forbids failing the match on bad config.
  if (override !== null && override.greaterThan(0) && override.lessThanOrEqualTo(100)) {
    return { capPercent: override, bandIndex: null, source: 'rule_override' };
  }

  // Employment before income: a bank that states both means "40% for the self-employed,
  // whatever they earn". Bounds re-checked for the same reason the override's are — a
  // hand-edited 0 here would cap an applicant at no affordability at all.
  const byEmployment =
    employmentType === undefined
      ? null
      : toDecimalOrNull(
          setting.dbrCapPercentByEmploymentType?.[coarseEmploymentType(employmentType)],
        );
  if (byEmployment !== null && byEmployment.greaterThan(0) && byEmployment.lessThanOrEqualTo(100)) {
    return { capPercent: byEmployment, bandIndex: null, source: 'program_default' };
  }

  const scalar = toDecimalOrNull(setting.dbrCapPercent) ?? new Decimal(0);
  const bands = setting.dbrBands;
  if (!bands || bands.length === 0) {
    return { capPercent: scalar, bandIndex: null, source: 'program_default' };
  }

  for (const [index, band] of bands.entries()) {
    const cap = toDecimalOrNull(band.capPercent);
    if (cap === null) continue;

    // The open-ended band terminates the table and matches any remaining income.
    if (band.upToIncomeEGP === null || band.upToIncomeEGP === undefined) {
      return { capPercent: cap, bandIndex: index, source: 'program_default' };
    }

    const bound = toDecimalOrNull(band.upToIncomeEGP);
    if (bound === null) continue;
    if (recognisedIncomeEGP.lessThanOrEqualTo(bound)) {
      return { capPercent: cap, bandIndex: index, source: 'program_default' };
    }
  }

  // Fell off the end — the table has no open-ended band (rejected on write, so
  // only reachable for legacy rows). Treat it as "no usable table".
  return { capPercent: scalar, bandIndex: null, source: 'program_default' };
}

/** Tolerant parse: a bad decimal string yields null instead of throwing. */
function toDecimalOrNull(value: string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

/** Re-exported so callers can type band tables without reaching into `../types`. */
export type { DbrBand, DbrSetting };

export function calculateDbr(input: DbrInput, dbrCapPercent: Decimal): DbrResult {
  if (input.monthlyIncomeEGP.lessThanOrEqualTo(0)) {
    return { dbrPercent: new Decimal(999), withinCap: false };
  }
  const totalObligations = input.existingMonthlyObligationsEGP.plus(input.newMonthlyInstallmentEGP);
  const dbrPercent = totalObligations
    .mul(100)
    .div(input.monthlyIncomeEGP)
    .toDecimalPlaces(2, ROUND_BANKERS);
  return { dbrPercent, withinCap: dbrPercent.lessThanOrEqualTo(dbrCapPercent) };
}

export function calculateMaxLoanFromDbr(args: {
  monthlyIncomeEGP: Decimal;
  existingMonthlyObligationsEGP: Decimal;
  dbrCapPercent: Decimal;
  annualRatePercent: Decimal;
  tenorMonths: number;
  /**
   * Omit to get the UNCAPPED affordability ceiling (`Quote.maxAffordableAmountEGP`
   * — "the most this person could borrow"). Pass it when shrinking an offer back
   * under the cap, where the result must never grow past what was asked for.
   */
  applicantRequestedEGP?: Decimal;
  amountStepEGP?: Decimal;
  /**
   * How this program charges its rate. Omitted reads as the reducing annuity, which is
   * what every program predating the field was priced by (`rate-basis.ts`).
   *
   * It must be the SAME basis the instalment was worked out under: this function inverts
   * `pmt.ts`, and inverting the other formula misstates the loan by 22–29%.
   */
  rateBasis?: RateBasis;
}): Decimal {
  const maxEmi = args.monthlyIncomeEGP
    .mul(args.dbrCapPercent)
    .div(100)
    .minus(args.existingMonthlyObligationsEGP);

  if (maxEmi.lessThanOrEqualTo(0)) return new Decimal(0);

  let maxPrincipal = maxPrincipalRaw(
    maxEmi,
    args.annualRatePercent,
    args.tenorMonths,
    args.rateBasis ?? DEFAULT_RATE_BASIS,
  );

  // Floor to ≤ applicant-requested amount (FR-008o.1), when one was supplied.
  if (args.applicantRequestedEGP && maxPrincipal.greaterThan(args.applicantRequestedEGP)) {
    maxPrincipal = args.applicantRequestedEGP;
  }

  // Floor to amount-step multiple (FR-008p.1).
  if (args.amountStepEGP && args.amountStepEGP.greaterThan(0)) {
    const steps = maxPrincipal.div(args.amountStepEGP).floor();
    maxPrincipal = steps.mul(args.amountStepEGP);
  }

  return maxPrincipal.toDecimalPlaces(2, ROUND_BANKERS);
}
