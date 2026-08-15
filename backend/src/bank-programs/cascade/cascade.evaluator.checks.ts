/**
 * Developer-discretion determinism checks for the cascade evaluator (research.md R15).
 * NOT a Vitest suite — Vitest is not installed, and Constitution v1.2.0 makes testing
 * optional. This module ships a Node-assert-style script runnable via:
 *
 *   npx tsx src/bank-programs/cascade/cascade.evaluator.checks.ts
 *
 * Exercises:
 *   FR-008b cascade ordering    — exact-key match at each level
 *   FR-008o.1 floor-to-≤        — down-payment band selection
 *   FR-008p.1 floor-to-≤        — asset-value band + below-all-bands fallthrough
 *   FR-005c.1                   — wealth-gate AND combination
 *   FR-003a                     — qualitativeReviewMaxEGP uplift only with operator approval
 */

import assert from 'node:assert/strict';
import {
  evaluateLoanLimit,
  evaluatePricing,
  evaluateWealthGate,
  type BankProgramConfig,
} from './cascade.evaluator';
import type { ApplicantContext } from './cascade.types';

const skeleton: BankProgramConfig = {
  pricing: {
    isVariableRate: false,
    baseRatePercent: '26.0000',
  },
  loanLimits: {
    minAmountEGP: '50000',
    maxAmountEGP: '2000000',
  },
  tenor: { minMonths: 12, maxMonths: 84 },
  eligibility: { requiresQualitativeReview: false, requiresNoDocuments: false },
};

function check(label: string, fn: () => void): void {
  try {
    fn();
    console.log(`✓ ${label}`);
  } catch (err) {
    console.error(`✗ ${label}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// FR-008o.1 — down-payment floor-to-≤
check('FR-008o.1: applicant 35% → 30 band', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    pricing: {
      ...skeleton.pricing,
      rateByDownPaymentPercent: {
        '30': { value: '25.5000' },
        '40': { value: '23.5000' },
        '45': { value: '22.5000' },
        '50': { value: '22.2500' },
        '60': { value: '21.7500' },
      },
    },
  };
  const ctx: ApplicantContext = { downPaymentPercent: 35 };
  const result = evaluatePricing(cfg, ctx);
  assert.equal(result.matchedLevel, 'rateByDownPaymentPercent');
  assert.equal(result.effectiveRatePercent, '25.5000');
});

check('FR-008o.1: applicant 65% → 60 band (highest defined)', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    pricing: {
      ...skeleton.pricing,
      rateByDownPaymentPercent: {
        '30': { value: '25.5000' },
        '60': { value: '21.7500' },
      },
    },
  };
  const result = evaluatePricing(cfg, { downPaymentPercent: 65 });
  assert.equal(result.effectiveRatePercent, '21.7500');
});

check('FR-008o.1: applicant 20% → no match → falls through to baseRate', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    pricing: {
      ...skeleton.pricing,
      baseRatePercent: '26.0000',
      rateByDownPaymentPercent: {
        '30': { value: '25.5000' },
      },
    },
  };
  const result = evaluatePricing(cfg, { downPaymentPercent: 20 });
  assert.equal(result.matchedLevel, 'baseOrCurrentEffectiveRate');
  assert.equal(result.effectiveRatePercent, '26.0000');
});

// FR-008p.1 — asset-value band single upper-band fallthrough
check('FR-008p.1: 3M car against >4M band → falls through', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    pricing: {
      ...skeleton.pricing,
      baseRatePercent: '26.0000',
      rateByAssetValueBand: {
        '4000001': { value: '24.5000' },
      },
    },
  };
  const result = evaluatePricing(cfg, { assetValueEGP: 3000000 });
  assert.equal(result.matchedLevel, 'baseOrCurrentEffectiveRate');
});

// FR-008b cascade ordering — rateByTenor wins over rateByEmploymentType
check('FR-008b: rateByTenor wins over rateByEmploymentType', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    pricing: {
      ...skeleton.pricing,
      baseRatePercent: '26.0000',
      rateByEmploymentType: { salaried: { value: '24.0000' } },
      rateByTenor: { '60': { value: '23.0000' } },
    },
  };
  const result = evaluatePricing(cfg, { employmentType: 'salaried', tenorMonths: 60 });
  assert.equal(result.matchedLevel, 'rateByTenor');
  assert.equal(result.effectiveRatePercent, '23.0000');
});

// FR-005c.1 — wealth gate AND
check('FR-005c.1: AND — both gates pass', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    eligibility: {
      ...skeleton.eligibility,
      minBankStatementBalanceEGP: '100000000',
      minAssetsValueEGP: '7000000',
    },
  };
  const result = evaluateWealthGate(cfg, {
    bankStatementBalanceEGP: 120000000,
    assetsValueEGP: 8000000,
  });
  assert.equal(result.passes, true);
});

check('FR-005c.1: AND — bank balance fails', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    eligibility: {
      ...skeleton.eligibility,
      minBankStatementBalanceEGP: '100000000',
      minAssetsValueEGP: '7000000',
    },
  };
  const result = evaluateWealthGate(cfg, {
    bankStatementBalanceEGP: 50000000,
    assetsValueEGP: 8000000,
  });
  assert.equal(result.passes, false);
  assert.equal(result.failingGate, 'minBankStatementBalance');
});

check('FR-005c.1: AND — null gate ignored', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    eligibility: {
      ...skeleton.eligibility,
      minBankStatementBalanceEGP: '100000000',
      // minAssetsValueEGP not set
    },
  };
  const result = evaluateWealthGate(cfg, { bankStatementBalanceEGP: 120000000 });
  assert.equal(result.passes, true);
});

// FR-003a — qualitativeReviewMaxEGP only applies with operator approval
check('FR-003a: no approval → base maxEGP', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    loanLimits: {
      minAmountEGP: '100000',
      maxAmountEGP: '2000000',
      qualitativeReviewMaxEGP: '3000000',
    },
    eligibility: { ...skeleton.eligibility, requiresQualitativeReview: true },
  };
  const result = evaluateLoanLimit(cfg, {});
  assert.equal(result.maxAmount, '2000000');
  assert.equal(result.upliftApplied, false);
});

check('FR-003a: operator approval → uplift', () => {
  const cfg: BankProgramConfig = {
    ...skeleton,
    loanLimits: {
      minAmountEGP: '100000',
      maxAmountEGP: '2000000',
      qualitativeReviewMaxEGP: '3000000',
    },
    eligibility: { ...skeleton.eligibility, requiresQualitativeReview: true },
  };
  const result = evaluateLoanLimit(cfg, { qualitativeReviewApproved: true });
  assert.equal(result.maxAmount, '3000000');
  assert.equal(result.upliftApplied, true);
});

console.log(process.exitCode ? '\n✗ FAILURES' : '\n✓ ALL CASCADE CHECKS PASS');
