/**
 * The operator-defined income FACT, end to end through the pure layer.
 *
 * Until the registry existed, "the bank works the income out from X" needed a release
 * for every new X: an enum member, a resolver branch, a profile field, a dropdown entry
 * and two locale strings. A fact is now a `surrogate_fact` row bound to a question, and
 * a rule names it with the strategy token `fact:<key>`.
 *
 * Three things are pinned here because each fails silently rather than loudly:
 *
 *   1. The RESOLVER reads the fact off the profile and looks it up in the bank's table,
 *      keyed for a choice answer and banded for a number.
 *   2. An unanswered / unknown fact yields a stated REASON, never a zero income — the
 *      whole point of FR-020, and the difference between "we could not price this" and
 *      "you earn nothing".
 *   3. The VALIDATOR refuses a rule the registry cannot serve, instead of letting it save
 *      and quote off the declared salary as though the table were not there.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import { validateIncomeRule } from '@/bank-programs/validation/income-rule.validator';
import { factKeyOf, factStrategy, type ApplicantProfile } from '@/matching/types';
import type { SurrogateFactBinding } from '@/matching/pipeline/surrogate-fact-registry';

const NO_ELIGIBILITY = { dbrCapPercent: '50' } as never;

/** A minimal applicant. `surrogateFacts` is the only part these specs vary. */
function profile(over: Partial<ApplicantProfile> = {}): ApplicantProfile {
  return {
    age: 34,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal(500_000),
    preferredTenorMonths: 60,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'salaried',
      // Zero, so a resolved figure can only have come from the fact — a declared salary
      // would win or blend and make the assertion prove nothing.
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

const TAXI: SurrogateFactBinding = {
  key: 'taxi_licence_class',
  questionCode: 'taxi_licence_class',
  type: 'SINGLE_SELECT',
};

const PATIENTS: SurrogateFactBinding = {
  key: 'weekly_patients',
  questionCode: 'weekly_patients',
  type: 'NUMERIC',
};

/** The validator's injected lookups, with a registry and one question's options. */
function ctx(facts: readonly SurrogateFactBinding[], options: readonly string[] = []) {
  return {
    isActiveMember: async () => true,
    activeMembers: async () => [],
    surrogateFacts: async () => facts,
    questionOptionCodes: async () => options,
  };
}

describe('fact:<key> strategy — token', () => {
  it('round-trips the key, and reads a built-in method as no fact at all', () => {
    expect(factKeyOf(factStrategy('taxi_licence_class'))).toBe('taxi_licence_class');
    expect(factKeyOf('byMilitaryGrade')).toBeNull();
    // `fact:` with nothing after it names no row. Returning `''` would send the resolver
    // looking one up and report a missing FACT for a rule that is simply malformed.
    expect(factKeyOf('fact:')).toBeNull();
  });
});

describe('registry fact — resolution', () => {
  it('looks a CHOICE answer up in the bank’s key table', () => {
    const resolution = resolveAssumedIncome({
      profile: profile({
        surrogateFacts: { taxi_licence_class: { kind: 'choice', optionCode: 'class_a' } },
      }),
      income: {
        strategy: factStrategy(TAXI.key),
        keyTable: [
          { key: 'class_a', incomeEGP: '18000' },
          { key: 'class_b', incomeEGP: '12000' },
        ],
      },
      eligibility: NO_ELIGIBILITY,
    });

    expect(resolution.incomeEGP.toString()).toBe('18000');
    expect(resolution.origin).toBe('surrogate');
    // The offer freezes this (Principle I), so the token has to survive resolution
    // intact — a program's rule must still be identifiable a year later.
    expect(resolution.strategy).toBe('fact:taxi_licence_class');
  });

  it('bands a NUMERIC answer, half-open like every other band table', () => {
    const income = (patients: string): string =>
      resolveAssumedIncome({
        profile: profile({
          surrogateFacts: { weekly_patients: { kind: 'numeric', value: new Decimal(patients) } },
        }),
        income: {
          strategy: factStrategy(PATIENTS.key),
          bands: [
            { fromInclusive: '0', toExclusive: '50', incomeEGP: '15000' },
            { fromInclusive: '50', toExclusive: null, incomeEGP: '40000' },
          ],
        },
        eligibility: NO_ELIGIBILITY,
      }).incomeEGP.toString();

    expect(income('49')).toBe('15000');
    // Exactly on the edge belongs to the UPPER band — `[from, to)`. The one boundary
    // every band table gets wrong when it is re-implemented per method.
    expect(income('50')).toBe('40000');
  });

  it('reports fact_not_answered rather than a zero when the applicant skipped it', () => {
    const resolution = resolveAssumedIncome({
      profile: profile(),
      income: {
        strategy: factStrategy(TAXI.key),
        keyTable: [{ key: 'class_a', incomeEGP: '18000' }],
      },
      eligibility: NO_ELIGIBILITY,
    });

    expect(resolution.origin).toBe('none');
    expect(resolution.unresolvedReason).toBe('fact_not_answered');
    expect(resolution.incomeEGP.toString()).toBe('0');
  });

  it('reports no_matching_row when the answer is outside the bank’s table', () => {
    const resolution = resolveAssumedIncome({
      profile: profile({
        surrogateFacts: { taxi_licence_class: { kind: 'choice', optionCode: 'class_c' } },
      }),
      income: {
        strategy: factStrategy(TAXI.key),
        keyTable: [{ key: 'class_a', incomeEGP: '18000' }],
      },
      eligibility: NO_ELIGIBILITY,
    });

    // A different problem from an unanswered question, and a different admin fix: add a
    // row here, versus ask the question there.
    expect(resolution.unresolvedReason).toBe('no_matching_row');
  });

  it('lets a declared salary carry the quote when the fact resolves to nothing', () => {
    const resolution = resolveAssumedIncome({
      profile: profile({
        employment: {
          ...profile().employment,
          monthlyNetSalaryEGP: new Decimal(9000),
        },
      }),
      income: { strategy: factStrategy(TAXI.key), keyTable: [{ key: 'class_a', incomeEGP: '1' }] },
      eligibility: NO_ELIGIBILITY,
    });

    // An unconfigured or unanswered fact must not blank out a program whose applicant
    // stated an income — it falls back, and says so through `origin`.
    expect(resolution.origin).toBe('declared');
    expect(resolution.incomeEGP.toString()).toBe('9000');
  });
});

describe('registry fact — save validation', () => {
  it('refuses a fact the registry cannot serve, and names the alternatives', async () => {
    const violation = await validateIncomeRule(
      { strategy: factStrategy('retired_fact'), keyTable: [{ key: 'x', incomeEGP: '1' }] },
      ctx([TAXI, PATIENTS]),
    );

    expect(violation).toEqual({
      kind: 'factUnavailable',
      factKey: 'retired_fact',
      availableFacts: ['taxi_licence_class', 'weekly_patients'],
    });
  });

  it('refuses a key the bound question does not offer', async () => {
    const violation = await validateIncomeRule(
      {
        strategy: factStrategy(TAXI.key),
        keyTable: [{ key: 'class_z', incomeEGP: '18000' }],
      },
      ctx([TAXI], ['class_a', 'class_b']),
    );

    // Reported against the QUESTION, not an enumeration: for a registry fact the keys
    // the bank picks from and the answers the customer picks from are one list.
    expect(violation).toMatchObject({
      kind: 'unknownKey',
      key: 'class_z',
      registry: 'taxi_licence_class',
    });
  });

  it('accepts a table whose keys are the question’s own options', async () => {
    const violation = await validateIncomeRule(
      {
        strategy: factStrategy(TAXI.key),
        keyTable: [
          { key: 'class_a', incomeEGP: '18000' },
          { key: 'class_b', incomeEGP: '12000' },
        ],
      },
      ctx([TAXI], ['class_a', 'class_b']),
    );

    expect(violation).toBeUndefined();
  });

  it('refuses an empty table for a numeric fact — no legacy scalar escape hatch', async () => {
    const violation = await validateIncomeRule(
      { strategy: factStrategy(PATIENTS.key), bands: [] },
      ctx([PATIENTS]),
    );

    // `byCDValue` may carry a legacy percent instead of bands (FR-015 protects figures
    // that already exist). No stored rule predates the registry, so a fact with nothing
    // configured is simply unconfigured.
    expect(violation).toEqual({ kind: 'empty', strategy: 'fact:weekly_patients' });
  });
});
