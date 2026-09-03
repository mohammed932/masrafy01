/**
 * The program-catalog board's join.
 *
 * Two things here are only wrong SILENTLY, which is why they are the cases worth writing:
 * a name that lands in no group at all (reachable from nowhere on a board that looks
 * complete), and a name counted twice because it is sold both ways.
 */
import { describe, expect, it } from 'vitest';
import {
  basesOf,
  buildBoard,
  type BuildBoardInput,
} from '../src/app/features/program-catalog/catalog-board';
import type { EnumerationRow } from '../src/app/features/lookups/lookups.api.service';
import type { SurrogateProductSummary } from '../src/app/features/bank-programs/bank-programs.types';

function name(over: Partial<EnumerationRow> & { key: string }): EnumerationRow {
  return {
    id: `id-${over.key}`,
    type: 'program_name',
    labelAr: over.key,
    labelEn: over.key,
    active: true,
    deprecatedAt: null,
    systemOnly: false,
    parentKey: null,
    surrogateProductKey: null,
    ...over,
  } as EnumerationRow;
}

function product(
  over: Partial<SurrogateProductSummary> & { key: string },
): SurrogateProductSummary {
  return {
    labelAr: over.key,
    labelEn: over.key,
    active: true,
    strategy: 'steps',
    outputKind: 'maxAmount',
    wayCount: 3,
    usedBy: [],
    ...over,
  } as SurrogateProductSummary;
}

function board(over: Partial<BuildBoardInput> = {}) {
  return buildBoard({ names: [], products: [], search: '', isAr: false, ...over });
}

describe('basesOf', () => {
  it('reads the stored per-category bases when the name is offered somewhere', () => {
    const row = name({
      key: 'doctor',
      categories: ['personal', 'business'],
      incomeBasesByCategory: { personal: ['payslip'], business: ['no_payslip'] },
    });
    expect([...basesOf(row)].sort()).toEqual(['no_payslip', 'payslip']);
  });

  it('falls back to the product LINK for a name offered under no loan type', () => {
    // The day-one state: a create assigns no category, so there is no assignment row to
    // read a basis off. Falling back to `payslip` reported a freshly created no-payslip
    // name as the opposite of what the operator picked.
    expect(basesOf(name({ key: 'fresh', surrogateProductKey: 'compound' }))).toEqual([
      'no_payslip',
    ]);
    expect(basesOf(name({ key: 'fresh2' }))).toEqual(['payslip']);
  });

  it('ignores a stored basis for a loan type the name is not offered under', () => {
    const row = name({
      key: 'withdrawn',
      categories: [],
      incomeBasesByCategory: { personal: ['no_payslip'] },
    });
    expect(basesOf(row)).toEqual(['payslip']);
  });
});

describe('buildBoard — every name is reachable', () => {
  it('puts a surrogate name with no product and no rule of its own in the unlinked group', () => {
    const b = board({
      names: [
        name({
          key: 'orphan',
          categories: ['personal'],
          incomeBasesByCategory: { personal: ['no_payslip'] },
          hasOwnIncomeRule: false,
        }),
      ],
    });
    expect(b.proofNames).toHaveLength(0);
    expect(b.products).toHaveLength(0);
    expect(b.unlinked.map((u) => [u.row.key, u.state])).toEqual([['orphan', 'nothing']]);
  });

  it('calls an unlinked name that states its own rule exactly that', () => {
    const b = board({
      names: [
        name({
          key: 'legacy',
          surrogateProductKey: null,
          categories: ['personal'],
          incomeBasesByCategory: { personal: ['no_payslip'] },
          hasOwnIncomeRule: true,
        }),
      ],
    });
    expect(b.unlinked[0]?.state).toBe('own_rule');
  });

  it('reads an ABSENT hasOwnIncomeRule as the harmless state, never as broken', () => {
    // Old backend: the field simply was not sent. Inventing a warning from that would send
    // an operator to fix a name that is fine.
    const b = board({
      names: [
        name({
          key: 'skew',
          categories: ['personal'],
          incomeBasesByCategory: { personal: ['no_payslip'] },
        }),
      ],
    });
    expect(b.unlinked[0]?.state).toBe('own_rule');
  });

  it('does not strand a linked name — it is inside its product card, not unlinked', () => {
    const b = board({
      names: [name({ key: 'compound_owner', surrogateProductKey: 'compound' })],
      products: [product({ key: 'compound', usedBy: ['compound_owner'] })],
    });
    expect(b.unlinked).toHaveLength(0);
    expect(b.products[0]?.names.map((r) => r.key)).toEqual(['compound_owner']);
  });
});

describe('buildBoard — a name sold both ways', () => {
  it('is one proof card and one chip inside a product card, never two cards', () => {
    const both = name({
      key: 'doctor',
      surrogateProductKey: 'by_years',
      categories: ['personal'],
      incomeBasesByCategory: { personal: ['payslip', 'no_payslip'] },
    });
    const b = board({
      names: [both],
      products: [product({ key: 'by_years', usedBy: ['doctor'] })],
    });

    expect(b.proofNames.map((r) => r.key)).toEqual(['doctor']);
    expect(b.products[0]?.names.map((r) => r.key)).toEqual(['doctor']);
    expect(b.unlinked).toHaveLength(0);
    // One card each side: the counts add up, and neither side is short.
    expect(b.counts).toEqual({ payslip: 1, no_payslip: 1 });
  });
});

