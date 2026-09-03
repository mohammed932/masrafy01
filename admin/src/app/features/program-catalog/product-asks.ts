/**
 * WHAT STEP ① RENDERS — the ask board, derived.
 *
 * Pure, and here rather than on the page, for the reason `catalog-board.ts` and
 * `figure-slots.ts` already state: the cases that matter fail SILENTLY and look right, and a
 * derivation living on a 1900-line component is one nothing exercises. Every state below is
 * a case in `admin/tests/product-asks.spec.ts`.
 *
 * THREE SECTIONS, NOT TWO, and the reason is that the tri-state is real. The catalog name's
 * scoring grid has two (`scored` / `rest`) and folds drift into the first with a warn tag,
 * because there the tick means one thing. Here a card can be:
 *
 *   asked here      — this product reads it AND the open loan type asks the question
 *   read, not asked — this product reads it and the open loan type does not ask it. The
 *                     product gets no answer from an applicant of that type, and the fix is
 *                     one tap. Folded into "asked here" with a tag, this state reads as a
 *                     cosmetic warning rather than as the reason the product quotes nothing.
 *   not read yet    — the rest of the pool
 *
 * ATTACHMENT IS GLOBAL, NOT PER TAB. A fact is read by a product, full stop; what the tabs
 * decide is which loan type a tick will START ASKING the question in, and which cards carry
 * the warning. So the ticked SET does not change with the open tab — only the section a card
 * sits in, the counts, and the categories a tick would add. That is the one thing a reader of
 * a tabbed grid assumes wrong, and it is pinned by a test.
 */
import { LOAN_CATEGORIES, type LoanCategory } from '@core/loan-category';
import type {
  AskIneligibleReason,
  AskQuestionType,
  ProductAsk,
  ProductAsksBoard,
} from '@features/bank-programs/bank-programs.types';

export type AskSectionKey = 'asked' | 'unasked' | 'rest';

/** One card. Everything the template needs, and nothing it has to work out for itself. */
export interface AskCard {
  /** The QUESTION code — what a tick is addressed by. Empty only for a broken ask. */
  code: string;
  /** The FACT key — what an untick is addressed by. Empty when the product does not read it. */
  factKey: string;
  label: string;
  type: AskQuestionType | null;
  /** True when this product reads the answer. */
  read: boolean;
  /** True when the loan type on the rail asks the question. */
  askedHere: boolean;
  /** The loan types that ask the question at all. Empty = asked of nobody. */
  askedIn: readonly LoanCategory[];
  /** Somebody switched the question off elsewhere: the product can never get an answer. */
  questionInactive: boolean;
  /** Other products reading the same fact — an untick here does not touch them. */
  alsoAskedBy: readonly string[];
  /** The product's own calculation reads this fact. */
  readByRule: boolean;
  /** `undefined` when it can be ticked. */
  blocked?: AskIneligibleReason;
  /** Why an untick is refused, when it is. */
  detachBlocked?: ProductAsk['detach']['reason'];
  detachMeta?: Record<string, unknown>;
  /** A write for this card is in flight. */
  saving: boolean;
}

export interface AskSection {
  key: AskSectionKey;
  cards: AskCard[];
}

export interface AskTab {
  id: LoanCategory;
  /** Facts this product reads whose question this loan type asks. */
  reads: number;
  /** Of the facts it reads, how many this loan type does not ask. */
  unasked: number;
}

export interface AskBoardInput {
  board: ProductAsksBoard | null;
  category: LoanCategory;
  search: string;
  isAr: boolean;
  /** Question codes with an attach in flight. */
  attaching: ReadonlySet<string>;
  /** Fact keys with a detach in flight. */
  detaching: ReadonlySet<string>;
}

function label(row: { labelAr: string; labelEn: string }, isAr: boolean): string {
  return isAr ? row.labelAr : row.labelEn;
}

