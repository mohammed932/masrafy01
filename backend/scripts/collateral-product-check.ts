/**
 * The seeded collateral products, quoted end to end against the REAL rows.
 *
 *   npx tsx scripts/collateral-product-check.ts
 *
 * Read-only. Nothing is written, nothing is persisted — it loads each program and its
 * catalog rule exactly as `applications.service.ts` does, builds the source design's own
 * baseline applicant, and prints what the engine produces.
 *
 * This exists because the unit suites prove the ARITHMETIC and the DATA separately. A rule
 * can be valid and a program can be live and the two can still fail to meet: the catalog's
 * step ids and the bank's `stepParams` keys are joined by string, and nothing but a real
 * quote proves that join holds. The four expected ceilings below are §10 of the source
 * design, so a drift in either half shows up as a number, not as a passing test.
 *
 * Exit code is 0 when every program quotes as expected, 1 when any does not, so it can gate
 * a deploy the same way `income-proof-conflicts.ts` does.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { toBankProgramSnapshot } from '../src/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '../src/matching/pipeline/quote';
import type { ApplicantProfile, IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();

/** §10 baseline: a 3 000 000 apartment in a Class-C compound, 20% paid, 5 years, no debts. */
const BASELINE_FACTS: Record<string, SurrogateFactValue> = {
  compound_unit_price: { kind: 'numeric', value: new Decimal('3000000') },
  compound_dp_percent: { kind: 'numeric', value: new Decimal('20') },
  compound_unit_type: { kind: 'choice', optionCode: 'apartment' },
  compound_name: { kind: 'choice', optionCode: 'other' },
  compound_contract_year: { kind: 'choice', optionCode: 'before2021' },
  compound_months_since_purchase: { kind: 'numeric', value: new Decimal('36') },
  compound_fully_settled: { kind: 'choice', optionCode: 'no' },
  compound_joint_unit: { kind: 'choice', optionCode: 'mine_only' },
  compound_multi_unit: { kind: 'choice', optionCode: 'no' },
  compound_best_unit_confirmed: { kind: 'choice', optionCode: 'yes' },
  club_class: { kind: 'choice', optionCode: 'class_1' },
  employment_status: { kind: 'choice', optionCode: 'private_sector_employee' },
};

/**
 * What each program should say about that applicant.
 *
 * A CEILING where the applicant clears the bank's conditions, and a stated REFUSAL where they
 * do not — because both are correct answers and a check that only knew how to expect a number
 * would call the refusal a bug.
 *
 * EGBank is the interesting one. §10 of the source design lists it at a 2 000 000 cap for this
 * applicant, but EGBank requires 40% down on a unit under 10 million and this applicant has
 * paid 20%. Its prototype computed the cap anyway and reported the down-payment failure as a
 * separate flag — the same masking its own bug #1 describes, where a wrong number is shown
 * beside a right verdict. Here the gate refuses first and says which gate, and the applicant
 * who does clear it (the 40% variant below) gets exactly the 2 000 000.
 */
type Expectation = { ceilingEGP: string } | { refusedWith: string };

const BASELINE_EXPECTATION: Readonly<Record<string, Expectation>> = {
  'ABK-COMPOUND-GUARANTEE': { ceilingEGP: '2000000' },
  'EGB-COMPOUND-GUARANTEE': { refusedWith: 'DOWN_PAYMENT_BELOW_MIN' },
  'FAB-COMPOUND-GUARANTEE': { ceilingEGP: '1000000' },
  'CAE-COMPOUND-GUARANTEE': { ceilingEGP: '300000' },
  'ABK-CLUB-MEMBERSHIP': { ceilingEGP: '500000' },

  // The two banks that state nothing and take the catalog's defaults. They are here for the
  // same reason as the five above: a rule can be valid and a program live while the string
  // join between the catalog's step ids and a bank's `stepParams` keys silently fails — and
  // for an INHERITING bank there are no `stepParams` at all, so what is being proved is that
  // `effectiveIncomeRule` puts the catalog's there. An apartment is 2 000 000 by the catalog's
  // own `capByUnitType` table, and a class-1 membership 500 000 by its `ceiling` table, so
  // each of these must land on exactly the figure its own-figures peer lands on.
  'NBE-COMPOUND-GUARANTEE': { ceilingEGP: '2000000' },
  'CIB-CLUB-MEMBERSHIP': { ceilingEGP: '500000' },
};

/** The same unit with 40% paid — the applicant EGBank's own tier accepts. */
const HIGH_DOWN_PAYMENT_EXPECTATION: Readonly<Record<string, Expectation>> = {
  'EGB-COMPOUND-GUARANTEE': { ceilingEGP: '2000000' },
};

function profile(obligationsEGP: string, dpPercent = '20'): ApplicantProfile {
  return {
    age: 35,
    loanPurpose: 'personal',
    // Above every ceiling, so the collateral is what binds rather than the ask.
    requestedAmountEGP: new Decimal('6000000'),
    preferredTenorMonths: 60,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'salaried',
      // ZERO. These products read no payslip, and a salary here would hide a rule that
      // silently fell back to it.
      monthlyNetSalaryEGP: new Decimal('0'),
      monthsInJob: 48,
      salaryTransferType: 'none',
      companyName: '',
      companyType: 'private',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal(obligationsEGP),
      hasCurrentLoan: obligationsEGP !== '0',
      hasPreviousRejection: false,
    },
    assets: { ownsCompoundProperty: true, clubMembership: true },
    surrogateFacts: { ...BASELINE_FACTS, compound_dp_percent: { kind: 'numeric', value: new Decimal(dpPercent) } },
  };
}

