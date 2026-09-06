import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { rankOffers } from '../../src/matching/pipeline/ranking';
import { APPLICATION_PRIORITIES, type ApplicationPriority, type Offer } from '../../src/matching/types';

/**
 * `rankOffers` is the ONE authority on offer order, and the apply path freezes its
 * output as `bank_offer.rankIndex` — so an arm that fails to discriminate does not
 * degrade quietly, it stamps an arbitrary order onto immutable offers (Principle I / A6).
 *
 * That is what these tests exist to catch, and it is not hypothetical: until the
 * approval score was removed, `fastest_approval` sorted by nothing else, and it is the
 * arm the four mobile mappers fall back to for every unmapped or skipped priority
 * answer — i.e. most applications, not an edge case.
 */

type OfferSpec = {
  programCode: string;
  installment: string;
  rate: string;
  docs: number;
  featured?: boolean;
};

function offer(spec: OfferSpec): Offer {
  return {
    programCode: spec.programCode,
    bankIsFeatured: spec.featured ?? false,
    monthlyInstallmentEGP: new Decimal(spec.installment),
    effectiveRatePercent: new Decimal(spec.rate),
    requiredDocuments: Array.from({ length: spec.docs }, (_, i) => `doc_${i}`),
  } as unknown as Offer;
}

/** Four programs, each best on exactly one axis, so a wrong key is visible. */
function spread(): Offer[] {
  return [
    offer({ programCode: 'C-CHEAP-RATE', installment: '3000', rate: '11', docs: 5 }),
    offer({ programCode: 'A-LOW-INSTALMENT', installment: '1000', rate: '19', docs: 4 }),
    offer({ programCode: 'D-FEW-DOCS', installment: '4000', rate: '21', docs: 1 }),
    offer({ programCode: 'B-PARTNER', installment: '2000', rate: '15', docs: 3, featured: true }),
  ];
}

const codes = (offers: Offer[]): string[] => offers.map((o) => o.programCode);

describe('rankOffers', () => {
  it('lowest_installment leads with the cheapest monthly payment', () => {
    expect(codes(rankOffers(spread(), 'lowest_installment'))[0]).toBe('A-LOW-INSTALMENT');
  });

  it('lowest_interest leads with the cheapest rate', () => {
    expect(codes(rankOffers(spread(), 'lowest_interest'))[0]).toBe('C-CHEAP-RATE');
  });

  it('least_paperwork leads with the fewest documents', () => {
    expect(codes(rankOffers(spread(), 'least_paperwork'))[0]).toBe('D-FEW-DOCS');
  });

  it('fastest_approval leads with the partner bank, then fewest documents', () => {
    // The proxies that survive the score's removal: a live channel with a partner,
    // then less paper to collect. Partner-first keeps it distinguishable from
    // `least_paperwork` — the applicant chose between the two.
    expect(codes(rankOffers(spread(), 'fastest_approval'))).toEqual([
      'B-PARTNER',
      'D-FEW-DOCS',
      'A-LOW-INSTALMENT',
      'C-CHEAP-RATE',
    ]);
  });

  it('every priority produces a total order — no arm leaves offers unsorted', () => {
    // The regression that matters. An arm whose primary key stopped discriminating
    // (as `fastest_approval`'s did when the score went) still "works": it returns the
    // input array. Feeding it a REVERSED input is what exposes that — a real comparator
    // reorders it, a dead one hands the reversal straight back.
    for (const priority of APPLICATION_PRIORITIES) {
      const forward = codes(rankOffers(spread(), priority));
      const reversed = codes(rankOffers([...spread()].reverse(), priority));
      expect(reversed, `${priority} is order-dependent — its keys do not discriminate`).toEqual(
        forward,
      );
    }
  });

  it('breaks a total tie on programCode, so equal offers never reshuffle', () => {
    const tied: Offer[] = [
      offer({ programCode: 'Z-BANK', installment: '2000', rate: '15', docs: 3 }),
      offer({ programCode: 'A-BANK', installment: '2000', rate: '15', docs: 3 }),
    ];
    for (const priority of APPLICATION_PRIORITIES) {
      expect(codes(rankOffers(tied, priority))).toEqual(['A-BANK', 'Z-BANK']);
    }
  });

  it('prefers the partner bank when the primary key ties', () => {
    const tied: Offer[] = [
      offer({ programCode: 'A-PLAIN', installment: '2000', rate: '15', docs: 3 }),
      offer({ programCode: 'Z-PARTNER', installment: '2000', rate: '15', docs: 3, featured: true }),
    ];
    // programCode would put A first; the featured boost outranks it.
    expect(codes(rankOffers(tied, 'lowest_installment'))).toEqual(['Z-PARTNER', 'A-PLAIN']);
  });

  it('does not mutate the caller’s array', () => {
    const input = spread();
    const before = codes(input);
    rankOffers(input, 'lowest_installment');
    expect(codes(input)).toEqual(before);
  });

  it('covers every declared priority', () => {
    // If a fifth priority is ever added, the switch gains an unhandled arm that
    // silently returns the input order — and `rankIndex` freezes it.
    const covered: ApplicationPriority[] = [
      'lowest_installment',
      'lowest_interest',
      'fastest_approval',
      'least_paperwork',
    ];
    expect([...APPLICATION_PRIORITIES].sort()).toEqual([...covered].sort());
  });
});
