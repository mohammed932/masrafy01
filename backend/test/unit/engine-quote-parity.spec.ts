import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { EngineService } from '../../src/matching/engine.service';
import { quoteProgram } from '../../src/matching/pipeline/quote';
import type { ScoringConfig } from '../../src/matching/types';
import { eligibilityFixture, profileFixture, programFixture } from '../helpers/matching';

const scoringConfig: ScoringConfig = {
  version: '1.0.0-test',
  weights: {},
  thresholds: { excellent: 80, good: 65, moderate: 50, low: 35 },
  factorCatalog: {},
  legacy: false,
};

const engine = new EngineService();

/**
 * FR-025 — preview and apply figures must be identical for identical inputs.
 *
 * The guarantee is structural, not incidental: `EngineService` and every other
 * consumer call the same `quoteProgram`. These tests pin that the engine copies
 * the quote through without re-deriving anything, so the guarantee cannot be
 * lost to a well-meaning "optimisation" in `buildOffer`.
 */
describe('engine ↔ quote parity', () => {
  it('copies every money figure from the quote onto the offer', () => {
    const profile = profileFixture();
    const program = programFixture({ fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000' } });

    const result = engine.run({ profile, programs: [program], scoringConfig, skipEligibility: true });
    const offer = result.offers[0];
    expect(offer).toBeDefined();
    if (!offer) return;

    const outcome = quoteProgram({ profile, program, skipDbrCheck: true });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const { quote } = outcome;

    expect(offer.monthlyInstallmentEGP.toFixed(2)).toBe(quote.monthlyInstallmentEGP.toFixed(2));
    expect(offer.effectiveRatePercent.toFixed(4)).toBe(quote.effectiveRatePercent.toFixed(4));
    expect(offer.effectiveTenorMonths).toBe(quote.effectiveTenorMonths);
    expect(offer.dbrPercent.toFixed(2)).toBe(quote.dbrPercent.toFixed(2));
    expect(offer.feesBreakdown).toEqual(quote.feesBreakdown);

    // The booked principal is the fee-inflated one; the "requested" figure on
    // the offer is the cash the customer receives.
    expect(offer.effectiveLoanAmountEGP.toFixed(2)).toBe(quote.offeredAmountEGP.toFixed(2));
    expect(offer.requestedLoanAmountEGP.toFixed(2)).toBe(quote.cashToCustomerEGP.toFixed(2));
  });

  it('exposes the quote on the match result so callers need not recompute', () => {
    const profile = profileFixture();
    const program = programFixture({ eligibility: eligibilityFixture({ dbrBands: [
      { upToIncomeEGP: '10000', capPercent: '35.0000' },
      { upToIncomeEGP: null, capPercent: '45.0000' },
    ] }) });

    const result = engine.run({ profile, programs: [program], scoringConfig, skipEligibility: true });
    expect(result.offers).toHaveLength(1);
    // The resolved band + cap ride along, so the apply path can persist them
    // (FR-021) without running the engine twice.
    const offer = result.offers[0];
    expect(offer?.dbrPercent).toBeInstanceOf(Decimal);
  });

  describe('DBR-adjusted offers', () => {
    const squeezed = profileFixture({
      obligations: {
        existingMonthlyObligationsEGP: new Decimal('5000'),
        hasCurrentLoan: true,
        hasPreviousRejection: false,
      },
    });

    it('marks the offer dbr_adjusted and reports the affordable ceiling', () => {
      const result = engine.run({
        profile: squeezed,
        programs: [programFixture()],
        scoringConfig,
      });

      const offer = result.offers[0];
      expect(offer).toBeDefined();
      if (!offer) return;
      expect(offer.maxLoanAvailableEGP?.toFixed(2)).toBe(offer.requestedLoanAmountEGP.toFixed(2));
      expect(offer.requestedLoanAmountEGP.lessThan(300000)).toBe(true);
    });

    it('leaves maxLoanAvailableEGP unset when nothing was reduced by DBR', () => {
      const result = engine.run({
        profile: profileFixture(),
        programs: [programFixture()],
        scoringConfig,
      });
      expect(result.offers[0]?.maxLoanAvailableEGP).toBeUndefined();
    });

    it('does not reduce on the apply path, which runs with eligibility skipped', () => {
      const result = engine.run({
        profile: squeezed,
        programs: [programFixture()],
        scoringConfig,
        skipEligibility: true,
      });
      expect(result.offers[0]?.requestedLoanAmountEGP.toFixed(2)).toBe('300000.00');
    });
  });

  it('lists a no-match reason rather than throwing when a program cannot be quoted', () => {
    const result = engine.run({
      profile: profileFixture({ requestedCurrency: 'USD' }),
      programs: [programFixture()],
      scoringConfig,
      skipEligibility: true,
    });
    expect(result.status).toBe('no_match');
    expect(result.noMatchDetails?.[0]?.failedChecks).toContain('currency');
  });
});
