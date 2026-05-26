# masrafy01 Development Guidelines

Auto-generated from feature plans + constitution. Last updated: 2026-05-25

## Project Identity

**Masrafy** (internally "Credit Match") — Egyptian fintech loan comparison marketplace. Connects users with 20+ bank loan programs (ABK Egypt + partners) via 5-step wizard + matching engine. Four product lines: personal loans, car loans, mortgages, business loans. Free for users; commission revenue from banks. Three platforms governed by a single constitution: NestJS backend (active), Angular admin dashboard (active), Flutter mobile app (deferred until Figma).

Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md) v1.7.0

**Product scope-lock (v1.7.0 / Principle II):** Platform supports exactly four retail loan categories — `personal`, `car`, `mortgage`, `business`. Removing a category requires a destructive migration that physically wipes registry entry, bank programs, and all applications + cascade (offers / decisions / activities / documents). Ghost / soft-deactivated rows = review block. Adding a fifth requires a constitution amendment (A26).

## Active Technologies
- Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ (same strictness profile) on admin. (002-bank-programs)
- PostgreSQL 16 (Prisma migrations only; `db push` forbidden in production); Redis 7 (rate-limit + future audit-event buffer; NOT used as primary store for bank programs). (002-bank-programs)
- Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ on admin. (003-matching-engine-post)

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
npm start                           # http://localhost:5173
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
- **XIII — Dual Auth**: Mobile API HMAC (anonymous reads); Admin JWT (15 min access + 7-day refresh httpOnly cookie); **Customer JWT (v1.7.0)** layered on HMAC for `/api/v1/auth/*` and authenticated mobile writes (15 min access + 30-day refresh, response-body strings — not cookies; separate signing keys `CUSTOMER_JWT_ACCESS_SECRET` / `CUSTOMER_JWT_REFRESH_SECRET`). bcrypt cost ≥ 12 with `select: false`.
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
- **XXIII — UI UX Skill Pipeline**: invoke `ui-ux-pro-max` (promax) BEFORE designing every new dashboard screen + invoke `impec` AFTER first implementation for polish/audit. Both mandatory.
- **XXIV — Design Tokens**: theme in CSS custom props; raw hex / raw pixel values outside `_tokens.scss` = review block.
- **XXV — Lazy + Functional Guards**: `canActivateFn`/`canMatchFn` only.
- **XXVI — HTTP Discipline**: `HttpClient` only (no `fetch()`); interceptors for auth / error / correlation / toast.
- **XXVII — Placeholder**: no constitutional testing requirements (v1.2.0).

### Flutter (Mobile — v1.8.0 ratified)

- **XXVIII — Clean Architecture + Cubit/Freezed (skeleton)**: data/domain/presentation per feature; HMAC secret only in `flutter_secure_storage`; `auto_route` v9+; design tokens in `MasrafyColorTheme` (`#06152D`).
- **XXX — Three-Layer Feature Architecture**: `mobile/lib/features/<name>/{data,domain,presentation}`. Models stay in data; entities returned by repositories; `Either<Failure, T>` from every repo method.
- **XXXI — Cubit + Freezed State Management**: one cubit per screen by default; multi-field forms use `updateField(FieldEnum, Object)` with exhaustive switch; cubits are orchestration-only (data logic on the Freezed state); cross-feature cubit sharing forbidden.
- **XXXII — Per-Flow Page Library Pattern**: `presentation/pages/<flow>/<flow>.imports.dart` owns flow's imports; screen files are `part of` it; flow-local widgets under `<flow>/widgets/`; feature-shared widgets under `pages/widgets/`; one widget per file.
- **XXXIII — Shared Widget Reuse**: `mobile/lib/core/widgets/<category>/` is the only home for cross-feature widgets; sheet/dialog/picker/app-bar surfaces extend their mandated base; naming `Masrafy[Action][ModalKind][Sheet|Dialog]`.
- **XXXIV — Shape-Matched Shimmer**: every async screen renders a shimmer skeleton mirroring the layout; centered spinner on first-load of content-bearing screens = review block; shimmer re-fires on every reload, not only first load.
- **XXXV — Cross-Feature Sub-Feature Reuse**: cubit + state + widgets shared across ≥2 features lives at `mobile/lib/core/features/<concern>/`; promote on second use; each consumer gets a fresh `getIt<>()` cubit.

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
- **A17** Skipping the UI UX skill pipeline (`ui-ux-pro-max` + `impec`)
- **A18** Raw hex outside theme
- **A19** `margin-left`/`-right` in stylesheets
- **A20** Hardcoded user-visible strings
- **A21** Manual `fetch()` in Angular
- **A22** Per-component error message mapping
- **A23** HMAC secret outside secure storage
- **A24** Approval probability without documented weights
- **A25** Half-updated dependents (cross-surface drift) — Principle XXIX
- **A26** Fifth retail loan category without amendment / ghost rows after removal (Principle II scope-lock, v1.5.0 → v1.6.0 → v1.7.0)
- **A27** Money / amount input without `MoneyInputDirective` (`appMoneyInput`)

## Recent Changes
- 2026-05-25 (v1.7.0): Constitution scope-lock widened to FOUR retail loan categories — added `business` alongside `personal`/`car`/`mortgage`. Principle XIII extended with customer-facing mobile auth (`/api/v1/auth/*` — customer JWT layered on HMAC, 15 min access + 30-day refresh, separate signing keys). A26 rewritten to bound at a FIFTH category. Mobile user-journey Phase 1 backend + admin alignment begins here (PRs #0–#7 per plan `this-is-the-gourney-frolicking-papert.md`).
- 003-matching-engine-post: Added Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ on admin.
- 002-bank-programs: Added Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ (same strictness profile) on admin.


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
