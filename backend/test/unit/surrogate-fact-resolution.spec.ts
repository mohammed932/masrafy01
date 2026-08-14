/**
 * T044 / FR-018 – FR-021 / SC-008 — the customer half of the loop.
 *
 * Four claims:
 *   1. Each answer lands on the right `ApplicantProfile` path.
 *   2. A numeric answer passes through EXACTLY — no bucket midpoint (FR-018).
 *   3. "Not asked" and "asked but skipped" are the SAME outcome and neither is a
 *      zero: both leave the field undefined, which the resolver reports as
 *      `SURROGATE_FACT_MISSING` (FR-020).
 *   4. PREVIEW and APPLY derive the facts from the same function, so the same answer
 *      set cannot mean two things before and after apply (SC-008, A33).
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  surrogateFactsFromAnswers,
  type SurrogateFactAnswers,
} from '@/matching/pipeline/surrogate-facts-from-answers';
import {
  SURROGATE_FACT_BINDINGS,
  SURROGATE_FACT_KEYS,
  SURROGATE_FACT_SPECS,
  surrogateFactForQuestionCode,
} from '@/matching/pipeline/surrogate-fact-bindings';
import { resolveAssumedIncome } from '@/matching/pipeline/income-resolver';
import type { ApplicantProfile, EligibilityConfig } from '@/matching/types';

function answers(over: {
  options?: Record<string, string>;
  numerics?: Record<string, string>;
}): SurrogateFactAnswers {
  return {
    optionByCode: new Map(Object.entries(over.options ?? {})),
    numericByCode: new Map(Object.entries(over.numerics ?? {})),
  };
}

const ELIGIBILITY = { dbrCapPercent: '50.0000' } as unknown as EligibilityConfig;

function profileWith(facts: {
  militaryGrade?: string;
  professorRank?: string;
  yearsInPractice?: number;
  creditCardLimitEGP?: Decimal;
}): ApplicantProfile {
  return {
    age: 35,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal('300000'),
    requestedCurrency: 'EGP',
    preferredTenorMonths: 48,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'government_employee',
      monthlyNetSalaryEGP: new Decimal('0'),
      monthsInJob: 48,
      yearsInPractice: facts.yearsInPractice,
      professorRank: facts.professorRank,
      militaryGrade: facts.militaryGrade,
      salaryTransferType: 'payroll',
      companyName: '',
      companyType: '',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal('0'),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: { creditCardLimitEGP: facts.creditCardLimitEGP },
  };
}

// --- 1. each answer lands on the right path ---------------------------------

describe('answer → profile path, per fact', () => {
  it('military_grade → employment.militaryGrade, as the picked OPTION CODE', () => {
    const facts = surrogateFactsFromAnswers(
      answers({ options: { military_grade: 'senior_officer' } }),
    );
    expect(facts.employment.militaryGrade).toBe('senior_officer');
    // The option code is sent through untranslated: it IS the registry key the
    // admin's table rows are keyed by (FR-017). A translation layer here would be a
    // third list to keep in step.
    expect(SURROGATE_FACT_SPECS.military_grade.path).toBe('employment.militaryGrade');
  });

  it('academic_rank → employment.professorRank (registry professor_rank)', () => {
    const facts = surrogateFactsFromAnswers(
      answers({ options: { academic_rank: 'assistant_professor' } }),
    );
    expect(facts.employment.professorRank).toBe('assistant_professor');
    expect(SURROGATE_FACT_SPECS.academic_rank.registry).toBe('professor_rank');
  });

  it('years_in_practice → employment.yearsInPractice', () => {
    const facts = surrogateFactsFromAnswers(answers({ numerics: { years_in_practice: '11' } }));
    expect(facts.employment.yearsInPractice).toBe(11);
  });

  it('credit_card_total_limit → assets.creditCardLimitEGP as a Decimal', () => {
    const facts = surrogateFactsFromAnswers(
      answers({ numerics: { credit_card_total_limit: '150000' } }),
    );
    expect(facts.assets.creditCardLimitEGP?.toFixed(2)).toBe('150000.00');
  });

  it('reads its bindings from the SPEC, so a fifth fact cannot be half-wired', () => {
    for (const fact of SURROGATE_FACT_KEYS) {
      const spec = SURROGATE_FACT_SPECS[fact];
      expect(spec.questionCode).toBe(SURROGATE_FACT_BINDINGS[fact]);
      expect(surrogateFactForQuestionCode(spec.questionCode)).toBe(fact);
      expect(spec.path.length).toBeGreaterThan(0);
    }
  });

  it('binds the card limit to the EXISTING question, not a second one', () => {
    // One fact, two uses, asked once: the same figure feeds the 5% obligation
    // discount. A second card-limit question would ask the applicant twice.
    expect(SURROGATE_FACT_SPECS.credit_card_limit.questionCode).toBe('credit_card_total_limit');
  });
});

// --- 2. numeric pass-through exactness --------------------------------------

describe('FR-018 — numeric answers pass through exactly', () => {
  it.each(['1', '150000', '999999.99', '0.01'])('keeps a card limit of %s to the cent', (raw) => {
    const facts = surrogateFactsFromAnswers(answers({ numerics: { credit_card_total_limit: raw } }));
    expect(facts.assets.creditCardLimitEGP?.equals(new Decimal(raw))).toBe(true);
  });

  it('preserves precision a double would round', () => {
    const raw = '10000000000000000001';
    const facts = surrogateFactsFromAnswers(answers({ numerics: { credit_card_total_limit: raw } }));
    expect(facts.assets.creditCardLimitEGP?.toFixed(0)).toBe(raw);
  });

  it('floors years to completed years rather than rounding up', () => {
    // The band edges are integers, and 11.9 years in practice is 11 completed years.
    // Rounding to 12 would move an applicant into the next band.
    expect(
      surrogateFactsFromAnswers(answers({ numerics: { years_in_practice: '11.9' } })).employment
        .yearsInPractice,
    ).toBe(11);
  });

  it('never approximates to a bucket midpoint', () => {
    // The defect feature 010 removed for the money answers, restated for the facts:
    // a stated 150 000 must not become "the 100k–200k bucket → 150k" by coincidence
    // of the bucket, so an odd value proves the pass-through.
    const facts = surrogateFactsFromAnswers(
      answers({ numerics: { credit_card_total_limit: '137426.51' } }),
    );
    expect(facts.assets.creditCardLimitEGP?.toFixed(2)).toBe('137426.51');
  });
});

// --- 3. unasked and skipped are the same, and neither is zero ---------------

describe('FR-020 — an absent fact is undefined, never defaulted', () => {
  it('leaves every field undefined when nothing was answered', () => {
    const facts = surrogateFactsFromAnswers(answers({}));
    expect(facts.employment).toEqual({});
    expect(facts.assets).toEqual({});
  });

  it('treats an empty pick as unanswered, not as an unmatched key', () => {
    // `''` would reach the resolver's key lookup and miss, reporting "your grade isn't
    // in this bank's table" when the truth is "you never told us your grade" — two
    // different reasons with two different admin fixes (research R9).
    const facts = surrogateFactsFromAnswers(answers({ options: { military_grade: '' } }));
    expect(facts.employment.militaryGrade).toBeUndefined();
  });

  it('treats an empty numeric string as unanswered rather than zero', () => {
    const facts = surrogateFactsFromAnswers(answers({ numerics: { years_in_practice: '' } }));
    expect(facts.employment.yearsInPractice).toBeUndefined();
  });

  it('drops an unparseable numeric rather than substituting a figure', () => {
    const facts = surrogateFactsFromAnswers(
      answers({ numerics: { credit_card_total_limit: 'not-a-number' } }),
    );
    expect(facts.assets.creditCardLimitEGP).toBeUndefined();
  });

  it('UNASKED and SKIPPED both resolve to SURROGATE_FACT_MISSING, identically', () => {
    // AS-2.4 / AS-2.5. The two are indistinguishable by design: from the engine's
    // point of view there is no answer either way, and inventing a distinction would
    // mean the mapper knowing what the questionnaire asked.
    const unasked = surrogateFactsFromAnswers(answers({}));
    const skipped = surrogateFactsFromAnswers(answers({ options: { military_grade: '' } }));
    expect(unasked.employment.militaryGrade).toBe(skipped.employment.militaryGrade);

    for (const facts of [unasked, skipped]) {
      const resolution = resolveAssumedIncome({
        profile: profileWith(facts.employment),
        income: {
          strategy: 'byMilitaryGrade',
          keyTable: [{ key: 'officer', incomeEGP: '15000' }],
        },
        eligibility: ELIGIBILITY,
      });
      expect(resolution.origin).toBe('none');
      expect(resolution.unresolvedReason).toBe('fact_not_answered');
    }
  });

  it('a DEAD registry key is reported, not silently resolved', () => {
    // The applicant answered; the bank's table has no row for it. That is
    // `no_matching_row`, a different reason from "not answered", and it must not fall
    // through to any income at all.
    const facts = surrogateFactsFromAnswers(answers({ options: { military_grade: 'colonel' } }));
    const resolution = resolveAssumedIncome({
      profile: profileWith(facts.employment),
      income: { strategy: 'byMilitaryGrade', keyTable: [{ key: 'officer', incomeEGP: '15000' }] },
      eligibility: ELIGIBILITY,
    });
    expect(resolution.origin).toBe('none');
    expect(resolution.unresolvedReason).toBe('no_matching_row');
    expect(resolution.incomeEGP.isZero()).toBe(true);
  });
});

// --- 4. preview / apply parity ----------------------------------------------

describe('SC-008 — preview and apply derive the facts identically', () => {
  /**
   * Both call sites reshape their own answer representation into the two maps and hand
   * them to `surrogateFactsFromAnswers`. So parity is structural: the assertion is
   * that the SAME two maps produce the same facts and therefore the same resolution,
   * whichever caller built them.
   */
  const shared = answers({
    options: { military_grade: 'senior_officer', academic_rank: 'lecturer' },
    numerics: { years_in_practice: '11', credit_card_total_limit: '150000' },
  });

  it('produces byte-identical facts from the same answer set', () => {
    const a = surrogateFactsFromAnswers(shared);
    const b = surrogateFactsFromAnswers(shared);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('resolves the same income for every fact-reading strategy', () => {
    const facts = surrogateFactsFromAnswers(shared);
    const profile = profileWith({
      militaryGrade: facts.employment.militaryGrade,
      professorRank: facts.employment.professorRank,
      yearsInPractice: facts.employment.yearsInPractice,
      creditCardLimitEGP: facts.assets.creditCardLimitEGP,
    });

    const cases = [
      {
        income: {
          strategy: 'byMilitaryGrade' as const,
          keyTable: [{ key: 'senior_officer', incomeEGP: '25000' }],
        },
        expected: '25000.00',
      },
      {
        income: {
          strategy: 'byProfessorRank' as const,
          keyTable: [{ key: 'lecturer', incomeEGP: '12000' }],
        },
        expected: '12000.00',
      },
      {
        income: {
          strategy: 'byYearsInPractice' as const,
          bands: [
            { fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' },
            { fromInclusive: '5', toExclusive: null, incomeEGP: '30000' },
          ],
        },
        expected: '30000.00',
      },
      {
        income: {
          strategy: 'byCreditCardLimit' as const,
          scalar: { value: '0.1', unit: 'multiplier' as const },
        },
        expected: '15000.00',
      },
    ];

    for (const c of cases) {
      const resolution = resolveAssumedIncome({
        profile,
        income: c.income,
        eligibility: ELIGIBILITY,
      });
      expect(resolution.incomeEGP.toFixed(2), c.income.strategy).toBe(c.expected);
      expect(resolution.origin, c.income.strategy).toBe('surrogate');
    }
  });

  it('traces each figure to exactly one configured row or band (FR-030)', () => {
    const facts = surrogateFactsFromAnswers(shared);
    const keyed = resolveAssumedIncome({
      profile: profileWith(facts.employment),
      income: {
        strategy: 'byMilitaryGrade',
        keyTable: [
          { key: 'officer', incomeEGP: '15000' },
          { key: 'senior_officer', incomeEGP: '25000' },
        ],
      },
      eligibility: ELIGIBILITY,
    });
    expect(keyed.matchedRow).toEqual({ key: 'senior_officer' });

    const banded = resolveAssumedIncome({
      profile: profileWith(facts.employment),
      income: {
        strategy: 'byYearsInPractice',
        bands: [
          { fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' },
          { fromInclusive: '5', toExclusive: null, incomeEGP: '30000' },
        ],
      },
      eligibility: ELIGIBILITY,
    });
    expect(banded.matchedRow).toEqual({ fromInclusive: '5', toExclusive: null });
  });
});
