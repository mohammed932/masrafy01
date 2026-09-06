/**
 * Matching Engine orchestrator — single entry point.
 * Constitution Principle V: composes pure pipeline functions; no I/O.
 */

import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  FiguresUnavailableReason,
  MatchResult,
  NoMatchDetail,
  Offer,
  Quote,
  Suggestion,
} from './types';
import { checkEligibility } from './pipeline/eligibility-checker';
import { applyCompanyTypeAdjustment, resolveAssumedIncome } from './pipeline/income-resolver';
import { rankOffers } from './pipeline/ranking';
import { quoteProgram, shouldConsultIncomeRule } from './pipeline/quote';

export interface EngineInput {
  profile: ApplicantProfile;
  programs: BankProgramSnapshot[];
  /**
   * MVP simplification (Principle V): when true, the eligibility checks are
   * evaluated for transparency but never reject a program — every active program
   * is quoted. `passedChecks`/`failedChecks` stay populated. Defaults to false.
   *
   * This says NOTHING about DBR. Affordability shapes the AMOUNT offered, which
   * is a different concern from whether a program is listed; conflating the two
   * is what previously left the apply path quoting amounts the applicant's
   * income could not carry. Use `skipDbrCheck` for that.
   */
  skipEligibility?: boolean;
  /**
   * Disable the DBR affordability reduction, quoting the requested amount as-is.
   * The program's own `eligibility.skipDbrCheck` is honoured independently —
   * either one disables it. Defaults to false: DBR shapes the amount everywhere.
   */
  skipDbrCheck?: boolean;
  /**
   * Lookup value → registry `parentKey`, for a product rule's `factParentTable` step.
   *
   * Read ONCE per run and passed down, never per program: it is one map for the whole
   * registry, and a per-program read inside the loop would be a query per program on the
   * apply path — the same reasoning `programNameIncomeRules` already follows.
   */
  parentKeyByValue?: Readonly<Record<string, string>>;
}

export interface EngineOutput {
  status: 'matched' | 'no_match';
  offers: Offer[];
  programsChecked: number;
  eligibleCount: number;
  engineDurationMs: number;
  noMatchDetails?: NoMatchDetail[];
  suggestions?: Suggestion[];
  primaryReason?: string;
  /**
   * Every program evaluated, in input order — including the ones that produced
   * no offer, each carrying `unavailable.reason`. Callers list from here so a
   * program is never silently dropped for being unaffordable (A33).
   */
  results: MatchResult[];
}

@Injectable()
export class EngineService {
  run(input: EngineInput): EngineOutput {
    const t0 = Date.now();
    const { profile, programs } = input;
    const skipEligibility = input.skipEligibility ?? false;
    const skipDbrCheck = input.skipDbrCheck ?? false;
    const results: MatchResult[] = [];
    const noMatchDetails: NoMatchDetail[] = [];

    for (const program of programs) {
      if (!program.active) continue;
      const result = this.evaluateProgram(profile, program, {
        skipEligibility,
        skipDbrCheck,
        ...(input.parentKeyByValue !== undefined
          ? { parentKeyByValue: input.parentKeyByValue }
          : {}),
      });
      results.push(result);
      if (!result.eligible) {
        noMatchDetails.push({
          programCode: program.programCode,
          failedChecks: result.failedChecks,
        });
      }
    }

    const offers = results.flatMap((r) => (r.offer ? [r.offer] : []));
    const ranked = rankOffers(offers, profile.priority);
    const engineDurationMs = Date.now() - t0;

    if (ranked.length === 0) {
      const suggestions = this.generateSuggestions(noMatchDetails, programs, profile);
      return {
        status: 'no_match',
        offers: [],
        programsChecked: results.length,
        eligibleCount: 0,
        engineDurationMs,
        noMatchDetails,
        suggestions,
        primaryReason: pickPrimaryReason(noMatchDetails),
        results,
      };
    }

    return {
      status: 'matched',
      offers: ranked,
      programsChecked: results.length,
      eligibleCount: ranked.length,
      engineDurationMs,
      results,
    };
  }

