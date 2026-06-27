/**
 * Simple MVP seeder for the admin "Applications" triage screen.
 *
 *   npm run seed:apps                 # tops up to 36 proceeded applications
 *   SEED_APPS_COUNT=60 npm run seed:apps
 *
 * Drops enough applications to actually render + paginate on the triage board
 * and light up every counter + probability bucket. Two things the legacy demo
 * seed skipped — and the reason the board showed all zeros — are set here:
 *   1. `userProceededAt` (Feature-008 gate: the admin list filters on it).
 *   2. one `BankOffer` per matched app (probability buckets read `approvalTier`).
 *
 * Idempotent + top-up: creates only the difference between the current proceeded
 * count and the target (SEED_APPS_COUNT, default 36). Never deletes.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

// DB check `customer_account_phone_invariants_check` requires PHONE accounts to
// carry a passwordHash. These are demo rows — a low-cost hash is fine.
const DEMO_PASSWORD_HASH = bcrypt.hashSync('demo-password-12!', 4);

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TARGET = 36;

type Tier = 'excellent' | 'good' | 'moderate' | 'low';
type LeadStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
type Purpose = 'personal' | 'car' | 'mortgage' | 'business';
type Priority =
  | 'lowest_installment'
  | 'lowest_interest'
  | 'fastest_approval'
  | 'least_paperwork';

interface RowSpec {
  leadStatus: LeadStatus;
  status: 'matched' | 'no_match';
  tier: Tier | null; // null = no offer (no_match)
  daysOld: number;
  amount: number;
  tenor: number;
  age: number;
  purpose: Purpose;
  priority: Priority;
  firstName: string;
  lastName: string;
}

// Demo customers (cycled across applications).
const CUSTOMERS = [
  { phone: '+201111100001', firstName: 'Youssef', lastName: 'Hassan', birthday: '1990-04-12' },
  { phone: '+201111100002', firstName: 'Mariam', lastName: 'Adel', birthday: '1994-09-03' },
  { phone: '+201111100003', firstName: 'Omar', lastName: 'Saleh', birthday: '1987-01-22' },
] as const;

const PURPOSES: readonly Purpose[] = ['personal', 'car', 'mortgage', 'business'];
const PRIORITIES: readonly Priority[] = [
  'lowest_installment',
  'lowest_interest',
  'fastest_approval',
  'least_paperwork',
];
const LEAD_STATUSES: readonly LeadStatus[] = ['pending', 'in_progress', 'done', 'cancelled'];
// Mostly matched offers across the tiers, with the occasional no_match (null).
const TIER_CYCLE: readonly (Tier | null)[] = [
  'excellent',
  'good',
  'moderate',
  'excellent',
  'good',
  'low',
  null,
  'good',
  'excellent',
  'moderate',
];

const TIER_SCORE: Record<Tier, { score: number; prob: number; rate: number }> = {
  excellent: { score: 90, prob: 88, rate: 18.5 },
  good: { score: 75, prob: 70, rate: 21.0 },
  moderate: { score: 55, prob: 52, rate: 24.5 },
  low: { score: 40, prob: 35, rate: 27.0 },
};

const AMOUNT_BASE: Record<Purpose, number> = {
  personal: 80_000,
  car: 150_000,
  mortgage: 900_000,
  business: 250_000,
};
const AMOUNT_STEP: Record<Purpose, number> = {
  personal: 25_000,
  car: 40_000,
  mortgage: 200_000,
  business: 100_000,
};
const TENOR: Record<Purpose, number> = { personal: 36, car: 48, mortgage: 120, business: 60 };

function buildRows(count: number): RowSpec[] {
  const rows: RowSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const cust = CUSTOMERS[i % CUSTOMERS.length]!;
    const purpose = PURPOSES[i % PURPOSES.length]!;
    const tier = TIER_CYCLE[i % TIER_CYCLE.length]!;
    rows.push({
      leadStatus: LEAD_STATUSES[i % LEAD_STATUSES.length]!,
      status: tier ? 'matched' : 'no_match',
      tier,
      daysOld: i % 30,
      amount: AMOUNT_BASE[purpose] + AMOUNT_STEP[purpose] * (i % 10),
      tenor: TENOR[purpose],
      age: 25 + (i % 25),
      purpose,
      priority: PRIORITIES[i % PRIORITIES.length]!,
      firstName: cust.firstName,
      lastName: cust.lastName,
    });
  }
  return rows;
}

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
  const target = Number(process.env.SEED_APPS_COUNT ?? DEFAULT_TARGET);
  const already = await prisma.application.count({ where: { userProceededAt: { not: null } } });
  const toCreate = Math.max(0, target - already);
  if (toCreate === 0) {
    console.log(
      `[seed:apps] ${already} proceeded application(s) already exist (target ${target}) — skipping (idempotent).`,
    );
    await seedSavedOffers();
    return;
  }

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

  const rows = buildRows(toCreate);
  let created = 0;
  for (const r of rows) {
    const cust = CUSTOMERS.find((c) => c.firstName === r.firstName) ?? CUSTOMERS[0]!;
    const customerId = customerIdByPhone.get(cust.phone)!;
    const createdAt = new Date(Date.now() - r.daysOld * DAY);

    const app = await prisma.application.create({
      data: {
        applicantUserId: customerId,
        submissionCorrelationId: randomUUID(),
        status: r.status,
        leadStatus: r.leadStatus,
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

  console.log(
    `[seed:apps] created ${created} applications (now ~${already + created}, target ${target}).`,
  );

  await seedSavedOffers();
}

/**
 * Link the primary demo customer's matched offers as Saved Offers so the
 * mobile "Saved Offers" screen (Figma 4088-153) renders content out of the box.
 * Mobile dev logs in as +201111100001 / demo-password-12!. Idempotent — the
 * unique (customerId, bankOfferId) pair makes re-running a no-op.
 */
async function seedSavedOffers(): Promise<void> {
  const phone = CUSTOMERS[0]!.phone; // +201111100001
  const customer = await prisma.customerAccount.findUnique({ where: { phone } });
  if (!customer) {
    console.log('[seed:apps] saved-offers: primary demo customer not found — skipped.');
    return;
  }
  const offers = await prisma.bankOffer.findMany({
    where: { application: { applicantUserId: customer.id }, erasedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true },
  });
  for (const o of offers) {
    await prisma.savedOffer.upsert({
      where: {
        idx_saved_offer_customer_offer: {
          customerId: customer.id,
          bankOfferId: o.id,
        },
      },
      create: { customerId: customer.id, bankOfferId: o.id },
      update: {},
    });
  }
  console.log(
    `[seed:apps] saved-offers: linked ${offers.length} offer(s) for ${phone}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
