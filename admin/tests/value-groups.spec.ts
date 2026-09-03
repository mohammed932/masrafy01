/**
 * How a lookup type's values are split by the class they are filed under, turned into tabs,
 * and paged.
 *
 * The cases worth writing are the ones that fail SILENTLY on the real data. The compound list
 * is 69 values in the catch-all class and 2 in another: an implementation that orders groups by
 * class registry order alone buries the values that no bank can price at all, one that drops
 * the All tab makes a value unfindable unless the operator already knows its class, and one
 * that trusts a remembered page index renders an empty list under a pager reading "6 of 3".
 */
import { describe, expect, it } from 'vitest';
import type { EnumerationRow } from '../src/app/features/lookups/lookups.api.service';
import {
  GROUP_ALL,
  GROUP_DEPRECATED,
  GROUP_MIN,
  GROUP_UNFILED,
  VALUE_PAGE_SIZE,
  groupValues,
  pageSlice,
  resolveValueTab,
  shouldGroup,
  valueTabs,
} from '../src/app/shared/lookups/value-groups';

function row(key: string, parentKey: string | null, over: Partial<EnumerationRow> = {}) {
  return {
    id: 'id-' + key,
    type: 'compound',
    key,
    labelEn: key.toUpperCase(),
    labelAr: 'ع-' + key,
    parentKey,
    sortOrder: 0,
    active: true,
    systemOnly: false,
    deprecatedAt: null,
    ...over,
  } as unknown as EnumerationRow;
}

function cls(key: string) {
  return row(key, null, { type: 'compound_category' });
}

const labelOf = (r: EnumerationRow) => r.labelEn;

function input(
  live: readonly EnumerationRow[],
  parents: readonly EnumerationRow[],
  dep: readonly EnumerationRow[] = [],
) {
  return {
    live,
    deprecated: dep,
    parents,
    labelOf,
    unfiledLabel: 'In no class',
    deprecatedLabel: 'Deprecated',
  };
}

const many = (n: number, parentKey: string | null, prefix = 'v') =>
  Array.from({ length: n }, (_, i) => row(`${prefix}${i}`, parentKey));

describe('shouldGroup', () => {
  it('leaves a short list flat even when it has classes', () => {
    expect(shouldGroup({ live: many(GROUP_MIN - 1, 'a'), parents: [cls('a')] })).toBe(false);
  });

  it('leaves a list with nothing to group by flat at any size', () => {
    expect(shouldGroup({ live: many(500, null), parents: [] })).toBe(false);
  });

  it('groups once the list is long enough to need scanning', () => {
    expect(shouldGroup({ live: many(GROUP_MIN, 'a'), parents: [cls('a')] })).toBe(true);
  });
});

describe('groupValues', () => {
  it('renders one anonymous group when it is not grouping — the plain list', () => {
    const groups = groupValues(input(many(3, 'a'), []));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe(GROUP_ALL);
    expect(groups[0]!.label).toBeNull();
  });

  it('emits nothing for a list with no values at all', () => {
    expect(groupValues(input([], [cls('a')]))).toEqual([]);
  });

  it('puts the unfiled values first — they are the only ones nobody can price', () => {
    const live = [...many(20, 'tier_a', 'filed'), ...many(2, null, 'loose')];
    const groups = groupValues(input(live, [cls('tier_a')]));
    expect(groups.map((g) => g.key)).toEqual([GROUP_UNFILED, 'tier_a']);
    expect(groups[0]!.tone).toBe('warn');
    expect(groups[1]!.tone).toBe('plain');
  });

  it('flags a class that was retired out from under its values, and names it by key', () => {
    const live = [...many(20, 'tier_a', 'filed'), row('orphan', 'tier_gone')];
    const groups = groupValues(input(live, [cls('tier_a')]));
    expect(groups.map((g) => g.key)).toEqual(['tier_gone', 'tier_a']);
    // The key IS the label: it is all that is left of the class, and blanking it would hide
    // exactly the rows that quote nothing.
    expect(groups[0]!.label).toBe('tier_gone');
    expect(groups[0]!.tone).toBe('warn');
  });

  it('follows the class list in registry order, not the order values happen to arrive in', () => {
    const live = [...many(6, 'tier_c'), ...many(6, 'tier_a'), ...many(6, 'tier_b')];
    const groups = groupValues(input(live, [cls('tier_a'), cls('tier_b'), cls('tier_c')]));
    expect(groups.map((g) => g.key)).toEqual(['tier_a', 'tier_b', 'tier_c']);
  });

  it('drops a class no value reaches rather than printing an empty heading', () => {
    const groups = groupValues(input(many(12, 'tier_a'), [cls('tier_a'), cls('tier_b')]));
    expect(groups.map((g) => g.key)).toEqual(['tier_a']);
  });

  it('keeps the incoming row order inside a group — it is the customer picker order', () => {
    const live = [row('zed', 'tier_a'), row('alpha', 'tier_a'), ...many(12, 'tier_a')];
    const groups = groupValues(input(live, [cls('tier_a')]));
    expect(groups[0]!.rows.slice(0, 2).map((r) => r.key)).toEqual(['zed', 'alpha']);
  });

  it('renders the class label through the caller, so an Arabic operator reads Arabic', () => {
    const groups = groupValues({
      ...input(many(12, 'tier_a'), [cls('tier_a')]),
      labelOf: (r) => r.labelAr,
    });
    expect(groups[0]!.label).toBe('ع-tier_a');
  });

  it('always puts deprecated rows in their own last group, grouped or not', () => {
    const dep = [row('old', 'tier_a', { deprecatedAt: '2026-01-01' })];
    const flat = groupValues(input(many(2, 'tier_a'), [cls('tier_a')], dep));
    expect(flat.map((g) => g.key)).toEqual([GROUP_ALL, GROUP_DEPRECATED]);
    const grouped = groupValues(input(many(12, 'tier_a'), [cls('tier_a')], dep));
    expect(grouped.map((g) => g.key)).toEqual(['tier_a', GROUP_DEPRECATED]);
    expect(grouped.at(-1)!.isDeprecated).toBe(true);
  });
});

