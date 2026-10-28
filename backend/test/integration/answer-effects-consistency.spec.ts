/**
 * ONE set of answers, ONE program — the loan calculator, the offer preview and the apply path
 * must land on the same adjusted figures (v31.3.0 acceptance criterion).
 *
 * Each path runs its own real code against the same fakes:
 *   preview    — `MatchingPreviewService.preview` (reads the answers with `answer-reading.ts`);
 *   calculator — `CalculatorService.quote`, affordability and cost (the same reader);
 *   apply      — `answerMapsOf` (apply's own reading of its resolved answers) → the shared
 *                selector → `EngineService.run`, the engine apply persists offers from.
 *
 * Program: 24%, 6…84 months, max 1 000 000, DBR 60%, no fees. Effects (fixed questions):
 *   has_bank_statement = no            → −20%, +2 points, ≤ 48 months (income-proof programs only)
 *   months_in_current_job under 12     → −10%, +1 point
 *   owned_assets ∋ car / ∋ apartment   → +0.5 points / −5%
 */

import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { ConfigService } from '@nestjs/config';
import { MatchingPreviewService } from '@/matching-preview/matching-preview.service';
import { CalculatorService } from '@/calculator/calculator.service';
import { EngineService } from '@/matching/engine.service';
import { toBankProgramSnapshot } from '@/bank-programs/bank-program-snapshot.mapper';
import { answerMapsOf } from '@/applications/applications.service';
import {
  answerEffectsFromAnswers,
  answerPicksFromMaps,
  type AnswerEffectSource,
} from '@/matching/pipeline/answer-effects';
import type {
  AffordabilityQuoteResponseDto,
  CostQuoteResponseDto,
} from '@/calculator/dto/calculator.dto';
import type { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';
import type { ResolvedAnswer } from '@/questionnaire/questionnaire.service';
import { eligibilityFixture, profileFixture } from '../helpers/matching';

const AGE = 34;
const INCOME = '1000000';
const TENOR = 60;
/** Far above any cap, so each path quotes the program's (adjusted) maximum. */
const ASK = '5000000';

const numeric = (code: string, max: string) => ({
  code,
  type: 'NUMERIC',
  categories: ['personal'],
  numeric: { minValue: '0', maxValue: max, step: null },
  options: [],
});

const SNAPSHOT = {
  versionNumber: 11,
  groups: [
    {
      code: 'g',
      questions: [
        numeric('amount_requested', '50000000'),
        numeric('repayment_period_months', '360'),
        numeric('monthly_income', '50000000'),
        numeric('current_installments', '50000000'),
        numeric('months_in_current_job', '600'),
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
      ],
    },
  ],
};

/** In question-code order, as `QuestionnaireRepository.answerEffectSources` returns them. */
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
  friendlyName: `Program ${id}`,
  productCategory: 'personal',
  programType,
  active: true,
  version: 1,
  requiredDocuments: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  tenor: { minMonths: 6, maxMonths: 84 },
  loanLimits: { minAmountEGP: '10000', maxAmountEGP: '1000000' },
  pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
  // Complete, as a stored program's is: apply's engine runs the eligibility checks over it.
  eligibility: eligibilityFixture({ dbrCapPercent: '60.0000' }),
  incomeAssumption: { strategy: 'declared' },
  fees: { adminFeePercent: '0' },
});

const ROWS = [programRow('ip_1', 'income_proof'), programRow('sg_1', 'income_surrogate')];

const questionnaireRepo = {
  activeVersion: async () => ({ id: 'ver_11', snapshot: SNAPSHOT }),
  answerEffectSources: async () => SOURCES,
};
const enumerations = {
  programNameIncomeRules: async () => new Map(),
  surrogateFactRegistry: async () => [],
  enumerationParentKeys: async () => ({}),
};

