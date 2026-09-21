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
import { runCascade, type CascadeBundle, type CascadeExtras } from './cascade-adapter';
import { resolveAssumedIncome } from './income-resolver';
import { applyIScoreFactor, iScoreOf, resolveIScoreFactor } from './iscore';
import { calculateFees } from './fees';
import { calculateEffectiveLoanAmount, calculateMonthlyInstallment } from './pmt';
import { calculateDbr, calculateMaxLoanFromDbr, resolveDbrCap } from './dbr';
import { rateBasisOf } from './rate-basis';
import { ceilingToIncome } from './product-rule-ceiling';
import { factsForProgram } from './bank-relationship';
import { resolveFactGrid } from './fact-grid';
import { resolveAdditionalIncome } from './additional-income';
import { resolveMaxLoanByFact } from './max-loan-by-fact';
import { ltvAmountFor, ltvByFactFor, ltvCeilingFor } from './ltv-ceiling';
import { applyMaxLoanAdjustments } from './max-loan-adjustments';
import { CAR_AGE_YEARS_FACT_KEY } from './car-details';

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
  /**
   * Lookup value -> registry `parentKey`, forwarded to the resolver for a product rule's
   * `factParentTable` step. Only read when this function resolves the rule ITSELF; a
   * caller that passes `incomeResolution` has already applied it.
   */
  parentKeyByValue?: Readonly<Record<string, string>>;
}

/**
 * Which reduction gets reported when several applied at once (FR-023).
 * Amount reductions outrank tenor reductions because the amount is the number
 * the customer actually asked for; a shortened term with the full amount is a
 * smaller surprise than a cut amount.
 */
