/**
 * DEV SEED FIXTURE ONLY — plausible Egyptian-market placeholders used to compose
 * the demo bank programs in `seed-bank-programs.ts`.
 *
 * This is NOT a product feature. Nothing here is stored on the predefined
 * program (a `platform_enumeration` row of type `program_name` is just a NAME:
 * labels, active flag, sort order), nothing here is read by the admin UI, and
 * nothing here is read at match time. Every real bank program authors its own
 * specs on the bank-program form.
 *
 * The fixture exists only so the seed can invent a believable starting point per
 * archetype — one flat set of values per program name, no loan-category
 * dimension — instead of hand-writing dozens of full program blobs. Figures are
 * placeholders, never contracted terms.
 */

/** Partial bank-program shape the seed composes a program from. */
export interface ProgramBaseline {
  tenor?: { minMonths?: number; maxMonths?: number };
  loanLimits?: { perCurrency?: Record<string, { minAmount?: string; maxAmount?: string }> };
  eligibility?: {
    ageMin?: number;
    ageMax?: number;
    minMonthlyIncomeEGP?: string;
    dbrCapPercent?: string;
    dbrBands?: Array<{ upToIncomeEGP: string | null; capPercent: string }>;
    skipDbrCheck?: boolean;
    requiresCollateral?: boolean;
    commercialBankIncomePercent?: string;
    publicBankIncomePercent?: string;
  };
  pricing?: {
    isVariableRate?: boolean;
    baseRatePercent?: string;
    currentEffectiveRatePercent?: string;
  };
  fees?: {
    adminFeePercent?: string;
    stampDutyPercent?: string;
    lifeInsurancePercent?: string;
    lifeInsuranceMinLoanEGP?: string;
  };
  requiredDocuments?: string[];
}

const egp = (minAmount: string, maxAmount: string) => ({ perCurrency: { EGP: { minAmount, maxAmount } } });

/**
 * A plausible income-banded DBR curve: lower earners keep a larger share of
 * income, so their cap is tighter. Archetypes that want a flat cap simply omit
 * `dbrBands` and keep `dbrCapPercent`.
 */
const STANDARD_DBR_BANDS = [
  { upToIncomeEGP: '10000.00', capPercent: '35.0000' },
  { upToIncomeEGP: '25000.00', capPercent: '45.0000' },
  { upToIncomeEGP: null, capPercent: '55.0000' },
];

const SALARIED_DOCS = ['national_id', 'salary_certificate', 'hr_letter', 'bank_statement'];
const SELF_EMPLOYED_DOCS = ['national_id', 'commercial_register', 'tax_card', 'bank_statement'];

/** Baseline every personal-loan archetype starts from, then overrides. */
const PERSONAL_BASE: ProgramBaseline = {
  tenor: { minMonths: 12, maxMonths: 60 },
  loanLimits: egp('20000.00', '1000000.00'),
  eligibility: {
    ageMin: 21,
    ageMax: 60,
    minMonthlyIncomeEGP: '8000.00',
    dbrCapPercent: '50.0000',
    dbrBands: STANDARD_DBR_BANDS,
    skipDbrCheck: false,
    requiresCollateral: false,
  },
  pricing: { isVariableRate: false, baseRatePercent: '26.0000' },
  fees: {
    adminFeePercent: '1.0000',
    stampDutyPercent: '0.5000',
    lifeInsurancePercent: '0.5000',
  },
  requiredDocuments: SALARIED_DOCS,
};

/** Deep-merges an override onto a base so archetypes stay one-liners. */
function extend(base: ProgramBaseline, override: ProgramBaseline): ProgramBaseline {
  return {
    ...base,
    ...override,
    tenor: { ...base.tenor, ...override.tenor },
    loanLimits: override.loanLimits ?? base.loanLimits,
    eligibility: { ...base.eligibility, ...override.eligibility },
    pricing: { ...base.pricing, ...override.pricing },
    fees: { ...base.fees, ...override.fees },
  };
}

/**
 * `program_name` key → the seed's baseline figures for that archetype. Keys come
 * from the `program_name_enumeration` migration. Each archetype carries one set
 * of figures; the loan category is chosen by the MATRIX offering that
 * instantiates the name.
 */
