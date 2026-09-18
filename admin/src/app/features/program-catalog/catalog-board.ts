/**
 * What the program-catalog board renders, derived from the two lists it loads.
 *
 * PURE — no Angular, no `$localize`, no HTTP. Everything here is a join or a count, and all
 * of it used to live as private methods on a 1 300-line component where none of it could be
 * exercised. The one thing the board gets structurally wrong is silent (a name reachable
 * from no card at all), so it is the thing worth a test.
 *
 * THE SHAPE, and why it is not one flat list. A catalog NAME is what a bank sells; a
 * surrogate PRODUCT is how the income is worked out when there is no payslip. They are
 * different objects that frequently share a key — `compound_owner` is both — so a merged
 * grid prints that key twice and every operator reads it as a duplicate. Products are
 * CONTAINERS of names here: a product card lists the names that take their calculation from
 * it, and each of those is a link.
 *
 * THE HOLE THAT SHAPE OPENS, and why `unlinked` exists. A name may carry `no_payslip` and
 * link to no product (`surrogateProductKey === null`) — it states its own rule, or it states
 * nothing. Rendered only inside product cards, those names would be reachable from NOWHERE.
 * They get their own group, and `hasOwnIncomeRule` is what lets it say which of the two
 * states each one is in — "states its own calculation" quotes fine, "neither" quotes
 * nothing at all and is the row somebody has to fix.
 */
import type { IncomeBasis } from '@core/income-basis';
import { LOAN_CATEGORIES, canonicalCategories, type LoanCategory } from '@core/loan-category';
import type { EnumerationRow } from '@features/lookups/lookups.api.service';
import type { SurrogateProductSummary } from '@features/bank-programs/bank-programs.types';

/**
 * The board's facet — one of the two bases, and nothing else.
 *
 * There is no `all`. The two chips hold DIFFERENT OBJECTS (catalog names on one side,
 * the calculations a no-payslip name quotes off on the other), so an "all" view was one
 * unheaded run of mixed cards that changed shape halfway down and needed its own pair of
 * headings to be readable at all. Two states, one control, one kind of card on stage.
 */
export type BasisFilter = IncomeBasis;

/**
 * The loan-category facet inside the no-payslip panel — which product of the four kinds of
 * loan a calculation is sold under. `'all'` shows every card regardless.
 *
 * A CALCULATION carries no loan-type column of its own — that axis lives on the catalog
 * NAMES that sell it (`bank_program`'s own category, via the name's `categories`
 * assignment), because one calculation is routinely sold under several names in several
 * categories (the compound guarantee sells under Personal, Car and Mortgage at once). So a
 * product's category set is DERIVED, the union of every name selling it, never stored.
 */
export type CategoryFilter = LoanCategory | 'all';

/** One surrogate product, with the names that sell it resolved. */
export interface ProductCard {
  readonly product: SurrogateProductSummary;
  /** Catalog names taking their calculation from it, in board order. */
  readonly names: readonly EnumerationRow[];
  /**
   * Loan categories this calculation is sold under — the union of every selling name's own
   * `categories`, in canonical order. Empty when nothing sells it yet, or when every name
   * selling it is parked (offered under no loan type).
   */
  readonly categories: readonly LoanCategory[];
  /**
   * Linked name keys with no row on this board.
   *
   * Kept rather than dropped: the link is stored on the NAME, so a key with no row means a
   * name was deleted while something still pointed at it. Silently rendering N-1 chips
   * would hide exactly that.
   */
  readonly orphanNameKeys: readonly string[];
  /** Bank programs reachable through those names. */
  readonly programs: number;
  /** Of those, how many are sold surrogate with no table entered — the actionable count. */
  readonly missingTables: number;
  /**
   * Programs that cap their maximum by an answer this product asks for.
   *
   * A SECOND way in, and the only one that reaches a cap-only product. Three of the eleven
   * predefined products guess no income at all — each bank states the maximum it lends
   * against one answer — so no catalog name may link to them and `programs` above is
   * structurally zero for them. Counting only that read three live products as used by
   * nobody while three banks quoted a cap from them.
   *
   * Kept SEPARATE from `programs` rather than added into it: the two answer different
   * questions ("what quotes off this calculation?" and "what caps by this answer?"), one
   * program can legitimately be both, and a single total would say which of the two neither.
   */
  readonly capPrograms: number;
}

/** Why a surrogate name is on the board on its own rather than inside a product card. */
export type UnlinkedState =
  /** It states a calculation of its own. Legacy, but it quotes. */
  | 'own_rule'
  /** It links to no product and states no rule: it quotes nothing at all. */
  | 'nothing';

export interface UnlinkedName {
  readonly row: EnumerationRow;
  readonly state: UnlinkedState;
  /** The row's own `categories`, canonically ordered — see `ProductCard.categories`. */
  readonly categories: readonly LoanCategory[];
}

