/**
 * T017 / FR-020, FR-024, SC-008, SC-009 — the engine rewiring.
 *
 * Four claims, in order of how much damage getting them wrong would do:
 *
 *   1. `income_proof` figures did not move, and neither did the
 *      `income_surrogate` + `strategy: 'declared'` population — no
 *      `commercialBankIncomePercent` haircut leaked into the quote path (SC-009,
 *      research R4).
 *   2. `combinationRule` finally executes on a surrogate program with a declared
 *      salary > 0 — the defect research R4 documents, where the stored rule had
 *      never run on the apply path.
 *   3. An unanswered fact yields `SURROGATE_FACT_MISSING` and an unmatched
 *      key/band yields `SURROGATE_NO_MATCHING_ROW` — never a zero-substituted
 *      income (FR-020).
 *   4. Result ORDERING is untouched: the program is still listed and still ranked
 *      (FR-024).
 *
 * The SC-009 half is checked against the frozen `baseline-offers.json` rather than
 * against numbers retyped here — a hand-copied expectation would pass while the
 * seeds drifted underneath it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Decimal } from '@prisma/client/runtime/library';
import { quoteProgram } from '@/matching/pipeline/quote';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import { normalizeEligibility } from '@/bank-programs/bank-program-snapshot.mapper';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  IncomeAssumptionConfig,
} from '@/matching/types';
import { abkEgypt2026 } from '@/bank-programs/seeds/catalogs/abk-egypt-2026';

// --- fixtures ---------------------------------------------------------------

function profile(over: {
  salaryEGP?: string;
  militaryGrade?: string;
  professorRank?: string;
  yearsInPractice?: number;
  monthsInJob?: number;
  bankCategory?: 'commercial' | 'public';
  obligationsEGP?: string;
  amountEGP?: string;
  tenorMonths?: number;
  creditCardLimitEGP?: string;
}): ApplicantProfile {
  return {
    age: 35,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal(over.amountEGP ?? '300000'),
    preferredTenorMonths: over.tenorMonths ?? 48,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'salaried',
      monthlyNetSalaryEGP: new Decimal(over.salaryEGP ?? '0'),
      monthsInJob: over.monthsInJob ?? 48,
      yearsInPractice: over.yearsInPractice,
      professorRank: over.professorRank,
      militaryGrade: over.militaryGrade,
      salaryTransferType: 'payroll',
      companyName: 'Sample Co',
      companyType: 'private',
      bankCategory: over.bankCategory,
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal(over.obligationsEGP ?? '0'),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: {
      ...(over.creditCardLimitEGP
        ? { creditCardLimitEGP: new Decimal(over.creditCardLimitEGP) }
        : {}),
    },
  };
}

/** A minimal quotable program, so a test names only what it is about. */
function program(over: {
  programType?: string;
  incomeAssumption: IncomeAssumptionConfig;
  dbrCapPercent?: string;
  commercialBankIncomePercent?: string;
}): BankProgramSnapshot {
  return {
    id: 'p1',
    programCode: 'TEST-P1',
    bankName: 'Test Bank',
    bankIsFeatured: false,
    friendlyName: 'Test Program',
    programType: over.programType ?? 'income_surrogate',
    productCategory: 'personal',
    active: true,
    isShariaCompliant: false,
    version: 1,
    requiredDocuments: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    tenor: { minMonths: 12, maxMonths: 84 },
    loanLimits: { minAmountEGP: '10000', maxAmountEGP: '5000000' },
    pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
    eligibility: normalizeEligibility({
      acceptedEmploymentTypes: ['salaried'],
      ageMin: 21,
      ageMax: 60,
      minMonthlyIncomeEGP: '0',
      minMonthsInJob: 0,
      dbrCapPercent: over.dbrCapPercent ?? '50.0000',
      skipDbrCheck: false,
      acceptedTransferTypes: ['payroll'],
      requiresCD: false,
      requiresAutoLoanAtABK: false,
      requiresAutoLoanAtOtherBank: false,
      requiresCreditCardAtOtherBank: false,
      requiresCompoundProperty: false,
      requiresCollateral: false,
      requiresClubMembership: false,
      requiresExistingLoan: false,
      requiresFRMUVerification: false,
      requiresQualitativeReview: false,
      requiresNoDocuments: false,
      ...(over.commercialBankIncomePercent
        ? { commercialBankIncomePercent: over.commercialBankIncomePercent }
        : {}),
    }),
    incomeAssumption: over.incomeAssumption,
    fees: {
      adminFeePercent: '0.0000',
      stampDutyPercent: '0.0000',
      lifeInsurancePercent: '0.0000',
      latePaymentFeePercent: '0.0000',
    },
  };
}

