import type { SeedCatalog } from '../catalog.types';
import { skeletonProgram } from './base';

/**
 * ABK Egypt 17-program reference catalog.
 * Rates verified against FR-033c at seed time.
 * Built from configuration only — Principle II (banks-are-data, not code).
 *
 * ABK-SELF-EMP, ABK-PAYROLL-CAT-A and ABK-PAYROLL-CAT-B were retired
 * 2026-08-02 (removed from the DB, not deactivated) and must not be re-added
 * here — re-seeding would resurrect them.
 *
 * ABK-DOCTORS-CLINIC and ABK-DOCTORS-PRACTICE were retired 2026-09-05 for the same
 * reason and must not come back. There are TWO doctors products, `doctors_clinic_owner`
 * and `doctors_in_practice`, seeded by `npm run seed:sheet-figures` as
 * ABK-PER-DOCTORS_CLINIC and ABK-PER-DOCTORS_PRACTICE — App. A §7 and §8, with the sheets'
 * own six bands, both rates, and the city-tier cap table on the one sheet that publishes
 * one. Each has its own catalog name, so the applicant's pick decides which of the
 * two an applicant is for. What stood here was a second, contradictory pair under
 * `programNameKey: 'doctor'` carrying a legacy TWO-band table (0–6 → 15,000, 6–51 →
 * 40,000), so running this catalog produced four doctor programmes and two of them
 * quoted figures no sheet publishes.
 */