function matches(card: { code: string; label: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return card.label.toLowerCase().includes(q) || card.code.toLowerCase().includes(q);
}

/**
 * Every card on the board, in one pass, before the search narrows anything.
 *
 * The pool is the spine: it is every ACTIVE question, and each one carries the fact already
 * reading it, so a card knows whether a tick would mint or join without a second lookup.
 * An ask whose question the pool no longer knows is appended afterwards — see `askCards`.
 */
function poolCards(input: AskBoardInput, board: ProductAsksBoard): AskCard[] {
  const asks = new Map(board.asks.map((ask) => [ask.factKey, ask]));
  const readByRule = new Set(board.factsReadByRule);

  return board.pool.map((question) => {
    const ask = question.factKey === null ? undefined : asks.get(question.factKey);
    const read = ask !== undefined;
    return {
      code: question.code,
      factKey: ask?.factKey ?? '',
      label: label(question, input.isAr),
      type: question.type,
      read,
      askedHere: question.categories.includes(input.category),
      askedIn: question.categories,
      // A pool question is active by construction — the pool is the ACTIVE pool. Only an ask
      // whose question was switched off afterwards can be inactive, and it is not in here.
      questionInactive: false,
      alsoAskedBy: ask?.alsoAskedBy ?? question.askedByOtherProducts,
      readByRule: question.factKey !== null && readByRule.has(question.factKey),
      ...(question.eligible ? {} : { blocked: question.ineligibleReason }),
      ...(ask && !ask.detach.ok
        ? { detachBlocked: ask.detach.reason, detachMeta: ask.detach.meta }
        : {}),
      saving:
        input.attaching.has(question.code) ||
        (ask !== undefined && input.detaching.has(ask.factKey)),
    } satisfies AskCard;
  });
}

/**
 * Asks whose question is not in the active pool — switched off, or retired.
 *
 * Rendered by whatever the ask itself carries rather than dropped, because "the question was
 * switched off" and "this product does not read it" have different fixes and only one of them
 * is this screen's. Dropping them would also make a product silently stop listing something
 * it still reads, which is the failure the whole board exists to remove.
 */
function orphanCards(input: AskBoardInput, board: ProductAsksBoard): AskCard[] {
  const poolCodes = new Set(board.pool.map((q) => q.code));
  const readByRule = new Set(board.factsReadByRule);
  return board.asks
    .filter((ask) => ask.questionCode === null || !poolCodes.has(ask.questionCode))
    .map((ask) => ({
      code: ask.questionCode ?? '',
      factKey: ask.factKey,
      label:
        ask.questionCode === null
          ? ask.factKey
          : label({ labelAr: ask.questionLabelAr, labelEn: ask.questionLabelEn }, input.isAr),
      type: ask.questionType,
      read: true,
      askedHere: ask.askedIn.includes(input.category),
      askedIn: ask.askedIn,
      questionInactive: true,
      alsoAskedBy: ask.alsoAskedBy,
      readByRule: readByRule.has(ask.factKey),
      ...(ask.detach.ok ? {} : { detachBlocked: ask.detach.reason, detachMeta: ask.detach.meta }),
      saving: input.detaching.has(ask.factKey),
    }));
}

/** Every card, pool first then orphans, unsorted — the pool keeps the server's own order. */
export function askCards(input: AskBoardInput): AskCard[] {
  const board = input.board;
  if (board === null) return [];
  return [...poolCards(input, board), ...orphanCards(input, board)];
}

/**
 * The three sections, after the search.
 *
 * `asked` is emitted even when empty, so the board says "nothing yet" rather than dropping
 * the heading and reading as though the product were finished. The other two vanish when
 * they have nothing in them.
 */
export function askSections(input: AskBoardInput): AskSection[] {
  const cards = askCards(input).filter((card) => matches(card, input.search));
  const asked = cards.filter((card) => card.read && card.askedHere);
  const unasked = cards.filter((card) => card.read && !card.askedHere);
  const rest = cards.filter((card) => !card.read);
  const sections: AskSection[] = [
    { key: 'asked', cards: asked },
    { key: 'unasked', cards: unasked },
    { key: 'rest', cards: rest },
  ];
  return sections.filter((section) => section.key === 'asked' || section.cards.length > 0);
}

/**
 * The loan-type rail.
 *
 * Counts are taken BEFORE the search, unlike the sections: a tab count is a fact about the
 * product, and a count that moved because somebody typed in a search box would read as the
 * product having changed. `unasked` is what earns the warn accent — a fact this product
 * reads that this loan type never asks is the one state under which the product quotes
 * nothing for that type. A loan type that reads NOTHING is not warned about: a product not
 * sold as a mortgage is the normal case, the same argument the catalog name's rail makes.
 */
export function askTabs(board: ProductAsksBoard | null): AskTab[] {
  return LOAN_CATEGORIES.map((id) => {
    const reads = board?.asks.filter((ask) => ask.askedIn.includes(id)).length ?? 0;
    const unasked = board?.asks.filter((ask) => !ask.askedIn.includes(id)).length ?? 0;
    return { id, reads, unasked };
  });
}

/**
 * Which loan types a tick should start asking the question in.
 *
 * ONLY the open tab, never every tab this product might one day be sold under. The operator
 * ticked a card inside one loan type, and adding the other three would start asking a
 * question of applicants nobody chose to ask — on a global assignment shared with every
 * other product that reads the same question.
 */
export function askInFor(category: LoanCategory): LoanCategory[] {
  return [category];
}

/**
 * The status the wizard rail shows for step ①.
 *
 * `invalid` is new and is a strict improvement: today a product whose only fact is asked in
 * NO loan type reads `done`, and it can never quote. Per-TAB emptiness is not invalid — a
 * product not sold as a mortgage is normal.
 */
export function askStepStatus(
  board: ProductAsksBoard | null,
  dirty: boolean,
): 'todo' | 'done' | 'invalid' {
  if (dirty) return 'invalid';
  if (board === null || board.asks.length === 0) return 'todo';
  const broken = board.asks.some((ask) => ask.askedIn.length === 0 || !ask.questionActive);
  return broken ? 'invalid' : 'done';
}
