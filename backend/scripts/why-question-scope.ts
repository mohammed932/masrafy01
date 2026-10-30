/**
 * WHY is each question served for a (category, programNameKey)?
 *
 *   npx tsx scripts/why-question-scope.ts <category> <programNameKey>
 *
 * Read-only diagnostic. Classifies every kept question by the clause of `narrowAskedQuestions`
 * that keeps it — fixed, the money core, read by a programme, ticked, or a gate source.
 */
import { PrismaClient } from '@prisma/client';
import type { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '../src/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { fixedCodesServed, frozenFixedServedOn } from '../src/questionnaire/validation/fixed-questions';
import {
  ASKED_EVEN_WHEN_PRODUCT_ONLY,
  narrowAskedQuestions,
  NEVER_PRODUCT_SCOPED_QUESTION_CODES,
} from '../src/questionnaire/validation/question-scope';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [category, nameKey] = process.argv.slice(2) as [LoanCategory, string];
  const repo = new PostgresPlatformEnumerationsRepository(prisma as unknown as PrismaService);

  const version = await prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    orderBy: { versionNumber: 'desc' },
  });
  if (!version) throw new Error('no active questionnaire version');
  const snap = version.snapshot as {
    groups: { questions: { code: string; enabledWhen?: unknown; fixedServedOn?: unknown }[] }[];
  };
  // Every question the snapshot holds: a question carries no loan type since v32.0.0.
  const all = snap.groups.flatMap((g) => g.questions);

  const scope = await repo.narrowingScopeFor(nameKey, category);
  if (!scope) throw new Error(`no program scope for ${nameKey}`);

  const d = narrowAskedQuestions(
    all.map((q) => ({
      code: q.code,
      enabledWhen: q.enabledWhen ?? null,
      fixedServedOn: frozenFixedServedOn(q, category),
    })),
    scope,
  );
  const fixed = fixedCodesServed(
    all.map((q) => ({ code: q.code, fixedServedOn: frozenFixedServedOn(q, category) })),
    scope,
  );

  const needed = new Set(scope.neededQuestionCodes);
  const mustAnswer = new Set(scope.mustAnswerQuestionCodes ?? []);
  const retained = new Set(d.gateSourcesRetained);
  const added = new Set(scope.addedQuestionCodes ?? []);

  const reason = (code: string): string => {
    if (fixed.has(code)) {
      return 'FIXED: the admin marked it fixed, asked on every program whatever reads it';
    }
    if (scope.productOnly === true && ASKED_EVEN_WHEN_PRODUCT_ONLY.has(code)) {
      return 'CORE (product-only name): debts or duration';
    }
    if (scope.productOnly !== true && NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(code)) {
      return 'CORE: money/obligation code';
    }
    if (needed.has(code)) return 'NEEDED: a programme here (or its product) reads it';
    if (mustAnswer.has(code)) return 'NEEDED: a programme here refuses without the answer';
    if (added.has(code)) return 'TICKED: the operator ticked it for this program';
    if (retained.has(code)) return 'GATE SOURCE: kept so a surviving gate stays evaluable';
    return '??';
  };

  const buckets = new Map<string, string[]>();
  for (const q of all) {
    if (!d.keep.has(q.code)) continue;
    const r = reason(q.code);
    (buckets.get(r) ?? buckets.set(r, []).get(r)!).push(q.code);
  }

  console.log(`\n${category} / ${nameKey}`);
  console.log(`  pool ${all.length}  ->  served ${d.keep.size}  (dropped ${d.dropped.length})\n`);
  for (const [r, codes] of [...buckets].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(codes.length).padStart(3)}  ${r}`);
    for (const c of codes.sort()) console.log(`         ${c}`);
  }
  console.log(`\n  dropped (${d.dropped.length}): ${[...d.dropped].sort().join(', ')}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
