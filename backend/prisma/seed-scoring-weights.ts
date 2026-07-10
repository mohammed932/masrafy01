/**
 * Demo seeder for per-bank-program matching weights (Constitution Principle V,
 * v8.0.0 two-level model). Without an ACTIVE `ScoringWeightSet` row, every
 * application scores 0% (documented behaviour) — so a freshly seeded dev DB
 * shows a flat 0% for every offer regardless of the customer's answers.
 *
 * Every active program gets its OWN weight set (`WEIGHTS_BY_PROGRAM`), not a
 * scheme shared across a whole category — sharing one scheme per category
 * makes every program in that category score identically for a given
 * customer, which renders as visually duplicate result cards (same %, same
 * tier) even though the offers are genuinely different bank products.
 * `WEIGHTS_BY_CATEGORY` remains only as a fallback for a program with no
 * explicit entry (e.g. a new program added later before an admin configures
 * it), so it may still collide with another program on that fallback path —
 * that's expected until someone sets that program's real weights.
 *
 *   npm run seed:weights      # standalone
 *
 * Also invoked by `npm run seed:demo`. Idempotent: skips any program that
 * already has an ACTIVE set, so re-running never overwrites an admin's real
 * edits made through the dashboard weights editor.
 *
 * This is dev/demo scaffolding, not the product's weight-editing path — real
 * per-bank tuning happens via the admin dashboard's direct-save weights editor
 * (`ScoringService.saveWeights`), which this script deliberately bypasses
 * (writing `ScoringWeightSet` rows directly, same convenience as
 * `AdminBootstrapService`/`seed-customers.ts`) since there is no HTTP session
 * to drive here.
 */
import { LoanCategory, Prisma, PrismaClient, ScoringWeightSetStatus } from '@prisma/client';

interface CategoryWeights {
  questionWeights: Record<string, number>;
  answerScores: Record<string, Record<string, number>>;
}

export const WEIGHTS_BY_CATEGORY: Record<string, CategoryWeights> = {
  personal: {
    questionWeights: {
      monthly_income: 25,
      employment_status: 15,
      job_tenure: 10,
      salary_transfer: 10,
      current_loans: 15,
      current_installments: 10,
      priority_factor: 5,
      prior_rejection: 5,
      needs_consultant: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 20,
        egp_10000_20000: 50,
        egp_20000_40000: 80,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 85,
        business_owner_company_owner: 70,
        freelancer: 50,
        retired: 40,
      },
      job_tenure: {
        less_than_6_months: 20,
        '6_months_to_1_year': 40,
        '1_to_3_years': 70,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 40 },
      current_loans: {
        none: 100,
        personal_loan: 60,
        car_loan: 60,
        mortgage: 50,
        credit_cards: 70,
        other: 50,
      },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 75,
        egp_5000_10000: 50,
        more_than_egp_10000: 20,
      },
      priority_factor: {
        lowest_monthly_installment: 80,
        lowest_interest_rate: 80,
        fastest_approval: 90,
        least_documentation_required: 70,
        flexible_repayment: 75,
      },
      prior_rejection: { yes: 30, no: 100 },
      needs_consultant: { yes: 70, no: 100 },
    },
  },
  car: {
    questionWeights: {
      monthly_income: 20,
      employment_status: 15,
      salary_transfer: 10,
      down_payment: 15,
      current_loans: 10,
      current_installments: 10,
      has_credit_card: 5,
      priority_factor: 10,
      wants_insurance: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 20,
        egp_10000_25000: 50,
        egp_25000_50000: 80,
        more_than_egp_50000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 85,
        business_owner_company_owner: 70,
        freelancer: 50,
        retired: 40,
      },
      salary_transfer: { yes: 100, no: 40 },
      down_payment: {
        no_down_payment: 30,
        less_than_20: 60,
        '20_40': 85,
        more_than_40: 100,
      },
      current_loans: { yes: 40, no: 100 },
      current_installments: {
        less_than_egp_3000: 100,
        egp_3000_7000: 75,
        egp_7000_15000: 50,
        more_than_egp_15000: 20,
      },
      has_credit_card: { yes: 70, no: 100 },
      priority_factor: {
        lowest_down_payment: 80,
        lowest_monthly_installment: 80,
        fastest_approval: 90,
        lowest_interest_rate: 80,
        financing_without_a_guarantor: 60,
      },
      wants_insurance: { yes: 100, no: 80 },
    },
  },
  mortgage: {
    questionWeights: {
      monthly_income: 20,
      employment_status: 15,
      down_payment: 20,
      current_loans: 10,
      current_installments: 10,
      salary_transfer: 10,
      prior_rejection: 10,
      priority_factor: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_15000: 20,
        egp_15000_30000: 50,
        egp_30000_60000: 80,
        more_than_egp_60000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 85,
        business_owner_company_owner: 70,
        freelancer: 50,
        retired: 40,
      },
      down_payment: {
        less_than_10: 30,
        '10_20': 60,
        '20_30': 85,
        more_than_30: 100,
      },
      current_loans: { yes: 40, no: 100 },
      current_installments: {
        less_than_egp_5000: 100,
        egp_5000_15000: 75,
        egp_15000_30000: 50,
        more_than_egp_30000: 20,
      },
      salary_transfer: { yes: 100, no: 40 },
      prior_rejection: { yes: 30, no: 100 },
      priority_factor: {
        lowest_monthly_installment: 80,
        longest_repayment_period: 75,
        lowest_down_payment: 80,
        fastest_approval: 90,
        lowest_administrative_fees: 70,
      },
    },
  },
  business: {
    questionWeights: {
      monthly_revenue: 25,
      business_age: 15,
      business_account: 10,
      tax_registration: 10,
      current_facilities: 10,
      current_installments: 10,
      prior_rejection: 10,
      priority_factor: 5,
      needs_consultation: 5,
    },
    answerScores: {
      monthly_revenue: {
        less_than_egp_50000: 20,
        egp_50000_200000: 50,
        egp_200000_500000: 80,
        more_than_egp_500000: 100,
      },
      business_age: {
        less_than_1_year: 30,
        '1_to_2_years': 65,
        more_than_2_years: 100,
      },
      business_account: { yes: 100, no: 50 },
      tax_registration: { yes: 100, no: 40 },
      current_facilities: { yes: 40, no: 100 },
      current_installments: {
        less_than_egp_10000: 100,
        egp_10000_50000: 60,
        more_than_egp_50000: 20,
      },
      prior_rejection: { yes: 30, no: 100 },
      priority_factor: {
        fast_approval: 90,
        flexible_repayment: 75,
        highest_financing_amount: 70,
        lowest_interest_rate: 80,
        least_documentation_required: 70,
      },
      needs_consultation: { yes: 70, no: 100 },
    },
  },
};

