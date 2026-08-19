/**
 * A borrowing CEILING → the income figure the rest of the pipeline already knows how
 * to spend. Pure, `Decimal` only (Principles I + V).
 *
 * ─── Why a conversion and not a second pipeline ────────────────────────────────
 *
 * A collateral product states a ceiling ("this unit supports 2 000 000") and nothing
 * about the applicant's earnings. Everything downstream of income — the DBR cap, the
 * obligations deduction, the affordability shrink loop, the fee financing, the offer
 * identities — is already written, tested, and frozen onto live offers. Re-deriving it
 * for ceilings would be a second money path, and the source design's own bug #3 is
 * exactly what two money paths cost.
 *
 * So the ceiling is expressed in the currency the pipeline speaks:
 *
 *   installmentAtCeiling = PMT(ceiling, rate, tenor)
 *   recognisedIncome     = installmentAtCeiling × 100 ÷ baselineDbrPercent
 *
 * Read it as: "the bank calibrated its appetite when it set that ceiling, so the
 * instalment the ceiling implies IS the debt-burden ceiling." Feeding that income into
 * `calculateMaxLoanFromDbr` with zero obligations returns the ceiling back, to the
 * cent — the round trip is lossless, which is the property the golden vectors assert.
 * With obligations it returns `ceiling − PV(obligations)`, which is the answer the
 * source design derives by hand in its §3.1 closed form.
 *
 * ─── Why the BASELINE cap and not the applicable one ──────────────────────────
 *
 * A bank that varies its cap by employment (50% salaried / 40% self-employed) states
 * the baseline it calibrated the ceiling against. The conversion divides by the
 * baseline; the affordability check then multiplies by whichever cap actually applies.
 * The haircut the source design calls `dbrRatio` is therefore `applicable ÷ baseline`
 * and needs no setting of its own — one fewer number to keep in step, and a bank with
 * one flat cap gets a ratio of exactly 1 without configuring anything.
 *
 * ─── Which rate ───────────────────────────────────────────────────────────────
 *
 * The program's cascade rate, NOT the fee-penalty-adjusted rate the instalment is
 * finally priced at. The ceiling is a credit-policy figure: the bank decided what the
 * unit supports before anyone chose to waive an admin fee. Pricing it at the penalty
 * rate would move a policy ceiling because of a fee election, which is the kind of
 * quiet coupling Principle I exists to prevent.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { calculateMonthlyInstallment, monthlyInstallmentRaw } from './pmt';

export interface CeilingConversionInput {
  ceilingEGP: Decimal;
  annualRatePercent: Decimal;
  tenorMonths: number;
  /**
   * The cap the ceiling was calibrated against. Callers pass the rule's
   * `output.baselineDbrPercent` when it carries one and the program's own cap when it
   * does not — a rule that says nothing is calibrated against the bank's normal cap,
   * which yields a ratio of 1 and changes nothing.
   */
  baselineDbrPercent: Decimal;
}

export interface CeilingConversion {
  /** The income figure to quote on. UNROUNDED — see `ceilingToIncome`. */
  recognisedIncomeEGP: Decimal;
  /** The instalment the ceiling implies — the bank's real debt-burden ceiling. */
  installmentAtCeilingEGP: Decimal;
  baselineDbrPercent: Decimal;
}

const ONE_HUNDRED = new Decimal(100);

/**
 * `null` when the conversion cannot be made — a non-positive ceiling, a tenor of zero,
 * or a baseline outside `(0, 100]`. Never a substituted figure: the caller reports a
 * stated reason, because "the unit supports nothing" and "we could not work out what
 * the unit supports" are different facts with the same digits (FR-020).
 */
export function ceilingToIncome(input: CeilingConversionInput): CeilingConversion | null {
  const { ceilingEGP, annualRatePercent, tenorMonths, baselineDbrPercent } = input;

  if (!ceilingEGP.isFinite() || ceilingEGP.lessThanOrEqualTo(0)) return null;
  if (!Number.isFinite(tenorMonths) || tenorMonths < 1) return null;
  if (!annualRatePercent.isFinite() || annualRatePercent.lessThan(0)) return null;
  if (
    !baselineDbrPercent.isFinite() ||
    baselineDbrPercent.lessThanOrEqualTo(0) ||
    baselineDbrPercent.greaterThan(ONE_HUNDRED)
  ) {
    return null;
  }

  // UNROUNDED on purpose. `calculateMaxLoanFromDbr` inverts this same annuity, so
  // rounding to piastres here loses the round trip and shows the customer a ceiling a
  // few piastres under the figure the bank's own table states. The rounded instalment
  // is reported alongside, for the surfaces that display it.
  const raw = monthlyInstallmentRaw(ceilingEGP, annualRatePercent, tenorMonths);
  if (raw.lessThanOrEqualTo(0)) return null;

  return {
    recognisedIncomeEGP: raw.mul(ONE_HUNDRED).div(baselineDbrPercent),
    installmentAtCeilingEGP: calculateMonthlyInstallment(ceilingEGP, annualRatePercent, tenorMonths),
    baselineDbrPercent,
  };
}
