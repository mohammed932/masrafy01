/* eslint-disable no-console */
import { ApplicationPriority, ApplicationStatus, ApprovalTier, DecisionOutcome, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // 1. Ensure an active scoring engine version exists.
  let engine = await prisma.scoringEngineVersion.findFirst({ where: { deactivatedAt: null } });
  if (!engine) {
    engine = await prisma.scoringEngineVersion.create({
      data: {
        version: 'v1.0-seed',
        description: 'Seed engine for analytics demo data',
        weightsConfig: { tierThresholds: { excellent: 90, good: 75, moderate: 55, low: 30 } },
      },
    });
    console.log(`scoring-seed: created engine version ${engine.version}`);
  }

  // 2. Get one BankProgram code to reference (any).
  const program = await prisma.bankProgram.findFirst({ select: { programCode: true, version: true, bankName: true, friendlyName: true } });
  if (!program) {
    throw new Error('No bank programs in DB. Run program seed first.');
  }

  // 3. Mint ~6 applications spanning the last 30 days.
  const apps: { id: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const ageDays = Math.floor(Math.random() * 28);
    const submittedAt = new Date(Date.now() - ageDays * 24 * 3600 * 1000);
    const app = await prisma.application.create({
      data: {
        mobileClientId: `seed-${i}-${Date.now()}`,
        submissionCorrelationId: `seed-corr-${i}-${Date.now()}`,
        priority: ApplicationPriority.lowest_interest,
        status: ApplicationStatus.matched,
        requestedAmountEGP: '500000.00',
        requestedCurrency: 'EGP',
        preferredTenorMonths: 60,
        loanPurpose: 'personal',
        age: 30 + i,
        isGuest: true,
        applicantProfile: { seed: true, alias: `Seed Applicant ${i + 1}` },
        summary: { matchedOfferCount: 1, topOfferTier: 'good' },
        createdAt: submittedAt,
      },
    });
    apps.push({ id: app.id });
  }

  // 4. Distribution: spread offers across tiers — 40 offers total.
  const tierPlan: { tier: ApprovalTier; prob: number; score: number; approvalLikelihood: number }[] = [
    { tier: ApprovalTier.excellent, prob: 92, score: 92, approvalLikelihood: 0.92 },
    { tier: ApprovalTier.good, prob: 78, score: 78, approvalLikelihood: 0.78 },
    { tier: ApprovalTier.moderate, prob: 60, score: 60, approvalLikelihood: 0.6 },
    { tier: ApprovalTier.low, prob: 38, score: 38, approvalLikelihood: 0.38 },
    { tier: ApprovalTier.very_low, prob: 18, score: 18, approvalLikelihood: 0.18 },
  ];

  let created = 0;
  let decided = 0;
  for (let i = 0; i < 40; i++) {
    const app = apps[i % apps.length]!;
    const plan = tierPlan[i % tierPlan.length]!;
    const offer = await prisma.bankOffer.create({
      data: {
        applicationId: app.id,
        programCode: program.programCode,
        programVersion: program.version,
        bankName: program.bankName,
        programFriendlyName: program.friendlyName,
        currency: 'EGP',
        effectiveRatePercent: '24.5000',
        monthlyInstallmentEGP: '15000.00',
        requestedLoanAmountEGP: '500000.00',
        effectiveLoanAmountEGP: '500000.00',
        requestedTenorMonths: 60,
        effectiveTenorMonths: 60,
        feesBreakdown: { adminFee: '1.0000', stampDuty: '0.5000' },
        approvalProbabilityPercent: plan.prob.toString(),
        approvalScore: plan.score,
        approvalTier: plan.tier,
        approvalFactors: { incomeStability: 0.8, dbr: 0.4 },
        engineVersion: engine.version,
        requiredDocuments: [],
        matchReasons: ['seed'],
        cascadeTrace: { steps: [] },
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 28) * 24 * 3600 * 1000),
      },
    });
    created++;

    // 70% of offers get a decision — outcome biased by tier likelihood.
    if (Math.random() < 0.7) {
      const approved = Math.random() < plan.approvalLikelihood;
      const rejected = !approved && Math.random() < 0.85;
      const outcome = approved
        ? DecisionOutcome.approved
        : rejected
        ? DecisionOutcome.rejected
        : DecisionOutcome.withdrawn;
      await prisma.bankOfferDecision.create({
        data: {
          bankOfferId: offer.id,
          outcome,
          recordedAt: new Date(offer.createdAt.getTime() + Math.floor(Math.random() * 5) * 24 * 3600 * 1000),
          decisionLatencyMs: Math.floor(Math.random() * 5 * 24 * 3600 * 1000),
        },
      });
      decided++;
    }
  }

  console.log(`scoring-seed: created ${created} offers, ${decided} decisions across ${apps.length} apps.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
