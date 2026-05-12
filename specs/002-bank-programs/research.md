# Phase 0 Research: BankProgram Management

**Feature**: 002-bank-programs
**Date**: 2026-05-12
**Spec**: [spec.md](./spec.md) (78 FRs, 30 SCs, 10 clarifications)
**Plan**: [plan.md](./plan.md)

All NEEDS CLARIFICATION items in Technical Context = NONE. The 10 spec clarifications already pin every cross-cutting decision; this document records the remaining technical decisions for storage shape, cascade evaluator design, derivation chain validation, the `PlatformEnumeration` stub strategy, mobile API contract differences, audit-event taxonomy, seed verifier strategy, and operator-review workflow for the qualitative-review uplift.

---

## R1. Tier-map storage shape: JSONB column vs normalised side-table

**Decision**: Single JSONB column per sub-configuration with strict Zod-equivalent (`class-validator` + `class-transformer`) schemas enforced at the DTO boundary.

**Rationale**:
- 8 sub-configurations × ~20 tier-map dimensions = ~160 potential tier maps; normalising every one into a side-table would produce 160+ Prisma models with a write-path that fans out to ~40 INSERT statements on every program save. Postgres handles JSONB indexing well; the catalog is ≤ 10k programs.
- Tier-map KEYS are opaque strings (FR-010a); they do NOT need referential integrity to a Postgres enum type. Integrity is validated at the application boundary against the `PlatformEnumeration` registry.
- Read path = `loadActiveCatalog()` returns the full active set in one query; cascade evaluator hydrates from the JSONB blob in process. No joins.
- Detail-view rendering = single SELECT; the JSONB blob carries everything the cascade-preview component needs without N+1.
- Diffing for audit events = structural JSON diff (server-side), captured before/after snapshots in the audit-event payload.

**Alternatives considered**:
- **One row per tier band in a `BankProgramTierBand` side-table**: too granular; every save = delete-all-bands-then-insert-all, no perf win, far worse audit-event ergonomics.
- **Per-dimension JSONB column (e.g., `rateByTenor JSONB`, `rateByTransferType JSONB`, …)**: schema columns proliferate, every new cascade level requires a migration. Defeats Principle II (banks are data, not code) at the schema layer.
- **EAV (entity-attribute-value) table**: classic anti-pattern; loses Postgres' JSONB validation + GIN-index benefits.

**Constraints honoured**:
- Principle I (Decimal money): Prisma `Decimal` is preserved inside JSONB via stringified canonical form (e.g., `"25.5000"`). Repository's hydration step converts strings back to `Prisma.Decimal` before they leave the data layer.
- Validation: `class-validator` + nested validation + custom `@DecimalRange(min, max, { precision, scale })` decorator enforces the precision/scale contract at the DTO boundary.

**Indexes** (Phase 1 data-model.md will encode):
- `BankProgram.programCode` UNIQUE (FR-012).
- `BankProgram.active` partial index (mobile read endpoint frequently filters `active = true`).
- `BankProgram.bankName` (filter by bank).
- GIN on `BankProgram.searchVector` (generated column = `lower(programCode || ' ' || friendlyName)`) for FR-016 case-insensitive search.
- `BankProgramAuditEvent.bankProgramId, occurredAt DESC` for detail-view audit timeline.

---

## R2. Cascade evaluator: pure module, frozen order

**Decision**: A standalone pure TypeScript module at `backend/src/bank-programs/cascade/cascade.evaluator.ts`. No NestJS DI, no Prisma, no HTTP — takes a hydrated `BankProgramConfig` + a normalised `ApplicantContext` and returns a `CascadeResult { value, matchedLevel, derivationChain?, trace[] }`. The matching engine (separate future feature) and the dashboard detail-view's what-if preview (FR-033e) both consume the SAME function — preventing drift.

**Cascade orders (FROZEN per FR-008e)**:

