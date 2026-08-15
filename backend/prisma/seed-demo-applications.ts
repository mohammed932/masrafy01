/**
 * Client-demo seeder for the admin Applications board (`/applications`).
 *
 *   npm run seed:apps:demo                    # top-up to the default target
 *   SEED_DEMO_APPS_COUNT=60 npm run seed:apps:demo
 *   SEED_DEMO_APPS_RESET=1 npm run seed:apps:demo   # wipe THIS seeder's rows first
 *
 * Unlike `seed-applications.ts` (flat fixtures, one synthetic `DEMO_*` offer per
 * row), this seeder produces data the demo can be driven through end to end:
 *
 *   - REAL offers: every application is run through the actual matching engine
 *     (`EngineService`) against the live `bank_program` rows of its category, so
 *     rates / installments / fees / cascade traces / required documents are the
 *     ones the product would really quote.
 *   - REAL scores: each offer's approval probability comes from the same
 *     `WeightedApprovalScoringService` the apply + preview paths use, reading the
 *     program's ACTIVE `ScoringWeightSet` (Principle V, two-level weights).
 *   - REAL answers: every application carries a full set of `application_answer`
 *     rows against the live GLOBAL question pool, so the detail page's
 *     questionnaire card and the "why this score" panel are populated.
 *   - The Feature-008 gate (`userProceededAt` + `userSelectedBankOfferId`) is set,
 *     which is what makes a row visible on the admin board at all.
 *
 * Category note: applications are only generated for categories that HAVE active
 * bank programs. With no active `business` program, business applications would
 * match nothing and can never be proceeded — the seeder logs that and skips them.
 *
 * Idempotent + top-up: seeded applications are tagged via `submissionCorrelationId`
 * prefix, counted, and only the difference to the target is created. Nothing that
 * this seeder did not create is ever deleted (even with RESET).
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { EngineService } from '../src/matching/engine.service';
import { ALL_LOAN_CATEGORIES } from '../src/common/loan-category.util';
import {
  askedWeightSum,
  computeProbability,
  normalizeWeights,
  tierFor,
  type ProgramScoring,
  type SelectedAnswer,
} from '../src/matching/scoring/approval-probability.scorer';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  Offer,
  ScoringConfig,
} from '../src/matching/types';

const prisma = new PrismaClient();
const engine = new EngineService();

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TARGET = Number(process.env['SEED_DEMO_APPS_COUNT'] ?? 42);
const RESET = process.env['SEED_DEMO_APPS_RESET'] === '1';

/** Marks every row this seeder owns — used for the count + the RESET scope. */
const DEMO_TAG = 'demo-board-';
const DEMO_PASSWORD = 'demo-password-12!';
const DEMO_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 4);

// Deterministic PRNG — a re-run reproduces the same board (mulberry32).
let rngState = 20260803;
function rand(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)] as T;
}

// ---------------------------------------------------------------------------
// Demo customers
// ---------------------------------------------------------------------------

interface DemoCustomer {
  phone: string;
  firstName: string;
  lastName: string;
  birthday: string;
  governorate: string;
  city: string;
  address: string;
}

const CUSTOMERS: readonly DemoCustomer[] = [
  { phone: '+201200100001', firstName: 'Youssef', lastName: 'Hassan', birthday: '1990-04-12', governorate: 'cairo', city: 'Nasr City', address: '14 El-Tayaran St.' },
  { phone: '+201200100002', firstName: 'Mariam', lastName: 'Adel', birthday: '1994-09-03', governorate: 'giza', city: 'Dokki', address: '8 Mosaddak St.' },
  { phone: '+201200100003', firstName: 'Omar', lastName: 'Saleh', birthday: '1987-01-22', governorate: 'cairo', city: 'Maadi', address: '22 Road 9' },
  { phone: '+201200100004', firstName: 'Nourhan', lastName: 'Fahmy', birthday: '1992-06-18', governorate: 'alexandria', city: 'Smouha', address: '5 Victor Emmanuel St.' },
  { phone: '+201200100005', firstName: 'Karim', lastName: 'El-Sayed', birthday: '1985-11-30', governorate: 'cairo', city: 'Heliopolis', address: '31 Baghdad St.' },
  { phone: '+201200100006', firstName: 'Salma', lastName: 'Ibrahim', birthday: '1996-02-14', governorate: 'giza', city: '6th of October', address: '3 Central Axis' },
  { phone: '+201200100007', firstName: 'Ahmed', lastName: 'Mansour', birthday: '1983-08-09', governorate: 'qalyubia', city: 'Banha', address: '11 El-Geish St.' },
  { phone: '+201200100008', firstName: 'Hana', lastName: 'Kamal', birthday: '1998-05-27', governorate: 'cairo', city: 'New Cairo', address: '77 South Teseen' },
  { phone: '+201200100009', firstName: 'Mostafa', lastName: 'Naguib', birthday: '1979-12-05', governorate: 'alexandria', city: 'Sidi Gaber', address: '19 Port Said St.' },
  { phone: '+201200100010', firstName: 'Dina', lastName: 'Shafik', birthday: '1991-03-21', governorate: 'cairo', city: 'Zamalek', address: '6 Brazil St.' },
  { phone: '+201200100011', firstName: 'Tarek', lastName: 'Ezzat', birthday: '1988-07-17', governorate: 'sharqia', city: 'Zagazig', address: '2 El-Mahatta Sq.' },
  { phone: '+201200100012', firstName: 'Rana', lastName: 'Gaber', birthday: '1995-10-08', governorate: 'giza', city: 'Sheikh Zayed', address: '40 Beverly Hills' },
  { phone: '+201200100013', firstName: 'Sherif', lastName: 'Abdel-Aziz', birthday: '1975-04-02', governorate: 'cairo', city: 'Shubra', address: '9 Khalousy St.' },
  { phone: '+201200100014', firstName: 'Laila', lastName: 'Mounir', birthday: '1999-01-19', governorate: 'dakahlia', city: 'Mansoura', address: '15 Gomhoreya St.' },
  { phone: '+201200100015', firstName: 'Hossam', lastName: 'Rashad', birthday: '1982-09-26', governorate: 'cairo', city: 'Mokattam', address: '3 Street 9' },
  { phone: '+201200100016', firstName: 'Yara', lastName: 'Sobhy', birthday: '1993-11-11', governorate: 'port_said', city: 'Port Said', address: '25 El-Gomhoreya St.' },
];