export interface CatalogBoard {
  /** Names sold against a payslip under at least one loan type they are offered under. */
  readonly proofNames: readonly EnumerationRow[];
  /** Product cards, already narrowed to `category` when one was passed. */
  readonly products: readonly ProductCard[];
  /** Unlinked names, already narrowed to `category` when one was passed. */
  readonly unlinked: readonly UnlinkedName[];
  readonly deprecated: readonly EnumerationRow[];
  /**
   * Chip counts, taken AFTER search — the chips count what the search has left, which is
   * what makes "Surrogate 0" readable as "nothing here matches" rather than as "there are
   * none".
   *
   * The two may overlap in NAMES but never in CARDS: a name sold both ways is one proof
   * card plus one chip inside somebody's product card, so nothing is counted twice.
   */
  readonly counts: Readonly<Record<BasisFilter, number>>;
  /**
   * How many no-payslip cards (product cards + unlinked names) carry each loan category,
   * taken after search but BEFORE the `category` facet — the same "count what search left"
   * rule `counts` follows, so "Auto Loan 0" reads as "nothing here matches" rather than
   * "there is no such category". `all` is the un-narrowed total, i.e. `counts.no_payslip`.
   *
   * A card with NO category (nothing selling it is assigned a loan type yet) is counted in
   * `all` and in none of the four — it is real, but no chip claims it, which is why `all`
   * can exceed the sum of the four.
   */
  readonly categoryCounts: Readonly<Record<CategoryFilter, number>>;
}

export interface BuildBoardInput {
  readonly names: readonly EnumerationRow[];
  readonly products: readonly SurrogateProductSummary[];
  /** Raw search box text; empty or blank means no filter. */
  readonly search: string;
  /**
   * Narrow the no-payslip panel to one loan category. `'all'` or omitted = every card.
   * Payslip names and the deprecated tail are unaffected — the facet only makes sense
   * where the board renders CALCULATIONS, which are sold under several categories at once.
   */
  readonly category?: CategoryFilter;
  /** Which locale's label the search matches against first. Both are always searched. */
  readonly isAr: boolean;
}

/**
 * Every basis a name carries, across the loan types it is offered under.
 *
 * Moved here verbatim from the board component, fallback and all. That fallback is the
 * load-bearing half: the basis rides on the (name, loan type) assignment row, and a name
 * offered under NO loan type has none — which is every name on the day it is created, since
 * a create now assigns no category. So the answer the operator gave on the create form is
 * not readable from the assignments at all.
 *
 * The product LINK is where that answer survives, and it is the same thing the server infers
 * from when the first assignment row is born (`bornBasisFlags`) — so the board says what the
 * name will BE, rather than contradicting it. Read from the link, not re-derived: one rule,
 * two readers.
 */
export function basesOf(row: EnumerationRow): readonly IncomeBasis[] {
  const byCategory = row.incomeBasesByCategory;
  const bases = byCategory
    ? (row.categories ?? []).flatMap((c) => byCategory[c] ?? [])
    : ([] as IncomeBasis[]);
  if (bases.length > 0) return [...new Set(bases)];
  return [row.surrogateProductKey ? 'no_payslip' : 'payslip'];
}

export function isPayslip(row: EnumerationRow): boolean {
  return basesOf(row).includes('payslip');
}

export function isNoPayslip(row: EnumerationRow): boolean {
  return basesOf(row).includes('no_payslip');
}

/** Search is over both locales plus the key — an operator may know a name by any of them. */
function nameMatches(row: EnumerationRow, q: string): boolean {
  return (
    row.labelEn.toLowerCase().includes(q) ||
    row.labelAr.toLowerCase().includes(q) ||
    row.key.toLowerCase().includes(q)
  );
}

function productMatches(p: SurrogateProductSummary, q: string): boolean {
  return (
    p.labelEn.toLowerCase().includes(q) ||
    p.labelAr.toLowerCase().includes(q) ||
    p.key.toLowerCase().includes(q)
  );
}

/**
 * The order the product cards are read in — by the NAME on the card, in the locale the
 * operator is reading.
 *
 * The wire order is the repository's `orderBy: [{ sortOrder }, { key }]`, and every product
 * row is seeded with `sortOrder = 0`, so what actually reached the grid was alphabetical by
 * the INTERNAL KEY. Nothing on screen shows a key, so the grid read as unsorted: "University
 * Professors" (`academic_rank_table`) came first and the doctors card, then keyed
 * `years_in_practice_bands`, came eleventh and below the fold — which is how a product that is
 * fully configured and live gets reported as missing.
 *
 * Sorted HERE rather than in the query because the key to sort on is the one being rendered,
 * and which of the two labels that is depends on the locale — a `labelEn` sort puts the
 * Arabic board in an order its own words do not explain. Nothing deliberate is discarded:
 * `sortOrder` is not on this payload and is zero on every row the seed writes, so there is no
 * operator-chosen order to preserve. `localeCompare` with `numeric` so a name ending in a
 * figure sorts 2 before 10.
 */
