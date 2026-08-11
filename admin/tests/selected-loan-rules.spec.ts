import { describe, expect, it } from 'vitest';
import {
  ceilingIsInformative,
  wasAmountReduced,
} from '@features/applications/detail/components/selected-loan.rules';

/**
 * Regression cover for the "Eligible for" card. Both rules exist because the
 * obvious reading of the payload is the wrong one:
 *   - the offer's own `requestedLoanAmountEGP` is post-cascade, not the ask;
 *   - a DBR-capped loan equals its own ceiling, so showing both says nothing.
 */
describe('wasAmountReduced', () => {
  it('flags a DBR-capped loan against the application ask (application cmsn7lcb…)', () => {
    // Real row: applicant asked 1,000,000; ABK Doctor Loans funded 451,760.85.
    expect(wasAmountReduced('451760.85', '1000000.00')).toBe(true);
  });

  it('would have missed that reduction if compared against the offer ask', () => {
    // The offer's own requestedLoanAmountEGP on that row — already trimmed by the
    // cascade to 442,902.80, i.e. BELOW what was funded. This is the bug the rule
    // replaced: the card read "Full amount requested" on a capped loan.
    expect(wasAmountReduced('451760.85', '442902.80')).toBe(false);
  });

  it('does not flag a loan funded at exactly the requested amount', () => {
    expect(wasAmountReduced('300000.00', '300000.00')).toBe(false);
  });

  it('does not flag when the ask is unknown — no ask is not evidence of a cut', () => {
    expect(wasAmountReduced('451760.85', null)).toBe(false);
    expect(wasAmountReduced('451760.85', '')).toBe(false);
    expect(wasAmountReduced('451760.85', '0.00')).toBe(false);
    expect(wasAmountReduced('451760.85', 'not-a-number')).toBe(false);
  });

  it('compares Decimal strings without tripping on the fractional part', () => {
    expect(wasAmountReduced('999999.99', '1000000.00')).toBe(true);
    expect(wasAmountReduced('1000000.01', '1000000.00')).toBe(false);
  });
});

describe('ceilingIsInformative', () => {
  it('hides the ceiling when the loan IS the ceiling (0.01 rounding gap)', () => {
    // Same real row: eligible 451,760.85 vs ceiling 451,760.86.
    expect(ceilingIsInformative('451760.86', '451760.85')).toBe(false);
  });

  it('shows the ceiling when the applicant borrowed less than the bank allows', () => {
    expect(ceilingIsInformative('900000.00', '300000.00')).toBe(true);
  });

  it('treats a 1 EGP gap as the threshold, not 0.99', () => {
    expect(ceilingIsInformative('100001.00', '100000.00')).toBe(true);
    expect(ceilingIsInformative('100000.99', '100000.00')).toBe(false);
  });

  it('hides the row when the offer carries no ceiling', () => {
    expect(ceilingIsInformative(null, '451760.85')).toBe(false);
    expect(ceilingIsInformative(undefined, '451760.85')).toBe(false);
  });
});
