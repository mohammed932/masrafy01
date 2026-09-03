/**
 * The "add a program name" draft — what the rail says, what refuses Save, and what gets written.
 *
 * Three of these are only wrong SILENTLY, which is why they are the cases worth writing:
 * the ORDER of the two writes when a product is made alongside the name (wrong order and the
 * server refuses the name, which reads as a validation bug), a RETRY after a half-applied
 * attempt (wrong and it mints a second product under the same name), and a payslip plan that
 * sends `surrogateProductKey` at all (the DTO refuses `''` and `null` alike, so the field has
 * to be ABSENT rather than empty).
 */
import { describe, expect, it } from 'vitest';
import {
  RESERVED_NAME_KEYS,
  barBlock,
  blockReason,
  productSettled,
  savePlan,
  stepBlock,
  stepStatuses,
  type NewNameDraft,
} from '../src/app/features/program-catalog/new-program-name';

function draft(over: Partial<NewNameDraft> = {}): NewNameDraft {
  return {
    labelEn: 'Doctors',
    labelAr: 'أطباء',
    basis: 'payslip',
    product: null,
    ...over,
  };
}

describe('blockReason', () => {
  it('asks for the basis first — it is step 1, and it is unanswered on arrival', () => {
    expect(blockReason(draft({ basis: null }))).toBe('basis');
  });

  it('names the basis even when the labels are empty too', () => {
    // In STEP ORDER, not by how much is missing. Reported as 'labels' this would name a field
    // one step past the one the operator is standing on.
    expect(blockReason(draft({ labelEn: '', labelAr: '', basis: null }))).toBe('basis');
  });

  it('then the labels, once the basis is answered', () => {
    expect(blockReason(draft({ labelEn: '' }))).toBe('labels');
    expect(blockReason(draft({ labelAr: '   ' }))).toBe('labels');
  });

  it('refuses an English label that slugs to nothing, BEFORE the click', () => {
    // The key is minted from the English label. Arabic-only slugs to '' and the server
    // answers VALIDATION_FAILED naming a field the operator did fill in.
    expect(blockReason(draft({ labelEn: 'أطباء' }))).toBe('labels_key');
    expect(blockReason(draft({ labelEn: '،،،' }))).toBe('labels_key');
  });

  it('then the product, but only on the surrogate basis', () => {
    expect(blockReason(draft({ basis: 'no_payslip' }))).toBe('product');
    expect(blockReason(draft({ basis: 'payslip' }))).toBeNull();
  });

  it('reports nothing once each step has an answer', () => {
    expect(blockReason(draft())).toBeNull();
    expect(
      blockReason(draft({ basis: 'no_payslip', product: { kind: 'existing', key: 'car_owner' } })),
    ).toBeNull();
  });

  it('holds a surrogate name whose picker is open with nothing chosen', () => {
    // `{key:''}` is the picker on screen, untouched. Settled, it would be refused by the
    // server after the click (`SURROGATE_PRODUCT_REQUIRED`) rather than before it.
    const open = draft({ basis: 'no_payslip', product: { kind: 'existing', key: '' } });
    expect(blockReason(open)).toBe('product');
    expect(
      blockReason(draft({ ...open, product: { kind: 'existing', key: 'car_owner' } })),
    ).toBeNull();
  });
});

describe('stepBlock', () => {
  // What the action bar reports, scoped to the step on screen. The global `blockReason` named
  // a field two steps away and left step 1 with nothing clickable.
  it('reports only the basis on step 1, whatever else is missing', () => {
    expect(stepBlock(draft({ basis: null, labelEn: '', labelAr: '' }), 0)).toBe('basis');
    expect(stepBlock(draft({ labelEn: '', labelAr: '' }), 0)).toBeNull();
  });

  it('reports the labels on step 2, and the slug case with them', () => {
    expect(stepBlock(draft({ labelEn: '' }), 1)).toBe('labels');
    expect(stepBlock(draft({ labelEn: 'أطباء' }), 1)).toBe('labels_key');
    expect(stepBlock(draft(), 1)).toBeNull();
  });

  it('reports the product on step 3, and only on the surrogate basis', () => {
    expect(stepBlock(draft({ basis: 'no_payslip' }), 2)).toBe('product');
    expect(stepBlock(draft({ basis: 'payslip' }), 2)).toBeNull();
  });

  it('clears step 1 the moment a basis is picked — that is what makes Next live', () => {
    // The defect this closes: basis answered, and the bar still refused with a step-2 reason.
    const picked = draft({ basis: 'no_payslip', labelEn: '', labelAr: '' });
    expect(stepBlock(picked, 0)).toBeNull();
    expect(blockReason(picked)).toBe('labels');
  });
});

