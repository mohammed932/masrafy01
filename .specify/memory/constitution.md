<!-- See `# Governance` section near the bottom for the binding version history table. -->


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

**Four product lines (NON-NEGOTIABLE — see Principle II scope-lock,
v1.5.0 → v1.7.0):** Personal loans (no down payment, mass market), Car
loans (20–30% down payment, premium tier above 4M EGP gets discounted
rates), Mortgages (20%+ down payment, multiple property types and
construction stages, highest revenue per deal), and Business loans
(SME / professional-use working-capital lending — larger ticket sizes,
separate underwriting, added in v1.7.0 to align the platform with the
mobile user-journey product surface). The platform supports EXACTLY
these four retail loan categories. The `loanPurpose`
platform-enumeration registry MUST contain only these four active
members (`personal`, `car`, `mortgage`, `business`). Any other
category is out of scope for v1.x and MUST be soft-deactivated rather
than introduced. Adding a fifth category requires a constitution
amendment.

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

**Brand:** Primary color **#0869c3** (azure blue — conveys trust, stability,
banking professionalism). Used as the dominant brand color across admin
dashboard and mobile app. Secondary palette and accents derive from this
base per the UI UX Pro Max skill design system on web and Figma designs
on mobile.

---

# Three-Platform Scope

| Platform | Stack | Audience | Auth | Status |
|----------|-------|----------|------|--------|
| **Backend API** | NestJS + PostgreSQL + Prisma | Both clients | JWT (mobile + admin, distinct signing keys) | 🟢 Active development |
| **Admin Dashboard** | Angular 18+ standalone + Signals | Internal staff (admin, viewer, super_admin) | JWT bearer | 🟢 Active development |
| **Mobile App** | Flutter + Clean Architecture | Egyptian end users | Customer JWT (access + refresh) | 🟡 Deferred — awaiting Figma |

The backend MUST be designed to serve the future Flutter client. Mobile
API endpoints (`/api/v1/*`) and customer JWT authentication are built NOW even
though the Flutter client doesn't exist yet. The Postman collection serves
as the mobile API consumer until Flutter is ready. Detailed Flutter UI
principles are deferred to constitution amendment v2.0 post-Figma; the
Flutter architectural skeleton (Principle XXVIII) is binding TODAY.

---

# Part I — Core Cross-Platform Principles (NON-NEGOTIABLE unless stated)

These principles apply to every platform (NestJS backend, Angular admin,
Flutter mobile). Violating one is a review block regardless of which
codebase the change lives in. Part II / III / IV below refine them with
platform-specific obligations.

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

**Scope-lock (v1.5.0, sharpened v1.6.0, widened v1.7.0):**
Bank-program data is unconstrained per bank, but the *set of loan
categories* the platform supports is fixed at exactly four:
`personal`, `car`, `mortgage`, `business`. The `loanPurpose`
platform-enumeration registry MUST contain only these four rows (no
soft-deactivated ghosts). Migrations, seed data, DTO enums, UI
multi-selects, and the matching engine MUST treat any other purpose
as nonexistent. **Physical removal is the standard** — when a
category leaves scope, ship a destructive migration that wipes the
registry entry, all bank programs in that category, and all
applications referencing it (with full FK cascade through offers,
decisions, activities, documents). Soft-deactivation (`deprecatedAt`)
is acceptable ONLY as a transitional step inside the same PR;
subsequent migrations within the PR must complete the wipe. Adding a
fifth retail category requires a constitution amendment — not a
migration shipped solo. See Anti-pattern A26.

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
`DBR_EXCEEDED`, `INCOME_TOO_LOW`, `REFRESH_TOKEN_REUSED`,
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
end-to-end. Profile photos and National ID images are PII documents:
stored in S3 with server-side encryption, served only via presigned
short-expiry URLs (admin read URLs re-issued on demand), never inlined
or logged. Angular displays National IDs masked by default (last 4 digits
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
Primary brand color is **#0869c3** (azure blue) — applied as the dominant
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

# Part II — Backend (NestJS + PostgreSQL)

The backend is the source of truth for money, identity, eligibility, and
audit. Code lives in `backend/src/` organized by feature module. The
backend obeys all Part I principles (typed errors, money-is-Decimal,
Arabic-first error copy, PII protection, observability) AND the
NestJS-specific principles below.

## IX. Feature Module Architecture
Organize by domain feature, not technical layer. Required modules:
- `auth/` — admin login, JWT issuance + refresh-token rotation
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
Two API surfaces. Both use JWT — no HMAC, no shared-secret signing,
no nonce cache. (HMAC was removed in v3.0.0; the mobile client and the
backend rely solely on customer JWT + refresh-token rotation.)

**Admin API (`/api/admin/*`)** uses JWT: 15-minute access token + 7-day
refresh token (httpOnly secure cookie). Admin passwords hashed with
bcrypt cost ≥ 12, `select: false` in Prisma schema so they're never
returned in queries. Failed login attempts trigger progressive lockout.

**Mobile API (`/api/v1/*`)** uses customer JWT: 15-minute access token +
30-day refresh token. Mobile clients receive both tokens as
response-body strings (NOT cookies — mobile clients lack the cookie
jar contract) and store them in `flutter_secure_storage`. Customer
JWT signing keys are separate from admin JWT signing keys (env:
`CUSTOMER_JWT_ACCESS_SECRET`, `CUSTOMER_JWT_REFRESH_SECRET`).
Customer passwords hashed with bcrypt cost ≥ 12 and `select: false`
like admin. Refresh-token rotation: each refresh issues a new access
+ refresh pair; the prior refresh token is invalidated server-side
(opaque-token registry keyed by `jti`). Stolen-token detection: reusing
an already-rotated refresh token revokes the entire session family.

Two registration paths, both creating the customer row **lite at
OTP/provider time and completing the profile afterward** via the
mandatory profile-completion step (see Principle XXXVII):
- **PHONE-signup:** mobile + OTP verified first → a lite customer row is
  created (`registrationPath = PHONE`, `mobileVerifiedAt` set) → the
  mandatory profile-completion step then collects firstName, lastName,
  birthday, profile photo, National ID front + back, and a password.
  `passwordHash` is non-null for PHONE.
- **SOCIAL sign-in (Google / Apple):** provider-token verification creates
  a lite customer row (`registrationPath = SOCIAL`, name seeded from the
  provider, `passwordHash = NULL`) → the same mandatory profile-completion
  step collects mobile + OTP, firstName, lastName, birthday, profile photo,
  and National ID front + back. SOCIAL customers never have a password and
  recover access via their provider.

There is **no "upfront full registration" and no "loan-request popup"**
model — profile completion is a first-class, post-OTP step gating the
whole authenticated surface, not a popup bolted onto apply. Every reachable
in-app feature (catalog, enumerations, questionnaire, matching, loan
request, account screens) requires a valid customer Bearer JWT — no
anonymous catalog access, no guest application flow, **no `Application.isGuest`,
no `mobileClientId`, no claim endpoint** (all removed from code as of
v4.0.0; they MUST NOT be reintroduced). Failed customer login attempts
trigger 30-minute account lockout after 10 failures within a 15-minute
window. Forgot-password is PHONE-only; SOCIAL customers recover via their
provider.

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

## NestJS Clean Code Structure (v2.0.0)

These are the binding craft rules for every backend file. They refine
Principles IX–XV without redefining them. Reviewers cite these when a
change drifts from the canonical NestJS pattern.

**File-naming + layout per feature module.** Every feature module follows
the same skeleton:

```text
backend/src/<feature>/
├── <feature>.module.ts                  // @Module — providers + controllers
├── <feature>.controller.ts              // HTTP surface — thin, no business logic
├── <feature>.service.ts                 // orchestration — no Prisma client
├── <feature>.repository.ts              // ONLY file that imports `@prisma/client`
├── dto/
│   ├── <name>.dto.ts                    // class-validator + @ApiProperty
│   └── <name>.response.dto.ts           // response shape
├── guards/                              // feature-local guards (e.g. ownership)
└── <optional sub-services>.service.ts   // domain helpers, NOT controllers
```

**Single-responsibility.** A controller answers HTTP, calls one service
method, returns the envelope. A service orchestrates the use case + emits
audit events. A repository touches Prisma. Crossing layers (controller →
Prisma, service → HTTP, etc.) = review block.

**No business logic in controllers.** Controllers are routing + auth
guards + DTO validation + delegation. If a controller method body has more
than ~10 lines or contains `if` branches deciding business state, the
logic belongs in a service.

**No magic strings.** Endpoint paths in `<feature>.controller.ts`
decorators, error codes in `common/errors/error-codes.ts`, header names in
`common/constants/`, audit-event types in the `AuditEventType` enum.
Inline string literals in service code (e.g. `'CUSTOMER_SIGNED_UP'`) =
review block — use the constant.

**Path aliases.** `tsconfig.json` defines `@/*` → `src/*`. Within `src/`,
prefer the alias over deep relative imports (`'../../../infra/...'`).
Within a single feature folder, relative imports (`'./repository'`) are
fine and preferred.

**Strict TypeScript everywhere.** `strict`, `noImplicitAny`,
`strictNullChecks`, `noUncheckedIndexedAccess` — all enabled in
`tsconfig.json`. Direct use of `any` = review block. Prefer `unknown` +
narrowing. Type assertions (`as Foo`) are allowed at boundaries (parsing
JSON from Pino logs, third-party APIs) but never to silence compiler
errors inside business code.

**DI via constructor.** NestJS uses constructor injection — explicit
`readonly`, single line per dependency. Avoid `@Inject()` symbols unless
binding an interface to a concrete implementation (e.g. `SMS_GATEWAY`
token). Service field assignment outside the constructor (e.g.
`this.foo = new Foo()`) = review block.

**Repository methods return Prisma entity types ONLY to other repositories
or to services in the SAME feature.** Cross-feature consumers receive
mapped DTOs / domain types — never `Prisma.Customer & { … }`. The mapping
function lives at the bottom of the repository file.

**Transactional writes use `prisma.$transaction`.** Multi-table writes that
must succeed or roll back together (loan-application apply, password
reset + token revoke, customer create + provider link) MUST use the
`prisma.$transaction(async (tx) => …)` pattern. Mid-write exceptions are
allowed — the transaction handles rollback. Logging successful writes
happens AFTER the transaction commits.

**Pino structured logs + correlation IDs.** Every log line is JSON
through `nestjs-pino`. Every request gets an `X-Correlation-Id` (generated
by `CorrelationIdMiddleware` if absent) attached to `req`. Service methods
that emit logs accept the correlation ID via context (audit events
already carry it). Pino's redaction config masks every PII field at the
process boundary — see `common/pino/pino.config.ts`.

**Global ValidationPipe.** `app.useGlobalPipes(new ValidationPipe({
whitelist: true, forbidNonWhitelisted: true, transform: true }))` is
non-negotiable. DTO classes use `class-validator` decorators + at least
one `@ApiProperty` annotation per public field for OpenAPI generation.

**Boot-time env validation.** Every env var lives in
`src/infra/env/env.schema.ts` as a Zod field. The app calls `loadEnv()`
in `main.ts` BEFORE `NestFactory.create()` — a missing or
wrong-typed env value crashes the process at boot, never at runtime.

**OpenAPI published.** Every controller decorator includes `@ApiTags`,
every endpoint has `@ApiOperation`, every response code has
`@ApiResponse({ status, description })`. The generated `/api/docs` is
restricted to dev + staging; production strips it.

**Anti-magic test fixtures.** When tests exist, fixture data lives in
`test/fixtures/` as typed factories (`buildCustomer(overrides)`), not
inline JSON. Tests assert on structured error codes, not English message
strings.

---

# Part III — Admin Dashboard (Angular 18)

The admin dashboard is the operator surface (sales agents, analysts,
super-admins). Code lives in `admin/src/app/` organized by feature folder
with standalone components. The admin obeys all Part I principles AND
the Angular-specific principles below.

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

## XXIII. UI UX Skills are the Design Authority
The admin dashboard uses TWO globally-installed design skills in a fixed
pipeline. Both are mandatory on every new screen, component, or visual
pattern.

**Phase 1 — `ui-ux-pro-max` (promax): design the system first.**
Invoked BEFORE writing any UI code. Produces the design-system block
(pattern, palette, typography, effects, anti-patterns, pre-delivery
checklist) tailored to the surface. Combine its output with brand color
#0869c3 and the Masrafy domain (bank program management, application
review, offer matching, document review, commission tracking). Designs
that contradict skill output require written justification in PR
description.

