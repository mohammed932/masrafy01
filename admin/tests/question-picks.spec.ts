/**
 * THE UNSAVED-PICK LAYER of `/program-catalog/:key` step 3.
 *
 * The two cases that fail silently and look right: a pending edit that reports itself as
 * saved (so the Save bar never appears and the operator walks away believing the ticks
 * landed), and an edit the operator undid by hand that keeps asking to be saved (so the
 * bar offers to write the set the server already holds). Both are set comparisons, which
 * is why they live in a pure module rather than on the page.
 */
import { describe, expect, it } from 'vitest';
import {
  dirtyPickCategories,
  pendingPickChanges,
  pickDiffCount,
  sameCodeSet,
  togglePick,
  type PickDraft,
  type StoredPicks,
} from '../src/app/features/program-catalog/question-picks';

describe('sameCodeSet', () => {
  it('is order-insensitive — membership is the decision, order is not', () => {
    expect(sameCodeSet(['a', 'b'], ['b', 'a'])).toBe(true);
  });

  it('separates a different length', () => {
    expect(sameCodeSet(['a'], ['a', 'b'])).toBe(false);
  });

  it('separates the same length with a different member', () => {
    expect(sameCodeSet(['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('reads two empty sets as equal, which is how a cleared list stays clean', () => {
    expect(sameCodeSet([], [])).toBe(true);
  });
});

describe('togglePick', () => {
  it('appends a fresh pick, so it lands at the end of the set', () => {
    expect(togglePick(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes one already held and leaves the rest in order', () => {
    expect(togglePick(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('pickDiffCount', () => {
  it('counts added plus removed, not the net — a swap is two changes', () => {
    expect(pickDiffCount(['a', 'c'], ['a', 'b'])).toBe(2);
  });

  it('counts a plain addition as one', () => {
    expect(pickDiffCount(['a', 'b'], ['a'])).toBe(1);
  });

  it('counts nothing for a reorder', () => {
    expect(pickDiffCount(['b', 'a'], ['a', 'b'])).toBe(0);
  });
});

describe('dirtyPickCategories', () => {
  const stored: StoredPicks = { personal: ['a', 'b'], car: ['c'] };

  it('reports nothing when no loan type holds a draft', () => {
    expect(dirtyPickCategories({}, stored)).toEqual([]);
  });

  it('reports a loan type whose draft differs', () => {
    expect(dirtyPickCategories({ personal: ['a'] }, stored)).toEqual(['personal']);
  });

  /* The undo case: ticked, then unticked. A draft equal to the saved set is not a
     change, and a bar that offered to save it would be writing what is already there. */
  it('does NOT report a draft that landed back on the saved set', () => {
    expect(dirtyPickCategories({ personal: ['b', 'a'] }, stored)).toEqual([]);
  });

  it('reports a draft that empties a set — clearing a list is a real edit', () => {
    expect(dirtyPickCategories({ car: [] }, stored)).toEqual(['car']);
  });

  it('reports a first pick on a loan type the row holds nothing for', () => {
    expect(dirtyPickCategories({ mortgage: ['x'] }, stored)).toEqual(['mortgage']);
  });

  /* Ordered by the platform's category order, which is also the order the writes go
     out in — so a partial failure is reportable against a list an operator can read. */
  it('returns the platform order, not the order the drafts were made in', () => {
    const draft: PickDraft = { business: ['x'], personal: ['a'] };
    expect(dirtyPickCategories(draft, stored)).toEqual(['personal', 'business']);
  });
});

describe('pendingPickChanges', () => {
  it('adds up every question moved across every loan type', () => {
    const stored: StoredPicks = { personal: ['a', 'b'], car: ['c'] };
    // personal: 'b' removed + 'z' added = 2 · car: cleared = 1.
    expect(pendingPickChanges({ personal: ['a', 'z'], car: [] }, stored)).toBe(3);
  });

  it('is zero when every draft matches the saved set', () => {
    expect(pendingPickChanges({ personal: ['a'] }, { personal: ['a'] })).toBe(0);
  });
});
