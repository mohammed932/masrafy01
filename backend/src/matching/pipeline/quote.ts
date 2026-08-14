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
  IncomeResolution,
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
  /**
   * An income resolution the caller has ALREADY computed for this
   * (profile, program) pair. Passed through rather than recomputed: the resolver
   * re-normalizes the whole rule blob and re-resolves the DBR cap on every call, and
   * the engine needs the figure one step earlier for its eligibility check. Two runs
   * also mean two chances to disagree about a number that is about to be frozen onto
   * an offer (Principle I) — the same reasoning step 6 already applies to the cap.
   *
   * Only honoured when the rule would be consulted at all; an `income_proof` program
   * with a declared salary ignores it, exactly as it ignores its own resolver call.
   */
  incomeResolution?: IncomeResolution | null;
}

/**
 * Which reduction gets reported when several applied at once (FR-023).
 * Amount reductions outrank tenor reductions because the amount is the number
 * the customer actually asked for; a shortened term with the full amount is a
 * smaller surprise than a cut amount.
 */
const BINDING_PRECEDENCE: Record<BindingConstraint, number> = {
  dbr_affordability: 5,
  program_max: 4,
  age_at_maturity: 3,
  tenor_max: 2,
  // Lowest of the real constraints: stretching a too-short term UP to the
  // program floor gives the customer more time, not less money, so anything
  // that actually reduced the ask outranks it as the headline.
  tenor_min: 1,
  requested_amount: 0,
};

/**
 * Whether this (applicant, program) pair reads the income RULE at all.
 *
 * On `income_proof` the resolver is still the FALLBACK it has always been, for an
 * applicant who declared nothing at all — `SF-SELF-EMP` is `income_proof` with
 * `byBankStatementPercent`, and dropping that path would blank it out for exactly the
 * applicants it exists to serve. What feature 011 changed is only that a SURROGATE
 * program consults the rule even when a salary was declared.
 *
 * Exported so the engine can decide whether resolving is worth doing before it calls
 * `quoteProgram`: it needs a figure one step earlier for `checkEligibility`, and it
 * used to resolve unconditionally — re-normalizing the rule blob and re-resolving the
 * DBR cap for every `income_proof` program in the loop, whose resolution the quote
 * then discarded. A second copy of this predicate in the engine would be the thing
 * that drifts, so there is one.
 */
