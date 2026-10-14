/**
 * Quote EVERY active bank program through the real pricing cascade and the real
 * `quoteProgram`, for a fixed applicant matrix, and print one line per (program, applicant).
 *
 * Read-only. The sibling of `quote-surrogate-programmes.ts`, and it exists because that one
 * is structurally blind to this half: it evaluates the INCOME RULE only, so it cannot prove
 * that a change moved no RATE, no term and no instalment.
 *
 *   npx tsx scripts/quote-rates.ts > before.txt
 *
 * The assembly is the production read path, in production order:
 *
 *   bank_program (+ bank.isFeatured) + catalog income rules  → toBankProgramSnapshot
 *   → runCascade(snapshot, profile)   — the rate, the tenor ceiling and the loan ceiling
 *   → quoteProgram({ profile, program, parentKeyByValue })
 *
 * TWO readings per row, deliberately:
 *
 *   · the CASCADE columns always resolve, because the cascade runs before income does. A
 *     program whose income rule refuses still reports the rate it would have charged, which
 *     is what makes a rate regression visible on a program that quotes nothing.
 *   · the QUOTE columns are the customer-visible outcome, or the stated reason.
 *
 * The applicant matrix walks the tenor axis on the questionnaire's own 6-month grid, because
 * the two defects this was built to measure are both tenor-shaped: an exact-key rate table
 * that misses, and a rate picked on the term the customer ASKED for rather than the one the
 * loan is repaid over.
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
import { asRateDefaults } from '../src/matching/pipeline/rate-inherit';
import { toBankProgramSnapshot, type BankProgramRow } from '../src/bank-programs/bank-program-snapshot.mapper';
import { runCascade } from '../src/matching/pipeline/cascade-adapter';
import { quoteProgram } from '../src/matching/pipeline/quote';
import type { ApplicantProfile, IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();

function asRule(raw: unknown): IncomeAssumptionConfig | undefined {
  return raw === null || raw === undefined ? undefined : (raw as IncomeAssumptionConfig);
}

const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (code: string): SurrogateFactValue => ({ kind: 'choice', optionCode: code });

/**
 * Every fact any product reads, answered. Copied deliberately from
 * `quote-surrogate-programmes.ts`'s "A/senior" so a surrogate program's figure here is
 * comparable with the figure recorded there: a number that moves is a rule change and never
 * a missing answer.
 */
const FACTS: Record<string, SurrogateFactValue> = {
  military_grade: pick('grade_major_general'),
  academic_rank: pick('dean'),
  university_type: pick('uni_private'),
  years_in_practice: num('12'),
  practice_governorate: pick('cairo'),
  credit_card_limit: num('60000'),
  car_loan_installment: num('8000'),
  auto_loan_amount: num('400000'),
  pledged_free_amount: num('1000000'),
  pledged_months_since_issue: num('12'),
  car_down_payment: num('500000'),
  car_price: num('1000000'),
  total_savings: num('36000'),
  green_buyer_type: pick('instalment_buyer'),
  compound_name: pick('mivida'),
  owned_unit_type: pick('villa'),
  unit_paid_to_date: num('3000000'),
  unit_down_payment: num('1000000'),
  unit_contract_price: num('5000000'),
  unit_months_owned: num('36'),
  unit_owned_share_pct: num('100'),
  school_stage: pick('stage_secondary'),
  school_type: pick('school_international'),
  employer_coding: pick('coding_cat_a'),
  club_branch: pick('branch_new_cairo'),
  i_score: num('700'),
  business_months: pick('24m_or_more'),
  self_employed_licence: pick('yes'),
  hospital_sector: pick('private_hospital'),
  home_ownership: pick('owned_by_me'),
  unit_approved_compound: pick('yes'),
  car_loan_original_tenor: num('60'),
  car_loan_instalments_paid: num('36'),
  car_loan_down_payment: num('200000'),
};

interface Applicant {
  readonly name: string;
  readonly profile: ApplicantProfile;
}

