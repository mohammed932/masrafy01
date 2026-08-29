/**
 * Delete every no-payslip product whose calculation was built by hand.
 *
 * ─── Why this exists ──────────────────────────────────────────────────────────
 *
 * The friendly form is now the way a no-payslip product is authored, and the decision taken
 * with it was that nothing hand-built survives: a product with no stored form is one nobody
 * can open, edit or explain, and leaving a few around means the screens have to keep
 * describing a state the platform no longer creates.
 *
 * It also finishes a job that was left half done. Migration `20260827090000` retires the
 * compound demo's two list KINDS and hands the rest of the cleanup to
 * `seed-collateral-products.ts#pruneRetiredDemoProducts` — a file deleted in `ad6d6d0`
 * before it ever ran. So every seeded database still holds that demo in full.
 *
 * ─── Why a SCRIPT and not a migration ─────────────────────────────────────────
 *
 * A migration runs on every deploy, in every environment, without anybody present. This
 * destroys bank programs and customer answers. It is a decision taken once, deliberately,
 * by somebody who has read what it is about to destroy — so it prints the whole blast radius
 * and does nothing until told twice.
 *
 *   npx tsx scripts/purge-handbuilt-surrogate-products.ts            report only
 *   npx tsx scripts/purge-handbuilt-surrogate-products.ts --confirm  delete
 *   ... --confirm --force                                            delete, answers included
 *
 * `--force` is separate because `application_answer.questionId` is `ON DELETE RESTRICT`:
 * without it the delete would simply fail, and the operator would be told about a foreign
 * key instead of about the customers whose answers are in the way.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Doomed {
  key: string;
  labelEn: string;
  active: boolean;
  strategy: string | null;
  names: string[];
  programCodes: string[];
  factKeys: string[];
  questionCodes: string[];
  questionIds: string[];
  listTypes: string[];
  listValueCount: number;
  answerCount: number;
}

async function collect(): Promise<Doomed[]> {
  // A product is hand-built exactly when it has no stored form. A product with NO rule at
  // all is swept too: it is an empty row nobody can finish through the form either, because
  // the form writes a template and this one has none.
  const products = await prisma.platformEnumeration.findMany({
    where: { type: 'surrogate_product', templateSpec: { equals: Prisma.DbNull } },
    orderBy: { key: 'asc' },
    select: { key: true, labelEn: true, active: true, incomeRule: true },
  });

  const out: Doomed[] = [];
  for (const product of products) {
    const names = await prisma.platformEnumeration.findMany({
      where: { type: 'program_name', surrogateProductKey: product.key },
      select: { key: true },
      orderBy: { key: 'asc' },
    });
    const nameKeys = names.map((n) => n.key);

    const programs =
      nameKeys.length === 0
        ? []
        : await prisma.bankProgram.findMany({
            where: { programNameKey: { in: nameKeys } },
            select: { programCode: true },
            orderBy: { programCode: 'asc' },
          });

    // What this product AUTHORED: its facts, the questions behind them, and the lists those
    // questions pick from.
    const facts = await prisma.platformEnumeration.findMany({
      where: { type: 'surrogate_fact', surrogateProductKey: product.key },
      select: { key: true, boundQuestion: { select: { id: true, code: true } } },
      orderBy: { key: 'asc' },
    });
    const questionIds = facts.flatMap((f) => (f.boundQuestion ? [f.boundQuestion.id] : []));

    const lists = await prisma.enumerationTypeDef.findMany({
      where: { surrogateProductKey: product.key },
      select: { key: true },
      orderBy: { key: 'asc' },
    });
    const listTypes = lists.map((l) => l.key);
    const listValueCount =
      listTypes.length === 0
        ? 0
        : await prisma.platformEnumeration.count({ where: { type: { in: listTypes } } });

    const answerCount =
      questionIds.length === 0
        ? 0
        : await prisma.applicationAnswer.count({ where: { questionId: { in: questionIds } } });

    out.push({
      key: product.key,
      labelEn: product.labelEn,
      active: product.active,
      strategy: (product.incomeRule as { strategy?: string } | null)?.strategy ?? null,
      names: nameKeys,
      programCodes: programs.map((p) => p.programCode),
      factKeys: facts.map((f) => f.key),
      questionCodes: facts.flatMap((f) => (f.boundQuestion ? [f.boundQuestion.code] : [])),
      questionIds,
      listTypes,
      listValueCount,
      answerCount,
    });
  }
  return out;
}

function report(doomed: Doomed[]): void {
  console.log('');
  console.log('These no-payslip products have no saved form, so they would be DELETED:');
  console.log('');
  for (const d of doomed) {
    console.log(`  ${d.key}  —  ${d.labelEn}${d.active ? '' : '  (already retired)'}`);
    console.log(`      calculation      ${d.strategy ?? 'none stated'}`);
    console.log(`      catalog names    ${d.names.length ? d.names.join(', ') : '—'}`);
    console.log(`      bank programs    ${d.programCodes.length ? d.programCodes.join(', ') : '—'}`);
    console.log(`      questions        ${d.questionCodes.length ? d.questionCodes.join(', ') : '—'}`);
    console.log(`      income facts     ${d.factKeys.length ? d.factKeys.join(', ') : '—'}`);
    console.log(
      `      answer lists     ${d.listTypes.length ? `${d.listTypes.join(', ')} (${d.listValueCount} value(s))` : '—'}`,
    );
    console.log(`      customer answers ${d.answerCount}`);
    console.log('');
  }

  const totals = doomed.reduce(
    (acc, d) => ({
      programs: acc.programs + d.programCodes.length,
      questions: acc.questions + d.questionCodes.length,
      answers: acc.answers + d.answerCount,
    }),
    { programs: 0, questions: 0, answers: 0 },
  );
  console.log(
    `TOTAL: ${doomed.length} product(s), ${totals.programs} bank program(s), ` +
      `${totals.questions} question(s), ${totals.answers} customer answer(s).`,
  );
}

/**
 * FK order, and every step of it is forced by a constraint rather than chosen:
 *
 *   answers        `application_answer.questionId` is RESTRICT — nothing else moves first
 *   options        `question_option` hangs off the question
 *   assignments    `question_loan_category` likewise
 *   the fact       cleared off the question before the question goes, so the SetNull FK
 *                  does not leave a fact bound to nothing for the length of the transaction
 *   questions      now unreferenced
 *   lists          values before the KIND, or the kind is a row no screen can reach
 *   programs       plain string link, so they are deleted rather than cascaded
 *   names          unlinked, NOT deleted — a catalog name is a product the bank still sells
 *   the product    last
 */