  private evaluateProgram(
    profile: ApplicantProfile,
    program: BankProgramSnapshot,
    flags: {
      skipEligibility: boolean;
      skipDbrCheck: boolean;
      parentKeyByValue?: Readonly<Record<string, string>>;
    },
  ): MatchResult {
    const { skipEligibility, skipDbrCheck } = flags;
    // Resolved at most ONCE per program and handed to `quoteProgram` below, through
    // the SAME predicate the quote uses to decide whether the rule is read at all.
    // Resolving unconditionally re-normalized the rule blob and re-resolved the DBR
    // cap for every `income_proof` program in the loop, whose resolution the quote
    // then threw away — and two independent runs could reach two answers about a
    // figure that is about to be frozen onto an offer (Principle I).
    const incomeResolution = shouldConsultIncomeRule(profile, program)
      ? resolveAssumedIncome({
          profile,
          income: program.incomeAssumption,
          eligibility: program.eligibility,
          programBankName: program.bankName,
          ...(flags.parentKeyByValue !== undefined
            ? { parentKeyByValue: flags.parentKeyByValue }
            : {}),
        })
      : null;

    // The bank's own recognition percentage (`commercialBankIncomePercent` /
    // `publicBankIncomePercent`, configured on live programs) applies HERE and only
    // here: `checkEligibility` asks "would this bank lend to them", which is a
    // question about what the bank recognises. The customer-facing figures
    // deliberately keep the raw salary — see the note on `resolveAssumedIncome` — so
    // the haircut is applied to the eligibility input rather than inside the
    // resolver. Applied only to a DECLARED figure: a surrogate income is the bank's
    // own table output and has no salary to discount.
    //
    // No resolution means the quote will run on the declared salary outright, so that
    // is what the eligibility check measures — the same figure, one step earlier.
    const rawIncome =
      incomeResolution?.incomeEGP ?? profile.employment?.monthlyNetSalaryEGP ?? new Decimal(0);
    const declaredOrigin =
      incomeResolution === null ||
      incomeResolution.origin === 'declared' ||
      incomeResolution.origin === 'declared_over_surrogate';
    const assumedIncome = declaredOrigin
      ? applyCompanyTypeAdjustment(rawIncome, profile, program.eligibility)
      : rawIncome;

    const eligibility = checkEligibility(profile, program, assumedIncome);
    if (!eligibility.passed && !skipEligibility) {
      return {
        programCode: program.programCode,
        programVersion: program.version,
        eligible: false,
        passedChecks: eligibility.passedChecks,
        failedChecks: eligibility.failedChecks,
      };
    }

    // All money math lives in `quoteProgram` — the one implementation shared by
    // matching preview, apply, the admin draft preview and the calculator. That
    // sharing is what makes FR-025 preview/apply parity structural.
    const outcome = quoteProgram({ profile, program, skipDbrCheck, incomeResolution });
    if (!outcome.ok) {
      return {
        programCode: program.programCode,
        programVersion: program.version,
        eligible: false,
        passedChecks: eligibility.passedChecks,
        failedChecks: [reasonToCheckCode(outcome.unavailable.reason)],
        // Carried so callers can list the program with its reason instead of
        // dropping it — an unaffordable program is still an offer-less program,
        // not a filtered-out one (A33).
        unavailable: outcome.unavailable,
      };
    }

    const { quote } = outcome;
    return {
      programCode: program.programCode,
      programVersion: program.version,
      eligible: true,
      passedChecks:
        quote.bindingConstraint === 'dbr_affordability'
          ? [...eligibility.passedChecks, 'dbr_adjusted']
          : eligibility.passedChecks,
      failedChecks: [],
      offer: this.buildOffer({ profile, program, quote }),
      quote,
    };
  }

