/**
 * Does every program still get asked what it reads?
 *
 * The program-name axis (`questionnaire/validation/question-scope.ts`) narrows the questions an
 * applicant answers to the ones a program behind the name they picked can be quoted from. This
 * is the standing proof that the narrowing never hides an answer a live program needs — and the
 * one place the class of failure it guards against is even visible, because a cap table that
 * misses its fact does not report anything: `onNoMatch: 'useProgramMax'` quietly quotes the
 * program's own maximum instead of the bank's row.
 *
 *   npx tsx scripts/check-question-scope.ts            (npm run check:question-scope)
 *   npx tsx scripts/check-question-scope.ts --report   + the served/required table
 *
 * It IMPORTS the rule rather than restating it, so the gate moves when the rule moves. What it
 * derives independently is the REQUIREMENT — the facts each program reads — and then asserts
 * the served set contains a question for every one of them. Deriving both sides the same way
 * would prove nothing.
 *
 * Read-only. Exit 0 when clean, 1 when anything is reported, so it can gate a deploy.
 */
import { PrismaClient } from '@prisma/client';
import type { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '../src/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import {
  catalogRuleOf,
  effectiveIncomeRule,
  effectiveProgramNameRule,
  type LinkedProduct,
} from '../src/matching/pipeline/income-rule-inherit';
import {
  factsReadByIncomeRule,
  factsReadByLoanLimits,
} from '../src/matching/pipeline/fact-readers';
import { bankAxisByFactKey } from '../src/matching/pipeline/bank-relationship';
import { narrowAskedQuestions } from '../src/questionnaire/validation/question-scope';
import type { IncomeAssumptionConfig } from '../src/matching/types';

interface Finding {
  kind: 'HIDDEN' | 'PARKED' | 'UNASSIGNED' | 'UNBOUND' | 'ASK_MISSING';
  name: string;
  category: string;
  factKey: string;
  detail: string;
  /** A cap-table reader is the silent one: it falls through to the program maximum. */
  silent: boolean;
}

const asRule = (v: unknown): IncomeAssumptionConfig | undefined =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as IncomeAssumptionConfig)
    : undefined;

