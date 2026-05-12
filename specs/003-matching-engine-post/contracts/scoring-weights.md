# Approval Probability Scoring Weights — Single Source of Truth

**Feature**: 003-matching-engine-post
**Constitution**: Principle V (engine is core IP), Anti-pattern A24 (no probability without documented weights).
**Spec anchor**: FR-033 + FR-034.

This document MIRRORS `backend/src/matching/scoring-weights.ts`. The code module is the runtime source of truth; this document exists for stakeholder review + audit. Both files MUST update in the same PR (FR-034). Reviewer sign-off required on any weight change; the corresponding golden-scenario fixtures must be re-recorded.

---

## Formula

```text
score = BASE
      + (hasPreviousRejection                       ? PREVIOUS_REJECTION : 0)
      + (age < program.eligibility.ageMin + 3       ? AGE_NEAR_MIN       : 0)
      + (computedDBR > 40                           ? HIGH_DBR           : 0)
      + (income < program.eligibility.minMonthlyIncome × 1.2 ? INCOME_NEAR_MIN : 0)
      + (programPrefersCatA && companyType !== 'cat_a' ? NOT_CAT_A      : 0)
      + (hasCDAtABK                                 ? HAS_CD_AT_ABK     : 0)
      + (monthsInJob > 36                           ? LONG_TENURE       : 0)
      + (salaryTransferType === 'payroll' || 'payroll_cat_a/b/c' ? PAYROLL_TRANSFER : 0)
      + (program.productCategory === 'wealth' && match.bankers ? BANKERS_PROGRAM : 0)
      + (program.productCategory === 'pension' ? PENSIONS_PROGRAM : 0)

approvalProbabilityPercent = clamp(score, CLAMP_MIN, CLAMP_MAX)
```

Cat-A detection (`programPrefersCatA`) per FR-033a: derived from `program.pricing.rateByTransferType` key matching the regex `^payroll_cat_a`.

---

## Weights

| Constant | Value | Rationale |
|---|---:|---|
| `BASE` | 70 | Starting point for an average applicant; published baseline so weight deltas read as "above / below average". |
| `PREVIOUS_REJECTION` | −30 | A recent bank rejection in I-Score history is the single strongest negative signal; outweighs most positive adjustments. |
| `AGE_NEAR_MIN` | −10 | Applicants within 3 years of the program's minimum age often fail post-engine underwriting; cushioning here surfaces the risk. |
| `HIGH_DBR` | −20 | Computed DBR > 40 % historically correlates with default; significant negative but not disqualifying. |
| `INCOME_NEAR_MIN` | −10 | Income < 1.2× the program minimum is brittle to expense shocks; flagged but not blocking. |
| `NOT_CAT_A` | −15 | Programs that quote Cat-A-specific rates have underwriters who specialize on Cat-A profiles; non-Cat-A applicants face stricter manual review. |
| `HAS_CD_AT_ABK` | +15 | Holding a CD at the lender is a strong stability signal — deposit history visible, collateral relationship established. |
| `LONG_TENURE` | +10 | > 36 months in the same job correlates with stability and on-time payment behavior. |
| `PAYROLL_TRANSFER` | +10 | Payroll transfer means income is directly observable to the bank; less reliance on documents = faster + more reliable approval. |
| `BANKERS_PROGRAM` | +20 | Bankers segment historically has very low default rates; the program is designed for that population. |
| `PENSIONS_PROGRAM` | +15 | Pension income is government-backed in Egypt; payment is regulator-guaranteed, lowest default tier. |
| `CLAMP_MIN` | 10 | Never report 0 % — there's always some chance an underwriter approves manually. |
| `CLAMP_MAX` | 95 | Never report 100 % — the engine never promises certainty (operator trust + legal posture). |

---

## Change procedure

1. Open a PR editing `backend/src/matching/scoring-weights.ts` AND this document IN THE SAME COMMIT.
2. Update the rationale comment for the changed weight in BOTH files.
3. Re-record the affected golden-scenario fixtures — every scenario in spec Appendix that asserts an `approvalProbabilityPercent` must be re-snapshot.
4. Add a `## Change log` entry below with date, PR link, and one-line reason.
5. Reviewer: at minimum one team member familiar with the underwriting domain (not the PR author). Constitutional reviewer-block applies (Anti-pattern A24).

---

## Change log

- **2026-05-12** — Initial weights for v1 launch. Derived from spec FR-033. No prior version.
