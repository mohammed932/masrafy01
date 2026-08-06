/**
 * Itemised obligations — the applicant states each debt separately and the total
 * is SUMMED, because one lump sum recalled from memory is the least reliable
 * input in the flow and the one with the largest effect on DBR.
 *
 * The property this file exists to hold is the one that made the design what it
 * is: **debt burden is only meaningful as a total.** Band each debt on its own
 * and one 5 000 car loan reads "high debt" once (a single low score) while three
 * 1 700 debts read "low debt" three times (three high scores) — the same real
 * burden scoring opposite ways, with the v13.0.0 asked-weight denominator
 * shifting underneath it too, because a three-debt applicant is asked three more
 * weighted questions than a one-debt applicant.
 *
 * That is why the five per-debt questions are capture-only (unweighted, no
 * bands) and only `current_installments`, the derived total, carries the
 * obligations weight. These tests pin both halves: the sum is right, and the
 * scored figure is identical for two applicants with the same burden split
 * differently.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  MONEY_FIELD_BINDINGS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
  OBLIGATION_ITEM_QUESTION_CODES,
  obligationItemQuestionFor,
  resolveObligations,
} from '@/matching/pipeline/money-field-bindings';
import {
  computeProbability,
  normalizeWeights,
  type ProgramScoring,
  type SelectedAnswer,
} from '@/matching/scoring/approval-probability.scorer';

const ITEM = OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE;

function numericAnswers(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('resolveObligations — the sum', () => {
  it('sums only the debts whose type was picked', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '2000.00',
        [ITEM.credit_cards]: '500.00',
        // Answered earlier, then the type was un-ticked. Must NOT count.
        [ITEM.personal_loan]: '9999.00',
      }),
      pickedDebtTypes: ['car_loan', 'credit_cards'],
    });

    expect(resolved?.totalEGP.toFixed(2)).toBe('2500.00');
    expect(resolved?.itemised).toBe(true);
    expect(resolved?.itemisedCodes).toEqual([ITEM.car_loan, ITEM.credit_cards]);
  });

  it('treats an explicit "none" pick as a stated zero, not as a missing figure', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({}),
      pickedDebtTypes: [DEBT_TYPE_NONE_OPTION],
    });

    // A real 0 — the applicant said so. Distinguishing this from "unanswered" is
    // the whole reason the `none` option exists: an empty multi-select is
    // indistinguishable from an untouched one.
    expect(resolved).not.toBeNull();
    expect(resolved?.totalEGP.toFixed(2)).toBe('0.00');
    expect(resolved?.hasCurrentLoan).toBe(false);
  });

  it('derives hasCurrentLoan from the PICK, not from the amount', () => {
    // A credit card carried at a zero minimum payment is still a loan on book.
    // The old `total > 0` derivation could never express that.
    const resolved = resolveObligations({
      numericByCode: numericAnswers({ [ITEM.credit_cards]: '0.00' }),
      pickedDebtTypes: ['credit_cards'],
    });

    expect(resolved?.totalEGP.toFixed(2)).toBe('0.00');
    expect(resolved?.hasCurrentLoan).toBe(true);
  });

  it('ignores a picked type whose amount has not been answered yet', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({ [ITEM.car_loan]: '2000.00' }),
      pickedDebtTypes: ['car_loan', 'mortgage'],
    });

    expect(resolved?.totalEGP.toFixed(2)).toBe('2000.00');
    expect(resolved?.itemisedCodes).toEqual([ITEM.car_loan]);
  });

  it('falls back to the stated lump sum when the snapshot serves no debt-type question', () => {
    // A questionnaire published before this feature. It must keep working rather
    // than resolve to "no figures" and blank every quote.
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [MONEY_FIELD_BINDINGS.existing_obligations]: '3400.00',
      }),
    });

    expect(resolved?.totalEGP.toFixed(2)).toBe('3400.00');
    expect(resolved?.itemised).toBe(false);
    expect(resolved?.hasCurrentLoan).toBe(true);
  });

  it('returns null on the fallback path when nothing was stated', () => {
    // FR-044: never substitute a default for a missing money figure.
    expect(resolveObligations({ numericByCode: numericAnswers({}) })).toBeNull();
  });
});

describe('resolveObligations — the stated total is cross-checked, never preferred', () => {
  it('reports a mismatch when the submitted total disagrees with the sum', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '2000.00',
        [ITEM.credit_cards]: '500.00',
        // A tampered or stale client: the total is computed, not typed, so this
        // cannot be a user slip.
        [MONEY_FIELD_BINDINGS.existing_obligations]: '100.00',
      }),
      pickedDebtTypes: ['car_loan', 'credit_cards'],
    });

    // The SUM stands regardless — editing the total must not buy affordability.
    expect(resolved?.totalEGP.toFixed(2)).toBe('2500.00');
    expect(resolved?.statedTotalMismatch).not.toBeNull();
    expect(resolved?.statedTotalMismatch?.statedEGP.toFixed(2)).toBe('100.00');
    expect(resolved?.statedTotalMismatch?.computedEGP.toFixed(2)).toBe('2500.00');
  });

  it('accepts a total that agrees with the sum', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '2000.00',
        [ITEM.credit_cards]: '500.00',
        [MONEY_FIELD_BINDINGS.existing_obligations]: '2500.00',
      }),
      pickedDebtTypes: ['car_loan', 'credit_cards'],
    });

    expect(resolved?.statedTotalMismatch).toBeNull();
  });

  it('tolerates a one-cent rounding difference', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '1000.01',
        [ITEM.credit_cards]: '500.00',
        [MONEY_FIELD_BINDINGS.existing_obligations]: '1500.00',
      }),
      pickedDebtTypes: ['car_loan', 'credit_cards'],
    });

    expect(resolved?.statedTotalMismatch).toBeNull();
  });
});

describe('the scoring trap — burden is scored as a TOTAL, never per debt', () => {
  /**
   * One weighted obligations question: the derived total, banded lower-is-better.
   * Weights sum to 100, as `assertQuestionWeightsSumTo100` requires on save.
   */
  const SCORING: ProgramScoring = normalizeWeights({
    questionWeights: { monthly_income: 50, [MONEY_FIELD_BINDINGS.existing_obligations]: 50 },
    answerScores: {},
    numericBands: {
      monthly_income: [{ from: null, to: null, score: 100 }],
      [MONEY_FIELD_BINDINGS.existing_obligations]: [
        { from: null, to: '2500', score: 100 },
        { from: '2500', to: '6000', score: 40 },
        { from: '6000', to: null, score: 10 },
      ],
    },
  });

  /** Score an applicant whose debts are `debts`, split however they like. */
  function scoreFor(debts: Record<string, string>, picks: string[]): number {
    const obligations = resolveObligations({
      numericByCode: numericAnswers(debts),
      pickedDebtTypes: picks,
    });
    expect(obligations).not.toBeNull();

    // The asked set: the debt-type question, one amount question per pick, and
    // the total. Only the total (and income) is WEIGHTED — see the module doc.
    const askedQuestionCodes = [
      DEBT_TYPES_QUESTION_CODE,
      ...picks.map((p) => obligationItemQuestionFor(p)).filter((c): c is string => c !== undefined),
      MONEY_FIELD_BINDINGS.existing_obligations,
      'monthly_income',
    ];

    const answers: SelectedAnswer[] = [
      { questionCode: 'monthly_income', kind: 'numeric', value: '20000' },
      {
        questionCode: MONEY_FIELD_BINDINGS.existing_obligations,
        kind: 'numeric',
        value: obligations!.totalEGP.toFixed(2),
      },
    ];

    return computeProbability(SCORING, answers, askedQuestionCodes);
  }

  it('scores one big debt and several small debts of the same burden identically', () => {
    const oneBigDebt = scoreFor({ [ITEM.car_loan]: '5100.00' }, ['car_loan']);
    const threeSmallDebts = scoreFor(
      {
        [ITEM.car_loan]: '1700.00',
        [ITEM.credit_cards]: '1700.00',
        [ITEM.personal_loan]: '1700.00',
      },
      ['car_loan', 'credit_cards', 'personal_loan'],
    );

    // Same 5 100 burden → same band → same score, however it is split. Had the
    // per-debt questions been weighted, the three-debt applicant would have
    // scored three "low debt" bands AND carried three extra weighted questions
    // in the denominator.
    expect(threeSmallDebts).toBe(oneBigDebt);
  });

  it('still separates a genuinely lighter burden from a heavier one', () => {
    // The guard above must not be achieved by making obligations stop mattering.
    const light = scoreFor({ [ITEM.credit_cards]: '400.00' }, ['credit_cards']);
    const heavy = scoreFor({ [ITEM.car_loan]: '7000.00' }, ['car_loan']);

    expect(light).toBeGreaterThan(heavy);
  });

  it('leaves the denominator unchanged as the number of debts grows', () => {
    // The per-debt questions ARE asked (they enter `askedQuestionCodes`), but
    // they carry no weight, so they cannot move the denominator.
    const oneDebt = scoreFor({ [ITEM.car_loan]: '1000.00' }, ['car_loan']);
    const fiveDebts = scoreFor(
      {
        [ITEM.car_loan]: '200.00',
        [ITEM.credit_cards]: '200.00',
        [ITEM.personal_loan]: '200.00',
        [ITEM.mortgage]: '200.00',
        [ITEM.other]: '200.00',
      },
      ['car_loan', 'credit_cards', 'personal_loan', 'mortgage', 'other'],
    );

    expect(fiveDebts).toBe(oneDebt);
  });
});

