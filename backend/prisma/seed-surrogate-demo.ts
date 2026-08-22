/**
 * Demo seeder for feature 011 — income-surrogate rules + the value-source gate
 * (FR-005 … FR-013, FR-032 … FR-035).
 *
 *   npm run seed:surrogate:demo                              # apply
 *   SEED_SURROGATE_DEMO_RESET=1 npm run seed:surrogate:demo   # back to `declared` + {}
 *
 * What to look at once this has run: the Eligibility step of each program below opens onto
 * a POPULATED income-rule editor — bands, a key table, a percentage — instead of the "no
 * table is needed" hint every seeded surrogate program shows out of the box.
 *
 * The team-estimated markers this seeder used to plant are GONE. It flagged three programs
 * so they would refuse to go live, which was the point of the value-source gate; that gate
 * and the control that set it have both been removed, so a marker here would now be a
 * number nobody could unflag. `valueSources` is written EMPTY instead, which is also what
 * clears a marker left on a program by an older run of this file.
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
  /**
   * The catalog name to file the program under, because the income PROOF is the name's
   * property now: a surrogate program must read what its name states, and every bank
   * under one name reads the same thing.
   *
   * Set on every scenario that supplies a rule. Without it this seeder manufactured the
   * exact violation the platform refuses — it pointed two programs reading DIFFERENT
   * proofs at `professional`, so re-seeding a dev box left two live programs that could
   * no longer be saved.
   */
  programNameKey: string;
  /**
   * The name the program is filed under WITHOUT this seeder — where RESET puts it back.
   *
   * Needed because reset restores `{strategy:'declared'}`, and `declared` under a name
   * that states `byProfessorRank` is refused. Resetting the rule without the name would
   * leave exactly the unsavable program this seeder is being fixed for, one axis over.
   */
  resetProgramNameKey: string;
  /** Numbers the team guessed. A non-empty map is what blocks activation (FR-033). */
  valueSources: Record<string, 'team_estimated'>;
  note: string;
}

const SCENARIOS: readonly Scenario[] = [
  {
    programCode: 'ABK-PER-DOCTOR',
    // `doctor` states `byYearsInPractice` and these are its catalog figures, so this
    // program is the one on the catalog's OWN table — the reference case for the
    // inherited path.
    programNameKey: 'doctor',
    resetProgramNameKey: 'doctor',
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
    valueSources: {},
    note: 'band table, top band closed on purpose: above 30 years the rule yields nothing',
  },
  {
    programCode: 'CIB-PER-DOCTOR',
    // Same name, same proof, DIFFERENT figures — two banks selling one product each
    // with their own table, which is the whole point of `amounts: 'own'`.
    programNameKey: 'doctor',
    resetProgramNameKey: 'doctor',
    incomeAssumption: {
      strategy: 'byYearsInPractice',
      amounts: 'own',
      bands: [
        { fromInclusive: '0', toExclusive: '5', incomeEGP: '20000' },
        { fromInclusive: '5', toExclusive: null, incomeEGP: '48000' },
      ],
      dbrCapPercentOverride: '45',
    },
    valueSources: {},
    note: 'band table + per-rule DBR cap',
  },
  {
    programCode: 'CIB-PER-PROFESSIONAL',
    // MOVED off `professional`. It reads academic rank, and `professor` is the name
    // that states academic rank; `professional` states nothing, because the two
    // programs filed there read two different proofs and one name cannot say both.
    programNameKey: 'professor',
    resetProgramNameKey: 'professional',
    // A key table, addressed by REGISTRY KEY rather than position — which is why its
    // marker survives a row being reordered.
    incomeAssumption: {
      strategy: 'byProfessorRank',
      amounts: 'own',
      keyTable: [
        { key: 'lecturer', incomeEGP: '22000' },
        { key: 'assistant_professor', incomeEGP: '38000' },
        { key: 'professor', incomeEGP: '65000' },
      ],
      combinationRule: 'greater_of',
    },
    valueSources: {},
    note: 'academic-rank key table, three ranks',
  },
  {
    programCode: 'HSBC-PER-PROFESSIONAL',
    // MOVED off `professional` too, and re-pointed at the proof its new name states.
    //
    // It used to read `byCDValue` (certificate value × 4% ÷ 12), which no catalog name
    // states — and inventing a name for one demo program would put a row in every
    // environment to serve a dev box. `self_employed` states
    // `byBankStatementPercent`, the SAME scalar-percent editor shape, so the scenario
    // still demonstrates "no table, one figure" while obeying the rule.
    programNameKey: 'self_employed',
    resetProgramNameKey: 'professional',
    // `amounts: 'catalog'` — no figures of its own. This is now the INHERITED case:
    // the 30% comes from the `self_employed` catalog rule, and editing the catalog
    // moves this program's income on the next quote. Which is also why it is the
    // control case that stays LIVE: nothing here is a team guess.
    incomeAssumption: {
      strategy: 'byBankStatementPercent',
      amounts: 'catalog',
    },
    valueSources: {},
    note: 'inherits the catalog percentage — nothing typed here, stays LIVE, the control case',
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
            ? {
                incomeAssumption: { strategy: 'declared' },
                // Back under its seeded name too. `declared` under a name that states
                // `byProfessorRank` is refused, so restoring one without the other
                // trades one unsavable program for another.
                programNameKey: scenario.resetProgramNameKey,
              }
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
          ? {
              incomeAssumption: scenario.incomeAssumption,
              // Filed WITH the rule, in the same write. A rule that disagrees with its
              // name's proof is refused by the API, so writing one without the other
              // leaves a program the admin cannot save — the state this seeder used to
              // produce.
              programNameKey: scenario.programNameKey,
            }
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
