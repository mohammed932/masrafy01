# masrafy01 Development Guidelines

Auto-generated from feature plans + constitution. Last updated: 2026-05-12

## Project Identity

**Masrafy** (internally "Credit Match") — Egyptian fintech loan comparison marketplace. Connects users with 20+ bank loan programs (ABK Egypt + partners) via 5-step wizard + matching engine. Three product lines: personal loans, car loans, mortgages. Free for users; commission revenue from banks. Three platforms governed by a single constitution: NestJS backend (active), Angular admin dashboard (active), Flutter mobile app (deferred until Figma).

Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md) v1.0.0

## Active Technologies

### Backend (`backend/`) — feature 001-admin-auth-users
- Node.js 22 LTS, TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`)
- NestJS 10, Prisma 5, PostgreSQL 16
- `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt` (cost 12)
- `@nestjs/throttler` (Redis store), `ioredis`
- `class-validator`, `class-transformer`
- `nestjs-pino` + `pino` (structured JSON logs, PII redact)
- `@nestjs/swagger` (OpenAPI at `/api/docs`)
- `zod` (env validation, fail-fast at boot)
- No constitutional testing requirements (Principle XVI placeholder post-v1.2.0).

### Frontend (`admin/`) — feature 001-admin-auth-users
- Angular 18, TypeScript 5.4+ (same strictness profile)
- Standalone components only — no NgModules in new code
- Signals over RxJS for state
- New control flow `@if` / `@for (... ; track ...)` / `@switch` / `@defer`
- `inject()` DI (no constructor DI)
- Reactive Forms with typed controls
- Angular Material 18 + `@angular/cdk` (one UI library, repo-wide)
- `@angular/localize` (Arabic primary, English secondary)
- No constitutional testing requirements (Principle XXVII placeholder post-v1.2.0).

### Infrastructure
- PostgreSQL 16 (Prisma migrations only — `db push` forbidden in prod)
- Redis 7 (rate limit, lockout sliding-window counters, future HMAC nonces)
- S3-compatible object storage (future feature)
- Docker multi-stage builds, non-root user

## Project Structure

```text
masrafy01/
├── backend/                # NestJS service
│   ├── src/
│   │   ├── auth/           # login, JWT, refresh, logout, me, password
│   │   ├── users/          # admin-users CRUD
│   │   ├── audit/          # AuditEvent writer + queries
│   │   ├── common/         # filters, guards, decorators, error codes, pagination, pino config
│   │   ├── infra/          # PrismaService, RedisService, HibpClient, env schema
│   │   ├── health/         # /health/live, /health/ready
│   │   └── main.ts
│   ├── prisma/             # schema.prisma, migrations/, seed.ts (idempotent)
│   └── test/               # unit / integration / e2e
├── admin/                  # Angular dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/       # AuthService, ErrorCodeService, interceptors, guards
│   │   │   ├── features/   # auth/, users/, shell/
│   │   │   └── app.routes.ts
│   │   ├── i18n/           # messages.{ar-EG,en-US}.xlf, error-codes.{ar-EG,en-US}.json
│   │   └── styles/         # _tokens.scss (#06152D base), _material-theme.scss
│   └── tests/              # unit (Vitest) / e2e (Playwright + axe-core)
├── docker/                 # compose.dev.yml, compose.test.yml
├── specs/001-admin-auth-users/   # spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md
└── .specify/               # constitution, scripts, templates
```

## Commands (development)

```bash
# Bring up infra
docker compose -f docker/compose.dev.yml up -d postgres redis

# Backend
cd backend
nvm use
npm install
npx prisma migrate dev
npx prisma db seed                  # idempotent super_admin
npm run start:dev                   # http://localhost:3000

# Admin
cd admin
npm install
npm start                           # http://localhost:4200
```

## Constitution Principles — Daily Rules

Tags map to constitution sections. Cite principle # to block PRs.

### Cross-Platform (NON-NEGOTIABLE)
- **I — Money is Decimal**: `Decimal` types only; floats forbidden. `BankOffer` immutable post-creation.
- **II — Banks Are Data**: no `if (programId === ...)` branches; tier resolution generic.
- **III — Typed Errors**: API returns `{ success: false, code: "CODE", meta? }`; no English to clients. Same-PR rule: backend `error-codes.ts` + Angular `error-codes.{ar-EG,en-US}.json` + Flutter ARB.
- **IV — Arabic-First**: all user text via `@angular/localize`; logical CSS only (`margin-inline-start`, never `margin-left`); test LTR + RTL on UI PRs.
- **V — Matching Engine Is IP**: pure module, ≥ 90% test coverage, weight changes need PR review.
- **VI — PII Protection**: encrypt at rest; logs never carry PII; documents in S3 with presigned URLs; audit log append-only.
- **VII — Observability**: `X-Correlation-Id` everywhere; `/health/live` + `/health/ready`; structured JSON logs (Pino); discrete business events.
- **VIII — Brand**: `#06152D` deep navy primary. Use tokens, never raw hex.

