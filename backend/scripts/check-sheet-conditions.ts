/**
 * Every sheet condition, in both directions.
 *
 * A condition that never refuses is decoration, and one that refuses the wrong person is
 * worse than none — so each case below states the programme, the one answer it changes, and
 * the reason code the customer must be told. Read-only.
 *
 *   npx tsx scripts/check-sheet-conditions.ts
 *
 * Exit code is 0 when every case lands as stated, 1 otherwise, so it can gate a deploy.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  catalogRuleOf,
  effectiveIncomeRule,
  effectiveProgramNameRule,
  type CatalogRuleResolution,
  type LinkedProduct,
} from '../src/matching/pipeline/income-rule-inherit';
import { normalizeIncomeAssumption } from '../src/matching/pipeline/income-rule-normalize';
import { evaluateProductRule, type ProductRule } from '../src/matching/pipeline/product-rule';
import type { IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();
const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (code: string): SurrogateFactValue => ({ kind: 'choice', optionCode: code });

/** Answers every live condition passes on. Each case below changes exactly one of them. */
const PASSES: Record<string, SurrogateFactValue> = {
  years_in_practice: num('12'),
  practice_governorate: pick('cairo'),
  credit_card_limit: num('60000'),
  car_loan_installment: num('8000'),
  auto_loan_amount: num('400000'),
  pledged_free_amount: num('1000000'),
  pledged_months_since_issue: num('12'),
  car_down_payment: num('500000'),
  total_savings: num('36000'),
  green_buyer_type: pick('instalment_buyer'),
  compound_name: pick('mivida'),
  owned_unit_type: pick('villa'),
  unit_paid_to_date: num('3000000'),
  unit_down_payment: num('1000000'),
  unit_contract_price: num('5000000'),
  unit_months_owned: num('36'),
  unit_owned_share_pct: num('100'),
  business_months: pick('24m_or_more'),
  self_employed_licence: pick('yes'),
  hospital_sector: pick('private_hospital'),
  home_ownership: pick('owned_by_me'),
  unit_approved_compound: pick('yes'),
  car_loan_original_tenor: num('60'),
  car_loan_instalments_paid: num('36'),
  car_loan_down_payment: num('200000'),
};

interface Case {
  what: string;
  programCode: string;
  /** The one answer this case changes. */
  change: Record<string, SurrogateFactValue>;
  /** `null` = must still quote. */
  expectGate: string | null;
}

const CASES: readonly Case[] = [
  // ---- the two self-employed conditions, on every SCB auto programme and CAE compound ----
  {
    what: 'a business under two years',
    programCode: 'SCB-CAR-DP60',
    change: { business_months: pick('under_12m') },
    expectGate: 'BUSINESS_TOO_NEW',
  },
  {
    what: 'a business under two years, on the CAE compound programme',
    programCode: 'CAE-PER-COMPOUND_OWNER',
    change: { business_months: pick('12m_to_24m') },
    expectGate: 'BUSINESS_TOO_NEW',
  },
  {
    what: 'a self-employed applicant who is not self-employed — the EXEMPTION',
    programCode: 'SCB-CAR-DP60',
    change: {
      business_months: pick('not_self_employed'),
      self_employed_licence: pick('not_self_employed'),
    },
    expectGate: null,
  },
  {
    what: 'missing papers',
    programCode: 'SCB-CAR-DP60',
    change: { self_employed_licence: pick('no') },
    expectGate: 'SELF_EMPLOYED_DOCS_MISSING',
  },
  // ---- the doctors' sector exclusion ----
  {
    what: 'a government-hospital doctor',
    programCode: 'ABK-PER-DOCTORS_PRACTICE',
    change: { hospital_sector: pick('government_hospital') },
    expectGate: 'GATE_NOT_MET',
  },
  {
    what: 'somebody who works at no hospital at all — the EXEMPTION',
    programCode: 'ABK-PER-DOCTORS_PRACTICE',
    change: { hospital_sector: pick('not_at_a_hospital') },
    expectGate: null,
  },
  // ---- the 20% tier's home-ownership condition, and its four siblings that lack it ----
  {
    what: 'a renter on the 20% tier',
    programCode: 'SCB-CAR-DP20',
    change: { home_ownership: pick('rented_or_other') },
    expectGate: 'OWNERSHIP_NOT_CONFIRMED',
  },
  {
    what: 'the same renter on the 30% tier, which states no such condition',
    programCode: 'SCB-CAR-DP30',
    change: { home_ownership: pick('rented_or_other') },
    expectGate: null,
  },
  // ---- Green Finance's compound condition ----
  {
    what: 'a Green applicant with no approved compound',
    programCode: 'SCB-CAR-GREEN_POWER',
    change: { unit_approved_compound: pick('no') },
    expectGate: 'GATE_NOT_MET',
  },
  {
    what: 'the same answer on a down-payment tier, which states no such condition',
    programCode: 'SCB-CAR-DP40',
    change: { unit_approved_compound: pick('no') },
    expectGate: null,
  },
  // ---- the auto cross-sell's three conditions on the existing loan ----
  {
    what: 'fewer than 12 instalments paid',
    programCode: 'ABK-PER-AUTO_XSELL_ABK',
    change: { car_loan_instalments_paid: num('6') },
    expectGate: 'LOAN_TOO_NEW',
  },
  {
    what: 'past 12 instalments but under half the tenor',
    programCode: 'ABK-PER-AUTO_XSELL_ABK',
    change: { car_loan_instalments_paid: num('20'), car_loan_original_tenor: num('60') },
    expectGate: 'LOAN_TOO_NEW',
  },
  {
    what: 'exactly half the tenor, which the sheet accepts',
    programCode: 'ABK-PER-AUTO_XSELL_ABK',
    change: { car_loan_instalments_paid: num('30'), car_loan_original_tenor: num('60') },
    expectGate: null,
  },
  {
    what: 'a car booked with under 40% down',
    programCode: 'ABK-PER-AUTO_XSELL_ABK',
    change: { car_loan_down_payment: num('50000') },
    expectGate: 'DOWN_PAYMENT_BELOW_MIN',
  },
  {
    what: 'exactly 40% down, which the sheet accepts',
    programCode: 'ABK-PER-AUTO_XSELL_ABK',
    change: { car_loan_down_payment: num('160000') },
    expectGate: null,
  },
];

