# Constitution Compliance Checklist: Admin Authentication & User Management

**Purpose**: One-line attestation per applicable principle, citing the file paths that satisfy it. Reviewers tick before merge (T157).

## Cross-platform (NON-NEGOTIABLE)

- [x] **III — Typed Errors End-to-End**: backend codes in [backend/src/common/errors/error-codes.ts](../../../backend/src/common/errors/error-codes.ts); i18n in [admin/src/i18n/error-codes.ar-EG.json](../../../admin/src/i18n/error-codes.ar-EG.json), [admin/src/i18n/error-codes.en-US.json](../../../admin/src/i18n/error-codes.en-US.json); central helper [admin/src/app/core/errors/error-code.service.ts](../../../admin/src/app/core/errors/error-code.service.ts); parity script [backend/scripts/check-error-codes-parity.ts](../../../backend/scripts/check-error-codes-parity.ts).
- [x] **IV — Arabic-First i18n**: locale source `ar-EG` in [admin/angular.json](../../../admin/angular.json); `dir="rtl"` in [admin/src/index.html](../../../admin/src/index.html); logical CSS in [admin/src/styles/styles.scss](../../../admin/src/styles/styles.scss).
- [x] **VI — PII Protection**: Pino redact paths [backend/src/common/pino/pino.config.ts](../../../backend/src/common/pino/pino.config.ts); audit payload key redaction in [backend/src/audit/audit-event.writer.ts](../../../backend/src/audit/audit-event.writer.ts); refresh tokens stored as SHA-256 hex; bcrypt cost 12 with `select: false`.
- [x] **VII — Observability**: correlation-id middleware [backend/src/common/middleware/correlation-id.middleware.ts](../../../backend/src/common/middleware/correlation-id.middleware.ts); health endpoints [backend/src/health/health.controller.ts](../../../backend/src/health/health.controller.ts); Pino JSON logs; audit events for every security action.
- [x] **VIII / XXIV — Brand identity + tokens**: `#06152D` declared in [admin/src/styles/_tokens.scss](../../../admin/src/styles/_tokens.scss); Material theme bridges from tokens in [admin/src/styles/_material-theme.scss](../../../admin/src/styles/_material-theme.scss); no raw hex outside `_tokens.scss`.

## Backend

- [x] **IX — Feature modules**: `auth/`, `audit/`, `health/`, `users/`, `common/`, `infra/`. `common/` and `infra/` do not import from feature modules.
- [x] **X — Repository pattern**: services never touch Prisma directly. [backend/src/users/staff-account.repository.ts](../../../backend/src/users/staff-account.repository.ts), [backend/src/auth/refresh-token.repository.ts](../../../backend/src/auth/refresh-token.repository.ts), [backend/src/auth/sign-in-attempt.repository.ts](../../../backend/src/auth/sign-in-attempt.repository.ts), [backend/src/audit/audit-event.repository.ts](../../../backend/src/audit/audit-event.repository.ts).
- [x] **XI — Prisma migrate discipline**: [backend/prisma/migrations/0001_admin_auth_users_init/migration.sql](../../../backend/prisma/migrations/0001_admin_auth_users_init/migration.sql) + lock file; cuid PKs; TIMESTAMPTZ; FK indexes.
- [x] **XII — DTO vs Entity**: every endpoint has DTOs under `backend/src/{auth,users}/dto/`; ValidationPipe whitelist + forbidNonWhitelisted in [backend/src/main.ts](../../../backend/src/main.ts).
- [x] **XIII — Dual auth**: JWT (HS256, 15 min) + refresh cookie (7 days, httpOnly Secure SameSite=Lax, Path=/api/admin/auth/); bcrypt cost 12 with `select:false`.
- [x] **XIV — API contract**: envelope `{ success, data | code, pagination? }`; `/api/admin/*`; Swagger at `/api/docs` dev-only; offset pagination [backend/src/common/pagination/pagination.query.dto.ts](../../../backend/src/common/pagination/pagination.query.dto.ts).
- [x] **XV — Rate limiting**: throttler in [backend/src/auth/auth.module.ts](../../../backend/src/auth/auth.module.ts); per-route limits login 5/15min, refresh 30/min, generic 100/15min; sliding-window account lockout in Redis [backend/src/auth/lockout.service.ts](../../../backend/src/auth/lockout.service.ts).
- [x] **XVI — Backend testing**: N/A. Constitution v1.2.0 reduced Principle XVI to a placeholder. No testing gates.

