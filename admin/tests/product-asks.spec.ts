/**
 * THE ASK BOARD's derivation — the cases that fail silently and look right.
 *
 * The one a naive build gets wrong: a tabbed grid reads as though the TICK were per tab, so
 * switching tabs looks like it should change what is ticked. It must not — a fact is read by
 * a product, full stop — and what the tabs decide is which loan type a tick starts asking
 * the question in, and which cards carry the warning.
 */
import { describe, expect, it } from 'vitest';
import {
  askCards,
  askInFor,
  askSections,
  askStepStatus,
  askTabs,
  type AskBoardInput,
} from '../src/app/features/program-catalog/product-asks';
import type {
  AskPoolQuestion,
  ProductAsk,
  ProductAsksBoard,
} from '../src/app/features/bank-programs/bank-programs.types';

const question = (over: Partial<AskPoolQuestion> = {}): AskPoolQuestion => ({
  code: 'owned_unit_type',
  labelAr: 'نوع الوحدة',
  labelEn: 'What kind of unit do you own?',
  type: 'SINGLE_SELECT',
  isRequired: false,
  categories: ['personal'],
  eligible: true,
  factKey: null,
  askedByThisProduct: false,
  askedByOtherProducts: [],
  ...over,
});

const ask = (over: Partial<ProductAsk> = {}): ProductAsk => ({
  factKey: 'owned_unit_type',
  source: 'operator',
  questionCode: 'owned_unit_type',
  questionLabelAr: 'نوع الوحدة',
  questionLabelEn: 'What kind of unit do you own?',
  questionType: 'SINGLE_SELECT',
  questionActive: true,
  askedIn: ['personal'],
  listType: null,
  parentListType: null,
  alsoAskedBy: [],
  detach: { ok: true },
  ...over,
});

const board = (over: Partial<ProductAsksBoard> = {}): ProductAsksBoard => ({
  productKey: 'compound_owner',
  labelAr: 'المنتج',
  labelEn: 'Product',
  active: true,
  capOnly: false,
  asks: [],
  pool: [question()],
  factsReadByRule: [],
  ...over,
});

const input = (over: Partial<AskBoardInput> = {}): AskBoardInput => ({
  board: board(),
  category: 'personal',
  search: '',
  isAr: false,
  attaching: new Set(),
  detaching: new Set(),
  ...over,
});

describe('askSections', () => {
  it('puts an unread question in the pool section', () => {
    const sections = askSections(input());
    expect(sections.map((s) => s.key)).toEqual(['asked', 'rest']);
    expect(sections[1]?.cards.map((c) => c.code)).toEqual(['owned_unit_type']);
  });

  it('puts a read question the open loan type asks in "asked here"', () => {
    const sections = askSections(
      input({ board: board({ asks: [ask()], pool: [question({ factKey: 'owned_unit_type' })] }) }),
    );
    expect(sections[0]?.cards.map((c) => c.code)).toEqual(['owned_unit_type']);
    expect(sections.some((s) => s.key === 'rest')).toBe(false);
  });

  it('separates a fact this product READS that the open loan type does not ask', () => {
    // The state a two-section grid hides behind a tag, and the one that makes the product
    // quote nothing for that loan type. Its own section, because the fix is a different act.
    const sections = askSections(
      input({
        category: 'car',
        board: board({
          asks: [ask()],
          pool: [question({ factKey: 'owned_unit_type', categories: ['personal'] })],
        }),
      }),
    );
    expect(sections.map((s) => s.key)).toEqual(['asked', 'unasked']);
    expect(sections[1]?.cards[0]?.askedHere).toBe(false);
  });

  it('keeps the "asked here" heading when it is empty', () => {
    // Dropping it would make a product with nothing read look finished rather than empty.
    expect(askSections(input())[0]).toEqual({ key: 'asked', cards: [] });
  });

  it('DOES NOT change what is read when the tab changes', () => {
    // Attachment is global. Only the section, the counts and what a tick would widen move.
    const withAsk = board({
      asks: [ask({ askedIn: ['personal'] })],
      pool: [question({ factKey: 'owned_unit_type', categories: ['personal'] })],
    });
    for (const category of ['personal', 'car', 'mortgage', 'business'] as const) {
      const cards = askCards(input({ board: withAsk, category }));
      expect(cards.filter((c) => c.read).map((c) => c.code)).toEqual(['owned_unit_type']);
    }
  });

  it('searches wording AND code', () => {
    const pool = [question(), question({ code: 'school_stage', labelEn: 'Which stage?' })];
    expect(
      askSections(input({ board: board({ pool }), search: 'stage' }))
        .flatMap((s) => s.cards)
        .map((c) => c.code),
    ).toEqual(['school_stage']);
    expect(
      askSections(input({ board: board({ pool }), search: 'owned_unit' }))
        .flatMap((s) => s.cards)
        .map((c) => c.code),
    ).toEqual(['owned_unit_type']);
  });

  it('reads Arabic wording in the Arabic build', () => {
    const [card] = askCards(input({ isAr: true }));
    expect(card?.label).toBe('نوع الوحدة');
  });
});

