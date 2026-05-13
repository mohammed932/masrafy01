# Implementation Plan: Approval Probability Display Enhancement

**Branch**: `004-approval-probability-display` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-approval-probability-display/spec.md`
**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.3.0

## Summary

Take the integer approval-probability number that the feature-003 matching engine already produces and ship the entire presentation + governance stack around it: a structured `{ score, tier, tierLabelCode, factors: { positive, negative }, engineVersion }` object that replaces the flat `approvalProbabilityPercent` field on every persisted `BankOffer` and on every `POST /api/v1/apply` response; a `ScoringEngineVersion` registry (one row per engine, JSONB `weightsConfig` snapshot including the threshold table and a self-contained `factorCatalog` so old offers always localize); a `super_admin`-only `POST /api/admin/scoring-versions/:version/activate` endpoint that flips the active version under a SERIALIZABLE transaction and emits a `SCORING_ENGINE_VERSION_PROMOTED` audit event; admin list pill + 3-bucket tier filter (`excellent` / `good` / `< good ∪ no_match`); admin detail "Why this score?" expander sourcing factor sentences from the offer's own engine version (so deprecated factors render with a "Deprecated in v\<active>" badge instead of going missing); analyst distribution + per-tier accuracy view bounded to a 180-day look-back window; 4 new error codes (`SCORING_VERSION_CONCURRENT_PROMOTION`, `SCORING_VERSION_NOT_FOUND`, `SCORING_VERSION_NO_ACTIVE`, `ANALYTICS_WINDOW_TOO_LARGE`) wired across backend + AR/EN i18n in the same PR.

The matching engine's calculation surface (`backend/src/matching/pipeline/approval-probability.ts` + `scoring-weights.ts`) stays where it is. The engine emits the new structured object instead of a flat integer; everything else is new persistence, new endpoints, new admin UI, new audit, new error codes. Constitution Principle V's purity boundary is preserved — the registry is consumed via a thin adapter that the matching module imports at the orchestrator boundary, never inside the pure pipeline.

Approach details and decision rationale in [research.md](./research.md). Persistent data shapes in [data-model.md](./data-model.md). External contracts in [contracts/openapi.yaml](./contracts/openapi.yaml) and [contracts/error-codes.md](./contracts/error-codes.md). Bring-up walkthrough in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**:
- Backend: Node.js 22 LTS (`.nvmrc`), TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).
- Frontend: TypeScript 5.4+ (same strictness profile), Angular 18 LTS.

**Primary Dependencies**:
- Backend: existing — NestJS 10, Prisma 5 (PostgreSQL provider), `@nestjs/jwt`, `@nestjs/passport`, `class-validator`, `class-transformer`, `nestjs-pino`, `@nestjs/swagger`, `ioredis`, `zod`. **No new runtime dependencies** introduced by this feature.
- Frontend: existing — Angular 18, `@angular/material` 18, `@angular/cdk`, `@angular/localize`. Adds **no new packages**; chart for the analyst distribution view is a single inline SVG rendered from JSON aggregate (no charting library).
- Test: none required (constitution v1.2.0 dropped XVI + XXVII testing requirements).

**Storage**:
- PostgreSQL 16: extends existing `bank_offer` table with 4 columns (`approvalScore`, `approvalTier`, `approvalFactors`, `engineVersion`) plus their indexes; adds new `scoring_engine_version` table; adds empty placeholder `bank_offer_decision` table for the analyst page.
- Redis 7: re-uses the existing admin throttler; no new keys.
- No object storage / no external API.

**Testing**: None constitutionally required (v1.2.0). Manual walkthrough of [quickstart.md](./quickstart.md) §1–§10 stands in for automated verification.

**Target Platform**:
- Backend: Linux x86_64 in Docker, Node 22.
- Frontend: Modern evergreen browsers (Chrome, Edge, Firefox, Safari latest two). Mobile-browser admin support out of scope.

**Project Type**: Web (backend service + admin SPA, separate packages in one repo). Mobile (Flutter) consumes the new `/api/v1/apply` response shape but ships separately under feature 005.

**Performance Goals**:
- `POST /api/v1/apply` p95 unchanged (≤ 800 ms end-to-end per SC-001 of feature 003). The structured payload adds ≤ 1 KB per offer; payload size delta is negligible.
- Admin list with pill + filter p95 < 250 ms for 1 000 applications + 5 offers each (single indexed query on `bank_offer.approvalScore` + `application.status`).
- Detail-page "Why this score?" expansion: in-page-render only (data already in row); SC-005 caps at 300 ms.
- Analytics page (FR-023) p95 < 2 s on 100 k offers + 10 k decisions over a 30-day window (SC-009).
- Activation endpoint (FR-011b) p95 < 100 ms (single SERIALIZABLE transaction).

**Constraints**:
- Backfill of historical `bank_offer` rows must complete in < 60 s on a 100 k-row table (SC-002). Migration uses a single `UPDATE ... SET approvalScore = ROUND(approvalProbabilityPercent), approvalTier = CASE ... END, approvalFactors = '{"positive":[],"negative":[],"legacy":true}'::jsonb, engineVersion = '1.0.0-legacy' WHERE engineVersion IS NULL` statement.
- Engine purity (Principle V): nothing inside `src/matching/` may import from `prisma/`, `@nestjs/*` runtime, or the new `scoring-versions/` module. The matching orchestrator reads the active version into a pure `ScoringConfig` value object before invoking the pipeline.
- Single-active-version invariant (FR-009): enforced both via SERIALIZABLE transaction in the activation endpoint AND via a Postgres partial unique index `WHERE deactivatedAt IS NULL` so the database refuses to hold two active rows even under transaction-isolation downgrades.
- Cookie / CORS / HMAC / rate-limit: unchanged from feature 001 + 003.

**Scale/Scope**:
- `scoring_engine_version` rows: < 50 total across the platform's lifetime; no pagination needed.
- `bank_offer` rows: target 100 k–1 M over 24 months (live tier) plus archived rows in cold storage.
- `bank_offer_decision` rows: empty at launch; ship pre-indexed and pre-FK-wired so the future feed lights up the analyst page on the first insert.
- Analyst-page query: capped at 180-day window per FR-023a; OLTP-scale fine.

## Constitution Check

Walk-through against [constitution.md](../../.specify/memory/constitution.md) v1.3.0. Marker key: ✅ Pass · ⚠ N/A for this feature · ❌ Violation (would block PR; none here).

### Core Cross-Platform Principles

- **I. Financial Data Integrity** ⚠ N/A — the score is an integer 0–100; no monetary calculation surface added.
- **II. Bank Programs Are Data, Not Code** ✅ — the new tier thresholds + factor catalog live in `weightsConfig` JSONB on `scoring_engine_version`, never branched in code by program code. No `if (programCode === '...')` blocks.
- **III. Typed Errors End-to-End** ✅ — 4 new codes (`SCORING_VERSION_CONCURRENT_PROMOTION`, `SCORING_VERSION_NOT_FOUND`, `SCORING_VERSION_NO_ACTIVE`, `ANALYTICS_WINDOW_TOO_LARGE`) ship with AR + EN translations in the same PR. Mapping centralized in `ErrorCodeService.toLocalizedMessage(code, meta)`.
- **IV. Arabic-First i18n** ✅ — every tier label (4 codes), every factor sentence (per-version catalog), and every admin-page label ships in `messages.{ar-EG,en-US}.xlf`. Pills render with logical CSS properties only. The API stays locale-agnostic and returns stable codes.
- **V. The Matching Engine is the Core IP** ✅ — calculation lives in `src/matching/pipeline/approval-probability.ts` as before; pipeline stays free of `@nestjs/*` runtime + Prisma + scoring-versions modules. Adapter pattern: the matching orchestrator reads the active `ScoringConfig` from the registry (in `applications.service.ts`, NOT inside the pipeline), then passes it as a pure value into the engine. ESLint `no-restricted-imports` rule (added in feature 003) continues to enforce the boundary.
- **VI. PII Protection** ✅ — factor codes are categorical (`HAS_CD_AT_ABK`, `PAYROLL_TRANSFER`, etc.); no PII enters `approvalFactors`. Analytics page aggregates only — no per-row PII in the chart payload. No new audit-payload PII.
- **VII. Observability** ✅ — extends existing `MATCHING_ENGINE_RUN` payload with `engineVersion + bestOfferScore + bestOfferTier`; adds new `SCORING_ENGINE_VERSION_PROMOTED` event (actor, previousVersion, newVersion, weights-diff summary). Correlation IDs already in place from feature 003.
- **VIII. Brand Identity** ✅ — pill colors map to existing `--color-success` / `--color-warning` / `--color-error` tokens declared in `admin/src/styles/_tokens.scss`. No raw hex in components.

### Backend Principles

- **IX. Feature Module Architecture** ✅ — new `src/scoring-versions/` module (controller + service + repository + DTOs). The matching module imports a single thin adapter (`active-scoring-config.adapter.ts`) that lives in `src/applications/` (the orchestrator boundary), keeping `src/matching/` import-free from infrastructure. `common/` unchanged.
- **X. Repository Pattern Mandatory** ✅ — `ScoringEngineVersionRepository` owns all Prisma access; services never touch `prisma.*`. `BankOfferRepository` (already in `applications/`) extends to populate the new 4 columns.
- **XI. Prisma Migration Discipline** ✅ — single named migration `20260513XXXXXX_approval_probability_display`: adds 4 columns to `bank_offer` with sensible NOT NULL defaults via expression (`approvalScore = ROUND(approvalProbabilityPercent)` etc.), creates `scoring_engine_version` table with partial unique index `WHERE "deactivatedAt" IS NULL`, creates empty `bank_offer_decision` table with FK + indexes, seeds the initial `1.1.0-init` row from current `SCORING_WEIGHTS`. No `db push`.
- **XII. DTO vs Entity Separation** ✅ — new DTOs: `ScoringVersionResponseDto`, `ApprovalProbabilityDto` (nested in `ApplyResponseDto`). Prisma types confined to repositories. Global `ValidationPipe` already in place.
- **XIII. Dual Authentication** ✅ — `/api/v1/apply` continues to require HMAC (feature 003). Admin endpoints (`/api/admin/applications`, `/api/admin/scoring-versions/...`, `/api/admin/scoring-analytics`) require JWT + role guard.
- **XIV. API Contract Standards** ✅ — envelope `{ success, data }` unchanged. Activation endpoint returns `{ success: true, data: { previousVersion, newVersion, activatedAt } }`. Analytics endpoint returns `{ success: true, data: { distribution: [], tierAccuracy: [] } }`. OpenAPI at `/api/docs` regenerates.
- **XV. Rate Limiting & Abuse Protection** ✅ — activation endpoint inherits the admin throttler; analytics endpoint added to the same tier (cheap aggregate query under capped 180-day window). No new Redis keys.
- **XVI. Backend Testing Requirements** ⚠ N/A — constitution v1.2.0 dropped this principle. Manual walkthrough only.

### Angular Principles

- **XVII. Standalone Components Only** ✅ — every new screen (analytics page, factor-panel component, tier-filter chips) is standalone.
- **XVIII. Signals Over RxJS** ✅ — analytics rows + filter state held in signals. No `BehaviorSubject` in component state.
- **XIX. New Control Flow** ✅ — `@if` / `@for ... track` / `@switch` everywhere new templates land.
- **XX. inject() Function** ✅ — no constructor DI in new code.
- **XXI. Strict TypeScript** ✅ — no `any`. `unknown` + narrowing in factor-list rendering.
- **XXII. Typed Reactive Forms** ✅ — analytics window picker uses typed reactive form.
- **XXIII. UI UX Skills are the Design Authority** ✅ — every new admin screen (list-filter chips, detail "Why this score?" panel, analyst distribution + accuracy view) MUST invoke `promax` pre-design and `impec` post-implementation. Three pre-design tasks + three post-implementation tasks in tasks.md.
- **XXIV. Design Tokens — #06152D Base** ✅ — tier-pill colors source from `--color-success` / `--color-warning` / `--color-error` tokens; no raw hex in components.
- **XXV. Lazy-Loaded Routes + Functional Guards** ✅ — `/admin/scoring-analytics` lazy-loaded; gated by `roleGuardFn(['super_admin', 'sales_manager', 'analyst'])`.
- **XXVI. HTTP Layer Discipline** ✅ — `HttpClient` only; existing interceptors (correlation → auth → error → toast) cover all new endpoints.
- **XXVII. Frontend Testing Requirements** ⚠ N/A — v1.2.0 dropped.

### Flutter (Phase 2, skeleton binding now)

- **XXVIII. Flutter Architectural Foundations** ⚠ N/A for this feature — Flutter consumes the new payload but ships under feature 005. The `approvalProbability` DTO shape documented in this feature's OpenAPI is the contract Flutter integrates against.

**Result**: ✅ All gates pass. No complexity-tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/004-approval-probability-display/
├── plan.md                       # This file
├── research.md                   # Phase 0 output (15 R-entries)
├── data-model.md                 # Phase 1 output (entity + column diff)
├── quickstart.md                 # Phase 1 output (operator walkthrough)
├── contracts/
│   ├── openapi.yaml              # /api/v1/apply response delta + admin endpoints
│   ├── error-codes.md            # 4 new codes + AR/EN translations
│   └── factor-catalog.md         # canonical factor-code → label mapping (1.1.0-init baseline)
└── tasks.md                      # Phase 2 output (/speckit.tasks command — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma             # +4 cols on bank_offer; +scoring_engine_version table; +bank_offer_decision placeholder
│   └── migrations/
│       └── 20260513XXXXXX_approval_probability_display/migration.sql
└── src/
    ├── scoring-versions/                # NEW feature module
    │   ├── scoring-versions.module.ts
    │   ├── scoring-versions.controller.ts            # POST /api/admin/scoring-versions/:version/activate
    │   ├── scoring-versions.service.ts
    │   ├── scoring-versions.repository.ts
    │   ├── scoring-versions.types.ts                 # ScoringConfig, FactorCatalog value-objects
    │   └── dto/
    │       └── scoring-version.response.dto.ts
    ├── scoring-analytics/               # NEW feature module
    │   ├── scoring-analytics.module.ts
    │   ├── scoring-analytics.controller.ts           # GET /api/admin/scoring-analytics
    │   ├── scoring-analytics.service.ts
    │   ├── scoring-analytics.repository.ts
    │   └── dto/
    │       └── scoring-analytics.response.dto.ts
    ├── matching/
    │   └── pipeline/
    │       └── approval-probability.ts               # MODIFIED — output shape now ApprovalProbabilityResult
    ├── applications/
    │   ├── applications.service.ts                   # MODIFIED — loads ScoringConfig from registry before engine.run
    │   ├── application.repository.ts                 # MODIFIED — persists 4 new cols on BankOffer
    │   ├── admin-applications.controller.ts          # MODIFIED — list response carries bestOffer pill data; supports tier filter
    │   └── adapters/
    │       └── active-scoring-config.adapter.ts      # NEW — bridge between scoring-versions repo and matching module
    └── common/errors/
        └── error-codes.ts                            # MODIFIED — 4 new codes

admin/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   ├── applications/            # MODIFIED — list pill + tier-filter chips
│   │   │   │   ├── list/
│   │   │   │   │   ├── applications-list.page.ts
│   │   │   │   │   └── components/
│   │   │   │   │       ├── approval-pill.component.ts          # NEW
│   │   │   │   │       └── tier-filter-chips.component.ts      # NEW
│   │   │   │   └── detail/
│   │   │   │       ├── application-detail.page.ts
│   │   │   │       └── components/
│   │   │   │           └── why-this-score-panel.component.ts   # NEW
│   │   │   └── scoring-analytics/       # NEW feature folder
│   │   │       ├── scoring-analytics.routes.ts
│   │   │       ├── scoring-analytics.page.ts
│   │   │       ├── components/
│   │   │       │   ├── score-distribution-histogram.component.ts
│   │   │       │   └── tier-accuracy-table.component.ts
│   │   │       └── scoring-analytics.api.service.ts
│   │   └── app.routes.ts                # MODIFIED — adds /scoring-analytics lazy route
│   └── i18n/
│       ├── error-codes.ar-EG.json       # MODIFIED — 4 new entries
│       ├── error-codes.en-US.json       # MODIFIED — 4 new entries
│       └── messages.ar-EG.xlf           # MODIFIED — tier labels, factor sentences (baseline catalog), analytics page strings
└── (no new packages)
```

**Structure Decision**: feature 003's matching pipeline stays pure (Principle V). New `scoring-versions/` module owns persistence + the activation endpoint; new `scoring-analytics/` module owns the aggregate read path. `applications/adapters/active-scoring-config.adapter.ts` is the single bridge between the registry and the matching engine — the matching pipeline imports the `ScoringConfig` *type* only, never the adapter or repository. The admin app gains one new feature folder (`scoring-analytics/`) plus three new component files inside existing `applications/`. Zero new runtime dependencies in either project.

## Complexity Tracking

> All Constitution Check gates pass. No violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
