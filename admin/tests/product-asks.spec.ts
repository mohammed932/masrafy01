/**
 * THE ASK BOARD's derivation — the cases that fail silently and look right.
 *
 * The ones a naive build gets wrong: a search that also hides what the product already reads
 * (a configured product then reads as empty), and an ask whose question left the pool dropped
 * instead of shown. One list since v32.0.0 — a question carries no loan type, so the board has
 * no per-loan-type tab left to get wrong.
 */
import { describe, expect, it } from 'vitest';
import {
  ASK_PAGE_SIZE,
  askCards,
  askMatchCount,
  askPagedSections,
  askSectionPage,
  askSections,
  askStepStatus,
  type AskBoardInput,
  type AskCard,
  type AskSection,
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

  it('puts a question this product reads in "asked"', () => {
    const sections = askSections(
      input({ board: board({ asks: [ask()], pool: [question({ factKey: 'owned_unit_type' })] }) }),
    );
    expect(sections[0]?.cards.map((c) => c.code)).toEqual(['owned_unit_type']);
    expect(sections.some((s) => s.key === 'rest')).toBe(false);
  });

  it('keeps the "asked" heading when it is empty', () => {
    // Dropping it would make a product with nothing read look finished rather than empty.
    expect(askSections(input())[0]).toEqual({ key: 'asked', cards: [] });
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

  /**
   * The box lives on "Not read yet" and narrows that section alone. A search that also hid
   * read cards would make a configured product read as empty on a word typed to FIND
   * something — the one state this board exists to report.
   */
  it('narrows the pool only, never what the product already reads', () => {
    const withAsk = board({
      asks: [ask()],
      pool: [
        question({ factKey: 'owned_unit_type' }),
        question({ code: 'school_stage', labelEn: 'Which stage?' }),
      ],
    });
    const sections = askSections(input({ board: withAsk, search: 'stage' }));
    expect(sections.find((s) => s.key === 'asked')?.cards.map((c) => c.code)).toEqual([
      'owned_unit_type',
    ]);
    expect(sections.find((s) => s.key === 'rest')?.cards.map((c) => c.code)).toEqual([
      'school_stage',
    ]);
  });

  /** The box is in that heading: dropping the section on the keystroke that empties it
   *  would take the search field out from under the caret. */
  it('keeps the pool section while a query stands, even with nothing in it', () => {
    const sections = askSections(input({ search: 'zzzz' }));
    expect(sections.map((s) => s.key)).toEqual(['asked', 'rest']);
    expect(sections.find((s) => s.key === 'rest')?.cards).toEqual([]);
  });

  it('drops the empty pool section when the box is empty', () => {
    const withAsk = board({
      asks: [ask()],
      pool: [question({ factKey: 'owned_unit_type' })],
    });
    expect(askSections(input({ board: withAsk })).map((s) => s.key)).toEqual(['asked']);
  });

  it('reads Arabic wording in the Arabic build', () => {
    const [card] = askCards(input({ isAr: true }));
    expect(card?.label).toBe('نوع الوحدة');
  });
});

describe('askMatchCount — a query that matched nothing is not an empty product', () => {
  it('counts what survived the search in the pool', () => {
    const pool = [question(), question({ code: 'school_stage', labelEn: 'Which stage?' })];
    expect(askMatchCount(askSections(input({ board: board({ pool }) })))).toBe(2);
    expect(askMatchCount(askSections(input({ board: board({ pool }), search: 'stage' })))).toBe(1);
  });

  /**
   * The state the board cannot report on its own: a query matching nothing leaves the pool
   * heading at 0, and without this the live region would say nothing about why the grid the
   * operator is picking from went empty under the caret.
   */
  it('is 0 when the query matches nothing, though the section is still emitted', () => {
    const sections = askSections(input({ search: 'zzzz' }));
    expect(sections.map((s) => s.key)).toEqual(['asked', 'rest']);
    expect(askMatchCount(sections)).toBe(0);
  });

  /**
   * The read cards are NOT matches: the search narrows the pool alone, so counting them would
   * announce "8 questions match" on a word that found one card the operator can tick.
   */
  it('counts the pool only, never the cards the product already reads', () => {
    const withAsk = board({
      asks: [ask()],
      pool: [question({ factKey: 'owned_unit_type' })],
    });
    expect(askMatchCount(askSections(input({ board: withAsk, search: 'unit' })))).toBe(0);
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
          pool: [question({ factKey: 'school_type', askedByOtherProducts: ['school_type_cap'] })],
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
          asks: [ask({ detach: { ok: false, reason: 'read_by_own_rule' } })],
          pool: [question({ factKey: 'owned_unit_type' })],
        }),
      }),
    );
    expect(card?.detachBlocked).toBe('read_by_own_rule');
  });

  it('carries where the ask came from, and does NOT read it as a refusal', () => {
    // Provenance, not a permission. An ask that came with the product is removable — the
    // server tombstones its row rather than deleting it, so `seed:blueprints` cannot put it
    // back — and the card says "comes with the product" while still offering the untick.
    const [card] = askCards(
      input({
        board: board({
          asks: [ask({ source: 'blueprint' })],
          pool: [question({ factKey: 'owned_unit_type' })],
        }),
      }),
    );
    expect(card?.source).toBe('blueprint');
    expect(card?.detachBlocked).toBeUndefined();
  });

  it('reports no source for a question this product does not read', () => {
    const [card] = askCards(input({ board: board({ pool: [question()] }) }));
    expect(card?.read).toBe(false);
    expect(card?.source).toBeNull();
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

describe('askStepStatus', () => {
  it('is todo with nothing read', () => {
    expect(askStepStatus(board(), false)).toBe('todo');
  });

  it('is done when every fact read has a live question', () => {
    expect(askStepStatus(board({ asks: [ask()] }), false)).toBe('done');
  });

  it('is INVALID when the question behind a fact is switched off', () => {
    expect(askStepStatus(board({ asks: [ask({ questionActive: false })] }), false)).toBe('invalid');
  });

  it('lets unsaved figures win', () => {
    expect(askStepStatus(board({ asks: [ask()] }), true)).toBe('invalid');
  });
});

const cardsOf = (n: number, prefix = 'q'): AskCard[] =>
  Array.from({ length: n }, (_, i) => ({
    code: `${prefix}${i + 1}`,
    factKey: '',
    label: `Question ${i + 1}`,
    type: 'SINGLE_SELECT' as const,
    read: false,
    questionInactive: false,
    source: null,
    alsoAskedBy: [],
    readByRule: false,
    saving: false,
  }));

const section = (n: number, key: AskSection['key'] = 'rest'): AskSection => ({
  key,
  cards: cardsOf(n),
});

describe('askSectionPage', () => {
  it('renders eight cards and reports one page of eight', () => {
    const page = askSectionPage(section(59), 1);
    expect(ASK_PAGE_SIZE).toBe(8);
    expect(page.cards.map((c) => c.code)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8']);
    expect(page).toMatchObject({ page: 1, pages: 8, total: 59, from: 1, to: 8 });
  });

  it('keeps the heading count on the WHOLE section, never the page', () => {
    // A count that shrank to 8 because a pager appeared reads as cards having gone away.
    expect(askSectionPage(section(59), 3).total).toBe(59);
  });

  it('serves the short last page', () => {
    const page = askSectionPage(section(59), 8);
    expect(page.cards).toHaveLength(3);
    expect(page).toMatchObject({ from: 57, to: 59 });
  });

  it('CLAMPS a page past the end instead of rendering an empty grid', () => {
    // What a stored page index reaches on its own the moment a search narrows the list.
    const page = askSectionPage(section(12), 9);
    expect(page.page).toBe(2);
    expect(page.cards.map((c) => c.code)).toEqual(['q9', 'q10', 'q11', 'q12']);
  });

  it('clamps a page below one', () => {
    expect(askSectionPage(section(12), 0).page).toBe(1);
    expect(askSectionPage(section(12), -4).page).toBe(1);
  });

  it('reports one page and a 0–0 range on an empty section', () => {
    // `asked` is emitted empty by design, so this shape is on screen for every new product.
    expect(askSectionPage(section(0, 'asked'), 1)).toEqual({
      key: 'asked',
      cards: [],
      page: 1,
      pages: 1,
      total: 0,
      from: 0,
      to: 0,
    });
  });

  it('needs no pager at exactly one page', () => {
    expect(askSectionPage(section(8), 1).pages).toBe(1);
  });
});

describe('askPagedSections', () => {
  it('pages each section on its own, defaulting to page 1', () => {
    const pages = askPagedSections([section(3, 'asked'), section(25, 'rest')], { rest: 2 });
    expect(pages.map((p) => [p.key, p.page, p.cards.length])).toEqual([
      ['asked', 1, 3],
      ['rest', 2, 8],
    ]);
  });

  it('does not let one section page index reach another', () => {
    const pages = askPagedSections([section(3, 'asked'), section(25, 'rest')], { asked: 1 });
    expect(pages[1]).toMatchObject({ key: 'rest', page: 1, from: 1, to: 8 });
  });
});
