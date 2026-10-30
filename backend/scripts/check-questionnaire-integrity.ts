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
 *   1. DEBTS CLOSED — while "which loans do you have" (`current_loans`) is live, the amount
 *      behind EVERY pick is live too. Car once asked 2 of 5, so a car loan, mortgage or card
 *      counted as 0.
 *   2. DEBTS SERVED PER NAME — under every offerable program name, the served questionnaire keeps
 *      the debt questions and the loan duration. Ten no-payslip names once dropped all of them.
 *   3. GATE SOURCE LIVE — a live question is never gated on a question that is not: a gate that
 *      is not there never hides its target, so the child shows to everybody.
 *   4. (warning) ASKED NOWHERE — a live question no program asks: not fixed, read by no
 *      programme, ticked by no program, and the source of no gate that is served.
 *   5. SNAPSHOT = LIVE — the published questionnaire holds exactly the live questions with their
 *      live fixed marks, and none of the loan-type keys retired in v32.0.0. A migration that
 *      changes questions and forgets to publish shows up here.
 *   6. NO DEAD CONDITION — a product condition whose allow-list accepts every answer refuses
 *      nobody, and still forces the question on every applicant. The car product had four.
 *   7. FACT ⇒ QUESTION — an active fact is bound to an active question.
 *   8. TICKS AND ORDER IN PLACE — every question a program TICKS is live, not fixed, not one every
 *      quote reads (those are asked everywhere already), and ticked under a loan type the name
 *      is offered in; every ORDER row sits under such a loan type too.
 *   9. FIXED SET SANE — every live FIXED question (`question.fixedServedOn`, the admin's since
 *      v31.0.0) is gated only on another live fixed question and is ticked by no program. Beside
 *      it, a WARNING for every question the engine reads by code (`ENGINE_READ_CODES`) that is
 *      switched off or not fixed — a super admin may delete one, and quotes then go without it.
 *  10. FIXED SET SERVED — under every offerable program name, the served questionnaire keeps the
 *      fixed questions that path must ask: the `every_name` ones always, the `income_proof`
 *      ones wherever the name sells a payslip programme in that loan type, the
 *      `income_surrogate` ones wherever it sells a no-payslip one (v32.1.0).
 *  11. OFFER EFFECTS ON FIXED ONLY (v31.3.0) — an answer's offer effect sits only on a fixed
 *      question; number ranges sit only on a fixed NUMBER question and pass the API's own range
 *      rules (`numberEffectRangesProblem`). A fixed TEXT question carries neither: it is asked
 *      and saved for the record and changes no offer.
 *  (warning) I-SCORE BAND EDGES — an I-Score tier that straddles a band edge (521, 626) is
 *      priced at the band's weakest tier for the whole band; reported so it is a choice.
 *
 * A question carries no loan type since v32.0.0: what an applicant is asked is the PROGRAM's
 * (`question-scope.ts`), so the per-loan-type invariants this script once held are gone with it.
 */