/**
 * Per-program overrides — each bank's own risk appetite (income bar, how much
 * a prior rejection or existing debt hurts, what it rewards). Every entry's
 * `questionWeights` sums to 100; every `answerScores` value is 0–100
 * (Principle V / A33). Programs not listed here fall back to
 * `WEIGHTS_BY_CATEGORY`.
 */
export const WEIGHTS_BY_PROGRAM: Record<string, CategoryWeights> = {
  // ── personal ──────────────────────────────────────────────────────────
  'ABK-PAYROLL-CAT-A': {
    questionWeights: {
      monthly_income: 30,
      employment_status: 15,
      job_tenure: 10,
      salary_transfer: 10,
      current_loans: 10,
      current_installments: 10,
      priority_factor: 5,
      prior_rejection: 5,
      needs_consultant: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 10,
        egp_10000_20000: 40,
        egp_20000_40000: 75,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 95,
        private_sector_employee: 85,
        business_owner_company_owner: 65,
        freelancer: 40,
        retired: 30,
      },
      job_tenure: {
        less_than_6_months: 10,
        '6_months_to_1_year': 30,
        '1_to_3_years': 65,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 30 },
      current_loans: { none: 100, personal_loan: 55, car_loan: 55, mortgage: 45, credit_cards: 60, other: 45 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 70,
        egp_5000_10000: 40,
        more_than_egp_10000: 15,
      },
      priority_factor: {
        lowest_monthly_installment: 80,
        lowest_interest_rate: 80,
        fastest_approval: 85,
        least_documentation_required: 65,
        flexible_repayment: 70,
      },
      prior_rejection: { yes: 15, no: 100 },
      needs_consultant: { yes: 60, no: 100 },
    },
  },
  'ABK-PAYROLL-CAT-B': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 15,
      job_tenure: 10,
      salary_transfer: 15,
      current_loans: 15,
      current_installments: 10,
      priority_factor: 5,
      prior_rejection: 5,
      needs_consultant: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 35,
        egp_10000_20000: 65,
        egp_20000_40000: 90,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 88,
        business_owner_company_owner: 75,
        freelancer: 60,
        retired: 50,
      },
      job_tenure: {
        less_than_6_months: 30,
        '6_months_to_1_year': 50,
        '1_to_3_years': 75,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 50 },
      current_loans: { none: 100, personal_loan: 70, car_loan: 70, mortgage: 60, credit_cards: 75, other: 60 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 80,
        egp_5000_10000: 60,
        more_than_egp_10000: 35,
      },
      priority_factor: {
        lowest_monthly_installment: 80,
        lowest_interest_rate: 80,
        fastest_approval: 90,
        least_documentation_required: 70,
        flexible_repayment: 75,
      },
      prior_rejection: { yes: 45, no: 100 },
      needs_consultant: { yes: 75, no: 100 },
    },
  },
  'ABK-SELF-EMP': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 25,
      job_tenure: 5,
      salary_transfer: 5,
      current_loans: 15,
      current_installments: 15,
      priority_factor: 5,
      prior_rejection: 5,
      needs_consultant: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 15,
        egp_10000_20000: 45,
        egp_20000_40000: 80,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 40,
        private_sector_employee: 45,
        business_owner_company_owner: 100,
        freelancer: 95,
        retired: 20,
      },
      job_tenure: {
        less_than_6_months: 40,
        '6_months_to_1_year': 60,
        '1_to_3_years': 80,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 70, no: 70 },
      current_loans: { none: 100, personal_loan: 60, car_loan: 60, mortgage: 50, credit_cards: 65, other: 50 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 75,
        egp_5000_10000: 50,
        more_than_egp_10000: 20,
      },
      priority_factor: {
        lowest_monthly_installment: 75,
        lowest_interest_rate: 75,
        fastest_approval: 90,
        least_documentation_required: 80,
        flexible_repayment: 85,
      },
      prior_rejection: { yes: 35, no: 100 },
      needs_consultant: { yes: 80, no: 100 },
    },
  },
  'BANK-NXT-PERSONAL': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 10,
      job_tenure: 5,
      salary_transfer: 10,
      current_loans: 15,
      current_installments: 10,
      priority_factor: 20,
      prior_rejection: 5,
      needs_consultant: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 25,
        egp_10000_20000: 55,
        egp_20000_40000: 85,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 80,
        private_sector_employee: 85,
        business_owner_company_owner: 80,
        freelancer: 75,
        retired: 55,
      },
      job_tenure: {
        less_than_6_months: 35,
        '6_months_to_1_year': 55,
        '1_to_3_years': 80,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 55 },
      current_loans: { none: 100, personal_loan: 65, car_loan: 65, mortgage: 55, credit_cards: 70, other: 55 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 78,
        egp_5000_10000: 55,
        more_than_egp_10000: 30,
      },
      priority_factor: {
        lowest_monthly_installment: 80,
        lowest_interest_rate: 70,
        fastest_approval: 100,
        least_documentation_required: 95,
        flexible_repayment: 85,
      },
      prior_rejection: { yes: 55, no: 100 },
      needs_consultant: { yes: 65, no: 100 },
    },
  },
  'BDC-PERSONAL-FLEX': {
    questionWeights: {
      monthly_income: 15,
      employment_status: 10,
      job_tenure: 5,
      salary_transfer: 20,
      current_loans: 10,
      current_installments: 10,
      priority_factor: 15,
      prior_rejection: 10,
      needs_consultant: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 30,
        egp_10000_20000: 60,
        egp_20000_40000: 85,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 85,
        private_sector_employee: 85,
        business_owner_company_owner: 75,
        freelancer: 65,
        retired: 55,
      },
      job_tenure: {
        less_than_6_months: 40,
        '6_months_to_1_year': 60,
        '1_to_3_years': 80,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 35 },
      current_loans: { none: 100, personal_loan: 80, car_loan: 80, mortgage: 70, credit_cards: 85, other: 70 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 88,
        egp_5000_10000: 70,
        more_than_egp_10000: 45,
      },
      priority_factor: {
        lowest_monthly_installment: 85,
        lowest_interest_rate: 75,
        fastest_approval: 80,
        least_documentation_required: 80,
        flexible_repayment: 100,
      },
      prior_rejection: { yes: 50, no: 100 },
      needs_consultant: { yes: 70, no: 100 },
    },
  },
  'CIB-PRIME-PERSONAL': {
    questionWeights: {
      monthly_income: 30,
      employment_status: 20,
      job_tenure: 10,
      salary_transfer: 10,
      current_loans: 10,
      current_installments: 8,
      priority_factor: 2,
      prior_rejection: 8,
      needs_consultant: 2,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 5,
        egp_10000_20000: 35,
        egp_20000_40000: 75,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 90,
        business_owner_company_owner: 70,
        freelancer: 35,
        retired: 25,
      },
      job_tenure: {
        less_than_6_months: 5,
        '6_months_to_1_year': 25,
        '1_to_3_years': 65,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 20 },
      current_loans: { none: 100, personal_loan: 50, car_loan: 50, mortgage: 40, credit_cards: 55, other: 40 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 65,
        egp_5000_10000: 35,
        more_than_egp_10000: 10,
      },
      priority_factor: {
        lowest_monthly_installment: 85,
        lowest_interest_rate: 90,
        fastest_approval: 75,
        least_documentation_required: 60,
        flexible_repayment: 65,
      },
      prior_rejection: { yes: 10, no: 100 },
      needs_consultant: { yes: 55, no: 100 },
    },
  },
  'HSBC-PERSONAL-PREMIER': {
    questionWeights: {
      monthly_income: 25,
      employment_status: 15,
      job_tenure: 20,
      salary_transfer: 10,
      current_loans: 10,
      current_installments: 8,
      priority_factor: 5,
      prior_rejection: 5,
      needs_consultant: 2,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 15,
        egp_10000_20000: 45,
        egp_20000_40000: 80,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 88,
        business_owner_company_owner: 72,
        freelancer: 45,
        retired: 35,
      },
      job_tenure: {
        less_than_6_months: 10,
        '6_months_to_1_year': 35,
        '1_to_3_years': 70,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 35 },
      current_loans: { none: 100, personal_loan: 58, car_loan: 58, mortgage: 48, credit_cards: 62, other: 48 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 72,
        egp_5000_10000: 45,
        more_than_egp_10000: 18,
      },
      priority_factor: {
        lowest_monthly_installment: 80,
        lowest_interest_rate: 85,
        fastest_approval: 80,
        least_documentation_required: 65,
        flexible_repayment: 70,
      },
      prior_rejection: { yes: 25, no: 100 },
      needs_consultant: { yes: 60, no: 100 },
    },
  },
  'NBE-PAYROLL-PRIME': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 25,
      job_tenure: 10,
      salary_transfer: 15,
      current_loans: 10,
      current_installments: 10,
      priority_factor: 5,
      prior_rejection: 3,
      needs_consultant: 2,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 25,
        egp_10000_20000: 55,
        egp_20000_40000: 82,
        more_than_egp_40000: 100,
      },
      employment_status: {
        government_employee: 100,
        private_sector_employee: 70,
        business_owner_company_owner: 55,
        freelancer: 35,
        retired: 60,
      },
      job_tenure: {
        less_than_6_months: 25,
        '6_months_to_1_year': 50,
        '1_to_3_years': 78,
        more_than_3_years: 100,
      },
      salary_transfer: { yes: 100, no: 45 },
      current_loans: { none: 100, personal_loan: 62, car_loan: 62, mortgage: 52, credit_cards: 68, other: 52 },
      current_installments: {
        less_than_egp_2000: 100,
        egp_2000_5000: 76,
        egp_5000_10000: 52,
        more_than_egp_10000: 25,
      },
      priority_factor: {
        lowest_monthly_installment: 82,
        lowest_interest_rate: 80,
        fastest_approval: 85,
        least_documentation_required: 70,
        flexible_repayment: 75,
      },
      prior_rejection: { yes: 45, no: 100 },
      needs_consultant: { yes: 68, no: 100 },
    },
  },
  // ── car ───────────────────────────────────────────────────────────────
  'ABK-AUTO-PRIME': {
    questionWeights: {
      monthly_income: 25,
      employment_status: 15,
      salary_transfer: 10,
      down_payment: 25,
      current_loans: 8,
      current_installments: 7,
      has_credit_card: 2,
      priority_factor: 6,
      wants_insurance: 2,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 10,
        egp_10000_25000: 40,
        egp_25000_50000: 78,
        more_than_egp_50000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 88,
        business_owner_company_owner: 70,
        freelancer: 40,
        retired: 30,
      },
      salary_transfer: { yes: 100, no: 30 },
      down_payment: { no_down_payment: 15, less_than_20: 50, '20_40': 85, more_than_40: 100 },
      current_loans: { yes: 35, no: 100 },
      current_installments: {
        less_than_egp_3000: 100,
        egp_3000_7000: 70,
        egp_7000_15000: 40,
        more_than_egp_15000: 15,
      },
      has_credit_card: { yes: 65, no: 100 },
      priority_factor: {
        lowest_down_payment: 70,
        lowest_monthly_installment: 80,
        fastest_approval: 85,
        lowest_interest_rate: 90,
        financing_without_a_guarantor: 55,
      },
      wants_insurance: { yes: 100, no: 75 },
    },
  },
  'ADIB-AUTO-ISLAMIC': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 15,
      salary_transfer: 20,
      down_payment: 15,
      current_loans: 8,
      current_installments: 7,
      has_credit_card: 3,
      priority_factor: 5,
      wants_insurance: 7,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 20,
        egp_10000_25000: 50,
        egp_25000_50000: 82,
        more_than_egp_50000: 100,
      },
      employment_status: {
        government_employee: 88,
        private_sector_employee: 85,
        business_owner_company_owner: 72,
        freelancer: 50,
        retired: 40,
      },
      salary_transfer: { yes: 100, no: 25 },
      down_payment: { no_down_payment: 30, less_than_20: 58, '20_40': 82, more_than_40: 100 },
      current_loans: { yes: 45, no: 100 },
      current_installments: {
        less_than_egp_3000: 100,
        egp_3000_7000: 75,
        egp_7000_15000: 48,
        more_than_egp_15000: 20,
      },
      has_credit_card: { yes: 75, no: 100 },
      priority_factor: {
        lowest_down_payment: 75,
        lowest_monthly_installment: 78,
        fastest_approval: 82,
        lowest_interest_rate: 70,
        financing_without_a_guarantor: 80,
      },
      wants_insurance: { yes: 100, no: 60 },
    },
  },
  'BM-AUTO-CLASSIC': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 15,
      salary_transfer: 10,
      down_payment: 15,
      current_loans: 15,
      current_installments: 15,
      has_credit_card: 3,
      priority_factor: 5,
      wants_insurance: 2,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_10000: 22,
        egp_10000_25000: 52,
        egp_25000_50000: 80,
        more_than_egp_50000: 100,
      },
      employment_status: {
        government_employee: 88,
        private_sector_employee: 85,
        business_owner_company_owner: 68,
        freelancer: 48,
        retired: 38,
      },
      salary_transfer: { yes: 100, no: 45 },
      down_payment: { no_down_payment: 25, less_than_20: 55, '20_40': 80, more_than_40: 100 },
      current_loans: { yes: 30, no: 100 },
      current_installments: {
        less_than_egp_3000: 100,
        egp_3000_7000: 65,
        egp_7000_15000: 35,
        more_than_egp_15000: 12,
      },
      has_credit_card: { yes: 70, no: 100 },
      priority_factor: {
        lowest_down_payment: 72,
        lowest_monthly_installment: 82,
        fastest_approval: 78,
        lowest_interest_rate: 85,
        financing_without_a_guarantor: 58,
      },
      wants_insurance: { yes: 95, no: 80 },
    },
  },
  // ── mortgage ──────────────────────────────────────────────────────────
  'ABK-MORTGAGE-CIB-COMPOUND': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 12,
      down_payment: 30,
      current_loans: 10,
      current_installments: 8,
      salary_transfer: 10,
      prior_rejection: 7,
      priority_factor: 3,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_15000: 15,
        egp_15000_30000: 45,
        egp_30000_60000: 80,
        more_than_egp_60000: 100,
      },
      employment_status: {
        government_employee: 88,
        private_sector_employee: 88,
        business_owner_company_owner: 70,
        freelancer: 42,
        retired: 32,
      },
      down_payment: { less_than_10: 10, '10_20': 45, '20_30': 80, more_than_30: 100 },
      current_loans: { yes: 38, no: 100 },
      current_installments: {
        less_than_egp_5000: 100,
        egp_5000_15000: 68,
        egp_15000_30000: 38,
        more_than_egp_30000: 12,
      },
      salary_transfer: { yes: 100, no: 35 },
      prior_rejection: { yes: 20, no: 100 },
      priority_factor: {
        lowest_monthly_installment: 80,
        longest_repayment_period: 75,
        lowest_down_payment: 55,
        fastest_approval: 85,
        lowest_administrative_fees: 70,
      },
    },
  },
  'HDB-MORTGAGE-FIRST-HOME': {
    questionWeights: {
      monthly_income: 20,
      employment_status: 15,
      down_payment: 12,
      current_loans: 10,
      current_installments: 10,
      salary_transfer: 15,
      prior_rejection: 13,
      priority_factor: 5,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_15000: 30,
        egp_15000_30000: 60,
        egp_30000_60000: 85,
        more_than_egp_60000: 100,
      },
      employment_status: {
        government_employee: 90,
        private_sector_employee: 88,
        business_owner_company_owner: 75,
        freelancer: 60,
        retired: 45,
      },
      down_payment: { less_than_10: 50, '10_20': 75, '20_30': 90, more_than_30: 100 },
      current_loans: { yes: 50, no: 100 },
      current_installments: {
        less_than_egp_5000: 100,
        egp_5000_15000: 80,
        egp_15000_30000: 60,
        more_than_egp_30000: 35,
      },
      salary_transfer: { yes: 100, no: 55 },
      prior_rejection: { yes: 55, no: 100 },
      priority_factor: {
        lowest_monthly_installment: 85,
        longest_repayment_period: 80,
        lowest_down_payment: 90,
        fastest_approval: 78,
        lowest_administrative_fees: 75,
      },
    },
  },
  'QNB-MORTGAGE-FAMILY': {
    questionWeights: {
      monthly_income: 28,
      employment_status: 20,
      down_payment: 15,
      current_loans: 8,
      current_installments: 7,
      salary_transfer: 10,
      prior_rejection: 10,
      priority_factor: 2,
    },
    answerScores: {
      monthly_income: {
        less_than_egp_15000: 10,
        egp_15000_30000: 38,
        egp_30000_60000: 78,
        more_than_egp_60000: 100,
      },
      employment_status: {
        government_employee: 92,
        private_sector_employee: 90,
        business_owner_company_owner: 68,
        freelancer: 35,
        retired: 28,
      },
      down_payment: { less_than_10: 20, '10_20': 55, '20_30': 85, more_than_30: 100 },
      current_loans: { yes: 40, no: 100 },
      current_installments: {
        less_than_egp_5000: 100,
        egp_5000_15000: 70,
        egp_15000_30000: 40,
        more_than_egp_30000: 15,
      },
      salary_transfer: { yes: 100, no: 30 },
      prior_rejection: { yes: 15, no: 100 },
      priority_factor: {
        lowest_monthly_installment: 82,
        longest_repayment_period: 78,
        lowest_down_payment: 60,
        fastest_approval: 85,
        lowest_administrative_fees: 72,
      },
    },
  },
};

