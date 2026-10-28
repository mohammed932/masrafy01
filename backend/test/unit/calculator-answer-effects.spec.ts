/**
 * The loan calculator applies the applicant's answer offer effects (v31.3.0) — with the same
 * reader, selector and `quoteProgram` as preview and apply, so a figure here never disagrees
 * with the offer card for the same answers and program.
 *
 * Program: 24% reducing, 6…84 months, max 1 000 000, DBR 60%. Effects (fixed questions):
 *   "Do you have a bank statement?" No            → max loan −20%, rate +2, term ≤ 48 (income proof only)
 *   "What do you own?" Car / Apartment (several)  → rate +0.5 / max loan −5%
 *   "Months in your current job" under 12         → max loan −10%, rate +1
 */

import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CalculatorService } from '../../src/calculator/calculator.service';
import type {
  AffordabilityQuoteResponseDto,
  CalculatorQuoteDto,
  CostQuoteResponseDto,
} from '../../src/calculator/dto/calculator.dto';
import type { AnswerEffectSource } from '../../src/matching/pipeline/answer-effects';
import type { SubmittedAnswerDto } from '../../src/questionnaire/dto/questionnaire.dto';

const AGE = 34;

const SNAPSHOT = {
  versionNumber: 9,
  groups: [
    {
      code: 'g',
      questions: [
        {
          code: 'has_bank_statement',
          type: 'SINGLE_SELECT',
          categories: ['personal'],
          options: [{ code: 'yes' }, { code: 'no' }],
        },
        {
          code: 'owned_assets',
          type: 'MULTI_SELECT',
          categories: ['personal'],
          options: [{ code: 'car' }, { code: 'apartment' }, { code: 'nothing' }],
        },
        {
          code: 'months_in_current_job',
          type: 'NUMERIC',
          categories: ['personal'],
          numeric: { minValue: '0', maxValue: '600', step: '1' },
          options: [],
        },
        // Asked of car loans only: not an answer a personal program's calculator can take.
        {
          code: 'car_price',
          type: 'NUMERIC',
          categories: ['car'],
          numeric: { minValue: '1', maxValue: '50000000', step: null },
          options: [],
        },
      ],
    },
  ],
};

const SOURCES: AnswerEffectSource[] = [
  {
    kind: 'option',
    questionCode: 'has_bank_statement',
    optionCode: 'no',
    incomeProofOnly: true,
    levers: { maxLoanPercent: '-20', ratePoints: '2', maxTenorMonths: 48 },
  },
  {
    kind: 'range',
    questionCode: 'months_in_current_job',
    range: { fromInclusive: null, toExclusive: '12' },
    incomeProofOnly: false,
    levers: { maxLoanPercent: '-10', ratePoints: '1' },
  },
  {
    kind: 'option',
    questionCode: 'owned_assets',
    optionCode: 'car',
    incomeProofOnly: false,
    levers: { ratePoints: '0.5' },
  },
  {
    kind: 'option',
    questionCode: 'owned_assets',
    optionCode: 'apartment',
    incomeProofOnly: false,
    levers: { maxLoanPercent: '-5' },
  },
];

const programRow = (id: string, programType: 'income_proof' | 'income_surrogate') => ({
  id,
  programCode: id.toUpperCase(),
  programNameKey: null,
  bankName: 'Test Bank',
  bank: { isFeatured: false },
  isShariaCompliant: false,
  friendlyName: 'Test Program',
  productCategory: 'personal',
  programType,
  active: true,
  version: 1,
  requiredDocuments: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  tenor: { minMonths: 6, maxMonths: 84 },
  loanLimits: { minAmountEGP: '10000', maxAmountEGP: '1000000' },
  pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
  eligibility: { dbrCapPercent: '60.0000', skipDbrCheck: false },
  incomeAssumption: { strategy: 'declared' },
  fees: { adminFeePercent: '0' },
});

const ROWS: Record<string, ReturnType<typeof programRow>> = {
  ip_1: programRow('ip_1', 'income_proof'),
  sg_1: programRow('sg_1', 'income_surrogate'),
};

function makeService(questionnaire?: unknown) {
  return new CalculatorService(
    { findById: async (id: string) => ROWS[id] ?? null } as never,
    { getOrThrow: () => '26.0000' } as unknown as ConfigService,
    { programNameIncomeRules: async () => new Map() } as never,
    (questionnaire ?? {
      activeVersion: async () => ({ id: 'ver_9', snapshot: SNAPSHOT }),
      answerEffectSources: async () => SOURCES,
    }) as never,
  );
}