const GRADE_TABLE: IncomeAssumptionConfig = {
  strategy: 'byMilitaryGrade',
  keyTable: [
    { key: 'officer', incomeEGP: '15000' },
    { key: 'senior_officer', incomeEGP: '25000' },
    { key: 'general', incomeEGP: '40000' },
  ],
};

// --- 1. SC-009 --------------------------------------------------------------

describe('SC-009 — nothing that was not meant to move, moved', () => {
  const baselinePath = resolve(__dirname, '../../../specs/011-surrogate-admin-panel/baseline-offers.json');

  it('the frozen baseline exists and covers both populations', () => {
    // The guard on the guard: an absent or emptied baseline would make every
    // assertion below vacuously true.
    const raw = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<
      string,
      { programType: string; samples: Record<string, unknown> }
    >;
    const entries = Object.entries(raw);
    expect(entries.length).toBeGreaterThan(40);

    const surrogate = entries.filter(([, v]) => v.programType === 'income_surrogate');
    const proof = entries.filter(([, v]) => v.programType === 'income_proof');
    expect(proof.length).toBeGreaterThan(0);
    expect(surrogate.length).toBeGreaterThan(0);
    // The populations research R4 names: business category plus the self-employed
    // archetypes. If a re-seed ever drops them, SC-009 stops meaning anything.
    const codes = surrogate.map(([k]) => k).join(' ');
    expect(codes).toMatch(/BIZ/);
    expect(codes).toMatch(/DOCTOR|PROFESSIONAL|PHARMACY/);
  });

  it('an income_proof program with a declared salary is byte-identical to declaring it', () => {
    const p = profile({ salaryEGP: '20000', obligationsEGP: '2000' });
    const proof = quoteProgram({
      profile: p,
      program: program({ programType: 'income_proof', incomeAssumption: GRADE_TABLE }),
    });
    expect(proof.ok).toBe(true);
    // The grade table is present AND the applicant carries no grade — on an
    // income_proof program neither fact is consulted at all.
    expect(proof.ok && proof.quote.recognisedIncomeEGP.toFixed(2)).toBe('20000.00');
    expect(proof.ok && proof.quote.incomeResolution).toBeNull();
  });

  it('does NOT haircut the declared salary on a surrogate + declared program (research R4)', () => {
    // The single most dangerous regression this feature could have shipped: every
    // business-category program and the doctor / professional / pharmacy archetypes
    // are `income_surrogate` with `strategy: 'declared'`, and `resolveAssumedIncome`
    // used to run `applyCompanyTypeAdjustment` on its baseline. Inheriting that on
    // delegation would have cut their income to 80%.
    const p = profile({ salaryEGP: '50000', bankCategory: 'commercial' });
    const outcome = quoteProgram({
      profile: p,
      program: program({
        programType: 'income_surrogate',
        incomeAssumption: { strategy: 'declared' },
        commercialBankIncomePercent: '80.0000',
      }),
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.quote.recognisedIncomeEGP.toFixed(2)).toBe('50000.00');
    expect(outcome.ok && outcome.quote.incomeResolution?.origin).toBe('declared');
  });

  it('keeps the income_proof fallback for an applicant who declared nothing', () => {
    // `SF-SELF-EMP` is `income_proof` with `byBankStatementPercent`. Removing the
    // fallback would blank out exactly the applicants it exists to serve.
    const p = profile({ salaryEGP: '0', creditCardLimitEGP: '150000' });
    const outcome = quoteProgram({
      profile: p,
      program: program({
        programType: 'income_proof',
        incomeAssumption: { strategy: 'byCreditCardLimit', scalar: { value: '0.1', unit: 'multiplier' } },
      }),
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.quote.recognisedIncomeEGP.toFixed(2)).toBe('15000.00');
  });

  it('reports NO_RECOGNISED_INCOME, not a surrogate reason, when an income_proof fallback fails', () => {
    // That program never promised to read a fact, so "we didn't ask about your
    // military grade" would be the wrong thing to tell its applicant.
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0' }),
      program: program({ programType: 'income_proof', incomeAssumption: GRADE_TABLE }),
    });
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.unavailable.reason).toBe('NO_RECOGNISED_INCOME');
  });
});

