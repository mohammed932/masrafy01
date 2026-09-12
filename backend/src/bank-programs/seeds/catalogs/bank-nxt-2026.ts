import type { SeedCatalog } from '../catalog.types';
import { skeletonProgram } from './base';

/**
 * Minimal Bank NXT competitor catalog.
 *
 * It used to carry a `rateByTenorAndCustomerType` map and its header claimed to "demonstrate
 * the dimension". It demonstrated nothing: that key was never in `PRICING_CASCADE_ORDER`, so
 * no level read it, and this catalog's own `expectedRates` recorded the consequence —
 * `26.5000`, the BASE rate, not either of the two tiers the map stated. The field is gone
 * with the map (see `PricingConfigDto.rateByFact`).
 *
 * The tiers are NOT re-expressed as a grid here, deliberately. A grid axis names a FACT, and
 * "salaried under five years" is a customer segment no question asks and no fact carries —
 * inventing one to keep a fictional bank's demo alive would seed a policy nobody stated.
 * `expectedRates` is unchanged, because the rate is unchanged: 26.5000 is what this program
 * quoted before and what it quotes now.
 */
export const bankNxt2026: SeedCatalog = {
  name: 'bank-nxt-2026',
  programs: [
    skeletonProgram({
      programCode: 'NXT-SALARIED',
      bankName: 'Bank NXT',
      friendlyName: 'Salaried',
      programNameKey: 'private_sector',
      tenor: { minMonths: 12, maxMonths: 84 },
      loanLimits: { minAmountEGP: '50000', maxAmountEGP: '2000000' },
      pricing: {
        isVariableRate: false,
        baseRatePercent: '26.5000',
      },
    }),
  ],
  expectedRates: {
    'NXT-SALARIED': '26.5000',
  },
};
