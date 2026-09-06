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
  capCellsOf,
  capConfigFrom,
  capGridFrom,
  capShapeConflict,
  maxLoanByFactErrorFor,
  missingCapCells,
  withColumnFact,
  withRowFact,
} from '../src/app/shared/ui/max-loan-by-fact.rules';
import type {
  MaxLoanByFactConfig,
  ProductCapShape,
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

/**
 * THE PRODUCT'S DECLARED GRID.
 *
 * The shape below is `compound_owner`'s, copied from
 * `backend/src/bank-programs/blueprints/product-blueprints.ts:619-630`, and the stored table
 * is ABK's, copied from `demo-figures/sheet-programs.ts:673-684`. Both are real: the point of
 * these tests is that the projection between them is exact, because the two are joined by
 * string equality on a cell id and a mismatch is silent — a figure that stops being rendered
 * while the engine goes on reading it.
 *
 * The `twin_house` case is the trap `sheet-figures.ts:25-30` writes up: a cap row is matched
 * against the OPTION CODE the applicant picked, and the same unit type is `twin_or_town_house`
 * in the question and `twin_house` in the list the question mirrors. A row keyed the second
 * way matches nobody, so it must stay visible and editable, not vanish into a grid that then
 * reads as complete.
 */
const COMPOUND_SHAPE: ProductCapShape = {
  factKey: 'owned_unit_type',
  columnFactKey: 'loan_is_topup',
  onNoMatch: 'useProgramMax',
  rowKeys: ['apartment', 'twin_or_town_house', 'villa'],
  columnKeys: ['new_loan', 'top_up'],
};

const ABK_STORED: MaxLoanByFactConfig = {
  factKey: 'owned_unit_type',
  columnFactKey: 'loan_is_topup',
  onNoMatch: 'useProgramMax',
  rows: [
    { rowKey: 'apartment', columnKey: 'new_loan', maxAmountEGP: '2000000' },
    { rowKey: 'apartment', columnKey: 'top_up', maxAmountEGP: '3000000' },
    { rowKey: 'twin_or_town_house', columnKey: 'new_loan', maxAmountEGP: '3000000' },
    { rowKey: 'twin_or_town_house', columnKey: 'top_up', maxAmountEGP: '3500000' },
    { rowKey: 'villa', columnKey: 'new_loan', maxAmountEGP: '4000000' },
    { rowKey: 'villa', columnKey: 'top_up', maxAmountEGP: '4500000' },
  ],
};

/** The CDs product bands its rows instead of keying them. */
const BANDED_SHAPE: ProductCapShape = {
  factKey: 'pledged_collateral_value',
  onNoMatch: 'useProgramMax',
  bands: [
    { fromInclusive: '0', toExclusive: '2000000' },
    { fromInclusive: '2000000', toExclusive: '5000000' },
    { fromInclusive: '5000000', toExclusive: null },
  ],
};

describe('capCellsOf', () => {
  it('lays the compound grid out row-major, in declared order', () => {
    expect(capCellsOf(COMPOUND_SHAPE)).toEqual([
      { rowKey: 'apartment', columnKey: 'new_loan' },
      { rowKey: 'apartment', columnKey: 'top_up' },
      { rowKey: 'twin_or_town_house', columnKey: 'new_loan' },
      { rowKey: 'twin_or_town_house', columnKey: 'top_up' },
      { rowKey: 'villa', columnKey: 'new_loan' },
      { rowKey: 'villa', columnKey: 'top_up' },
    ]);
  });

  it('gives a one-column shape one cell per row, with no columnKey at all', () => {
    expect(
      capCellsOf({ ...COMPOUND_SHAPE, columnFactKey: undefined, columnKeys: undefined }),
    ).toEqual([{ rowKey: 'apartment' }, { rowKey: 'twin_or_town_house' }, { rowKey: 'villa' }]);
  });

  it('carries band edges, open end included', () => {
    expect(capCellsOf(BANDED_SHAPE)).toEqual([
      { fromInclusive: '0', toExclusive: '2000000' },
      { fromInclusive: '2000000', toExclusive: '5000000' },
      { fromInclusive: '5000000', toExclusive: null },
    ]);
  });

  it('declares nothing when the shape names no rows', () => {
    expect(capCellsOf({ factKey: 'x', onNoMatch: 'reject' })).toEqual([]);
  });
});

describe('capGridFrom', () => {
  it("maps ABK's six onto the six declared cells, nothing unlisted", () => {
    const grid = capGridFrom(COMPOUND_SHAPE, ABK_STORED);
    expect(grid.declared.map((entry) => entry.amount)).toEqual([
      '2000000',
      '3000000',
      '3000000',
      '3500000',
      '4000000',
      '4500000',
    ]);
    expect(grid.unlisted).toEqual([]);
  });

  it('keeps a row the grid does not declare, rather than hiding it', () => {
    const withOrphan: MaxLoanByFactConfig = {
      ...ABK_STORED,
      rows: [
        ...ABK_STORED.rows,
        { rowKey: 'twin_house', columnKey: 'new_loan', maxAmountEGP: '9000000' },
      ],
    };
    const grid = capGridFrom(COMPOUND_SHAPE, withOrphan);
    expect(grid.declared).toHaveLength(6);
    expect(grid.unlisted).toEqual([
      { rowKey: 'twin_house', columnKey: 'new_loan', maxAmountEGP: '9000000' },
    ]);
  });

  it("falls back to the product's default only where this bank stored nothing", () => {
    const partial: MaxLoanByFactConfig = {
      ...ABK_STORED,
      rows: [{ rowKey: 'villa', columnKey: 'top_up', maxAmountEGP: '9999999' }],
    };
    const defaults = ABK_STORED.rows;
    const grid = capGridFrom(COMPOUND_SHAPE, partial, defaults);
    expect(grid.declared[0]?.amount).toBe('2000000');
    expect(grid.declared[5]?.amount).toBe('9999999');
  });

  it('a program with no table at all opens on the product defaults', () => {
    const grid = capGridFrom(COMPOUND_SHAPE, null, ABK_STORED.rows);
    expect(grid.declared.map((entry) => entry.amount)).toEqual([
      '2000000',
      '3000000',
      '3000000',
      '3500000',
      '4000000',
      '4500000',
    ]);
  });
});

describe('capConfigFrom', () => {
  it("round-trips ABK's table byte-for-byte", () => {
    const grid = capGridFrom(COMPOUND_SHAPE, ABK_STORED);
    expect(capConfigFrom(COMPOUND_SHAPE, grid, ABK_STORED.onNoMatch)).toEqual(ABK_STORED);
  });

  it('a blank grid stores NOTHING, so a program with no cap saves unchanged', () => {
    const grid = capGridFrom(COMPOUND_SHAPE, null);
    expect(capConfigFrom(COMPOUND_SHAPE, grid, 'useProgramMax')).toBeNull();
  });

  it('one typed box is one row', () => {
    const grid = capGridFrom(COMPOUND_SHAPE, null);
    const typed = {
      ...grid,
      declared: grid.declared.map((entry, index) =>
        index === 2 ? { ...entry, amount: '3000000' } : entry,
      ),
    };
    expect(capConfigFrom(COMPOUND_SHAPE, typed, 'useProgramMax')?.rows).toEqual([
      { rowKey: 'twin_or_town_house', columnKey: 'new_loan', maxAmountEGP: '3000000' },
    ]);
  });

  it('clearing one box drops that row and leaves the others', () => {
    const grid = capGridFrom(COMPOUND_SHAPE, ABK_STORED);
    const cleared = {
      ...grid,
      declared: grid.declared.map((entry, index) =>
        index === 0 ? { ...entry, amount: '' } : entry,
      ),
    };
    const next = capConfigFrom(COMPOUND_SHAPE, cleared, 'useProgramMax');
    expect(next?.rows).toHaveLength(5);
    expect(next?.rows[0]).toEqual({
      rowKey: 'apartment',
      columnKey: 'top_up',
      maxAmountEGP: '3000000',
    });
  });

  it('carries an unlisted row through, so it is never dropped by a save', () => {
    const withOrphan: MaxLoanByFactConfig = {
      ...ABK_STORED,
      rows: [
        ...ABK_STORED.rows,
        { rowKey: 'twin_house', columnKey: 'new_loan', maxAmountEGP: '9000000' },
      ],
    };
    const grid = capGridFrom(COMPOUND_SHAPE, withOrphan);
    expect(capConfigFrom(COMPOUND_SHAPE, grid, 'useProgramMax')?.rows).toHaveLength(7);
  });

  it("keeps the bank's onNoMatch, not the product's", () => {
    const grid = capGridFrom(COMPOUND_SHAPE, ABK_STORED);
    expect(capConfigFrom(COMPOUND_SHAPE, grid, 'reject')?.onNoMatch).toBe('reject');
  });
});

describe('capShapeConflict', () => {
  it('is false for a table keyed the way the product declares', () => {
    expect(capShapeConflict(COMPOUND_SHAPE, ABK_STORED)).toBe(false);
  });

  it('is false when there is no table yet', () => {
    expect(capShapeConflict(COMPOUND_SHAPE, null)).toBe(false);
  });

  it('is true for a legacy table keyed by another fact', () => {
    expect(capShapeConflict(COMPOUND_SHAPE, { ...ABK_STORED, factKey: 'school_type' })).toBe(true);
  });

  it('is true when the axis differs, which matches nothing at runtime', () => {
    expect(capShapeConflict(COMPOUND_SHAPE, { ...ABK_STORED, rowVia: 'parentClass' })).toBe(true);
  });
});

describe('missingCapCells', () => {
  it('counts the whole grid when nothing is filled', () => {
    expect(missingCapCells(COMPOUND_SHAPE, null)).toHaveLength(6);
  });

  it('counts none when every cell holds a figure', () => {
    expect(missingCapCells(COMPOUND_SHAPE, ABK_STORED)).toEqual([]);
  });

  it('a product default counts as filled — the operator has a figure either way', () => {
    expect(missingCapCells(COMPOUND_SHAPE, null, ABK_STORED.rows)).toEqual([]);
  });
});

describe('row order is a statement, not a rendering detail', () => {
  /**
   * `fact-value.ts` reads a multi-pick answer top to bottom and the FIRST row whose key the
   * applicant chose wins — "row order is the operator's way of saying which answer outranks
   * which" — and any bound question, MULTI_SELECT included, may key a cap. Re-emitting in the
   * product's declared order would re-rank an applicant who picked two answers, on a save
   * that merely re-rendered the table.
   */
  const OUT_OF_ORDER: MaxLoanByFactConfig = {
    factKey: 'owned_unit_type',
    columnFactKey: 'loan_is_topup',
    onNoMatch: 'useProgramMax',
    rows: [
      { rowKey: 'villa', columnKey: 'new_loan', maxAmountEGP: '4000000' },
      { rowKey: 'apartment', columnKey: 'new_loan', maxAmountEGP: '2000000' },
    ],
  };

  it('keeps the stored sequence when nothing changed', () => {
    const grid = capGridFrom(COMPOUND_SHAPE, OUT_OF_ORDER);
    const next = capConfigFrom(COMPOUND_SHAPE, grid, 'useProgramMax', OUT_OF_ORDER.rows);
    expect(next?.rows).toEqual(OUT_OF_ORDER.rows);
  });

  it('appends a newly typed row after the stored ones, in declared order', () => {
    const grid = capGridFrom(COMPOUND_SHAPE, OUT_OF_ORDER);
    const typed = {
      ...grid,
      declared: grid.declared.map((e) =>
        e.cell.rowKey === 'twin_or_town_house' && e.cell.columnKey === 'top_up'
          ? { ...e, amount: '3500000' }
          : e,
      ),
    };
    const rows = capConfigFrom(COMPOUND_SHAPE, typed, 'useProgramMax', OUT_OF_ORDER.rows)?.rows;
    expect(rows?.map((r) => `${r.rowKey}|${r.columnKey}`)).toEqual([
      'villa|new_loan',
      'apartment|new_loan',
      'twin_or_town_house|top_up',
    ]);
  });

  it('two brand-new rows keep the order they were emitted in', () => {
    const grid = capGridFrom(COMPOUND_SHAPE, null);
    const typed = {
      ...grid,
      declared: grid.declared.map((e, i) => (i < 2 ? { ...e, amount: `${i + 1}000000` } : e)),
    };
    const rows = capConfigFrom(COMPOUND_SHAPE, typed, 'useProgramMax', [])?.rows;
    expect(rows?.map((r) => r.columnKey)).toEqual(['new_loan', 'top_up']);
  });
});
