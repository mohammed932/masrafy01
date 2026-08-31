/**
 * Shrink the dev catalog to three banks, and delete the catalog names that predate the
 * surrogate-PRODUCT policy.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * Since v18.4.0 a catalog name sold without a payslip takes its calculation from a
 * surrogate PRODUCT it points at. Eleven names still carry the older shape — the rule
 * written inline on the name itself, or (for two of them) no rule at all — and the merged
 * program-catalog board groups them under "Not taking a product's calculation" precisely
 * so they can be found. The decision taken was to delete them rather than migrate them,
 * together with every bank outside the three the dev database keeps.
 *
 * ─── Why a SCRIPT and not a migration ─────────────────────────────────────────
 *
 * A migration runs on every deploy, in every environment, with nobody present. This deletes
 * bank programs and catalog names. It is a decision taken once, deliberately, by somebody
 * who has read what it is about to destroy — so it prints the whole blast radius and does
 * nothing until told to.
 *
 *   npx tsx scripts/purge-legacy-surrogate-catalog.ts            report only
 *   npx tsx scripts/purge-legacy-surrogate-catalog.ts --confirm  delete
 *
 * ─── What it does NOT touch, and why that is not luck ─────────────────────────
 *
 * Applications, bank offers, offer decisions and saved offers all survive. `bank_offer`
 * stores `programCode` and `bankName` as PLAIN STRINGS with no foreign key to
 * `bank_program` or `bank`, because an offer is an immutable snapshot of what a bank quoted
 * (Principle I / A6). So deleting the program a past offer was quoted from cannot rewrite
 * that offer, and nothing here cascades into a customer's history. Verified against the
 * schema rather than assumed — it is the single fact that decides whether this script is
 * a catalog cleanup or a data loss.
 *
 * The deletes that DO cascade are declared in the schema and are all bookkeeping:
 *   · `scoring_weight_set.bankProgramId`            → Cascade
 *   · `audit_event.bankProgramId`                   → SetNull  (the event survives)
 *   · `platform_enumeration_loan_category`          → Cascade
 *   · `platform_enumeration_question`               → Cascade
 *
 * `bank_program.bankId` is `onDelete: Restrict`, so programs are deleted BEFORE their bank.
 * That ordering is load-bearing: reversed, Postgres refuses and the operator is told about
 * a foreign key instead of about the book they are about to remove.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** The three banks the dev database keeps. Everything else goes. */
const KEEP_BANKS = ['ABK Egypt', 'CIB', 'Bank NXT'] as const;

/**
 * The catalog names to delete, BY EXPLICIT KEY.
 *
 * Never "whatever is in the group today". The group is derived from live data — a name
 * joins it the moment somebody unlinks it, and leaves it the moment somebody links it — so
 * a script that reads the group would delete a different set depending on when it is run,
 * and a name somebody was midway through fixing is exactly the one it would take.
 */
const DOOMED_NAMES = [
  'doctor',
  'working_capital',
  'armed_forces',
  'equipment_finance',
  'police',
  'govt_employee',
  'professional',
  'pharmacy',
  'professor',
  'doctor_practice',
  'self_employed',
] as const;

interface Plan {
  doomedBanks: Array<{ id: string; name: string; programCodes: string[] }>;
  keptBanks: Array<{ name: string; programsBefore: number; programsAfter: number }>;
  doomedNames: Array<{
    id: string;
    key: string;
    labelEn: string;
    strategy: string | null;
    /** Programs filed under this name that survive the bank purge — deleted by name. */
    programCodes: string[];
    categories: number;
    questions: number;
  }>;
  /** Offers that name a program this run deletes. They SURVIVE; counted so that is visible. */
  orphanedOffers: number;
  missingNames: string[];
}

