/**
 * Seed — the program-name catalog's three axes (Constitution II / V):
 *
 *   1. `platform_enumeration_loan_category` — which loan categories each
 *      predefined program name may be OFFERED under.
 *   2. `platform_enumeration_question`      — which questions that name SUGGESTS
 *      scoring on, per loan category (advisory; pre-ticks step 1 of the
 *      per-bank-program scoring wizard and is read by nothing at runtime).
 *   3. `platform_enumeration_loan_category.payslip` / `.noPayslip` — the income
 *      BASIS of each offered pair. EXACTLY ONE of the two, always: the catalog
 *      states what a name is for, and a name marked both ways has stated nothing.
 *      A bank that disagrees says so on its own program, where it is enforced.
 *
 * The curated data lives in `data/program-catalog-matrix.ts`; this file only
 * applies it. Idempotent — both writes are "the listed set IS the set", so a
 * re-run converges rather than accumulating.
 *
 * Run:  npm run seed:catalog        (add --dry to print the plan and write nothing)
 *
 * Three guards, in order of how much damage they prevent:
 *
 *   - A category with LIVE BANK PROGRAMS is never removed. The API rejects
 *     creating a program under an unassigned pair, so unassigning one behind
 *     existing rows leaves programs that can be read and matched but never
 *     re-saved. The seed keeps the category, and says so.
 *   - A question outside the category's ASKED set is dropped from the write, not
 *     written-and-flagged. The service tolerates drift because an operator may
 *     have created it before a category assignment caught up; a seed has no such
 *     excuse — it would just be shipping the board a warning on day one.
 *   - An unknown program name or question code is reported and skipped, never
 *     created. This seed curates the catalog; it does not define it.
 *
 * No audit events are written. Every other seeder writes its rows directly too,
 * and a `PLATFORM_ENUMERATION_UPDATED` event attributed to a seed actor would
 * put a diff no operator made into the log an operator reaches for.
 */
import { PrismaClient, type LoanCategory } from '@prisma/client';

import {
  CATALOG_CATEGORY_ASSIGNMENTS,
  CATALOG_INCOME_BASIS,
  CATALOG_QUESTION_TEMPLATE,
  catalogIncomeBasis,
  type CatalogCategory,
  type CatalogIncomeBasis,
} from './data/program-catalog-matrix';

const prisma = new PrismaClient();

const PROGRAM_NAME_TYPE = 'program_name';
const CATEGORY_ORDER: readonly CatalogCategory[] = ['personal', 'car', 'mortgage', 'business'];

const sortCategories = (cats: readonly CatalogCategory[]): CatalogCategory[] =>
  [...new Set(cats)].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));

/** One basis → the two columns. Exactly one is true, which is the whole point. */
const flagsOf = (basis: CatalogIncomeBasis): { payslip: boolean; noPayslip: boolean } => ({
  payslip: basis === 'payslip',
  noPayslip: basis === 'no_payslip',
});

/**
 * What a pair reads as TODAY, for the change log. `both` and `neither` are the two
 * states this seed exists to clear, so they are named rather than rendered as a
 * pair of booleans the reader has to decode.
 */
const describeBasis = (flags: { payslip: boolean; noPayslip: boolean }): string => {
  if (flags.payslip && flags.noPayslip) return 'both';
  if (flags.payslip) return 'payslip';
  if (flags.noPayslip) return 'no_payslip';
  return 'neither';
};

