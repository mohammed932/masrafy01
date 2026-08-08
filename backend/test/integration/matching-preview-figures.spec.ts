/**
 * Preview carries the money (feature 010, FR-022a/FR-024).
 *
 * Two things are pinned here:
 *
 *  1. The preview runs the SAME `quoteProgram` the offers are built from, so the
 *     installment and the borrowing ceiling shown before applying are the ones
 *     that survive applying.
 *  2. A program the applicant cannot afford is still LISTED, carrying a reason
 *     instead of figures. Dropping it would make DBR a hard eligibility filter,
 *     which Anti-Pattern A33 forbids.
 */
import { describe, expect, it, vi } from 'vitest';
import { MatchingPreviewService } from '@/matching-preview/matching-preview.service';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';

const numericQuestion = (code: string, max: string) => ({
  code,
  type: 'NUMERIC',
  isRequired: false,
  numeric: { minValue: '0.00', maxValue: max, step: null },
  options: [],
});

/** The four bound money questions (`MONEY_FIELD_BINDINGS`) plus one scored pick. */
const SNAPSHOT = {
  versionNumber: 4,
  groups: [
    {
      code: 'financing_info',
      questions: [
        numericQuestion('amount_requested', '20000000.00'),
        numericQuestion('repayment_period_months', '360.00'),
        numericQuestion('monthly_income', '10000000.00'),
        numericQuestion('current_installments', '10000000.00'),
        {
          code: 'loan_purpose',
          type: 'SINGLE_SELECT',
          isRequired: false,
          options: [{ code: 'education' }],
        },
      ],
    },
  ],
};

/** 26% fixed, no fees, a 60% DBR cap — the reference sheet's worked example. */
const PROGRAM = {
  id: 'prog_1',
  programCode: 'CIB-PRIME-PERSONAL',
  bankName: 'CIB',
  bank: { isFeatured: false },
  isShariaCompliant: false,
  friendlyName: 'Prime Personal Loan',
  productCategory: 'PERSONAL',
  programType: 'income_proof',
  currencies: ['EGP'],
  active: true,
  version: 1,
  requiredDocuments: ['national_id'],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  tenor: { minMonths: 6, maxMonths: 84 },
  loanLimits: { perCurrency: { EGP: { minAmount: '10000', maxAmount: '5000000' } } },
  pricing: { isVariableRate: false, baseRatePercent: '26.0000' },
  eligibility: { ageMin: 21, ageMax: 65, dbrCapPercent: '60.0000', skipDbrCheck: false },
  incomeAssumption: { strategy: 'declared' },
  fees: { adminFeePercent: '0' },
};

function makeService() {
  const scoreProgram = vi.fn(async () => ({
    probability: 0.42,
    tier: 'moderate',
    usedDefault: false,
    factors: { positive: [{ code: 'education', impact: 42 }], negative: [] },
  }));
  return new MatchingPreviewService(
    { activeVersion: async () => ({ id: 'ver_4', snapshot: SNAPSHOT }) } as never,
    { scoreProgram } as never,
    { findAllActive: async () => [PROGRAM] } as never,
  );
}

const moneyAnswers = (obligations: string): SubmittedAnswerDto[] =>
  [
    { questionCode: 'amount_requested', numericValue: '300000' },
    { questionCode: 'repayment_period_months', numericValue: '60' },
    { questionCode: 'monthly_income', numericValue: '100000' },
    { questionCode: 'current_installments', numericValue: obligations },
  ] as SubmittedAnswerDto[];

function preview(answers: SubmittedAnswerDto[]) {
  // Derived from the caller's birthday in production (Principle XXXVII / A31);
  // 34 against ageMax 65 leaves the age-at-maturity rule with nothing to cut.
  return makeService().preview({ category: 'personal' as never, answers, age: 34 });
}

describe('preview figures', () => {
  it('quotes the requested amount and reports the ceiling the salary supports', async () => {
    const { matches } = await preview(moneyAnswers('40000'));
    const match = matches[0];

    expect(match).toBeDefined();
    expect(match?.figuresUnavailableReason).toBeNull();
    // 100 000 × 60% = 60 000 allowance − 40 000 committed = 20 000 a month,
    // which over 60 months at 26% is worth ~668 000 today.
    expect(match?.maxAffordableAmountEGP).toBe('667992.20');
    // The ask fits inside that, so it is quoted untouched.
    expect(match?.figures?.cashToCustomerEGP).toBe('300000.00');
    expect(match?.figures?.bindingConstraint).toBe('requested_amount');
    expect(match?.figures?.dbrCapPercent).toBe('60.0000');
    expect(match?.effectiveRatePercent).toBe('26.0000');
  });

  it('cuts the amount to the affordable ceiling when the ask is too big', async () => {
    const { matches } = await preview([
      ...moneyAnswers('40000').filter((a) => a.questionCode !== 'amount_requested'),
      { questionCode: 'amount_requested', numericValue: '2000000' } as SubmittedAnswerDto,
    ]);
    const match = matches[0];

    expect(match?.figures?.bindingConstraint).toBe('dbr_affordability');
    expect(match?.figures?.cashToCustomerEGP).toBe('667992.20');
    // Never quoted above its own cap (FR-022b).
    expect(Number(match?.figures?.dbrPercent)).toBeLessThanOrEqual(60);
  });

  it('still lists a program the applicant cannot afford, with the reason (A33)', async () => {
    const { matches } = await preview(moneyAnswers('60000')); // eats the whole allowance
    const match = matches[0];

    expect(matches).toHaveLength(1); // listed, not filtered out
    expect(match?.eligible).toBe(true);
    expect(match?.figures).toBeNull();
    expect(match?.figuresUnavailableReason).toBe('OBLIGATIONS_EXCEED_ALLOWANCE');
    expect(match?.maxAffordableAmountEGP).toBe('0.00');
    expect(match?.approvalProbability).toBe(0.42); // still scored + ranked
  });

  /**
   * The scorer already computes the per-answer breakdown behind the score. It
   * used to be discarded here, which left every surface asserting a percentage
   * it could not explain — and a dropped field looks identical to a program with
   * nothing scored.
   */
  it('carries the scorer’s factor breakdown through to the match', async () => {
    const { matches } = await preview(moneyAnswers('40000'));

    expect(matches[0]?.approvalFactors.positive).toEqual([{ code: 'education', impact: 42 }]);
  });

  it('lists programs without figures until every money answer is in', async () => {
    const { matches } = await preview([
      { questionCode: 'monthly_income', numericValue: '100000' },
    ] as SubmittedAnswerDto[]);
    const match = matches[0];

    expect(matches).toHaveLength(1);
    expect(match?.figures).toBeNull();
    expect(match?.figuresUnavailableReason).toBe('MONEY_FIGURE_MISSING');
    expect(match?.monthlyInstallmentEGP).toBeNull();
  });
});