### Backend
- **IX — Feature Modules**: organize by domain (`auth/`, `users/`, etc.). `common/` MUST NOT import from features.
- **X — Repository Pattern**: services NEVER touch Prisma directly. Use `*.repository.ts`.
- **XI — Prisma Migrate Only**: `db push` forbidden in prod. Named migrations; indexes on FKs + hot WHERE/ORDER BY.
- **XII — DTO vs Entity**: `class-validator` DTOs; Prisma types stay in repositories. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- **XIII — Dual Auth**: Mobile API HMAC; Admin JWT (15 min access + 7-day refresh httpOnly cookie); bcrypt cost ≥ 12 with `select: false`.
- **XIV — API Contract**: envelope `{ success, data, pagination? }`; versioned (`/api/v1/`, `/api/admin/`); OpenAPI at `/api/docs`.
- **XV — Rate Limiting**: `@nestjs/throttler` with Redis backing.
- **XVI — Placeholder**: no constitutional testing requirements (v1.2.0).

### Angular
- **XVII — Standalone Only**: no `NgModule` in new code.
- **XVIII — Signals**: `BehaviorSubject` for component state = review block.
- **XIX — New Control Flow**: `@if`/`@for ... track`/`@switch`/`@defer`; old `*ng*` directives = review block.
- **XX — `inject()`**: constructor DI = review block.
- **XXI — No `any`**: use `unknown` + narrowing.
- **XXII — Typed Reactive Forms**: template-driven forms = review block.
- **XXIII — UI UX Pro Max Skill**: invoke `ui-ux-pro-max` skill before every new dashboard screen.
- **XXIV — Design Tokens**: theme in CSS custom props; raw hex / raw pixel values outside `_tokens.scss` = review block.
- **XXV — Lazy + Functional Guards**: `canActivateFn`/`canMatchFn` only.
- **XXVI — HTTP Discipline**: `HttpClient` only (no `fetch()`); interceptors for auth / error / correlation / toast.
- **XXVII — Placeholder**: no constitutional testing requirements (v1.2.0).

### Flutter (Phase 2, skeleton binding now)
- **XXVIII — Clean Architecture + Cubit/Freezed**: data/domain/presentation per feature; HMAC secret only in `flutter_secure_storage`; `auto_route` v9+; design tokens in `MasrafyColorTheme` (`#06152D`).

## Anti-Patterns (Binding — see constitution Appendix)

- **A1** Hardcoded bank logic
- **A2** English errors to clients
- **A3** Float for money
- **A4** PII in logs
- **A5** Direct Prisma in services
- **A6** Mutable BankOffer after match
- **A7** Schema via `db push`
- **A8** Leaking Prisma types through controllers
- **A9** Skipping HMAC in mobile tests
- **A10** NgModules in new Angular code
- **A11** `BehaviorSubject` for component state
- **A12** Old `*ng*` control flow
- **A13** Missing `track` in `@for`
- **A14** Constructor DI in Angular
- **A15** `any` type
- **A16** Template-driven forms
- **A17** Ignoring `ui-ux-pro-max` output
- **A18** Raw hex outside theme
- **A19** `margin-left`/`-right` in stylesheets
- **A20** Hardcoded user-visible strings
- **A21** Manual `fetch()` in Angular
- **A22** Per-component error message mapping
- **A23** HMAC secret outside secure storage
- **A24** Approval probability without documented weights

## Recent Changes

- **2026-05-12** — Constitution v1.2.0: all testing requirements removed from Principles XVI + XXVII. No constitutional testing gates (unit, integration, or E2E). Features choose their own strategy.
- **2026-05-12** — Constitution v1.1.0 (superseded): dropped unit + integration testing requirements; kept E2E + a11y.
- **2026-05-12** — Feature 001-admin-auth-users: spec, plan, research, data model, OpenAPI contract, error-code contract, quickstart all generated. Stack pinned: NestJS 10 + Prisma 5 + Postgres 16 + Redis 7 backend; Angular 18 + Material 18 + Playwright + axe-core admin. JWT (15 min) + refresh-token cookie (7 days, SHA-256 hashed at rest); bcrypt 12; NIST-style password policy (HIBP k-anonymity + top-10k deny list, fail-closed); sliding-window lockout in Redis; SERIALIZABLE super_admin floor guard; WCAG 2.2 AA gate.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
