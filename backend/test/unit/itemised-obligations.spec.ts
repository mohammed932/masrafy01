/**
 * Itemised obligations — the applicant states each debt separately and the total
 * is SUMMED, because one lump sum recalled from memory is the least reliable
 * input in the flow and the one with the largest effect on DBR.
 *
 * The property this file exists to hold is the one that made the design what it
 * is: **debt burden is only meaningful as a total.** Each debt is a separate answer,
 * and only the SUM reaches the quote — `resolveObligations` is the one place that
 * addition happens, so a per-debt figure can never leak into DBR on its own.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  CREDIT_CARD_DEBT_TYPE_OPTION,
  CREDIT_CARD_LIMIT_MONTHLY_PERCENT,
  CREDIT_CARD_LIMIT_QUESTION_CODE,
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  MONEY_FIELD_BINDINGS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
  OBLIGATION_ITEM_QUESTION_CODES,
  obligationItemQuestionFor,
  obligationMonthlyAmountFor,
  resolveObligations,
} from '@/matching/pipeline/money-field-bindings';

const ITEM = OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE;

function numericAnswers(entries: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(entries));
}

describe('resolveObligations — the sum', () => {
  it('sums only the debts whose type was picked', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '2000.00',
        [ITEM.mortgage]: '500.00',
        // Answered earlier, then the type was un-ticked. Must NOT count.
        [ITEM.personal_loan]: '9999.00',
      }),
      pickedDebtTypes: ['car_loan', 'mortgage'],
    });

    expect(resolved?.totalEGP.toFixed(2)).toBe('2500.00');
    expect(resolved?.itemised).toBe(true);
    expect(resolved?.itemisedCodes).toEqual([ITEM.car_loan, ITEM.mortgage]);
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
    // A card the applicant holds but has no limit left on is still a facility on
    // book. The old `total > 0` derivation could never express that.
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
        [ITEM.mortgage]: '500.00',
        // A tampered or stale client: the total is computed, not typed, so this
        // cannot be a user slip.
        [MONEY_FIELD_BINDINGS.existing_obligations]: '100.00',
      }),
      pickedDebtTypes: ['car_loan', 'mortgage'],
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
        [ITEM.mortgage]: '500.00',
        [MONEY_FIELD_BINDINGS.existing_obligations]: '2500.00',
      }),
      pickedDebtTypes: ['car_loan', 'mortgage'],
    });

    expect(resolved?.statedTotalMismatch).toBeNull();
  });

  it('tolerates a one-cent rounding difference', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '1000.01',
        [ITEM.mortgage]: '500.00',
        [MONEY_FIELD_BINDINGS.existing_obligations]: '1500.00',
      }),
      pickedDebtTypes: ['car_loan', 'mortgage'],
    });

    expect(resolved?.statedTotalMismatch).toBeNull();
  });
});

describe('credit cards state a LIMIT, and only a share of it is a monthly burden', () => {
  /**
   * A card has no fixed instalment and an undrawn limit is money the applicant can
   * draw tomorrow, so the whole portfolio limit is stated and discounted. These
   * tests pin the two halves that can silently go wrong: the discount is applied
   * (or the applicant's affordability collapses under a limit counted in full),
   * and it is applied to CARDS ONLY (or every real instalment shrinks to 5%).
   */
  it('converts the stated total limit at the platform percentage', () => {
    // The worked example: a 100 000 card at one bank plus a 50 000 card at
    // another is stated as one 150 000 figure, and 5% of it is 7 500 a month.
    const resolved = resolveObligations({
      numericByCode: numericAnswers({ [ITEM.credit_cards]: '150000.00' }),
      pickedDebtTypes: ['credit_cards'],
    });

    expect(resolved?.totalEGP.toFixed(2)).toBe('7500.00');
    expect(resolved?.hasCurrentLoan).toBe(true);
  });

  it('never counts the limit in full', () => {
    // The regression this conversion exists to prevent: 150 000 of obligation
    // against any realistic salary leaves no DBR room at all, so the applicant
    // would see every program as unaffordable.
    const resolved = resolveObligations({
      numericByCode: numericAnswers({ [ITEM.credit_cards]: '150000.00' }),
      pickedDebtTypes: ['credit_cards'],
    });

    expect(resolved?.totalEGP.lessThan(new Decimal('150000'))).toBe(true);
  });

  it('adds the card share alongside real instalments', () => {
    const resolved = resolveObligations({
      numericByCode: numericAnswers({
        [ITEM.car_loan]: '2000.00',
        [ITEM.credit_cards]: '150000.00',
      }),
      pickedDebtTypes: ['car_loan', 'credit_cards'],
    });

    // 2 000 instalment + 7 500 notional. The car loan is NOT discounted.
    expect(resolved?.totalEGP.toFixed(2)).toBe('9500.00');
  });

  it('discounts cards and nothing else', () => {
    const stated = new Decimal('150000.00');
    expect(obligationMonthlyAmountFor(CREDIT_CARD_DEBT_TYPE_OPTION, stated).toFixed(2)).toBe(
      '7500.00',
    );
    for (const debtType of ['car_loan', 'personal_loan', 'mortgage', 'other']) {
      expect(obligationMonthlyAmountFor(debtType, stated).toFixed(2)).toBe('150000.00');
    }
  });

  it('passes an unmapped debt type through at face value rather than dropping it', () => {
    // A new option added to the multi-select before this map is updated must not
    // silently vanish from the DBR.
    expect(obligationMonthlyAmountFor('student_loan', new Decimal('500')).toFixed(2)).toBe('500.00');
  });

  it('rounds the share away from zero on a half, matching the clients', () => {
    // Dart's `toStringAsFixed` and JS's `toFixed` both round a half away from
    // zero. Banker's rounding here would land one cent under the figure the app
    // computed and fail `OBLIGATIONS_TOTAL_MISMATCH` on a figure nobody typed.
    // 100.10 × 5% = 5.005.
    const share = obligationMonthlyAmountFor(CREDIT_CARD_DEBT_TYPE_OPTION, new Decimal('100.10'));
    expect(share.toFixed(2)).toBe('5.01');
  });

  it('routes the credit-card pick at the LIMIT question, not the retired instalment one', () => {
    expect(obligationItemQuestionFor(CREDIT_CARD_DEBT_TYPE_OPTION)).toBe(
      CREDIT_CARD_LIMIT_QUESTION_CODE,
    );
    // The pre-limit question is retired: leaving it mapped would ask for a
    // payment and then discount it by 95%.
    expect(OBLIGATION_ITEM_QUESTION_CODES).not.toContain('obligation_credit_card');
  });

  it('keeps the discount a percentage of the limit, in Decimal', () => {
    // Guards against the constant being re-expressed as a 0.05 float factor.
    expect(CREDIT_CARD_LIMIT_MONTHLY_PERCENT.toFixed(2)).toBe('5.00');
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
        [ITEM.personal_loan]: '0.20',
      }),
      pickedDebtTypes: ['car_loan', 'personal_loan'],
    });

    // 0.1 + 0.2 in binary floating point is 0.30000000000000004.
    expect(resolved?.totalEGP.equals(new Decimal('0.30'))).toBe(true);
  });
});
