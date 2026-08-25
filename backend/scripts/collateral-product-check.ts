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
import { effectiveProgramNameRule } from '../src/matching/pipeline/income-rule-inherit';
import type { ApplicantProfile, IncomeAssumptionConfig, SurrogateFactValue } from '../src/matching/types';

const prisma = new PrismaClient();

/**
 * §10 baseline: a 3 000 000 apartment in a Class-C compound, 20% paid, 5 years, no debts —
 * who also owns an 800 000 car, 3 to 7 years old, for the car product.
 */
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
  // `single_unit`, not `yes`: this applicant owns ONE unit, and `yes` beside
  // `compound_multi_unit: 'no'` was a combination the questionnaire's own branching could
  // never produce — the baseline was passing CAE's strongest-unit gate on an answer no real
  // applicant could have given.
  compound_best_unit_confirmed: { kind: 'choice', optionCode: 'single_unit' },
  // The car product's two facts. The same applicant answers both packs, which is what a
  // customer with a unit AND a car would do — each program reads only the facts its own rule
  // names, so neither pack disturbs the other.
  owned_car_value: { kind: 'numeric', value: new Decimal('800000') },
  owned_car_age: { kind: 'choice', optionCode: '3_to_7' },
  employment_status: { kind: 'choice', optionCode: 'private_sector_employee' },
  // A salaried applicant's honest answer to the two self-employed conditions. The gates that
  // read them accept it, so turning them on costs this applicant nothing — but the answer has
  // to be GIVEN: a gate reads a fact, and an unanswered fact is a stated refusal, not a pass.
  self_employed_licence: { kind: 'choice', optionCode: 'not_self_employed' },
  business_years: { kind: 'choice', optionCode: 'not_self_employed' },
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
type Expectation =
  | { ceilingEGP: string; maxAffordableEGP?: string }
  | { refusedWith: string };

/** What varies between the runs below: who the applicant is, and who they already bank with. */
interface Variant {
  dpPercent?: string;
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
  'ABK-COMPOUND-GUARANTEE': { ceilingEGP: '2000000' },
  'EGB-COMPOUND-GUARANTEE': { refusedWith: 'DOWN_PAYMENT_BELOW_MIN' },
  'FAB-COMPOUND-GUARANTEE': { ceilingEGP: '1000000' },
  'CAE-COMPOUND-GUARANTEE': { ceilingEGP: '300000' },
  // 800 000 × 65% — ABK's own advance share for a 3-to-7-year-old car.
  'ABK-CAR-OWNER': { ceilingEGP: '520000' },

  // The two banks that state nothing and take the catalog's defaults. They are here for the
  // same reason as the five above: a rule can be valid and a program live while the string
  // join between the catalog's step ids and a bank's `stepParams` keys silently fails — and
  // for an INHERITING bank there are no `stepParams` at all, so what is being proved is that
  // `effectiveIncomeRule` puts the catalog's there. Each must land on the figure the CATALOG
  // states: an apartment is 2 000 000 by `capByUnitType`, and a 3-to-7-year-old car is 60% of
  // 800 000 by `advancePct` —
  // which is DELIBERATELY not ABK's 65%, so a run that silently read the bank's figures
  // instead of the catalog's would show up as the wrong number rather than as a match.
  'NBE-COMPOUND-GUARANTEE': { ceilingEGP: '2000000' },
  'CIB-CAR-OWNER': { ceilingEGP: '480000' },
};

/**
 * The self-employed applicant at CAE.
 *
 * The CEILING is the same 300 000 a salaried applicant gets — it is what the unit supports,
 * and employment says nothing about that. What moves is the amount the bank will write:
 * 40% applicable against the 50% baseline the ceiling was calibrated on is exactly 80% of it,
 * and that identity is the whole reason a per-employment cap needed no third setting.
 */
const SELF_EMPLOYED_EXPECTATION: Expectation = {
  ceilingEGP: '300000',
  maxAffordableEGP: '240000',
};

/** The same unit with 40% paid — the applicant EGBank's own tier accepts. */
const HIGH_DOWN_PAYMENT_EXPECTATION: Readonly<Record<string, Expectation>> = {
  'EGB-COMPOUND-GUARANTEE': { ceilingEGP: '2000000' },
};

