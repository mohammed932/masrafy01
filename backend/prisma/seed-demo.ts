/**
 * Demo seeder — populates the dev DB with realistic data so the admin UI
 * has something to render. Idempotent: re-running skips already-seeded rows.
 *
 *   npm run seed:demo
 *
 * What it creates (in order):
 *   1.  bank programs, composed from the predefined program catalog
 *       (`seed-bank-programs.ts` — every bank offers the same archetypes)
 *   2.  active scoring weight sets for every program (Principle V) so /apply
 *       returns non-zero, answer-dependent approval scores
 *   3.  1 sales_manager + 3 sales_agent + 1 analyst (dev passwords)
 *   4. 23 applications (matched, with masked applicant profiles)
 *
 * Re-running is safe — every step checks for existing rows first.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { seedBanks } from './seed-banks';
import { seedCustomers } from './seed-customers';
import { seedBankPrograms } from './seed-bank-programs';
import { seedProgramCatalog } from './seed-program-catalog';
import { seedScoringWeights } from './seed-scoring-weights';

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

// Constitution v16.0.0 / Principle II scope-lock — 4 active categories. The no-payslip
// product is not one of them: it is `bank_program.programType`, chosen per program.
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

  // Banks BEFORE programs: a program's `bankId` FK needs the Bank row to exist,
  // otherwise the programs land orphaned and the admin banks list reads empty.
  await seedBanks(superAdminId);
  // Catalog BEFORE programs: `seedBankPrograms` refuses to create a program
  // under a (name, category) pair the catalog does not assign, so narrowing the
  // assignments afterwards would silently leave rows the API itself rejects.
  await seedProgramCatalog();
  await seedBankPrograms(superAdminId);
  await seedScoringWeights(prisma, superAdminId);

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