// ---------------------------------------------------------------------------
// Applicant archetypes — drive both the questionnaire answers and the engine
// profile, so the board shows a genuine spread of approval tiers.
// ---------------------------------------------------------------------------

type Strength = 'strong' | 'solid' | 'mid' | 'weak' | 'very_weak';

interface Archetype {
  strength: Strength;
  employmentType: string; // engine (coarse) vocabulary
  employmentAnswer: string; // questionnaire option code
  salaryTransferType: string; // engine vocabulary
  salaryTransferAnswer: string; // questionnaire option code
  monthsInJob: number;
  jobTenureAnswer: string;
  companyName: string;
  companyType: string;
  incomeEGP: number;
  obligationsEGP: number;
  hasCurrentLoan: boolean;
  currentLoansAnswer: string[];
  hasPreviousRejection: boolean;
  hasCreditCard: boolean;
  employerApprovedAnswer: string;
  additionalIncomeAnswer: string;
}

const ARCHETYPES: readonly Archetype[] = [
  {
    strength: 'strong',
    employmentType: 'salaried',
    employmentAnswer: 'government_employee',
    salaryTransferType: 'payroll',
    salaryTransferAnswer: 'payroll',
    monthsInJob: 96,
    jobTenureAnswer: 'more_than_3_years',
    companyName: 'Telecom Egypt',
    companyType: 'public_sector',
    incomeEGP: 48000,
    obligationsEGP: 2500,
    hasCurrentLoan: false,
    currentLoansAnswer: ['none'],
    hasPreviousRejection: false,
    hasCreditCard: true,
    employerApprovedAnswer: 'yes',
    additionalIncomeAnswer: 'yes',
  },
  {
    strength: 'solid',
    employmentType: 'salaried',
    employmentAnswer: 'private_sector_employee',
    salaryTransferType: 'payroll',
    salaryTransferAnswer: 'payroll',
    monthsInJob: 54,
    jobTenureAnswer: 'more_than_3_years',
    companyName: 'Vodafone Egypt',
    companyType: 'multinational',
    incomeEGP: 35000,
    obligationsEGP: 4200,
    hasCurrentLoan: true,
    currentLoansAnswer: ['credit_cards'],
    hasPreviousRejection: false,
    hasCreditCard: true,
    employerApprovedAnswer: 'yes',
    additionalIncomeAnswer: 'no',
  },
  {
    strength: 'mid',
    employmentType: 'salaried',
    employmentAnswer: 'private_sector_employee',
    salaryTransferType: 'salary_transfer_letter',
    salaryTransferAnswer: 'salary_transfer_letter',
    monthsInJob: 20,
    jobTenureAnswer: '1_to_3_years',
    companyName: 'Orange Egypt',
    companyType: 'private_sector',
    incomeEGP: 22000,
    obligationsEGP: 5200,
    hasCurrentLoan: true,
    currentLoansAnswer: ['personal_loan', 'credit_cards'],
    hasPreviousRejection: false,
    hasCreditCard: true,
    employerApprovedAnswer: 'not_sure',
    additionalIncomeAnswer: 'no',
  },
  {
    strength: 'mid',
    employmentType: 'self_employed',
    employmentAnswer: 'business_owner_company_owner',
    salaryTransferType: 'income_transfer_letter',
    salaryTransferAnswer: 'income_transfer_letter',
    monthsInJob: 40,
    jobTenureAnswer: 'more_than_3_years',
    companyName: 'Delta Trading',
    companyType: 'sme',
    incomeEGP: 60000,
    obligationsEGP: 9000,
    hasCurrentLoan: true,
    currentLoansAnswer: ['personal_loan'],
    hasPreviousRejection: false,
    hasCreditCard: false,
    employerApprovedAnswer: 'no',
    additionalIncomeAnswer: 'yes',
  },
  {
    strength: 'weak',
    employmentType: 'self_employed',
    employmentAnswer: 'freelancer',
    salaryTransferType: 'none',
    salaryTransferAnswer: 'no_salary_transfer',
    monthsInJob: 5,
    jobTenureAnswer: 'less_than_6_months',
    companyName: 'Independent',
    companyType: 'freelance',
    incomeEGP: 14000,
    obligationsEGP: 3800,
    hasCurrentLoan: true,
    currentLoansAnswer: ['personal_loan', 'car_loan'],
    hasPreviousRejection: true,
    hasCreditCard: true,
    employerApprovedAnswer: 'no',
    additionalIncomeAnswer: 'no',
  },
  {
    strength: 'weak',
    employmentType: 'salaried',
    employmentAnswer: 'private_sector_employee',
    salaryTransferType: 'none',
    salaryTransferAnswer: 'no_salary_transfer',
    monthsInJob: 9,
    jobTenureAnswer: '6_months_to_1_year',
    companyName: 'Cairo Logistics',
    companyType: 'private_sector',
    incomeEGP: 12500,
    obligationsEGP: 2600,
    hasCurrentLoan: false,
    currentLoansAnswer: ['none'],
    hasPreviousRejection: true,
    hasCreditCard: false,
    employerApprovedAnswer: 'not_sure',
    additionalIncomeAnswer: 'no',
  },
  {
    strength: 'very_weak',
    employmentType: 'retired',
    employmentAnswer: 'retired',
    salaryTransferType: 'none',
    salaryTransferAnswer: 'no_salary_transfer',
    monthsInJob: 3,
    jobTenureAnswer: 'less_than_6_months',
    companyName: 'Pension',
    companyType: 'none',
    incomeEGP: 9000,
    obligationsEGP: 6500,
    hasCurrentLoan: true,
    currentLoansAnswer: ['personal_loan', 'credit_cards', 'other'],
    hasPreviousRejection: true,
    hasCreditCard: true,
    employerApprovedAnswer: 'no',
    additionalIncomeAnswer: 'no',
  },
];

