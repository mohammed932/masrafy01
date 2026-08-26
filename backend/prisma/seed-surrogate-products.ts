/**
 * Seed the surrogate-product library — the pre-defined no-payslip products a catalog
 * program name can link to.
 *
 *   npm run seed:surrogate-products [-- --dry]
 *
 * IDEMPOTENT. Upserts by `(type, key)`; a re-run with nothing changed writes nothing and
 * says so.
 *
 * VALIDATES BEFORE WRITING, through `validateIncomeRule` — the same function the admin
 * save runs. A seeded product that would be refused on save is a product no operator can
 * then edit: the fixing save is the failing save. Rejected rows are reported and skipped,
 * never half-written.
 *
 * DOES NOT LINK EXISTING NAMES. Every catalog name that already states its own rule keeps
 * it. Linking them would be a behavioural change nobody asked for, and the grandfather
 * posture is deliberate: what exists keeps working, the NEXT no-payslip name has to pick.
 * An operator moves an existing name onto an archetype from the admin, one name at a time,
 * seeing what it costs.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { validateIncomeRule } from '../src/bank-programs/validation/income-rule.validator';
import type { IncomeAssumptionConfig } from '../src/matching/types';
import { stableJson } from '../src/common/stable-json.util';
import { incomeRuleValidationContext } from './data/income-rule-validation-context';
import {
  PIPELINE_PRODUCT_KEYS,
  SURROGATE_PRODUCTS,
  surrogateProductRule,
} from './data/surrogate-products';

const SURROGATE_PRODUCT_TYPE = 'surrogate_product';
const DRY = process.argv.includes('--dry');

const prisma = new PrismaClient();

async function resolveSeedActor(): Promise<string | null> {
  const staff = await prisma.staffAccount.findFirst({
    where: { role: 'super_admin', isActive: true },
    select: { id: true },
  });
  return staff?.id ?? null;
}

async function main(): Promise<void> {
  const actorId = await resolveSeedActor();
  const ctx = incomeRuleValidationContext(prisma);

  let written = 0;
  let unchanged = 0;
  let rejected = 0;

  for (const product of SURROGATE_PRODUCTS) {
    const rule = surrogateProductRule(product);
    if (rule === undefined) {
      rejected += 1;
      console.warn(
        `[seed-surrogate-products] ! '${product.key}' names catalog rule ` +
          `'${product.fromCatalog}', which is not in CATALOG_INCOME_RULE — skipped.`,
      );
      continue;
    }

    // Checked even on a dry run: telling the operator what would be written is worth
    // less than telling them it would be refused.
    const violation = await validateIncomeRule(rule as unknown as IncomeAssumptionConfig, ctx, {
      // A product's figures are its banks' to fill, the same posture a CATALOG write
      // takes. Holding an archetype to a bank's completeness would make any frame whose
      // design is "each bank fills exactly one derivation" unsavable.
      figuresRequired: false,
    });
    if (violation) {
      rejected += 1;
      console.error(
        `[seed-surrogate-products] ✗ '${product.key}' is invalid (${violation.kind}) and was ` +
          `NOT written — fix SURROGATE_PRODUCTS in prisma/data/surrogate-products.ts`,
      );
      continue;
    }

    const existing = await prisma.platformEnumeration.findUnique({
      where: {
        idx_platform_enumeration_type_key: { type: SURROGATE_PRODUCT_TYPE, key: product.key },
      },
      select: { id: true, labelEn: true, labelAr: true, sortOrder: true, incomeRule: true },
    });

    const same =
      existing !== null &&
      existing.labelEn === product.labelEn &&
      existing.labelAr === product.labelAr &&
      existing.sortOrder === product.sortOrder &&
      stableJson(existing.incomeRule) === stableJson(rule);
    if (same) {
      unchanged += 1;
      continue;
    }

    written += 1;
    console.log(
      `[seed-surrogate-products] ${existing === null ? 'create' : 'update'} ` +
        `${product.key.padEnd(20)} ${rule.strategy}`,
    );
    if (DRY) continue;

    await prisma.platformEnumeration.upsert({
      where: {
        idx_platform_enumeration_type_key: { type: SURROGATE_PRODUCT_TYPE, key: product.key },
      },
      update: {
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        sortOrder: product.sortOrder,
        incomeRule: rule as unknown as Prisma.InputJsonValue,
        updatedBy: actorId,
      },
      create: {
        type: SURROGATE_PRODUCT_TYPE,
        key: product.key,
        labelEn: product.labelEn,
        labelAr: product.labelAr,
        sortOrder: product.sortOrder,
        incomeRule: rule as unknown as Prisma.InputJsonValue,
        createdBy: actorId,
        updatedBy: actorId,
      },
    });
  }

  // The pipeline product belongs to `seed-collateral-products.ts`. Reported, not written —
  // an operator running only this seed should be told the library is incomplete rather
  // than left to notice a product is missing from the picker.
  const pipelines = await prisma.platformEnumeration.findMany({
    where: { type: SURROGATE_PRODUCT_TYPE, key: { in: [...PIPELINE_PRODUCT_KEYS] } },
    select: { key: true },
  });
  const absent = PIPELINE_PRODUCT_KEYS.filter((k) => !pipelines.some((p) => p.key === k));
  if (absent.length > 0) {
    console.log(
      `[seed-surrogate-products] not seeded here: ${absent.join(', ')} — ` +
        `run \`npm run seed:collateral\`, which seeds their questions and facts too.`,
    );
  }

  console.log(
    `[seed-surrogate-products]${DRY ? ' (dry run)' : ''} ` +
      `${written} written · ${unchanged} unchanged` +
      (rejected > 0 ? ` · ${rejected} REFUSED` : ''),
  );
  if (rejected > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error('[seed-surrogate-products] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
