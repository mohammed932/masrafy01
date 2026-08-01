# Phase 0 Research — Simple Program Setup, Banded DBR & Loan Calculator

All Technical Context unknowns resolved here. Each entry: decision, rationale, alternatives.
File references are to the code as it stands on `develop`.

---

## R1 — Where banded DBR lives and how it resolves

**Decision.** Add an optional `dbrBands` array beside the existing `dbrCapPercent` inside the program's `eligibility` JSONB:

```jsonc
"dbrBands": [
  { "upToIncomeEGP": "5000",  "capPercent": "30.0000" },
  { "upToIncomeEGP": "10000", "capPercent": "35.0000" },
  { "upToIncomeEGP": null,    "capPercent": "50.0000" }
]
```

A new pure function in `backend/src/matching/pipeline/dbr.ts`:

```ts
resolveDbrCap(cfg: { dbrCapPercent: string; dbrBands?: DbrBand[] }, recognisedIncome: Decimal): { capPercent: Decimal; bandIndex: number | null }
```

Empty/absent `dbrBands` → the scalar, `bandIndex: null`. Upper bounds are **inclusive**; the last band carries `upToIncomeEGP: null`.

**Rationale.** Matches the existing storage pattern (all program config is JSONB hydrated in the repository, per feature 002 R1), needs no migration for existing rows, and satisfies FR-020 by construction. Resolution stays a pure function inside the engine pipeline, so Principle V holds. Returning `bandIndex` gives FR-021 its audit value for free.

**Alternatives rejected.** (a) Relational `dbr_band` table — a join per program per match for ≤6 rows, and a migration for every program; (b) replacing the scalar outright — breaks FR-020 and forces an admin review pass before matching is trustworthy again; (c) reusing a generic `NumericRule` union from the source plan — attractive long-term, but introducing a rule interpreter across every numeric field is the "generic rules engine" the plan itself defers (§12). Band-only is the smallest correct step.

**Validation** (shared by all three hosts, one validator in `bank-programs/validation/`): ≥1 band; bounds strictly ascending; no duplicate bound; exactly one `null` bound and it is last; each `capPercent` in `[1,100]`; decimal strings only. Failures → `DBR_BANDS_INVALID` with `meta.index`.

---

## R2 — How the four money figures reach the engine

**Decision.** Four **number** questions carry them. The binding from question code → engine field is a **code constant** — `backend/src/matching/pipeline/money-field-bindings.ts` server-side, mirrored in the app's existing mapper files (e.g. `personal_apply_mapper.dart`). It is deliberately NOT a column on `Question`: that would revive the `Question.profileField` / `systemRole` mapping A33 bans and v6.0.0 deleted.

| Engine field | Bound question code | Unit | Bounds |
|---|---|---|---|
| `requestedAmountEGP` | `amount_requested` | EGP | 1 000 … 20 000 000, step 1 000 |
| `preferredTenorMonths` | `repayment_period_months` | months | 6 … 120, step 6 |
| `employment.monthlyNetSalaryEGP` | `monthly_income` | EGP | 1 000 … 5 000 000 |
| `obligations.existingMonthlyObligationsEGP` | `current_installments` | EGP | 0 … 5 000 000 |

The bucket→representative-number maps (`_amountEgp`, `_incomeEgp`, `_installmentsEgp`, `_tenorMonths` in the four `*_apply_mapper.dart` files) are **deleted**.

**Rationale.** Kills the accuracy bug directly: today `egp_150_000_500_000` becomes 300 000 for everyone. Uses columns that already exist (`application_answer.numericValue`). Keeps the binding auditable in one visible place, satisfying FR-048/FR-049.

**Alternatives rejected.** (a) Extra numeric screen after the questionnaire — a second place to collect the same thing; (b) a `systemRole`/`profileField` marker back on `Question` — explicitly forbidden by A33; (c) keeping buckets but moving the numbers to admin config — still an approximation, and the customer sees a payment for an amount they did not ask for.

**Migration note.** Existing published questionnaires answer these as single-choice. The seed adds the number questions and marks the old bucket questions inactive; in-flight applications keep their stored answers (FR-045), and the mapper falls back to a bucket answer only when the number question is absent from the snapshot — a temporary shim removed once the new version is published everywhere.

---

## R3 — Where quote math runs (client vs server)