**Phase 2 — `impec` (impeccable): polish after first implementation.**
Invoked AFTER the screen renders. Surgical pass to catch AI-default drift
— Inter-as-display, AI-purple gradients, gray-on-color, cards-in-cards,
bounce easing, emoji-as-icons, drop-shadows-without-thought, `outline:
none` without replacement, body text under 16px, untouchable tap
targets. Default invocation: `impec audit normalize polish <surface>`.
Output is a punch list + surgical SCSS edits; reviewer applies before
merge.

The two skills cover different jobs and do NOT replace each other. Skip
either and the PR is blocked.

The pipeline governs: dashboard layouts (sidebars, top bars, cards),
data table presentation, form layouts, modal/drawer patterns, empty
states, loading states, chart styling, navigation patterns, and admin
UI conventions.

## XXIV. Design Tokens — #0869c3 Base
Define full theme in CSS custom properties under `:root`:
- `--color-brand-primary: #0869c3`
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

## Angular Clean Code Structure (v2.0.0)

These rules refine Principles XVII–XXVI without redefining them. They are
the canonical "how" for new admin code. Reviewers cite them when a change
drifts from the standalone + signals + new control flow pattern.

**Feature-folder layout.** Every admin feature mirrors:

```text
admin/src/app/features/<feature>/
├── <feature>.routes.ts                   // standalone route array w/ canActivateFn
├── pages/
│   └── <screen>.component.{ts,html,scss} // smart components — own the route + state
├── components/
│   └── <bit>.component.{ts,html,scss}    // presentational — inputs/outputs only
├── services/
│   └── <feature>.service.ts              // HTTP + state (signals), one per concern
├── models/
│   ├── <name>.model.ts                   // wire-format types
│   └── <name>.entity.ts                  // domain types (computed properties)
└── guards/                               // feature-local canActivateFn
```

Cross-feature components live under `admin/src/app/shared/components/`;
cross-feature services under `admin/src/app/core/`.

**Smart vs presentational split.** A "page" component owns the route, the
service injection, the signals, and the loading/error states. A
"presentational" component takes typed inputs + emits typed outputs —
zero service injection, zero HttpClient, zero global state access. A
presentational component that imports a service = review block.

**Signals over RxJS for state.** `signal<T>(initial)` for mutable state,
`computed(() => …)` for derived state, `effect(() => …)` ONLY for
side-effects (e.g. syncing a signal to localStorage). `BehaviorSubject`,
`Subject`, `ReplaySubject` for component state = review block (use
`signal` / `computed`). Genuine streams (HTTP, WebSocket, debounced
inputs) stay as RxJS `Observable` and convert via `toSignal()` for
storage on the component.

**New control flow only.** `@if`, `@for (… ; track …)`, `@switch`,
`@defer`. The old `*ngIf` / `*ngFor` / `*ngSwitch` = review block. Every
`@for` MUST include a `track` expression; missing track = review block
(A13).

**inject() over constructor DI.** Use `inject(SomeService)` at field
declaration. Constructor DI in Angular 18+ = review block. This unlocks
strongly-typed inject + works in functional guards / resolvers / factory
functions.

**Typed reactive forms.** `FormGroup<{...}>` with explicit type
parameters. Template-driven forms (`ngModel`) = review block. Reactive
forms compose with Signals via `controlValueChanges.pipe(toSignal())` or
the `signal(controlValue)` pattern.

**No `any`.** `strict`, `noImplicitAny`, `strictNullChecks`,
`noUncheckedIndexedAccess` enabled in `tsconfig.json`. Use `unknown` for
parsed-but-untyped values and narrow before use. Casting (`as Foo`) is
allowed at API boundaries (parsing JSON responses) but never to silence a
compiler error in business code.

**HttpClient + interceptors only.** No `fetch()`, no `XMLHttpRequest`, no
ad-hoc `Axios`. Interceptors handle: bearer token attach, error-code →
typed `DomainError`, correlation ID echo, toast emission. Each
interceptor is a single function — no class-based interceptors.

**Functional guards + resolvers.** `canActivateFn`, `canMatchFn`,
`resolveFn`. Class-based guards = review block. Guards receive `inject()`
inside their function body.

