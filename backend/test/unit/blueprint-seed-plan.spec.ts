/**
 * What the blueprint seed decides before it writes.
 *
 * The case that matters is `skip`. An operator may still edit a product's figures, so a
 * seed that re-ran the blueprint over a built product would undo their work on the next
 * deploy — silently, and in a place nobody looks. The other three exist so that a run
 * interrupted half-way finishes on the next attempt instead of reporting a duplicate key.
 */
import { describe, expect, it } from 'vitest';
import { planSeedAction, seedProductKey } from '@/bank-programs/blueprints/blueprint-seed-plan';
import { productBlueprint } from '@/bank-programs/blueprints/product-blueprints';

const income = productBlueprint('armed_forces_grades')!;
const ceiling = productBlueprint('compound_owner')!;
const cap = productBlueprint('club_branch_cap')!;

describe('planSeedAction', () => {
  it('builds a product that is not there', () => {
    expect(planSeedAction(income, null)).toEqual({
      kind: 'create',
      productKey: 'armed_forces_grades',
    });
  });

  it('RESUMES a row that exists without a calculation', () => {
    // A previous run stopped part-way. Every object is looked up by key first, so running
    // the blueprint again writes only what is missing.
    expect(planSeedAction(income, { key: 'armed_forces_grades', hasRule: false })).toEqual({
      kind: 'resume',
      productKey: 'armed_forces_grades',
    });
  });

  it('SKIPS a product that already holds a calculation — the operator’s work', () => {
    expect(planSeedAction(ceiling, { key: 'compound_owner', hasRule: true })).toEqual({
      kind: 'skip',
      productKey: 'compound_owner',
    });
  });

  it('treats a cap-only blueprint as its own case, whether or not the row is there', () => {
    // It guesses no income, so there is no calculation to have or to skip: what varies is
    // only whether the row still has to be minted.
    expect(planSeedAction(cap, null)).toEqual({
      kind: 'cap',
      productKey: 'club_branch_cap',
      rowExists: false,
    });
    expect(planSeedAction(cap, { key: 'club_branch_cap', hasRule: false })).toEqual({
      kind: 'cap',
      productKey: 'club_branch_cap',
      rowExists: true,
    });
  });
});

describe('seedProductKey', () => {
  it('is the blueprint’s key, never a slug of its English name', () => {
    // `createFromBlueprint` slugs `labelEn` when no key is given. That would write
    // `income_by_armed_forces_grade` here, and the cap-only predicate, a bank program's
    // stored link and this seed's own idempotence all expect the blueprint key.
    expect(seedProductKey(income)).toBe('armed_forces_grades');
    expect(seedProductKey(income)).not.toBe(
      income.labelEn.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    );
  });
});