**Decision.** Server. One new endpoint `POST /api/v1/calculator/quote` handles both modes; the app debounces input by 300 ms and shows a shimmer on the figure area (Principle XXXIV). The pure function `quoteProgram()` in `matching/pipeline/quote.ts` is the single implementation, called by the calculator, the preview, the apply path and the admin simulator.

**Rationale.** Principle I bans float money; Dart `double` arithmetic would drift from `Decimal` and break SC-004 parity. One implementation means the calculator, the results list and the signed offer cannot disagree.

**Alternatives rejected.** (a) Client-side estimate labelled "approximate" — two implementations, guaranteed drift, and the drift lands on the exact number customers compare; (b) shipping a Dart decimal port — a second money engine to keep in sync, for a sub-second saving.

**Latency budget.** One indexed program read + pure math; p95 target < 500 ms for the full preview over ~150 programs. Existing single-program endpoints are well inside this; the risk is preview fan-out, mitigated because `findAllActive()` is already a single query and the per-program work is arithmetic only.

---

## R4 — Removing the unused settings safely

**Decision.** One reviewed migration `prune_unused_eligibility_settings`, ordered: (1) `pg_dump` of `bank_program` captured and stored by the operator; (2) `SELECT count(*)` of programs holding any pruned key, logged into the migration output; (3) `UPDATE bank_program SET eligibility = eligibility - '{key1,key2,…}'::text[], performance_criteria = NULL`; (4) DTO/type/form removal in the same PR. Runs only after explicit product-owner go-ahead (FR-015c).

**Kept** (still read by code): `dbrCapPercent`, `skipDbrCheck`, `requiresCollateral` (drives `fees.ts` via `collateralized`), `commercialBankIncomePercent` + `publicBankIncomePercent` (drive `income-resolver.ts`), `ageMin`/`ageMax` (used by this feature for tenor-at-maturity shortening), `minMonthlyIncomeEGP` (selects the DBR band context and is displayed).

**Pruned** (`eligibility`): `acceptedEmploymentTypes`, `acceptedLoanPurposes`, `acceptedTransferTypes`, `companyType`, `minMonthsInJob`, `minMonthsInJobBySalaryCategory`, `ageMinSelfEmployed`, `ageMaxSelfEmployed`, `minMonthlyIncomeSelfEmployedEGP`, `requiresCD`, `requiresAutoLoanAtABK`, `requiresAutoLoanAtOtherBank`, `requiresCreditCardAtOtherBank`, `requiresCompoundProperty`, `requiresClubMembership`, `requiresExistingLoan`, `requiresFRMUVerification`, `requiresQualitativeReview`, `requiresNoDocuments`, `minBankStatementBalanceEGP`, `minAssetsValueEGP`, `minimumCreditCardHoldingMonths`, `competitorCardMustBeUnsecured`, `eligibleCarPriceMinEGP`, `eligibleDownPaymentPercent`, `clubClass`, `compoundClass`. Whole `performanceCriteria` block dropped (`requiredMOBMonths`, `bkt1NoHitWithinMonths`, `bkt2NoHitWithinMonths`, `requireCurrentLoanStatus`).

**Code consequences.** `eligibility-checker.ts` shrinks to the checks that survive (currency, amount range, tenor range, age range, minimum income); `checkEligibility` keeps returning `passedChecks`/`failedChecks` because the apply path still records them, but nothing gates on them (`skipEligibility` remains the operating mode). `ApplicantProfile.assets` fields that only fed pruned gates stay in the type for now — they are populated from answers and still used by income strategies; removing them is a separate cleanup.

**Rationale.** Prune is what the product owner chose over read-only. The count-then-strip order makes the loss visible rather than silent (spec edge case), and JSONB key subtraction avoids rewriting rows twice.

**Alternatives rejected.** (a) Read-only "not used by matching" panel — rejected by the product owner; (b) column drops — these are JSONB keys, not columns; (c) leaving stored keys and only hiding them in the UI — leaves the form's source of truth lying about itself and fails FR-015d.

---

## R5 — Prefill merge and copy-on-save

**Decision.** `GET /api/admin/bank-programs/prefill?bankId=&programNameKey=&category=` returns a full draft plus per-field provenance:

