/**
 * A FACT BOUND TO A MULTI-PICK OR A TEXT QUESTION, end to end through the pure layer.
 *
 * Every pool question is tickable on a product's ask board, so a fact can be bound to a
 * question whose answer is a SET or free text. Neither had a reading before, and each one
 * fails silently if it is got wrong — an unemitted fact is `fact_not_answered` on every
 * quote, which looks exactly like a customer who skipped a question.
 *
 * What is pinned:
 *   1. the mapper EMITS the two new shapes, and emits nothing for an empty answer;
 *   2. the resolver reads a multi-pick by the BANK'S ROW ORDER, not by pick order;
 *   3. a text answer resolves off the one reserved presence key, and nothing reads the words;
 *   4. the validator holds a text-bound table to that key alone.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import { validateIncomeRule } from '@/bank-programs/validation/income-rule.validator';
import { surrogateFactsFromAnswers } from '@/matching/pipeline/surrogate-facts-from-answers';
import { PRESENCE_FACT_LOOKUP_KEY } from '@/matching/pipeline/fact-value';
import { factStrategy, type ApplicantProfile } from '@/matching/types';
import type { SurrogateFactBinding } from '@/matching/pipeline/surrogate-fact-registry';

const NO_ELIGIBILITY = { dbrCapPercent: '50' } as never;

const DEBT_TYPES: SurrogateFactBinding = {
  key: 'current_loans',
  questionCode: 'current_loans',
  type: 'MULTI_SELECT',
};

const NOTES: SurrogateFactBinding = {
  key: 'business_notes',
  questionCode: 'business_notes',
  type: 'TEXT',
};

function profile(over: Partial<ApplicantProfile> = {}): ApplicantProfile {
  return {
    age: 34,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal(500_000),
    preferredTenorMonths: 60,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'salaried',
      // Zero, so a resolved figure can only have come from the fact.
      monthlyNetSalaryEGP: new Decimal(0),
      monthsInJob: 0,
      salaryTransferType: 'none',
      companyName: '',
      companyType: '',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal(0),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: {},
    ...over,
  };
}

function ctx(facts: readonly SurrogateFactBinding[], options: readonly string[] = []) {
  return {
    isActiveMember: async () => true,
    activeMembers: async () => [],
    surrogateFacts: async () => facts,
    questionOptionCodes: async () => options,
  };
}

const EMPTY_ANSWERS = {
  optionByCode: new Map<string, string>(),
  numericByCode: new Map<string, string>(),
};

describe('answers → facts, for the two new shapes', () => {
  it('emits every code a multi-pick answer carries', () => {
    const facts = surrogateFactsFromAnswers(
      {
        ...EMPTY_ANSWERS,
        multiByCode: new Map([['current_loans', ['car_loan', 'mortgage']]]),
      },
      [DEBT_TYPES],
    );

    expect(facts.byKey.current_loans).toEqual({
      kind: 'choices',
      optionCodes: ['car_loan', 'mortgage'],
    });
  });

  it('emits PRESENCE for a text answer, and never the words', () => {
    const facts = surrogateFactsFromAnswers(
      { ...EMPTY_ANSWERS, textByCode: new Map([['business_notes', ' a workshop in Tanta ']]) },
      [NOTES],
    );

    // Presence only. Carrying the prose would put a reader one step from matching on it,
    // which is the keyword scoring A33 forbids.
    expect(facts.byKey.business_notes).toEqual({ kind: 'presence' });
  });

  it('emits NOTHING for an empty pick list or blank text', () => {
    const facts = surrogateFactsFromAnswers(
      {
        ...EMPTY_ANSWERS,
        multiByCode: new Map([['current_loans', []]]),
        textByCode: new Map([['business_notes', '   ']]),
      },
      [DEBT_TYPES, NOTES],
    );

    // `undefined`, so the resolver says `fact_not_answered` ("we never asked / you skipped")
    // rather than `no_matching_row` ("your answer is not in this bank's table").
    expect(facts.byKey.current_loans).toBeUndefined();
    expect(facts.byKey.business_notes).toBeUndefined();
  });
});

describe('resolution — a multi-pick fact', () => {
  const income = (picked: readonly string[], rows: readonly { key: string; egp: string }[]) =>
    resolveAssumedIncome({
      profile: profile({
        surrogateFacts: { current_loans: { kind: 'choices', optionCodes: [...picked] } },
      }),
      income: {
        strategy: factStrategy(DEBT_TYPES.key),
        keyTable: rows.map((r) => ({ key: r.key, incomeEGP: r.egp })),
      },
      eligibility: NO_ELIGIBILITY,
    });

  it('reads the first row the BANK lists, whatever order the applicant picked in', () => {
    const rows = [
      { key: 'mortgage', egp: '30000' },
      { key: 'car_loan', egp: '12000' },
    ];
    // Both applicants picked the same two answers, in opposite orders: one figure.
    expect(income(['car_loan', 'mortgage'], rows).incomeEGP.toString()).toBe('30000');
    expect(income(['mortgage', 'car_loan'], rows).incomeEGP.toString()).toBe('30000');
  });

  it('falls through to a later pick the bank does state a row for', () => {
    expect(
      income(['mortgage', 'car_loan'], [{ key: 'car_loan', egp: '12000' }]).incomeEGP.toString(),
    ).toBe('12000');
  });

  it('reports no_matching_row when the bank states none of the picks', () => {
    const resolution = income(['personal_loan'], [{ key: 'car_loan', egp: '12000' }]);
    expect(resolution.origin).not.toBe('surrogate');
    expect(resolution.unresolvedReason).toBe('no_matching_row');
  });
});

describe('resolution — a text fact', () => {
  it('resolves off the reserved presence key', () => {
    const resolution = resolveAssumedIncome({
      profile: profile({ surrogateFacts: { business_notes: { kind: 'presence' } } }),
      income: {
        strategy: factStrategy(NOTES.key),
        keyTable: [{ key: PRESENCE_FACT_LOOKUP_KEY, incomeEGP: '9000' }],
      },
      eligibility: NO_ELIGIBILITY,
    });

    expect(resolution.incomeEGP.toString()).toBe('9000');
    expect(resolution.origin).toBe('surrogate');
  });
});

describe('validation — a text-bound table', () => {
  it('accepts the presence key', async () => {
    const violation = await validateIncomeRule(
      {
        strategy: factStrategy(NOTES.key),
        keyTable: [{ key: PRESENCE_FACT_LOOKUP_KEY, incomeEGP: '9000' }],
      },
      ctx([NOTES]),
    );
    expect(violation).toBeUndefined();
  });

  it('refuses any other key, because nothing reads what the text SAYS', async () => {
    const violation = await validateIncomeRule(
      { strategy: factStrategy(NOTES.key), keyTable: [{ key: 'workshop', incomeEGP: '9000' }] },
      ctx([NOTES]),
    );
    expect(violation).toBeDefined();
  });

  it('holds a multi-pick table to the question’s own option codes', async () => {
    const violation = await validateIncomeRule(
      {
        strategy: factStrategy(DEBT_TYPES.key),
        keyTable: [{ key: 'boat_loan', incomeEGP: '1000' }],
      },
      ctx([DEBT_TYPES], ['car_loan', 'mortgage']),
    );
    expect(violation).toBeDefined();
  });
});
