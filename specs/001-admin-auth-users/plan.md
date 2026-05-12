# Implementation Plan: Admin Authentication & User Management

**Branch**: `001-admin-auth-users` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-admin-auth-users/spec.md`
**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.0.0

## Summary

Build the foundational authentication & authorization layer for the Masrafy admin dashboard plus admin-user CRUD. Three roles (`SUPER_ADMIN`, `ADMIN`, `VIEWER`) with role-gated UI and independent backend enforcement; JWT access tokens (15 min, in-memory on client) paired with opaque, server-revocable refresh tokens (7 days, `httpOnly Secure SameSite=Lax` cookie, stored as SHA-256 hashes and rotated on every refresh); sliding-window account lockout in Redis; NIST-style password policy (length-only + HIBP k-anonymity + common-password deny list, fail-closed on breach-check outage); forced password change on first login and after super_admin reset; concurrency-safe super_admin floor guard via Postgres SERIALIZABLE; WCAG 2.2 AA accessibility intent in both Arabic (RTL) and English (LTR) locales; full append-only audit trail for every security-relevant action.

This feature is the prerequisite for every other admin-facing feature. Approach details and decision rationale in [research.md](./research.md). Persistent data shapes in [data-model.md](./data-model.md). External contracts in [contracts/admin-api.openapi.yaml](./contracts/admin-api.openapi.yaml) and [contracts/error-codes.md](./contracts/error-codes.md). Bring-up walkthrough in [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**:
- Backend: Node.js 22 LTS (`.nvmrc`), TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`).
- Frontend: TypeScript 5.4+ (same strictness profile), Angular 18 LTS.

**Primary Dependencies**:
- Backend: NestJS 10, Prisma 5 (PostgreSQL provider), `@nestjs/jwt`, `@nestjs/passport` + `passport-jwt`, `@nestjs/throttler` (Redis store), `bcrypt`, `class-validator`, `class-transformer`, `nestjs-pino` + `pino`, `@nestjs/swagger`, `ioredis`, `cookie-parser`, `zod` (env validation), `cuid` (Prisma default).
- Frontend: Angular 18, `@angular/material` 18, `@angular/cdk`, `@angular/localize`, `@angular/forms` (Reactive).
- Test: none required (constitution v1.2.0 dropped XVI + XXVII testing requirements).

**Storage**:
- PostgreSQL 16 for `StaffAccount`, `RefreshToken`, `SignInAttempt`, `AuditEvent` (schema in [data-model.md](./data-model.md)). Connection pooled via PgBouncer or managed pooler.
- Redis 7 for sliding-window lockout counters (`signin:fail:<email>` sorted sets), throttler rate-limit buckets, and (future) HMAC nonce cache.

**Testing**: None constitutionally required (v1.2.0 dropped XVI + XXVII). Manual walkthrough of [quickstart.md](./quickstart.md) §1–§11 stands in for automated verification.

**Target Platform**:
- Backend: Linux x86_64 in Docker (multi-stage build, non-root user, slim runtime), Node 22.
- Frontend: Modern evergreen browsers (Chrome, Edge, Firefox, Safari latest two versions) on desktop. Mobile-browser admin support out of scope.

**Project Type**: Web (backend service + frontend SPA, separate packages in one repo).

**Performance Goals**:
- Login p95 < 500 ms end-to-end (bcrypt cost-12 dominates; ~150–250 ms hash + Postgres lookup + Redis update + JWT sign).
- Token refresh p95 < 100 ms (DB lookup by `tokenHash` index + JWT sign).
- Bearer-validated GET p95 < 50 ms (JWT verify is in-process; no DB hit on `/auth/me` beyond cache hit; staff list is single indexed query).
- HIBP outbound: hard timeout 1.5 s; absent that the breach check stays within the user-facing p95 budget for password-set flows (target < 2 s p95 end-to-end on password change).

**Constraints**:
- Concurrent demotion targeting the last "other" super_admin: SERIALIZABLE transaction MUST guarantee floor invariant under at least 100 racing pairs (SC-020).
- Cookie flags: `httpOnly` (always), `Secure` (production), `SameSite=Lax`, `Path=/api/admin/auth/`, `Max-Age=604800`.
- PII redaction in logs: `password`, `currentPassword`, `newPassword`, `passwordHash`, `tokenHash`, `accessToken`, `refreshToken`, `Authorization`, `Cookie`, `Set-Cookie` headers — all redacted at Pino-level with explicit redact paths.
- Accessibility CI gate: 0 serious/critical violations per axe-core report; tests run in both locales.