  private buildOffer(args: {
    profile: ApplicantProfile;
    program: BankProgramSnapshot;
    quote: Quote;
  }): Offer {
    const { quote } = args;

    return {
      bankName: args.program.bankName,
      bankIsFeatured: args.program.bankIsFeatured,
      isShariaCompliant: args.program.isShariaCompliant,
      programFriendlyName: args.program.friendlyName,
      programCode: args.program.programCode,
      programVersion: args.program.version,
      effectiveRatePercent: quote.effectiveRatePercent,
      rateBasis: quote.rateBasis,
      monthlyInstallmentEGP: quote.monthlyInstallmentEGP,
      // `requestedLoanAmountEGP` is the cash the customer receives; the booked
      // principal (cash + financed fees) is `effectiveLoanAmountEGP`.
      requestedLoanAmountEGP: quote.cashToCustomerEGP,
      effectiveLoanAmountEGP: quote.offeredAmountEGP,
      requestedTenorMonths: args.profile.preferredTenorMonths,
      effectiveTenorMonths: quote.effectiveTenorMonths,
      feesBreakdown: quote.feesBreakdown,
      requiredDocuments: args.program.requiredDocuments,
      matchReasons: buildMatchReasons(args.profile, args.program),
      cascadeTrace: quote.cascadeTrace,
      qualitativeReviewBadge: args.program.eligibility.requiresQualitativeReview,
      selfDeclared: args.program.programType === 'income_surrogate',
      // The applicant's ceiling at this program, always — not only when DBR
      // happened to bind. Someone who asked for 100k needs to know the same
      // salary supports 668k just as much as someone who asked for too much
      // needs to know it was cut.
      maxLoanAvailableEGP: quote.maxAffordableAmountEGP,
      dbrPercent: quote.dbrPercent,
      dbrCapPercent: quote.dbrCapPercent,
      dbrBandIndex: quote.dbrBandIndex,
      // Feature 011 — provenance, carried straight off the quote rather than
      // re-derived. Re-running the resolver here could reach a different answer, and
      // the offer is about to become immutable.
      incomeOrigin: quote.incomeResolution?.origin ?? null,
      incomeSurrogateStrategy: quote.incomeResolution ? quote.incomeResolution.strategy : null,
      // The ceiling, when the rule derived one. Same reasoning as the two above: it is the
      // output of a pipeline over a table, an uplift and the applicant's own answers, every
      // one of which can move after the offer is written.
      collateralCeilingEGP: quote.collateralCeilingEGP ?? null,
    };
  }

  private generateSuggestions(
    noMatchDetails: NoMatchDetail[],
    programs: BankProgramSnapshot[],
    profile: ApplicantProfile,
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const failed = new Set(noMatchDetails.flatMap((d) => d.failedChecks));

    if (failed.has('monthly_income')) {
      const next = profile.employment.monthlyNetSalaryEGP.mul('1.2');
      const unlocks = programs.filter((p) =>
        next.greaterThanOrEqualTo(p.eligibility.minMonthlyIncomeEGP),
      ).length;
      suggestions.push({
        code: 'INCREASE_INCOME_THRESHOLD',
        magnitude: 20,
        programsUnlocked: unlocks,
      });
    }

    if (failed.has('dbr_exceeded')) {
      const unlocks = noMatchDetails.filter(
        (d) => !d.failedChecks.includes('monthly_income'),
      ).length;
      suggestions.push({ code: 'REDUCE_OBLIGATIONS', magnitude: 15, programsUnlocked: unlocks });
    }

    if (failed.has('loan_amount')) {
      suggestions.push({
        code: 'ADJUST_LOAN_AMOUNT',
        magnitude: 10,
        programsUnlocked: programs.length,
      });
    }

    if (failed.has('frmu_verification_required')) {
      suggestions.push({ code: 'SUGGEST_VERIFY_FRMU', magnitude: 25, programsUnlocked: 0 });
    }

    if (failed.has('age')) {
      suggestions.push({ code: 'SUGGEST_GUARANTOR', magnitude: 0, programsUnlocked: 0 });
    }

    return suggestions.sort((a, b) => b.magnitude - a.magnitude);
  }
}

