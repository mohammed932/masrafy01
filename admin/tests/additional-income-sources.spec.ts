import { describe, expect, it } from 'vitest';

import { additionalIncomeSources } from '../src/app/features/bank-programs/additional-income-sources';
import type { RegistryFact } from '../src/app/features/bank-programs/bank-programs.types';

/**
 * The real shape of a numeric registry fact, trimmed to what the filter reads.
 * `gate` null = the questionnaire asks it of everyone.
 */
function fact(
  key: string,
  label: string,
  gate: string | null,
  type: 'NUMERIC' | 'SINGLE_SELECT' = 'NUMERIC',
): RegistryFact {
  return {
    key,
    label,
    ownedBy: null,
    question: {
      code: key,
      label,
      type,
      active: true,
      options: [],
      parentOptions: [],
      askedIn: ['personal'],
      enabledWhen: gate === null ? null : { questionCode: gate, optionCode: 'yes' },
    },
  };
}

/** The four the seed gates on `additional_income`, and a sample of what surrounded them. */
const RENT = fact('rental_income_monthly', 'Rental income', 'additional_income');
const CD = fact('cd_returns_monthly', 'Certificate or deposit returns', 'additional_income');
const FIXED = fact('fixed_allowances_monthly', 'Fixed allowances', 'additional_income');
const VARIABLE = fact('variable_allowances_monthly', 'Variable allowances', 'additional_income');
const CONTRACT_PRICE = fact('unit_contract_price', 'What is the contract price of the unit?', null);
const MONTHS_SINCE = fact('pledged_months_since_issue', 'How many months ago was it issued?', null);
const I_SCORE = fact('i_score', 'I-Score', null);
const CARD_LIMIT = fact('credit_card_limit', 'Credit card limit', 'current_loans');
const GRADE = fact('military_grade', 'Military grade', null, 'SINGLE_SELECT');

const REGISTRY = [
  CONTRACT_PRICE,
  RENT,
  MONTHS_SINCE,
  CD,
  I_SCORE,
  FIXED,
  CARD_LIMIT,
  VARIABLE,
  GRADE,
];

describe('additionalIncomeSources', () => {
  it('offers exactly the sources the questionnaire gates on additional_income', () => {
    expect(additionalIncomeSources(REGISTRY).map((o) => o.key)).toEqual([
      'rental_income_monthly',
      'cd_returns_monthly',
      'fixed_allowances_monthly',
      'variable_allowances_monthly',
    ]);
  });

  it('drops the numeric facts that are not money the applicant receives', () => {
    const keys = additionalIncomeSources(REGISTRY).map((o) => o.key);
    // Each of these was offered a percentage box before the gate became the filter.
    expect(keys).not.toContain('unit_contract_price');
    expect(keys).not.toContain('pledged_months_since_issue');
    expect(keys).not.toContain('i_score');
  });

  it('does not treat a fact gated on some OTHER question as additional income', () => {
    // The card limit is asked behind "which loans do you have?" — a gate, but not this one.
    expect(additionalIncomeSources([CARD_LIMIT])).toEqual([]);
  });

  it('never offers a choice fact, gated or not', () => {
    const choice = fact('school_type', 'School type', 'additional_income', 'SINGLE_SELECT');
    expect(additionalIncomeSources([choice])).toEqual([]);
  });

  it('keeps a source this program already weighs, and tags it', () => {
    // The weight is stored and still counting. Dropping the row would leave it in effect
    // with nothing on any screen able to see or clear it.
    const out = additionalIncomeSources(REGISTRY, ['i_score']);
    expect(out.map((o) => o.key)).toContain('i_score');
    expect(out.find((o) => o.key === 'i_score')?.retired).toBe(true);
  });

  it('does not tag a still-asked source that the program weighs', () => {
    const out = additionalIncomeSources(REGISTRY, ['rental_income_monthly']);
    expect(out.find((o) => o.key === 'rental_income_monthly')).toEqual({
      key: 'rental_income_monthly',
      label: 'Rental income',
    });
  });

  it('reads an older backend that sends no gate at all as "not additional income"', () => {
    // `enabledWhen` absent is "the field did not travel", which must not be read as the
    // permissive answer — that is the seventeen-row table again.
    const noField = { ...RENT, question: { ...RENT.question!, enabledWhen: undefined } };
    expect(additionalIncomeSources([noField])).toEqual([]);
  });

  it('preserves registry order rather than imposing one of its own', () => {
    expect(additionalIncomeSources([VARIABLE, RENT]).map((o) => o.key)).toEqual([
      'variable_allowances_monthly',
      'rental_income_monthly',
    ]);
  });
});