function profile(obligationsEGP: string, variant: Variant = {}): ApplicantProfile {
  const dpPercent = variant.dpPercent ?? '20';
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
    assets: { ownsCompoundProperty: true },
    surrogateFacts: {
      ...BASELINE_FACTS,
      compound_dp_percent: { kind: 'numeric', value: new Decimal(dpPercent) },
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
  // the compound and car products entirely and every program below quotes nothing.
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

  console.log('— 3 000 000 apartment, 20% paid, 5 years · an 800 000 car, 3–7 years old —');
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

  console.log('\n— the same unit with 40% paid —');
  for (const [code, expected] of Object.entries(HIGH_DOWN_PAYMENT_EXPECTATION)) {
    check(`${code} dp=40%`, code, '0', expected, { dpPercent: '40' });
  }

  // ── The second column: a customer the bank already has ────────────────────
  //
  // Same unit, same money, one extra answer. Each of these reads a table the applicant
  // above could not reach, which is what proves the `pickByFact` branch is wired to the
  // right column — and NBE proves it through the CATALOG's default pair, having stated
  // nothing itself.
  console.log('\n— the same applicant, already a customer of the bank —');
  check('ABK-COMPOUND-GUARANTEE villa top-up', 'ABK-COMPOUND-GUARANTEE', '0', { ceilingEGP: '4500000' }, {
    banks: ['abk_egypt'],
    facts: { compound_unit_type: { kind: 'choice', optionCode: 'villa' } },
  });
  check('FAB-COMPOUND-GUARANTEE x-sell', 'FAB-COMPOUND-GUARANTEE', '0', { ceilingEGP: '1500000' }, {
    banks: ['fabmisr'],
  });
  check('NBE-COMPOUND-GUARANTEE top-up (catalog default)', 'NBE-COMPOUND-GUARANTEE', '0', { ceilingEGP: '3000000' }, {
    banks: ['national_bank_of_egypt'],
  });
  // Banking elsewhere is not banking HERE: the same answer must leave ABK on its standard
  // column, or the membership test is matching everybody.
  check('ABK-COMPOUND-GUARANTEE customer of another bank', 'ABK-COMPOUND-GUARANTEE', '0', { ceilingEGP: '2000000' }, {
    banks: ['fabmisr'],
  });

  // ── The self-employed applicant CAE prices differently ────────────────────
  const SELF_EMPLOYED: Record<string, SurrogateFactValue> = {
    employment_status: { kind: 'choice', optionCode: 'business_owner_company_owner' },
    self_employed_licence: { kind: 'choice', optionCode: 'yes' },
    business_years: { kind: 'choice', optionCode: 'two_or_more' },
  };
  const SELF_EMPLOYED_VARIANT: Variant = {
    facts: SELF_EMPLOYED,
    employmentType: 'business_owner_company_owner',
  };
  console.log('\n— a self-employed applicant —');
  // The CEILING is the same 300 000 — it is what the unit supports, and employment does not
  // change that. The 40% cap against a 50% baseline shows up in what the bank will actually
  // write, so that is what is pinned.
  check('CAE-COMPOUND-GUARANTEE self-employed', 'CAE-COMPOUND-GUARANTEE', '0', SELF_EMPLOYED_EXPECTATION, SELF_EMPLOYED_VARIANT);
  // ABK caps every applicant at 50%, so the SAME applicant must be unaffected there — or the
  // per-employment cap is being read by programs that never stated one.
  check('ABK-COMPOUND-GUARANTEE self-employed (no split)', 'ABK-COMPOUND-GUARANTEE', '0', { ceilingEGP: '2000000', maxAffordableEGP: '2000000' }, SELF_EMPLOYED_VARIANT);
  check('CAE-COMPOUND-GUARANTEE no licence', 'CAE-COMPOUND-GUARANTEE', '0', { refusedWith: 'SELF_EMPLOYED_DOCS_MISSING' }, {
    ...SELF_EMPLOYED_VARIANT,
    facts: { ...SELF_EMPLOYED, self_employed_licence: { kind: 'choice', optionCode: 'no' } },
  });
  check('CAE-COMPOUND-GUARANTEE business under 2 years', 'CAE-COMPOUND-GUARANTEE', '0', { refusedWith: 'BUSINESS_TOO_NEW' }, {
    ...SELF_EMPLOYED_VARIANT,
    facts: { ...SELF_EMPLOYED, business_years: { kind: 'choice', optionCode: 'less_than_2' } },
  });

  // ── The three compound classes, priced ────────────────────────────────────
  //
  // At 40% down, because EGBank's own down-payment gate refuses a 20% applicant BEFORE the
  // class table is ever read — so a 20% assertion proves nothing about the tiers.
  //
  // These three runs are the whole reason this block exists: the class list went from five
  // tiers to three, and the one applicant the rest of this script uses (`other`, the lowest
  // class) is worth 2 000 000 under BOTH the old scheme and the new one. Without a run per
  // class, a migration that re-filed every compound onto the wrong tier would ship green.
  console.log('\n— one run per compound class, at 40% down —');
  const CLASS_TIERS: ReadonlyArray<{ compound: string; label: string; ceilingEGP: string }> = [
    { compound: 'mivida', label: 'Class A', ceilingEGP: '6000000' },
    { compound: 'madinaty', label: 'Class B', ceilingEGP: '4000000' },
    { compound: 'other', label: 'Class C', ceilingEGP: '2000000' },
  ];
  for (const tier of CLASS_TIERS) {
    check(
      `EGB-COMPOUND-GUARANTEE ${tier.label} (${tier.compound})`,
      'EGB-COMPOUND-GUARANTEE',
      '0',
      { ceilingEGP: tier.ceilingEGP },
      {
        dpPercent: '40',
        facts: { compound_name: { kind: 'choice', optionCode: tier.compound } },
      },
    );
  }

  // ── Two invariants nothing else in the codebase asserts ───────────────────
  //
  // A quote can only prove the compounds it names. These two prove the SHAPE of the registry,
  // which is what a botched re-filing breaks: a table keyed by a class that no longer exists
  // saves clean (parent-table keys are deliberately not validated at save) and then answers
  // `no_matching_row` for whoever picked the compound behind it.
  console.log('\n— registry invariants —');
  const liveClasses = new Set(
    (
      await prisma.platformEnumeration.findMany({
        where: { type: 'compound_category', active: true, deprecatedAt: null },
        select: { key: true },
      })
    ).map((row) => row.key),
  );
  const compoundRows = await prisma.platformEnumeration.findMany({
    where: { type: 'compound' },
    select: { key: true, parentKey: true },
  });
  const unfiled = compoundRows.filter(
    (row) => row.parentKey === null || !liveClasses.has(row.parentKey),
  );
  if (unfiled.length > 0) {
    console.error(
      `✗ ${unfiled.length} compound(s) are not filed under a live class: ` +
        unfiled.map((row) => `${row.key}→${row.parentKey ?? 'none'}`).join(', '),
    );
    failures += 1;
  } else {
    console.log(`✓ every compound (${compoundRows.length}) is filed under one of ${liveClasses.size} live classes`);
  }

  const withTables = await prisma.bankProgram.findMany({
    select: { programCode: true, incomeAssumption: true },
  });
  const staleKeyed: string[] = [];
  for (const row of withTables) {
    const rule = row.incomeAssumption as { stepParams?: Record<string, { keyTable?: { key: string }[] }> } | null;
    for (const [stepId, params] of Object.entries(rule?.stepParams ?? {})) {
      for (const cell of params?.keyTable ?? []) {
        // A cap table keyed by a class the registry no longer has. Reported per program and
        // step, because the fix is a figure an operator types on that program's own screen.
        if (stepId === 'capByCompoundClass' && !liveClasses.has(cell.key)) {
          staleKeyed.push(`${row.programCode}.${stepId}.${cell.key}`);
        }
      }
    }
  }
  if (staleKeyed.length > 0) {
    console.error(`✗ cap table row(s) keyed by a class that no longer exists: ${staleKeyed.join(', ')}`);
    failures += 1;
  } else {
    console.log('✓ no cap table names a retired class');
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
