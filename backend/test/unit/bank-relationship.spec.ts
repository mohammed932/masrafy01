/**
 * The derived `bank_relationship` fact — who the applicant already banks with, per program.
 *
 * Two things are worth pinning: the SLUG (the question's option codes and the programs' bank
 * names are two different files that have to agree), and the DEFAULT (a skipped question must
 * read as "new to this bank", never as a missing requirement).
 */

import { describe, expect, it } from 'vitest';
import {
  BANK_AXES,
  BANK_RELATIONSHIP_EXISTING,
  BANK_RELATIONSHIP_FACT_KEY,
  BANK_RELATIONSHIP_NEW,
  bankRelationshipFact,
  bankSlug,
  factsForProgram,
  LOAN_TOPUP_FACT_KEY,
  OTHER_PRODUCT_FACT_KEY,
} from '../../src/matching/pipeline/bank-relationship';
import {
  DERIVED_FACT_KEYS,
  derivedFactOptionCodes,
  isDerivedFactKey,
} from '../../src/matching/pipeline/surrogate-fact-registry';

describe('bankSlug', () => {
  it('folds the accent on the one seeded bank that has one', () => {
    // `Crédit Agricole Egypt` is a real seeded partner. A byte-wise strip would yield
    // `crdit_agricole_egypt` on one side and match nothing on the other.
    expect(bankSlug('Crédit Agricole Egypt')).toBe('credit_agricole_egypt');
  });

  it('agrees with the questionnaire seed on every seeded bank name', () => {
    // The questionnaire's `bankOptions` calls this same function; these are the codes a
    // customer's answer actually carries.
    expect(bankSlug('ABK Egypt')).toBe('abk_egypt');
    expect(bankSlug('EG Bank')).toBe('eg_bank');
    expect(bankSlug('FABMISR')).toBe('fabmisr');
    expect(bankSlug('National Bank of Egypt')).toBe('national_bank_of_egypt');
    expect(bankSlug('Housing & Development Bank')).toBe('housing_development_bank');
  });
});

describe('bankRelationshipFact', () => {
  it('is an existing customer when the bank is in the list', () => {
    expect(bankRelationshipFact('ABK Egypt', ['fabmisr', 'abk_egypt'])).toEqual({
      kind: 'choice',
      optionCode: BANK_RELATIONSHIP_EXISTING,
    });
  });

  it('is new to the bank when the list names other banks', () => {
    expect(bankRelationshipFact('ABK Egypt', ['fabmisr'])).toEqual({
      kind: 'choice',
      optionCode: BANK_RELATIONSHIP_NEW,
    });
  });

  it('is new to the bank when the question was skipped', () => {
    // Always an answer, never `undefined`: the question is optional, and a bank with a second
    // column must still be able to quote its first.
    expect(bankRelationshipFact('ABK Egypt', undefined).optionCode).toBe(BANK_RELATIONSHIP_NEW);
    expect(bankRelationshipFact('ABK Egypt', []).optionCode).toBe(BANK_RELATIONSHIP_NEW);
  });

  it('is new to the bank when the program carries no bank name', () => {
    expect(bankRelationshipFact(undefined, ['abk_egypt']).optionCode).toBe(BANK_RELATIONSHIP_NEW);
  });
});

describe('the derived-fact registry', () => {
  it('knows the key, so save-time validation does not demand a registry row for it', () => {
    expect(DERIVED_FACT_KEYS).toContain('bank_relationship');
    expect(isDerivedFactKey('bank_relationship')).toBe(true);
    expect(isDerivedFactKey('compound_unit_type')).toBe(false);
  });

  it('states the branches a rule may key off, so a typo is refused at save', () => {
    expect(derivedFactOptionCodes('bank_relationship')).toEqual(['ntb', 'xsell']);
    expect(derivedFactOptionCodes('compound_unit_type')).toBeNull();
  });
});

/**
 * The other two axes (spec §10.3).
 *
 * The case that matters is the one sentence in the spec: a customer who holds a card at a
 * bank but has no loan there is X-SELL to FABMISR, existing to EGBank and NTB to ABK. If
 * these three ever collapse back into one question, that applicant reads the wrong row at
 * two banks out of three — so it is pinned as one test with one applicant.
 */
describe('the three per-bank axes', () => {
  const cardHolderAtAbk = {
    surrogateFacts: {},
    bankAxisSlugs: {
      bank_relationship: ['abk_egypt'],
      // No loan anywhere, a card at ABK.
      loan_is_topup: [],
      holds_other_product: ['abk_egypt'],
    },
  };

  it('reads three different columns at one bank for one applicant', () => {
    const facts = factsForProgram({ profile: cardHolderAtAbk, programBankName: 'ABK Egypt' });
    expect(facts[BANK_RELATIONSHIP_FACT_KEY]).toEqual({ kind: 'choice', optionCode: 'xsell' });
    expect(facts[LOAN_TOPUP_FACT_KEY]).toEqual({ kind: 'choice', optionCode: 'new_loan' });
    expect(facts[OTHER_PRODUCT_FACT_KEY]).toEqual({
      kind: 'choice',
      optionCode: 'other_product_held',
    });
  });

  it('reads the standard column of every axis at a bank the applicant never named', () => {
    const facts = factsForProgram({ profile: cardHolderAtAbk, programBankName: 'EG Bank' });
    expect(facts[BANK_RELATIONSHIP_FACT_KEY]).toEqual({ kind: 'choice', optionCode: 'ntb' });
    expect(facts[LOAN_TOPUP_FACT_KEY]).toEqual({ kind: 'choice', optionCode: 'new_loan' });
    expect(facts[OTHER_PRODUCT_FACT_KEY]).toEqual({
      kind: 'choice',
      optionCode: 'other_product_none',
    });
  });

  it('answers every axis for an applicant who answered none', () => {
    const facts = factsForProgram({ profile: { surrogateFacts: {} }, programBankName: 'ABK Egypt' });
    for (const axis of BANK_AXES) {
      expect(facts[axis.factKey]).toEqual({ kind: 'choice', optionCode: axis.standard });
    }
  });

  it('spells each axis its own columns, so one cannot be re-pointed at another', () => {
    const codes = BANK_AXES.flatMap((axis) => [axis.standard, axis.matched]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('registers all three, so a rule may key off any of them with no registry row', () => {
    for (const axis of BANK_AXES) {
      expect(isDerivedFactKey(axis.factKey)).toBe(true);
      expect(derivedFactOptionCodes(axis.factKey)).toEqual([axis.standard, axis.matched]);
    }
  });

  it('lets a stored answer win a collision, as it always did', () => {
    const facts = factsForProgram({
      profile: {
        surrogateFacts: { [LOAN_TOPUP_FACT_KEY]: { kind: 'choice', optionCode: 'top_up' } },
        bankAxisSlugs: { loan_is_topup: [] },
      },
      programBankName: 'ABK Egypt',
    });
    expect(facts[LOAN_TOPUP_FACT_KEY]).toEqual({ kind: 'choice', optionCode: 'top_up' });
  });
});
