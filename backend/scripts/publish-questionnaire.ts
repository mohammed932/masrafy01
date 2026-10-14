/**
 * Publish a questionnaire snapshot from the command line.
 *
 * Which categories ask a question is FROZEN into the snapshot (A33 — never re-derived at
 * read time), so a category assignment written straight to the join table changes nothing a
 * customer sees until a version is published. The admin does this on every write; a script
 * that edits assignments needs the same step.
 *
 * It calls the REAL `QuestionnaireService.publish()`, wiring the two repositories by hand
 * rather than booting `AppModule` (which needs an HTTP context to resolve). A second,
 * hand-rolled snapshot writer is exactly the drift A33 exists to stop, so there isn't one.
 */
import { PrismaClient } from '@prisma/client';
import { QuestionnaireService } from '../src/questionnaire/questionnaire.service';
import { QuestionnaireRepository } from '../src/questionnaire/questionnaire.repository';
import { PostgresPlatformEnumerationsRepository } from '../src/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '../src/infra/prisma/prisma.service';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const actor = process.argv[2] ?? 'script:publish-questionnaire';
  const service = new QuestionnaireService(
    new QuestionnaireRepository(prisma as unknown as PrismaService),
    new PostgresPlatformEnumerationsRepository(prisma as unknown as PrismaService),
  );
  const result = await service.publish(actor);
  console.log(`# published: ${JSON.stringify(result).slice(0, 400)}`);
  await prisma.$disconnect();
}

main().catch((e: unknown) => {
  console.error('FAILED:', e instanceof Error ? e.stack : e);
  process.exit(1);
});
