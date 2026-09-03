/**
 * HOW EACH ANSWER SHAPE IS READ AS A TABLE KEY.
 *
 * The two new shapes are the interesting ones. A MULTI_SELECT answer offers SEVERAL keys
 * and the bank's ROW ORDER decides which is read — not the order the applicant tapped,
 * which is a client artefact — and a TEXT answer offers exactly one reserved key, because
 * presence is the only thing a free-text answer tells a bank (A33 forbids reading the
 * words).
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import {
  PRESENCE_FACT_LOOKUP_KEY,
  factAnswerHasKey,
  factLookupKeys,
  matchFactRow,
} from '@/matching/pipeline/fact-value';

describe('factLookupKeys', () => {
  it('reads a single pick as itself', () => {
    expect(factLookupKeys({ kind: 'choice', optionCode: 'villa' })).toEqual(['villa']);
  });

  it('reads a multi-pick as every code picked', () => {
    expect(factLookupKeys({ kind: 'choices', optionCodes: ['car_loan', 'mortgage'] })).toEqual([
      'car_loan',
      'mortgage',
    ]);
  });

  it('reads a text answer as the one reserved presence key', () => {
    expect(factLookupKeys({ kind: 'presence' })).toEqual([PRESENCE_FACT_LOOKUP_KEY]);
  });

  it('offers a number NO keys, so a key-shaped reader reports unconfigured', () => {
    expect(factLookupKeys({ kind: 'numeric', value: new Decimal('8') })).toEqual([]);
  });
});

describe('matchFactRow', () => {
  const rows = [{ key: 'mortgage' }, { key: 'car_loan' }];

  it('reads the first row the TABLE lists, not the first code the applicant picked', () => {
    // Picked car loan first; the bank lists mortgage first, so mortgage is the row read.
    const row = matchFactRow(
      rows,
      { kind: 'choices', optionCodes: ['car_loan', 'mortgage'] },
      (r) => r.key,
    );
    expect(row).toEqual({ key: 'mortgage' });
  });

  it('falls to the next pick when the bank states no row for the first', () => {
    const row = matchFactRow(
      [{ key: 'car_loan' }],
      { kind: 'choices', optionCodes: ['mortgage', 'car_loan'] },
      (r) => r.key,
    );
    expect(row).toEqual({ key: 'car_loan' });
  });

  it('matches nothing for an answer the table has no row for', () => {
    expect(matchFactRow(rows, { kind: 'choice', optionCode: 'personal_loan' }, (r) => r.key)).toBe(
      undefined,
    );
  });

  it('matches nothing for a number — a band table reads those', () => {
    expect(matchFactRow(rows, { kind: 'numeric', value: new Decimal('3') }, (r) => r.key)).toBe(
      undefined,
    );
  });
});

describe('factAnswerHasKey', () => {
  it('is true when ANY pick names the key', () => {
    expect(factAnswerHasKey({ kind: 'choices', optionCodes: ['a', 'b'] }, 'b')).toBe(true);
    expect(factAnswerHasKey({ kind: 'choices', optionCodes: ['a', 'b'] }, 'c')).toBe(false);
  });
});
