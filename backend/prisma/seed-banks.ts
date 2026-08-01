/**
 * Seed — the `Bank` entity rows the demo bank programs reference.
 *
 * Why this file exists: `seed-demo.ts` creates `bank_program` rows carrying a
 * denormalised `bankName` string, but never created the `Bank` rows themselves,
 * so a freshly reset database had 14 programs with `bankId = NULL` and an empty
 * banks list. Banks had only ever been added by hand through the admin UI, which
 * meant `prisma migrate reset` silently destroyed them. This makes them
 * reproducible.
 *
 * Idempotent: upserts by `nameEnglish` (the unique key) and re-links any program
 * whose `bankId` is still null. Safe to run repeatedly.
 *
 * Run via:  npm run seed:banks
 *
 * NOTE: these are DEV values. Arabic names are the banks' common trade names;
 * `websiteUrl` is deliberately left null rather than guessed — fill it in the
 * admin UI. `isFeatured` drives only the ranking tiebreaker (Principle II /
 * `rankOffers`), never eligibility or pricing.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedBank {
  nameEnglish: string;
  nameArabic: string;
  /** Partner-bank flag — final ranking tiebreaker only. */
  isFeatured?: boolean;
  displayOrder: number;
}

/**
 * The ten banks referenced by `seed-demo.ts`' programs. `nameEnglish` MUST match
 * `bank_program.bankName` exactly — that string is how the two are linked until
 * every program carries a `bankId`.
 */
const BANKS: readonly SeedBank[] = [
  // ABK is the platform's anchor partner (see CLAUDE.md "ABK Egypt + partners").
  { nameEnglish: 'ABK Egypt', nameArabic: 'البنك الأهلي الكويتي – مصر', isFeatured: true, displayOrder: 1 },
  { nameEnglish: 'Bank NXT', nameArabic: 'بنك نكست', isFeatured: true, displayOrder: 2 },
  { nameEnglish: 'National Bank of Egypt', nameArabic: 'البنك الأهلي المصري', displayOrder: 3 },
  { nameEnglish: 'Banque Misr', nameArabic: 'بنك مصر', displayOrder: 4 },
  { nameEnglish: 'CIB', nameArabic: 'البنك التجاري الدولي', displayOrder: 5 },
  { nameEnglish: 'QNB Al Ahli', nameArabic: 'بنك قطر الوطني الأهلي', displayOrder: 6 },
  { nameEnglish: 'Banque du Caire', nameArabic: 'بنك القاهرة', displayOrder: 7 },
  { nameEnglish: 'ADIB Egypt', nameArabic: 'مصرف أبو ظبي الإسلامي – مصر', displayOrder: 8 },
  { nameEnglish: 'HSBC Egypt', nameArabic: 'إتش إس بي سي مصر', displayOrder: 9 },
  { nameEnglish: 'Housing & Development Bank', nameArabic: 'بنك التعمير والإسكان', displayOrder: 10 },
];

const SEED_NOTE = 'Created by seed-banks.ts (dev data) — verify details before any shared use.';

export async function seedBanks(actorStaffId?: string): Promise<void> {
  // Bank.createdBy / updatedBy are FKs to StaffAccount, so a staff row must exist.
  const actorId = actorStaffId ?? (await resolveSeedActor());
  if (!actorId) {
    console.error('[seed-banks] no active super_admin found — run `npx prisma db seed` first.');
    return;
  }

  let created = 0;
  let updated = 0;
  for (const b of BANKS) {
    const existing = await prisma.bank.findUnique({
      where: { nameEnglish: b.nameEnglish },
      select: { id: true },
    });
    await prisma.bank.upsert({
      where: { nameEnglish: b.nameEnglish },
      // Only re-assert the fields this seed owns: an admin may have edited the
      // logo, website or notes, and a re-run must not wipe that.
      update: {
        nameArabic: b.nameArabic,
        isActive: true,
        isFeatured: b.isFeatured ?? false,
        displayOrder: b.displayOrder,
        updatedBy: actorId,
      },
      create: {
        nameEnglish: b.nameEnglish,
        nameArabic: b.nameArabic,
        isActive: true,
        isFeatured: b.isFeatured ?? false,
        displayOrder: b.displayOrder,
        notes: SEED_NOTE,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
    if (existing) updated += 1;
    else created += 1;
  }

  const linked = await linkOrphanPrograms();

  console.log(
    `[seed-banks] banks: created ${created}, updated ${updated} of ${BANKS.length}; linked ${linked} program(s) by bankName.`,
  );
}

/**
 * Re-point `bank_program.bankId` for programs that carry a `bankName` but no
 * `bankId`. Matching is by exact name because that is the only link the demo
 * programs ever had.
 */
async function linkOrphanPrograms(): Promise<number> {
  const orphans = await prisma.bankProgram.findMany({
    where: { bankId: null },
    select: { id: true, bankName: true },
  });
  if (orphans.length === 0) return 0;

  const banks = await prisma.bank.findMany({ select: { id: true, nameEnglish: true } });
  const idByName = new Map(banks.map((b) => [b.nameEnglish, b.id]));

  let linked = 0;
  const unmatched = new Set<string>();
  for (const p of orphans) {
    const bankId = idByName.get(p.bankName);
    if (!bankId) {
      unmatched.add(p.bankName);
      continue;
    }
    await prisma.bankProgram.update({ where: { id: p.id }, data: { bankId } });
    linked += 1;
  }
  if (unmatched.size > 0) {
    // Loud rather than silent: an unmatched name means the banks list and the
    // programs disagree, and the admin banks page will look inconsistent.
    console.warn(
      `[seed-banks] ${unmatched.size} program bankName(s) matched no Bank row: ${[...unmatched].join(', ')}`,
    );
  }
  return linked;
}

async function resolveSeedActor(): Promise<string | null> {
  const staff = await prisma.staffAccount.findFirst({
    where: { role: 'super_admin', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return staff?.id ?? null;
}

// Standalone run: `npx tsx prisma/seed-banks.ts`. Skipped when imported.
if (process.argv[1]?.includes('seed-banks')) {
  seedBanks()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