describe('the debt-type → amount-question mapping', () => {
  it('maps every debt type to exactly one amount question, and none collide', () => {
    const codes = Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE);
    expect(new Set(codes).size).toBe(codes.length);
    expect(OBLIGATION_ITEM_QUESTION_CODES).toEqual(codes);
  });

  it('does not map the "none" option to an amount question', () => {
    // `none` exists to mean "no amounts to state", so a mapping would be a bug —
    // and publish validation exempts it for exactly this reason.
    expect(obligationItemQuestionFor(DEBT_TYPE_NONE_OPTION)).toBeUndefined();
  });

  it('does not map an unknown option', () => {
    expect(obligationItemQuestionFor('student_loan')).toBeUndefined();
  });

  it('never maps a debt type onto the derived total', () => {
    // The total is summed FROM the items; if an item aliased it the sum would
    // fold its own result back in.
    expect(OBLIGATION_ITEM_QUESTION_CODES).not.toContain(
      MONEY_FIELD_BINDINGS.existing_obligations,
    );
  });
});

describe('Decimal discipline (Principle I)', () => {
  it('sums in Decimal, so cents do not drift', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '0.10',
        [ITEM.credit_cards]: '0.20',
      }),
      pickedDebtTypes: ['car_loan', 'credit_cards'],
    });

    // 0.1 + 0.2 in binary floating point is 0.30000000000000004.
    expect(resolved?.totalEGP.equals(new Decimal('0.30'))).toBe(true);
  });
});
