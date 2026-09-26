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
  /**
   * The loan types that ask it of EVERY program name today. Empty = parked: kept, editable,
   * asked by nobody (or only by names that add it — see `optInCategories`).
   */
  readonly categories: readonly LoanCategory[];
  /**
   * The loan types it sits in only as an OPT-IN row: a program name added it for its own
   * applicants. Disjoint from `categories`. Absent on a bare fixture — read as none.
   */
  readonly optInCategories?: readonly LoanCategory[];
  /** `enabledWhen.questionCode` — the question this one branches off, or `null`. */
  readonly gateSourceCode: string | null;
  /** Wording + code + answer labels, already lower-cased. What search matches. */
  readonly haystack: string;
  /** `SINGLE_SELECT` | `MULTI_SELECT` | `NUMERIC` | `TEXT`. Absent on a bare fixture. */
  readonly type?: string;
  /** The questionnaire section it sits in — the board groups its cards by this. */
  readonly groupKey?: string;
  readonly groupEn?: string;
  readonly groupAr?: string;
  /** Active answer labels, in order — a card previews the first few. */
  readonly optionsEn?: readonly string[];
  readonly optionsAr?: readonly string[];
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
  readonly type: string | null;
  /** Appears only after a specific answer to another question, so not everyone sees it. */
  readonly gated: boolean;
  /** Section the question sits in; rows sharing a `groupKey` are drawn under one heading. */
  readonly groupKey: string;
  readonly group: string;
  /** Answer labels in the reading language, for the card's preview line. */
  readonly options: readonly string[];
}

/** What an applicant of one name is served in one loan type — counted server-side. */
export interface ServedCount {
  readonly category: LoanCategory;
  readonly categoryTotal: number;
  readonly categoryRequired: number;
  readonly servedTotal: number;
  readonly servedRequired: number;
  /**
   * Served to this name and NOT in the loan type's own list — the questions it added, or that
   * a bank program under it reads through an opt-in row. Absent on an older server.
   */
  readonly servedExtra?: number;
  /** Codes of the questions served, when the endpoint sends them. */
  readonly servedQuestionCodes?: readonly string[];
  /**
   * False while no active bank program is filed under the name: the name's unticks and
   * additions are stored but not in force, and the applicant is asked what the loan type asks.
   */
  readonly nameAxisActive?: boolean;
}

/** A run of rows from one questionnaire section, in pool order. */
export interface AskedGroup {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly AskedRow[];
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
    type: q.type ?? null,
    gated: q.gateSourceCode !== null,
    groupKey: q.groupKey ?? '',
    group: (isAr ? q.groupAr : q.groupEn) || q.groupEn || q.groupAr || '',
    options: (isAr ? q.optionsAr : q.optionsEn) ?? q.optionsEn ?? [],
  };
}

/**
 * Rows folded into their questionnaire sections, keeping the pool's own order.
 *
 * The pool arrives in section order, so a section is a contiguous run — but it is keyed and
 * merged rather than trusted to be contiguous, because a search or a tick can pull one row
 * out of the middle of a section and the heading must not be repeated for the remainder.
 * Rows with no section (a bare fixture) fall under one untitled group.
 */
export function groupRows(rows: readonly AskedRow[]): readonly AskedGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, { title: string; rows: AskedRow[] }>();
  for (const row of rows) {
    let entry = byKey.get(row.groupKey);
    if (entry === undefined) {
      entry = { title: row.group, rows: [] };
      byKey.set(row.groupKey, entry);
      order.push(row.groupKey);
    }
    entry.rows.push(row);
  }
  return order.map((key) => ({ key, title: byKey.get(key)!.title, rows: byKey.get(key)!.rows }));
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

// ---------------------------------------------------------------------------------------
// The minimum a loan type must ask to be QUOTABLE
// ---------------------------------------------------------------------------------------

/**
 * The four money answers the engine cannot price without (`MONEY_FIELD_BINDINGS` on the
 * backend — a missing one yields no figures, never a default). Mirrored here as codes because
 * the admin has no endpoint that lists them per loan type; a code renamed on the backend is a
 * code change on both sides, which is the same accepted limit the backend constant records.
 */
const MONEY_CORE: readonly string[] = [
  'monthly_income',
  'amount_requested',
  'repayment_period_months',
  'current_installments',
];

/**
 * Per loan type, the answers a quote reads beyond the money four.
 *
 * `car`: price and down payment are typed numbers now and cap the loan by the share the bank
 * finances. `mortgage`: the property value and the down payment. `personal` needs only the
 * money four. `business` is deliberately not validated here — its product is priced off the
 * money four too, but nothing on the platform sells a business program off a checklist this
 * short, and inventing one would refuse a name over a rule nobody stated.
 */
export const CORE_QUESTION_CODES: Readonly<Partial<Record<LoanCategory, readonly string[]>>> = {
  personal: MONEY_CORE,
  car: [...MONEY_CORE, 'car_price', 'car_down_payment'],
  mortgage: [...MONEY_CORE, 'property_value', 'down_payment'],
};

