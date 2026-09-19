/**
 * Crédit Agricole's three auto programmes, quoted through the REAL read path.
 *
 * Read-only. Repository row -> `toBankProgramSnapshot` -> `quoteProgram`, so every figure
 * below is one a customer would be shown. Exit 0 when every case lands as stated, 1
 * otherwise, so it can gate a deploy.
 *
 * The matrix is the deposit against the car, because those are the axes the guide keys on:
 * the deposit picks the financed share, the origin picks the loan ceiling, and the fuel
 * decides which of the petrol and electric programmes will quote at all.
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

interface Case {
  programCode: string;
  what: string;
  price: string;
  down: string;
  origin: string;
  fuel: string;
  /** Who is selling it. Absent means the applicant skipped the optional question. */
  dealer?: string;
  /** The model year, relative to the year the script runs — never a frozen literal. */
  ageYears?: number;
  tenor: number;
  /** The financed share the amount must be capped at, or the ceiling the origin states. */
  expectMax: string | null;
  /** The term the vehicle table clamps to, where the Chinese rule applies. */
  expectTerm?: number;
  /**
   * Always `program_max_by_fact` on this bank, and that is worth knowing rather than
   * hiding behind an expectation.
   *
   * `ltv_ceiling`, `collateral_ceiling` and `program_max_by_fact` all sit at precedence 5,
   * and `noteConstraint` breaks a tie with a strict `>` — so whichever is noted FIRST wins,
   * and the origin table (quote.ts:639) is noted before the financed share (quote.ts:717).
   * Every Crédit Agricole programme carries both, so the deposit can never be the reported
   * headline here even on the rows where it is the number that actually bound. The AMOUNTS
   * below are the assertion that matters; this field pins the reporting as it is today so a
   * change to it is a visible diff rather than a surprise.
   */
  expectReason?: string;
  expectBinding?: string;
}

/** A salary big enough that DBR never binds — these cases are about the CAR, not the wallet. */
const INCOME = '400000';