/**
 * How often each archetype appears. Cycling the array 1:1 gave a board that was
 * two-thirds `excellent`; a real triage queue skews to the middle, so mid/weak
 * personas repeat.
 */
const ARCHETYPE_MIX: readonly number[] = [0, 2, 4, 1, 3, 5, 2, 6, 3, 4, 1, 5];

// ---------------------------------------------------------------------------
// Per-category application shapes
// ---------------------------------------------------------------------------

// Mirrors the Prisma enum via the shared list rather than re-typing it, so a category
// added or removed by amendment cannot leave this seeder asserting yesterday's product
// scope (v15.0.0 added `fast`; v16.0.0 removed it again).
type Category = (typeof ALL_LOAN_CATEGORIES)[number];
type Priority =
  | 'lowest_installment'
  | 'lowest_interest'
  | 'fastest_approval'
  | 'least_paperwork';
type LeadStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

const PRIORITY_ANSWER: Record<Priority, string> = {
  lowest_installment: 'lowest_monthly_installment',
  lowest_interest: 'lowest_interest_rate',
  fastest_approval: 'fastest_approval',
  least_paperwork: 'least_documentation_required',
};

/** Category mix — weights the board the way a real funnel looks. */
const CATEGORY_MIX: readonly Category[] = [
  'personal', 'personal', 'car', 'personal', 'mortgage',
  'personal', 'car', 'business', 'mortgage', 'business',
];

const LEAD_MIX: readonly LeadStatus[] = [
  'pending', 'pending', 'in_progress', 'pending', 'done',
  'in_progress', 'pending', 'cancelled', 'in_progress', 'pending',
];

const AMOUNT_RANGE: Record<Category, { min: number; max: number; step: number }> = {
  personal: { min: 60_000, max: 500_000, step: 10_000 },
  car: { min: 250_000, max: 1_400_000, step: 25_000 },
  mortgage: { min: 900_000, max: 4_500_000, step: 100_000 },
  business: { min: 300_000, max: 3_000_000, step: 50_000 },
};

const TENOR_CHOICES: Record<Category, readonly number[]> = {
  personal: [24, 36, 48, 60],
  car: [36, 48, 60, 72],
  mortgage: [84, 96, 120],
  business: [36, 48, 60],
};

const LOAN_PURPOSE_ANSWER: Record<Category, readonly string[]> = {
  personal: ['home_finishing_renovation', 'marriage', 'education', 'debt_consolidation_settling_obligations', 'purchasing_appliances_or_furniture'],
  car: ['personal_project', 'other'],
  mortgage: ['home_finishing_renovation', 'other'],
  business: ['personal_project'],
};

interface AppSpec {
  customer: DemoCustomer;
  archetype: Archetype;
  category: Category;
  amountEGP: number;
  tenorMonths: number;
  age: number;
  priority: Priority;
  leadStatus: LeadStatus;
  daysAgo: number;
  decision: 'approved' | 'rejected' | null;
}

function ageFromBirthday(birthday: string, at: Date): number {
  const b = new Date(birthday);
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age -= 1;
  return age;
}

