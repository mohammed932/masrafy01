/**
 * Loan calculator (feature 010, FR-028 … FR-032).
 *
 * Answers two questions with the SAME pipeline the matched offers are built
 * from — `quoteProgram` — so a figure the customer sees here can never disagree
 * with the one on their offer card:
 *
 *   cost          "I want 300 000 over 60 months — what does it cost?"
 *   affordability "I earn 100 000 and owe 40 000 — how much can I borrow?"
 *
 * The affordability answer is the reverse annuity:
 *
 *   obligations    = stated monthly obligations + 5% × total credit-card limit
 *   maxInstallment = income × dbrCap ÷ 100 − obligations
 *   maxLoan        = maxInstallment × (1 − (1+r)⁻ⁿ) ÷ r        (r = APR ÷ 12)
 *
 * Persists nothing (Principle X — read-only, no repository writes).
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import { toBankProgramSnapshot } from '@/bank-programs/bank-program-snapshot.mapper';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  CREDIT_CARD_DEBT_TYPE_OPTION,
  obligationMonthlyAmountFor,
} from '@/matching/pipeline/money-field-bindings';
import { quoteProgram } from '@/matching/pipeline/quote';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import type { ApplicantProfile, BankProgramSnapshot, Quote } from '@/matching/types';
import {
  CALCULATOR_DISCLAIMER_CODE,
  type AffordabilityQuoteResponseDto,
  type CalculatorQuoteDto,
  type CostQuoteResponseDto,
} from './dto/calculator.dto';

/** Generic-mode program shape. Wide open so only the caller's numbers bind. */
const GENERIC_PROGRAM = {
  minAmountEGP: '5000',
  maxAmountEGP: '50000000',
  minTenorMonths: 6,
  maxTenorMonths: 360,
  dbrCapPercent: '50.0000',
} as const;

@Injectable()
export class CalculatorService {
  constructor(
    private readonly programs: BankProgramRepository,
    private readonly config: ConfigService,
    private readonly enumerations: PlatformEnumerationsRepository,
  ) {}

  /** `age` is derived from the caller's `birthday` by the controller — never sent by the client. */
  async quote(
    dto: CalculatorQuoteDto,
    age: number,
  ): Promise<CostQuoteResponseDto | AffordabilityQuoteResponseDto> {
    const { program, isRepresentativeRate } = await this.resolveProgram(dto);
    return dto.mode === 'cost'
      ? this.costQuote(dto, age, program, isRepresentativeRate)
      : this.affordabilityQuote(dto, age, program, isRepresentativeRate);
  }

  // ── cost ─────────────────────────────────────────────────────────────────

  private costQuote(
    dto: CalculatorQuoteDto,
    age: number,
    program: BankProgramSnapshot,
    isRepresentativeRate: boolean,
  ): CostQuoteResponseDto {
    const requested = new Decimal(this.required(dto.amountEGP, 'amountEGP'));
    const quote = this.runQuote({
      dto,
      age,
      program,
      income: requested, // Cost mode tests price, not affordability…
      obligations: new Decimal(0),
      overrideAmountEGP: requested,
      skipDbrCheck: true, // …so DBR must not shrink the amount that was asked for.
    });

    const limits = program.loanLimits;
    return {
      mode: 'cost',
      ...(isRepresentativeRate ? {} : { programCode: program.programCode }),
      isRepresentativeRate,
      effectiveRatePercent: quote.effectiveRatePercent.toFixed(4),
      amountEGP: quote.offeredAmountEGP.toFixed(2),
      cashToCustomerEGP: quote.cashToCustomerEGP.toFixed(2),
      totalFeesEGP: quote.totalFeesEGP.toFixed(2),
      monthlyInstallmentEGP: quote.monthlyInstallmentEGP.toFixed(2),
      tenorMonths: quote.effectiveTenorMonths,
      totalPayableEGP: quote.totalPayableEGP.toFixed(2),
      totalCostOfCreditEGP: quote.totalCostOfCreditEGP.toFixed(2),
      fees: {
        adminFeeEGP: new Decimal(quote.feesBreakdown.adminFeeEGP).toFixed(2),
        stampDutyEGP: new Decimal(quote.feesBreakdown.stampDutyEGP).toFixed(2),
        lifeInsuranceEGP: new Decimal(quote.feesBreakdown.lifeInsuranceEGP).toFixed(2),
      },
      clamped: {
        amount: !quote.cashToCustomerEGP.equals(requested),
        tenor: quote.effectiveTenorMonths !== dto.tenorMonths,
      },
      limits: {
        minAmountEGP: new Decimal(limits?.minAmountEGP ?? 0).toFixed(2),
        maxAmountEGP: new Decimal(limits?.maxAmountEGP ?? 0).toFixed(2),
        minTenorMonths: program.tenor.minMonths,
        maxTenorMonths: program.tenor.maxMonths,
      },
      disclaimerCode: CALCULATOR_DISCLAIMER_CODE,
    };
  }