import { PrismaClient } from '@prisma/client';
import { I_SCORE_BANDS } from '../src/matching/pipeline/base-question-set';
import { ENGINE_READ_CODES } from '../src/questionnaire/validation/engine-contract';
import {
  numberEffectRangesOf,
  numberEffectRangesProblem,
} from '../src/matching/pipeline/answer-effects';
import {
  fixedServedHere,
  type FixedSides,
  fixedServedOnOf,
  frozenFixedServedOn,
} from '../src/questionnaire/validation/fixed-questions';
import { PostgresPlatformEnumerationsRepository } from '../src/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import {
  NEVER_PRODUCT_SCOPED_QUESTION_CODES,
  narrowAskedQuestions,
} from '../src/questionnaire/validation/question-scope';
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
  /** Frozen since v31.0.0; absent = not fixed. */
  fixedServedOn?: unknown;
  [key: string]: unknown;
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
      type: true,
      isActive: true,
      isRequired: true,
      enabledWhen: true,
      numericMinValue: true,
      numericMaxValue: true,
      numericStep: true,
      numericUnitEn: true,
      numericUnitAr: true,
      textMaxLength: true,
      fixedServedOn: true,
      numberEffects: true,
      options: {
        select: {
          code: true,
          isActive: true,
          effectMaxLoanPercent: true,
          effectRatePoints: true,
          effectMaxTenorMonths: true,
        },
      },
    },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const byCode = new Map(questions.map((q) => [q.code, q]));
  const live = questions.filter((q) => q.isActive);
  const liveCodes = new Set(live.map((q) => q.code));

  // 1. DEBTS CLOSED
  if (liveCodes.has(DEBT_TYPES_QUESTION_CODE)) {
    for (const item of OBLIGATION_ITEM_QUESTION_CODES) {
      if (!liveCodes.has(item)) {
        add('1 debts closed', `${DEBT_TYPES_QUESTION_CODE} is live but ${item} is not`);
      }
    }
  }

  // 3. GATE SOURCE LIVE
  for (const q of live) {
    const source = gateSourceOf(q.enabledWhen);
    if (source !== null && !liveCodes.has(source)) {
      add('3 gate source live', `${q.code} is gated on ${source}, which is not live`);
    }
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
  let retiredKeys = 0;
  for (const sq of snapshotQuestions) {
    inSnapshot.add(sq.code);
    if (!liveCodes.has(sq.code)) {
      add('5 snapshot = live', `${sq.code}: published, switched off live — publish`);
    }
    const liveMark = fixedServedOnOf(byCode.get(sq.code)?.fixedServedOn);
    if (liveMark !== fixedServedOnOf(sq.fixedServedOn)) {
      add(
        '5 snapshot = live',
        `${sq.code}: published fixed [${String(sq.fixedServedOn ?? 'no')}], live [${liveMark ?? 'no'}] — publish`,
      );
    }
    if ('categories' in sq || 'optInCategories' in sq || 'categoryOrder' in sq) retiredKeys += 1;
  }
  if (retiredKeys > 0) {
    add(
      '5 snapshot = live',
      `${retiredKeys} published question(s) still carry the loan-type keys retired in v32.0.0 — publish`,
    );
  }
  for (const q of live) {
    if (!inSnapshot.has(q.code)) {
      add('5 snapshot = live', `${q.code}: live, missing from the published version`);
    }
  }

  // 2 and 10, per path — and the union of what every path serves, for 4.
  const repo = new PostgresPlatformEnumerationsRepository(prisma as unknown as PrismaService);
  const offered = await prisma.bankProgram.groupBy({
    by: ['programNameKey', 'productCategory'],
    where: { active: true, programNameKey: { not: null } },
  });
  const offeredPairs = await prisma.platformEnumerationLoanCategory.findMany({
    where: { enumeration: { type: 'program_name', active: true, deprecatedAt: null } },
    select: { category: true, enumeration: { select: { key: true } } },
  });
  const mustServe = [
    DEBT_TYPES_QUESTION_CODE,
    ...OBLIGATION_ITEM_QUESTION_CODES,
    MONEY_FIELD_BINDINGS.tenor_months,
  ];
  const servedAnywhere = new Set<string>();
  const servedOn = async (
    programNameKey: string,
    category: (typeof offeredPairs)[number]['category'],
  ): Promise<{ served: ReadonlySet<string>; sides: FixedSides }> => {
    const scope = await repo.narrowingScopeFor(programNameKey, category);
    const decision = narrowAskedQuestions(
      snapshotQuestions.map((q) => ({
        code: q.code,
        enabledWhen: q.enabledWhen ?? null,
        fixedServedOn: frozenFixedServedOn(q, category),
      })),
      scope,
    );
    for (const code of decision.keep) servedAnywhere.add(code);
    return {
      served: decision.keep,
      sides: {
        incomeProof: scope?.incomeProof === true,
        incomeSurrogate: scope?.incomeSurrogate === true,
      },
    };
  };
  for (const pair of offeredPairs) await servedOn(pair.enumeration.key, pair.category);
  for (const { programNameKey, productCategory } of offered) {
    if (programNameKey === null) continue;
    const category = productCategory as (typeof offeredPairs)[number]['category'];
    const { served, sides } = await servedOn(programNameKey, category);
    // 2. DEBTS SERVED PER NAME
    for (const code of mustServe) {
      if (inSnapshot.has(code) && !served.has(code)) {
        add('2 debts served per name', `${productCategory}/${programNameKey}: ${code} not served`);
      }
    }
    // 10. FIXED SET SERVED — same path, same decision.
    for (const q of snapshotQuestions) {
      if (!fixedServedHere(frozenFixedServedOn(q, category), sides)) continue;
      if (!served.has(q.code)) {
        add('10 fixed set served', `${productCategory}/${programNameKey}: ${q.code} not served`);
      }
    }
  }

  // 4. (warning) ASKED NOWHERE
  const nowhere: string[] = [];
  for (const q of live) {
    if (!servedAnywhere.has(q.code)) nowhere.push(`${q.code}: live, asked by no program`);
  }

  // 9. FIXED SET SANE
  const namePolicy = new Set(
    (await prisma.programNameQuestionAddition.findMany({ select: { questionId: true } })).map(
      (r) => r.questionId,
    ),
  );
  const fixedWarnings: string[] = [];
  for (const q of questions) {
    if (!q.isActive || q.fixedServedOn === null) continue;
    const at = (detail: string): void => add('9 fixed set sane', `${q.code}: ${detail}`);
    const source = gateSourceOf(q.enabledWhen);
    if (source !== null) {
      const gate = byCode.get(source);
      if (!gate || !gate.isActive || gate.fixedServedOn === null) {
        at(`gated on ${source}, which is not fixed`);
      }
    }
    if (namePolicy.has(q.id)) at('a program ticks it');
  }
  for (const q of questions) {
    const at = (detail: string): void => add('11 offer effects on fixed only', `${q.code}: ${detail}`);
    const withEffect = q.options.filter(
      (o) =>
        o.effectMaxLoanPercent !== null ||
        o.effectRatePoints !== null ||
        o.effectMaxTenorMonths !== null,
    );
    if (q.fixedServedOn === null && withEffect.length > 0) {
      at(`ordinary, yet answers ${withEffect.map((o) => o.code).join(', ')} change the offer`);
    }
    const ranges = numberEffectRangesOf(q.numberEffects);
    if (ranges.length > 0) {
      if (q.fixedServedOn === null) at('ordinary, yet carries number ranges');
      if (q.type !== 'NUMERIC') at(`a ${q.type} question carrying number ranges`);
      const problem = numberEffectRangesProblem(ranges);
      if (problem !== null) at(`its number ranges break the rules: ${problem}`);
    }
  }
  for (const code of ENGINE_READ_CODES) {
    const q = byCode.get(code);
    if (!q || !q.isActive) fixedWarnings.push(`${code}: switched off — quotes go without it`);
    else if (q.fixedServedOn === null) fixedWarnings.push(`${code}: the engine reads it, not fixed`);
  }

  // (warning) I-SCORE BAND EDGES
  const edges = I_SCORE_BANDS.flatMap((b) =>
    b.range === 'no_score' ? [] : [b.range.from, b.range.to],
  ).filter((e): e is string => e !== null);
  const tiersAt = async (): Promise<
    { where: string; bands: { from: number; to: number | null }[] }[]
  > => {
    const out: { where: string; bands: { from: number; to: number | null }[] }[] = [];
    const shared = await repo.platformIScoreTiers();
    const read = (raw: unknown): { from: number; to: number | null }[] =>
      Array.isArray((raw as { bands?: unknown } | null)?.bands)
        ? (raw as { bands: { fromInclusive?: string; toExclusive?: string | null }[] }).bands.map(
            (b) => ({
              from: Number(b.fromInclusive),
              to:
                b.toExclusive === null || b.toExclusive === undefined
                  ? null
                  : Number(b.toExclusive),
            }),
          )
        : [];
    if (shared) out.push({ where: 'the shared I-Score table', bands: read(shared) });
    for (const p of await prisma.bankProgram.findMany({
      where: { active: true },
      select: { programCode: true, incomeAssumption: true },
    })) {
      const tiers = (p.incomeAssumption as { iScoreTiers?: unknown } | null)?.iScoreTiers;
      if (tiers !== undefined) out.push({ where: p.programCode, bands: read(tiers) });
    }
    return out;
  };
  const warnings: string[] = [];
  for (const table of await tiersAt()) {
    for (const edge of edges.map(Number)) {
      if (table.bands.some((b) => b.from < edge && (b.to === null || edge < b.to))) {
        warnings.push(`${table.where}: a tier straddles the band edge ${edge}`);
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
    if (!q || !q.isActive)
      add('7 fact ⇒ question', `${f.key}: active fact, bound question inactive`);
  }

  // 8. TICKS AND ORDER IN PLACE
  const additions = await prisma.programNameQuestionAddition.findMany({
    select: {
      category: true,
      questionId: true,
      enumeration: {
        select: { key: true, loanCategories: { select: { category: true } } },
      },
    },
  });
  for (const a of additions) {
    const q = byId.get(a.questionId);
    const where = `${a.category}/${a.enumeration.key}`;
    if (!q) continue; // the FK cascades a deleted question's rows away
    if (!q.isActive) add('8 ticks and order in place', `${where}: ticks ${q.code}, which is off`);
    if (q.fixedServedOn !== null) {
      add('8 ticks and order in place', `${where}: ticks ${q.code}, which is fixed`);
    }
    if (NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(q.code)) {
      add('8 ticks and order in place', `${where}: ticks ${q.code}, which every quote reads`);
    }
    if (!a.enumeration.loanCategories.some((c) => c.category === a.category)) {
      add('8 ticks and order in place', `${where}: the name is not offered under ${a.category}`);
    }
  }
  const orders = await prisma.programNameQuestionOrder.groupBy({
    by: ['enumerationId', 'category'],
  });
  const names = await prisma.platformEnumeration.findMany({
    where: { id: { in: orders.map((o) => o.enumerationId) } },
    select: { id: true, key: true, loanCategories: { select: { category: true } } },
  });
  const nameById = new Map(names.map((n) => [n.id, n]));
  for (const o of orders) {
    const name = nameById.get(o.enumerationId);
    if (name !== undefined && !name.loanCategories.some((c) => c.category === o.category)) {
      add(
        '8 ticks and order in place',
        `${o.category}/${name.key}: an order is kept under a loan type the name is not offered in`,
      );
    }
  }

  console.log('\n[check:questionnaire-integrity]\n');
  for (const w of warnings) console.log(`  ! [I-Score band edges] ${w}`);
  for (const w of fixedWarnings) console.log(`  ! [engine reads it] ${w}`);
  for (const w of nowhere) console.log(`  ! [asked nowhere] ${w}`);
  if (violations.length === 0) {
    console.log('  clean — every invariant holds.');
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