**Lazy routes everywhere.** Top-level feature routes use `loadChildren`
or `loadComponent`. Eagerly importing a feature from `app.routes.ts` =
review block.

**Design tokens, no raw hex.** CSS custom properties in
`admin/src/styles/_tokens.scss`. Component styles reference
`var(--surface-primary)` etc. Raw `#0869c3` outside `_tokens.scss` =
review block (A18). Brand primary is `#0869c3` (azure blue) — never
re-pick.

**Logical CSS only.** `margin-inline-start`, `padding-inline-end`,
`text-align: start`. `margin-left` / `margin-right` = review block (A19)
because the app ships in RTL and LTR.

**Every visible string via `@angular/localize`.** Inline English strings
in templates / TS / SCSS = review block (A20). The single error-code
copy file (`error-codes.{ar-EG,en-US}.json`) is the typed-error surface;
no per-component error message maps (A22).

**One concern per service.** `CustomersService` does customer CRUD;
`CustomerExportService` does exports; `CustomerListFiltersService` owns
the filter state. A god-service named `AppService` or `MainService` =
review block. Services are tree-shakeable singletons via `providedIn:
'root'` unless feature-scoped.

**Path aliases.** `tsconfig.json` defines `@app/*` → `src/app/*`,
`@shared/*` → `src/app/shared/*`, `@core/*` → `src/app/core/*`. Deep
relative imports (`'../../../core/...'`) across feature boundaries =
review block. Within a feature folder, relative imports preferred.

**UI UX skill pipeline (Principle XXIII).** Every new dashboard screen
invokes `ui-ux-pro-max` (promax) BEFORE design + `impec` AFTER first
implementation. Skipping either = review block (A17).

---

# Part IV — Mobile App (Flutter)

The customer-facing mobile app is the primary product surface. Code lives
in `masrafy-app/lib/features/<name>/{data,domain,presentation}/`. Architecture
and conventions are lifted from the pilot100 reference project + adapted
to Masrafy domain constraints. The mobile app obeys all Part I principles
AND the Flutter-specific principles below.

## Mobile App Structure (Flutter) — Phase 2 Skeleton

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
- **Network**: Dio with customer-JWT bearer interceptor + silent refresh-token rotation on 401 token-expired. Access + refresh tokens stored ONLY in `flutter_secure_storage` — never in code, assets, environment files, or `shared_preferences`. Reusing a rotated refresh token must trigger session-family revoke (server-enforced).
- **Routing**: `auto_route` v9+.
- **Persistence**: `shared_preferences` (non-sensitive), `flutter_secure_storage` (JWT access + refresh tokens, sensitive session flags). Keys in `StorageKeys` enum.
- **Three flavors**: `main_dev.dart`, `main_staging.dart`, `main_prod.dart` — each loads a distinct `BaseEnvironment`. `AppEnv` registered as singleton.
- **Typed payloads end-to-end**: Request DTOs are typed Dart classes — never `Map<String, dynamic>` past the datasource. Domain entities typed — never `dynamic` past the repository. Enums for finite states.
- **Typed errors**: Exceptions at boundary → `Failure` subtypes (`ServerFailure`, `NetworkFailure`, `ValidationFailure`, `EligibilityFailure`, `DbrExceededFailure`). Repository wraps datasource call with single error-translation helper (`ApiHandler.callApi`). `Either<Failure, T>` flows up; UI consumes `failure.userFacingMessage`.
- **Design tokens**: Brand primary `#0869c3` lives in `MasrafyColorTheme` — every surface using it reads via `MasrafyColorTheme.of(context).brandPrimary`. NO raw hex outside `lib/core/theme/`. Text via `MasrafyTextTheme.of(context)`. Sizes via `.w`/`.h`/`.sp`.
- **RTL native, not retrofitted**: All layouts use `EdgeInsetsDirectional`, `AlignmentDirectional`, `Directionality`. Test app in Arabic AND English on every PR.
- **Figma is the visual source of truth**: Every screen traces to a Figma frame. Implementing screens not yet in Figma = review block.

These commitments shape backend API design today. Reserved principle
numbers XXX–XXXVII for detailed Flutter rules in v2.0 (covering screen
patterns, shimmer loading, widget reuse, cross-feature promotion, edit
flow routing, package reuse, anti-patterns).

---

## XXIX. Dependency-Aware Changes — No Half Updates (All Platforms)

When a change to one place has downstream readers, EVERY reader MUST be
updated in the same PR. A field rename, enum extension, status-derivation
tweak, formula change, or visual contract update is incomplete until every
dependent surface reflects it.

This rule is non-negotiable because Masrafy reads the same underlying data
through many lenses (list ⇄ detail ⇄ Kanban ⇄ drawer ⇄ analytics ⇄
activity timeline ⇄ exports). One stale reader = a user-visible
contradiction (e.g. list says "no qualifying offers" while detail says
"submitted to bank approved"), and contradictions destroy trust faster
than missing features.

### Concrete obligations

When you touch any of these, audit + update ALL listed dependents in the
same PR:

| Touch this | Audit these dependents |
|---|---|
| `Application.status` / `leadStatus` enum or derivation | applications list status pill · Kanban column membership · application detail header · lead-analytics conversion math · activity-timeline filter labels · any saved filter chip · CSV/PDF exports |
| `BankOffer.approvalScore` / `approvalTier` thresholds | approval pill component · scoring-analytics histogram bins · agent-leaderboard tone thresholds · drawer KPI tone thresholds · ranking-by-conversion tone |
| `Activity` outcomeFlags or reasons | add-activity dialog chip options · activity-timeline humanizer + flag pills · lead-analytics activity-type rollups · stuck-lead-flag cron filters |
| `BankOfferDecision` outcome semantics | lead-analytics `valueFundedEGP` JOIN · drawer "loans approved" count · application-detail submission banner tone · ranking |
| Currency / Decimal precision rules | every numeric formatter (`formatEgp`, `formatPct`, `formatAvg`) across all features · stat strip · CSV export · Flutter `MasrafyNumberTheme` |
| Error code in `error-codes.ts` | Angular `error-codes.{ar-EG,en-US}.json` (same PR — already Principle III, A2/A22 reinforced) · Flutter ARB |
| Token rename in `_tokens.scss` / palette | every consumer SCSS · every consumer Angular component · DESIGN_SYSTEM.md table · Flutter `MasrafyColorTheme` |
| Renaming a UI label that doubles as a filter key (e.g. `system` → `workflow`) | filter chip labels · category-by-type map · CSS `data-category` selectors · URL query params · saved-view defaults |
| Adding a new agent KPI (e.g. `valueFundedEGP`) | repository raw SQL · service DTO · API contract · Angular types · stat strip · leaderboard row · drawer line-list · sort dropdown · ranking comparator · CSV export |

### How to comply

1. **Trace before editing.** `grep` for every reader of the symbol/field
   you're changing. List them in the PR description under "Dependents
   touched".
2. **Change the producer + every consumer in one commit.** Compile-time
   coupling (TypeScript types) catches most renames; behavioral changes
   (status semantics, threshold tweaks, label-doubling-as-filter) do not
   — those need manual audit.
3. **State the invariant tested.** After the change, the same business
   fact MUST read identically across all surfaces. If a manager looks at
   the list AND the detail page AND the Kanban AND the analytics
   leaderboard for the same lead, they MUST see consistent state — never
   "matched / submitted / no offers" simultaneously.
4. **If a dependent can't be updated in the same PR** (e.g. external
   consumer, Flutter not yet built), explicitly flag it in the PR
   description, open a tracking ticket, and add a TODO comment with
   ticket reference at the producer site.
5. **Reviewer obligation.** Reviewers MUST scan for plausible dependents
   not listed in the PR description. Missing dependent = block.

### What this is NOT

- Not a ban on refactors. Encouraged. Just complete them.
- Not a demand for tests (testing is not a constitutional gate per v1.2.0
  — Principles XVI/XXVII). The audit is manual; the obligation is to do
  it.
- Not retroactive. Pre-existing drift is technical debt; new PRs MUST
  not extend it.

### Enforcement

- Citing this principle (Principle XXIX) is sufficient to block a PR.
- A reviewer who spots a UI contradiction that traces to a half-update
  files a ticket tagged `principle-xxix-debt` and assigns it back to
  the introducing author.

---

# Flutter Code Structure & Shared Widgets (v1.8.0, mobile-only)