const BINDING_PRECEDENCE: Record<BindingConstraint, number> = {
  dbr_affordability: 6,
  // Above `program_max` and below the DBR shrink: a collateral ceiling is the more
  // specific of the two amount ceilings ("the program would lend more, this unit will
  // not carry more"), but if affordability then cut it further, that is the headline.
  collateral_ceiling: 5,
  /**
   * Beside `collateral_ceiling`, above `program_max`: both are the specific statement
   * "the program would lend more, THIS row does not". Below the collateral ceiling only
   * because a ceiling the applicant's own unit imposes is the more surprising of the two.
   */
  program_max_by_fact: 5,
  /**
   * Beside the other two specific ceilings: "the program would lend more, this car will not
   * carry more". It is also the one a customer can act on — it names the down payment they
   * have to find.
   */
  ltv_ceiling: 5,
  program_max: 4,
  age_at_maturity: 3,
  /**
   * With `age_at_maturity`, because both shorten the TERM rather than cut the amount and both
   * are more specific than the program's flat `tenor_max`. `resolveTenor` reports whichever
   * of the two produced the final term, so an equal ranking never has to break a tie.
   */
  vehicle_tenor_cap: 3,
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

interface TenorPlan {
  /** The term that was asked for, kept so the caller can tell whether anything moved. */
  readonly requested: number;
  /** The term the loan is repaid over. */
  readonly months: number;
  /** In the order they applied, so the caller reports the same binding it always did. */
  readonly constraints: readonly BindingConstraint[];
  /**
   * Which ceiling drove the term BELOW the program's own floor, when one did.
   *
   * `null` whenever the term is sellable. It exists because the two ceilings are not
   * interchangeable in a refusal: telling a 34-year-old that "no available term keeps you
   * within this program's age limit" is a false statement about them when what happened is
   * that their bank finances a car this old for twelve months and the programme's floor is
   * twenty-four.
   */
  readonly belowFloorCause: BindingConstraint | null;
}

/**
 * The term the loan is actually repaid over: the requested term brought inside the
 * program's ceiling, then its floor, then the applicant's age at maturity.
 *
 * Pure, and lifted out of step 3, because the answer is needed TWICE — once to PRICE the
 * loan (`rateByTenor` is keyed by the term) and once to report which constraint bound it —
 * and computing it in two places is precisely how the priced loan and the reported loan
 * come apart. The order of the three clamps is unchanged and is load-bearing: the floor is
 * applied after the ceiling, so a program with an inverted range is caught at step 1
 * rather than here, and the age cap is applied last because it is the only one that can
 * legitimately drive the term below the floor and refuse the program.
 *
 * Total by construction — a non-finite ceiling skips its clamp rather than poisoning the
 * term with NaN, because step 1 has already recorded that as a misconfiguration and is
 * about to return; this must not throw on the way there.
 */
function resolveTenor(input: {
  requested: number;
  minMonths: number;
  maxMonths: number;
  maxAge?: number;
  age: number;
  /** The ceiling this vehicle carries, when the program states a table and a row matched. */
  vehicleMaxMonths?: number | null;
}): TenorPlan {
  const constraints: BindingConstraint[] = [];
  let months = input.requested;

  if (Number.isFinite(input.maxMonths) && months > input.maxMonths) {
    months = input.maxMonths;
    constraints.push('tenor_max');
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
  if (months < input.minMonths) {
    months = input.minMonths;
    constraints.push('tenor_min');
  }

  // The two ceilings that shorten rather than refuse. Only the one that produces the FINAL
  // term is reported: they share a precedence, and `noteConstraint` breaks a tie by call
  // order, which would otherwise credit the vehicle table for a cut the age cap made.
  let ceiling: BindingConstraint | null = null;

  // The bank finances this car for at most N months, whatever the applicant asked for.
  const vehicleMax = input.vehicleMaxMonths;
  if (typeof vehicleMax === 'number' && Number.isFinite(vehicleMax) && vehicleMax < months) {
    months = vehicleMax;
    ceiling = 'vehicle_tenor_cap';
  }

  // The loan must be repaid before the applicant passes the program's age
  // ceiling, so the term is shortened rather than the program rejected.
  if (typeof input.maxAge === 'number' && Number.isFinite(input.maxAge)) {
    const monthsUntilAgeCap = Math.floor((input.maxAge - input.age) * 12);
    if (monthsUntilAgeCap < months) {
      months = monthsUntilAgeCap;
      ceiling = 'age_at_maturity';
    }
  }
  if (ceiling !== null) constraints.push(ceiling);

  // The floor is applied BEFORE the two ceilings, so either of them can push the term back
  // under it. Which one did is the difference between two refusals a customer reads very
  // differently, so it travels rather than being guessed at the return site.
  const belowFloorCause = months < input.minMonths ? ceiling : null;

  return { requested: input.requested, months, constraints, belowFloorCause };
}

export function quoteProgram(input: QuoteInput): QuoteOutcome {
  const { profile, program } = input;

  // ── 0. The platform is withholding the calculation ───────────────────────
  //
  // FIRST, and deliberately so. Two reasons: `input.incomeResolution` can be supplied
  // by the caller further down, so a check placed after the resolution would be skipped
  // for exactly those callers; and there is no point running the pricing cascade to
  // produce a figure nobody will read.
  //
  // Its own outcome rather than a missing rule, because a missing rule is not inert: on
  // a single-fact product the resolver falls through to the declared salary, and this
  // program would quietly start pricing off a payslip instead of reporting that the
  // product it quotes from is switched off.
  if (program.incomeRuleWithheld !== undefined) {
    return { ok: false, unavailable: { reason: 'SURROGATE_PRODUCT_RETIRED' } };
  }

  // ── 1. Misconfiguration — collect every offending path, don't fail fast ──
  //
  // The cascade runs in two passes, and the ORDER is load-bearing. `evaluateTenor` and
  // `evaluateLoanLimit` read no term, so the first pass settles both. PRICING does read one
  // — `rateByTenor` is keyed by it — so it must be evaluated against the term the loan is
  // REPAID over, and the program's ceiling, its floor and the applicant's age at maturity
  // can each move that away from the term the customer typed. Pricing one term while
  // writing another quotes a four-year loan at a ten-year rate.
  //
  // The facts are built ONCE here and reused by every reader below — the rate grid, the
  // vehicle term ceiling and the cap table. They were built at step 3c before, which was
  // fine while only the cap read them; a grid in the cascade needs them one step earlier,
  // and two builds would be two chances to disagree about what this applicant answered.
  const programFacts = factsForProgram({
    profile,
    ...(program.bankName !== undefined ? { programBankName: program.bankName } : {}),
  });
  const gridExtras: CascadeExtras = {
    facts: programFacts,
    ...(input.parentKeyByValue !== undefined ? { parentKeyByValue: input.parentKeyByValue } : {}),
  };

  const firstPass = runCascade(program, profile, gridExtras);
  const problems: string[] = [];

  // Tenor is checked FIRST now, because the term it settles is an input to the pricing
  // pass below. The checks themselves are unchanged.
  const minTenor = program.tenor?.minMonths ?? 0;
  const cascadeMaxTenor = firstPass.tenor.maxMonths;
  if (!Number.isFinite(cascadeMaxTenor) || cascadeMaxTenor < 1) {
    problems.push('tenor.maxMonths');
  } else if (minTenor > cascadeMaxTenor) {
    // Inverted range — either `tenor` itself or a by-X override pushed the
    // ceiling under the floor. Reported as an offending path, same as a
    // missing one: both make the program unquotable until an admin fixes it.
    problems.push('tenor.minMonths');
  }

  // ── 1a½. Is this car too OLD to finance at all ──────────────────────────
  //
  // A standalone refusal, not a clamp: "German from 2015, maximum 8 years back" says nothing
  // about the TERM, it says the bank will not write this loan. Run before the term ceiling
  // below, which assumes the car is eligible and only differs on how long to finance it.
  //
  // `car_age_years` is engine-derived (`withGridFacts`, read against the clock once per
  // quote) and absent whenever `car_model_year` was never answered — that question is
  // optional, so a skipped one must not refuse here. The grid's own `useFallback` /
  // `reject` split is read the same way: an applicant this table has nothing to say about
  // (unanswered origin or dealer) gets `useFallback`, meaning "no extra restriction", never
  // a refusal for having skipped an optional question.
  const ageGrid = program.tenor?.maxVehicleAgeYearsByFact;
  if (ageGrid !== undefined) {
    const carAgeFact = (firstPass.ctx.facts ?? programFacts)[CAR_AGE_YEARS_FACT_KEY];
    if (carAgeFact !== undefined && carAgeFact.kind === 'numeric' && carAgeFact.value.isFinite()) {
      const hit = resolveFactGrid({
        config: ageGrid,
        facts: firstPass.ctx.facts ?? programFacts,
        ...(input.parentKeyByValue !== undefined
          ? { parentKeyByValue: input.parentKeyByValue }
          : {}),
      });
      if (hit.matched && carAgeFact.value.greaterThan(hit.value)) {
        return { ok: false, unavailable: { reason: 'VEHICLE_NOT_ELIGIBLE' } };
      }
      if (!hit.matched && hit.action === 'reject') {
        return {
          ok: false,
          unavailable: {
            reason: 'VEHICLE_NOT_ELIGIBLE',
            ...(hit.missingFactKeys.length > 0
              ? { missingFactKeys: [...hit.missingFactKeys] }
              : {}),
          },
        };
      }
      // `!hit.matched && hit.action === 'useFallback'`: this table has nothing to say about
      // this applicant's origin/dealer combination, so no extra age restriction applies.
    }
    // `carAgeFact === undefined`: the model year was never answered. The car's age is
    // unknown, not zero, and an age table is not the place to demand an optional answer.
  }

  // ── 1b. The term ceiling this VEHICLE carries ───────────────────────────
  //
  // A bank's used-car card prints a table, not a formula: "German from 2015 → 3 years,
  // Chinese from 2023 at 50% down → 4". The engine reads that table and knows nothing about
  // what "german" means or that 2015 is a year — the keys and the figures are the bank's
  // (Principle II / A1) — and it holds no clock, so a model-year rule cannot drift under a
  // frozen offer (Principle V / A6).
  //
  // Resolved BEFORE the term is settled, because it is one of the things that settles it.
  const vehicleGrid = program.tenor?.maxMonthsByFact;
  let vehicleMaxMonths: number | null = null;
  if (vehicleGrid !== undefined) {
    const hit = resolveFactGrid({
      config: vehicleGrid,
      // The facts the cascade itself was given, so the down-payment share a vehicle rule
      // keys on is the same number the rate banded on.
      facts: firstPass.ctx.facts ?? programFacts,
      ...(input.parentKeyByValue !== undefined ? { parentKeyByValue: input.parentKeyByValue } : {}),
    });
    if (hit.matched) {
      vehicleMaxMonths = Math.floor(hit.value.toNumber());
    } else if (hit.action === 'reject') {
      // The bank finances no car of this age, origin or down payment. A stated refusal, not
      // a filter: the program stays listed and ranked (Principle V / A33), and the reason is
      // the customer's to act on — a different car, or a bigger deposit.
      return {
        ok: false,
        unavailable: {
          reason: 'VEHICLE_NOT_ELIGIBLE',
          ...(hit.missingFactKeys.length > 0 ? { missingFactKeys: [...hit.missingFactKeys] } : {}),
        },
      };
    }
  }

  // The term FLOOR this plan states, composed by `max` so it only ever RAISES the program's
  // own. A floor that could lower one would let a table undercut a minimum the bank typed,
  // which is the direction `minAmountByFact` below is also refused.
  const planMinGrid = program.tenor?.minMonthsByFact;
  let planMinMonths = minTenor;
  if (planMinGrid !== undefined) {
    const hit = resolveFactGrid({
      config: planMinGrid,
      facts: firstPass.ctx.facts ?? programFacts,
      ...(input.parentKeyByValue !== undefined ? { parentKeyByValue: input.parentKeyByValue } : {}),
    });
    if (hit.matched) {
      planMinMonths = Math.max(minTenor, Math.ceil(hit.value.toNumber()));
    } else if (hit.action === 'reject') {
      // Same refusal and the same reason code as the ceiling one above: a plan that states
      // no shortest term for this applicant is a plan this bank does not sell them.
      return {
        ok: false,
        unavailable: {
          reason: 'VEHICLE_NOT_ELIGIBLE',
          ...(hit.missingFactKeys.length > 0 ? { missingFactKeys: [...hit.missingFactKeys] } : {}),
        },
      };
    }
  }

  // Resolved ONCE and read twice: here, to price the loan on the right term, and at step 3
  // to report which constraint bound it. Two computations of one term is exactly how the
  // priced loan and the reported loan come apart.
  const tenorPlan = resolveTenor({
    requested: Math.floor(input.overrideTenorMonths ?? profile.preferredTenorMonths),
    minMonths: planMinMonths,
    maxMonths: cascadeMaxTenor,
    maxAge: program.eligibility?.maxAge,
    age: profile.age,
    vehicleMaxMonths,
  });

  // Second pass only when the term actually moved, so a program whose applicant asked for a
  // term it can write is byte-identical to before this split existed.
  const cascade =
    tenorPlan.months === tenorPlan.requested
      ? firstPass
      : runCascade(program, profile, { ...gridExtras, tenorMonths: tenorPlan.months });

  // A grid that matched nothing and whose bank chose `reject` STOPS here. There is no safe
  // fallback rate — see `fact-grid.ts` — and quoting one would freeze a figure no bank
  // stated onto an immutable offer, with the DBR and the whole affordability loop measured
  // against it.
  const refusal = cascade.pricing.refusal;
  if (refusal !== undefined) {
    return {
      ok: false,
      unavailable: {
        reason: 'NO_RATE_FOR_ANSWER',
        ...(refusal.missingFactKeys.length > 0
          ? { missingFactKeys: [...refusal.missingFactKeys] }
          : {}),
      },
    };
  }

  const ratePercent = toFiniteDecimal(cascade.pricing.effectiveRatePercent);
  // How that rate is charged. Read ONCE here and passed to every formula below: a quote
  // that prices the instalment one way and inverts it the other misstates the loan by
  // 22–29% (`rate-basis.ts`). Absent reads as the reducing annuity, which is what every
  // program configured before the field existed was priced by.
  const rateBasis = rateBasisOf(program.pricing);
  if (ratePercent === null || ratePercent.lessThan(0)) {
    problems.push(
      program.pricing?.isVariableRate
        ? 'pricing.currentEffectiveRatePercent'
        : 'pricing.baseRatePercent',
    );
  }

  const programMaxConfigured = toFiniteDecimal(cascade.loanLimit.maxAmount);
  if (programMaxConfigured === null || programMaxConfigured.lessThanOrEqualTo(0)) {
    problems.push('loanLimits.maxAmountEGP');
  }

  if (problems.length > 0 || ratePercent === null || programMaxConfigured === null) {
    return { ok: false, unavailable: { reason: 'PROGRAM_MISCONFIGURED', missing: problems } };
  }

  // ── 2. Income ───────────────────────────────────────────────────────────
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
        // Which bank this is, for the derived `bank_relationship` fact: a rule may price an
        // existing customer off a second column, and that is a per-program answer.
        programBankName: program.bankName,
        ...(input.parentKeyByValue !== undefined
          ? { parentKeyByValue: input.parentKeyByValue }
          : {}),
      }))
    : null;

  // The two new reasons are raised for SURROGATE programs only. On `income_proof`
  // a failed fallback keeps reporting `NO_RECOGNISED_INCOME`, exactly as today:
  // that program never promised to read a fact, so "we didn't ask you about your
  // military grade" would be a confusing thing to tell its applicant.
  // A ceiling is not an income and cannot be judged as one yet: the figure it implies
  // needs the rate and the FINAL tenor, and step 3 has not run. Deferred to step 3b.
  // `let`, because step 2a below scales it by the applicant's I-Score. Its NULL-ness never
  // moves — that is decided by `origin` alone — so every `ceilingAmountEGP === null` test
  // downstream reads exactly what it always did.
  let ceilingAmountEGP =
    incomeResolution?.origin === 'ceiling' ? (incomeResolution.ceilingAmountEGP ?? null) : null;

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
          : // A product-rule GATE refused. Its own reason, because nothing about this
            // applicant's income was in question: the down payment is short, the
            // contract is outside the window, the unit was not confirmed. The gate's
            // own code says which, and both locale dictionaries have a sentence for it.
            incomeResolution.unresolvedReason === 'gate_failed'
            ? 'PRODUCT_RULE_GATE_FAILED'
            : // `rule_unconfigured` with no declared salary is not a surrogate
              // problem — the program simply has no income to work from, which is
              // what `NO_RECOGNISED_INCOME` has always meant.
              'NO_RECOGNISED_INCOME';
    return {
      ok: false,
      unavailable: {
        reason,
        ...(incomeResolution.gateId !== undefined ? { gateId: incomeResolution.gateId } : {}),
        ...(incomeResolution.gateReasonCode !== undefined
          ? { gateReasonCode: incomeResolution.gateReasonCode }
          : {}),
        // WHICH answers are missing, not merely that some are — what lets the customer be
        // shown "answer these six questions about your unit" instead of a blank.
        ...(incomeResolution.missingFactKeys !== undefined
          ? { missingFactKeys: incomeResolution.missingFactKeys }
          : {}),
      },
    };
  }

  let recognisedIncomeEGP = incomeResolution
    ? incomeResolution.incomeEGP
    : (declaredIncomeEGP ?? new Decimal(0));

  // ── 2a. The bureau score ────────────────────────────────────────────────
  //
  // HERE, and the position is the whole of why the v30.3.0 refactor moves no money. Until
  // then this was four compiled steps INSIDE a surrogate product's rule, applied to the
  // rule's output before `output.from` read it — so it landed after the arithmetic and
  // before the additional income and the debt-burden band. This is the same point.
  //
  // Both quantities, and `school_stage_ceiling` is why: it is the one seeded product whose
  // output is a `maxAmount`, and its tiers scaled that ceiling while they lived in the
  // rule. Scaling only the income would have silently dropped I-Score for it.
  //
  // ON EVERY PROGRAM TYPE, which is the point of the move. `shouldConsultIncomeRule` never
  // reads a rule for a payslip applicant who declared a salary, so nothing stored inside
  // the rule could ever have reached them — 54 of 71 programs could not state a table at
  // all. Nothing here asks what `programType` is.
  //
  // A 100% factor returns the SAME Decimal (`applyIScoreFactor` short-circuits), so a
  // program with no tiers — every program on this database but seventeen — allocates
  // nothing and is arithmetically untouched.
  const iScore = resolveIScoreFactor(program.iScoreTiers, iScoreOf(profile));
  const incomeBeforeIScore = recognisedIncomeEGP;
  recognisedIncomeEGP = applyIScoreFactor(recognisedIncomeEGP, iScore.factorPercent);
  if (ceilingAmountEGP !== null) {
    ceilingAmountEGP = applyIScoreFactor(ceilingAmountEGP, iScore.factorPercent);
  }
  // DID THE MULTIPLIER MOVE THE FIGURE? Step 5 needs to know, because the resolver picked a
  // debt-burden BAND against the figure as it stood before this line, and `dbrBands` are
  // keyed BY INCOME — a multiplier that carries an applicant over a band edge would
  // otherwise leave them capped as the person they were before their score was read.
  //
  // This is the property `iscore-before-dbr.spec.ts` exists to pin. It used to hold
  // structurally: the multiplier was four steps INSIDE the rule, so the resolver's own
  // `resolveDbrCap` already saw the multiplied figure. Moving the multiply out here made it a
  // property that has to be maintained, so it is measured rather than assumed — compared on
  // the FIGURES and not on `factorPercent`, because a 100% table and no table at all must
  // both count as "nothing moved" and neither should trigger a re-resolve.
  const iScoreMovedIncome = !recognisedIncomeEGP.equals(incomeBeforeIScore);

  // ── 2b. Money earned beside the basic figure ────────────────────────────
  //
  // Rents at 50%, certificate returns at 75%, allowances at 100 / 75, and a ceiling on the
  // total as a share of the basic — one live sheet states all five (spec §10.11).
  //
  // HERE, and the position is load-bearing in both directions. After the basic figure, so
  // the cap is measured against what the rule actually produced (I-Score included — it is
  // applied inside the rule). Before the debt-burden cap is chosen below, because `dbrBands`
  // are keyed BY INCOME: adding income after the band was picked quotes this applicant on
  // the band of somebody who earns less.
  //
  // A CEILING is skipped deliberately: it is what the collateral supports, not an opinion
  // about what the applicant earns, and rental income does not make a unit bigger. Its own
  // implied income is derived at step 3b and is not an income this can add to.
  const additional =
    ceilingAmountEGP === null
      ? resolveAdditionalIncome({
          config: program.incomeAssumption?.additionalIncome,
          facts: profile.surrogateFacts ?? {},
          basicIncomeEGP: recognisedIncomeEGP,
        })
      : null;
  if (additional && additional.addedEGP.greaterThan(0)) {
    recognisedIncomeEGP = recognisedIncomeEGP.plus(additional.addedEGP);
  }
  // A ceiling resolution carries `incomeEGP: 0` by construction, so its guard moves to
  // step 3b, after the conversion. Every other path is unchanged.
  if (ceilingAmountEGP === null && recognisedIncomeEGP.lessThanOrEqualTo(0)) {
    return { ok: false, unavailable: { reason: 'NO_RECOGNISED_INCOME' } };
  }

  // ── 3. Tenor: program ceiling, then age at maturity ─────────────────────
  let binding: BindingConstraint = 'requested_amount';
  const noteConstraint = (candidate: BindingConstraint): void => {
    if (BINDING_PRECEDENCE[candidate] > BINDING_PRECEDENCE[binding]) binding = candidate;
  };

  // Already resolved at step 1, because the rate had to be picked on this term rather than
  // on the one that was asked for. Replayed here in the order `resolveTenor` applied it, so
  // the reported constraint is the same one it always was.
  const tenorMonths = tenorPlan.months;
  for (const constraint of tenorPlan.constraints) noteConstraint(constraint);

  // A term still under the floor means one of the two CEILINGS pushed it back there — the
  // floor stretch runs before both. Which one is what the customer is told: the vehicle table
  // is a fact about the car they can act on, and reporting it as an age limit is a sentence
  // about them that is not true.
  if (tenorMonths < 1 || tenorMonths < minTenor) {
    return tenorPlan.belowFloorCause === 'vehicle_tenor_cap'
      ? { ok: false, unavailable: { reason: 'VEHICLE_NOT_ELIGIBLE' } }
      : { ok: false, unavailable: { reason: 'AGE_AT_MATURITY' } };
  }

  // ── 3b. Collateral ceiling → the income it implies ──────────────────────
  //
  // Runs HERE and nowhere else, because here is the first point at which both halves of
  // the conversion exist: the cascade rate (step 1) and the final tenor (step 3). The
  // resolver cannot do it — it knows neither — and doing it in two places would be two
  // chances to disagree about a figure an offer is about to freeze (Principle I).
  //
  // The rate used is the CASCADE rate, not the fee-penalty-adjusted one: the ceiling is a
  // credit-policy figure the bank set before anyone elected to waive an admin fee.
  // ── 3b. The program's own CAP: the flat maximum, the table keyed by an answer,
  //        and the adjustments that lift or share it ──────────────────────────
  //
  // Computed BEFORE the collateral ceiling below, and that order is the whole of §10.4:
  // an adjustment declared on the CAP lifts the bank's own ceiling, never the ceiling the
  // applicant's unit imposes. `min` is taken afterwards, so the three compose and the lowest
  // wins whichever one it is.
  //
  // Nine of the source sheets print the table under "Loan Amount — Maximum" — by property
  // type, city, CD tier, school type, branch, company coding, down-payment bracket. It reads
  // as "two ways to reach the figure, take the lower" and it is not: see
  // `max-loan-by-fact.ts`, including why capping the AMOUNT here gives the same figure to
  // the piastre as capping the INCOME upstream would (the map is monotonic, so `min`
  // commutes with it).
  let programCap = programMaxConfigured;
  let capCameFromTable = false;
  const maxLoanByFact = program.loanLimits?.maxLoanByFact;
  if (maxLoanByFact !== undefined) {
    const capped = resolveMaxLoanByFact({
      config: maxLoanByFact,
      facts: programFacts,
      ...(input.parentKeyByValue !== undefined ? { parentKeyByValue: input.parentKeyByValue } : {}),
    });
    if (capped.matched) {
      if (capped.maxAmountEGP.lessThan(programCap)) {
        programCap = capped.maxAmountEGP;
        capCameFromTable = true;
      }
    } else if (capped.action === 'reject') {
      // The bank chose refusal over a fallback. A "no figures" outcome, not a filter: the
      // program stays listed and stays ranked, and the reason names the admin action.
      return { ok: false, unavailable: { reason: 'NO_MAX_LOAN_FOR_ANSWER' } };
    }
    // `useProgramMax` is the other branch and it is a no-op on purpose: the program's own
    // maximum still applies, exactly as it did before a cap table was added. Never "no cap"
    // and never zero — those are the two silent failures `onNoMatch` exists to prevent.
  }

  const capAdjustments = program.loanLimits?.maxLoanAdjustments;
  if (capAdjustments !== undefined && capAdjustments.length > 0) {
    const adjusted = applyMaxLoanAdjustments({
      cap: programCap,
      adjustments: capAdjustments,
      facts: programFacts,
    });
    if (adjusted.applied.length > 0) {
      programCap = adjusted.cap;
      // An adjustment that CUT the cap (a joint-ownership 50%) is as much the binding
      // ceiling as the table row was, so it reports the same way.
      capCameFromTable = true;
    }
  }

  let programMax = programCap;
  if (capCameFromTable) noteConstraint('program_max_by_fact');
  if (ceilingAmountEGP !== null) {
    const converted = ceilingToIncome({
      ceilingEGP: ceilingAmountEGP,
      annualRatePercent: ratePercent,
      tenorMonths,
      rateBasis,
      // A rule that states no baseline was calibrated against the bank's own cap, which
      // makes the haircut ratio exactly 1 and changes nothing.
      baselineDbrPercent:
        incomeResolution?.ceilingBaselineDbrPercent ??
        toFiniteDecimal(program.eligibility?.dbrCapPercent) ??
        new Decimal(0),
    });
    if (converted === null) {
      // A ceiling of zero, or a baseline outside (0, 100]. Not priceable, and not a
      // substituted figure: the program stays listed with a stated reason.
      return { ok: false, unavailable: { reason: 'NO_RECOGNISED_INCOME' } };
    }
    recognisedIncomeEGP = converted.recognisedIncomeEGP;

    // The collateral caps the AMOUNT as well as the instalment. Both are needed: without
    // the clamp a bank whose program maximum exceeds the ceiling would quote past what
    // the unit carries whenever the applicant's obligations left room.
    if (ceilingAmountEGP.lessThan(programMax)) {
      programMax = ceilingAmountEGP;
      noteConstraint('collateral_ceiling');
    }
  }

  // ── 3c. The share of the car's price this program finances ──────────────
  //
  // AFTER the collateral ceiling and before the request is clamped, so all four ceilings —
  // the flat maximum, the cap table, the collateral and this — compose and the lowest wins.
  // Everything downstream then follows with no further code: the request clamp below,
  // `BELOW_PROGRAM_MIN_AMOUNT` when the LTV lands under the program's floor, and
  // `maxAffordableAmountEGP`, which is where the reference's `MIN(DBR max, LTV max)` is
  // actually taken.
  //
  // A no-op for every program that states no LTV and every applicant who stated no car —
  // `ltvCeilingFor` answers `null` rather than zero, because a zero cap is a blank card with
  // no stated reason.
  //
  // The TABLE is read first and the scalar is its fallback. Both exist on purpose: the grid
  // is the more specific statement, and the scalar has to survive beside it because an
  // absent scalar is not a conservative cap — `ltvCeilingFor` answers `null`, and `null`
  // means NO CLAMP AT ALL. A build that cannot read a grid must still find a number here.
  const ltvByFact = ltvByFactFor({
    grid: program.loanLimits?.ltvCeilingByFact,
    // The CASCADE's facts, not the bare answered ones: the deposit SHARE these tables key on
    // is derived per quote by `withGridFacts` and exists nowhere else. Reading `programFacts`
    // here left every axis unresolved, so no cell matched and `reject` refused every
    // applicant — measured, not reasoned about. It is also the same set the rate banded on,
    // which is what keeps one plan row stating one customer's rate, term and share.
    facts: cascade.ctx.facts ?? programFacts,
    ...(input.parentKeyByValue !== undefined ? { parentKeyByValue: input.parentKeyByValue } : {}),
  });
  if (ltvByFact.kind === 'refused') {
    // One band of a table can carry a condition the rest does not — a deposit tier sold only
    // to somebody who owns their home states rows for an owner and none for a renter. The
    // refusal therefore binds IN THAT BAND, and the same applicant is priced normally in
    // every other one. Listed with a stated reason, never filtered (A33).
    return {
      ok: false,
      unavailable: {
        reason: 'VEHICLE_NOT_ELIGIBLE',
        ...(ltvByFact.missingFactKeys.length > 0
          ? { missingFactKeys: [...ltvByFact.missingFactKeys] }
          : {}),
      },
    };
  }
  const ltvCeilingEGP =
    ltvByFact.kind === 'percent'
      ? ltvAmountFor(ltvByFact.value, profile.carDetails)
      : ltvCeilingFor(program.loanLimits, profile.carDetails);
  if (ltvCeilingEGP !== null && ltvCeilingEGP.lessThan(programMax)) {
    programMax = ltvCeilingEGP;
    noteConstraint('ltv_ceiling');
  }

  // ── 4. Amount: clamp down to the program ceiling ────────────────────────
  // The FLOOR, and the table that can raise it. Composed by `max`, never by replacement: a
  // plan states the minimum for its own band, and a band that states none leaves the
  // program's own standing. `onNoMatch` is deliberately not read here — `useFallback` and a
  // miss are the same thing for a floor, which is "the program's own applies", and `reject`
  // on a floor would refuse an applicant a band above them already prices.
  let minAmount = toFiniteDecimal(program.loanLimits?.minAmountEGP) ?? new Decimal(0);
  const minAmountGrid = program.loanLimits?.minAmountByFact;
  if (minAmountGrid !== undefined) {
    const hit = resolveFactGrid({
      config: minAmountGrid,
      // Same facts as the share above, and for the same reason.
      facts: cascade.ctx.facts ?? programFacts,
      ...(input.parentKeyByValue !== undefined ? { parentKeyByValue: input.parentKeyByValue } : {}),
    });
    if (hit.matched && hit.value.greaterThan(minAmount)) minAmount = round2(hit.value);
  }
  let cash = round2(input.overrideAmountEGP ?? profile.requestedAmountEGP);
  if (cash.greaterThan(programMax)) {
    cash = round2(programMax);
    noteConstraint('program_max');
  }

  // The program's FLOOR, checked here as well as inside the affordability loop below.
  //
  // It used to be checked only there — a `BELOW_PROGRAM_MIN_AMOUNT` was reachable only when
  // the debt-burden cap dragged the amount down into the floor. An amount that started below
  // it, or a collateral ceiling that clamped it below it, was quoted anyway: the program
  // reported an instalment for a loan the bank does not write.
  //
  // A 200-body reason, not an eligibility filter (A33): the program stays listed, stays
  // ranked, and says which floor it is. `checkEligibility`'s own `loan_amount` check cannot
  // do this job — every production path runs with `skipEligibility`.
  if (cash.lessThan(minAmount)) {
    return {
      ok: false,
      unavailable: {
        // The REQUEST-side reason, not the affordability one below: nothing about this
        // applicant's debt burden has been measured yet at this point in the pipeline.
        reason: 'REQUESTED_BELOW_PROGRAM_MIN_AMOUNT',
        // The amount this program could have written, which here is the clamped request
        // itself — the DBR figures do not exist yet and reporting a zero for them would
        // state a cap nobody measured.
        maxAffordableAmountEGP: cash,
        recognisedIncomeEGP,
      },
    };
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
      rateBasis,
    );
    return { fees, booked, installment };
  };

  // ── 5. Fees → booked principal → installment → DBR ──────────────────────
  //
  // FR-012 — when the recognised income came FROM the income rule, the rule's own
  // `dbrCapPercentOverride` applies. `resolveAssumedIncome` already decided that
  // (it is the only place that knows the origin) and reports the cap, its source AND
  // its band, so the WHOLE resolution is taken from there rather than re-derived.
  // Re-deriving would need the origin in two places, which is how the two drift — and
  // the band branch was re-running `resolveDbrCap` over the very income the resolver
  // had just run it over, once per program per applicant.
  //
  // A CEILING is the one case that must re-resolve. The resolver ran the cap against zero
  // income, deliberately: the cap BANDS are keyed by a monthly income, and searching them
  // with a two-million-pound amount would pick a band by comparing a ceiling against an
  // income edge. Now that the implied income exists, the bands are searched with the only
  // figure they were ever meant to take. The rule's own override still applies — a ceiling
  // IS rule-derived — which is why it is passed through.
  //
  // A figure the ADDITIONAL income moved re-resolves for the same reason a ceiling does: the
  // resolver picked its band against the basic figure, and the band the quote must run on is
  // the one the total falls in. Without this an applicant whose rent carries them over a band
  // edge is capped as the person they were before their rent was counted.
  //
  // A figure the I-SCORE multiplier moved re-resolves for exactly that reason, and it is the
  // one case the v30.3.0 refactor CREATED. While the multiplier lived inside the rule the
  // resolver's own `resolveDbrCap` already saw the multiplied figure, so the ordering held
  // structurally; applied at step 2a it does not, and an applicant whose score carries them
  // over a band edge would be capped as the person they were before it was read. No program
  // states both a tier table and income bands today (measured: 0 of 71), so nothing on this
  // database moves — which is exactly why this had to be reasoned about rather than tested
  // into existence. `iscore-before-dbr.spec.ts` pins it.
  //
  // WHICH override travels is not the same question in the two cases. A ceiling IS
  // rule-derived, so the rule's own cap applies. An income the additional-income policy
  // merely topped up may have come from a payslip, and the rule override must not attach to
  // a declared salary (FR-012) — so the RESOLVER's own answer is carried rather than
  // re-decided here, and only the band is picked again.
  const reResolveForAdditional = additional !== null && additional.addedEGP.greaterThan(0);
  const overrideForCap =
    ceilingAmountEGP !== null || incomeResolution?.dbrCapSource === 'rule_override'
      ? program.incomeAssumption?.dbrCapPercentOverride
      : undefined;
  const capResolution =
    ceilingAmountEGP !== null || reResolveForAdditional || iScoreMovedIncome
      ? resolveDbrCap(
          {
            dbrCapPercent: program.eligibility.dbrCapPercent,
            dbrBands: program.eligibility.dbrBands,
            ...(program.eligibility.dbrCapPercentByEmploymentType !== undefined
              ? { dbrCapPercentByEmploymentType: program.eligibility.dbrCapPercentByEmploymentType }
              : {}),
          },
          recognisedIncomeEGP,
          overrideForCap,
          profile.employment?.employmentType,
        )
      : null;

  const { capPercent: dbrCapPercent, bandIndex: dbrBandIndex } = capResolution
    ? { capPercent: capResolution.capPercent, bandIndex: capResolution.bandIndex }
    : incomeResolution
      ? { capPercent: incomeResolution.dbrCapPercent, bandIndex: incomeResolution.dbrBandIndex }
      : resolveDbrCap(
          {
            dbrCapPercent: program.eligibility.dbrCapPercent,
            dbrBands: program.eligibility.dbrBands,
            ...(program.eligibility.dbrCapPercentByEmploymentType !== undefined
              ? { dbrCapPercentByEmploymentType: program.eligibility.dbrCapPercentByEmploymentType }
              : {}),
          },
          recognisedIncomeEGP,
          undefined,
          profile.employment?.employmentType,
        );
  const dbrCapSource: 'program_default' | 'rule_override' =
    (capResolution?.source ?? incomeResolution?.dbrCapSource) === 'rule_override'
      ? 'rule_override'
      : 'program_default';

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
    rateBasis,
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

  // ── 6. Affordability (FR-022b) ──────────────────────────────────────────
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
      rateBasis,
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

  // ── 7. Assemble ─────────────────────────────────────────────────────────
  const carValueEGP = profile.carDetails?.carValueEGP ?? null;
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
      rateBasis,
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
      // The term ceiling this vehicle carried, frozen even when something else ended up
      // binding: on its own, a shortened term reads as an unexplained cut, and the bank's
      // table cannot be re-read later (Principle I / A6).
      ...(vehicleMaxMonths !== null ? { vehicleMaxTenorMonths: vehicleMaxMonths } : {}),
      ...(ltvCeilingEGP !== null ? { ltvCeilingEGP } : {}),
      // What the customer puts in: the price they stated less the cash this offer pays out.
      // The cash leg is what reaches the dealer — fees are financed on top (see the header) —
      // and it is floored at zero rather than allowed negative, which an offer above the
      // stated price would otherwise produce.
      ...(carValueEGP !== null
        ? {
            requiredDownPaymentEGP: Decimal.max(
              new Decimal(0),
              carValueEGP.minus(cashToCustomerEGP),
            ),
          }
        : {}),
      recognisedIncomeEGP,
      // Frozen onto the offer (Principle I / A6). "2 000 000" says nothing about WHY, and
      // the ceiling cannot be re-derived later: the rule, the tables and the applicant's
      // answers can all move.
      ...(ceilingAmountEGP !== null ? { collateralCeilingEGP: ceilingAmountEGP } : {}),
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
      // The MULTIPLIER, frozen for the reason `dbrCapPercent` above is: the tiers are stated
      // per product and overridden per bank, and either can be retyped after this offer is
      // written. Both keys absent when `source` is null — no table was in force, or the
      // applicant left the optional question blank — because that is a different fact from a
      // table measured at 100% and the offer's own docstring says so.
      ...(iScore.source !== null
        ? {
            iScoreFactorPercent: iScore.factorPercent,
            iScoreTiersSource: iScore.source,
          }
        : {}),
      feesBreakdown: priced.fees.breakdown,
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
