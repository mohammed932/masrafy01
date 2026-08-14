/**
 * T048 / FR-030 / SC-007 — the check panel and the simulator agree, by construction.
 *
 * The guarantee is STRUCTURAL: `checkIncomeRule` overlays the draft rule on the saved
 * `BankProgramSnapshot` and calls the SAME `quoteProgram` the admin simulator reaches
 * through `MatchingPreviewService`. So this test does not re-implement the simulator —
 * it calls `quoteProgram` directly on the equivalent snapshot + profile (which is
 * exactly what the simulator does with it) and asserts the endpoint's figures match,
 * field by field, across the sample matrix INCLUDING the no-match case.
 *
 * If the two ever diverge it will be because someone added a second income →
 * DBR → installment → max-loan path, which is the failure this test exists to catch.
 * The real service is instantiated (with stubbed persistence) rather than
 * re-implemented, so the assertion is about shipped code.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import { toBankProgramSnapshot } from '@/bank-programs/bank-program-snapshot.mapper';
import { quoteProgram } from '@/matching/pipeline/quote';
import type { IncomeRuleCheckDto } from '@/bank-programs/dto/income-rule-check.dto';
import type { ApplicantProfile, BankProgramSnapshot, IncomeAssumptionConfig } from '@/matching/types';

// --- the program row, as the DB would return it ------------------------------

const ELIGIBILITY_JSON = {
  acceptedEmploymentTypes: ['salaried'],
  ageMin: 21,
  ageMax: 60,
  minMonthlyIncomeEGP: '0',
  minMonthsInJob: 0,
  dbrCapPercent: '50.0000',
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
};

function programRow(storedRule: unknown) {
  return {
    id: 'p1',
    programCode: 'TEST-CHECK',
    bankName: 'Test Bank',
    bankId: null,
    friendlyName: 'Test Program',
    friendlyNameAr: null,
    programNameKey: 'private_sector',
    programType: 'income_surrogate',
    productCategory: 'personal',
    currencies: ['EGP'],
    active: false,
    isShariaCompliant: false,
    version: 3,
    operatorNotes: null,
    operatorTips: [],
    requiredDocuments: [],
    tenor: { minMonths: 12, maxMonths: 84 },
    loanLimits: { perCurrency: { EGP: { minAmount: '10000', maxAmount: '5000000' } } },
    pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
    eligibility: ELIGIBILITY_JSON,
    performanceCriteria: null,
    incomeAssumption: storedRule,
    fees: {
      adminFeePercent: '2.0000',
      stampDutyPercent: '0.5000',
      lifeInsurancePercent: '0.5000',
      latePaymentFeePercent: '4.0000',
    },
    valueSources: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdBy: 'seed',
    updatedBy: 'seed',
    searchVector: null,
  } as unknown as Awaited<ReturnType<BankProgramsService['findOne']>> extends never
    ? never
    : Parameters<typeof toBankProgramSnapshot>[0];
}

/** The registries the key-table validator resolves against. */
const REGISTRY: Record<string, string[]> = {
  military_grade: ['officer', 'senior_officer', 'general'],
  professor_rank: ['lecturer', 'assistant_professor', 'professor'],
};

/**
 * The real service, with persistence stubbed. Only `repo.findByProgramCode` and the
 * two enumeration reads are exercised by `checkIncomeRule` — it writes nothing, which
 * is itself part of the contract (FR-029), so a stub that would throw on any write is
 * the right shape.
 */
function serviceFor(storedRule: unknown): BankProgramsService {
  const repo = {
    findByProgramCode: async () => programRow(storedRule),
  };
  const enums = {
    isAvailable: async () => true,
    isActiveMember: async (type: string, key: string) => (REGISTRY[type] ?? []).includes(key),
    getActiveMembers: async (type: string) => (REGISTRY[type] ?? []).map((key) => ({ key })),
  };
  const explode = () => {
    throw new Error('checkIncomeRule must persist NOTHING (FR-029)');
  };
  return new BankProgramsService(
    { $transaction: explode } as never,
    repo as never,
    { create: explode } as never,
    enums as never,
  );
}

// --- the same overlay + profile the simulator would quote -------------------

function overlaySnapshot(storedRule: unknown, draft: IncomeAssumptionConfig): BankProgramSnapshot {
  return {
    ...toBankProgramSnapshot(programRow(storedRule)),
    incomeAssumption: draft,
    active: true,
    programType: 'income_surrogate',
  };
}

