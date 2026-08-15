import type { CreateBankProgramDto } from '../../dto/create-bank-program.dto';

/**
 * Minimal-but-valid skeleton for catalog entries. Specific catalogs spread + override.
 *
 * `programNameKey` is deliberately NOT defaulted: a default would be a real
 * archetype, so every entry that forgot to choose would silently claim to be an
 * instance of it — counted as such on the catalog board and renamed with it.
 * Requiring it here makes the compiler name each gap instead.
 */
export function skeletonProgram(
  overrides: Partial<CreateBankProgramDto> & { programCode: string; programNameKey: string },
): CreateBankProgramDto & { programCode: string } {
  const base: Omit<CreateBankProgramDto, 'programNameKey'> = {
    programCode: 'PLACEHOLDER',
    bankName: 'ABK Egypt',
    friendlyName: 'Placeholder',
    programType: 'income_proof',
    productCategory: 'personal',
    tenor: { minMonths: 12, maxMonths: 84 },
    loanLimits: {
      minAmountEGP: '50000',
      maxAmountEGP: '1500000',
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
