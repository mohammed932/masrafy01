# Cascade Evaluator — Pure Module

Pure TypeScript module. NO NestJS DI, NO Prisma, NO HTTP, NO clocks. Deterministic. Re-evaluating the same `(BankProgramConfig, ApplicantContext)` returns bit-identical results forever.

Two consumers:

1. The future **matching engine** (separate feature) imports it directly via `import { evaluatePricing, evaluateLoanLimit, evaluateTenor, evaluateWealthGate } from '@/bank-programs/cascade/cascade.evaluator'`.
2. The admin **what-if preview** (FR-033e) imports a TypeScript port at `admin/src/app/features/bank-programs/detail/cascade-preview.component.ts`. The two implementations stay in lock-step via the shared types module shape.

## Public surface

```ts
import { evaluatePricing, evaluateLoanLimit, evaluateTenor, evaluateWealthGate, derivationDescription } from './cascade.evaluator';
import type { BankProgramConfig } from './cascade.evaluator';
import type { ApplicantContext, CascadeTraceStep, PricingResult, LoanLimitResult, TenorResult, RateBandValue, DerivationChain } from './cascade.types';
```

## Frozen orders (FR-008b/c/d, FR-008e — reorder = constitution amendment)

- **Pricing**: `rateByTenor → rateByTransferType → rateByDownPaymentPercent → rateByCustomerProgramTier → rateByAssetValueBand → rateByLoanAmountBand → rateBySeniority → rateByEmploymentType → baseOrCurrentEffectiveRate`.
- **Loan limits**: `maxByCDTier → maxByPropertyType → maxByCityTier → maxByTransferType → maxBySalaryCategory → maxByEmploymentType → maxEGP`. Post-cascade FR-003a uplift applies when `eligibility.requiresQualitativeReview === true` AND `ctx.qualitativeReviewApproved === true`.
- **Tenor**: `maxMonthsBySalaryCategory → maxMonthsByEmploymentType → maxMonths`.

## Floor-to-≤ rule (FR-008o.1, FR-008p.1)

Range-keyed tier maps (`rateByDownPaymentPercent`, `rateByAssetValueBand`, `rateByLoanAmountBand`) select the band whose key is the LARGEST numeric value ≤ the applicant's value. Applicant value BELOW every defined band → no match → cascade falls through.

## Wealth-gate AND (FR-005c.1)

`minBankStatementBalanceEGP` AND `minAssetsValueEGP` evaluate as a conjunction when both are configured. Null gates are ignored (not blocking). `evaluateWealthGate(config, ctx)` returns `{ passes, failingGate? }`.

## Determinism guarantees (SC-017, SC-027, SC-029, SC-030)

- No external I/O.
- No clocks / randomness / env reads.
- Frozen-order constants are `const` arrays, not data.
- `evaluatePricing(config, ctx)` returns `{ effectiveRatePercent, matchedLevel, derivationChain?, trace[] }` — `trace[]` is the deterministic execution record for detail-view rendering.

## Sanity checks

Run the developer-discretion check script (research.md R15):

```bash
cd backend
npx tsx src/bank-programs/cascade/cascade.evaluator.checks.ts
```

10 checks cover FR-008b ordering, FR-008o.1 + FR-008p.1 floor-to-≤, FR-005c.1 AND, FR-003a uplift gating.

## Extraction roadmap

When the matching engine lands as a separate feature, this module can be:

1. Lifted into a `packages/cascade-evaluator/` workspace.
2. Imported by `backend/src/bank-programs/` (read-only consumer for the what-if preview backend stub) and by `backend/src/matching/` (the actual engine).

No code outside this module knows the frozen cascade order. Re-ordering remains a single-source-of-truth edit guarded by FR-008e.
