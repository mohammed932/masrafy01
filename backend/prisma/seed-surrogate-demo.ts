/**
 * Demo seeder for feature 011 — income-surrogate rules + the value-source gate
 * (FR-005 … FR-013, FR-032 … FR-035).
 *
 *   npm run seed:surrogate:demo                              # apply
 *   SEED_SURROGATE_DEMO_RESET=1 npm run seed:surrogate:demo   # back to `declared` + {}
 *
 * Two things to look at once this has run:
 *
 *   1. The Eligibility step of each program below opens onto a POPULATED income-rule
 *      editor — bands, a key table, a percentage — instead of the "no table is needed"
 *      hint every seeded surrogate program shows out of the box.
 *   2. Three of them carry a team-estimated marker, so they are OFF AIR and refuse to
 *      go live: `POST /toggle {active:true}` answers 409 `PROGRAM_HAS_ESTIMATED_VALUES`
 *      naming the exact fields. Untick the marker in the editor, save, and the program
 *      becomes switchable. That refusal is the whole feature.
 *
 * The markers deliberately cover more than the income rule (a rate, a fee): the gate is
 * about ANY number an admin typed rather than read off a bank's document, and only one
 * of the seven markable config blobs is `incomeAssumption`.
 *
 * Idempotent. Every audit event it writes carries a `demoSurrogateSeed: true` payload
 * flag, which is both the re-run scope and the RESET scope — nothing it did not create
 * is ever deleted, and re-running replaces its own events rather than stacking them.
 */

import { PrismaClient, Prisma, AuditEventType } from '@prisma/client';

const prisma = new PrismaClient();

const RESET = process.env['SEED_SURROGATE_DEMO_RESET'] === '1';

/** Marks every audit event this seeder owns. */
const SEED_FLAG = 'demoSurrogateSeed';

interface Scenario {
  programCode: string;
  /** What the admin configured. `null` leaves the program's rule untouched. */
  incomeAssumption: Prisma.InputJsonValue | null;
  /** Numbers the team guessed. A non-empty map is what blocks activation (FR-033). */
  valueSources: Record<string, 'team_estimated'>;
  note: string;
}

const SCENARIOS: readonly Scenario[] = [
  {
    programCode: 'ABK-PER-DOCTOR',
    // Years in practice → an assumed income. The top band is CLOSED on purpose:
    // above 30 years the rule yields nothing and the customer is told so, which is a
    // real configuration and not a mistake.
    incomeAssumption: {
      strategy: 'byYearsInPractice',
      bands: [
        { fromInclusive: '0', toExclusive: '3', incomeEGP: '18000' },
        { fromInclusive: '3', toExclusive: '8', incomeEGP: '35000' },
        { fromInclusive: '8', toExclusive: '15', incomeEGP: '60000' },
        { fromInclusive: '15', toExclusive: '31', incomeEGP: '90000' },
      ],
      requiredDocuments: ['syndicate_card'],
    },
    valueSources: { 'incomeAssumption.bands.3.incomeEGP': 'team_estimated' },
    note: 'band table, top band closed — the 15+ year income is our guess, so it is OFF AIR',
  },
  {
    programCode: 'CIB-PER-DOCTOR',
    incomeAssumption: {
      strategy: 'byYearsInPractice',
      bands: [
        { fromInclusive: '0', toExclusive: '5', incomeEGP: '20000' },
        { fromInclusive: '5', toExclusive: null, incomeEGP: '48000' },
      ],
      dbrCapPercentOverride: '45',
    },
    // TWO paths, and one is not an income at all — the gate covers every number.
    valueSources: {
      'incomeAssumption.bands.1.incomeEGP': 'team_estimated',
      'pricing.baseRatePercent': 'team_estimated',
    },
    note: 'band table + per-rule DBR cap; TWO guessed numbers, one of them the rate',
  },
  {
    programCode: 'CIB-PER-PROFESSIONAL',
    // A key table, addressed by REGISTRY KEY rather than position — which is why its
    // marker survives a row being reordered.
    incomeAssumption: {
      strategy: 'byProfessorRank',
      keyTable: [
        { key: 'lecturer', incomeEGP: '22000' },
        { key: 'assistant_professor', incomeEGP: '38000' },
        { key: 'professor', incomeEGP: '65000' },
      ],
      combinationRule: 'greater_of',
    },
    valueSources: { 'incomeAssumption.keyTable.professor.incomeEGP': 'team_estimated' },
    note: 'academic-rank key table; the top rank was our guess, so it is OFF AIR',
  },
  {
    programCode: 'HSBC-PER-PROFESSIONAL',
    // The percentage form: no table, one figure. Certificate value × 4% ÷ 12.
    incomeAssumption: {
      strategy: 'byCDValue',
      bands: [],
      scalar: { value: '4', unit: 'percent' },
    },
    valueSources: {},
    note: 'percentage form, fully bank-stated — stays LIVE, the control case',
  },
];

