/**
 * The class-keyed maximum-loan table, on the client.
 *
 * The failure this file exists for shipped and was invisible: `rowVia` was absent from the
 * whole admin bundle, so it survived an edit only by accident — a spread carried it — and
 * clearing the second column, which rebuilds the config by name, silently dropped it. ABK's
 * doctors cap is keyed by three city-tier CLASSES standing in for twenty-seven governorates,
 * so a dropped axis leaves the table matching raw governorate codes, finding no row, and
 * falling through to `onNoMatch` — a million pounds on one applicant, with nothing on screen
 * saying anything changed.
 *
 * The opposite direction matters just as much and arrives with the fix: carrying the axis
 * onto a fact that has no class to walk up to is `via_not_applicable` at save, and the
 * refusal the operator reads never mentions the axis.
 */
import { describe, expect, it } from 'vitest';
import {
  maxLoanByFactErrorFor,
  withColumnFact,
  withRowFact,
} from '../src/app/shared/ui/max-loan-by-fact.rules';
import type { MaxLoanByFactConfig } from '../src/app/shared/ui/max-loan-by-fact.rules';

/** ABK 7's cap: rows are city tiers, columns are new-loan / top-up. */
const CLASS_KEYED: MaxLoanByFactConfig = {
  factKey: 'practice_governorate',
  rowVia: 'parentClass',
  columnFactKey: 'loan_is_topup',
  onNoMatch: 'reject',
  rows: [
    { rowKey: 'city_tier_major', columnKey: 'new_loan', maxAmountEGP: '1500000' },
    { rowKey: 'city_tier_other', columnKey: 'new_loan', maxAmountEGP: '500000' },
  ],
};

/** Governorates and school types are filed under classes; a CD tier is not. */
const CLASSED = (key: string) => key === 'practice_governorate' || key === 'school_type';

describe('withColumnFact', () => {
  it('keeps the class axis when the second column is cleared', () => {
    // The regression. Clearing the column is a statement about the COLUMN; the rows are
    // still keyed by the tier and must stay that way.
    const next = withColumnFact(CLASS_KEYED, null, CLASSED);
    expect(next.rowVia).toBe('parentClass');
    expect(next.columnFactKey).toBeUndefined();
    expect(next.columnVia).toBeUndefined();
  });

  it('drops every row column with the axis, so no row points at a column that is gone', () => {
    const next = withColumnFact(CLASS_KEYED, null, CLASSED);
    expect(next.rows.map((r) => r.columnKey)).toEqual([undefined, undefined]);
    expect(next.rows.map((r) => r.rowKey)).toEqual(['city_tier_major', 'city_tier_other']);
  });

  it('does not carry a class axis onto a new column fact that has no classes', () => {
    const columnClassed: MaxLoanByFactConfig = { ...CLASS_KEYED, columnVia: 'parentClass' };
    expect(withColumnFact(columnClassed, 'school_type', CLASSED).columnVia).toBe('parentClass');
    expect(withColumnFact(columnClassed, 'cd_tier', CLASSED).columnVia).toBeUndefined();
  });
});

describe('withRowFact', () => {
  it('clears the rows, because a key drawn from the other list matches nothing', () => {
    expect(withRowFact(CLASS_KEYED, 'school_type', CLASSED).rows).toEqual([]);
  });

  it('keeps the class axis on a fact that still has classes, and drops it on one that does not', () => {
    expect(withRowFact(CLASS_KEYED, 'school_type', CLASSED).rowVia).toBe('parentClass');
    expect(withRowFact(CLASS_KEYED, 'cd_tier', CLASSED).rowVia).toBeUndefined();
  });

  it('carries the second column and everything else about it', () => {
    const next = withRowFact(CLASS_KEYED, 'school_type', CLASSED);
    expect(next.columnFactKey).toBe('loan_is_topup');
    expect(next.onNoMatch).toBe('reject');
  });
});

describe('maxLoanByFactErrorFor — the class axis', () => {
  it('accepts a class-keyed table on a choice fact', () => {
    expect(maxLoanByFactErrorFor(CLASS_KEYED, false)).toBeNull();
  });

  it('refuses a class axis on a NUMERIC answer, which is filed under nothing', () => {
    const banded: MaxLoanByFactConfig = {
      factKey: 'down_payment',
      rowVia: 'parentClass',
      onNoMatch: 'useProgramMax',
      rows: [{ fromInclusive: '250000', toExclusive: null, maxAmountEGP: '750000' }],
    };
    expect(maxLoanByFactErrorFor(banded, true)).toBe('VIA_NOT_APPLICABLE');
  });

  it('refuses a class axis on a DERIVED axis, which has no registry row at all', () => {
    const derivedRow: MaxLoanByFactConfig = {
      factKey: 'loan_is_topup',
      rowVia: 'parentClass',
      onNoMatch: 'useProgramMax',
      rows: [{ rowKey: 'new_loan', maxAmountEGP: '750000' }],
    };
    expect(maxLoanByFactErrorFor(derivedRow, false, { rowIsDerived: true })).toBe(
      'VIA_NOT_APPLICABLE',
    );
    expect(
      maxLoanByFactErrorFor({ ...CLASS_KEYED, columnVia: 'parentClass' }, false, {
        columnIsDerived: true,
      }),
    ).toBe('VIA_NOT_APPLICABLE');
  });

  it('refuses NOTHING extra while the registry is still loading', () => {
    // The under-refusal guarantee. `isNumericFact` is false before the registry lands and
    // `axes` defaults to "not derived", so a config the server WOULD refuse passes here —
    // deliberately. A mirror that hardened would tell the operator their figures are
    // unsavable with nothing on screen to fix, which is what `productRuleHasError` shipped
    // with. Same config, same call, no third argument:
    const derivedRow: MaxLoanByFactConfig = {
      factKey: 'loan_is_topup',
      rowVia: 'parentClass',
      onNoMatch: 'useProgramMax',
      rows: [{ rowKey: 'new_loan', maxAmountEGP: '750000' }],
    };
    expect(maxLoanByFactErrorFor(derivedRow, false)).toBeNull();
    expect(maxLoanByFactErrorFor(CLASS_KEYED, false)).toBeNull();
  });

  it('leaves a table with no axis stated exactly as it was', () => {
    const plain: MaxLoanByFactConfig = {
      factKey: 'property_type',
      onNoMatch: 'useProgramMax',
      rows: [{ rowKey: 'villa', maxAmountEGP: '4000000' }],
    };
    expect(maxLoanByFactErrorFor(plain, false)).toBeNull();
    expect(withColumnFact(plain, null, CLASSED).rowVia).toBeUndefined();
  });
});