function sampleProfile(sample: IncomeRuleCheckDto['sample']): ApplicantProfile {
  const dec = (v?: string) => (v !== undefined ? new Decimal(v) : undefined);
  return {
    age: sample.age,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal(sample.requestedAmountEGP),
    requestedCurrency: 'EGP',
    preferredTenorMonths: sample.tenorMonths,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'salaried',
      monthlyNetSalaryEGP: new Decimal(sample.declaredMonthlySalaryEGP ?? '0'),
      monthsInJob: sample.monthsInJob ?? 0,
      yearsInPractice: sample.yearsInPractice,
      professorRank: sample.professorRank,
      militaryGrade: sample.militaryGrade,
      salaryTransferType: 'payroll',
      companyName: '',
      companyType: '',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal(sample.existingMonthlyObligationsEGP),
      hasCurrentLoan: new Decimal(sample.existingMonthlyObligationsEGP).greaterThan(0),
      hasPreviousRejection: false,
    },
    assets: {
      cdAtABKValueEGP: dec(sample.cdValueEGP),
      totalDepositsAtABKValueEGP: dec(sample.totalDepositsEGP),
      bankStatementBalanceEGP: dec(sample.bankStatementBalanceEGP),
      creditCardLimitEGP: dec(sample.creditCardLimitEGP),
      carInstallmentEGP: dec(sample.carInstallmentEGP),
      autoLoanAtOtherBankEGP: dec(sample.carLoanAmountEGP),
    },
  };
}

// --- the matrix -------------------------------------------------------------

const GRADE_DRAFT: IncomeAssumptionConfig = {
  strategy: 'byMilitaryGrade',
  keyTable: [
    { key: 'officer', incomeEGP: '15000' },
    { key: 'senior_officer', incomeEGP: '25000' },
    { key: 'general', incomeEGP: '40000' },
  ],
};

const BAND_DRAFT: IncomeAssumptionConfig = {
  strategy: 'byYearsInPractice',
  bands: [
    { fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' },
    { fromInclusive: '5', toExclusive: null, incomeEGP: '30000' },
  ],
};

function sample(over: Partial<IncomeRuleCheckDto['sample']>): IncomeRuleCheckDto['sample'] {
  return {
    age: 34,
    existingMonthlyObligationsEGP: '3000',
    requestedAmountEGP: '500000',
    tenorMonths: 60,
    ...over,
  } as IncomeRuleCheckDto['sample'];
}

interface ParityCase {
  readonly name: string;
  readonly draft: IncomeAssumptionConfig;
  readonly sample: IncomeRuleCheckDto['sample'];
}

const CASES: readonly ParityCase[] = [
  {
    name: 'key table, senior officer, no declared salary',
    draft: GRADE_DRAFT,
    sample: sample({ militaryGrade: 'senior_officer', declaredMonthlySalaryEGP: '0' }),
  },
  {
    name: 'key table, general, high amount',
    draft: GRADE_DRAFT,
    sample: sample({ militaryGrade: 'general', requestedAmountEGP: '2000000' }),
  },
  {
    name: 'key table + declared salary, greater_of',
    draft: { ...GRADE_DRAFT, combinationRule: 'greater_of' },
    sample: sample({ militaryGrade: 'officer', declaredMonthlySalaryEGP: '30000' }),
  },
  {
    name: 'key table + rule DBR override',
    draft: { ...GRADE_DRAFT, dbrCapPercentOverride: '45' },
    sample: sample({ militaryGrade: 'senior_officer' }),
  },
  {
    name: 'bands, 3 years',
    draft: BAND_DRAFT,
    sample: sample({ yearsInPractice: 3 }),
  },
  {
    name: 'bands, 11 years, tight obligations',
    draft: BAND_DRAFT,
    sample: sample({ yearsInPractice: 11, existingMonthlyObligationsEGP: '12000' }),
  },
  {
    name: 'scalar card limit',
    draft: { strategy: 'byCreditCardLimit', scalar: { value: '0.1', unit: 'multiplier' } },
    sample: sample({ creditCardLimitEGP: '150000' }),
  },
  {
    name: 'NO MATCH — key answered but absent from the table',
    draft: GRADE_DRAFT,
    sample: sample({ militaryGrade: 'colonel' }),
  },
  {
    name: 'NO MATCH — fact never answered',
    draft: GRADE_DRAFT,
    sample: sample({}),
  },
  {
    name: 'NO MATCH — value below the first band edge',
    draft: {
      strategy: 'byYearsInPractice',
      bands: [{ fromInclusive: '5', toExclusive: null, incomeEGP: '30000' }],
    },
    sample: sample({ yearsInPractice: 2 }),
  },
];

// The stored rule is deliberately DIFFERENT from every draft, so a handler that
// silently read the saved rule instead of the draft would produce different figures
// and fail every row (FR-028).
const STORED_RULE = {
  strategy: 'byMilitaryGrade',
  keyTable: [{ key: 'officer', incomeEGP: '99999' }],
};

describe('FR-030 / SC-007 — the check endpoint and the shared quote agree on every figure', () => {
  it.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, testCase) => {
    const service = serviceFor(STORED_RULE);
    const result = await service.checkIncomeRule('TEST-CHECK', {
      incomeAssumption: testCase.draft as never,
      sample: testCase.sample,
    });

    // The simulator's path: the same snapshot, the same profile, the same function.
    const outcome = quoteProgram({
      profile: sampleProfile(testCase.sample),
      program: overlaySnapshot(STORED_RULE, testCase.draft),
    });

    if (!outcome.ok) {
      // No-match: the panel states a reason and returns NO figures — never a zero
      // income (FR-031).
      expect(result.resolvedIncomeEGP).toBeNull();
      expect(result.affordableInstallmentEGP).toBeNull();
      expect(result.estimatedLoanAmountEGP).toBeNull();
      expect(result.qualifies).toBe(false);
      expect(result.unavailableReason).toBe(outcome.unavailable.reason);
      expect(result.origin).toBe('none');
      expect(result.unresolvedReason).toBeTruthy();
      return;
    }

    // Resolved: every figure the panel shows is the quote's own.
    expect(result.resolvedIncomeEGP).toBe(outcome.quote.recognisedIncomeEGP.toFixed(2));
    expect(result.dbrCapPercent).toBe(outcome.quote.dbrCapPercent.toFixed(4));
    expect(result.dbrCapSource).toBe(outcome.quote.dbrCapSource);
    expect(result.estimatedLoanAmountEGP).toBe(outcome.quote.maxAffordableAmountEGP.toFixed(2));
    expect(result.origin).toBe(outcome.quote.incomeResolution?.origin);
    expect(result.unavailableReason).toBeUndefined();

    // The affordable installment is the cap applied to the SAME income, not a second
    // derivation of it.
    const expectedAffordable = outcome.quote.recognisedIncomeEGP
      .mul(outcome.quote.dbrCapPercent)
      .div(100)
      .minus(new Decimal(testCase.sample.existingMonthlyObligationsEGP));
    expect(result.affordableInstallmentEGP).toBe(
      expectedAffordable.greaterThan(0) ? expectedAffordable.toFixed(2) : '0.00',
    );
  });

  it('covers the no-match case, not only the resolved ones (FR-031)', () => {
    const noMatch = CASES.filter((c) => c.name.startsWith('NO MATCH'));
    expect(noMatch.length).toBeGreaterThanOrEqual(3);
  });
});

