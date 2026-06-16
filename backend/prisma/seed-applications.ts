/**
 * Simple MVP seeder for the admin "Applications" triage screen.
 *
 *   npm run seed:apps
 *
 * Drops ~12 applications that actually render on the triage board and light up
 * every counter + stage tab. Two things the legacy demo seed skipped — and the
 * reason the board shows all zeros — are set here:
 *   1. `userProceededAt` (Feature-008 gate: the admin list filters on it).
 *   2. one `BankOffer` per app (probability buckets read `approvalTier`).
 *
 * Idempotent: skips entirely if any proceeded application already exists.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

// DB check `customer_account_phone_invariants_check` requires PHONE accounts to
// carry a passwordHash. These are demo rows — a low-cost hash is fine.
const DEMO_PASSWORD_HASH = bcrypt.hashSync('demo-password-12!', 4);

const DAY = 24 * 60 * 60 * 1000;

type Tier = 'excellent' | 'good' | 'moderate' | 'low';

interface RowSpec {
  leadStatus: 'needs_first_contact' | 'document_collection' | 'ready_for_submission' | 'submitted_to_bank' | 'bank_decided';
  status: 'matched' | 'no_match';
  tier: Tier | null; // null = no offer (no_match)
  assigned: boolean;
  daysOld: number;
  amount: number;
  tenor: number;
  age: number;
  purpose: 'personal' | 'car' | 'mortgage' | 'business';
  priority: 'lowest_installment' | 'lowest_interest' | 'fastest_approval' | 'least_paperwork';
  firstName: string;
  lastName: string;
}

// Demo customers (cycled across applications).
const CUSTOMERS = [
  { phone: '+201111100001', firstName: 'Youssef', lastName: 'Hassan', birthday: '1990-04-12' },
  { phone: '+201111100002', firstName: 'Mariam', lastName: 'Adel', birthday: '1994-09-03' },
  { phone: '+201111100003', firstName: 'Omar', lastName: 'Saleh', birthday: '1987-01-22' },
] as const;

// ~12 rows spread across every stage + probability tier + assignment state.
const ROWS: RowSpec[] = [
  // needs_first_contact (old + no activity => stale)
  { leadStatus: 'needs_first_contact', status: 'matched', tier: 'excellent', assigned: true,  daysOld: 15, amount: 250_000, tenor: 48, age: 34, purpose: 'personal', priority: 'fastest_approval',  firstName: 'Youssef', lastName: 'Hassan' },
  { leadStatus: 'needs_first_contact', status: 'matched', tier: 'good',      assigned: false, daysOld: 12, amount: 120_000, tenor: 36, age: 29, purpose: 'car',      priority: 'lowest_installment', firstName: 'Mariam',  lastName: 'Adel' },
  { leadStatus: 'needs_first_contact', status: 'matched', tier: 'moderate',  assigned: false, daysOld: 20, amount: 80_000,  tenor: 24, age: 41, purpose: 'personal', priority: 'least_paperwork',    firstName: 'Omar',    lastName: 'Saleh' },
  // document_collection (old + no activity => stale)
  { leadStatus: 'document_collection', status: 'matched',  tier: 'excellent', assigned: true,  daysOld: 10, amount: 1_500_000, tenor: 120, age: 38, purpose: 'mortgage', priority: 'lowest_interest',    firstName: 'Youssef', lastName: 'Hassan' },
  { leadStatus: 'document_collection', status: 'matched',  tier: 'good',      assigned: false, daysOld: 18, amount: 300_000,   tenor: 60,  age: 31, purpose: 'business', priority: 'fastest_approval',   firstName: 'Mariam',  lastName: 'Adel' },
  { leadStatus: 'document_collection', status: 'no_match', tier: null,        assigned: false, daysOld: 14, amount: 90_000,    tenor: 24,  age: 45, purpose: 'personal', priority: 'lowest_installment', firstName: 'Omar',    lastName: 'Saleh' },
  // ready_for_submission
  { leadStatus: 'ready_for_submission', status: 'matched', tier: 'excellent', assigned: true, daysOld: 2, amount: 200_000, tenor: 36, age: 33, purpose: 'personal', priority: 'fastest_approval',   firstName: 'Youssef', lastName: 'Hassan' },
  { leadStatus: 'ready_for_submission', status: 'matched', tier: 'good',      assigned: true, daysOld: 3, amount: 450_000, tenor: 48, age: 36, purpose: 'car',      priority: 'lowest_interest',    firstName: 'Mariam',  lastName: 'Adel' },
  // submitted_to_bank (=> WITH BANK)
  { leadStatus: 'submitted_to_bank', status: 'matched', tier: 'excellent', assigned: true, daysOld: 5, amount: 600_000, tenor: 60, age: 40, purpose: 'business', priority: 'lowest_installment', firstName: 'Omar',    lastName: 'Saleh' },
  { leadStatus: 'submitted_to_bank', status: 'matched', tier: 'good',      assigned: true, daysOld: 6, amount: 350_000, tenor: 48, age: 28, purpose: 'personal', priority: 'fastest_approval',   firstName: 'Youssef', lastName: 'Hassan' },
  // bank_decided
  { leadStatus: 'bank_decided', status: 'matched', tier: 'excellent', assigned: true, daysOld: 8, amount: 500_000, tenor: 60, age: 37, purpose: 'mortgage', priority: 'lowest_interest', firstName: 'Mariam', lastName: 'Adel' },
  { leadStatus: 'bank_decided', status: 'matched', tier: 'moderate',  assigned: true, daysOld: 9, amount: 75_000,  tenor: 18, age: 44, purpose: 'personal', priority: 'least_paperwork', firstName: 'Omar',   lastName: 'Saleh' },
];

const TIER_SCORE: Record<Tier, { score: number; prob: number; rate: number }> = {
  excellent: { score: 90, prob: 88, rate: 18.5 },
  good: { score: 75, prob: 70, rate: 21.0 },
  moderate: { score: 55, prob: 52, rate: 24.5 },
  low: { score: 40, prob: 35, rate: 27.0 },
};

function monthlyInstallment(amount: number, ratePct: number, tenor: number): number {
  const r = ratePct / 100 / 12;
  const f = Math.pow(1 + r, tenor);
  return Math.round((amount * r * f) / (f - 1));
}

function applicantProfile(r: RowSpec, phone: string) {
  return {
    firstName: r.firstName,
    lastName: r.lastName,
    nationalId: `2${1980 + (r.age % 20)}${String(Math.abs(r.amount) % 100000000).padStart(8, '0')}`,
    phone,
    email: `${r.firstName.toLowerCase()}.${r.lastName.toLowerCase()}@example.com`,
    employment: {
      type: 'employee',
      companyName: 'Demo Co.',
      seniorityMonths: 36,
      monthlyIncomeEGP: '35000',
    },
    obligations: { monthlyExistingDebtEGP: '2000' },
    assets: {},
  };
}

async function main(): Promise<void> {
  const already = await prisma.application.count({ where: { userProceededAt: { not: null } } });
  if (already > 0) {
    console.log(`[seed:apps] ${already} proceeded application(s) already exist — skipping (idempotent).`);
    return;
  }

  // Reuse any seeded staff member as the assigned agent; null if none exist yet.
  const agent = await prisma.staffAccount.findFirst({ select: { id: true } });
  const agentId = agent?.id ?? null;

  // Upsert demo customers.
  const customerIdByPhone = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const row = await prisma.customerAccount.upsert({
      where: { phone: c.phone },
      update: {},
      create: {
        registrationPath: 'PHONE',
        phone: c.phone,
        mobileVerifiedAt: new Date(),
        email: `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@masrafy.local`,
        firstName: c.firstName,
        lastName: c.lastName,
        birthday: new Date(c.birthday),
        passwordHash: DEMO_PASSWORD_HASH,
        isVerified: true,
      },
    });
    customerIdByPhone.set(c.phone, row.id);
  }

  let created = 0;
  for (const r of ROWS) {
    const cust = CUSTOMERS.find((c) => c.firstName === r.firstName) ?? CUSTOMERS[0]!;
    const customerId = customerIdByPhone.get(cust.phone)!;
    const createdAt = new Date(Date.now() - r.daysOld * DAY);
    const assigned = r.assigned && agentId !== null;

    const app = await prisma.application.create({
      data: {
        applicantUserId: customerId,
        submissionCorrelationId: randomUUID(),
        status: r.status,
        priority: r.priority,
        requestedAmountEGP: new Prisma.Decimal(r.amount),
        requestedCurrency: 'EGP',
        preferredTenorMonths: r.tenor,
        loanPurpose: r.purpose,
        category: r.purpose,
        age: r.age,
        applicantProfile: applicantProfile(r, cust.phone) as unknown as Prisma.InputJsonValue,
        summary: { totalProgramsChecked: 28, eligiblePrograms: r.tier ? 6 : 0 } as Prisma.InputJsonValue,
        programsCheckedCount: 28,
        eligibleProgramsCount: r.tier ? 6 : 0,
        assignedAgentStaffId: assigned ? agentId : null,
        assignedAt: assigned ? createdAt : null,
        leadStatus: r.leadStatus,
        userProceededAt: createdAt, // the gate that makes the row visible
        createdAt,
      },
    });

    if (r.tier) {
      const t = TIER_SCORE[r.tier];
      const installment = monthlyInstallment(r.amount, t.rate, r.tenor);
      const offer = await prisma.bankOffer.create({
        data: {
          applicationId: app.id,
          programCode: `DEMO_${r.purpose.toUpperCase()}`,
          programVersion: 1,
          bankName: 'ABK Egypt',
          programFriendlyName: `${r.purpose} loan`,
          currency: 'EGP',
          effectiveRatePercent: new Prisma.Decimal(t.rate),
          monthlyInstallmentEGP: new Prisma.Decimal(installment),
          requestedLoanAmountEGP: new Prisma.Decimal(r.amount),
          effectiveLoanAmountEGP: new Prisma.Decimal(r.amount),
          requestedTenorMonths: r.tenor,
          effectiveTenorMonths: r.tenor,
          feesBreakdown: {} as Prisma.InputJsonValue,
          approvalProbabilityPercent: new Prisma.Decimal(t.prob),
          approvalScore: t.score,
          approvalTier: r.tier,
          approvalFactors: {} as Prisma.InputJsonValue,
          engineVersion: 'seed',
          requiredDocuments: [],
          matchReasons: [],
          cascadeTrace: {} as Prisma.InputJsonValue,
        },
      });
      await prisma.application.update({
        where: { id: app.id },
        data: { userSelectedBankOfferId: offer.id },
      });
    }
    created += 1;
  }

  console.log(`[seed:apps] created ${created} applications (agent: ${agentId ?? 'none — all unassigned'}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
