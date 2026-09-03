/**
 * How a lookup type's values are split by the class they are filed under — pure, so the
 * ordering, the tabs and the paging can be exercised without a component.
 *
 * The join itself is one equality (`platform_enumeration.parentKey` → the class list's `key`)
 * and it is the most consequential thing about a value on these screens: a bank keys its cap
 * table by the CLASS while the customer picks a value by NAME, and `factParentTable` walks one
 * to the other. Rendered as a per-row badge that was the word "Other" printed 69 times on the
 * real compound list — a column carrying no information, hiding the two rows that differ.
 */
import type { EnumerationRow } from '@features/lookups/lookups.api.service';
import type { RailTabItem } from '@shared/ui/rail-tabs.component';

/**
 * Below this many live values the list is left flat.
 *
 * Splitting five values across four classes is four tabs over one row each — the frame costs
 * more than the thing it frames. Grouping earns its keep the moment scanning does.
 */
export const GROUP_MIN = 12;

/**
 * Cells on one page. SIXTEEN.
 *
 * The list renders as a GRID whose widest breakpoint is four columns, so sixteen fills
 * exactly four rows where ten would leave a ragged half-row of two under two full ones.
 */
export const VALUE_PAGE_SIZE = 16;

/** Reserved group keys. Real class keys are registry slugs, so a `__` prefix cannot collide. */
export const GROUP_ALL = '__all';
export const GROUP_UNFILED = '__none';
export const GROUP_DEPRECATED = '__deprecated';

/** One tab and the rows under it. */
export interface ValueGroup {
  /** Stable, and used verbatim in a DOM id — every class key is already a slug. */
  readonly key: string;
  /** `null` for the single anonymous group, which renders as the plain list. */
  readonly label: string | null;
  readonly rows: readonly EnumerationRow[];
  /** `warn` = these rows are priced by nobody. Carried as the rail's own marker. */
  readonly tone: 'plain' | 'warn';
  readonly isDeprecated: boolean;
}

export interface GroupInput {
  readonly live: readonly EnumerationRow[];
  readonly deprecated: readonly EnumerationRow[];
  /** The class list, in registry order. Empty = this type is filed under nothing. */
  readonly parents: readonly EnumerationRow[];
  /** Renders a class label in the operator's own locale. */
  readonly labelOf: (row: EnumerationRow) => string;
  readonly unfiledLabel: string;
  readonly deprecatedLabel: string;
}

/** Whether there is anything to group BY, and enough rows for it to be worth doing. */
export function shouldGroup(input: Pick<GroupInput, 'live' | 'parents'>): boolean {
  return input.parents.length > 0 && input.live.length >= GROUP_MIN;
}

/**
 * The groups, in the order they render.
 *
 * Warn groups first — a value in no class, and a value under a class that has been retired,
 * are the only rows on this screen that quote nothing, so they are the rows worth putting
 * first. Live classes then follow in REGISTRY order, which is the order the class rail and the
 * class board both use, so the two halves of a product screen agree.
 *
 * Row order INSIDE a group is left exactly as it arrived: `sortOrder` is the order the
 * customer's own picker offers these values in, and re-sorting the screen alphabetically would
 * quietly stop the screen agreeing with the wizard.
 */
export function groupValues(input: GroupInput): readonly ValueGroup[] {
  const dep: readonly ValueGroup[] =
    input.deprecated.length > 0
      ? [
          {
            key: GROUP_DEPRECATED,
            label: input.deprecatedLabel,
            rows: input.deprecated,
            tone: 'plain',
            isDeprecated: true,
          },
        ]
      : [];

  if (!shouldGroup(input)) {
    const live: readonly ValueGroup[] =
      input.live.length > 0
        ? [
            {
              key: GROUP_ALL,
              label: null,
              rows: input.live,
              tone: 'plain',
              isDeprecated: false,
            },
          ]
        : [];
    return [...live, ...dep];
  }

  const byParent = new Map<string, EnumerationRow[]>();
  for (const row of input.live) {
    const k = row.parentKey ?? '';
    const bucket = byParent.get(k);
    if (bucket) bucket.push(row);
    else byParent.set(k, [row]);
  }

  const known = new Set(input.parents.map((p) => p.key));
  const out: ValueGroup[] = [];

  const unfiled = byParent.get('');
  if (unfiled) {
    out.push({
      key: GROUP_UNFILED,
      label: input.unfiledLabel,
      rows: unfiled,
      tone: 'warn',
      isDeprecated: false,
    });
  }
  for (const [key, rows] of byParent) {
    if (key === '' || known.has(key)) continue;
    // A class retired out from under its values. Named by its KEY, because that is all there
    // is left of it, and flagged: `factParentTable` prices these no better than an unfiled one.
    out.push({ key, label: key, rows, tone: 'warn', isDeprecated: false });
  }
  for (const parent of input.parents) {
    const rows = byParent.get(parent.key);
    if (!rows) continue;
    out.push({
      key: parent.key,
      label: input.labelOf(parent),
      rows,
      tone: 'plain',
      isDeprecated: false,
    });
  }
  return [...out, ...dep];
}

