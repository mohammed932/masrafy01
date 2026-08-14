/**
 * SC-009 guard — freeze, then re-verify, the figures every seeded program
 * produces for a fixed set of sample applicants.
 *
 * Feature 011 rewires which INCOME enters the quote for `income_surrogate`
 * programs (`quote.ts` step 3 → `resolveAssumedIncome`). That population is much
 * larger than the three table-carrying targets: every business-category program
 * plus the doctor / professional / pharmacy archetypes are seeded
 * `income_surrogate` with `strategy: 'declared'` (research R4). SC-009 says none
 * of their figures may move, and the ONLY way to know is a snapshot taken BEFORE
 * the engine changed — which is why this script exists and why T071 runs first.
 *
 *   npx tsx scripts/baseline-offers.ts --write    # capture (once, pre-change)
 *   npx tsx scripts/baseline-offers.ts            # verify (exit 1 on any drift)
 *
 * Deterministic by construction: the sample applicants are literals here, the
 * programs come from the seeded DB, and `quoteProgram` is pure. Nothing is
 * written to the database.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  normalizeEligibility,
  toBankProgramSnapshot,
} from '../src/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '../src/matching/pipeline/quote';
import type { ApplicantProfile, BankProgramSnapshot } from '../src/matching/types';
import { abkEgypt2026 } from '../src/bank-programs/seeds/catalogs/abk-egypt-2026';
import { bankNxt2026 } from '../src/bank-programs/seeds/catalogs/bank-nxt-2026';
import { salesfloorEgp2026 } from '../src/bank-programs/seeds/catalogs/salesfloor-egp-2026';
import type { SeedCatalog } from '../src/bank-programs/seeds/catalog.types';

const OUT = resolve(__dirname, '../../specs/011-surrogate-admin-panel/baseline-offers.json');

/**
 * The sample matrix. Deliberately spans the populations whose income path this
 * feature touches: a salaried applicant (`income_proof`), a self-employed one
 * (the doctor / professional / pharmacy archetypes), a business owner (the whole
 * business category), and one applicant carrying every surrogate FACT so a
 * table-carrying program has something to look up. `apply` never sends an age,
 * so these are the derived-age equivalents (A31 — the sample is admin-side).
 */
interface Sample {
  readonly name: string;
  readonly profile: ApplicantProfile;
}

function sample(
  name: string,
  over: {
    age?: number;
    salaryEGP: string;
    obligationsEGP: string;
    amountEGP: string;
    tenorMonths: number;
    employmentType: string;
    monthsInJob?: number;
    salaryTransferType?: string;
    bankCategory?: 'public' | 'commercial';
    yearsInPractice?: number;
    professorRank?: string;
    militaryGrade?: string;
    assets?: Partial<ApplicantProfile['assets']>;
  },
): Sample {
  return {
    name,
    profile: {
      age: over.age ?? 35,
      loanPurpose: 'personal',
      requestedAmountEGP: new Decimal(over.amountEGP),
      requestedCurrency: 'EGP',
      preferredTenorMonths: over.tenorMonths,
      priority: 'lowest_installment',
      employment: {
        employmentType: over.employmentType,
        monthlyNetSalaryEGP: new Decimal(over.salaryEGP),
        monthsInJob: over.monthsInJob ?? 48,
        yearsInPractice: over.yearsInPractice,
        professorRank: over.professorRank,
        militaryGrade: over.militaryGrade,
        salaryTransferType: over.salaryTransferType ?? 'payroll',
        companyName: 'Sample Co',
        companyType: 'private',
        bankCategory: over.bankCategory,
      },
      obligations: {
        existingMonthlyObligationsEGP: new Decimal(over.obligationsEGP),
        hasCurrentLoan: new Decimal(over.obligationsEGP).greaterThan(0),
        hasPreviousRejection: false,
      },
      assets: {
        cdAtABKValueEGP: over.assets?.cdAtABKValueEGP,
        totalDepositsAtABKValueEGP: over.assets?.totalDepositsAtABKValueEGP,
        bankStatementBalanceEGP: over.assets?.bankStatementBalanceEGP,
        creditCardLimitEGP: over.assets?.creditCardLimitEGP,
        autoLoanAtOtherBankEGP: over.assets?.autoLoanAtOtherBankEGP,
        autoLoanAtABKEGP: over.assets?.autoLoanAtABKEGP,
        carInstallmentEGP: over.assets?.carInstallmentEGP,
      },
    },
  };
}

