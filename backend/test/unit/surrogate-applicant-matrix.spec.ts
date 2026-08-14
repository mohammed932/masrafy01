/**
 * T074 / SC-003 — ten sample applicants across the four ASKED facts, every produced
 * figure traced to exactly one configured row or band, and every skip yielding a
 * stated reason.
 *
 * SC-003 was narrowed by FR-016 to the facts a customer is actually ASKED. Six of the
 * ten methods (certificate value, total deposits, car installment, car loan amount,
 * bank-statement balance) stay configurable and checkable but have no question yet —
 * adding five is a separate increment. They are covered here by their SKIP case only,
 * which is the honest thing to assert about them: an unasked fact is
 * `SURROGATE_FACT_MISSING`, never a zero.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import { surrogateFactsFromAnswers } from '@/matching/pipeline/surrogate-facts-from-answers';
import type {
  ApplicantProfile,
  EligibilityConfig,
  IncomeAssumptionConfig,
} from '@/matching/types';

const ELIGIBILITY = { dbrCapPercent: '50.0000' } as unknown as EligibilityConfig;

/** The configured rules, one per asked fact — the "exactly one row" targets. */
const GRADE_RULE: IncomeAssumptionConfig = {
  strategy: 'byMilitaryGrade',
  keyTable: [
    { key: 'officer', incomeEGP: '15000' },
    { key: 'senior_officer', incomeEGP: '25000' },
    { key: 'general', incomeEGP: '40000' },
  ],
};

const RANK_RULE: IncomeAssumptionConfig = {
  strategy: 'byProfessorRank',
  keyTable: [
    { key: 'lecturer', incomeEGP: '12000' },
    { key: 'assistant_professor', incomeEGP: '18000' },
    { key: 'professor', incomeEGP: '25000' },
  ],
};

const PRACTICE_RULE: IncomeAssumptionConfig = {
  strategy: 'byYearsInPractice',
  bands: [
    { fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' },
    { fromInclusive: '5', toExclusive: '8', incomeEGP: '30000' },
    { fromInclusive: '8', toExclusive: null, incomeEGP: '45000' },
  ],
};

const CARD_RULE: IncomeAssumptionConfig = {
  strategy: 'byCreditCardLimit',
  scalar: { value: '0.1', unit: 'multiplier' },
};

function profileFrom(
  raw: { options?: Record<string, string>; numerics?: Record<string, string> },
  declaredSalaryEGP = '0',
): ApplicantProfile {
  // Built through the SHARED mapper, not by hand: the matrix has to exercise the path
  // a real applicant's answers take, or it proves nothing about the loop.
  const facts = surrogateFactsFromAnswers({
    optionByCode: new Map(Object.entries(raw.options ?? {})),
    numericByCode: new Map(Object.entries(raw.numerics ?? {})),
  });
  return {
    age: 35,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal('300000'),
    requestedCurrency: 'EGP',
    preferredTenorMonths: 48,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'government_employee',
      monthlyNetSalaryEGP: new Decimal(declaredSalaryEGP),
      monthsInJob: 48,
      salaryTransferType: 'payroll',
      companyName: '',
      companyType: '',
      ...facts.employment,
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal('0'),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: { ...facts.assets },
  };
}

interface MatrixCase {
  readonly name: string;
  readonly answers: { options?: Record<string, string>; numerics?: Record<string, string> };
  readonly rule: IncomeAssumptionConfig;
  readonly expectedIncomeEGP: string;
  /** The single configured value the figure must trace back to (FR-030, SC-003). */
  readonly tracesTo: { key: string } | { fromInclusive: string; toExclusive: string | null };
}

/** Ten applicants spanning the four asked facts. */
const MATRIX: readonly MatrixCase[] = [
  {
    name: '1 — junior officer',
    answers: { options: { military_grade: 'officer' } },
    rule: GRADE_RULE,
    expectedIncomeEGP: '15000.00',
    tracesTo: { key: 'officer' },
  },
  {
    name: '2 — senior officer',
    answers: { options: { military_grade: 'senior_officer' } },
    rule: GRADE_RULE,
    expectedIncomeEGP: '25000.00',
    tracesTo: { key: 'senior_officer' },
  },
  {
    name: '3 — general',
    answers: { options: { military_grade: 'general' } },
    rule: GRADE_RULE,
    expectedIncomeEGP: '40000.00',
    tracesTo: { key: 'general' },
  },
  {
    name: '4 — lecturer',
    answers: { options: { academic_rank: 'lecturer' } },
    rule: RANK_RULE,
    expectedIncomeEGP: '12000.00',
    tracesTo: { key: 'lecturer' },
  },
  {
    name: '5 — professor',
    answers: { options: { academic_rank: 'professor' } },
    rule: RANK_RULE,
    expectedIncomeEGP: '25000.00',
    tracesTo: { key: 'professor' },
  },
  {
    name: '6 — 0 years in practice (first band, lower edge INCLUSIVE)',
    answers: { numerics: { years_in_practice: '0' } },
    rule: PRACTICE_RULE,
    expectedIncomeEGP: '12000.00',
    tracesTo: { fromInclusive: '0', toExclusive: '5' },
  },
  {
    name: '7 — exactly 5 years (upper edge EXCLUSIVE — the next band owns it)',
    answers: { numerics: { years_in_practice: '5' } },
    rule: PRACTICE_RULE,
    expectedIncomeEGP: '30000.00',
    tracesTo: { fromInclusive: '5', toExclusive: '8' },
  },
  {
    name: '8 — 30 years (open-ended last band)',
    answers: { numerics: { years_in_practice: '30' } },
    rule: PRACTICE_RULE,
    expectedIncomeEGP: '45000.00',
    tracesTo: { fromInclusive: '8', toExclusive: null },
  },
  {
    name: '9 — 150,000 card limit',
    answers: { numerics: { credit_card_total_limit: '150000' } },
    rule: CARD_RULE,
    expectedIncomeEGP: '15000.00',
    // A scalar method has no row to point at: the figure IS the arithmetic. Asserted
    // by the value alone, which is why the trace is checked as absent below.
    tracesTo: { key: '' },
  },
  {
    name: '10 — 37,500 card limit (an odd value, so no bucket could have produced it)',
    answers: { numerics: { credit_card_total_limit: '37500' } },
    rule: CARD_RULE,
    expectedIncomeEGP: '3750.00',
    tracesTo: { key: '' },
  },
];

describe('SC-003 — every produced figure traces to exactly one configured value', () => {
  it.each(MATRIX.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const resolution = resolveAssumedIncome({
      profile: profileFrom(testCase.answers),
      income: testCase.rule,
      eligibility: ELIGIBILITY,
    });

    expect(resolution.origin).toBe('surrogate');
    expect(resolution.incomeEGP.toFixed(2)).toBe(testCase.expectedIncomeEGP);
    expect(resolution.strategy).toBe(testCase.rule.strategy);

    if ('key' in testCase.tracesTo && testCase.tracesTo.key === '') {
      // Scalar method: no row exists to name, so claiming one would be a lie.
      expect(resolution.matchedRow).toBeUndefined();
    } else {
      expect(resolution.matchedRow).toEqual(testCase.tracesTo);
    }
  });

  it('covers ten applicants across all four asked facts', () => {
    expect(MATRIX).toHaveLength(10);
    const strategies = new Set(MATRIX.map((c) => c.rule.strategy));
    expect(strategies).toEqual(
      new Set(['byMilitaryGrade', 'byProfessorRank', 'byYearsInPractice', 'byCreditCardLimit']),
    );
  });

  it('produces a figure the rule can account for, never one it cannot', () => {
    // The negative form of the same claim: every expected income appears verbatim in
    // its rule, except the two scalar cases which are the stated multiple of the
    // stated limit.
    for (const c of MATRIX) {
      if (c.rule.strategy === 'byCreditCardLimit') continue;
      const configured = [
        ...(c.rule.keyTable ?? []).map((r) => r.incomeEGP),
        ...(c.rule.bands ?? []).map((b) => b.incomeEGP),
      ];
      expect(configured, c.name).toContain(c.expectedIncomeEGP.replace('.00', ''));
    }
  });
});

