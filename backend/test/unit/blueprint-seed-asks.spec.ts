/**
 * THE ASK ROWS THE BLUEPRINT SEED RECORDS — the half SQL could not backfill.
 *
 * The migration copied the rows `platform_enumeration.surrogateProductKey` happens to hold.
 * On a real database that was 12 of 27 facts: the planner withholds the column for a fact
 * several blueprints share and for every cap-only blueprint, so `club_branch_cap` — a
 * product whose entire content is one ask — rendered "asks the applicant nothing yet", and
 * `school_type`, read by three blueprints, appeared on no product's list.
 *
 * `ensureBlueprintAsks` is what closes that, and the two properties worth pinning are that
 * it covers the ask kinds the plan produces NO write for, and that a second run adds nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import { ensureBlueprintAsks } from '@/bank-programs/blueprints/blueprint-seed-asks';
import { blueprintKeysAsking, productBlueprint } from '@/bank-programs/blueprints/product-blueprints';
import type { ProductAsksRepository } from '@/bank-programs/asks/product-asks.repository';

/** A repository that says every ask row is new, and records what it was asked to write. */
function fresh(outcome: 'added' | 'already' | 'missing' = 'added') {
  const addAskByKeys = vi.fn().mockResolvedValue(outcome);
  return { repo: { addAskByKeys } as unknown as ProductAsksRepository, addAskByKeys };
}

describe('ensureBlueprintAsks', () => {
  it('records the PLATFORM fact a product reads, which the plan writes nothing for', () => {
    // `armed_forces_grades` reads `military_grade`, a fact seeded by migration and filed
    // under no product. Without this the product that exists to ask about a grade lists
    // nothing at all.
    const asked = blueprintKeysAsking('military_grade').map((b) => b.blueprintKey);
    expect(asked).toContain('armed_forces_grades');
  });

  it('records a SHARED fact for every product that reads it', async () => {
    const { repo, addAskByKeys } = fresh();
    for (const key of ['school_stage_ceiling', 'school_type_cap']) {
      await ensureBlueprintAsks({
        blueprint: productBlueprint(key)!,
        productKey: key,
        asks: repo,
        actorStaffId: 'staff_1',
      });
    }
    const pairs = addAskByKeys.mock.calls.map(
      (c) => `${(c[0] as { productKey: string }).productKey}/${(c[0] as { factKey: string }).factKey}`,
    );
    expect(pairs).toContain('school_stage_ceiling/school_type');
    expect(pairs).toContain('school_type_cap/school_type');
  });

  it('records a CAP product’s only ask', async () => {
    const { repo } = fresh();
    const result = await ensureBlueprintAsks({
      blueprint: productBlueprint('club_branch_cap')!,
      productKey: 'club_branch_cap',
      asks: repo,
      actorStaffId: 'staff_1',
    });
    expect(result.added).toContain('club_branch');
  });

  it('always writes as the LIBRARY, never as an operator', async () => {
    // A `blueprint` row is what refuses the untick, and it has to: the next seed run would
    // put an operator's removal back with nothing saying why.
    const { repo, addAskByKeys } = fresh();
    await ensureBlueprintAsks({
      blueprint: productBlueprint('compound_owner')!,
      productKey: 'compound_owner',
      asks: repo,
      actorStaffId: 'staff_1',
    });
    for (const call of addAskByKeys.mock.calls) {
      expect((call[0] as { source: string }).source).toBe('blueprint');
    }
  });

  it('excludes a DERIVED fact, which has no row to point at', async () => {
    // The platform computes a bank axis per quote from the program's own bank, so there is
    // no registry row and nothing an operator could curate.
    const { repo, addAskByKeys } = fresh();
    await ensureBlueprintAsks({
      blueprint: productBlueprint('doctors_clinic_owner')!,
      productKey: 'doctors_clinic_owner',
      asks: repo,
      actorStaffId: 'staff_1',
    });
    const keys = addAskByKeys.mock.calls.map((c) => (c[0] as { factKey: string }).factKey);
    expect(keys).not.toContain('loan_is_topup');
    expect(keys).toContain('years_in_practice');
  });

  it('writes nothing on a second run', async () => {
    const { repo } = fresh('already');
    const result = await ensureBlueprintAsks({
      blueprint: productBlueprint('compound_owner')!,
      productKey: 'compound_owner',
      asks: repo,
      actorStaffId: 'staff_1',
    });
    expect(result).toEqual({ added: [], missingFacts: [] });
  });

  it('reports a fact with no row instead of writing one', async () => {
    const { repo } = fresh('missing');
    const result = await ensureBlueprintAsks({
      blueprint: productBlueprint('club_branch_cap')!,
      productKey: 'club_branch_cap',
      asks: repo,
      actorStaffId: 'staff_1',
    });
    expect(result.added).toEqual([]);
    expect(result.missingFacts).toContain('club_branch');
  });

  it('asks for each fact exactly once, however many asks name it', async () => {
    const { repo, addAskByKeys } = fresh();
    await ensureBlueprintAsks({
      blueprint: productBlueprint('compound_owner')!,
      productKey: 'compound_owner',
      asks: repo,
      actorStaffId: 'staff_1',
    });
    const keys = addAskByKeys.mock.calls.map((c) => (c[0] as { factKey: string }).factKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('blueprintKeysAsking', () => {
  it('names every blueprint that declares a shared key', () => {
    const keys = blueprintKeysAsking('school_type').map((b) => b.blueprintKey);
    expect(keys.sort()).toEqual(['school_stage_ceiling', 'school_type_cap']);
  });

  it('carries the question a bindQuestion ask declares, and none for a minted one', () => {
    const bound = blueprintKeysAsking('car_loan_installment');
    expect(bound[0]?.questionCode).toBe('obligation_car_loan');
    const minted = blueprintKeysAsking('owned_unit_type');
    expect(minted[0]?.questionCode).toBeUndefined();
  });

  it('is empty for a key no blueprint asks for', () => {
    expect(blueprintKeysAsking('loan_purpose')).toEqual([]);
  });
});