async function main(): Promise<void> {
  const rows = await prisma.platformEnumeration.findMany({
    where: { type: { in: ['program_name', 'surrogate_product'] } },
    select: {
      type: true,
      key: true,
      incomeRule: true,
      surrogateProductKey: true,
      active: true,
      deprecatedAt: true,
    },
  });
  const asRule = (raw: unknown): IncomeAssumptionConfig | undefined =>
    raw === null || raw === undefined ? undefined : (raw as IncomeAssumptionConfig);

  const products = new Map<string, LinkedProduct>();
  for (const row of rows) {
    if (row.type !== 'surrogate_product') continue;
    products.set(row.key, {
      key: row.key,
      active: row.active,
      deprecatedAt: row.deprecatedAt,
      rule: asRule(row.incomeRule),
    });
  }
  const catalog = new Map<string, CatalogRuleResolution>();
  for (const row of rows) {
    if (row.type !== 'program_name') continue;
    const r = effectiveProgramNameRule(
      asRule(row.incomeRule),
      row.surrogateProductKey === null ? undefined : products.get(row.surrogateProductKey),
    );
    if (r !== undefined) catalog.set(row.key, r);
  }
  const parentRows = await prisma.platformEnumeration.findMany({
    where: { active: true, deprecatedAt: null, parentKey: { not: null } },
    select: { key: true, parentKey: true },
  });
  const parentKeyByValue: Record<string, string> = {};
  for (const row of parentRows) if (row.parentKey !== null) parentKeyByValue[row.key] = row.parentKey;

  let failed = 0;
  for (const c of CASES) {
    const program = await prisma.bankProgram.findFirst({
      where: { programCode: c.programCode },
      select: { programNameKey: true, incomeAssumption: true },
    });
    if (program === null) {
      console.log(`MISSING ${c.programCode}`);
      failed++;
      continue;
    }
    const rule = normalizeIncomeAssumption(
      effectiveIncomeRule(
        program.incomeAssumption as unknown as IncomeAssumptionConfig,
        catalogRuleOf(
          program.programNameKey === null ? undefined : catalog.get(program.programNameKey),
        ),
      ),
    ) as unknown as ProductRule;

    const outcome = evaluateProductRule(rule, {
      facts: { ...PASSES, ...c.change },
      parentKeyByValue,
    });
    const got = outcome.ok
      ? null
      : ('gateReasonCode' in outcome && outcome.gateReasonCode) || `(${outcome.reason})`;
    const ok = got === c.expectGate;
    if (!ok) failed++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${c.programCode.padEnd(24)} ${c.what}\n` +
        `       expected ${c.expectGate ?? 'a quote'}, got ${got ?? `a quote (${outcome.ok ? outcome.valueEGP.toFixed(2) : ''})`}`,
    );
  }
  console.log(
    failed === 0
      ? `\nall ${CASES.length} condition cases land as stated`
      : `\n${failed} of ${CASES.length} case(s) did NOT`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
