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
installments, fees, and document checklists. The
service is free for users; commissions are paid by banks per successful
loan (1–2% personal, 0.5–1% mortgage, flat fees for cards). The platform
NEVER charges users.

**Four product lines (NON-NEGOTIABLE — see Principle II scope-lock,
v1.5.0 → v1.7.0 → v15.0.0 → v16.0.0):** Personal loans (no down payment,
mass market), Car loans (20–30% down payment, premium tier above 4M EGP
gets discounted rates), Mortgages (20%+ down payment, multiple property
types and construction stages, highest revenue per deal), and Business
loans (SME / professional-use working-capital lending — larger ticket
sizes, separate underwriting, added in v1.7.0 to align the platform with
the mobile user-journey product surface).

**The no-payslip product is an income BASIS, not a category (v16.0.0).**
v15.0.0 added a fifth category, `fast` ("Fast Loans"), for the product
where the bank cannot see a salary and works one out from a fact about the
applicant (army grade, academic rank, years in practice, credit-card
limit). v16.0.0 REMOVES it. The reasoning that put it there — a customer
PICKS a product, so it needs a category — inverted on contact with the
catalog: the same program name is sold against a payslip by one bank and
against a grade table by another, so the customer would have had to choose
between two cards describing one loan, and every catalog name worth
selling would have needed duplicating across both. What the bank reads is
a property of the BANK PROGRAM (`bank_program.programType`), decided per
program, and the applicant is simply asked the four facts as well as the
payslip questions. No category constrains the program type; the retired
`PROGRAM_TYPE_INVALID_FOR_CATEGORY` code and its exception are deleted.

**Which categories can sell a no-payslip program is DERIVED and
admin-configurable (v16.0.0).** There is no `SURROGATE_CAPABLE_` or
`SURROGATE_REQUIRED_CATEGORIES` list in any codebase — both are deleted,
not renamed. A category can carry a working no-payslip program exactly
when its applicants are ASKED at least one of the four surrogate facts,
which is recorded per question in `question_loan_category` and edited by
an admin on the questionnaire screen. This is not a proxy for the old
list; it is the real precondition, because a bank cannot work an income
out from a fact nobody was asked, whatever a constant says. `personal` and
`car` are the SEEDED DEFAULT, not a rule — assigning `military_grade` to
`mortgage` is all it takes to sell no-payslip mortgages, and the seed must
not be re-run to allow it. A rule configured on a program whose type is
`income_proof` is still reported as ignored; the report keys off the type
alone, matching the engine's own gate.

The platform supports EXACTLY these four retail loan categories. The
`loanPurpose` platform-enumeration registry MUST contain only these four
active members (`personal`, `car`, `mortgage`, `business`). Any other
category is out of scope and MUST be soft-deactivated rather than
introduced. Adding a FIFTH category requires a constitution amendment.

**Five-step wizard:**
1. About You — employment type, age, monthly income, time in job, salary transfer status
2. About the Loan — purpose, amount, duration
3. Personal Loan Details (if personal) — existing liabilities for DBR
4. Mortgage Details (if mortgage) — property value, down payment, property type (apartment/twin house/villa), compound status, construction stage A/B/C
5. Car Loan Details (if car) — car value, down payment

**Engine outputs:** Minimum down payment, monthly installment (PMT
formula), Debt Burden Ratio (DBR ≤ 50%), maximum loan available, ranked
matched programs (ordered by the applicant's stated priority; partner bank
then fewest documents when they have not stated one), required documents per
program.

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
decision returns `passedChecks[]` AND `failedChecks[]` arrays. Match reasons
surface as error codes across the API boundary — NEVER English text. The matching
service is a pure dependency-free TypeScript service that can run in isolation
against in-memory bank program fixtures.

**(v25.0.0) There is no approval score.** Approval probability, its tiers, its
per-program weight sets, its factor breakdown and the engine-version registry
around it are REMOVED — from the engine, from `bank_offer`, from the admin, and
from every customer surface. The number was a weighted sum of figures an admin
typed and was never once compared against a bank decision; v13.0.0 had already
had to downgrade the customer copy from "Guarantee Approval" to "% match", which
is the admission. Nothing replaces it. The platform states the figures it can
derive — installment, rate, fees, tenor, ceiling, documents — and orders the list
by what the applicant said they cared about. A score returns only when a backtest
against real bank outcomes earns it, and that is an amendment, not a PR.

**Ordering is the applicant's own priority, computed once and FROZEN.**
`rankOffers(offers, priority)` is the single authority: it sorts by the key the
applicant's `priority` answer names, then partner-bank first (`bankIsFeatured`),
then `programCode` lexically as a deterministic last resort. The apply path
persists the result as `bank_offer.rankIndex` — Int, 0-based, dense within one
application, written at creation and never updated (A6) — and every reader of a
persisted offer orders by `rankIndex asc`. Persisted rather than recomputed for
the reason `bankIsFeatured` and `rateBasis` are frozen (Principle I): the order
is an output of the engine over the profile, the priority and the whole candidate
set at match time, so re-sorting an immutable offer set later rewrites what the
customer was actually shown. All of an application's offers are written in one
transaction and share an identical `createdAt`, so there is no other key.

**`fastest_approval` orders by partner bank, then fewest required documents.**
It is the DEFAULT arm of all four mobile priority mappers and the fallback for an
unanswered (optional) `priority_factor`, so it carries most applications, not an
edge case — and its only sort key used to be the deleted score. The two proxies
that survive are the two the platform actually has: a live channel with a partner
bank, and less paper to collect. The `ApplicationPriority` enum member is
RETAINED — historical applications carry it. An arm of `rankOffers` with no sort
key of its own = review block.

**The customer preview orders by the same key chain.**
`POST /v1/matching/preview` persists nothing and so has no `rankIndex`, but it
MUST NOT carry an ordering of its own devising: it sorts by installment ascending
(unpriced programs last), then `bankIsFeatured`, then `programCode`, matching
`rankOffers`' `lowest_installment` arm. Preview and apply returning the same
programs in a different order for the same answers = review block — the v13.0.0
`isQuestionVisible` lesson applied to ordering.

Questions and answer options are **pure content** (label + order) — they carry NO
scoring or eligibility fields, and NO `category` column: they form a single
**GLOBAL question pool**, published as **one immutable versioned snapshot**. The
questionnaire that feeds the engine (questions, options, branching, ordering) is
admin-editable DATA; only the algorithm consuming it is code. The customer
questionnaire payload carries pure content only — anything a program configures
stays server-side (IP).

(v12.0.0) Each question is **assigned to one or more of the four loan
categories** through the `question_loan_category` join table, so one question can
serve several categories while the pool stays one canonical list with one
snapshot. The chosen loan category decides both which *programs* are matched and
which of the pool's *questions* are asked, but never which *questionnaire* is
served: there is only one. Assignment is authoritative — a question assigned to
nothing is asked by nobody — it lives ONLY in the join table, and it is **frozen
into the published snapshot**, so a later reassignment can never retroactively
change what an older version asked. A snapshot published before v12.0.0 carries
no assignment and reads as "asked for every category". `GET
/v1/questionnaire?category=` narrows the snapshot and fails loudly on an unknown
category (`VALIDATION_FAILED`, never a silent fallback); the apply path scopes
required-question enforcement to the same set, through the same shared
visibility rule.

