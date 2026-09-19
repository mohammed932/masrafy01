import { LOAN_CATEGORIES, canonicalCategories, type LoanCategory } from '@core/loan-category';

/**
 * Which questions a loan type's applicants are asked, and what a tick on that board writes.
 *
 * WHY A MODULE OF ITS OWN. Two of the things here are only wrong in states no component test
 * reaches, and both fail silently rather than loudly:
 *
 *  - the GATE CLOSURE. 23 of the pool's questions appear only after a specific answer to
 *    another one (`enabledWhen`). Adding such a question to a loan type whose applicants are
 *    not asked its SOURCE does not break — the server shows a question whose rule it cannot
 *    evaluate, so the branch quietly stops branching and the question becomes unconditional
 *    for everyone. Nothing on screen says so; the only place it surfaces today is the health
 *    panel on `/questionnaire/categories`. `pendingAdds` therefore pulls each picked
 *    question's gate source in with it, transitively — two-level chains exist.
 *  - the GROUPING. The board is per loan type, so one question genuinely gets ticked under
 *    two of them in one session. Emitted as two rows, the second would be the one the server
 *    kept if this were a whole-set write, and the first loan type would be silently dropped.
 *    It is an ADD-only write, so today that is harmless — which is exactly why it would go
 *    unnoticed if the endpoint ever changed under it.
 *
 * ADD-ONLY is the whole contract of this board. `question_loan_category` is global: it says
 * which loan types ask a question, for every program name at once. Turning one ON from here
 * is additive and safe; turning one OFF would stop asking it for every program of that loan
 * type, which is `/questionnaire/categories`' job and nowhere else's.
 *
 * Pure: no Angular, no `$localize`. The words belong to the screens — `categoryLabel()` calls
 * `$localize` in its body, which does not exist under the bare jsdom the specs run in.
 */

/** A question from the global pool, in the shape this board reasons about. */
export interface AskableQuestion {
  readonly id: string;
  readonly code: string;
  readonly labelEn: string;
  readonly labelAr: string;
  /**
   * A switched-off question is asked of nobody whatever its categories say, so it is listed
   * as unavailable rather than offered as a live add that would do nothing.
   */
  readonly isActive: boolean;
  /**
   * Required questions are the ones that can break something. Apply enforces requiredness
   * from the LIVE assignment table while customers are served a frozen snapshot, so widening
   * a required question refuses every application already in flight in that loan type until
   * they answer it. The board confirms those and ticks the rest silently.
   */
  readonly isRequired: boolean;
  /** The loan types that ask it today. Empty = parked: kept, editable, asked by nobody. */
  readonly categories: readonly LoanCategory[];
  /** `enabledWhen.questionCode` — the question this one branches off, or `null`. */
  readonly gateSourceCode: string | null;
  /** Wording + code + answer labels, already lower-cased. What search matches. */
  readonly haystack: string;
}

/** What the operator has ticked, per loan type, before anything is written. */
export type AskedPicks = ReadonlyMap<LoanCategory, ReadonlySet<string>>;

/** One row on the board. */
export interface AskedRow {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly isRequired: boolean;
  readonly isActive: boolean;
  /** Ticked in this session, as opposed to already asked before the operator arrived. */
  readonly justPicked: boolean;
  /**
   * The loan type already asks it, whoever set that and whenever.
   *
   * Only a blank-start board renders this: there, an untouched row sits in the NOT-TICKED
   * list whether or not the loan type already asks it, and without the tag the row would
   * read as "leave it and it is not asked", which is the one thing a global list cannot
   * promise. Ticking such a row writes nothing — `pendingAdds` drops it.
   */
  readonly alreadyAsked: boolean;
  /**
   * The questions this one would drag in with it — its gate source chain, named, so the card
   * can say so before the tick rather than after the publish.
   */
  readonly alsoAdds: readonly string[];
}

export interface AskedSections {
  /** Asked in this loan type already, plus everything ticked this session. */
  readonly asked: readonly AskedRow[];
  /** The rest of the pool. The only section search narrows. */
  readonly rest: readonly AskedRow[];
}

/** One loan type's tab: how many questions it asks, and how many of those are new. */
export interface AskedTab {
  readonly category: LoanCategory;
  readonly asked: number;
  readonly adding: number;
}

/** One row of the write: a question, and the loan types to add it to. */
export interface QuestionCategoryAdd {
  readonly questionId: string;
  readonly categories: LoanCategory[];
}

function picked(picks: AskedPicks, category: LoanCategory, id: string): boolean {
  return picks.get(category)?.has(id) === true;
}

/** Is this question asked in that loan type — stored, or ticked in this session? */
export function isAsked(q: AskableQuestion, category: LoanCategory, picks: AskedPicks): boolean {
  return q.categories.includes(category) || picked(picks, category, q.id);
}

/**
 * The gate sources a tick would have to bring with it, nearest first.
 *
 * Walks `enabledWhen` upward until it reaches a question the loan type already asks, one the
 * operator has already ticked, or the end of the chain. A cycle is impossible through the
 * server's own guards but is bounded here anyway — a pure function that can hang is worse
 * than one that stops early, and the bound costs a `Set`.
 */
