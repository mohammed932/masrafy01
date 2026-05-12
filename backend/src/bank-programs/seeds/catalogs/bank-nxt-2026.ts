import type { SeedCatalog } from '../catalog.types';
import { skeletonProgram } from './base';

/**
 * Minimal Bank NXT competitor catalog — demonstrates `rateByTenorAndCustomerType` dimension.
 * Operator can expand later.
 */
export const bankNxt2026: SeedCatalog = {
  name: 'bank-nxt-2026',
  programs: [
    skeletonProgram({
      programCode: 'NXT-SALARIED',
      bankName: 'Bank NXT',
      friendlyName: 'Salaried — Tenor × Tenure tiered',
      tenor: { minMonths: 12, maxMonths: 84 },
      loanLimits: { perCurrency: { EGP: { minAmount: '50000', maxAmount: '2000000' } } },
      pricing: {
        isVariableRate: false,
        baseRatePercent: '26.5000',
        rateByTenorAndCustomerType: {
          salaried_lt_5y: { value: '27.5000' },
          salaried_gt_5y: { value: '25.0000' },
        },
      },
    }),
  ],
  expectedRates: {
    'NXT-SALARIED': '26.5000',
  },
};
