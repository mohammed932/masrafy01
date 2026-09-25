/**
 * Put the four questions a CAR applicant must be asked back on the `car` category.
 *
 * Read the diagnosis before running: `check:money` reports "4 flow(s) a customer cannot
 * finish" because `repayment_period_months`, `monthly_income` and `current_installments`
 * carry every category EXCEPT car, and `home_ownership` / `unit_approved_compound` carry
 * none at all. A car applicant is therefore never asked the term, the income, the
 * obligations or who owns their home — so apply posts `preferredTenorMonths: 0`, a zero
 * salary and no `home_ownership`, and every programme refuses: the surrogate income rule
 * answers SURROGATE_FACT_MISSING, and the deposit band that states rows only for an owner
 * rejects the rest. Six programmes checked, zero offers.
 *
 * TARGETED on purpose. `seed:questionnaire` would fix this too and is the durable answer,
 * but it rewrites EVERY question's assignments and deactivates anything outside its own
 * pool — which would discard category or ordering work done by hand in the admin since the
 * last seed. This adds four rows and nothing else.
 *
 * It publishes through `QuestionnaireService.publish()` rather than writing a snapshot of
 * its own: which categories ask a question is FROZEN into the snapshot (A33 — never
 * re-derived at read time), so the rows alone change nothing until a version is published,
 * and a second hand-rolled publisher is exactly the drift that rule exists to stop.
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';

const prisma = new PrismaClient();

/** The four money bindings a car flow needs, plus the facts its programmes read. */
const CODES = [
  'repayment_period_months',
  'monthly_income',
  'current_installments',
  'home_ownership',
  // `unit_approved_compound`, `business_months` and `self_employed_licence` were here for the
  // auto product's sheet conditions, removed 2026-09-24 — no car programme reads them now, and
  // restoring them would put a commercial-register question back on every car applicant.
] as const;

async function main(): Promise<void> {
  const questions = await prisma.question.findMany({
    where: { code: { in: [...CODES] } },
    select: { id: true, code: true, isActive: true, loanCategories: { select: { category: true } } },
  });

  const missing = CODES.filter((c) => !questions.some((q) => q.code === c));
  if (missing.length > 0) throw new Error(`no question row for: ${missing.join(', ')}`);

  let added = 0;
  for (const q of questions) {
    const has = q.loanCategories.some((c) => c.category === 'car');
    if (has) {
      console.log(`  ${q.code.padEnd(24)} already on car — left alone`);
      continue;
    }
    // The pair is the primary key, so this is idempotent: a second run adds nothing.
    await prisma.questionLoanCategory.create({ data: { questionId: q.id, category: 'car' } });
    added += 1;
    console.log(`  ${q.code.padEnd(24)} + car`);
  }

  console.log(`# ${added} assignment(s) added`);
  await prisma.$disconnect();

  // The real publish path, so the snapshot is built exactly as an admin write builds it.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const result = await app.get(QuestionnaireService).publish('script:restore-car-categories');
  console.log(`# published version ${JSON.stringify(result).slice(0, 200)}`);
  await app.close();
}

main().catch((e) => {
  console.error('FAILED:', e?.stack ?? e);
  process.exit(1);
});
