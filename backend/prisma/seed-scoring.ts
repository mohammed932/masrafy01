/* eslint-disable no-console */
import {
  ApplicationPriority,
  ApplicationStatus,
  ApprovalTier,
  DecisionOutcome,
  LeadStatus,
  Prisma,
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

const FACTOR_CATALOG = {
  ISCORE_PREMIUM: { labelEn: 'i-Score 700+ (premium)', labelAr: 'تقييم ائتماني ممتاز (٧٠٠+)' },
  ISCORE_GOOD: { labelEn: 'i-Score 620–699 (good)', labelAr: 'تقييم ائتماني جيد (٦٢٠–٦٩٩)' },
  ISCORE_LOW: { labelEn: 'i-Score below 560', labelAr: 'تقييم ائتماني منخفض' },
  DBR_LOW: { labelEn: 'Debt burden under 30%', labelAr: 'نسبة الدين منخفضة (أقل من ٣٠٪)' },
  DBR_HIGH: { labelEn: 'Debt burden above 45%', labelAr: 'نسبة الدين مرتفعة (أعلى من ٤٥٪)' },
  EMPLOYMENT_STABLE: { labelEn: 'Employed 3+ years at current employer', labelAr: 'مدة العمل أكثر من ٣ سنوات' },
  EMPLOYMENT_NEW: { labelEn: 'New employer (< 12 months)', labelAr: 'وظيفة حديثة (أقل من ١٢ شهر)' },
  SALARY_DOMICILED: { labelEn: 'Salary domiciled with the bank', labelAr: 'الراتب محول للبنك' },
  SALARY_EXTERNAL: { labelEn: 'Salary not domiciled with the bank', labelAr: 'الراتب من بنك آخر' },
  INCOME_HIGH: { labelEn: 'Income comfortably above installment', labelAr: 'الدخل أعلى بكثير من القسط' },
  INCOME_TIGHT: { labelEn: 'Income tight relative to installment', labelAr: 'الدخل قريب من القسط المطلوب' },
  EXISTING_LOANS_NONE: { labelEn: 'No active loans', labelAr: 'لا يوجد قروض نشطة' },
  EXISTING_LOANS_HEAVY: { labelEn: '3+ active loans', labelAr: '٣ قروض نشطة أو أكثر' },
  AGE_PRIME: { labelEn: 'Age in prime band (30–50)', labelAr: 'العمر في النطاق المفضل (٣٠–٥٠)' },
  AGE_HIGH: { labelEn: 'Age above 55', labelAr: 'العمر فوق ٥٥' },
  BANKING_LONG: { labelEn: '5+ year banking relationship', labelAr: 'علاقة بنكية أكثر من ٥ سنوات' },
  PROPERTY_LTV_GOOD: { labelEn: 'Loan-to-value below 70%', labelAr: 'نسبة القرض للأصل أقل من ٧٠٪' },
  COSIGNER_PRESENT: { labelEn: 'Co-signer available', labelAr: 'يوجد ضامن' },
} as const;

const FACTOR_WEIGHTS: Record<string, number> = {
  ISCORE_PREMIUM: 18,
  ISCORE_GOOD: 8,
  ISCORE_LOW: -15,
  DBR_LOW: 12,
  DBR_HIGH: -12,
  EMPLOYMENT_STABLE: 8,
  EMPLOYMENT_NEW: -6,
  SALARY_DOMICILED: 6,
  SALARY_EXTERNAL: -4,
  INCOME_HIGH: 5,
  INCOME_TIGHT: -7,
  EXISTING_LOANS_NONE: 4,
  EXISTING_LOANS_HEAVY: -8,
  AGE_PRIME: 3,
  AGE_HIGH: -5,
  BANKING_LONG: 4,
  PROPERTY_LTV_GOOD: 5,
  COSIGNER_PRESENT: 3,
};

const WEIGHTS_CONFIG = {
  weights: FACTOR_WEIGHTS,
  thresholds: { excellent: 90, good: 75, moderate: 55, low: 30 },
  factorCatalog: FACTOR_CATALOG,
  legacy: false,
};

async function ensureEngine() {
  let engine = await prisma.scoringEngineVersion.findFirst({ where: { deactivatedAt: null } });
  if (engine) {
    engine = await prisma.scoringEngineVersion.update({
      where: { id: engine.id },
      data: { weightsConfig: WEIGHTS_CONFIG },
    });
    console.log(`scoring-seed: refreshed weightsConfig on engine ${engine.version}`);
    return engine;
  }
  engine = await prisma.scoringEngineVersion.create({
    data: {
      version: 'v1.0-seed',
      description: 'Seed engine for analytics demo data',
      weightsConfig: WEIGHTS_CONFIG,
    },
  });
  console.log(`scoring-seed: created engine ${engine.version}`);
  return engine;
}

interface FactorImpact {
  code: string;
  impact: number;
}

interface OfferFactors {
  positive: FactorImpact[];
  negative: FactorImpact[];
}

function buildOfferFactors(tier: ApprovalTier, hasPropertyValue: boolean): OfferFactors {
  const positivePool: string[] = [];
  const negativePool: string[] = [];

  switch (tier) {
    case 'excellent':
      positivePool.push('ISCORE_PREMIUM', 'DBR_LOW', 'EMPLOYMENT_STABLE', 'SALARY_DOMICILED', 'INCOME_HIGH', 'EXISTING_LOANS_NONE', 'BANKING_LONG', 'AGE_PRIME');
      negativePool.push();
      break;
    case 'good':
      positivePool.push('ISCORE_GOOD', 'DBR_LOW', 'EMPLOYMENT_STABLE', 'SALARY_DOMICILED', 'AGE_PRIME', 'BANKING_LONG');
      negativePool.push('INCOME_TIGHT');
      break;
    case 'moderate':
      positivePool.push('ISCORE_GOOD', 'EMPLOYMENT_STABLE', 'AGE_PRIME');
      negativePool.push('DBR_HIGH', 'INCOME_TIGHT', 'SALARY_EXTERNAL');
      break;
    case 'low':
      positivePool.push('SALARY_DOMICILED', 'COSIGNER_PRESENT');
      negativePool.push('ISCORE_LOW', 'DBR_HIGH', 'EMPLOYMENT_NEW', 'EXISTING_LOANS_HEAVY', 'INCOME_TIGHT');
      break;
    case 'very_low':
      positivePool.push('COSIGNER_PRESENT');
      negativePool.push('ISCORE_LOW', 'DBR_HIGH', 'EMPLOYMENT_NEW', 'EXISTING_LOANS_HEAVY', 'AGE_HIGH', 'SALARY_EXTERNAL');
      break;
  }
  if (hasPropertyValue) positivePool.push('PROPERTY_LTV_GOOD');

  const positiveCount =
    tier === 'excellent' || tier === 'good' ? rand(3, Math.min(5, positivePool.length + 1)) : rand(1, 3);
  const negativeCount =
    tier === 'low' || tier === 'very_low' ? rand(3, Math.min(5, negativePool.length + 1)) : rand(0, 2);

  const sample = (pool: string[], count: number): string[] => {
    const out: string[] = [];
    const copy = [...pool];
    for (let i = 0; i < count && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]!);
    }
    return out;
  };

  return {
    positive: sample(positivePool, positiveCount).map((code) => ({
      code,
      impact: FACTOR_WEIGHTS[code] ?? 0,
    })),
    negative: sample(negativePool, negativeCount).map((code) => ({
      code,
      impact: FACTOR_WEIGHTS[code] ?? 0,
    })),
  };
}