describe('buildBoard — product cards', () => {
  it('sums programs and missing tables over the names that sell it', () => {
    const b = board({
      names: [
        name({
          key: 'a',
          surrogateProductKey: 'p',
          usage: { programs: 3, banks: 2, noPayslipPrograms: 3, noPayslipProgramsWithoutTable: 1 },
        }),
        name({
          key: 'b',
          surrogateProductKey: 'p',
          usage: { programs: 2, banks: 2, noPayslipPrograms: 1, noPayslipProgramsWithoutTable: 2 },
        }),
      ],
      products: [product({ key: 'p', usedBy: ['a', 'b'] })],
    });
    expect(b.products[0]?.programs).toBe(5);
    expect(b.products[0]?.missingTables).toBe(3);
  });

  it('reports a linked key with no row rather than quietly rendering one chip fewer', () => {
    const b = board({
      names: [name({ key: 'a', surrogateProductKey: 'p' })],
      products: [product({ key: 'p', usedBy: ['a', 'deleted_name'] })],
    });
    expect(b.products[0]?.names.map((r) => r.key)).toEqual(['a']);
    expect(b.products[0]?.orphanNameKeys).toEqual(['deleted_name']);
  });

  it('keeps a product nothing sells, with an empty name list', () => {
    const b = board({ products: [product({ key: 'unsold' })] });
    expect(b.products).toHaveLength(1);
    expect(b.products[0]?.names).toEqual([]);
  });

  it('still lists a DEPRECATED name inside the card that quotes through it', () => {
    // It is deprecated, not gone — a program filed under it still reaches this product, so
    // "what uses this?" must not answer zero.
    const b = board({
      names: [name({ key: 'old', surrogateProductKey: 'p', deprecatedAt: '2026-01-01T00:00:00Z' })],
      products: [product({ key: 'p', usedBy: ['old'] })],
    });
    expect(b.products[0]?.names.map((r) => r.key)).toEqual(['old']);
    expect(b.deprecated.map((r) => r.key)).toEqual(['old']);
    // ...and it is not offered as a live surrogate name needing attention.
    expect(b.unlinked).toHaveLength(0);
  });
});

describe('buildBoard — search', () => {
  it('matches a name on either locale label or its key', () => {
    const rows = [
      name({ key: 'doctor', labelEn: 'Doctor Loans', labelAr: 'قروض الأطباء' }),
      name({ key: 'police', labelEn: 'Police Personnel', labelAr: 'الشرطة' }),
    ];
    expect(board({ names: rows, search: 'الأطباء' }).proofNames.map((r) => r.key)).toEqual([
      'doctor',
    ]);
    expect(board({ names: rows, search: 'POLICE' }).proofNames.map((r) => r.key)).toEqual([
      'police',
    ]);
  });

  it('finds a product by a name that sells it, not only by its own label', () => {
    // The calculation is rarely called what the product is called; an operator searches for
    // the thing they sell.
    const names = [
      name({ key: 'doctor', labelEn: 'Doctor Loans', surrogateProductKey: 'by_years' }),
    ];
    const products = [
      product({ key: 'by_years', labelEn: 'By years in practice', usedBy: ['doctor'] }),
    ];

    expect(board({ names, products, search: 'Doctor' }).products.map((c) => c.product.key)).toEqual(
      ['by_years'],
    );
    expect(board({ names, products, search: 'years' }).products.map((c) => c.product.key)).toEqual([
      'by_years',
    ]);
    expect(board({ names, products, search: 'mortgage' }).products).toHaveLength(0);
  });

  it('counts what the search left, so an empty chip reads as "nothing matches"', () => {
    const b = board({
      names: [name({ key: 'doctor' }), name({ key: 'police' })],
      products: [product({ key: 'p' })],
      search: 'doctor',
    });
    expect(b.counts).toEqual({ payslip: 1, no_payslip: 0 });
  });

  // --- a product switched OFF -------------------------------------------------
  //
  // Switching a product off is the operator's one lifecycle action on one now, and the board
  // is where it happens. What the board must NOT do is quietly stop describing the product:
  // the names that sell it are still linked, still live, and quoting nothing.

  it('keeps an inactive product’s names and program count, so the warning is renderable', () => {
    // Read from `usedBy` regardless of the active flag, deliberately. If this ever came back
    // with no names, the card would go quiet at exactly the moment it has something to say.
    const b = board({
      names: [
        name({
          key: 'compound_owner_4',
          usage: { programs: 3, banks: 1, noPayslipPrograms: 3, noPayslipProgramsWithoutTable: 0 },
        } as never),
      ],
      products: [product({ key: 'compound', active: false, usedBy: ['compound_owner_4'] })],
    });
    const card = b.products[0]!;
    expect(card.product.active).toBe(false);
    expect(card.names.map((n) => n.key)).toEqual(['compound_owner_4']);
    expect(card.programs).toBe(3);
  });

  it('does not push a name out of a switched-off product’s card', () => {
    // It would then render twice — once inside the card and once as an unlinked name — or,
    // worse, appear to state a calculation of its own.
    const b = board({
      names: [name({ key: 'compound_owner_4' })],
      products: [product({ key: 'compound', active: false, usedBy: ['compound_owner_4'] })],
    });
    expect(b.unlinked).toHaveLength(0);
  });

  it('counts a switched-off product under the Surrogate chip', () => {
    // The chip is what the operator clicks to FIND it and switch it back on. A count that
    // shrank when a product went off would hide the row that needs the next decision.
    const b = board({ products: [product({ key: 'off', active: false })] });
    expect(b.counts.no_payslip).toBe(1);
    expect(b.products).toHaveLength(1);
  });
});