const cost = (over: Partial<CalculatorQuoteDto> = {}): CalculatorQuoteDto => ({
  mode: 'cost',
  bankProgramId: 'ip_1',
  amountEGP: '300000.00',
  tenorMonths: 60,
  ...over,
});

const affordability = (over: Partial<CalculatorQuoteDto> = {}): CalculatorQuoteDto => ({
  mode: 'affordability',
  bankProgramId: 'ip_1',
  monthlyIncomeEGP: '1000000.00',
  existingObligationsEGP: '0.00',
  tenorMonths: 60,
  ...over,
});

const a = (questionCode: string, value: Partial<SubmittedAnswerDto>) =>
  ({ questionCode, ...value }) as SubmittedAnswerDto;

const NO_STATEMENT = [a('has_bank_statement', { optionCode: 'no' })];
const YES_STATEMENT = [a('has_bank_statement', { optionCode: 'yes' })];

async function costQuote(dto: CalculatorQuoteDto): Promise<CostQuoteResponseDto> {
  return (await makeService().quote(dto, AGE)) as CostQuoteResponseDto;
}
async function affordabilityQuote(dto: CalculatorQuoteDto): Promise<AffordabilityQuoteResponseDto> {
  return (await makeService().quote(dto, AGE)) as AffordabilityQuoteResponseDto;
}

describe('calculator — no answers, or answers that change nothing', () => {
  it('without answers the quote is the bank offer, with no effects said', async () => {
    const quote = await costQuote(cost());
    expect(quote.effectiveRatePercent).toBe('24.0000');
    expect(quote.tenorMonths).toBe(60);
    expect(quote.limits.maxAmountEGP).toBe('1000000.00');
    expect(quote.limits.maxTenorMonths).toBe(84);
    expect(quote.answerEffects).toBeUndefined();
  });

  it('a "Yes" that carries no effect quotes exactly like no answers', async () => {
    expect(await costQuote(cost({ answers: YES_STATEMENT }))).toEqual(await costQuote(cost()));
  });

  it('a number in no range quotes exactly like no answers', async () => {
    const answers = [a('months_in_current_job', { numericValue: '24' })];
    expect(await costQuote(cost({ answers }))).toEqual(await costQuote(cost()));
  });

  it('a generic quote has no program, so answers move nothing — the questionnaire is not even read', async () => {
    const service = makeService({
      activeVersion: async () => {
        throw new Error('must not be read');
      },
      answerEffectSources: async () => {
        throw new Error('must not be read');
      },
    });
    const dto = cost({ bankProgramId: undefined, answers: NO_STATEMENT });
    const quote = (await service.quote(dto, AGE)) as CostQuoteResponseDto;
    expect(quote.isRepresentativeRate).toBe(true);
    expect(quote.effectiveRatePercent).toBe('26.0000');
    expect(quote.answerEffects).toBeUndefined();
  });
});

describe('calculator — cost mode with effects', () => {
  it('"No bank statement": rate 24% → 26%, term 60 → 48, max loan 1 000 000 → 800 000', async () => {
    const quote = await costQuote(cost({ answers: NO_STATEMENT }));
    expect(quote.effectiveRatePercent).toBe('26.0000');
    expect(quote.tenorMonths).toBe(48);
    expect(quote.clamped.tenor).toBe(true);
    expect(quote.limits.maxAmountEGP).toBe('800000.00');
    expect(quote.limits.maxTenorMonths).toBe(48);
    expect(quote.answerEffects).toEqual([
      {
        questionCode: 'has_bank_statement',
        optionCode: 'no',
        maxLoanPercent: '-20',
        ratePoints: '2',
        maxTenorMonths: 48,
      },
    ]);
  });

  it('an amount over the cut cap is clamped to it', async () => {
    const quote = await costQuote(cost({ amountEGP: '950000.00', answers: NO_STATEMENT }));
    expect(quote.cashToCustomerEGP).toBe('800000.00');
    expect(quote.clamped.amount).toBe(true);
  });

  it('several choices: Car and Apartment both apply (+0.5 points, −5%)', async () => {
    const quote = await costQuote(
      cost({ answers: [a('owned_assets', { optionCodes: ['car', 'apartment'] })] }),
    );
    expect(quote.effectiveRatePercent).toBe('24.5000');
    expect(quote.limits.maxAmountEGP).toBe('950000.00');
    expect(quote.answerEffects?.map((e) => e.optionCode)).toEqual(['car', 'apartment']);
  });

  it('a number range: 6 months in the job → +1 point, −10%', async () => {
    const quote = await costQuote(
      cost({ answers: [a('months_in_current_job', { numericValue: '6' })] }),
    );
    expect(quote.effectiveRatePercent).toBe('25.0000');
    expect(quote.limits.maxAmountEGP).toBe('900000.00');
    expect(quote.answerEffects).toEqual([
      {
        questionCode: 'months_in_current_job',
        range: { fromInclusive: null, toExclusive: '12' },
        value: '6',
        maxLoanPercent: '-10',
        ratePoints: '1',
      },
    ]);
  });

  it('all of them at once: points add up, caps compound, the shortest term wins', async () => {
    const quote = await costQuote(
      cost({
        amountEGP: '950000.00',
        answers: [
          ...NO_STATEMENT,
          a('owned_assets', { optionCodes: ['car', 'apartment'] }),
          a('months_in_current_job', { numericValue: '6' }),
        ],
      }),
    );
    // 24 + 2 + 1 + 0.5; 1 000 000 × 0.8 × 0.9 × 0.95.
    expect(quote.effectiveRatePercent).toBe('27.5000');
    expect(quote.limits.maxAmountEGP).toBe('684000.00');
    expect(quote.cashToCustomerEGP).toBe('684000.00');
    expect(quote.tenorMonths).toBe(48);
  });
});

