/**
 * The questionnaire's structural invariants, checked against the live database.
 *
 * Read-only. Exit 0 when every invariant holds, 1 otherwise, so it can gate a deploy.
 *
 *   npx tsx scripts/check-questionnaire-integrity.ts
 *
 * WHY IT EXISTS. On 2026-09-24 a review found questions asked where nothing read them and,
 * worse, questions NOT asked where the engine needed them — car and ten no-payslip names
 * counting existing debts as zero, a 120-month cap on 240-month mortgages. Every check that
 * existed passed throughout, because each looked at one loan type as a whole, or at income and
 * cap facts only. Seven different writers set which loan type asks a question (the seed,
 * blueprints, the admin screen, product asks, scripts, migrations), so the drift will come back
 * unless something looks for it. This is that something. Each invariant below names the
 * failure it would have caught.
 *
 *   1. DEBTS CLOSED — a loan type that asks "which loans do you have" (`current_loans`) asks the
 *      amount behind EVERY pick. Car asked 2 of 5, so a car loan, mortgage or card counted as 0.
 *   2. DEBTS SERVED PER NAME — under every offerable program name, the served questionnaire keeps
 *      the debt questions and the loan duration. Ten no-payslip names dropped all of them.
 *   3. GATE SOURCE ASKED — a question is never assigned where the question gating it is not: a
 *      gate that is not there never hides its target, so the child shows to everybody.
 *   4. ACTIVE ⇔ ASSIGNED — an active question is asked by at least one loan type, an inactive one
 *      by none.
 *   5. SNAPSHOT = LIVE — the published questionnaire's per-question loan types equal the live
 *      join table. A migration that changes assignments and forgets to publish shows up here.
 *   6. NO DEAD CONDITION — a product condition whose allow-list accepts every answer refuses
 *      nobody, and still forces the question on every applicant. The car product had four.
 *   7. FACT ⇒ QUESTION — an active fact is bound to an active question.
 */
