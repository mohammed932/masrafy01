/* eslint-disable no-console -- a command-line report IS this file's output. */
/**
 * `npm run seed:car-list` (v36.4.0) — the car list's first run: three linked lists
 * (country → brand → model), each the answers of its question, and a fact on the model
 * question so a bank's cases can read it.
 *
 * IDEMPOTENT and additive: a kind, a value, a link or a fact that is already there is left
 * as it is, so a second run writes nothing. The operator owns the list after this.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { BlueprintSeedModule } from '@/bank-programs/blueprints/blueprint-seed.module';
import { PlatformEnumerationsAdminService } from '../platform-enumerations-admin.service';
import { PostgresPlatformEnumerationsRepository } from '../postgres-platform-enumerations.repository';
import { QuestionnaireService } from '@/questionnaire/questionnaire.service';
import { ProductAsksService } from '@/bank-programs/asks/product-asks.service';
import { PrismaService } from '@/infra/prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import {
  CAR_DEMO_PROGRAM,
  CAR_BRANDS,
  CAR_COUNTRIES,
  CAR_LIST_TYPES,
  CAR_MODEL_QUESTION,
  CAR_MODEL_TYPE,
  CAR_MODELS,
  type CarListRow,
} from './car-list.data';

const TAG = '[seed-car-list]';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(BlueprintSeedModule, {
    logger: ['error', 'warn'],
    abortOnError: true,
  });
  const written: string[] = [];
  try {
    const prisma = app.get(PrismaService);
    const repo = app.get(PostgresPlatformEnumerationsRepository, { strict: false });
    const admin = app.get(PlatformEnumerationsAdminService);
    const questionnaire = app.get(QuestionnaireService);
    const asks = app.get(ProductAsksService, { strict: false });

    const staff = await prisma.staffAccount.findFirst({
      where: { role: 'super_admin', isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!staff) {
      console.error(`${TAG} no active super_admin; run \`npm run prisma:seed\` first.`);
      process.exitCode = 1;
      return;
    }
    const actor = { staffId: staff.id, sourceIp: null };

    // 1. The three kinds, each filed under the one before it.
    for (const t of CAR_LIST_TYPES) {
      const defs = await repo.typeDefinitions();
      if (defs.has(t.key)) continue;
      await admin.createType(
        {
          key: t.key,
          labelEn: t.labelEn,
          labelAr: t.labelAr,
          parentTypeKey: t.parentTypeKey,
          // A brand or a model can be removed (a case naming it stops matching); a country
          // cannot — bank tables are keyed on `car_origin`'s answers.
          deletable: t.key !== 'car_country',
          // The Car list page is its screen; the Manage-values rail would show a third of it.
          onValuesRail: false,
        },
        actor,
      );
      written.push(`kind ${t.key}`);
    }

    // 2. The values, parents first.
    const rows: Array<[string, CarListRow[]]> = [
      ['car_country', CAR_COUNTRIES],
      ['car_brand', CAR_BRANDS],
      [CAR_MODEL_TYPE, CAR_MODELS],
    ];
    for (const [type, list] of rows) {
      let order = 0;
      for (const row of list) {
        order += 1;
        if (await repo.findByTypeAndKey(type, row.key)) continue;
        await admin.create(
          {
            type,
            key: row.key,
            labelEn: row.labelEn,
            labelAr: row.labelAr,
            sortOrder: order,
            ...(row.parentKey !== undefined ? { parentKey: row.parentKey } : {}),
          },
          actor,
        );
        written.push(`${type} ${row.key}`);
      }
    }

    // 3. Each list IS its question's answers. Country and brand mirror the questions that
    //    already exist (same codes); the model question is created from its list.
    for (const t of CAR_LIST_TYPES) {
      const def = (await repo.typeDefinitions()).get(t.key);
      if (def?.mirrorQuestionId != null) continue;
      if (t.key === CAR_MODEL_TYPE) {
        await questionnaire.createQuestionWithOptions(
          {
            questionEn: 'What model is the car?',
            questionAr: 'ما طراز السيارة؟',
            type: 'SINGLE_SELECT',
            isRequired: false,
            optionsFromEnumerationType: CAR_MODEL_TYPE,
          },
          staff.id,
        );
      } else {
        await admin.linkMirrorQuestion(t.key, t.question, actor);
        await questionnaire.syncMirroredOptions(t.key, staff.id);
      }
      written.push(`link ${t.key} → ${t.question}`);
    }

    // 4. A fact on the model question, so a bank's case or table can read the answer.
    const model = await prisma.question.findFirst({
      where: { code: CAR_MODEL_QUESTION },
      select: { id: true },
    });
    if (model === null) {
      console.error(`${TAG} the model question was not created as ${CAR_MODEL_QUESTION}`);
      process.exitCode = 1;
      return;
    }
    const bound = await prisma.platformEnumeration.findFirst({
      where: { type: 'surrogate_fact', boundQuestionId: model.id },
      select: { key: true },
    });
    if (bound === null) {
      await asks.ensureFact(CAR_MODEL_QUESTION, { id: staff.id, sourceIp: null });
      // A short name, as a bank's Cases list it ("Car model: C 200"), not the question.
      await prisma.platformEnumeration.updateMany({
        where: { type: 'surrogate_fact', key: CAR_MODEL_QUESTION },
        data: { labelEn: 'Car model', labelAr: 'طراز السيارة' },
      });
      written.push(`fact ${CAR_MODEL_QUESTION}`);
    }

    // 5. The demo program (once; the operator's after that). Skipped where the bank program
    //    it copies is not seeded.
    const demo = CAR_DEMO_PROGRAM;
    const exists = await prisma.bankProgram.findUnique({
      where: { programCode: demo.programCode },
      select: { id: true },
    });
    const source = await prisma.bankProgram.findUnique({ where: { programCode: demo.copyFrom } });
    if (exists === null && source !== null) {
      const cases = demo.cases.map((c) => ({
        id: c.id,
        allOf: c.allOf.map((cr) => ({
          factKey: cr.factKey,
          key: 'option' in cr ? { key: cr.option } : { toExclusive: cr.before },
        })),
        effects: c.effects,
        ...('refuse' in c ? { refuse: true } : {}),
      }));
      const json = (v: unknown) => (v ?? undefined) as Prisma.InputJsonValue | undefined;
      await prisma.bankProgram.create({
        data: {
          programCode: demo.programCode,
          bankName: source.bankName,
          bankId: source.bankId,
          friendlyName: demo.friendlyName,
          friendlyNameAr: demo.friendlyNameAr,
          programNameKey: demo.programNameKey,
          programType: source.programType,
          productCategory: source.productCategory,
          active: true,
          isShariaCompliant: source.isShariaCompliant,
          requiredDocuments: source.requiredDocuments,
          operatorTips: [],
          tenor: json(source.tenor)!,
          loanLimits: json(source.loanLimits)!,
          pricing: json(source.pricing)!,
          eligibility: json(source.eligibility)!,
          ...(source.performanceCriteria !== null
            ? { performanceCriteria: json(source.performanceCriteria)! }
            : {}),
          incomeAssumption: json(source.incomeAssumption)!,
          fees: json(source.fees)!,
          plansSource: source.plansSource,
          cases: cases as unknown as Prisma.InputJsonValue,
          createdBy: staff.id,
          updatedBy: staff.id,
        },
      });
      written.push(`program ${demo.programCode}`);
    }

    console.log(`${TAG} ${written.length} written`);
    for (const w of written) console.log(`${TAG}   ${w}`);
  } finally {
    await app.close();
  }
}

void main();
