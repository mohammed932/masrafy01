/**
 * `npm run seed:blueprints` — put the predefined no-payslip products in the database.
 *
 *   npm run build && npm run seed:blueprints          write
 *   npm run build && npm run seed:blueprints -- --dry report only, write nothing
 *
 * ORDER: `npm run prisma:seed` (an admin, and the questionnaire) → `npm run build` → this.
 * It needs a super-admin to attribute its writes to and a published questionnaire to add
 * questions to, and it says so rather than failing obscurely.
 *
 * ── Why this is not a `tsx` script like every other seed ─────────────────────
 *
 * It reuses `BlueprintService.createFromBlueprint`, the same code an operator's clicks used
 * to go through, so a seeded product is identical to one the UI produced — same refusals,
 * same single questionnaire publish, same audited writes. That service injects four
 * providers inside a `forwardRef` cycle, so it needs Nest's DI; and Nest's constructor
 * injection needs `emitDecoratorMetadata`, which `tsconfig.json` sets and which esbuild —
 * and therefore `tsx` — does not implement. Under `tsx` every provider would fail to
 * resolve. So this lives in `src/` and runs compiled, which also means `tsc` type-checks it
 * and eslint sees it; a file under `scripts/` is in neither glob.
 *
 * ── What it will not do ──────────────────────────────────────────────────────
 *
 * It NEVER touches a product that already holds a calculation. An operator may still edit a
 * product's figures, so re-writing one would undo their work on the next deploy. Re-running
 * the whole library therefore writes nothing and publishes nothing. The decision is in
 * `blueprint-seed-plan.ts`, where it can be tested.
 *
 * It is not wired into `prisma/seed.ts`, deliberately: that file owns its own PrismaClient,
 * runs on `prisma migrate reset` and from the container entrypoint, and publishes the
 * questionnaire LAST — which this depends on. It would also make a database-only operation
 * start requiring the Redis and S3 env (see `blueprint-seed.module.ts`).
 *
 * ── Audit events ────────────────────────────────────────────────────────────
 *
 * This seed DOES write them, because it goes through the real admin services. That is the
 * opposite of `seed-program-catalog.ts`'s stated policy, and the difference is real: that
 * policy is about seeds that write rows directly, where an event would describe a diff no
 * operator made. Here the events are the correct record of products appearing, and the
 * account they are attributed to is printed so nobody has to guess.
 */
/* eslint-disable no-console -- a command-line report IS this file's output; a logger would
   wrap every line in JSON that an operator then has to read past. */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BlueprintSeedModule } from './blueprint-seed.module';
import { BlueprintService } from './blueprint.service';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { DomainException } from '@/common/errors/domain.exceptions';
import { productBlueprints } from './product-blueprints';
import { planSeedAction } from './blueprint-seed-plan';
import type { ProductBlueprint } from './product-blueprint.types';

const TAG = '[seed-blueprints]';

interface Tally {
  created: string[];
  resumed: string[];
  unchanged: string[];
  caps: string[];
  refused: string[];
  publishes: number;
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const app = await NestFactory.createApplicationContext(BlueprintSeedModule, {
    // Otherwise sixty "dependencies initialized" lines arrive before the report, and the
    // report is the only thing anybody runs this for.
    logger: ['error', 'warn'],
    abortOnError: true,
  });