export type CoreState =
  /** The loan type already asks it. */
  | 'asked'
  /** Not asked yet, but ticked in this session. */
  | 'picked'
  /** In the pool and switched on, but this loan type does not ask it — a tick fixes it. */
  | 'not_asked'
  /** Not in the pool, or switched off — no tick here can fix it. */
  | 'unavailable';

export interface CoreCheck {
  readonly code: string;
  readonly label: string;
  readonly state: CoreState;
  /** The pool row to tick, when a tick can fix it. */
  readonly questionId: string | null;
  readonly isRequired: boolean;
}

/** Is this loan type one the checklist covers? */
export function isValidatedCategory(category: LoanCategory): boolean {
  return CORE_QUESTION_CODES[category] !== undefined;
}

/** One loan type's checklist, in the order the codes are listed above. */
export function coreChecks(
  pool: readonly AskableQuestion[],
  category: LoanCategory,
  picks: AskedPicks,
  isAr: boolean,
): readonly CoreCheck[] {
  const byCode = new Map(pool.map((q) => [q.code, q]));
  return (CORE_QUESTION_CODES[category] ?? []).map((code): CoreCheck => {
    const q = byCode.get(code);
    if (q === undefined || !q.isActive) {
      return { code, label: code, state: 'unavailable', questionId: null, isRequired: false };
    }
    const label = (isAr ? q.labelAr : q.labelEn) || code;
    const state: CoreState = q.categories.includes(category)
      ? 'asked'
      : picked(picks, category, q.id)
        ? 'picked'
        : 'not_asked';
    return { code, label, state, questionId: q.id, isRequired: q.isRequired };
  });
}

/**
 * Checks that would leave a loan type unquotable, across every loan type the name is offered
 * under. `not_asked` and `unavailable` both block; only the first can be fixed by a tick.
 * Empty pool (unread) yields nothing — a failed read must not refuse a name it cannot judge.
 */
export function coreProblems(
  pool: readonly AskableQuestion[],
  offered: readonly LoanCategory[],
  picks: AskedPicks,
  isAr: boolean,
): readonly { readonly category: LoanCategory; readonly missing: readonly CoreCheck[] }[] {
  if (pool.length === 0) return [];
  return canonicalCategories(offered)
    .filter(isValidatedCategory)
    .map((category) => ({
      category,
      missing: coreChecks(pool, category, picks, isAr).filter(
        (c) => c.state === 'not_asked' || c.state === 'unavailable',
      ),
    }))
    .filter((p) => p.missing.length > 0);
}

// ---- Unticking a question for ONE program name -------------------------------------------

/**
 * Why a question cannot be unticked for a program name, or `null` when it can.
 *
 *   - `engine` / `program` come from the server (`questionLockReason`), never from a list kept
 *     here: every quote reads the first kind, a bank program under the name reads the second.
 *   - `gate` is worked out here, for feedback before anything is saved: another question this
 *     name still asks appears only after an answer to this one, so skipping it would leave that
 *     question with nothing to branch off. The server's gate closure would put it back anyway.
 */
export type UntickLock = 'engine' | 'program' | 'gate';

/**
 * The lock on every question the loan type asks, keyed by question id. Missing = free.
 *
 * Unticking is per (name, loan type) and subtractive: `question_loan_category` stays as it is,
 * so the other names of the loan type keep asking what this one skips.
 */
export function untickLocks(
  pool: readonly AskableQuestion[],
  category: LoanCategory,
  picks: AskedPicks,
  excluded: ReadonlySet<string>,
  serverLocks: ReadonlyMap<string, 'engine' | 'program'>,
): ReadonlyMap<string, UntickLock> {
  const asked = pool.filter((q) => q.isActive && isAsked(q, category, picks));
  const dependentsOf = new Map<string, AskableQuestion[]>();
  for (const q of asked) {
    if (q.gateSourceCode === null) continue;
    const list = dependentsOf.get(q.gateSourceCode) ?? [];
    list.push(q);
    dependentsOf.set(q.gateSourceCode, list);
  }
  const out = new Map<string, UntickLock>();
  const visiting = new Set<string>();
  const lockOf = (q: AskableQuestion): UntickLock | null => {
    const known = out.get(q.id);
    if (known !== undefined) return known;
    const server = serverLocks.get(q.code);
    if (server !== undefined) {
      out.set(q.id, server);
      return server;
    }
    // Bounded against a cycle the server's own guards already refuse.
    if (visiting.has(q.id)) return null;
    visiting.add(q.id);
    const held = (dependentsOf.get(q.code) ?? []).some(
      (d) => !excluded.has(d.id) || lockOf(d) !== null,
    );
    visiting.delete(q.id);
    if (held) out.set(q.id, 'gate');
    return held ? 'gate' : null;
  };
  for (const q of asked) lockOf(q);
  return out;
}

/**
 * What to save for one loan type: the unticked ids, minus any the server now locks — a bank
 * program filed after the untick may have started reading one, and the server refuses a write
 * that names it. A gate-held one is kept: it is still the operator's choice, and it takes
 * effect the moment the question behind it is unticked too.
 */
