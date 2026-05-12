# Feature Specification: Matching Engine — POST /api/v1/apply with Ranked Offers

**Feature Branch**: `003-matching-engine-post`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "Matching Engine — POST /api/v1/apply with Ranked Offers"

## Summary

This feature delivers Masrafy's core IP: a pure matching engine that consumes a user's complete loan-application profile, evaluates eligibility + tier resolution + income computation + DBR + approval-probability across all active bank programs (feature 002), and returns a ranked list of bank-offer cards with installment, fees, required documents, and explanation strings. Surfaced via a mobile-authenticated HTTP endpoint and an internal staff list/detail view. The engine itself is a dependency-free pure module — testable offline with fixture data, importable by future ML/recommendation features, and never branches on bank identity (banks are data, FR-008b cascade from feature 002 is the contract).

Per Constitution Principle V, this is the bounded module the rest of the platform orbits. Without it, the 20 ABK Egypt programs configured in feature 002 produce no offers.

## Clarifications

### Session 2026-05-12

- Q: How long does the platform retain `BankOffer` snapshots and `Application` records? → A: 24 months active retention in the live PostgreSQL store, then automatic move to a 7-year compressed audit tier (Egyptian Central Bank pattern). Live store supports operator queries, user re-applies, and analytics for 24 months. After 24 months, rows are migrated to an audit tier (cold storage, compressed) accessible to compliance review only. Total 7-year retention from `Application.createdAt`. User-triggered right-to-erasure requests (GDPR-equivalent under Egyptian Personal Data Protection Law) zero-out PII in BOTH tiers but preserve a tombstone record with `applicationId` + `programCode` + `effectiveRatePercent` + audit timestamps (no PII) for regulator inspection.
- Q: How does the matching engine detect a program "prefers Cat-A" for the FR-033 approval-probability bias? → A: Implicit derivation from existing pricing-tier keys. When the program's `pricing.rateByTransferType` map contains a key starting with `payroll_cat_a` (or any key matching the `^payroll_cat_a` regex), the engine flags the program as "prefers Cat-A" for scoring purposes. ZERO new schema fields. Banks already encode the preference by quoting a Cat-A-specific rate; the engine reads the existing configuration. Cat-A detection on the applicant side uses `applicantProfile.employment.companyType === 'cat_a'` (a value sourced from the platform-enumeration registry).
- Q: What is the canonical trigger matrix for the suggestions engine (FR-047)? → A: Greedy-by-impact matrix. For each failure cluster, the engine emits MULTIPLE applicable suggestions ranked by `programsUnlocked` (descending). `DBR_EXCEEDED` → `SUGGEST_REDUCE_AMOUNT` (always) + `SUGGEST_PAY_DOWN_OBLIGATIONS` (when obligations > 0) + `SUGGEST_EXTEND_TENOR` (when applicant's preferred tenor < program max). `AMOUNT_OUT_OF_RANGE` (high) → `SUGGEST_REDUCE_AMOUNT` to lowest-program-max. `AMOUNT_OUT_OF_RANGE` (low) → `SUGGEST_INCREASE_AMOUNT` to highest-program-min. `TENOR_OUT_OF_RANGE` → `SUGGEST_REDUCE_TENOR` or `SUGGEST_EXTEND_TENOR` to nearest valid. `INCOME_TOO_LOW` / `AGE_NOT_ELIGIBLE` → `SUGGEST_GUARANTOR` only (cannot increase income or reduce age via UI). `MISSING_*` records → `SUGGEST_UPLOAD_RECORD` per missing record type. Each suggestion's `programsUnlocked` count MUST be computed by re-running the eligibility check with the hypothetical adjustment applied.
- Q: Is the `Application.status = 'draft'` state persisted (visible to staff before matching completes) or transient (only exists in-transaction)? → A: Transient (single-transaction). The endpoint runs validation → application INSERT with `status='draft'` → engine evaluation → `BankOffer` INSERTs → status UPDATE to `matched` or `no_match` → COMMIT, all inside one Postgres transaction. Staff NEVER observe a `draft` row in the applications list. Engine failures roll back the transaction cleanly with ZERO half-finished applications. The `draft` enum value remains documented for completeness (and for the rare auditor-grade introspection that walks the audit log) but is INVISIBLE to operator queries.
- Q: What rate-limit tier applies to the apply endpoint beyond `Idempotency-Key`? → A: Tiered limits — 30 submissions per hour per HMAC mobile client AND 5 submissions per hour per applicant fingerprint (`hash(nationalId)` when present, else `hash(deviceId + sourceIp)` for guest mode). Whichever bucket trips first returns `429 RATE_LIMITED`. Reuses the `@nestjs/throttler` Redis-backed stack from feature 001. Bucket counters operate on sliding-window 1 hour. Excludes idempotent re-submissions (same Idempotency-Key + same payload) — those serve from cache and do NOT count against the limit.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Applicant submits profile and receives ranked offers (Priority: P1)

A user (mobile applicant or Postman tester) submits the full 5-step-wizard profile to the apply endpoint. The platform validates the payload, verifies the request-signing token, runs the matching engine against every active bank program, snapshots the resulting offers immutably, and returns the ranked list with installment, effective rate, approval probability, fees breakdown, and required documents per offer.

**Why this priority**: Without this story, the entire product produces ZERO outputs. Every other story depends on offers existing. This is the value moment for the user and the moment the engine's IP becomes visible.

**Independent Test**: Submit a signed request with a known-good government-employee profile (age 35, Cat-A payroll to ABK 15,000 EGP, CD 80,000 EGP, requesting 200,000 EGP / 48 months, priority `lowest_installment`). The response MUST include at least three matched offers, the CD-Holders program MUST be present, the cheapest-installment offer MUST come first in the array, and the offer's installment MUST be reproducible from the engine's pure function with the same inputs (deterministic).

**Acceptance Scenarios**:

1. **Given** a valid signed request with a complete applicant profile that satisfies at least one active program's eligibility, **When** the engine runs, **Then** the response includes one or more `BankOffer` records, each with `monthlyInstallmentEGP`, `effectiveRatePercent`, `approvalProbabilityPercent`, `feesBreakdown`, `requiredDocuments[]`, `matchReasons[]`, ordered by the applicant's submitted `priority`.
2. **Given** an applicant with multiple eligible programs, **When** priority is `lowest_installment`, **Then** offers are sorted ascending by monthly installment (ties broken by lower rate, then higher approval probability).
3. **Given** an applicant with multiple eligible programs, **When** priority is `lowest_interest`, **Then** offers are sorted ascending by `effectiveRatePercent`.
4. **Given** an applicant with multiple eligible programs, **When** priority is `fastest_approval`, **Then** offers are sorted descending by `approvalProbabilityPercent`.
5. **Given** an applicant with multiple eligible programs, **When** priority is `least_paperwork`, **Then** offers are sorted ascending by required-document count, ties broken by descending approval probability.
6. **Given** a successful match, **When** the response is rendered, **Then** the envelope is `{ success: true, data: { applicationId, matchedOffers: [...], summary: { totalProgramsChecked, eligiblePrograms, bestInstallment, bestRate } } }`.
7. **Given** a successful match, **When** the matching engine persists offer rows, **Then** each `BankOffer` snapshots the program's `programCode`, version, effective rate, installment, fees, and document list at match time — and is NEVER mutated when the source program later changes (FR-020 from feature 002).
8. **Given** a successful match, **When** the engine completes, **Then** a discrete audit event `application.matched` is emitted with the application id, programs-checked count, eligible-count, duration milliseconds, and correlation id — and contains ZERO applicant PII.
9. **Given** a successful match, **When** the engine evaluates each program, **Then** for each program's effective rate the cascade trace (matched cascade level, derivation chain if present) is attached to the offer's `cascadeTrace` field so staff can reproduce the math on the detail view.
10. **Given** an applicant request runs against the same 20-program catalog with the same inputs, **When** the engine evaluates 1,000 sampled times, **Then** each run produces bit-identical offers in identical order (deterministic — SC-002).

---

### User Story 2 — Internal staff browses applications + inspects matched offers (Priority: P1)

Internal staff (admin, super_admin, viewer) open the applications list, filter by status / loan purpose / date range, click into any application, and see the applicant's profile (PII-masked) alongside the full ranked offer cards, failed-check reasons per ineligible program, and the engine's matching trace.

**Why this priority**: Operational visibility is required from day one — when a user calls support saying "why didn't bank X match me?", a staff member needs to see exactly which checks failed AND the parameters the engine used. Without this view, support cannot answer.

**Independent Test**: Sign in as a viewer role, open `/applications` in the dashboard, confirm the list paginates and filters work. Click an application produced by Story 1. Confirm the detail view shows: full profile (PII masked), ALL matched offer cards in priority order, a "Programs not matched" section listing each program with its failing-check error codes, the engine's `duration_ms`, the cascade trace per offer, and an audit timeline. Confirm the page is RTL-clean in Arabic mode.

**Acceptance Scenarios**:

1. **Given** any staff role signed in, **When** they visit `/applications`, **Then** the paginated list renders with status / date / loan-purpose filters and search by application id.
2. **Given** any staff role opens an application's detail page, **When** the page renders, **Then** they see the applicant profile with PII masked per the platform's masking rules (Principle VI), the ranked offer cards (same shape as the mobile response), and a "Why these programs didn't match" section keyed by program code → failing-check error codes.
3. **Given** a viewer role, **When** they open the detail page, **Then** they see all data but no write actions (re-run matching is disabled).
4. **Given** an admin or super_admin role, **When** they open the detail page, **Then** they additionally see a "Re-run match" action (P2 — see User Story 4) and an audit-timeline drawer.
5. **Given** the applications list is filtered to "no-match" status, **When** the user opens any row, **Then** the consolidated failure summary + suggestions (from User Story 3) are visible alongside the failing-check breakdown.
6. **Given** an offer carries a `cascadeTrace`, **When** the staff inspects it, **Then** the trace is rendered as the matched cascade level + the derivation chain (e.g., "rate 24.5% = 25.5% from down-payment band − 1% high-value-car discount").
7. **Given** the applicant submitted in Arabic locale, **When** staff toggle the dashboard to Arabic, **Then** the page direction flips RTL, monetary values render with Egyptian-Pound locale conventions, and error-code text is Arabic.

---

### User Story 3 — Applicant receives a no-match response with actionable suggestions (Priority: P2)

When the engine evaluates an applicant and ZERO programs satisfy eligibility, the response is a structured failure envelope explaining the primary reason ("DBR exceeded across all programs"), the per-program failing-check breakdown, AND concrete suggestions ("reduce loan to 75,000 EGP to qualify for 3 more programs", "pay down 1,500 EGP/month of existing obligations to unlock 5 programs").

**Why this priority**: A no-match without explanation is a dead end — users abandon. The suggestions engine converts a rejection into a clear corrective action, materially raising successful re-submission rate.

**Independent Test**: Submit a profile guaranteed to fail every program (age 19, no income, no employment, requesting 1,000,000 EGP). Response MUST be `{ success: false, code: 'NO_MATCHING_PROGRAMS', meta: { primaryReason, details, suggestions: [...] } }`. Each suggestion MUST be a structured object — error code keyed (`SUGGEST_REDUCE_AMOUNT`, `SUGGEST_PAY_DOWN_OBLIGATIONS`, `SUGGEST_EXTEND_TENOR`, etc.) with a numeric magnitude and a programs-unlocked count.

**Acceptance Scenarios**:

1. **Given** a profile that fails every program's eligibility, **When** the engine completes, **Then** the response carries `{ success: false, code: 'NO_MATCHING_PROGRAMS', meta: { ... } }` with HTTP 200 (the request is well-formed; the matching is the failure path).
2. **Given** the failure response, **When** the `meta` payload is inspected, **Then** it contains `primaryReason` (the most common failing-check error code across programs), `details[]` (one entry per program with `programCode` + `failedChecks[]`), and `suggestions[]` (zero-or-more suggestion objects).
3. **Given** the suggestions engine, **When** it processes a profile that failed all programs by DBR, **Then** it computes the loan amount that WOULD unlock the largest number of programs and emits `SUGGEST_REDUCE_AMOUNT` with the suggested amount + programs-unlocked count.
4. **Given** the suggestions engine, **When** it processes a profile with age below all minimums, **Then** it emits no `SUGGEST_REDUCE_AMOUNT` (age can't be reduced) — but it MAY suggest `SUGGEST_GUARANTOR` or surface eligibility-windows-by-age info.
5. **Given** the failure path, **When** the audit event fires, **Then** `application.no_match` is emitted with `primaryReason` + `programsChecked` count + correlation id, ZERO PII.

---

### User Story 4 — Idempotent re-submission (Priority: P2)

When an applicant submits the same payload with the same `Idempotency-Key` header within one hour, the platform returns the cached offer set rather than re-running the engine. This protects against flaky network retries, double-tapped submit buttons, and post-payment-redirect re-runs.

**Why this priority**: Mobile networks drop. Without idempotency, a re-tried request produces a new application id, a new set of bank offers, a new audit event, and a confused operator. Idempotency keeps the user experience stable AND prevents engine load amplification during outages.

**Independent Test**: Submit a profile with `Idempotency-Key: foo-123`. Receive offers. Submit the EXACT same profile with the same key within 1 hour → same `applicationId` and same `matchedOffers` returned, no new database rows, no new audit events. Submit DIFFERENT profile with the same key → reject with `IDEMPOTENCY_KEY_MISMATCH`.

**Acceptance Scenarios**:

1. **Given** a successful match for key `K`, **When** the same request body + key arrives within 1 hour, **Then** the engine is NOT re-run; the cached `applicationId` + offers are returned with identical content.
2. **Given** a successful match for key `K`, **When** a DIFFERENT request body arrives with the same key `K`, **Then** the response is `409 IDEMPOTENCY_KEY_MISMATCH` with the offending key.
3. **Given** a key `K` is older than 1 hour, **When** a new request with `K` arrives, **Then** the cache is bypassed and a fresh match runs.
4. **Given** the key is absent, **When** the request arrives, **Then** the engine runs normally without caching.

---

### User Story 5 — Backend engineer runs engine offline against fixtures (Priority: P3)

A backend engineer or future ML / batch-processing feature imports the engine as a pure function and runs it against in-memory program fixtures + applicant profiles — no HTTP, no database, no JWT, no logger required. The engine returns the same `MatchResult[]` shape it would in production.

**Why this priority**: This is the contract that makes the engine reusable. The mobile app team, batch-jobs team, and future ML feature all need to compute "what would the engine do?" without spinning up the full backend. Lowest priority because it's developer-experience, not user-facing — but losing this contract turns the engine into a coupled HTTP handler.

**Independent Test**: Import `match(applicationProfile, programs)` in a developer-discretion sanity-check script. Call it with the 14 golden scenarios + fixture programs. Confirm: zero NestJS dependencies, zero Prisma, zero `fetch`, zero `console.log`. The function returns synchronously. Output is bit-identical across runs.

**Acceptance Scenarios**:

1. **Given** the `matching/` module, **When** a developer imports it from a CLI script, **Then** the function is callable with `(applicationProfile, programs[])` → `MatchResult[]` — no DI, no Prisma client, no HttpClient.
2. **Given** the engine is invoked, **When** it completes, **Then** the result includes per-program `MatchResult` records with `passedChecks[]` + `failedChecks[]` + (if matched) `offer` containing all FR-rate-resolution outputs.
3. **Given** two invocations with identical inputs, **When** results are compared, **Then** they are deep-equal (deterministic; no clocks, no randomness, no env reads).

---

### Edge Cases

- An applicant submits with an `Idempotency-Key` but a malformed body that fails DTO validation: validation errors win (422 with field errors); cache is NOT consulted; key is NOT reserved.
- A bank program's `currentEffectiveRatePercent` is updated AFTER the offer is snapshotted: the offer's stored rate MUST NOT change (FR-020 from feature 002); a re-match against the same applicant produces NEW offers with the new rate, but old offers stay frozen.
- An applicant's profile satisfies a program's eligibility AND would qualify for a tier override, but the override key has been deprecated in the platform enumeration registry (FR-010c from feature 002): the engine MUST surface a warning in the offer's `cascadeTrace` (specifically the deprecated-key id) but still produce the offer using the deprecated key's value — the offer is valid; the warning is operational.
- An applicant with `isGuest = true` submits without authentication: HMAC token MAY identify only the mobile client, not the user; the engine still runs; the `Application` record is created with `userId = null`; audit events log only the correlation id and mobile client id, never PII.
- An applicant submits a request for a currency that NO active program supports: response is `CURRENCY_NOT_SUPPORTED` with the supported-currencies-by-program breakdown.
- The matching engine takes longer than the response timeout (e.g., 500ms target is exceeded due to runaway iteration): the engine MUST timeout-bound itself per request and return a structured `MATCHING_ENGINE_ERROR` with the correlation id — never a 502 / 504 from the platform.
- A program declares `skipDbrCheck = true` (secured loans) AND the applicant has high DBR: the program is eligible (DBR check bypassed), the offer ships, and the offer's `feesBreakdown` includes collateral fees per FR-007 from feature 002.
- The applicant requests a tenor of 360 months but every program caps at 84 months: the engine MUST return all programs eligible at their maximum tenor (with the offer's `requestedTenorMonths` showing the applicant's request and `effectiveTenorMonths` showing the program's cap), and a suggestion `SUGGEST_REDUCE_TENOR` if the cap materially changes the installment.
- The applicant requests an amount BELOW every program's minimum: response is `AMOUNT_OUT_OF_RANGE` with the lowest minimum across programs surfaced as a suggestion.
- Two programs produce the same effective installment + same approval probability: ranking ties are broken by program creation order (earlier-created = first) — deterministic.
- An applicant's `creditCardLimit` is 0 EGP (no card): the income-by-credit-card-limit strategy yields 0 → falls back to the program's base income check. If the base income still fails, the program is rejected with `INCOME_TOO_LOW`.
- The applicant's `bankStatementBalance` is null but the program uses `byBankStatementPercent`: the program is REJECTED with `MISSING_BANK_STATEMENT` — the engine MUST NOT silently treat null as 0 for income computation.
- The fee-waiver penalty (+2% per Constitution) interacts with a program that has BOTH `feeWaiverEnabledAtRatePercent` + `feeWaiverPenaltyRatePercent` configured: the engine applies them per the FR-008j/k order from feature 002 — admin fee waiver first, then penalty rate added.
- Multi-currency programs (EGP/USD/EUR) MUST quote the offer in the requested currency only; the engine selects the currency-specific rate / min / max per FR-008g from feature 002.

## Requirements *(mandatory)*

### Functional Requirements

**Matching engine (pure module)**

- **FR-001**: System MUST expose a pure function `match(applicationProfile, programs[])` that takes a structured applicant profile and a list of active bank programs, evaluates each program independently, and returns a structured `MatchResult[]` carrying matched offers + per-program failing-check breakdowns.
- **FR-002**: The matching engine MUST be a self-contained module with ZERO imports from the HTTP layer, the database access layer, application-level logging, or any side-effecting service. The same module MUST be importable by a CLI script, a batch-job feature, and a future ML feature.
- **FR-003**: The matching engine MUST consume the bank-program configuration READ-ONLY (feature 002's `BankProgram` aggregate); it MUST NOT mutate any program field, and it MUST NOT branch on `programCode` identifiers (Principle II — banks are data).

**Eligibility evaluation**

- **FR-004**: For each program, the engine MUST evaluate every eligibility dimension defined in feature 002's `EligibilityConfig`: accepted employment types, age (with self-employed bounds when present), min monthly income (with self-employed minimum), min months in job, accepted loan purposes, accepted salary-transfer types, dbrCapPercent, and every required-X boolean flag (requiresCD, requiresAutoLoanAtABK, requiresAutoLoanAtOtherBank, requiresCreditCardAtOtherBank, requiresCompoundProperty, requiresCollateral, requiresClubMembership, requiresExistingLoan, requiresFRMUVerification, requiresQualitativeReview, requiresNoDocuments).
- **FR-005**: For wealth-tier programs (FR-005c from feature 002), the engine MUST evaluate `minBankStatementBalanceEGP` AND `minAssetsValueEGP` as an AND when both are configured (FR-005c.1).
- **FR-006**: For programs with `performanceCriteria` configured (buyout + cross-sell), the engine MUST evaluate `requiredMOBMonths`, `bkt1NoHitWithinMonths`, `bkt2NoHitWithinMonths`, and `requireCurrentLoanStatus`. Evidence source is hybrid per the feature-002 clarification: applicant-declared values are authoritative for the offer math; bureau auto-verification status only changes the `selfDeclared` badge on the offer.
- **FR-007**: For programs with `requiresQualitativeReview = true`, the engine MUST mark the resulting offer with a `qualitativeReviewBadge` flag; the offer's effective loan ceiling is the standard `maxEGP` (not the uplift). The uplift to `qualitativeReviewMaxEGP` is applied ONLY after an operator approves the badge — which is OUT OF SCOPE for this feature (see FR-003a from feature 002).
- **FR-008**: For programs with `requiresNoDocuments = true`, the engine MUST evaluate the program ONLY when the applicant did NOT upload income documents AND the request amount is within the program's `loanLimits.maxEGP`; otherwise the program is excluded with `requiresNoDocuments` violation (FR-005d from feature 002).
- **FR-009**: The engine MUST evaluate currency match — if `applicantProfile.requestedCurrency` is not in `program.currencies[]`, the program is excluded with `CURRENCY_NOT_SUPPORTED` failure (FR-008h).

**Income computation (income-assumption strategy)**

- **FR-010**: When `program.incomeAssumption.strategy = 'declared'`, the engine MUST use `applicantProfile.employment.monthlyNetSalaryEGP` as the income-of-record.
- **FR-011**: When `strategy = 'byYearsInJob'` or `'byYearsInPractice'`, the engine MUST select the income from the `incomeTable` band whose `[minYears, maxYears]` covers the applicant's years value.
- **FR-012**: When `strategy = 'byProfessorRank'`, the engine MUST look up the income from `rankIncomeMap[applicantProfile.employment.professorRank]`. Missing rank → reject the program with `INCOME_LOOKUP_FAILED`.
- **FR-013**: When `strategy = 'byMilitaryGrade'`, the engine MUST look up the income from `gradeIncomeMap[applicantProfile.employment.militaryGrade]`. Missing grade → reject the program with `INCOME_LOOKUP_FAILED`.
- **FR-014**: When `strategy = 'byCDValue'`, the engine MUST compute `min(cdValueEGP * cdIncomePercent, totalDepositsEGP * cdIncomePercentOfDeposits)` if `combinationRule = 'lesser_of'` (else max), clamped to `cdIncomeMinEGP` floor. Missing CD record → reject with `MISSING_CD_RECORD`.
- **FR-015**: When `strategy = 'byCarInstallment'`, the engine MUST compute `min(carInstallmentEGP * carInstallmentMultiplier, autoLoanAmountEGP * carLoanAmountPercent)` if both fields are present (whichever-yields-less). Missing car loan → reject with `MISSING_CAR_LOAN_RECORD`.
- **FR-016**: When `strategy = 'byCarLoanAmount'`, the engine MUST compute `autoLoanAmountEGP * carLoanAmountPercent`. Missing → reject with `MISSING_CAR_LOAN_RECORD`.
- **FR-017**: When `strategy = 'byCreditCardLimit'`, the engine MUST compute `creditCardLimitEGP * creditCardLimitMultiplier`. Zero limit → 0 income → falls through to base income check.
- **FR-018**: When `strategy = 'byBankStatementPercent'`, the engine MUST compute `bankStatementBalanceEGP * bankStatementPercent / 100`. Missing balance → reject with `MISSING_BANK_STATEMENT`.

**Tier resolution (FR-008b/c/d cascade from feature 002)**

- **FR-019**: The engine MUST resolve the program's effective rate via the FROZEN pricing cascade order from FR-008b (feature 002): `rateByTenor → rateByTransferType → rateByDownPaymentPercent → rateByCustomerProgramTier → rateByAssetValueBand → rateByLoanAmountBand → rateBySeniority → rateByEmploymentType → (isVariableRate ? currentEffectiveRate : baseRate)`. The first matching tier wins; no composition / blending across tiers.
- **FR-020**: The engine MUST honor the floor-to-nearest-band-≤-applicant rule (FR-008o.1, FR-008p.1) for range-keyed tiers (`rateByDownPaymentPercent`, `rateByAssetValueBand`, `rateByLoanAmountBand`).
- **FR-021**: The engine MUST resolve the program's effective loan limit via the FROZEN loan-limit cascade (FR-008c).
- **FR-022**: The engine MUST resolve the program's effective tenor cap via the FROZEN tenor cascade (FR-008d). If the applicant's `preferredTenorMonths` exceeds the program's effective `maxMonths`, the offer caps at `maxMonths` (offer carries `requestedTenorMonths` AND `effectiveTenorMonths`).
- **FR-023**: For variable-rate programs (`isVariableRate = true`), the engine MUST use `currentEffectiveRatePercent` as the rate-of-record. The cascade's bottom-of-stack substitution applies per feature 002 FR-008b.
- **FR-024**: For buyout programs, the engine MUST compute the effective rate as `original_loan_rate + buyoutRateDeltaPercent` (delta is usually negative) clamped to `buyoutRateMinFloorPercent` (FR-008m from feature 002). The applicant-declared `original_loan_rate` is authoritative; bureau auto-verification status only changes the `selfDeclared` badge on the offer.
- **FR-025**: The engine MUST attach the cascade trace (matched cascade level + derivation chain if present per FR-008s) to every matched offer's `cascadeTrace` field for staff inspection.

**Installment + fees + DBR computation**

- **FR-026**: The engine MUST compute the monthly installment via the standard amortization formula PMT(P, r, n) where P = loan amount, r = monthly rate (annual rate / 100 / 12), n = months. Banker's rounding to 2 decimal places on the final value.
- **FR-027**: The engine MUST compute the per-offer fees breakdown using the program's `FeesConfig` (FR-007 from feature 002): admin fee (percentage of loan amount), stamp duty, life insurance (mandatory or above `lifeInsuranceMinLoanEGP` threshold), late-payment fee (informational), payoff fees (informational), plus any flat collateral fees on secured loans.
- **FR-028**: When the program has `feeWaiverEnabledAtRatePercent` configured AND the applicant's effective rate ≥ that threshold AND tenor ≥ `feeWaiverMinTenorMonths`, the engine MUST mark admin fees as WAIVED on the offer (FR-008j).
- **FR-029**: When admin fees are waived AND tenor ≥ `feeWaiverPenaltyMinTenorMonths`, the engine MUST add `feeWaiverPenaltyRatePercent` to the offer's effective rate (FR-008k). Default penalty = 2.0 %.
- **FR-030**: When the resulting offer waives mandatory life or lease insurance AND tenor ≥ `insuranceWaiverPenaltyMinTenorMonths`, the engine MUST add `insuranceWaiverPenaltyRatePercent` to the effective rate (FR-008r). The two penalties STACK independently when both apply.
- **FR-031**: The engine MUST compute the applicant's debt-burden ratio (DBR) as `(existingMonthlyObligationsEGP + creditCardLimitEGP * 0.05 + newInstallmentEGP) / effectiveMonthlyIncomeEGP * 100`. If the program has `skipDbrCheck = true`, the engine MUST bypass this check (FR-005 from feature 002). Otherwise the program is rejected with `DBR_EXCEEDED` when computed DBR > `program.eligibility.dbrCapPercent`.
- **FR-032**: For programs that pass eligibility but exceed the DBR cap at the requested loan amount, the engine MUST compute the MAXIMUM loan amount that keeps DBR ≤ cap via binary search and expose it on the offer as `maxLoanAvailableEGP` — used by the suggestions engine in User Story 3.

**Approval probability**

- **FR-033**: The engine MUST compute an `approvalProbabilityPercent` for every matched offer using a rule-based weighted scoring formula:
  - Base score: 70 points
  - Adjustments (additive):
    - Applicant has a previous bank rejection: −30
    - Age within 3 years of the program's minimum: −10
    - Computed DBR > 40 %: −20
    - Income < program's `minMonthlyIncomeEGP × 1.2`: −10
    - Applicant company is NOT Cat-A (when the program prefers Cat-A — see FR-033a for detection): −15
    - Applicant holds a CD at ABK: +15
    - Applicant has been in their job > 36 months: +10
    - Applicant has salary payroll transfer (vs letter): +10
    - Program is Bankers (low-risk segment): +20
    - Program is Pensions (very stable): +15
  - Final score CLAMPED to [10, 95] — never 0 (engine always allows some chance) and never 100 (engine never promises certainty).
- **FR-033a**: "Program prefers Cat-A" detection (FR-033 bias trigger) MUST be derived implicitly from the program's existing pricing configuration — specifically: a program "prefers Cat-A" iff `pricing.rateByTransferType` contains at least one key matching the regex `^payroll_cat_a` (case-sensitive). NO new schema field is introduced on `EligibilityConfig` or `BankProgram`. Applicant-side Cat-A check uses `applicantProfile.employment.companyType === 'cat_a'` sourced from the platform-enumeration registry.
- **FR-034**: The approval-probability weights MUST be expressed as named constants in a single configuration module (`scoring-weights`); each weight MUST carry a one-line rationale comment. Any weight change MUST trip a code-review block AND require the corresponding golden tests to be re-recorded.
- **FR-035**: The approval-probability formula is rule-based for v1 (no ML). The function MUST be a pure, documented computation — out-of-scope: ML-trained probability models.

**Match result + ranking**

- **FR-036**: Each `MatchResult` MUST carry: `programCode`, `programVersion` (the version at match time), `eligible` (boolean), `passedChecks: string[]` (error-code-keyed list of dimensions that passed), `failedChecks: string[]` (error-code-keyed list of dimensions that failed; empty when `eligible = true`), and (when eligible) an `offer` payload.
- **FR-037**: The `offer` payload MUST include: `bankName`, `programFriendlyName`, `effectiveRatePercent`, `monthlyInstallmentEGP`, `requestedLoanAmountEGP`, `effectiveLoanAmountEGP` (the lesser of requested + program cap), `requestedTenorMonths`, `effectiveTenorMonths`, `feesBreakdown` (object with named fee components), `approvalProbabilityPercent`, `requiredDocuments[]`, `matchReasons: string[]` (error-code-keyed; e.g., `MATCH_HAS_CD`, `MATCH_PAYROLL_CAT_A`), `cascadeTrace`, `currency`, and `qualitativeReviewBadge` (boolean) + `selfDeclared` (boolean) when applicable.
- **FR-038**: All error-code strings (in `passedChecks`, `failedChecks`, `matchReasons`, `code` fields) MUST be stable identifiers — never English prose crossing the API boundary (Principle III).
- **FR-039**: The engine MUST apply the applicant's `priority` to order matched offers per the rules in Acceptance Scenario US1 #2–#5. Ties MUST be broken deterministically (lower rate first, then higher approval probability, then earlier program creation order).
- **FR-040**: The engine MUST produce ZERO offers (eligible-count = 0) when no program satisfies eligibility — and the suggestions engine (User Story 3) takes over to produce actionable advice.

**Application submission endpoint**

- **FR-041**: System MUST expose a mobile-authenticated POST endpoint that accepts the full applicant profile, validates the DTO at the API boundary, verifies the request-signing token (Principle XIII), and inside a SINGLE database transaction: creates an `Application` record (status = `draft`), runs the matching engine, persists `BankOffer` rows for each matched program (Principle I — immutable snapshot), updates the application status to `matched` (or `no_match`), and commits. On engine failure the transaction MUST roll back cleanly — no orphan `Application` or `BankOffer` rows survive. Staff queries (FR-050) MUST exclude rows where `status = 'draft'`. The endpoint returns the ranked offers in the canonical response envelope (Principle XIV).
- **FR-042**: The applicant profile DTO MUST cover: `age` (18–75), `loanPurpose` (enum), `requestedAmountEGP` (Decimal, ≥ 5,000), `requestedCurrency` (default EGP), `preferredTenorMonths` (6–360), `priority` (enum: `lowest_installment` | `lowest_interest` | `fastest_approval` | `least_paperwork`), `isGuest` (boolean), `employment` sub-DTO (employmentType, monthlyNetSalaryEGP, monthsInJob, professorRank?, militaryGrade?, yearsInPractice?, salaryTransferType, companyName, companyType), `obligations` sub-DTO (existingMonthlyObligationsEGP, hasCurrentLoan, currentLoanRatePercent?, monthsOnBookCurrentLoan?, bkt1HitWithinMonths?, bkt2HitWithinMonths?), `assets` sub-DTO (cdAtABKValueEGP?, totalDepositsAtABKValueEGP?, bankStatementBalanceEGP?, declaredAssetsValueEGP?, creditCardLimitEGP?, autoLoanAtOtherBankEGP?, autoLoanAtABKEGP?, ownsCompoundProperty?, clubMembership?), and conditional `mortgageDetails` / `carDetails` sub-DTOs when the loan purpose requires.
- **FR-043**: Validation failures MUST return the canonical 422 envelope with field-level error codes (per Principle III + feature 002 FR-013). Authentication failures MUST return 401 with `UNAUTHENTICATED`. HMAC verification failures MUST return 401 with the typed code from Principle XIII.
- **FR-044**: The endpoint MUST honor an OPTIONAL `Idempotency-Key` header: same key + same body within 1 hour → return the cached response. Same key + different body → reject with `IDEMPOTENCY_KEY_MISMATCH`. Cache TTL = 1 hour.
- **FR-045**: The endpoint MUST emit discrete audit events: `application.created`, `application.matched` (success path with duration_ms + programsChecked + eligibleCount), `application.no_match` (failure path with primaryReason + suggestionsCount), `matching.engine.run` (technical event with duration_ms + programsChecked). NONE of these events may contain applicant PII (Principle VI).
- **FR-046**: Every offer row created MUST carry a snapshot of: program code, program version at match time, currency, effective rate, installment, fees breakdown, required documents — and the row is IMMUTABLE post-creation (FR-020 from feature 002 — edits to the source program NEVER mutate offers).

**No-match suggestions engine**

- **FR-047**: When zero programs match, the engine MUST produce zero-or-more structured suggestion objects keyed by error code: `SUGGEST_REDUCE_AMOUNT`, `SUGGEST_INCREASE_AMOUNT`, `SUGGEST_PAY_DOWN_OBLIGATIONS`, `SUGGEST_EXTEND_TENOR`, `SUGGEST_REDUCE_TENOR`, `SUGGEST_GUARANTOR`, `SUGGEST_UPLOAD_RECORD`, `SUGGEST_LOWER_DBR_TARGET`. Each suggestion carries a numeric magnitude (e.g., suggested amount, suggested monthly reduction) AND a `programsUnlocked` count showing how many programs would unlock if the suggestion is acted on. The suggestions array MUST be ordered by `programsUnlocked` descending (highest-impact suggestion first).
- **FR-047a**: Canonical trigger matrix (greedy-by-impact). For each `primaryReason` failure cluster, the engine MUST emit the listed suggestions; each suggestion's `programsUnlocked` MUST be computed by re-running the eligibility check with the hypothetical adjustment applied:
  - `DBR_EXCEEDED` → `SUGGEST_REDUCE_AMOUNT` (always) + `SUGGEST_PAY_DOWN_OBLIGATIONS` (when `obligations > 0`) + `SUGGEST_EXTEND_TENOR` (when applicant's `preferredTenorMonths < program.tenor.maxMonths` for any program).
  - `AMOUNT_OUT_OF_RANGE` (requested > every program max) → `SUGGEST_REDUCE_AMOUNT` with magnitude = the largest `program.loanLimits.maxEGP` in EGP across all programs.
  - `AMOUNT_OUT_OF_RANGE` (requested < every program min) → `SUGGEST_INCREASE_AMOUNT` with magnitude = the smallest `program.loanLimits.minEGP`.
  - `TENOR_OUT_OF_RANGE` → `SUGGEST_REDUCE_TENOR` or `SUGGEST_EXTEND_TENOR` to the nearest valid program tenor (closest in months).
  - `INCOME_TOO_LOW` → `SUGGEST_GUARANTOR` only. The engine MUST NOT emit `SUGGEST_REDUCE_AMOUNT` here (lowering amount usually doesn't fix income gates; programs typically check absolute income, not amount-derived income).
  - `AGE_NOT_ELIGIBLE` → `SUGGEST_GUARANTOR` only (FR-049). Age cannot be reduced.
  - `MISSING_CD_RECORD` / `MISSING_CAR_LOAN_RECORD` / `MISSING_BANK_STATEMENT` → `SUGGEST_UPLOAD_RECORD` per missing record type, with magnitude = the count of programs that would unlock once the record is provided.
  - When multiple failure clusters apply (e.g., DBR + tenor out of range simultaneously), the engine MUST emit suggestions for ALL applicable clusters, ranked by combined `programsUnlocked` descending.
- **FR-048**: The suggestions engine MUST be a pure helper alongside the matching engine — same dependency-free contract (FR-002).
- **FR-049**: When the primary failure reason is `AGE_NOT_ELIGIBLE`, the suggestions engine MUST NOT emit `SUGGEST_REDUCE_AMOUNT` (age can't be reduced); it MAY emit `SUGGEST_GUARANTOR` and surface the eligibility-windows-by-age info.

**Staff applications list + detail (admin dashboard)**

- **FR-050**: Internal staff MUST be able to list applications with pagination, filter by status (`draft` | `matched` | `no_match`), filter by loan purpose, filter by date range, and search by application id.
- **FR-051**: Staff MUST be able to open any application's detail view showing: the applicant profile with PII masked (national ID masked to last-4 digits, phone masked to last-2, email masked except first character + domain), the ranked offer cards, the "Programs not matched" section keyed by program code → failed-check error codes, the engine's matching trace (duration, programs checked, primary failure reason if applicable), and the application's audit timeline.
- **FR-052**: Offer cards on the detail view MUST render per the design tokens established in feature 001 + feature 002 (brand-navy primary, tonal-accent CTAs, Cairo font, tabular numerals on monetary fields).
- **FR-053**: The detail page MUST be RTL-clean in Arabic mode and LTR in English mode (FR-035 from feature 002).
- **FR-054**: The applications list + detail must respect role-based read permissions; all three roles (viewer / admin / super_admin) MAY read; write actions (the future "re-run match" for admins) are OUT OF SCOPE for this feature unless explicitly chosen during planning.

**Error codes added by this feature**

- **FR-055**: The same-PR error-code-translation contract from feature 001 + feature 002 applies. New codes introduced by this feature:
  - `NO_MATCHING_PROGRAMS` — engine found zero eligible programs (HTTP 200 with `success: false`)
  - `INCOME_TOO_LOW` — applicant income below every program's minimum
  - `AGE_NOT_ELIGIBLE` — applicant age outside every program's range
  - `DBR_EXCEEDED` — applicant DBR exceeds every program's cap at the requested amount
  - `TENOR_OUT_OF_RANGE` — applicant requested tenor outside every program's range
  - `AMOUNT_OUT_OF_RANGE` — applicant requested amount outside every program's min/max
  - `CURRENCY_NOT_SUPPORTED` — applicant currency outside every program's `currencies[]`
  - `MISSING_CD_RECORD` / `MISSING_CAR_LOAN_RECORD` / `MISSING_BANK_STATEMENT` — income strategy required a record the applicant didn't provide
  - `INCOME_LOOKUP_FAILED` — income strategy required a rank/grade that wasn't in the lookup map
  - `MATCHING_ENGINE_ERROR` (HTTP 500) — internal engine failure
  - `IDEMPOTENCY_KEY_MISMATCH` (HTTP 409) — same idempotency key with a different body
  - `MATCH_HAS_CD` / `MATCH_PAYROLL_CAT_A` / `MATCH_AGE_OK` / `MATCH_INCOME_OK` / `MATCH_TENURE_OK` etc. — positive-side error codes for the offer's `matchReasons[]` list
  - `SUGGEST_REDUCE_AMOUNT` / `SUGGEST_INCREASE_AMOUNT` / `SUGGEST_PAY_DOWN_OBLIGATIONS` / `SUGGEST_EXTEND_TENOR` / `SUGGEST_REDUCE_TENOR` / `SUGGEST_GUARANTOR` / `SUGGEST_UPLOAD_RECORD` / `SUGGEST_LOWER_DBR_TARGET` — suggestion-engine codes for the no-match response

**Performance + observability**

- **FR-056**: The matching engine's p95 latency MUST be < 500 ms with 20 active bank programs in the catalog. The endpoint p95 (including DTO validation + offer persistence + audit emit) MUST be < 800 ms.
- **FR-057**: The engine MUST emit a `matching.engine.run` discrete event with `duration_ms`, `programsChecked`, `eligibleCount`, and `correlationId` — never applicant PII (Principle VII).
- **FR-058**: Correlation identifiers from feature 001 MUST flow through to the matched-offer audit events (FR-031 from feature 002).

**Internationalization, accessibility, branding**

- **FR-059**: All operator-visible labels on the applications list + detail page MUST be available in Arabic (primary) and English (secondary), routed through the platform's central error-code-to-message helper.
- **FR-060**: The pages MUST be operable via keyboard alone with visible focus indicators and tap targets ≥ 24 × 24 CSS pixels (WCAG 2.2 AA — consistent with feature 001 + feature 002).
- **FR-061**: All screens introduced by this feature MUST visually conform to the Masrafy brand identity (deep-navy primary, tonal-accent for secondary CTAs, Cairo font, tabular numerals on monetary fields) — consistent with the design tokens established in feature 001 + 002.

**Design pipeline (per Constitution v1.3.0 Principle XXIII)**

- **FR-062**: Each new screen introduced by this feature (applications list, application detail with offer cards, no-match explanation surface) MUST be designed via the platform's `ui-ux-pro-max` design skill BEFORE implementation begins, with the skill's output recorded as a design document in the feature's design folder. After first implementation, each screen MUST receive an `impec` polish pass.

**Retention + right-to-erasure**

- **FR-063**: `Application` + `BankOffer` records MUST remain in the live PostgreSQL store for 24 months from `Application.createdAt`. At the 24-month boundary, an automated archival job MUST transition the application status to `archived` and move the row + its offer rows to a compressed cold-storage tier (object storage). Cold-tier records remain readable for 5 additional years (total retention 7 years from `createdAt`) for compliance review by authorized auditor roles only.
- **FR-064**: System MUST honor user-triggered right-to-erasure requests (Egyptian Personal Data Protection Law equivalent): on receipt of a verified erasure request, the platform MUST zero out PII fields in BOTH live + cold tiers within 30 days but MUST preserve a tombstone record per application carrying ONLY `applicationId`, `programCode` (per offer), `effectiveRatePercent`, `createdAt`, `erasedAt`, and the audit trail — enabling regulator inspection without exposing PII. Application status MUST transition to `erased`.
- **FR-065**: A `data.erasure.completed` discrete audit event MUST be emitted per erasure with `applicationId` count + `correlationId`, ZERO PII. The audit-event row itself is exempt from the same erasure (audit-event immutability — append-only).

**Rate limiting (abuse protection)**

- **FR-066**: The apply endpoint MUST enforce TIERED rate limits beyond idempotency: 30 submissions per HMAC mobile client per rolling hour AND 5 submissions per applicant fingerprint per rolling hour. The fingerprint MUST be `sha256(nationalId)` when the applicant declares one, else `sha256(deviceId + sourceIp)` for guest mode. The first bucket to exceed its limit returns `RATE_LIMITED` (Principle XV; reuses the `@nestjs/throttler` Redis backing from feature 001).
- **FR-067**: Idempotent re-submissions (same `Idempotency-Key` + same payload-hash, served from cache per FR-044) MUST NOT consume a rate-limit bucket — only fresh engine runs count.
- **FR-068**: Rate-limit responses MUST emit a discrete audit event `application.rate_limited` with the bucket that tripped (`hmac_client` vs `applicant_fingerprint`), the fingerprint hash (never raw national id), and the correlation id. ZERO raw PII.

### Key Entities *(include if feature involves data)*

- **Application**: The top-level record of a single submission. Carries an application id (uuid), submitter identifier (or null for guest), submission timestamp, status (`draft` | `matched` | `no_match` | `archived` | `erased`), submission correlation id, the snapshotted applicant profile JSON, the chosen priority, and the resulting summary (`totalProgramsChecked`, `eligibleCount`, `primaryFailureReason` for no-match). Append-only post-creation; the only allowed mutations are status transitions to `archived` (at 24-month boundary, moves to cold tier) or `erased` (user-triggered right-to-erasure under Egyptian PDPL; zeros PII, keeps tombstone fields).
- **BankOffer**: The IMMUTABLE snapshot of a single program's match outcome for a specific application. Carries: applicationId (FK), programCode, programVersion (at match time), currency, effectiveRatePercent, monthlyInstallmentEGP, requestedLoanAmountEGP, effectiveLoanAmountEGP, requestedTenorMonths, effectiveTenorMonths, feesBreakdown (JSONB), approvalProbabilityPercent, requiredDocuments (string[]), matchReasons (string[]), cascadeTrace (JSONB), qualitativeReviewBadge (boolean), selfDeclared (boolean), and createdAt. NEVER mutated post-creation. Indexed on applicationId + programCode.
- **NoMatchSummary**: Embedded in the Application record when status = `no_match`. Carries: primaryReason (error code), perProgramFailures (programCode → failedChecks[]), suggestions (Array of structured suggestion objects with code + magnitude + programsUnlocked).
- **MatchingEngineEvent (audit)**: An append-only record of every engine run. Carries: applicationId, programsChecked, eligibleCount, duration_ms, primaryFailureReason (if no-match), correlation id, occurredAt. Zero PII.
- **IdempotencyRecord**: Short-lived cache row keyed by idempotency-key + payload-hash. Carries: applicationId, payloadHash, expiresAt (1 hour TTL). On match, the cached `applicationId` is returned with its `BankOffer` rows.
- **ScoringWeights (configuration)**: A named-constant module of approval-probability weights (base, adjustments, clamp range). Each weight carries a rationale comment. Versioned via code commits; weight changes are explicit code edits subject to PR review.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An applicant whose profile satisfies at least one program's eligibility receives one or more ranked offers, each with all FR-037 fields populated, within p95 < 800 ms end-to-end (validation + matching + persistence + audit). Measurable across 100 sampled requests.
- **SC-002**: The matching engine is deterministic — across 1,000 sampled invocations with identical inputs, every invocation produces bit-identical `MatchResult[]` in identical order. Mismatch rate: 0 %.
- **SC-003**: Across the 14 golden scenarios (see Appendix), each scenario's outcome (programs matched, offer count, the "best offer" by `lowest_installment` priority) is reproducible against fixture data via the pure engine — and the same outcome is reproduced via the HTTP endpoint with HMAC-signed requests.
- **SC-004**: Across 50 applications with an `Idempotency-Key`, re-submitting the same payload within 1 hour returns the same applicationId + offers — and runs the engine zero times. Same key + different payload returns `IDEMPOTENCY_KEY_MISMATCH` 100 % of the time.
- **SC-005**: Every matched offer is an IMMUTABLE snapshot — across 1,000 sampled offers, editing the source bank program AFTER the offer is created leaves the offer's stored values bit-identical. Zero offer mutations (Principle I, FR-020 of feature 002).
- **SC-006**: Across 200 sampled application submissions, every successful match emits exactly one `application.matched` audit event, every no-match emits exactly one `application.no_match`, and every engine invocation emits one `matching.engine.run`. Zero events contain applicant PII.
- **SC-007**: Across the 4 priority options, the order of returned offers is consistent with the documented sort rules (FR-039) across 1,000 sampled multi-offer responses. Zero ordering mismatches.
- **SC-008**: When applicants submit profiles that fail every program, the response is `NO_MATCHING_PROGRAMS` with a populated `meta.suggestions[]` array 100 % of the time — and every suggestion carries a structured `(code, magnitude, programsUnlocked)` triple.
- **SC-009**: The matching engine's p95 latency (engine-only, excluding HTTP / persistence) stays under 500 ms at a catalog of 20 active programs across 1,000 sampled runs.
- **SC-010**: Adding a new bank program through the feature 002 admin UI immediately makes it eligible for matching (within the next match-cycle); no engine-code change required (Principle II). Measurable across 10 sampled program additions covering all income-assumption strategies.
- **SC-011**: A locale switch between Arabic (primary) and English (secondary) updates 100 % of user-visible labels + currency formatting on the staff applications + detail pages. Layout flips RTL in Arabic and LTR in English.
- **SC-012**: A keyboard-only user can navigate the applications list, open an application detail, inspect every offer card, and read the failed-checks section without using a pointing device (WCAG 2.2 AA).
- **SC-013**: The approval-probability formula's outputs match the rule-based weight specification for every golden scenario (the score is reproducible from the weights — no hidden adjustments). Verified across 100 sampled offers via the developer-discretion sanity script.
- **SC-014**: Cascade trace + derivation chain (FR-008s from feature 002) appears on every matched offer for programs that carry derivation data — and the trace's arithmetic reconciles bit-identically to the offer's `effectiveRatePercent`.
- **SC-015**: For wealth-tier programs (FR-005c.1), the engine respects the AND combination — across 100 sampled high-balance applicants, each is rejected when EITHER `minBankStatementBalanceEGP` OR `minAssetsValueEGP` is missing.
- **SC-016**: Every new screen introduced by this feature receives both a recorded `ui-ux-pro-max` design pass BEFORE implementation and an `impec` polish pass AFTER first implementation — verified as design + polish artifacts in the feature's design folder at PR time.
- **SC-017**: The fee-waiver penalty (FR-028, FR-029) and insurance-waiver penalty (FR-030) stack independently — across 50 sampled offers where both waivers apply, the effective rate equals base rate + admin-fee-penalty + insurance-penalty (additive, never max-of).
- **SC-018**: An audit-event downstream consumer can replay a matching session by reading the `Application` record + the `BankOffer` snapshots — without re-querying the source bank programs (snapshots are self-contained).
- **SC-019**: The engine's pure-function contract is preserved — a developer-discretion CLI sanity-check script imports `match()` from the engine module, calls it with fixture programs + profiles, and produces the expected `MatchResult[]` — with ZERO NestJS, ZERO Prisma, ZERO HTTP imports surfaced in the dependency graph for the engine module.
- **SC-020**: Retention pipeline correctness — across a synthetic time-travel test of 100 applications created at simulated `now − 24 months − 1 day`, the archival job transitions ALL 100 to `archived` status, moves rows to the cold tier, and removes them from live-store query results within 24 hours of the boundary. Cold-tier reads remain functional for an authorized auditor query.
- **SC-021**: Right-to-erasure SLA — across 50 sampled erasure requests, each completes (PII zeroed in BOTH tiers + status `erased` + audit event emitted) within 30 days. Tombstone records remain present + queryable by application id with ZERO PII fields populated.
- **SC-022**: Rate-limit enforcement — across 1,000 synthetic submissions from a single HMAC client exceeding 30/hour, the 31st onward returns `RATE_LIMITED` 100 % of the time. Across 1,000 submissions from a single applicant fingerprint exceeding 5/hour, the 6th onward returns `RATE_LIMITED` 100 % of the time. Idempotent re-submissions from the same key consume ZERO bucket capacity.

## Assumptions

- This feature ASSUMES the `BankProgram` aggregate from feature 002 is in place, complete with the frozen cascade order (FR-008b/c/d) and the `PlatformEnumeration` registry. If feature 002 is not deployed, this feature does not function.
- This feature ASSUMES the applicant profile is captured upstream by the mobile client's 5-step wizard. The wizard implementation, the document-upload flow, and the user-account-persistence flow are OUT OF SCOPE (separate specifications).
- This feature ASSUMES the request-signing mechanism (Principle XIII) is implemented or will be implemented in parallel by the mobile-platform feature. The matching endpoint requires the signature to verify; the actual signing client-side is the Flutter app's concern.
- The bureau-integration mechanism (Egyptian I-Score) for verifying buyout + performance-criteria evidence is OPTIONAL — when configured + reachable, the engine flags the offer with `selfDeclared = false`. When unavailable, `selfDeclared = true`. The applicant-declared values are authoritative for offer math in BOTH paths (per feature 002 clarification).
- Document upload is OUT OF SCOPE; the offer's `requiredDocuments[]` is a CHECKLIST the applicant will complete in a subsequent flow.
- User account persistence beyond guest mode is OUT OF SCOPE; the `isGuest` flag determines whether the application is anonymous OR linked to a future authenticated user record.
- ML-trained approval probability is OUT OF SCOPE for v1. The rule-based weights in FR-033 are explicit and auditable; an ML model can replace them in a later feature without changing the engine's public contract.
- Actual submission of offers to real bank APIs is OUT OF SCOPE. This feature stops at producing the offer + showing it to the user / staff. Bank-side ingestion is a later integration.
- A "re-run matching" action from the admin dashboard is OUT OF SCOPE for v1 (FR-054). Staff can re-submit the application via the public endpoint if needed.
- Alternative suggestions engines (e.g., "switch to a guarantor-backed program") beyond the basic codes in FR-047 are OUT OF SCOPE — a richer recommendation surface is a future feature.
- The applicant's MOB / I-Score evidence (BKT-1 / BKT-2 hit windows) is collected at the wizard step + sent in the profile DTO. Bureau verification of these values is hybrid per the feature-002 clarification.

## Appendix — Golden Test Scenarios

These scenarios MUST pass — they form the engine's regression bedrock. Each is reproducible against fixture programs (the feature 002 ABK Egypt 20 + salesfloor-egp-2026 + bank-nxt-2026 seeds).

| # | Profile | Expected outcome |
|---|---|---|
| 1 | Government employee, age 35, payroll Cat-A to ABK 15,000 EGP, CD 80,000 EGP at ABK, no existing debt, requesting 200,000 EGP × 48 months, priority `lowest_installment` | At least 3 matches: ABK-CD-HOLDERS (24 % rate, 0 % admin fee), ABK-SALARIED-NO-XFER (27 %), ABK-PAYROLL-CAT-A (22.5 %). Best offer: ABK-PAYROLL-CAT-A by lowest installment OR ABK-CD-HOLDERS by lowest fees. |
| 2 | Self-employed doctor, age 45, 10 years in practice, no declared salary, requesting 500,000 EGP × 60 months | Engine looks up income from `incomeTable` (`byYearsInPractice` strategy) → assumed income 60,000 EGP. ABK-DOCTORS-PRACTICE matches at 30 % rate. |
| 3 | Self-employed business owner, age 30, declared 12,000 EGP, existing loan 3,000 EGP/mo, CC limit 50,000 EGP, requesting 100,000 EGP × 36 months | ABK-SELF-EMP eligible at 28.5 % rate. Critical: DBR check — `(3,000 + 50,000 * 0.05 + newInstallment) / 12,000 * 100` must be ≤ 50 %. If exceeded, returns `DBR_EXCEEDED` + suggestion to reduce amount. |
| 4 | Salaried public-bank banker, age 40, 25,000 EGP income with head-office stamp, requesting 1,500,000 EGP × 84 months | ABK-BANKERS matches at 22 % rate. Public-bank applicant uses 100 % income calculation (vs commercial-bank's 80 %) — net income reads as 25,000 EGP, not 20,000 EGP. |
| 5 | Profile that fails everything: age 19, no income, no employment, requesting 1,000,000 EGP × 60 months | `NO_MATCHING_PROGRAMS` response. `primaryReason = AGE_NOT_ELIGIBLE` (or `INCOME_TOO_LOW` depending on most-common failed check). Suggestions: `SUGGEST_GUARANTOR` (cannot reduce age) + eligibility-windows-by-age info. |
| 6 | Self-employed, age 35, declared 30,000 EGP, requesting 1,500,000 EGP × 60 months | SF-SELF-EMP (sales-floor) matches at 28 % rate (loan amount > 1M tier). Operator-uplift ceiling 3M EGP would unlock after qualitative review — out of scope here; offer caps at maxEGP 2M. |
| 7 | Professor, associate_professor rank, age 50, no declared income, requesting 800,000 EGP × 72 months | ABK-PROFESSORS matches. Engine looks up `rankIncomeMap.associate_professor` → 18,000 EGP. Rate 25.5 %. |
| 8 | Military, senior_officer grade, age 48, no declared income, requesting 600,000 EGP × 60 months | ABK-MILITARY matches. Engine looks up `gradeIncomeMap.senior_officer` → 25,000 EGP. Rate 25 %. |
| 9 | Mortgage applicant, age 38, owns compound apartment, payroll 25,000 EGP, requesting 2,000,000 EGP × 240 months | ABK-COMPOUND-OWNER matches (requires `requiresCompoundProperty = true` + the applicant has it). Rate 25.5 %. |
| 10 | Auto-loan applicant, age 32, requesting 5,000,000 EGP × 60 months at SF-AUTO (sales-floor), 50 % down payment | SF-AUTO matches. Rate cascade: rateByDownPaymentPercent.50 (22.25 %) wins. If car price > 4M EGP, rateByAssetValueBand triggers → 21.25 % (via the seeded derivation `22.25 − 1`). |
| 11 | DBR-heavy applicant: 8,000 EGP income, 5,000 EGP existing obligations, requesting 200,000 EGP × 60 months | DBR computes well above any program's cap. Returns `DBR_EXCEEDED`. `SUGGEST_PAY_DOWN_OBLIGATIONS` with magnitude → reduce obligations by N to unlock M programs. `SUGGEST_REDUCE_AMOUNT` with the engine's computed `maxLoanAvailableEGP`. |
| 12 | Same as scenario 4 but applicant works at a commercial bank | ABK-BANKERS matches BUT engine uses 80 % income (`commercialBankIncomePercent`) → net 20,000 EGP for DBR computation. Effective installment differs from scenario 4. |
| 13 | Secured-loan applicant, age 55, USD denominated, requesting 100,000 USD × 60 months, collateral value 105,000 USD | ABK-SECURED-LOANS matches. `skipDbrCheck = true` so DBR bypassed. LTV check passes (95 / 105 = 90 % < 95 % LTV ceiling). Currency-specific rate applies. |
| 14 | Buyout applicant, age 42, existing loan at 28 % rate, MOB 18 months, no BKT-1/BKT-2 hits in last 6 months, requesting 500,000 EGP × 60 months | ABK-BUYOUT matches. Engine computes effective rate = `28 − 3 = 25 %`, clamped to `buyoutRateMinFloorPercent` (25 %). Performance-criteria gates pass. Offer flags `selfDeclared = true` if bureau is unavailable. |

The 14 scenarios are the engine's regression bedrock — adding a 21st bank program through the feature 002 admin UI MUST NOT break any of them (FR-033d from feature 002 + Principle II).
