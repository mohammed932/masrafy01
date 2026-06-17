import type { CreateBankProgramDto } from '../../dto/create-bank-program.dto';

/**
 * Minimal-but-valid skeleton for catalog entries. Specific catalogs spread + override.
 */
export function skeletonProgram(
  overrides: Partial<CreateBankProgramDto> & { programCode: string },
): CreateBankProgramDto & { programCode: string } {
  const base: CreateBankProgramDto = {
    programCode: 'PLACEHOLDER',
    bankName: 'ABK Egypt',
    friendlyName: 'Placeholder',
    programType: 'income_proof',
    productCategory: 'personal',
    currencies: ['EGP'],
    tenor: { minMonths: 12, maxMonths: 84 },
    loanLimits: {
      perCurrency: { EGP: { minAmount: '50000', maxAmount: '1500000' } },
    },
    pricing: {
      isVariableRate: false,
      baseRatePercent: '24.0000',
    },
    eligibility: {
      acceptedEmploymentTypes: ['salaried'],
      ageMin: 21,
      ageMax: 60,
      minMonthlyIncomeEGP: '6000',
      minMonthsInJob: 6,
      acceptedLoanPurposes: ['personal'],
      dbrCapPercent: '50.0000',
      skipDbrCheck: false,
      acceptedTransferTypes: ['payroll'],
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
    fees: {
      adminFeePercent: '2.0000',
      stampDutyPercent: '0.5000',
      lifeInsurancePercent: '0.5000',
      lifeInsuranceMandatory: false,
      latePaymentFeePercent: '4.0000',
      payoffCashPercent: '12.0000',
      payoffBuyoutPercent: '15.0000',
    },
  };
  return { ...base, ...overrides };
}