export async function seedProgramCatalog(): Promise<void> {
  const dryRun = process.argv.includes('--dry');
  const notes: string[] = [];
  /** Categories axis 1 decided each matrix name is offered under — read by axis 3. */
  const planned = new Map<string, Set<CatalogCategory>>();

  // ---- What exists -------------------------------------------------------

  const names = await prisma.platformEnumeration.findMany({
    where: { type: PROGRAM_NAME_TYPE },
    select: {
      id: true,
      key: true,
      labelEn: true,
      loanCategories: { select: { category: true, payslip: true, noPayslip: true } },
    },
  });
  const nameByKey = new Map(names.map((n) => [n.key, n]));

  // Which (name, category) pairs already carry bank programs. Those categories
  // are load-bearing: see the guard note in the file header.
  const liveProgramRows = await prisma.bankProgram.groupBy({
    by: ['programNameKey', 'productCategory'],
    _count: { _all: true },
  });
  const liveCategoriesByKey = new Map<string, Set<CatalogCategory>>();
  for (const row of liveProgramRows) {
    if (!row.programNameKey) continue;
    const set = liveCategoriesByKey.get(row.programNameKey) ?? new Set<CatalogCategory>();
    set.add(row.productCategory as CatalogCategory);
    liveCategoriesByKey.set(row.programNameKey, set);
  }

  // The whole question pool with the categories that ASK each question — the
  // set the template is filtered against. Inactive questions are included so a
  // stale pick is reported as "left the pool" rather than as "unknown code".
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      code: true,
      isActive: true,
      loanCategories: { select: { category: true } },
    },
  });
  const questionByCode = new Map(questions.map((q) => [q.code, q]));

  // ---- Axis 1: category assignment ---------------------------------------

  let categoriesChanged = 0;

  for (const [key, desiredRaw] of Object.entries(CATALOG_CATEGORY_ASSIGNMENTS)) {
    const name = nameByKey.get(key);
    if (!name) {
      notes.push(`program_name '${key}' not in the catalog — skipped`);
      continue;
    }

    const desired = new Set(desiredRaw);
    for (const live of liveCategoriesByKey.get(key) ?? []) {
      if (desired.has(live)) continue;
      desired.add(live);
      const count = liveProgramRows.find(
        (r) => r.programNameKey === key && r.productCategory === live,
      )?._count._all;
      notes.push(
        `'${key}': kept '${live}' — ${count} bank program(s) already offer it (unassigning would make them unsaveable)`,
      );
    }

    const next = sortCategories([...desired]);
    // Recorded for every matrix key, changed or not — axis 3 asks "is this pair
    // offered?" and must get the answer this axis just decided, not the one the
    // opening snapshot happened to hold.
    planned.set(key, new Set(next));

    const before = sortCategories(name.loanCategories.map((c) => c.category as CatalogCategory));
    if (before.join(',') === next.join(',')) continue;

    categoriesChanged += 1;
    console.log(`  categories  ${key.padEnd(18)} ${before.join('+') || '—'}  →  ${next.join('+')}`);
    if (dryRun) continue;

    // Delete-then-insert, so the written set is exactly the intended set — the
    // same shape the repository uses, for the same reason.
    //
    // The surviving pair's basis is NOT carried across any more. It was, so that a
    // re-run could not un-sell a name an operator had marked no-payslip — but the
    // basis is now curated per pair (axis 3) and converged one loop below, so the
    // carry-across only decided which value survived for the length of this
    // transaction. Writing the curated basis here keeps a newly created pair
    // correct from birth instead of correct one write later.
    await prisma.$transaction([
      prisma.platformEnumerationLoanCategory.deleteMany({ where: { enumerationId: name.id } }),
      prisma.platformEnumerationLoanCategory.createMany({
        data: next.map((category) => ({
          enumerationId: name.id,
          category: category as LoanCategory,
          ...flagsOf(catalogIncomeBasis(key, category)),
        })),
        skipDuplicates: true,
      }),
    ]);
  }

  // ---- Axis 2: question template -----------------------------------------

  let templatesWritten = 0;
  let picksWritten = 0;

  for (const [key, byCategory] of Object.entries(CATALOG_QUESTION_TEMPLATE)) {
    const name = nameByKey.get(key);
    if (!name) continue; // already reported above

    for (const category of CATEGORY_ORDER) {
      const codes = byCategory[category];
      if (!codes) continue;

      const resolved: string[] = [];
      for (const code of [...new Set(codes)]) {
        const question = questionByCode.get(code);
        if (!question) {
          notes.push(`'${key}/${category}': unknown question code '${code}' — dropped`);
          continue;
        }
        if (!question.isActive) {
          notes.push(`'${key}/${category}': question '${code}' has left the pool — dropped`);
          continue;
        }
        if (!question.loanCategories.some((c) => c.category === category)) {
          notes.push(`'${key}/${category}': '${code}' is not asked under '${category}' — dropped`);
          continue;
        }
        resolved.push(question.id);
      }

      const before = await prisma.platformEnumerationQuestion.findMany({
        where: { enumerationId: name.id, category: category as LoanCategory },
        select: { questionId: true },
      });
      const beforeIds = new Set(before.map((r) => r.questionId));
      const unchanged =
        beforeIds.size === resolved.length && resolved.every((id) => beforeIds.has(id));
      if (unchanged) continue;

      templatesWritten += 1;
      picksWritten += resolved.length;
      console.log(
        `  questions   ${key.padEnd(18)} ${category.padEnd(9)} ${beforeIds.size} → ${resolved.length}`,
      );
      if (dryRun) continue;

      // Scoped to the category on BOTH halves: a delete over the whole name
      // would make writing the Personal set wipe the Business set.
      await prisma.$transaction([
        prisma.platformEnumerationQuestion.deleteMany({
          where: { enumerationId: name.id, category: category as LoanCategory },
        }),
        prisma.platformEnumerationQuestion.createMany({
          data: resolved.map((questionId) => ({
            enumerationId: name.id,
            category: category as LoanCategory,
            questionId,
          })),
          skipDuplicates: true,
        }),
      ]);
    }
  }

  // ---- Axis 3: income basis ------------------------------------------------
  //
  // "The listed basis IS the basis" — the same converging shape as axes 1 and 2,
  // and a change from the additive pass this replaces. That one only ever turned
  // `noPayslip` ON and never touched `payslip`, which left every fact-carrying
  // name marked BOTH ways: a catalog that says a name is for two things is a
  // catalog that has not said what it is for, and the admin screens now offer one
  // choice, so both is a value their controls cannot express or clear.
  //
  // It therefore OVERWRITES an operator's manual pick. That is deliberate and the
  // reason each change is logged with its direction: the seed is one operator's
  // curated pass, and a re-run is a request to apply it. Nothing downstream refuses
  // a save over this (v16.4.1) — the bank still states its own basis on its own
  // program — so the blast radius is the catalog's stated intent and nothing else.

  let basisWritten = 0;

  // Post-axis-1 state, re-read rather than reasoned off the opening snapshot: axis
  // 1 may have just created the pair this axis is about to converge. On a dry run
  // nothing was written, so the snapshot IS current and `planned` covers what axis
  // 1 would have added — a pair it plans to create is skipped here, because it
  // creates it with this basis already on it.
  const matrixNames = Object.keys(CATALOG_INCOME_BASIS)
    .map((key) => nameByKey.get(key))
    .filter((n): n is NonNullable<typeof n> => n !== undefined);
  const basisNow = new Map<string, { payslip: boolean; noPayslip: boolean }>();
  const pairKey = (id: string, category: CatalogCategory): string => `${id}:${category}`;
  if (dryRun) {
    for (const name of matrixNames) {
      for (const c of name.loanCategories) {
        basisNow.set(pairKey(name.id, c.category as CatalogCategory), {
          payslip: c.payslip,
          noPayslip: c.noPayslip,
        });
      }
    }
  } else {
    const rows = await prisma.platformEnumerationLoanCategory.findMany({
      where: { enumerationId: { in: matrixNames.map((n) => n.id) } },
      select: { enumerationId: true, category: true, payslip: true, noPayslip: true },
    });
    for (const r of rows) {
      basisNow.set(pairKey(r.enumerationId, r.category as CatalogCategory), {
        payslip: r.payslip,
        noPayslip: r.noPayslip,
      });
    }
  }

  for (const [key, byCategory] of Object.entries(CATALOG_INCOME_BASIS)) {
    const name = nameByKey.get(key);
    if (!name) continue; // already reported by axis 1

    for (const category of CATEGORY_ORDER) {
      const basis = byCategory[category];
      if (!basis) continue;
      if (!planned.get(key)?.has(category)) {
        notes.push(`'${key}/${category}': not offered under this loan type — basis not set`);
        continue;
      }
      const want = { payslip: basis === 'payslip', noPayslip: basis === 'no_payslip' };
      const current = basisNow.get(pairKey(name.id, category));
      // Absent on a dry run only: axis 1 plans to create it, already correct.
      if (!current) continue;
      if (current.payslip === want.payslip && current.noPayslip === want.noPayslip) continue;

      basisWritten += 1;
      console.log(
        `  basis       ${key.padEnd(18)} ${category.padEnd(9)} ${describeBasis(current)} → ${basis}`,
      );
      if (dryRun) continue;

      await prisma.platformEnumerationLoanCategory.update({
        where: {
          pk_platform_enumeration_loan_category: {
            enumerationId: name.id,
            category: category as LoanCategory,
          },
        },
        data: want,
      });
    }
  }

  // ---- Report -------------------------------------------------------------

  console.log(
    `[seed-program-catalog]${dryRun ? ' (dry run)' : ''} ` +
      `${categoriesChanged} category set(s) changed · ` +
      `${templatesWritten} template(s) written (${picksWritten} picks) · ` +
      `${basisWritten} income basis/bases corrected`,
  );
  const untouched = names.filter((n) => !(n.key in CATALOG_CATEGORY_ASSIGNMENTS));
  if (untouched.length > 0) {
    console.log(
      `[seed-program-catalog] left untouched (not in the matrix): ${untouched
        .map((n) => n.key)
        .join(', ')}`,
    );
  }
  if (notes.length > 0) {
    console.warn(`[seed-program-catalog] ${notes.length} note(s):`);
    for (const n of notes) console.warn(`  - ${n}`);
  }
}

if (require.main === module) {
  seedProgramCatalog()
    .catch((error) => {
      console.error('[seed-program-catalog] failed', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
