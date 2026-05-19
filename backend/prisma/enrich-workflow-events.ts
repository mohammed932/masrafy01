/* eslint-disable no-console */
import { LeadStatus, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const WORKFLOW_TYPES = new Set([
  'MARKED_AS_REVIEWED',
  'SUBMITTED_TO_BANK',
  'BANK_RESPONDED',
  'STATUS_CHANGE',
  'LEAD_REASSIGNED',
  'UPDATED_APPLICANT_INFO',
  'STALE_LEAD_FLAGGED',
]);

const SYSTEM_STAFF_ID = 'clsysactor00000000000000000000';

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

async function ensureSystemActor(): Promise<string> {
  const existing = await prisma.staffAccount.findUnique({ where: { id: SYSTEM_STAFF_ID } });
  if (existing) return existing.id;
  // fall back to any agent if no system actor row exists
  const anyAgent = await prisma.staffAccount.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  return anyAgent?.id ?? SYSTEM_STAFF_ID;
}

async function main(): Promise<void> {
  const systemId = await ensureSystemActor();
  const apps = await prisma.application.findMany({
    where: {
      mobileClientId: { startsWith: 'seed-' },
      assignedAgentStaffId: { not: null },
    },
    select: {
      id: true,
      assignedAgentStaffId: true,
      assignedAt: true,
      leadStatus: true,
      assignedAgent: { select: { role: true } },
      bankOffers: {
        select: { programCode: true },
        take: 3,
      },
      activities: {
        select: { activityType: true, reason: true },
      },
    },
  });

  let added = 0;
  let appsTouched = 0;

  for (const a of apps) {
    if (!a.assignedAgentStaffId || !a.assignedAt) continue;
    const agentId = a.assignedAgentStaffId;
    const agentRole = a.assignedAgent?.role ?? 'sales_agent';
    const assignedMs = a.assignedAt.getTime();

    const currentWorkflowCount = a.activities.filter((x) => WORKFLOW_TYPES.has(x.activityType)).length;
    if (currentWorkflowCount >= 3) continue;

    const has = (t: string) => a.activities.some((x) => x.activityType === t);
    const has2 = (t: string, reason: string) =>
      a.activities.some((x) => x.activityType === t && x.reason === reason);

    let touched = false;

    // ---- STATUS_CHANGE: needs_first_contact -> document_collection
    if (!has2('STATUS_CHANGE', 'SYSTEM_GENERATED')) {
      await prisma.activity.create({
        data: {
          applicationId: a.id,
          actorStaffId: systemId,
          actorRole: 'system',
          activityType: 'STATUS_CHANGE',
          reason: 'SYSTEM_GENERATED',
          note: 'Status moved to Document Collection.',
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          occurredAt: new Date(assignedMs + 4 * HOUR),
        },
      });
      added++;
      touched = true;
    }

    // ---- REQUESTED_MORE_DOCS (mid-stage)
    if (!has('REQUESTED_MORE_DOCS')) {
      await prisma.activity.create({
        data: {
          applicationId: a.id,
          actorStaffId: agentId,
          actorRole: agentRole,
          activityType: 'REQUESTED_MORE_DOCS',
          reason: pick(['MISSING_ITEM', 'DOCUMENT_BLURRY', 'NAME_MISMATCH']),
          note: 'Asked applicant to re-upload a clearer copy.',
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          occurredAt: new Date(assignedMs + 12 * HOUR),
        },
      });
      added++;
      touched = true;
    }

    // ---- UPDATED_APPLICANT_INFO
    if (!has('UPDATED_APPLICANT_INFO')) {
      await prisma.activity.create({
        data: {
          applicationId: a.id,
          actorStaffId: agentId,
          actorRole: agentRole,
          activityType: 'UPDATED_APPLICANT_INFO',
          reason: pick(['CORRECTED_PHONE', 'UPDATED_EMPLOYMENT', 'CORRECTED_INCOME']),
          note: 'Corrected applicant phone number after verification call.',
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          occurredAt: new Date(assignedMs + 22 * HOUR),
        },
      });
      added++;
      touched = true;
    }

    // ---- MARKED_AS_REVIEWED (may already exist from prior backfill)
    if (!has('MARKED_AS_REVIEWED')) {
      await prisma.activity.create({
        data: {
          applicationId: a.id,
          actorStaffId: agentId,
          actorRole: agentRole,
          activityType: 'MARKED_AS_REVIEWED',
          reason: 'READY_FOR_SUBMISSION',
          note: 'Docs verified — ready for bank submission.',
          outcomeFlags: [],
          attachedDocumentIds: [],
          correlationId: randomUUID(),
          occurredAt: new Date(assignedMs + 26 * HOUR),
        },
      });
      added++;
      touched = true;
    }

    // ---- SUBMITTED_TO_BANK + BANK_RESPONDED for first available program
    const firstOffer = a.bankOffers[0];
    if (firstOffer) {
      if (!has2('SUBMITTED_TO_BANK', firstOffer.programCode)) {
        await prisma.activity.create({
          data: {
            applicationId: a.id,
            actorStaffId: agentId,
            actorRole: agentRole,
            activityType: 'SUBMITTED_TO_BANK',
            reason: firstOffer.programCode,
            note: `Submitted under ${firstOffer.programCode}.`,
            outcomeFlags: [],
            attachedDocumentIds: [],
            correlationId: randomUUID(),
            occurredAt: new Date(assignedMs + 2 * DAY),
          },
        });
        added++;
        touched = true;
      }

      if (!has('BANK_RESPONDED')) {
        const outcome = pick(['APPROVED', 'NEEDS_MORE_INFO', 'CONDITIONAL_APPROVAL', 'COUNTER_OFFER']);
        await prisma.activity.create({
          data: {
            applicationId: a.id,
            actorStaffId: agentId,
            actorRole: agentRole,
            activityType: 'BANK_RESPONDED',
            reason: outcome,
            note: `Bank responded: ${outcome.replace(/_/g, ' ').toLowerCase()}.`,
            outcomeFlags: [],
            attachedDocumentIds: [],
            correlationId: randomUUID(),
            occurredAt: new Date(assignedMs + (3 + rand(0, 3)) * DAY),
          },
        });
        added++;
        touched = true;
      }
    }

    if (touched) appsTouched++;
  }

  console.log(`enrich-workflow: added ${added} workflow rows across ${appsTouched} apps.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
