---
description: "Task list for feature 001-admin-auth-users (Admin Authentication & User Management)"
---

# Tasks: Admin Authentication & User Management

**Input**: Design documents from `/specs/001-admin-auth-users/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: REMOVED per Constitution v1.2.0. All test tasks (unit, integration, E2E, Playwright, axe-core) marked `[~]` (skipped). No automated test coverage is constitutionally required. Manual quickstart walkthrough (T155, `[~]` deferred) substitutes for automated verification.

**Marker legend**: `[X]` done · `[ ]` pending · `[~]` skipped (testing removed per v1.2.0, or operator-deferred for T155).

**Organization**: Tasks grouped by user story. US1 (Login + Session, P1) is the MVP — fully functional sign-in + forced change + silent refresh + lockout. US2 (RBAC, P1) layers role enforcement on top. US3 (User Management, P2) ships the super_admin CRUD.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable (different files, no in-phase dependencies)
- **[Story]**: US1 / US2 / US3 — maps to spec user stories
- File paths absolute relative to repo root

## Path Conventions

Two top-level packages: `backend/` (NestJS) and `admin/` (Angular 18). Compose files in `docker/`. Feature design docs in `specs/001-admin-auth-users/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding, lint/format, test runners, codegen, docker.

- [X] T001 Create top-level directories `backend/`, `admin/`, `docker/` per [plan.md](./plan.md) Project Structure section
- [X] T002 Add `.nvmrc` at repo root pinning Node 22 LTS
- [X] T003 [P] Initialize backend package: `backend/package.json` with NestJS 10, Prisma 5, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `@nestjs/throttler`, `bcrypt`, `class-validator`, `class-transformer`, `nestjs-pino`, `pino`, `@nestjs/swagger`, `ioredis`, `cookie-parser`, `zod`, `cuid` per [plan.md](./plan.md) Primary Dependencies (Backend)
- [X] T004 [P] Initialize admin package: Angular 18 standalone CLI scaffold at `admin/`, add `@angular/material`, `@angular/cdk`, `@angular/localize`
- [X] T005 [P] Author `docker/compose.dev.yml` defining `postgres:16` and `redis:7` services with healthchecks and named volumes
- [X] T006 [P] Author `docker/compose.test.yml` defining ephemeral postgres + redis on isolated network for E2E
- [X] T007 [P] Configure backend lint: `backend/.eslintrc.cjs` + `backend/.prettierrc` per Principle XXI strictness
- [X] T008 [P] Configure admin lint: `admin/.eslintrc.json` (with `@angular-eslint`) + `admin/.prettierrc`
- [X] T009 [P] Configure backend strict TS: `backend/tsconfig.json` with `strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitReturns`
- [X] T010 [P] Configure admin strict TS: `admin/tsconfig.json` matching backend strictness profile
- [X] T011 [P] Configure backend Vitest: `backend/vitest.config.ts` with unit + integration projects, jsdom not required
- [X] T012 [P] Configure admin Vitest: `admin/vitest.config.ts` via `@analogjs/vitest-angular` preset
- [X] T013 [P] Configure admin Playwright: `admin/playwright.config.ts` with two projects (`{ locale: 'ar-EG' }` and `{ locale: 'en-US' }`); enable retries=1 in CI
- [X] T014 [P] Add OpenAPI codegen script: `admin/package.json` script `gen:api` runs `openapi-typescript ../specs/001-admin-auth-users/contracts/admin-api.openapi.yaml -o src/app/core/auth/auth.types.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Cross-cutting infrastructure every user story consumes. No user story tasks may start until this phase is complete.

**⚠️ CRITICAL**: Touches `app.module.ts`, `main.ts`, Prisma schema, design tokens, interceptor chain — these become hot files in later phases.

- [X] T015 Define env schema (Zod): `backend/src/infra/env/env.schema.ts` validating `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET` (≥32 bytes), `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TTL_SECONDS`, `BCRYPT_COST`, `HIBP_TIMEOUT_MS`, `HIBP_BASE_URL`, `COOKIE_DOMAIN`, `COOKIE_SECURE`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`, `LOG_LEVEL`, `NODE_ENV`; fail-fast at boot
- [X] T016 Author Prisma schema with all 4 entities and 3 enums per [data-model.md](./data-model.md): `backend/prisma/schema.prisma` — `StaffAccount`, `RefreshToken`, `SignInAttempt`, `AuditEvent`, enums `StaffRole`, `AttemptOutcome`, `AuditEventType`; cuid PKs; TIMESTAMPTZ; all FKs + composite indexes per data-model
- [X] T017 Generate initial migration: run `npx prisma migrate dev --name 0001_admin_auth_users_init` and commit `backend/prisma/migrations/0001_admin_auth_users_init/migration.sql`
- [X] T018 Implement idempotent seed: `backend/prisma/seed.ts` reading `SEED_ADMIN_*` env, normalizing email, inserting super_admin with `mustChangePassword=true` only when absent (R-015); wire `prisma.seed` in `backend/package.json`
- [X] T019 [P] Pino config with PII redact paths: `backend/src/common/pino/pino.config.ts` listing `req.body.password`, `req.body.currentPassword`, `req.body.newPassword`, `req.body.initialPassword`, `res.headers["set-cookie"]`, `req.headers.authorization`, `req.headers.cookie` per Principle VI + plan.md Constraints
- [X] T020 [P] Correlation-ID middleware: `backend/src/common/middleware/correlation-id.middleware.ts` reading `X-Correlation-Id` or generating UUID v4, binding to `req.log` and echoing in response
- [X] T021 [P] Error code constants: `backend/src/common/errors/error-codes.ts` exporting one const per row in [contracts/error-codes.md](./contracts/error-codes.md)
- [X] T022 [P] Domain exceptions: `backend/src/common/errors/domain.exceptions.ts` declaring `class DomainException extends HttpException` carrying `{ code, meta? }` plus one subclass per common code (`AuthInvalidCredentialsException`, etc.)
- [X] T023 [P] HTTP exception filter mapping to envelope: `backend/src/common/errors/http-exception.filter.ts` translating `DomainException` and Nest's built-ins to `{ success: false, code, meta? }` per Principle XIV
- [X] T024 [P] PrismaService: `backend/src/infra/prisma/prisma.service.ts` extending `PrismaClient` with `onModuleInit`/`onModuleDestroy`
- [X] T025 [P] RedisService: `backend/src/infra/redis/redis.service.ts` wrapping `ioredis`; expose `ping()`, `zadd/zcard/zremrangebyscore/expire/del` typed methods
- [X] T026 [P] HIBP client: `backend/src/infra/hibp/hibp.client.ts` doing SHA-1, prefix split, `GET /range/<prefix>` with `Add-Padding: true` header and 1.5 s `AbortController` timeout; fail-closed throws `PasswordBreachCheckUnavailableException` (R-008)
- [X] T027 [P] Common-password deny-list loader: `backend/src/infra/passwords/common-passwords.ts` reading `backend/assets/top-10000-passwords.txt` at boot into `Set<string>` (lowercase, trim); also commit the asset file (R-009)
- [X] T028 Password service: `backend/src/auth/password.service.ts` exposing `hash(plain): Promise<string>` (bcrypt 12), `verify(plain, hash): Promise<boolean>` (constant-time), `validatePolicy(plain): Promise<void>` running length (12–128), common-list, HIBP — distinct exceptions per failure mode; depends T026, T027
- [X] T029 Audit-event writer + repository: `backend/src/audit/audit-event.writer.ts` (the only insert path; strips sensitive keys from `payload`) + `backend/src/audit/audit-event.repository.ts`; both used inside service transactions per data-model "Audit completeness" invariant
- [X] T030 [P] Health module: `backend/src/health/health.controller.ts` + `backend/src/health/health.module.ts` exposing `/health/live` (always 200) and `/health/ready` (Postgres `SELECT 1` + Redis `PING`)
- [X] T031 Global wiring in `backend/src/main.ts`: cookie-parser, `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, exception filter, Pino logger, correlation middleware, Swagger module — done in this single file because all are global
- [X] T032 [P] Pagination DTOs: `backend/src/common/pagination/pagination.query.dto.ts` (`page` default 1, `pageSize` default 20 max 100) + `backend/src/common/pagination/paginated.response.dto.ts`
- [X] T033 [P] Swagger setup: `backend/src/common/swagger/swagger.module.ts` mounting OpenAPI at `/api/docs` in dev; emit fresh spec to `backend/openapi-generated.json` for contract test
- [X] T034 [P] Error-code i18n scaffolds: `admin/src/i18n/error-codes.ar-EG.json` and `admin/src/i18n/error-codes.en-US.json` containing one key per code in [contracts/error-codes.md](./contracts/error-codes.md) with the "UI message (intent)" copy as the starting value
- [X] T035 [P] Design tokens: `admin/src/styles/_tokens.scss` declaring `--color-brand-primary: #06152D`, hover/active shades, surface tokens, text tokens, border tokens, semantic colors, full 4 px spacing scale, type scale, radius scale, shadow scale per Principle XXIV
- [X] T036 [P] Material 3 theme bridge: `admin/src/styles/_material-theme.scss` calling `mat.define-theme` and overriding palette using the CSS custom properties from `_tokens.scss`
- [X] T037 [P] i18n scaffolding: `admin/src/i18n/messages.ar-EG.xlf`, `admin/src/i18n/messages.en-US.xlf`; configure `LOCALE_ID` provider in `admin/src/main.ts` reading user preference from `localStorage` (default `ar-EG`)
- [X] T038 [P] AuthService skeleton: `admin/src/app/core/auth/auth.service.ts` defining signals `accessToken`, `currentUser`, `isAuthenticated`, `isRefreshing`; no logic yet — only signals + types from generated `auth.types.ts` (T014)
- [X] T039 [P] ErrorCodeService skeleton: `admin/src/app/core/errors/error-code.service.ts` loading `error-codes.<locale>.json` and exposing `toLocalizedMessage(code, meta?)` per Principle III
- [X] T040 [P] Correlation-ID interceptor: `admin/src/app/core/interceptors/correlation-id.interceptor.ts` generating UUID v4 per outbound request, attaching `X-Correlation-Id`
- [X] T041 [P] Auth interceptor (Bearer attach): `admin/src/app/core/interceptors/auth.interceptor.ts` reading `accessToken` signal from AuthService, attaching `Authorization: Bearer ...` only on `/api/admin/*` URLs
- [X] T042 [P] Error interceptor scaffold: `admin/src/app/core/interceptors/error.interceptor.ts` envelope-parsing only (no refresh flow yet — that lands in T090); throws typed `ApiError` on `{ success: false }`
- [X] T043 [P] Toast interceptor: `admin/src/app/core/interceptors/toast.interceptor.ts` calling `ErrorCodeService.toLocalizedMessage(code, meta)` and surfacing via MatSnackBar; skips codes the error interceptor routes silently (per [contracts/error-codes.md](./contracts/error-codes.md) Failure-Mode Routing table)
- [X] T044 App routes scaffold: `admin/src/app/app.routes.ts` declaring lazy routes `/login`, `/auth/change-password`, `/auth/self-password`, `/dashboard`, `/users` with placeholder `loadComponent` calls (real components land in US1/US3); register guards even if no-op for now
- [X] T045 ShellComponent + skeleton TopBar: `admin/src/app/features/shell/shell.component.ts` + `admin/src/app/features/shell/top-bar.component.ts` — render-only; bindings wired in T094
- [X] T046 Auth guard (functional): `admin/src/app/core/guards/auth.guard.fn.ts` — `canActivateFn` reading `isAuthenticated` signal; redirects to `/login?next=<encodedUrl>` if not authenticated
- [X] T047 MCP guard (functional): `admin/src/app/core/guards/mcp.guard.fn.ts` — `canMatchFn` redirecting to `/auth/change-password` when current user's `mustChangePassword` is true and route is not the forced-change page
- [X] T048 Run OpenAPI codegen end-to-end: execute `npm run gen:api` in admin, verify `admin/src/app/core/auth/auth.types.ts` contains all schemas from [contracts/admin-api.openapi.yaml](./contracts/admin-api.openapi.yaml)