**Eligibility gating is dropped for MVP**: there are no hard filters (salary /
age / DBR / loan-amount / max-loan) in either the customer preview or the
persisted apply flow — every active program in the chosen category is returned,
ordered as above, in BOTH surfaces. Program limits and DBR shape the AMOUNT,
never whether a program is listed.

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
- `matching/` — eligibility engine, tier resolver, PMT/DBR calculators, priority ranking
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
  birthday, and a password. `passwordHash` is non-null for PHONE.
- **SOCIAL sign-in (Google — the ONLY social provider, v11.0.0):**
  provider-token verification creates a lite customer row
  (`registrationPath = SOCIAL`, name seeded from the provider,
  `passwordHash = NULL`) → the same mandatory profile-completion step
  collects mobile + OTP, firstName, lastName, and birthday. SOCIAL
  customers never have a password and recover access via their provider.
  **Sign in with Apple is removed platform-wide** (v11.0.0): no
  `/auth/social/apple` or `/auth/apple/login` route, no Apple ID-token
  verifier, no `APPLE_BUNDLE_ID`, no `sign_in_with_apple` package, and
  `SocialProvider` carries `GOOGLE` only. Adding a second provider
  requires a constitution amendment. (App Store Guideline 4.8 does not
  bind us: the platform ships its own first-party phone + OTP signup.)

Profile photo and National ID front + back are OPTIONAL for both paths
(Principle XXXVII, v9.0.0) — a customer MAY upload either at any time via
the existing customer-scoped presign endpoints; neither is required to
finish profile completion or to reach any gated surface.

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
engine's correctness invariants remain governed by Principle V (engine
changes require PR review; offer order is frozen on the offer), but
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

**Modals overlay the full viewport (A34).** Every modal / dialog / sheet
backdrop MUST cover the entire viewport — scrim + blur dim the whole
screen (sidebar, top bar, content), never just the content panel.
Preferred mechanism is `NzModalService` / `NzDrawerService`, which portal
the surface to `document.body` and cannot be clipped. A hand-rolled
`position: fixed` scrim is allowed ONLY when it is NOT a descendant of any
ancestor that establishes a containing block for fixed elements
(`transform`, `filter`, `perspective`, `contain`, `will-change`) — render
it as a root-level sibling of the page content, not inside `section.page`
(which runs the `app-page-rise` transform). A modal whose blur stops at
the content panel edge = review block. Backdrop tokens
(`--color-overlay-backdrop`, blur radius) are shared so all modals dim
identically.

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
| `bank_offer.rankIndex` / the `rankOffers` comparator | apply persistence · every persisted-offer read (customer detail, applied list, idempotent replay, admin list, admin detail) · customer results list · saved-offers list · previous-applications list · matching preview (in-memory, same key chain) |
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

**Value selection = bottom sheet (default, NON-NEGOTIABLE, v8.1.0):** picking
one value (or several) for a form field uses a modal bottom sheet — never an
inline / floating / overlay dropdown, an accordion expand-in-place select, a
native `DropdownButton` / `DropdownButtonFormField` / `DropdownMenu`, or a
`PopupMenuButton` acting as a value picker.

- The trigger is a labeled `MasrafySelectField<T>` (a tappable field showing
  the current value or hint + a chevron); tapping it opens the shared
  `showMasrafySingleSelectSheet<T>` / `showMasrafyMultiSelectSheet<T>`.
- Selection is **instant tap-to-select**: a row tap applies the value and
  closes the sheet (no Save/Cancel footer). Dismiss (drag-down / back /
  tap-outside) leaves the value unchanged; an optional `nullOptionLabel` row
  commits a clear.
- Long lists pass `showSearch: true`; the sheet scrolls natively — no
  caller-managed max-height or overlay anchoring.
- One `MasrafySelectOption<T>` model (value + localized label) app-wide. The
  caller-owned accordion plumbing (`openField` / `toggleField`) the old
  floating dropdown required is forbidden — the sheet owns its own open/close.
- Exempt (NOT form-field value selection): action menus / kebabs
  (`MasrafyPopupMenu`), filter pills (`MasrafyDropdownPill`), and period
  selectors (`MasrafyPeriodSelector`).

**Sheet & dialog naming convention (NON-NEGOTIABLE):** every concrete
sheet under `bottom_sheets/` and every concrete dialog under `dialogs/`
follows `Masrafy[Action][ModalKind][Sheet|Dialog]` — e.g.
`MasrafyDeleteConfirmationSheet`, `MasrafyRenameInputSheet`,
`MasrafyLogoutConfirmationDialog`. Generic single-word names
(`MasrafyRenameSheet`, `MasrafyEditSheet`) = review block.

**Gradient hero header (NON-NEGOTIABLE, v5.1.0):** the brand gradient hero
is a SINGLE shared widget — `MasrafyGradientHeader`
(`core/widgets/common/`). Never fork the gradient, the glass back button,
or the title/subtitle stack into a feature.

- **Content-sized height (no fixed clip).** The hero height is DERIVED
  FROM CONTENT, never a hardcoded literal that clips a long title /
  subtitle / `bottom` bar or wastes space. Compute it with
  `MasrafyGradientHeader.expandedHeightFor(context, …)` (a `TextPainter`
  measure) — feed the result to the sliver `expandedHeight` and to the
  static header's `heightInPixels`. Keep a small `minHeight` floor
  (~180 logical px) so short heroes still read as a brand band; the
  header grows for long / two-line titles. A hardcoded `height` /
  `expandedHeight` literal that can clip content = review block.
- **Full title when collapsed.** The collapsed sliver toolbar shows the
  WHOLE title — wrap it in `FittedBox(fit: BoxFit.scaleDown)` (shrinks
  the font only when too wide), never `maxLines:1 + ellipsis` truncation.
- **Breathing space below the hero.** The content sheet's first element
  (avatar, field, card) MUST NOT hug the gradient — keep a visible gap
  between the hero's bottom edge and the first content widget (sheet top
  padding, net of the rounded `-28` overlap, ≥ ~12 logical px of gap).
- **Collapse on scroll (scrollable screens).** Any SCROLLABLE screen
  using the hero MUST render it as a collapsing sliver —
  `SliverPersistentHeader(pinned: true, delegate:
  MasrafySliverGradientHeaderDelegate(...))` inside a `CustomScrollView`
  whose `physics` is `BouncingScrollPhysics(parent:
  AlwaysScrollableScrollPhysics())`. On collapse it shrinks to a compact
  pinned toolbar: a SMALLER title (`heading4`) vertically centred on the
  back-button row, the subtitle faded out, the gradient + glass back
  button preserved. A static (non-collapsing) hero on a scrollable
  screen = review block.