```jsonc
{ "values": { "tenor": {...}, "loanLimits": {...}, "eligibility": {...}, "pricing": {...}, "fees": {...} },
  "origin": { "eligibility.dbrBands": "CATALOG", "tenor.maxMonths": "BANK_POLICY", "pricing.currentEffectiveRatePercent": "EMPTY" } }
```

Merge order: bank policy → catalog defaults → (admin edits, client-side). Deep merge is one level per sub-config, last writer wins per leaf. On save the resolved values are written into `bank_program` exactly as any hand-typed value; the endpoint is never consulted at match time (FR-009, FR-021b).

**Rationale.** Mirrors how banks publish (general policy + per-program exception sheets) and keeps the engine's read path single-source. Provenance is what makes FR-010 testable.

**Alternatives rejected.** Live inheritance at match time (a bank-policy edit would silently reprice every program — the opposite of SC-008); server-side merge on save only (the admin could not see what they were inheriting before saving).

---

## R6 — Storing catalog defaults on `program_name`

**Decision.** Add `defaults Json @default("{}")` to `platform_enumeration`, populated only for `type = 'program_name'`, keyed by category:

```jsonc
{ "personal": { "tenor": { "minMonths": 6, "maxMonths": 84 },
                "loanLimits": { "perCurrency": { "EGP": { "minAmount": "20000", "maxAmount": "500000" } } },
                "eligibility": { "minMonthlyIncomeEGP": "15000", "dbrBands": [ … ] },
                "fees": { "adminFeePercent": "1.5", "stampDutyEGP": "50" },
                "requiredDocuments": ["SIGNED_APPLICATION","VALID_NID","BANK_STATEMENT_6M"] } }
```

Keys are validated against the same sub-config DTOs used by `bank_program`, partial-mode.

**Rationale.** `program_name` already lives in `platform_enumeration` with a `categories String[]`, and the defaults are per category — a JSON map keyed by category matches the existing grain with one nullable column. Reusing the sub-config DTOs in partial mode means one validation implementation for both layers.