  // ── affordability ────────────────────────────────────────────────────────

  private affordabilityQuote(
    dto: CalculatorQuoteDto,
    age: number,
    program: BankProgramSnapshot,
    isRepresentativeRate: boolean,
  ): AffordabilityQuoteResponseDto {
    const income = new Decimal(this.required(dto.monthlyIncomeEGP, 'monthlyIncomeEGP'));
    const stated = new Decimal(this.required(dto.existingObligationsEGP, 'existingObligationsEGP'));
    // Cards are stated as a limit and discounted here by the SAME constant the
    // questionnaire path uses, so the calculator and the offer cards cannot answer
    // the same person differently.
    const creditCardMonthly = obligationMonthlyAmountFor(
      CREDIT_CARD_DEBT_TYPE_OPTION,
      new Decimal(dto.creditCardTotalLimitEGP ?? 0),
    );
    const obligations = stated.plus(creditCardMonthly);

    // Price at the program ceiling and let the DBR reduction find the answer:
    // whatever the engine would offer someone asking for the maximum IS the
    // maximum. Same code path as a real offer, so the two cannot diverge.
    const ceiling = new Decimal(program.loanLimits.maxAmountEGP ?? 0);
    const outcome = quoteProgram({
      profile: this.buildProfile({ dto, age, income, obligations, requested: ceiling }),
      program,
      overrideAmountEGP: ceiling,
      overrideTenorMonths: dto.tenorMonths,
    });

    // The affordability reasons carry their own figures: "you can borrow 0" is a
    // valid, explainable answer, not an error (FR-024).
    if (!outcome.ok) {
      const u = outcome.unavailable;
      if (u.maxAffordableAmountEGP === undefined) {
        throw new DomainException(
          // Two platform states are reported as themselves rather than as
          // `CALCULATOR_INPUT_INVALID`: nothing the caller sent is wrong, and telling
          // them to fix their input for a switched-off product sends them looking in the
          // one place the answer is not.
          u.reason === 'PROGRAM_MISCONFIGURED'
            ? ERROR_CODES.PROGRAM_MISCONFIGURED
            : u.reason === 'SURROGATE_PRODUCT_RETIRED'
              ? ERROR_CODES.SURROGATE_PRODUCT_RETIRED
              : ERROR_CODES.CALCULATOR_INPUT_INVALID,
          { reason: u.reason, ...(u.missing ? { missing: u.missing } : {}) },
        );
      }
      const cap = u.dbrCapPercent ?? new Decimal(0);
      return {
        mode: 'affordability',
        ...(isRepresentativeRate ? {} : { programCode: program.programCode }),
        isRepresentativeRate,
        effectiveRatePercent: this.representativeRate(program).toFixed(4),
        recognisedIncomeEGP: (u.recognisedIncomeEGP ?? income).toFixed(2),
        existingObligationsEGP: obligations.toFixed(2),
        creditCardMonthlyEGP: creditCardMonthly.toFixed(2),
        dbrCapPercent: cap.toFixed(4),
        dbrBandIndex: u.dbrBandIndex ?? null,
        maxMonthlyInstallmentEGP: this.maxInstallment(income, cap, obligations).toFixed(2),
        maxAffordableAmountEGP: u.maxAffordableAmountEGP.toFixed(2),
        monthlyInstallmentEGP: '0.00',
        tenorMonths: dto.tenorMonths,
        bindingConstraint: null,
        disclaimerCode: CALCULATOR_DISCLAIMER_CODE,
      };
    }

    const { quote } = outcome;
    return {
      mode: 'affordability',
      ...(isRepresentativeRate ? {} : { programCode: program.programCode }),
      isRepresentativeRate,
      effectiveRatePercent: quote.effectiveRatePercent.toFixed(4),
      recognisedIncomeEGP: quote.recognisedIncomeEGP.toFixed(2),
      existingObligationsEGP: obligations.toFixed(2),
      creditCardMonthlyEGP: creditCardMonthly.toFixed(2),
      dbrCapPercent: quote.dbrCapPercent.toFixed(4),
      dbrBandIndex: quote.dbrBandIndex,
      maxMonthlyInstallmentEGP: this.maxInstallment(
        quote.recognisedIncomeEGP,
        quote.dbrCapPercent,
        obligations,
      ).toFixed(2),
      maxAffordableAmountEGP: quote.maxAffordableAmountEGP.toFixed(2),
      monthlyInstallmentEGP: quote.monthlyInstallmentEGP.toFixed(2),
      tenorMonths: quote.effectiveTenorMonths,
      bindingConstraint: quote.bindingConstraint,
      disclaimerCode: CALCULATOR_DISCLAIMER_CODE,
    };
  }