async function main(): Promise<void> {
  const programs = await prisma.bankProgram.findMany({
    where: { programCode: { in: Object.keys(BASELINE_EXPECTATION) } },
    include: { bank: { select: { isFeatured: true } } },
  });

  const catalogRows = await prisma.platformEnumeration.findMany({
    where: { type: 'program_name' },
    select: { key: true, incomeRule: true },
  });
  const catalogRules = new Map(
    catalogRows.flatMap((row) =>
      row.incomeRule === null || typeof row.incomeRule !== 'object'
        ? []
        : [[row.key, row.incomeRule as unknown as IncomeAssumptionConfig] as const],
    ),
  );

  const parentRows = await prisma.platformEnumeration.findMany({
    where: { active: true, deprecatedAt: null, parentKey: { not: null } },
    select: { key: true, parentKey: true },
  });
  const parentKeyByValue: Record<string, string> = {};
  for (const row of parentRows) if (row.parentKey !== null) parentKeyByValue[row.key] = row.parentKey;

  let failures = 0;
  const missing = Object.keys(BASELINE_EXPECTATION).filter(
    (code) => !programs.some((p) => p.programCode === code),
  );
  for (const code of missing) {
    console.error(`✗ ${code} — not seeded. Run \`npm run seed:collateral\`.`);
    failures += 1;
  }

  const check = (
    label: string,
    code: string,
    dpPercent: string,
    obligations: string,
    expected: Expectation | undefined,
  ): void => {
    const row = programs.find((p) => p.programCode === code);
    if (!row) return;
    const snapshot = toBankProgramSnapshot(row, catalogRules);
    const outcome = quoteProgram({
      profile: profile(obligations, dpPercent),
      program: snapshot,
      parentKeyByValue,
    });

    if (!outcome.ok) {
      const u = outcome.unavailable;
      const detail = [u.reason, u.gateReasonCode, u.missingFactKeys?.join('+'), u.missing?.join('+')]
        .filter(Boolean)
        .join(' · ');
      // A refusal is the right answer in two shapes: the bank's own condition was not met, or
      // the applicant's existing payments consume the whole ceiling. CAE's implies an 8 805
      // instalment, which a 10 000 obligation eats outright.
      const wanted =
        expected !== undefined && 'refusedWith' in expected
          ? u.gateReasonCode === expected.refusedWith
          : obligations !== '0' &&
            (u.reason === 'OBLIGATIONS_EXCEED_ALLOWANCE' || u.reason === 'BELOW_PROGRAM_MIN_AMOUNT');
      if (!wanted) failures += 1;
      console.log(`${wanted ? '✓' : '✗'} ${label} → no figures (${detail})`);
      return;
    }

    const quote = outcome.quote;
    const ceiling = quote.collateralCeilingEGP?.toString() ?? '—';
    const wantCeiling =
      expected !== undefined && 'ceilingEGP' in expected ? expected.ceilingEGP : null;
    const ok = wantCeiling === null || ceiling === wantCeiling;
    if (!ok) failures += 1;
    console.log(
      `${ok ? '✓' : '✗'} ${label} → ceiling ${ceiling}` +
        `${wantCeiling !== null ? ` (expected ${wantCeiling})` : ''}` +
        ` · income ${quote.recognisedIncomeEGP.toDecimalPlaces(2)}` +
        ` · max ${quote.maxAffordableAmountEGP}` +
        ` · cash ${quote.cashToCustomerEGP}` +
        ` · binding ${quote.bindingConstraint}` +
        ` · origin ${quote.incomeResolution?.origin ?? '—'}`,
    );
  };

  console.log('— 3 000 000 apartment, 20% paid, 5 years —');
  for (const code of Object.keys(BASELINE_EXPECTATION)) {
    const expected = BASELINE_EXPECTATION[code];
    check(`${code} obl=0`, code, '20', '0', expected);
    // With obligations the expectation is only "still explainable": the exact figure is pinned
    // by `ceiling-identity.spec.ts`, and repeating it here would be a second place to update
    // when a rate moves. A program the bank's own CONDITION already refuses refuses either
    // way, though — obligations change nothing about a down payment that is short.
    const withDebt = expected !== undefined && 'refusedWith' in expected ? expected : undefined;
    check(`${code} obl=10000`, code, '20', '10000', withDebt);
  }

  console.log('\n— the same unit with 40% paid —');
  for (const [code, expected] of Object.entries(HIGH_DOWN_PAYMENT_EXPECTATION)) {
    check(`${code} dp=40%`, code, '40', '0', expected);
  }

  console.log(failures === 0 ? '\nall collateral programs quote as expected.' : `\n${failures} problem(s).`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error('[collateral-check] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