```text
Pricing (FR-008b):
  rateByTenor →
  rateByTransferType →
  rateByDownPaymentPercent →
  rateByCustomerProgramTier →
  rateByAssetValueBand →
  rateByLoanAmountBand →
  rateBySeniority →
  rateByEmploymentType →
  (isVariableRate ? currentEffectiveRate : baseRate)

Loan limits (FR-008c):
  maxByCDTier →
  maxByPropertyType →
  maxByCityTier →
  maxByTransferType →
  maxBySalaryCategory →
  maxByEmploymentType →
  maxEGP
  (qualitativeReviewMaxEGP applied ONLY if offer has operator-approved qualitative-review badge — per FR-003a)

Tenor (FR-008d):
  maxMonthsBySalaryCategory →
  maxMonthsByEmploymentType →
  maxMonths
```

**Resolution rules**:
- Discrete-key cascades (employment type, transfer type, salary category, etc.) → exact-key match; no match → next level.
- Range-keyed cascades (`rateByDownPaymentPercent`, `rateByAssetValueBand`, `rateByLoanAmountBand`, CD-value bands) → floor-to-nearest-band-≤-applicant-value per FR-008o.1 + FR-008p.1; no match → next level.
- Variable-rate substitution: when `isVariableRate = true`, `currentEffectiveRate` replaces `baseRate` at the bottom of the pricing cascade.
- `qualitativeReviewMaxEGP` is NOT a cascade tier; it is a per-offer ceiling lift evaluated AFTER cascade selection of `maxEGP` and ONLY when the offer carries an operator-approved qualitative-review badge (per FR-003a).

**Determinism (SC-017)**:
- Pure function; given identical `(BankProgramConfig, ApplicantContext)` → identical output. No clocks, no randomness, no env reads. Cascade order encoded as a `const` array, not data — reorder requires a code change (and per FR-008e a constitution amendment).

**Trace**:
- Result includes a `trace[]` of every cascade level evaluated, with `{ level, matched: boolean, value?, reason? }`. Detail-view cascade preview (FR-008f) and the what-if preview (FR-033e) consume this trace.

**Alternatives considered**:
- **NestJS service with DI**: rejected; pulls the matching engine into a NestJS dependency graph. Pure module survives extraction to a future shared package without rewrites.
- **Configurable cascade order per program**: explicitly forbidden by FR-008e (frozen). Reorder = constitution amendment.

---

## R3. Derivation chain validation (FR-008s) — guarding the −1 % delta

**Decision**: Validate at write time (DTO boundary) that `derivation.sourceRatePercent + derivation.deltaPercent ≈ value` within `±0.0001` percentage points. Reject with `DERIVATION_ARITHMETIC_MISMATCH` on failure. The derivation field is OPTIONAL; absent → no validation runs.

**Rationale**:
- The derivation chain exists ONLY for human readability on the detail view; the matching engine never reads it. A drift between the persisted value and the persisted chain produces user-visible math that does not reconcile (e.g., detail-view reads "24.5 % = 25.5 % − 1 %" but the stored value is 24.4 % due to a manual edit). The write-time guard catches this immediately.
- ±0.0001 tolerance mirrors the `DECIMAL(7,4)` scale and absorbs banker's-rounding artefacts without admitting structural drift.

**Implementation**:
- Custom `@ValidDerivationChain()` class-validator decorator on `DerivationDto`. Cross-field validator: at the same level as the `value` field on each tier-map entry.

**Alternatives considered**:
- **Runtime validation in the cascade evaluator**: too late — bad data is already persisted.
- **Compute `value` from derivation at read time**: rejected; persisting the canonical `value` is mandated by Principle I (rates are decimals, not formulas). Derivation is documentation, not source-of-truth.

---

## R4. `PlatformEnumeration` registry stub (this feature) vs full feature 003