describe('calculator — which programs an effect reaches', () => {
  it('an income-proof question never moves a no-payslip program', async () => {
    const withAnswer = await costQuote(cost({ bankProgramId: 'sg_1', answers: NO_STATEMENT }));
    const without = await costQuote(cost({ bankProgramId: 'sg_1' }));
    expect(withAnswer).toEqual(without);
  });

  it('a question asked on every program moves a no-payslip program too', async () => {
    const quote = await costQuote(
      cost({ bankProgramId: 'sg_1', answers: [a('months_in_current_job', { numericValue: '6' })] }),
    );
    expect(quote.effectiveRatePercent).toBe('25.0000');
  });
});

describe('calculator — affordability mode with effects', () => {
  it('"No bank statement" lowers the most this income can borrow to the cut cap, at the new rate and term', async () => {
    const without = await affordabilityQuote(affordability());
    const withAnswer = await affordabilityQuote(affordability({ answers: NO_STATEMENT }));
    expect(without.maxAffordableAmountEGP).toBe('1000000.00');
    expect(withAnswer.maxAffordableAmountEGP).toBe('800000.00');
    expect(withAnswer.effectiveRatePercent).toBe('26.0000');
    expect(withAnswer.tenorMonths).toBe(48);
    expect(withAnswer.answerEffects?.[0]?.optionCode).toBe('no');
  });

  it('a modest income: the higher rate and shorter term lower the DBR-bound maximum', async () => {
    const modest = { monthlyIncomeEGP: '20000.00' };
    const without = await affordabilityQuote(affordability(modest));
    const withAnswer = await affordabilityQuote(affordability({ ...modest, answers: NO_STATEMENT }));
    expect(Number(withAnswer.maxAffordableAmountEGP)).toBeLessThan(
      Number(without.maxAffordableAmountEGP),
    );
    // The instalment room is the income's, not the answers': 20 000 × 60%.
    expect(withAnswer.maxMonthlyInstallmentEGP).toBe(without.maxMonthlyInstallmentEGP);
  });
});

describe('calculator — the answers are checked like preview checks them', () => {
  it('refuses an answer to a question this loan type does not ask', async () => {
    await expect(
      costQuote(cost({ answers: [a('car_price', { numericValue: '500000' })] })),
    ).rejects.toMatchObject({ code: 'UNKNOWN_QUESTION_CODE' });
  });

  it('refuses an answer that is not one of the options', async () => {
    await expect(
      costQuote(cost({ answers: [a('has_bank_statement', { optionCode: 'maybe' })] })),
    ).rejects.toMatchObject({ code: expect.any(String) });
  });

  it('says so when no questionnaire is published', async () => {
    const service = makeService({
      activeVersion: async () => null,
      answerEffectSources: async () => SOURCES,
    });
    await expect(service.quote(cost({ answers: NO_STATEMENT }), AGE)).rejects.toMatchObject({
      code: 'QUESTIONNAIRE_NOT_PUBLISHED',
    });
  });
});
