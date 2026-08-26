/**
 * The list → question-options diff.
 *
 * What is being pinned is the one invariant the whole seam exists for: a question that
 * mirrors a registry list has `question_option.code` === `platform_enumeration.key`, for
 * every value, at every moment. The engine keys a bank's table by that code
 * (`factChoiceTable` / `factParentTable`) and `attachOptionsEnumerationType` recognises the
 * list from it, so a value that fails to reach the options is unpickable AND unpriceable.
 */
import { describe, expect, it } from 'vitest';
import {
  mirroredOptionPlan,
  planIsEmpty,
  type ExistingOption,
  type MirroredValue,
} from '@/questionnaire/mirrored-options';

const value = (code: string, labelEn = code): MirroredValue => ({
  code,
  labelAr: `${labelEn}-ar`,
  labelEn,
});

const option = (over: Partial<ExistingOption> & { code: string }): ExistingOption => ({
  id: `opt_${over.code}`,
  labelAr: `${over.code}-ar`,
  labelEn: over.code,
  displayOrder: 0,
  isActive: true,
  ...over,
});

describe('mirroring a registry list into a question', () => {
  it('creates one option per value, with the KEY as the code', () => {
    const plan = mirroredOptionPlan([], [value('maadi'), value('zamalek')]);
    expect(plan.create.map((r) => r.code)).toEqual(['maadi', 'zamalek']);
    expect(plan.create.map((r) => r.displayOrder)).toEqual([0, 1]);
    expect(plan.deactivate).toEqual([]);
    expect(plan.update).toEqual([]);
  });

  it('plans nothing when the two already agree', () => {
    const existing = [
      option({ code: 'maadi', displayOrder: 0 }),
      option({ code: 'zamalek', displayOrder: 1 }),
    ];
    const plan = mirroredOptionPlan(existing, [value('maadi'), value('zamalek')]);
    expect(planIsEmpty(plan)).toBe(true);
  });

  it('adds a value the operator typed later — the whole point of remembering the link', () => {
    const existing = [option({ code: 'maadi', displayOrder: 0 })];
    const plan = mirroredOptionPlan(existing, [value('maadi'), value('nasr_city')]);
    expect(plan.create).toEqual([
      { code: 'nasr_city', labelAr: 'nasr_city-ar', labelEn: 'nasr_city', displayOrder: 1 },
    ]);
    expect(plan.deactivate).toEqual([]);
  });

  it('carries a relabel through', () => {
    const existing = [option({ code: 'maadi', labelEn: 'Maadi', displayOrder: 0 })];
    const plan = mirroredOptionPlan(existing, [value('maadi', 'Old Maadi')]);
    expect(plan.update).toEqual([
      { id: 'opt_maadi', labelAr: 'Old Maadi-ar', labelEn: 'Old Maadi', displayOrder: 0 },
    ]);
  });

  it('re-orders to the registry order, which is the only one the customer sees', () => {
    const existing = [
      option({ code: 'maadi', displayOrder: 0 }),
      option({ code: 'zamalek', displayOrder: 1 }),
    ];
    const plan = mirroredOptionPlan(existing, [value('zamalek'), value('maadi')]);
    expect(plan.update.map((r) => [r.id, r.displayOrder])).toEqual([
      ['opt_maadi', 1],
      ['opt_zamalek', 0],
    ]);
  });

  it('DEACTIVATES a retired value rather than deleting it', () => {
    // `application_answer` stores the code, an archived snapshot carries it, and a bank's key
    // table may still be keyed by it. Deleting would take all three meanings with it.
    const existing = [
      option({ code: 'maadi', displayOrder: 0 }),
      option({ code: 'zamalek', displayOrder: 1 }),
    ];
    const plan = mirroredOptionPlan(existing, [value('maadi')]);
    expect(plan.deactivate).toEqual(['opt_zamalek']);
    expect(plan.create).toEqual([]);
  });

  it('leaves an already-inactive option alone rather than re-retiring it every write', () => {
    const existing = [option({ code: 'zamalek', isActive: false, displayOrder: 1 })];
    const plan = mirroredOptionPlan(existing, []);
    expect(planIsEmpty(plan)).toBe(true);
  });

  it('resurrects the SAME row when a value comes back', () => {
    // A second row would collide on `@@unique([questionId, code])`, and even if it did not,
    // the answers already given against that code belong to the row that was retired.
    const existing = [option({ code: 'zamalek', isActive: false, displayOrder: 7 })];
    const plan = mirroredOptionPlan(existing, [value('zamalek')]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([
      { id: 'opt_zamalek', labelAr: 'zamalek-ar', labelEn: 'zamalek', displayOrder: 0 },
    ]);
  });

  it('does not rewrite the order of an option it is retiring', () => {
    // It renders nowhere, so an order write on it is a change that changes nothing — and a
    // non-empty plan is what decides whether the questionnaire is republished.
    const existing = [
      option({ code: 'maadi', displayOrder: 5 }),
      option({ code: 'zamalek', displayOrder: 6 }),
    ];
    const plan = mirroredOptionPlan(existing, [value('maadi')]);
    expect(plan.update).toEqual([
      { id: 'opt_maadi', labelAr: 'maadi-ar', labelEn: 'maadi', displayOrder: 0 },
    ]);
    expect(plan.deactivate).toEqual(['opt_zamalek']);
  });
});
