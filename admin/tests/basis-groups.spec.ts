import { describe, expect, it } from 'vitest';
import { BASIS_GROUP_ORDER, splitByBasis } from '../src/app/features/banks/basis-groups';

const proof = (code: string) => ({ code, programType: 'income_proof' as const });
const surrogate = (code: string) => ({ code, programType: 'income_surrogate' as const });

describe('splitByBasis', () => {
  it('files each program under its own basis', () => {
    const groups = splitByBasis([proof('a'), surrogate('b'), proof('c')]);
    expect(groups.map((g) => g.key)).toEqual(['income_proof', 'income_surrogate']);
    expect(groups[0]?.items.map((p) => p.code)).toEqual(['a', 'c']);
    expect(groups[1]?.items.map((p) => p.code)).toEqual(['b']);
  });

  it('reads income proof first whatever order the rows arrive in', () => {
    expect(splitByBasis([surrogate('b'), proof('a')]).map((g) => g.key)).toEqual([
      'income_proof',
      'income_surrogate',
    ]);
  });

  it('drops a group that holds nothing rather than rendering an empty heading', () => {
    expect(splitByBasis([proof('a')]).map((g) => g.key)).toEqual(['income_proof']);
    expect(splitByBasis([]).length).toBe(0);
  });

  /**
   * The one that matters: `programType` is optional on the wire, and folding an absent
   * value into "Income proof" would state a fact nobody sent.
   */
  it('files an unstated basis under its own group, never under income proof', () => {
    const groups = splitByBasis([proof('a'), { code: 'b' }, { code: 'c', programType: null }]);
    expect(groups.map((g) => g.key)).toEqual(['income_proof', 'unknown']);
    expect(groups[1]?.items.map((p) => p.code)).toEqual(['b', 'c']);
  });

  it('keeps the caller order inside a group', () => {
    const groups = splitByBasis([proof('z'), proof('a'), proof('m')]);
    expect(groups[0]?.items.map((p) => p.code)).toEqual(['z', 'a', 'm']);
  });

  it('never invents a group outside the declared order', () => {
    const keys = splitByBasis([proof('a'), surrogate('b'), { code: 'c' }]).map((g) => g.key);
    expect(keys.every((k) => BASIS_GROUP_ORDER.includes(k))).toBe(true);
  });
});