**Decision**: Ship an in-memory stub implementation of `PlatformEnumerationRepository` for feature 002 ONLY. The stub seeds the initial enumeration members (salary categories Cat-A / Cat-B / Cat-C / outsource; transfer types payroll / salary-transfer-letter / income-transfer-letter / none; employment types salaried / self_employed; property types apartment / twin_house / villa; city tiers main_cities / other_cities; loan purposes personal / car / mortgage; plus professor ranks, military grades, customer program tiers) at boot. Feature 003 (planned) replaces the stub with a registry-backed implementation behind the SAME `PlatformEnumerationRepository` interface — zero changes to bank-programs feature code.

**Rationale**:
- Building feature 003 INSIDE feature 002 violates the spec's explicit deferral (Assumptions section + FR-010 + FR-010c). The stub honours the fail-closed contract (when the registry is "unavailable" — e.g., not initialised — the form's tier-key pickers MUST refuse to render and show the localized "enumerations unavailable" state).
- The interface-first design (TypeScript `interface PlatformEnumerationRepository`) lets feature 003 land via DI swap without touching bank-programs code.

**Fail-closed behaviour**:
- Stub fails fast at boot if the seed list is empty (assumption in spec: feature seed requires working registry).
- Backend save endpoint rejects unknown / deactivated keys with `UNKNOWN_ENUMERATION_KEY` + `DEPRECATED_ENUMERATION_KEY` and includes the offending key in the response (FR-010 + FR-010c).
- Frontend tier-key picker disables on registry-unavailable state and shows the localized message (FR-010b + Edge Case for `PlatformEnumeration` registry unavailable).

**Alternatives considered**:
- **Hardcoded TypeScript enums in feature 002**: violates Principle II + FR-010a (keys MUST be opaque strings resolved against a registry).
- **Build feature 003 first**: scope creep; the spec's assumptions and the user direction allow consuming a stub now.

---

## R5. Mobile read-only contract — what to expose, what to redact

**Decision**: Mobile DTOs are explicit hand-written subsets, NOT auto-derived from admin DTOs. Each mobile DTO lives in `backend/src/bank-programs/dto/mobile-*.response.dto.ts`.

**Exposed fields** (mobile):
- `programCode` (immutable identifier)
- `friendlyName` (localized at display time on mobile; backend ships canonical strings)
- `bankName`
- `productCategory`
- `currencies`
- Public-facing pricing presentation: a precomputed `displayRateRange` `{ minPercent, maxPercent }` derived from base / cascade min/max at active time; NOT the full cascade map
- Public-facing limits presentation: `displayMinEGP`, `displayMaxEGP` per currency
- Tenor presentation: `displayMinMonths`, `displayMaxMonths`
- Required documents list (localized labels)
- Fees presentation: `adminFeeDisplay` + `lifeInsuranceMandatory` flag + `stampDutyDisplay`
- Eligibility headline: `acceptedEmploymentTypes`, `acceptedLoanPurposes`, `ageRangeDisplay`

