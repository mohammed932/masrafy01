/**
 * Demo seeder for per-bank-program matching weights (Constitution Principle V,
 * v14.0.0). Without an ACTIVE `ScoringWeightSet` row a program scores 0% and
 * renders as "Not rated" — so a freshly seeded dev DB would show no ranking at
 * all between offers.
 *
 *   npm run seed:weights              # programs that have no seed-authored set yet
 *   npm run seed:weights -- --force   # rebuild EVERY program from the catalog,
 *                                     # archiving any admin-tuned ACTIVE version
 *
 * Also invoked by `npm run seed:demo`. Run `npm run seed:catalog` first: the
 * question set is the CATALOG's (`platform_enumeration_question`, per program
 * name × loan category), and a program whose name has no set for its category is
 * reported and left unscored rather than given an invented one — `saveWeights`
 * rejects every weighted question in that state (`WEIGHTS_QUESTION_NOT_IN_CATALOG`),
 * so an invented set would be a row the admin screen cannot re-save.
 *
 * The scheme itself (which used to live here as hand-authored per-program maps)
 * is now built by `writeProgramWeightSets` from the questionnaire seed's own
 * authored option points, tilted per program so two banks under the same catalog
 * name still rank the same applicant differently. Those maps were keyed by
 * question codes that have since left the pool (`monthly_revenue`, the bucketed
 * income/instalment options replaced by NUMERIC bands in feature 010), so they
 * had stopped describing anything the engine could score.
 *
 * This is dev/demo scaffolding, not the product's weight-editing path — real
 * per-bank tuning happens in the admin dashboard's weights editor
 * (`ScoringService.saveWeights`), which this script deliberately bypasses
 * (writing rows directly) since there is no HTTP session to drive here.
 */
import { PrismaClient } from '@prisma/client';

import { writeProgramWeightSets, type WriteWeightSetsResult } from './program-weight-sets';
import { mergeSeedPool, reportWeightSetRun } from './seed-questionnaire';

export interface SeedScoringWeightsOptions {
  /** Rebuild admin-tuned ACTIVE sets too (archiving them into history first). */
  force?: boolean;
}

/**
 * Idempotent. Writes one catalog-scoped ACTIVE weight set per bank program;
 * without `force`, an ACTIVE set an admin saved is left alone.
 */
export async function seedScoringWeights(
  prisma: PrismaClient,
  editorId: string,
  options: SeedScoringWeightsOptions = {},
): Promise<WriteWeightSetsResult> {
  // The pool merge is read-only and gives the authored per-answer desirability
  // this seeder scores with — the same data `seed-questionnaire` publishes the
  // questions from, so the two can never disagree about an option's worth.
  const pool = await mergeSeedPool(prisma);
  const result = await writeProgramWeightSets(prisma, pool, { editorId, force: options.force });
  log(`weight sets: wrote ${result.written}`);
  reportWeightSetRun(result, '[seed-scoring-weights]');
  return result;
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[seed-scoring-weights] ${msg}`);
}

// Standalone entrypoint (`npm run seed:weights`).
if (process.argv[1] && process.argv[1].endsWith('seed-scoring-weights.ts')) {
  const prisma = new PrismaClient();
  (async () => {
    const superAdmin = await prisma.staffAccount.findFirst({
      where: { role: 'super_admin' },
      select: { id: true },
    });
    if (!superAdmin) {
      throw new Error('No super_admin staff account found — seed the admin bootstrap first.');
    }
    await seedScoringWeights(prisma, superAdmin.id, { force: process.argv.includes('--force') });
  })()
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[seed-scoring-weights] failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
