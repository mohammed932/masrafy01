/**
 * WHAT DOES COVER COST this applicant, on every car programme that demands it?
 *
 * Read-only diagnostic, driven from the command line so any price, deposit and term can be
 * tried without editing a fixture:
 *
 *   npx tsx scripts/quote-car-insurance.ts <carPrice> <downPayment> [tenorMonths]
 *   npx tsx scripts/quote-car-insurance.ts 2000000 600000 60
 *
 * It walks the REAL read path — repository row -> `toBankProgramSnapshot` (where a product's
 * plan tables are merged in) -> `runCascade` -> `quoteProgram` — so every figure printed is
 * one a customer would be shown, not one this file worked out. In particular it prints the
 * premium off `quote.feesBreakdown`, never by multiplying the price itself: a harness that
 * redoes the engine's arithmetic proves only that it agrees with itself.
 *
 * The two columns to read together are the deposit SHARE and the premium. The share is what
 * the table is keyed on, and a programme printing `none` at 45% while charging at 35% is the
 * mechanism working: an absent row means this bank demands no cover at that deposit.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  effectiveProgramNameRule,
  type CatalogRuleResolution,
  type LinkedProduct,
} from '../src/matching/pipeline/income-rule-inherit';
import { asTenorDefaults } from '../src/matching/pipeline/tenor-inherit';
import { asPlanDefaults } from '../src/matching/pipeline/plan-inherit';
import {
  toBankProgramSnapshot,
  type BankProgramRow,
} from '../src/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '../src/matching/pipeline/quote';
import type {
  ApplicantProfile,
  IncomeAssumptionConfig,
  SurrogateFactValue,
} from '../src/matching/types';

const prisma = new PrismaClient();
const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (c: string): SurrogateFactValue => ({ kind: 'choice', optionCode: c });

function money(v: Decimal | string): string {
  return new Decimal(v).toDecimalPlaces(2).toNumber().toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function main(): Promise<void> {
  const [priceArg, downArg, tenorArg] = process.argv.slice(2);
  if (priceArg === undefined || downArg === undefined) {
    console.error('usage: npx tsx scripts/quote-car-insurance.ts <carPrice> <downPayment> [tenorMonths]');
    process.exit(2);
  }
  const price = new Decimal(priceArg);
  const down = new Decimal(downArg);
  const tenorMonths = tenorArg === undefined ? 60 : Number(tenorArg);
  if (!price.isFinite() || price.lessThanOrEqualTo(0)) throw new Error('carPrice must be > 0');
  if (!down.isFinite() || down.lessThan(0)) throw new Error('downPayment must be >= 0');

  const sharePercent = down.div(price).mul(100).toDecimalPlaces(2);

  // The catalog, resolved exactly as the quote path resolves it — a programme on
  // `plansSource: 'product'` stores no cover table of its own and reads the product's.
  const enumRows = await prisma.platformEnumeration.findMany({
    where: { type: { in: ['program_name', 'surrogate_product'] } },
    select: {
      type: true, key: true, incomeRule: true, tenorDefaults: true, planDefaults: true,
      surrogateProductKey: true, active: true, deprecatedAt: true,
    },
  });
  const products = new Map<string, LinkedProduct>();
  for (const row of enumRows) {
    if (row.type !== 'surrogate_product') continue;
    products.set(row.key, {
      key: row.key,
      active: row.active,
      deprecatedAt: row.deprecatedAt,
      rule: row.incomeRule === null ? undefined : (row.incomeRule as IncomeAssumptionConfig),
      tenorDefaults: asTenorDefaults(row.tenorDefaults),
      planDefaults: asPlanDefaults(row.planDefaults),
    });
  }
  const catalog = new Map<string, CatalogRuleResolution>();
  for (const row of enumRows) {
    if (row.type !== 'program_name') continue;
    const r = effectiveProgramNameRule(
      row.incomeRule === null ? undefined : (row.incomeRule as IncomeAssumptionConfig),
      row.surrogateProductKey === null ? undefined : products.get(row.surrogateProductKey),
    );
    if (r !== undefined) catalog.set(row.key, r);
  }

  const programs = await prisma.bankProgram.findMany({
    where: { productCategory: 'car', active: true },
    include: { bank: { select: { isFeatured: true } } },
    orderBy: { programCode: 'asc' },
  });

  const profile: ApplicantProfile = {
    age: 35,
    loanPurpose: 'car',
    requestedAmountEGP: price.minus(down),
    preferredTenorMonths: tenorMonths,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'private_sector_employee',
      monthlyNetSalaryEGP: new Decimal('400000'),
      monthsInJob: 48,
      salaryTransferType: 'none',
      companyName: 'Acme',
      companyType: 'private',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal('0'),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: {},
    surrogateFacts: {
      car_price: num(price.toString()),
      car_down_payment: num(down.toString()),
      car_origin: pick('germany'),
      car_fuel_type: pick('petrol_diesel'),
      home_ownership: pick('owned_by_me'),
      i_score: num('700'),
      business_months: pick('24m_or_more'),
      self_employed_licence: pick('yes'),
    },
    carDetails: { carValueEGP: price, downPaymentEGP: down },
  };

  console.log(`# car ${money(price)} · deposit ${money(down)} (${sharePercent}%) · asked for ${tenorMonths} months`);
  console.log('# programme | term | rate% | premium/yr | years | total cover | note');

  let charged = 0;
  for (const program of programs) {
    const snapshot = toBankProgramSnapshot(program as unknown as BankProgramRow, catalog);
    const out = quoteProgram({ profile, program: snapshot, skipEligibility: true });
    if (!out.ok) {
      console.log(`${program.programCode} | - | - | - | - | - | ${out.unavailable.reason}`);
      continue;
    }
    const b = out.quote.feesBreakdown;
    if (b.carInsuranceAnnualEGP === undefined) {
      console.log(
        `${program.programCode} | ${out.quote.effectiveTenorMonths} | ${out.quote.effectiveRatePercent} | none | - | - | no cover required at this deposit`,
      );
      continue;
    }
    charged += 1;
    console.log(
      `${program.programCode} | ${out.quote.effectiveTenorMonths} | ${out.quote.effectiveRatePercent} | ` +
        `${money(b.carInsuranceAnnualEGP)} | ${b.carInsuranceYears} | ${money(b.carInsuranceTotalEGP ?? '0')} | ` +
        `${b.carInsuranceRatePercent}% of the price, per year`,
    );
  }

  console.log(`# ${charged} of ${programs.length} active car programme(s) demand cover at this deposit`);
  await prisma.$disconnect();
}

void main();