const SAMPLES: readonly Sample[] = [
  sample('salaried-mid', {
    salaryEGP: '20000',
    obligationsEGP: '2000',
    amountEGP: '300000',
    tenorMonths: 48,
    employmentType: 'salaried',
  }),
  sample('salaried-high-commercial-bank', {
    salaryEGP: '60000',
    obligationsEGP: '5000',
    amountEGP: '1200000',
    tenorMonths: 60,
    employmentType: 'salaried',
    // Exercises `commercialBankIncomePercent`: the haircut research R4 forbids
    // inheriting into the quote path. If it ever leaks in, this row moves.
    bankCategory: 'commercial',
  }),
  sample('self-employed-doctor', {
    salaryEGP: '45000',
    obligationsEGP: '3000',
    amountEGP: '800000',
    tenorMonths: 60,
    employmentType: 'self_employed',
    monthsInJob: 96,
    yearsInPractice: 11,
    salaryTransferType: 'income_transfer_letter',
  }),
  sample('business-owner', {
    salaryEGP: '90000',
    obligationsEGP: '12000',
    amountEGP: '2000000',
    tenorMonths: 72,
    employmentType: 'business_owner',
    monthsInJob: 120,
    salaryTransferType: 'income_transfer_letter',
  }),
  sample('government-employee-with-facts', {
    salaryEGP: '12000',
    obligationsEGP: '1000',
    amountEGP: '250000',
    tenorMonths: 36,
    employmentType: 'government_employee',
    militaryGrade: 'senior_officer',
    professorRank: 'assistant_professor',
    yearsInPractice: 3,
    assets: {
      cdAtABKValueEGP: new Decimal('500000'),
      totalDepositsAtABKValueEGP: new Decimal('750000'),
      bankStatementBalanceEGP: new Decimal('200000'),
      creditCardLimitEGP: new Decimal('150000'),
      carInstallmentEGP: new Decimal('4000'),
      autoLoanAtOtherBankEGP: new Decimal('300000'),
    },
  }),
  sample('low-income-tight', {
    salaryEGP: '7000',
    obligationsEGP: '2500',
    amountEGP: '150000',
    tenorMonths: 24,
    employmentType: 'salaried',
  }),
];

/**
 * Exactly the figures SC-009 names — installment, rate, tenor, max loan — plus
 * the recognised income, because that is the value this feature changes and a
 * moved income with an unmoved installment would be a rounding coincidence, not
 * a pass.
 */
interface BaselineRow {
  installmentEGP: string | null;
  ratePercent: string | null;
  tenorMonths: number | null;
  maxLoanEGP: string | null;
  recognisedIncomeEGP: string | null;
  unavailableReason: string | null;
}

/**
 * `programType` is recorded but NOT compared: T072 deliberately re-types the
 * three table-carrying seeds from `income_proof` to `income_surrogate`, which is
 * the point of the change, not drift. Folding it into the key instead would make
 * every re-typed program read as "missing" plus "added" and hide the figures —
 * which are the only thing SC-009 is about. Verify prints re-types as a note.
 */
interface BaselineProgram {
  programType: string;
  samples: Record<string, BaselineRow>;
}

type Baseline = Record<string, BaselineProgram>;