const preview = new MatchingPreviewService(
  questionnaireRepo as never,
  { findAllActive: async () => ROWS } as never,
  { assertOfferedUnder: async () => undefined } as never,
  enumerations as never,
);
const calculator = new CalculatorService(
  { findById: async (id: string) => ROWS.find((r) => r.id === id) ?? null } as never,
  { getOrThrow: () => '26.0000' } as unknown as ConfigService,
  enumerations as never,
  questionnaireRepo as never,
);
const engine = new EngineService();

const a = (questionCode: string, value: Partial<SubmittedAnswerDto>) =>
  ({ questionCode, ...value }) as SubmittedAnswerDto;

/** The applicant's answers that can move the offer, without the money ones. */
type EffectAnswers = SubmittedAnswerDto[];

const ALL_EFFECTS: EffectAnswers = [
  a('has_bank_statement', { optionCode: 'no' }),
  a('months_in_current_job', { numericValue: '6' }),
  a('owned_assets', { optionCodes: ['car', 'apartment'] }),
];
const NO_EFFECTS: EffectAnswers = [
  a('has_bank_statement', { optionCode: 'yes' }),
  a('months_in_current_job', { numericValue: '24' }),
  a('owned_assets', { optionCodes: ['nothing'] }),
];

interface Figures {
  ratePercent: string;
  tenorMonths: number;
  maxLoanEGP: string;
}

async function viaPreview(programId: string, answers: EffectAnswers): Promise<Figures> {
  const { matches } = await preview.preview({
    category: 'personal' as never,
    age: AGE,
    answers: [
      a('amount_requested', { numericValue: ASK }),
      a('repayment_period_months', { numericValue: String(TENOR) }),
      a('monthly_income', { numericValue: INCOME }),
      a('current_installments', { numericValue: '0' }),
      ...answers,
    ],
  });
  const match = matches.find((m) => m.bankProgramId === programId);
  const figures = match?.figures;
  if (!figures) throw new Error(`preview gave ${programId} no figures`);
  return {
    ratePercent: new Decimal(figures.effectiveRatePercent).toFixed(4),
    tenorMonths: figures.effectiveTenorMonths,
    maxLoanEGP: new Decimal(figures.maxAffordableAmountEGP).toFixed(2),
  };
}

async function viaCalculator(programId: string, answers: EffectAnswers): Promise<Figures> {
  const quote = (await calculator.quote(
    {
      mode: 'affordability',
      bankProgramId: programId,
      monthlyIncomeEGP: INCOME,
      existingObligationsEGP: '0',
      tenorMonths: TENOR,
      answers,
    },
    AGE,
  )) as AffordabilityQuoteResponseDto;
  return {
    ratePercent: new Decimal(quote.effectiveRatePercent).toFixed(4),
    tenorMonths: quote.tenorMonths,
    maxLoanEGP: new Decimal(quote.maxAffordableAmountEGP).toFixed(2),
  };
}

/** What `resolveAnswers` hands apply for the same answers (live pool, validated). */
function resolved(answers: EffectAnswers): ResolvedAnswer[] {
  return answers.map((ans) => {
    const q = SNAPSHOT.groups[0]!.questions.find((x) => x.code === ans.questionCode)!;
    const picks = ans.optionCodes ?? (ans.optionCode !== undefined ? [ans.optionCode] : []);
    return {
      questionId: `q_${q.code}`,
      questionCode: q.code,
      type: q.type as ResolvedAnswer['type'],
      selectedOptionCodes: picks,
      selectedOptionCode: q.type === 'SINGLE_SELECT' ? (picks[0] ?? null) : null,
      selectedOptionId: null,
      textValue: null,
      numericValue: ans.numericValue ?? null,
    };
  });
}