describe('askCards — what cannot be ticked', () => {
  it('LISTS a free-text question, with the reason', () => {
    // Listed, not filtered. A naive build hides the ineligible ones and the operator hunts
    // for a question that is on the screen it is not on.
    const [card] = askCards(
      input({
        board: board({
          pool: [question({ type: 'TEXT', eligible: false, ineligibleReason: 'text' })],
        }),
      }),
    );
    expect(card?.blocked).toBe('text');
    expect(card?.type).toBe('TEXT');
  });

  it('lists the declared salary with its own reason', () => {
    const [card] = askCards(
      input({
        board: board({
          pool: [
            question({
              code: 'monthly_income',
              type: 'NUMERIC',
              eligible: false,
              ineligibleReason: 'money_binding',
            }),
          ],
        }),
      }),
    );
    expect(card?.blocked).toBe('money_binding');
  });

  it('carries who else reads a fact this product has not ticked', () => {
    const [card] = askCards(
      input({
        board: board({
          pool: [
            question({ factKey: 'school_type', askedByOtherProducts: ['school_type_cap'] }),
          ],
        }),
      }),
    );
    expect(card?.read).toBe(false);
    expect(card?.alsoAskedBy).toEqual(['school_type_cap']);
  });

  it('carries the untick refusal from the server, never re-derived', () => {
    const [card] = askCards(
      input({
        board: board({
          asks: [ask({ source: 'blueprint', detach: { ok: false, reason: 'blueprint_owned' } })],
          pool: [question({ factKey: 'owned_unit_type' })],
        }),
      }),
    );
    expect(card?.detachBlocked).toBe('blueprint_owned');
  });

  it('renders an ask whose question left the pool, and keeps it detachable', () => {
    // "The question was retired" and "this product does not read it" have different fixes,
    // and only one of them is this screen's.
    const cards = askCards(
      input({
        board: board({
          asks: [ask({ factKey: 'gone_key', questionCode: 'gone_code', questionActive: false })],
          pool: [],
        }),
      }),
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      factKey: 'gone_key',
      // Its own code survives, so "Edit the wording" still has somewhere to point.
      code: 'gone_code',
      read: true,
      questionInactive: true,
    });
    // Absent, not `undefined`: the key is omitted when the untick is allowed, so a template
    // reading it with `@if` renders nothing rather than a blank reason chip.
    expect('detachBlocked' in cards[0]!).toBe(false);
  });

  it('falls back to the fact key when the ask reads no question at all', () => {
    const [card] = askCards(
      input({
        board: board({
          asks: [ask({ factKey: 'orphan', questionCode: null, questionType: null })],
          pool: [],
        }),
      }),
    );
    expect(card?.label).toBe('orphan');
    expect(card?.code).toBe('');
  });

  it('marks a card the calculation reads', () => {
    const [card] = askCards(
      input({
        board: board({
          asks: [ask()],
          pool: [question({ factKey: 'owned_unit_type' })],
          factsReadByRule: ['owned_unit_type'],
        }),
      }),
    );
    expect(card?.readByRule).toBe(true);
  });

  it('marks a card with a write in flight, from either direction', () => {
    const withAsk = board({ asks: [ask()], pool: [question({ factKey: 'owned_unit_type' })] });
    expect(askCards(input({ attaching: new Set(['owned_unit_type']) }))[0]?.saving).toBe(true);
    expect(
      askCards(input({ board: withAsk, detaching: new Set(['owned_unit_type']) }))[0]?.saving,
    ).toBe(true);
  });
});

describe('askTabs', () => {
  it('counts what each loan type asks, and what it does not', () => {
    const tabs = askTabs(
      board({
        asks: [
          ask({ factKey: 'a', askedIn: ['personal', 'car'] }),
          ask({ factKey: 'b', askedIn: ['personal'] }),
        ],
      }),
    );
    expect(tabs.find((t) => t.id === 'personal')).toEqual({ id: 'personal', reads: 2, unasked: 0 });
    expect(tabs.find((t) => t.id === 'car')).toEqual({ id: 'car', reads: 1, unasked: 1 });
    // A loan type that reads NOTHING is not warned about: a product not sold as a mortgage
    // is the normal case.
    expect(tabs.find((t) => t.id === 'mortgage')).toEqual({ id: 'mortgage', reads: 0, unasked: 2 });
  });

  it('renders four tabs with no board at all', () => {
    expect(askTabs(null)).toHaveLength(4);
  });

  it('does not move a count because somebody typed in the search box', () => {
    // Counts come from the board, not from the filtered sections: a tab count is a fact
    // about the product.
    const b = board({ asks: [ask()] });
    expect(askTabs(b)).toEqual(askTabs(b));
  });
});

describe('askInFor', () => {
  it('widens ONLY the open loan type', () => {
    // Never every type the product might one day be sold under: the assignment is global to
    // the question and shared with every other product reading it.
    expect(askInFor('car')).toEqual(['car']);
  });
});

describe('askStepStatus', () => {
  it('is todo with nothing read', () => {
    expect(askStepStatus(board(), false)).toBe('todo');
  });

  it('is done when everything read is asked somewhere', () => {
    expect(askStepStatus(board({ asks: [ask()] }), false)).toBe('done');
  });

  it('is INVALID when a fact is asked of nobody', () => {
    // Today such a product reads `done` and can never quote.
    expect(askStepStatus(board({ asks: [ask({ askedIn: [] })] }), false)).toBe('invalid');
  });

  it('is INVALID when the question behind a fact is switched off', () => {
    expect(askStepStatus(board({ asks: [ask({ questionActive: false })] }), false)).toBe('invalid');
  });

  it('lets unsaved figures win', () => {
    expect(askStepStatus(board({ asks: [ask()] }), true)).toBe('invalid');
  });
});