export interface ValueTabsInput {
  readonly groups: readonly ValueGroup[];
  /** Live rows in the WHOLE list — what the All tab counts. */
  readonly liveCount: number;
  readonly grouped: boolean;
  readonly allLabel: string;
  /** What the count counts, for a screen reader — the number alone has no unit. */
  readonly countLabel: string;
  /** What the warn marker means, for a screen reader. */
  readonly warnLabel: string;
}

/**
 * The rail, one tab per group.
 *
 * An **All** tab leads it whenever the list is split, and it is not decoration: an operator
 * searching for a compound does not know which class it is filed under, and without it the
 * only way to see the whole list is to read every tab. It reuses `GROUP_ALL` as its id, which
 * cannot collide — `groupValues` emits that key only for the anonymous group, and the
 * anonymous group exists only while the list is NOT split, in which case it simply IS the All
 * tab (its `null` label is given the same word).
 */
export function valueTabs(input: ValueTabsInput): readonly RailTabItem[] {
  const tabs: RailTabItem[] = [];
  if (input.grouped) {
    tabs.push({
      id: GROUP_ALL,
      label: input.allLabel,
      count: input.liveCount,
      countLabel: input.countLabel,
    });
  }
  for (const group of input.groups) {
    const warn = group.tone === 'warn';
    tabs.push({
      id: group.key,
      label: group.label ?? input.allLabel,
      count: group.rows.length,
      countLabel: input.countLabel,
      warn,
      warnLabel: warn ? input.warnLabel : undefined,
    });
  }
  return tabs;
}

/**
 * Which tab is on stage.
 *
 * DERIVED rather than stored, because the rail moves under the operator: filtering empties a
 * class, and a class that matched nothing stops being a tab at all. Falling back to the first
 * tab is what turns that into "the search landed somewhere" instead of an empty panel with a
 * tab still lit for rows that are no longer there.
 */
export function resolveValueTab(
  tabs: readonly RailTabItem[],
  requested: string | null,
): string | null {
  const first = tabs[0];
  if (!first) return null;
  if (requested !== null && tabs.some((tab) => tab.id === requested)) return requested;
  return first.id;
}

/** One page of rows, already narrowed. */
export interface ValuePage<T> {
  readonly rows: readonly T[];
  /** 1-based, already clamped into range. */
  readonly page: number;
  readonly pages: number;
  /** Rows in the whole tab, never the page's own length. */
  readonly total: number;
  /** 1-based range of the page; 0–0 on an empty tab. */
  readonly from: number;
  readonly to: number;
}

/**
 * A tab's page — the requested index CLAMPED rather than trusted.
 *
 * Same contract as `askSectionPage` on the product's ask grid: narrowing the filter while
 * sitting on page 6 must land on the last page that exists, not on an empty list under a pager
 * reading "6 of 3", which is the state a remembered page index reaches on its own with nothing
 * on screen saying why.
 */
export function pageSlice<T>(
  rows: readonly T[],
  requested: number,
  size: number = VALUE_PAGE_SIZE,
): ValuePage<T> {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, Math.floor(requested) || 1), pages);
  const offset = (page - 1) * size;
  const shown = rows.slice(offset, offset + size);
  return {
    rows: shown,
    page,
    pages,
    total,
    from: total === 0 ? 0 : offset + 1,
    to: offset + shown.length,
  };
}
