/**
 * WHICH FACT KEY MAY BE MINTED — the only door left on a tick.
 *
 * The domain half of this file is gone with the refusals it pinned: every pool question is
 * tickable now, `monthly_income` and the itemised debts included, so what a fact MEANS is
 * an operator's decision on the product's own board. What remains is the pair of key
 * families the platform computes for itself, where a row would be created, bound, audited,
 * rendered — and never carry an answer.
 *
 * The formerly-refused question codes are pinned as ALLOWED in `product-ask-plan.spec.ts`,
 * where the tick itself is decided.
 */
import { describe, expect, it } from 'vitest';
import {
  RESERVED_FACT_KEYS,
  isReservedFactKey,
} from '@/matching/pipeline/fact-question-eligibility';
import { BANK_AXES } from '@/matching/pipeline/bank-relationship';
import { I_SCORE_FACT_KEY } from '@/matching/pipeline/product-template';

describe('reserved fact keys', () => {
  it('covers the platform-wide I-Score', () => {
    expect(isReservedFactKey(I_SCORE_FACT_KEY)).toBe(true);
  });

  it('covers every derived per-bank axis', () => {
    // A row under one of these is created, bound, audited and rendered — and never carries
    // an answer, because the answer→fact mapper skips derived keys by contract.
    for (const axis of BANK_AXES) {
      expect(isReservedFactKey(axis.factKey)).toBe(true);
      expect(RESERVED_FACT_KEYS).toContain(axis.factKey);
    }
  });

  it('leaves an ordinary key alone', () => {
    expect(isReservedFactKey('owned_unit_type')).toBe(false);
  });
});