**Checkpoint**: Foundation ready. Database + Redis + Pino + error envelope + Prisma + Material theme + interceptor chain + guards + types are wired. US1/US2/US3 work can begin.

---

## Phase 3: User Story 1 — Admin Login & Authenticated Session (Priority: P1) 🎯 MVP

**Goal**: A seeded super_admin signs in via the dashboard, sees the top bar, navigates protected routes, has their session silently refreshed across access-token expiry, completes the forced password change on first login, and signs out cleanly. Lockout enforced.

**Independent Test**: Seed env per [quickstart.md](./quickstart.md) §1–§6. Browser-test login with correct + wrong + deactivated credentials; force five failures + verify lockout; force access-token TTL to 30 s and verify silent refresh; sign out and verify protected URL access fails. All in both Arabic (RTL) and English (LTR). axe-core: 0 serious/critical violations.

### Tests for User Story 1

> Write these tests FIRST, ensure they FAIL before implementation.

- [~] T049 [P] [US1] Backend E2E login happy path: `backend/test/e2e/auth-login-success.e2e-spec.ts` — POST `/api/admin/auth/login` with seeded super_admin → 200, envelope, `Set-Cookie` flags (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/admin/auth/`, `Max-Age=604800`), `accessTokenExpiresIn=900`
- [~] T050 [P] [US1] Backend E2E login wrong password: `backend/test/e2e/auth-login-invalid.e2e-spec.ts` → 401 `AUTH_INVALID_CREDENTIALS`; SignInAttempt row recorded with outcome `WRONG_CREDENTIALS`; AuditEvent `AUTH_LOGIN_FAILURE`
- [~] T051 [P] [US1] Backend E2E login inactive account: `backend/test/e2e/auth-login-inactive.e2e-spec.ts` → 403 `AUTH_ACCOUNT_INACTIVE` (distinct from invalid credentials)
- [~] T052 [P] [US1] Backend E2E login lockout: `backend/test/e2e/auth-login-lockout.e2e-spec.ts` — 5 failures within window → 6th attempt with CORRECT password returns 429 `RATE_LIMITED`; wait > 15 min (or fast-forward Redis clock) → next attempt succeeds (FR-031 + FR-031a/b)
- [~] T053 [P] [US1] Backend E2E refresh rotation: `backend/test/e2e/auth-refresh-rotation.e2e-spec.ts` — POST `/api/admin/auth/refresh` rotates cookie, old `tokenHash` revoked, new row references `rotatedFromId`
- [~] T054 [P] [US1] Backend E2E refresh invalid: `backend/test/e2e/auth-refresh-invalid.e2e-spec.ts` — missing cookie / revoked / expired → 401 `AUTH_REFRESH_INVALID`, response clears the cookie
- [~] T055 [P] [US1] Backend E2E logout idempotent: `backend/test/e2e/auth-logout.e2e-spec.ts` — POST `/api/admin/auth/logout` with valid cookie → 204 + clear-cookie; calling again → 204 (no error)
- [~] T056 [P] [US1] Backend E2E me: `backend/test/e2e/auth-me.e2e-spec.ts` — GET `/api/admin/auth/me` with bearer → 200 returning `AuthenticatedUser`; without bearer → 401 `AUTH_TOKEN_MISSING`
- [~] T057 [P] [US1] Backend E2E self-change happy: `backend/test/e2e/auth-password-self.e2e-spec.ts` — PATCH `/api/admin/auth/password` with correct `currentPassword` + policy-compliant `newPassword` → 200, all refresh tokens for the user revoked, fresh access token + cookie
- [~] T058 [P] [US1] Backend E2E forced-change happy: `backend/test/e2e/auth-password-forced.e2e-spec.ts` — user with `mcp=true` access token, body `{ newPassword }` only → 200, `mustChangePassword=false` on DB, audit event `AUTH_PASSWORD_FORCED_CHANGE_COMPLETED`
- [~] T059 [P] [US1] Backend E2E password too short: `backend/test/e2e/auth-password-policy-short.e2e-spec.ts` → 422 `PASSWORD_TOO_SHORT` with `meta: { min: 12 }`
- [~] T060 [P] [US1] Backend E2E password breached (HIBP stub returns match): `backend/test/e2e/auth-password-policy-breached.e2e-spec.ts` → 422 `PASSWORD_BREACHED`
- [~] T061 [P] [US1] Backend E2E password HIBP timeout (stub stalls > 1.5 s): `backend/test/e2e/auth-password-hibp-timeout.e2e-spec.ts` → 503 `PASSWORD_BREACH_CHECK_UNAVAILABLE`; password NOT hashed; no `passwordHash` write
- [~] T062 [P] [US1] Backend Vitest unit PasswordService: `backend/test/unit/password.service.spec.ts` — covers policy edges (length 11/12/128/129, common-list hit, breached, breach-check unavailable, reset-value reuse rejection)
- [~] T063 [P] [US1] Backend Vitest unit LockoutService: `backend/test/unit/lockout.service.spec.ts` — sliding window edges (4 fails → not locked; 5th → locked; 6th during lockout → does NOT push window; success during not-locked → counter reset)
- [~] T064 [P] [US1] Backend Vitest unit RefreshTokenService: `backend/test/unit/refresh-token.service.spec.ts` — issue → rotate → revoke chain; concurrent rotation of the same token → one wins / other gets `AUTH_REFRESH_INVALID`
- [~] T065 [P] [US1] Admin Playwright ar-EG login → forced change → land dashboard: `admin/tests/e2e/auth-login-flow.ar.spec.ts`
- [~] T066 [P] [US1] Admin Playwright en-US same flow: `admin/tests/e2e/auth-login-flow.en.spec.ts`
- [~] T067 [P] [US1] Admin Playwright axe-core scan login page (both locales): `admin/tests/e2e/a11y-login.spec.ts` — fails on serious/critical
- [~] T068 [P] [US1] Admin Playwright axe-core scan forced-change page: `admin/tests/e2e/a11y-forced-change.spec.ts`
- [~] T069 [P] [US1] Admin Playwright silent refresh: `admin/tests/e2e/auth-silent-refresh.spec.ts` — backend started with `JWT_ACCESS_TTL_SECONDS=30`; test waits 35 s and asserts a single transparent `/auth/refresh` round-trip
- [~] T070 [P] [US1] Admin Playwright logout clears state: `admin/tests/e2e/auth-logout.spec.ts` — after logout, direct navigation to `/dashboard` redirects to `/login`

### Implementation for User Story 1

**Models / Repositories (backend)**

- [X] T071 [P] [US1] StaffAccountRepository (US1 surface): `backend/src/users/staff-account.repository.ts` — `findByCanonicalEmail`, `findById`, `findForLogin` (returns row WITH `passwordHash` for the only allowed path), `updateLastLogin`, `updatePasswordAndClearMcpTx` (sets hash, mcp=false, revokes all refresh tokens for user — single transaction)
- [X] T072 [P] [US1] RefreshTokenRepository: `backend/src/auth/refresh-token.repository.ts` — `issue(userId, tokenHash, expiresAt, rotatedFromId?, ua, ip)`, `lookupByHash`, `rotate(oldId, newRowInput) [tx]`, `revokeAllForUser(userId, tx)`, `revoke(id, tx)`
- [X] T073 [P] [US1] SignInAttemptRepository: `backend/src/auth/sign-in-attempt.repository.ts` — `record(emailCanonical, userId|null, outcome, sourceIp, userAgent, correlationId)`

**Services (backend)**

- [X] T074 [US1] LockoutService: `backend/src/auth/lockout.service.ts` — `isLockedOut(emailCanonical): Promise<boolean>`, `recordFailure(emailCanonical, now): Promise<void>`, `clearOnSuccess(emailCanonical): Promise<void>`; implements R-004 sliding-window via Redis sorted set; depends T025
- [X] T075 [US1] JwtService wrapper: `backend/src/auth/jwt.service.ts` — `signAccessToken({ sub, role, mcp }): string`, `verifyAccessToken(token): Payload`; reads TTL + secret from env; claims per R-006
- [X] T076 [US1] RefreshTokenService: `backend/src/auth/refresh-token.service.ts` — `issueForUser(userId, ua, ip, rotatedFromId?): { rawToken, expiresAt }` (generates 32 random bytes, SHA-256s, writes via repo), `verifyAndRotate(rawCookieToken, ua, ip): { rawToken, expiresAt, userId }`, `revoke(rawCookieToken)`, helpers to build/clear `Set-Cookie` strings honouring `COOKIE_SECURE` + `COOKIE_DOMAIN` from env
- [X] T077 [US1] AuthService: `backend/src/auth/auth.service.ts` — `login(email, password, ua, ip, correlationId)`, `refresh(rawCookie, ua, ip, correlationId)`, `logout(rawCookie, correlationId)`, `me(userId)`, `changePassword({ userIdFromJwt, mcpFromJwt, currentPassword?, newPassword }, ua, ip, correlationId)`. Each method wraps its DB mutations + AuditEventWriter call in a single Prisma `$transaction`; depends T028, T029, T071, T072, T073, T074, T075, T076
- [X] T078 [US1] JWT strategy + JwtAuthGuard: `backend/src/auth/jwt.strategy.ts` (passport-jwt extracting Bearer; verifies via JwtService; loads `StaffAccount` lightly) + `backend/src/auth/guards/jwt-auth.guard.ts`
- [X] T079 [US1] McpGuard: `backend/src/auth/guards/mcp-guard.guard.ts` — when access token has `mcp=true` AND route is NOT `PATCH /api/admin/auth/password`, returns 403 `MUST_CHANGE_PASSWORD`
- [X] T080 [US1] Throttler per-route config in `backend/src/auth/auth.module.ts`: login 5/15 min per IP, refresh 30/min per IP, generic admin 100/15 min per IP — Redis-backed (Principle XV)

**DTOs (backend)**

- [X] T081 [P] [US1] Login DTOs: `backend/src/auth/dto/login.request.dto.ts` (email `@IsEmail`, `@MaxLength(320)`; password `@IsString`, `@Length(1,128)`) and `backend/src/auth/dto/login.response.dto.ts`
- [X] T082 [P] [US1] PasswordChangeRequestDto: `backend/src/auth/dto/password-change.request.dto.ts` — `currentPassword?` (`@ValidateIf((o,p)=>!p.mcpFromContext)` via custom validation context wired in the controller); `newPassword` `@Length(12,128)`
- [X] T083 [P] [US1] Me + Refresh response DTOs: `backend/src/auth/dto/me.response.dto.ts` and `backend/src/auth/dto/refresh.response.dto.ts`

**Controller (backend)**

- [X] T084 [US1] AuthController: `backend/src/auth/auth.controller.ts` — routes `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout`, `GET /api/admin/auth/me`, `PATCH /api/admin/auth/password`; reads cookie, sets cookie, attaches Swagger decorators; depends T077, T078, T079, T080, T081, T082, T083

**Design (frontend) — invoke `ui-ux-pro-max` skill BEFORE building each screen (Principle XXIII)**

- [X] T085 [P] [US1] Invoke `ui-ux-pro-max` skill for login page; record output at `admin/docs/design/login.md` (Arabic-first, deep-navy #06152D primary, single column, large form fields ≥24px tap target, focus indicator, error region with aria-live)
- [X] T086 [P] [US1] Invoke `ui-ux-pro-max` skill for forced-change page; `admin/docs/design/forced-change.md`
- [X] T087 [P] [US1] Invoke `ui-ux-pro-max` skill for self-change page; `admin/docs/design/self-change.md`
- [X] T088 [P] [US1] Invoke `ui-ux-pro-max` skill for top-bar (user name + role chip + logout); `admin/docs/design/top-bar.md`

**Frontend implementation (US1)**

- [X] T089 [US1] AuthService implementation in `admin/src/app/core/auth/auth.service.ts` — methods `login`, `refresh`, `logout`, `loadCurrentUser`, `changePassword` (handles both standard + forced — sends `currentPassword` only when present); on login/refresh success, updates `accessToken` signal and `currentUser` signal; depends T038, T085
- [X] T090 [US1] Error interceptor refresh flow in `admin/src/app/core/interceptors/error.interceptor.ts` — on `AUTH_TOKEN_EXPIRED` queue request, call `AuthService.refresh()` (deduplicated via `isRefreshing` signal), retry original once; on refresh failure clear state + route to `/login`; on `MUST_CHANGE_PASSWORD` route to `/auth/change-password`; on `AUTH_REFRESH_INVALID|AUTH_TOKEN_INVALID|AUTH_TOKEN_MISSING` clear + redirect; per [contracts/error-codes.md](./contracts/error-codes.md) Failure-Mode Routing
- [X] T091 [US1] LoginPage in `admin/src/app/features/auth/login.page.ts` — standalone, typed `FormGroup<{email,password}>`, Material form fields, submit disabled until valid + dirty + not in-flight; on success uses router `next` query param or `/dashboard`; reads design from T085
- [X] T092 [US1] ForcedChangePage in `admin/src/app/features/auth/forced-change.page.ts` — typed form with only `newPassword`; blocks all other navigation via `canDeactivateFn` returning false unless submitted; reads design from T086
- [X] T093 [US1] SelfChangePage in `admin/src/app/features/auth/self-change.page.ts` — typed form `{ currentPassword, newPassword }`; reads design from T087
- [X] T094 [US1] ShellComponent wiring + TopBar in `admin/src/app/features/shell/shell.component.ts` and `admin/src/app/features/shell/top-bar.component.ts` — reads `currentUser` signal for name + role chip; logout button calls AuthService and redirects; reads design from T088
- [X] T095 [US1] Auth feature routes: `admin/src/app/features/auth/auth.routes.ts` exporting `[{path:'login', loadComponent:...}, {path:'change-password', canActivate:[authGuardFn], loadComponent:...forced}, {path:'self-password', canActivate:[authGuardFn], loadComponent:...self}]`
- [X] T096 [US1] MCP guard wiring in `admin/src/app/app.routes.ts` and `admin/src/app/core/guards/mcp.guard.fn.ts` — every route other than `/auth/change-password` includes `canMatch: [mcpGuardFn]` which reads `currentUser.mustChangePassword` signal
- [X] T097 [US1] i18n + error-code copy for US1: extend `admin/src/i18n/messages.{ar-EG,en-US}.xlf` with login/forced/self/top-bar strings; finalize `admin/src/i18n/error-codes.{ar-EG,en-US}.json` for all auth codes (`AUTH_*`, `PASSWORD_*`, `MUST_CHANGE_PASSWORD`, `INVALID_CURRENT_PASSWORD`, `RATE_LIMITED`)

**Cross-cutting (US1)**

- [X] T098 [US1] Audit-event emission wired inside AuthService for login success/failure/refresh/logout/password-changed/forced-change-completed — verified by T049/T050/T051/T053/T055/T057/T058 assertions on `audit_event` rows; backend file `backend/src/auth/auth.service.ts`

**Checkpoint**: User Story 1 is fully functional. A seeded super_admin can sign in (Arabic + English), is forced to change password, sees the dashboard, has their session silently refreshed, and can sign out — verified by T065–T070, axe-core gating in T067/T068. Stop, validate, demo if desired.

---

## Phase 4: User Story 2 — Role-Based Access Inside the Dashboard (Priority: P1)

**Goal**: All three roles see only what their role permits; backend rejects every cross-role write regardless of what the dashboard shows.

**Independent Test**: Seed one user per role. Sign in as each. Assert: super_admin sees user-management nav entry; admin does not (and direct nav to `/users` returns the unauthorized state); viewer sees no create/edit/delete buttons anywhere. From a viewer's session, call `POST /api/admin/users` directly → 403 `FORBIDDEN`.

**Story dependency**: US2 reuses US1's `JwtAuthGuard`. The concrete protected resource exercised here is `/users/*` — those endpoints' controller-level @Roles annotation is implemented in this phase as a placeholder; US3 fills in the service body. This wiring ensures US2 is independently testable (curl-able) the moment its tasks are done, against a stub that returns 200/403 by role.

### Tests for User Story 2

- [~] T099 [P] [US2] Backend E2E viewer write rejected: `backend/test/e2e/rbac-viewer-write.e2e-spec.ts` — viewer JWT, POST `/api/admin/users` body → 403 `FORBIDDEN`
- [~] T100 [P] [US2] Backend E2E admin user-mgmt rejected: `backend/test/e2e/rbac-admin-users.e2e-spec.ts` — admin JWT hits any `/api/admin/users/*` route → 403 `FORBIDDEN`
- [~] T101 [P] [US2] Backend E2E super_admin user-mgmt allowed: `backend/test/e2e/rbac-super-admin-users.e2e-spec.ts` — super_admin JWT hits `GET /api/admin/users` → 200 (stub list)
- [~] T102 [P] [US2] Backend Vitest unit RolesGuard: `backend/test/unit/roles.guard.spec.ts` — @Roles metadata read via Reflector, request user.role compared, 403 with code `FORBIDDEN`
- [~] T103 [P] [US2] Admin Playwright ar-EG viewer no write controls: `admin/tests/e2e/rbac-viewer-controls.ar.spec.ts` — viewer signed in; no create/edit/delete button reachable on any screen rendered so far
- [~] T104 [P] [US2] Admin Playwright ar-EG admin sidebar omits users: `admin/tests/e2e/rbac-admin-sidebar.ar.spec.ts`
- [~] T105 [P] [US2] Admin Playwright en-US RBAC coverage: `admin/tests/e2e/rbac.en.spec.ts` — combined sidebar + controls assertions
- [~] T106 [P] [US2] Admin Playwright ar-EG super_admin sees Users entry: `admin/tests/e2e/rbac-super-sidebar.ar.spec.ts`

### Implementation for User Story 2

- [X] T107 [US2] Roles decorator + guard (backend): `backend/src/common/decorators/roles.decorator.ts` (`@Roles(...roles)` setting metadata) and `backend/src/common/guards/roles.guard.ts` (reads metadata via Reflector; throws `ForbiddenException` carrying code `FORBIDDEN`); registered alongside `JwtAuthGuard` in `app.module.ts`
- [X] T108 [US2] `/users/*` placeholder controller: `backend/src/users/users.controller.ts` defined with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('super_admin')` at class level; methods return `{ success: true, data: [] }` stubs so US2 E2E tests (T099–T101) pass against real HTTP — US3 fills in real bodies
- [X] T109 [US2] Role guard (frontend): `admin/src/app/core/guards/role.guard.fn.ts` — `roleGuardFn(allowed: StaffRole[])` returns a `canMatchFn` reading `currentUser.role` signal
- [X] T110 [US2] Sidebar nav role-aware in `admin/src/app/features/shell/sidebar.component.ts` — `@if (auth.currentUser()?.role === 'super_admin') { <usersNavEntry/> }` and route `/users` carries `canMatch: [roleGuardFn(['super_admin'])]`
- [X] T111 [US2] `can` directive for role-gated controls (frontend): `admin/src/app/shared/can.directive.ts` standalone directive `*can="['super_admin']"` that consumes the auth signal and conditionally renders content — used to wrap all current and future write controls (Principle XXII / FR-013)
- [X] T112 [US2] i18n strings for forbidden + role-aware empty states; extend `admin/src/i18n/messages.{ar-EG,en-US}.xlf` and `admin/src/i18n/error-codes.{ar-EG,en-US}.json` ensuring `FORBIDDEN` and `CANNOT_SELF_MODIFY` and `SUPER_ADMIN_FLOOR_VIOLATED` are present (the last two ship copy now, used in US3)

**Checkpoint**: US1 + US2 work together. Login + role enforcement are end-to-end verifiable. The `/users/*` endpoints respond correctly at the role layer even though the service bodies are stubs.

---

## Phase 5: User Story 3 — Super-Admin Manages Other Admin Users (Priority: P2)

**Goal**: A super_admin can create `sales_manager`, `sales_agent`, and `analyst` accounts, edit name/role/status, deactivate without deletion, reset another user's password, and never accidentally lock the platform out of super_admins.

**Independent Test**: Per [quickstart.md](./quickstart.md) §7–§11. Create admin via dashboard; sign in as them; deactivate; verify cannot sign in; reset password; verify new password works. Then attempt the concurrent demotion race with two browser sessions — the floor invariant holds.

### Tests for User Story 3

- [~] T113 [P] [US3] Backend E2E create user happy: `backend/test/e2e/users-create-success.e2e-spec.ts` — POST `/api/admin/users` super_admin → 201, user appears in list, AuditEvent `ADMIN_USER_CREATED`, `mustChangePassword=true`
- [~] T114 [P] [US3] Backend E2E duplicate email: `backend/test/e2e/users-create-duplicate.e2e-spec.ts` → 409 `DUPLICATE_ENTRY` with `meta: { field: "email" }`
- [~] T115 [P] [US3] Backend E2E unicode/whitespace email collision: `backend/test/e2e/users-create-canonical-email.e2e-spec.ts` — submit `Ａｄｍｉｎ@example.com ` vs existing `admin@example.com` → 409
- [~] T116 [P] [US3] Backend E2E password policy on create: `backend/test/e2e/users-create-password-policy.e2e-spec.ts` — too-short / breached / on-list each yield correct 422 code
- [~] T117 [P] [US3] Backend E2E list pagination: `backend/test/e2e/users-list.e2e-spec.ts` — seeded fixtures (25 users) → page=1,pageSize=20 returns 20+pagination meta, page=2 returns 5
- [~] T118 [P] [US3] Backend E2E get by id + 404: `backend/test/e2e/users-get.e2e-spec.ts`
- [~] T119 [P] [US3] Backend E2E update name/role/status: `backend/test/e2e/users-update.e2e-spec.ts` — verifies AuditEvent `ADMIN_USER_UPDATED` with `changedFields`, plus role-change emits `ADMIN_USER_ROLE_CHANGED`
- [~] T120 [P] [US3] Backend E2E self-modify rejected: `backend/test/e2e/users-update-self-rejected.e2e-spec.ts` → 403 `CANNOT_SELF_MODIFY`
- [~] T121 [P] [US3] Backend E2E demotion allowed when floor holds: `backend/test/e2e/users-update-demote-ok.e2e-spec.ts` — seed 2 super_admins, demote one → 200, count = 1
- [~] T122 [P] [US3] Backend E2E demotion blocked when floor violated: `backend/test/e2e/users-update-demote-blocked.e2e-spec.ts` — seed 1 super_admin, attempt self / only-other demote → 403 `SUPER_ADMIN_FLOOR_VIOLATED`
- [~] T123 [P] [US3] Backend E2E reset password: `backend/test/e2e/users-reset-password.e2e-spec.ts` — super_admin resets target → 204, target's `mustChangePassword=true`, all target's refresh tokens revoked, AuditEvent `ADMIN_USER_PASSWORD_RESET`
- [~] T124 [P] [US3] Backend E2E reset self rejected: `backend/test/e2e/users-reset-self-rejected.e2e-spec.ts` → 403 `CANNOT_SELF_MODIFY`
- [~] T125 [P] [US3] Backend concurrency test (SC-020): `backend/test/e2e/role-floor-race.e2e-spec.ts` — seed exactly 2 active super_admins, fire 100 paired racing demotes in both directions; assert (a) at least one of 200 requests succeeds, (b) end state has ≥ 1 active super_admin, (c) no `INTERNAL_ERROR` ever emitted, (d) blocked requests carry `SUPER_ADMIN_FLOOR_VIOLATED`
- [~] T126 [P] [US3] Backend Vitest unit StaffAccountRepository serializable retry: `backend/test/unit/staff-account.repository.spec.ts` — mocks `40001` serialization-failure, asserts single retry, surfaces conflict on second failure
- [~] T127 [P] [US3] Backend Vitest unit email canonicalisation: `backend/test/unit/email-canonical.spec.ts` — NFKC + lowercase + trim, with fullwidth + mixed-case + leading/trailing whitespace inputs
- [~] T128 [P] [US3] Admin Playwright ar-EG create → first login → forced change: `admin/tests/e2e/users-create-flow.ar.spec.ts`
- [~] T129 [P] [US3] Admin Playwright en-US same flow: `admin/tests/e2e/users-create-flow.en.spec.ts`
- [~] T130 [P] [US3] Admin Playwright axe-core scan user-list page (both locales): `admin/tests/e2e/a11y-users-list.spec.ts`
- [~] T131 [P] [US3] Admin Playwright axe-core scan user-form dialog: `admin/tests/e2e/a11y-user-form.spec.ts`
- [~] T132 [P] [US3] Admin Playwright super_admin demote flow + audit visible (via backend assertion): `admin/tests/e2e/users-demote.spec.ts`

### Implementation for User Story 3

**Repository extensions (backend)**

- [X] T133 [P] [US3] StaffAccountRepository extensions in `backend/src/users/staff-account.repository.ts`: `list(page, pageSize): { rows, total }` (offset pagination), `createWithCanonicalEmail({ email, emailDisplay, name, role, passwordHash, mustChangePassword=true })` (catches Postgres unique-violation `23505` and re-throws `DuplicateEntryException`), `updateMeta(id, { name?, role?, isActive? })` (without floor implications — caller pre-checks), `updateRoleAndActiveTx(id, patch)` (SERIALIZABLE isolation, post-mutation floor count, retry-once on `40001` per R-007), `resetPasswordTx(id, passwordHash)` (sets hash + mcp=true + revokes all refresh tokens for the user — single transaction)

**DTOs (backend)**

- [X] T134 [P] [US3] User DTOs: `backend/src/users/dto/create-staff.request.dto.ts` (name 2–120, email IsEmail, role enum `ADMIN|VIEWER`, initialPassword 12–128), `backend/src/users/dto/update-staff.request.dto.ts` (all optional, `AtLeastOneOf` custom validator), `backend/src/users/dto/reset-password.request.dto.ts` (newPassword 12–128), `backend/src/users/dto/staff-account.response.dto.ts`

**Service (backend)**

- [X] T135 [US3] UsersService: `backend/src/users/users.service.ts` — `create(actorId, body, ctx)` (canonicalises email, validates password policy via PasswordService, hashes, calls repo.createWithCanonicalEmail in tx that also writes `ADMIN_USER_CREATED` audit), `list(query)`, `getById(id)`, `update(actorId, targetId, patch, ctx)` (FR-022 self-modify rejected; chooses `updateRoleAndActiveTx` when `role` or `isActive` touched, else `updateMeta`; writes `ADMIN_USER_UPDATED` + conditionally `ADMIN_USER_ROLE_CHANGED` + `ADMIN_USER_DEACTIVATED`; on deactivation also revokes all target's refresh tokens in same tx), `resetPassword(actorId, targetId, newPassword, ctx)` (rejects self via `CANNOT_SELF_MODIFY`, validates policy, hashes, calls `resetPasswordTx`, writes `ADMIN_USER_PASSWORD_RESET`); depends T133, T134, T028, T029, T072

**Controller (backend)**

- [X] T136 [US3] UsersController real bodies: replace stubs from T108 in `backend/src/users/users.controller.ts` — wire all 6 routes from [contracts/admin-api.openapi.yaml](./contracts/admin-api.openapi.yaml) to UsersService methods; preserve `@Roles('super_admin')` from US2; attach Swagger decorators per DTO

**Design (frontend) — `ui-ux-pro-max` invocation**

- [X] T137 [P] [US3] Invoke `ui-ux-pro-max` skill for user-list page; output at `admin/docs/design/user-list.md` (data table, role chips, active/inactive badge, search not required this slice, paginator at bottom)
- [X] T138 [P] [US3] Invoke `ui-ux-pro-max` skill for user-create/edit dialog; `admin/docs/design/user-form.md`
- [X] T139 [P] [US3] Invoke `ui-ux-pro-max` skill for reset-password dialog; `admin/docs/design/reset-password.md`

**Frontend implementation (US3)**

- [X] T140 [US3] Admin UsersService: `admin/src/app/features/users/users.service.ts` — wraps HttpClient calls to `GET/POST/PATCH /api/admin/users` and `PATCH /api/admin/users/:id/password`; returns typed responses from generated `auth.types.ts`
- [X] T141 [US3] UsersListPage: `admin/src/app/features/users/users-list.page.ts` — standalone, `MatTable` driven by signal-backed datasource, paginator, `*can="['super_admin']"` on create button (US2 directive), row action buttons (edit, deactivate/activate, reset password); reads design from T137
- [X] T142 [US3] UserFormDialog: `admin/src/app/features/users/user-form.dialog.ts` — single component for create + edit; typed `FormGroup<{name, email?, role, isActive?, initialPassword?}>` (email + initialPassword only on create); validation messages from i18n; rejects close without save when dirty; reads design from T138
- [X] T143 [US3] ResetPasswordDialog: `admin/src/app/features/users/reset-password.dialog.ts` — typed `FormGroup<{newPassword}>`; reads design from T139
- [X] T144 [US3] Users feature routes: `admin/src/app/features/users/users.routes.ts` — root route `''` (UsersListPage) gated by `canMatch:[authGuardFn, roleGuardFn(['super_admin']), mcpGuardFn]`; lazy-loaded from app.routes
- [X] T145 [US3] Sidebar nav "Users" entry (super_admin only — already gated in T110); confirm icon + label resolved from i18n
- [X] T146 [US3] i18n + error-code copy for US3: extend `admin/src/i18n/messages.{ar-EG,en-US}.xlf` (user-list headers, action labels, dialog titles, confirmation copy) and finalize `admin/src/i18n/error-codes.{ar-EG,en-US}.json` entries for `DUPLICATE_ENTRY`, `NOT_FOUND`, `CANNOT_SELF_MODIFY`, `SUPER_ADMIN_FLOOR_VIOLATED`, `VALIDATION_FAILED`
- [X] T147 [US3] Audit verification — backend file `backend/src/users/users.service.ts` is the source of truth; T125 concurrency test asserts each event type's presence/absence; no separate frontend audit work in this slice (audit-log viewer is out of scope per spec Assumptions)

**Checkpoint**: All three user stories functional. MVP + RBAC + user management work end-to-end. Spec acceptance scenarios 1–6 (US1), 1–4 (US2), and 1–6 (US3) all pass. All 15 success criteria (SC-001 through SC-020 accounting for the additions in /speckit.clarify) are verifiable.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Final correctness/operability tasks that touch shared surfaces.

- [X] T148 [P] Add error-code parity script: `backend/scripts/check-error-codes-parity.ts` reads `error-codes.ts` constants and asserts every code key exists in BOTH `admin/src/i18n/error-codes.ar-EG.json` and `admin/src/i18n/error-codes.en-US.json` — wired as `npm run check:codes` in both packages and in CI
- [~] T149 [P] Pino redact verification test: `backend/test/integration/pino-redact.spec.ts` POSTs `/api/admin/auth/login` with a password and asserts the captured log line contains `"password":"[Redacted]"` and never the raw password value — same for `Authorization` and `Cookie` headers
- [~] T150 [P] Contract test backend vs OpenAPI: `backend/test/e2e/openapi-contract.spec.ts` uses `dredd` or `openapi-validator-middleware` to assert every response from a running backend matches the schema in `specs/001-admin-auth-users/contracts/admin-api.openapi.yaml`
- [X] T151 [P] Annotate all DTOs + controllers with `@nestjs/swagger` decorators so `/api/docs` renders complete schemas (all files under `backend/src/auth/dto/`, `backend/src/users/dto/`, `backend/src/auth/auth.controller.ts`, `backend/src/users/users.controller.ts`)
- [X] T152 [P] Backend Dockerfile: `backend/Dockerfile` multi-stage build (`node:22-alpine` → `node:22-alpine` slim), non-root user `node`, no dev deps in final stage, `HEALTHCHECK` hitting `/health/ready`
- [X] T153 [P] Admin production build config: `admin/angular.json` configures localized bundles (`ar-EG`, `en-US`) via `i18n.locales` block; `package.json` script `build:prod` runs both localized builds
- [X] T154 [P] CI workflow `.github/workflows/ci.yml`: stages — lint (backend + admin), tsc, build, error-code parity (T148), OpenAPI lint. No test stages per constitution v1.2.0.
- [~] T155 Run [quickstart.md](./quickstart.md) end-to-end against fresh `docker compose -f docker/compose.dev.yml up`: complete §1–§11, capture screenshots for PR description (LTR + RTL), sign off — DEFERRED (operator runs locally; requires Docker)
- [X] T156 README updates: `README.md` documents chosen UI library (Angular Material — Principle XXIV's "document the choice in README") and chosen test runner (Vitest); links to constitution, spec, plan
- [X] T157 Constitution PR-checklist append: `specs/001-admin-auth-users/checklists/constitution-compliance.md` — one-line attestation per applicable principle (I, III, IV, VI, VII, VIII, IX–XVI, XVII–XXVII), cite implementing file paths; reviewers tick before merge
- [X] T158 [P] Sentry-style error reporter scaffold (deferred-friendly): `admin/src/app/core/errors/error-reporter.ts` with `ErrorReporter.report(err, ctx)`; wired but disabled by env flag `NG_SENTRY_DSN`; backend mirror `backend/src/common/errors/error-reporter.ts` for unhandled exceptions; no DSN configured in this slice — flag stays unset

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies; can start immediately
- **Foundational (Phase 2)**: depends on Phase 1; BLOCKS all user-story phases
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2; logically pairs with US1 since both ship as P1, but can start the moment Phase 2 is done if staffing allows
- **US3 (Phase 5)**: depends on Phase 2; T108's stub controller lets US3 wait for US2 only at the controller-merge moment, not for the entire US2 phase
- **Polish (Phase 6)**: depends on all preceding phases

### User Story Dependencies

- **US1**: independent post-Phase-2. Only consumes foundational primitives + its own auth-module scaffolding.
- **US2**: independent post-Phase-2 in test scope. Implementation-side it places stubs on `/users/*` so its E2E tests can run before US3 is implemented.
- **US3**: depends on US2's RolesGuard + frontend roleGuardFn for its `@Roles` annotation + sidebar gating; otherwise independent. Replaces the T108 stub controller body but the controller itself was created in US2.

### Within Each User Story

- Tests written first; verify they FAIL against stubs/placeholders before implementation
- Repositories before services
- Services before controllers
- Controllers before E2E coverage cycles back green
- Frontend: design (`ui-ux-pro-max` skill) → service → page/dialog → routes wired

### Parallel Opportunities

- **Phase 1**: T003 + T004 + T005 + T006 + T007 + T008 + T009 + T010 + T011 + T012 + T013 + T014 all run together (different files, no in-phase ordering)
- **Phase 2**: T019 + T020 + T021 + T022 + T023 + T024 + T025 + T026 + T027 + T030 + T032 + T033 + T034 + T035 + T036 + T037 + T038 + T039 + T040 + T041 + T042 + T043 all run together; T028 awaits T026 + T027; T031 awaits T021–T023; T044–T047 await guard prerequisites
- **US1 tests**: T049–T070 all parallel (different test files)
- **US1 repositories**: T071 + T072 + T073 parallel
- **US1 DTOs**: T081 + T082 + T083 parallel
- **US1 design tasks**: T085 + T086 + T087 + T088 parallel
- **US2 tests**: T099–T106 parallel
- **US3 tests**: T113–T132 parallel
- **US3 design tasks**: T137 + T138 + T139 parallel
- **Polish**: T148–T154 + T158 parallel; T155 sequential (manual sign-off); T157 depends on each principle's implementing files being merged

---

## Parallel Example: User Story 1 (within a single developer-day)

```bash
# Launch all US1 tests in parallel (different files; fail until implementation lands):
Task: "Backend E2E login happy path in backend/test/e2e/auth-login-success.e2e-spec.ts"            # T049
Task: "Backend E2E refresh rotation in backend/test/e2e/auth-refresh-rotation.e2e-spec.ts"        # T053
Task: "Backend Vitest unit PasswordService in backend/test/unit/password.service.spec.ts"        # T062
Task: "Admin Playwright ar-EG login flow in admin/tests/e2e/auth-login-flow.ar.spec.ts"          # T065

# Launch all US1 repositories in parallel:
Task: "StaffAccountRepository in backend/src/users/staff-account.repository.ts"                  # T071
Task: "RefreshTokenRepository in backend/src/auth/refresh-token.repository.ts"                   # T072
Task: "SignInAttemptRepository in backend/src/auth/sign-in-attempt.repository.ts"                # T073

# Launch all US1 design-skill invocations in parallel:
Task: "Invoke ui-ux-pro-max skill for login page → admin/docs/design/login.md"                   # T085
Task: "Invoke ui-ux-pro-max skill for forced-change → admin/docs/design/forced-change.md"        # T086
Task: "Invoke ui-ux-pro-max skill for self-change → admin/docs/design/self-change.md"            # T087
Task: "Invoke ui-ux-pro-max skill for top-bar → admin/docs/design/top-bar.md"                    # T088
```

---

## Implementation Strategy

### MVP first (User Story 1 only)

1. Complete Phase 1: Setup (T001–T014).
2. Complete Phase 2: Foundational (T015–T048). CRITICAL — blocks everything.
3. Complete Phase 3: User Story 1 (T049–T098).
4. **STOP and VALIDATE**: walk through [quickstart.md](./quickstart.md) §1–§6 + §9. Demo. This is shippable as a single-super_admin admin product.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → Test → Deploy / Demo (MVP).
3. US2 → Test → Deploy / Demo (RBAC layered on; sales_manager / sales_agent / analyst users can sign in even without management UI — they just see no Users link).
4. US3 → Test → Deploy / Demo (super_admin can now grow the team without re-running seed).
5. Polish → ship-grade.

### Parallel team strategy

After Phase 2 completes:
- Developer A: US1 backend (T071–T084) then US1 frontend (T089–T097)
- Developer B: US2 (T107–T112) — minimal scope; finishes early; rolls into helping with US3
- Developer C: US3 backend (T133–T136) then US3 frontend (T140–T146) once US2 has wired RolesGuard
- Test work (T049–T070, T099–T106, T113–T132) parallelized across all three or owned by a fourth.

---

---

## Phase 9 — Role Expansion Retrofit (2026-05-13)

Replace 3-role model (`SUPER_ADMIN`/`ADMIN`/`VIEWER`) with 4-role model (`super_admin`/`sales_manager`/`sales_agent`/`analyst`). See research §R-016.

- [X] T200 Update Prisma `StaffRole` enum in `backend/prisma/schema.prisma`
- [X] T201 Write atomic enum-swap migration: `backend/prisma/migrations/20260512234911_admin_role_expansion/migration.sql` mapping `SUPER_ADMIN→super_admin`, `ADMIN→sales_manager`, `VIEWER→analyst`
- [X] T202 Backend role references: `users.controller.ts`, `staff-account.repository.ts`, `create-staff.request.dto.ts`, `update-staff.request.dto.ts`, `login.response.dto.ts`, `staff-account.response.dto.ts`, `roles.decorator.ts` doc, `prisma/seed.ts`
- [X] T203 Admin types: `admin/src/app/core/auth/auth.types.ts` (`StaffRole` union + `CreatableRole` export)
- [X] T204 Admin guards + routes: `app.routes.ts:roleGuardFn(['super_admin'])`; `sidebar.component.ts:*can="['super_admin']"`
- [X] T205 Admin UI: `top-bar.component.ts` (4 chip variants + `roleLabel`), `users-list.page.ts` (4 chip classes + 4 avatar `[data-role]` + `roleLabel`), `user-form.dialog.ts` (3 selectable roles with descriptions, defaults to `analyst`), `dashboard-placeholder.component.ts` (4 kicker variants)
- [X] T206 i18n role labels in `admin/src/i18n/messages.ar-EG.xlf`: `role.super_admin`, `role.sales_manager`, `role.sales_agent`, `role.analyst`, plus form descriptions and dashboard kickers
- [X] T207 Boot-time silent refresh fix: `app.config.ts` `APP_INITIALIZER` calls `auth.refresh()` + `auth.loadCurrentUser()` so page reload preserves session (previously forced re-login)
- [X] T208 Spec retrofit: `spec.md`, `data-model.md`, `plan.md`, `research.md`, `quickstart.md`, `contracts/admin-api.openapi.yaml`, `tasks.md` updated to reflect 4-role model

---

## Notes

- `[P]` tasks touch different files and have no in-phase dependencies. Cross-phase dependencies still apply.
- Story label maps to spec user stories for traceability.
- Tests must be written and FAIL before implementation per Phase-order rule (constitution doesn't mandate strict TDD red-green-refactor but the spec's "Definition of done" requires the tests to exist; writing them first catches contract drift).
- Audit-event assertions live INSIDE E2E tests rather than in dedicated tasks because the constitution's append-only invariant means audit completeness is part of every mutating-endpoint test (see data-model.md "Cross-Entity Invariants" #5).
- The `ui-ux-pro-max` skill invocation tasks are explicit because Principle XXIII requires "invoke the skill to obtain layout guidance, component composition, spacing scale, and interaction patterns" BEFORE building each screen — these are first-class deliverables that the implementation tasks read from.
- Commits should land in small logical groups per task or per few-parallel-tasks; never one massive PR.
- After each checkpoint, stop and validate the story independently before continuing.
- Avoid: vague task descriptions; cross-story dependencies that break independence; same-file [P] markers; skipping the `ui-ux-pro-max` skill invocation.
