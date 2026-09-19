/**
 * The "add a program name" draft — which steps a name walks, what refuses Save, what gets
 * written, and what the second write's body is.
 *
 * The cases worth writing are the ones that are only wrong SILENTLY: a payslip plan that
 * sends `surrogateProductKey` at all (the DTO refuses `''` and `null` alike, so the field has
 * to be ABSENT rather than empty), a step list that carries a step the operator's basis does
 * not walk, and — since the flow ends on a question board — a write body that widens a
 * question into a loan type nothing asked for, or drops the gate source a newly asked
 * question branches off.
 */
import { describe, expect, it } from 'vitest';
import {
  NEW_NAME_STEP_ORDER,
  RESERVED_NAME_KEYS,
  barBlock,
  blockReason,
  isLastStep,
  newNameStepIds,
  productSettled,
  savePlan,
  stepBlock,
  stepIdAt,
  stepIndexOf,
  stepStatuses,
  type NewNameDraft,
} from '../src/app/features/program-catalog/new-program-name';
import {
  askedSections,
  askedTabs,
  gateChainFor,
  isAsked,
  pendingAdds,
  type AskableQuestion,
  type AskedPicks,
} from '../src/app/shared/questions/asked-questions.rules';
import type { LoanCategory } from '../src/app/core/loan-category';

function draft(over: Partial<NewNameDraft> = {}): NewNameDraft {
  return {
    labelEn: 'Doctors',
    labelAr: 'أطباء',
    basis: 'payslip',
    product: null,
    // "Everything else is answered", which is what every assertion below that is not ABOUT
    // the offer set already assumes. A name offered under nothing cannot be created.
    offered: ['personal'],
    ...over,
  };
}

const PAYSLIP_STEPS = newNameStepIds('payslip');
const SURROGATE_STEPS = newNameStepIds('no_payslip');