function buildSpecs(count: number, categories: readonly Category[]): AppSpec[] {
  const now = new Date();
  const specs: AppSpec[] = [];
  const priorities: readonly Priority[] = [
    'lowest_installment',
    'lowest_interest',
    'fastest_approval',
    'least_paperwork',
  ];

  for (let i = 0; i < count; i += 1) {
    const wanted = CATEGORY_MIX[i % CATEGORY_MIX.length] as Category;
    // Fall back to a category that actually has programs.
    const category = categories.includes(wanted) ? wanted : (categories[i % categories.length] as Category);
    const customer = CUSTOMERS[i % CUSTOMERS.length] as DemoCustomer;
    const archetype = ARCHETYPES[
      (ARCHETYPE_MIX[i % ARCHETYPE_MIX.length] as number) % ARCHETYPES.length
    ] as Archetype;
    const range = AMOUNT_RANGE[category];
    const steps = Math.floor((range.max - range.min) / range.step);
    const amountEGP = range.min + range.step * Math.floor(rand() * (steps + 1));
    const daysAgo = Math.floor((i / count) * 75) + Math.floor(rand() * 3);
    const createdAt = new Date(now.getTime() - daysAgo * DAY);
    const leadStatus = LEAD_MIX[i % LEAD_MIX.length] as LeadStatus;

    specs.push({
      customer,
      archetype,
      category,
      amountEGP,
      tenorMonths: pick(TENOR_CHOICES[category]),
      age: ageFromBirthday(customer.birthday, createdAt),
      priority: priorities[i % priorities.length] as Priority,
      leadStatus,
      daysAgo,
      // Bank decisions only exist for leads sales already worked.
      decision:
        leadStatus === 'done' ? 'approved' : leadStatus === 'cancelled' ? 'rejected' : null,
    });
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Questionnaire answers — every active question in the GLOBAL pool is answered,
// so the admin detail page renders a complete questionnaire card.
// ---------------------------------------------------------------------------

interface QuestionRow {
  id: string;
  code: string;
  type: string;
  isRequired: boolean;
  optionCodes: string[];
}

interface AnswerValue {
  optionCode?: string;
  optionCodes?: string[];
  numericValue?: string;
  textValue?: string;
}

function propertyValueAnswer(amount: number): string {
  if (amount < 1_000_000) return 'less_than_egp_1_million';
  if (amount < 3_000_000) return 'egp_1_3_million';
  if (amount < 5_000_000) return 'egp_3_5_million';
  return 'more_than_egp_5_million';
}

function vehiclePriceAnswer(amount: number): string {
  if (amount < 500_000) return 'less_than_egp_500000';
  if (amount < 1_000_000) return 'egp_500000_1_million';
  if (amount < 2_000_000) return 'egp_1_2_million';
  return 'more_than_egp_2_million';
}

function financingAmountAnswer(amount: number): string {
  if (amount < 250_000) return 'less_than_egp_250000';
  if (amount < 1_000_000) return 'egp_250000_1_million';
  if (amount < 5_000_000) return 'egp_1_5_million';
  return 'more_than_egp_5_million';
}

function monthlyRevenueAnswer(income: number): string {
  const revenue = income * 4;
  if (revenue < 50_000) return 'less_than_egp_50000';
  if (revenue < 200_000) return 'egp_50000_200000';
  if (revenue < 500_000) return 'egp_200000_500000';
  return 'more_than_egp_500000';
}

function buildAnswers(spec: AppSpec): Record<string, AnswerValue> {
  const a = spec.archetype;
  const strong = a.strength === 'strong' || a.strength === 'solid';
  /**
   * Pick the answer that matches the archetype's credit strength. Without this
   * the "weak" personas answered the discretionary questions as well as the
   * strong ones and the whole board landed in one tier.
   */
  const byStrength = <T>(best: T, middle: T, worst: T): T =>
    strong ? best : a.strength === 'mid' ? middle : worst;
  return {
    // Financing
    repayment_period_months: { numericValue: String(spec.tenorMonths) },
    amount_requested: { numericValue: spec.amountEGP.toFixed(2) },
    loan_purpose: {
      optionCode: byStrength(
        pick(LOAN_PURPOSE_ANSWER[spec.category]),
        'personal_project',
        'debt_consolidation_settling_obligations',
      ),
    },

    // Employment + income
    monthly_income: { numericValue: a.incomeEGP.toFixed(2) },
    employment_status: { optionCode: a.employmentAnswer },
    job_tenure: { optionCode: a.jobTenureAnswer },
    salary_transfer: { optionCode: a.salaryTransferAnswer },
    salary_bank: { optionCode: strong ? 'a_specific_bank' : 'no_specific_bank' },
    employer_approved: { optionCode: a.employerApprovedAnswer },
    additional_income: { optionCode: a.additionalIncomeAnswer },
    active_account: { optionCode: strong ? 'yes' : 'no' },

    // Commitments
    current_installments: { numericValue: a.obligationsEGP.toFixed(2) },
    current_loans: { optionCodes: a.currentLoansAnswer },
    current_facilities: { optionCode: a.hasCurrentLoan ? 'yes' : 'no' },

    // Preferences
    priority_factor: { optionCode: PRIORITY_ANSWER[spec.priority] },
    prior_rejection: { optionCode: a.hasPreviousRejection ? 'yes' : 'no' },
    needs_consultant: { optionCode: byStrength('no', 'no', 'yes') },
    needs_assistance: { optionCode: byStrength('no', 'yes', 'yes') },
    wants_insurance: { optionCode: strong ? 'yes' : 'no' },
    needs_consultation: { optionCode: byStrength('no', 'no', 'yes') },

    // Property (answered by everyone — the pool is global)
    property_type: {
      optionCode:
        spec.category === 'mortgage'
          ? byStrength('apartment', 'duplex', 'commercial_shop')
          : 'apartment',
    },
    in_compound: { optionCode: spec.category === 'mortgage' && strong ? 'yes' : 'no' },
    registration_status: {
      optionCode: byStrength('officially_registered', 'eligible_for_registration', 'not_registered'),
    },
    governorate: { optionCode: spec.customer.governorate },
    property_value: { optionCode: propertyValueAnswer(spec.category === 'mortgage' ? spec.amountEGP * 1.4 : 1_500_000) },
    down_payment: {
      // Active codes only: the merged global pool retired `more_than_30`,
      // `20_40` and `less_than_20` (they survive as deactivated rows, so a
      // lookup by code still finds them but the seeder's guard rejects them).
      optionCode:
        spec.category === 'mortgage'
          ? byStrength('more_than_40', '20_30', '10_20')
          : byStrength('30_40', 'less_than_10', 'no_down_payment'),
    },

    // Vehicle
    vehicle_condition: { optionCode: spec.category === 'car' ? byStrength('new', 'new', 'used') : 'new' },
    model_year: {
      optionCode:
        spec.category === 'car'
          ? byStrength('current_year_model', 'within_the_last_3_years', 'more_than_5_years_old')
          : 'current_year_model',
    },
    vehicle_price: { optionCode: vehiclePriceAnswer(spec.category === 'car' ? spec.amountEGP * 1.25 : 700_000) },

    // Business
    activity_type: { optionCode: byStrength('manufacturing', 'services', 'restaurants_cafes') },
    business_age: { optionCode: byStrength('more_than_2_years', '1_to_2_years', 'less_than_1_year') },
    financing_amount: { optionCode: financingAmountAnswer(spec.amountEGP) },
    financing_purpose: { optionCode: byStrength('expansion', 'working_capital', 'settling_obligations') },
    monthly_revenue: { optionCode: monthlyRevenueAnswer(a.incomeEGP) },
    business_account: { optionCode: strong ? 'yes' : 'no' },
    registered: { optionCode: byStrength('yes', 'registration_in_progress', 'no') },
    tax_registration: { optionCode: strong ? 'yes' : 'no' },
  };
}

// ---------------------------------------------------------------------------
// Engine input
// ---------------------------------------------------------------------------

function buildProfile(spec: AppSpec): ApplicantProfile {
  const a = spec.archetype;
  return {
    age: spec.age,
    loanPurpose: spec.category,
    requestedAmountEGP: new Decimal(spec.amountEGP),
    preferredTenorMonths: spec.tenorMonths,
    priority: spec.priority,
    nationalId: nationalIdFor(spec),
    employment: {
      employmentType: a.employmentType,
      monthlyNetSalaryEGP: new Decimal(a.incomeEGP),
      monthsInJob: a.monthsInJob,
      salaryTransferType: a.salaryTransferType,
      companyName: a.companyName,
      companyType: a.companyType,
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal(a.obligationsEGP),
      hasCurrentLoan: a.hasCurrentLoan,
      hasPreviousRejection: a.hasPreviousRejection,
    },
    assets: {
      creditCardLimitEGP: a.hasCreditCard ? new Decimal(50_000) : undefined,
      bankStatementBalanceEGP: new Decimal(Math.round(a.incomeEGP * 2.5)),
    },
    ...(spec.category === 'mortgage'
      ? {
          mortgageDetails: {
            propertyValueEGP: new Decimal(Math.round(spec.amountEGP * 1.4)),
            downPaymentEGP: new Decimal(Math.round(spec.amountEGP * 0.4)),
            propertyType: 'apartment',
            isCompound: a.strength === 'strong',
            constructionStage: 'ready',
          },
        }
      : {}),
    ...(spec.category === 'car'
      ? {
          carDetails: {
            carValueEGP: new Decimal(Math.round(spec.amountEGP * 1.25)),
            downPaymentEGP: new Decimal(Math.round(spec.amountEGP * 0.25)),
          },
        }
      : {}),
  } as ApplicantProfile;
}

function nationalIdFor(spec: AppSpec): string {
  const b = spec.customer.birthday.replace(/-/g, '').slice(2); // YYMMDD
  const serial = spec.customer.phone.slice(-5); // stable per customer
  return `2${b}0${serial}1`;
}

function normalizeEligibility(raw: unknown): BankProgramSnapshot['eligibility'] {
  const e = (raw ?? {}) as Record<string, unknown>;
  return {
    ...e,
    minAge: e['minAge'] ?? e['ageMin'],
    maxAge: e['maxAge'] ?? e['ageMax'],
    acceptedSalaryTransferTypes: e['acceptedSalaryTransferTypes'] ?? e['acceptedTransferTypes'],
  } as unknown as BankProgramSnapshot['eligibility'];
}

type ProgramRow = Awaited<ReturnType<typeof loadPrograms>>[number];

async function loadPrograms() {
  return prisma.bankProgram.findMany({
    where: { active: true },
    include: { bank: { select: { isFeatured: true } } },
  });
}

function toSnapshot(p: ProgramRow): BankProgramSnapshot {
  return {
    id: p.id,
    programCode: p.programCode,
    bankName: p.bank ? p.bankName : p.bankName,
    bankIsFeatured: p.bank?.isFeatured ?? false,
    friendlyName: p.friendlyName,
    programType: p.programType,
    productCategory: p.productCategory,
    active: p.active,
    isShariaCompliant: p.isShariaCompliant,
    version: p.version,
    requiredDocuments: p.requiredDocuments,
    createdAt: p.createdAt,
    tenor: p.tenor as unknown as BankProgramSnapshot['tenor'],
    loanLimits: p.loanLimits as unknown as BankProgramSnapshot['loanLimits'],
    pricing: p.pricing as unknown as BankProgramSnapshot['pricing'],
    eligibility: normalizeEligibility(p.eligibility),
    incomeAssumption: p.incomeAssumption as unknown as BankProgramSnapshot['incomeAssumption'],
    fees: p.fees as unknown as BankProgramSnapshot['fees'],
    performanceCriteria: p.performanceCriteria as unknown as
      | BankProgramSnapshot['performanceCriteria']
      | undefined,
  };
}

/**
 * The same two-level formula the apply path runs (Principle V v13.0.0):
 * `Σ_answered(questionWeight × answerScore/100) ÷ Σ_asked(questionWeight)`, with
 * the per-answer contributions kept as the offer's `approvalFactors` so the
 * admin "why this score" panel has real content.
 *
 * The demo applicant was asked exactly what they answered, so the asked set is
 * every question code the spec produced a row for — including the numeric and
 * text ones, which carry no weight and so drop out of the sum anyway.
 */
function scoreProgram(
  scoring: ProgramScoring,
  answers: readonly SelectedAnswer[],
  askedQuestionCodes: readonly string[],
): { score: number; tier: string; factors: { positive: Array<{ code: string; impact: number }>; negative: never[] } } {
  const probability = computeProbability(scoring, answers, askedQuestionCodes);
  const denominator = askedWeightSum(scoring, askedQuestionCodes);
  const positive =
    denominator <= 0
      ? []
      : answers
          .map((ans) => {
            const weight = scoring.questionWeights[ans.questionCode] ?? 0;
            const optionScore = scoring.answerScores[ans.questionCode]?.[ans.optionCode] ?? 0;
            return { code: ans.optionCode, impact: Math.round((weight * optionScore) / denominator) };
          })
          .filter((f) => f.impact > 0)
          .sort((x, y) => y.impact - x.impact);
  return {
    score: Math.round(probability * 100),
    tier: tierFor(probability),
    factors: { positive, negative: [] },
  };
}

function jsonify(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (v instanceof Decimal ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function ensureCustomers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const email = `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase().replace(/[^a-z]/g, '')}@masrafy.demo`;
    const row = await prisma.customerAccount.upsert({
      where: { phone: c.phone },
      update: {
        firstName: c.firstName,
        lastName: c.lastName,
        governorate: c.governorate,
        city: c.city,
        address: c.address,
        isVerified: true,
        isActive: true,
      },
      create: {
        registrationPath: 'PHONE',
        phone: c.phone,
        mobileVerifiedAt: new Date(),
        email,
        firstName: c.firstName,
        lastName: c.lastName,
        birthday: new Date(c.birthday),
        governorate: c.governorate,
        city: c.city,
        address: c.address,
        locale: 'ar-EG',
        passwordHash: DEMO_PASSWORD_HASH,
        isVerified: true,
        isActive: true,
        lastLoginAt: new Date(Date.now() - Math.floor(rand() * 10) * DAY),
      },
    });
    ids.set(c.phone, row.id);

    // National ID front + back: the select-offer commitment gate (v9.1.0)
    // refuses to mark an application as proceeded without them.
    for (const side of ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK'] as const) {
      const s3Key = `customers/${row.id}/national-id/${side.toLowerCase()}.jpg`;
      await prisma.document.upsert({
        where: { s3Key },
        update: { status: 'uploaded' },
        create: {
          customerId: row.id,
          documentType: side,
          s3Key,
          status: 'uploaded',
          uploadedByContext: 'user',
          uploadedBySource: 'mobile_app',
          uploadedByCustomerId: row.id,
          originalFilename: `${side.toLowerCase()}.jpg`,
          mimeType: 'image/jpeg',
          sizeBytes: 184_320,
        },
      });
    }
  }
  return ids;
}

async function loadQuestions(): Promise<Map<string, QuestionRow>> {
  const rows = await prisma.question.findMany({
    where: { isActive: true },
    include: { options: { where: { isActive: true }, select: { code: true } } },
  });
  const out = new Map<string, QuestionRow>();
  for (const q of rows) {
    out.set(q.code, {
      id: q.id,
      code: q.code,
      type: q.type,
      isRequired: q.isRequired,
      optionCodes: q.options.map((o) => o.code),
    });
  }
  return out;
}

async function loadScoringConfig(): Promise<ScoringConfig> {
  const row = await prisma.scoringEngineVersion.findFirst({ where: { deactivatedAt: null } });
  if (!row) throw new Error('No active scoring engine version — run `npx prisma db seed` first.');
  const cfg = row.weightsConfig as unknown as {
    weights: Record<string, number>;
    thresholds: ScoringConfig['thresholds'];
    factorCatalog: ScoringConfig['factorCatalog'];
    legacy?: boolean;
  };
  return {
    version: row.version,
    weights: cfg.weights,
    thresholds: cfg.thresholds,
    factorCatalog: cfg.factorCatalog,
    legacy: cfg.legacy ?? false,
  };
}

async function resetSeededRows(): Promise<void> {
  const deleted = await prisma.application.deleteMany({
    where: { submissionCorrelationId: { startsWith: DEMO_TAG } },
  });
  console.log(`[seed:apps:demo] reset — deleted ${deleted.count} previously seeded application(s).`);
}

async function main(): Promise<void> {
  if (RESET) await resetSeededRows();

  const already = await prisma.application.count({
    where: { submissionCorrelationId: { startsWith: DEMO_TAG } },
  });
  const toCreate = Math.max(0, DEFAULT_TARGET - already);
  if (toCreate === 0) {
    console.log(
      `[seed:apps:demo] ${already} seeded application(s) already present (target ${DEFAULT_TARGET}) — nothing to do.`,
    );
    return;
  }

  const programs = await loadPrograms();
  if (programs.length === 0) throw new Error('No active bank programs — run `npm run seed:banks` first.');

  const byCategory = new Map<string, BankProgramSnapshot[]>();
  for (const p of programs) {
    const key = p.productCategory.toLowerCase();
    const list = byCategory.get(key) ?? [];
    list.push(toSnapshot(p));
    byCategory.set(key, list);
  }
  // Read from the shared list, so a category added or removed by amendment is seeded — or
  // explicitly reported as skipped — without an edit here.
  const seedable = ALL_LOAN_CATEGORIES.filter((c) => (byCategory.get(c)?.length ?? 0) > 0);
  const skipped = ALL_LOAN_CATEGORIES.filter((c) => !seedable.includes(c));
  if (skipped.length > 0) {
    console.log(
      `[seed:apps:demo] no active bank program for: ${skipped.join(', ')} — no applications generated for those categories.`,
    );
  }

  const [customerIds, questions, scoringConfig] = await Promise.all([
    ensureCustomers(),
    loadQuestions(),
    loadScoringConfig(),
  ]);

  const activeVersion = await prisma.questionnaireVersion.findFirst({ where: { isActive: true } });

  // ACTIVE weight set per program (Principle V) — read once, reused per offer.
  const weightSets = await prisma.scoringWeightSet.findMany({ where: { status: 'ACTIVE' } });
  const scoringByProgramId = new Map<string, ProgramScoring>(
    weightSets.map((w) => [w.bankProgramId, normalizeWeights(w.weights)]),
  );
  const programIdByCode = new Map(programs.map((p) => [p.programCode, p.id]));

  const specs = buildSpecs(toCreate, seedable);
  let created = 0;
  let offersCreated = 0;
  const tierTally: Record<string, number> = {};

  for (const [index, spec] of specs.entries()) {
    const customerId = customerIds.get(spec.customer.phone);
    if (!customerId) continue;

    const answers = buildAnswers(spec);
    // Guard: a code that no longer exists in the pool would silently drop an
    // answer row and leave the questionnaire card half-empty.
    const answerRows: Prisma.ApplicationAnswerCreateManyApplicationInput[] = [];
    const selectedAnswers: SelectedAnswer[] = [];
    // The scoring denominator: what this demo applicant was put in front of.
    const askedQuestionCodes: string[] = [];
    for (const [code, value] of Object.entries(answers)) {
      const q = questions.get(code);
      if (!q) continue; // question retired since this seeder was written
      if (value.optionCode && !q.optionCodes.includes(value.optionCode)) {
        throw new Error(`[seed:apps:demo] option "${value.optionCode}" not valid for question "${code}"`);
      }
      // MULTI_SELECT answers went unchecked, so a retired code here used to be
      // written straight into application_answer instead of failing loudly.
      for (const multiCode of value.optionCodes ?? []) {
        if (!q.optionCodes.includes(multiCode)) {
          throw new Error(`[seed:apps:demo] option "${multiCode}" not valid for question "${code}"`);
        }
      }
      answerRows.push({
        questionId: q.id,
        questionCode: code,
        selectedOptionCodes: value.optionCodes ?? (value.optionCode ? [value.optionCode] : []),
        selectedOptionCode: value.optionCode ?? null,
        selectedOptionId: null,
        textValue: value.textValue ?? null,
        numericValue: value.numericValue ? new Prisma.Decimal(value.numericValue) : null,
      });
      askedQuestionCodes.push(code);
      if (value.optionCode) {
        selectedAnswers.push({ questionCode: code, optionCode: value.optionCode });
      }
    }
    // Resolve option ids for the single-choice answers (the scorer + the admin
    // answer views read the denormalised code, the id keeps the FK honest).
    for (const row of answerRows) {
      if (!row.selectedOptionCode) continue;
      const option = await prisma.questionOption.findFirst({
        where: { questionId: row.questionId, code: row.selectedOptionCode },
        select: { id: true },
      });
      row.selectedOptionId = option?.id ?? null;
    }

    const categoryPrograms = byCategory.get(spec.category) ?? [];
    const profile = buildProfile(spec);
    const result = engine.run({
      profile,
      programs: categoryPrograms,
      scoringConfig,
      skipEligibility: true,
    });
    if (result.offers.length === 0) {
      console.log(`[seed:apps:demo] skipped #${index} (${spec.category}) — engine produced no offer.`);
      continue;
    }

    // Per-bank weighted approval score (overrides the engine's generic one).
    for (const offer of result.offers) {
      const programId = programIdByCode.get(offer.programCode);
      const scoring = (programId && scoringByProgramId.get(programId)) || {
        questionWeights: {},
        answerScores: {},
      };
      const scored = scoreProgram(scoring, selectedAnswers, askedQuestionCodes);
      offer.approvalProbability = {
        score: scored.score,
        tier: scored.tier,
        factors: scored.factors,
        // No ACTIVE weight set → this 0 means "nobody configured the program",
        // and the board must not render it as a poor fit.
        usedDefault: !(programId && scoringByProgramId.has(programId)),
      } as Offer['approvalProbability'];
      offer.approvalProbabilityPercent = scored.score;
    }
    const ranked = [...result.offers].sort(
      (x, y) => y.approvalProbability.score - x.approvalProbability.score,
    );
    const best = ranked[0] as Offer;

    const createdAt = new Date(Date.now() - spec.daysAgo * DAY);
    // Applicants proceed a few hours to a couple of days after matching.
    const proceededAt = new Date(
      Math.min(Date.now(), createdAt.getTime() + Math.floor(rand() * 36 + 2) * 60 * 60 * 1000),
    );

    const applicationId = await prisma.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          applicantUserId: customerId,
          submissionCorrelationId: `${DEMO_TAG}${String(already + created + 1).padStart(4, '0')}-${index}`,
          status: 'matched',
          leadStatus: spec.leadStatus,
          priority: spec.priority,
          requestedAmountEGP: new Prisma.Decimal(spec.amountEGP),
          preferredTenorMonths: spec.tenorMonths,
          loanPurpose: spec.category,
          category: spec.category,
          questionnaireVersionId: activeVersion?.id ?? null,
          age: spec.age,
          applicantProfile: jsonify(profile),
          summary: jsonify({
            programsCheckedCount: result.programsChecked,
            eligibleProgramsCount: result.eligibleCount,
            engineDurationMs: result.engineDurationMs,
            bestRatePercent: best.effectiveRatePercent.toFixed(4),
            bestInstallmentEGP: best.monthlyInstallmentEGP.toFixed(2),
          }),
          engineDurationMs: result.engineDurationMs,
          programsCheckedCount: result.programsChecked,
          eligibleProgramsCount: result.eligibleCount,
          createdAt,
          dynamicAnswers: { createMany: { data: answerRows } },
        },
        select: { id: true },
      });

      let selectedOfferId: string | null = null;
      for (const offer of ranked) {
        const row = await tx.bankOffer.create({
          data: {
            applicationId: app.id,
            programCode: offer.programCode,
            programVersion: offer.programVersion,
            bankName: offer.bankName,
            bankIsFeatured: offer.bankIsFeatured,
            isShariaCompliant: offer.isShariaCompliant,
            programFriendlyName: offer.programFriendlyName,
            effectiveRatePercent: new Prisma.Decimal(offer.effectiveRatePercent.toString()),
            monthlyInstallmentEGP: new Prisma.Decimal(offer.monthlyInstallmentEGP.toString()),
            requestedLoanAmountEGP: new Prisma.Decimal(offer.requestedLoanAmountEGP.toString()),
            effectiveLoanAmountEGP: new Prisma.Decimal(offer.effectiveLoanAmountEGP.toString()),
            requestedTenorMonths: offer.requestedTenorMonths,
            effectiveTenorMonths: offer.effectiveTenorMonths,
            feesBreakdown: jsonify(offer.feesBreakdown),
            approvalProbabilityPercent: new Prisma.Decimal(offer.approvalProbabilityPercent),
            approvalScore: offer.approvalProbability.score,
            approvalTier: offer.approvalProbability.tier,
            approvalFactors: jsonify(offer.approvalProbability.factors),
            approvalUsedDefault: offer.approvalProbability.usedDefault ?? false,
            engineVersion: scoringConfig.version,
            requiredDocuments: offer.requiredDocuments,
            matchReasons: offer.matchReasons,
            cascadeTrace: jsonify(offer.cascadeTrace),
            qualitativeReviewBadge: offer.qualitativeReviewBadge,
            selfDeclared: offer.selfDeclared,
            maxLoanAvailableEGP: offer.maxLoanAvailableEGP
              ? new Prisma.Decimal(offer.maxLoanAvailableEGP.toString())
              : null,
            createdAt,
          },
          select: { id: true },
        });
        offersCreated += 1;
        if (selectedOfferId === null) selectedOfferId = row.id;

        // Bank decision on the offer the applicant proceeded with.
        if (spec.decision && row.id === selectedOfferId) {
          await tx.bankOfferDecision.create({
            data: {
              bankOfferId: row.id,
              outcome: spec.decision,
              recordedAt: new Date(proceededAt.getTime() + 2 * DAY),
              decisionLatencyMs: 2 * DAY,
            },
          });
        }
      }

      // Feature-008 user-intent gate — without this the row never reaches the
      // admin board (the list filters on `userProceededAt`).
      await tx.application.update({
        where: { id: app.id },
        data: { userSelectedBankOfferId: selectedOfferId, userProceededAt: proceededAt },
      });

      await tx.questionnaireAnswer.create({
        data: {
          customerId,
          applicationId: app.id,
          payloadJson: jsonify({
            category: spec.category,
            answers: Object.entries(answers).map(([questionCode, v]) => ({
              questionCode,
              ...v,
            })),
          }),
        },
      });

      return app.id;
    });

    tierTally[best.approvalProbability.tier] = (tierTally[best.approvalProbability.tier] ?? 0) + 1;
    created += 1;
    if (created % 10 === 0) console.log(`[seed:apps:demo] ${created}/${toCreate}… (last ${applicationId})`);
  }

  console.log(
    `[seed:apps:demo] created ${created} application(s) + ${offersCreated} offer(s); board total ≈ ${already + created}.`,
  );
  console.log(`[seed:apps:demo] selected-offer tiers: ${JSON.stringify(tierTally)}`);
  console.log(`[seed:apps:demo] demo customers login: ${CUSTOMERS[0]?.phone} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