async function buildPlan(): Promise<Plan> {
  const banks = await prisma.bank.findMany({
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      nameEnglish: true,
      programs: { select: { id: true, programCode: true, programNameKey: true } },
    },
  });

  const keepSet = new Set<string>(KEEP_BANKS);
  const unknownKeep = [...keepSet].filter((n) => !banks.some((b) => b.nameEnglish === n));
  if (unknownKeep.length > 0) {
    throw new Error(
      `keep-list names no bank in this database: ${unknownKeep.join(', ')}. ` +
        `Refusing rather than deleting every bank that does not match a typo.`,
    );
  }

  const doomedBanks = banks
    .filter((b) => !keepSet.has(b.nameEnglish))
    .map((b) => ({
      id: b.id,
      name: b.nameEnglish,
      programCodes: b.programs.map((p) => p.programCode).sort(),
    }));

  const doomedBankIds = new Set(doomedBanks.map((b) => b.id));

  const names = await prisma.platformEnumeration.findMany({
    where: { type: 'program_name', key: { in: [...DOOMED_NAMES] } },
    select: {
      id: true,
      key: true,
      labelEn: true,
      incomeRule: true,
      _count: { select: { loanCategories: true, questions: true } },
    },
  });

  const found = new Set(names.map((n) => n.key));
  const missingNames = DOOMED_NAMES.filter((k) => !found.has(k));

  // Programs filed under a doomed NAME but belonging to a KEPT bank: the bank purge leaves
  // them, so the name purge has to take them, or the name delete hits a program that still
  // references its key.
  const survivorsByName = new Map<string, string[]>();
  for (const b of banks) {
    if (doomedBankIds.has(b.id)) continue;
    for (const p of b.programs) {
      if (p.programNameKey === null || !found.has(p.programNameKey)) continue;
      const list = survivorsByName.get(p.programNameKey);
      if (list) list.push(p.programCode);
      else survivorsByName.set(p.programNameKey, [p.programCode]);
    }
  }

  const doomedProgramCodes = new Set<string>([
    ...doomedBanks.flatMap((b) => b.programCodes),
    ...[...survivorsByName.values()].flat(),
  ]);

  const keptBanks = banks
    .filter((b) => keepSet.has(b.nameEnglish))
    .map((b) => ({
      name: b.nameEnglish,
      programsBefore: b.programs.length,
      programsAfter: b.programs.filter((p) => !doomedProgramCodes.has(p.programCode)).length,
    }));

  const orphanedOffers = await prisma.bankOffer.count({
    where: { programCode: { in: [...doomedProgramCodes] } },
  });

  return {
    doomedBanks,
    keptBanks,
    doomedNames: names
      .map((n) => ({
        id: n.id,
        key: n.key,
        labelEn: n.labelEn,
        strategy:
          n.incomeRule && typeof n.incomeRule === 'object' && 'strategy' in n.incomeRule
            ? String((n.incomeRule as { strategy?: unknown }).strategy ?? '')
            : null,
        programCodes: (survivorsByName.get(n.key) ?? []).sort(),
        categories: n._count.loanCategories,
        questions: n._count.questions,
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    orphanedOffers,
    missingNames: [...missingNames],
  };
}

function report(plan: Plan): void {
  const bankPrograms = plan.doomedBanks.reduce((n, b) => n + b.programCodes.length, 0);
  const namePrograms = plan.doomedNames.reduce((n, d) => n + d.programCodes.length, 0);

  console.log('\n=== BANKS TO DELETE ===================================================');
  for (const b of plan.doomedBanks) {
    console.log(`  ${b.name.padEnd(30)} ${String(b.programCodes.length).padStart(2)} programs`);
    for (const c of b.programCodes) console.log(`      · ${c}`);
  }
  console.log(`  ${plan.doomedBanks.length} banks, ${bankPrograms} bank programs`);

  console.log('\n=== BANKS TO KEEP =====================================================');
  for (const b of plan.keptBanks) {
    const lost = b.programsBefore - b.programsAfter;
    const note = lost > 0 ? `  (loses ${lost} filed under a deleted name)` : '';
    console.log(`  ${b.name.padEnd(30)} ${b.programsBefore} → ${b.programsAfter} programs${note}`);
  }

  console.log('\n=== CATALOG NAMES TO DELETE ===========================================');
  for (const d of plan.doomedNames) {
    const strat = d.strategy ?? 'no rule at all';
    console.log(
      `  ${d.key.padEnd(20)} ${strat.padEnd(24)} ` +
        `${d.categories} loan types, ${d.questions} picked questions`,
    );
    for (const c of d.programCodes) console.log(`      · ${c}  (at a kept bank — deleted too)`);
  }
  console.log(`  ${plan.doomedNames.length} names, ${namePrograms} further bank programs`);

  if (plan.missingNames.length > 0) {
    console.log(`\n  NOT FOUND (already gone): ${plan.missingNames.join(', ')}`);
  }

  console.log('\n=== SURVIVES ==========================================================');
  console.log(
    `  ${plan.orphanedOffers} bank offers name a program this deletes, and are UNTOUCHED.\n` +
      `  An offer stores programCode + bankName as plain strings, not as a foreign key, so\n` +
      `  it keeps quoting exactly what the bank quoted (Principle I / A6). Applications,\n` +
      `  offer decisions, saved offers and audit events all survive.`,
  );
  console.log(
    `\n  TOTAL to delete: ${plan.doomedBanks.length} banks, ` +
      `${bankPrograms + namePrograms} bank programs, ${plan.doomedNames.length} catalog names.`,
  );
}

async function apply(plan: Plan): Promise<void> {
  const doomedBankIds = plan.doomedBanks.map((b) => b.id);
  const doomedNameKeys = plan.doomedNames.map((d) => d.key);
  const doomedNameIds = plan.doomedNames.map((d) => d.id);

  // One transaction. A half-applied run leaves banks with no programs, or names whose
  // programs are gone — both states look configured and quote nothing.
  const result = await prisma.$transaction(async (tx) => {
    // 1. Programs of the doomed banks. BEFORE the banks: `bank_program.bankId` is Restrict.
    const byBank = await tx.bankProgram.deleteMany({ where: { bankId: { in: doomedBankIds } } });

    // 2. Programs still filed under a doomed name at a KEPT bank.
    const byName = await tx.bankProgram.deleteMany({
      where: { programNameKey: { in: doomedNameKeys } },
    });

    // 3. The banks themselves, now that nothing references them.
    const banks = await tx.bank.deleteMany({ where: { id: { in: doomedBankIds } } });

    // 4. The catalog names. Their loan-category and picked-question rows cascade.
    const names = await tx.platformEnumeration.deleteMany({ where: { id: { in: doomedNameIds } } });

    return {
      programsByBank: byBank.count,
      programsByName: byName.count,
      banks: banks.count,
      names: names.count,
    };
  });

  console.log('\n=== DELETED ===========================================================');
  console.log(`  bank programs (by bank) : ${result.programsByBank}`);
  console.log(`  bank programs (by name) : ${result.programsByName}`);
  console.log(`  banks                   : ${result.banks}`);
  console.log(`  catalog names           : ${result.names}`);
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');
  const plan = await buildPlan();
  report(plan);

  if (!confirm) {
    console.log('\n  DRY RUN — nothing was written.');
    console.log('  Re-run with --confirm to delete.\n');
    return;
  }

  await apply(plan);

  // Re-read rather than trust the counts: the point of the run is the END STATE.
  const banksLeft = await prisma.bank.count();
  const programsLeft = await prisma.bankProgram.count();
  const namesLeft = await prisma.platformEnumeration.count({ where: { type: 'program_name' } });
  console.log('\n=== NOW ===============================================================');
  console.log(`  banks: ${banksLeft}   bank programs: ${programsLeft}   catalog names: ${namesLeft}\n`);
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
