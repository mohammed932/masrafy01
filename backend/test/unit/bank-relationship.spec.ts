/**
 * The derived `bank_relationship` fact — who the applicant already banks with, per program.
 *
 * Two things are worth pinning: the SLUG (the question's option codes and the programs' bank
 * names are two different files that have to agree), and the DEFAULT (a skipped question must
 * read as "new to this bank", never as a missing requirement).
 */

import { describe, expect, it } from 'vitest';
import {
  BANK_RELATIONSHIP_EXISTING,
  BANK_RELATIONSHIP_NEW,
  bankRelationshipFact,
  bankSlug,
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
