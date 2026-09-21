/**
 * Quote EVERY bank program end-to-end through the real production read path, for the same
 * applicant at four bureau scores, and print one line per (program, score).
 *
 * Read-only.
 *
 *   npx tsx scripts/quote-iscore.ts > after.txt
 *
 * WHY THIS EXISTS BESIDE `quote:surrogate`. That harness calls `evaluateProductRule`
 * directly, so it measures the RULE's own answer. When the I-Score multiplier moved out of
 * the rule (v30.3.0) the rule's answer legitimately changed — it stopped multiplying — while
 * the figure a CUSTOMER is quoted did not, because `quoteProgram` step 2a now applies the
 * multiplier at exactly the point the deleted step occupied. Only a harness that runs the
 * whole quote can tell those two apart, and "no money moved" is a claim about the second.
 *
 * It is also the first harness that covers the OTHER 54 programs. `quote:surrogate` walks
 * the surrogate book alone, and the whole point of the change is that a payslip program can
 * now carry a tier table too — so a parity check that skipped them would have proved
 * nothing about the 42 rows most likely to be disturbed.
 *
 * The assembly is the production read path and not a reconstruction of it:
 *
 *   findAllActive-shaped query → buildCatalogRules (the repository's own resolution)
 *   → toBankProgramSnapshot(row, catalogRules) → quoteProgram(...)
 *
 * so a figure here is the figure the apply path would freeze onto an offer.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  catalogRuleOf,
  effectiveProgramNameRule,
  type CatalogRuleResolution,
  type LinkedProduct,
} from '../src/matching/pipeline/income-rule-inherit';
import { asTenorDefaults } from '../src/matching/pipeline/tenor-inherit';
import { toBankProgramSnapshot } from '../src/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '../src/matching/pipeline/quote';
import type { ApplicantProfile, IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();

const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (code: string): SurrogateFactValue => ({ kind: 'choice', optionCode: code });

/**
 * Every fact any product reads, answered, so a figure that moves is a policy change and
 * never a missing answer. Copied from `quote-surrogate-programmes.ts`' applicant A so the
 * two harnesses can be read against each other, MINUS `i_score`, which the loop below
 * varies and is the one axis under test.
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
  business_months: pick('24m_or_more'),
  self_employed_licence: pick('yes'),
  hospital_sector: pick('private_hospital'),
  home_ownership: pick('owned_by_me'),
  unit_approved_compound: pick('yes'),
  car_loan_original_tenor: num('60'),
  car_loan_instalments_paid: num('36'),
  car_loan_down_payment: num('200000'),
};

/**
 * `undefined` is the CONTROL and the most important column: the question is optional, so the
 * commonest real applicant answers nothing, and their figure must be untouched by every
 * tier table on the platform. The three scores straddle the seeded 0–550 / 550–700 / 700+
 * edges (×0.80 / ×1.00 / ×1.10), and 700 is deliberately ON an edge — the tiers are
 * half-open `[from, to)`, so 700 belongs to the top band and a reader that got that wrong
 * would show up here rather than in a customer's offer.
 */
const SCORES: ReadonlyArray<string | undefined> = [undefined, '500', '600', '700', '750'];

function profileAt(score: string | undefined): ApplicantProfile {
  return {
    age: 36,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal('500000'),
    preferredTenorMonths: 60,
    priority: 'lowest_installment',
    employment: {
      monthlyNetSalaryEGP: new Decimal('40000'),
      employmentType: 'private_sector_employee',
      monthsInJob: 48,
      salaryTransferType: 'transfer_to_bank',
    },
    obligations: { existingMonthlyObligationsEGP: new Decimal('2000') },
    assets: {},
    // Every car programme needs a priced car, or the LTV ceiling and the down-payment
    // product have nothing to read and the whole car book reports a stated reason instead
    // of a figure — which would make 19 of the 71 rows useless as a parity check.
    carDetails: { carValueEGP: new Decimal('1000000'), downPaymentEGP: new Decimal('500000') },
    mortgageDetails: {
      propertyValueEGP: new Decimal('5000000'),
      downPaymentEGP: new Decimal('1000000'),
      propertyType: 'apartment',
      isCompound: true,
      constructionStage: 'ready',
    },
    surrogateFacts: score === undefined ? FACTS : { ...FACTS, i_score: num(score) },
  } as unknown as ApplicantProfile;
}

