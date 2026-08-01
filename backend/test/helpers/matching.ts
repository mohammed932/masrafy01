import { Decimal } from '@prisma/client/runtime/library';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  EligibilityConfig,
  FeesConfig,
} from '../../src/matching/types';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * Minimal eligibility block. Every `requires*` flag is false and every gate is
 * wide open, so a fixture only has to state the field under test.
 */
export function eligibilityFixture(over: Partial<EligibilityConfig> = {}): EligibilityConfig {
  return {
    acceptedEmploymentTypes: ['salaried'],
    minAge: 21,
    maxAge: 60,
    minMonthlyIncomeEGP: '5000',
    minMonthsInJob: 0,
    acceptedLoanPurposes: ['personal'],
    acceptedSalaryTransferTypes: ['payroll_cat_a'],
    dbrCapPercent: '50.0000',
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
    ...over,
  };
}

/** Zero-fee schedule — tests opt fees in explicitly so figures stay readable. */
export function feesFixture(over: Partial<FeesConfig> = {}): FeesConfig {
  return { adminFeePercent: '0', ...over };
}

export function programFixture(over: DeepPartial<BankProgramSnapshot> = {}): BankProgramSnapshot {
  const base: BankProgramSnapshot = {
    id: 'prog_test',
    programCode: 'TEST-001',
    bankName: 'Test Bank',
    bankIsFeatured: false,
    friendlyName: 'Test Program',
    programType: 'income_proof',
    productCategory: 'personal',
    currencies: ['EGP'],
    active: true,
    isShariaCompliant: false,
    version: 1,
    requiredDocuments: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    tenor: { minMonths: 6, maxMonths: 84 },
    loanLimits: { perCurrency: { EGP: { minAmount: '10000', maxAmount: '1000000' } } },
    pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
    eligibility: eligibilityFixture(),
    incomeAssumption: { strategy: 'declared' },
    fees: feesFixture(),
  };
  return { ...base, ...(over as Partial<BankProgramSnapshot>) };
}

export function profileFixture(over: DeepPartial<ApplicantProfile> = {}): ApplicantProfile {
  const base: ApplicantProfile = {
    age: 34,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal('300000'),
    requestedCurrency: 'EGP',
    preferredTenorMonths: 60,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'salaried',
      monthlyNetSalaryEGP: new Decimal('20000'),
      monthsInJob: 48,
      salaryTransferType: 'payroll_cat_a',
      companyName: 'Acme',
      companyType: 'private',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal('0'),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: {},
  };
  return { ...base, ...(over as Partial<ApplicantProfile>) };
}
