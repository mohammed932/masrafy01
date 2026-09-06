import { describe, expect, it } from 'vitest';
import {
  compareOffers,
  orderOffers,
  type OrderableOffer,
} from '@features/applications/detail/offer-order';

/**
 * Regression cover for offer ordering on the application detail page.
 *
 * Both branches exist because the obvious reading of the payload is the wrong
 * one: array order is Postgres's arbitrary order, not the order the customer
 * saw, so an offer with no frozen `rankIndex` must NOT fall back to it.
 */

function offer(over: Partial<OrderableOffer> & { programCode: string }): OrderableOffer {
  return {
    isSelected: false,
    monthlyInstallmentEGP: '1000.00',
    bankIsFeatured: false,
    ...over,
  };
}

describe('compareOffers — rankIndex branch', () => {
  it('orders by the frozen rank the customer was shown', () => {
    const rows = [
      offer({ programCode: 'C', rankIndex: 2 }),
      offer({ programCode: 'A', rankIndex: 0 }),
      offer({ programCode: 'B', rankIndex: 1 }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['A', 'B', 'C']);
  });

  it('ignores installment and featured when both sides carry a rank', () => {
    // B is cheaper AND featured, but the customer saw A first — that stands.
    const rows = [
      offer({ programCode: 'B', rankIndex: 1, monthlyInstallmentEGP: '10.00', bankIsFeatured: true }),
      offer({ programCode: 'A', rankIndex: 0, monthlyInstallmentEGP: '9999.00' }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['A', 'B']);
  });

  it('lifts the applicant’s pick above a better rank', () => {
    const rows = [
      offer({ programCode: 'A', rankIndex: 0 }),
      offer({ programCode: 'B', rankIndex: 1 }),
      offer({ programCode: 'C', rankIndex: 2, isSelected: true }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['C', 'A', 'B']);
  });

  it('is stable for two offers sharing a rank (dense per application, so a data fault)', () => {
    expect(compareOffers(offer({ programCode: 'A', rankIndex: 3 }), offer({ programCode: 'B', rankIndex: 3 }))).toBe(0);
  });
});

describe('compareOffers — fallback chain when rankIndex is absent', () => {
  it('sorts by monthly installment ascending, not by array order', () => {
    const rows = [
      offer({ programCode: 'C', monthlyInstallmentEGP: '3000.00' }),
      offer({ programCode: 'A', monthlyInstallmentEGP: '1000.00' }),
      offer({ programCode: 'B', monthlyInstallmentEGP: '2000.00' }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['A', 'B', 'C']);
  });

  it('breaks an installment tie with the featured bank first', () => {
    const rows = [
      offer({ programCode: 'PLAIN', monthlyInstallmentEGP: '1000.00' }),
      offer({ programCode: 'PARTNER', monthlyInstallmentEGP: '1000.00', bankIsFeatured: true }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['PARTNER', 'PLAIN']);
  });

  it('breaks a full tie on programCode, so two reloads agree', () => {
    const rows = [offer({ programCode: 'ZZZ' }), offer({ programCode: 'AAA' })];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['AAA', 'ZZZ']);
  });

  it('compares Decimal strings without tripping on the fractional part', () => {
    expect(
      compareOffers(
        offer({ programCode: 'A', monthlyInstallmentEGP: '999.99' }),
        offer({ programCode: 'B', monthlyInstallmentEGP: '1000.00' }),
      ),
    ).toBeLessThan(0);
  });

  it('sinks an unparseable installment rather than floating it to the top', () => {
    const rows = [
      offer({ programCode: 'BAD', monthlyInstallmentEGP: 'not-a-number' }),
      offer({ programCode: 'GOOD', monthlyInstallmentEGP: '5000.00' }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['GOOD', 'BAD']);
  });

  it('still puts the applicant’s pick first', () => {
    const rows = [
      offer({ programCode: 'CHEAP', monthlyInstallmentEGP: '100.00' }),
      offer({ programCode: 'TAKEN', monthlyInstallmentEGP: '9000.00', isSelected: true }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['TAKEN', 'CHEAP']);
  });
});

describe('compareOffers — mixed, some rows ranked and some not', () => {
  it('falls through to the deterministic chain whenever EITHER side lacks a rank', () => {
    // RANKED carries rank 0 but PLAIN carries none, so the pair cannot be compared
    // by rank — it is decided by installment, which puts PLAIN first.
    const rows = [
      offer({ programCode: 'RANKED', rankIndex: 0, monthlyInstallmentEGP: '8000.00' }),
      offer({ programCode: 'PLAIN', monthlyInstallmentEGP: '1000.00' }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['PLAIN', 'RANKED']);
  });

  it('keeps ranked rows in rank order among themselves', () => {
    const rows = [
      offer({ programCode: 'R2', rankIndex: 1, monthlyInstallmentEGP: '2000.00' }),
      offer({ programCode: 'R1', rankIndex: 0, monthlyInstallmentEGP: '3000.00' }),
    ];
    expect(orderOffers(rows).map((o) => o.programCode)).toEqual(['R1', 'R2']);
  });
});

describe('orderOffers', () => {
  it('does not mutate the caller’s array', () => {
    const rows = [offer({ programCode: 'B', rankIndex: 1 }), offer({ programCode: 'A', rankIndex: 0 })];
    const before = rows.map((o) => o.programCode);
    orderOffers(rows);
    expect(rows.map((o) => o.programCode)).toEqual(before);
  });

  it('handles an empty list', () => {
    expect(orderOffers([])).toEqual([]);
  });
});
