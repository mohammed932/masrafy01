/**
 * `npm run blueprint:retemplate` — bring ONE product back in line with its blueprint.
 *
 *   npm run build && npm run blueprint:retemplate -- <productKey>
 *   npm run build && npm run blueprint:retemplate -- <productKey> --confirm
 *   npm run build && npm run blueprint:retemplate -- <productKey> --confirm --drop-figures
 *
 * ── Why this is not `seed:blueprints` ───────────────────────────────────────
 *
 * The seed NEVER touches a product that already holds a calculation, and that is a promise
 * rather than an optimisation: an operator may have edited its figures, and a deploy that
 * re-wrote them would undo their work with nobody present (`blueprint-seed-plan.ts`). So
 * when a blueprint CHANGES — a new ask, a different mechanism — every database that already
 * has the product keeps the old shape, and there is no click anywhere that closes the gap:
 * the product screen's form saves the figures, not the library's shape.
 *
 * This command is that missing door, and it is deliberately narrow. It names ONE product, it
 * reports everything it would touch before it writes anything, and the write itself goes
 * through `createFromBlueprint` — so the compile, the validator, the orphan check and the
 * audit events are the same ones an operator's clicks went through.
 *
 * ── What it will not do without being told twice ────────────────────────────
 *
 * A recompile can stop emitting a step, and every figure a bank filed under that id is then
 * orphaned — the program still reads as configured and quotes nothing. `setProductTemplate`
 * REFUSES that (`PRODUCT_TEMPLATE_ORPHANS_FIGURES`), which is right, so this prints the
 * programs and the boxes first and drops them only under `--drop-figures`. The figures it
 * drops are gone: they are a bank's, and no screen shows them once the slot is unreachable.
 *
 * ── Not a `tsx` script, for the reason its sibling states ───────────────────
 *
 * It reuses `BlueprintService`, which sits in a three-module `forwardRef` cycle and needs
 * Nest's DI; Nest's constructor injection needs `emitDecoratorMetadata`, which esbuild — and
 * therefore `tsx` — does not emit. See `blueprint-seed.command.ts` and the module note in
 * `blueprint-seed.module.ts` for what booting this context costs.
 */
/* eslint-disable no-console -- a command-line report IS this file's output; a logger would
   wrap every line in JSON that an operator then has to read past. */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BlueprintSeedModule } from './blueprint-seed.module';
import { BlueprintService } from './blueprint.service';
import { productBlueprint } from './product-blueprints';
import { ensureBlueprintAsks } from './blueprint-seed-asks';
import { ASK_SOURCE, ProductAsksRepository } from '../asks/product-asks.repository';
import { ProductAsksService } from '../asks/product-asks.service';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { templateParamKeys } from '@/matching/pipeline/product-template';
import type { ProductTemplate } from '@/matching/pipeline/product-template';
import type { IncomeAssumptionConfig } from '@/matching/types';

const TAG = '[blueprint-retemplate]';
const FACT_TYPE = 'surrogate_fact';