export function shouldConsultIncomeRule(
  profile: ApplicantProfile,
  program: BankProgramSnapshot,
): boolean {
  const declared = profile.employment?.monthlyNetSalaryEGP;
  const hasDeclaredIncome = declared !== undefined && declared.greaterThan(0);
  return program.programType === 'income_surrogate' || !hasDeclaredIncome;
}

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

  // ── 3. Income ───────────────────────────────────────────────────────────
  //
  // Two paths, split on `programType`, and the split is the whole of feature 011's
  // engine change.
  //
  // `income_proof`: the DECLARED monthly salary, as typed by the applicant —
  // byte-identical to the pre-011 behaviour (SC-009). Programs may recognise only
  // a fraction of a declared salary for their own credit policy, but the
  // customer-facing figures deliberately do NOT apply that haircut: two screens
  // quoting the same person must show the same number, and the affordability
  // answer is "what your salary supports", not "what this bank would concede".
  //
  // `income_surrogate`: delegate to `resolveAssumedIncome`, which owns the rule.
  // Before this change the declared salary won outright whenever it was > 0, and
  // `monthly_income` is a bound REQUIRED numeric question — so a submitted
  // application ALWAYS carried one, and the program's stored `combinationRule` had
  // never executed on the apply path. A perfectly configured grade table was
  // ignored for every real applicant (research R4). The resolver takes the RAW
  // declared figure as its baseline, preserving the invariant above.
  const declaredIncomeEGP = profile.employment?.monthlyNetSalaryEGP;
  const isSurrogateProgram = program.programType === 'income_surrogate';

  const consultRule = shouldConsultIncomeRule(profile, program);

  const incomeResolution: IncomeResolution | null = consultRule
    ? (input.incomeResolution ??
      resolveAssumedIncome({
        profile,
        income: program.incomeAssumption,
        eligibility: program.eligibility,
      }))
    : null;

  // The two new reasons are raised for SURROGATE programs only. On `income_proof`
  // a failed fallback keeps reporting `NO_RECOGNISED_INCOME`, exactly as today:
  // that program never promised to read a fact, so "we didn't ask you about your
  // military grade" would be a confusing thing to tell its applicant.
  if (isSurrogateProgram && incomeResolution && incomeResolution.origin === 'none') {
    // These two WIN over the generic `NO_RECOGNISED_INCOME` below, which keeps its
    // meaning for every other cause. The distinction is the point: "we never asked
    // you" and "your grade isn't in this bank's table" lead to different admin
    // fixes — assign the question to the category, vs. add the row (research R9).
    // The program stays LISTED and stays RANKED either way (FR-022, FR-024).
    const reason =
      incomeResolution.unresolvedReason === 'no_matching_row' ||
      incomeResolution.unresolvedReason === 'no_matching_band'
        ? 'SURROGATE_NO_MATCHING_ROW'
        : incomeResolution.unresolvedReason === 'fact_not_answered'
          ? 'SURROGATE_FACT_MISSING'
          : // `rule_unconfigured` with no declared salary is not a surrogate
            // problem — the program simply has no income to work from, which is
            // what `NO_RECOGNISED_INCOME` has always meant.
            'NO_RECOGNISED_INCOME';
    return { ok: false, unavailable: { reason } };
  }

  const recognisedIncomeEGP = incomeResolution
    ? incomeResolution.incomeEGP
    : (declaredIncomeEGP ?? new Decimal(0));
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

  // A term SHORTER than the program's floor is stretched UP to it — symmetrical
  // with the ceiling clamp above, and for the same reason: the program is still
  // sellable to this applicant, just on its own shortest term.
  //
  // Rejecting instead is what emptied whole shortlists: the questionnaire lets
  // any applicant ask for 6 months while every personal program floors at 12, so
  // "personal + Doctor Loans, 6 months" dropped BOTH doctor programs and the
  // customer got an empty screen — reported, on top of that, as AGE_AT_MATURITY,
  // which had nothing to do with it.
  if (tenorMonths < minTenor) {
    tenorMonths = minTenor;
    noteConstraint('tenor_min');
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

  // Only the age ceiling can reach here now: the requested term was raised to
  // `minTenor` above, so a term still under the floor means the age cap ate it.
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
  //
  // FR-012 — when the recognised income came FROM the income rule, the rule's own
  // `dbrCapPercentOverride` applies. `resolveAssumedIncome` already decided that
  // (it is the only place that knows the origin) and reports the cap, its source AND
  // its band, so the WHOLE resolution is taken from there rather than re-derived.
  // Re-deriving would need the origin in two places, which is how the two drift — and
  // the band branch was re-running `resolveDbrCap` over the very income the resolver
  // had just run it over, once per program per applicant.
  const { capPercent: dbrCapPercent, bandIndex: dbrBandIndex } = incomeResolution
    ? { capPercent: incomeResolution.dbrCapPercent, bandIndex: incomeResolution.dbrBandIndex }
    : resolveDbrCap(
        {
          dbrCapPercent: program.eligibility.dbrCapPercent,
          dbrBands: program.eligibility.dbrBands,
        },
        recognisedIncomeEGP,
      );
  const dbrCapSource: 'program_default' | 'rule_override' =
    incomeResolution?.dbrCapSource === 'rule_override' ? 'rule_override' : 'program_default';

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

  // The headroom figure: the largest principal this income supports at this
  // tenor and rate, INDEPENDENT of what was asked for. Bounded by the program
  // ceiling — a bank cannot lend past its own maximum however much the income
  // would carry. Priced off the rate at the requested amount, the same rate the
  // affordability loop below starts from.
  const uncappedMax = calculateMaxLoanFromDbr({
    monthlyIncomeEGP: recognisedIncomeEGP,
    existingMonthlyObligationsEGP: obligations,
    dbrCapPercent,
    annualRatePercent: priced.fees.effectiveRateAfterPenaltiesPercent,
    tenorMonths,
    amountStepEGP,
  });
  const maxAffordableAmountEGP = uncappedMax.greaterThan(programMax)
    ? round2(programMax)
    : uncappedMax;

  /** Context carried on every "no figures" exit so the program stays listed. */
  const unavailableContext = {
    maxAffordableAmountEGP,
    dbrCapPercent,
    dbrBandIndex,
    recognisedIncomeEGP,
  };

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
      return {
        ok: false,
        unavailable: { reason: 'OBLIGATIONS_EXCEED_ALLOWANCE', ...unavailableContext },
      };
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
        return {
          ok: false,
          unavailable: { reason: 'OBLIGATIONS_EXCEED_ALLOWANCE', ...unavailableContext },
        };
      }
      if (next.lessThanOrEqualTo(minAmount)) {
        return {
          ok: false,
          unavailable: { reason: 'BELOW_PROGRAM_MIN_AMOUNT', ...unavailableContext },
        };
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
      maxAffordableAmountEGP,
      bindingConstraint: binding,
      recognisedIncomeEGP,
      // Feature 011 — WHERE that income came from. Carried out of the quote so the
      // apply path can FREEZE it on the immutable offer (Principle I / A6) and the
      // admin check panel can name the row it traced to, without either of them
      // re-running the resolver and risking a different answer.
      //
      // `null` on an `income_proof` program that declared a salary: the rule was
      // never consulted, and saying `declared` there would claim a decision the
      // engine did not make.
      incomeResolution,
      dbrCapSource,
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