const CASES: Case[] = [
  // ── New Car: the three deposit tiers, each capping at its own financed share ──
  { programCode: 'CAE-CAR-NEW_CAR', what: '20% down -> finances 80%', price: '1000000', down: '200000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: '800000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-NEW_CAR', what: '40% down -> finances 60%', price: '1000000', down: '400000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-NEW_CAR', what: '50% down -> finances 50%', price: '1000000', down: '500000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: '500000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-NEW_CAR', what: '60% down -> still the 50% row', price: '1000000', down: '600000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: '500000', expectBinding: 'program_max_by_fact' },
  // A deposit under the lowest tier the card sells.
  { programCode: 'CAE-CAR-NEW_CAR', what: '10% down -> below every tier', price: '1000000', down: '100000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: null, expectReason: 'VEHICLE_NOT_ELIGIBLE' },

  // ── The origin ceiling: 7M for a German car, 4M for a Chinese one ──
  { programCode: 'CAE-CAR-NEW_CAR', what: 'German car, 20% down on 20M -> 7M ceiling', price: '20000000', down: '4000000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: '7000000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-NEW_CAR', what: 'Chinese car, same -> 4M ceiling', price: '20000000', down: '4000000', origin: 'china', fuel: 'petrol_diesel', tenor: 84, expectMax: '4000000', expectBinding: 'program_max_by_fact' },

  // ── Used Car: one share for both tiers, and the same origin ceiling ──
  { programCode: 'CAE-CAR-USED_CAR', what: '40% down -> finances 60%', price: '1000000', down: '400000', origin: 'japan', fuel: 'petrol_diesel', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-USED_CAR', what: '50% down -> still 60%', price: '1000000', down: '500000', origin: 'japan', fuel: 'petrol_diesel', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-USED_CAR', what: '30% down -> under the card', price: '1000000', down: '300000', origin: 'japan', fuel: 'petrol_diesel', tenor: 84, expectMax: null, expectReason: 'VEHICLE_NOT_ELIGIBLE' },

  // ── EV: the 35% tier reaching 65%, and petrol refused HERE ──
  { programCode: 'CAE-CAR-EV', what: 'electric, 35% down -> finances 65%', price: '1000000', down: '350000', origin: 'china', fuel: 'electric', tenor: 84, expectMax: '650000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-EV', what: 'electric, 50% down -> finances 50%', price: '1000000', down: '500000', origin: 'china', fuel: 'electric', tenor: 84, expectMax: '500000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-EV', what: 'hybrid accepted on the same terms', price: '1000000', down: '350000', origin: 'japan', fuel: 'hybrid', tenor: 84, expectMax: '650000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-EV', what: 'PETROL refused on the EV card', price: '1000000', down: '350000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: null, expectReason: 'VEHICLE_NOT_ELIGIBLE' },

  // ── The Chinese-car term rule, printed on every page of the guide ──
  // A German car is untouched by it; a Chinese one drops to 60 unless Ghabbour is selling.
  { programCode: 'CAE-CAR-NEW_CAR', what: 'German car keeps the full 84', price: '1000000', down: '400000', origin: 'germany', fuel: 'petrol_diesel', dealer: 'other_authorized', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact', expectTerm: 84 },
  { programCode: 'CAE-CAR-NEW_CAR', what: 'Chinese car -> 60 months', price: '1000000', down: '400000', origin: 'china', fuel: 'petrol_diesel', dealer: 'other_authorized', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact', expectTerm: 60 },
  { programCode: 'CAE-CAR-NEW_CAR', what: 'Chinese via GHABBOUR -> 84 months', price: '1000000', down: '400000', origin: 'china', fuel: 'petrol_diesel', dealer: 'ghabbour_mansour', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact', expectTerm: 84 },
  // The extension must be CLAIMED, never assumed: a skipped dealer question is still 60.
  { programCode: 'CAE-CAR-NEW_CAR', what: 'Chinese, dealer unanswered -> still 60', price: '1000000', down: '400000', origin: 'china', fuel: 'petrol_diesel', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact', expectTerm: 60 },
  { programCode: 'CAE-CAR-USED_CAR', what: 'Chinese used car -> 60 months', price: '1000000', down: '400000', origin: 'china', fuel: 'petrol_diesel', dealer: 'other_authorized', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact', expectTerm: 60 },
  // On the EV card the same rule rides a grid that ALSO refuses petrol — three axes, one table.
  { programCode: 'CAE-CAR-EV', what: 'Chinese electric -> 60 months', price: '1000000', down: '350000', origin: 'china', fuel: 'electric', dealer: 'other_authorized', tenor: 84, expectMax: '650000', expectBinding: 'program_max_by_fact', expectTerm: 60 },
  { programCode: 'CAE-CAR-EV', what: 'Chinese electric via GHABBOUR -> 84', price: '1000000', down: '350000', origin: 'china', fuel: 'electric', dealer: 'ghabbour_mansour', tenor: 84, expectMax: '650000', expectBinding: 'program_max_by_fact', expectTerm: 84 },
  { programCode: 'CAE-CAR-EV', what: 'petrol from Ghabbour is STILL refused', price: '1000000', down: '350000', origin: 'china', fuel: 'petrol_diesel', dealer: 'ghabbour_mansour', tenor: 84, expectMax: null, expectReason: 'VEHICLE_NOT_ELIGIBLE' },

  // ── Used-car age eligibility: a REFUSAL, independent of the tenor rule above ──
  // 8 years for every origin, 5 for a Chinese car unless Ghabbour is selling (then 8).
  { programCode: 'CAE-CAR-USED_CAR', what: 'German, 8yo -> at the limit, still priced', price: '1000000', down: '400000', origin: 'germany', fuel: 'petrol_diesel', ageYears: 8, tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-USED_CAR', what: 'German, 9yo -> too old, refused', price: '1000000', down: '400000', origin: 'germany', fuel: 'petrol_diesel', ageYears: 9, tenor: 84, expectMax: null, expectReason: 'VEHICLE_NOT_ELIGIBLE' },
  // The case a naive wildcard-plus-age-band design would have leaked: 6 years exceeds
  // China's OWN 5-year limit even though it is inside every other origin's 8-year one.
  { programCode: 'CAE-CAR-USED_CAR', what: 'Chinese, non-Ghabbour, 5yo -> at ITS OWN limit, priced', price: '1000000', down: '400000', origin: 'china', fuel: 'petrol_diesel', dealer: 'other_authorized', ageYears: 5, tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact' },
  { programCode: 'CAE-CAR-USED_CAR', what: 'Chinese, non-Ghabbour, 6yo -> refused (would pass on a leaky wildcard)', price: '1000000', down: '400000', origin: 'china', fuel: 'petrol_diesel', dealer: 'other_authorized', ageYears: 6, tenor: 84, expectMax: null, expectReason: 'VEHICLE_NOT_ELIGIBLE' },
  { programCode: 'CAE-CAR-USED_CAR', what: 'Chinese via GHABBOUR, 8yo -> extended, priced', price: '1000000', down: '400000', origin: 'china', fuel: 'petrol_diesel', dealer: 'ghabbour_mansour', ageYears: 8, tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact' },
  // The model year is optional — skipping it must not refuse.
  { programCode: 'CAE-CAR-USED_CAR', what: 'model year unanswered -> not refused', price: '1000000', down: '400000', origin: 'germany', fuel: 'petrol_diesel', tenor: 84, expectMax: '600000', expectBinding: 'program_max_by_fact' },
];

function profileFor(c: Case): ApplicantProfile {
  return {
    age: 35,
    loanPurpose: 'car',
    requestedAmountEGP: new Decimal('50000000'),
    preferredTenorMonths: c.tenor,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'private_sector_employee',
      monthlyNetSalaryEGP: new Decimal(INCOME),
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
      car_price: num(c.price),
      car_down_payment: num(c.down),
      car_origin: pick(c.origin),
      car_fuel_type: pick(c.fuel),
      ...(c.dealer !== undefined ? { car_dealer: pick(c.dealer) } : {}),
      ...(c.ageYears !== undefined
        ? { car_model_year: num(String(new Date().getFullYear() - c.ageYears)) }
        : {}),
      i_score: num('700'),
    },
    carDetails: {
      carValueEGP: new Decimal(c.price),
      downPaymentEGP: new Decimal(c.down),
    },
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

  const snapshots = new Map<string, ReturnType<typeof toBankProgramSnapshot>>();
  for (const code of ['CAE-CAR-NEW_CAR', 'CAE-CAR-USED_CAR', 'CAE-CAR-EV']) {
    const program = await prisma.bankProgram.findUnique({
      where: { programCode: code },
      include: { bank: { select: { isFeatured: true } } },
    });
    if (program === null) throw new Error(`${code} not found — run seed:sheet-figures`);
    snapshots.set(code, toBankProgramSnapshot(program as unknown as BankProgramRow, catalog));
  }

  console.log('# Crédit Agricole auto book, quoted through the real read path');
  console.log('# programme | case | maxAmount | term | reason | VERDICT');
  let failures = 0;
  for (const c of CASES) {
    const snapshot = snapshots.get(c.programCode);
    if (snapshot === undefined) throw new Error(`no snapshot for ${c.programCode}`);
    const out = quoteProgram({ profile: profileFor(c), program: snapshot, skipEligibility: true });
    const max = out.ok ? out.quote.maxAffordableAmountEGP.toString() : '-';
    const binding = out.ok ? (out.quote.bindingConstraint ?? '-') : '-';
    const term = out.ok ? String(out.quote.effectiveTenorMonths) : '-';
    const reason = out.ok ? '-' : out.unavailable.reason;

    let verdict = 'OK';
    if (c.expectReason !== undefined) {
      if (out.ok || reason !== c.expectReason) verdict = `FAIL expected ${c.expectReason}`;
    } else if (!out.ok) {
      verdict = `FAIL expected a quote, got ${reason}`;
    } else if (c.expectMax !== null && !new Decimal(max).equals(new Decimal(c.expectMax))) {
      verdict = `FAIL max expected ${c.expectMax}`;
    } else if (c.expectBinding !== undefined && binding !== c.expectBinding) {
      verdict = `FAIL binding expected ${c.expectBinding}`;
    } else if (c.expectTerm !== undefined && out.ok && out.quote.effectiveTenorMonths !== c.expectTerm) {
      verdict = `FAIL term expected ${c.expectTerm} got ${out.quote.effectiveTenorMonths}`;
    }
    if (verdict !== 'OK') failures += 1;
    console.log(
      `${c.programCode.replace('CAE-CAR-', '').padEnd(9)} | ${c.what.padEnd(40)} | ${max.padStart(8)} | ${term.padStart(3)} | ${reason.padEnd(21)} | ${verdict}`,
    );
  }
  console.log(`\n# ${CASES.length - failures}/${CASES.length} cases as stated`);
  await prisma.$disconnect();
  if (failures > 0) process.exitCode = 1;
}

void main();
