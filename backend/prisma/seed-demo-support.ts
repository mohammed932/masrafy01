/**
 * Client-demo seeder for the support desk (`support_request`) — the rows behind
 * the dashboard "Open requests" tile.
 *
 *   npm run seed:support:demo                       # top-up to the default target
 *   SEED_DEMO_SUPPORT_COUNT=30 npm run seed:support:demo
 *   SEED_DEMO_SUPPORT_RESET=1 npm run seed:support:demo   # wipe THIS seeder's rows first
 *
 * The desk is only ever read by status + createdAt, so the shape that matters is
 * the mix: a live queue (`open` + `in_progress`) sitting on top of a resolved
 * archive, spread over the four channels, aged over the last three weeks, and
 * attached to the demo applications + customers created by
 * `seed-demo-applications.ts` so a ticket opens onto a real lead.
 *
 * Idempotent + top-up: every row this seeder owns carries an explicit
 * `demo-sup-*` id, which is both the count scope and the RESET scope — nothing
 * it did not create is ever deleted.
 */

import { PrismaClient, SupportChannel, SupportStatus } from '@prisma/client';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Live queue + archive. The dashboard tile counts only the live half. */
const DEFAULT_TARGET = Number(process.env['SEED_DEMO_SUPPORT_COUNT'] ?? 26);
const RESET = process.env['SEED_DEMO_SUPPORT_RESET'] === '1';

/** Marks every row this seeder owns — used for the count + the RESET scope. */
const DEMO_ID_PREFIX = 'demo-sup-';
/** Tag of the applications produced by `seed-demo-applications.ts`. */
const DEMO_APP_TAG = 'demo-board-';

// Deterministic PRNG — a re-run reproduces the same desk (mulberry32).
let rngState = 20260803;
function rand(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)] as T;
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

// ---------------------------------------------------------------------------
// Ticket content — Arabic, because the desk reads them in Arabic (Principle IV).
// Grouped by intent so the channel mix stays plausible.
// ---------------------------------------------------------------------------

interface Topic {
  /** Channels this intent realistically arrives on. */
  readonly channels: readonly SupportChannel[];
  /** Needs a linked application to make sense. */
  readonly needsApplication: boolean;
  readonly notes: readonly string[];
}

const TOPICS: readonly Topic[] = [
  {
    channels: ['chat', 'whatsapp'],
    needsApplication: true,
    notes: [
      'العميل يسأل عن موعد رد البنك على طلبه.',
      'العميل يريد معرفة المستندات المطلوبة لاستكمال الطلب.',
      'العميل يستفسر عن سبب اختلاف القسط عن العرض المعروض في التطبيق.',
    ],
  },
  {
    channels: ['call', 'whatsapp'],
    needsApplication: true,
    notes: [
      'العميل يطلب تعديل مدة القرض من 36 إلى 48 شهرًا.',
      'العميل يريد تغيير البنك المختار قبل توقيع العقد.',
      'العميل يطلب إلغاء الطلب والتقديم بمبلغ أقل.',
    ],
  },
  {
    channels: ['chat', 'email'],
    needsApplication: false,
    notes: [
      'العميل لا يستطيع رفع صورة البطاقة — الملف يُرفض عند الرفع.',
      'العميل لم يستلم كود التحقق على رقم الموبايل.',
      'العميل يسأل عن كيفية تعديل بيانات الملف الشخصي بعد التسجيل.',
    ],
  },
  {
    channels: ['email', 'call'],
    needsApplication: false,
    notes: [
      'استفسار عن مصاريف الإدارة ونسبة الفائدة المعلنة.',
      'العميل يسأل هل الخدمة مجانية ومن يتحمل العمولة.',
      'العميل يريد شرحًا لطريقة حساب نسبة القبول المعروضة.',
    ],
  },
];

// ---------------------------------------------------------------------------
// Desk mix
// ---------------------------------------------------------------------------

/**
 * Weights of the live queue against the archive. The tile is meant to read as a
 * working desk: a handful waiting, about a third picked up, the rest closed.
 */
const STATUS_MIX: readonly { status: SupportStatus; weight: number }[] = [
  { status: 'open', weight: 9 },
  { status: 'in_progress', weight: 5 },
  { status: 'resolved', weight: 12 },
];