function byLabel(isAr: boolean): (a: ProductCard, b: ProductCard) => number {
  const label = (c: ProductCard): string => (isAr ? c.product.labelAr : c.product.labelEn);
  return (a, b) =>
    label(a).localeCompare(label(b), isAr ? 'ar' : 'en', { numeric: true, sensitivity: 'base' });
}

/** A row's own `categories`, canonically ordered. Absent/empty reads as "offered nowhere". */
function rowCategories(row: EnumerationRow): readonly LoanCategory[] {
  return canonicalCategories(row.categories ?? []);
}

/** A product's category set: the union of every selling name's own categories. */
function cardCategories(names: readonly EnumerationRow[]): readonly LoanCategory[] {
  return canonicalCategories(names.flatMap(rowCategories));
}

function matchesCategory(
  categories: readonly LoanCategory[],
  filter: CategoryFilter,
): boolean {
  return filter === 'all' || categories.includes(filter);
}

export function buildBoard(input: BuildBoardInput): CatalogBoard {
  const q = input.search.trim().toLowerCase();
  const categoryFilter: CategoryFilter = input.category ?? 'all';

  // Resolved from EVERY row, deprecated ones included: a deprecated name still linked to a
  // product is still quoting through it, and a card that quietly drops it would answer "what
  // uses this?" with a number that is too small.
  const byKey = new Map(input.names.map((r) => [r.key, r]));

  const live = input.names.filter((r) => !r.deprecatedAt);
  const liveMatching = q ? live.filter((r) => nameMatches(r, q)) : live;

  const proofNames = liveMatching.filter(isPayslip);

  const cards: ProductCard[] = input.products.map((product) => {
    const names: EnumerationRow[] = [];
    const orphanNameKeys: string[] = [];
    for (const key of product.usedBy) {
      const row = byKey.get(key);
      if (row) names.push(row);
      else orphanNameKeys.push(key);
    }
    return {
      product,
      names,
      orphanNameKeys,
      categories: cardCategories(names),
      // Summed over the names, because a program is filed under a NAME and reaches the
      // product through it. Banks are deliberately NOT summed: one bank selling two names
      // under the same product would be counted twice, and there is no per-bank identity on
      // this payload to de-duplicate against.
      programs: names.reduce((n, r) => n + (r.usage?.programs ?? 0), 0),
      missingTables: names.reduce((n, r) => n + (r.usage?.noPayslipProgramsWithoutTable ?? 0), 0),
      capPrograms: product.capPrograms?.length ?? 0,
    };
  });

  // A product matches the search on its own name OR on any name that sells it — searching
  // "Doctor" should find the calculation Doctor Loans quotes from, which is not called that.
  //
  // Kept as the SEARCHED-but-not-category-narrowed set: it is what `categoryCounts` below is
  // taken from, so a chip counts what the search left rather than what the previous chip
  // pick also excluded — the same "count what search left" rule `counts` already follows.
  const searchedProducts = (
    q
      ? cards.filter((c) => productMatches(c.product, q) || c.names.some((r) => nameMatches(r, q)))
      : cards
  ).sort(byLabel(input.isAr));

  const linked = new Set(input.products.flatMap((p) => p.usedBy));
  const searchedUnlinked: UnlinkedName[] = liveMatching
    .filter((r) => isNoPayslip(r) && !linked.has(r.key))
    .map((row) => ({
      row,
      // `hasOwnIncomeRule` is optional on the wire so the bundle still runs against a backend
      // that predates it. Absent reads as `own_rule` — the state that needs no action —
      // because inventing a "quotes nothing" warning from a field that simply was not sent
      // would send an operator to fix a name that is fine.
      state: row.hasOwnIncomeRule === false ? 'nothing' : 'own_rule',
      categories: rowCategories(row),
    }));

  const products = searchedProducts.filter((c) => matchesCategory(c.categories, categoryFilter));
  const unlinked = searchedUnlinked.filter((u) => matchesCategory(u.categories, categoryFilter));

  const deprecated = q
    ? input.names.filter((r) => r.deprecatedAt && nameMatches(r, q))
    : input.names.filter((r) => r.deprecatedAt);

  const payslip = proofNames.length;
  const noPayslip = searchedProducts.length;

  const categoryCounts = { all: noPayslip } as Record<CategoryFilter, number>;
  for (const cat of LOAN_CATEGORIES) {
    categoryCounts[cat] = searchedProducts.filter((c) => c.categories.includes(cat)).length;
  }

  return {
    proofNames,
    products,
    unlinked,
    deprecated,
    counts: { payslip, no_payslip: noPayslip },
    categoryCounts,
  };
}
