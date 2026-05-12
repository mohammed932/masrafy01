# Implementation Plan: Matching Engine — POST /api/v1/apply with Ranked Offers

**Branch**: `003-matching-engine-post` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-matching-engine-post/spec.md`

## Summary

Deliver Masrafy's core IP: a pure-module matching engine that resolves eligibility + tier cascade + income strategy + DBR + approval probability across all active bank programs (feature 002), produces ranked immutable bank-offer snapshots, and exposes them via a HMAC-authenticated `POST /api/v1/apply` (mobile) + an internal staff applications list / detail view (admin). The engine is dependency-free (Constitution Principle V) — importable by future ML / batch features without HTTP / DB / DI overhead. Five user stories: P1 submit + receive offers, P1 staff list + detail, P2 no-match suggestions, P2 idempotency, P3 offline-fixture invocation. Sixty-eight FRs, twenty-two SCs, fourteen golden test scenarios. Five clarifications resolved: 24-month live retention + 7-year audit tier + Egyptian PDPL erasure, Cat-A preference detected implicitly via pricing-tier keys, suggestions greedy-by-impact matrix, transient `draft` state in single transaction, tiered rate limit (30/hr per HMAC client + 5/hr per applicant fingerprint).

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ on admin.

**Primary Dependencies**:
- Backend: NestJS 10, Prisma 5, `class-validator`, `class-transformer`, `@nestjs/throttler` (Redis-backed for tiered rate limits FR-066), `nestjs-pino`, `@nestjs/swagger`, `zod` (env), `ioredis` (idempotency-key cache TTL 1 h + rate-limit sliding-window counters), `crypto` (HMAC verification + applicant-fingerprint sha256). No new external libraries beyond what feature 001 + 002 already pinned.
- Admin: Angular 18 standalone, Angular Material 18 + the in-house `BrandSelectComponent` from feature 002, `@angular/cdk`, `@angular/localize`. No new admin libraries.

**Storage**:
- PostgreSQL 16 (Prisma migrations only). New tables: `application`, `bank_offer`. Extends existing `audit_event` enum with six new event-type values.
- Redis 7: idempotency-key cache (1 h TTL), rate-limit sliding-window counters (1 h TTL), HMAC nonce store (5 min TTL).
- S3-compatible object storage: 24-month → cold-tier archival pipeline target (compressed JSONL + manifest). Reads from cold-tier are auditor-only.

**Testing**: NONE constitutionally required (Principles XVI + XXVII v1.2.0 placeholders). The feature MAY add Vitest unit specs for the engine + suggestions at developer discretion (research R12 — 14 golden scenarios form the regression bedrock and an obvious target). Not mandated.

**Target Platform**: Linux server (Node 22 LTS Docker, non-root user); modern evergreen browsers for the admin SPA; the mobile applicants reach the endpoint via the future Flutter client (out of scope; the HMAC contract published here).

**Project Type**: Web — `backend/` NestJS service + `admin/` Angular SPA + mobile-facing endpoint under `/api/v1/apply` (Principle XIV).

**Performance Goals**:
- Engine-only p95 < 500 ms at 20 active programs (SC-009)
- End-to-end endpoint p95 < 800 ms (SC-001)
- Suggestions engine adds < 100 ms when invoked
- Idempotency cache lookup < 10 ms (Redis local network)
- Rate-limit Redis check < 5 ms

**Constraints**:
- Constitution Principle I — `Prisma.Decimal` end-to-end; `BankOffer` rows NEVER mutated post-creation.
- Principle II — no `programCode` branches in the engine.
- Principle III — error codes are stable identifiers; no English on the boundary.
- Principle V — engine module is pure; dependency-graph audit (SC-019) is the binding gate.
- Principle VI — no PII in logs; rate-limit fingerprint pre-hashed.
- Principle VII — six new discrete event types plumb correlation id.
- Principle XIII — HMAC signing on `/api/v1/apply` with nonce replay-protection.
- Principle XIV — versioned `/api/v1/`.
- Principle XV — tiered rate limits per FR-066.
- Principle XXIII v1.3.0 — three new screens each require promax + impec.
- Engine module MUST NOT import from `bank-programs/` runtime modules; only types-only imports allowed (ESLint boundary rule).

**Scale/Scope**:
- 20–60 active programs at launch; engine scales linearly with program count.
- Expected applications: 200 / day at launch → ~73 K rows / year → 146 K rows live (24-month retention) → ~512 K cold rows after 7 years.
- Per-application: 1 row in `application` + N rows in `bank_offer` (N ≤ active program count). At 50 programs avg → 50 offer rows / application → 3.65 M live offer rows steady-state.
- Admin operator population at launch: ~10 admins + 1 super_admin + ~3 viewers.
- ~3 new dashboard screens: applications list, application detail (offer cards + cascade preview + failed-checks section), no-match insight overlay (potentially folded into detail).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution: `.specify/memory/constitution.md` v1.3.0 (28 principles + 24 anti-patterns).

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Money is Decimal + offer immutability | **PASS** | `Prisma.Decimal` end-to-end; FR-046 forbids mutation. SC-005 verifies. |
| II | Banks are data, not code | **PASS** | FR-003 forbids `programCode` branches. Cascade evaluator imported from feature 002 as types-only. SC-010 verifies. |
| III | Typed errors end-to-end | **PASS** | FR-055 catalogs 16 new codes with AR/EN parity. FR-038 binding. |
| IV | Arabic-first RTL | **PASS** | FR-053 + FR-059. SC-011. |
| V | Matching engine is the core IP | **PASS — central goal** | FR-002 + SC-019. Engine module dependency-graph audited. |
| VI | PII protection in audit | **PASS** | FR-045 + FR-051 (PII masking) + FR-068 (fingerprint hashed). |
| VII | Correlation IDs + audit events | **PASS** | Six new event types; correlation id from feature 001 interceptor. |
| VIII | Brand identity #06152D | **PASS** | Design tokens reused. |
| IX | Feature module architecture | **PASS** | New backend modules `matching/` + `applications/`. `common/` MUST NOT import features. |
| X | Repository pattern mandatory | **PASS** | Four new repositories listed in structure. |
| XI | Prisma migrations only | **PASS** | Named migration creates two tables + extends enum. |
| XII | DTO vs entity | **PASS** | Engine never sees Prisma types — operates on plain TypeScript shapes. |
| XIII | Dual auth (HMAC mobile, JWT admin) | **PASS** | Apply endpoint HMAC; admin endpoints JWT + role. |
| XIV | API contract standards | **PASS** | Versioned `/api/v1/`; canonical envelope. |
| XV | Rate limiting | **PASS** | FR-066 + Redis backing. |
| XVI | Backend testing | **N/A (v1.2.0)** | Developer-discretion engine tests. |
| XVII–XXII | Angular discipline | **PASS** | Same rules as feature 002. |
| XXIII | UI UX skill pipeline | **PASS (gated)** | FR-062 + SC-016. Three screens × (promax + impec). |
| XXIV | Design tokens | **PASS** | No raw hex. |
| XXV | Lazy + functional guards | **PASS** | Admin route lazy-loaded behind `authGuardFn`. |
| XXVI | HTTP discipline | **PASS** | `HttpClient` + interceptors reused. |
| XXVII | Frontend testing | **N/A (v1.2.0)** | No required tests. |
| XXVIII | Flutter foundations | **N/A** | HMAC contract published; Flutter client out of scope. |

**Anti-patterns review**: A1 / A2 / A3 / A4 / A5 / A6 / A7 / A9 / A17 / A24 all protected — see notes above.

**Gate result (Phase 0 pre-design)**: PASS — no violations.

### Post-design re-evaluation (Phase 1 done)

Re-checked after generating research, data-model, contracts, quickstart. No new violations:

- Principle I — `data-model.md` persists Decimal as `@db.Decimal(13,2)` (money) + `@db.Decimal(7,4)` (percent); engine PMT operates on `Prisma.Decimal` (research R5).
- Principle II — cascade evaluator imported as types-only contract; ESLint boundary rule blocks runtime imports from `bank-programs/` (research R3).
- Principle III — 16 codes in `contracts/error-codes.md` with `meta` shapes.
- Principle V — engine package boundary explicit; `backend/src/matching/` has zero runtime imports from `applications/` or `bank-programs/`.
- Principle VI — PII masking utility in `matching/pii-mask/` shared with admin (research R8).
- Principle VII — every event-type pre-designed with payload shape in `data-model.md` § Audit Payload Schemas.
- Principle XIII — HMAC middleware design pinned in research R6.
- Principle XIV — OpenAPI 3.1 covers `/api/v1/apply` + admin endpoints.
- Principle XV — rate-limit guard composed of two throttlers.
- Principle XXIII — three `design/` subfolders pre-allocated.

**Gate result (Phase 1 post-design)**: PASS — Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/003-matching-engine-post/
├── plan.md                       # This file
├── spec.md                       # 68 FRs, 22 SCs, 5 clarifications, 14 golden scenarios
├── research.md                   # Phase 0 — engine architecture, PMT precision, HMAC, retention pipeline
├── data-model.md                 # Phase 1 — entities, indexes, audit-payload schemas, Prisma sketch
├── quickstart.md                 # Phase 1 — operator onboarding + 14 golden-scenario walkthrough
├── contracts/
│   ├── openapi.yaml              # /api/v1/apply + /api/admin/applications/*
│   ├── error-codes.md            # 16 new codes + AR/EN translations + meta shapes
│   └── scoring-weights.md        # Approval-probability weights + rationales (FR-034 SoT)
├── checklists/
│   └── requirements.md           # Existing — spec-quality checklist
└── design/                       # Per-screen design docs (promax pre + impec post)
    ├── 01-applications-list/
    ├── 02-application-detail/
    └── 03-no-match-insight/
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── matching/                                # NEW — pure engine module (Principle V)
│   │   ├── matching.module.ts
│   │   ├── engine/
│   │   │   ├── match.ts                         # entry: match(profile, programs) → MatchResult[]
│   │   │   ├── eligibility/                     # per-dimension modules
│   │   │   │   ├── employment-type.ts
│   │   │   │   ├── age.ts
│   │   │   │   ├── income.ts
│   │   │   │   ├── tenure.ts
│   │   │   │   ├── loan-purpose.ts
│   │   │   │   ├── transfer-type.ts
│   │   │   │   ├── currency.ts
│   │   │   │   ├── required-flags.ts
│   │   │   │   ├── wealth-gate.ts
│   │   │   │   ├── performance-criteria.ts
│   │   │   │   └── no-documents.ts
│   │   │   ├── income/                          # FR-010-018 — 9 strategies
│   │   │   │   ├── declared.ts
│   │   │   │   ├── by-years.ts
│   │   │   │   ├── by-professor-rank.ts
│   │   │   │   ├── by-military-grade.ts
│   │   │   │   ├── by-cd-value.ts
│   │   │   │   ├── by-car-installment.ts
│   │   │   │   ├── by-car-loan-amount.ts
│   │   │   │   ├── by-credit-card-limit.ts
│   │   │   │   ├── by-bank-statement-percent.ts
│   │   │   │   └── resolve-income.ts
│   │   │   ├── tier-resolution/
│   │   │   │   ├── resolve-rate.ts              # imports cascade.evaluator from feature 002 (types-only)
│   │   │   │   ├── resolve-loan-limit.ts
│   │   │   │   ├── resolve-tenor.ts
│   │   │   │   └── resolve-buyout-rate.ts
│   │   │   ├── pmt.ts                           # PMT(P, r, n) with Decimal + banker's rounding
│   │   │   ├── dbr.ts                           # DBR + max-loan-binary-search
│   │   │   ├── fees.ts                          # fees breakdown + waiver penalties
│   │   │   ├── approval-probability.ts          # rule-based scoring (FR-033)
│   │   │   ├── ranking.ts                       # 4 priority sort rules
│   │   │   └── result-mapper.ts
│   │   ├── suggestions/
│   │   │   ├── suggest.ts
│   │   │   ├── trigger-matrix.ts                # FR-047a
│   │   │   └── unlock-counter.ts
│   │   ├── types.ts                             # ApplicantProfile, MatchResult, Suggestion
│   │   ├── pii-mask/
│   │   │   └── mask.ts                          # FR-051 shared
│   │   ├── scoring-weights.ts                   # FR-034
│   │   ├── match.checks.ts                      # developer-discretion sanity script
│   │   └── README.md                            # engine extraction contract
│   ├── applications/                            # NEW — HTTP + persistence
│   │   ├── applications.module.ts
│   │   ├── applications.controller.ts           # POST /api/v1/apply
│   │   ├── applications.admin.controller.ts     # /api/admin/applications/*
│   │   ├── applications.service.ts
│   │   ├── applications.repository.ts
│   │   ├── bank-offers.repository.ts            # insert-only
│   │   ├── idempotency.repository.ts            # Redis-backed
│   │   ├── audit/
│   │   │   ├── application-audit.repository.ts
│   │   │   └── audit-payloads.ts
│   │   ├── dto/
│   │   │   ├── apply.request.dto.ts
│   │   │   ├── apply.response.dto.ts
│   │   │   ├── no-match.response.dto.ts
│   │   │   ├── list-applications.query.ts
│   │   │   ├── application-detail.response.dto.ts
│   │   │   └── sub-dtos/
│   │   │       ├── employment.dto.ts
│   │   │       ├── obligations.dto.ts
│   │   │       ├── assets.dto.ts
│   │   │       ├── mortgage-details.dto.ts
│   │   │       └── car-details.dto.ts
│   │   ├── guards/
│   │   │   ├── hmac-signature.guard.ts          # HMAC + nonce replay-protection
│   │   │   └── applicant-rate-limit.guard.ts    # FR-066 tiered limits
│   │   ├── retention/
│   │   │   ├── archive.scheduler.ts             # cron: 24-month boundary archival
│   │   │   ├── erasure.service.ts               # PDPL right-to-erasure
│   │   │   └── cold-tier-writer.ts              # S3-compatible JSONL
│   │   └── pii-mask.service.ts                  # wrapper around matching/pii-mask/mask.ts
│   ├── common/
│   │   └── errors/error-codes.ts                # EXTENDED with 16 new codes
│   └── ... (existing modules unchanged)
├── prisma/
│   ├── schema.prisma                            # EXTENDED — Application + BankOffer + new AuditEventType values
│   └── migrations/
│       └── 2026<timestamp>_add_matching_engine/
│           └── migration.sql

admin/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   └── applications/                    # NEW — lazy-loaded route
│   │   │       ├── applications.routes.ts
│   │   │       ├── list/applications-list.page.ts
│   │   │       ├── detail/
│   │   │       │   ├── application-detail.page.ts
│   │   │       │   ├── offer-card.component.ts
│   │   │       │   ├── failed-checks.component.ts
│   │   │       │   ├── no-match-insight.component.ts
│   │   │       │   └── audit-timeline.component.ts
│   │   │       └── applications.api.service.ts
│   │   └── core/
│   │       └── pii-mask/pii-mask.pipe.ts
│   └── i18n/
│       ├── messages.{ar-EG,en-US}.xlf
│       └── error-codes.{ar-EG,en-US}.json
```

**Structure Decision**: Web-app structure. Backend gets two new feature modules: `matching/` (pure engine, Principle V) + `applications/` (HTTP + persistence + retention). Admin gets one new lazy-loaded route `/applications` with three pages. The engine has an explicit boundary — types-only imports from `bank-programs/` (the cascade evaluator types shared from feature 002); no controller / persistence imports allowed. Enforced by ESLint boundary rules (research R3).

## Complexity Tracking

> No Constitution Check violations; this section intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _none_    | _n/a_      | _n/a_                                |
