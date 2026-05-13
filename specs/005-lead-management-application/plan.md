# Implementation Plan: Lead Management & Application Review Dashboard

**Branch**: `005-lead-management-application` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-lead-management-application/spec.md`
**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.3.0

## Summary

Ship the operational layer the dashboard has been missing: an append-only `Activity` table that records every agent action against an application (call / WhatsApp / email / receive-documents / mark-as-reviewed / submit-to-bank / etc.), a `Document` table that accepts file attachments via S3-compatible presigned-PUT uploads (MinIO in dev, AWS S3 in prod), an `assignedAgentStaffId` + new `LeadStatus` column on `Application` driving the agent-workflow lifecycle independent of feature 003's engine-outcome `status`, an hourly cron (`@nestjs/schedule` + Redis distributed lock) that flags stale leads, a customer-facing milestone timeline endpoint (HMAC-gated) that exposes only `leadStatus` transitions, and an analyst aggregate endpoint that anonymizes agent identities into per-session aliases. The admin application-detail page at `/applications/:id` is the SOLE action surface — every agent verb (Add Activity, Attach Documents, Assign / Reassign visible to managers, Mark Ready for Bank Submission, internal notes) lives in the detail header so the operator's mental model is "click row → detail → act."

The matching engine + scoring registry stay untouched. The applications module gains an `activities/` sub-feature; new `documents/` and `lead-analytics/` modules ship for the document store and the analyst aggregate respectively. 7 new error codes, 4 new audit events, and ~50 i18n keys round-trip AR/EN. Single migration adds `Activity` + `Document` + `LeadStatus` enum + new `AuditEventType` values + `assignedAgentStaffId`/`assignedAt`/`leadStatus` columns on `application` + Postgres triggers blocking `UPDATE`/`DELETE` on `activity` (append-only at the DB level, defence-in-depth on top of the no-update repository discipline).

Approach details + decision rationale in [research.md](./research.md). Persistent shapes in [data-model.md](./data-model.md). External contracts in [contracts/openapi.yaml](./contracts/openapi.yaml), [contracts/error-codes.md](./contracts/error-codes.md), [contracts/reason-codes.md](./contracts/reason-codes.md). Operator walkthrough in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**:
- Backend: Node.js 22 LTS (`.nvmrc`), TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).
- Frontend: TypeScript 5.4+ (same strictness), Angular 18 LTS.

**Primary Dependencies**:
- Backend: existing — NestJS 10, Prisma 5, `@nestjs/jwt`, `@nestjs/passport`, `class-validator`, `class-transformer`, `nestjs-pino`, `@nestjs/swagger`, `ioredis`, `zod`. **NEW** — `@nestjs/schedule` (cron decorator), `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. All small, well-maintained, no transitive bloat.
- Frontend: existing — Angular 18, `@angular/material` 18, `@angular/cdk`, `@angular/localize`. **No new packages**.
- Test: none required (constitution v1.2.0 dropped XVI + XXVII).

**Storage**:
- PostgreSQL 16: new tables `activity` + `document` + new enum `LeadStatus` + 4 new `AuditEventType` values + 3 columns on `application` (`assignedAgentStaffId`, `assignedAt`, `leadStatus`). Append-only enforcement via `BEFORE UPDATE/DELETE` Postgres triggers on `activity` raising an exception (SC-009).
- Redis 7: distributed-lock channel `stale-lead-scan:lock` (55-min TTL); per-analyst alias-table cache (15-min TTL keyed by analyst JWT `sub`).
- S3-compatible object storage: bucket `masrafy-documents-${NODE_ENV}`. Dev = MinIO single-container in `docker/compose.dev.yml`. Prod = AWS S3 (or any compatible service).

**Testing**: None constitutionally required. Manual walkthrough of [quickstart.md](./quickstart.md) substitutes for automated verification.

**Target Platform**:
- Backend: Linux x86_64 in Docker.
- Frontend: evergreen browsers, desktop-first (admin product).

**Project Type**: Web (backend + admin SPA in one repo). Mobile consumer (Flutter) consumes the customer-timeline endpoint under a future feature.

