/**
 * The predefined-product library's rules.
 *
 * What is worth pinning here is the state an operator cannot see anywhere else: an ask can be
 * "set up" by every measure a list screen has — the question exists, the fact exists, the
 * list exists — and still be asked of NOBODY, because it is assigned to no loan category this
 * product is sold under. A product whose column reads it then quotes its standard column for
 * every applicant and says nothing about why.
 */
import { describe, expect, it } from 'vitest';
import {
  LIBRARY_GROUPS,
  askState,
  createLines,
  groupOf,
  libraryBlock,
  readyCount,
  searchLibrary,
  widenedCategories,
} from '../src/app/features/program-catalog/product-library';
import type {
  ProductBlueprint,
  ProductBlueprintAsk,
} from '../src/app/features/bank-programs/bank-programs.types';

const ask = (over: Partial<ProductBlueprintAsk> = {}): ProductBlueprintAsk => ({
  factKey: 'years_in_practice',
  kind: 'platformFact',
  questionCode: 'years_in_practice',
  factExists: true,
  questionExists: true,
  listExists: true,
  missingCategories: [],
  ...over,
});

const blueprint = (over: Partial<ProductBlueprint> = {}): ProductBlueprint => ({
  key: 'years_in_practice_bands',
  group: 'income',
  labelEn: 'Income by years in practice',
  labelAr: 'الدخل حسب سنوات الممارسة',
  outputKind: 'monthlyIncome',
  wayCount: 1,
  hasSecondColumn: true,
  conditionCount: 0,
  hasCap: true,
  asks: [ask()],
  creates: { lists: 0, values: 0, questions: 0, facts: 0, widens: 0 },
  suggestedBands: [],
  ...over,
});

describe('askState', () => {
  it('reads a fully wired ask as ready', () => {
    expect(askState(ask())).toBe('ready');
  });

  it.each([
    ['no fact', { factExists: false }],
    ['no question', { questionExists: false }],
    ['no list', { listExists: false }],
  ])('reads %s as something to create', (_label, over) => {
    expect(askState(ask(over))).toBe('creates');
  });

  it('reads an existing question asked in the wrong loan types as a WIDEN', () => {
    // The state no other screen shows. Not "creates" — nothing is written but an assignment —
    // and emphatically not "ready", which is what every list screen already says about it.
    expect(askState(ask({ missingCategories: ['personal', 'car'] }))).toBe('widens');
  });

  it('prefers "creates" when a missing thing ALSO needs widening', () => {
    // Both are true and only one can be shown. The bigger write is the honest one: a chip
    // saying "will be widened" about a question that does not exist yet reads as a smaller
    // change than it is.
    expect(askState(ask({ questionExists: false, missingCategories: ['car'] }))).toBe('creates');
  });
});

describe('libraryBlock', () => {
  it('refuses before anything is picked', () => {
    expect(libraryBlock({ picked: null, labelEn: 'x', labelAr: 'س' })).toBe('no_pick');
  });

  it('asks for both names, and names the Arabic one as primary', () => {
    expect(libraryBlock({ picked: blueprint(), labelEn: '', labelAr: 'س' })).toBe('no_name_en');
    expect(libraryBlock({ picked: blueprint(), labelEn: 'x', labelAr: '' })).toBe('no_name_ar');
    expect(libraryBlock({ picked: blueprint(), labelEn: ' x ', labelAr: ' س ' })).toBeNull();
  });

  it('asks for NO name for a cap-only product', () => {
    // It creates no product, so there is nothing to name — and demanding one would be the
    // screen inventing a name for a thing that never gets it.
    expect(
      libraryBlock({ picked: blueprint({ group: 'cap' }), labelEn: '', labelAr: '' }),
    ).toBeNull();
  });
});

describe('what a create writes', () => {
  it('lists only the kinds it actually writes', () => {
    expect(
      createLines(
        blueprint({ creates: { lists: 2, values: 5, questions: 0, facts: 2, widens: 0 } }),
      ),
    ).toEqual([
      { kind: 'lists', count: 2 },
      { kind: 'values', count: 5 },
      { kind: 'facts', count: 2 },
    ]);
  });

  it('says nothing at all for a product every ask of which exists', () => {
    // Which is a real state — one product reuses a question, a fact and a list it did not
    // author — and "nothing to set up" is worth a line where five zeroes are not.
    expect(createLines(blueprint())).toEqual([]);
  });

  it('names every loan category a reused question has to be widened to, once', () => {
    expect(
      widenedCategories(
        blueprint({
          asks: [
            ask({ missingCategories: ['personal', 'car'] }),
            ask({ factKey: 'loan_is_topup', missingCategories: ['car'] }),
          ],
        }),
      ),
    ).toEqual(['personal', 'car']);
  });

  it('counts how many asks are ready', () => {
    expect(
      readyCount(
        blueprint({
          asks: [ask(), ask({ factKey: 'a', factExists: false }), ask({ factKey: 'b' })],
        }),
      ),
    ).toBe(2);
  });
});

describe('the shelves', () => {
  it('orders them by how much of the answer the product works out', () => {
    expect(LIBRARY_GROUPS).toEqual(['income', 'ceiling', 'cap']);
  });

  it('puts each product on exactly one shelf', () => {
    const all = [
      blueprint({ key: 'a', group: 'income' }),
      blueprint({ key: 'b', group: 'ceiling' }),
      blueprint({ key: 'c', group: 'cap' }),
    ];
    expect(LIBRARY_GROUPS.flatMap((group) => groupOf(all, group)).map((b) => b.key)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});

describe('search', () => {
  const all = [
    blueprint({
      key: 'armed_forces_grades',
      labelEn: 'Armed forces',
      asks: [ask({ factKey: 'military_grade', questionCode: 'military_grade' })],
    }),
    blueprint({ key: 'years_in_practice_bands', labelEn: 'Doctors', labelAr: 'الأطباء' }),
  ];

  it('returns everything for a blank query', () => {
    expect(searchLibrary(all, '   ')).toHaveLength(2);
  });

  it('finds a product by what it READS, not only by its name', () => {
    // An operator hunting for "the one that reads years in practice" is searching for the
    // fact — the only word they have seen, on the bank's figures editor.
    expect(searchLibrary(all, 'years_in_practice').map((b) => b.key)).toEqual([
      'years_in_practice_bands',
    ]);
    expect(searchLibrary(all, 'military').map((b) => b.key)).toEqual(['armed_forces_grades']);
  });

  it('finds it by its Arabic name, which is the primary locale', () => {
    expect(searchLibrary(all, 'الأطباء').map((b) => b.key)).toEqual(['years_in_practice_bands']);
  });

  it('finds it by the key a colleague pasted into a message', () => {
    expect(searchLibrary(all, 'ARMED_FORCES').map((b) => b.key)).toEqual(['armed_forces_grades']);
  });
});
