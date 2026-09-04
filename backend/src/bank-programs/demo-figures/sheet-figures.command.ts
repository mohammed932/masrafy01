/**
 * `npm run seed:sheet-figures` — put the published sheets' FIGURES in the database.
 *
 *   npm run build && npm run seed:sheet-figures -- --dry    report only, write nothing
 *   npm run build && npm run seed:sheet-figures             write
 *   npm run build && npm run seed:sheet-figures -- --force  overwrite figures already typed
 *
 * ORDER: `npm run prisma:seed` → `npm run seed:banks` → `npm run build` →
 * `npm run seed:blueprints` → this. It needs a super-admin to attribute its writes to, the
 * eleven predefined products to hang figures on, and the four banks the sheets belong to; it
 * says which is missing rather than failing obscurely.
 *
 * ── Why this is not a `tsx` script like most seeds ───────────────────────────
 *
 * Same reason as `blueprint-seed.command.ts`, which states it at length: this writes through
 * `BankProgramsService` and `PlatformEnumerationsAdminService`, so a seeded figure is
 * identical to one an operator typed — same validators, same refusals, same audit events.
 * Those services need Nest's DI, DI needs `emitDecoratorMetadata`, and esbuild — therefore
 * `tsx` — does not emit it. So this lives in `src/` and runs compiled.
 *
 * It boots `BlueprintSeedModule`, not `AppModule`: the provider set is exactly the one this
 * needs, and `AppModule` would reset the super-admin's password on the way up.
 *
 * ── What it will not do ─────────────────────────────────────────────────────
 *
 * It never touches a product that already holds figures, unless `--force`. An operator may
 * have typed their own, and a seed that overwrote them would undo somebody's work on every
 * deploy. The decision is in `sheet-figures.plan.ts`, where it is tested.
 *
 * It creates no product and no bank. Products are seeded by `seed:blueprints` and banks by
 * `seed:banks`; a missing one is reported, never invented.
 */
/* eslint-disable no-console -- a command-line report IS this file's output; a logger would
   wrap every line in JSON that an operator then has to read past. */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { LoanCategory } from '@prisma/client';
import { BlueprintSeedModule } from '../blueprints/blueprint-seed.module';
import { BankProgramsService } from '../bank-programs.service';
import { BankProgramRepository } from '../bank-programs.repository';
import { PlatformEnumerationsAdminService } from '@/platform-enumerations/platform-enumerations-admin.service';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { PrismaService } from '@/infra/prisma/prisma.service';
import { DomainException } from '@/common/errors/domain.exceptions';
import { compileTemplate } from '@/matching/pipeline/product-template';
import { productBlueprint } from '../blueprints/product-blueprints';
import {
  CATALOG_FIGURES,
  COMPOUND_CLASSES,
  EXISTING_COMPOUND_NAME,
  PROGRAM_NAMES,
} from './sheet-figures';
import { SHEET_PROGRAMS } from './sheet-programs';
import {
  blankSlots,
  countFigureLeaves,
  planCatalogFigures,
  planProgram,
  programFingerprint,
} from './sheet-figures.plan';
import type { EstimatedPaths } from './sheet-figures';

const TAG = '[seed-sheet-figures]';
const PROGRAM_NAME_TYPE = 'program_name';

interface Tally {
  productsWritten: string[];
  productsSkipped: string[];
  productsAbsent: string[];
  namesCreated: string[];
  namesReused: string[];
  programsCreated: string[];
  programsUpdated: string[];
  programsUnchanged: string[];
  refused: string[];
  compoundsFiled: number;
  blanks: string[];
}

/** `{path: 'team_estimated'}`, the shape both write paths take. */
function marks(paths: EstimatedPaths): Record<string, 'team_estimated'> {
  const out: Record<string, 'team_estimated'> = {};
  for (const path of paths) out[path] = 'team_estimated';
  return out;
}

function pad(key: string): string {
  return key.padEnd(28);
}