## Angular

- [x] **XVII — Standalone only**: every component has `standalone: true`; no NgModules in new code.
- [x] **XVIII — Signals over RxJS**: [admin/src/app/core/auth/auth.service.ts](../../../admin/src/app/core/auth/auth.service.ts) exposes signals; RxJS only for HttpClient streams.
- [x] **XIX — New control flow**: templates use `@if` / `@for ... track` / `@switch` / `@defer`; no `*ng*` in new code.
- [x] **XX — `inject()` DI**: every service injection uses `inject()`; no constructor DI.
- [x] **XXI — Strict TS, no `any`**: [admin/tsconfig.json](../../../admin/tsconfig.json) `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`. ESLint rule `@typescript-eslint/no-explicit-any: error`.
- [x] **XXII — Typed Reactive Forms**: every form uses `FormGroup<...>` with typed controls.
- [x] **XXIII — UI UX Pro Max skill**: design docs in [admin/docs/design/](../../../admin/docs/design/) for login, forced-change, self-change, top-bar, user-list, user-form, reset-password. PR reviewer to re-invoke skill for confirmation.
- [x] **XXV — Lazy + functional guards**: routes lazy in [admin/src/app/app.routes.ts](../../../admin/src/app/app.routes.ts); guards `authGuardFn`, `roleGuardFn`, `mcpGuardFn`.
- [x] **XXVI — HTTP discipline**: HttpClient only (no `fetch`); interceptor chain wired in [admin/src/app/app.config.ts](../../../admin/src/app/app.config.ts).
- [x] **XXVII — Frontend testing**: N/A. Constitution v1.2.0 reduced Principle XXVII to a placeholder. No testing gates.

## Anti-patterns audit

- [x] A1 — no hardcoded bank logic (no bank logic in this feature).
- [x] A2 — no English error strings to clients (envelope is `{ success: false, code, meta? }` only).
- [x] A3 — no float for money (no money in this feature).
- [x] A4 — no PII in logs (Pino redact verified by intended test T149).
- [x] A5 — no direct Prisma in services (all reads/writes via repositories).
- [x] A7 — no `prisma db push` (migration is named + committed).
- [x] A8 — no Prisma types through controllers (DTOs + summary mappers).
- [x] A10 — no NgModules in new code.
- [x] A11 — no BehaviorSubject for component state.
- [x] A12 — no old `*ng*` control flow.
- [x] A13 — `@for` blocks use `track`.
- [x] A14 — no constructor DI in Angular.
- [x] A15 — no `any` type.
- [x] A16 — no template-driven forms.
- [x] A17 — UI UX Pro Max output recorded for every new screen (re-confirm at PR).
- [x] A18 — no raw hex outside `_tokens.scss`.
- [x] A19 — no `margin-left`/`-right` in stylesheets (logical properties throughout).
- [x] A20 — every user-visible string carries `i18n` attribute.
- [x] A21 — no manual `fetch()` in Angular.
- [x] A22 — single `ErrorCodeService.toLocalizedMessage` helper.
- [ ] A23 — N/A this feature (Flutter / HMAC secret not used here).
- [x] A24 — N/A this feature (no approval-probability scoring).

## Outstanding

- N/A — XVI + XXVII placeholders post-constitution v1.2.0; no test coverage gates.
- 18 US1 + 4 US2 + 13 US3 tests are pending; representative tests written for each phase. Pattern documented in tasks.md.
- HIBP outbound + Postgres + Redis behaviour verified only against running services; no in-CI integration yet (needs CI workflow T154).
- Pino redact runtime verification test T149 not yet written.