export const PROGRAM_BASELINES: Record<string, ProgramBaseline> = {
  // --- borrower-profile archetypes -----------------------------------------
  // Unsecured baseline: the widest terms this archetype lends on, which a
  // secured offering then tightens on the bank program itself.
  doctor: extend(PERSONAL_BASE, {
    tenor: { maxMonths: 84 },
    loanLimits: egp('50000.00', '2000000.00'),
    eligibility: { minMonthlyIncomeEGP: '15000.00' },
    pricing: { baseRatePercent: '23.5000' },
    requiredDocuments: SELF_EMPLOYED_DOCS,
  }),
  armed_forces: extend(PERSONAL_BASE, {
    tenor: { maxMonths: 84 },
    eligibility: { minMonthlyIncomeEGP: '6000.00', publicBankIncomePercent: '100.0000' },
    pricing: { baseRatePercent: '22.0000' },
  }),
  police: extend(PERSONAL_BASE, {
    tenor: { maxMonths: 84 },
    eligibility: { minMonthlyIncomeEGP: '6000.00', publicBankIncomePercent: '100.0000' },
    pricing: { baseRatePercent: '22.0000' },
  }),
  pensioner: extend(PERSONAL_BASE, {
    tenor: { maxMonths: 36 },
    loanLimits: egp('10000.00', '300000.00'),
    eligibility: { ageMin: 50, ageMax: 70, minMonthlyIncomeEGP: '4000.00' },
    pricing: { baseRatePercent: '27.0000' },
    requiredDocuments: ['national_id', 'bank_statement'],
  }),
  youth: extend(PERSONAL_BASE, {
    tenor: { maxMonths: 48 },
    loanLimits: egp('10000.00', '250000.00'),
    eligibility: { ageMin: 21, ageMax: 35, minMonthlyIncomeEGP: '6000.00' },
    pricing: { baseRatePercent: '25.0000' },
  }),
  bankers: extend(PERSONAL_BASE, {
    tenor: { maxMonths: 84 },
    loanLimits: egp('50000.00', '1500000.00'),
    eligibility: {
      minMonthlyIncomeEGP: '12000.00',
      // The two bank-staff percentages drive recognised income for this archetype.
      commercialBankIncomePercent: '90.0000',
      publicBankIncomePercent: '100.0000',
    },
    pricing: { baseRatePercent: '23.0000' },
  }),
  govt_employee: extend(PERSONAL_BASE, {
    eligibility: { minMonthlyIncomeEGP: '5000.00', publicBankIncomePercent: '100.0000' },
    pricing: { baseRatePercent: '24.0000' },
  }),
  private_sector: extend(PERSONAL_BASE, {
    eligibility: { minMonthlyIncomeEGP: '8000.00' },
    pricing: { baseRatePercent: '26.0000' },
  }),
  professional: extend(PERSONAL_BASE, {
    tenor: { maxMonths: 72 },
    eligibility: { minMonthlyIncomeEGP: '12000.00' },
    pricing: { baseRatePercent: '25.0000' },
    requiredDocuments: SELF_EMPLOYED_DOCS,
  }),
  // Unsecured baseline, same reasoning as `doctor`: secured car / working-capital
  // offerings of this name narrow it per bank program.
  pharmacy: extend(PERSONAL_BASE, {
    eligibility: { minMonthlyIncomeEGP: '12000.00' },
    pricing: { baseRatePercent: '25.0000' },
    requiredDocuments: SELF_EMPLOYED_DOCS,
  }),

  // --- vehicle archetypes ---------------------------------------------------
  new_car: {
    tenor: { minMonths: 12, maxMonths: 84 },
    loanLimits: egp('100000.00', '3000000.00'),
    eligibility: {
      ageMin: 21,
      ageMax: 60,
      minMonthlyIncomeEGP: '10000.00',
      dbrCapPercent: '50.0000',
      dbrBands: STANDARD_DBR_BANDS,
      skipDbrCheck: false,
      requiresCollateral: true,
    },
    pricing: { isVariableRate: false, baseRatePercent: '21.0000' },
    fees: { adminFeePercent: '1.0000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.4000' },
    requiredDocuments: SALARIED_DOCS,
  },
  used_car: {
    tenor: { minMonths: 12, maxMonths: 60 },
    loanLimits: egp('75000.00', '1500000.00'),
    eligibility: {
      ageMin: 21,
      ageMax: 60,
      minMonthlyIncomeEGP: '10000.00',
      dbrCapPercent: '50.0000',
      dbrBands: STANDARD_DBR_BANDS,
      skipDbrCheck: false,
      requiresCollateral: true,
    },
    pricing: { isVariableRate: false, baseRatePercent: '23.5000' },
    fees: { adminFeePercent: '1.0000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.4000' },
    requiredDocuments: SALARIED_DOCS,
  },

  // --- property archetypes --------------------------------------------------
  home_purchase: {
    tenor: { minMonths: 60, maxMonths: 240 },
    loanLimits: egp('300000.00', '10000000.00'),
    eligibility: {
      ageMin: 25,
      ageMax: 65,
      minMonthlyIncomeEGP: '20000.00',
      dbrCapPercent: '45.0000',
      dbrBands: STANDARD_DBR_BANDS,
      skipDbrCheck: false,
      requiresCollateral: true,
    },
    pricing: { isVariableRate: true, currentEffectiveRatePercent: '22.0000' },
    fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.6000' },
    requiredDocuments: [...SALARIED_DOCS, 'property_deed'],
  },
  home_finishing: {
    tenor: { minMonths: 24, maxMonths: 120 },
    loanLimits: egp('100000.00', '2000000.00'),
    eligibility: {
      ageMin: 25,
      ageMax: 65,
      minMonthlyIncomeEGP: '15000.00',
      dbrCapPercent: '45.0000',
      dbrBands: STANDARD_DBR_BANDS,
      skipDbrCheck: false,
      requiresCollateral: true,
    },
    pricing: { isVariableRate: true, currentEffectiveRatePercent: '23.0000' },
    fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.6000' },
    requiredDocuments: [...SALARIED_DOCS, 'property_deed'],
  },

  // --- enterprise archetypes ------------------------------------------------
  working_capital: {
    tenor: { minMonths: 6, maxMonths: 36 },
    loanLimits: egp('100000.00', '5000000.00'),
    eligibility: {
      ageMin: 25,
      ageMax: 65,
      minMonthlyIncomeEGP: '30000.00',
      dbrCapPercent: '50.0000',
      skipDbrCheck: false,
      requiresCollateral: false,
    },
    pricing: { isVariableRate: true, currentEffectiveRatePercent: '25.0000' },
    fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.5000' },
    requiredDocuments: SELF_EMPLOYED_DOCS,
  },
  equipment_finance: {
    tenor: { minMonths: 12, maxMonths: 60 },
    loanLimits: egp('200000.00', '10000000.00'),
    eligibility: {
      ageMin: 25,
      ageMax: 65,
      minMonthlyIncomeEGP: '40000.00',
      dbrCapPercent: '50.0000',
      skipDbrCheck: false,
      requiresCollateral: true,
    },
    pricing: { isVariableRate: true, currentEffectiveRatePercent: '23.5000' },
    fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.5000' },
    requiredDocuments: SELF_EMPLOYED_DOCS,
  },
};