function quoteAll(snapshot: BankProgramSnapshot): Record<string, BaselineRow> {
  const perSample: Record<string, BaselineRow> = {};
  for (const s of SAMPLES) {
    const outcome = quoteProgram({ profile: s.profile, program: snapshot });
    perSample[s.name] = outcome.ok
      ? {
          installmentEGP: outcome.quote.monthlyInstallmentEGP.toFixed(2),
          ratePercent: outcome.quote.effectiveRatePercent.toFixed(4),
          tenorMonths: outcome.quote.effectiveTenorMonths,
          maxLoanEGP: outcome.quote.maxAffordableAmountEGP.toFixed(2),
          recognisedIncomeEGP: outcome.quote.recognisedIncomeEGP.toFixed(2),
          unavailableReason: null,
        }
      : {
          installmentEGP: null,
          ratePercent: null,
          tenorMonths: null,
          maxLoanEGP: null,
          recognisedIncomeEGP: outcome.unavailable.recognisedIncomeEGP?.toFixed(2) ?? null,
          unavailableReason: outcome.unavailable.reason,
        };
  }
  return perSample;
}

/**
 * The IN-CODE catalogs, quoted directly.
 *
 * `seed-bank-programs.ts` never writes them — they are seeded on demand through
 * `POST /api/admin/bank-programs/seed/abk`, so a dev database usually has none of
 * them. They matter here more than anything in the DB: `ABK-MILITARY`,
 * `ABK-PROFESSORS` and `ABK-DOCTORS-PRACTICE` are the only rows carrying the
 * three LEGACY rule shapes, and T065 rewrites those rows into the canonical
 * shape. Without a pre-change quote of each, "the normalizer changed nothing"
 * (FR-015 / SC-009) is an assertion with no evidence behind it.
 */
const CATALOGS: readonly SeedCatalog[] = [abkEgypt2026, bankNxt2026, salesfloorEgp2026];

/**
 * The programs whose figures this feature is SUPPOSED to move, and why.
 *
 * SC-009 says no figure moves — but it is scoped, in the spec's own words, to
 * `income_proof` programs and to the `income_surrogate` population carrying
 * `strategy: 'declared'`. These three are neither: each carries a real surrogate
 * table that has never been read, because they inherited `income_proof` from
 * `catalogs/base.ts` (T072) and because `quote.ts` short-circuited on any declared
 * salary (T016). Making their tables take effect is the feature.
 *
 * Listed explicitly rather than re-baselined silently: an allow-list keeps the
 * check meaningful for the other 69 programs, and turns "these three changed" from
 * a thing a reader has to notice into a thing the script says out loud. A drift
 * anywhere else still fails.
 */
const EXPECTED_TO_MOVE: Readonly<Record<string, string>> = Object.freeze({
  'catalog:abk-egypt-2026:ABK-MILITARY':
    'grade table now read (T072 re-type + T016 combination rule)',
  'catalog:abk-egypt-2026:ABK-PROFESSORS':
    'rank table now read (T072 re-type + T016 combination rule)',
  'catalog:abk-egypt-2026:ABK-DOCTORS-PRACTICE':
    'years-in-practice table now read (T072 re-type + T016 combination rule)',
});

function catalogRows(): Baseline {
  const out: Baseline = {};
  for (const catalog of CATALOGS) {
    for (const p of catalog.programs) {
      const snapshot: BankProgramSnapshot = {
        id: p.programCode,
        programCode: p.programCode,
        bankName: p.bankName,
        bankIsFeatured: false,
        friendlyName: p.friendlyName,
        programType: p.programType,
        productCategory: p.productCategory,
        currencies: p.currencies,
        active: true,
        isShariaCompliant: p.isShariaCompliant ?? false,
        version: 1,
        requiredDocuments: p.requiredDocuments ?? [],
        // Fixed, not `new Date()`: a baseline that changes every run compares
        // nothing. Nothing in `quoteProgram` reads it.
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        tenor: p.tenor as unknown as BankProgramSnapshot['tenor'],
        loanLimits: p.loanLimits as unknown as BankProgramSnapshot['loanLimits'],
        pricing: p.pricing as unknown as BankProgramSnapshot['pricing'],
        // Same reconciliation the DB path gets: the catalogs author `ageMin` /
        // `acceptedTransferTypes`, which the engine reads under other names.
        eligibility: normalizeEligibility(p.eligibility),
        incomeAssumption: p.incomeAssumption as unknown as BankProgramSnapshot['incomeAssumption'],
        fees: p.fees as unknown as BankProgramSnapshot['fees'],
        performanceCriteria: p.performanceCriteria as unknown as
          | BankProgramSnapshot['performanceCriteria']
          | undefined,
      };
      out[`catalog:${catalog.name}:${p.programCode}`] = {
        programType: p.programType,
        samples: quoteAll(snapshot),
      };
    }
  }
  return out;
}