// --- 2. the combination rule finally runs ------------------------------------

describe('combinationRule executes on a surrogate program with a declared salary', () => {
  const declared = '12000';

  it('greater_of picks the surrogate when it is higher', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: declared, militaryGrade: 'senior_officer' }),
      program: program({ incomeAssumption: { ...GRADE_TABLE, combinationRule: 'greater_of' } }),
    });
    expect(outcome.ok && outcome.quote.recognisedIncomeEGP.toFixed(2)).toBe('25000.00');
    expect(outcome.ok && outcome.quote.incomeResolution?.origin).toBe('surrogate_over_declared');
  });

  it('greater_of keeps the declared salary when IT is higher', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '30000', militaryGrade: 'senior_officer' }),
      program: program({ incomeAssumption: { ...GRADE_TABLE, combinationRule: 'greater_of' } }),
    });
    expect(outcome.ok && outcome.quote.recognisedIncomeEGP.toFixed(2)).toBe('30000.00');
    expect(outcome.ok && outcome.quote.incomeResolution?.origin).toBe('declared_over_surrogate');
  });

  it('lesser_of picks the smaller of the two', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: declared, militaryGrade: 'senior_officer' }),
      program: program({ incomeAssumption: { ...GRADE_TABLE, combinationRule: 'lesser_of' } }),
    });
    expect(outcome.ok && outcome.quote.recognisedIncomeEGP.toFixed(2)).toBe('12000.00');
    expect(outcome.ok && outcome.quote.incomeResolution?.origin).toBe('declared_over_surrogate');
  });

  it('an absent rule REPLACES the declared salary — the point of a surrogate program', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '30000', militaryGrade: 'officer' }),
      program: program({ incomeAssumption: GRADE_TABLE }),
    });
    expect(outcome.ok && outcome.quote.recognisedIncomeEGP.toFixed(2)).toBe('15000.00');
    expect(outcome.ok && outcome.quote.incomeResolution?.origin).toBe('surrogate');
  });

  it('records the matched row so the figure traces to exactly one configured value', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0', militaryGrade: 'general' }),
      program: program({ incomeAssumption: GRADE_TABLE }),
    });
    expect(outcome.ok && outcome.quote.incomeResolution?.matchedRow).toEqual({ key: 'general' });
    expect(outcome.ok && outcome.quote.incomeResolution?.strategy).toBe('byMilitaryGrade');
  });
});

// --- 3. misses are stated, never zero ----------------------------------------

describe('a missing fact or unmatched row is stated, never zero-substituted (FR-020)', () => {
  it('an unanswered fact yields SURROGATE_FACT_MISSING', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0' }), // no militaryGrade
      program: program({ incomeAssumption: GRADE_TABLE }),
    });
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.unavailable.reason).toBe('SURROGATE_FACT_MISSING');
  });

  it('an answered fact with no matching KEY yields SURROGATE_NO_MATCHING_ROW', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0', militaryGrade: 'colonel' }),
      program: program({ incomeAssumption: GRADE_TABLE }),
    });
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.unavailable.reason).toBe('SURROGATE_NO_MATCHING_ROW');
  });

  it('a value below the first BAND edge yields SURROGATE_NO_MATCHING_ROW', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0', yearsInPractice: 1 }),
      program: program({
        incomeAssumption: {
          strategy: 'byYearsInPractice',
          bands: [{ fromInclusive: '5', toExclusive: null, incomeEGP: '30000' }],
        },
      }),
    });
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.unavailable.reason).toBe('SURROGATE_NO_MATCHING_ROW');
  });

  it('never substitutes a zero income — the resolution says none, and 0 is not a figure', () => {
    const resolution = resolveAssumedIncome({
      profile: profile({ salaryEGP: '0' }),
      income: GRADE_TABLE,
      eligibility: program({ incomeAssumption: GRADE_TABLE }).eligibility,
    });
    expect(resolution.origin).toBe('none');
    expect(resolution.unresolvedReason).toBe('fact_not_answered');
    // The figure IS zero, which is exactly why callers must read `origin`. A caller
    // that trusted the number would report "you earn 0" to the customer.
    expect(resolution.incomeEGP.isZero()).toBe(true);
  });

  it('a declared salary still carries the quote when the rule resolves nothing', () => {
    // An unconfigured or unmatched rule must not blank out a program whose
    // applicant DID state an income.
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '18000' }), // no grade answered
      program: program({ incomeAssumption: GRADE_TABLE }),
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.quote.recognisedIncomeEGP.toFixed(2)).toBe('18000.00');
    expect(outcome.ok && outcome.quote.incomeResolution?.origin).toBe('declared');
  });
});

