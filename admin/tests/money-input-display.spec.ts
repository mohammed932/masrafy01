/**
 * The money directive is the ONE value accessor behind every amount field in the admin
 * (A27), and it now serves two kinds of figure: money, which groups its thousands, and a
 * percentage or multiplier, which must not. Before that flag existed each caller forked into
 * a second `<input>` that bypassed `ngModel` entirely, so this branch is new and load-bearing.
 *
 * `money-format.ts` is the pure half — what the field SHOWS for a raw value — split out so
 * these branches are covered without dragging Angular's JIT into a test about formatting.
 */
import { describe, expect, it } from 'vitest';
import { displayValue, formatGroupedNumber } from '../src/app/core/directives/money-format';

describe('money input — what the field shows', () => {
  it('groups money, thousands separated', () => {
    expect(displayValue('2000000', true)).toBe('2,000,000');
    expect(displayValue('15000.50', true)).toBe('15,000.50');
  });

  it('leaves a percentage or a multiplier ungrouped', () => {
    // The whole reason the flag exists: "20" is not twenty pounds, and a grouped 1,000%
    // reads as a figure nobody typed.
    expect(displayValue('20', false)).toBe('20');
    expect(displayValue('1000', false)).toBe('1000');
    expect(displayValue('1.25', false)).toBe('1.25');
  });

  it('canonicalises what the caller typed, either way', () => {
    // Separators and stray characters are stripped before display, so the model never
    // sees them and a pasted "1,000" is not read as one.
    expect(displayValue('1,000', false)).toBe('1000');
    expect(displayValue('EGP 1,000', true)).toBe('1,000');
    expect(displayValue('', true)).toBe('');
    expect(displayValue('', false)).toBe('');
  });

  it('keeps one decimal point at most', () => {
    expect(displayValue('1.2.3', false)).toBe('1.23');
  });

  it('formatGroupedNumber stays the read-only counterpart', () => {
    expect(formatGroupedNumber('20000000.00')).toBe('20,000,000');
    expect(formatGroupedNumber(null)).toBe('');
  });
});