/** The repository's own catalog resolution, so a name resolves here as it does in production. */
async function buildCatalogRules(): Promise<Map<string, CatalogRuleResolution>> {
  const rows = await prisma.platformEnumeration.findMany({
    where: { type: { in: ['program_name', 'surrogate_product'] } },
  });
  const products = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.type === 'surrogate_product') products.set(r.key, r);

  const out = new Map<string, CatalogRuleResolution>();
  for (const name of rows.filter((r) => r.type === 'program_name')) {
    const productRow =
      name.surrogateProductKey === null ? undefined : products.get(name.surrogateProductKey);
    const linked: LinkedProduct | undefined =
      productRow === undefined
        ? undefined
        : ({
            key: productRow.key,
            active: productRow.active,
            deprecatedAt: productRow.deprecatedAt,
            rule: (productRow.incomeRule ?? undefined) as IncomeAssumptionConfig | undefined,
            tenorDefaults: asTenorDefaults(productRow.tenorDefaults),
            planDefaults: (productRow.planDefaults ?? undefined) as never,
            loanAmountDefaults: (productRow.loanAmountDefaults ?? undefined) as never,
            // Absent at HEAD, where the column does not exist — the harness runs on both
            // trees, and `?? undefined` is what lets it.
            iScoreDefaults: ((productRow as Record<string, unknown>)['iScoreDefaults'] ??
              undefined) as never,
          } satisfies LinkedProduct);
    const resolution = effectiveProgramNameRule(
      (name.incomeRule ?? null) as IncomeAssumptionConfig | null,
      linked,
    );
    if (resolution !== undefined) out.set(name.key, resolution);
  }
  // Touched so the import is load-bearing and the resolution is asserted non-empty.
  if ([...out.values()].filter((r) => catalogRuleOf(r) !== undefined).length === 0) {
    throw new Error('quote-iscore: no catalog name resolved to a rule — the map is wrong');
  }
  return out;
}

async function main(): Promise<void> {
  const catalogRules = await buildCatalogRules();
  const programs = await prisma.bankProgram.findMany({
    where: { active: true },
    include: { bank: { select: { isFeatured: true } } },
    orderBy: { programCode: 'asc' },
  });

  for (const row of programs) {
    const snapshot = toBankProgramSnapshot(row, catalogRules);
    for (const score of SCORES) {
      const label = `${row.programCode.padEnd(24)} ${(score ?? 'blank').padEnd(6)}`;
      let line: string;
      try {
        const result = quoteProgram({
          profile: profileAt(score),
          program: snapshot,
          skipDbrCheck: false,
        });
        line = result.ok
          ? [
              `income=${result.quote.recognisedIncomeEGP.toFixed(2)}`,
              `offered=${result.quote.offeredAmountEGP.toFixed(2)}`,
              `cash=${result.quote.cashToCustomerEGP.toFixed(2)}`,
              `emi=${result.quote.monthlyInstallmentEGP.toFixed(2)}`,
              `max=${result.quote.maxAffordableAmountEGP.toFixed(2)}`,
              `dbr=${result.quote.dbrPercent.toFixed(2)}/${result.quote.dbrCapPercent.toFixed(4)}`,
              `band=${result.quote.dbrBandIndex ?? '-'}`,
              `term=${result.quote.effectiveTenorMonths}`,
              `rate=${result.quote.effectiveRatePercent.toFixed(4)}`,
              `bind=${result.quote.bindingConstraint}`,
              `ceiling=${result.quote.collateralCeilingEGP?.toFixed(2) ?? '-'}`,
              `dp=${result.quote.requiredDownPaymentEGP?.toFixed(2) ?? '-'}`,
            ].join(' ')
          : `UNAVAILABLE ${result.unavailable.reason}`;
      } catch (error) {
        line = `THREW ${(error as Error).message}`;
      }
      console.log(`${label} ${line}`);
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
