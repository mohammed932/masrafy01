# Tasks: Approval Probability Display Enhancement

**Branch**: `004-approval-probability-display`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)
**Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/openapi.yaml](./contracts/openapi.yaml) · [contracts/error-codes.md](./contracts/error-codes.md) · [contracts/factor-catalog.md](./contracts/factor-catalog.md)
**Quickstart**: [quickstart.md](./quickstart.md)

Total: **78 tasks** across 8 phases. Tests intentionally NOT generated (constitution v1.2.0 dropped XVI + XXVII testing requirements). MVP scope = Phases 1 + 2 + 3 (US1 only — structured API payload + persistence + version registry seeded). All later phases compose on top.

Story labels: [US1] mobile/API structured payload (P1) · [US2] admin list pill + tier filter (P1) · [US3] admin detail "Why this score?" (P2) · [US4] analyst distribution + accuracy (P3) · [US5] engineer version bump via activation endpoint (P2).

`[P]` = parallelizable: touches different files than any other in-flight task in the same phase. Always respect cross-phase ordering.

---

## Phase 1 — Setup

- [ ] T001 Pull develop and rebase 004-approval-probability-display: `git fetch origin && git rebase origin/develop` from repo root; resolve any conflict and run `cd backend && npm install && cd ../admin && npm install`
- [ ] T002 Verify infra running per [feature 002 quickstart §1](../002-bank-programs/quickstart.md#1--bring-up-infrastructure-dev): `docker compose -f docker/compose.dev.yml up -d postgres redis`

---

## Phase 2 — Foundational (blocking prerequisites for every user story)

- [ ] T003 Add `ApprovalTier` enum (`excellent`, `good`, `moderate`, `low`, `very_low`) and `DecisionOutcome` enum (`approved`, `rejected`, `withdrawn`) plus `SCORING_ENGINE_VERSION_PROMOTED` to `AuditEventType` in `backend/prisma/schema.prisma`
- [ ] T004 Extend `BankOffer` model with 4 columns (`approvalScore Int`, `approvalTier ApprovalTier`, `approvalFactors Json`, `engineVersion String`) and the two new indexes (`@@index([approvalScore], name: "idx_bank_offer_approval_score")`, `@@index([engineVersion], name: "idx_bank_offer_engine_version")`) in `backend/prisma/schema.prisma`
- [ ] T005 Add `ScoringEngineVersion` model in `backend/prisma/schema.prisma` per [data-model.md §2](./data-model.md#2-scoringengineversion--new-table) including the partial unique index `WHERE deactivatedAt IS NULL` and the activator FK to `StaffAccount`
- [ ] T006 Add `BankOfferDecision` model + `DecisionOutcome` enum + indexes in `backend/prisma/schema.prisma` per [data-model.md §3](./data-model.md#3-bankofferdecision--new-empty-table)
- [ ] T007 Generate the migration: `cd backend && npx prisma migrate dev --name approval_probability_display --create-only`. Open `backend/prisma/migrations/<ts>_approval_probability_display/migration.sql` and inline the backfill UPDATE + ALTER NOT NULL block per [research.md R-003](./research.md#r-003--backfill-strategy-for-historical-bank_offer-rows); wrap the whole file in `BEGIN; ... COMMIT;`
- [ ] T008 Append to the same migration: `CREATE UNIQUE INDEX scoring_engine_version_active_unique ON scoring_engine_version ((1)) WHERE "deactivatedAt" IS NULL;` and the seed `INSERT INTO scoring_engine_version (...) VALUES ('cl...seed...', '1.1.0-init', 'Initial seeded version', '{...weightsConfig per R-004...}'::jsonb, now(), NULL, now());` capturing the full `SCORING_WEIGHTS` constants from `backend/src/matching/scoring-weights.ts` + the threshold table + baseline factor catalog from [contracts/factor-catalog.md](./contracts/factor-catalog.md)
- [ ] T009 Apply migration locally and regenerate Prisma client: `cd backend && npx prisma migrate dev && npx prisma generate`
- [ ] T010 [P] Add 4 new error codes (`SCORING_VERSION_CONCURRENT_PROMOTION` 409, `SCORING_VERSION_NOT_FOUND` 404, `SCORING_VERSION_NO_ACTIVE` 503, `ANALYTICS_WINDOW_TOO_LARGE` 400) to `ERROR_CODES` + `ERROR_HTTP_STATUS` maps in `backend/src/common/errors/error-codes.ts`
- [ ] T011 [P] Add `ScoringVersionConcurrentPromotionException`, `ScoringVersionNotFoundException`, `ScoringVersionNoActiveException`, `AnalyticsWindowTooLargeException` to `backend/src/common/errors/domain.exceptions.ts`
- [ ] T012 [P] Add Arabic translations for the 4 new error codes to `admin/src/i18n/error-codes.ar-EG.json` per [contracts/error-codes.md](./contracts/error-codes.md)
- [ ] T013 [P] Add English translations for the 4 new error codes to `admin/src/i18n/error-codes.en-US.json` per [contracts/error-codes.md](./contracts/error-codes.md)
- [ ] T014 [P] Add the `ScoringConfig` value-object type in `backend/src/matching/types.ts`: `interface ScoringConfig { version: string; weights: Record<string, number>; thresholds: { excellent: number; good: number; moderate: number; low: number }; factorCatalog: Record<string, { labelAr: string; labelEn: string }>; legacy: boolean; }`. Type-only import — no runtime dependency on the registry.
- [ ] T015 [P] Add `FactorImpact` + `ApprovalProbabilityResult` types to `backend/src/matching/types.ts` per [research.md R-006](./research.md#r-006--approvalprobabilityresult-engine-output-shape)
- [ ] T016 Extend the ESLint boundary rule in `backend/.eslintrc.cjs`: add `src/scoring-versions/*` and `src/scoring-analytics/*` to the blocked-imports `patterns[].group` list inside the `files: ['src/matching/**/*.ts']` override (keeps Principle V boundary green)
- [ ] T017 Create `backend/src/scoring-versions/` directory with `scoring-versions.module.ts` (empty `@Module({})` shell exporting nothing yet) and register it under `imports:` of `backend/src/app.module.ts`
- [ ] T018 Create `backend/src/scoring-analytics/` directory with `scoring-analytics.module.ts` (empty `@Module({})` shell) and register it under `imports:` of `backend/src/app.module.ts`

**Phase 2 checkpoint**: schema migrated · 4 error codes round-trip AR/EN · 2 new feature modules wired · types added · ESLint boundary extended.

---

## Phase 3 — User Story 1 (P1): Structured `approvalProbability` payload

**Goal**: `POST /api/v1/apply` returns a fully structured `approvalProbability` object on every matched offer (score + tier + tierLabelCode + factors{positive,negative} + engineVersion); every persisted `bank_offer` row carries the same on its 4 new columns.

**Independent test**: §3 of [quickstart.md](./quickstart.md#3--submit-golden-scenario-1-with-structured-probability-postman--curl). Sign + POST a golden-scenario request, verify response shape against [contracts/openapi.yaml#ApprovalProbability](./contracts/openapi.yaml), query `bank_offer` directly to confirm all 4 columns persisted with non-null values.

- [ ] T019 [US1] `ScoringEngineVersionRepository` in `backend/src/scoring-versions/scoring-versions.repository.ts` — methods `findActive(): Promise<ScoringEngineVersionRow | null>`, `findByVersion(version: string): Promise<ScoringEngineVersionRow | null>`, with Prisma access encapsulated; type-narrowed `weightsConfig` Zod schema validation on read
- [ ] T020 [US1] `ScoringEngineVersionService` in `backend/src/scoring-versions/scoring-versions.service.ts` — `getActive(): Promise<ScoringConfig>` and `getByVersion(version): Promise<ScoringConfig>`. Hydrates the raw row into the pure `ScoringConfig` value object and caches nothing (per R-015)
- [ ] T021 [US1] Wire repository + service as providers in `backend/src/scoring-versions/scoring-versions.module.ts`; export `ScoringEngineVersionService`
- [ ] T022 [US1] Create `backend/src/applications/adapters/active-scoring-config.adapter.ts` — thin async function `loadActiveScoringConfig(svc: ScoringEngineVersionService): Promise<ScoringConfig>` that the orchestrator calls before invoking the engine; this is the ONLY bridge between the registry and the matching module (per R-001)
- [ ] T023 [US1] Update `backend/src/applications/applications.module.ts` to import `ScoringVersionsModule` so the adapter can inject `ScoringEngineVersionService`
- [ ] T024 [US1] Add boot-time integrity check in `backend/src/scoring-versions/scoring-versions.service.ts:onModuleInit()`: call `repo.findActive()`, throw `ScoringVersionNoActiveException` (FR-031) on null. Refuses to serve `/apply` until an operator promotes a version
- [ ] T025 [US1] Refactor `backend/src/matching/pipeline/approval-probability.ts` to emit the structured `ApprovalProbabilityResult` (per R-006): accept `scoringConfig: ScoringConfig` parameter, build `factors.positive` + `factors.negative` arrays as it sums each weighted contribution, classify into a tier via the threshold table, sort both arrays by `|impact|` desc, return `{ score, tier, factors }`. Apply clamping per R-007 and emit `CLAMPED_TO_FLOOR` / `CLAMPED_TO_CEILING` markers
- [ ] T026 [US1] Update `backend/src/matching/engine.service.ts:run()` signature to accept `scoringConfig: ScoringConfig` in the `EngineInput` object and forward it to the approval-probability pipeline call; remove the hard-coded `SCORING_WEIGHTS` import — config is now data passed in
- [ ] T027 [US1] Update `backend/src/applications/applications.service.ts:apply()`: call `loadActiveScoringConfig(scoringVersionsService)` before `engine.run`; stamp every returned offer's `approvalProbability` with `tierLabelCode = 'approval.tier.' + result.tier` and `engineVersion = scoringConfig.version`; keep response envelope shape in `apply-response.dto.ts`
- [ ] T028 [US1] Update `backend/src/applications/application.repository.ts` `CreateBankOfferInput` to include the 4 new columns (`approvalScore: number`, `approvalTier: ApprovalTier`, `approvalFactors: Prisma.InputJsonValue`, `engineVersion: string`); update `persistMatch()` to pass them through to `createMany` in the same transaction
- [ ] T029 [US1] Update `applications.service.ts:toOfferInput()` to map the new `ApprovalProbabilityResult` fields onto `CreateBankOfferInput`'s new 4 cols; preserve the existing `approvalProbabilityPercent` Decimal column (set from `result.score`) so feature 003 readers keep working during the rollover
- [ ] T030 [US1] Extend `MATCHING_ENGINE_RUN` audit payload in `applications.service.ts` with `engineVersion`, `bestOfferScore`, `bestOfferTier` (per data-model.md §4); compute `bestOfferScore`/`bestOfferTier` from the highest-score offer or set null when status='no_match'
- [ ] T031 [US1] Update `backend/src/applications/dto/apply-response.dto.ts`: replace per-offer `approvalProbabilityPercent: number` projection with the new `approvalProbability: ApprovalProbabilityDto` shape per [contracts/openapi.yaml#ApplyMatchedResponse](./contracts/openapi.yaml)
- [ ] T032 [US1] Update `applications.service.ts:toResponse()` to project `bank_offer` rows into the new shape; include the `legacy: true` flag from `approvalFactors` when present
- [ ] T033 [US1] [P] Add `ApprovalProbabilityDto` Swagger type with the structured shape to `backend/src/applications/dto/approval-probability.dto.ts` so OpenAPI at `/api/docs` reflects the new contract
- [ ] T034 [US1] [P] Type-check both projects: `cd backend && npx tsc --noEmit` and `cd admin && npx tsc --noEmit -p tsconfig.app.json` both exit 0
- [ ] T035 [US1] Run quickstart §3 end-to-end (signed apply request → inspect response → query DB columns); record any divergence in `specs/004-approval-probability-display/quickstart-failures.md`

**Phase 3 checkpoint**: mobile API consumer integrates against the new shape; DB persists every column; the engine version stamp travels end-to-end. MVP is shippable here.

---

## Phase 4 — User Story 2 (P1): Admin list pill + tier filter

**Goal**: `sales_manager` / `sales_agent` / `analyst` open the Applications list; every row shows a colored pill of the best-offer probability; 3 tier-bucket filter chips work and serialize to `?tier=` query parameter.

**Independent test**: §4 of [quickstart.md](./quickstart.md#4--admin-list--pill--tier-filter-operator). Seed 30 applications across the spectrum, sign in as `sales_manager`, verify pill colors track tier table, exercise each filter chip, verify URL serialization round-trips.

- [ ] T036 [US2] Add `findManyAdminWithBestOffer({ tier, status, loanPurpose, cursor, limit })` method to `backend/src/applications/application.repository.ts` — Prisma query with a `Application -> BankOffer` correlated subquery returning `bestOfferScore`, `bestOfferTier`, `bestOfferTierLabelCode`; applies the WHERE predicate from [research.md R-009](./research.md#r-009--tier-filter-query-plan)
- [ ] T037 [US2] Update `backend/src/applications/admin-applications.controller.ts` GET `/admin/applications`: accept `tier?: 'high'|'medium'|'needs_coaching'` query param; pass through to the new repository method; project `bestOffer` field per [contracts/openapi.yaml#BestOfferSummary](./contracts/openapi.yaml); preserve PII-masking on `maskedApplicant`
- [ ] T038 [US2] [P] **promax** pre-design for the list pill + tier-filter-chips component: design tokens, pill color mapping per tier (use `--color-success` / `--color-warning` / `--color-error` from `_tokens.scss`), chip iconography, empty-state copy. Write findings to `specs/004-approval-probability-display/design/promax-list-pill.md`
- [ ] T039 [US2] Create `admin/src/app/features/applications/list/components/approval-pill.component.ts` — standalone OnPush component, input `bestOffer: BestOfferSummary | null`, renders colored pill with localized tier label or muted "—" + "No matches yet" for null
- [ ] T040 [US2] Create `admin/src/app/features/applications/list/components/tier-filter-chips.component.ts` — standalone OnPush component, signal `selectedTier`, 3 chips ("High probability leads" / "Medium probability" / "Needs coaching") with per-chip count, emits filter change events; URL serialization handled by parent page
- [ ] T041 [US2] Update `admin/src/app/features/applications/list/applications-list.page.ts`: integrate `approval-pill` per row, integrate `tier-filter-chips` in the toolbar, read/write `?tier=` from `ActivatedRoute.queryParams` + `Router.navigate`, refetch on filter change
- [ ] T042 [US2] Update `admin/src/app/features/applications/applications.api.service.ts` (or feature-003 equivalent) to call `GET /api/admin/applications?tier=...` and parse `bestOffer` field
- [ ] T043 [US2] [P] Add i18n entries to `admin/src/i18n/messages.ar-EG.xlf`: tier labels (`approval.tier.excellent`, `.good`, `.moderate`, `.low`, `.very_low`), filter chip titles (`applications.filter.tier.high`, `.medium`, `.needs_coaching`), "No matches yet" copy
- [ ] T044 [US2] [P] Type-check admin: `cd admin && npx tsc --noEmit -p tsconfig.app.json` exits 0
- [ ] T045 [US2] [P] **impec** post-implementation polish pass on the list page: audit pill spacing/contrast/RTL/keyboard, fix issues. Write findings to `specs/004-approval-probability-display/design/impec-list-pill.md`
- [ ] T046 [US2] Run quickstart §4 end-to-end (seed → sign in → exercise filters → URL share); record divergence

**Phase 4 checkpoint**: list page renders triaged leads with one-click bucket switching.

---

## Phase 5 — User Story 3 (P2): Admin detail "Why this score?"

**Goal**: application-detail page renders each offer's probability prominently; an expandable panel shows the positive/negative factor lists with localized sentences sourced from the OFFER'S engine version's factor catalog; deprecated codes render with a "Deprecated in v\<active>" badge.

**Independent test**: §5 of [quickstart.md](./quickstart.md#5--admin-detail--why-this-score-expander-operator). Open a detail page, expand the panel, verify factor list matches the engine's contributions; localize AR/EN; open a backfilled (`engineVersion='1.0.0-legacy'`) offer and confirm the legacy notice instead of empty list.

- [ ] T047 [US3] Update `backend/src/applications/admin-applications.controller.ts` GET `/admin/applications/:id` to include the full `approvalProbability` object on each offer's projection (already persisted in Phase 3; this exposes it in the admin envelope)
- [ ] T048 [US3] [P] **promax** pre-design for the "Why this score?" panel: factor row layout, icon convention (up-arrow for positive, down-arrow for negative), sort order indicator (`|impact|` desc), legacy notice block, deprecated-factor badge. Write findings to `specs/004-approval-probability-display/design/promax-detail-panel.md`
- [ ] T049 [US3] Add `GET /api/admin/scoring-versions/:version` endpoint in `backend/src/scoring-versions/scoring-versions.controller.ts` (JWT + RolesGuard, all 4 roles) — returns the row's `weightsConfig.factorCatalog` so the admin detail panel can localize an offer's factor sentences from its own version, never the active one (FR-020)
- [ ] T050 [US3] Add `getFactorCatalog(version: string)` method to `admin/src/app/features/scoring-versions/scoring-versions.api.service.ts` (create the service file in same task) — calls the new GET endpoint, caches the result in a signal-backed memoization map (versions rarely change; cache hit is the common case)
- [ ] T051 [US3] Create `admin/src/app/features/applications/detail/components/why-this-score-panel.component.ts` — standalone OnPush component, input `offer: AdminOfferDto`, calls `factorCatalogService.getFactorCatalog(offer.approvalProbability.engineVersion)`, renders sorted factor rows with localized sentences + impact + arrow indicator; renders legacy notice when `approvalProbability.factors.legacy === true`; renders "Scored under engine v\<offer.engineVersion>" annotation when `offer.engineVersion !== activeEngineVersion()`
- [ ] T052 [US3] Update `admin/src/app/features/applications/detail/application-detail.page.ts` to embed `why-this-score-panel` per offer (collapsed by default; chevron toggles)
- [ ] T053 [US3] [P] Add i18n entries to `admin/src/i18n/messages.ar-EG.xlf`: "Why this score?" toggle label, "Scored under engine v{version}" annotation pattern, legacy notice copy ("Detailed factors unavailable for offers produced before engine version 1.1.0"), deprecated-factor badge ("Deprecated in v{active}")
- [ ] T054 [US3] [P] **impec** post-implementation polish pass on the detail panel: audit factor-row hierarchy/spacing/iconography contrast, fix issues. Write findings to `specs/004-approval-probability-display/design/impec-detail-panel.md`
- [ ] T055 [US3] [P] Type-check admin: `cd admin && npx tsc --noEmit -p tsconfig.app.json` exits 0
- [ ] T056 [US3] Run quickstart §5 end-to-end (open detail → expand panel → toggle AR/EN → open backfilled offer); record divergence

**Phase 5 checkpoint**: support-case workflow lands; operators answer "why?" without engineer support.

---

## Phase 6 — User Story 5 (P2): Engineer promotes a new engine version

**Goal**: `super_admin` can promote a registered scoring-engine version via the API; transaction is SERIALIZABLE; audit event emitted; concurrent promotions rejected.

**Independent test**: §7 + §8 of [quickstart.md](./quickstart.md#7--promote-a-new-engine-version-operator-role-super_admin). Insert a `1.2.0-test` row into the registry via raw SQL; promote via the endpoint; verify single-active invariant + audit event. Race two promotions to confirm one returns `SCORING_VERSION_CONCURRENT_PROMOTION`.

- [ ] T057 [US5] Add `activate(version: string, actorId: string)` method to `backend/src/scoring-versions/scoring-versions.repository.ts` — SERIALIZABLE transaction per [research.md R-010](./research.md#r-010--activation-endpoint-contract--audit): (1) SELECT FOR UPDATE the target row (throw `ScoringVersionNotFoundException` on null), (2) UPDATE current-active SET deactivatedAt=now(), (3) UPDATE target SET activatedAt=now(), deactivatedAt=NULL, (4) compute weightsDiff vs the previously-active row, (5) write `SCORING_ENGINE_VERSION_PROMOTED` audit event inside the same transaction, (6) catch Postgres 40001 → re-throw `ScoringVersionConcurrentPromotionException`
- [ ] T058 [US5] Add `activate(version: string, actor: JwtPayload)` method to `backend/src/scoring-versions/scoring-versions.service.ts` — semver validation (FR-008 pattern), delegates to repository, returns `{ previousVersion, newVersion, activatedAt }` for the response
- [ ] T059 [US5] Add `ScoringVersionsController` in `backend/src/scoring-versions/scoring-versions.controller.ts`: `@Controller('admin/scoring-versions')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `POST :version/activate` with `@Roles('super_admin')`, returns the envelope per [contracts/openapi.yaml#ActivateScoringVersionResponse](./contracts/openapi.yaml). Register controller in `scoring-versions.module.ts`
- [ ] T060 [US5] Add `weightsDiff(prevConfig, nextConfig)` helper in `backend/src/scoring-versions/scoring-versions.service.ts` returning top-5-by-`|delta|` changes; classifies bump kind (`major` / `minor` / `patch`) per FR-011a rules; feeds the audit payload
- [ ] T061 [US5] Wire `ScoringVersionsController` into the admin OpenAPI surface so `/api/docs` shows the new endpoint; tag `Admin · Scoring`
- [ ] T062 [US5] [P] Type-check backend: `cd backend && npx tsc --noEmit` exits 0
- [ ] T063 [US5] Run quickstart §7 + §8 end-to-end (insert row → activate → audit → race); record divergence

**Phase 6 checkpoint**: engine-version mutation has a safe, audited surface; no more raw-SQL promotion in dev.

---

## Phase 7 — User Story 4 (P3): Analyst distribution + accuracy

**Goal**: `analyst` (and `super_admin` / `sales_manager`) sees a histogram of approval-score distribution + a per-tier accuracy table over a 1-to-180-day window.

**Independent test**: §6 of [quickstart.md](./quickstart.md#6--analyst-view-operator-role-analyst). Seed 100 matched offers + a handful of decisions; sign in as analyst; verify histogram + table; try `?windowDays=400` → `ANALYTICS_WINDOW_TOO_LARGE`.

- [ ] T064 [US4] Add `BankOfferDecisionRepository.aggregateByTier(windowDays: number)` in `backend/src/scoring-analytics/scoring-analytics.repository.ts` — runs the per-tier aggregate SQL per [research.md R-011](./research.md#r-011--analytics-query-plan); returns `Array<{ tier, offerCount, decisionCount, approvalRate: number|null }>`
- [ ] T065 [US4] Add `aggregateDistribution(windowDays)` method to the same repository — runs the 10-point-bucket SQL; returns `Array<{ bucket: number, count: number }>` with implicit zeros for empty buckets
- [ ] T066 [US4] Add `ScoringAnalyticsService` in `backend/src/scoring-analytics/scoring-analytics.service.ts` — `getAnalytics(windowDays: number): Promise<{ windowDays, distribution, tierAccuracy }>`; throws `AnalyticsWindowTooLargeException` when `windowDays > 180` per FR-023a
- [ ] T067 [US4] Add `ScoringAnalyticsController` in `backend/src/scoring-analytics/scoring-analytics.controller.ts` — `@Controller('admin/scoring-analytics')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles('super_admin', 'sales_manager', 'analyst')`, `GET /` accepting `?windowDays=N` (default 30). Register controller + service + repository in `scoring-analytics.module.ts`
- [ ] T068 [US4] [P] **promax** pre-design for the analyst page: histogram visual treatment (inline SVG, no charting lib per plan §Primary Dependencies), tier-accuracy table layout, window picker UX (preset chips: 7d / 30d / 90d / 180d), too-large-window notice block. Write findings to `specs/004-approval-probability-display/design/promax-analytics.md`
- [ ] T069 [US4] Create `admin/src/app/features/scoring-analytics/scoring-analytics.routes.ts` with a single lazy route gated by `roleGuardFn(['super_admin', 'sales_manager', 'analyst'])`; register `/scoring-analytics` in `admin/src/app/app.routes.ts`
- [ ] T070 [US4] Create `admin/src/app/features/scoring-analytics/scoring-analytics.api.service.ts` — `getAnalytics(windowDays: number)` calls the new GET endpoint, returns typed response
- [ ] T071 [US4] Create `admin/src/app/features/scoring-analytics/components/score-distribution-histogram.component.ts` — standalone OnPush, input `buckets: Array<{ bucket; count }>`, renders 10 inline-SVG bars sized to the max count; AR/EN tooltips on hover
- [ ] T072 [US4] Create `admin/src/app/features/scoring-analytics/components/tier-accuracy-table.component.ts` — standalone OnPush, input `rows: Array<{ tier; offerCount; decisionCount; approvalRate }>`, renders a Material table; cells with `approvalRate === null` show `—` with an `@if` block + tooltip per FR-024
- [ ] T073 [US4] Create `admin/src/app/features/scoring-analytics/scoring-analytics.page.ts` — composes histogram + table + window picker; signal-backed `windowDays`; refetches on change; renders the "Use the data warehouse for windows > 180 days" notice on 400 response
- [ ] T074 [US4] [P] Add i18n entries to `admin/src/i18n/messages.ar-EG.xlf` for the analytics page (title, window-picker chip labels, histogram axis labels, tier-accuracy column headers, too-large notice)
- [ ] T075 [US4] [P] Add a sidebar nav entry "Scoring analytics" gated by `*can="['super_admin', 'sales_manager', 'analyst']"` in `admin/src/app/features/shell/sidebar.component.ts`
- [ ] T076 [US4] [P] **impec** post-implementation polish pass on the analytics page: audit histogram contrast/RTL/keyboard/screen-reader for chart, fix issues. Write findings to `specs/004-approval-probability-display/design/impec-analytics.md`
- [ ] T077 [US4] Run quickstart §6 end-to-end (seed → analyst sign-in → window picker → too-large rejection); record divergence

**Phase 7 checkpoint**: feedback loop wired even though decisions are empty; future feed lights the page up.

---

## Phase 8 — Polish & cross-cutting

- [ ] T078 Run the full quickstart top-to-bottom (§1–§12) on a freshly migrated environment; log any failures to `specs/004-approval-probability-display/quickstart-failures.md`; backfill verification (§10), boundary checks (§11), and performance check (§12) all pass at the budgets stated in [plan.md#performance-goals](./plan.md)

---

## Dependency graph

```
Phase 1 ──► Phase 2 ──► Phase 3 (US1) ──┬─► Phase 4 (US2)
                                        ├─► Phase 5 (US3)
                                        ├─► Phase 6 (US5)
                                        └─► Phase 7 (US4)
                                                  │
                                                  └─► Phase 8 (Polish)
```

Phases 4 / 5 / 6 / 7 are independent of each other — each consumes Phase 3's persisted data + Phase 2's registry but does not depend on its siblings. Pick MVP scope = 1 + 2 + 3 to ship. Add the rest in any order.

---

## Parallel-execution windows (per phase)

| Phase | Parallel windows |
|---|---|
| Phase 2 | T010–T015 all parallelizable (different files); T017+T018 parallelizable |
| Phase 3 | T033–T034 parallelizable; T019–T021 sequential (same module); T028–T032 sequential (same service) |
| Phase 4 | T038 (promax) parallel to T036–T037 (backend); T043–T045 parallel to T036–T042 (different files) |
| Phase 5 | T048 (promax) parallel to T047 (backend); T053–T055 parallel |
| Phase 6 | T062 parallel to T057–T061 (typecheck after each iteration) |
| Phase 7 | T068 (promax) parallel to T064–T067 (backend); T074–T076 parallel to T069–T073 (different files) |

---

## Implementation strategy

- **MVP scope**: Phases 1 + 2 + 3 (33 tasks). Delivers the canonical contract every downstream feature reads. Ship and integrate against it.
- **Sales-team workflow**: add Phase 4 (US2) next — daily-driver triage UI lands with one phase.
- **Support workflow**: Phase 5 (US3). Builds on US1's persisted factor lists; no new backend writes.
- **Safe engine evolution**: Phase 6 (US5). Activation endpoint is the v1 promotion contract; remove the raw-SQL promotion dance from dev quickstart.
- **Feedback loop**: Phase 7 (US4). Analyst page is read-only; ships even with empty decisions.
- **Polish**: Phase 8.

Land Phases 4 → 5 → 6 → 7 → 8 in priority order. Each phase is a separate PR.

---

## Notes

- Tests are intentionally NOT generated (constitution v1.2.0 dropped XVI + XXVII). Manual walkthrough of [quickstart.md](./quickstart.md) replaces automated verification.
- `promax` (pre-design) + `impec` (post-implementation) tasks are explicit per Principle XXIII (UI UX skill pipeline). Skipping either is a review block — the design folder under `specs/004-approval-probability-display/design/` captures both passes for traceability.
- Same-PR i18n parity: every new error code / i18n key lands in `ar-EG` AND `en-US` files in the same task that introduces the code (T010 ↔ T012 ↔ T013).
- Engine purity: tasks T014–T016 + T025–T026 keep the matching pipeline free of `@nestjs/*` runtime, Prisma, and the new `scoring-versions/*` / `scoring-analytics/*` modules. The adapter (T022) is the only bridge.
- Backfill correctness: T007 inlines the UPDATE statement before the `SET NOT NULL` ALTER so the migration cannot partially apply.
- Single-active-version invariant: T005 (partial unique index, layer 1) + T024 (boot integrity check, layer 3) + T057 (SERIALIZABLE transaction, layer 2) cover the three layers from [research.md R-002](./research.md#r-002--single-active-version-enforcement).
