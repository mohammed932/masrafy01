/**
 * The "add a program name" draft — what refuses Save, what gets written, and what the second
 * write's body is.
 *
 * The cases worth writing are the ones that are only wrong SILENTLY: a plan that sends
 * `surrogateProductKey` at all (the DTO refuses `''` and `null` alike, and every name this
 * screen makes is income proof, so the field has to be ABSENT rather than empty), and — since
 * the flow ends on a question board — a write body that widens a question into a loan type
 * nothing asked for, or drops the gate source a newly asked question branches off.
 */
import { describe, expect, it } from 'vitest';
import {
  NEW_NAME_STEP_ORDER,
  RESERVED_NAME_KEYS,
  barBlock,
  blockReason,
  isLastStep,
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
    // "Everything else is answered", which is what every assertion below that is not ABOUT
    // the offer set already assumes. A name offered under nothing cannot be created.
    offered: ['personal'],
    ...over,
  };
}

const STEPS = NEW_NAME_STEP_ORDER;

describe('NEW_NAME_STEP_ORDER', () => {
  it('walks three steps and no calculation step — every name made here is income proof', () => {
    // A Surrogate answer used to grow a fourth step that linked the name to one of the
    // platform's calculations. A surrogate program is code, so there is nothing to link.
    expect(STEPS).toEqual(['program', 'offered', 'asks']);
  });
});

describe('stepIdAt / stepIndexOf / isLastStep', () => {
  it('clamps a pasted step number into the list', () => {
    // `?step=9` names a step that is not on the rail.
    expect(stepIdAt(STEPS, 3)).toBe('asks');
    expect(stepIdAt(STEPS, -2)).toBe('program');
  });

  it('answers each step by its position, which is what `?step=` mirrors', () => {
    expect(stepIndexOf(STEPS, 'program')).toBe(0);
    expect(stepIndexOf(STEPS, 'asks')).toBe(2);
  });

  it('puts the last step at the end of the list', () => {
    expect(isLastStep(STEPS, 'asks')).toBe(true);
    expect(isLastStep(STEPS, 'offered')).toBe(false);
  });
});

describe('blockReason', () => {
  it('asks for the labels first — they are the first thing on the form', () => {
    expect(blockReason(draft({ labelEn: '' }))).toBe('labels');
    expect(blockReason(draft({ labelAr: '   ' }))).toBe('labels');
  });

  it('refuses an English label that slugs to nothing, BEFORE the click', () => {
    // The key is minted from the English label. Arabic-only slugs to '' and the server
    // answers VALIDATION_FAILED naming a field the operator did fill in.
    expect(blockReason(draft({ labelEn: 'أطباء' }))).toBe('labels_key');
    expect(blockReason(draft({ labelEn: '،،،' }))).toBe('labels_key');
  });

  it('then the offer set — a name offered under nothing can be picked by no bank', () => {
    expect(blockReason(draft({ offered: [] }))).toBe('offered');
  });

  it('never names the question step — adding nothing there is a real answer', () => {
    // Add-only means the loan types already ask what they ask, and this name is not the
    // only thing that decides it.
    expect(blockReason(draft())).toBeNull();
  });
});

describe('stepBlock', () => {
  // What the action bar reports, scoped to the step on screen. The global `blockReason` named
  // a field two steps away and left the first step with nothing clickable.
  it('reports both of step ①’s answers, in reading order', () => {
    expect(stepBlock(draft({ labelEn: '', labelAr: '' }), 'program')).toBe('labels');
    expect(stepBlock(draft({ labelEn: 'أطباء' }), 'program')).toBe('labels_key');
    expect(stepBlock(draft(), 'program')).toBeNull();
  });

  it('reports the offer set on its own step and nowhere else', () => {
    expect(stepBlock(draft({ offered: [] }), 'offered')).toBe('offered');
    expect(stepBlock(draft({ offered: [] }), 'program')).toBeNull();
    expect(stepBlock(draft({ offered: [] }), 'asks')).toBeNull();
  });

  it('agrees with blockReason on step ①', () => {
    // The bar on the first step and the create both name the labels, so the operator is
    // never refused over a field that is not on screen.
    const unnamed = draft({ labelEn: '', labelAr: '' });
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
    const unnamed = draft({ labelEn: '', labelAr: '' });
    expect(stepBlock(unnamed, 'asks')).toBeNull();
    expect(barBlock(unnamed, 'asks', STEPS)).toBe('labels');
    expect(barBlock(draft(), 'asks', STEPS)).toBeNull();
  });

  it('otherwise says exactly what the step on screen owes', () => {
    expect(barBlock(draft({ labelEn: '' }), 'program', STEPS)).toBe('labels');
    expect(barBlock(draft({ offered: [] }), 'offered', STEPS)).toBe('offered');
  });
});

describe('stepStatuses', () => {
  it('reports every step by id', () => {
    const statuses = stepStatuses(draft());
    expect(Object.keys(statuses).sort()).toEqual(['asks', 'offered', 'program'].sort());
  });

  it('holds step ① open until both labels are answered', () => {
    expect(stepStatuses(draft()).program.status).toBe('done');
    expect(stepStatuses(draft({ labelEn: '', labelAr: '' })).program.status).toBe('todo');
  });

  it('holds step ① open for a label that slugs to nothing', () => {
    expect(stepStatuses(draft({ labelEn: 'أطباء' })).program.status).toBe('todo');
  });

  it('leaves every step reachable — nothing on the form gates another', () => {
    // Every later step used to wait for the income basis; with one basis there is nothing to
    // wait for, and the labels are an order, not a gate.
    const blank = stepStatuses(draft({ labelEn: '', labelAr: '', offered: [] }));
    expect(Object.values(blank).map((s) => s.disabled)).toEqual([false, false, false]);
  });

  it('marks the question step done as soon as it has something to render', () => {
    // Add-only: "these loan types already ask what they ask" is an answer, stated.
    expect(stepStatuses(draft()).asks.status).toBe('done');
    expect(stepStatuses(draft({ offered: [] })).asks.status).toBe('todo');
  });

  it('never reports invalid — every unfinished state here is merely unfinished', () => {
    const empty = stepStatuses(draft({ labelEn: '', labelAr: '', offered: [] }));
    expect(Object.values(empty).map((s) => s.status)).toEqual(['todo', 'todo', 'todo']);
  });
});

describe('savePlan', () => {
  // ONE write for the name, its loan types AND their income basis. What only ever failed
  // silently is the link: the create must send `surrogateProductKey` ABSENT, never `''`
  // (refused by the DTO) and never `null` (which means UNLINK on a patch).
  it('plans an income-proof name with no link at all — not an empty one', () => {
    // The exact shape: a plan that grew any link field would fail here, not in production.
    expect(savePlan(draft())).toEqual({ incomeBases: ['payslip'], categories: ['personal'] });
  });

  it('carries the loan types, canonically ordered, so the name is born offered', () => {
    // They ride the SAME insert as the row, each taking `incomeBases` as its own basis
    // flags. A create used to assign none, and every new name was parked.
    const plan = savePlan(draft({ offered: ['mortgage', 'personal'] }));
    expect(plan.categories).toEqual(['personal', 'mortgage']);
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
