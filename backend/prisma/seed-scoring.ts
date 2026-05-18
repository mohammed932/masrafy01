/* eslint-disable no-console */
import {
  ApplicationPriority,
  ApplicationStatus,
  ApprovalTier,
  DecisionOutcome,
  LeadStatus,
  PrismaClient,
  StaffRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

interface Agent {
  id: string;
  name: string;
  role: StaffRole;
}

async function ensureAgents(): Promise<Agent[]> {
  const existing = await prisma.staffAccount.findMany({
    where: { role: { in: ['sales_agent', 'sales_manager'] }, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { createdAt: 'asc' },
    take: 6,
  });
  if (existing.length >= 3) return existing;

  const pw = await bcrypt.hash('SeedAgent!2026', 12);
  const created: Agent[] = [...existing];
  const names = ['Aya Hassan', 'Khaled Mostafa', 'Mariam Nasr', 'Tarek Adel'];
  for (let i = created.length; i < 4; i++) {
    const name = names[i] ?? `Seed Agent ${i + 1}`;
    const email = `seed.agent.${i + 1}@masrafy.local`;
    const row = await prisma.staffAccount.upsert({
      where: { email },
      create: {
        email,
        emailDisplay: email,
        name,
        passwordHash: pw,
        role: StaffRole.sales_agent,
        isActive: true,
        mustChangePassword: false,
      },
      update: {},
      select: { id: true, name: true, role: true },
    });
    created.push(row);
  }
  console.log(`scoring-seed: ensured ${created.length} sales agents`);
  return created;
}

async function ensureEngine() {
  let engine = await prisma.scoringEngineVersion.findFirst({ where: { deactivatedAt: null } });
  if (!engine) {
    engine = await prisma.scoringEngineVersion.create({
      data: {
        version: 'v1.0-seed',
        description: 'Seed engine for analytics demo data',
        weightsConfig: { tierThresholds: { excellent: 90, good: 75, moderate: 55, low: 30 } },
      },
    });
    console.log(`scoring-seed: created engine ${engine.version}`);
  }
  return engine;
}

async function wipePriorSeed(): Promise<void> {
  // Activity rows are append-only (DB trigger). Use session_replication_role to
  // bypass triggers for the duration of the cascade DELETE, then restore.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET session_replication_role = 'replica'`),
    prisma.$executeRawUnsafe(`DELETE FROM application WHERE "mobileClientId" LIKE 'seed-%'`),
    prisma.$executeRawUnsafe(`SET session_replication_role = 'origin'`),
  ]);
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

async function main(): Promise<void> {
  const agents = await ensureAgents();
  const engine = await ensureEngine();

  const programs = await prisma.bankProgram.findMany({
    select: { programCode: true, version: true, bankName: true, friendlyName: true },
    take: 8,
  });
  if (programs.length === 0) throw new Error('No bank programs in DB. Run program seed first.');

  // skip wipe — Activity append-only trigger blocks cascade DELETE without superuser.
  // Each run appends fresh seed apps; old ones remain unassigned and don't show in agent metrics.
  void wipePriorSeed;

  const APP_COUNT = 18;
  const APPLICANT_NAMES = ['Mohamed Saleh', 'Reem Ali', 'Hossam Fawzy', 'Nour El-Din', 'Yara Mahmoud', 'Omar Adel'];
  const LOAN_AMOUNTS = [250000, 500000, 750000, 1_000_000, 1_250_000, 1_500_000];

  // ---- agent performance "tiers" — controls realism per agent ----
  const agentProfiles: Record<string, { speedMin: number; speedMax: number; submitDays: [number, number]; approvalLikelihood: number }> = {};
  agents.forEach((a, idx) => {
    if (idx === 0) {
      agentProfiles[a.id] = { speedMin: 5 * MIN, speedMax: 30 * MIN, submitDays: [1, 3], approvalLikelihood: 0.6 };
    } else if (idx === 1) {
      agentProfiles[a.id] = { speedMin: 90 * MIN, speedMax: 4 * HOUR, submitDays: [3, 6], approvalLikelihood: 0.25 };
    } else if (idx === 2) {
      agentProfiles[a.id] = { speedMin: 15 * MIN, speedMax: 80 * MIN, submitDays: [2, 4], approvalLikelihood: 0.4 };
    } else {
      agentProfiles[a.id] = { speedMin: 30 * MIN, speedMax: 2 * HOUR, submitDays: [2, 5], approvalLikelihood: 0.35 };
    }
  });

  const tierPlan: { tier: ApprovalTier; prob: number; score: number; approvalLikelihood: number }[] = [
    { tier: ApprovalTier.excellent, prob: 92, score: 92, approvalLikelihood: 0.92 },
    { tier: ApprovalTier.good, prob: 78, score: 78, approvalLikelihood: 0.78 },
    { tier: ApprovalTier.moderate, prob: 60, score: 60, approvalLikelihood: 0.6 },
    { tier: ApprovalTier.low, prob: 38, score: 38, approvalLikelihood: 0.38 },
    { tier: ApprovalTier.very_low, prob: 18, score: 18, approvalLikelihood: 0.18 },
  ];

  let offersCreated = 0;
  let decisionsCreated = 0;
  let activitiesCreated = 0;
  let approvedSum = 0;

  for (let i = 0; i < APP_COUNT; i++) {
    const agent = agents[i % agents.length]!;
    const profile = agentProfiles[agent.id]!;
    const ageDays = rand(2, 26);
    const createdAt = new Date(NOW - ageDays * DAY);
    const assignedAt = new Date(createdAt.getTime() + rand(0, 60) * MIN);
    const requestedAmount = pick(LOAN_AMOUNTS);

    const app = await prisma.application.create({
      data: {
        mobileClientId: `seed-${i}-${Date.now()}`,
        submissionCorrelationId: `seed-corr-${i}-${Date.now()}`,
        priority: ApplicationPriority.lowest_interest,
        status: ApplicationStatus.matched,
        requestedAmountEGP: requestedAmount.toFixed(2),
        requestedCurrency: 'EGP',
        preferredTenorMonths: pick([36, 48, 60, 72]),
        loanPurpose: pick(['personal', 'car', 'home_renovation']),
        age: rand(26, 52),
        isGuest: false,
        applicantProfile: { seed: true, alias: pick(APPLICANT_NAMES) },
        summary: { matchedOfferCount: 3, topOfferTier: 'good' },
        leadStatus: LeadStatus.submitted_to_bank,
        assignedAgentStaffId: agent.id,
        assignedAt,
        createdAt,
      },
    });

    // ---- ACTIVITIES per app (drive speed-to-first-contact + cycle time) ----
    const firstContactAt = new Date(
      assignedAt.getTime() + rand(profile.speedMin, profile.speedMax),
    );

    await prisma.activity.create({
      data: {
        applicationId: app.id,
        actorStaffId: agent.id,
        actorRole: agent.role,
        activityType: 'CALLED_USER',
        reason: 'INITIAL_CONTACT',
        durationMinutes: rand(2, 14),
        outcomeFlags: [],
        attachedDocumentIds: [],
        correlationId: randomUUID(),
        occurredAt: firstContactAt,
      },
    });
    activitiesCreated++;

    // varied non-headline activity for context
    const extras: Array<{ type: string; reason: string; minutes?: number }> = [
      { type: 'SENT_WHATSAPP', reason: 'DOCUMENT_REQUEST' },
      { type: 'RECEIVED_DOCUMENTS', reason: 'VIA_WHATSAPP' },
      { type: 'REVIEWED_DOCUMENTS', reason: 'VERIFIED_READY' },
      { type: 'CALLED_USER', reason: 'FOLLOWUP', minutes: rand(3, 12) },
    ];
    let cursor = firstContactAt.getTime();
    for (const e of extras) {
      cursor += rand(2 * HOUR, 18 * HOUR);
      if (cursor > NOW) break;
      await prisma.activity.create({
        data: {
          applicationId: app.id,
          actorStaffId: agent.id,
          actorRole: agent.role,
          activityType: e.type,
          reason: e.reason,
          durationMinutes: e.minutes ?? null,
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          occurredAt: new Date(cursor),
        },
      });
      activitiesCreated++;
    }

    // submitted-to-bank activity (drives cycle time + bank submission denominator)
    const submitDays = rand(profile.submitDays[0], profile.submitDays[1]);
    const submittedAtMs = assignedAt.getTime() + submitDays * DAY;
    const willSubmit = submittedAtMs < NOW;
    let submittedAt: Date | null = null;
    if (willSubmit) {
      submittedAt = new Date(submittedAtMs);
      await prisma.activity.create({
        data: {
          applicationId: app.id,
          actorStaffId: agent.id,
          actorRole: agent.role,
          activityType: 'SUBMITTED_TO_BANK',
          reason: pick(programs).programCode,
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          occurredAt: submittedAt,
        },
      });
      activitiesCreated++;
    }

    // ---- OFFERS for this app ----
    const offerCount = rand(2, 5);
    for (let j = 0; j < offerCount; j++) {
      const plan = tierPlan[j % tierPlan.length]!;
      const program = pick(programs);
      const offerAmount = requestedAmount * (0.85 + Math.random() * 0.3); // 85-115% of requested
      const offerCreatedAt = new Date(assignedAt.getTime() + rand(0, submitDays + 1) * DAY);

      const offer = await prisma.bankOffer.create({
        data: {
          applicationId: app.id,
          programCode: program.programCode,
          programVersion: program.version,
          bankName: program.bankName,
          programFriendlyName: program.friendlyName,
          currency: 'EGP',
          effectiveRatePercent: (20 + Math.random() * 8).toFixed(4),
          monthlyInstallmentEGP: (offerAmount / 36).toFixed(2),
          requestedLoanAmountEGP: requestedAmount.toFixed(2),
          effectiveLoanAmountEGP: offerAmount.toFixed(2),
          requestedTenorMonths: 60,
          effectiveTenorMonths: pick([36, 48, 60]),
          feesBreakdown: { adminFee: '1.0000', stampDuty: '0.5000' },
          approvalProbabilityPercent: plan.prob.toString(),
          approvalScore: plan.score,
          approvalTier: plan.tier,
          approvalFactors: { incomeStability: 0.8, dbr: 0.4 },
          engineVersion: engine.version,
          requiredDocuments: [],
          matchReasons: ['seed'],
          cascadeTrace: { steps: [] },
          createdAt: offerCreatedAt,
        },
      });
      offersCreated++;

      // Decision: skewed by tier × agent's approval likelihood
      const decideChance = 0.7;
      if (willSubmit && Math.random() < decideChance) {
        const approvalP =
          plan.approvalLikelihood * 0.5 + profile.approvalLikelihood * 0.5;
        const approved = Math.random() < approvalP;
        const rejected = !approved && Math.random() < 0.85;
        const outcome = approved
          ? DecisionOutcome.approved
          : rejected
          ? DecisionOutcome.rejected
          : DecisionOutcome.withdrawn;
        const recordedAt = new Date(
          (submittedAt?.getTime() ?? offerCreatedAt.getTime()) + rand(1, 5) * DAY,
        );
        await prisma.bankOfferDecision.create({
          data: {
            bankOfferId: offer.id,
            outcome,
            recordedAt: recordedAt > new Date(NOW) ? new Date(NOW) : recordedAt,
            decisionLatencyMs: rand(1 * DAY, 5 * DAY),
          },
        });
        decisionsCreated++;

        if (approved) {
          approvedSum += offerAmount;
          await prisma.activity.create({
            data: {
              applicationId: app.id,
              actorStaffId: agent.id,
              actorRole: agent.role,
              activityType: 'BANK_RESPONDED',
              reason: 'APPROVED',
              outcomeFlags: [],
              attachedDocumentIds: [],
              correlationId: randomUUID(),
              occurredAt: recordedAt > new Date(NOW) ? new Date(NOW) : recordedAt,
            },
          });
          activitiesCreated++;
        }
      }
    }
  }

  console.log(
    `scoring-seed: ${APP_COUNT} apps · ${offersCreated} offers · ${decisionsCreated} decisions · ${activitiesCreated} activities · ${(approvedSum / 1_000_000).toFixed(2)}M EGP funded`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
