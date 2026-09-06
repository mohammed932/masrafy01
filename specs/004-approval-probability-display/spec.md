# ~~Feature Specification: Approval Probability Display Enhancement~~ — REMOVED (v25.0.0)

> **REMOVED in v25.0.0.** Approval scoring is gone platform-wide — the score, its tiers, its
> factor breakdown, the `ScoringEngineVersion` registry, `/admin/scoring-versions/*`, the five
> `bank_offer.approval*` columns, the `ApprovalTier` enum, the admin pill / tier filter / "Why this
> score?" panel, and the mobile "% match". Everything below describes a feature that no longer
> exists in the code.
>
> Why: this feature was the presentation and governance layer around a number, and the number never
> earned it. It was a weighted sum of figures an admin typed, never once compared against a bank's
> actual decision — v13.0.0 had already had to reword it from "Guarantee Approval" to "% match",
> which was the admission. Tiers, a factor catalog, an engine-version registry and an accuracy page
> are all machinery for auditing a claim; none of them made the claim true. What ships instead is an
> order, not a score: `rankOffers(offers, priority)` sorts by the applicant's OWN stated priority and
> that order is frozen on each row as `bank_offer.rankIndex` (Principle I / A6).
>
> **This directory is kept, not deleted.** `specs/005-lead-management-application/quickstart.md`
> names its quickstart as a prerequisite, and `design/promax-*` + `design/impec-*` are the
> Principle XXIII / A17 evidence that the design pipeline was run. `tasks.md`, `research.md`,
> `data-model.md` and `design/` are left untouched as the build record.

**Feature Branch**: `004-approval-probability-display`
**Created**: 2026-05-13
**Status**: Draft
**Input**: User description: "Spec #3.5 — present matching-engine probability scores with tiered classification, factor breakdowns, localized labels (AR/EN), admin filters/columns, engine versioning + audit. Calculation engine unchanged; this is the display + persistence + observability layer on top of feature 003."

## Background

Feature 003 (Matching Engine) already computes an approval-probability **number** (`approvalProbabilityPercent`, 10–95) for every matched bank offer. The number ships to clients and persists on `bank_offer`. That is sufficient to display "85%" — and nothing else.

This feature ships everything around the number:

- **Tier** — coarse-grained classification (excellent / good / moderate / low / very_low) so clients can render colored pills + thresholds without re-implementing the bucket math.
- **Factor breakdown** — the explicit list of inputs that nudged the score (positive contributions like *payroll transfer verified*, negative contributions like *previous rejection*) with each input's numeric impact, so users + operators can answer "why this score?" with no engineer lookup.
- **Localized label codes** — the client renders Arabic or English from a stable code (`approval.tier.excellent`) rather than concatenating English strings server-side. Constitution Principle IV.
- **Engine version stamp** — every offer carries the semantic version of the scoring model that produced it. Weight changes never silently rewrite history; an offer's score reproduces exactly from the stored version + weights snapshot. Constitution Principle V.
- **Admin views** — the lead list shows a colored pill of the best-offer probability; filters bucket leads as "high-probability / medium / needs coaching"; the application-detail page expands a per-offer "Why this score?" panel; the analytics page tracks distribution + accuracy vs. actual bank decisions.

The calculation itself stays where it lives (`backend/src/matching/pipeline/approval-probability.ts` + `scoring-weights.ts`). The refactor is **output-shape only**, plus a version registry + admin surface.

## Clarifications

### Session 2026-05-13 (initial)