/**
 * Map a quote-unavailable reason onto the legacy failed-check vocabulary, so
 * `generateSuggestions` and `pickPrimaryReason` keep working unchanged.
 *
 * Exported for its own test. The switch is exhaustive, so TypeScript already forces a case
 * for every new reason; what a test can add is that the case is the RIGHT one — mapping a
 * platform state onto `monthly_income` compiles perfectly and sends the suggestion engine
 * off proposing a guarantor for something no applicant can change.
 */
export function reasonToCheckCode(reason: FiguresUnavailableReason): string {
  switch (reason) {
    case 'OBLIGATIONS_EXCEED_ALLOWANCE':
    case 'BELOW_PROGRAM_MIN_AMOUNT':
      return 'dbr_exceeded';
    case 'NO_RECOGNISED_INCOME':
    // Both surrogate reasons are an income problem from the applicant's side —
    // the check that could not be satisfied is the same one. They stay SEPARATE
    // reasons because the admin fix differs (research R9), but a customer-facing
    // failed-check list has one income check, not three.
    case 'SURROGATE_FACT_MISSING':
    case 'SURROGATE_NO_MATCHING_ROW':
      return 'monthly_income';
    case 'AGE_AT_MATURITY':
      return 'age';
    case 'PROGRAM_MISCONFIGURED':
      return 'program_misconfigured';
    // A product-rule gate refused: the applicant does not meet a condition of the
    // COLLATERAL this product is sold against (the down payment, the contract age, the
    // multi-unit declaration). Its own check code, not `monthly_income`: nothing about
    // this applicant's earnings was in question, and mapping it there would send the
    // suggestion engine off proposing a guarantor for a unit-price floor.
    case 'PRODUCT_RULE_GATE_FAILED':
      return 'product_rule_gate';
    // The bank's cap TABLE has no row for this applicant's answer and the bank chose to
    // refuse rather than fall back. `loan_amount`, not `monthly_income`: nothing about the
    // applicant's earnings was in question, and mapping it to income would send the
    // suggestion engine off proposing a guarantor for a missing table row.
    case 'NO_MAX_LOAN_FOR_ANSWER':
      return 'loan_amount';
    // The no-payslip product this program quotes from is switched off. Its own check code
    // for the same reason as the two above: nothing about this applicant is in question,
    // and mapping a platform switch to `monthly_income` would have the suggestion engine
    // proposing a guarantor for something only an operator can undo.
    case 'SURROGATE_PRODUCT_RETIRED':
      return 'program_misconfigured';
  }
}

function buildMatchReasons(profile: ApplicantProfile, program: BankProgramSnapshot): string[] {
  const reasons: string[] = [];
  if (profile.employment.salaryTransferType === 'payroll') {
    reasons.push('payroll_transfer_verified');
  }
  if (profile.assets.cdAtABKValueEGP?.greaterThan(0)) {
    reasons.push('cd_collateral_available');
  }
  if (profile.employment.monthsInJob > 36) {
    reasons.push('stable_employment');
  }
  reasons.push(`program_category_${program.productCategory}`);
  return reasons;
}

function pickPrimaryReason(noMatchDetails: NoMatchDetail[]): string | undefined {
  const counts = new Map<string, number>();
  for (const d of noMatchDetails) {
    for (const c of d.failedChecks) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let top: { code: string; n: number } | null = null;
  for (const [code, n] of counts.entries()) {
    if (!top || n > top.n) top = { code, n };
  }
  if (!top) return undefined;
  switch (top.code) {
    case 'monthly_income':
      return 'INCOME_TOO_LOW';
    case 'age':
      return 'AGE_NOT_ELIGIBLE';
    case 'dbr_exceeded':
      return 'DBR_EXCEEDED';
    case 'tenor':
      return 'TENOR_OUT_OF_RANGE';
    case 'loan_amount':
      return 'AMOUNT_OUT_OF_RANGE';
    case 'requires_cd':
      return 'MISSING_CD_RECORD';
    default:
      return undefined;
  }
}
