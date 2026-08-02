/**
 * Quote — one program + one applicant → the figures a customer sees.
 *
 * Constitution Principle V: pure. No Nest, no Prisma, no HTTP, no clock.
 * Principle I: `Decimal` end to end, banker's rounding, rounded only here.
 *
 * ─── The money identities (FR-022a) ───────────────────────────────────────
 *
 *   offeredAmountEGP      = clampedRequested + totalFeesEGP   ← the booked principal
 *   cashToCustomerEGP     = offeredAmountEGP − totalFeesEGP   ← ( = clampedRequested )
 *   monthlyInstallmentEGP = PMT(offeredAmountEGP, rateAfterPenalties, effectiveTenorMonths)
 *   totalPayableEGP       = monthlyInstallmentEGP × effectiveTenorMonths
 *   totalCostOfCreditEGP  = totalPayableEGP − cashToCustomerEGP
 *
 * Fees are FINANCED: they are added to the principal and the installment is
 * computed on that total, so the amount asked for and the cash received differ
 * by exactly the fees. `data-model.md` describes this inconsistently (it both
 * adds and subtracts the fees); the identities above are the only reading that
 * satisfies every worked example in `contracts/admin-api.md`, and they are
 * numerically identical to the pre-010 engine — no existing offer's figures move.
 *
 * Getting this backwards silently reprices the whole book. Do not "simplify" it.
 *
 * One implementation, four callers — matching preview, apply, the admin draft
 * preview, and the customer calculator — which is how FR-025 preview/apply
 * parity holds by construction rather than by a test that has to be remembered.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  BindingConstraint,
  CascadeTrace,
  QuoteOutcome,
} from '../types';
import { runCascade, type CascadeBundle } from './cascade-adapter';
import { resolveAssumedIncome } from './income-resolver';
import { calculateFees } from './fees';
import { calculateEffectiveLoanAmount, calculateMonthlyInstallment } from './pmt';
import { calculateDbr, calculateMaxLoanFromDbr, resolveDbrCap } from './dbr';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

/**
 * Safety valve on the affordability loop. Each pass strictly decreases the
 * amount, so the loop terminates on its own; this only bounds pathological
 * configurations (a fee schedule so steep that shrinking barely moves the EMI).
 */
const MAX_AFFORDABILITY_PASSES = 8;

export interface QuoteInput {
  profile: ApplicantProfile;
  program: BankProgramSnapshot;
  /**
   * MVP behaviour (the apply path): never reduce the amount for DBR. Mirrors
   * `EngineInput.skipEligibility`. The program's own `skipDbrCheck` is honoured
   * independently — either one disables the reduction.
   */
  skipDbrCheck?: boolean;
  /** Calculator cost-mode override of the requested amount. */
  overrideAmountEGP?: Decimal;
  /** Calculator override of the requested tenor. */
  overrideTenorMonths?: number;
}

/**
 * Which reduction gets reported when several applied at once (FR-023).
 * Amount reductions outrank tenor reductions because the amount is the number
 * the customer actually asked for; a shortened term with the full amount is a
 * smaller surprise than a cut amount.
 */
const BINDING_PRECEDENCE: Record<BindingConstraint, number> = {
  dbr_affordability: 4,
  program_max: 3,
  age_at_maturity: 2,
  tenor_max: 1,
  requested_amount: 0,
};