  /** income × cap ÷ 100 − obligations, floored at zero. */
  private maxInstallment(income: Decimal, capPercent: Decimal, obligations: Decimal): Decimal {
    const room = income.mul(capPercent).div(100).minus(obligations);
    return room.lessThan(0) ? new Decimal(0) : room.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
  }

  // ── plumbing ─────────────────────────────────────────────────────────────

  private runQuote(args: {
    dto: CalculatorQuoteDto;
    age: number;
    program: BankProgramSnapshot;
    income: Decimal;
    obligations: Decimal;
    overrideAmountEGP: Decimal;
    skipDbrCheck?: boolean;
  }): Quote {
    const outcome = quoteProgram({
      profile: this.buildProfile({
        dto: args.dto,
        age: args.age,
        income: args.income,
        obligations: args.obligations,
        requested: args.overrideAmountEGP,
      }),
      program: args.program,
      overrideAmountEGP: args.overrideAmountEGP,
      overrideTenorMonths: args.dto.tenorMonths,
      skipDbrCheck: args.skipDbrCheck,
    });
    if (!outcome.ok) {
      throw new DomainException(
        outcome.unavailable.reason === 'PROGRAM_MISCONFIGURED'
          ? ERROR_CODES.PROGRAM_MISCONFIGURED
          : ERROR_CODES.CALCULATOR_INPUT_INVALID,
        {
          reason: outcome.unavailable.reason,
          ...(outcome.unavailable.missing ? { missing: outcome.unavailable.missing } : {}),
        },
      );
    }
    return outcome.quote;
  }

  /**
   * A deliberately neutral applicant: the calculator asks about money, not about
   * employment history. Rate-cascade levels keyed on employment or transfer type
   * therefore fall through to the program's base rate — an indicative estimate,
   * which is what `disclaimerCode` says it is.
   */
  private buildProfile(args: {
    dto: CalculatorQuoteDto;
    age: number;
    income: Decimal;
    obligations: Decimal;
    requested: Decimal;
  }): ApplicantProfile {
    return {
      age: args.age,
      loanPurpose: 'personal',
      requestedAmountEGP: args.requested,
      preferredTenorMonths: args.dto.tenorMonths,
      priority: 'lowest_installment',
      employment: {
        employmentType: 'salaried',
        monthlyNetSalaryEGP: args.income,
        monthsInJob: 0,
        salaryTransferType: 'none',
        companyName: '',
        companyType: '',
      },
      obligations: {
        existingMonthlyObligationsEGP: args.obligations,
        hasCurrentLoan: args.obligations.greaterThan(0),
        hasPreviousRejection: false,
      },
      assets: {},
    };
  }

