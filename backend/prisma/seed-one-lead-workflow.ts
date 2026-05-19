/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const APP_ID = 'cmpbt3t5b003vrrvu2pw52gal';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const SYSTEM_STAFF_ID = 'clsysactor00000000000000000000';

async function main(): Promise<void> {
  const app = await prisma.application.findUnique({
    where: { id: APP_ID },
    select: {
      id: true,
      assignedAgentStaffId: true,
      assignedAt: true,
      assignedAgent: { select: { role: true, name: true } },
      bankOffers: { select: { programCode: true, effectiveLoanAmountEGP: true }, take: 4 },
    },
  });
  if (!app) {
    console.error(`Application ${APP_ID} not found.`);
    process.exitCode = 1;
    return;
  }
  if (!app.assignedAgentStaffId || !app.assignedAt) {
    console.error('Application has no assigned agent or assignedAt.');
    process.exitCode = 1;
    return;
  }

  const agentId = app.assignedAgentStaffId;
  const agentRole = app.assignedAgent?.role ?? 'sales_agent';
  const t0 = app.assignedAt.getTime();
  const systemActorExists = await prisma.staffAccount.findUnique({
    where: { id: SYSTEM_STAFF_ID },
  });
  const systemId = systemActorExists ? SYSTEM_STAFF_ID : agentId;
  const systemRole = systemActorExists ? 'system' : agentRole;

  // Pick a second agent for the reassignment row (any other active agent)
  const otherAgent = await prisma.staffAccount.findFirst({
    where: {
      id: { not: agentId },
      isActive: true,
      role: { in: ['sales_agent', 'sales_manager'] },
    },
    select: { id: true, name: true },
  });

  const program1 = app.bankOffers[0]?.programCode ?? 'ABK-PERSONAL-2026';
  const program2 = app.bankOffers[1]?.programCode ?? program1;

  const events: Array<{
    activityType: string;
    reason: string;
    actorStaffId: string;
    actorRole: string;
    occurredAt: Date;
    note?: string;
  }> = [
    {
      activityType: 'STATUS_CHANGE',
      reason: 'SYSTEM_GENERATED',
      actorStaffId: systemId,
      actorRole: systemRole,
      occurredAt: new Date(t0 + 4 * HOUR),
      note: 'Lead status moved to Document Collection.',
    },
    {
      activityType: 'REQUESTED_MORE_DOCS',
      reason: 'NAME_MISMATCH',
      actorStaffId: agentId,
      actorRole: agentRole,
      occurredAt: new Date(t0 + 14 * HOUR),
      note: 'Asked applicant to re-upload national ID — name mismatch on salary slip.',
    },
    {
      activityType: 'UPDATED_APPLICANT_INFO',
      reason: 'CORRECTED_INCOME',
      actorStaffId: agentId,
      actorRole: agentRole,
      occurredAt: new Date(t0 + 20 * HOUR),
      note: 'Corrected monthly income after second salary slip confirmed.',
    },
    {
      activityType: 'STATUS_CHANGE',
      reason: 'SYSTEM_GENERATED',
      actorStaffId: systemId,
      actorRole: systemRole,
      occurredAt: new Date(t0 + 26 * HOUR),
      note: 'Lead status moved to Ready For Submission.',
    },
    {
      activityType: 'MARKED_AS_REVIEWED',
      reason: 'READY_FOR_SUBMISSION',
      actorStaffId: agentId,
      actorRole: agentRole,
      occurredAt: new Date(t0 + 28 * HOUR),
      note: 'Docs verified — ready for bank submission.',
    },
    {
      activityType: 'SUBMITTED_TO_BANK',
      reason: program1,
      actorStaffId: agentId,
      actorRole: agentRole,
      occurredAt: new Date(t0 + 2 * DAY),
      note: `Submitted under ${program1}.`,
    },
    {
      activityType: 'BANK_RESPONDED',
      reason: 'NEEDS_MORE_INFO',
      actorStaffId: agentId,
      actorRole: agentRole,
      occurredAt: new Date(t0 + 3 * DAY + 4 * HOUR),
      note: 'Bank requested 6-month bank statement.',
    },
    {
      activityType: 'STATUS_CHANGE',
      reason: 'SYSTEM_GENERATED',
      actorStaffId: systemId,
      actorRole: systemRole,
      occurredAt: new Date(t0 + 4 * DAY),
      note: 'Lead status moved to Submitted To Bank.',
    },
    {
      activityType: 'SUBMITTED_TO_BANK',
      reason: program2,
      actorStaffId: agentId,
      actorRole: agentRole,
      occurredAt: new Date(t0 + 4 * DAY + 6 * HOUR),
      note: `Re-submitted to a second bank: ${program2}.`,
    },
    ...(otherAgent
      ? [
          {
            activityType: 'LEAD_REASSIGNED',
            reason: 'WORKLOAD_REBALANCE',
            actorStaffId: agentId,
            actorRole: agentRole,
            occurredAt: new Date(t0 + 5 * DAY),
            note: `Reassigned to ${otherAgent.name} during workload rebalance.`,
          },
        ]
      : []),
    {
      activityType: 'BANK_RESPONDED',
      reason: 'CONDITIONAL_APPROVAL',
      actorStaffId: (otherAgent?.id ?? agentId),
      actorRole: agentRole,
      occurredAt: new Date(t0 + 6 * DAY),
      note: 'Conditional approval — pending property valuation.',
    },
    {
      activityType: 'BANK_RESPONDED',
      reason: 'APPROVED',
      actorStaffId: (otherAgent?.id ?? agentId),
      actorRole: agentRole,
      occurredAt: new Date(t0 + 7 * DAY),
      note: 'Final approval received from bank.',
    },
    {
      activityType: 'STATUS_CHANGE',
      reason: 'SYSTEM_GENERATED',
      actorStaffId: systemId,
      actorRole: systemRole,
      occurredAt: new Date(t0 + 7 * DAY + 1 * HOUR),
      note: 'Lead status moved to Bank Decided.',
    },
  ];

  let added = 0;
  for (const e of events) {
    await prisma.activity.create({
      data: {
        applicationId: app.id,
        actorStaffId: e.actorStaffId,
        actorRole: e.actorRole,
        activityType: e.activityType,
        reason: e.reason,
        note: e.note ?? null,
        outcomeFlags: [],
        attachedDocumentIds: [],
        correlationId: randomUUID(),
        occurredAt: e.occurredAt,
      },
    });
    added++;
  }

  console.log(`Seeded ${added} workflow events on lead ${app.id}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
