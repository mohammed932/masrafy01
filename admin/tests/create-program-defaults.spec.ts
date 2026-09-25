import { describe, expect, it } from 'vitest';
import { newProgramDefaults } from '../src/app/features/bank-programs/form/new-program-defaults';

describe('newProgramDefaults', () => {
  it('starts a new bank program in the catalog-backed state instead of hardcoded bank-owned values', () => {
    const defaults = newProgramDefaults();

    expect(defaults.plansSource).toBe('product');
    expect(defaults.tenor.minMonths).toBeNull();
    expect(defaults.tenor.maxMonths).toBeNull();
    expect(defaults.loanLimits.minAmountEGP).toBeNull();
    expect(defaults.loanLimits.maxAmountEGP).toBeNull();
    expect(defaults.pricing.baseRatePercent).toBeNull();
  });
});