**Scale/Scope**:
- Staff accounts: ≤ 200 (small-to-medium internal team per spec assumption); pagination defaults 20/page, max 100/page.
- Concurrent sessions: no cap; multi-device coexistence supported (each device has its own refresh-token row).
- Sign-in attempts: ≤ 500/day baseline. Redis sorted sets per email auto-evict via `EXPIRE`.
- Audit events: indefinite retention; volume bounded by staff team size and activity (~hundreds/day max).

## Constitution Check

Walk-through against [constitution.md](../../.specify/memory/constitution.md) v1.0.0. Marker key: ✅ Pass · ⚠ N/A for this feature · ❌ Violation (would block PR; none here).

### Core Cross-Platform Principles
- **I. Financial Data Integrity** ⚠ N/A — no monetary calculations in this feature.
- **II. Bank Programs Are Data** ⚠ N/A — no bank-program logic.
- **III. Typed Errors End-to-End** ✅ — every spec-named error has a code constant in `backend/src/common/errors/error-codes.ts` and a translation entry in `admin/src/i18n/error-codes.{ar-EG,en-US}.json`. Mapping centralized in `ErrorCodeService.toLocalizedMessage(code, meta)`. See [contracts/error-codes.md](./contracts/error-codes.md).
- **IV. Arabic-First i18n** ✅ — `@angular/localize` for templates, JSON files for error codes; logical CSS properties only; Angular Material RTL on; Playwright suite runs both locales.
- **V. Matching Engine** ⚠ N/A.
- **VI. PII Protection** ✅ — passwords hashed at bcrypt-12; refresh tokens stored as SHA-256 hashes; no PII in logs (Pino redact paths declared); audit payloads scrubbed by `AuditEventWriter` of any sensitive key; National IDs not in scope here.
- **VII. Observability** ✅ — correlation IDs propagated via `X-Correlation-Id`; `/health/live` + `/health/ready` (ready includes Postgres + Redis pings); structured JSON logs via Pino; discrete audit events for every security action.
- **VIII. Brand Identity** ✅ — `--color-brand-primary: #06152D` declared in `admin/src/styles/_tokens.scss`; login primary button + brand mark + top-bar accent all read from token; no raw hex in components.

### Backend Principles
- **IX. Feature Module Architecture** ✅ — modules: `auth/`, `users/`, `audit/`, plus `common/` (filters, guards, decorators, error-codes, PII redaction, pagination helpers). `auth/` and `users/` export only what each genuinely consumes; `common/` does not import from feature modules.
- **X. Repository Pattern Mandatory** ✅ — `StaffAccountRepository`, `RefreshTokenRepository`, `SignInAttemptRepository`, `AuditEventRepository`. Services NEVER touch `prisma.*` directly. Transactional writes wrapped inside the repository.
- **XI. Prisma Migration Discipline** ✅ — single named migration `0001_admin_auth_users_init`; `cuid()` PKs; `TIMESTAMPTZ` timestamps; explicit indexes on every FK and on hot-path WHERE/ORDER BY columns; JSONB used ONLY for `audit_event.payload` (genuinely flexible per event type).
- **XII. DTO vs Entity Separation** ✅ — every endpoint has a request DTO (`LoginRequestDto`, `CreateStaffRequestDto`, etc.) and a response DTO. Prisma types stay inside repositories. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- **XIII. Dual Authentication, No Compromise** ✅ — JWT for admin (15-min access, 7-day refresh cookie, bcrypt cost 12, password `select: false`). HMAC scaffold (for future mobile API) NOT implemented in this feature but the global guard structure leaves room: admin routes mounted under `/api/admin/*`, mobile routes will mount under `/api/v1/*` and pick up a separate guard.
- **XIV. API Contract Standards** ✅ — all responses wrapped in `{ success, data, pagination? }` or `{ success: false, code, meta? }`; endpoints versioned (`/api/admin/`); OpenAPI published at `/api/docs` (dev); offset pagination for admin lists (page=1 default, pageSize=20 default, max 100) per Principle XIV.
- **XV. Rate Limiting** ✅ — `@nestjs/throttler` with Redis store: login 5/15m per IP, refresh 30/m per IP, generic admin 100/15m per IP. Account lockout layered on top per FR-031 (sliding window in Redis).
- **XVI. Backend Testing Requirements** ⚠ Placeholder — constitution v1.2.0 dropped all testing gates. N/A.