async function main(): Promise<void> {
  const report = process.argv.includes('--report');
  const prisma = new PrismaClient();
  const repo = new PostgresPlatformEnumerationsRepository(prisma as unknown as PrismaService);
  const findings: Finding[] = [];
  const rows: string[] = [];

  try {
    const [names, products, facts, questions, programs] = await Promise.all([
      prisma.platformEnumeration.findMany({
        where: { type: 'program_name', active: true, deprecatedAt: null },
        select: {
          key: true,
          incomeRule: true,
          surrogateProductKey: true,
          loanCategories: { select: { category: true } },
        },
        orderBy: { key: 'asc' },
      }),
      prisma.platformEnumeration.findMany({
        where: { type: 'surrogate_product' },
        select: { key: true, active: true, deprecatedAt: true, incomeRule: true },
      }),
      prisma.platformEnumeration.findMany({
        where: { type: 'surrogate_fact' },
        select: {
          key: true,
          boundQuestion: { select: { code: true, isActive: true } },
          askedByProducts: {
            where: { detachedAt: null },
            select: { product: { select: { key: true } } },
          },
        },
      }),
      prisma.question.findMany({
        where: { isActive: true },
        select: {
          code: true,
          isRequired: true,
          enabledWhen: true,
          loanCategories: { select: { category: true } },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.bankProgram.findMany({
        where: { active: true },
        select: {
          programCode: true,
          programNameKey: true,
          productCategory: true,
          incomeAssumption: true,
          loanLimits: true,
        },
      }),
    ]);

    const productByKey = new Map(products.map((p) => [p.key, p]));
    const factByKey = new Map(facts.map((f) => [f.key, f]));

    for (const name of names) {
      const underName = programs.filter((p) => p.programNameKey === name.key);
      if (underName.length === 0) continue; // narrowing is off for a name nothing is sold under

      const productRow =
        name.surrogateProductKey === null
          ? undefined
          : productByKey.get(name.surrogateProductKey);
      const linked: LinkedProduct | undefined =
        productRow === undefined
          ? undefined
          : {
              key: productRow.key,
              active: productRow.active,
              deprecatedAt: productRow.deprecatedAt,
              rule: asRule(productRow.incomeRule),
            };
      const catalogRule = catalogRuleOf(
        effectiveProgramNameRule(asRule(name.incomeRule), linked),
      );

      const scope = await repo.narrowingScopeFor(name.key);

      for (const category of name.loanCategories.map((c) => c.category)) {
        // Per CATEGORY, not per name. A mortgage applicant who picks this name is quoted by
        // its mortgage programs alone, so a fact only its personal programs read is not one
        // they need — reporting it would send an operator to widen a question for nobody.
        const mine = underName.filter((p) => p.productCategory === category);
        if (mine.length === 0) continue;

        // The REQUIREMENT, derived here and NOT from the production scope read: which facts do
        // these programs consume, and did each arrive from the loud side or the silent one. A
        // fact reached only through a cap table is the dangerous kind — `onNoMatch` swallows a
        // miss — so it is tracked apart rather than lumped in.
        const loud = new Set<string>();
        const viaCap = new Set<string>();
        for (const program of mine) {
          const effective = effectiveIncomeRule(
            (program.incomeAssumption ?? {}) as unknown as IncomeAssumptionConfig,
            catalogRule,
          );
          for (const key of factsReadByIncomeRule(effective)) loud.add(key);
          for (const key of factsReadByLoanLimits(program.loanLimits)) viaCap.add(key);
        }
        const needed = new Set<string>([...loud, ...viaCap]);
        const silentOnly = new Set([...viaCap].filter((key) => !loud.has(key)));

        const inCategory = questions.filter((q) =>
          q.loanCategories.some((c) => c.category === category),
        );
        const decision = narrowAskedQuestions(inCategory, scope);
        const served = decision.narrowed
          ? new Set(decision.keep)
          : new Set(inCategory.map((q) => q.code));

        for (const factKey of needed) {
          const fact = factByKey.get(factKey);
          const axis = bankAxisByFactKey(factKey);
          const silent = silentOnly.has(factKey);
          if (fact === undefined && axis === undefined) {
            findings.push({
              kind: 'UNBOUND',
              name: name.key,
              category,
              factKey,
              detail: 'no registry row and no derived axis',
              silent,
            });
            continue;
          }
          const code = fact?.boundQuestion?.code ?? axis?.questionCode;
          if (code === undefined) {
            findings.push({
              kind: 'UNBOUND',
              name: name.key,
              category,
              factKey,
              detail: 'the fact is bound to no question',
              silent,
            });
            continue;
          }
          if (fact?.boundQuestion !== null && fact?.boundQuestion?.isActive === false) {
            findings.push({
              kind: 'PARKED',
              name: name.key,
              category,
              factKey,
              detail: `${code} is switched off`,
              silent,
            });
            continue;
          }
          if (!inCategory.some((q) => q.code === code)) {
            findings.push({
              kind: 'UNASSIGNED',
              name: name.key,
              category,
              factKey,
              detail: `${code} is not asked in ${category}`,
              silent,
            });
            continue;
          }
          if (!served.has(code)) {
            // The invariant. Zero by construction — if this fires the rule is broken.
            findings.push({
              kind: 'HIDDEN',
              name: name.key,
              category,
              factKey,
              detail: `${code} is asked in ${category} but the narrowing drops it`,
              silent,
            });
            continue;
          }
          // Only when the fact is one SOME product declares. A fact nobody asks is the
          // platform's own (the bureau score) or a per-bank policy (the additional-income
          // sources), and neither is a board omission — sending an operator to tick it would
          // file a platform fact under one product.
          if (
            name.surrogateProductKey !== null &&
            fact !== undefined &&
            fact.askedByProducts.length > 0 &&
            !fact.askedByProducts.some((a) => a.product.key === name.surrogateProductKey)
          ) {
            findings.push({
              kind: 'ASK_MISSING',
              name: name.key,
              category,
              factKey,
              detail: `read by a program but not ticked on ${name.surrogateProductKey}`,
              silent,
            });
          }
        }

        if (report) {
          const requiredAfter = [...served].filter((code) => {
            const q = inCategory.find((x) => x.code === code);
            return q?.isRequired === true || decision.extraRequired.has(code);
          }).length;
          rows.push(
            [
              name.key.padEnd(26),
              category.padEnd(9),
              String(inCategory.length).padStart(3),
              String(served.size).padStart(4),
              String(inCategory.filter((q) => q.isRequired).length).padStart(4),
              String(requiredAfter).padStart(4),
              decision.disabledReason ?? '',
            ].join(' '),
          );
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  const out: string[] = ['', '[check:question-scope]', ''];
  if (report) {
    out.push(
      `  ${'name'.padEnd(26)} ${'category'.padEnd(9)} q-> served req-> after  off`,
      ...rows.map((r) => `  ${r}`),
      '',
    );
  }
  if (findings.length === 0) {
    out.push('  every fact a live program reads is asked of the applicants it quotes', '');
    console.log(out.join('\n'));
    return;
  }
  for (const kind of ['HIDDEN', 'PARKED', 'UNASSIGNED', 'UNBOUND', 'ASK_MISSING'] as const) {
    const group = findings.filter((f) => f.kind === kind);
    if (group.length === 0) continue;
    out.push(`  ${kind} (${group.length})`);
    for (const f of group) {
      out.push(
        `    ${f.name} / ${f.category} — ${f.factKey}: ${f.detail}${f.silent ? '  [SILENT: a cap table, so it falls through to the program maximum]' : ''}`,
      );
    }
    out.push('');
  }
  console.log(out.join('\n'));
  process.exitCode = 1;
}

void main();