export function exclusionsToSave(
  pool: readonly AskableQuestion[],
  excluded: ReadonlySet<string>,
  serverLocks: ReadonlyMap<string, 'engine' | 'program'>,
): string[] {
  const byId = new Map(pool.map((q) => [q.id, q]));
  return [...excluded]
    .filter((id) => {
      const q = byId.get(id);
      return q !== undefined && !serverLocks.has(q.code);
    })
    .sort();
}

// ---- Adding a question for ONE program name ------------------------------------------------

/**
 * One row of "Other questions": a question the loan type does NOT ask of every program name,
 * which this name may add for its own applicants.
 */
export interface OtherRow extends AskedRow {
  /** Ticked for this name — it asks the question under this loan type. */
  readonly added: boolean;
  /**
   * Every quote reads it (or a question it needs first), so whether it is asked is the loan
   * type's call, never one name's. Shown, not tickable. From the server's `engine` lock.
   */
  readonly loanTypeWide: boolean;
  /** The other loan types that ask it of every name — what the question is FOR. */
  readonly askedIn: readonly LoanCategory[];
  /** Added, and another added question appears only after an answer to this one. */
  readonly heldByGate: boolean;
}

/** `picks` for one loan type widened by this name's additions — what the board draws as asked. */
export function withAdditions(
  picks: AskedPicks,
  category: LoanCategory,
  added: ReadonlySet<string>,
): AskedPicks {
  if (added.size === 0) return picks;
  const merged = new Map(picks);
  merged.set(category, new Set([...(picks.get(category) ?? []), ...added]));
  return merged;
}

/**
 * What one tick adds: the question, and the gate sources it needs that this name is not asked
 * yet, nearest first — the same chain `pendingAdds` closes for a loan-type-wide tick. Without
 * the sources the question's gate would dangle, and the server shows a dangling gate's target
 * to everybody. The server closes the chain again on save; doing it here too is what lets the
 * board show the sources ticked before anything is written.
 */
export function additionWithChain(
  pool: readonly AskableQuestion[],
  question: AskableQuestion,
  category: LoanCategory,
  picks: AskedPicks,
  added: ReadonlySet<string>,
): string[] {
  return [
    question.id,
    ...gateChainFor(pool, question, category, withAdditions(picks, category, added)).map(
      (q) => q.id,
    ),
  ];
}

/** Added ids another added question branches off — they cannot be unticked before it is. */
export function gateHeldAdditions(
  pool: readonly AskableQuestion[],
  added: ReadonlySet<string>,
): ReadonlySet<string> {
  const byCode = new Map(pool.map((q) => [q.code, q]));
  const held = new Set<string>();
  for (const q of pool) {
    if (!added.has(q.id) || q.gateSourceCode === null) continue;
    const source = byCode.get(q.gateSourceCode);
    if (source !== undefined && added.has(source.id)) held.add(source.id);
  }
  return held;
}

/**
 * The "Other questions" list for one loan type: every live question it does not ask of every
 * name, in pool order — the ones it has never asked and the opt-in rows other names added
 * alike. `hideCodes` are drawn elsewhere (the checklist's own questions). A search narrows it;
 * an empty box lists them all, because this list IS where an extra question is picked from.
 */
export function otherRows(
  pool: readonly AskableQuestion[],
  category: LoanCategory,
  picks: AskedPicks,
  added: ReadonlySet<string>,
  search: string,
  isAr: boolean,
  locks: ReadonlyMap<string, 'engine' | 'program'>,
  hideCodes: ReadonlySet<string>,
): readonly OtherRow[] {
  const needle = search.trim().toLowerCase();
  const drawn = withAdditions(picks, category, added);
  const held = gateHeldAdditions(pool, added);
  const out: OtherRow[] = [];
  for (const q of pool) {
    if (!q.isActive || q.categories.includes(category) || picked(picks, category, q.id)) continue;
    if (hideCodes.has(q.code)) continue;
    if (needle !== '' && !q.haystack.includes(needle)) continue;
    const chain = gateChainFor(pool, q, category, drawn);
    out.push({
      ...rowOf(pool, q, category, drawn, isAr),
      added: added.has(q.id),
      loanTypeWide:
        locks.get(q.code) === 'engine' || chain.some((s) => locks.get(s.code) === 'engine'),
      askedIn: canonicalCategories(q.categories.filter((c) => c !== category)),
      heldByGate: held.has(q.id),
    });
  }
  return out;
}

/**
 * What to save for one loan type: the added ids the pool still holds, sorted — the PUT body.
 * An empty list is a real write ("ask only what the loan type asks"), so the caller decides
 * whether to skip it; on the create flow an empty set has nothing to replace.
 */
export function additionsToSave(
  pool: readonly AskableQuestion[],
  added: ReadonlySet<string>,
): string[] {
  const known = new Set(pool.map((q) => q.id));
  return [...added].filter((id) => known.has(id)).sort();
}