### Angular Admin Dashboard Principles
- **XVII. Standalone Components Only** ✅ — every component, directive, pipe is `standalone: true`; `bootstrapApplication()` in `main.ts`; no `NgModule` outside Material's unavoidable third-party interop where required (documented in PR description).
- **XVIII. Signals Over RxJS for State** ✅ — `AuthService` exposes `currentUser: Signal<AuthenticatedUser | null>`, `isAuthenticated: Signal<boolean>`, `accessToken: Signal<string | null>`. Refresh-in-flight state via `signal()`. RxJS only for `HttpClient` streams; results wrapped in `toSignal()` for component consumption.
- **XIX. New Control Flow Required** ✅ — `@if`, `@for (… ; track item.id)`, `@switch`, `@defer` in templates; no `*ng*` structural directives.
- **XX. inject() Function, Not Constructor DI** ✅ — all services injected via `inject()` at field level.
- **XXI. Strict TypeScript, No `any`** ✅ — `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`; `any` banned; `unknown` with narrowing for error envelopes from HttpClient.
- **XXII. Typed Reactive Forms** ✅ — `FormGroup<LoginFormControls>`, `FormGroup<CreateStaffFormControls>`, etc. Form value types align with DTOs (OpenAPI codegen via `openapi-typescript` from `contracts/admin-api.openapi.yaml`; generated types checked in).
- **XXIII. UI UX Pro Max Skill is Authority** ✅ — every screen in this feature (login, forced-change, top bar, user list, user create/edit modal, self-change) MUST be designed against `ui-ux-pro-max` skill output. Tasks (Phase 2) will explicitly invoke the skill before each screen.
- **XXIV. Design Tokens — #06152D Base** ✅ — full token file `admin/src/styles/_tokens.scss` with CSS custom properties for color, spacing (4 px base), type scale, radius scale, shadow scale. Material 3 theme provider reads from these tokens. No raw hex in any component.
- **XXV. Lazy-Loaded Routes + Functional Guards** ✅ — `/auth/*`, `/dashboard`, `/users` each via `loadComponent`/`loadChildren`; `authGuardFn`, `roleGuardFn(['SUPER_ADMIN'])`, `mcpGuardFn` (forced-change router), all functional.
- **XXVI. HTTP Layer Discipline** ✅ — `HttpClient` only; interceptors in order: `correlationIdInterceptor` → `authInterceptor` (attach Bearer) → `errorInterceptor` (401 silent refresh + retry, code-based routing) → `toastInterceptor` (localized via `ErrorCodeService`). `fetch()` forbidden.
- **XXVII. Frontend Testing Requirements** ⚠ Placeholder — constitution v1.2.0 dropped all testing gates. N/A.

### Flutter
- **XXVIII. Flutter Architectural Foundations** ⚠ N/A — admin dashboard feature; Flutter mobile app is deferred. The HMAC scaffolding required to serve a future Flutter client is NOT touched in this feature.