**Performance Goals**:
- Activity create + audit emit p95 < 250 ms.
- Activity timeline read p95 < 200 ms for 200 activities.
- Application list with row aggregations (last-activity, count, stale flag) p95 < 350 ms for 1 000 rows.
- Presigned-PUT URL request p95 < 100 ms.
- Direct-to-S3 upload (5 MB JPG) p95 < 2 s end-to-end on a Cairo 4G connection (SC-007).
- Customer timeline read p95 < 150 ms (single indexed query).
- Stale-lead cron p95 < 5 s for 10 000 applications.

**Constraints**:
- Append-only invariant enforced at DB layer (Postgres trigger) AND application layer (repository pattern has no `update*` method on `activity`).
- Multi-instance safe: cron uses Redis `SETNX` lock (no double-fire).
- HMAC-gated customer endpoint reuses feature 003's `MobileHmacGuard` + per-applicant rate-limit guard.
- All file uploads constrained to 10 MB + JPG/PNG/HEIC/PDF; reject at presigned-URL request step before any byte hits S3.
- Document filenames PII-stripped before persistence; never logged at any level.

**Scale/Scope**:
- ~10 000 active applications at end of year 1; ~50 000 activities/month at peak (5 per app on average).
- ~3 active sales agents, 1 sales manager, 1 analyst at launch; permission model accommodates 50+.
- Document table: ~100 000 rows year-1; total storage ~50 GB (median 500 KB per doc × 100 k).
- Audit events: hundreds per minute peak (every activity emits ≥ 1).

## Constitution Check

Walk-through against [constitution.md](../../.specify/memory/constitution.md) v1.3.0. ✅ Pass · ⚠ N/A · ❌ Violation.

### Core Cross-Platform Principles