function applicant(
  name: string,
  tenorMonths: number,
  over: { employmentType?: string; car?: { price: string; down: string } } = {},
): Applicant {
  const profile: ApplicantProfile = {
    age: 35,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal('500000'),
    preferredTenorMonths: tenorMonths,
    priority: 'lowest_installment',
    employment: {
      employmentType: over.employmentType ?? 'private_sector_employee',
      monthlyNetSalaryEGP: new Decimal('40000'),
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
    surrogateFacts: FACTS,
    ...(over.car === undefined
      ? {}
      : {
          carDetails: {
            carValueEGP: new Decimal(over.car.price),
            downPaymentEGP: new Decimal(over.car.down),
          },
        }),
  };
  return { name, profile };
}

/**
 * The tenor walk is the point. 12 / 60 / 84 are exact keys some program states; 36 and 72
 * fall BETWEEN stated keys; 96 and 120 sit above several programs' ceilings, which is where
 * the term the rate was picked on and the term the loan is repaid over come apart.
 *
 * The two car rows carry a real price and down payment so `downPaymentPercent` resolves and
 * the down-payment rate level can fire at all.
 */
const APPLICANTS: readonly Applicant[] = [
  applicant('salaried/12m', 12),
  applicant('salaried/36m', 36),
  applicant('salaried/60m', 60),
  applicant('salaried/72m', 72),
  applicant('salaried/84m', 84),
  applicant('salaried/96m', 96),
  applicant('salaried/120m', 120),
  applicant('selfemp/60m', 60, { employmentType: 'business_owner_company_owner' }),
  applicant('car40dp/60m', 60, { car: { price: '1000000', down: '400000' } }),
  applicant('car60dp/36m', 36, { car: { price: '1000000', down: '600000' } }),
];

const dec = (v: unknown): string =>
  v === null || v === undefined ? '-' : new Decimal(v as string).toFixed(2);

async function main(): Promise<void> {
  const enumRows = await prisma.platformEnumeration.findMany({
    where: { type: { in: ['program_name', 'surrogate_product'] } },
    select: {
      type: true,
      key: true,
      incomeRule: true,
      // The DURATION a product hands down. Selected here for the same reason
      // `quote-surrogate-programmes.ts` selects it: without it `effectiveTenor` sees no
      // default, and every programme that states no months of its own reaches `quoteProgram`
      // with no term at all and reports `PROGRAM_MISCONFIGURED` — which is not the production
      // read path, and would make this harness lie about exactly the rows a tenor change
      // touches.
      tenorDefaults: true,
      // The PLAN tables a product hands down — the rate grid above all, which is what this
      // harness exists to print. Omitting it is the same defect one field over: the snapshot
      // mapper merges nothing, the cascade falls past `rateByFact`, and every programme on
      // `plansSource: 'product'` is reported at its placeholder `baseRatePercent` with a flat
      // term ceiling. A harness that cannot see the grid it is measuring is worse than no
      // harness, because its output looks like evidence.
      planDefaults: true,
      // The flat RATE a product hands down, for the same reason the grid above it is read:
      // this harness exists to print what every programme is priced at, and since the
      // wizard stopped asking for a rate, most of them are priced from this column.
      rateDefaults: true,
      surrogateProductKey: true,
      active: true,
      deprecatedAt: true,
    },
  });

  const products = new Map<string, LinkedProduct>();
  for (const row of enumRows) {
    if (row.type !== 'surrogate_product') continue;
    products.set(row.key, {
      key: row.key,
      active: row.active,
      deprecatedAt: row.deprecatedAt,
      rule: asRule(row.incomeRule),
      tenorDefaults: asTenorDefaults(row.tenorDefaults),
      planDefaults: asPlanDefaults(row.planDefaults),
      rateDefaults: asRateDefaults(row.rateDefaults),
    });
  }
  const catalog = new Map<string, CatalogRuleResolution>();
  for (const row of enumRows) {
    if (row.type !== 'program_name') continue;
    const resolution = effectiveProgramNameRule(
      asRule(row.incomeRule),
      row.surrogateProductKey === null ? undefined : products.get(row.surrogateProductKey),
    );
    if (resolution !== undefined) catalog.set(row.key, resolution);
  }
  const parentRows = await prisma.platformEnumeration.findMany({
    where: { active: true, deprecatedAt: null, parentKey: { not: null } },
    select: { key: true, parentKey: true },
  });
  const parentKeyByValue: Record<string, string> = {};
  for (const row of parentRows) {
    if (row.parentKey !== null) parentKeyByValue[row.key] = row.parentKey;
  }

  const programs = await prisma.bankProgram.findMany({
    where: { active: true },
    include: { bank: { select: { isFeatured: true } } },
    orderBy: { programCode: 'asc' },
  });

  console.log(`# ${programs.length} active programs x ${APPLICANTS.length} applicants`);
  console.log(
    '# program | applicant | cascadeRate | matchedLevel | cascadeMaxTenor | effTenor | instalment | binding | reason',
  );

  for (const program of programs) {
    const snapshot = toBankProgramSnapshot(program as unknown as BankProgramRow, catalog);

    for (const { name, profile } of APPLICANTS) {
      const cascade = runCascade(snapshot, profile);
      const outcome = quoteProgram({ profile, program: snapshot, parentKeyByValue });

      const quoted = outcome.ok
        ? [
            String(outcome.quote.effectiveTenorMonths),
            dec(outcome.quote.monthlyInstallmentEGP),
            outcome.quote.bindingConstraint ?? '-',
            '-',
          ]
        : ['-', '-', '-', outcome.unavailable.reason];

      console.log(
        [
          program.programCode,
          name,
          cascade.pricing.effectiveRatePercent,
          cascade.pricing.matchedLevel,
          String(cascade.tenor.maxMonths),
          ...quoted,
        ].join(' | '),
      );
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
