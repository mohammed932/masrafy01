/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function main(): Promise<void> {
  const apps = await prisma.application.findMany({
    where: {
      submissionCorrelationId: { startsWith: 'seed-corr-' },
      assignedAgentStaffId: { not: null },
    },
    select: {
      id: true,
      assignedAgentStaffId: true,
      assignedAt: true,
      assignedAgent: { select: { role: true } },
      bankOffers: {
        where: { decision: { isNot: null } },
        select: {
          id: true,
          programCode: true,
          decision: { select: { outcome: true, recordedAt: true } },
        },
      },
      activities: {
        select: { activityType: true, occurredAt: true, reason: true },
      },
    },
  });

  let added = 0;
  for (const a of apps) {
    if (!a.assignedAgentStaffId || !a.assignedAt) continue;
    const agentId = a.assignedAgentStaffId;
    const agentRole = a.assignedAgent?.role ?? 'sales_agent';
    const has = (t: string) => a.activities.some((x) => x.activityType === t);
    const has2 = (t: string, reason: string) =>
      a.activities.some((x) => x.activityType === t && x.reason === reason);
    const assignedMs = a.assignedAt.getTime();

    // 1. MARKED_AS_REVIEWED ~ assignedAt + 1d
    if (!has('MARKED_AS_REVIEWED')) {
      await prisma.activity.create({
        data: {
          applicationId: a.id,
          actorStaffId: agentId,
          actorRole: agentRole,
          activityType: 'MARKED_AS_REVIEWED',
          reason: 'READY_FOR_SUBMISSION',
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          note: 'Docs verified — ready for bank submission.',
          occurredAt: new Date(assignedMs + 18 * HOUR),
        },
      });
      added++;
    }

    // 2. SUBMITTED_TO_BANK (one row per approved offer's programCode, if missing)
    for (const offer of a.bankOffers) {
      if (offer.decision?.outcome !== 'approved') continue;
      if (has2('SUBMITTED_TO_BANK', offer.programCode)) continue;
      await prisma.activity.create({
        data: {
          applicationId: a.id,
          actorStaffId: agentId,
          actorRole: agentRole,
          activityType: 'SUBMITTED_TO_BANK',
          reason: offer.programCode,
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          note: `Submitted under ${offer.programCode}.`,
          occurredAt: new Date(assignedMs + 2 * DAY),
        },
      });
      added++;

      // 3. BANK_RESPONDED APPROVED at the decision time
      if (!a.activities.some((x) => x.activityType === 'BANK_RESPONDED' && x.reason === 'APPROVED')) {
        await prisma.activity.create({
          data: {
            applicationId: a.id,
            actorStaffId: agentId,
            actorRole: agentRole,
            activityType: 'BANK_RESPONDED',
            reason: 'APPROVED',
            outcomeFlags: [],
            attachedDocumentIds: [],
            correlationId: randomUUID(),
            note: 'Bank approved.',
            occurredAt: offer.decision?.recordedAt ?? new Date(assignedMs + 4 * DAY),
          },
        });
        added++;
      }
    }

    // If no approved offers — still add SUBMITTED if leadStatus suggests submission happened
    if (a.bankOffers.length === 0 && !has('SUBMITTED_TO_BANK')) {
      // skip — only seed workflow for apps that actually progressed
    }
  }

  console.log(`backfill-workflow: added ${added} workflow activities across ${apps.length} seeded apps.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