async function main(): Promise<void> {
  const actorId = await resolveActorId();

  // Always cleared first, so a re-run replaces this seeder's history instead of
  // stacking a second copy of it behind the same markers.
  const cleared = await prisma.auditEvent.deleteMany({
    where: {
      eventType: AuditEventType.BANK_PROGRAM_VALUE_SOURCE_CHANGED,
      payload: { path: [SEED_FLAG], equals: true },
    },
  });
  if (cleared.count > 0) console.log(`  cleared ${cleared.count} previous demo marker event(s)`);

  for (const scenario of SCENARIOS) {
    const program = await prisma.bankProgram.findUnique({
      where: { programCode: scenario.programCode },
      select: { id: true, programCode: true },
    });
    if (!program) {
      console.log(`  SKIP ${scenario.programCode} — not in this database`);
      continue;
    }

    const paths = Object.keys(scenario.valueSources);

    if (RESET) {
      await prisma.bankProgram.update({
        where: { id: program.id },
        data: {
          valueSources: {},
          active: true,
          ...(scenario.incomeAssumption !== null
            ? { incomeAssumption: { strategy: 'declared' } }
            : {}),
        },
      });
      console.log(`  reset ${scenario.programCode}`);
      continue;
    }

    await prisma.bankProgram.update({
      where: { id: program.id },
      data: {
        valueSources: scenario.valueSources,
        // A program carrying an estimate cannot be live (FR-033/FR-035), so the seed
        // leaves it in the state the API would have left it in.
        active: paths.length === 0,
        ...(scenario.incomeAssumption !== null
          ? { incomeAssumption: scenario.incomeAssumption }
          : {}),
      },
    });

    // FR-038 — a marker change is auditable with the identity behind it. Written even
    // for a seed, because "who said this number was a guess" is the question the audit
    // trail exists to answer.
    if (paths.length > 0) {
      await prisma.auditEvent.create({
        data: {
          actorId,
          bankProgramId: program.id,
          eventType: AuditEventType.BANK_PROGRAM_VALUE_SOURCE_CHANGED,
          payload: {
            programCode: program.programCode,
            added: paths,
            removed: [],
            [SEED_FLAG]: true,
          },
        },
      });
    }

    console.log(
      `  ${scenario.programCode.padEnd(24)} ${paths.length === 0 ? 'LIVE ' : 'off  '} ${scenario.note}`,
    );
  }
}

/**
 * The editor the events are attributed to.
 *
 * `actorId` is nullable and `SetNull` on delete, so a missing account is not fatal —
 * but an unattributed change is a poor demo of FR-038, whose whole claim is that every
 * marker change carries the identity of whoever made it.
 */
async function resolveActorId(): Promise<string | null> {
  const staff =
    (await prisma.staffAccount.findFirst({
      where: { role: 'super_admin', email: { not: 'system@masrafy.local' } },
      select: { id: true },
    })) ?? (await prisma.staffAccount.findFirst({ select: { id: true } }));
  return staff?.id ?? null;
}

main()
  .then(async () => {
    console.log(RESET ? 'surrogate demo reset.' : 'surrogate demo seeded.');
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