async function wipePriorSeed(): Promise<void> {
  // Activity rows are append-only (DB trigger). Use session_replication_role to
  // bypass triggers for the duration of the cascade DELETE, then restore.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET session_replication_role = 'replica'`),
    prisma.$executeRawUnsafe(`DELETE FROM application WHERE "submissionCorrelationId" LIKE 'seed-corr-%'`),
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

  const APP_COUNT = 120;
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

  const LEAD_STAGE_WEIGHTS: Array<{ stage: LeadStatus; w: number }> = [
    { stage: LeadStatus.needs_first_contact,   w: 0.10 },
    { stage: LeadStatus.document_collection,   w: 0.20 },
    { stage: LeadStatus.ready_for_submission,  w: 0.15 },
    { stage: LeadStatus.submitted_to_bank,     w: 0.35 },
    { stage: LeadStatus.bank_decided,          w: 0.20 },
  ];

  function pickLeadStage(): LeadStatus {
    let roll = Math.random();
    for (const s of LEAD_STAGE_WEIGHTS) {
      roll -= s.w;
      if (roll <= 0) return s.stage;
    }
    return LeadStatus.submitted_to_bank;
  }

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

  // Every application requires an owning customer (guest mode removed, v4.0.0).
  const seedCustomer = await prisma.customerAccount.upsert({
    where: { phone: '+201000000001' },
    update: {},
    create: {
      registrationPath: 'PHONE',
      phone: '+201000000001',
      mobileVerifiedAt: new Date(),
      email: 'seed.scoring@masrafy.local',
      firstName: 'Seed',
      lastName: 'Scoring',
      birthday: new Date('1990-01-01'),
      profilePhotoKey: 'customers/seed-scoring/photo/seed.jpg',
      isVerified: true,
    },
  });

  for (let i = 0; i < APP_COUNT; i++) {
    const agent = agents[i % agents.length]!;
    const profile = agentProfiles[agent.id]!;
    const ageDays = rand(2, 26);
    const createdAt = new Date(NOW - ageDays * DAY);
    const assignedAt = new Date(createdAt.getTime() + rand(0, 60) * MIN);
    const requestedAmount = pick(LOAN_AMOUNTS);

    const app = await prisma.application.create({
      data: {
        applicantUserId: seedCustomer.id,
        submissionCorrelationId: `seed-corr-${i}-${Date.now()}`,
        priority: ApplicationPriority.lowest_interest,
        status: ApplicationStatus.matched,
        requestedAmountEGP: requestedAmount.toFixed(2),
        requestedCurrency: 'EGP',
        preferredTenorMonths: pick([36, 48, 60, 72]),
        loanPurpose: pick(['personal', 'car', 'mortgage', 'business']),
        age: rand(26, 52),
        applicantProfile: { seed: true, alias: pick(APPLICANT_NAMES) },
        summary: { matchedOfferCount: 3, topOfferTier: 'good' },
        leadStatus: pickLeadStage(),
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
    // One offer per tier so each tier accumulates enough decisions
    // to clear the sample-size trustworthiness threshold (30) in analytics.
    // Realistic distribution of which offer the applicant actually picks:
    // most users grab the top probability but a meaningful tail goes lower.
    const SELECT_WEIGHTS = [0.35, 0.30, 0.20, 0.10, 0.05]; // excellent..very_low
    let selectionRoll = Math.random();
    let selectedTierIndex = 0;
    for (let k = 0; k < SELECT_WEIGHTS.length; k++) {
      selectionRoll -= SELECT_WEIGHTS[k]!;
      if (selectionRoll <= 0) {
        selectedTierIndex = k;
        break;
      }
    }
    const offerIdsByTier: Array<string | null> = [null, null, null, null, null];
    for (let j = 0; j < tierPlan.length; j++) {
      const plan = tierPlan[j]!;
      const program = pick(programs);
      const offerAmount = requestedAmount * (0.85 + Math.random() * 0.3); // 85-115% of requested
      const offerCreatedAt = new Date(assignedAt.getTime() + rand(0, submitDays + 1) * DAY);
      const isPropertyBackedPurpose = app.loanPurpose === 'mortgage' || app.loanPurpose === 'car';
      const factors = buildOfferFactors(plan.tier, isPropertyBackedPurpose);
      const matchReasonCodes = factors.positive.map((f) => f.code);

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
          approvalFactors: { positive: factors.positive, negative: factors.negative } as unknown as Prisma.InputJsonValue,
          engineVersion: engine.version,
          requiredDocuments: [],
          matchReasons: matchReasonCodes.length > 0 ? matchReasonCodes : ['seed'],
          cascadeTrace: { steps: [] },
          createdAt: offerCreatedAt,
        },
      });
      offersCreated++;
      offerIdsByTier[j] = offer.id;

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

    // Mark applicant as having selected one offer and proceeded. Selection is
    // weighted across tiers so the admin triage view shows a realistic spread
    // of probabilities — most applicants pick high-tier, some pick mid/low.
    const selectedOfferId =
      offerIdsByTier[selectedTierIndex] ?? offerIdsByTier.find((id) => id !== null) ?? null;
    if (selectedOfferId) {
      await prisma.application.update({
        where: { id: app.id },
        data: {
          userSelectedBankOfferId: selectedOfferId,
          userProceededAt: assignedAt,
        },
      });
    }
  }

  // Re-roll selection on ALL seed-* apps (including ones from prior runs that
  // received a "best-scored" assignment via the feature-008 migration backfill).
  // Keeps the admin probability column visibly spread across tiers each run.
  const SELECTION_WEIGHTS_BY_TIER: Record<ApprovalTier, number> = {
    excellent: 0.35,
    good: 0.30,
    moderate: 0.20,
    low: 0.10,
    very_low: 0.05,
  };
  const seededApps = await prisma.application.findMany({
    where: { submissionCorrelationId: { startsWith: 'seed-corr-' } },
    select: {
      id: true,
      bankOffers: {
        where: { erasedAt: null },
        select: { id: true, approvalTier: true, decision: { select: { outcome: true } } },
      },
    },
  });
  let rerolled = 0;
  for (const a of seededApps) {
    if (a.bankOffers.length === 0) continue;
    const tiers = a.bankOffers;
    let roll = Math.random();
    let pickTier: ApprovalTier = tiers[0]!.approvalTier;
    for (const t of (['excellent', 'good', 'moderate', 'low', 'very_low'] as ApprovalTier[])) {
      roll -= SELECTION_WEIGHTS_BY_TIER[t];
      if (roll <= 0) {
        pickTier = t;
        break;
      }
    }
    const pick = tiers.find((o) => o.approvalTier === pickTier) ?? tiers[0]!;
    const stage = pickLeadStage();

    // bank_decided requires a recorded outcome on the selected offer.
    // If the selected offer has no decision yet, create one (weighted realistic mix).
    if (stage === LeadStatus.bank_decided && !pick.decision) {
      const outcomeRoll = Math.random();
      const outcome =
        outcomeRoll < 0.55
          ? DecisionOutcome.approved
          : outcomeRoll < 0.90
          ? DecisionOutcome.rejected
          : DecisionOutcome.withdrawn;
      try {
        await prisma.bankOfferDecision.create({
          data: {
            bankOfferId: pick.id,
            outcome,
            recordedAt: new Date(NOW - rand(1, 6) * HOUR),
            decisionLatencyMs: rand(1 * DAY, 5 * DAY),
          },
        });
      } catch {
        // unique constraint — already exists from inner loop, ignore
      }
    }

    await prisma.application.update({
      where: { id: a.id },
      data: {
        userSelectedBankOfferId: pick.id,
        leadStatus: stage,
      },
    });
    rerolled++;
  }

  console.log(
    `scoring-seed: ${APP_COUNT} apps · ${offersCreated} offers · ${decisionsCreated} decisions · ${activitiesCreated} activities · ${(approvedSum / 1_000_000).toFixed(2)}M EGP funded · ${rerolled} selections re-rolled`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
