/**
 * Matching Engine orchestrator — single entry point.
 * Constitution Principle V: composes pure pipeline functions; no I/O.
 */

import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import type {
  ApplicantProfile,
  ApprovalProbabilityResult,
  BankProgramSnapshot,
  CascadeTrace,
  MatchResult,
  NoMatchDetail,
  Offer,
  ScoringConfig,
  Suggestion,
} from './types';
import { checkEligibility } from './pipeline/eligibility-checker';
import { resolveAssumedIncome } from './pipeline/income-resolver';
import { calculateMonthlyInstallment, calculateEffectiveLoanAmount } from './pipeline/pmt';
import { calculateDbr, calculateMaxLoanFromDbr } from './pipeline/dbr';
import { calculateFees } from './pipeline/fees';
import { calculateApprovalProbability } from './pipeline/approval-probability';
import { rankOffers } from './pipeline/ranking';
import { runCascade } from './pipeline/cascade-adapter';

export interface EngineInput {
  profile: ApplicantProfile;
  programs: BankProgramSnapshot[];
  scoringConfig: ScoringConfig;
  correlationId: string;
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
    const results: MatchResult[] = [];
    const noMatchDetails: NoMatchDetail[] = [];

    for (const program of programs) {
      if (!program.active) continue;
      const result = this.evaluateProgram(profile, program, scoringConfig);
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
  ): MatchResult {
    const assumedIncome = resolveAssumedIncome(
      profile,
      program.incomeAssumption,
      program.eligibility,
    );

    const eligibility = checkEligibility(profile, program, assumedIncome);
    if (!eligibility.passed) {
      return {
        programCode: program.programCode,
        programVersion: program.version,
        eligible: false,
        passedChecks: eligibility.passedChecks,
        failedChecks: eligibility.failedChecks,
      };
    }

    const cascade = runCascade(program, profile);
    const ratePercent = new Decimal(cascade.pricing.effectiveRatePercent);
    const effectiveTenor = Math.min(profile.preferredTenorMonths, cascade.tenor.maxMonths);

    let requested = profile.requestedAmountEGP;
    const maxFromCascade = new Decimal(cascade.loanLimit.maxAmount);
    if (requested.greaterThan(maxFromCascade)) {
      requested = maxFromCascade;
    }

    const feesFirst = calculateFees(program.fees, {
      requestedAmountEGP: requested,
      effectiveLoanAmountEGP: requested,
      annualRatePercent: ratePercent,
      tenorMonths: effectiveTenor,
      loanPurpose: profile.loanPurpose,
      collateralized: program.eligibility.requiresCollateral,
    });

    const effectiveLoanAmount = calculateEffectiveLoanAmount(
      requested,
      feesFirst.totalFinancedFeesEGP,
    );
    const ratePostPenalties = feesFirst.effectiveRateAfterPenaltiesPercent;
    const monthlyInstallment = calculateMonthlyInstallment(
      effectiveLoanAmount,
      ratePostPenalties,
      effectiveTenor,
    );

    const dbr = calculateDbr(
      {
        monthlyIncomeEGP: assumedIncome,
        existingMonthlyObligationsEGP: profile.obligations.existingMonthlyObligationsEGP,
        newMonthlyInstallmentEGP: monthlyInstallment,
      },
      program.eligibility.dbrCapPercent,
    );

    if (!dbr.withinCap && !program.eligibility.skipDbrCheck) {
      const amountStep = program.loanLimits.amountStepEGP
        ? new Decimal(program.loanLimits.amountStepEGP)
        : undefined;
      const maxLoan = calculateMaxLoanFromDbr({
        monthlyIncomeEGP: assumedIncome,
        existingMonthlyObligationsEGP: profile.obligations.existingMonthlyObligationsEGP,
        dbrCapPercent: program.eligibility.dbrCapPercent,
        annualRatePercent: ratePostPenalties,
        tenorMonths: effectiveTenor,
        applicantRequestedEGP: requested,
        amountStepEGP: amountStep,
      });

      const minAmount = new Decimal(
        program.loanLimits.perCurrency[profile.requestedCurrency]?.minAmount ?? '0',
      );
      if (maxLoan.lessThanOrEqualTo(minAmount)) {
        return {
          programCode: program.programCode,
          programVersion: program.version,
          eligible: false,
          passedChecks: eligibility.passedChecks,
          failedChecks: ['dbr_exceeded'],
        };
      }

      const feesAdjusted = calculateFees(program.fees, {
        requestedAmountEGP: maxLoan,
        effectiveLoanAmountEGP: maxLoan,
        annualRatePercent: ratePercent,
        tenorMonths: effectiveTenor,
        loanPurpose: profile.loanPurpose,
        collateralized: program.eligibility.requiresCollateral,
      });
      const adjustedEffective = calculateEffectiveLoanAmount(
        maxLoan,
        feesAdjusted.totalFinancedFeesEGP,
      );
      const adjustedEmi = calculateMonthlyInstallment(
        adjustedEffective,
        feesAdjusted.effectiveRateAfterPenaltiesPercent,
        effectiveTenor,
      );

      const offer = this.buildOffer({
        profile,
        program,
        scoringConfig,
        ratePercent: feesAdjusted.effectiveRateAfterPenaltiesPercent,
        monthlyInstallment: adjustedEmi,
        requestedAmount: maxLoan,
        effectiveLoanAmount: adjustedEffective,
        effectiveTenor,
        feesBreakdown: feesAdjusted.breakdown,
        assumedIncome,
        dbrPercent: dbr.dbrPercent,
        cascadeTrace: this.buildCascadeTrace(cascade),
        maxLoanAvailableEGP: maxLoan,
      });

      return {
        programCode: program.programCode,
        programVersion: program.version,
        eligible: true,
        passedChecks: [...eligibility.passedChecks, 'dbr_adjusted'],
        failedChecks: [],
        offer,
      };
    }

    const offer = this.buildOffer({
      profile,
      program,
      scoringConfig,
      ratePercent: ratePostPenalties,
      monthlyInstallment,
      requestedAmount: requested,
      effectiveLoanAmount,
      effectiveTenor,
      feesBreakdown: feesFirst.breakdown,
      assumedIncome,
      dbrPercent: dbr.dbrPercent,
      cascadeTrace: this.buildCascadeTrace(cascade),
    });

    return {
      programCode: program.programCode,
      programVersion: program.version,
      eligible: true,
      passedChecks: eligibility.passedChecks,
      failedChecks: [],
      offer,
    };
  }