function viaApply(programId: string, answers: EffectAnswers): Figures {
  // Apply's own steps: its answer maps, the shared selector, then the engine it persists from.
  const answerEffects = answerEffectsFromAnswers(
    SOURCES,
    answerPicksFromMaps(answerMapsOf(resolved(answers))),
  );
  const profile = {
    ...profileFixture({
      age: AGE,
      requestedAmountEGP: new Decimal(ASK),
      preferredTenorMonths: TENOR,
      employment: {
        ...profileFixture().employment,
        monthlyNetSalaryEGP: new Decimal(INCOME),
        salaryTransferType: 'none',
      },
    } as never),
    ...(answerEffects.length > 0 ? { answerEffects } : {}),
  };
  const result = engine.run({
    profile,
    programs: ROWS.map((r) => toBankProgramSnapshot(r as never)),
    skipEligibility: true,
  });
  const offer = result.offers.find((o) => o.programCode === programId.toUpperCase());
  if (!offer) throw new Error(`apply gave ${programId} no offer`);
  return {
    ratePercent: new Decimal(offer.effectiveRatePercent).toFixed(4),
    tenorMonths: offer.effectiveTenorMonths,
    maxLoanEGP: new Decimal(offer.maxLoanAvailableEGP).toFixed(2),
  };
}

async function allThree(programId: string, answers: EffectAnswers) {
  return {
    preview: await viaPreview(programId, answers),
    calculator: await viaCalculator(programId, answers),
    apply: viaApply(programId, answers),
  };
}

describe('calculator, preview and apply agree on the adjusted offer', () => {
  it('income-proof program, every effect on: 27.5%, 48 months, 684 000', async () => {
    const got = await allThree('ip_1', ALL_EFFECTS);
    // 24 + 2 + 1 + 0.5 points; 1 000 000 × 0.8 × 0.9 × 0.95; the 48-month ceiling.
    const expected: Figures = { ratePercent: '27.5000', tenorMonths: 48, maxLoanEGP: '684000.00' };
    expect(got.preview).toEqual(expected);
    expect(got.calculator).toEqual(expected);
    expect(got.apply).toEqual(expected);
  });

  it('no-payslip program: the income-proof question does not reach it, the others do', async () => {
    const got = await allThree('sg_1', ALL_EFFECTS);
    // 24 + 1 + 0.5 points; 1 000 000 × 0.9 × 0.95; no term ceiling.
    const expected: Figures = { ratePercent: '25.5000', tenorMonths: 60, maxLoanEGP: '855000.00' };
    expect(got.preview).toEqual(expected);
    expect(got.calculator).toEqual(expected);
    expect(got.apply).toEqual(expected);
  });

  it('answers that carry no effect leave every path on the bank offer', async () => {
    for (const programId of ['ip_1', 'sg_1']) {
      const got = await allThree(programId, NO_EFFECTS);
      const expected: Figures = { ratePercent: '24.0000', tenorMonths: 60, maxLoanEGP: '1000000.00' };
      expect(got.preview).toEqual(expected);
      expect(got.calculator).toEqual(expected);
      expect(got.apply).toEqual(expected);
    }
  });

  it('one Yes/No answer alone moves all three paths the same way', async () => {
    const got = await allThree('ip_1', [a('has_bank_statement', { optionCode: 'no' })]);
    const expected: Figures = { ratePercent: '26.0000', tenorMonths: 48, maxLoanEGP: '800000.00' };
    expect(got.preview).toEqual(expected);
    expect(got.calculator).toEqual(expected);
    expect(got.apply).toEqual(expected);
  });

  it('the calculator cost mode clamps to the same adjusted cap, rate and term', async () => {
    const quote = (await calculator.quote(
      {
        mode: 'cost',
        bankProgramId: 'ip_1',
        amountEGP: ASK,
        tenorMonths: TENOR,
        answers: ALL_EFFECTS,
      },
      AGE,
    )) as CostQuoteResponseDto;
    expect(quote.cashToCustomerEGP).toBe('684000.00');
    expect(quote.effectiveRatePercent).toBe('27.5000');
    expect(quote.tenorMonths).toBe(48);
    expect(quote.limits).toMatchObject({ maxAmountEGP: '684000.00', maxTenorMonths: 48 });
  });
});