function describe(error: unknown): string {
  if (error instanceof DomainException) {
    return `${error.code} ${JSON.stringify(error.meta ?? {})}`;
  }
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const force = process.argv.includes('--force');
  const app = await NestFactory.createApplicationContext(BlueprintSeedModule, {
    logger: ['error', 'warn'],
    abortOnError: true,
  });

  try {
    const prisma = app.get(PrismaService);
    const programs = app.get(BankProgramsService);
    const programRepo = app.get(BankProgramRepository);
    const enums = app.get(PlatformEnumerationsRepository);
    const enumsAdmin = app.get(PlatformEnumerationsAdminService);

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
    // Two shapes, deliberately not unified: `BankProgramsService` takes `{id}` and the
    // enumerations admin takes `{staffId}`. Naming them apart here is cheaper than a wrapper
    // that hides which service is being called.
    const programActor = { id: staff.id, sourceIp: null };
    const enumActor = { staffId: staff.id, sourceIp: null };

    console.log(`${TAG} ${dry ? 'DRY RUN — nothing will be written' : 'writing'}`);
    console.log(`${TAG} attributing to ${staff.email}`);
    if (force) console.log(`${TAG} --force: figures already typed WILL be overwritten`);

    const tally: Tally = {
      productsWritten: [],
      productsSkipped: [],
      productsAbsent: [],
      namesCreated: [],
      namesReused: [],
      programsCreated: [],
      programsUpdated: [],
      programsUnchanged: [],
      refused: [],
      compoundsFiled: 0,
      blanks: [],
    };

    // 1. The banks the sheets belong to. Reported, never created: a bank row carries a name
    //    an operator reads, and inventing one here would put a bank on the board that nobody
    //    decided to partner with.
    const wanted = [...new Set(SHEET_PROGRAMS.map((spec) => spec.dto.bankName))];
    const banks = await prisma.bank.findMany({
      where: { nameEnglish: { in: wanted } },
      select: { nameEnglish: true },
    });
    const haveBanks = new Set(banks.map((bank) => bank.nameEnglish));
    const missingBanks = wanted.filter((name) => !haveBanks.has(name));
    if (missingBanks.length > 0) {
      console.error(`${TAG} these banks do not exist: ${missingBanks.join(', ')}`);
      console.error(`${TAG} run \`npm run seed:banks\` first — it holds all of them.`);
      process.exitCode = 1;
      return;
    }

    // 2. Catalog defaults, product by product.
    for (const set of CATALOG_FIGURES) {
      const row = await enums.findSurrogateProduct(set.productKey);
      const action = planCatalogFigures({
        productKey: set.productKey,
        stored: row === null ? null : { stepParams: row.incomeRule?.stepParams },
        force,
      });

      if (action.kind === 'absent') {
        tally.productsAbsent.push(set.productKey);
        console.error(
          `${TAG} absent  ${pad(set.productKey)} no such product — run \`npm run seed:blueprints\``,
        );
        continue;
      }
      if (action.kind === 'skip') {
        tally.productsSkipped.push(set.productKey);
        console.log(
          `${TAG} skip    ${pad(set.productKey)} already holds ${action.figures} figures — untouched`,
        );
        continue;
      }
      if (dry) {
        tally.productsWritten.push(set.productKey);
        console.log(
          `${TAG} write   ${pad(set.productKey)} ${Object.keys(set.stepParams).length} slots` +
            (set.baselineDbrPercent ? ` · baseline DBR ${set.baselineDbrPercent}%` : ''),
        );
        continue;
      }

      try {
        // The baseline goes on the TEMPLATE and therefore first: a template write recompiles
        // the steps, and a figures write landing before it would be writing against a shape
        // that is about to be replaced. `stepParams` is omitted so the stored figures are
        // kept and pruned rather than blanked.
        if (set.baselineDbrPercent !== undefined) {
          const current = await programs.getSurrogateProductTemplate(set.productKey);
          if (
            current.template !== null &&
            current.template.baselineDbrPercent !== set.baselineDbrPercent
          ) {
            await programs.setSurrogateProductTemplate(
              set.productKey,
              {
                template: {
                  ...current.template,
                  baselineDbrPercent: set.baselineDbrPercent,
                } as unknown as Record<string, unknown>,
              },
              programActor,
            );
          }
        }

        await programs.setSurrogateProductIncomeRule(
          set.productKey,
          {
            // A figures-only write: `strategy` plus `stepParams`, and nothing else.
            // `withStoredStructure` keeps the compiled steps, gates and output — posting a
            // step list this seed merely read would let it replace the product itself.
            incomeRule: {
              strategy: 'steps',
              stepParams: set.stepParams,
            } as never,
            valueSources: marks(set.estimated ?? []),
          },
          programActor,
        );
        tally.productsWritten.push(set.productKey);
        console.log(
          `${TAG} write   ${pad(set.productKey)} ${Object.keys(set.stepParams).length} slots · ` +
            `${countFigureLeaves(set.stepParams)} figures · ${(set.estimated ?? []).length} estimated`,
        );
      } catch (error) {
        tally.refused.push(set.productKey);
        console.error(`${TAG} ✗ ${pad(set.productKey)} ${describe(error)}`);
      }
    }

    // 3. The catalog names that sell them.
    const nameRows = new Map(
      (await enumsAdmin.listAll({ type: PROGRAM_NAME_TYPE })).map((row) => [row.key, row]),
    );

    for (const spec of PROGRAM_NAMES) {
      const existing = nameRows.get(spec.key);
      if (dry) {
        (existing ? tally.namesReused : tally.namesCreated).push(spec.key);
        console.log(
          `${TAG} ${existing ? 'reuse ' : 'create'}  ${pad(spec.key)} → ${spec.productKey}`,
        );
        continue;
      }
      try {
        let id = existing?.id;
        if (id === undefined) {
          // One atomic create: the link and the basis are applied inside it, so a name can
          // never exist as no-payslip with nothing saying how its income is worked out.
          const created = await enumsAdmin.create(
            {
              type: PROGRAM_NAME_TYPE,
              key: spec.key,
              labelEn: spec.labelEn,
              labelAr: spec.labelAr,
              surrogateProductKey: spec.productKey,
              categories: spec.categories,
              incomeBases: ['no_payslip'],
            } as never,
            enumActor,
          );
          id = created.id;
          tally.namesCreated.push(spec.key);
          console.log(`${TAG} create  ${pad(spec.key)} → ${spec.productKey}`);
        } else {
          // The LINK first and the basis second, in that order: moving a name to the
          // no-payslip basis is refused while nothing says how its income is worked out.
          // The label is left exactly as it is — an operator may have renamed it.
          await enumsAdmin.update(id, { surrogateProductKey: spec.productKey } as never, enumActor);
          await enumsAdmin.setCategories(id, [...spec.categories], enumActor);
          for (const category of spec.categories) {
            await enumsAdmin.setIncomeBases(id, category, ['no_payslip'], enumActor);
          }
          tally.namesReused.push(spec.key);
          console.log(`${TAG} reuse   ${pad(spec.key)} → ${spec.productKey}`);
        }
        for (const category of spec.categories) {
          await enumsAdmin.setQuestions(id, category, [...spec.questionCodes], enumActor);
        }
      } catch (error) {
        tally.refused.push(spec.key);
        console.error(`${TAG} ✗ ${pad(spec.key)} ${describe(error)}`);
      }
    }

    // The compound name predates this seed and is already linked. Only its scored-question
    // shortlist is missing, and a name with none reads "No questions picked" on the board.
    const compoundName = nameRows.get(EXISTING_COMPOUND_NAME.key);
    if (compoundName && !dry) {
      try {
        for (const category of EXISTING_COMPOUND_NAME.categories) {
          await enumsAdmin.setQuestions(
            compoundName.id,
            category,
            [...EXISTING_COMPOUND_NAME.questionCodes],
            enumActor,
          );
        }
        console.log(`${TAG} reuse   ${pad(EXISTING_COMPOUND_NAME.key)} questions set`);
      } catch (error) {
        tally.refused.push(EXISTING_COMPOUND_NAME.key);
        console.error(`${TAG} ✗ ${pad(EXISTING_COMPOUND_NAME.key)} ${describe(error)}`);
      }
    } else if (!compoundName) {
      console.log(
        `${TAG} note    ${pad(EXISTING_COMPOUND_NAME.key)} not in this database — skipped`,
      );
    }

    // 4. The bank programs.
    for (const spec of SHEET_PROGRAMS) {
      const stored = await programRepo.findByProgramCode(spec.programCode);
      const body = { ...spec.dto, valueSources: marks(spec.estimated) };
      const action = planProgram({
        programCode: spec.programCode,
        stored:
          stored === null
            ? null
            : { version: stored.version, fingerprint: programFingerprint(stored) },
        fingerprint: programFingerprint(body),
        force,
      });
      if (action.kind === 'unchanged') {
        tally.programsUnchanged.push(spec.programCode);
        console.log(`${TAG} same    ${pad(spec.programCode)} identical to what is stored`);
        continue;
      }
      if (dry) {
        (action.kind === 'create' ? tally.programsCreated : tally.programsUpdated).push(
          spec.programCode,
        );
        console.log(
          `${TAG} ${action.kind === 'create' ? 'create' : 'update'}  ${pad(spec.programCode)} ` +
            `${spec.dto.bankName} · ${spec.dto.programType}`,
        );
        continue;
      }
      try {
        if (action.kind === 'create') {
          await programs.create(body, programActor);
          tally.programsCreated.push(spec.programCode);
        } else {
          await programs.update(
            spec.programCode,
            { ...body, version: action.version },
            programActor,
          );
          tally.programsUpdated.push(spec.programCode);
        }
        console.log(
          `${TAG} ${action.kind === 'create' ? 'create' : 'update'}  ${pad(spec.programCode)} ` +
            `${countFigureLeaves(spec.dto.incomeAssumption.stepParams ?? {})} figures · ` +
            `${spec.estimated.length} estimated`,
        );
      } catch (error) {
        tally.refused.push(spec.programCode);
        console.error(`${TAG} ✗ ${pad(spec.programCode)} ${describe(error)}`);
      }
    }

    // 5. The compounds the source material names, filed under the class it names them in.
    //    Only those: a class decides a price, so the other sixty stay in the catch-all and
    //    are reported rather than guessed.
    const compounds = await enumsAdmin.listAll({ type: 'compound' });
    const assignments = compounds
      .filter((row) => COMPOUND_CLASSES[row.key] !== undefined)
      .filter((row) => row.parentKey !== COMPOUND_CLASSES[row.key])
      .map((row) => ({ id: row.id, parentKey: COMPOUND_CLASSES[row.key] as string }));
    if (assignments.length > 0 && !dry) {
      try {
        const moved = await enumsAdmin.setParentKeysBulk({ assignments }, enumActor);
        tally.compoundsFiled = moved.moved;
        console.log(`${TAG} file    ${pad('compounds')} ${moved.moved} moved into a real class`);
      } catch (error) {
        tally.refused.push('compound-classes');
        console.error(`${TAG} ✗ ${pad('compound-classes')} ${describe(error)}`);
      }
    } else if (assignments.length > 0) {
      console.log(`${TAG} file    ${pad('compounds')} ${assignments.length} would move`);
    }
    const catchAll = compounds.filter((row) => row.parentKey === 'compound_tier_other').length;
    if (catchAll > 0) {
      console.log(
        `${TAG} note    ${pad('compounds')} ${catchAll} of ${compounds.length} are still in the ` +
          `catch-all class. They quote — the catch-all has a figure — but each is priced as ` +
          `"Other" until somebody who knows moves it on the class board.`,
      );
    }

    // 6. The blank-field matrix — the report the demo needs.
    console.log(`${TAG} ─── boxes still empty ───`);
    for (const set of CATALOG_FIGURES) {
      const template = productBlueprint(set.productKey)?.template;
      if (!template) continue;
      const blanks = blankSlots({
        rule: compileTemplate(template),
        stepParams: set.stepParams,
        gatesExpectedBlank: true,
      });
      if (blanks.length === 0) continue;
      tally.blanks.push(`${set.productKey}: ${blanks.join(', ')}`);
      console.log(`${TAG} catalog ${pad(set.productKey)} ${blanks.join(', ')}`);
    }
    for (const spec of SHEET_PROGRAMS) {
      if (spec.dto.programType !== 'income_surrogate') continue;
      const stored = await enums.findProgramName(spec.dto.programNameKey);
      const productKey = stored?.surrogateProductKey ?? null;
      const template = productKey === null ? undefined : productBlueprint(productKey)?.template;
      if (!template) continue;
      const blanks = blankSlots({
        rule: compileTemplate(template),
        stepParams: (spec.dto.incomeAssumption.stepParams ?? {}) as Record<string, unknown>,
        gatesExpectedBlank: false,
      });
      if (blanks.length === 0) continue;
      tally.blanks.push(`${spec.programCode}: ${blanks.join(', ')}`);
      console.log(`${TAG} program ${pad(spec.programCode)} ${blanks.join(', ')}`);
    }
    console.log(
      `${TAG} a blank slot on a PROGRAM is a way that bank does not sell — the calculation ` +
        `reads the ways it filled, and never demands the answers of the others.`,
    );

    console.log(
      `${TAG} ${tally.productsWritten.length} products written · ` +
        `${tally.productsSkipped.length} untouched · ${tally.productsAbsent.length} absent · ` +
        `${tally.namesCreated.length} names created · ${tally.namesReused.length} reused · ` +
        `${tally.programsCreated.length} programs created · ${tally.programsUpdated.length} updated · ` +
        `${tally.programsUnchanged.length} unchanged · ` +
        `${tally.compoundsFiled} compounds filed · ${tally.refused.length} REFUSED`,
    );
    if (tally.refused.length > 0) process.exitCode = 1;
  } finally {
    // Redis connects eagerly, so without this the process never exits.
    await app.close();
  }
}

// Referenced so the enum import is not dropped as unused by an over-eager transform: the
// category values in `sheet-figures.ts` are this enum's members, and a build that elided it
// would fail at runtime rather than at compile time.
void LoanCategory;

if (require.main === module) {
  void main().catch((error: unknown) => {
    new Logger('seed-sheet-figures').error(describe(error));
    process.exitCode = 1;
  });
}
