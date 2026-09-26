/**
 * WHY is each question served for a (category, programNameKey)?
 *
 * Read-only diagnostic. Classifies every kept question by the clause of
 * `narrowAskedQuestions`' `isCore` that keeps it, so it is visible which ones a product's
 * ask board could actually subtract and which are structural.
 */
import { PrismaClient } from '@prisma/client';
import type { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '../src/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
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
    groups: {
      questions: {
        code: string;
        enabledWhen?: unknown;
        categories?: string[];
        optInCategories?: string[];
      }[];
    }[];
  };
  const all = snap.groups.flatMap((g) => g.questions);
  const isOptIn = (q: { optInCategories?: string[] }): boolean =>
    q.optInCategories?.includes(category) === true;
  // The service's own rule (`askedFor` / `optInFor`): no `categories` array = a pre-v12
  // snapshot, asked everywhere; an EMPTY array = parked, asked by nobody; an OPT-IN row is in
  // the category for the names that add it.
  const inCategory = all.filter(
    (q) => !Array.isArray(q.categories) || q.categories.includes(category) || isOptIn(q),
  );

  const scope = await repo.narrowingScopeFor(nameKey, category);
  if (!scope) throw new Error(`no narrowing scope for ${nameKey}`);

  const d = narrowAskedQuestions(
    inCategory.map((q) => ({ code: q.code, enabledWhen: q.enabledWhen ?? null, optIn: isOptIn(q) })),
    scope,
  );

  const factBound = new Set(scope.factBoundQuestionCodes);
  const askScoped = new Set(scope.askScopedQuestionCodes);
  const platform = new Set(scope.platformQuestionCodes);
  const needed = new Set(scope.neededQuestionCodes);
  const retained = new Set(d.gateSourcesRetained);
  const added = new Set(scope.addedQuestionCodes ?? []);
  const optIn = new Set(inCategory.filter(isOptIn).map((q) => q.code));

  const reason = (code: string): string => {
    // An OPT-IN row is never core: it is kept only because this name added it, a programme
    // reads it, or a kept question branches off it.
    if (optIn.has(code)) {
      if (needed.has(code)) return 'NEEDED (opt-in row): a programme under this name reads it';
      if (added.has(code)) return 'ADDED (opt-in row): the operator ticked it for this name';
      if (retained.has(code)) return 'GATE SOURCE (opt-in row): a kept question branches off it';
      return '??';
    }
    if (added.has(code) && !needed.has(code)) {
      return 'ADDED: the operator ticked it for this name';
    }
    if (scope.productOnly === true) {
      if (ASKED_EVEN_WHEN_PRODUCT_ONLY.has(code))
        return 'CORE (product-only name): debts, duration or employment type';
      if (needed.has(code))
        return 'NEEDED (product-only name): the product or a programme reads it';
      if (retained.has(code)) return 'GATE SOURCE: kept so a surviving gate stays evaluable';
      return '??';
    }
    if (NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(code)) return 'CORE: money/obligation code';
    if (!factBound.has(code)) return 'CORE: bound to no fact';
    if (platform.has(code)) return 'CORE: platform-owned fact (reserved)';
    if (!askScoped.has(code)) return 'CORE: no product anywhere asks its fact';
    if (needed.has(code)) return 'NEEDED: a programme under this name reads it';
    if (retained.has(code)) return 'GATE SOURCE: kept so a surviving gate stays evaluable';
    return '??';
  };

  const buckets = new Map<string, string[]>();
  for (const q of inCategory) {
    if (!d.keep.has(q.code)) continue;
    const r = reason(q.code);
    (buckets.get(r) ?? buckets.set(r, []).get(r)!).push(q.code);
  }

  console.log(`\n${category} / ${nameKey}`);
  console.log(
    `  category pool ${inCategory.length}  ->  served ${d.keep.size}  (dropped ${d.dropped.length})\n`,
  );
  for (const [r, codes] of [...buckets].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(codes.length).padStart(3)}  ${r}`);
    for (const c of codes.sort()) console.log(`         ${c}`);
  }
  console.log(`\n  dropped (${d.dropped.length}): ${d.dropped.sort().join(', ')}`);
  const optInDropped = d.dropped.filter((code) => optIn.has(code));
  if (optInDropped.length > 0) {
    console.log(`  of which opt-in, not added here: ${optInDropped.sort().join(', ')}`);
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