export function gateChainFor(
  pool: readonly AskableQuestion[],
  question: AskableQuestion,
  category: LoanCategory,
  picks: AskedPicks,
): readonly AskableQuestion[] {
  const byCode = new Map(pool.map((q) => [q.code, q]));
  const out: AskableQuestion[] = [];
  const seen = new Set<string>([question.id]);
  let at: AskableQuestion | undefined = question;
  while (at?.gateSourceCode != null) {
    const source: AskableQuestion | undefined = byCode.get(at.gateSourceCode);
    // A gate naming a question the pool does not carry scopes nothing — the pool editor's
    // own guards own that case, and refusing here would block a tick over somebody else's
    // broken row.
    if (source === undefined || seen.has(source.id)) break;
    seen.add(source.id);
    if (!isAsked(source, category, picks)) out.push(source);
    at = source;
  }
  return out;
}

function rowOf(
  pool: readonly AskableQuestion[],
  q: AskableQuestion,
  category: LoanCategory,
  picks: AskedPicks,
  isAr: boolean,
): AskedRow {
  return {
    id: q.id,
    code: q.code,
    label: (isAr ? q.labelAr : q.labelEn) || q.code,
    isRequired: q.isRequired,
    isActive: q.isActive,
    justPicked: picked(picks, category, q.id),
    alreadyAsked: q.categories.includes(category),
    alsoAdds: gateChainFor(pool, q, category, picks).map((s) => (isAr ? s.labelAr : s.labelEn)),
  };
}

/**
 * The board's two lists for one loan type.
 *
 * Search narrows the SECOND list only. The first is what this loan type already asks, and
 * hiding part of it behind a search turns the count above it into a lie — the operator is
 * searching for something to add, not auditing what is there.
 *
 * `blankStart` is the CREATE flow's reading, and it changes which list a row lands in and
 * nothing else. There, the first list is what the operator has TICKED — it opens empty, and
 * a question the loan type already asks starts in the second list with `alreadyAsked` set,
 * rather than arriving pre-ticked on a screen nobody has touched yet. The name does not
 * exist, so nothing on this board describes it; every tick is the operator's own. The
 * already-asked rows are still listed and still say so, because leaving one un-ticked does
 * NOT stop it being asked — `question_loan_category` is global and this board is add-only.
 */
export function askedSections(
  pool: readonly AskableQuestion[],
  category: LoanCategory,
  picks: AskedPicks,
  search: string,
  isAr: boolean,
  blankStart = false,
): AskedSections {
  const needle = search.trim().toLowerCase();
  const asked: AskedRow[] = [];
  const rest: AskedRow[] = [];
  for (const q of pool) {
    if (blankStart ? picked(picks, category, q.id) : isAsked(q, category, picks)) {
      asked.push(rowOf(pool, q, category, picks, isAr));
      continue;
    }
    if (needle !== '' && !q.haystack.includes(needle)) continue;
    rest.push(rowOf(pool, q, category, picks, isAr));
  }
  return { asked, rest };
}

/**
 * One tab per loan type the name is OFFERED under, in canonical order.
 *
 * `blankStart` counts the same rows the board shows: on a create flow the number beside a
 * loan type is what the operator has ticked for it, so it starts at 0 and only they can
 * move it. Counting the stored set there would put a number on the rail that no click of
 * theirs produced.
 */
export function askedTabs(
  pool: readonly AskableQuestion[],
  offered: readonly LoanCategory[],
  picks: AskedPicks,
  blankStart = false,
): readonly AskedTab[] {
  return canonicalCategories(offered).map((category) => {
    let asked = 0;
    let adding = 0;
    for (const q of pool) {
      if (!(blankStart ? picks.get(category)?.has(q.id) === true : isAsked(q, category, picks)))
        continue;
      asked += 1;
      if (!q.categories.includes(category)) adding += 1;
    }
    return { category, asked, adding };
  });
}

/**
 * What to write, grouped by question and closed over gates.
 *
 * Returns `[]` when nothing moved, which the caller MUST use to skip the request entirely:
 * the endpoint refuses an empty body, and a request that changes nothing would still cut a
 * questionnaire version — a full copy of the pool, in a history an operator reads.
 *
 * A loan type the operator did not offer the name under contributes nothing even if the map
 * still holds ticks from before they un-ticked it, so walking back a step cannot leave a
 * write behind.
 */
export function pendingAdds(
  pool: readonly AskableQuestion[],
  offered: readonly LoanCategory[],
  picks: AskedPicks,
): QuestionCategoryAdd[] {
  const byId = new Map(pool.map((q) => [q.id, q]));
  const wanted = new Map<string, Set<LoanCategory>>();
  const want = (id: string, category: LoanCategory): void => {
    const set = wanted.get(id) ?? new Set<LoanCategory>();
    set.add(category);
    wanted.set(id, set);
  };
  for (const category of canonicalCategories(offered)) {
    for (const id of picks.get(category) ?? []) {
      const q = byId.get(id);
      if (q === undefined || q.categories.includes(category)) continue;
      want(id, category);
      for (const source of gateChainFor(pool, q, category, picks)) want(source.id, category);
    }
  }
  return [...wanted.entries()]
    .map(([questionId, categories]) => ({
      questionId,
      categories: canonicalCategories([...categories]),
    }))
    .filter((row) => row.categories.length > 0);
}

/** How many questions the write would touch — what the summary line counts. */
export function pendingAddCount(adds: readonly QuestionCategoryAdd[]): number {
  return adds.length;
}

/** Every loan type, for a board that is not scoped to one name's offer set. */
export const ALL_ASKED_TABS: readonly LoanCategory[] = LOAN_CATEGORIES;