describe('SC-003 — the SKIP case for every fact yields a stated reason, never a zero', () => {
  const skipCases = [
    { fact: 'military grade', rule: GRADE_RULE },
    { fact: 'academic rank', rule: RANK_RULE },
    { fact: 'years in practice', rule: PRACTICE_RULE },
    { fact: 'credit-card limit', rule: CARD_RULE },
  ] as const;

  it.each(skipCases.map((c) => [c.fact, c.rule] as const))(
    'skipping %s reports fact_not_answered',
    (_fact, rule) => {
      const resolution = resolveAssumedIncome({
        profile: profileFrom({}),
        income: rule,
        eligibility: ELIGIBILITY,
      });
      expect(resolution.origin).toBe('none');
      expect(resolution.unresolvedReason).toBe('fact_not_answered');
      // Zero is the FIGURE, and callers must read `origin` rather than trust it —
      // reporting 0 as an income would tell the customer this bank assessed them as
      // earning nothing.
      expect(resolution.incomeEGP.isZero()).toBe(true);
      expect(resolution.matchedRow).toBeUndefined();
    },
  );

  it.each([
    ['byCDValue', 'certificate value'],
    ['byTotalDeposits', 'total deposits'],
    ['byCarInstallment', 'car installment'],
    ['byCarLoanAmount', 'car loan amount'],
    ['byBankStatementPercent', 'bank statement balance'],
  ] as const)(
    'the UNASKED fact behind %s (%s) also yields a stated reason (FR-016, narrowed)',
    (strategy) => {
      // These five are configurable and fully checkable in the admin panel, but no
      // question asks their fact yet. FR-016 and SC-003 were narrowed to say so
      // rather than promise coverage this increment does not deliver — and the
      // outcome for a customer is the correct one either way.
      const resolution = resolveAssumedIncome({
        profile: profileFrom({}),
        income: { strategy, scalar: { value: '10', unit: 'percent' } },
        eligibility: ELIGIBILITY,
      });
      expect(resolution.origin).toBe('none');
      expect(resolution.unresolvedReason).toBe('fact_not_answered');
      expect(resolution.incomeEGP.isZero()).toBe(true);
    },
  );

  it('an ANSWERED fact with no matching row is a DIFFERENT reason from a skip', () => {
    // The distinction the two reason codes exist for: "assign the question" vs. "add
    // the row" are different admin actions (research R9).
    const resolution = resolveAssumedIncome({
      profile: profileFrom({ options: { military_grade: 'colonel' } }),
      income: GRADE_RULE,
      eligibility: ELIGIBILITY,
    });
    expect(resolution.unresolvedReason).toBe('no_matching_row');
  });

  it('a value below the first band edge is no_matching_band, not the first band', () => {
    const resolution = resolveAssumedIncome({
      profile: profileFrom({ numerics: { years_in_practice: '2' } }),
      income: {
        strategy: 'byYearsInPractice',
        bands: [{ fromInclusive: '5', toExclusive: null, incomeEGP: '30000' }],
      },
      eligibility: ELIGIBILITY,
    });
    expect(resolution.origin).toBe('none');
    expect(resolution.unresolvedReason).toBe('no_matching_band');
  });
});
