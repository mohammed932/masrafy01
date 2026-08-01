/**
 * Matching Engine orchestrator — single entry point.
 * Constitution Principle V: composes pure pipeline functions; no I/O.
 */

import { Injectable } from '@nestjs/common';
import type {
  ApplicantProfile,
  ApprovalProbabilityResult,
  BankProgramSnapshot,
  FiguresUnavailableReason,
  MatchResult,
  NoMatchDetail,
  Offer,
  Quote,
  ScoringConfig,
  Suggestion,
} from './types';
import { checkEligibility } from './pipeline/eligibility-checker';
import { resolveAssumedIncome } from './pipeline/income-resolver';
import { calculateApprovalProbability } from './pipeline/approval-probability';
import { rankOffers } from './pipeline/ranking';
import { quoteProgram } from './pipeline/quote';

export interface EngineInput {
  profile: ApplicantProfile;
  programs: BankProgramSnapshot[];
  scoringConfig: ScoringConfig;
  /**
   * MVP simplification: when true, eligibility gating is dropped — every active
   * program yields an offer and NO program is rejected on the eligibility check
   * or the DBR cap (the requested-amount path is used, as if `skipDbrCheck` were
   * on per program). Money math (PMT/installment, fees, effective rate, income
   * resolution, max-loan) is unchanged. `passedChecks`/`failedChecks` stay
   * populated for transparency. Defaults to false to preserve existing behavior.
   */
  skipEligibility?: boolean;
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
}

@Injectable()
export class EngineService {
  run(input: EngineInput): EngineOutput {
    const t0 = Date.now();
    const { profile, programs, scoringConfig } = input;
    const skipEligibility = input.skipEligibility ?? false;
    const results: MatchResult[] = [];
    const noMatchDetails: NoMatchDetail[] = [];

    for (const program of programs) {
      if (!program.active) continue;
      const result = this.evaluateProgram(profile, program, scoringConfig, skipEligibility);
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
      };
    }

    return {
      status: 'matched',
      offers: ranked,
      programsChecked: results.length,
      eligibleCount: ranked.length,
      engineDurationMs,
    };
  }

  private evaluateProgram(
    profile: ApplicantProfile,
    program: BankProgramSnapshot,
    scoringConfig: ScoringConfig,
    skipEligibility = false,
  ): MatchResult {
    const assumedIncome = resolveAssumedIncome(
      profile,
      program.incomeAssumption,
      program.eligibility,
    );

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
    const outcome = quoteProgram({ profile, program, skipDbrCheck: skipEligibility });
    if (!outcome.ok) {
      return {
        programCode: program.programCode,
        programVersion: program.version,
        eligible: false,
        passedChecks: eligibility.passedChecks,
        failedChecks: [reasonToCheckCode(outcome.unavailable.reason)],
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
      offer: this.buildOffer({ profile, program, scoringConfig, quote }),
      quote,
    };
  }

  private buildOffer(args: {
    profile: ApplicantProfile;
    program: BankProgramSnapshot;
    scoringConfig: ScoringConfig;
    quote: Quote;
  }): Offer {
    const { quote } = args;
    const approvalProbability: ApprovalProbabilityResult = calculateApprovalProbability({
      profile: args.profile,
      program: args.program,
      assumedMonthlyIncomeEGP: quote.recognisedIncomeEGP,
      dbrPercent: quote.dbrPercent,
      scoringConfig: args.scoringConfig,
    });

    return {
      bankName: args.program.bankName,
      bankIsFeatured: args.program.bankIsFeatured,
      isShariaCompliant: args.program.isShariaCompliant,
      programFriendlyName: args.program.friendlyName,
      programCode: args.program.programCode,
      programVersion: args.program.version,
      effectiveRatePercent: quote.effectiveRatePercent,
      monthlyInstallmentEGP: quote.monthlyInstallmentEGP,
      // `requestedLoanAmountEGP` is the cash the customer receives; the booked
      // principal (cash + financed fees) is `effectiveLoanAmountEGP`.
      requestedLoanAmountEGP: quote.cashToCustomerEGP,
      effectiveLoanAmountEGP: quote.offeredAmountEGP,
      requestedTenorMonths: args.profile.preferredTenorMonths,
      effectiveTenorMonths: quote.effectiveTenorMonths,
      feesBreakdown: quote.feesBreakdown,
      approvalProbabilityPercent: approvalProbability.score,
      approvalProbability,
      requiredDocuments: args.program.requiredDocuments,
      matchReasons: buildMatchReasons(args.profile, args.program),
      cascadeTrace: quote.cascadeTrace,
      currency: quote.currency,
      qualitativeReviewBadge: args.program.eligibility.requiresQualitativeReview,
      selfDeclared: args.program.programType === 'income_surrogate',
      // Only meaningful when DBR is what reduced the amount.
      maxLoanAvailableEGP:
        quote.bindingConstraint === 'dbr_affordability' ? quote.cashToCustomerEGP : undefined,
      dbrPercent: quote.dbrPercent,
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
 */
function reasonToCheckCode(reason: FiguresUnavailableReason): string {
  switch (reason) {
    case 'OBLIGATIONS_EXCEED_ALLOWANCE':
    case 'BELOW_PROGRAM_MIN_AMOUNT':
      return 'dbr_exceeded';
    case 'NO_RECOGNISED_INCOME':
      return 'monthly_income';
    case 'CURRENCY_NOT_OFFERED':
      return 'currency';
    case 'AGE_AT_MATURITY':
      return 'age';
    case 'PROGRAM_MISCONFIGURED':
      return 'program_misconfigured';
  }
}

function buildMatchReasons(profile: ApplicantProfile, program: BankProgramSnapshot): string[] {
  const reasons: string[] = [];
  if (profile.employment.salaryTransferType === 'payroll_transfer') {
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
    case 'currency':
      return 'CURRENCY_NOT_SUPPORTED';
    case 'requires_cd':
      return 'MISSING_CD_RECORD';
    default:
      return undefined;
  }
}
