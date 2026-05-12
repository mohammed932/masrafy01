<!--
SYNC IMPACT REPORT
==================
Version Change: TEMPLATE → 1.0.0 → 1.1.0 → 1.2.0
Ratification: 2026-05-12 (initial ratification)
Last Amended: 2026-05-12 (v1.2.0)

v1.2.0 amendment (2026-05-12):
  Further scope reduction. Principles XVI (Backend Testing Requirements)
  and XXVII (Frontend Testing Requirements) reduced to placeholders.
  Unit testing, integration testing, and E2E testing are NO LONGER
  constitutional gates of any kind. Accessibility scan (axe-core)
  retained as an OPTIONAL recommendation, not a gate. Features MAY adopt
  any testing strategy they prefer. Rationale: explicit team direction.
  Numbered as MINOR because the principle slots are retained for future
  use; full removal would be MAJOR and the v2.0 slot is reserved for
  Flutter Phase 2 ratification.

v1.1.0 amendment (2026-05-12):
  Scope reduction on Principles XVI and XXVII. Unit + integration
  testing dropped from constitutional gates; E2E + a11y retained.
  Superseded by v1.2.0.

Rationale:
  Initial ratification of the Masrafy (internally "Credit Match") constitution
  as a single document governing three codebases as one coherent system:
    - NestJS backend (active)
    - Angular admin dashboard (active)
    - Flutter mobile app (architectural skeleton binding now; UI principles deferred)
  Establishes financial-data integrity, data-driven bank programs, typed
  errors end-to-end, Arabic-first i18n, the matching engine as core IP,
  PII protection, observability, and brand identity (#06152D) as
  cross-platform NON-NEGOTIABLE foundations.

Principles Added (I–XXVIII):
  I.    Financial Data Integrity is Sacred (All Platforms)
  II.   Bank Programs Are Data, Not Code (Backend + Admin)
  III.  Typed Errors End-to-End (All Platforms)
  IV.   Arabic-First Internationalization (Frontend Platforms)
  V.    The Matching Engine is the Core IP (Backend)
  VI.   PII Protection & Compliance (All Platforms)
  VII.  Observability is Built-In (Backend + Mobile)
  VIII. Brand Identity & Visual Consistency (Frontend Platforms)
  IX.   Feature Module Architecture (Backend)
  X.    Repository Pattern Mandatory (Backend)
  XI.   Prisma Migration Discipline (Backend)
  XII.  DTO vs Entity Separation (Backend)
  XIII. Dual Authentication, No Compromise (Backend)
  XIV.  API Contract Standards (Backend)
  XV.   Rate Limiting & Abuse Protection (Backend)
  XVI.  Backend Testing Requirements (Backend)
  XVII. Standalone Components Only — No NgModules (Angular)
  XVIII.Signals Over RxJS for State (Angular)
  XIX.  New Control Flow Required (Angular)
  XX.   inject() Function, Not Constructor DI (Angular)
  XXI.  Strict TypeScript, No `any` (Angular)
  XXII. Typed Reactive Forms (Angular)
  XXIII.UI UX Pro Max Skill is the Design Authority (Angular)
  XXIV. Design Tokens — #06152D Base (Angular)
  XXV.  Lazy-Loaded Routes + Functional Guards (Angular)
  XXVI. HTTP Layer Discipline (Angular)
  XXVII.Frontend Testing Requirements (Angular)
  XXVIII.Flutter Architectural Foundations (Binding Now)

Reserved (post-Figma, planned v2.0):
  XXIX–XXXVI — Detailed Flutter UI principles (screen patterns, shimmer
  loading, widget reuse, cross-feature promotion, edit flow routing,
  package reuse, anti-patterns). Reserved today; ratified once Figma
  designs are delivered.

Locations Affected:
  - .specify/memory/constitution.md (this file) — replaces template
  - Backend repo: feature module layout, error code constants, HMAC
    middleware, Prisma schema discipline, OpenAPI publication
  - Angular repo: standalone bootstrap, Signals state, new control flow,
    inject() DI, typed Reactive Forms, design tokens (#06152D), i18n,
    UI UX Pro Max skill invocation, HTTP interceptors
  - Flutter repo (future): Clean Architecture, Cubit+Freezed, per-flow
    page library pattern, get_it+injectable, Dio HMAC interceptor,
    auto_route, secure storage of HMAC secret, three flavors,
    MasrafyColorTheme (#06152D), Figma-traceable screens

Templates / Artifacts Requiring Updates:
  - PR template: add principle-citation checklist (cite principle # to block)
  - Backend errorCodes.ts: keep in sync with Angular i18n + Flutter ARB
  - Angular README: document chosen UI library (Principle XXIV)
  - Flutter README (future): document flavors, DI, theme tokens

v2.0 Planned (Post-Figma):
  - Ratify Principles XXIX–XXXVI (Flutter UI)
  - Extend Anti-Patterns Appendix with Flutter-specific blocks
  - Update Technical Constraints with finalized Flutter SDK pin and
    package choices
-->

# Masrafy Constitution
<!-- Internally: Credit Match — Egyptian fintech loan marketplace -->

This constitution governs three codebases as ONE coherent system: the
NestJS backend, the Angular admin dashboard, and the Flutter mobile app.
The Flutter client is deferred until Figma is ready; its architectural
skeleton (Principle XXVIII) is binding TODAY because backend design must
support it now. Reviewers MUST cite principle numbers to block PRs across
any of the three codebases.

---

# Project Context

**Masrafy is** a loan comparison marketplace connecting Egyptian consumers
with 20+ bank loan programs (ABK Egypt and partner banks). Users complete
a 5-step wizard via the mobile app; the matching engine evaluates
eligibility against all bank programs and returns ranked offers with
installments, fees, approval probability, and document checklists. The
service is free for users; commissions are paid by banks per successful
loan (1–2% personal, 0.5–1% mortgage, flat fees for cards). The platform
NEVER charges users.

**Three product lines:** Personal loans (no down payment, mass market),
Car loans (20–30% down payment, premium tier above 4M EGP gets discounted
rates), Mortgages (20%+ down payment, multiple property types and
construction stages, highest revenue per deal).

**Five-step wizard:**
1. About You — employment type, age, monthly income, time in job, salary transfer status
2. About the Loan — purpose, amount, duration
3. Personal Loan Details (if personal) — existing liabilities for DBR
4. Mortgage Details (if mortgage) — property value, down payment, property type (apartment/twin house/villa), compound status, construction stage A/B/C
5. Car Loan Details (if car) — car value, down payment

**Engine outputs:** Minimum down payment, monthly installment (PMT
formula), Debt Burden Ratio (DBR ≤ 50%), maximum loan available, ranked
matched programs (by best rate default), required documents per program,
approval probability percentage.

**Critical domain reality:** Real Egyptian bank rates from a single bank
range 18.5% to 29% — a 10.5pp spread — depending on employment type
(salaried 24% vs self-employed 29%), corporate partnerships (Egypt Air
employees 18.5%, bankers 20%), salary transfer type (payroll vs Salary
Transfer Letter vs Income Transfer Letter vs none), salary category tier
(A/B/C company classification), loan size (above/below 1M EGP threshold),
credit score (I-Score affects buyout rates), profession (dedicated
programs for doctors, pharmacists, professors, military). Hidden rule:
programs priced at 26%+ waive admin fees. Picking the wrong program costs
users hundreds of thousands of EGP over the loan lifetime. The matching
engine is the platform's core IP and primary competitive moat.

**Brand:** Primary color **#06152D** (deep navy — conveys trust, stability,
banking professionalism). Used as the dominant brand color across admin
dashboard and mobile app. Secondary palette and accents derive from this
base per the UI UX Pro Max skill design system on web and Figma designs
on mobile.

---

# Three-Platform Scope

| Platform | Stack | Audience | Auth | Status |
|----------|-------|----------|------|--------|
| **Backend API** | NestJS + PostgreSQL + Prisma | Both clients | HMAC (mobile), JWT (admin) | 🟢 Active development |
| **Admin Dashboard** | Angular 18+ standalone + Signals | Internal staff (admin, viewer, super_admin) | JWT bearer | 🟢 Active development |
| **Mobile App** | Flutter + Clean Architecture | Egyptian end users | HMAC-signed requests | 🟡 Deferred — awaiting Figma |

The backend MUST be designed to serve the future Flutter client. Mobile
API endpoints (`/api/v1/*`) and HMAC authentication are built NOW even
though the Flutter client doesn't exist yet. The Postman collection serves
as the mobile API consumer until Flutter is ready. Detailed Flutter UI
principles are deferred to constitution amendment v2.0 post-Figma; the
Flutter architectural skeleton (Principle XXVIII) is binding TODAY.

---

# Core Cross-Platform Principles (NON-NEGOTIABLE unless stated)

## I. Financial Data Integrity is Sacred (All Platforms)
All monetary amounts use precise decimal types — NEVER floats. Backend
uses Prisma `Decimal`; Angular treats monetary values as strings until
display (using `Decimal.js` for client-side arithmetic if needed); Flutter
uses the `decimal` package, NEVER `double` for money. Currency is EGP
unless explicitly tagged. All financial calculations (PMT, DBR, interest,
fees) are pure deterministic functions with unit tests covering edge
cases. `BankOffer` records are IMMUTABLE once created — they snapshot
pricing at match time; if a `BankProgram` changes later, existing offers
do not. Banker's rounding for EGP whole units. Backend serializes decimals
as strings to prevent JS precision loss. Display formatting respects
locale ("100,000 ج.م" or "EGP 100,000").

## II. Bank Programs Are Data, Not Code (Backend + Admin)
`BankProgram` eligibility rules, tier maps, pricing tables, and document
requirements live in PostgreSQL (JSONB for genuinely flexible tier maps
where the structure varies per program). Adding a new bank program
requires ZERO code changes — only database inserts via the admin portal.
Tier resolution (rate by employment type, max loan by salary category,
rate by transfer type, max tenor by employment type, rate by I-Score) is
a generic engine reading program configuration — NEVER hardcoded switch
statements per bank. Activating/deactivating a program is a single
boolean toggle. Hardcoded bank-specific logic anywhere in the codebase =
review block.

## III. Typed Errors End-to-End (All Platforms)
Exceptions caught at the network/persistence boundary translate to typed
`Failure` subtypes on every layer. Backend error responses follow
`{ success: false, code: "ERROR_CODE", meta?: {...} }` — NEVER English
message strings to clients. Angular and Flutter both map error codes to
localized user messages via a single canonical helper
(`ErrorCodeService.toLocalizedMessage(code, meta)` in Angular;
`failure.userFacingMessage` extension in Flutter). Adding a new error
code requires same-PR updates to: backend `errorCodes.ts` constants,
Angular Arabic + English localization files, Flutter Arabic + English
ARB files. Error code naming: `DOMAIN_SPECIFIC_REASON` (e.g.,
`DBR_EXCEEDED`, `INCOME_TOO_LOW`, `HMAC_NONCE_REPLAYED`,
`BANK_PROGRAM_NOT_FOUND`, `NO_MATCHING_PROGRAMS`).

## IV. Arabic-First Internationalization (Frontend Platforms)
Primary language is Arabic; English is secondary. Both Angular and Flutter
support RTL natively, not retrofitted. All user-facing strings flow
through the i18n service — hardcoded text = review block. Angular uses
`@angular/localize` with build-time translation extraction; Flutter uses
`flutter_localizations` + ARB files. Angular layout uses logical CSS
properties (`margin-inline-start`, `padding-inline-end`) —
`margin-left`/`margin-right` in stylesheets = review block. Flutter uses
`EdgeInsetsDirectional`, `AlignmentDirectional`, `Directionality`.
Direction-aware icons (back arrows, chevrons) flip automatically. Test
both LTR and RTL on every PR with UI changes. Currency, date, and number
formatting respects Egyptian Arabic conventions.

## V. The Matching Engine is the Core IP (Backend)
Matching logic lives in a dedicated `matching/` feature module in the
backend with ZERO dependencies on the HTTP layer. Engine signature:
`match(applicationProfile, programs[]) → MatchResult[]`. Every match
decision returns `passedChecks[]` AND `failedChecks[]` arrays. Approval
probability is calculable via rule-based scoring with documented weights —
the algorithm is a first-class business artifact, version-controlled,
weight changes require PR review and historical impact analysis. Unit test
coverage MUST be ≥ 90%. Match reasons surface as error codes across the
API boundary — NEVER English text. The matching service is a pure
dependency-free TypeScript service that can run in isolation against
in-memory bank program fixtures.

## VI. PII Protection & Compliance (All Platforms)
National IDs, salary slips, bank statements, and any PII-containing
documents MUST be encrypted at rest (Postgres column-level encryption for
structured PII; S3 SSE for documents). Uploaded documents go to
S3-compatible object storage with presigned short-expiry URLs — NEVER
PostgreSQL BLOB columns. Logs MUST NEVER contain PII (correlation IDs
only — sanitize at the logger level). Browser console logs in Angular and
device logs in Flutter also MUST NOT contain PII. Application status
transitions are append-only (state machine log table, not status column
overwrites). Bank commission tracking is auditable end-to-end. Egyptian
data protection compliance: user data deletion requests are supported
end-to-end. Guest users complete matching without persistent account
creation. Angular displays National IDs masked by default (last 4 digits
visible) with an explicit "Reveal" action that logs an audit event.

## VII. Observability is Built-In (Backend + Mobile)
Every HTTP request gets a correlation ID (`X-Correlation-Id` header in/out)
propagated through logs. Backend exposes `/health/live` and `/health/ready`
(ready includes DB connectivity check + Redis ping). Structured JSON logs
in production via Pino. Critical business events logged as discrete
events: `application.created`, `application.matched`, `offer.selected`,
`document.uploaded`, `loan.submitted`, `loan.approved`, `loan.rejected`,
`commission.recorded`. Metrics endpoint exposes matching engine performance
(p50/p95/p99 latency) and DB pool stats. Mobile crashes report to
Sentry/Crashlytics with sanitized context (NO PII).

## VIII. Brand Identity & Visual Consistency (Frontend Platforms)
Primary brand color is **#06152D** (deep navy) — applied as the dominant
color across all surfaces: app bars, primary buttons, headers, brand
marks, focus accents. Secondary colors, semantic colors
(success/warning/error/info), spacing scale, and typography scale are
defined ONCE per platform in theme tokens and consumed everywhere through
the design token API. NO raw hex outside theme files. NO inline pixel
values for spacing/sizing — use the scale. Logos, illustrations, and SVG
fills pull from theme tokens, not baked-in colors. The brand visual
system is shared in concept (deep navy primary, trust-conveying density,
geometric/clean aesthetic, Arabic-first layout) but each platform
implements via its own theming primitives.

---

# Backend Principles (NestJS + PostgreSQL)

## IX. Feature Module Architecture
Organize by domain feature, not technical layer. Required modules:
- `auth/` — admin login, JWT issuance, HMAC verification middleware
- `users/` — registered user accounts
- `banks/` — BankProgram CRUD, eligibility config, pricing tiers
- `applications/` — user loan applications, wizard data capture
- `matching/` — eligibility engine, tier resolver, PMT/DBR calculators, approval probability
- `offers/` — BankOffer creation and retrieval
- `loans/` — post-selection loan tracking, status workflow, commission recording
- `documents/` — file upload metadata, S3 presigned URL generation, document type validation
- `options/` — dynamic form metadata for mobile wizard (employment types with `revealFields`, salary categories, professor ranks, military grades, priorities, tenor buckets, property types, construction stages)
- `health/` — liveness/readiness probes
- `common/` — cross-cutting concerns (filters, guards, decorators, pipes) — MUST NOT import from feature modules

Each module exports ONE `*.module.ts` and only exports what other modules
genuinely need. Circular dependencies = review block. `forwardRef()`
requires written justification in PR description.

## X. Repository Pattern Mandatory
Services NEVER call Prisma client directly — they call a
`*.repository.ts` per feature. Repositories encapsulate persistence,
transactions, and ORM-specific logic. Enables mocking in unit tests and
persistence swaps. Repository methods return domain types — NEVER raw
Prisma types past the repository boundary. Multi-step writes wrap in
transactions inside the repository, not in the service.

## XI. Prisma Migration Discipline
All schema changes go through `prisma migrate`. `prisma db push` is
FORBIDDEN in production. Migrations named descriptively
(`add_bank_program_compound_field`), kept small and reversible. Primary
keys are `cuid()` or UUID v4. All timestamp columns are `TIMESTAMPTZ`
with `@default(now())` where appropriate. All foreign keys have indexes.
Columns used in WHERE/ORDER BY on hot paths have indexes (matching engine
queries against `BankProgram.isActive`, eligibility fields). JSONB columns
permitted ONLY for genuinely flexible tier maps — NEVER as
schema-avoidance dumping ground.

## XII. DTO vs Entity Separation
HTTP DTOs are request/response classes with `class-validator` decorators
in `*.dto.ts` files — NEVER the same as Prisma types. Global
`ValidationPipe` enabled with `whitelist: true` and
`forbidNonWhitelisted: true`. Prisma-generated types stay inside
repositories. Domain types (when needed) live in `domain/` subfolders
separate from DTOs. Leaking Prisma types through controllers = review
block.

## XIII. Dual Authentication, No Compromise
Mobile API (`/api/v1/*`) requires HMAC-SHA256 signing in production with
three headers: `X-App-Signature`, `X-Timestamp`, `X-Nonce`. Timestamp
drift tolerance ±5 minutes. Nonce cache in Redis prevents replay attacks
within window (TTL = 5 minutes). HMAC verification uses constant-time
comparison. Admin API (`/api/admin/*`) uses JWT: 15-minute access token +
7-day refresh token (httpOnly secure cookie). Admin passwords hashed with
bcrypt cost ≥ 12, `select: false` in Prisma schema so they're never
returned in queries. Skipping HMAC outside development = review block.
Failed login attempts trigger progressive lockout.

## XIV. API Contract Standards
All HTTP endpoints use typed DTO classes. All responses follow envelope:
`{ success: true, data: ... }` or
`{ success: true, data: [...], pagination: {...} }` or
`{ success: false, code, meta? }`. All endpoints versioned (`/api/v1/`).
All list endpoints support pagination (cursor for large/unstable lists,
offset for admin lists — document choice per endpoint). OpenAPI/Swagger
docs generated via `@nestjs/swagger` and published at `/api/docs` (dev)
or restricted in production. Breaking changes require a new version path.
Mobile API and admin API are documented separately in OpenAPI.

## XV. Rate Limiting & Abuse Protection
Mobile API: 100 requests / 15 minutes global. Profile/wizard endpoints:
10 requests / 1 minute. Apply endpoint: 5 requests / 1 minute. Auth
endpoints: 5 requests / 15 minutes. Use `@nestjs/throttler` with Redis
backing for distributed deployments. Failed login attempts trigger
progressive lockout. All limits documented in API reference and tested.

## XVI. Backend Testing Requirements
**(v1.2.0: testing requirements removed from the constitution.)**

No backend testing — unit, integration, or E2E — is constitutionally
required. Features choose their own testing strategy. The matching
engine's correctness invariants remain governed by Principle V (rule
weight changes require PR review and historical impact analysis), but
test artifacts to enforce those invariants are NOT mandated here.

The principle slot is retained for future re-introduction if the team
chooses to reinstate testing gates.

---

# Angular Admin Dashboard Principles

## XVII. Standalone Components Only — No NgModules
Every component, directive, and pipe is `standalone: true`. NgModules
FORBIDDEN except for unavoidable third-party library interop, documented
in PR description. Bootstrapping uses `bootstrapApplication()`. Route
configuration uses standalone route arrays with `loadComponent` and
`loadChildren` for lazy loading.

## XVIII. Signals Over RxJS for State
Component state and computed derivations use Angular Signals (`signal()`,
`computed()`, `effect()`). RxJS Observables reserved for genuine streams:
HTTP responses, WebSockets, debounced inputs. Wrap HTTP results in
`toSignal()` when stored on the component. `BehaviorSubject` for
component state = review block (use `signal()`). Global state in
injectable services exposing signals via getter methods, not raw fields.

## XIX. New Control Flow Required
Templates use `@if`, `@for`, `@switch`, `@defer` — NOT `*ngIf`, `*ngFor`,
`*ngSwitch`. Structural directives = review block (except third-party
components requiring them). `@for` blocks MUST include `track` expression.
Use `@defer` for below-the-fold sections and heavy components (charts,
large data tables) to improve initial load.

## XX. inject() Function, Not Constructor DI
All dependencies injected via `inject(ServiceName)` at class field level.
Constructor injection FORBIDDEN. Custom inject tokens use
`InjectionToken<T>` with `providedIn: 'root'` factory defaults. This
enables cleaner inheritance, easier testing, and aligns with functional
patterns.

## XXI. Strict TypeScript, No `any`
`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`,
`noUncheckedIndexedAccess: true`. The `any` type is FORBIDDEN — use
`unknown` with type narrowing instead. Implicit returns banned. Function
parameter and return types explicit on public APIs. Type assertions
(`as Foo`) require comment justification.

## XXII. Typed Reactive Forms
All forms use Reactive Forms with typed `FormControl<T>` /
`FormGroup<T>` / `FormArray<T>`. Template-driven forms FORBIDDEN. Form
value types align with backend DTOs (generate types from OpenAPI when
feasible — pin the OpenAPI generator config and check in generated
types). Form validation messages flow through i18n. Custom validators are
pure functions, unit tested. Submit button disabled until form valid AND
dirty AND not currently submitting.

## XXIII. UI UX Pro Max Skill is the Design Authority
The `ui-ux-pro-max` skill installed globally is the AUTHORITATIVE design
system reference for the admin dashboard. Before designing any new screen,
component, or visual pattern, invoke the skill to obtain layout guidance,
component composition, spacing scale, and interaction patterns. Designs
that contradict skill output require written justification in PR
description. The skill governs: dashboard layouts (sidebars, top bars,
cards), data table presentation, form layouts, modal patterns, empty
states, loading states, chart styling, navigation patterns, and admin UI
conventions. Combine skill guidance with brand color #06152D and the
Masrafy domain (bank program management, application review, offer
matching, document review, commission tracking).

## XXIV. Design Tokens — #06152D Base
Define full theme in CSS custom properties under `:root`:
- `--color-brand-primary: #06152D`
- `--color-brand-primary-hover`, `--color-brand-primary-active` (derived shades)
- `--color-surface-default`, `--color-surface-elevated`, `--color-surface-muted`
- `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled`, `--color-text-on-brand`
- `--color-border-default`, `--color-border-strong`
- `--color-success`, `--color-warning`, `--color-error`, `--color-info` (semantic colors)
- Spacing scale `--space-1` to `--space-12` (4px base — 4, 8, 12, 16, 24, 32, 48, 64, 96, 128)
- Type scale `--text-xs` to `--text-3xl`
- Radius scale `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (16px)
- Shadow scale `--shadow-sm`, `--shadow-md`, `--shadow-lg`

Raw hex values, raw pixel values, or hardcoded font sizes outside the
theme file = review block. Components consume tokens via CSS custom
properties. Pick ONE UI library project-wide (Angular Material, PrimeNG,
or Tailwind + headless components) and document the choice in README;
mixing UI libraries = review block.

## XXV. Lazy-Loaded Routes + Functional Guards
Every admin section lazy-loaded via `loadChildren` or `loadComponent`.
Route guards are FUNCTIONAL (`canActivateFn`, `canMatchFn`), not
class-based. Auth guard reads JWT validity and role permissions from a
signal-backed auth service. Unauthorized navigation redirects to login
with intent preserved (return URL after login). Heavy widgets inside lazy
sections use `@defer` for further granularity.

## XXVI. HTTP Layer Discipline
HTTP communication goes through a typed API client (preferably generated
from OpenAPI). HTTP interceptors:
- **Auth interceptor**: attaches `Authorization: Bearer <accessToken>` from auth service
- **Error interceptor**: handles 401 with refresh-token flow, retries the original request once with the new token; on refresh failure, redirects to login
- **Correlation interceptor**: attaches `X-Correlation-Id` for log tracing
- **Toast interceptor**: emits localized toasts on standardized error codes via the central error-to-message helper

Manual `fetch()` calls FORBIDDEN. Always use `HttpClient`.

## XXVII. Frontend Testing Requirements
**(v1.2.0: testing requirements removed from the constitution.)**

No frontend testing — unit, component, or E2E — is constitutionally
required. Features choose their own testing strategy. Accessibility
work remains governed by Principles IV (RTL + i18n) and the AA contrast
targets implicit in Principle XXIV's token scale, but automated axe-core
scanning is NOT mandated here.

The principle slot is retained for future re-introduction if the team
chooses to reinstate testing gates.

---

# Mobile App Structure (Flutter) — Phase 2 Skeleton

**Note:** Detailed UI principles are deferred to constitution amendment
v2.0 once Figma designs are finalized. The architectural commitments
below are BINDING NOW because backend design today must support them.
Reserved principle numbers XXIX through XXXVI for full Flutter principles
in v2.0.

## XXVIII. Flutter Architectural Foundations (Binding Now)
When the Flutter project starts, it MUST use:
- **Three-Layer Clean Architecture per feature**: `data/` (datasource, models, repository impl) | `domain/` (entities, repository abstract, usecase) | `presentation/` (cubit, pages, widgets). Class suffixes: `Model` (response), `Request` (payload), `Entity` (domain) — non-negotiable.
- **State management**: Cubit + Freezed. One Cubit per screen. Pure data logic (validators, request builders, derived flags) lives on the state class.
- **Per-Flow Page Library Pattern**: `presentation/pages/` and `presentation/pages/widgets/` use `<feature>_pages.imports.dart` library with `part` directives — zero imports inside page/widget files.
- **DI**: `get_it` + `injectable` code-generated via `build_runner`.
- **Network**: Dio with HMAC-signing interceptor reading secret from `flutter_secure_storage`. HMAC secret NEVER in code, assets, environment files, or `shared_preferences`.
- **Routing**: `auto_route` v9+.
- **Persistence**: `shared_preferences` (non-sensitive), `flutter_secure_storage` (HMAC secret, tokens). Keys in `StorageKeys` enum.
- **Three flavors**: `main_dev.dart`, `main_staging.dart`, `main_prod.dart` — each loads a distinct `BaseEnvironment`. `AppEnv` registered as singleton.
- **Typed payloads end-to-end**: Request DTOs are typed Dart classes — never `Map<String, dynamic>` past the datasource. Domain entities typed — never `dynamic` past the repository. Enums for finite states.
- **Typed errors**: Exceptions at boundary → `Failure` subtypes (`ServerFailure`, `NetworkFailure`, `ValidationFailure`, `EligibilityFailure`, `DbrExceededFailure`). Repository wraps datasource call with single error-translation helper (`ApiHandler.callApi`). `Either<Failure, T>` flows up; UI consumes `failure.userFacingMessage`.
- **Design tokens**: Brand primary `#06152D` lives in `MasrafyColorTheme` — every surface using it reads via `MasrafyColorTheme.of(context).brandPrimary`. NO raw hex outside `lib/core/theme/`. Text via `MasrafyTextTheme.of(context)`. Sizes via `.w`/`.h`/`.sp`.
- **RTL native, not retrofitted**: All layouts use `EdgeInsetsDirectional`, `AlignmentDirectional`, `Directionality`. Test app in Arabic AND English on every PR.
- **Figma is the visual source of truth**: Every screen traces to a Figma frame. Implementing screens not yet in Figma = review block.

These commitments shape backend API design today. Reserved principle
numbers XXIX–XXXVI for detailed Flutter rules in v2.0 (covering screen
patterns, shimmer loading, widget reuse, cross-feature promotion, edit
flow routing, package reuse, anti-patterns).

---

# Technical Constraints

## Backend
- Node.js LTS via `.nvmrc`, invoked through `nvm use`
- PostgreSQL 16+ with PgBouncer or managed pooler
- Prisma 5+ with migrations checked in
- `@nestjs/config` with Zod-validated env schema, fail-fast at boot
- Pino-compatible structured logging
- Docker multi-stage build, non-root user, slim runtime image
- Redis for rate limiting and HMAC nonce cache
- S3-compatible object storage (AWS S3, Cloudflare R2, or MinIO) for documents
- ESLint + Prettier with shared config; `tsc --noEmit` in CI

## Angular
- Angular 18+ via `.nvmrc`
- TypeScript strict mode mandatory
- ESLint (with `@angular-eslint`) + Prettier with shared config
- Build target: `esbuild` (default in v17+)
- One UI library project-wide — document choice in README
- `@angular/localize` for i18n with build-time translation extraction
- Reactive Forms only
- Jest for unit, Cypress or Playwright for E2E

## Flutter (Reserved)
- Flutter SDK pinned via `.fvmrc`, invoked through `fvm flutter`
- Detailed constraints in amendment v2.0 post-Figma

---

# Development Workflow & Quality Gates

- Every PR: lint clean, generated code committed (Prisma client for backend, Angular build artifacts as needed, `build_runner` output for Flutter), screenshots for UI changes (LTR + RTL for Angular; Arabic + English for Flutter), all spec acceptance criteria checked off
- No constitutional testing gates (Principles XVI + XXVII placeholders post-v1.2.0). Features choose their own testing strategy.
- Forbidden identifiers across all platforms: `data`, `info`, `result`, `value`, `item`, `obj`, `temp`, `tmp`, `foo`, `bar`, single letters outside `i`/`j`/`k`/`e`/`err`/`_`
- Forbidden suffixes inside feature modules: `…Handler`, `…Manager`, `…Util`, `…Helper` (services in NestJS are OK, but business-named — e.g., `MatchingEngineService`, not `MatchHelper`)
- Booleans read as questions: `isLoading`, `hasError`, `canSubmit`, `shouldRefresh`, `wasCancelled`, `didFinish`
- Effect functions verb-first (`loadX`, `submitForm`); pure reads via getter
- Canonical vocabulary: `load` (fetch+emit), `refresh` (re-run same load), `submit` (send user input), `updateField` (single-field mutation), `change<X>` (filter switch), `select<X>(id)`

---

# Anti-Patterns Appendix (Binding)

## A1. Hardcoded Bank Logic (Principle II)
`if (programId === 'ABK-01')` or any bank-specific branch in code = review block.

## A2. English Error Messages to Clients (Principle III)
`throw new Error('Income too low')` or `{ message: 'Invalid token' }` = review block. Only error codes cross API boundary.

## A3. Float for Money (Principle I)
Prisma `Float`/`@db.Real`, JavaScript `parseFloat()` for monetary values, Dart `double` for money = review block. Use `Decimal` types.

## A4. PII in Logs (Principle VI)
Logging full application body, salary tied to user identifier, or document contents (backend, Angular console, or Flutter device logs) = review block.

## A5. Direct Prisma in Services (Principle X)
Services calling `prisma.bankProgram.findMany()` directly bypassing the repository = review block.

## A6. Mutable BankOffer After Match (Principle I)
Updating `BankOffer` fields after creation = review block. Create a new offer instead.

## A7. Schema Changes via db push (Principle XI)
Modifying `schema.prisma` and using `db push` to apply = review block. Always `migrate dev`.

## A8. Leaking Prisma Types Through Controllers (Principle XII)
Controller returning `Prisma.BankProgramGetPayload<...>` = review block. Map to DTO.

## A9. Skipping HMAC in Mobile Tests (Principle XIII)
Mobile API integration tests bypassing HMAC = review block.

## A10. NgModules in New Angular Code (Principle XVII)
Any new `*.module.ts` in Angular code outside third-party interop = review block.

## A11. BehaviorSubject for Component State (Principle XVIII)
Using `BehaviorSubject` where `signal()` would work = review block.

## A12. Old Control Flow Syntax (Principle XIX)
`*ngIf`, `*ngFor`, `*ngSwitch` in new templates = review block.

## A13. Missing `track` in @for (Principle XIX)
`@for (item of items)` without `track` clause = review block.

## A14. Constructor DI in Angular (Principle XX)
`constructor(private foo: FooService)` = review block. Use `private foo = inject(FooService)`.

## A15. `any` Type (Principle XXI)
Any use of `any` (explicit or implicit) in Angular = review block. Use `unknown` with narrowing.

## A16. Template-Driven Forms (Principle XXII)
`ngModel` for new forms = review block. Use Reactive Forms with typed controls.

## A17. Ignoring UI UX Pro Max Output (Principle XXIII)
Building a new dashboard screen without invoking the `ui-ux-pro-max` skill, or deviating without written justification = review block.

## A18. Raw Hex Colors Outside Theme (Principle XXIV)
`color: #ffffff` or `background: #06152D` in any component stylesheet = review block. Use `var(--color-*)`.

## A19. margin-left/margin-right in Angular Stylesheets (Principle IV)
Any directional CSS property that doesn't respect RTL = review block. Use `margin-inline-start`, etc.

## A20. Hardcoded User-Visible Strings (Principle IV)
Any user-visible text not flowing through i18n (Angular `$localize` or Flutter ARB) = review block.

## A21. Manual fetch() in Angular (Principle XXVI)
Bypassing `HttpClient` with `fetch()` = review block.

## A22. Per-Component Error Message Mapping (Principle III)
Local `mapErrorToMessage` helper in components or services other than the central `ErrorCodeService` = review block.

## A23. HMAC Secret Outside Secure Storage (Principle XXVIII)
HMAC secret in code, asset files, environment files, or `shared_preferences` = review block. Only `flutter_secure_storage`.

## A24. Approval Probability Without Documented Weights (Principle V)
Changing approval probability scoring without recording weight changes in the PR description with historical-impact analysis = review block. (Test artifacts not mandated post-v1.2.0; PR description carries the rationale.)

---

# Governance

- Version SemVer. MAJOR = breaking principle removal/redefinition. MINOR = new principle or section (Flutter Phase 2 detailed principles = v2.0 minor). PATCH = clarification/anti-pattern addition.
- Every amendment carries a SYNC IMPACT REPORT comment block at the top of the file: version change, rationale, locations affected, templates requiring updates.
- Flutter amendment v2.0 is scheduled for ratification when Figma designs are delivered. Principle numbers XXIX–XXXVI are reserved.
- Brand color, primary stack, or any principle marked NON-NEGOTIABLE require explicit team sign-off recorded in the PR description.

---

**Version**: 1.2.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12