- **Wizard hero follows its step's scroll (v5.1.2).** A button-driven
  `PageView` wizard (e.g. the mortgage questionnaire, which renders its
  `MasrafySegmentedProgress` in the hero's `bottom` slot) keeps the static
  hero ONLY while a step's form fits without scrolling. When a step's form
  scrolls, that step MUST host its OWN collapsing sliver hero — each
  `PageView` child is its own `CustomScrollView` +
  `SliverPersistentHeader(pinned)` (per-step collapse offset, so a short
  step always opens fully expanded; a single `NestedScrollView` over the
  PageView is forbidden — its shared offset leaves short steps
  pre-collapsed). The `bottom` progress bar fades with the hero on collapse
  (it returns on scroll-up); it stays visible on steps that never scroll.

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
   - PHONE customers additionally: `passwordHash` (non-null). SOCIAL
     customers have `passwordHash = NULL` and complete via their provider.

   `profilePhotoKey` and the National ID FRONT/BACK `Document` rows are NOT
   part of this contract (narrowed v9.0.0) — see Rule 3.
2. **Hard gate.** Backend MUST reject questionnaire-submit, matching, and
   `/applications/apply` for any customer whose profile is incomplete per
   Rule 1 with `PROFILE_INCOMPLETE`. The mobile app MUST route an incomplete
   customer into the profile-completion flow and MUST NOT render the gated
   surfaces. A missing profile photo or National ID is NEVER a reason to
   reject under this gate (Rule 3).
3. **Profile photo and National ID are optional, not gating.** Neither
   `profilePhotoKey` nor the two National ID `Document` rows are required to
   reach COMPLETE (Rule 1), to pass the hard gate (Rule 2), or to reach any
   part of the app including Home. A customer MAY upload either at any time,
   before or after profile completion, via the existing customer-scoped
   presign endpoints — uploading is never itself a precondition of anything
   in this Principle. (A separate, non-XXXVII business rule requires the
   National ID front+back at the select-offer commitment point — when the
   customer proceeds with a bank offer, never at the matching call; that rule
   lives with the application flow, not with profile completeness. Profile
   photo is NO LONGER part of that gate as of v9.1.0 — it is optional
   everywhere.)
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
Profile photo and National ID are PII-heavy, camera-driven uploads that
meaningfully slow first-run onboarding for no identity-assurance benefit at
the Home/browse/questionnaire stage; narrowing the mandatory gate to the
handful of fields that genuinely identify and secure the account (name,
birthday, and — for PHONE — a password) lets a PHONE-signup customer reach
Home immediately after OTP verification instead of stalling on a document
step. Both remain fully available to upload at any time via the existing
profile-document endpoints, and this Principle takes no position on whether
a later step (e.g. offer selection) chooses to require them
independently.

### Enforcement

Citing Principle XXXVII (or Anti-Patterns A31 / A32) blocks PRs that store
an `age` value instead of deriving from `birthday`, reintroduce
`profilePhotoKey` or National ID as a mandatory field of the Rule 1
completeness contract, or allow any gated surface to proceed past a profile
missing mobile+`mobileVerifiedAt` / firstName / lastName / birthday / (PHONE)
`passwordHash`.

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

## A24. Reserved (was: Approval Probability Without Documented Weights — retired v25.0.0)
Approval scoring was removed platform-wide in v25.0.0 — there are no weights
left to document. Slot reserved to keep downstream anti-pattern IDs stable.

## A25. Half-Updated Dependents (Principle XXIX)
Changing a field / enum / derivation / threshold / label-doubling-as-filter / numeric formatter / token / error code without updating every downstream reader in the same PR = review block. UI contradictions where the same business fact reads differently across list / detail / Kanban / drawer / analytics / timeline = automatic block. PR description MUST list "Dependents touched"; reviewers MUST scan for missing ones.

## A26. Fifth Retail Loan Category Without Amendment / Ghost Rows After Removal / A No-Payslip Category (Principle II scope-lock, v1.5.0 → v1.6.0 → v1.7.0 → v15.0.0 → v16.0.0)
Adding a FIFTH retail loan category (anything beyond `personal`, `car`, `mortgage`, `business`) via migration, seed row, DTO enum, UI multi-select, matching-engine branch, or analytics dimension — without first amending the constitution to widen the scope-lock — = review block. The v15.0.0 → v16.0.0 round trip on `fast` is the reference for what an amendment must carry, in ONE change (A25): the Prisma enum value, the shared category list on every surface (backend `ALL_LOAN_CATEGORIES`, Angular `LOAN_CATEGORIES`, Flutter `LoanCategory`), the questionnaire's own question set for it, the catalog's assignments, a colour token, and the label in every locale.

**Re-introducing the no-payslip product as a category is the same block (v16.0.0).** Whether the bank reads a payslip or works an income out from a fact about the applicant is `bank_program.programType`, chosen per program — not a category, not a `loanPurpose` member, and not a card on the mobile home screen. The same catalog name is sold both ways by different banks, so a category would force every such name to be duplicated and would ask the customer to choose between two descriptions of one loan. Equally a block: a hardcoded list of which categories MAY sell a no-payslip program (`SURROGATE_CAPABLE_CATEGORIES`, `SURROGATE_REQUIRED_CATEGORIES`, or any `isSurrogate*Category(category)` helper). Capability is DERIVED from whether a category's applicants are asked one of the four surrogate facts (`question_loan_category`), so widening the product is an admin action on the questionnaire screen, not a release. Removing a category requires a destructive migration that physically deletes the registry entry, all bank programs in that category, and all applications referencing it (cascade through bank offers, decisions, activities, documents). Append-only triggers must be temporarily disabled (`ALTER TABLE … DISABLE TRIGGER`) and re-enabled inside the same migration; a `DATA_ERASURE_COMPLETED` audit-event row records the wipe. Leaving deactivated rows behind = review block — operators see ghost categories in audit dashboards and registry pickers. Buyout pricing as a feature of an existing program (e.g. `pricing.buyoutRateDeltaPercent` on a `personal` program) is NOT a fifth category and is allowed.

## A27. Money / Amount Input Without the Grouping Directive (UI consistency, v1.6.1)
Any editable money or amount input — EGP loan amounts, monthly income, balances, asset values, uplift ceilings, tier-band thresholds, prices — that does NOT use the shared `MoneyInputDirective` (`appMoneyInput`, `admin/src/app/core/directives/money-input.directive.ts`) = review block. The directive is the single owner of: thousands-grouping display (`1,000,000`), caret preservation across re-grouping, and the **raw-string contract** — the `FormControl` value, the request payload, and the backend DTO see digit-only strings (optionally one decimal point), never separators. The following are blocks: re-implementing a per-input `(input)` formatting handler, storing a comma-formatted string in a `FormControl`, or shipping an ungrouped raw money input. Percent fields (interest rate, fee %, spread, LTV %, down-payment %) are NOT money and MUST NOT use the directive.

## A28. Mobile Method With More Than Two Params Not Promoted To a Request DTO (Principle XXX, v1.8.1)
Any datasource, repository, usecase, or cubit method on the Flutter client that takes MORE THAN TWO parameters as separate named or positional params (instead of a single typed `<Name>Request` DTO from `data/models/request/`) = review block. The DTO MUST be the same one the datasource serializes at the wire boundary — one payload shape, one place to evolve. Two-or-fewer params MAY use named params. Promoting to a DTO retroactively when a third param is added is mandatory, not optional. Existing pre-v1.8.1 call sites with 3+ params get a one-PR grace period to migrate.

## A29. Multiple Route-Level Widgets in One Page File (Principle XXXVI, v3.1.0)
Any `*_page.dart` / `*_pages.dart` / `*_dialog.dart` / `*_sheet.dart` / `*_picker.dart` file containing MORE THAN ONE public route-level widget = review block. Each route / navigable destination ships in its own file named after the widget. Private `_`-prefixed leaf helpers used by exactly one screen MAY co-exist below the page class in the same file. Helpers reused by 2+ screens MUST be promoted to the feature's `widgets/` or `core/widgets/` per Principle XXXIII. Existing pre-v3.1.0 multi-class page files (e.g. `phone_signup_pages.dart`, `forgot_password_pages.dart`, `complete_profile_pages.dart`) are technical debt; new PRs MUST NOT extend them.

## A30. Reserved (was: National ID Collected at Apply Instead of Profile Completion — retired v9.0.0)
National ID timing is no longer gated by Principle XXXVII (photo/National ID
are optional and non-blocking — see Rule 3, v9.0.0). Slot reserved to keep
downstream anti-pattern IDs stable.

## A31. Storing Age, or Accepting It From a Client, Instead of Deriving From Birthday (Principle XXXVII, v4.0.0; extended v11.0.0)
Any `age` column on the customer, persisted `age` field, or DTO that writes a customer's age to the database = review block. Store `birthday` (`DateTime`); derive age on read and validate the 18–80 range against the derived value.

**Extended v11.0.0:** an `age` field on ANY customer-facing request body (`/v1/applications/apply`, `/v1/matching/preview`, `/v1/calculator/quote`, …), or a customer surface that assumes a placeholder age, = review block. Every registration path collects `birthday` at profile completion, so the server always owns the number: derive it once via `CustomerProfileCompletenessService.getApplicantAge(customerId)`. A client that both fetches the derived age and posts it back is the same violation. Age prices money (the age-at-maturity rule shortens the tenor), so an assumed age makes preview and calculator figures disagree with the offer apply produces; surfaces that need it are `CustomerProfileCompleteGuard`-gated. The admin matching simulator is the one exception — it has no customer, so its sample applicant carries an explicit `age` on the ADMIN DTO only. `Application.age` remains a legitimate submission snapshot of the derived value.

## A32. Proceeding Past an Incomplete Profile (Principle XXXVII, v4.0.0; narrowed v9.0.0)
Allowing questionnaire-submit, matching, or `/applications/apply` to succeed for a customer missing any completeness field (mobile+verified, firstName, lastName, birthday; PHONE also passwordHash) = review block. Profile photo and National ID are NOT completeness fields (Rule 1/3) and MUST NOT be added back into this gate. Backend returns `PROFILE_INCOMPLETE`; mobile routes into the completion flow instead of rendering the gated surface.

## A33. Hand-Typed Questionnaire Codes / Reintroduced Scoring / Reintroduced Eligibility / Per-Category Questionnaires / Re-Derived Offer Order (Principle V, v6.0.0; global pool v10.0.0; category assignment v12.0.0; scoring removed v25.0.0)
Typing questionnaire question/option `code`s by hand instead of auto-generating + freezing them = review block. Adding a scoring or eligibility field back onto `Question`/`QuestionOption` (they are pure content), or reintroducing hard eligibility gates (salary / age / DBR / loan-amount / max-loan) into the preview or apply flow, = review block. **Reintroducing an approval score, approval probability, tier, match percentage, or any per-program answer-weighting table (`ScoringWeightSet` or a successor under another name) without a constitution amendment = review block (v25.0.0)** — the number was never once compared against a bank decision, so a fresh one is the same unbacked claim wearing a new name; earning it back needs the outcome loop, not a PR. **Reintroducing a `category` field onto `Question` / `QuestionGroup` / `QuestionnaireVersion`, or publishing a per-category questionnaire (a second pool, or one versioned snapshot per category) instead of the single GLOBAL one, = review block** — there is one pool and one snapshot. Loan-category scoping of *which questions are asked* is legal and lives ONLY in the `question_loan_category` join table (v12.0.0, many-to-many: one question serves several categories). Reading or deriving that assignment from anywhere else — a column, a code map, a naming convention on `code` — = review block, as is publishing a snapshot that omits each question's frozen `categories` or re-deriving them at read time (a reassignment would then silently rewrite what an older version asked). A category-filtered read MUST fail loudly on an unknown category rather than falling back to the whole pool.

**Preview and apply deriving the same engine input differently = review block.** Question visibility comes from the one shared `validation/question-visibility.ts`, the surrogate facts from the one shared `surrogate-facts-from-answers.ts`, and the order from the one shared `rankOffers` — the same answers must not produce two outcomes either side of apply.

**(v25.0.0 — the order is frozen, not derived.)** Ordering persisted offers by anything other than `bank_offer.rankIndex asc`, or re-deriving an offer's position at read time, = review block: the order the customer saw is part of what an immutable offer means (Principle I / A6), and every offer of one application shares an identical `createdAt`, so a read that drops `rankIndex` has no discriminating key and returns rows in unspecified order. Equally a review block: a `rankOffers` arm with no sort key of its own (it does not degrade quietly — it freezes an arbitrary order onto immutable rows), a `rankIndex` that is sparse or duplicated within one application's offer set, and a second comparator inside the customer preview instead of the shared key chain.

## A34. Modal Backdrop That Does Not Cover the Full Viewport (Angular Clean Code Structure, v4.1.1)
A modal / dialog / sheet whose scrim + blur dims only the content panel instead of the entire viewport (sidebar + top bar + content) = review block. Cause is almost always a hand-rolled `position: fixed` scrim rendered inside an ancestor that establishes a containing block for fixed elements (`transform` / `filter` / `perspective` / `contain` / `will-change`) — notably `section.page`, which runs the `app-page-rise` transform. Fix: prefer `NzModalService` / `NzDrawerService` (portals to `document.body`), or render the custom scrim as a root-level sibling of the page content (outside `section.page`). Use the shared backdrop tokens (`--color-overlay-backdrop`, shared blur radius) so all modals dim identically.

## A35. Fixed/Clipping or Non-Collapsing Gradient Hero (Principle XXXIII, v5.1.0; clarified v5.1.1, v5.1.2)
A `MasrafyGradientHeader` with a hardcoded `height` / `expandedHeight` literal that can clip its title / subtitle / `bottom` content (or wastes space), a hero whose content sheet hugs the gradient with no breathing space, a collapsed sliver toolbar that truncates the title with an ellipsis instead of showing it in full, OR a STATIC (non-collapsing) gradient hero on a scrollable screen = review block. Height MUST be content-sized via `MasrafyGradientHeader.expandedHeightFor(...)` (feed the sliver `expandedHeight` and the static header's `heightInPixels`, with a small `minHeight` floor); the collapsed toolbar title uses `FittedBox(fit: BoxFit.scaleDown)`. Scrollable screens host the hero in `MasrafySliverGradientHeaderDelegate` (`SliverPersistentHeader(pinned: true)` + `CustomScrollView` with `BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics())`), collapsing to a compact toolbar — smaller `heading4` title vertically centred on the back-button row, subtitle faded out, gradient + glass back button preserved. A button-driven `PageView` wizard keeps the static header ONLY for steps whose form fits without scrolling; a step whose form scrolls MUST host its OWN per-step collapsing sliver hero (each `PageView` child is its own `CustomScrollView` + `SliverPersistentHeader(pinned)` — a single `NestedScrollView` over the PageView is forbidden, its shared offset leaves short steps pre-collapsed). The `bottom` progress bar fades with the hero on collapse and stays visible on non-scrolling steps (v5.1.2).

## A36. Dropdown Instead of Bottom Sheet for Value Selection (Principle XXXIII, v8.1.0)
Selecting a value for a form field with an inline / floating / overlay dropdown, an accordion expand-in-place select, a native `DropdownButton` / `DropdownButtonFormField` / `DropdownMenu`, or a `PopupMenuButton` used as a value picker = review block. Single / multi value selection uses the shared **instant tap-to-select** bottom sheet (`showMasrafySingleSelectSheet<T>` / `showMasrafyMultiSelectSheet<T>`) opened from a `MasrafySelectField<T>` trigger, with one shared `MasrafySelectOption<T>` model (value + localized label). A row tap applies the value and closes the sheet — no Save/Cancel footer; long lists pass `showSearch: true` and the sheet scrolls natively. Caller-owned accordion plumbing (`openField` / `toggleField`) for selects is forbidden — the sheet owns its own open/close. Action menus / kebabs (`MasrafyPopupMenu`), filter pills (`MasrafyDropdownPill`), and period selectors (`MasrafyPeriodSelector`) are NOT value selection and are exempt.

---

# Governance

- Version SemVer. MAJOR = breaking principle removal/redefinition OR major structural reorganization. MINOR = new principle or section. PATCH = clarification / anti-pattern addition.
- Every amendment updates the version-history table below and the Recent Changes block in `CLAUDE.md`. Old long-form rationale lives in git history, not here.
- Brand color, primary stack, or any principle marked NON-NEGOTIABLE require explicit team sign-off recorded in the PR description.
- Reviewers cite principle numbers (e.g. "Principle X violated") or anti-pattern IDs (e.g. "A18") to block PRs.

## Version History

| Version | Date | Type | Summary |
|---|---|---|---|
| 14.0.0 | 2026-08-06 | MAJOR | **Principle V — every question type is scoreable.** The formula is untouched (`Σ_answered(questionWeight × answerScore ÷ 100) ÷ Σ_asked(questionWeight)`); what changes is that all four types can now produce that answer score, each by an admin-set rule stored in the same `ScoringWeightSet.weights` blob: `SINGLE_SELECT` by option score (unchanged), `MULTI_SELECT` by the picked options' scores combined through a per-question **aggregation** (`AVERAGE` default / `SUM_CAPPED` / `MAX` / `MIN`), `NUMERIC` by **half-open `[from, to)` bands** that must be ordered, gapless and cover −∞…+∞ (Decimal edges, Principle I), `TEXT` by **presence only** — pattern/keyword matching on free text is forbidden as unauditable and gameable. Before this version `SCOREABLE_TYPES = ['SINGLE_SELECT']`, so monthly income, existing debts, requested amount and term — all `NUMERIC` — priced the loan but contributed nothing to the match, and both the preview and apply paths silently dropped every non-single-choice answer before the scorer. Backend: `SelectedAnswer` becomes a discriminated union (`option` / `options` / `numeric` / `text`) and new pure `answerScoreFor` + `bandFor` derive the score, with the persisted factor breakdown re-pointed at the same function so score and explanation cannot drift; one shared `matching/scoring/answer-to-selected.ts` maps normalised answers for BOTH paths (the v13.0.0 `isQuestionVisible` lesson); `normalizeWeights` gains the three rule maps (absent on older rows — no migration, JSON-only) and its new-shape test switched from truthiness to key presence, which previously read a weights-only row as one bogus question. `saveWeights` now enforces the rule per type: new error codes **`WEIGHTS_MISSING_RULE`**, **`WEIGHTS_NUMERIC_BANDS_INVALID`**, **`WEIGHTS_RULE_TYPE_MISMATCH`** (all 422, ar + en); `QUESTION_TYPE_NOT_SCOREABLE` is retired-but-retained (the `PROFILE_PHOTO_REQUIRED` precedent). A weighted question with no rule was previously legal and silently capped the program — that hole is closed for option maps too. `listWeightableOptions` returns all four types plus each numeric question's bounds/unit; `questionsWithOptions` carries them (Decimal → string at the repository edge). Admin: step 3 of the scoring wizard becomes type-driven — a new shared `app-score-bands-editor` (edges only, so gaps/overlaps are unrepresentable rather than merely validated, with `scoreBandsErrorFor` mirroring the backend rule), an aggregation select with a plain-language consequence line, and a single presence score for text; per-type completion gates, blockers that name the offending question, and band tables auto-seeded from the question's own range. Seed emits the new rule shapes. Mobile: unchanged. A33 extended. |
| 13.0.0 | 2026-08-06 | MAJOR | **Principle V — the approval score is normalised over the questions the applicant was ASKED**, replacing the flat denominator of 100: `probability = Σ_answered(questionWeight × answerScore ÷ 100) ÷ Σ_asked(questionWeight)`. *Asked* = active + assigned to the applicant's loan category + visible after branching + scoreable type. Fixes two defects the flat form caused: (a) programs weighting different question sets were ranked against each other on incomparable scales, and (b) weight placed on a question the program's own category does not ask silently capped that program below 100% forever, with no error and nothing in the admin to reveal it — the two assignment axes (question→category, program→question) are set on different screens and nothing compared them. Skipping an asked question still costs its weight. Backend: `computeProbability(scoring, answers, askedQuestionCodes)` + new exported `askedWeightSum` (the factor breakdown divides by the same denominator, so contributions still sum to the score); `resolveAnswers` returns `{ resolved, askedQuestionCodes }` (an asked-but-skipped optional question produces no row, so the set cannot be recovered from `resolved`); `isQuestionVisible` promoted out of `questionnaire.service.ts` into shared `validation/question-visibility.ts` so preview and apply cannot drift; the mobile preview now scopes answers to the requested category (it previously read the whole pool while apply scoped, per v12.0.0). Same PR: unrated programs are distinguishable from bad fits — new `bank_offer.approvalUsedDefault` column (migration `offer_approval_used_default`, backfilled false) carried through the apply, admin, and saved-offer responses, because configuring a program later would otherwise retroactively change the meaning of an immutable offer (Principle I). Admin scoring editor gains a per-row "not asked" tag + a summary warning (warn, never block — an admin may legitimately tick a question before its category assignment catches up); `questionsWithOptions()` now selects `categories`. Mobile copy: **"{pct}% Guarantee Approval" → "{pct}% match"** and "{pct}% Approval" → "{pct}% match score" across all four surfaces, plus "Not rated yet" — the number is a weighted sum of admin-typed weights never once compared against a real bank decision, so it must not be worded as a guarantee or a probability of approval. It becomes "approval chance" only when a backtest against real outcomes earns it. A33 reworded. No new error codes. |
| 12.0.0 | 2026-08-04 | MAJOR | **Principle V — questions are assigned to loan categories.** The pool stays ONE global list with ONE versioned snapshot (v10.0.0 intact), but each question is now assigned to one or more of the four categories via the new `question_loan_category` join table (many-to-many — a question can serve several), so the chosen category decides both which *programs* match and which of the pool's *questions* are asked. Assignment is authoritative (assigned to nothing = asked by nobody), lives only in the join table, and is **frozen into the published snapshot**; a snapshot published before this version carries none and reads as "asked for every category". Migration `question_loan_category_assignment` creates the table and backfills all four categories for every existing question (behaviour unchanged until an admin narrows one). Backend: `activeSnapshot(category?)` + `GET /v1/questionnaire?category=` (unknown value → `VALIDATION_FAILED`, never a silent fallback), `resolveAnswers(answers, category?)` scopes required-question enforcement (apply passes `dto.category`), `publish()` freezes `categories`, `draftTree()` returns them, `CreateQuestionDto.categories?` defaults to all four, new `PUT /admin/questionnaire/questions/:id/categories` + `POST /admin/questionnaire/questions/categories` (bulk, one transaction + one publish). Admin: `/questionnaire` becomes a two-tab route shell — **Questions** (the existing pool builder) and **Loan categories** (a question × category tick matrix with column All/None actions, parked-question and dangling-branch warnings). Mobile: `getActive(category)` threaded datasource → repository → usecase → cubit; `QuestionnaireView` passes its category. Principle V + A33 reworded (A33 still blocks a `category` column and per-category questionnaires/snapshots). No new error codes. |
| 11.0.0 | 2026-08-04 | MAJOR | **Principle XIII — SOCIAL sign-in narrows to Google only; Apple removed platform-wide.** Backend: `apple-verify.service.ts` deleted, `POST /v1/auth/social/apple` + `POST /v1/auth/apple/login` deleted, `SocialAppleSignInDto` deleted, `verifyProviderToken()` collapses to the Google verifier (its `userInfo` param dropped), `APPLE_BUNDLE_ID` removed from the Zod env schema + both `.env.*.example`. Prisma: `SocialProvider` → `{ GOOGLE }` via migration `google_only_social_provider` (recreates the enum; deletes APPLE links/sessions and deactivates only accounts orphaned BY that delete). Mobile: `sign_in_with_apple` package + pod removed, Apple datasource/repository/usecase methods deleted, `SocialProvider` → `{ google }`, Apple buttons removed from login + onboarding (the onboarding one had been wired to the Google flow), ARB keys `auth_landing_action_apple` / `onboarding_apple` / `login_apple` deleted and the three "Google or Apple" strings reworded (ar + en). Admin: same three strings reworded in `error-codes.{ar-EG,en-US}.json`. No error code added or removed. **Also (A31, extended):** applicant `age` is no longer accepted on ANY customer request body — apply / matching-preview / calculator derive it from the authenticated customer's `birthday` via `CustomerProfileCompletenessService.getApplicantAge()`; the calculator gains `CustomerProfileCompleteGuard`; the mobile results cubit drops its `/auth/me`-then-post-it-back round-trip; the admin simulator keeps an explicit sample `age` on its own DTO. |
| 10.0.0 | 2026-07-24 | MAJOR | **Principle V — questionnaire becomes a single GLOBAL question pool.** `category` dropped from `Question` / `QuestionGroup` / `QuestionnaireVersion` (globally-unique `code`; one global versioned snapshot). The chosen loan category now filters only which *programs* are matched, never which *questions* are asked. Each bank program **selects which questions it scores on** via checkbox in a unified per-program scoring editor — assignment IS the `questionWeights` key set (no new join table); weights sum to 100 over the program's ASSIGNED questions. Migration `global_question_pool_merge_by_code` merges duplicate-code rows across the old categories into one canonical row (options unioned), re-points `application_answer` + weight-set references, drops the `category` columns. Admin: 4-category questionnaire tabs → one global pool builder (overview page removed, route → editor); per-program scoring editor gains an assign checkbox + "Distribute evenly" and drops `:category` from its route. Backend questionnaire/scoring endpoints drop the category param (`GET /admin/questionnaire/tree`, `versions/publish\|history`, `GET /admin/scoring/questions`, customer `GET /v1/questionnaire`); `seed-questionnaire` emits the merged global pool + per-program category pre-assignment. Principle V + A33 reworded; no new error codes. |
| 9.1.0 | 2026-07-13 | MINOR | Select-offer document gate (non-XXXVII, v9.0.1) narrowed: **profile photo dropped from the gate — only National ID front+back are required at the select-offer commitment point.** `assertSelectOfferDocuments()` no longer throws `PROFILE_PHOTO_REQUIRED` (National ID check only); profile photo is now optional EVERYWHERE (completeness + select-offer). `getProfileDocumentsStatus()` still returns `profilePhoto` (informational). Mobile apply-documents screen (`ApplyDocumentsPage`/`ApplyDocumentsCubit`) drops the photo tile + `photo*` state fields; CTA unlocks on both National ID sides. `SelectOfferState.needsDocuments` no longer matches `PROFILE_PHOTO_REQUIRED`. `PROFILE_PHOTO_REQUIRED` error code + ARB/JSON strings retained but unused (no cross-surface removal). Principle XXXVII Rule 3 parenthetical reworded. A32 unchanged. |
| 9.0.1 | 2026-07-11 | PATCH | Principle XXXVII Rule 3 parenthetical updated to the now-ratified select-offer document gate (non-XXXVII): profile photo + National ID front/back are required when the customer proceeds with a bank offer — `selectOffer()` calls `assertSelectOfferDocuments` (409 `NATIONAL_ID_REQUIRED` checked first, then new `PROFILE_PHOTO_REQUIRED`) — and `POST /v1/apply` NO LONGER requires any document (pre-9.0.1 apply-time `assertNationalId` removed; matched offers browse freely). `hasNationalId`/`assertNationalId` absorbed into `getProfileDocumentsStatus()` + `assertSelectOfferDocuments()`; lightweight `CustomerAccountRepository.findProfilePhotoKey()` added. New `GET /v1/profile/documents/status` → `{ profilePhoto, nationalIdFront, nationalIdBack }` for the mobile docs-screen pre-check. Completeness contract untouched (Rules 1/2 unchanged). Same-PR i18n: `PROFILE_PHOTO_REQUIRED` in admin en-US/ar-EG error JSONs + Flutter ARB `auth_profile_photo_required`. |
| 9.0.0 | 2026-07-11 | MAJOR | Principle XXXVII narrowed: profile photo (`profilePhotoKey`) and National ID FRONT/BACK are REMOVED from the mandatory completeness contract — COMPLETE now requires only mobile+`mobileVerifiedAt`, firstName, lastName, birthday, and (PHONE only) `passwordHash`. `CustomerProfileCompletenessService.evaluate()` drops the `profilePhotoKey` check; `customer-auth-mobile.service.ts#completeProfile()` no longer throws `PROFILE_INCOMPLETE` for a missing photo. A PHONE-signup customer can reach Home / the gated surfaces as soon as firstName+lastName+birthday+password are set, without ever uploading a photo or National ID. Photo + National ID upload endpoints (`CustomerProfileDocumentsController`) are UNCHANGED; the separate apply-time National ID requirement (`assertNationalId`/`NATIONAL_ID_REQUIRED`) is unaffected and stays outside this Principle. Rule 3 rewritten (was "National ID collected at completion, not apply" — now "photo/National ID optional, not gating"); Rules 1/2 narrowed; Rationale + Enforcement reworded. Principle XIII registration-path prose updated to drop photo/National ID from the mandatory profile-completion step. Anti-Pattern A30 retired (slot reserved, mirrors A9); A32 reworded to the narrowed field list. |
| 8.1.0 | 2026-06-27 | MINOR | Principle XXXIII extended: the **bottom sheet is the default value-selection control** on mobile. Inline / floating / overlay / accordion dropdowns (incl. the removed `MasrafyExpandableSelect`), native `DropdownButton` / `DropdownMenu`, and value-picking `PopupMenuButton`s are banned for form-field selection; use a `MasrafySelectField<T>` trigger opening the shared **instant tap-to-select** `showMasrafySingleSelectSheet` / `showMasrafyMultiSelectSheet`, with one `MasrafySelectOption<T>` model. The 33 questionnaire selects + the profile governorate picker migrated; per-cubit `openField` / `toggleField` accordion plumbing removed. Kebab / filter / period controls exempt. New Anti-Pattern A36. |
| 8.0.0 | 2026-06-17 | MAJOR | Principle V switched to a TWO-LEVEL model: per bank program, each QUESTION has a weight and all question weights sum to **100**, each ANSWER has a **score 0–100**; `probability = Σ_question(questionWeight ÷ 100 × pickedAnswerScore ÷ 100)` (max achievable = 100% by construction). Reverses v7.0.0's per-question ≤100 single-level points. `ScoringWeightSet.weights` shape → `{ questionWeights, answerScores }` (legacy rows upgrade on read with equal weights; no DB migration). Error codes `WEIGHTS_POINTS_OUT_OF_RANGE` + `WEIGHTS_QUESTION_OVER_BUDGET` removed; `WEIGHTS_QUESTION_WEIGHT_SUM_INVALID` + `WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE` added. A33 reworded. |
| 7.0.0 | 2026-06-17 | MAJOR | Principle V: per-bank-program answer points are now capped **per question** — the points across one question's options must sum to **≤ 100** (a percentage budget; each answer 1–100). Reverses the v6.0.0 "no sum constraint". The scoring formula is UNCHANGED (`probability = Σ(picked points) ÷ maxAchievablePoints`); only the editable-data rule changes. New error code `WEIGHTS_QUESTION_OVER_BUDGET` (422); the admin weights editor validates per-question totals and blocks save when over; pre-existing weight sets exceeding the cap surface as over-budget and must be adjusted. Anti-Pattern A33 extended. |
| 6.0.0 | 2026-06-17 | MAJOR | Principle V matching/scoring model simplified again for MVP. Questions + answer options become **pure content** (label + order) — all engine/eligibility fields dropped from `Question` (`systemRole`, `isScored`, `profileField`) and `QuestionOption` (`numericMin/Max`, `numericPoint`, `scoreValue`, `profileValue`); `QuestionSystemRole` enum removed. Approval probability is now **per-answer weighted**: `probability = Σ(points[questionCode][optionCode]) ÷ maxAchievablePoints`. Per bank program, points are assigned to individual answer **options** (nested `questionCode → optionCode → points` in `ScoringWeightSet.weights`, arbitrary scale, **no sum-100 constraint**). **Eligibility gating dropped entirely** (no salary/age/DBR/loan-amount/max-loan filters) in BOTH the customer preview and the persisted apply flow — every active program is returned, ranked by probability; the apply path runs the engine with `skipEligibility`. Error codes `OPTION_MISSING_SCORE_VALUE` + `WEIGHTS_MUST_SUM_TO_100` removed; `WEIGHTS_UNKNOWN_QUESTION` → `WEIGHTS_UNKNOWN_OPTION`. Anti-Pattern A33 rewritten. |
| 5.0.0 | 2026-06-16 | MAJOR | Principle V matching/scoring model simplified for MVP. Approval probability is now **per-question weighted** — `probability = Σ(option.scoreValue × questionWeight)/100` over a category's scored questions (`Question.isScored`), with per-bank-program weights keyed by `questionCode` summing to 100. The `ScoringFactor`/`scoringFactorCode` indirection and the COMPUTED `debt_burden` factor are removed from the probability (DBR stays an eligibility gate + max-loan cap only). The two-person **maker-checker** weight flow is REPLACED by **direct admin save** (editor ID audited; save archives prior ACTIVE + activates the new versioned set atomically); code-default equal-split fallback retained. Per-option `scoreValue` + internal mapping fields MUST be stripped from the customer questionnaire payload (IP). Anti-Pattern A33 rewritten accordingly. |
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
| 4.1.0 | 2026-06-02 | MINOR | Principle V extended for the Dynamic Questionnaire & Matching feature: questionnaire (questions/options/branching/order) and per-bank scoring weights + per-option sub-scores become admin-editable DATA; formula/tiers/COMPUTED factors stay code (≥90% tests). Weight changes move from PR review to an in-dashboard two-person maker-checker flow (checker ≠ maker, weights sum to 100, atomic activate+archive, both IDs audited); code-default fallback when no ACTIVE set. Questionnaire published as immutable versioned snapshots. New Anti-Pattern A33. The feature's mobile/customer endpoints remain JWT-gated (no guest — consistent with v4.0.0). |
| 4.1.1 | 2026-06-02 | PATCH | Angular Clean Code Structure: modal/dialog/sheet backdrops MUST dim the full viewport (sidebar + top bar + content), never just the content panel. Prefer `NzModalService`/`NzDrawerService` (portal to body); a hand-rolled `position: fixed` scrim must NOT live inside a containing-block ancestor (`transform`/`filter`/`contain` — e.g. `section.page`'s `app-page-rise`) and must use shared backdrop tokens. New Anti-Pattern A34. |
| 5.1.0 | 2026-06-17 | MINOR | Principle XXXIII extended with the **Gradient hero header** rule: single shared `MasrafyGradientHeader`; expanded height bounded ≤ 240 logical px (compact band, ~210–230); mandatory breathing space between the hero and the content sheet; scrollable screens MUST host the hero as a collapsing sliver (`MasrafySliverGradientHeaderDelegate` + `SliverPersistentHeader(pinned)` in a `CustomScrollView` with `BouncingScrollPhysics`), collapsing to a compact toolbar (smaller `heading4` title centred on the back-button row, subtitle faded, gradient + glass back button preserved); non-scrollable `PageView` wizards keep the static header. New Anti-Pattern A35. |
| 5.1.1 | 2026-06-17 | PATCH | Gradient hero height clarified from a fixed ≤240 bound to **content-sized**: callers compute it via `MasrafyGradientHeader.expandedHeightFor(context, …)` (`TextPainter` measure) — fed to the sliver `expandedHeight` and the static header's `heightInPixels`, with a ~180 logical-px `minHeight` floor — so it grows for long/two-line titles and never clips. Collapsed toolbar title MUST show in full via `FittedBox(scaleDown)` (no ellipsis truncation). A35 reworded accordingly. |
| 5.1.2 | 2026-06-17 | PATCH | Wizard hero rule clarified: a button-driven `PageView` wizard step whose form scrolls MUST host its OWN per-step collapsing sliver hero (each `PageView` child = its own `CustomScrollView` + `SliverPersistentHeader(pinned)`); a single `NestedScrollView` over the PageView is forbidden (shared offset leaves short steps pre-collapsed). The static header is only for non-scrolling steps; the `bottom` progress bar fades with the hero on collapse. Principle XXXIII bullet + A35 reworded; first applied to the mortgage questionnaire. |
| 15.0.0 | 2026-08-14 | MAJOR | **Principle II scope-lock widened from four retail loan categories to FIVE: `fast` (Fast Loans) added.** The no-payslip product: the bank cannot see a salary, so it works one out from a fact about the applicant (army grade, academic rank, years in practice, card limit) and prices off that. Its engine half already shipped as `bank_program.programType = 'income_surrogate'` (feature 011); this amendment gives it the customer-facing half — a category a customer picks, with its own question set, its own bank programs and its own ranked results — rather than a flag on `personal`, which would have made the questions asked depend on a program attribute the applicant never chose. Prisma `LoanCategory` gains `fast` (`20260814110000_fast_loan_category`, ADD VALUE, one-way). New rule + typed error: a Fast Loans program MUST be `income_surrogate` (`PROGRAM_TYPE_INVALID_FOR_CATEGORY`, 422, ar+en); the converse stays legal because business/professional programs use that type with `strategy: 'declared'`. A26 re-aimed at a SIXTH category and now records what an amendment must carry across all surfaces. |
| 15.1.0 | 2026-08-14 | MINOR | **Principle II: surrogate-CAPABLE (`personal`, `car`, `fast`) split from surrogate-REQUIRED (`fast`).** A personal or auto loan may also be sold with no payslip, so those two categories now ask the four facts, have their surrogate income rules READ instead of reported as ignored, and show the fact picker on their catalog tab. Not an A26 amendment — no category added, `ALL_LOAN_CATEGORIES` untouched, no migration. Backend: `SURROGATE_LOAN_CATEGORIES`/`isSurrogateCategory` renamed to `SURROGATE_REQUIRED_CATEGORIES`/`requiresSurrogateProgramType` (still the only driver of `PROGRAM_TYPE_INVALID_FOR_CATEGORY`), new `SURROGATE_CAPABLE_CATEGORIES`/`isSurrogateCapableCategory`; `collectIncomeRuleWarnings` narrows the category term to the capable set rather than dropping it, so a grade table on a mortgage or business program still warns; `SurrogateFactSpec.category` dropped (the capable list is the single authority) and the publish warning became a set difference with `missingCategories` (`reason: 'not_assigned_to_surrogate_categories'`). Seed assigns `military_grade` / `academic_rank` / `years_in_practice` to `car` (the card-limit fact already rode the obligation block) — **requires a re-seed + re-publish** for car applicants to be asked. No new error code. |
| 16.0.0 | 2026-08-14 | MAJOR | **Principle II scope-lock back to FOUR retail loan categories: `fast` (Fast Loans) removed, one day after v15.0.0 added it.** The no-payslip product is an income BASIS carried by `bank_program.programType`, not a product line: the same catalog name is sold against a payslip by one bank and against a grade table by another, so a category would have duplicated every sellable name and asked the customer to choose between two descriptions of one loan. Prisma `LoanCategory` back to four and the unapplied `20260814110000_fast_loan_category` migration deleted — the value never reached any database, so there is no destructive migration and no data to wipe. **Both category lists are DELETED, not renamed:** `SURROGATE_REQUIRED_CATEGORIES` / `requiresSurrogateProgramType` and `SURROGATE_CAPABLE_CATEGORIES` / `isSurrogateCapableCategory` are gone, and which categories can sell a no-payslip program is now derived from whether their applicants are asked one of the four surrogate facts (`question_loan_category`) — admin-configurable on the questionnaire screen, `personal` + `car` seeded as the default. `PROGRAM_TYPE_INVALID_FOR_CATEGORY` + its exception deleted across backend and both locale dictionaries (unthrowable once no category constrains the type). `collectIncomeRuleWarnings` drops the category term entirely and keys off `programType` alone, matching the engine's own gate — it previously reported a rule as ignored on categories the engine WOULD price off. Publish warning `not_assigned_to_surrogate_categories` → `not_asked_by_any_category` (a fact missing from one category is a product decision; a fact asked nowhere is a break). **Load-bearing fix:** the catalog usage counters were gated on the no-payslip CATEGORY, so removing it would have silently zeroed the board's only actionable warning while the three live `personal` + `income_surrogate` ABK programs stayed unconfigured — re-gated on `programType`, renamed `fastPrograms*` → `noPayslipPrograms` / `noPayslipProgramsWithoutTable`, pinned by `test/unit/no-payslip-usage-counters.spec.ts`. New derived `EnumerationMember.noPayslipFacts` (facts ticked per category) lets the program wizard filter its name picker by basis and warn, before saving, when the fact a method reads is not set up. Admin: catalog list is one grid with `All · Reads a payslip · No payslip` chips instead of two lanes; catalog name detail gains a "Sold without a payslip" switch on EVERY category tab; the wizard replaces the "Income-proof / Income-surrogate" dropdown with two step-1 choice cards, leads step 4 with the rule, groups the eleven methods by what they read, and gains an income row on the review step. `--color-cat-fast` → `--color-income-surrogate`. Flutter: enum member, home card, `pages/fast/`, route and ARB keys removed + regenerated. A26 re-aimed at a FIFTH category and now also blocks re-introducing the no-payslip product as a category or as a hardcoded capable-category list. |

| 25.0.0 | 2026-09-05 | MAJOR | **Principle V — approval scoring is REMOVED, and offer order becomes a frozen column instead of a derived score.** Both scoring systems go: the rule-based scorer (`matching/pipeline/approval-probability.ts`) and the two-level admin-weighted one (`scoring/`, `matching/scoring/`, `ScoringWeightSet`), together with the `ScoringEngineVersion` registry, `/admin/scoring/*` + `/admin/scoring-versions/*`, the admin weights editor, the approval pill, the tier filter chips and the "Why this score?" panel, and the mobile "% match" on all four surfaces. The number was a weighted sum of admin-typed figures never once compared against a bank decision — v13.0.0 had already had to reword it from "Guarantee Approval" to "% match", which is the admission. **Prisma:** `bank_offer.approvalProbabilityPercent / approvalScore / approvalTier / approvalFactors / approvalUsedDefault` DROPPED with `idx_bank_offer_approval_score`; `scoring_weight_set` and `scoring_engine_version` dropped; enum `ApprovalTier` dropped. `AuditEventType.SCORING_WEIGHTS_SAVED` and `.SCORING_ENGINE_VERSION_PROMOTED` are **RETAINED** — `audit_event` is append-only (Principle VI) and 12 live rows carry the first, so dropping the enum members would mean recreating the type against the audit log. `bank_offer.engineVersion` survives and now reads `MATCHING_ENGINE_VERSION` from code, since which build priced an offer is a fact about the code. 11 error codes deleted (8 `WEIGHT*`, 3 `SCORING_VERSION_*`) in one change with both admin dictionaries — `check:codes` 229 → 218, and 217 once the orphaned `platform_enumeration_question` template dropped with them; `QUESTION_TYPE_NOT_SCOREABLE` stays retired-but-retained as it already was. **What replaces the score is not another score — it is the order.** New `bank_offer.rankIndex` (Int, 0-based, dense per application) persists the output of the existing `rankOffers(offers, priority)`, which has always sorted by the applicant's own priority answer and whose result every read then threw away: the fallback `ORDER BY approvalScore DESC` re-sorted the list by a number the customer never asked to be sorted by, so somebody who chose "lowest monthly payment" was shown the highest-scoring offer first. Backfilled from the existing read order **before** the columns drop (two migrations in timestamp order, not one), verified byte-identical across all 53 applications on the dev database, so no historical list re-orders. **The defect the removal would otherwise have shipped with:** `rankOffers`' `fastest_approval` arm sorted by the deleted probability and nothing else, and it is the `_ =>` DEFAULT of all four mobile priority mappers plus the fallback for an unanswered (optional) `priority_factor` — the majority case, not an edge. Left alone it would have degraded to featured-then-programCode, i.e. alphabetical, and `rankIndex` would have frozen that alphabet onto immutable offers permanently. It now sorts partner-bank first, then fewest required documents; the enum member is retained for historical rows and A33 now blocks an arm with no sort key. The customer preview, which carried its own probability-desc comparator with no `programCode` last resort (so it was not even deterministic), moves to the same key chain. Admin applications list drops `?tier=high|medium`; its `createdAt desc` was already newest-first and is unchanged. A24 retired-but-retained on the A9 precedent — deleting it would renumber A25–A36, which are cited by number across CLAUDE.md, this file and ~40 source comments. A33 rewritten with the weights clauses excised, the questionnaire-pool clauses intact, and the preview/apply-parity clause re-homed off scoring because two live source comments cite it. Principle XXIX's obligations table swaps its `approvalScore`/`approvalTier` row — three of whose five listed dependents had already been deleted with lead-management — for a `rankIndex` row; Project Context, Engine outputs, Principle IX's `matching/` line and Principle XVI's weight-review parenthetical de-scored. |

---

**Version**: 25.0.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-09-05