describe('newNameStepIds', () => {
  it('drops the calculation step on a payslip name — three steps, not four', () => {
    // The payslip branch of that step used to render a sentence and no control: a screen
    // that could not be answered, could not be wrong, and could not be skipped.
    expect(PAYSLIP_STEPS).toEqual(['program', 'offered', 'asks']);
    expect(SURROGATE_STEPS).toEqual(['program', 'calculation', 'offered', 'asks']);
  });

  it('walks the payslip list while the basis is unanswered', () => {
    // One rule in one direction: the rail GROWS when no-payslip is picked, and it can only
    // grow while the operator is standing on `program`, which both lists carry.
    expect(newNameStepIds(null)).toEqual(PAYSLIP_STEPS);
  });

  it('keeps every list a subsequence of the canonical order', () => {
    for (const ids of [PAYSLIP_STEPS, SURROGATE_STEPS]) {
      const positions = ids.map((id) => NEW_NAME_STEP_ORDER.indexOf(id));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });
});

describe('stepIdAt / stepIndexOf / isLastStep', () => {
  it('clamps a pasted step number into the list the basis actually walks', () => {
    // `?step=4` on a payslip name names a step that is not on its rail.
    expect(stepIdAt(PAYSLIP_STEPS, 3)).toBe('asks');
    expect(stepIdAt(PAYSLIP_STEPS, -2)).toBe('program');
    expect(stepIdAt(SURROGATE_STEPS, 3)).toBe('asks');
  });

  it('answers -1 for a step the list does not carry, never a position', () => {
    expect(stepIndexOf(PAYSLIP_STEPS, 'calculation')).toBe(-1);
    expect(stepIndexOf(SURROGATE_STEPS, 'calculation')).toBe(1);
  });

  it('puts the last step at the end of both lists', () => {
    expect(isLastStep(PAYSLIP_STEPS, 'asks')).toBe(true);
    expect(isLastStep(SURROGATE_STEPS, 'asks')).toBe(true);
    expect(isLastStep(SURROGATE_STEPS, 'offered')).toBe(false);
  });
});

describe('blockReason', () => {
  it('asks for the basis first — it leads the form, and it decides the step list', () => {
    expect(blockReason(draft({ basis: null }))).toBe('basis');
  });

  it('names the basis even when the labels are empty too', () => {
    // In STEP ORDER, not by how much is missing. The basis card sits above the label fields
    // on the same step, so this is also reading order.
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

  it('then the offer set — a name offered under nothing can be picked by no bank', () => {
    expect(blockReason(draft({ offered: [] }))).toBe('offered');
    // The product still wins: it is the earlier step.
    expect(blockReason(draft({ basis: 'no_payslip', offered: [] }))).toBe('product');
  });

  it('never names the question step — adding nothing there is a real answer', () => {
    // Add-only means the loan types already ask what they ask, and this name is not the
    // only thing that decides it.
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
  // a field two steps away and left the first step with nothing clickable.
  it('reports all three of step ①’s answers, in reading order', () => {
    // The basis and the labels share a step now, so this is the one place the two are
    // compared — and the order is the order they appear down the page.
    expect(stepBlock(draft({ basis: null, labelEn: '', labelAr: '' }), 'program')).toBe('basis');
    expect(stepBlock(draft({ labelEn: '', labelAr: '' }), 'program')).toBe('labels');
    expect(stepBlock(draft({ labelEn: 'أطباء' }), 'program')).toBe('labels_key');
    expect(stepBlock(draft(), 'program')).toBeNull();
  });

  it('reports the product on the calculation step, which only a surrogate name walks', () => {
    expect(stepBlock(draft({ basis: 'no_payslip' }), 'calculation')).toBe('product');
    // Unreachable on a payslip name — that list carries no such step — so the arm answers
    // null rather than inventing a refusal for a screen nobody is looking at.
    expect(stepBlock(draft({ basis: 'payslip' }), 'calculation')).toBeNull();
  });

  it('reports the offer set on its own step and nowhere else', () => {
    expect(stepBlock(draft({ offered: [] }), 'offered')).toBe('offered');
    expect(stepBlock(draft({ offered: [] }), 'program')).toBeNull();
    expect(stepBlock(draft({ offered: [] }), 'asks')).toBeNull();
  });

  it('agrees with blockReason on step ①, which is what the merge bought', () => {
    // Before the merge these disagreed: the basis cleared its own step while the global
    // reason named the labels a step away, so the bar refused with an off-screen field.
    const unnamed = draft({ basis: 'no_payslip', labelEn: '', labelAr: '' });
    expect(stepBlock(unnamed, 'program')).toBe('labels');
    expect(blockReason(unnamed)).toBe('labels');
  });
});

describe('barBlock', () => {
  // What the ACTION BAR refuses, which is not the same question as what the step owes: on the
  // last step its button creates, on every earlier one it moves.
  it('names the whole draft on the last step, where the button creates', () => {
    // `stepBlock` is null on `asks` whatever the rest says, so without the split the bar
    // offered an enabled control that could neither save nor move.
    const unnamed = draft({ basis: 'payslip', labelEn: '', labelAr: '' });
    expect(stepBlock(unnamed, 'asks')).toBeNull();
    expect(barBlock(unnamed, 'asks', PAYSLIP_STEPS)).toBe('labels');
    expect(barBlock(draft(), 'asks', PAYSLIP_STEPS)).toBeNull();
  });

  it('gates every forward move on the first step, so the old landing clause is gone', () => {
    // There used to be a "somewhere to land" clause, because the basis sat on a step the
    // operator could walk PAST. It is on step ① now and `stepBlock` gates it there.
    expect(barBlock(draft({ basis: null }), 'program', PAYSLIP_STEPS)).toBe('basis');
  });

  it('otherwise says exactly what the step on screen owes', () => {
    expect(barBlock(draft({ labelEn: '' }), 'program', PAYSLIP_STEPS)).toBe('labels');
    expect(barBlock(draft({ offered: [] }), 'offered', PAYSLIP_STEPS)).toBe('offered');
    expect(barBlock(draft({ basis: 'no_payslip' }), 'calculation', SURROGATE_STEPS)).toBe(
      'product',
    );
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
  it('reports every step by id, including one this basis does not walk', () => {
    // A total Record and not a positional tuple: the list is conditional, so an index means
    // different things on the two paths.
    const statuses = stepStatuses(draft());
    expect(Object.keys(statuses).sort()).toEqual(
      ['asks', 'calculation', 'offered', 'program'].sort(),
    );
  });

  it('holds step ① open until BOTH the basis and the labels are answered', () => {
    expect(stepStatuses(draft()).program.status).toBe('done');
    expect(stepStatuses(draft({ basis: null })).program.status).toBe('todo');
    expect(stepStatuses(draft({ labelEn: '', labelAr: '' })).program.status).toBe('todo');
  });

  it('holds step ① open for a label that slugs to nothing', () => {
    expect(stepStatuses(draft({ labelEn: 'أطباء' })).program.status).toBe('todo');
  });

  it('leaves every later step unreachable until the basis is answered — and nothing else', () => {
    const blind = stepStatuses(draft({ labelEn: '', labelAr: '', basis: null }));
    expect(blind.program.disabled).toBe(false);
    expect(blind.calculation.disabled).toBe(true);
    expect(blind.offered.disabled).toBe(true);
    expect(blind.asks.disabled).toBe(true);
    const answered = stepStatuses(draft());
    expect(answered.offered.disabled).toBe(false);
    expect(answered.asks.disabled).toBe(false);
  });

  it('marks the question step done as soon as it has something to render', () => {
    // Add-only: "these loan types already ask what they ask" is an answer, stated.
    expect(stepStatuses(draft()).asks.status).toBe('done');
    expect(stepStatuses(draft({ offered: [] })).asks.status).toBe('todo');
  });

  it('never reports invalid — every unfinished state here is merely unfinished', () => {
    const empty = stepStatuses(draft({ labelEn: '', labelAr: '', basis: null, offered: [] }));
    expect(Object.values(empty).map((s) => s.status)).toEqual(['todo', 'todo', 'todo', 'todo']);
  });
});

describe('savePlan', () => {
  // ONE write for the name, its loan types AND their income basis. What only ever failed
  // silently is the link: a payslip name must send `surrogateProductKey` ABSENT, never `''`
  // (refused by the DTO) and never `null` (which means UNLINK on a patch).
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

  it('carries the loan types, canonically ordered, so the name is born offered', () => {
    // They ride the SAME insert as the row, each taking `incomeBases` as its own basis
    // flags. A create used to assign none, and every new name was parked.
    const plan = savePlan(draft({ offered: ['mortgage', 'personal'] }));
    expect(plan.categories).toEqual(['personal', 'mortgage']);
  });

  it('sends the basis on every plan — it is what the server guard reads on the way in', () => {
    // `SURROGATE_PRODUCT_REQUIRED` reads it, AND `flagsOfBases` writes it onto every
    // category row. Dropping it would disarm the guard and mislabel the rows at once.
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

// ---------------------------------------------------------------------------
// The second write's body. Same flow, same spec file: this module IS what step ④
// sends, and both of its rules fail silently rather than loudly.
// ---------------------------------------------------------------------------

function q(over: Partial<AskableQuestion> & { id: string }): AskableQuestion {
  return {
    code: over.id,
    labelEn: over.id,
    labelAr: over.id,
    isActive: true,
    isRequired: false,
    categories: [],
    gateSourceCode: null,
    haystack: over.id,
    ...over,
  };
}

function picks(entries: Record<string, string[]>): AskedPicks {
  return new Map(
    Object.entries(entries).map(([c, ids]) => [c as LoanCategory, new Set(ids)] as const),
  );
}

describe('pendingAdds', () => {
  it('writes nothing when nothing was ticked', () => {
    // The endpoint refuses an empty body, and a request that changes nothing would still be
    // a round trip nobody asked for.
    expect(pendingAdds([q({ id: 'a' })], ['personal'], picks({}))).toEqual([]);
  });

  it('groups one question ticked under two loan types into ONE row', () => {
    // The board is per loan type, so this is the ordinary case, not an edge one. Two rows
    // for one id is what a whole-set write would collapse to the second one.
    const adds = pendingAdds(
      [q({ id: 'a' })],
      ['personal', 'car'],
      picks({ personal: ['a'], car: ['a'] }),
    );
    expect(adds).toEqual([{ questionId: 'a', categories: ['personal', 'car'] }]);
  });

  it('ignores a loan type the name is no longer offered under', () => {
    // Walking back a step and un-ticking a loan type must not leave its picks in the write.
    const adds = pendingAdds(
      [q({ id: 'a' })],
      ['personal'],
      picks({ personal: ['a'], mortgage: ['a'] }),
    );
    expect(adds).toEqual([{ questionId: 'a', categories: ['personal'] }]);
  });

  it('skips a question that loan type already asks', () => {
    expect(
      pendingAdds(
        [q({ id: 'a', categories: ['personal'] })],
        ['personal'],
        picks({ personal: ['a'] }),
      ),
    ).toEqual([]);
  });

  it('pulls in the gate source of a question that branches off another', () => {
    // The server SHOWS a question whose rule it cannot evaluate, so a missing source does
    // not break the branch — it silently stops branching and the question becomes
    // unconditional for everyone in that loan type.
    const pool = [q({ id: 'src' }), q({ id: 'dep', gateSourceCode: 'src' })];
    expect(pendingAdds(pool, ['personal'], picks({ personal: ['dep'] }))).toEqual([
      { questionId: 'dep', categories: ['personal'] },
      { questionId: 'src', categories: ['personal'] },
    ]);
  });

  it('follows a two-level chain, which one sweep would not', () => {
    const pool = [
      q({ id: 'root' }),
      q({ id: 'mid', gateSourceCode: 'root' }),
      q({ id: 'leaf', gateSourceCode: 'mid' }),
    ];
    const ids = pendingAdds(pool, ['personal'], picks({ personal: ['leaf'] })).map(
      (a) => a.questionId,
    );
    expect(ids.sort()).toEqual(['leaf', 'mid', 'root']);
  });

  it('stops at a source the loan type already asks', () => {
    const pool = [
      q({ id: 'src', categories: ['personal'] }),
      q({ id: 'dep', gateSourceCode: 'src' }),
    ];
    expect(pendingAdds(pool, ['personal'], picks({ personal: ['dep'] }))).toEqual([
      { questionId: 'dep', categories: ['personal'] },
    ]);
  });

  it('survives a gate naming a question the pool does not carry', () => {
    // The pool editor's own guards own that case; refusing here would block a tick over
    // somebody else's broken row.
    const pool = [q({ id: 'dep', gateSourceCode: 'missing' })];
    expect(pendingAdds(pool, ['personal'], picks({ personal: ['dep'] }))).toEqual([
      { questionId: 'dep', categories: ['personal'] },
    ]);
  });

  it('terminates on a gate cycle rather than hanging', () => {
    const pool = [
      q({ id: 'a', code: 'a', gateSourceCode: 'b' }),
      q({ id: 'b', code: 'b', gateSourceCode: 'a' }),
    ];
    expect(gateChainFor(pool, pool[0]!, 'personal', picks({})).map((s) => s.id)).toEqual(['b']);
  });
});

describe('askedSections / askedTabs', () => {
  const pool = [
    q({ id: 'asked', categories: ['personal'], haystack: 'asked salary' }),
    q({ id: 'other', haystack: 'other rent' }),
  ];

  it('counts a tick as asked before it is written', () => {
    expect(isAsked(pool[1]!, 'personal', picks({ personal: ['other'] }))).toBe(true);
  });

  it('searches the NOT-asked list only', () => {
    // Hiding part of what the loan type already asks turns the count above it into a lie:
    // the operator is searching for something to add, not auditing what is there.
    const sections = askedSections(pool, 'personal', picks({}), 'rent', false);
    expect(sections.asked.map((r) => r.id)).toEqual(['asked']);
    expect(sections.rest.map((r) => r.id)).toEqual(['other']);
    expect(askedSections(pool, 'personal', picks({}), 'zzz', false).rest).toEqual([]);
  });

  it('names what a tick would drag in with it, before the tick', () => {
    const gated = [q({ id: 'src' }), q({ id: 'dep', gateSourceCode: 'src', labelEn: 'Dep' })];
    const rest = askedSections(gated, 'personal', picks({}), '', false).rest;
    expect(rest.find((r) => r.id === 'dep')?.alsoAdds).toEqual(['src']);
  });

  it('puts one tab per OFFERED loan type, in canonical order, counting the new ones', () => {
    const tabs = askedTabs(pool, ['car', 'personal'], picks({ car: ['other'] }));
    expect(tabs.map((t) => t.category)).toEqual(['personal', 'car']);
    expect(tabs[0]).toEqual({ category: 'personal', asked: 1, adding: 0 });
    expect(tabs[1]).toEqual({ category: 'car', asked: 1, adding: 1 });
  });
});
