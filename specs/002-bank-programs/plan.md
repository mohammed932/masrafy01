# Implementation Plan: BankProgram Management — Tiered Loan Product Configuration

**Branch**: `002-bank-programs` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-bank-programs/spec.md`

## Summary

Deliver the admin dashboard surfaces + backend API + mobile read-only API for **internal-staff-driven configuration of bank loan programs**. The platform stores a single `BankProgram` aggregate per loan product with 8 sub-configurations (tenor, loan-limits, pricing, eligibility, income-assumption, performance-criteria, fees, documents) and a 7-level frozen-cascade evaluator that the matching engine consumes read-only. Five user stories: P1 create + P1 list/view, P2 edit/toggle + P2 clone, P3 super_admin delete + mobile read-only API. The 20-program ABK Egypt catalog and a `salesfloor-egp-2026` competitor catalog are seeded opt-in via super_admin endpoints. All tier-map keys resolve against a separate `PlatformEnumeration` registry (feature 003, planned but not built here — this feature consumes read-only with fail-closed behaviour). Concurrency = optimistic version field (`CONFLICT_STALE_DATA` on mismatch). Monetary precision = `DECIMAL(13,2)`, percentage precision = `DECIMAL(7,4)`, no floats anywhere. Multi-currency (EGP/USD/EUR) for secured products. Hybrid evidence (applicant-declared + optional bureau auto-verify) for buyout + performance-criteria gates with `selfDeclared` badge fallback. Per-entry `derivation` field preserves the audit chain for seed-resolved rates without leaking deltas into the matching engine. Stack: NestJS 10 + Prisma 5 + Postgres 16 + Redis 7 (backend) — Angular 18 + Material 18 standalone + signals (admin) — Arabic-first RTL with English secondary; brand color `#06152D`; all flows behind existing JWT + role permissions from feature 001.

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ (same strictness profile) on admin.
**Primary Dependencies**:
- Backend: NestJS 10, Prisma 5, `@nestjs/jwt`, `@nestjs/passport`, `class-validator`, `class-transformer`, `nestjs-pino`, `@nestjs/swagger`, `zod` (env validation), `ioredis`, `@nestjs/throttler` (rate-limit Redis store), `bcrypt` (re-used from feature 001).
- Admin: Angular 18 standalone, Angular Material 18, `@angular/cdk` (table, overlay, paginator), `@angular/localize`, RxJS (HTTP interceptors only — state on signals), typed Reactive Forms (`FormBuilder.nonNullable.group`).
**Storage**: PostgreSQL 16 (Prisma migrations only; `db push` forbidden in production); Redis 7 (rate-limit + future audit-event buffer; NOT used as primary store for bank programs).
**Testing**: NONE constitutionally required (Principles XVI + XXVII reduced to placeholders in v1.2.0). Feature MAY add Vitest unit specs for the cascade evaluator at developer discretion; not mandated; CI does NOT gate on tests.
**Target Platform**: Linux server (Node 22 LTS Docker, non-root user); modern evergreen browsers for the admin SPA (Chrome / Edge / Safari latest + 1 prior major); the mobile read-only API serves the future Flutter client (out of scope this feature — contract only).
**Project Type**: Web — `backend/` NestJS service + `admin/` Angular SPA + read-only mobile endpoints in the same `backend/` service under `/api/mobile/v1/`.
**Performance Goals**: List endpoint p95 ≤ 200 ms at 1k programs (full-text search across `programCode` + `friendlyName` via Postgres GIN); detail endpoint p95 ≤ 150 ms; save endpoint p95 ≤ 400 ms (single Postgres transaction, no external I/O); cascade evaluation in-process p95 ≤ 5 ms per application (matching engine is consumer — NOT built here, but the BankProgram repository's `loadActiveCatalog()` MUST return the full active set in ≤ 100 ms warm at 1k programs).
**Constraints**:
- Decimal everywhere for money + rates (Principle I). Prisma `Decimal` type, transport as string, validate with `class-validator` + custom decimal-range decorator.
- All tier-map keys resolve against `PlatformEnumeration` registry at save-time validation (fail-closed if registry unavailable).
- Cascade order frozen at the platform level (FR-008b/c/d). Reorder requires constitution amendment.
- Bank offers immutable post-creation (Principle I) — this feature MUST preserve that contract: edits to a program never mutate downstream offers (FR-020).
- Audit events carry NO PII (Principle VI). Operator identifier + program code + before/after fields only.
- Arabic-first RTL on every screen (Principle IV); logical CSS only (`margin-inline-*`, never `margin-left/right`); all strings via `@angular/localize`; error codes via central helper (Principle III).
- Brand color `#06152D` referenced via design tokens (Principle XXIV); never raw hex inline.
- WCAG 2.2 AA on every screen (FR-037).
- Admin write surfaces gated by JWT + role per feature 001 (admin / super_admin / viewer); mobile read-only surface gated by HMAC request-signing per Principle XIII.
**Scale/Scope**:
- 20–60 programs at launch (ABK Egypt 20 + a handful of competitor seeds + room for ~30 net-new). Schema sized for ≤ 10k programs without partitioning.
- Per-program payload up to ~50 KB JSON (full sub-configs serialized).
- Admin operator population: ~10 admins + 1 super_admin + ~3 viewers at launch.
- ~5 dashboard screens introduced by this feature: bank programs list, detail view, create-form drawer (sectioned), edit-form drawer (same component, edit mode), clone modal, delete confirmation dialog. Toggle is an in-row affordance, not a screen.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution: `.specify/memory/constitution.md` v1.3.0 (28 principles + 24 anti-patterns).

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Money is Decimal + offer immutability | **PASS** | FR-008 mandates `DECIMAL(13,2)` money + `DECIMAL(7,4)` percent; FR-020 + SC-005 preserve offer immutability; Prisma `Decimal` mapped to `Prisma.Decimal` (TypeScript) — never `number`. |
| II | Banks are data, not code | **PASS** | Central goal. No `if (programCode === ...)` branches anywhere. Tier resolution via generic cascade evaluator. ABK + competitor catalogs are seeds, not branches. |
| III | Typed errors end-to-end | **PASS** | New error codes (FR-013, FR-021, FR-034): `BANK_PROGRAM_NOT_FOUND`, `PROGRAM_CODE_ALREADY_IN_USE`, `INVALID_VARIABLE_RATE_CONFIGURATION`, `INVALID_QUALITATIVE_REVIEW_CEILING`, `QUALITATIVE_REVIEW_CEILING_BELOW_BASE`, `CONFLICT_STALE_DATA`, `BANK_PROGRAM_HAS_OFFERS`, `UNKNOWN_ENUMERATION_KEY`, `DEPRECATED_ENUMERATION_KEY`, `ENUMERATION_REGISTRY_UNAVAILABLE`, `DERIVATION_ARITHMETIC_MISMATCH`. Same-PR rule: backend `error-codes.ts` + admin `error-codes.{ar-EG,en-US}.json`. |
| IV | Arabic-first RTL | **PASS** | Every label / hint / tier descriptor routed through `@angular/localize`. Plain-language tier renderers translated. RTL flip tested per screen. |
| V | Matching engine is IP | **N/A this feature** | This feature does NOT build the matching engine; it produces the configuration the engine consumes. The cascade evaluator (in-process, deterministic) ships as a separate pure module under `backend/src/bank-programs/cascade/` consumed read-only by the future matching feature. |
| VI | PII protection in audit | **PASS** | Audit events carry operator identifier + program code + structured before/after on configuration fields only. No applicant data. |
| VII | Correlation IDs + audit events | **PASS** | FR-031, FR-032 honor existing feature-001 correlation interceptor. New audit event types: `BANK_PROGRAM_CREATED`, `BANK_PROGRAM_UPDATED`, `BANK_PROGRAM_TOGGLED`, `BANK_PROGRAM_CLONED`, `BANK_PROGRAM_DELETED`, `BANK_PROGRAM_RATE_UPDATED`, `BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED`. |
| VIII | Brand identity #06152D | **PASS** | All screens use design tokens. Primary CTA = `--color-brand-primary`; section accents = `--color-tonal-accent` per feature-001 conventions. No raw hex in component styles. |
| IX | Feature module architecture | **PASS** | New backend modules: `bank-programs/`, `bank-program-seeds/`, `platform-enumerations/` (read-only consumer). `common/` MUST NOT import from features. |
| X | Repository pattern mandatory | **PASS** | Services NEVER call Prisma directly. New repositories: `BankProgramRepository`, `BankProgramAuditRepository`, `BankProgramSeedRepository`, `PlatformEnumerationRepository` (read-only). |
| XI | Prisma migrate only | **PASS** | All schema changes via `prisma migrate dev` → named migration. Indexes on `programCode` (unique), `active`, FKs to `BankOffer` (when added by matching feature). `db push` forbidden in production. |
| XII | DTO vs entity separation | **PASS** | Public-facing DTOs in `bank-programs/dto/`. Prisma types confined to repositories. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` already configured by feature 001. |
| XIII | Dual auth (HMAC mobile, JWT admin) | **PASS** | Admin endpoints under `/api/admin/bank-programs` use JWT auth + RBAC guards from feature 001. Mobile read-only endpoints under `/api/mobile/v1/bank-programs` use HMAC request-signing middleware. |
| XIV | API contract standards | **PASS** | All envelope `{ success, data, pagination? }` or `{ success: false, code, meta? }`. Versioned `/api/admin/...` + `/api/mobile/v1/...`. OpenAPI at `/api/docs`. |
| XV | Rate limiting | **PASS** | `@nestjs/throttler` (Redis store) already wired. Bank-program write endpoints inherit the global throttle (60 req / minute per actor); mobile read-only endpoints get a separate, higher mobile-tier throttle (configurable). Seed endpoints get a strict 5-per-day throttle (super_admin operator burst protection). |
| XVI | Backend testing | **N/A (v1.2.0 placeholder)** | No constitutional testing requirements. The cascade evaluator MAY get a developer-discretion Vitest spec; not mandated. |
| XVII | Standalone components only | **PASS** | All new admin screens are standalone Angular components. Zero `NgModule` introductions. |
| XVIII | Signals over RxJS for state | **PASS** | Bank-program list state, drawer-form state, filter state — all on `signal()` + `computed()`. RxJS only for HTTP. |
| XIX | New control flow | **PASS** | `@if` / `@for (... ; track program.id)` / `@switch` / `@defer` throughout. No `*ngIf` / `*ngFor`. |
| XX | inject() DI | **PASS** | Zero constructor DI in new code. |
| XXI | Strict TypeScript, no `any` | **PASS** | Tier-map values typed as `Record<string, RateBandValue>` where `RateBandValue = { value: Decimal; derivation?: DerivationChain }`. `unknown` + narrowing where needed. |
| XXII | Typed reactive forms | **PASS** | `FormBuilder.nonNullable.group<{...}>()` for create + edit drawer. Field-level `FormControl<T>` everywhere. |
| XXIII | UI UX skill pipeline | **PASS (gated)** | Each new screen requires `ui-ux-pro-max` BEFORE design lands + `impec` AFTER first implementation. FR-040 + SC-016. Design docs land in `specs/002-bank-programs/design/` (one folder per screen). |
| XXIV | Design tokens | **PASS** | All visual values via `_tokens.scss`. No raw hex / raw pixel in new component styles. |
| XXV | Lazy + functional guards | **PASS** | `bank-programs` routes lazy-loaded behind `canMatchFn` checking JWT + role. Reuse `authGuard` + new `adminOrSuperAdminGuard`, `superAdminOnlyGuard` from feature 001. |
| XXVI | HTTP discipline | **PASS** | `HttpClient` only; interceptors from feature 001 (auth, correlation, error, toast) reused. Zero `fetch()`. |
| XXVII | Frontend testing | **N/A (v1.2.0 placeholder)** | No constitutional testing requirements. |
| XXVIII | Flutter foundations | **N/A this feature** | Mobile read-only contract published; Flutter client deferred until Figma. |

Anti-patterns review:
- **A1 (hardcoded bank logic)**: Avoided — ABK + competitor seeds are data; no program-code branches.
- **A2 (English errors to clients)**: All errors via typed codes + central translator.
- **A3 (float for money)**: `Decimal` end-to-end.
- **A4 (PII in logs)**: Audit events carry no applicant data.
- **A5 (direct Prisma in services)**: Repositories enforced.
- **A6 (mutable BankOffer)**: FR-020 — edits never mutate offers.
- **A7 (db push)**: Migrations only.
- **A17 (skipping design pipeline)**: FR-040 + SC-016 mandate both promax + impec.
- **A18 (raw hex)**: Tokens only.
- **A19 (`margin-left/right`)**: Logical CSS only.
- ~~**A24 (approval probability without weights)**~~: retired in constitution v25.0.0 — approval scoring was removed platform-wide, and A24 is now `Reserved` (kept only so A25–A36 are not renumbered). It was N/A to this feature in any case: bank programs never produced a probability.

**Gate result (Phase 0 pre-design)**: PASS — no violations, no Complexity Tracking entries required.

### Post-design re-evaluation (Phase 1 done)

Re-checked after generating `research.md`, `data-model.md`, `contracts/openapi.yaml`, `contracts/error-codes.md`, and `quickstart.md`. No new violations introduced:

- **Principle I (Decimal money + offer immutability)**: data-model.md transports Decimal as canonical strings via OpenAPI; `BankProgram` repository hydrates to `Prisma.Decimal` before leaving the data layer. Offer immutability preserved (FR-020) — edits do NOT mutate downstream offers.
- **Principle II (banks are data, not code)**: storage shape is JSONB blobs + opaque-string tier-map keys resolved against the `PlatformEnumeration` registry — zero program-code branching anywhere in the design.
- **Principle III (typed errors)**: 13 new error codes documented in `contracts/error-codes.md` with Arabic + English translations and `meta` shapes.
- **Principle IV (Arabic-first RTL)**: every dashboard string routed through `@angular/localize`; OpenAPI carries `friendlyNameAr`; quickstart §12 verifies RTL flip end-to-end.
- **Principle V (matching engine is IP)**: this feature does NOT build the engine; the cascade evaluator (R2) ships as a pure module the future matching feature consumes read-only.
- **Principle VI (PII protection)**: audit-event payloads (R6) carry zero applicant data; mobile DTOs (R5) explicitly redact internal fields.
- **Principle VII (observability)**: feature 001's correlation-ID interceptor reused; new audit event types registered.
- **Principle VIII (brand identity #06152D)**: design tokens referenced; no raw hex.
- **Principle IX (feature module architecture)**: `bank-programs/`, `platform-enumerations/` modules introduced; `common/` does NOT import from features.
- **Principle X (repository pattern)**: four new repositories listed in plan structure.
- **Principle XI (Prisma migrations only)**: named migration `add_bank_programs` with raw-SQL block for the tsvector generated column.
- **Principle XII (DTO vs entity)**: hand-written mobile DTOs allowlist explicit fields; admin DTOs nested per sub-config.
- **Principle XIII (dual auth)**: admin endpoints behind JWT; mobile endpoints HMAC-signed with timestamp + nonce + Redis nonce store.
- **Principle XIV (API contract)**: every endpoint returns the canonical envelope; OpenAPI complete.
- **Principle XV (rate limiting)**: throttle buckets defined for admin + mobile + seed endpoints.
- **Principles XVI + XXVII (testing placeholders)**: respected — no constitutional testing required; developer-discretion Vitest spec on the cascade evaluator only (R15).
- **Principles XVII–XXII (Angular discipline)**: standalone, signals, new control flow, inject(), no `any`, typed Reactive Forms — all encoded in the structure block.
- **Principle XXIII (UI UX skill pipeline)**: `design/` subfolders pre-allocated, one per screen, for promax + impec artifacts.
- **Principle XXIV (design tokens)**: tokens from feature 001 reused; no new raw hex.
- **Principle XXV (lazy + functional guards)**: routes lazy-loaded behind `canMatchFn`.
- **Principle XXVI (HTTP discipline)**: HttpClient only; feature 001 interceptors reused.
- **Principle XXVIII (Flutter foundations)**: mobile contract published; client deferred.

**Gate result (Phase 1 post-design)**: PASS — Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-bank-programs/
├── plan.md                       # This file
├── spec.md                       # Feature specification (78 FRs, 30 SCs, 10 clarifications)
├── research.md                   # Phase 0 — technical decisions (cascade evaluator, derivation guard, etc.)
├── data-model.md                 # Phase 1 — entities, relationships, Prisma sketch, indices
├── quickstart.md                 # Phase 1 — operator onboarding flow (create first program end-to-end)
├── contracts/
│   ├── openapi.yaml              # /api/admin/bank-programs + /api/mobile/v1/bank-programs
│   └── error-codes.md            # New error codes + Arabic/English translations
├── checklists/
│   └── requirements.md           # Existing — spec-quality checklist
└── design/                       # Per-screen design docs (promax pre + impec post)
    ├── 01-list-page/
    ├── 02-detail-view/
    ├── 03-create-drawer/
    ├── 04-clone-modal/
    └── 05-delete-confirmation/
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── bank-programs/                            # NEW — feature module
│   │   ├── bank-programs.module.ts
│   │   ├── bank-programs.controller.ts           # /api/admin/bank-programs
│   │   ├── bank-programs.service.ts
│   │   ├── bank-programs.repository.ts
│   │   ├── bank-programs.mobile.controller.ts    # /api/mobile/v1/bank-programs (HMAC-protected)
│   │   ├── bank-programs.mobile.service.ts
│   │   ├── dto/
│   │   │   ├── create-bank-program.dto.ts
│   │   │   ├── update-bank-program.dto.ts
│   │   │   ├── list-bank-programs.query.ts
│   │   │   ├── clone-bank-program.dto.ts
│   │   │   ├── toggle-bank-program.dto.ts
│   │   │   ├── bank-program.response.dto.ts
│   │   │   ├── mobile-bank-program.response.dto.ts
│   │   │   └── sub-configs/                      # nested DTOs for each sub-config
│   │   │       ├── tenor-config.dto.ts
│   │   │       ├── loan-limits-config.dto.ts
│   │   │       ├── pricing-config.dto.ts
│   │   │       ├── eligibility-config.dto.ts
│   │   │       ├── performance-criteria-config.dto.ts
│   │   │       ├── income-assumption-config.dto.ts
│   │   │       ├── fees-config.dto.ts
│   │   │       └── derivation.dto.ts             # FR-008s chain validation
│   │   ├── cascade/                              # pure module — frozen cascade evaluator
│   │   │   ├── cascade.evaluator.ts
│   │   │   ├── cascade.types.ts
│   │   │   └── cascade.examples.ts               # readable docs of every cascade level
│   │   ├── seeds/
│   │   │   ├── seed-abk.controller.ts            # POST /api/admin/bank-programs/seeds/abk
│   │   │   ├── seed-competitor.controller.ts     # POST /api/admin/bank-programs/seeds/competitor/:catalogName
│   │   │   ├── seed.service.ts
│   │   │   ├── catalogs/
│   │   │   │   ├── abk-egypt-2026.ts             # 20-program catalog (configuration only)
│   │   │   │   ├── bank-nxt-2026.ts              # competitor catalog
│   │   │   │   └── salesfloor-egp-2026.ts        # 4 sales-floor products from the spec appendix
│   │   │   └── seed.verifier.ts                  # FR-033c — rate-assertion at seed time
│   │   └── audit/
│   │       └── bank-program-audit.repository.ts  # writes the new audit event types
│   ├── platform-enumerations/                    # NEW — read-only consumer of the (future) registry
│   │   ├── platform-enumerations.module.ts
│   │   ├── platform-enumerations.service.ts      # IN-MEMORY STUB for now; switches to feature-003 source later
│   │   ├── platform-enumerations.repository.ts   # interface — implemented by stub today + registry later
│   │   └── enumeration-keys.ts                   # canonical enum-type identifiers
│   └── common/
│       ├── error-codes.ts                        # EXTENDED with new bank-program codes
│       └── decorators/
│           └── decimal-range.decorator.ts        # NEW — class-validator decimal-range validator
├── prisma/
│   ├── schema.prisma                             # EXTENDED with BankProgram + sub-configs + BankProgramAuditEvent
│   ├── migrations/
│   │   └── 2026<timestamp>_add_bank_programs/
│   │       └── migration.sql
│   └── seed.ts                                   # UNCHANGED — bootstrap super_admin only (per FR-033a)
└── test/                                         # OPTIONAL — developer-discretion specs for cascade evaluator

admin/
├── src/
│   ├── app/
│   │   ├── features/
│   │   │   └── bank-programs/                    # NEW — lazy-loaded route
│   │   │       ├── bank-programs.routes.ts
│   │   │       ├── list/
│   │   │       │   └── bank-programs-list.page.ts
│   │   │       ├── detail/
│   │   │       │   ├── bank-program-detail.page.ts
│   │   │       │   ├── cascade-preview.component.ts   # FR-008f cascade trace
│   │   │       │   └── derivation-chip.component.ts   # FR-008s chain renderer
│   │   │       ├── form/
│   │   │       │   ├── bank-program-form.drawer.ts    # create + edit modes (side-drawer pattern)
│   │   │       │   └── sections/                      # one section component per sub-config
│   │   │       │       ├── identity-section.component.ts
│   │   │       │       ├── tenor-section.component.ts
│   │   │       │       ├── loan-limits-section.component.ts
│   │   │       │       ├── pricing-section.component.ts
│   │   │       │       ├── eligibility-section.component.ts
│   │   │       │       ├── performance-criteria-section.component.ts
│   │   │       │       ├── income-assumption-section.component.ts
│   │   │       │       ├── fees-section.component.ts
│   │   │       │       └── documents-section.component.ts
│   │   │       ├── clone/
│   │   │       │   └── clone-program.dialog.ts
│   │   │       ├── delete/
│   │   │       │   └── delete-program.dialog.ts
│   │   │       ├── tier-key-picker/
│   │   │       │   └── tier-key-picker.component.ts   # uses PlatformEnumerationService — fail-closed
│   │   │       └── bank-programs.service.ts            # HttpClient adapter
│   │   └── core/
│   │       └── platform-enumerations/
│   │           ├── platform-enumerations.service.ts    # signal-cache of registry; refresh on stale
│   │           └── platform-enumerations.types.ts
│   ├── i18n/
│   │   ├── messages.ar-EG.xlf                     # EXTENDED with all bank-program strings
│   │   ├── messages.en-US.xlf
│   │   └── error-codes.{ar-EG,en-US}.json         # EXTENDED with new codes
│   └── styles/
│       └── _tokens.scss                            # UNCHANGED (reuses feature-001 tokens)
└── tests/                                          # OPTIONAL — developer-discretion specs
```

**Structure Decision**: Web-app structure (Option 2). Backend service (NestJS) + Angular admin SPA exist already from feature 001. This feature adds the `bank-programs/` and `platform-enumerations/` modules to the backend and the `features/bank-programs/` lazy-loaded route to the admin. The mobile read-only API surface lives inside the same NestJS service under `/api/mobile/v1/bank-programs/*` rather than a separate service — the Flutter client is deferred to a later phase, and a separate service would burn ops budget for no current return.

## Complexity Tracking

> No Constitution Check violations; this section intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _none_    | _n/a_      | _n/a_                                |