/** Expands the mix to exactly `count` statuses, oldest bucket first. */
function statusPlan(count: number): SupportStatus[] {
  const totalWeight = STATUS_MIX.reduce((s, m) => s + m.weight, 0);
  const plan: SupportStatus[] = [];
  for (const { status, weight } of STATUS_MIX) {
    const n = Math.round((weight / totalWeight) * count);
    for (let i = 0; i < n; i += 1) plan.push(status);
  }
  // Rounding drift — top up with `open` / trim from the archive.
  while (plan.length < count) plan.push('open');
  while (plan.length > count) {
    const idx = plan.lastIndexOf('resolved');
    plan.splice(idx >= 0 ? idx : plan.length - 1, 1);
  }
  return plan;
}

async function main(): Promise<void> {
  if (RESET) {
    const { count } = await prisma.supportRequest.deleteMany({
      where: { id: { startsWith: DEMO_ID_PREFIX } },
    });
    console.log(`[seed:support:demo] RESET removed ${count} previously seeded request(s).`);
  }

  const already = await prisma.supportRequest.count({
    where: { id: { startsWith: DEMO_ID_PREFIX } },
  });
  const toCreate = Math.max(0, DEFAULT_TARGET - already);
  if (toCreate === 0) {
    console.log(
      `[seed:support:demo] desk already holds ${already} seeded request(s) (target ${DEFAULT_TARGET}) — nothing to do.`,
    );
    return;
  }

  // Leads to hang tickets on. Missing demo applications is not fatal: the
  // support model makes both links optional, so the desk still seeds standalone.
  const applications = await prisma.application.findMany({
    where: { submissionCorrelationId: { startsWith: DEMO_APP_TAG } },
    select: { id: true, applicantUserId: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  if (applications.length === 0) {
    console.log(
      '[seed:support:demo] no demo applications found (run `npm run seed:apps:demo` first) — seeding unlinked requests.',
    );
  }

  // Only the roles that actually work the desk get assigned tickets.
  const staff = await prisma.staffAccount.findMany({
    where: { isActive: true, role: { in: ['sales_agent', 'sales_manager', 'super_admin'] } },
    select: { id: true, name: true, role: true },
    orderBy: { role: 'asc' },
  });
  const agents = staff.filter((s) => s.role !== 'super_admin');
  const assignable = agents.length > 0 ? agents : staff;
  if (assignable.length === 0) {
    console.log(
      '[seed:support:demo] no active staff found — `in_progress` requests will be left unassigned.',
    );
  }

  const now = Date.now();
  const plan = statusPlan(toCreate);
  const tally: Record<string, number> = {};

  for (const [index, status] of plan.entries()) {
    const topic = pick(TOPICS);
    const linked = topic.needsApplication && applications.length > 0 ? pick(applications) : null;

    // Resolved tickets are the oldest, open ones the freshest — so the desk
    // reads as a queue that has been worked, not a random scatter.
    const ageDays =
      status === 'resolved' ? randInt(7, 21) : status === 'in_progress' ? randInt(1, 5) : randInt(0, 3);
    const createdAt = new Date(now - ageDays * DAY - randInt(0, 23) * HOUR);
    const resolvedAt =
      status === 'resolved' ? new Date(createdAt.getTime() + randInt(2, 60) * HOUR) : null;
    const assignedStaffId =
      status !== 'open' && assignable.length > 0 ? pick(assignable).id : null;

    await prisma.supportRequest.create({
      data: {
        id: `${DEMO_ID_PREFIX}${String(already + index + 1).padStart(4, '0')}`,
        applicationId: linked?.id ?? null,
        customerId: linked?.applicantUserId ?? null,
        channel: pick(topic.channels),
        note: pick(topic.notes),
        status,
        assignedStaffId,
        createdAt,
        resolvedAt,
      },
    });

    tally[status] = (tally[status] ?? 0) + 1;
  }

  const live = (tally['open'] ?? 0) + (tally['in_progress'] ?? 0);
  console.log(
    `[seed:support:demo] created ${plan.length} request(s): ${JSON.stringify(tally)}; desk total ≈ ${already + plan.length}.`,
  );
  console.log(
    `[seed:support:demo] dashboard "Open requests" tile will read ${live} (${tally['in_progress'] ?? 0} being handled).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