- Q: What numeric thresholds define each tier, and how do the admin filter buckets map to them? → A: Tier table = `excellent ≥ 80`, `good 60–79`, `moderate 40–59`, `low 20–39`, `very_low < 20`. Admin filter buckets ARE the tier buckets: "High probability" = `excellent`; "Medium probability" = `good`; "Needs coaching" = `moderate ∪ low ∪ very_low ∪ no_match`. Tier and filter share one canonical scale. Thresholds live in the engine version's `weightsConfig` JSONB (changing them = new version + new offers; old offers keep their original tier label).
- Q: Engine-version semver bump policy? → A: **MAJOR** = threshold table changed OR an existing factor code removed (user-visible tier shifts for the same score; deprecated code may surface in detail panels). **MINOR** = a new factor code added OR an existing weight value changed (same factor catalog, different numbers; old scores still reproduce). **PATCH** = `weightsConfig` edited but semantically equivalent (comment/documentation tweaks, no behavioral delta). Communicated to engineers via the version string itself so reviewers see blast radius at a glance.
- Q: How does an operator promote a new engine version in v1? → A: **`POST /api/admin/scoring-versions/:version/activate`** — `super_admin`-only endpoint (JWT + RolesGuard), audited via `SCORING_ENGINE_VERSION_PROMOTED`, throttled, executes the SERIALIZABLE activation transaction (FR-009). No admin UI in this feature — the endpoint is the v1 contract. CLI script + dashboard surface are future-feature deliverables. Eliminates the "ssh into prod" risk without ballooning task count.
- Q: How does the detail "Why this score?" panel render a factor whose code was removed in a later engine version? → A: Render the factor row normally (impact + plain-language sentence) PLUS a small "Deprecated in v\<active>" badge. Localization sentence is sourced from the **offer's own** engine version's `weightsConfig.factorCatalog`, never from the active version. Operator gets historical context with zero missing-translation flashes and an accurate audit trail. Requires the factor catalog (code → AR/EN label) to live inside `weightsConfig` JSONB so every version snapshot is self-contained.
- Q: Max look-back window for the analyst distribution + accuracy page? → A: **Up to 180 days** (≈ 6 months — two quarters of trend / drift comparison). Ranges past 180 days render a "Use the data warehouse for windows > 180 days" notice instead of running the query. Keeps the OLTP query path bounded without needing pre-aggregation indexes for year-long histograms.
- Q: Is the factor breakdown surfaced to mobile end-users (guest applicants) as well as authenticated admins? → A: **Yes for both**, but only the positive factors render by default on mobile. Negative factors are tucked behind a "How could I improve?" disclosure to avoid discouragement. Admins see both lists side by side, sorted by absolute impact.
- Q: Backfill policy for historical `bank_offer` rows that lack the new columns? → A: Set `approvalScore` from the existing `approvalProbabilityPercent` Decimal column (round to nearest int), derive `approvalTier` from the threshold table, set `approvalFactors` to `{ positive: [], negative: [], legacy: true }` (we don't reconstruct factors retroactively), set `engineVersion = '1.0.0-legacy'`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Mobile API Consumer Receives Structured Probability (Priority: P1)

A mobile API consumer (today: Postman / curl; tomorrow: the Flutter app) sends a signed `POST /api/v1/apply` request. The response carries, for every matched offer, a fully structured `approvalProbability` object: the score (`88`), the tier (`excellent`), a stable label code the client localizes (`approval.tier.excellent`), the positive and negative factor arrays with code + impact, and the engine version stamp (`1.1.0`) so the client can audit later that the same model produced the same score.

**Why this priority**: this is the single contract the Flutter app and any future third-party consumer will integrate against. Until it ships, the UI layers cannot render anything richer than a flat percentage. Every other story in this spec depends on this contract.

**Independent Test**: send a known-good signed apply request, inspect each entry in `data.matchedOffers[].approvalProbability`, verify the object carries `score`, `tier`, `tierLabelCode`, `factors.positive[]`, `factors.negative[]`, and `engineVersion`. Hash the structured factor list and compare to the inputs that the engine actually used. The mobile contract is complete and reproducible.

**Acceptance Scenarios**:

1. **Given** a profile with payroll-transfer + CD-at-ABK + previous-rejection-false, **When** the matching engine returns an offer with score 88, **Then** the offer's `approvalProbability` carries `{ score: 88, tier: 'excellent', tierLabelCode: 'approval.tier.excellent', factors: { positive: [{ code: 'PAYROLL_TRANSFER', impact: +10 }, { code: 'HAS_CD_AT_ABK', impact: +15 }, ...], negative: [] }, engineVersion: '1.1.0' }`.
2. **Given** the matching engine encounters a previous-rejection + high-DBR + not-Cat-A profile, **When** the offer carries score 35, **Then** the response shows `tier: 'very_low'`, populates `factors.negative` with three entries (`PREVIOUS_REJECTION`, `HIGH_DBR`, `NOT_CAT_A`) each with its numeric impact, and `factors.positive` carries any partial credits earned.
3. **Given** the engine clamps a sub-floor raw score to the configured minimum, **When** the structured response renders, **Then** the `score` field carries the clamped value and `factors` carries a synthetic entry `CLAMPED_TO_FLOOR` so downstream consumers can detect the floor without recomputing.

---

### User Story 2 — Admin Sees Probability Pill + Tier Filter on List (Priority: P1)

A `sales_manager` or `sales_agent` opens **Applications** in the admin dashboard. Each row carries a colored pill showing the **best offer's** approval probability for that application (the highest among the matched offers). They can filter by tier bucket — "High probability leads" (best offer is `excellent`, i.e. score ≥ 80), "Medium probability" (best offer is `good`, 60–79), "Needs coaching" (best offer is `moderate` / `low` / `very_low` — score < 60 — OR application has no matches at all) — to triage their work in seconds.

**Why this priority**: this is the daily-driver workflow for sales-team users. The team currently has no way to prioritize 40 leads by likelihood-to-close other than opening each in turn. A list-level filter is what turns the engine's output into a workflow.

**Independent Test**: seed 30 applications across the full probability spectrum, sign in as `sales_manager`, open the Applications list, confirm the pill colors track the tier table, click "High probability leads", confirm only ≥ 80% rows remain, switch to "Needs coaching", confirm rows < 40 OR `status='no_match'` remain.

**Acceptance Scenarios**:

1. **Given** an application with three matched offers (scores 92 / 76 / 41), **When** the list renders the row, **Then** the pill shows `92%` with the `excellent` color treatment and the tier label `Excellent`.
2. **Given** the user selects the "Medium probability" filter, **When** the list refreshes, **Then** only applications whose best-offer tier is `good` (score in `[60, 80)`) appear; counts in the filter chip update accordingly.
3. **Given** an application with zero matched offers (`status='no_match'`) OR best-offer score < 60, **When** the user enables "Needs coaching", **Then** the row appears with the appropriate pill (muted "—" for no-match, tiered pill for `moderate` / `low` / `very_low`) and is counted in the filter chip total.
4. **Given** the operator's locale is Arabic, **When** the pill renders, **Then** the tier label is the Arabic localization (e.g., `ممتاز`) and the percentage uses Egyptian-Arabic numerals if the platform's number-formatting policy says so.

---

### User Story 3 — Admin Inspects "Why this score?" Per Offer (Priority: P2)

On the application-detail page, the operator sees each matched offer's probability prominently displayed and can expand a "Why this score?" section to see exactly which factors moved the score up and which moved it down, in plain language ("You have a CD at ABK: +15 points"; "Previous rejection on file: −30 points"). Factors are localized.

**Why this priority**: this is the support-case workflow. When an applicant asks "why didn't I get the rate I expected?", the operator needs the factor breakdown on screen, not a SQL query.

**Independent Test**: open the detail page of an application from US2's seed set, expand "Why this score?" on the best offer, confirm the factor list matches the engine's actual contributions (positive entries highlighted, negative entries muted), each carrying a plain-language sentence + impact magnitude. Toggle Arabic — every factor sentence localizes.

**Acceptance Scenarios**:

1. **Given** an offer with `factors.positive = [{ code: 'HAS_CD_AT_ABK', impact: +15 }, { code: 'PAYROLL_TRANSFER', impact: +10 }]` and `factors.negative = [{ code: 'PREVIOUS_REJECTION', impact: -30 }]`, **When** the "Why this score?" panel expands, **Then** three rows render — two with green up-arrows and `+15` / `+10`, one with a red down-arrow and `−30` — sorted by absolute impact (rejection first, CD second, payroll third).
2. **Given** an offer flagged `legacy: true` from the pre-feature-004 backfill, **When** the panel expands, **Then** instead of a factor list the panel renders a single notice: "Detailed factors unavailable for offers produced before engine version 1.1.0" with the engine version stamp visible.
3. **Given** the offer's engine version is `1.2.0` and the platform's active engine is `1.3.0`, **When** the panel renders, **Then** a small "Scored under engine v1.2.0" annotation appears next to the score so the operator never confuses an old score for a current-engine score.

---

### User Story 4 — Analyst Sees Distribution + Accuracy Tracking (Priority: P3)

An `analyst` opens the analytics dashboard and sees a panel called **Probability accuracy**. It plots the distribution of approval scores across all matched offers over a chosen window, and — for any offer whose downstream bank decision was eventually recorded — the conversion / approval rate per tier. Over time this answers "is our engine actually predictive?"

**Why this priority**: this loop closes the feedback model. The engine ships v1.1, sees real bank decisions, and the analyst checks whether the tier the engine assigned correlates with the actual approval outcome. P3 because: there is no real bank-decision feed today (assumption section), so the panel exists with a placeholder for the field even when no decision data is present.

**Independent Test**: seed 100 matched offers across the spectrum, mark a handful (any subset) with simulated `bankDecisionOutcome ∈ {approved, rejected}`, open the analyst view, confirm the distribution histogram, confirm the per-tier conversion table shows the seeded data and a "—" for tiers with no data.

**Acceptance Scenarios**:

1. **Given** 100 matched offers and 30 with recorded bank decisions, **When** the panel renders, **Then** a histogram with 10-percentage-point buckets shows the score distribution and a 5-row table (one per tier) shows `decided / total` plus an `approval_rate` percentage per tier.
2. **Given** the analyst narrows the time range to "Last 7 days", **When** the panel refreshes, **Then** both the histogram and the table re-fetch and re-render against that window.
3. **Given** a tier has no recorded bank decisions in the selected window, **When** the row renders, **Then** the rate column shows `—` and a tooltip explains "Insufficient data for this tier in the selected window".

---

### User Story 5 — Backend Engineer Bumps Engine Version (Priority: P2)

A backend engineer changes a scoring weight (say, `PAYROLL_TRANSFER` from `+10` to `+12`), commits the change, and bumps the engine version to `1.2.0` in the `ScoringEngineVersion` registry. New apply requests stamp their offers with `engineVersion='1.2.0'`. Existing `bank_offer` rows keep their original `engineVersion`. The registry exposes the full weights snapshot for every active and past version so any old offer's score reproduces deterministically.

**Why this priority**: this is the audit / reproducibility primitive that lets Masrafy revisit a 6-month-old offer and explain exactly why it scored what it scored. Without the version stamp + weights registry, every weight change silently rewrites history.

**Independent Test**: persist engine version `1.1.0` and run a fixture apply with a known profile → record the offer's score. Activate `1.2.0` in the registry (with one weight changed). Run the same fixture apply → record the new offer's score. Verify both offers persist their respective `engineVersion` stamps, both versions remain queryable in the registry, and a future engineer running `npx tsx scripts/replay-score.ts <offerId>` reproduces the score from the stored version's `weightsConfig`.

**Acceptance Scenarios**:

1. **Given** the active engine version is `1.1.0`, **When** an apply request resolves matched offers, **Then** every persisted `bank_offer.engineVersion` equals `'1.1.0'` and the audit event payload `MATCHING_ENGINE_RUN` carries the same value.
2. **Given** the operator promotes version `1.2.0` (sets `activatedAt = now()` on the new row + `deactivatedAt = now()` on the old row in a single transaction), **When** the next apply request fires, **Then** matched offers stamp `engineVersion='1.2.0'`.
3. **Given** a six-month-old offer with `engineVersion='1.1.0'`, **When** an engineer queries the registry for `version='1.1.0'`, **Then** the `weightsConfig` JSONB returns the exact `SCORING_WEIGHTS` constants that were in effect at the time of the offer.

---

### Edge Cases

- An offer's score sits exactly on a tier boundary (e.g., 80): clamp UP — boundary inclusive on the upper-tier side. `score === 80` → tier `excellent` (not `good`); `score === 60` → `good` (not `moderate`); etc. Documented in the threshold table.
- An offer's factor breakdown is empty in both arrays (no positive, no negative): render a notice "Score reflects the base model only — no profile-specific adjustments applied."
- The active engine version has zero rows in the registry on startup: backend logs a fatal config error and refuses to serve `/apply` until the registry is seeded. The migration seeds `1.1.0-init` from `SCORING_WEIGHTS` at deploy time.
- A scoring weight is added in `1.2.0` that did not exist in `1.1.0` (e.g., new factor `EMPLOYEE_AT_PARTNER_COMPANY`). The `weightsConfig` snapshot for each version is self-contained — `1.1.0` simply does not carry the key. Replay against `1.1.0` ignores any factor whose code is missing from that version's weights.
- A factor code is REMOVED in a later engine version per the MAJOR-bump rule (e.g., `2.0.0` drops `OLD_CAT_A_BONUS` from the catalog), and an offer scored under `1.x.x` carries that code: the detail "Why this score?" panel renders the row normally with its impact, localizes the sentence using the OFFER'S engine `weightsConfig.factorCatalog`, and appends a small "Deprecated in v\<active>" badge. List-page pill rendering is unaffected (tier comes from `approvalTier`, not the factor catalog).
- Two operators simultaneously activate two different engine versions: the activation transaction is `SERIALIZABLE` and enforces "exactly one version where `deactivatedAt IS NULL`"; the slower transaction is rejected with `SCORING_VERSION_CONCURRENT_PROMOTION`.
- A legacy backfilled offer (`engineVersion='1.0.0-legacy'`) is returned in a `findManyAdmin` query: the admin list still renders the pill but the detail-page factor panel renders the legacy-notice from Acceptance Scenario 3.2 instead of an empty list.
- The mobile client passes its locale via `Accept-Language: ar-EG`: the response body still uses stable codes (the API stays locale-agnostic), but a planned future enhancement is server-rendered localized label strings for clients that prefer to skip the lookup. Out of scope for v1.

## Requirements *(mandatory)*

### Functional Requirements

#### Output Shape (API Contract)

- **FR-001**: System MUST extend the apply-response per-offer shape so each matched offer carries an `approvalProbability` object with exactly these top-level keys: `score` (integer), `tier` (one of `excellent`/`good`/`moderate`/`low`/`very_low`), `tierLabelCode` (stable localization key matching the pattern `approval.tier.<tier>`), `factors` (object with `positive` and `negative` arrays), and `engineVersion` (semver string).
- **FR-002**: Each entry in `factors.positive` and `factors.negative` MUST carry exactly two keys: `code` (one of the documented factor codes from the active engine version) and `impact` (signed integer — positive entries strictly > 0, negative entries strictly < 0). No nested objects, no English strings.
- **FR-003**: System MUST sort each factor array by `Math.abs(impact)` descending so the most-impactful contributor is first regardless of sign.
- **FR-004**: When the engine clamps a raw score to either floor or ceiling, the response MUST add a synthetic factor entry `CLAMPED_TO_FLOOR` (impact = `floor - rawScore`, always positive) or `CLAMPED_TO_CEILING` (impact = `rawScore - ceiling`, always positive) to the appropriate array so the client can detect clamping.

#### Tier Classification

- **FR-005**: System MUST classify each score into exactly one tier per the active engine version's threshold table; ties on a boundary resolve to the higher tier (e.g., 80 → `excellent`, not `good`).
- **FR-006**: The default tier thresholds are: `excellent ≥ 80`, `good 60–79`, `moderate 40–59`, `low 20–39`, `very_low < 20`. These values live in the `weightsConfig` JSONB of each `ScoringEngineVersion` row so they are versioned alongside the weights. Tier names + admin filter buckets share one canonical scale (FR-017).
- **FR-007**: System MUST localize every tier label code in BOTH Arabic and English at the i18n layer; missing translations are a same-PR review block (Constitution Principle III).

#### Engine Versioning

- **FR-008**: System MUST persist a `ScoringEngineVersion` row for every active and past engine. Each row carries `version` (unique semver string), `description` (free text), `weightsConfig` (JSONB snapshot of the full weight map + threshold table + `factorCatalog: { [code: string]: { labelAr: string, labelEn: string } }` so every version is self-contained for factor-sentence rendering), `activatedAt` (timestamp), and `deactivatedAt` (nullable timestamp).
- **FR-009**: System MUST enforce that exactly one `ScoringEngineVersion` row has `deactivatedAt IS NULL` at any time. Activation is a single SERIALIZABLE transaction that sets `deactivatedAt = now()` on the previous active row and inserts the new row with `activatedAt = now(), deactivatedAt = NULL`. Concurrent activation attempts MUST be rejected with code `SCORING_VERSION_CONCURRENT_PROMOTION`.
- **FR-010**: Every `bank_offer` row created post-feature-004 MUST carry the `engineVersion` of the active scoring model at the time of the engine run.
- **FR-011**: Audit event `MATCHING_ENGINE_RUN` MUST carry the engine version in its payload.
- **FR-011a**: Engine-version bumps MUST follow semver per this rule set: MAJOR = threshold-table change OR factor-code removal; MINOR = factor-code addition OR existing-weight change; PATCH = `weightsConfig` edit with no behavioral delta. Promotion PRs MUST cite the rule that drove the chosen bump.
- **FR-011b**: System MUST expose `POST /api/admin/scoring-versions/:version/activate` as the v1 promotion path. Endpoint requires `super_admin` role (`@Roles('super_admin')`), is audited via `SCORING_ENGINE_VERSION_PROMOTED` (FR-028), runs the SERIALIZABLE activation transaction (FR-009), and is rate-limited at the existing admin throttler. Request body is empty; the version identifier comes from the URL path. Response is the envelope `{ success: true, data: { previousVersion, newVersion, activatedAt } }`.
- **FR-011c**: The activation endpoint MUST reject any version not present in the `ScoringEngineVersion` registry with `SCORING_VERSION_NOT_FOUND`. Rows are inserted into the registry by a separate engineering workflow (Prisma migration that runs at deploy time, or a future CLI / dashboard surface) — NOT by this endpoint.

#### Persistence

- **FR-012**: System MUST extend the `bank_offer` table with four columns: `approvalScore` (integer 0–100, indexed for sort + filter), `approvalTier` (enum: `excellent`/`good`/`moderate`/`low`/`very_low`), `approvalFactors` (JSONB), and `engineVersion` (varchar, indexed for replay queries).
- **FR-013**: The migration MUST backfill historical `bank_offer` rows: round the existing `approvalProbabilityPercent` Decimal to nearest integer → `approvalScore`; derive `approvalTier` from the active threshold table; set `approvalFactors = '{"positive": [], "negative": [], "legacy": true}'`; set `engineVersion = '1.0.0-legacy'`.
- **FR-014**: The migration MUST seed the initial `ScoringEngineVersion` row from `backend/src/matching/scoring-weights.ts` as `version='1.1.0-init'`, `activatedAt=now()`, `deactivatedAt=NULL`, capturing the full `SCORING_WEIGHTS` constant plus the threshold table from FR-006.

#### Admin List Surface

- **FR-015**: The `/admin/applications` list endpoint MUST return for each application a `bestOffer` object containing at minimum `score`, `tier`, `tierLabelCode`; null when `status='no_match'`.
- **FR-016**: The admin list page MUST render a colored pill per row using the `tier` to drive the color treatment; the pill renders `—` and a muted "No matches yet" tier label when `bestOffer` is null.
- **FR-017**: The admin list MUST expose three tier-bucket filters aligned to the tier table: "High probability leads" = `tier = excellent` (score ≥ 80); "Medium probability" = `tier = good` (60 ≤ score < 80); "Needs coaching" = `tier ∈ { moderate, low, very_low } OR status = 'no_match'` (score < 60 OR no matches). Filter chips display the count of matching applications in the current visible result window.
- **FR-018**: Tier filter selection MUST be serialized to the URL (`?tier=high|medium|needs_coaching`) so an operator can share a filtered view.

#### Admin Detail Surface

- **FR-019**: The application-detail page MUST render each matched offer's probability prominently using the same pill treatment as the list view.
- **FR-020**: An expandable "Why this score?" panel MUST render the positive and negative factor lists, each entry showing a localized factor sentence + the impact integer with an up/down indicator. Factor sentences MUST be sourced from the OFFER's own engine version's `weightsConfig.factorCatalog` (not the currently-active engine's catalog) so historical offers never flash missing translations.
- **FR-020a**: When an offer carries a factor code that no longer exists in the currently-active engine's catalog (i.e., removed in a MAJOR bump), the factor row MUST render normally PLUS a small "Deprecated in v\<active>" badge so the operator sees the historical context without ambiguity.
- **FR-021**: Offers stamped `engineVersion='1.0.0-legacy'` (or any version whose `weightsConfig.legacy=true` flag is set) MUST render the legacy notice instead of an empty factor list.
- **FR-022**: When an offer's `engineVersion` differs from the active engine version, the detail panel MUST render a small "Scored under engine v\<version>" annotation adjacent to the score.

#### Analyst Surface

- **FR-023**: A new analytics page MUST render a histogram of approval-score distribution across all matched offers in the chosen window (default: last 30 days; user-selectable up to a hard 180-day cap).
- **FR-023a**: Window selections > 180 days MUST short-circuit at the API layer — `GET /api/admin/scoring-analytics?windowDays=400` returns `{ success: false, code: 'ANALYTICS_WINDOW_TOO_LARGE', meta: { maxDays: 180 } }`. The admin page renders a "Use the data warehouse for windows > 180 days" notice in place of the histogram.
- **FR-024**: A per-tier accuracy table MUST render `offer_count`, `bank_decision_count`, and `approval_rate` for each tier in the chosen window. The `approval_rate` column shows `—` when `bank_decision_count = 0` for that tier.
- **FR-025**: The bank-decision data feed is OUT OF SCOPE for this feature; the table reads from a `bank_offer_decision` table that ships empty and is populated by a future feature.

#### Localization

- **FR-026**: Every new factor code, every tier label, and every analyst-page label MUST have entries in both `error-codes.{ar-EG,en-US}.json` (for codes returned to clients) and `messages.{ar-EG,en-US}.xlf` (for in-template strings). Same-PR rule per Constitution Principle III.

#### Audit

- **FR-027**: The existing `MATCHING_ENGINE_RUN` audit event MUST extend its payload with `engineVersion`, `bestOfferScore`, and `bestOfferTier` so an operator can reconstruct the engine's behavior at the moment of the apply.
- **FR-028**: A new audit event `SCORING_ENGINE_VERSION_PROMOTED` MUST fire whenever an operator activates a new engine version, carrying actor, previous version, new version, weights diff summary.

#### Error Codes (new)

- **FR-029**: `SCORING_VERSION_CONCURRENT_PROMOTION` (409) — second SERIALIZABLE activation racing the first.
- **FR-030**: `SCORING_VERSION_NOT_FOUND` (404) — engine attempted to load an `engineVersion` not present in the registry.
- **FR-031**: `SCORING_VERSION_NO_ACTIVE` (503) — `/apply` cannot serve because zero rows have `deactivatedAt IS NULL`. Boot-time config error.
- **FR-031a**: `ANALYTICS_WINDOW_TOO_LARGE` (400) — analytics request asked for a window > 180 days. `meta` carries the configured `maxDays`.

### Key Entities

- **BankOffer (extended)**: keeps every existing column from feature 003; adds `approvalScore` (integer 0–100), `approvalTier` (enum), `approvalFactors` (JSONB, schema `{ positive: Factor[], negative: Factor[], legacy?: boolean }` where `Factor = { code: string; impact: number }`), `engineVersion` (varchar). Indexed on `approvalScore` (for list-sort) and `engineVersion` (for replay).
- **ScoringEngineVersion**: new table. `id` (cuid PK), `version` (varchar unique), `description` (text), `weightsConfig` (JSONB — full snapshot of `SCORING_WEIGHTS` + threshold table + factor-code catalog), `activatedAt` (timestamptz), `deactivatedAt` (timestamptz nullable), `activatedByStaffId` (FK → staff_account, nullable for the seeded initial row), `createdAt` (timestamptz). Partial unique index `WHERE deactivatedAt IS NULL` enforces single-active invariant at the DB level.
- **BankOfferDecision** (placeholder, populated by future feature): `id` (cuid PK), `bankOfferId` (FK), `outcome` (enum: `approved`/`rejected`/`withdrawn`), `recordedAt` (timestamptz), `decisionLatencyMs` (int). Created empty by this feature; the analyst accuracy view reads it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of matched offers persisted post-deploy carry a non-null `engineVersion` matching the active scoring engine row.
- **SC-002**: 100% of historical `bank_offer` rows backfill cleanly to `engineVersion='1.0.0-legacy'` in a single deploy migration with no transaction longer than 60 seconds on a 100 k-row table.
- **SC-003**: The admin list filter "Needs coaching" returns the same row set as a direct SQL query on `(best_offer_score < 60 OR status = 'no_match')` for any seed of 1 000 applications.
- **SC-004**: An offer scored on engine version `V` at time `T` reproduces the same score and the same factor list when re-run by a standalone replay script against the registry's `weightsConfig[V]` (assumption: applicant profile and program snapshot are persisted alongside the offer per feature 003).
- **SC-005**: An operator who clicks "Why this score?" on a non-legacy offer sees the factor list rendered in their locale within 300 ms of expansion (data is already in the offer's row; no additional API call).
- **SC-006**: Activating a new engine version takes the API offline for less than 100 ms (single SERIALIZABLE transaction; existing in-flight requests complete on the old version because the version they read is captured at engine-run entry).
- **SC-007**: Across a sample of 100 random offers reviewed by sales managers, ≥ 90% rate the factor breakdown as "matches my mental model of why the score is what it is" or better.
- **SC-008**: The tier-bucket filters cover the entire score range with no gaps and no overlaps: union of "High" + "Medium" + "Needs coaching" = 100% of applications (every application falls into exactly one filter bucket).
- **SC-009**: After enabling the analytics page, the per-tier accuracy table renders within 2 seconds against 100 k matched offers + 10 k recorded decisions.
- **SC-010**: Constitutional gates remain green: no English error strings cross the API boundary, every new code has AR + EN entries shipped in the same PR, no raw hex outside design tokens, all new UI screens invoke promax pre-design + impec post-impl per Principle XXIII.

## Assumptions

- The matching engine's calculation surface stays exactly where it lives — `backend/src/matching/pipeline/approval-probability.ts` + `scoring-weights.ts`. This feature only changes the output shape and adds persistence + UI on top.
- The application's applicant profile and bank-program snapshot are already persisted on `application.applicantProfile` and on the offer (via cascade-trace + program-version) per feature 003. Score replay relies on this — it is the single non-trivial dependency.
- A `bank_offer_decision` feed (real bank approve / reject outcomes) is OUT OF SCOPE. This feature provisions the table and the analyst-view read path so the moment data arrives the page lights up; populating it is a future feature.
- The mobile API stays locale-agnostic. Localized strings remain a client concern. Server returns stable codes (`approval.tier.excellent`, `factor.HAS_CD_AT_ABK.label`) which the admin web app + future Flutter app translate through their `messages.{ar-EG,en-US}.xlf` and i18n JSON respectively.
- The `engineVersion` registry never grows large enough to require pagination. Realistic upper bound is < 50 versions across the platform's lifetime.
- Operator UI for promoting / deactivating engine versions is OUT OF SCOPE for v1. The v1 promotion contract is the `super_admin`-only `POST /api/admin/scoring-versions/:version/activate` endpoint (FR-011b). A dashboard surface that lists registry rows + offers an "Activate" button is a future feature.
- Registry row INSERTION (writing a brand-new version's `weightsConfig` snapshot) is OUT OF SCOPE for the activation endpoint. New versions are created either by Prisma migrations at deploy time or by a future engineering tool — the activation endpoint only flips `activatedAt` / `deactivatedAt` on rows that already exist.
- Bank-decision-feed integration (real outcome data) is OUT OF SCOPE.
- This feature does not change the matching engine's correctness or the offered list of programs. Every program that matched before continues to match; only the way the probability is described to clients changes.
- `super_admin` is the only role allowed to invoke the promote-version CLI / future UI. `sales_manager`, `sales_agent`, and `analyst` read the registry but cannot mutate it. Enforced via `@Roles('super_admin')` on any mutating endpoint that ships.
- Visual treatment of the probability pill follows the design system established in feature 002 + feature 003 admin surfaces (deep-navy primary, tonal accents, restrained color usage) — no new palette additions; tier-specific colors are sourced from existing `--color-success` / `--color-warning` / `--color-error` tokens with documented mapping rules.

## Constitution Alignment

- **Principle I — Decimal for money**: this feature touches only the integer score; no monetary calculation changes.
- **Principle II — Banks are data, not code**: tier thresholds + factor weights live in the versioned `weightsConfig` JSONB, never branched in code by program code.
- **Principle III — Typed errors end-to-end**: 3 new error codes (`SCORING_VERSION_CONCURRENT_PROMOTION`, `SCORING_VERSION_NOT_FOUND`, `SCORING_VERSION_NO_ACTIVE`) ship with AR + EN translations in the same PR.
- **Principle IV — Arabic-first i18n**: every tier label and every factor sentence ships in both locales; the API stays locale-agnostic and returns stable codes only.
- **Principle V — Matching engine is the core IP**: the engine's purity boundary stays intact (no NestJS DI, no Prisma runtime imports inside `src/matching/`); the new structured output is built by the engine's pure pipeline; persistence happens in `applications.service.ts` as before.
- **Principle VI — PII protection**: factor codes are categorical (no PII); the analyst view aggregates only.
- **Principle VII — Observability**: existing `MATCHING_ENGINE_RUN` payload extended; new `SCORING_ENGINE_VERSION_PROMOTED` audit event.
- **Principle VIII — Brand identity**: pill colors derive from existing token mapping; no raw hex in components.
- **Principle XIII — Dual auth**: no change. Apply endpoint remains HMAC-protected; admin endpoints remain JWT + role-gated.
- **Principle XIV — API contract envelope**: unchanged. The structured `approvalProbability` object replaces the previous flat `approvalProbabilityPercent` field in the response.
- **Principle XXIII — UI UX skill pipeline**: every new admin screen (list-filter chips, detail "Why this score?" panel, analyst distribution + accuracy view) MUST invoke `promax` pre-design and `impec` post-implementation. Skipping is a review block.