  private async resolveProgram(
    dto: CalculatorQuoteDto,
  ): Promise<{ program: BankProgramSnapshot; isRepresentativeRate: boolean }> {
    if (!dto.bankProgramId) {
      return { program: this.genericProgram(dto), isRepresentativeRate: true };
    }
    if (dto.dbrCapPercent !== undefined) {
      // The program owns its cap (FR-021b). Rejecting beats ignoring.
      throw new DomainException(ERROR_CODES.CALCULATOR_INPUT_INVALID, { field: 'dbrCapPercent' });
    }
    const row = await this.programs.findById(dto.bankProgramId);
    if (!row) throw new DomainException(ERROR_CODES.BANK_PROGRAM_NOT_FOUND);
    if (!row.active) {
      throw new DomainException(ERROR_CODES.CALCULATOR_PROGRAM_INACTIVE, {
        programCode: row.programCode,
      });
    }
    // One program, so one read — the calculator quotes a single named program and a
    // per-request map of the whole catalog is cheaper than teaching the mapper to do IO.
    const catalogRules = await this.enumerations.programNameIncomeRules();
    return { program: toBankProgramSnapshot(row, catalogRules), isRepresentativeRate: false };
  }

  private genericProgram(dto: CalculatorQuoteDto): BankProgramSnapshot {
    return {
      id: 'generic',
      programCode: 'GENERIC',
      bankName: '',
      bankIsFeatured: false,
      friendlyName: '',
      programType: 'income_proof',
      productCategory: 'personal',
      active: true,
      isShariaCompliant: false,
      version: 1,
      requiredDocuments: [],
      createdAt: new Date(0),
      tenor: {
        minMonths: GENERIC_PROGRAM.minTenorMonths,
        maxMonths: GENERIC_PROGRAM.maxTenorMonths,
      },
      loanLimits: {
        minAmountEGP: GENERIC_PROGRAM.minAmountEGP,
        maxAmountEGP: GENERIC_PROGRAM.maxAmountEGP,
      },
      pricing: {
        isVariableRate: false,
        baseRatePercent: this.config
          .getOrThrow<string>('CALCULATOR_REPRESENTATIVE_RATE_PERCENT')
          .toString(),
      },
      eligibility: {
        acceptedEmploymentTypes: [],
        minAge: 18,
        maxAge: 80,
        minMonthlyIncomeEGP: '0',
        minMonthsInJob: 0,
        acceptedSalaryTransferTypes: [],
        dbrCapPercent: dto.dbrCapPercent ?? GENERIC_PROGRAM.dbrCapPercent,
        skipDbrCheck: false,
        requiresCD: false,
        requiresAutoLoanAtABK: false,
        requiresAutoLoanAtOtherBank: false,
        requiresCreditCardAtOtherBank: false,
        requiresCompoundProperty: false,
        requiresCollateral: false,
        requiresClubMembership: false,
        requiresExistingLoan: false,
        requiresFRMUVerification: false,
        requiresQualitativeReview: false,
        requiresNoDocuments: false,
      },
      incomeAssumption: { strategy: 'declared' },
      fees: { adminFeePercent: '0' },
    };
  }

  private representativeRate(program: BankProgramSnapshot): Decimal {
    const raw = program.pricing.isVariableRate
      ? program.pricing.currentEffectiveRatePercent
      : program.pricing.baseRatePercent;
    return new Decimal(raw ?? 0);
  }

  private required(value: string | undefined, field: string): string {
    if (value === undefined) {
      throw new DomainException(ERROR_CODES.CALCULATOR_INPUT_INVALID, { field });
    }
    return value;
  }
}