function tabsOf(
  live: readonly EnumerationRow[],
  parents: readonly EnumerationRow[],
  dep: readonly EnumerationRow[] = [],
) {
  const grouped = shouldGroup({ live, parents });
  return valueTabs({
    groups: groupValues(input(live, grouped ? parents : [], dep)),
    liveCount: live.length,
    grouped,
    allLabel: 'All',
    countLabel: 'values',
    warnLabel: 'No bank can price these',
  });
}

describe('valueTabs', () => {
  it('leads a split list with All, counting every live row', () => {
    // The real shape: 69 in the catch-all, 2 in another class.
    const live = [...many(69, 'tier_other', 'o'), ...many(2, 'tier_aa', 'a')];
    const tabs = tabsOf(live, [cls('tier_aa'), cls('tier_other')]);
    expect(tabs.map((t) => t.id)).toEqual([GROUP_ALL, 'tier_aa', 'tier_other']);
    expect(tabs[0]!.count).toBe(71);
    expect(tabs[1]!.count).toBe(2);
    expect(tabs[2]!.count).toBe(69);
  });

  it('turns the anonymous group INTO the All tab when the list is not split', () => {
    const tabs = tabsOf(many(3, 'tier_a'), [cls('tier_a')]);
    // One tab, not two: an All tab in front of an anonymous group would be the same rows
    // offered twice under two names.
    expect(tabs.map((t) => t.id)).toEqual([GROUP_ALL]);
    expect(tabs[0]!.label).toBe('All');
    expect(tabs[0]!.count).toBe(3);
  });

  it('marks the tabs whose rows nobody can price, and only those', () => {
    const live = [...many(20, 'tier_a', 'filed'), ...many(2, null, 'loose')];
    const tabs = tabsOf(live, [cls('tier_a')]);
    expect(tabs.map((t) => t.id)).toEqual([GROUP_ALL, GROUP_UNFILED, 'tier_a']);
    expect(tabs[1]!.warn).toBe(true);
    expect(tabs[1]!.warnLabel).toBe('No bank can price these');
    expect(tabs[2]!.warn).toBe(false);
    expect(tabs[2]!.warnLabel).toBeUndefined();
  });

  it('keeps deprecated last, and out of the All count', () => {
    const dep = [row('old', 'tier_a', { deprecatedAt: '2026-01-01' })];
    const live = many(12, 'tier_a');
    const tabs = tabsOf(live, [cls('tier_a')], dep);
    expect(tabs.map((t) => t.id)).toEqual([GROUP_ALL, 'tier_a', GROUP_DEPRECATED]);
    expect(tabs[0]!.count).toBe(12);
    expect(tabs.at(-1)!.count).toBe(1);
  });

  it('names the count for a screen reader — a bare number has no unit', () => {
    const tabs = tabsOf(many(3, null), []);
    expect(tabs[0]!.countLabel).toBe('values');
  });

  it('emits no rail at all for a list with no values', () => {
    expect(tabsOf([], [cls('tier_a')])).toEqual([]);
  });
});

describe('resolveValueTab', () => {
  const tabs = tabsOf(
    [...many(20, 'tier_a', 'filed'), ...many(2, 'tier_b', 'other')],
    [cls('tier_a'), cls('tier_b')],
  );

  it('keeps the tab the operator picked while it still exists', () => {
    expect(resolveValueTab(tabs, 'tier_b')).toBe('tier_b');
  });

  it('falls back to the first tab when the pick filtered away', () => {
    // What a search does: the class the operator was in matches nothing, so its tab is gone.
    expect(resolveValueTab(tabs, 'tier_gone')).toBe(GROUP_ALL);
  });

  it('lands on the first tab before anything is picked', () => {
    expect(resolveValueTab(tabs, null)).toBe(GROUP_ALL);
  });

  it('answers null for an empty rail rather than inventing a tab', () => {
    expect(resolveValueTab([], 'tier_a')).toBeNull();
  });
});

describe('pageSlice', () => {
  const rows = many(25, 'tier_a');

  it('cuts the list into pages of the house size', () => {
    const first = pageSlice(rows, 1);
    expect(VALUE_PAGE_SIZE).toBe(16);
    expect(first.rows).toHaveLength(16);
    expect(first.pages).toBe(2);
    expect(first.total).toBe(25);
    expect([first.from, first.to]).toEqual([1, 16]);
  });

  it('reports the real range on a partial last page', () => {
    const last = pageSlice(rows, 2);
    expect(last.rows).toHaveLength(9);
    expect([last.from, last.to]).toEqual([17, 25]);
  });

  it('clamps a page past the end instead of rendering nothing', () => {
    // The state a remembered page index reaches on its own once a filter narrows the tab.
    const clamped = pageSlice(rows, 9);
    expect(clamped.page).toBe(2);
    expect(clamped.rows).toHaveLength(9);
  });

  it('clamps a page below the first, and a page that is not a number at all', () => {
    expect(pageSlice(rows, 0).page).toBe(1);
    expect(pageSlice(rows, -4).page).toBe(1);
    expect(pageSlice(rows, Number.NaN).page).toBe(1);
  });

  it('reports one page for a list that fits, and 0–0 for no rows', () => {
    expect(pageSlice(many(4, null), 1).pages).toBe(1);
    const none = pageSlice([], 1);
    expect(none.pages).toBe(1);
    expect([none.from, none.to]).toEqual([0, 0]);
  });
});