export const abkEgypt2026: SeedCatalog = {
  name: 'abk-egypt-2026',
  programs: [
    skeletonProgram({
      programCode: 'ABK-COMPOUND-OWNER',
      friendlyName: 'Compound Owner',
      // Really a salaried personal loan qualified by owning a compound unit;
      // the catalog has no property-owner archetype.
      programNameKey: 'private_sector',
      pricing: { isVariableRate: false, baseRatePercent: '25.5000' },
      eligibility: { ...skeletonEligibility('salaried'), requiresCompoundProperty: true },
    }),
    skeletonProgram({
      programCode: 'ABK-CD-HOLDERS',
      friendlyName: 'CD Holders',
      // Really a salaried personal loan secured by a certificate of deposit;
      // the catalog has no deposit-secured archetype.
      programNameKey: 'private_sector',
      pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
      fees: skeletonFees('0.0000'), // 0 admin fee for CD holders
      eligibility: { ...skeletonEligibility('salaried'), requiresCD: true },
    }),
    skeletonProgram({
      programCode: 'ABK-AUTO-XSELL-OTHER',
      friendlyName: 'Auto Cross-Sell — Other Bank',
      // Really a salaried personal loan cross-sold to customers already running
      // a car loan elsewhere — it finances nothing automotive.
      programNameKey: 'private_sector',
      productCategory: 'auto_cross_sell',
      pricing: { isVariableRate: false, baseRatePercent: '26.0000' },
      eligibility: { ...skeletonEligibility('salaried'), requiresAutoLoanAtOtherBank: true },
    }),
    skeletonProgram({
      programCode: 'ABK-AUTO-XSELL-ABK',
      friendlyName: 'Auto Cross-Sell — At ABK',
      // Same cross-sell as ABK-AUTO-XSELL-OTHER, for a car loan already at ABK.
      programNameKey: 'private_sector',
      productCategory: 'auto_cross_sell',
      pricing: { isVariableRate: false, baseRatePercent: '25.0000' },
      eligibility: { ...skeletonEligibility('salaried'), requiresAutoLoanAtABK: true },
    }),
    skeletonProgram({
      programCode: 'ABK-CC-XSELL',
      friendlyName: 'Credit Card Cross-Sell',
      // Really a salaried personal loan cross-sold against a competitor's credit
      // card; the catalog has no card-holder archetype.
      programNameKey: 'private_sector',
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
      programCode: 'ABK-BANKERS',
      friendlyName: 'Bankers',
      programNameKey: 'bankers',
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
      programNameKey: 'professional',
      // A rank table makes this income_surrogate. It inherited `income_proof` from
      // `skeletonProgram` and was never re-typed, which left the rule it carries
      // unreachable: the admin form's rule section is gated on this field.
      programType: 'income_surrogate',
      pricing: { isVariableRate: false, baseRatePercent: '25.5000' },
      eligibility: skeletonEligibility('salaried'),
      // CANONICAL shape (FR-014). Same keys, same incomes, registry display order —
      // `rankIncomeMap` converted one-for-one (FR-015).
      incomeAssumption: {
        strategy: 'byProfessorRank',
        keyTable: [
          { key: 'lecturer', incomeEGP: '12000' },
          { key: 'assistant_professor', incomeEGP: '18000' },
          { key: 'professor', incomeEGP: '25000' },
        ],
      },
    }),
    skeletonProgram({
      programCode: 'ABK-MILITARY',
      friendlyName: 'Egyptian Armed Forces',
      programNameKey: 'armed_forces',
      // A grade table makes this income_surrogate — same correction as ABK-PROFESSORS
      // above, and for the same reason.
      programType: 'income_surrogate',
      pricing: { isVariableRate: false, baseRatePercent: '25.0000' },
      eligibility: skeletonEligibility('salaried'),
      // CANONICAL shape (FR-014). `gradeIncomeMap` converted one-for-one (FR-015).
      incomeAssumption: {
        strategy: 'byMilitaryGrade',
        keyTable: [
          { key: 'officer', incomeEGP: '15000' },
          { key: 'senior_officer', incomeEGP: '25000' },
          { key: 'general', incomeEGP: '40000' },
        ],
      },
    }),
    skeletonProgram({
      programCode: 'ABK-SALARIED-NO-XFER',
      friendlyName: 'Salaried Without Salary Transfer',
      programNameKey: 'private_sector',
      pricing: { isVariableRate: false, baseRatePercent: '27.0000' },
      eligibility: {
        ...skeletonEligibility('salaried'),
        acceptedTransferTypes: ['salary_transfer_letter', 'income_transfer_letter'],
      },
    }),
    skeletonProgram({
      programCode: 'ABK-WEALTH',
      friendlyName: 'Wealth Program',
      // Really an affluent / high-net-worth tier. No wealth archetype exists;
      // `professional` is the nearest high-income, large-ticket name.
      programNameKey: 'professional',
      productCategory: 'wealth',
      pricing: { isVariableRate: false, baseRatePercent: '23.0000' },
      loanLimits: { minAmountEGP: '500000', maxAmountEGP: '5000000' },
      eligibility: {
        ...skeletonEligibility('salaried'),
        minBankStatementBalanceEGP: '50000000',
        minAssetsValueEGP: '5000000',
        requiresQualitativeReview: true,
      },
    }),
    skeletonProgram({
      programCode: 'ABK-PAYROLL-CAT-C',
      friendlyName: 'Payroll — Cat C',
      programNameKey: 'private_sector',
      pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
      eligibility: { ...skeletonEligibility('salaried'), acceptedTransferTypes: ['payroll_cat_c'] },
    }),
    skeletonProgram({
      programCode: 'ABK-STL',
      friendlyName: 'Salary Transfer Letter',
      programNameKey: 'private_sector',
      pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
      eligibility: {
        ...skeletonEligibility('salaried'),
        acceptedTransferTypes: ['salary_transfer_letter'],
      },
    }),
    skeletonProgram({
      programCode: 'ABK-ITL',
      friendlyName: 'Income Transfer Letter',
      programNameKey: 'private_sector',
      pricing: { isVariableRate: false, baseRatePercent: '25.0000' },
      eligibility: {
        ...skeletonEligibility('salaried'),
        acceptedTransferTypes: ['income_transfer_letter'],
      },
    }),
    skeletonProgram({
      programCode: 'ABK-CLUBS',
      friendlyName: 'Clubs Membership',
      programNameKey: 'private_sector',
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
      eligibility: {
        ...skeletonEligibility('salaried'),
        requiresClubMembership: true,
        clubClass: 'Class 1',
      },
    }),
    skeletonProgram({
      programCode: 'ABK-FOOTBALL',
      friendlyName: 'Football Player',
      programNameKey: 'professional',
      pricing: { isVariableRate: false, baseRatePercent: '31.0000' },
      eligibility: {
        ...skeletonEligibility('self_employed'),
        requiresFRMUVerification: true,
        clubClass: 'Class 1',
      },
    }),
  ],
  expectedRates: {
    'ABK-COMPOUND-OWNER': '25.5000',
    'ABK-CD-HOLDERS': '24.0000',
    'ABK-AUTO-XSELL-OTHER': '26.0000',
    'ABK-AUTO-XSELL-ABK': '25.0000',
    'ABK-CC-XSELL': '27.0000',
    'ABK-BANKERS': '22.0000',
    'ABK-PROFESSORS': '25.5000',
    'ABK-MILITARY': '25.0000',
    'ABK-SALARIED-NO-XFER': '27.0000',
    'ABK-WEALTH': '23.0000',
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