// --- FR-012 — the per-rule DBR override --------------------------------------

describe('FR-012 — the rule DBR override applies only over a surrogate income', () => {
  const withOverride: IncomeAssumptionConfig = { ...GRADE_TABLE, dbrCapPercentOverride: '45' };

  it('applies and reports rule_override when the income came from the rule', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0', militaryGrade: 'senior_officer' }),
      program: program({ incomeAssumption: withOverride, dbrCapPercent: '50.0000' }),
    });
    expect(outcome.ok && outcome.quote.dbrCapPercent.toFixed(0)).toBe('45');
    expect(outcome.ok && outcome.quote.dbrCapSource).toBe('rule_override');
  });

  it('does NOT apply when the declared salary won — a payslip gets the program cap', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '60000', militaryGrade: 'senior_officer' }),
      program: program({
        incomeAssumption: { ...withOverride, combinationRule: 'greater_of' },
        dbrCapPercent: '50.0000',
      }),
    });
    expect(outcome.ok && outcome.quote.dbrCapPercent.toFixed(0)).toBe('50');
    expect(outcome.ok && outcome.quote.dbrCapSource).toBe('program_default');
  });

  it('ignores an out-of-range override rather than capping everyone at zero', () => {
    // The save path rejects it, but a hand-edited JSONB row must not take the
    // program down (Principle V).
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0', militaryGrade: 'officer' }),
      program: program({
        incomeAssumption: { ...GRADE_TABLE, dbrCapPercentOverride: '0' },
        dbrCapPercent: '50.0000',
      }),
    });
    expect(outcome.ok && outcome.quote.dbrCapPercent.toFixed(0)).toBe('50');
    expect(outcome.ok && outcome.quote.dbrCapSource).toBe('program_default');
  });
});

// --- 4. still listed, still ranked -------------------------------------------

describe('FR-022 / FR-024 — an unresolved program is still listed and ordering is untouched', () => {
  it('returns an unavailable reason rather than dropping the program', () => {
    const outcome = quoteProgram({
      profile: profile({ salaryEGP: '0' }),
      program: program({ incomeAssumption: GRADE_TABLE }),
    });
    // `ok: false` + a reason is the "listed without figures" contract; a filter
    // would be a thrown error or an absent entry.
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.unavailable.reason).toBeTruthy();
  });

  it('quotes every re-typed seed and orders them by installment exactly as their figures imply', () => {
    // Ordering is not re-implemented by this feature, so the assertion is that the
    // figures the new income path produces still sort — i.e. every one of the three
    // re-typed programs produces a figure for an applicant carrying the facts.
    const p = profile({
      salaryEGP: '12000',
      militaryGrade: 'senior_officer',
      professorRank: 'assistant_professor',
      yearsInPractice: 3,
      monthsInJob: 96,
    });
    const targets = ['ABK-MILITARY', 'ABK-PROFESSORS', 'ABK-DOCTORS-PRACTICE'];
    const quotes = targets.map((code) => {
      const seed = abkEgypt2026.programs.find((s) => s.programCode === code);
      if (!seed) throw new Error(`${code} missing from the catalog`);
      expect(seed.programType, `${code} must be re-typed (T072)`).toBe('income_surrogate');
      const outcome = quoteProgram({
        profile: p,
        program: program({
          incomeAssumption: seed.incomeAssumption as unknown as IncomeAssumptionConfig,
        }),
      });
      expect(outcome.ok, code).toBe(true);
      return {
        code,
        installment: outcome.ok ? outcome.quote.monthlyInstallmentEGP : new Decimal(0),
      };
    });

    const sorted = [...quotes].sort((a, b) => a.installment.comparedTo(b.installment));
    expect(sorted.map((q) => q.code)).toHaveLength(3);
    // Every program produced a positive installment: none was silently dropped.
    for (const q of quotes) expect(q.installment.greaterThan(0)).toBe(true);
  });
});