import { PrismaClient } from '@prisma/client';
import type { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '../src/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import { narrowAskedQuestions } from '../src/questionnaire/validation/question-scope';
import {
  DEBT_TYPES_QUESTION_CODE,
  MONEY_FIELD_BINDINGS,
  OBLIGATION_ITEM_QUESTION_CODES,
} from '../src/matching/pipeline/money-field-bindings';

const prisma = new PrismaClient();

interface Violation {
  invariant: string;
  detail: string;
}

interface SnapshotQuestion {
  code: string;
  enabledWhen?: unknown;
  categories?: string[];
}

function gateSourceOf(enabledWhen: unknown): string | null {
  if (enabledWhen === null || typeof enabledWhen !== 'object') return null;
  const code = (enabledWhen as { questionCode?: unknown }).questionCode;
  return typeof code === 'string' ? code : null;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  const add = (invariant: string, detail: string): void => {
    violations.push({ invariant, detail });
  };

  const questions = await prisma.question.findMany({
    select: {
      id: true,
      code: true,
      isActive: true,
      enabledWhen: true,
      options: { select: { code: true } },
    },
  });
  const assignments = await prisma.questionLoanCategory.findMany({
    select: { questionId: true, category: true },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const categoriesOf = new Map<string, Set<LoanCategory>>();
  for (const q of questions) categoriesOf.set(q.code, new Set());
  for (const a of assignments) {
    const q = byId.get(a.questionId);
    if (q) categoriesOf.get(q.code)!.add(a.category);
  }

  // 1. DEBTS CLOSED
  for (const category of categoriesOf.get(DEBT_TYPES_QUESTION_CODE) ?? []) {
    for (const item of OBLIGATION_ITEM_QUESTION_CODES) {
      if (!categoriesOf.get(item)?.has(category)) {
        add('1 debts closed', `${category}: asks ${DEBT_TYPES_QUESTION_CODE} but not ${item}`);
      }
    }
  }

  // 3. GATE SOURCE ASKED
  const byCode = new Map(questions.map((q) => [q.code, q]));
  for (const q of questions) {
    const source = gateSourceOf(q.enabledWhen);
    if (source === null || !byCode.has(source)) continue;
    for (const category of categoriesOf.get(q.code) ?? []) {
      if (!categoriesOf.get(source)?.has(category)) {
        add('3 gate source asked', `${category}: ${q.code} is gated on ${source}, not asked there`);
      }
    }
  }

  // 4. ACTIVE ⇔ ASSIGNED
  for (const q of questions) {
    const n = categoriesOf.get(q.code)?.size ?? 0;
    if (q.isActive && n === 0) add('4 active ⇔ assigned', `${q.code}: active, asked by no loan type`);
    if (!q.isActive && n > 0) add('4 active ⇔ assigned', `${q.code}: inactive, still assigned`);
  }

  // 5. SNAPSHOT = LIVE
  const version = await prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    orderBy: { versionNumber: 'desc' },
  });
  const snapshotQuestions: SnapshotQuestion[] = version
    ? (version.snapshot as { groups: { questions: SnapshotQuestion[] }[] }).groups.flatMap(
        (g) => g.questions,
      )
    : [];
  if (version === null) add('5 snapshot = live', 'no active questionnaire version');
  const inSnapshot = new Set<string>();
  for (const sq of snapshotQuestions) {
    inSnapshot.add(sq.code);
    const live = [...(categoriesOf.get(sq.code) ?? [])].sort().join(',');
    const frozen = Array.isArray(sq.categories) ? [...sq.categories].sort().join(',') : '(all)';
    if (live !== frozen) {
      add('5 snapshot = live', `${sq.code}: published [${frozen}], live [${live}] — publish`);
    }
  }
  for (const q of questions) {
    if ((categoriesOf.get(q.code)?.size ?? 0) > 0 && !inSnapshot.has(q.code)) {
      add('5 snapshot = live', `${q.code}: assigned live, missing from the published version`);
    }
  }

  // 2. DEBTS SERVED PER NAME
  const repo = new PostgresPlatformEnumerationsRepository(prisma as unknown as PrismaService);
  const offered = await prisma.bankProgram.groupBy({
    by: ['programNameKey', 'productCategory'],
    where: { active: true, programNameKey: { not: null } },
  });
  const mustServe = [
    DEBT_TYPES_QUESTION_CODE,
    ...OBLIGATION_ITEM_QUESTION_CODES,
    MONEY_FIELD_BINDINGS.tenor_months,
  ];
  for (const { programNameKey, productCategory } of offered) {
    if (programNameKey === null) continue;
    const inCategory = snapshotQuestions.filter(
      (q) => !Array.isArray(q.categories) || q.categories.includes(productCategory),
    );
    const scope = await repo.narrowingScopeFor(programNameKey);
    const decision = narrowAskedQuestions(
      inCategory.map((q) => ({ code: q.code, enabledWhen: q.enabledWhen ?? null })),
      scope,
    );
    const served = decision.narrowed ? decision.keep : new Set(inCategory.map((q) => q.code));
    for (const code of mustServe) {
      const assigned = inCategory.some((q) => q.code === code);
      if (assigned && !served.has(code)) {
        add('2 debts served per name', `${productCategory}/${programNameKey}: ${code} not served`);
      }
    }
  }

  // 6. NO DEAD CONDITION
  const facts = await prisma.platformEnumeration.findMany({
    where: { type: 'surrogate_fact' },
    select: { key: true, active: true, boundQuestionId: true },
  });
  const factQuestion = new Map(facts.map((f) => [f.key, f.boundQuestionId]));
  const products = await prisma.platformEnumeration.findMany({
    where: { type: 'surrogate_product', active: true },
    select: { key: true, templateSpec: true },
  });
  for (const product of products) {
    const conditions =
      (product.templateSpec as { conditions?: unknown[] } | null)?.conditions ?? [];
    for (const raw of conditions) {
      const c = raw as {
        id?: string;
        measure?: { of?: string; fact?: string };
        test?: { op?: string; expect?: unknown[] };
      };
      if (c.test?.op !== 'oneOf' || c.measure?.of !== 'fact' || c.measure.fact === undefined) {
        continue;
      }
      const questionId = factQuestion.get(c.measure.fact);
      const question = questionId ? byId.get(questionId) : undefined;
      if (!question || question.options.length === 0) continue;
      const allowed = new Set((c.test.expect ?? []).map(String));
      if (question.options.every((o) => allowed.has(o.code))) {
        add(
          '6 no dead condition',
          `${product.key}/${c.id ?? '?'}: accepts every answer to ${question.code} — refuses nobody`,
        );
      }
    }
  }

  // 7. FACT ⇒ QUESTION
  for (const f of facts) {
    if (!f.active || f.boundQuestionId === null) continue;
    const q = byId.get(f.boundQuestionId);
    if (!q || !q.isActive) add('7 fact ⇒ question', `${f.key}: active fact, bound question inactive`);
  }

  console.log('\n[check:questionnaire-integrity]\n');
  if (violations.length === 0) {
    console.log('  clean — all seven invariants hold.');
  } else {
    for (const v of violations) console.log(`  ✗ [${v.invariant}] ${v.detail}`);
    console.log(`\n  ${violations.length} violation(s).`);
  }
  await prisma.$disconnect();
  if (violations.length > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error('FAILED:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