/** Idempotent. Activates a v1 weight set for every program that has none yet. */
export async function seedScoringWeights(prisma: PrismaClient, editorId: string): Promise<void> {
  const programs = await prisma.bankProgram.findMany({
    select: { id: true, programCode: true, productCategory: true },
  });

  let created = 0;
  let skipped = 0;

  for (const program of programs) {
    const scheme =
      WEIGHTS_BY_PROGRAM[program.programCode] ??
      WEIGHTS_BY_CATEGORY[program.productCategory as LoanCategory];
    if (!scheme) {
      log(`no weight scheme defined for category "${program.productCategory}" (${program.programCode}) — skipping`);
      continue;
    }

    const existingActive = await prisma.scoringWeightSet.findFirst({
      where: { bankProgramId: program.id, status: ScoringWeightSetStatus.ACTIVE },
    });
    if (existingActive) {
      skipped += 1;
      continue;
    }

    await prisma.scoringWeightSet.create({
      data: {
        bankProgramId: program.id,
        status: ScoringWeightSetStatus.ACTIVE,
        versionNumber: 1,
        weights: scheme as unknown as Prisma.InputJsonValue,
        createdBy: editorId,
        approvedBy: editorId,
        approvedAt: new Date(),
      },
    });
    created += 1;
  }

  log(`weight sets: created ${created}, skipped ${skipped} (already active) of ${programs.length} programs`);
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[seed-scoring-weights] ${msg}`);
}

// Standalone entrypoint (`npm run seed:weights`).
if (process.argv[1] && process.argv[1].endsWith('seed-scoring-weights.ts')) {
  const prisma = new PrismaClient();
  (async () => {
    const superAdmin = await prisma.staffAccount.findFirst({
      where: { role: 'super_admin' },
      select: { id: true },
    });
    if (!superAdmin) {
      throw new Error('No super_admin staff account found — seed the admin bootstrap first.');
    }
    await seedScoringWeights(prisma, superAdmin.id);
  })()
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[seed-scoring-weights] failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