  private buildCascadeTrace(cascade: ReturnType<typeof runCascade>): CascadeTrace {
    return {
      matchedPricingLevel: cascade.pricing.matchedLevel,
      matchedTenorLevel: cascade.tenor.matchedLevel,
      matchedLoanLimitLevel: cascade.loanLimit.matchedLevel,
      pricingDerivation: cascade.pricing.derivationChain,
      steps: cascade.steps,
    };
  }

  private buildOffer(args: {
    profile: ApplicantProfile;
    program: BankProgramSnapshot;
    scoringConfig: ScoringConfig;
    ratePercent: Decimal;
    monthlyInstallment: Decimal;
    requestedAmount: Decimal;
    effectiveLoanAmount: Decimal;
    effectiveTenor: number;
    feesBreakdown: Offer['feesBreakdown'];
    assumedIncome: Decimal;
    dbrPercent: Decimal;
    cascadeTrace: CascadeTrace;
    maxLoanAvailableEGP?: Decimal;
  }): Offer {
    const approvalProbability: ApprovalProbabilityResult = calculateApprovalProbability({
      profile: args.profile,
      program: args.program,
      assumedMonthlyIncomeEGP: args.assumedIncome,
      dbrPercent: args.dbrPercent,
      scoringConfig: args.scoringConfig,
    });

    return {
      bankName: args.program.bankName,
      programFriendlyName: args.program.friendlyName,
      programCode: args.program.programCode,
      programVersion: args.program.version,
      effectiveRatePercent: args.ratePercent,
      monthlyInstallmentEGP: args.monthlyInstallment,
      requestedLoanAmountEGP: args.requestedAmount,
      effectiveLoanAmountEGP: args.effectiveLoanAmount,
      requestedTenorMonths: args.profile.preferredTenorMonths,
      effectiveTenorMonths: args.effectiveTenor,
      feesBreakdown: args.feesBreakdown,
      approvalProbabilityPercent: approvalProbability.score,
      approvalProbability,
      requiredDocuments: args.program.requiredDocuments,
      matchReasons: buildMatchReasons(args.profile, args.program),
      cascadeTrace: args.cascadeTrace,
      currency: args.profile.requestedCurrency,
      qualitativeReviewBadge: args.program.eligibility.requiresQualitativeReview,
      selfDeclared: args.program.programType === 'income_surrogate',
      maxLoanAvailableEGP: args.maxLoanAvailableEGP,
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
