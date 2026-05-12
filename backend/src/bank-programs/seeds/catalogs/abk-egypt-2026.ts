import type { SeedCatalog } from '../catalog.types';
import { skeletonProgram } from './base';

/**
 * ABK Egypt 20-program reference catalog.
 * Rates verified against FR-033c at seed time.
 * Built from configuration only — Principle II (banks-are-data, not code).
 */
export const abkEgypt2026: SeedCatalog = {
  name: 'abk-egypt-2026',
  programs: [
    skeletonProgram({
      programCode: 'ABK-SELF-EMP',
      friendlyName: 'Self-Employed & Professionals',
      programType: 'income_surrogate',
      pricing: { isVariableRate: false, baseRatePercent: '28.5000' },
      eligibility: skeletonEligibility('self_employed'),
      incomeAssumption: { strategy: 'byBankStatementPercent', bankStatementPercent: '30.0' },
    }),
    skeletonProgram({
      programCode: 'ABK-COMPOUND-OWNER',
      friendlyName: 'Compound Owner',
      pricing: { isVariableRate: false, baseRatePercent: '25.5000' },
      eligibility: { ...skeletonEligibility('salaried'), requiresCompoundProperty: true },
    }),
    skeletonProgram({
      programCode: 'ABK-CD-HOLDERS',
      friendlyName: 'CD Holders',
      pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
      fees: skeletonFees('0.0000'), // 0 admin fee for CD holders
      eligibility: { ...skeletonEligibility('salaried'), requiresCD: true },
    }),
    skeletonProgram({
      programCode: 'ABK-AUTO-XSELL-OTHER',
      friendlyName: 'Auto Cross-Sell — Other Bank',
      productCategory: 'auto_cross_sell',
      pricing: { isVariableRate: false, baseRatePercent: '26.0000' },
      eligibility: { ...skeletonEligibility('salaried'), requiresAutoLoanAtOtherBank: true },
    }),
    skeletonProgram({
      programCode: 'ABK-AUTO-XSELL-ABK',
      friendlyName: 'Auto Cross-Sell — At ABK',
      productCategory: 'auto_cross_sell',
      pricing: { isVariableRate: false, baseRatePercent: '25.0000' },
      eligibility: { ...skeletonEligibility('salaried'), requiresAutoLoanAtABK: true },
    }),
    skeletonProgram({
      programCode: 'ABK-CC-XSELL',
      friendlyName: 'Credit Card Cross-Sell',
      productCategory: 'credit_card_cross_sell',
      pricing: { isVariableRate: false, baseRatePercent: '27.0000' },
      eligibility: {
        ...skeletonEligibility('salaried'),
        requiresCreditCardAtOtherBank: true,
        minimumCreditCardHoldingMonths: 6,
        competitorCardMustBeUnsecured: true,
      },
    }),
    skeletonProgram({
      programCode: 'ABK-DOCTORS-CLINIC',
      friendlyName: 'Doctors — Clinic Owners',
      pricing: { isVariableRate: false, baseRatePercent: '26.5000' },
      eligibility: skeletonEligibility('self_employed'),
    }),
    skeletonProgram({
      programCode: 'ABK-DOCTORS-PRACTICE',
      friendlyName: 'Doctors — In Practice',
      pricing: { isVariableRate: false, baseRatePercent: '30.0000' },
      eligibility: skeletonEligibility('self_employed'),
      incomeAssumption: { strategy: 'byYearsInPractice', incomeTable: [{ minYears: 0, maxYears: 5, incomeEGP: '15000' }, { minYears: 5, maxYears: 50, incomeEGP: '40000' }] },
    }),
    skeletonProgram({
      programCode: 'ABK-BANKERS',
      friendlyName: 'Bankers',
      pricing: { isVariableRate: false, baseRatePercent: '22.0000' },
      eligibility: {
        ...skeletonEligibility('salaried'),
        companyType: ['commercial_bank', 'public_bank'],
        commercialBankIncomePercent: '80.0000',
        publicBankIncomePercent: '100.0000',
      },
    }),
    skeletonProgram({
      programCode: 'ABK-PROFESSORS',
      friendlyName: 'University Professors',
      pricing: { isVariableRate: false, baseRatePercent: '25.5000' },
      eligibility: skeletonEligibility('salaried'),
      incomeAssumption: { strategy: 'byProfessorRank', rankIncomeMap: { lecturer: '12000', assistant_professor: '18000', professor: '25000' } },
    }),
    skeletonProgram({
      programCode: 'ABK-MILITARY',
      friendlyName: 'Egyptian Armed Forces',
      pricing: { isVariableRate: false, baseRatePercent: '25.0000' },
      eligibility: skeletonEligibility('salaried'),
      incomeAssumption: { strategy: 'byMilitaryGrade', gradeIncomeMap: { officer: '15000', senior_officer: '25000', general: '40000' } },
    }),
    skeletonProgram({
      programCode: 'ABK-SALARIED-NO-XFER',
      friendlyName: 'Salaried Without Salary Transfer',
      pricing: { isVariableRate: false, baseRatePercent: '27.0000' },
      eligibility: { ...skeletonEligibility('salaried'), acceptedTransferTypes: ['salary_transfer_letter', 'income_transfer_letter'] },
    }),
    skeletonProgram({
      programCode: 'ABK-WEALTH',
      friendlyName: 'Wealth Program',
      productCategory: 'wealth',
      pricing: { isVariableRate: false, baseRatePercent: '23.0000' },
      loanLimits: { perCurrency: { EGP: { minAmount: '500000', maxAmount: '5000000' } } },
      eligibility: {
        ...skeletonEligibility('salaried'),
        minBankStatementBalanceEGP: '50000000',
        minAssetsValueEGP: '5000000',
        requiresQualitativeReview: true,
      },
    }),
    skeletonProgram({
      programCode: 'ABK-PAYROLL-CAT-A',
      friendlyName: 'Payroll — Cat A',
      pricing: { isVariableRate: false, baseRatePercent: '22.5000' },
      eligibility: { ...skeletonEligibility('salaried'), acceptedTransferTypes: ['payroll_cat_a'] },
    }),
    skeletonProgram({
      programCode: 'ABK-PAYROLL-CAT-B',
      friendlyName: 'Payroll — Cat B',
      pricing: { isVariableRate: false, baseRatePercent: '23.0000' },
      eligibility: { ...skeletonEligibility('salaried'), acceptedTransferTypes: ['payroll_cat_b'] },
    }),
    skeletonProgram({
      programCode: 'ABK-PAYROLL-CAT-C',
      friendlyName: 'Payroll — Cat C',
      pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
      eligibility: { ...skeletonEligibility('salaried'), acceptedTransferTypes: ['payroll_cat_c'] },
    }),
    skeletonProgram({
      programCode: 'ABK-STL',
      friendlyName: 'Salary Transfer Letter',
      pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
      eligibility: { ...skeletonEligibility('salaried'), acceptedTransferTypes: ['salary_transfer_letter'] },
    }),
    skeletonProgram({
      programCode: 'ABK-ITL',
      friendlyName: 'Income Transfer Letter',
      pricing: { isVariableRate: false, baseRatePercent: '25.0000' },
      eligibility: { ...skeletonEligibility('salaried'), acceptedTransferTypes: ['income_transfer_letter'] },
    }),
    skeletonProgram({
      programCode: 'ABK-CLUBS',
      friendlyName: 'Clubs Membership',
      productCategory: 'clubs',
      pricing: {
        isVariableRate: false,
        baseRatePercent: '30.0000',
        rateByTenor: {
          '12': { value: '27.0000' },
          '60': { value: '27.0000' },
          '84': { value: '29.0000' },
        },
      },
      eligibility: { ...skeletonEligibility('salaried'), requiresClubMembership: true, clubClass: 'Class 1' },
    }),
    skeletonProgram({
      programCode: 'ABK-FOOTBALL',
      friendlyName: 'Football Player',
      pricing: { isVariableRate: false, baseRatePercent: '31.0000' },
      eligibility: { ...skeletonEligibility('self_employed'), requiresFRMUVerification: true, clubClass: 'Class 1' },
    }),
  ],
  expectedRates: {
    'ABK-SELF-EMP': '28.5000',
    'ABK-COMPOUND-OWNER': '25.5000',
    'ABK-CD-HOLDERS': '24.0000',
    'ABK-AUTO-XSELL-OTHER': '26.0000',
    'ABK-AUTO-XSELL-ABK': '25.0000',
    'ABK-CC-XSELL': '27.0000',
    'ABK-DOCTORS-CLINIC': '26.5000',
    'ABK-DOCTORS-PRACTICE': '30.0000',
    'ABK-BANKERS': '22.0000',
    'ABK-PROFESSORS': '25.5000',
    'ABK-MILITARY': '25.0000',
    'ABK-SALARIED-NO-XFER': '27.0000',
    'ABK-WEALTH': '23.0000',
    'ABK-PAYROLL-CAT-A': '22.5000',
    'ABK-PAYROLL-CAT-B': '23.0000',
    'ABK-PAYROLL-CAT-C': '24.0000',
    'ABK-STL': '24.0000',
    'ABK-ITL': '25.0000',
    'ABK-CLUBS': '30.0000',
    'ABK-FOOTBALL': '31.0000',
  },
};

// --- helpers --------------------------------------------------------------

function skeletonEligibility(emp: 'salaried' | 'self_employed') {
  return {
    acceptedEmploymentTypes: [emp],
    ageMin: 21,
    ageMax: 60,
    minMonthlyIncomeEGP: '6000',
    minMonthsInJob: emp === 'self_employed' ? 24 : 6,
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
  };
}

function skeletonFees(adminFee: string) {
  return {
    adminFeePercent: adminFee,
    stampDutyPercent: '0.5000',
    lifeInsurancePercent: '0.5000',
    lifeInsuranceMandatory: false,
    latePaymentFeePercent: '4.0000',
    payoffCashPercent: '12.0000',
    payoffBuyoutPercent: '15.0000',
  };
}