describe('FR-028 — the panel evaluates the DRAFT, never the stored rule', () => {
  it('ignores the saved table entirely', async () => {
    const service = serviceFor(STORED_RULE);
    const result = await service.checkIncomeRule('TEST-CHECK', {
      incomeAssumption: GRADE_DRAFT as never,
      sample: sample({ militaryGrade: 'officer' }),
    });
    // The stored table pays `officer` 99,999; the draft pays 15,000.
    expect(result.resolvedIncomeEGP).toBe('15000.00');
  });
});

describe('FR-029 — nothing is persisted', () => {
  it('never opens a transaction and never writes an audit event', async () => {
    // The stubs throw on any write, so reaching one fails the test rather than
    // silently succeeding.
    const service = serviceFor(STORED_RULE);
    await expect(
      service.checkIncomeRule('TEST-CHECK', {
        incomeAssumption: GRADE_DRAFT as never,
        sample: sample({ militaryGrade: 'general' }),
      }),
    ).resolves.toBeTruthy();
  });
});

describe('contracts § 2 — an unsaveable rule does not silently work here', () => {
  it.each([
    ['empty table', { strategy: 'byMilitaryGrade', keyTable: [] }, 'INCOME_RULE_EMPTY'],
    [
      'duplicate key',
      {
        strategy: 'byMilitaryGrade',
        keyTable: [
          { key: 'officer', incomeEGP: '1' },
          { key: 'officer', incomeEGP: '2' },
        ],
      },
      'INCOME_RULE_DUPLICATE_KEY',
    ],
    [
      'unknown key',
      { strategy: 'byMilitaryGrade', keyTable: [{ key: 'colonel', incomeEGP: '1000' }] },
      'INCOME_RULE_UNKNOWN_KEY',
    ],
    [
      'zero income',
      { strategy: 'byMilitaryGrade', keyTable: [{ key: 'officer', incomeEGP: '0' }] },
      'INCOME_RULE_INCOME_INVALID',
    ],
    [
      'gapped bands',
      {
        strategy: 'byYearsInPractice',
        bands: [
          { fromInclusive: '0', toExclusive: '5', incomeEGP: '1000' },
          { fromInclusive: '6', toExclusive: null, incomeEGP: '2000' },
        ],
      },
      'INCOME_RULE_BANDS_INVALID',
    ],
    [
      'out-of-range DBR override',
      {
        strategy: 'byMilitaryGrade',
        keyTable: [{ key: 'officer', incomeEGP: '1000' }],
        dbrCapPercentOverride: '0',
      },
      'INCOME_RULE_DBR_OVERRIDE_INVALID',
    ],
  ] as const)('rejects a %s with %s — the same code the save path raises', async (_n, draft, code) => {
    const service = serviceFor(STORED_RULE);
    await expect(
      service.checkIncomeRule('TEST-CHECK', {
        incomeAssumption: draft as never,
        sample: sample({ militaryGrade: 'officer' }),
      }),
    ).rejects.toMatchObject({ code });
  });
});
