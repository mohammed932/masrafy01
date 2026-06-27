/**
 * Demo seeder — populates the dev DB with realistic data so the admin UI
 * has something to render. Idempotent: re-running skips already-seeded rows.
 *
 *   npm run seed:demo
 *
 * What it creates (in order):
 *   1.  8 bank programs (ABK + competitor mix; minimal but realistic)
 *   2.  1 sales_manager + 3 sales_agent + 1 analyst (dev passwords)
 *   3. 23 applications (matched, with masked applicant profiles)
 *
 * Re-running is safe — every step checks for existing rows first.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { seedCustomers } from './seed-customers';

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'ops@masrafy.local';
const DEV_PASSWORD = 'dev-password-12!';

interface DemoStaff {
  email: string;
  name: string;
  role: 'sales_manager' | 'sales_agent' | 'analyst';
}

const DEMO_STAFF: DemoStaff[] = [
  { email: 'manager.a@masrafy.local', name: 'Manager Aya', role: 'sales_manager' },
  { email: 'agent.a@masrafy.local', name: 'Agent Adel', role: 'sales_agent' },
  { email: 'agent.b@masrafy.local', name: 'Agent Bassem', role: 'sales_agent' },
  { email: 'agent.c@masrafy.local', name: 'Agent Carol', role: 'sales_agent' },
  { email: 'analyst.a@masrafy.local', name: 'Analyst Ahmed', role: 'analyst' },
];

// Constitution v1.7.0 / Principle II scope-lock — 4 active categories.
const LOAN_PURPOSES = ['personal', 'car', 'mortgage', 'business'] as const;
const PRIORITIES = [
  'lowest_installment',
  'lowest_interest',
  'fastest_approval',
  'least_paperwork',
] as const;

const FIRST_NAMES = ['Ahmed', 'Mohamed', 'Mahmoud', 'Khaled', 'Yasser', 'Tarek', 'Hany', 'Sherif', 'Hossam', 'Adel', 'Nour', 'Layla', 'Reem', 'Sara', 'Hanan'];
const LAST_NAMES = ['Hassan', 'Mansour', 'Salah', 'Ibrahim', 'Said', 'Fahmy', 'Kamal', 'Aziz', 'Naguib', 'El-Sayed'];
const COMPANIES = ['Telecom Egypt', 'CIB', 'NBE', 'Etisalat Misr', 'Orange Egypt', 'Schlumberger', 'Vodafone', 'Microsoft Egypt', 'Egyptair', 'Independent'];

function randomFromSet<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

async function findOrCreateStaff(s: DemoStaff): Promise<string> {
  const email = s.email.toLowerCase();
  const existing = await prisma.staffAccount.findUnique({ where: { email } });
  if (existing) {
    log(`staff: ${email} already present`);
    return existing.id;
  }
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  const created = await prisma.staffAccount.create({
    data: {
      email,
      emailDisplay: s.email,
      name: s.name,
      passwordHash,
      role: s.role,
      isActive: true,
      mustChangePassword: false,
    },
  });
  log(`staff: created ${email} (${s.role}) password=${DEV_PASSWORD}`);
  return created.id;
}

async function ensureSuperAdminId(): Promise<string> {
  const existing = await prisma.staffAccount.findUnique({
    where: { email: SUPER_ADMIN_EMAIL.toLowerCase() },
  });
  if (!existing) {
    throw new Error(
      `Super-admin (${SUPER_ADMIN_EMAIL}) not seeded yet. Run \`npx prisma db seed\` first.`,
    );
  }
  return existing.id;
}

interface DemoProgram {
  programCode: string;
  bankName: string;
  friendlyName: string;
  friendlyNameAr: string;
  productCategory: string;
  baseRatePercent: string;
  minAmount: string;
  maxAmount: string;
  minMonthlyIncomeEGP: string;
  ageMin: number;
  ageMax: number;
  programType: 'income_proof' | 'income_surrogate';
}

const DEMO_PROGRAMS: DemoProgram[] = [
  {
    programCode: 'ABK-PAYROLL-CAT-A',
    bankName: 'ABK Egypt',
    friendlyName: 'Payroll — Category A',
    friendlyNameAr: 'الرواتب — الفئة أ',
    productCategory: 'personal',
    baseRatePercent: '22.5000',
    minAmount: '50000',
    maxAmount: '2000000',
    minMonthlyIncomeEGP: '15000',
    ageMin: 21,
    ageMax: 60,
    programType: 'income_proof',
  },
  {
    programCode: 'ABK-PAYROLL-CAT-B',
    bankName: 'ABK Egypt',
    friendlyName: 'Payroll — Category B',
    friendlyNameAr: 'الرواتب — الفئة ب',
    productCategory: 'personal',
    baseRatePercent: '24.5000',
    minAmount: '50000',
    maxAmount: '1500000',
    minMonthlyIncomeEGP: '10000',
    ageMin: 21,
    ageMax: 60,
    programType: 'income_proof',
  },
  {
    programCode: 'ABK-SELF-EMP',
    bankName: 'ABK Egypt',
    friendlyName: 'Self-Employed & Professionals',
    friendlyNameAr: 'العمل الحر والمهنيون',
    productCategory: 'personal',
    baseRatePercent: '28.5000',
    minAmount: '50000',
    maxAmount: '1000000',
    minMonthlyIncomeEGP: '20000',
    ageMin: 25,
    ageMax: 60,
    programType: 'income_surrogate',
  },
  {
    programCode: 'ABK-AUTO-PRIME',
    bankName: 'ABK Egypt',
    friendlyName: 'Auto Loan — Prime',
    friendlyNameAr: 'تمويل السيارات — متميز',
    productCategory: 'car',
    baseRatePercent: '19.9000',
    minAmount: '100000',
    maxAmount: '3000000',
    minMonthlyIncomeEGP: '20000',
    ageMin: 21,
    ageMax: 65,
    programType: 'income_proof',
  },
  {
    programCode: 'ABK-MORTGAGE-CIB-COMPOUND',
    bankName: 'ABK Egypt',
    friendlyName: 'Mortgage — Compound Property',
    friendlyNameAr: 'تمويل عقاري — كمبوند',
    productCategory: 'mortgage',
    baseRatePercent: '21.0000',
    minAmount: '500000',
    maxAmount: '10000000',
    minMonthlyIncomeEGP: '40000',
    ageMin: 25,
    ageMax: 65,
    programType: 'income_proof',
  },
  {
    programCode: 'BANK-NXT-PERSONAL',
    bankName: 'Bank NXT',
    friendlyName: 'Personal Loan — Standard',
    friendlyNameAr: 'القرض الشخصي — العادي',
    productCategory: 'personal',
    baseRatePercent: '26.0000',
    minAmount: '30000',
    maxAmount: '1200000',
    minMonthlyIncomeEGP: '8000',
    ageMin: 21,
    ageMax: 60,
    programType: 'income_proof',
  },
  // ─── New banks (added 2026-05-18) ─────────────────────────────────────────
  {
    programCode: 'CIB-PRIME-PERSONAL',
    bankName: 'CIB',
    friendlyName: 'Prime Personal Loan',
    friendlyNameAr: 'القرض الشخصي المتميز',
    productCategory: 'personal',
    baseRatePercent: '23.0000',
    minAmount: '50000',
    maxAmount: '2500000',
    minMonthlyIncomeEGP: '12000',
    ageMin: 21,
    ageMax: 60,
    programType: 'income_proof',
  },
  {
    programCode: 'NBE-PAYROLL-PRIME',
    bankName: 'National Bank of Egypt',
    friendlyName: 'Payroll Prime',
    friendlyNameAr: 'الرواتب المميزة',
    productCategory: 'personal',
    baseRatePercent: '22.0000',
    minAmount: '40000',
    maxAmount: '2000000',
    minMonthlyIncomeEGP: '10000',
    ageMin: 21,
    ageMax: 60,
    programType: 'income_proof',
  },
  {
    programCode: 'BM-AUTO-CLASSIC',
    bankName: 'Banque Misr',
    friendlyName: 'Auto Loan — Classic',
    friendlyNameAr: 'تمويل السيارات — كلاسيك',
    productCategory: 'car',
    baseRatePercent: '20.5000',
    minAmount: '150000',
    maxAmount: '2500000',
    minMonthlyIncomeEGP: '18000',
    ageMin: 21,
    ageMax: 65,
    programType: 'income_proof',
  },
  {
    programCode: 'QNB-MORTGAGE-FAMILY',
    bankName: 'QNB Al Ahli',
    friendlyName: 'Family Home Mortgage',
    friendlyNameAr: 'تمويل المنزل العائلي',
    productCategory: 'mortgage',
    baseRatePercent: '21.5000',
    minAmount: '750000',
    maxAmount: '15000000',
    minMonthlyIncomeEGP: '35000',
    ageMin: 25,
    ageMax: 65,
    programType: 'income_proof',
  },
  {
    programCode: 'BDC-PERSONAL-FLEX',
    bankName: 'Banque du Caire',
    friendlyName: 'Personal Loan — Flex',
    friendlyNameAr: 'القرض الشخصي — مرن',
    productCategory: 'personal',
    baseRatePercent: '25.0000',
    minAmount: '30000',
    maxAmount: '1500000',
    minMonthlyIncomeEGP: '7500',
    ageMin: 21,
    ageMax: 60,
    programType: 'income_proof',
  },
  {
    programCode: 'ADIB-AUTO-ISLAMIC',
    bankName: 'ADIB Egypt',
    friendlyName: 'Auto Murabaha',
    friendlyNameAr: 'مرابحة السيارات',
    productCategory: 'car',
    baseRatePercent: '19.5000',
    minAmount: '120000',
    maxAmount: '2200000',
    minMonthlyIncomeEGP: '15000',
    ageMin: 21,
    ageMax: 63,
    programType: 'income_proof',
  },
  {
    programCode: 'HSBC-PERSONAL-PREMIER',
    bankName: 'HSBC Egypt',
    friendlyName: 'Premier Personal Loan',
    friendlyNameAr: 'قرض شخصي بريمير',
    productCategory: 'personal',
    baseRatePercent: '24.5000',
    minAmount: '100000',
    maxAmount: '3500000',
    minMonthlyIncomeEGP: '25000',
    ageMin: 25,
    ageMax: 60,
    programType: 'income_proof',
  },
  {
    programCode: 'HDB-MORTGAGE-FIRST-HOME',
    bankName: 'Housing & Development Bank',
    friendlyName: 'First Home Mortgage',
    friendlyNameAr: 'تمويل أول منزل',
    productCategory: 'mortgage',
    baseRatePercent: '20.0000',
    minAmount: '500000',
    maxAmount: '8000000',
    minMonthlyIncomeEGP: '20000',
    ageMin: 23,
    ageMax: 60,
    programType: 'income_proof',
  },
];

async function seedBankPrograms(superAdminId: string): Promise<void> {
  const existing = await prisma.bankProgram.count();
  if (existing >= DEMO_PROGRAMS.length) {
    log(`bank programs: ${existing} already seeded — skipping`);
    return;
  }
  let created = 0;
  for (const p of DEMO_PROGRAMS) {
    const dupe = await prisma.bankProgram.findUnique({ where: { programCode: p.programCode } });
    if (dupe) continue;
    await prisma.bankProgram.create({
      data: {
        programCode: p.programCode,
        bankName: p.bankName,
        friendlyName: p.friendlyName,
        friendlyNameAr: p.friendlyNameAr,
        programType: p.programType,
        productCategory: p.productCategory,
        currencies: ['EGP'],
        active: true,
        isShariaCompliant: p.programCode === 'ADIB-AUTO-ISLAMIC',
        version: 1,
        operatorNotes: null,
        operatorTips: [],
        requiredDocuments: ['national_id', 'salary_slip', 'bank_statement'],
        tenor: { minMonths: 12, maxMonths: 84 },
        loanLimits: {
          perCurrency: {
            EGP: { minAmount: p.minAmount, maxAmount: p.maxAmount },
          },
        },
        pricing: { isVariableRate: false, baseRatePercent: p.baseRatePercent },
        eligibility: {
          acceptedEmploymentTypes: ['salaried'],
          ageMin: p.ageMin,
          ageMax: p.ageMax,
          minMonthlyIncomeEGP: p.minMonthlyIncomeEGP,
          minMonthsInJob: 6,
          acceptedLoanPurposes: [p.productCategory],
          dbrCapPercent: '50.0000',
          skipDbrCheck: false,
          acceptedTransferTypes: ['payroll_cat_a', 'payroll_cat_b', 'payroll_cat_c'],
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
        createdBy: superAdminId,
        updatedBy: superAdminId,
      },
    });
    created++;
  }
  log(`bank programs: created ${created} / ${DEMO_PROGRAMS.length}`);
}

interface AppShape {
  loanPurpose: string;
  amount: number;
  age: number;
  tenor: number;
  firstName: string;
  lastName: string;
  company: string;
  daysOldCreated: number;
}

function buildApplicantProfile(s: AppShape) {
  return {
    firstName: s.firstName,
    lastName: s.lastName,
    nationalId: `2${randomBetween(1980, 2005)}${String(randomBetween(0, 99999999)).padStart(8, '0')}`,
    phone: `+201${randomBetween(0, 9)}${String(randomBetween(0, 99999999)).padStart(8, '0')}`,
    email: `${s.firstName.toLowerCase()}.${s.lastName.toLowerCase()}@example.com`,
    employment: {
      type: 'employee',
      companyName: s.company,
      seniorityMonths: randomBetween(12, 240),
      monthlyIncomeEGP: String(randomBetween(15000, 80000)),
    },
    obligations: {
      monthlyExistingDebtEGP: String(randomBetween(0, 8000)),
    },
    assets: {},
  };
}

async function seedApplications(): Promise<void> {
  const existing = await prisma.application.count();
  if (existing >= 25) {
    log(`applications: ${existing} already seeded — skipping`);
    return;
  }

  const shapes: AppShape[] = Array.from({ length: 23 }, () => ({
    loanPurpose: randomFromSet(LOAN_PURPOSES),
    amount: randomBetween(50_000, 800_000),
    age: randomBetween(22, 58),
    tenor: randomFromSet([12, 24, 36, 48, 60, 72, 84, 96]),
    firstName: randomFromSet(FIRST_NAMES),
    lastName: randomFromSet(LAST_NAMES),
    company: randomFromSet(COMPANIES),
    daysOldCreated: randomBetween(0, 30),
  }));

  // Every application now requires an owning customer (guest mode removed,
  // v4.0.0). Upsert one complete demo customer and attach all seeded apps to it.
  const demoCustomer = await prisma.customerAccount.upsert({
    where: { phone: '+201000000000' },
    update: {},
    create: {
      registrationPath: 'PHONE',
      phone: '+201000000000',
      mobileVerifiedAt: new Date(),
      email: 'demo.customer@masrafy.local',
      firstName: 'Demo',
      lastName: 'Customer',
      birthday: new Date('1990-01-01'),
      profilePhotoKey: 'customers/demo/photo/seed.jpg',
      passwordHash: null,
      isVerified: true,
    },
  });

  for (const s of shapes) {
    await createOneApplication(s, demoCustomer.id);
  }
  log(`applications: created ${shapes.length}`);
}

async function createOneApplication(s: AppShape, customerId: string): Promise<void> {
  const createdAt = new Date(Date.now() - s.daysOldCreated * 24 * 60 * 60 * 1000);
  const correlationId = randomUUID();
  const applicantProfile = buildApplicantProfile(s);

  await prisma.application.create({
    data: {
      applicantUserId: customerId,
      submissionCorrelationId: correlationId,
      status: 'matched',
      priority: randomFromSet(PRIORITIES),
      requestedAmountEGP: new Prisma.Decimal(s.amount),
      requestedCurrency: 'EGP',
      preferredTenorMonths: s.tenor,
      loanPurpose: s.loanPurpose,
      age: s.age,
      applicantProfile: applicantProfile as unknown as Prisma.InputJsonValue,
      summary: {
        totalProgramsChecked: randomBetween(20, 34),
        eligiblePrograms: randomBetween(2, 12),
      },
      programsCheckedCount: randomBetween(20, 34),
      eligibleProgramsCount: randomBetween(2, 12),
      createdAt,
    },
  });
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[seed-demo] ${msg}`);
}

async function main(): Promise<void> {
  log('starting demo seed…');

  const superAdminId = await ensureSuperAdminId();

  await seedBankPrograms(superAdminId);

  for (const s of DEMO_STAFF) {
    await findOrCreateStaff(s);
  }

  await seedApplications();

  // Mobile end-users for the admin /customers list + detail drawer.
  await seedCustomers(prisma);

  log('demo seed complete.');
  log(`  super_admin → ${SUPER_ADMIN_EMAIL} / <SEED_ADMIN_PASSWORD>`);
  log(`  demo staff  → manager.a / agent.{a,b,c} / analyst.a @masrafy.local / ${DEV_PASSWORD}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-demo] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