export function quoteProgram(input: QuoteInput): QuoteOutcome {
  const { profile, program } = input;
  const currency = profile.requestedCurrency;

  // ── 1. Currency ─────────────────────────────────────────────────────────
  const limitsForCurrency = program.loanLimits?.perCurrency?.[currency];
  if (!program.currencies.includes(currency) || !limitsForCurrency) {
    return { ok: false, unavailable: { reason: 'CURRENCY_NOT_OFFERED' } };
  }

  // ── 2. Misconfiguration — collect every offending path, don't fail fast ──
  const cascade = runCascade(program, profile);
  const problems: string[] = [];

  const ratePercent = toFiniteDecimal(cascade.pricing.effectiveRatePercent);
  if (ratePercent === null || ratePercent.lessThan(0)) {
    problems.push(
      program.pricing?.isVariableRate
        ? 'pricing.currentEffectiveRatePercent'
        : 'pricing.baseRatePercent',
    );
  }

  const programMax = toFiniteDecimal(cascade.loanLimit.maxAmount);
  if (programMax === null || programMax.lessThanOrEqualTo(0)) {
    problems.push(`loanLimits.perCurrency.${currency}.maxAmount`);
  }

  const minTenor = program.tenor?.minMonths ?? 0;
  const cascadeMaxTenor = cascade.tenor.maxMonths;
  if (!Number.isFinite(cascadeMaxTenor) || cascadeMaxTenor < 1) {
    problems.push('tenor.maxMonths');
  } else if (minTenor > cascadeMaxTenor) {
    // Inverted range — either `tenor` itself or a by-X override pushed the
    // ceiling under the floor. Reported as an offending path, same as a
    // missing one: both make the program unquotable until an admin fixes it.
    problems.push('tenor.minMonths');
  }

  if (problems.length > 0 || ratePercent === null || programMax === null) {
    return { ok: false, unavailable: { reason: 'PROGRAM_MISCONFIGURED', missing: problems } };
  }

  // ── 3. Recognised income ────────────────────────────────────────────────
  // Declared income after the program's income assumption. Every downstream
  // figure keys off this, NOT off declared income.
  const recognisedIncomeEGP = resolveAssumedIncome(
    profile,
    program.incomeAssumption,
    program.eligibility,
  );
  if (recognisedIncomeEGP.lessThanOrEqualTo(0)) {
    return { ok: false, unavailable: { reason: 'NO_RECOGNISED_INCOME' } };
  }

  // ── 4. Tenor: program ceiling, then age at maturity ─────────────────────
  let binding: BindingConstraint = 'requested_amount';
  const noteConstraint = (candidate: BindingConstraint): void => {
    if (BINDING_PRECEDENCE[candidate] > BINDING_PRECEDENCE[binding]) binding = candidate;
  };

  let tenorMonths = Math.floor(input.overrideTenorMonths ?? profile.preferredTenorMonths);
  if (tenorMonths > cascadeMaxTenor) {
    tenorMonths = cascadeMaxTenor;
    noteConstraint('tenor_max');
  }

  // The loan must be repaid before the applicant passes the program's age
  // ceiling, so the term is shortened rather than the program rejected.
  const maxAge = program.eligibility?.maxAge;
  if (typeof maxAge === 'number' && Number.isFinite(maxAge)) {
    const monthsUntilAgeCap = Math.floor((maxAge - profile.age) * 12);
    if (monthsUntilAgeCap < tenorMonths) {
      tenorMonths = monthsUntilAgeCap;
      noteConstraint('age_at_maturity');
    }
  }

  if (tenorMonths < 1 || tenorMonths < minTenor) {
    return { ok: false, unavailable: { reason: 'AGE_AT_MATURITY' } };
  }

  // ── 5. Amount: clamp down to the program ceiling ────────────────────────
  const minAmount = toFiniteDecimal(limitsForCurrency.minAmount) ?? new Decimal(0);
  let cash = round2(input.overrideAmountEGP ?? profile.requestedAmountEGP);
  if (cash.greaterThan(programMax)) {
    cash = round2(programMax);
    noteConstraint('program_max');
  }

  const amountStepEGP = toPositiveDecimal(program.loanLimits.amountStepEGP);

  // Price at a given cash amount. Note `effectiveLoanAmountEGP: cash` — the
  // life-insurance base is the pre-fee amount, matching the pre-010 engine.
  const priceAt = (amount: Decimal) => {
    const fees = calculateFees(program.fees, {
      requestedAmountEGP: amount,
      effectiveLoanAmountEGP: amount,
      annualRatePercent: ratePercent,
      tenorMonths,
      collateralized: program.eligibility?.requiresCollateral ?? false,
    });
    const booked = calculateEffectiveLoanAmount(amount, fees.totalFinancedFeesEGP);
    const installment = calculateMonthlyInstallment(
      booked,
      fees.effectiveRateAfterPenaltiesPercent,
      tenorMonths,
    );
    return { fees, booked, installment };
  };

  // ── 6. Fees → booked principal → installment → DBR ──────────────────────
  const { capPercent: dbrCapPercent, bandIndex: dbrBandIndex } = resolveDbrCap(
    { dbrCapPercent: program.eligibility.dbrCapPercent, dbrBands: program.eligibility.dbrBands },
    recognisedIncomeEGP,
  );

  const obligations = profile.obligations.existingMonthlyObligationsEGP;
  const dbrAt = (installment: Decimal) =>
    calculateDbr(
      {
        monthlyIncomeEGP: recognisedIncomeEGP,
        existingMonthlyObligationsEGP: obligations,
        newMonthlyInstallmentEGP: installment,
      },
      dbrCapPercent,
    );

  let priced = priceAt(cash);
  let dbr = dbrAt(priced.installment);

  // ── 7. Affordability (FR-022b) ──────────────────────────────────────────
  //
  // The check must use the SAME installment the customer is shown, so a quote
  // can never be presented that breaks its own cap.
  //
  // `calculateMaxLoanFromDbr` inverts the annuity on the PRINCIPAL, but the
  // installment is computed on principal + financed fees — so one pass can
  // still land above the cap by the fee-financing delta. Hence the loop.
  const dbrDisabled = (input.skipDbrCheck ?? false) || program.eligibility.skipDbrCheck === true;

  if (!dbr.withinCap && !dbrDisabled) {
    const maxAffordableInstallment = recognisedIncomeEGP
      .mul(dbrCapPercent)
      .div(100)
      .minus(obligations);
    if (maxAffordableInstallment.lessThanOrEqualTo(0)) {
      return { ok: false, unavailable: { reason: 'OBLIGATIONS_EXCEED_ALLOWANCE' } };
    }

    let next = calculateMaxLoanFromDbr({
      monthlyIncomeEGP: recognisedIncomeEGP,
      existingMonthlyObligationsEGP: obligations,
      dbrCapPercent,
      annualRatePercent: priced.fees.effectiveRateAfterPenaltiesPercent,
      tenorMonths,
      applicantRequestedEGP: cash,
      amountStepEGP,
    });

    for (let pass = 0; ; pass++) {
      if (next.lessThanOrEqualTo(0)) {
        return { ok: false, unavailable: { reason: 'OBLIGATIONS_EXCEED_ALLOWANCE' } };
      }
      if (next.lessThanOrEqualTo(minAmount)) {
        return { ok: false, unavailable: { reason: 'BELOW_PROGRAM_MIN_AMOUNT' } };
      }

      cash = next;
      priced = priceAt(cash);
      dbr = dbrAt(priced.installment);
      if (dbr.withinCap || pass >= MAX_AFFORDABILITY_PASSES) break;

      // Still over: shrink in proportion to the overshoot, then force a strict
      // decrease so the loop cannot stall on a rounding plateau.
      const shrunk = cash.mul(maxAffordableInstallment).div(priced.installment);
      next = floorToStep(shrunk, amountStepEGP);
      if (next.greaterThanOrEqualTo(cash)) {
        next = floorToStep(cash.minus(amountStepEGP ?? new Decimal('0.01')), amountStepEGP);
      }
    }

    noteConstraint('dbr_affordability');
  }

  // ── 8. Assemble ─────────────────────────────────────────────────────────
  const totalFeesEGP = round2(priced.fees.totalFinancedFeesEGP);
  const offeredAmountEGP = round2(priced.booked);
  const cashToCustomerEGP = round2(offeredAmountEGP.minus(totalFeesEGP));
  const monthlyInstallmentEGP = round2(priced.installment);
  const totalPayableEGP = round2(monthlyInstallmentEGP.mul(tenorMonths));

  return {
    ok: true,
    quote: {
      offeredAmountEGP,
      cashToCustomerEGP,
      totalFeesEGP,
      monthlyInstallmentEGP,
      effectiveTenorMonths: tenorMonths,
      effectiveRatePercent: priced.fees.effectiveRateAfterPenaltiesPercent,
      totalPayableEGP,
      totalCostOfCreditEGP: round2(totalPayableEGP.minus(cashToCustomerEGP)),
      // Derived from the FINAL installment, so a DBR-adjusted quote reports the
      // ratio of the payment actually offered. The pre-010 engine persisted the
      // pre-adjustment ratio, describing a payment that was never on the table.
      dbrPercent: dbr.dbrPercent,
      dbrCapPercent,
      dbrBandIndex,
      bindingConstraint: binding,
      recognisedIncomeEGP,
      feesBreakdown: priced.fees.breakdown,
      currency,
      cascadeTrace: buildCascadeTrace(cascade),
    },
  };
}

/** Shared by the engine and every quote consumer so the trace shape cannot drift. */
export function buildCascadeTrace(cascade: CascadeBundle): CascadeTrace {
  return {
    matchedPricingLevel: cascade.pricing.matchedLevel,
    matchedTenorLevel: cascade.tenor.matchedLevel,
    matchedLoanLimitLevel: cascade.loanLimit.matchedLevel,
    pricingDerivation: cascade.pricing.derivationChain,
    steps: cascade.steps,
  };
}

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, ROUND_BANKERS);
}

function floorToStep(value: Decimal, step?: Decimal): Decimal {
  if (!step || step.lessThanOrEqualTo(0)) return value.toDecimalPlaces(2, Decimal.ROUND_DOWN);
  return value.div(step).floor().mul(step);
}

function toFiniteDecimal(value: string | number | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function toPositiveDecimal(value: string | number | null | undefined): Decimal | undefined {
  const parsed = toFiniteDecimal(value);
  return parsed && parsed.greaterThan(0) ? parsed : undefined;
}
