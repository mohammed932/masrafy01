/**
 * WHICH POOL QUESTION MAY BECOME A FACT — the domain half, table-driven.
 *
 * Every entry here passes the TYPE check and must still be refused, which is why nothing
 * else catches them: they are all NUMERIC. The one that matters most is `monthly_income` —
 * binding it as a fact would let a no-payslip rule read the applicant's declared payslip,
 * the exact figure a withheld product rule exists to keep out of a quote.
 */
import { describe, expect, it } from 'vitest';
import {
  FACT_INELIGIBLE_QUESTION_CODES,
  RESERVED_FACT_KEYS,
  factQuestionIneligibleReason,
  isReservedFactKey,
} from '@/matching/pipeline/fact-question-eligibility';
import { BANK_AXES } from '@/matching/pipeline/bank-relationship';
import { I_SCORE_FACT_KEY } from '@/matching/pipeline/product-template';

describe('factQuestionIneligibleReason', () => {
  it.each([
    ['monthly_income', 'money_binding'],
    ['amount_requested', 'money_binding'],
    ['repayment_period_months', 'money_binding'],
    ['current_installments', 'money_binding'],
    ['obligation_car_loan', 'obligation_item'],
    ['obligation_personal_loan', 'obligation_item'],
    ['obligation_mortgage', 'obligation_item'],
    ['obligation_other', 'obligation_item'],
    ['current_loans', 'debt_types'],
  ])('refuses %s as %s', (code, reason) => {
    expect(factQuestionIneligibleReason(code)).toBe(reason);
  });

  it('refuses every bank-axis question', () => {
    for (const axis of BANK_AXES) {
      expect(factQuestionIneligibleReason(axis.questionCode)).toBe('bank_axis');
    }
  });

  it('ALLOWS the credit-card limit', () => {
    // The deliberate exception: `credit_card_total_limit` is already bound to the platform
    // fact `credit_card_limit`, so refusing the whole obligation block would refuse a fact
    // the platform ships.
    expect(factQuestionIneligibleReason('credit_card_total_limit')).toBeUndefined();
  });

  it('allows an ordinary question', () => {
    expect(factQuestionIneligibleReason('owned_unit_type')).toBeUndefined();
  });

  it('lists every refused code, so a refusal can name the alternatives', () => {
    for (const code of FACT_INELIGIBLE_QUESTION_CODES) {
      expect(factQuestionIneligibleReason(code)).toBeDefined();
    }
    expect(FACT_INELIGIBLE_QUESTION_CODES).not.toContain('credit_card_total_limit');
  });
});

describe('reserved fact keys', () => {
  it('covers the platform-wide I-Score', () => {
    expect(isReservedFactKey(I_SCORE_FACT_KEY)).toBe(true);
  });

  it('covers every derived per-bank axis', () => {
    // A row under one of these is created, bound, audited and rendered — and never carries
    // an answer, because the answer→fact mapper skips derived keys by contract.
    for (const axis of BANK_AXES) {
      expect(isReservedFactKey(axis.factKey)).toBe(true);
      expect(RESERVED_FACT_KEYS).toContain(axis.factKey);
    }
  });

  it('leaves an ordinary key alone', () => {
    expect(isReservedFactKey('owned_unit_type')).toBe(false);
  });
});
