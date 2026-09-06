/**
 * Changing the program name clears the chosen way and the typed cap rows, warned first — and
 * the warning must fire ONLY when something the operator did is about to go. The two silent
 * cases are the ones that matter: a way recorded without asking, and a grid still equal to
 * the product's seed. Either, if counted, puts a destructive dialog in front of every routine
 * name change on a fresh create.
 */
import { describe, expect, it } from 'vitest';
import {
  nameChangeLoss,
  typedCapRowCount,
} from '../src/app/features/bank-programs/form/name-change-losses';
import type { MaxLoanByFactConfig as MaxLoanByFactConfig } from '../src/app/shared/ui/max-loan-by-fact.rules';

const grid = (amounts: readonly string[]): MaxLoanByFactConfig => ({
  factKey: 'owned_unit_type',
  rows: amounts.map((maxAmountEGP, i) => ({ rowKey: `k${i}`, maxAmountEGP })),
  onNoMatch: 'useProgramMax',
});

describe('rows the operator typed', () => {
  it('counts nothing when there is no grid', () => {
    expect(typedCapRowCount(null, null)).toBe(0);
  });

  it('counts nothing while the grid is byte-equal to what the product seeded', () => {
    const seeded = grid(['2000000', '3000000']);
    expect(typedCapRowCount(seeded, JSON.stringify(seeded))).toBe(0);
  });

  it('counts only rows holding an amount once the grid has moved off the seed', () => {
    const seeded = grid(['2000000', '3000000', '']);
    const edited = grid(['2500000', '3000000', '']);
    expect(typedCapRowCount(edited, JSON.stringify(seeded))).toBe(2);
    expect(typedCapRowCount(grid(['', '', '']), null)).toBe(0);
  });
});

describe('what a name change loses', () => {
  const base = { wayId: null, wayTitle: null, hadChoice: false, capConfig: null, capSeededSignature: null };

  it('loses nothing on a fresh program — no dialog', () => {
    expect(nameChangeLoss(base)).toBeNull();
  });

  it('does not count a way that was RECORDED rather than chosen', () => {
    // A single-way product's `primary` is written by the wizard without asking.
    expect(nameChangeLoss({ ...base, wayId: 'primary', wayTitle: 'A table by rank', hadChoice: false })).toBeNull();
  });

  it('names a way the operator picked from a choice', () => {
    expect(
      nameChangeLoss({ ...base, wayId: 'alt', wayTitle: 'A table of ranges over: down payment', hadChoice: true }),
    ).toEqual({ wayTitle: 'A table of ranges over: down payment', typedCapRows: 0 });
  });

  it('falls back to the slot id when no title is known — never to silence', () => {
    expect(nameChangeLoss({ ...base, wayId: 'alt', hadChoice: true })).toEqual({ wayTitle: 'alt', typedCapRows: 0 });
  });

  it('counts the typed rows beside the way, and asks for either alone', () => {
    const seeded = grid(['2000000']);
    const edited = grid(['2200000']);
    expect(nameChangeLoss({ ...base, capConfig: edited, capSeededSignature: JSON.stringify(seeded) })).toEqual({
      wayTitle: null,
      typedCapRows: 1,
    });
    expect(nameChangeLoss({ ...base, capConfig: seeded, capSeededSignature: JSON.stringify(seeded) })).toBeNull();
  });
});