- **I. Financial Data Integrity** ⚠ N/A — no money calculations; existing Decimal columns stay untouched.
- **II. Bank Programs Are Data, Not Code** ✅ — `SUBMITTED_TO_BANK` activity reason set dynamically derives from active `BankProgram` rows (FR-003); no `if (bankCode === ...)` branches anywhere in this feature.
- **III. Typed Errors End-to-End** ✅ — 7 new codes (`ACTIVITY_FORBIDDEN_NOT_ASSIGNED`, `INVALID_ACTIVITY_REASON`, `REASON_DETAILS_REQUIRED`, `DURATION_REQUIRED_FOR_CALL`, `FOLLOWUP_IN_PAST`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`) ship with AR + EN translations in the same PR.
- **IV. Arabic-First i18n** ✅ — every activity-type label + reason chip + filter chip + customer milestone label ships in `messages.{ar-EG,en-US}.xlf` and `error-codes.{ar-EG,en-US}.json`. Logical CSS only.
- **V. Matching Engine Is the Core IP** ✅ — engine pure-pipeline boundary intact. New modules (`activities/`, `documents/`, `lead-analytics/`) cannot import from `src/matching/`; the ESLint engine-boundary rule already blocks the reverse direction.
- **VI. PII Protection** ✅ — activity `note` field treated as PII: Pino redact path covers it, never returned to analysts, never exposed via customer timeline. Original document filenames stripped before persistence. S3 bucket policy denies public-read.
- **VII. Observability** ✅ — 4 new audit events (`APPLICATION_ACTIVITY_LOGGED`, `DOCUMENT_UPLOADED`, `APPLICATION_REASSIGNED`, `MANAGER_ATTENTION_REQUESTED`). All correlated via a per-action `correlationId`. Cron run emits a `STALE_LEAD_SCAN_COMPLETED` info log with run-duration + flags-created count.
- **VIII. Brand Identity** ✅ — every new UI surface uses tokens (timeline color-coding per activity type, pill colors from existing tokens). No raw hex.

### Backend Principles

- **IX. Feature Module Architecture** ✅ — new modules: `activities/`, `documents/`, `lead-analytics/`. `applications/` extended (assignment + leadStatus adapter). `common/` unchanged.
- **X. Repository Pattern Mandatory** ✅ — `ActivityRepository`, `DocumentRepository`, `LeadAnalyticsRepository` own Prisma access. The activity repo exposes NO `update` / `delete` method — append-only at the API layer; the Postgres trigger is the second layer.
- **XI. Prisma Migration Discipline** ✅ — single named migration `20260513XXXXXX_lead_management_activity` adds the entity tables + enum + trigger + AuditEventType extension + 3 application columns. No `db push`. Indexes on every FK and on hot-path WHERE/ORDER BY paths.
- **XII. DTO vs Entity Separation** ✅ — DTOs: `CreateActivityRequestDto`, `RequestUploadUrlRequestDto`, `AssignLeadRequestDto`, `ActivityResponseDto`, `CustomerTimelineResponseDto`, `LeadActivitySummaryResponseDto`. Prisma types stay in repositories.
- **XIII. Dual Authentication** ✅ — customer-timeline endpoint reuses feature 003's `MobileHmacGuard` + rate-limit. Admin endpoints JWT + RolesGuard.
- **XIV. API Contract Standards** ✅ — envelope `{ success, data }`. OpenAPI at `/api/docs` regenerated.
- **XV. Rate Limiting** ✅ — activity-create inherits admin throttler; customer-timeline inherits mobile rate-limit (5/h per applicant fingerprint); presigned-URL request inherits admin throttler.
- **XVI. Backend Testing** ⚠ N/A — constitution v1.2.0 dropped.

### Angular Principles

- **XVII. Standalone Components Only** ✅ — every new screen / component / dialog ships standalone.
- **XVIII. Signals Over RxJS** ✅ — timeline state + filter state + reminder widget all signal-backed.
- **XIX. New Control Flow** ✅ — `@if` / `@for ... track` / `@switch` / `@defer` everywhere new templates land.
- **XX. inject() Function** ✅ — no constructor DI in new code.
- **XXI. Strict TypeScript** ✅ — no `any`. `unknown` + narrowing in JSONB-payload handling.
- **XXII. Typed Reactive Forms** ✅ — Add Activity dialog uses typed reactive form.
- **XXIII. UI UX Skills are the Design Authority** ✅ — 5 new screens / components (detail-page action header, Add Activity modal, list filter chips, analyst aggregate report, reminders widget). Each gets a `promax` pre-design + `impec` post-implementation task in tasks.md. Customer-timeline endpoint is API-only — no UI in this feature.
- **XXIV. Design Tokens** ✅ — activity-type icons + colors source from existing tokens. No raw hex.
- **XXV. Lazy-Loaded Routes + Functional Guards** ✅ — `/lead-analytics` lazy-loaded; gated by `roleGuardFn(['super_admin','sales_manager','analyst'])`.
- **XXVI. HTTP Layer Discipline** ✅ — `HttpClient` only. Existing interceptors apply.
- **XXVII. Frontend Testing** ⚠ N/A — v1.2.0 dropped.

### Flutter

- **XXVIII. Flutter Architectural Foundations** ⚠ N/A — Flutter consumes the customer-timeline endpoint under a separate future feature.

**Result**: ✅ All gates pass. No complexity-tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-lead-management-application/
├── plan.md                       # This file
├── research.md                   # Phase 0 output (12 R-entries)
├── data-model.md                 # Phase 1 output
├── quickstart.md                 # Phase 1 output
├── contracts/
│   ├── openapi.yaml              # All new endpoints
│   ├── error-codes.md            # 7 new codes + AR/EN
│   └── reason-codes.md           # Canonical activity-type × reason-code matrix
├── design/
│   ├── promax-{add-activity-modal,list-filters,activity-timeline,analyst-report,reminders-widget}.md
│   └── impec-{ … same set … }.md
└── tasks.md                      # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma             # +Activity, +Document, +LeadStatus enum, +AuditEventType values, +3 application cols
│   └── migrations/
│       └── 20260513XXXXXX_lead_management_activity/migration.sql
└── src/
    ├── activities/               # NEW
    │   ├── activities.module.ts
    │   ├── activities.controller.ts            # POST /api/admin/applications/:id/activities
    │   ├── activities.service.ts
    │   ├── activities.repository.ts            # NO update/delete methods (append-only)
    │   ├── activities.types.ts                 # ActivityType + ReasonCode unions
    │   ├── activity-reasons.ts                 # Readonly<Record<ActivityType, ReasonCode[]>> (mirrors contracts/reason-codes.md)
    │   ├── stale-lead-scanner.ts               # @Cron('0 * * * *') + Redis lock
    │   └── dto/
    │       ├── create-activity.request.dto.ts
    │       └── activity.response.dto.ts
    ├── documents/                # NEW
    │   ├── documents.module.ts
    │   ├── documents.controller.ts             # POST /api/admin/documents/upload-url (presigned PUT) + GET /api/admin/documents/:id/download
    │   ├── documents.service.ts
    │   ├── documents.repository.ts
    │   ├── s3-storage.client.ts                # @aws-sdk/client-s3 wrapper
    │   └── dto/
    │       ├── request-upload-url.dto.ts
    │       └── document.response.dto.ts
    ├── lead-analytics/           # NEW
    │   ├── lead-analytics.module.ts
    │   ├── lead-analytics.controller.ts        # GET /api/admin/lead-analytics/activity-summary
    │   ├── lead-analytics.service.ts
    │   ├── lead-analytics.repository.ts
    │   ├── alias-resolver.service.ts           # per-analyst session-consistent agent aliases (Redis-cached)
    │   └── dto/activity-summary.response.dto.ts
    ├── applications/
    │   ├── applications.service.ts             # MODIFIED — leadStatus transitions on activity write
    │   ├── application.repository.ts           # MODIFIED — list query carries last-activity aggregate + filter predicates
    │   ├── admin-applications.controller.ts    # MODIFIED — extends list filters + POST :id/assign + GET :id/timeline (HMAC)
    │   └── adapters/
    │       └── lead-status-transition.adapter.ts  # NEW — pure function: activity → leadStatus transition rule
    └── common/errors/
        └── error-codes.ts                      # MODIFIED — 7 new codes

admin/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   ├── applications/                   # MODIFIED — detail page becomes action surface
│   │   │   │   ├── list/
│   │   │   │   │   └── applications-list.page.ts          # MODIFIED — new filter chips, last-activity column
│   │   │   │   ├── detail/
│   │   │   │   │   ├── application-detail.page.ts         # MODIFIED — action header (FR-010b) + timeline embed
│   │   │   │   │   └── components/
│   │   │   │   │       ├── activity-timeline.component.ts            # NEW
│   │   │   │   │       ├── add-activity.dialog.ts                    # NEW
│   │   │   │   │       └── lead-assign.dialog.ts                     # NEW
│   │   │   │   └── api/applications.api.service.ts                   # MODIFIED — activity create + timeline read
│   │   │   ├── lead-analytics/                  # NEW
│   │   │   │   ├── lead-analytics.routes.ts
│   │   │   │   ├── lead-analytics.page.ts
│   │   │   │   ├── lead-analytics.api.service.ts
│   │   │   │   └── components/
│   │   │   │       └── agent-activity-table.component.ts
│   │   │   └── shell/
│   │   │       └── reminders-widget.component.ts                     # NEW (dashboard widget)
│   │   └── app.routes.ts                       # MODIFIED — adds /lead-analytics
│   └── i18n/
│       ├── error-codes.ar-EG.json              # MODIFIED — 7 new entries
│       ├── error-codes.en-US.json              # MODIFIED — 7 new entries
│       └── messages.ar-EG.xlf                  # MODIFIED — ~50 new units

docker/
└── compose.dev.yml                              # MODIFIED — add MinIO service
```

**Structure Decision**: Activities, Documents, and Lead-Analytics each get their own backend module — clean ownership boundaries. The matching engine stays untouched. The applications module gains 2 modifications: list-query extension (filter chips + last-activity aggregation) and a thin adapter that maps activity writes to `leadStatus` transitions. The detail page at `/applications/:id` is the SOLE action surface (FR-010a–d); the list page never carries inline action buttons. Frontend gains a new feature folder for analyst reports, a new reminders widget on the dashboard, and three new components on the existing application-detail page (timeline + add-activity dialog + assign dialog).

## Complexity Tracking

> All Constitution Check gates pass. No violations to justify.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