async function build(): Promise<Baseline> {
  const prisma = new PrismaClient();
  try {
    const programs = await prisma.bankProgram.findMany({
      orderBy: { programCode: 'asc' },
      include: { bank: { select: { isFeatured: true } } },
    });
    const out: Baseline = {};
    for (const row of programs) {
      out[row.programCode] = {
        programType: row.programType,
        samples: quoteAll(toBankProgramSnapshot(row)),
      };
    }
    return { ...out, ...catalogRows() };
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write');
  const current = await build();

  if (write) {
    if (existsSync(OUT) && !process.argv.includes('--force')) {
      console.error(
        `refusing to overwrite ${OUT}\n` +
          'The baseline is the pre-change truth SC-009 is measured against — ' +
          're-capturing it after the engine changed would make SC-009 vacuous. ' +
          'Pass --force only if you are certain nothing has changed yet.',
      );
      process.exit(1);
    }
    writeFileSync(OUT, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    const programs = Object.keys(current).length;
    console.log(`wrote ${programs} programs × ${SAMPLES.length} samples → ${OUT}`);
    return;
  }

  if (!existsSync(OUT)) {
    console.error(`no baseline at ${OUT} — run with --write first`);
    process.exit(1);
  }
  const expected = JSON.parse(readFileSync(OUT, 'utf8')) as Baseline;
  const drift: string[] = [];

  const retyped: string[] = [];
  const intended: string[] = [];

  for (const [program, before] of Object.entries(expected)) {
    const now = current[program];
    if (!now) {
      drift.push(`${program}: program missing from the current set`);
      continue;
    }
    if (before.programType !== now.programType) {
      retyped.push(`${program}: ${before.programType} → ${now.programType}`);
    }
    const allowed = EXPECTED_TO_MOVE[program];
    for (const [sampleName, beforeRow] of Object.entries(before.samples)) {
      const after = now.samples[sampleName];
      if (!after) {
        drift.push(`${program} / ${sampleName}: sample missing`);
        continue;
      }
      for (const field of Object.keys(beforeRow) as Array<keyof BaselineRow>) {
        if (String(beforeRow[field]) === String(after[field])) continue;
        const line = `${program} / ${sampleName} / ${field}: ${String(beforeRow[field])} → ${String(after[field])}`;
        if (allowed) intended.push(line);
        else drift.push(line);
      }
    }
  }

  if (retyped.length > 0) {
    console.log(`note: ${retyped.length} program(s) re-typed (expected, T072):`);
    for (const r of retyped) console.log(`  ${r}`);
  }

  if (intended.length > 0) {
    console.log(`note: ${intended.length} INTENDED figure change(s), allow-listed:`);
    for (const [program, why] of Object.entries(EXPECTED_TO_MOVE)) {
      const rows = intended.filter((l) => l.startsWith(`${program} /`));
      if (rows.length === 0) continue;
      console.log(`  ${program} — ${why}`);
      for (const r of rows) console.log(`    ${r.slice(program.length + 3)}`);
    }
  }

  const added = Object.keys(current).filter((k) => !(k in expected));
  if (added.length > 0) {
    // Not drift: a program added after the baseline was frozen has no "before".
    console.log(`note: ${added.length} program(s) absent from the baseline: ${added.join(', ')}`);
  }

  if (drift.length > 0) {
    console.error(`SC-009 FAILED — ${drift.length} figure(s) moved:`);
    for (const d of drift.slice(0, 60)) console.error(`  ${d}`);
    if (drift.length > 60) console.error(`  … and ${drift.length - 60} more`);
    process.exit(1);
  }
  console.log(
    `SC-009 OK — ${Object.keys(expected).length} programs × ${SAMPLES.length} samples unchanged`,
  );
}

void main();