Principles XXX–XXXV are mobile-only rules for the Flutter client. They
refine the Principle XXVIII skeleton with the concrete folder shapes,
state-management contracts, and shared-widget homes the mobile codebase
must follow. They were lifted from a sibling Flutter project (pilot100)
whose `lib/core/` was imported into masrafy as the structural reference;
adapt naming (`Pilot…` → `Masrafy…`) as widgets graduate out of `core/`
into production use.

## XXX. Three-Layer Feature Architecture (Mobile, NON-NEGOTIABLE)

Every mobile feature MUST mirror `masrafy-app/lib/features/<name>/{data,domain,presentation}`.

- **data/datasources/**: exactly one concrete `<Name>RemoteDatasource`,
  registered with `get_it`. The datasource accepts a `Dio` (customer
  JWT interceptors are already wired by the shared `DioFactory`).
- **data/models/**: wire-format DTOs with `fromJson` / `toJson`. Class
  names end in `Model` (response DTOs) or `Request` (write-only payloads).
  Models live ONLY in the data layer — `domain/` and `presentation/`
  never import from `data/models/`.
- **domain/entities/**: pure business objects (plain Dart, no JSON). Class
  names end in `Entity`. These are what repositories return and what cubits
  + UI consume.
- **domain/enums/**: feature-scoped enums consumed by domain entities,
  repositories, or cubits in the same feature — one file per enum. Enums
  shared across features go in `masrafy-app/lib/core/enums/`. Placing a
  feature-scoped enum inside an entity file or a cubit = review block.
- **domain/repositories/**: abstract `<Name>Repository` declaring
  `Future<Either<Failure, T>>` methods where `T` is an **entity**
  (not a model).
- **data/repositories/**: concrete `<Name>RepositoryImpl implements
  <Name>Repository` that calls the remote datasource, catches
  `DioException` (and unknown errors), maps via `failureFromDio`, and
  returns `Either<Failure, T>` with entities. Mappers (e.g.
  `CustomerModel.toEntity()`) live at the bottom of the matching model file.
- **domain/usecases/**: one `<Name>Usecase` per feature with one `call`
  method per action. One-usecase-per-action is forbidden — group by feature.
- **Method-arity rule (v1.8.1, NON-NEGOTIABLE)**: any datasource, repository,
  usecase, or cubit method that takes MORE THAN TWO parameters MUST accept
  them as a single typed `<Name>Request` DTO from `data/models/request/`,
  not as separate named or positional params. Two-or-fewer params MAY use
  named params for ergonomics. The DTO is the same one the datasource
  serializes at the wire — single source of truth for the payload shape.
  Adding a third param later WITHOUT promoting to a DTO = review block
  (Anti-Pattern A28).

Divergence (skipping the repository, leaking `Model` types up into a cubit,
splitting usecases per action) defeats the predictability that the customer-
auth and document-upload features depend on. The model-vs-entity split
prevents wire-format concerns (JSON field names, transitional DTO shapes)
from leaking up into UI, and means a backend contract change is a data-
layer-only edit.

## XXXI. Cubit + Freezed State Management (Mobile, NON-NEGOTIABLE)

Presentation state is managed with `flutter_bloc`'s `Cubit` and `freezed`
state classes.

**Structural rules (per cubit):**

- Each cubit is `<Name>Cubit extends Cubit<<Name>State>`, registered via
  `get_it` (`registerFactory` so each `BlocProvider.create` gets a fresh
  instance).
- **State serialization tool — cubit (NON-NEGOTIABLE)**: every cubit state
  class MUST use `@freezed`. Plain Dart classes, `Equatable`, or hand-rolled
  `copyWith` are forbidden for cubit state.
- State is a single Freezed class (no event union), with matching
  `part '<name>_state.dart'` + `part '<name>_cubit.freezed.dart'`. Mutate
  via `copyWith`.
- Cubits expose public methods per user intent (e.g., `submit(...)`,
  `refresh()`) and call `emit(state.copyWith(...))` to update. No
  `on<Event>(...)` handlers, no event files.
- **Multi-field form cubits use a single `updateField(FieldEnum, Object)`
  method with an exhaustive switch** — never one method per field. Define
  a `<Name>Field` enum in the state file; dispatch in the cubit:

  ```dart
  enum SignupField { phone, name, password, email, locale }

  void updateField(SignupField field, Object value) {
    switch (field) {
      case SignupField.phone:
        emit(state.copyWith(phone: value as String, errorMessage: null));
      case SignupField.password:
        emit(state.copyWith(password: value as String, errorMessage: null));
      // ...
    }
  }
  ```

  Separate `phoneChanged(String v)` / `passwordChanged(String v)` methods
  on a form cubit with more than two fields = review block.

- **Cubits are orchestration-only — pure data logic lives on the state
  class.** Form validation returns `state.validated()`; request-body
  construction returns `state.toRequest()`; boolean "can I submit?" checks
  are getters like `state.canSubmit`. Long `if (phone == null || ...)`
  chains and inline DTO constructors in the cubit = review block.
- Dependencies (usecases, repositories) are injected via constructor; the
  cubit is resolved via `getIt<FooCubit>()` in `BlocProvider.create`.

**Cubit scope (NON-NEGOTIABLE):**

- **Default: one cubit per screen.** Each screen owns its own
  `<Screen>Cubit`, provided at the top of the screen via
  `BlocProvider(create: (_) => getIt<<Screen>Cubit>()..load())`. Navigating
  away tears down the cubit.
- **Shared cubits across screens are the narrow exception** — permitted
  only when ≥2 screens within the same feature genuinely need to emit to
  the same state (multi-step wizard, master-detail flip-back, tab
  projections of one dataset). Shared cubits MUST be provided at the
  lowest common ancestor (a feature-shell route with `BlocProvider`
  wrapping children), NEVER as a `getIt` singleton.
- **Cubits are never shared across features.** Cross-feature coordination
  goes through a `core/services/` service, a repository call, or a usecase.
- Shared state MUST be only the genuinely-shared concern. Per-screen
  local UI state (field focus, screen-level loading, screen-level error)
  stays on a per-screen cubit or local `StatefulWidget` state.

**Cubit performance hygiene (NON-NEGOTIABLE):**

1. **No-op guards on setters.** Every public `setX(value)` MUST early-
   return when the value is unchanged before calling `emit`:

   ```dart
   void setAmount(int amount) {
     if (state.amount == amount) return;
     emit(state.copyWith(amount: amount));
   }
   ```

2. **`buildWhen` where it earns its keep — not everywhere.** Use it when:
   state has >5 fields AND the widget reads <50% of them AND the widget
   subtree is non-trivial (>20 children) OR sits in a list of many siblings.
   Skip it when: the widget reads most fields, the widget is a leaf
   (`Text`, `Icon`), the widget is keyed on a value that already tears it
   down, or the state is narrow with infrequent emits.

3. **Controller mutations live outside `build()`.** Mutating a
   `TextEditingController.text` inside `BlocBuilder.builder` is a write-
   during-layout anti-pattern. Move the sync into a `BlocConsumer.listener`
   (gated by `listenWhen`), `initState`, or `didUpdateWidget`.

4. **Dispose every controller / subscription.** `TextEditingController`,
   `ScrollController`, `StreamSubscription`, `AnimationController`, and
   any `Timer` created in `initState` MUST be disposed in `dispose()`.

`Bloc` (with an event union) is permissible **only** when a feature has a
genuinely complex state machine whose transitions are clarified by
exhaustive event matching; such cases MUST be justified in the PR
description. Default is `Cubit`.

## XXXII. Per-Flow Page Library Pattern (Mobile Presentation, NON-NEGOTIABLE)

Within `presentation/pages/`, every user-visible flow lives in its own
subfolder with its own imports/part library. Cross-flow widgets live in a
feature-level `widgets/` folder.

**Folder shape (for feature `auth`):**

```
features/auth/presentation/pages/
├── login/
│   ├── login.imports.dart              ← library owning login's imports
│   ├── login_screen.dart               ← part of 'login.imports.dart'
│   ├── widgets/
│   │   ├── login_widgets.imports.dart  ← library for login's flow-local widgets
│   │   └── <widget>.dart               ← part of login_widgets.imports.dart
│   └── sub_features/                   ← embedded UI units owned by this flow (never @RoutePage)
│       └── <sub_feature_name>/
│           ├── cubit/<sub_feature_name>/
│           ├── widgets/
│           ├── <sub_feature_name>.imports.dart
│           └── <sub_feature_name>_screen.dart   ← NOT @RoutePage
├── signup/                              (same shape)
├── widgets/                             ← feature-shared (used by ≥2 flows)
│   ├── auth_widgets.imports.dart
│   └── <widget>.dart                    ← part of auth_widgets.imports.dart
└── sub_features/                        ← feature-shared sub-features
    └── <sub_feature_name>/              (same four-piece shape)
```

**Rules:**

- **One flow = one folder.** A feature with a single flow still nests
  that flow as a subfolder (e.g. `dashboard/pages/dashboard/`) for
  structural consistency with multi-flow features.
- **One flow = one library.** The flow folder contains
  `<flow>.imports.dart` owning all imports for that flow. The screen file
  starts with `part of '<flow>.imports.dart';` and carries no imports of
  its own.
- **Flow-local widgets** live under `<flow>/widgets/` and are `part of
  '<flow>_widgets.imports.dart';`. A flow with no flow-local widgets omits
  the `widgets/` subfolder.
- **Feature-shared widgets** (used by ≥2 flows of the same feature) live
  under `pages/widgets/` with a single `<feature>_widgets.imports.dart`
  library that every flow's `<flow>.imports.dart` imports.
- **Sub-features** (self-contained UI units embedded inside a flow — e.g.
  an OTP panel, an offer-detail bottom sheet) live under
  `pages/<flow>/sub_features/<sub_feature_name>/`. Each sub-feature has
  exactly three concerns in their own subfolders: `cubit/` (one
  `@injectable` cubit + Freezed state), `widgets/` (one library + one
  widget per file), and the top-level `<sub_feature_name>.imports.dart`
  + `<sub_feature_name>_screen.dart`. The screen file is **never**
  `@RoutePage` — sub-features are rendered inline / as a
  `showModalBottomSheet` builder / as a panel child.
- **One widget per file (NON-NEGOTIABLE):** a `widgets/` file MUST NOT
  contain more than one `Stateless`/`Stateful` widget class. Library-
  private (`_`-prefixed) helpers each go in their own sibling file under
  the same `widgets/` folder, all `part of` the same imports library.
- **Cross-feature widgets** (could reasonably be used by ≥2 features) do
  NOT live under any feature — they belong in
  `masrafy-app/lib/core/widgets/<category>/` per Principle XXXIII.

**Widget-promotion ladder (applies in the same PR that introduces the
second use — a trailing duplicate is a review block):**

- Flow-local → feature-shared: the moment a second flow in the same
  feature imports the widget, move it to `pages/widgets/` and rewire imports.
- Feature-shared → `masrafy-app/lib/core/widgets/<category>/`: the moment a
  second feature would import it, promote per Principle XXXIII.

The imports/part mechanism is preserved (part files have no imports,
adding a new screen or widget is one file + one `part` line in the right
library). The flow scoping ensures a flow with 7 screens and 30+ widgets
is navigable by flow rather than buried in a single feature-wide library.

## XXXIII. Shared Widget Reuse (Mobile, NON-NEGOTIABLE)

Any widget that could be used by more than one feature lives in
`masrafy-app/lib/core/widgets/`, grouped by widget family into categorized
subfolders.

**Rules:**

- **Before creating any widget, grep `masrafy-app/lib/core/widgets/`** for an
  existing implementation. If one exists, reuse it. If it exists but is
  almost-but-not-quite right, extend it (new props, new variant) rather
  than forking.
- **New shared widgets MUST be placed under `masrafy-app/lib/core/widgets/<category>/`**
  where `<category>` groups by widget family. Current categories (imported
  from the pilot100 reference and progressively rebranded to `Masrafy…`):
  `answer_options/`, `app_bars/`, `bottom_sheets/`, `buttons/`, `cards/`,
  `charts/`, `chips/`, `common/`, `date_pickers/`, `dialogs/`, `flip_card/`,
  `icons/`, `images/`, `input_controls/`, `shimmers/`, `slivers/`,
  `steppers/`, `success/`, `toasts/`. Add new categories when a family of
  ≥2 related widgets emerges; folder names use the widget family, not the
  feature consuming them.
- **Duplicated widgets across features = review block.** Two
  `EmailField` implementations across two features → promote to
  `masrafy-app/lib/core/widgets/input_controls/email_field.dart` in the same
  PR that introduces the second use.
- **Near-twin widget detection (NON-NEGOTIABLE):** before adding a row /
  tile / option / chip / card-shape widget to any feature, grep
  `masrafy-app/lib/features/` for the same shape (search by visual role — "offer
  card", "loan row", "doc-upload tile" — not by exact class name). If a
  sibling feature already ships a widget that renders the same primitive
  layout (even with different state / behaviour), the new feature MUST
  NOT fork. Two visually-identical-but-textually-different tile
  implementations across features = review block, even when each is
  internally consistent and shapes diverge by 5–10%.
- **Feature-local widgets** (single-use, tightly-coupled to one screen's
  state) stay in `features/<name>/presentation/pages/<flow>/widgets/`
  per Principle XXXII. Test: "could another feature ever reasonably use
  this?" — if yes, it goes in `masrafy-app/lib/core/widgets/`.
- Shared widgets use normal per-file imports (they are standalone
  libraries — Principle XXXII's imports/part pattern does NOT apply to
  `lib/core/widgets/`).
- Shared widgets MUST still obey Principles VIII + XXIV (design tokens,
  no hardcoded colors/sizes) so they compose cleanly across features.

**Abstract base + concrete variant pattern (REQUIRED for shared widgets
with fixed layout but variable content):** when a shared widget always
renders the same layout but each usage fills different content (icon,
copy, callbacks), use an abstract `StatelessWidget` base that owns
`build()` and declares abstract getters, plus named concrete subclasses
for each standardised use-case (e.g. `MasrafyEmptyState` abstract +
`MasrafyFetchErrorState` / `MasrafyNoItemsState` concrete). Never
construct the abstract base directly; always use a named concrete variant.

**Mandated surface bases (NON-NEGOTIABLE):** four widget families have
established abstract bases. Every new instance MUST extend the
corresponding base — rolling a sheet/dialog/picker/app-bar from a raw
`showModalBottomSheet` / `showDialog` callback or hand-rolled `Container`
chrome = review block.

| Family | Base | When to extend vs compose |
| --- | --- | --- |
| App bars | abstract `MasrafyAppBar` (today: `PilotAppBar`) | Always extend; override `buildContent`, `showBack`, `trailingActions`. |
| Bottom sheets | `MasrafyBottomSheetShell` + abstract `MasrafyBottomSheetBase` | Declarative → extend base. Stateful → return `…Shell(...)` from `State.build`. Present via `…BottomSheet.show<T>(...)`. |
| Dialogs | `MasrafyDialogShell` + abstract `MasrafyDialogBase` | Same two-layer pattern as sheets. Present via `MasrafyDialogBase.show<T>(...)`. |
| Date pickers | abstract `MasrafyDatePickerBase<W>` | Picker `State` extends the base. Hooks: `initialDisplayedMonth`, `buildPickerBody(context)`, `onSavePressed(context)`. |

**Rules for sheets / dialogs:**

- `dialogs/` is the only home for app-wide dialogs. Feature-local
  `*Dialog` widgets = review block — promote in the same PR.
- Stateful sheets and dialogs MUST compose with the `*Shell` widget,
  not re-implement the shell's layout.
- Presentation helpers (`MasrafyBottomSheet.show<T>(...)`,
  `MasrafyDialogBase.show<T>(...)`) are the canonical entry points;
  raw `showModalBottomSheet` / `showDialog` calls in feature code =
  review block when a `*.show()` helper exists.
- Sheets that collect user input return the value via
  `Navigator.pop(context, userValue)` and let the caller persist.
  Embedding `_isSaving` flags, `try / catch + ScaffoldMessenger…`
  error reporting, or persistence calls inside the sheet's `State` =
  review block — that's cubit territory.

**Sheet & dialog naming convention (NON-NEGOTIABLE):** every concrete
sheet under `bottom_sheets/` and every concrete dialog under `dialogs/`
follows `Masrafy[Action][ModalKind][Sheet|Dialog]` — e.g.
`MasrafyDeleteConfirmationSheet`, `MasrafyRenameInputSheet`,
`MasrafyLogoutConfirmationDialog`. Generic single-word names
(`MasrafyRenameSheet`, `MasrafyEditSheet`) = review block.

Duplicated widgets are the #1 source of inconsistent UI — button A has
4px radius, button B has 6px radius, both "copied from somewhere".
Forcing a home for every reusable widget prevents drift, makes design-
token changes trivial (edit once), and lets reviewers block duplication
early.

## XXXIV. Shape-Matched Shimmer Loading States (Mobile, NON-NEGOTIABLE)

Every screen and widget that fetches async content MUST render its
loading state as a **shimmer skeleton whose primitives mirror the design
layout it replaces** — not a generic centered spinner, not a blank screen.

**Shape-match rule:**

The shimmer is a low-fidelity wireframe of the real layout. Each
placeholder primitive matches the geometry of the widget it stands in for:

- A **circular** widget (avatar, ring chart, badge) → circular shimmer
  (`BoxShape.circle`) at the same diameter.
- A **rectangular** widget (card, image, container, button) → rectangular
  shimmer with the same width, height, and border radius.
- A **text line** (title, subtitle, caption, body paragraph) → a thin
  rounded bar at the same position; titles ~60–80% of available width,
  subtitles ~40–50%, body paragraphs span multiple bars.
- A **list of repeated rows** (offer cards, application list entries,
  support requests) → render the row skeleton 3–5 times so the user
  perceives the list shape.

**Implementation rules:**

- Use one canonical shimmer effect (the `shimmer` package). Wrapper lives
  at `masrafy-app/lib/core/widgets/shimmers/<masrafy>_shimmer.dart`. Do NOT
  introduce a second shimmer package.
- **Wrapper + plain-primitive pattern (NON-NEGOTIABLE):** the wrapper is
  a non-abstract `StatelessWidget` that takes a `child` and owns the
  single `Shimmer.fromColors` — animation, gradient, and base/highlight
  colors come from the theme. Primitives (`*ShimmerBox`, `*ShimmerCircle`,
  `*ShimmerLine`) are plain `StatelessWidget`s that render opaque colored
  containers; they do NOT wrap themselves in `Shimmer.fromColors`.
- **One shimmer wrapper per skeleton (NON-NEGOTIABLE):** nesting the
  wrapper inside itself (directly or indirectly) is a review block — it
  produces nested `Shimmer.fromColors` and breaks the sweep animation.
- **Feature-specific composite skeletons** that mirror one feature's
  layout (e.g. `OfferCardSkeleton`, `ApplicationsListItemSkeleton`) live
  next to the real widget in `presentation/<flow>/widgets/` and are
  `part of` the flow's widgets library. They wrap their layout in one
  shimmer wrapper and compose the core primitives inside. Naming ends
  in `…Skeleton`.
- **Promotion rule (NON-NEGOTIABLE):** when introducing a new feature-
  local skeleton, audit existing skeletons across features. If the new
  skeleton's layout matches an existing one AND will appear in ≥2
  features, promote the shared layout to `masrafy-app/lib/core/widgets/shimmers/`
  in the same PR.

**When a generic spinner IS acceptable:**

- Inside a button after the user taps it ("submit in progress") — the
  button keeps its frame, the label is replaced with a small spinner.
- One-shot modal confirmation dialogs that are themselves transient
  overlays.
- Inline operations on a row that does not change the row's geometry.

**When a generic spinner is FORBIDDEN (review block):**

- Any first-load of a content screen, tab, or bottom sheet with a known
  layout. A `Center(child: CircularProgressIndicator())` as the screen-
  level loading state for content-bearing screens = review block.
- Any list, grid, or chart whose design is known. The loading state
  mirrors the layout.

**Shimmer triggers on every reload, not only on first load
(NON-NEGOTIABLE):** a `BlocBuilder` rendering a content section MUST
swap to its skeleton whenever the underlying state is loading — not only
when the data slot is also empty:

```dart
// CORRECT — shimmer on every fetch (initial load + every filter change)
if (state.requestState.isLoading) return const _OffersListSkeleton();
if (state.offers.isEmpty) return const SizedBox.shrink();

// WRONG — only shimmers on first load; later refreshes show stale data
if (state.offers.isEmpty && state.requestState.isLoading) {
  return const _OffersListSkeleton();
}
```

A centered spinner conveys "something is happening" but nothing about
what. A shape-matched shimmer conveys layout, hierarchy, and pacing —
the user's eyes settle into the structure during the wait, so when the
real content appears there is no perceptual jolt.

## XXXV. Cross-Feature Sub-Feature Reuse (Mobile, NON-NEGOTIABLE)

When the same behavioural unit — a cubit + its state + its widgets + the
presentation glue that ties them together — needs to live inside ≥2
features, it MUST be extracted to `masrafy-app/lib/core/features/<concern>/`
and consumed by composition. Duplicating the unit across features =
review block. Importing a cubit / state / widget across feature folders
(`features/foo/` reaching into `features/bar/`) = review block (already
forbidden by Principle XXXI's "Never share a cubit across features").

This extends Principle XXXIII from "shared widgets" to "shared sub-
features" — a sub-feature is a cubit + its state + its widgets + (optionally)
its presentation imports library, taken as one cohesive package. Pure
widgets without a cubit still go to `masrafy-app/lib/core/widgets/<category>/`
per Principle XXXIII; pure data layers (datasource, repository, usecase,
entities) are cross-feature-safe per Principle XXX and live in their
owning feature. This principle covers the gap in between: behavior-
with-state.

**Folder layout under `masrafy-app/lib/core/features/<concern>/`:**

```
masrafy-app/lib/core/features/<concern>/
├── cubit/
│   ├── <concern>_cubit.dart            # registered factory in get_it
│   ├── <concern>_state.dart            # part of the cubit; freezed
│   └── <concern>_cubit.freezed.dart    # generated
├── widgets/
│   ├── <concern>_widgets.imports.dart  # one library owning imports + part files
│   └── <widget>.dart                   # part of imports library
└── <concern>.imports.dart              # optional top-level imports library
```

**Rules:**

- **Promote on the second use, not the first.** A sub-feature that
  today lives inside one feature stays there until a second consumer
  surfaces. The PR that introduces the second consumer MUST move the
  sub-feature to `masrafy-app/lib/core/features/<concern>/` and update the
  original feature's imports in the same PR. The old location is
  deleted; no parallel implementation exists.
- **Provider scope: lowest common ancestor of the consumers.** Each
  consuming screen provides its own fresh
  `BlocProvider(create: (_) => getIt<XCubit>())` — there is NO singleton
  instance of a cross-feature cubit. `registerFactory` makes each
  `getIt<>()` call return a fresh cubit.
- **Cubit naming.** Inside `masrafy-app/lib/core/features/comments/cubit/`,
  the cubit class is `CommentsCubit` — no `Masrafy…` prefix (those are
  reserved for shared widgets per Principle XXXIII) and no `Core…`
  prefix. The folder path declares the scope; the class name stays plain.
- **Routing.** A sub-feature that exposes a screen-shaped surface (a
  full route) MAY register an `auto_route` page from inside
  `masrafy-app/lib/core/features/<concern>/`. The router config in
  `masrafy-app/lib/core/router/` is the canonical home for the route
  registration entry; the page widget lives in `core/features/`.

**Anti-patterns (review blocks):**

- A `features/<x>/` folder importing from another `features/<y>/`
  folder for a cubit / state / widget. Promote the shared unit to
  `masrafy-app/lib/core/features/<concern>/` in the same PR.
- A `masrafy-app/lib/core/features/<concern>/` folder that holds only widgets
  without a cubit. Move the widgets to
  `masrafy-app/lib/core/widgets/<category>/` per Principle XXXIII —
  `core/features/` is for cubit-bearing units.
- A second copy of a cubit / state / widget that already lives in
  another feature.

Without this principle, teams either (a) duplicate ~hundreds of LOC
across features (drift, double maintenance) or (b) reach across feature
folders to import a cubit (Principle XXXI violation, brittle coupling).
The `lib/core/features/<concern>/` location closes that gap, mirrors
the existing `lib/core/widgets/` pattern, and makes the second-use
trigger explicit so review can enforce promotion at the right moment.

---

## XXXVI. One Screen, One File (Mobile, NON-NEGOTIABLE)

Every navigable screen (a route / destination) is declared as exactly
ONE public widget in its own file. A file MUST NOT contain more than
one route-level widget.

### Rules

1. **One public page widget per file.** File name = widget name in
   snake_case, suffixed `_page.dart`. e.g. `PhoneSignupOtpPage` lives
   in `phone_signup_otp_page.dart`. Dialog/sheet/picker route-level
   surfaces follow the same shape (`_dialog.dart`, `_sheet.dart`).
2. **Private leaf helper widgets** (prefixed `_`) used ONLY by that
   screen MAY live in the same file, declared below the page class.
   Helper widgets reused by 2+ screens MUST be promoted to public and
   moved to the feature's `widgets/` directory (or `core/widgets/`
   per Principle XXXIII if cross-feature).
3. **Page files contain UI only.** No datasource calls, no business
   logic, no token signing, no async repository invocation outside the
   cubit. Those belong in the Cubit per Principle XXXI. The page is a
   `BlocBuilder` / `BlocConsumer` / `BlocSelector` surface that reads
   state and dispatches intent.
4. **Per-flow library compatibility (Principle XXXII).** Page files
   remain `part of '<flow>.imports.dart';` — the per-flow library
   declares `part` directives for each individual `*_page.dart` file
   under the flow folder.

### Rationale

Predictable file → screen mapping makes navigation, code review, and
ownership trivial. It keeps diffs small, prevents merge conflicts when
two engineers touch different steps of the same flow, and stops files
from growing into 800-line god-files (e.g. the original
`phone_signup_pages.dart` collapsed three steps into one file —
unreviewable). The pilot100 reference project enforces the same rule.

### Naming

| Surface | File suffix | Class suffix |
|---|---|---|
| Route page | `_page.dart` | `Page` |
| Modal route — bottom sheet | `_sheet.dart` | `Sheet` |
| Modal route — dialog | `_dialog.dart` | `Dialog` |
| Modal route — picker | `_picker.dart` | `Picker` |

For the four modal surfaces, the constitutional naming layer (Principle
XXXIII) — `Masrafy[Action][ModalKind][Sheet|Dialog]` — still applies for
the core-shared base; per-flow modals defined under a feature use the
flow-local prefix (e.g. `LoginForgotPasswordSheet`).

### Enforcement

Citing Principle XXXVI (or Anti-Pattern A29) blocks PRs that introduce
multiple route-level widgets in a single file. Existing multi-class
files are technical debt; new PRs MUST NOT extend them.

---

## XXXVII. Mandatory Profile Completeness (All Platforms, NON-NEGOTIABLE)

A customer account is UNUSABLE for the questionnaire, matching, and loan
application until its profile is complete. Profile completion is a
first-class step that runs immediately after OTP / provider verification
creates the lite customer row — NOT a popup attached to "Apply", and NOT
deferred to apply time.

### Rules

1. **Completeness contract.** A profile is COMPLETE only when ALL of the
   following are persisted on the customer:
   - mobile + `mobileVerifiedAt` (OTP-verified; non-null)
   - `firstName` AND `lastName` (both non-empty)
   - `birthday` (a `DateTime`; age is DERIVED from it, NEVER stored — see Rule 4)
   - `profilePhotoKey` (an S3 object key under Principle VI)
   - National ID FRONT + BACK — two `Document` rows of type
     `NATIONAL_ID_FRONT` / `NATIONAL_ID_BACK` linked to the customer
   - PHONE customers additionally: `passwordHash` (non-null). SOCIAL
     customers have `passwordHash = NULL` and complete via their provider.
2. **Hard gate.** Backend MUST reject questionnaire-submit, matching, and
   `/applications/apply` for any customer whose profile is incomplete with
   `PROFILE_INCOMPLETE`. The mobile app MUST route an incomplete customer
   into the profile-completion flow and MUST NOT render the gated surfaces.
3. **National ID is collected at profile completion, NOT at apply.** The two
   National ID Document rows are created and linked to the CUSTOMER during
   profile completion. Apply binds the already-present documents to the
   application; apply MUST NOT be the first point National ID is requested.
4. **Age is always derived from `birthday`.** No `age` column, no persisted
   `age` DTO field on the customer. Validation (18–80) runs against the value
   derived from `birthday` at write time and at apply time.
5. **Images follow Principle VI.** Profile photo and National ID images are
   PII: S3 + SSE, presigned short-expiry URLs, never logged, masked in admin.
6. **Immutability.** Once set, mobile + `mobileVerifiedAt` and `birthday` are
   immutable (service-layer assertion). firstName / lastName / profile photo
   are editable via account screens.

### Rationale

Splitting registration into "lite row at OTP" + "mandatory completion step"
gives both paths ONE identical completeness contract, removes the brittle
apply-time popup, and lets the questionnaire/matching/apply gates check a
single boolean instead of path-specific field sets. Storing `birthday` and
deriving age eliminates the stale-age bug class (an age integer is wrong the
day after it is written) and matches how National ID birthdate is verified.
Collecting National ID at completion (not apply) means a complete customer
can apply to any matched program with zero extra document steps.

### Enforcement

Citing Principle XXXVII (or Anti-Patterns A30 / A31 / A32) blocks PRs that
collect National ID at apply, store an `age` value instead of deriving from
`birthday`, or allow any gated surface to proceed past an incomplete profile.

---

# Technical Constraints

## Backend
- Node.js LTS via `.nvmrc`, invoked through `nvm use`
- PostgreSQL 16+ with PgBouncer or managed pooler
- Prisma 5+ with migrations checked in
- `@nestjs/config` with Zod-validated env schema, fail-fast at boot
- Pino-compatible structured logging
- Docker multi-stage build, non-root user, slim runtime image
- Redis for rate limiting, login-lockout sliding-window counters, and (future) refresh-token revoke broadcasts
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

## A9. Reserved (was: Skipping HMAC in Mobile Tests — retired v3.0.0)
HMAC was removed platform-wide in v3.0.0. Slot reserved to keep
downstream anti-pattern IDs stable.

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

## A17. Skipping the UI UX Skill Pipeline (Principle XXIII)
Building a new dashboard screen without invoking BOTH `ui-ux-pro-max` (pre-design) AND `impec` (post-implementation polish), or deviating from their output without written justification in the PR description = review block. Either skill alone is insufficient.

## A18. Raw Hex Colors Outside Theme (Principle XXIV)
`color: #ffffff` or `background: #0869c3` in any component stylesheet = review block. Use `var(--color-*)`.

## A19. margin-left/margin-right in Angular Stylesheets (Principle IV)
Any directional CSS property that doesn't respect RTL = review block. Use `margin-inline-start`, etc.

## A20. Hardcoded User-Visible Strings (Principle IV)
Any user-visible text not flowing through i18n (Angular `$localize` or Flutter ARB) = review block.

## A21. Manual fetch() in Angular (Principle XXVI)
Bypassing `HttpClient` with `fetch()` = review block.

## A22. Per-Component Error Message Mapping (Principle III)
Local `mapErrorToMessage` helper in components or services other than the central `ErrorCodeService` = review block.

## A23. JWT Tokens Outside Secure Storage (Principle XXVIII, restated v3.0.0)
Customer JWT access or refresh token persisted in code, asset files, environment files, or `shared_preferences` = review block. Only `flutter_secure_storage`. (HMAC predecessor was retired in v3.0.0 along with the shared-secret signing model.)

## A24. Approval Probability Without Documented Weights (Principle V)
Changing approval probability scoring without recording weight changes in the PR description with historical-impact analysis = review block. (Test artifacts not mandated post-v1.2.0; PR description carries the rationale.)

## A25. Half-Updated Dependents (Principle XXIX)
Changing a field / enum / derivation / threshold / label-doubling-as-filter / numeric formatter / token / error code without updating every downstream reader in the same PR = review block. UI contradictions where the same business fact reads differently across list / detail / Kanban / drawer / analytics / timeline = automatic block. PR description MUST list "Dependents touched"; reviewers MUST scan for missing ones.

## A26. Fifth Retail Loan Category Without Amendment / Ghost Rows After Removal (Principle II scope-lock, v1.5.0 → v1.6.0 → v1.7.0)
Adding a FIFTH retail loan category (anything beyond `personal`, `car`, `mortgage`, `business`) via migration, seed row, DTO enum, UI multi-select, matching-engine branch, or analytics dimension — without first amending the constitution to widen the scope-lock — = review block. Removing a category requires a destructive migration that physically deletes the registry entry, all bank programs in that category, and all applications referencing it (cascade through bank offers, decisions, activities, documents). Append-only triggers must be temporarily disabled (`ALTER TABLE … DISABLE TRIGGER`) and re-enabled inside the same migration; a `DATA_ERASURE_COMPLETED` audit-event row records the wipe. Leaving deactivated rows behind = review block — operators see ghost categories in audit dashboards and registry pickers. Buyout pricing as a feature of an existing program (e.g. `pricing.buyoutRateDeltaPercent` on a `personal` program) is NOT a fifth category and is allowed.

## A27. Money / Amount Input Without the Grouping Directive (UI consistency, v1.6.1)
Any editable money or amount input — EGP loan amounts, monthly income, balances, asset values, uplift ceilings, tier-band thresholds, prices — that does NOT use the shared `MoneyInputDirective` (`appMoneyInput`, `admin/src/app/core/directives/money-input.directive.ts`) = review block. The directive is the single owner of: thousands-grouping display (`1,000,000`), caret preservation across re-grouping, and the **raw-string contract** — the `FormControl` value, the request payload, and the backend DTO see digit-only strings (optionally one decimal point), never separators. The following are blocks: re-implementing a per-input `(input)` formatting handler, storing a comma-formatted string in a `FormControl`, or shipping an ungrouped raw money input. Percent fields (interest rate, fee %, spread, LTV %, down-payment %) are NOT money and MUST NOT use the directive.

## A28. Mobile Method With More Than Two Params Not Promoted To a Request DTO (Principle XXX, v1.8.1)
Any datasource, repository, usecase, or cubit method on the Flutter client that takes MORE THAN TWO parameters as separate named or positional params (instead of a single typed `<Name>Request` DTO from `data/models/request/`) = review block. The DTO MUST be the same one the datasource serializes at the wire boundary — one payload shape, one place to evolve. Two-or-fewer params MAY use named params. Promoting to a DTO retroactively when a third param is added is mandatory, not optional. Existing pre-v1.8.1 call sites with 3+ params get a one-PR grace period to migrate.

## A29. Multiple Route-Level Widgets in One Page File (Principle XXXVI, v3.1.0)
Any `*_page.dart` / `*_pages.dart` / `*_dialog.dart` / `*_sheet.dart` / `*_picker.dart` file containing MORE THAN ONE public route-level widget = review block. Each route / navigable destination ships in its own file named after the widget. Private `_`-prefixed leaf helpers used by exactly one screen MAY co-exist below the page class in the same file. Helpers reused by 2+ screens MUST be promoted to the feature's `widgets/` or `core/widgets/` per Principle XXXIII. Existing pre-v3.1.0 multi-class page files (e.g. `phone_signup_pages.dart`, `forgot_password_pages.dart`, `complete_profile_pages.dart`) are technical debt; new PRs MUST NOT extend them.

## A30. National ID Collected at Apply Instead of Profile Completion (Principle XXXVII, v4.0.0)
Requesting, uploading, or first-linking National ID FRONT/BACK inside the loan-application / apply flow = review block. National ID is collected during the mandatory profile-completion step and linked to the CUSTOMER; apply only binds pre-existing Document rows to the Application.

## A31. Storing Age Instead of Deriving From Birthday (Principle XXXVII, v4.0.0)
Any `age` column, persisted `age` field, or DTO that writes a customer's age to the database = review block. Store `birthday` (`DateTime`); derive age on read and validate the 18–80 range against the derived value.

## A32. Proceeding Past an Incomplete Profile (Principle XXXVII, v4.0.0)
Allowing questionnaire-submit, matching, or `/applications/apply` to succeed for a customer missing any completeness field (mobile+verified, firstName, lastName, birthday, profilePhotoKey, National ID front+back; PHONE also passwordHash) = review block. Backend returns `PROFILE_INCOMPLETE`; mobile routes into the completion flow instead of rendering the gated surface.

---

# Governance

- Version SemVer. MAJOR = breaking principle removal/redefinition OR major structural reorganization. MINOR = new principle or section. PATCH = clarification / anti-pattern addition.
- Every amendment updates the version-history table below and the Recent Changes block in `CLAUDE.md`. Old long-form rationale lives in git history, not here.
- Brand color, primary stack, or any principle marked NON-NEGOTIABLE require explicit team sign-off recorded in the PR description.
- Reviewers cite principle numbers (e.g. "Principle X violated") or anti-pattern IDs (e.g. "A18") to block PRs.

## Version History

| Version | Date | Type | Summary |
|---|---|---|---|
| 1.0.0 | 2026-05-12 | RATIFY | Initial three-platform constitution. Principles I–XXVIII. |
| 1.1.0 | 2026-05-12 | MINOR | Drop unit + integration testing from constitutional gates. |
| 1.2.0 | 2026-05-12 | MINOR | Drop E2E + a11y gates. Principles XVI / XXVII become placeholders. |
| 1.3.0 | 2026-05-12 | MINOR | Principle XXIII expanded: promax BEFORE design + impec AFTER first impl. |
| 1.4.0 | 2026-05-19 | MINOR | New Principle XXIX (No Half Updates). Anti-pattern A25. |
| 1.5.0 | 2026-05-21 | MINOR | Product scope-lock: three retail loan categories (personal/car/mortgage). A26. |
| 1.6.0 | 2026-05-21 | MINOR | Scope-lock tightened: destructive migration required for removed category. |
| 1.6.1 | 2026-05-21 | PATCH | Anti-pattern A27: every money input MUST use `MoneyInputDirective`. |
| 1.7.0 | 2026-05-25 | MINOR | Scope-lock widened to FOUR categories (added `business`). Customer JWT layer added to Principle XIII. |
| 1.8.0 | 2026-05-26 | MINOR | Principle XIII rewrite: guest mode removed; two-path registration (PHONE upfront + SOCIAL lite + mandatory loan-request popup); claim endpoint deleted; login lockout codified. |
| 1.8.1 | 2026-05-27 | PATCH | Principle XXX method-arity rule (>2 params → typed Request DTO). Anti-pattern A28. |
| 2.0.0 | 2026-05-28 | MAJOR | Structural reorganization into Part I (Cross-Platform) / II (Backend NestJS) / III (Admin Angular) / IV (Mobile Flutter). New normative sub-sections: NestJS Clean Code Structure + Angular Clean Code Structure. No principle removed or redefined. |
| 3.0.0 | 2026-05-28 | MAJOR | Principle XIII redefined: HMAC-SHA256 signing model REMOVED platform-wide. Mobile API (`/api/v1/*`) is JWT-only — customer access (15min) + refresh (30d) with server-side rotation + reuse detection. Principle XXVIII Network bullet updated (Dio + bearer + silent refresh, no HMAC interceptor). Brand primary swapped from `#06152D` to `#0869C3` (azure). Anti-Pattern A9 retired (slot reserved). A23 restated for JWT secrets in secure storage. |
| 3.1.0 | 2026-05-28 | MINOR | New Principle XXXVI — One Screen, One File (Mobile, NON-NEGOTIABLE). Every navigable screen ships as exactly one public widget in its own `*_page.dart` (or `_dialog.dart` / `_sheet.dart` / `_picker.dart`) file. Anti-Pattern A29 enforces it. Pre-v3.1.0 multi-class files (`phone_signup_pages.dart`, `forgot_password_pages.dart`, `complete_profile_pages.dart`) flagged as tech debt. |
| 4.0.0 | 2026-06-02 | MAJOR | Principle XIII registration model redefined: customer row created LITE post-OTP/provider, then a MANDATORY profile-completion step (firstName + lastName + birthday + profile photo + National ID front+back; PHONE also password) for BOTH paths — the "upfront full registration" / "loan-request popup" model is gone. New Principle XXXVII (Mandatory Profile Completeness, NON-NEGOTIABLE). Data model: `name`→`firstName`+`lastName`; `age Int`→`birthday DateTime` (age always derived, never stored); new `profilePhotoKey`; `passwordHash` nullable (null for SOCIAL). National ID collected at profile completion (not apply) as two customer-linked Document rows. Guest plumbing (`Application.isGuest`, `mobileClientId`, claim flow) fully removed from code. Anti-Patterns A30/A31/A32 added. Principle VI guest sentence replaced with profile-photo/National-ID PII coverage. |

---

**Version**: 4.0.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-06-02
