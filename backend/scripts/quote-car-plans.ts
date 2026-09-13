/**
 * The Suez Canal down-payment card, quoted plan by plan through the REAL read path.
 *
 * Read-only. Repository row -> `toBankProgramSnapshot` (which is where the product's plan
 * tables are merged in) -> `runCascade` -> `quoteProgram`, so every figure below is one a
 * customer would be shown. Exit 0 when every case lands as stated, 1 otherwise, so it can
 * gate a deploy.
 *
 * The matrix is the deposit against the car and the home, because those are the three axes
 * the card keys on: the deposit picks the plan, the origin and the fuel pick the rate column,
 * and who owns the home decides whether the 20% tier is sold at all.
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
import { toBankProgramSnapshot, type BankProgramRow } from '../src/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '../src/matching/pipeline/quote';
import type { ApplicantProfile, IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();
const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (c: string): SurrogateFactValue => ({ kind: 'choice', optionCode: c });



interface Case {
  what: string;
  price: string;
  down: string;
  origin: string;
  fuel: string;
  home: string;
  tenor: number;
  expectRate: string | null;
  expectMax: string | null;
  expectReason?: string;
}

const P = '1000000';
const BIG = '3000000';

const CASES: Case[] = [
  // deposit band -> rate, and the financed share the amount is capped at.
  { price: BIG, what: '20% down, owner, petrol', down: '600000', origin: 'germany', fuel: 'petrol_diesel', home: 'owned_by_me', tenor: 84, expectRate: '10', expectMax: '2400000' },
  { price: BIG, what: '25% down, relative owns home', down: '750000', origin: 'germany', fuel: 'petrol_diesel', home: 'owned_by_relative', tenor: 84, expectRate: '10', expectMax: '2400000' },
  { price: P, what: '35% down, owner', down: '350000', origin: 'germany', fuel: 'petrol_diesel', home: 'owned_by_me', tenor: 84, expectRate: '9', expectMax: '700000' },
  { price: P, what: '45% down, owner', down: '450000', origin: 'germany', fuel: 'petrol_diesel', home: 'owned_by_me', tenor: 84, expectRate: '8', expectMax: '600000' },
  { price: P, what: '55% down, owner', down: '550000', origin: 'germany', fuel: 'petrol_diesel', home: 'owned_by_me', tenor: 84, expectRate: '7', expectMax: '500000' },
  { price: P, what: '65% down, owner', down: '650000', origin: 'germany', fuel: 'petrol_diesel', home: 'owned_by_me', tenor: 84, expectRate: '6', expectMax: '400000' },
  // the car-type columns
  { price: P, what: '35% down, CHINESE car', down: '350000', origin: 'china', fuel: 'petrol_diesel', home: 'owned_by_me', tenor: 84, expectRate: '11', expectMax: '700000' },
  { price: P, what: '35% down, ELECTRIC car', down: '350000', origin: 'germany', fuel: 'electric', home: 'owned_by_me', tenor: 84, expectRate: '8', expectMax: '700000' },
  { price: P, what: '35% down, HYBRID car', down: '350000', origin: 'germany', fuel: 'hybrid', home: 'owned_by_me', tenor: 84, expectRate: '8', expectMax: '700000' },
  // a Chinese electric car: origin outranks fuel, stated in the seed.
  { price: P, what: '35% down, Chinese ELECTRIC (origin wins)', down: '350000', origin: 'china', fuel: 'electric', home: 'owned_by_me', tenor: 84, expectRate: '11', expectMax: '700000' },
  // the band-scoped condition: a renter is refused at 20-30% and priced everywhere else.
  { price: BIG, what: '25% down, RENTER — refused in that band alone', down: '750000', origin: 'germany', fuel: 'petrol_diesel', home: 'rented_or_other', tenor: 84, expectRate: null, expectMax: null, expectReason: 'VEHICLE_NOT_ELIGIBLE' },
  { price: P, what: '65% down, RENTER — priced', down: '650000', origin: 'germany', fuel: 'petrol_diesel', home: 'rented_or_other', tenor: 84, expectRate: '6', expectMax: '400000' },
  // Below the lowest tier the sheet prints. The RATE grid refuses first — it is read in the
  // pricing cascade, before the financed share is looked at — so the reason is
  // `NO_RATE_FOR_ANSWER` and not the share's `VEHICLE_NOT_ELIGIBLE`. Both are true and the
  // first one reached is the honest one: this bank states no price for a 15% deposit.
  { price: P, what: '15% down — below every plan', down: '150000', origin: 'germany', fuel: 'petrol_diesel', home: 'owned_by_me', tenor: 84, expectRate: null, expectMax: null, expectReason: 'NO_RATE_FOR_ANSWER' },
];

function profileFor(c: Case): ApplicantProfile {
  const PRICE = c.price;
  return {
    age: 35,
    loanPurpose: 'car',
    requestedAmountEGP: new Decimal('5000000'),
    preferredTenorMonths: c.tenor,
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
      car_price: num(PRICE),
      car_down_payment: num(c.down),
      car_origin: pick(c.origin),
      car_fuel_type: pick(c.fuel),
      home_ownership: pick(c.home),
      i_score: num('700'),
      business_months: pick('24m_or_more'),
      self_employed_licence: pick('yes'),
    },
    carDetails: { carValueEGP: new Decimal(PRICE), downPaymentEGP: new Decimal(c.down) },
  };
}

async function main(): Promise<void> {
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

  const program = await prisma.bankProgram.findUnique({
    where: { programCode: 'SCB-CAR-DOWN_PAYMENT' },
    include: { bank: { select: { isFeatured: true } } },
  });
  if (program === null) throw new Error('SCB-CAR-DOWN_PAYMENT not found — run seed:sheet-figures');
  const snapshot = toBankProgramSnapshot(program as unknown as BankProgramRow, catalog);

  console.log('# Suez Canal down-payment card — car price 1,000,000');
  console.log('# case | rate | maxAmount | term | binding | reason | VERDICT');
  let failures = 0;
  for (const c of CASES) {
    const out = quoteProgram({ profile: profileFor(c), program: snapshot, skipEligibility: true });
    const rate = out.ok ? out.quote.effectiveRatePercent.toString() : '-';
    const max = out.ok ? out.quote.maxAffordableAmountEGP.toString() : '-';
    const term = out.ok ? String(out.quote.effectiveTenorMonths) : '-';
    const binding = out.ok ? (out.quote.bindingConstraint ?? '-') : '-';
    const reason = out.ok ? '-' : out.unavailable.reason;

    let verdict = 'OK';
    if (c.expectReason !== undefined) {
      if (out.ok || reason !== c.expectReason) verdict = `FAIL expected ${c.expectReason}`;
    } else if (!out.ok) {
      verdict = `FAIL expected a quote, got ${reason}`;
    } else {
      if (c.expectRate !== null && !new Decimal(rate).equals(new Decimal(c.expectRate))) {
        verdict = `FAIL rate expected ${c.expectRate}`;
      } else if (c.expectMax !== null && !new Decimal(max).equals(new Decimal(c.expectMax))) {
        verdict = `FAIL max expected ${c.expectMax}`;
      }
    }
    if (verdict !== 'OK') failures += 1;
    console.log(`${c.what} | ${rate} | ${max} | ${term} | ${binding} | ${reason} | ${verdict}`);
  }
  console.log(`\n# ${CASES.length - failures}/${CASES.length} cases as stated`);
  await prisma.$disconnect();
  if (failures > 0) process.exit(1);
}

void main();
