/**
 * A cap-only product's usage — the one measure a name-keyed walk cannot find.
 *
 * Three of the eleven predefined products guess no income: each bank states the maximum it
 * lends against one answer and nothing else. Such a product is sold through NO catalog name
 * (`SURROGATE_PRODUCT_CAP_ONLY` refuses the link), so `usedBy` is empty for it however many
 * banks quote a cap from it — and the board therefore read three live products as used by
 * nobody. `capPrograms` is the second measure, and these are its edges.
 */
import { describe, expect, it } from 'vitest';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';

interface Stub {
  asks: Map<string, Array<{ factKey: string }>>;
  capFacts: Array<{ programCode: string; factKeys: string[] }>;
}

function serviceWith(stub: Stub): BankProgramsService {
  const enums = {
    listSurrogateProducts: async () => [
      {
        key: 'club_branch_cap',
        labelAr: 'عضوية النادي',
        labelEn: 'Club Membership',
        active: true,
        incomeRule: null,
        templateSpec: null,
        valueSources: {},
        usedBy: [],
      },
      {
        key: 'compound_owner',
        labelAr: 'كومباوند',
        labelEn: 'Compound Owner',
        active: true,
        incomeRule: null,
        templateSpec: null,
        valueSources: {},
        usedBy: ['compound_owner_4'],
      },
    ],
  };
  return new BankProgramsService(
    {} as never,
    { capFactsByProgram: async () => stub.capFacts } as never,
    {} as never,
    enums as never,
    {} as never,
    { asksByProduct: async () => stub.asks } as never,
  );
}

describe('a cap-only product, and which programs use it', () => {
  const asks = new Map([
    [
      'club_branch_cap',
      [{ factKey: 'club_branch' }] as Array<{ factKey: string }>,
    ],
    [
      'compound_owner',
      [{ factKey: 'owned_unit_type' }, { factKey: 'unit_count_owned' }] as Array<{
        factKey: string;
      }>,
    ],
  ]);

  it('finds the programs that cap by an answer it asks for, though no name sells it', async () => {
    const service = serviceWith({
      asks,
      capFacts: [
        { programCode: 'FAB-PER-CLUB_MEMBERSHIP', factKeys: ['club_branch'] },
        { programCode: 'ABK-PER-PROFESSORS', factKeys: [] },
      ],
    });
    const products = await service.listSurrogateProducts();
    const club = products.find((p) => p.key === 'club_branch_cap');
    expect(club?.usedBy).toEqual([]);
    expect(club?.capPrograms).toEqual(['FAB-PER-CLUB_MEMBERSHIP']);
  });

  it('counts a program that caps by the SECOND axis of its table, not only the first', async () => {
    // One sheet caps by city and splits the column by relationship; another does the reverse.
    // A `factKey`-only read would report the second bank as capping by nothing.
    const service = serviceWith({
      asks,
      capFacts: [{ programCode: 'X-PER-ONE', factKeys: ['loan_is_topup', 'owned_unit_type'] }],
    });
    const products = await service.listSurrogateProducts();
    expect(products.find((p) => p.key === 'compound_owner')?.capPrograms).toEqual(['X-PER-ONE']);
  });

  it('counts an ADJUSTMENT to the maximum, which no JSON path filter can reach', async () => {
    const service = serviceWith({
      asks,
      capFacts: [{ programCode: 'Y-PER-TWO', factKeys: ['unit_count_owned'] }],
    });
    const products = await service.listSurrogateProducts();
    expect(products.find((p) => p.key === 'compound_owner')?.capPrograms).toEqual(['Y-PER-TWO']);
  });

  it('reports nothing for a product no program caps by — never a program that caps by something else', async () => {
    const service = serviceWith({
      asks,
      capFacts: [{ programCode: 'Z-PER-THREE', factKeys: ['employer_coding'] }],
    });
    const products = await service.listSurrogateProducts();
    expect(products.find((p) => p.key === 'club_branch_cap')?.capPrograms).toEqual([]);
    expect(products.find((p) => p.key === 'compound_owner')?.capPrograms).toEqual([]);
  });

  it('lists the programs in a stable order, so a board does not reshuffle between reads', async () => {
    const service = serviceWith({
      asks,
      capFacts: [
        { programCode: 'B-PER-TWO', factKeys: ['club_branch'] },
        { programCode: 'A-PER-ONE', factKeys: ['club_branch'] },
      ],
    });
    const products = await service.listSurrogateProducts();
    expect(products.find((p) => p.key === 'club_branch_cap')?.capPrograms).toEqual([
      'A-PER-ONE',
      'B-PER-TWO',
    ]);
  });
});
