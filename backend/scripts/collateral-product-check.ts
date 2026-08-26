/**
 * The seeded collateral product, quoted end to end against the REAL rows.
 *
 *   npx tsx scripts/collateral-product-check.ts
 *
 * Read-only. Nothing is written, nothing is persisted — it loads each program and its
 * catalog rule exactly as `applications.service.ts` does, builds a baseline applicant, and
 * prints what the engine produces.
 *
 * This exists because the unit suites prove the ARITHMETIC and the DATA separately. A rule
 * can be valid and a program can be live and the two can still fail to meet: the catalog's
 * step ids and the bank's `stepParams` keys are joined by string, and nothing but a real
 * quote proves that join holds.
 *
 * The compound-ownership demo used to be checked here too, and its assertions went with it
 * when the product was retired — including the two registry invariants, which asserted the
 * shape of a list nobody seeds any more. A product an OPERATOR builds is verified the same
 * way, by quoting it; there is nothing to hardcode here for a product this file has never
 * heard of.
 *
 * Exit code is 0 when every program quotes as expected, 1 when any does not, so it can gate
 * a deploy the same way `income-proof-conflicts.ts` does.
 */
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { toBankProgramSnapshot } from '../src/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '../src/matching/pipeline/quote';
import { effectiveProgramNameRule } from '../src/matching/pipeline/income-rule-inherit';
import type { ApplicantProfile, IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();

/** Baseline: an applicant who owns an 800 000 car, 3 to 7 years old, and has no debts. */
const BASELINE_FACTS: Record<string, SurrogateFactValue> = {
  owned_car_value: { kind: 'numeric', value: new Decimal('800000') },
  owned_car_age: { kind: 'choice', optionCode: '3_to_7' },
  // The pool's own question, read here because a bank may key a table by it. Neither seeded
  // car program does today; it is supplied so that one which starts to does not silently
  // refuse this applicant for an unanswered fact.
  employment_status: { kind: 'choice', optionCode: 'private_sector_employee' },
};

/**
 * What each program should say about that applicant.
 *
 * A CEILING where the applicant clears the bank's conditions, and a stated REFUSAL where they
 * do not — because both are correct answers and a check that only knew how to expect a number
 * would call the refusal a bug. Nothing seeded today produces a refusal; the shape stays,
 * because a gate is the first thing a new product adds.
 */
type Expectation =
  | { ceilingEGP: string; maxAffordableEGP?: string }
  | { refusedWith: string };

/** What varies between the runs below: who the applicant is, and who they already bank with. */
interface Variant {
  /** Bank slugs the applicant already uses — the input to the derived `bank_relationship`. */
  banks?: readonly string[];
  facts?: Record<string, SurrogateFactValue>;
  /**
   * The applicant's own employment, which is NOT the same input as the `employment_status`
   * FACT: the fact keys a bank's down-payment table, while this is what the debt-burden cap
   * and the age band read. A run that changes one and not the other proves nothing.
   */
  employmentType?: string;
}

const BASELINE_EXPECTATION: Readonly<Record<string, Expectation>> = {
  // 800 000 × 65% — ABK's own advance share for a 3-to-7-year-old car.
  'ABK-CAR-OWNER': { ceilingEGP: '520000' },

  // The bank that states nothing and takes the catalog's defaults. It is here for the same
  // reason as the one above: a rule can be valid and a program live while the string join
  // between the catalog's step ids and a bank's `stepParams` keys silently fails — and for an
  // INHERITING bank there are no `stepParams` at all, so what is being proved is that
  // `effectiveIncomeRule` puts the catalog's there. It must land on the figure the CATALOG
  // states: a 3-to-7-year-old car is 60% of 800 000 by `advancePct` — DELIBERATELY not ABK's
  // 65%, so a run that silently read the bank's figures instead of the catalog's would show up
  // as the wrong number rather than as a match.
  'CIB-CAR-OWNER': { ceilingEGP: '480000' },
};

function profile(obligationsEGP: string, variant: Variant = {}): ApplicantProfile {
  return {
    age: 35,
    loanPurpose: 'personal',
    // Above every ceiling, so the collateral is what binds rather than the ask.
    requestedAmountEGP: new Decimal('6000000'),
    preferredTenorMonths: 60,
    priority: 'lowest_installment',
    employment: {
      employmentType: variant.employmentType ?? 'salaried',
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
    assets: {},
    surrogateFacts: {
      ...BASELINE_FACTS,
      ...(variant.facts ?? {}),
    },
    ...(variant.banks !== undefined ? { bankRelationshipSlugs: variant.banks } : {}),
  };
}

async function main(): Promise<void> {
  const programs = await prisma.bankProgram.findMany({
    where: { programCode: { in: Object.keys(BASELINE_EXPECTATION) } },
    include: { bank: { select: { isFeatured: true } } },
  });

  // The same two-map resolve `programNameIncomeRules()` does, and it has to be here
  // too: this script deliberately reads Postgres directly rather than booting Nest, so
  // it does not get the repository's version for free. A name that links to a surrogate
  // product carries NULL in its own `incomeRule`, so reading only `program_name` drops
  // the car product entirely and every program below quotes nothing.
  const catalogRows = await prisma.platformEnumeration.findMany({
    where: { type: { in: ['program_name', 'surrogate_product'] } },
    select: { type: true, key: true, incomeRule: true, surrogateProductKey: true },
  });
  const asRule = (value: unknown): IncomeAssumptionConfig | undefined =>
    value === null || typeof value !== 'object' ? undefined : (value as IncomeAssumptionConfig);

  const productRules = new Map<string, IncomeAssumptionConfig>();
  for (const row of catalogRows) {
    if (row.type !== 'surrogate_product') continue;
    const rule = asRule(row.incomeRule);
    if (rule !== undefined) productRules.set(row.key, rule);
  }
  const catalogRules = new Map<string, IncomeAssumptionConfig>();
  for (const row of catalogRows) {
    if (row.type !== 'program_name') continue;
    const rule = effectiveProgramNameRule(
      asRule(row.incomeRule),
      row.surrogateProductKey === null ? undefined : productRules.get(row.surrogateProductKey),
    );
    if (rule !== undefined) catalogRules.set(row.key, rule);
  }

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
    obligations: string,
    expected: Expectation | undefined,
    variant: Variant = {},
  ): void => {
    const row = programs.find((p) => p.programCode === code);
    if (!row) return;
    const snapshot = toBankProgramSnapshot(row, catalogRules);
    const outcome = quoteProgram({
      profile: profile(obligations, variant),
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
    // The affordable amount is pinned only where a run exists to prove something about it —
    // a debt-burden cap that differs by employment shows up HERE and not in the ceiling,
    // which is the same number for both applicants.
    const wantMax =
      expected !== undefined && 'ceilingEGP' in expected ? (expected.maxAffordableEGP ?? null) : null;
    const ok =
      (wantCeiling === null || ceiling === wantCeiling) &&
      (wantMax === null || quote.maxAffordableAmountEGP.toString() === wantMax);
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

  console.log('— an 800 000 car, 3–7 years old —');
  for (const code of Object.keys(BASELINE_EXPECTATION)) {
    const expected = BASELINE_EXPECTATION[code];
    check(`${code} obl=0`, code, '0', expected);
    // With obligations the expectation is only "still explainable": the exact figure is pinned
    // by `ceiling-identity.spec.ts`, and repeating it here would be a second place to update
    // when a rate moves. A program the bank's own CONDITION already refuses refuses either
    // way, though — obligations change nothing about a down payment that is short.
    const withDebt = expected !== undefined && 'refusedWith' in expected ? expected : undefined;
    check(`${code} obl=10000`, code, '10000', withDebt);
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