  try {
    const prisma = app.get(PrismaService);
    const blueprints = app.get(BlueprintService);
    const enums = app.get(PlatformEnumerationsRepository);
    const enumsAdmin = app.get(PlatformEnumerationsAdminService);

    // A real staff id: `platform_enumeration.createdBy` is written from it and
    // `audit_event.actorId` is a foreign key onto `staff_account`.
    const staff = await prisma.staffAccount.findFirst({
      where: { role: 'super_admin', isActive: true },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!staff) {
      console.error(`${TAG} no active super_admin to attribute these writes to.`);
      console.error(`${TAG} run \`npm run prisma:seed\` first.`);
      process.exitCode = 1;
      return;
    }
    const actor = { staffId: staff.id, sourceIp: null };
    console.log(`${TAG} ${dry ? 'DRY RUN — nothing will be written' : 'writing'}`);
    console.log(`${TAG} attributing to ${staff.email}`);

    const tally: Tally = {
      created: [],
      resumed: [],
      unchanged: [],
      caps: [],
      refused: [],
      publishes: 0,
    };

    for (const blueprint of productBlueprints()) {
      const row = await enums.findSurrogateProduct(blueprint.key);
      const action = planSeedAction(
        blueprint,
        row === null ? null : { key: row.key, hasRule: row.incomeRule !== null },
      );

      if (action.kind === 'skip') {
        tally.unchanged.push(action.productKey);
        console.log(
          `${TAG} skip    ${pad(action.productKey)} already has a calculation — untouched`,
        );
        continue;
      }

      if (dry) {
        reportDry(blueprint, action.kind, row !== null);
        if (action.kind === 'cap') tally.caps.push(action.productKey);
        else tally.created.push(action.productKey);
        continue;
      }

      try {
        const result = await blueprints.createFromBlueprint(
          {
            blueprintKey: blueprint.key,
            key: action.productKey,
            labelEn: blueprint.labelEn,
            labelAr: blueprint.labelAr,
          },
          actor,
        );
        if (result.publishedQuestionnaire) tally.publishes += 1;

        if (action.kind === 'cap') {
          // A cap blueprint builds its question, its list and its fact and returns no
          // product. The ROW is minted here so the operator gets one card and one switch per
          // product — with no calculation, because there is none to state and inventing one
          // would be a figure nobody published.
          if (!action.rowExists) {
            await enumsAdmin.create(
              {
                type: 'surrogate_product',
                key: action.productKey,
                labelEn: blueprint.labelEn,
                labelAr: blueprint.labelAr,
              } as never,
              actor,
              { source: 'blueprint' },
            );
          }
          tally.caps.push(action.productKey);
          console.log(
            `${TAG} cap     ${pad(action.productKey)} question + list + row, no calculation` +
              (result.capFactKey ? ` (fact: ${result.capFactKey})` : ''),
          );
          continue;
        }

        (action.kind === 'resume' ? tally.resumed : tally.created).push(action.productKey);
        console.log(
          `${TAG} ${action.kind === 'resume' ? 'resume' : 'create'}  ${pad(action.productKey)} ` +
            `lists ${result.created.lists.length} · values ${result.created.values} · ` +
            `questions ${result.created.questions.length} · facts ${result.created.facts.length} · ` +
            `revived ${result.created.revived.length} · reused ${reusedCount(result.reused)}`,
        );
      } catch (error) {
        // Per blueprint, and then CARRY ON. The eleven are independent, so stopping at the
        // third would leave eight uninstalled for no reason — and `createFromBlueprint`
        // computes its whole plan before its first write, so a refusal lands before
        // anything is written and the next run resumes.
        tally.refused.push(blueprint.key);
        console.error(`${TAG} ✗ ${pad(blueprint.key)} ${describe(error)}`);
      }
    }

    // Drift an operator has to fix on the product's own screen: the create path cannot,
    // because it refuses a product that already holds a calculation. Reported, never a
    // failure — the products quote fine, a question is just not being asked somewhere.
    for (const projected of await blueprints.list()) {
      const gaps = projected.asks.filter(
        (ask) =>
          !ask.factExists ||
          !ask.questionExists ||
          !ask.listExists ||
          ask.missingCategories.length > 0,
      );
      for (const ask of gaps) {
        if (!tally.unchanged.includes(projected.key)) continue;
        console.log(
          `${TAG} drift   ${pad(projected.key)} ${ask.factKey}: ` +
            [
              ask.questionExists ? null : 'no question',
              ask.listExists ? null : 'no list',
              ask.factExists ? null : 'no fact',
              ask.missingCategories.length > 0
                ? `not asked in ${ask.missingCategories.join(', ')}`
                : null,
            ]
              .filter((x) => x !== null)
              .join(' · '),
        );
      }
    }

    console.log(
      `${TAG} ${tally.created.length} created · ${tally.resumed.length} resumed · ` +
        `${tally.unchanged.length} unchanged · ${tally.caps.length} cap-only · ` +
        `${tally.refused.length} REFUSED · questionnaire published ${tally.publishes}×`,
    );
    if (tally.refused.length > 0) process.exitCode = 1;
  } finally {
    // Redis connects eagerly, so without this the process never exits. `process.exitCode`
    // rather than `process.exit()` everywhere above, for the same reason: stdout has to
    // flush and this has to run.
    await app.close();
  }
}

function pad(key: string): string {
  return key.padEnd(24);
}

function reusedCount(reused: {
  typeKeys: string[];
  questionCodes: string[];
  factKeys: string[];
  valueKeys: string[];
}): number {
  return (
    reused.typeKeys.length +
    reused.questionCodes.length +
    reused.factKeys.length +
    reused.valueKeys.length
  );
}

/** What a dry run can say without writing: the real key, and whether it is taken. */
function reportDry(blueprint: ProductBlueprint, kind: string, rowExists: boolean): void {
  console.log(
    `${TAG} ${kind.padEnd(6)}  ${pad(blueprint.key)} ` +
      `key ${rowExists ? 'TAKEN — would resume' : 'free'}`,
  );
}

function describe(error: unknown): string {
  if (error instanceof DomainException) {
    return `${error.code} ${JSON.stringify(error.meta ?? {})}`;
  }
  return error instanceof Error ? error.message : String(error);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    new Logger('seed-blueprints').error(describe(error));
    process.exitCode = 1;
  });
}