describe('barBlock', () => {
  // What the ACTION BAR refuses, which is not the same question as what the step owes: on the
  // last step its button creates, on every earlier one it moves. Both of the cases below were
  // a live button whose click did nothing at all.
  it('names the whole draft on the last step, where the button creates', () => {
    // stepBlock is null here — a payslip step 3 asks nothing — so the bar used to offer an
    // enabled Next that could neither save nor move.
    const unnamed = draft({ basis: 'payslip', labelEn: '', labelAr: '' });
    expect(stepBlock(unnamed, 2)).toBeNull();
    expect(barBlock(unnamed, 2)).toBe('labels');
    expect(barBlock(draft({ basis: 'payslip' }), 2)).toBeNull();
  });

  it('refuses a move to step 3 while the basis is unanswered', () => {
    // Reachable: the rail never locks the name, and `?step=2` lands here with no basis.
    const noBasis = draft({ basis: null });
    expect(stepBlock(noBasis, 1)).toBeNull();
    expect(barBlock(noBasis, 1)).toBe('basis');
  });

  it('otherwise says exactly what the step on screen owes', () => {
    expect(barBlock(draft({ basis: null, labelEn: '', labelAr: '' }), 0)).toBe('basis');
    expect(barBlock(draft({ labelEn: '' }), 1)).toBe('labels');
    expect(barBlock(draft({ basis: 'no_payslip' }), 1)).toBeNull();
  });
});

describe('productSettled', () => {
  it('separates unanswered from open-with-nothing-chosen, and settles on a real key', () => {
    // Three states, and the middle one is why this is a wrapper object rather than a bare
    // string: `null` is "not asked yet", `{key:''}` is "asked, nothing picked".
    expect(productSettled(draft({ product: null }))).toBe(false);
    expect(productSettled(draft({ product: { kind: 'existing', key: '' } }))).toBe(false);
    expect(productSettled(draft({ product: { kind: 'existing', key: 'car_owner' } }))).toBe(true);
  });
});

describe('stepStatuses', () => {
  // The rail is [1] basis · [2] name · [3] source.
  it('marks step 3 done on the payslip basis — the path is three steps, not two', () => {
    const [basis, name, source] = stepStatuses(draft());
    expect(basis!.status).toBe('done');
    expect(name!.status).toBe('done');
    expect(source!.status).toBe('done');
    expect(source!.disabled).toBe(false);
  });

  it('reports the basis on step 1 and the name on step 2', () => {
    // The one case where the two differ, so a silent re-swap of the pair cannot pass.
    const [basis, name] = stepStatuses(draft({ labelEn: '', labelAr: '' }));
    expect(basis!.status).toBe('done');
    expect(name!.status).toBe('todo');
  });

  it('leaves step 3 unreachable until the basis is answered — and nothing else', () => {
    const statuses = stepStatuses(draft({ labelEn: '', labelAr: '', basis: null }));
    expect(statuses.map((s) => s.disabled)).toEqual([false, false, true]);
  });

  it('never reports invalid — every unfinished state here is merely unfinished', () => {
    const empty = stepStatuses(draft({ labelEn: '', labelAr: '', basis: null }));
    expect(empty.map((s) => s.status)).toEqual(['todo', 'todo', 'todo']);
    const surrogate = stepStatuses(draft({ basis: 'no_payslip' }));
    expect(surrogate.map((s) => s.status)).toEqual(['done', 'done', 'todo']);
  });

  it('holds the NAME step open for a label that slugs to nothing', () => {
    expect(stepStatuses(draft({ labelEn: 'أطباء' }))[1]!.status).toBe('todo');
  });
});

describe('savePlan', () => {
  // ONE write now. This flow used to be able to create a PRODUCT first and the name second,
  // which is where the ordering and the retry rule lived; a product is not created here any
  // more. What survives is the rule that only ever failed silently: a payslip name must send
  // `surrogateProductKey` ABSENT, never `''` (refused by the DTO) and never `null` (which
  // means UNLINK on a patch).
  it('payslip: no link at all — not an empty one', () => {
    const plan = savePlan(draft());
    expect(plan.incomeBases).toEqual(['payslip']);
    expect(plan.link).toEqual({ kind: 'none' });
  });

  it('an unanswered basis plans the payslip write, never a surrogate one', () => {
    // Unreachable past blockReason, but the fallthrough must not invent a surrogate name.
    expect(savePlan(draft({ basis: null })).incomeBases).toEqual(['payslip']);
    expect(savePlan(draft({ basis: null })).link).toEqual({ kind: 'none' });
  });

  it('surrogate: one write, carrying the link', () => {
    const plan = savePlan(
      draft({ basis: 'no_payslip', product: { kind: 'existing', key: 'car_owner' } }),
    );
    expect(plan.incomeBases).toEqual(['no_payslip']);
    expect(plan.link).toEqual({ kind: 'existing', key: 'car_owner' });
  });

  it('sends the no-payslip basis even though a create with no categories stores none of it', () => {
    // It is what `SURROGATE_PRODUCT_REQUIRED` reads on the way in. Dropping it would turn the
    // server's one guard against a name that quotes nothing into a no-op.
    expect(
      savePlan(draft({ basis: 'no_payslip', product: { kind: 'existing', key: 'x' } })).incomeBases,
    ).toEqual(['no_payslip']);
  });
});

describe('RESERVED_NAME_KEYS', () => {
  it('names every literal segment declared before the catalog :key route', () => {
    // A name minted onto one of these resolves to that screen instead of its own page —
    // saved, listed, and impossible to open.
    expect([...RESERVED_NAME_KEYS].sort()).toEqual(['new', 'products']);
  });
});