**Alternatives rejected.** A separate `program_template` table (the source plan's Layer 2) — cleaner in the abstract, but it duplicates the catalog the team just shipped in commit `cdd9685` and forces a second name registry; revisit if templates ever need their own lifecycle or versioning.

---

## R7 — Storing the bank lending policy

**Decision.** `Bank.policyDefaults Json?` holding the same partial sub-config shape as R6 minus category keying (a bank policy is category-agnostic): age range, minimum income, DBR setting, tenor range, and `maxUnsecuredExposureEGP`. Edits audited via the existing `AuditEvent` path with a new event type.

**Rationale.** One nullable column, no new table, optional by construction (FR-006), and the audit trail already exists for `Bank`.

**Alternatives rejected.** Typed columns on `bank` — a dozen mostly-null columns for prefill-only data; a `bank_policy` table — a 1:1 table for one optional blob.

---

## R8 — Storing typed answers, including multi-pick

**Decision.** Keep one `application_answer` row per question and widen it:

- `selectedOptionCodes String[] @default([])` — the canonical store for both choice types (single = one element).
- `selectedOptionId` / `selectedOptionCode` retained, populated for single-choice, so existing readers and the scorer keep working (FR-045).
- `textValue` used for text; `numericValue` (`Decimal(18,2)`) for number.
- The `@@unique([applicationId, questionId])` constraint **stays** — it is what makes multi-pick-as-array necessary and keeps answer reads one row per question.

**Rationale.** The existing unique key forbids one-row-per-pick; an array column keeps reads and the uniqueness guarantee intact with no join. `numericValue` already exists at the right precision.

**Alternatives rejected.** (a) Dropping the unique key and storing one row per pick — breaks every current reader and the "one answer per question" invariant; (b) a child `application_answer_option` table — a join for a 1–5 element list; (c) JSON blob per answer — loses the typed decimal for the money figures.

**Submission contract.** `SubmittedAnswerDto` becomes: `questionCode` + exactly one of `optionCode` | `optionCodes[]` | `textValue` | `numericValue`, validated against the published question's type. Wrong shape → `ANSWER_TYPE_MISMATCH`; out-of-bounds number → `ANSWER_OUT_OF_RANGE` with `meta.min`/`meta.max`; over-length text → `ANSWER_TOO_LONG`.

---

## R9 — Scoring and the new types (A33 safety)

**Decision.** Only `SINGLE_SELECT` questions are assignable to a program's weight set. `MULTI_SELECT`, `TEXT` and `NUMERIC` are non-scoring: the admin scoring editor does not list them, and a stored weight referencing one is rejected with the existing `WEIGHTS_UNKNOWN_OPTION` family.

**Rationale.** A33 pins the formula to `Σ(questionWeight ÷ 100 × pickedAnswerScore ÷ 100)`. With two picks there is no single `pickedAnswerScore`, so any aggregate (max, mean, sum-capped) would be a *new* formula — a constitution amendment, not an implementation choice. Number and text have no options and therefore no scores. Excluding them keeps weights summing to 100 over a well-defined set and leaves every existing score bit-identical.

**Alternatives rejected.** Scoring multi-pick by mean of picked options (needs an amendment; also lets a customer lower their own score by picking more true answers); scoring numbers by band (that is eligibility logic returning through the back door, banned by A33).

**Spec follow-up.** FR-041 named only text and number as non-assignable; multi-choice joins them. Recorded in the spec.

---

## R10 — Preview gains figures without regressing

**Decision.** `MatchingPreviewService` keeps its answer-validation and weighted-scoring steps and adds, per program, a `quoteProgram()` call using the profile derived from the number answers. Programs that cannot be quoted return `figures: null` plus a `figuresUnavailableReason` code — they are still listed and still scored (FR-024). Response fields are additive; `monthlyInstallmentEGP` stops being `null` and is joined by `offeredAmountEGP`, `cashToCustomerEGP`, `totalFeesEGP`, `totalPayableEGP`, `totalCostOfCreditEGP`, `effectiveRatePercent`, `effectiveTenorMonths`, `dbrPercent`, `dbrCapPercent`, `dbrBandIndex`, `bindingConstraint`.

`bindingConstraint` ∈ `requested_amount | program_max | dbr_affordability | tenor_max | age_at_maturity`.

**Rationale.** Additive response = no breaking change for the app's current results screen; the same pure function as apply gives SC-004 for free.

**Alternatives rejected.** Calling the full `EngineService.match()` from preview — it wants a persisted application context and a scoring-config adapter, and it would double the scoring work already done in preview.

---

## R11 — Tenor shortening by age at maturity

**Decision.** `quoteProgram()` shortens tenor so `age + tenorMonths/12 ≤ eligibility.ageMax`, rounding down to the program's tenor step (or 1 month if unset), and reports `bindingConstraint: 'age_at_maturity'`. If the result is below `tenor.minMonths` → no figures, reason `AGE_AT_MATURITY`.

**Rationale.** Age is one of the kept settings and this is the only remaining use for it; without it a 58-year-old is quoted a 10-year loan no bank would book. Pure arithmetic, no new config.

**Alternatives rejected.** A separate `maxAgeAtMaturity` setting (more config for the same number ops already hold in `ageMax`); ignoring age (quotes that cannot exist).

---

## R12 — Rounding and display parity

**Decision.** All money math is `Decimal` with `ROUND_HALF_EVEN`, rounding only at the API boundary to 2 dp, as `pmt.ts`/`dbr.ts`/`fees.ts` already do. Tenor rounds down. The app formats the string it receives and never recomputes. Figures are compared as strings in the parity test (SC-004).

**Rationale.** Existing convention (feature 003 R2: banker's rounding matches the CBE statement convention); string comparison makes parity failures unambiguous.

---

## R13 — Testing focus (no constitutional coverage gate)

**Decision.** Mandatory targeted tests: (1) `resolveDbrCap` boundaries — income exactly 5 000 / 10 000 / 20 000 / 30 000, plus scalar fallback and single-band table; (2) `presentValue(amortize(P,i,n),i,n) ≈ P` over 50 random triples; (3) preview↔offer parity over 10 golden profiles; (4) one test per new error code; (5) band-validator rejection cases (unordered, gap, no terminator, cap out of range); (6) answer-type validation matrix (4 types × right/wrong payload); (7) prune migration: pruned keys absent, kept keys intact, affected count reported; (8) prefill provenance: catalog beats bank policy, saved program immune to later policy edits.

**Rationale.** Principles XVI/XXVII are placeholders, so effort goes where a wrong number reaches a customer: band boundaries, money identities, and parity.