async function purge(doomed: Doomed[], force: boolean): Promise<void> {
  for (const d of doomed) {
    await prisma.$transaction(async (tx) => {
      if (d.questionIds.length > 0) {
        if (d.answerCount > 0 && force) {
          await tx.applicationAnswer.deleteMany({ where: { questionId: { in: d.questionIds } } });
        }
        await tx.questionOption.deleteMany({ where: { questionId: { in: d.questionIds } } });
        await tx.questionLoanCategory.deleteMany({ where: { questionId: { in: d.questionIds } } });
        await tx.platformEnumeration.updateMany({
          where: { boundQuestionId: { in: d.questionIds } },
          data: { boundQuestionId: null },
        });
        await tx.enumerationTypeDef.updateMany({
          where: { mirrorQuestionId: { in: d.questionIds } },
          data: { mirrorQuestionId: null },
        });
        await tx.question.deleteMany({ where: { id: { in: d.questionIds } } });
      }

      await tx.platformEnumeration.deleteMany({
        where: { type: 'surrogate_fact', surrogateProductKey: d.key },
      });

      if (d.listTypes.length > 0) {
        await tx.platformEnumeration.deleteMany({ where: { type: { in: d.listTypes } } });
        await tx.enumerationTypeDef.deleteMany({ where: { key: { in: d.listTypes } } });
      }

      if (d.programCodes.length > 0) {
        await tx.bankProgram.deleteMany({ where: { programCode: { in: d.programCodes } } });
      }
      if (d.names.length > 0) {
        await tx.platformEnumeration.updateMany({
          where: { type: 'program_name', key: { in: d.names } },
          data: { surrogateProductKey: null },
        });
      }

      await tx.platformEnumeration.deleteMany({
        where: { type: 'surrogate_product', key: d.key },
      });
    });
    console.log(`  deleted ${d.key}`);
  }
}

async function main(): Promise<void> {
  const confirm = process.argv.includes('--confirm');
  const force = process.argv.includes('--force');

  const doomed = await collect();
  if (doomed.length === 0) {
    console.log('Nothing to do — every no-payslip product has a saved form.');
    return;
  }

  report(doomed);

  if (!confirm) {
    console.log('');
    console.log('Nothing was changed. Re-run with --confirm to delete all of the above.');
    return;
  }

  const withAnswers = doomed.filter((d) => d.answerCount > 0);
  if (withAnswers.length > 0 && !force) {
    console.error('');
    console.error(
      `REFUSED: ${withAnswers.length} product(s) have questions real customers have already answered ` +
        `(${withAnswers.map((d) => `${d.key}: ${d.answerCount}`).join(', ')}).`,
    );
    console.error(
      'Those answers are part of applications that were already submitted. Deleting them ' +
        'rewrites what those customers told us. Re-run with --force only if that is what you mean.',
    );
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('Deleting…');
  await purge(doomed, force);
  console.log('');
  console.log('Done. Every remaining no-payslip product was authored through the form.');
  console.log('Run `npm run seed:questionnaire` to publish a snapshot without the deleted questions.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