**Redacted fields** (NEVER sent to mobile):
- internal IDs (`id` Prisma uuid)
- `version` field (FR-021a)
- Full tier-map detail (mobile shows a summary, not the cascade)
- Audit metadata (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
- Operator notes (`operatorNotes`)
- Operator tips (`operatorTips`) — internal-only
- `derivation` chains
- Performance-criteria gates (the wizard collects evidence; the gates are evaluated server-side; mobile never sees the gate values)
- Wealth gates (`minBankStatementBalanceEGP`, `minAssetsValueEGP`) — server-side eligibility only
- `qualitativeReviewMaxEGP` (operator-only)

**Inactive-program handling** (FR-029, FR-030): mobile detail endpoint returns the platform's standard `NOT_FOUND` response for any inactive program, regardless of whether the caller knows the program code. No metadata leakage.

**Rationale**:
- Hand-written DTOs > auto-derivation: prevents accidental field leakage when the admin DTO grows. Explicit allowlist is easier to audit at PR time.
- Computed display fields (`displayRateRange`, etc.) decouple the mobile contract from the internal cascade-evaluator output shape — refactoring the cascade doesn't break the mobile client.

---

## R6. Audit-event taxonomy + payload shapes

**Decision**: Seven distinct event types, each carrying a structured payload typed by event-type. Payloads contain operator identifier, program code, correlation ID, occurredAt, and event-specific structured fields. No applicant data (Principle VI).

| Event type | Payload |
|---|---|
| `BANK_PROGRAM_CREATED` | `{ programCode, friendlyName, bankName, productCategory, active }` |
| `BANK_PROGRAM_UPDATED` | `{ programCode, diff: { fieldPath: { before, after } }[] }` — RFC 6902-style structural diff scoped to top-level config fields |
| `BANK_PROGRAM_TOGGLED` | `{ programCode, before: 'active'\|'inactive', after: 'active'\|'inactive' }` |
| `BANK_PROGRAM_CLONED` | `{ sourceProgramCode, newProgramCode }` |
| `BANK_PROGRAM_DELETED` | `{ programCode, friendlyName, bankName, deletedAt }` |
| `BANK_PROGRAM_RATE_UPDATED` | `{ programCode, beforeEffectiveRate, afterEffectiveRate, isVariableRate, operatorNote? }` — fired in addition to (and not replacing) `BANK_PROGRAM_UPDATED` when the change touches `currentEffectiveRate` or `baseRate` (FR-031) |
| `BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED` | `{ programCode, offerId, decision: 'approved'\|'denied', uplift?: { beforeMaxEGP, afterMaxEGP }, rationale }` — fired when an operator decides on an offer's qualitative-review badge (FR-003a) |

**Storage**: extends the existing `AuditEvent` table from feature 001 (single audit table, polymorphic via `eventType` discriminator). New event-type enum values added via Prisma migration.

**Rationale**:
- Two-event firing for rate updates (`BANK_PROGRAM_RATE_UPDATED` + generic `BANK_PROGRAM_UPDATED`) honours FR-031's "distinct rate-update event" without losing the generic update.
- Diff payload size bounded by config-field cardinality (≤ 50 top-level config fields per program); no risk of payload bloat.

**Alternatives considered**:
- **Single generic event with `eventType` discriminator and free-form payload**: loses type safety; harder to query downstream.
- **Per-event-type Postgres table**: over-engineered; the single-table polymorphic pattern from feature 001 is proven.

---

## R7. Seed verifier (FR-033c) — rate-assertion-at-seed-time

**Decision**: Each seed catalog file (`abk-egypt-2026.ts`, `salesfloor-egp-2026.ts`, etc.) exports a structure of `{ programs: BankProgramCreateInput[], expectedRates: Record<programCode, expectedRatePercent> }`. The seed service writes the programs in a transaction; the verifier reads back each program's `baseRate` / `currentEffectiveRate` and asserts against `expectedRates`. Mismatch → rollback the transaction + `SEED_RATE_VERIFICATION_FAILED` error response listing every mismatched program.

**Rationale**:
- The transcribed catalogs are operator-trust source data; a typo turning Self-Employed 28.5 % into 25.8 % must not silently land in production. The verifier closes the loop at seed time (FR-033c) and is logged at info level for the operator's confirmation.
- Transaction wrapping means an aborted seed leaves zero partial state.

**Idempotency** (FR-033a/b):
- Each seed call queries `findUnique({ programCode })` first; existing programs are SKIPPED, not overwritten. Response payload lists each entry as `created | skipped` with the catalog rate for operator inspection.

**Alternatives considered**:
- **Verifier as a separate post-seed endpoint**: rejected; race window between seed + verify allows another operator to mutate a freshly-seeded program before verification runs.

---

## R8. Operator-review workflow for the qualitative-review uplift (FR-003a)

**Decision**: The qualitative-review decision is per-OFFER (not per-program). The offer surface lives in the future matching feature; THIS feature exposes the qualitative-review eligibility field on the bank program and the API endpoint shape that the future matching feature will call. Specifically:

- **This feature ships**: the `qualitativeReviewMaxEGP` field on the loan-limits sub-config + the `requiresQualitativeReview` flag on the eligibility sub-config + the validation rules (FR-003a) + the audit event type `BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED` registered in the audit-event taxonomy.
- **This feature does NOT ship**: the per-offer review UI, the offer-level state machine, the operator surface that approves/denies the badge. Those are matching-feature concerns.
- **Contract for the matching feature**: a documented internal API `BankProgramRepository.uplifted(programCode, offerId, decision)` that emits the `BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED` event and returns the resolved `effectiveMaxEGP`.

**Rationale**:
- Cleanly partitions feature 002 (program configuration) from the matching feature (offer lifecycle). No half-built UI ships here.
- The internal API contract is documented now so the matching feature has a stable target.

**Alternatives considered**:
- **Build the per-offer review UI in this feature**: scope creep; out-of-spec.

---

## R9. Search implementation (FR-016) — Postgres GIN

**Decision**: Postgres `tsvector` generated column over `lower(programCode || ' ' || friendlyName || ' ' || coalesce(friendlyNameAr, ''))` indexed with GIN. Backend query uses `to_tsquery` with prefix matching for typeahead (`to_tsquery('query:*')`).

**Rationale**:
- Bilingual search (Arabic primary + English secondary, FR-016 case-insensitive both languages). Postgres `tsvector` is locale-agnostic with the `simple` configuration; case-insensitivity from `lower()`.
- ≤ 10k programs → GIN-index point queries are sub-millisecond.

**Alternatives considered**:
- **`ILIKE '%query%'`**: works at this scale but loses prefix-typeahead pleasantness + slower at higher cardinality.
- **External search service (Meilisearch, OpenSearch)**: massive over-engineering for 10k records.

---

## R10. Form-shape architecture (admin)

**Decision**: One `BankProgramForm` typed Reactive Form composed of 8 nested `FormGroup` sub-configs. Each sub-config is rendered by a dedicated section component (`identity-section.component.ts`, `tenor-section.component.ts`, …). The drawer parent owns the form root, validation state, and submit. Sections receive their sub-FormGroup via `input()` signal and emit only via the FormGroup's value/status changes.

**Rationale**:
- Typed Reactive Forms (Principle XXII) require typing at the FormBuilder boundary. Splitting per section keeps each sub-FormGroup typing < 30 fields — manageable.
- The drawer parent's `formGroup.valid` signal is the single source of truth for the submit button's enabled state — no scattered validation chasing.
- Income-assumption strategy switches the visible sub-form section (FR-006 + Acceptance Scenario #8) — handled by a `@switch` on `strategy()` signal in the income-assumption-section component.

**Alternatives considered**:
- **One flat FormGroup with ~150 controls**: typing nightmare; impossible to maintain.
- **Multi-step wizard with one section at a time**: rejected by user-story acceptance ("complete every required section with valid data" — implies the operator sees the full form, not a wizard).

---

## R11. Drawer pattern (admin) — re-use feature 001's side-drawer

**Decision**: The create + edit drawer uses the existing `panelClass: 'side-drawer'` MatDialog pattern established in feature 001 (`admin/src/styles/styles.scss` lines 56–115). Drawer width = 720 px (wider than feature 001's 480 px user form) to accommodate the multi-section bank-program form. RTL flip, scroll behaviour, and reduced-motion guards inherit unchanged.

**Rationale**:
- One drawer pattern across the dashboard. Operator muscle memory is preserved.
- Width override per-feature is acceptable; the global pattern handles flex-end anchoring.

---

## R12. What-if preview helper (FR-033e) — optional, scoped down

**Decision**: SHIP the what-if preview as part of this feature, BUT scope it to the detail view ONLY (read mode), NOT to the create/edit drawer. The detail view's right-rail "Try a sample applicant" pane lets the operator pick employment type, transfer type, tenor, down-payment percent (for auto programs), and asset value, then renders the cascade trace + final rate/limit/tenor. Pure client-side: the cascade evaluator's TypeScript implementation is shared via a published types-only contract; the admin compiles a deterministic subset of the evaluator for in-browser execution. NO matching-engine call; NO real-offer side effect.

**Rationale**:
- FR-033e marks this as OPTIONAL polish, but it materially helps operators verify their configuration before saving — close to zero incremental cost given the cascade evaluator already exists server-side.
- Limiting it to the detail view (not the drawer) keeps the create flow's complexity manageable; the operator saves first, then verifies.

**Alternatives considered**:
- **Skip entirely**: leaves operators guessing on cascade resolution; spec allows skipping but the polish value is high.
- **Ship in the drawer too**: doubles the work; can come in a follow-up if operators request it.

---

## R13. Locale formatting for monetary + percentage values

**Decision**: Use `Intl.NumberFormat` (browser-native) with locale `'ar-EG'` and `'en-US'` plus the `numberingSystem` option (`'arab'` for Arabic-Indic digits where the operator's profile prefers them; `'latn'` for Western Arabic numerals — default for Egyptian banking even in Arabic mode). Currency formatting via `Intl.NumberFormat` with `{ style: 'currency', currency: 'EGP'|'USD'|'EUR' }`. Percentage formatting via `{ style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 4 }`.

**Rationale**:
- Browser-native + zero dependencies. Handles RTL bidi for currency symbols.
- Egyptian banking convention favours Western Arabic numerals (Latin digits) even in Arabic-locale UIs; Arabic-Indic is a per-operator preference, not a default.

**Persistence side**: backend stores canonical decimal strings; locale formatting is a presentation concern only.

---

## R14. Concurrency: optimistic version field implementation

**Decision**: `version` is a plain `Int` column on `BankProgram` with default 1. Every persisted save uses Prisma's `update({ where: { id, version: currentVersion }, data: { ..., version: { increment: 1 } } })`. If `update` returns zero rows (Prisma `P2025`), the service throws `CONFLICT_STALE_DATA` with the current persisted version included in the response. Toggling, cloning (as source — no change), and rate updates ALL increment the version.

**Rationale**:
- Native Prisma idiom. No raw SQL needed. No SERIALIZABLE transaction needed (the increment is atomic at the row level).
- Faster than pessimistic locks for the expected concurrent-edit rate (low — 10 admins, rare simultaneous edits on the same program).

**Alternatives considered**:
- **Pessimistic row lock**: heavier; no operator-experience win at this scale.
- **`updatedAt` timestamp as version**: clock skew across replicas is a footgun; integer counter is unambiguous.

---

## R15. Test strategy (developer-discretion, not constitutional)

**Decision**: NO testing is constitutionally mandated (v1.2.0). Developer discretion:
- The cascade evaluator (pure module) will get a small Vitest suite covering each FR-008b/c/d level + the FR-008o.1/FR-008p.1 floor rules + the FR-005c.1 wealth-gate AND rule + the FR-003a uplift gate. These are short, fast, and protect determinism (SC-017, SC-027, SC-029).
- No integration / E2E / a11y mandates.

**Rationale**:
- The spec's measurable outcomes (SC-017 + SC-021 + SC-027 + SC-029 + SC-030) all describe cascade-determinism guarantees. A small unit test against the pure evaluator is the cheapest way to assert them in CI without resurrecting any constitutional testing gate.

---

## Resolved unknowns

All "NEEDS CLARIFICATION" markers from Technical Context = NONE. Every cross-cutting concern is pinned by either the spec's 10 clarifications or this research document.

## Open items deferred to planning's Phase 1

- Concrete Prisma schema sketch (R1 + R6 + R14) → `data-model.md`.
- OpenAPI shapes (R5 + admin endpoints) → `contracts/openapi.yaml`.
- New error codes + translations (R3 + Constitution Check) → `contracts/error-codes.md`.
- Operator quickstart (create first program end-to-end) → `quickstart.md`.