function describe(error: unknown): string {
  if (error instanceof Error) {
    const meta = (error as { meta?: unknown }).meta;
    const code = (error as { code?: unknown }).code;
    return [code ?? error.message, meta ? JSON.stringify(meta) : null].filter(Boolean).join(' ');
  }
  return String(error);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const flags = new Set(args.filter((arg) => arg.startsWith('--')));
  const productKey = args.find((arg) => !arg.startsWith('--'));
  const confirm = flags.has('--confirm');
  const dropFigures = flags.has('--drop-figures');

  if (!productKey) {
    console.error(`${TAG} name the product: npm run blueprint:retemplate -- <productKey>`);
    process.exitCode = 1;
    return;
  }

  const blueprint = productBlueprint(productKey);
  if (!blueprint) {
    // The product key IS the blueprint key for everything the library seeded
    // (`seedProductKey`). A product with no blueprint has no shape to be brought back to.
    console.error(`${TAG} no blueprint called "${productKey}".`);
    process.exitCode = 1;
    return;
  }
  if (blueprint.template === null) {
    console.error(`${TAG} ${productKey} is a cap-only blueprint — it holds no calculation.`);
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(BlueprintSeedModule, {
    logger: ['error', 'warn'],
    abortOnError: true,
  });

  try {
    const prisma = app.get(PrismaService);
    const blueprints = app.get(BlueprintService);
    const enums = app.get(PlatformEnumerationsRepository);
    const enumsAdmin = app.get(PlatformEnumerationsAdminService);
    const questionnaire = app.get(QuestionnaireService);
    const asksRepo = app.get(ProductAsksRepository);
    const asksService = app.get(ProductAsksService);

    // A real staff id: `platform_enumeration.createdBy` is written from it and
    // `audit_event.actorId` is a foreign key onto `staff_account`.
    const staff = await prisma.staffAccount.findFirst({
      where: { role: 'super_admin', isActive: true },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!staff) {
      console.error(`${TAG} no active super_admin to attribute these writes to.`);
      process.exitCode = 1;
      return;
    }
    const actor = { staffId: staff.id, sourceIp: null };

    const product = await enums.findSurrogateProduct(productKey);
    if (!product) {
      console.error(`${TAG} ${productKey} is not in the database — run seed:blueprints first.`);
      process.exitCode = 1;
      return;
    }

    console.log(`${TAG} ${confirm ? 'writing' : 'DRY RUN — nothing will be written'}`);
    console.log(`${TAG} attributing to ${staff.email}`);
    console.log(`${TAG} product ${productKey} (${product.labelEn})`);

    // ── 1. What the new shape drops ────────────────────────────────────────
    const surviving = new Set(templateParamKeys(blueprint.template as ProductTemplate));
    const perProgram = await enums.programFigureKeysUnderProduct(productKey);
    const orphans = perProgram
      .map((program) => ({
        programCode: program.programCode,
        lost: program.keys.filter((key) => !surviving.has(key)),
      }))
      .filter((program) => program.lost.length > 0);

    for (const program of orphans) {
      console.log(`${TAG} figures  ${program.programCode} → drops ${program.lost.join(', ')}`);
    }
    if (orphans.length === 0) console.log(`${TAG} figures  no bank figure is orphaned`);

    // ── 2. What the product asks that the blueprint no longer declares ──────
    const declared = new Set(blueprint.asks.map((ask) => ask.factKey));
    const askRows = await asksRepo.asksFor(productKey);
    const askSourceByFact = new Map(askRows.map((row) => [row.factKey, row.source]));
    const factRowsAll = await enumsAdmin.listAll({ type: FACT_TYPE });

    // What this product reads that the library no longer declares, from BOTH directions:
    //
    //   an attached ask row     the ordinary case, one run after the blueprint changed
    //   a fact filed under this product with no live ask row
    //                           what the first run leaves behind — a blueprint ask detaches
    //                           as a TOMBSTONE and never touches its fact row, on the
    //                           product screen's reasoning that the library re-declares it
    //                           next seed. Dropped from the library, nothing ever will.
    //
    // An OPERATOR's ask is excluded from both, and that is not a refinement — it is the
    // difference between tidying up after a shape change and deleting somebody else's work.
    // An operator may tick any pool question onto a product, and on this database that is
    // `current_loans` and `repayment_period_months`: platform questions the whole
    // questionnaire asks. "Not declared by this blueprint" says nothing about those.
    const operatorAsks = askRows
      .filter((row) => row.source !== ASK_SOURCE.blueprint && !declared.has(row.factKey))
      .map((row) => row.factKey);
    for (const factKey of operatorAsks) {
      console.log(`${TAG} keeps    ${factKey} — an operator attached it, not the library`);
    }

    const stale = [
      ...new Set([
        ...askRows
          .filter((row) => row.source === ASK_SOURCE.blueprint && !declared.has(row.factKey))
          .map((row) => row.factKey),
        ...factRowsAll
          .filter((row) => row.surrogateProductKey === productKey && !declared.has(row.key))
          .map((row) => row.key),
      ]),
    ]
      .filter((factKey) => !operatorAsks.includes(factKey))
      .sort();

    for (const factKey of stale) {
      console.log(`${TAG} retires  ${factKey} — the blueprint no longer reads it`);
    }
    if (stale.length === 0) console.log(`${TAG} retires  nothing`);

    if (!confirm) {
      console.log(
        `${TAG} re-run with --confirm to write` + (orphans.length > 0 ? ' --drop-figures' : ''),
      );
      return;
    }
    if (orphans.length > 0 && !dropFigures) {
      console.error(
        `${TAG} refusing: ${orphans.length} program(s) hold figures the new shape has no box for.`,
      );
      console.error(`${TAG} re-run with --drop-figures once you have read the list above.`);
      process.exitCode = 1;
      return;
    }

    // ── 3. Drop the orphaned figures, so the template write is accepted ─────
    //
    // Written straight to the row rather than through the program editor: this is a
    // DELETION of boxes the new shape cannot address, and the program update path takes a
    // whole configuration DTO — round-tripping one to remove a key would re-post every
    // other setting on the program as though somebody had retyped it.
    for (const program of orphans) {
      const row = await prisma.bankProgram.findUnique({
        where: { programCode: program.programCode },
        select: { id: true, incomeAssumption: true },
      });
      if (!row) continue;
      const config = row.incomeAssumption as unknown as IncomeAssumptionConfig;
      const params = { ...(config.stepParams ?? {}) };
      for (const key of program.lost) delete params[key];
      await prisma.bankProgram.update({
        where: { id: row.id },
        data: {
          incomeAssumption: {
            ...config,
            ...(Object.keys(params).length > 0 ? { stepParams: params } : { stepParams: {} }),
          } as never,
        },
      });
      console.log(`${TAG} dropped  ${program.programCode} ${program.lost.join(', ')}`);
    }

    // ── 4. The shape itself, through the same door the library uses ────────
    const result = await blueprints.createFromBlueprint(
      {
        blueprintKey: blueprint.key,
        key: productKey,
        // The product's OWN labels, never the blueprint's: an operator may have renamed it,
        // and a rename is not something a shape change is entitled to undo.
        labelEn: product.labelEn,
        labelAr: product.labelAr,
      },
      actor,
      { onExistingProduct: 'retemplate' },
    );
    console.log(
      `${TAG} shape    lists ${result.created.lists.length} · values ${result.created.values} · ` +
        `questions ${result.created.questions.length} · facts ${result.created.facts.length} · ` +
        `revived ${result.created.revived.length}`,
    );
    if (result.publishedQuestionnaire) console.log(`${TAG} shape    questionnaire published`);

    // ── 5. The ask rows, the same pass the seed runs ────────────────────────
    const asked = await ensureBlueprintAsks({
      blueprint,
      productKey,
      asks: asksRepo,
      actorStaffId: actor.staffId,
    });
    if (asked.added.length > 0) console.log(`${TAG} asks     added ${asked.added.join(', ')}`);
    if (asked.missingFacts.length > 0) {
      console.log(`${TAG} asks     no registry row for ${asked.missingFacts.join(', ')}`);
    }

    // ── 6. Retire what the product no longer reads ──────────────────────────
    //
    // AFTER the shape, and the order is load-bearing: `detach` refuses while the product's
    // own rule still names the fact, which it does until the recompile lands.
    //
    // Through the ordinary detach, so its guards are the ones already written down — a fact
    // another product asks, or any rule anywhere reads, is kept and said so. The question
    // and the list behind a fact that WAS deleted go with it, because the ask was the only
    // reason either existed: a question nobody reads is still asked of every applicant, and
    // a list nothing keys is a tab on a screen with nothing behind it.
    // Read AFTER the shape write, not reused from the planning pass above: that pass ran
    // before `createFromBlueprint` created this run's new facts and bound their questions.
    const bound = await enumsAdmin.boundQuestions({ type: FACT_TYPE });
    const factRows = await enumsAdmin.listAll({ type: FACT_TYPE });
    const defs = await enums.typeDefinitions();

    for (const factKey of stale) {
      const factRow = factRows.find((row) => row.key === factKey);
      const question = factRow ? bound.get(factRow.id) : undefined;
      try {
        let factDeleted = false;
        if (askSourceByFact.has(factKey)) {
          const outcome = await asksService.detach(productKey, factKey, {
            id: actor.staffId,
            sourceIp: actor.sourceIp,
          });
          factDeleted = outcome.changed.factDeleted;
          console.log(
            `${TAG} detach   ${factKey} — ask ` +
              `${outcome.changed.askRemoved ? 'removed' : 'kept'}, ` +
              `fact ${factDeleted ? 'deleted' : 'kept'}`,
          );
        }
        // A BLUEPRINT ask detaches as a TOMBSTONE and its fact row is never touched — right
        // on the product screen, where the reasoning is that the library re-declares the
        // fact on the next seed whatever an operator ticks. That reasoning is exactly what
        // has stopped being true here: the library has DROPPED this ask, so nothing will
        // re-declare it and the row would sit in the registry forever, with its question
        // still asked of every applicant.
        //
        // So the delete is made here, with the two guards the plan applies restated rather
        // than borrowed: `remove` counts what READS the fact (`fact-readers`), and nothing
        // counts what ASKS it — a fact another product asks would be deleted, and the ask
        // row would vanish with it through the FK cascade, silently.
        if (!question) continue;
        if (!factDeleted && factRow) {
          const alsoAsking = (await asksRepo.productsAsking(factKey)).filter(
            (key) => key !== productKey,
          );
          if (alsoAsking.length > 0) {
            console.log(`${TAG} fact     ${factKey} kept — also asked by ${alsoAsking.join(', ')}`);
            continue;
          }
          if (factRow.surrogateProductKey !== productKey) {
            console.log(`${TAG} fact     ${factKey} kept — it is not this product's to delete`);
            continue;
          }
          await enumsAdmin.remove(factRow.id, actor);
          console.log(`${TAG} fact     ${factKey} deleted`);
        } else if (!factDeleted) {
          continue;
        }

        // The list whose options ARE this question, if it has one. Deactivated rather than
        // deleted: `deleteType` refuses while values survive, a value's type cannot be
        // changed through the API, and an operator may have added rows of their own —
        // deleting would take those with it, and there is no remedy to offer them.
        for (const [typeKey, def] of defs) {
          if (def.mirrorQuestionId !== question.id) continue;
          await enumsAdmin.updateType(typeKey, { active: false }, actor);
          console.log(`${TAG} list     ${typeKey} deactivated`);
        }

        await questionnaire.softDeleteQuestion(question.id, actor.staffId);
        console.log(`${TAG} question ${question.code} switched off`);
      } catch (error) {
        // Reported, never fatal: the shape is already correct, and a fact another product
        // reads is a decision for a person rather than a reason to leave the run half done.
        console.error(`${TAG} ✗ ${factKey} ${describe(error)}`);
      }
    }

    console.log(`${TAG} done`);
  } finally {
    // `RedisService` connects eagerly, so the process hangs after the report without this.
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(`${TAG} failed:`, error);
  process.exitCode = 1;
});