**Result**: All applicable principles **pass**. No violations. Complexity Tracking section is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-admin-auth-users/
├── plan.md                                     # This file
├── research.md                                 # Phase 0 (decisions + rationale)
├── data-model.md                               # Phase 1 (entities + schema)
├── quickstart.md                               # Phase 1 (operator bring-up)
├── contracts/
│   ├── admin-api.openapi.yaml                  # Phase 1 (OpenAPI 3.0 contract)
│   └── error-codes.md                          # Phase 1 (code → HTTP / meta / UI intent)
├── checklists/
│   └── requirements.md                         # Spec quality (filled by /speckit.specify)
├── spec.md                                     # Feature spec (with /speckit.clarify edits)
└── tasks.md                                    # Phase 2 output of /speckit.tasks (NOT created here)
```

### Source Code (repository root)

```text
masrafy01/
├── backend/                                    # NestJS service
│   ├── src/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── password.service.ts             # bcrypt + policy + HIBP + common-list
│   │   │   ├── jwt.strategy.ts                 # passport-jwt
│   │   │   ├── jwt.service.ts                  # sign/verify wrapper
│   │   │   ├── refresh-token.service.ts        # rotation + revocation
│   │   │   ├── lockout.service.ts              # Redis sliding window
│   │   │   ├── dto/
│   │   │   │   ├── login.request.dto.ts
│   │   │   │   ├── login.response.dto.ts
│   │   │   │   ├── refresh.response.dto.ts
│   │   │   │   ├── me.response.dto.ts
│   │   │   │   └── password-change.request.dto.ts
│   │   │   └── guards/
│   │   │       ├── jwt-auth.guard.ts
│   │   │       └── mcp-guard.guard.ts          # enforces MUST_CHANGE_PASSWORD routing
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── staff-account.repository.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-staff.request.dto.ts
│   │   │   │   ├── update-staff.request.dto.ts
│   │   │   │   ├── reset-password.request.dto.ts
│   │   │   │   └── staff-account.response.dto.ts
│   │   │   └── guards/
│   │   │       └── role.guard.ts               # generic; reused
│   │   ├── audit/
│   │   │   ├── audit.module.ts
│   │   │   ├── audit-event.writer.ts           # sole insert path; payload redaction
│   │   │   └── audit-event.repository.ts
│   │   ├── common/
│   │   │   ├── errors/
│   │   │   │   ├── error-codes.ts
│   │   │   │   ├── domain.exceptions.ts        # typed exceptions per code
│   │   │   │   └── http-exception.filter.ts    # maps to envelope
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   └── correlation-id.decorator.ts
│   │   │   ├── middleware/
│   │   │   │   └── correlation-id.middleware.ts
│   │   │   ├── pagination/
│   │   │   │   ├── pagination.query.dto.ts
│   │   │   │   └── paginated.response.dto.ts
│   │   │   └── pino/
│   │   │       └── pino.config.ts              # redact paths declared here
│   │   ├── infra/
│   │   │   ├── prisma/
│   │   │   │   └── prisma.service.ts
│   │   │   ├── redis/
│   │   │   │   └── redis.service.ts
│   │   │   ├── hibp/
│   │   │   │   └── hibp.client.ts              # k-anonymity, 1.5s timeout, fail-closed
│   │   │   └── env/
│   │   │       └── env.schema.ts               # Zod schema
│   │   ├── health/
│   │   │   ├── health.module.ts
│   │   │   └── health.controller.ts            # /health/live, /health/ready
│   │   ├── main.ts
│   │   └── app.module.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   │   └── 0001_admin_auth_users_init/
│   │   │       └── migration.sql
│   │   └── seed.ts                             # idempotent super_admin bootstrap
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── admin/                                      # Angular dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.service.ts         # signal-backed
│   │   │   │   │   └── auth.types.ts           # generated from OpenAPI
│   │   │   │   ├── errors/
│   │   │   │   │   ├── error-code.service.ts
│   │   │   │   │   └── error-code.types.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── correlation-id.interceptor.ts
│   │   │   │   │   ├── auth.interceptor.ts
│   │   │   │   │   ├── error.interceptor.ts
│   │   │   │   │   └── toast.interceptor.ts
│   │   │   │   └── guards/
│   │   │   │       ├── auth.guard.fn.ts
│   │   │   │       ├── role.guard.fn.ts
│   │   │   │       └── mcp.guard.fn.ts
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login.page.ts
│   │   │   │   │   ├── forced-change.page.ts
│   │   │   │   │   ├── self-change.page.ts
│   │   │   │   │   └── auth.routes.ts
│   │   │   │   ├── users/
│   │   │   │   │   ├── users-list.page.ts
│   │   │   │   │   ├── user-form.dialog.ts     # create + edit shared modal
│   │   │   │   │   ├── reset-password.dialog.ts
│   │   │   │   │   ├── users.service.ts        # wraps HttpClient calls
│   │   │   │   │   └── users.routes.ts
│   │   │   │   └── shell/
│   │   │   │       ├── shell.component.ts
│   │   │   │       └── top-bar.component.ts
│   │   │   └── app.routes.ts
│   │   ├── i18n/
│   │   │   ├── messages.ar-EG.xlf
│   │   │   ├── messages.en-US.xlf
│   │   │   ├── error-codes.ar-EG.json
│   │   │   └── error-codes.en-US.json
│   │   ├── styles/
│   │   │   ├── _tokens.scss                    # CSS custom properties; #06152D base
│   │   │   ├── _material-theme.scss            # Material 3 theming bridge
│   │   │   └── styles.scss
│   │   └── main.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── angular.json
├── docker/
│   ├── compose.dev.yml                         # postgres + redis (dev)
│   └── compose.test.yml                        # postgres + redis (ephemeral, retained for local exploration only)
├── specs/001-admin-auth-users/                 # this feature
├── .specify/                                   # constitution, scripts, templates
├── .nvmrc                                      # Node 22 LTS
└── README.md
```

**Structure Decision**: Two top-level packages (`backend/`, `admin/`) as siblings in one repo, plus `docker/` for compose files. No monorepo wrapper (Nx/Turborepo) at this stage — premature for two packages. Each package has its own `package.json`, `tsconfig.json`, test runner config, lint config. Mobile (`mobile/`) will be added as a third sibling when Flutter Phase 2 starts. The OpenAPI contract in `specs/001-admin-auth-users/contracts/` is the canonical source for cross-package types — both packages consume it via codegen.

## Complexity Tracking

> No constitution violations; no justifications needed. Section intentionally empty.
