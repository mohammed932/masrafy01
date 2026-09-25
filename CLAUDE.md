# masrafy01 Development Guidelines

Auto-generated from feature plans + constitution. Last updated: 2026-08-13

## Project Identity

**Masrafy** (internally "Credit Match") — Egyptian fintech loan comparison marketplace. Connects users with 20+ bank loan programs (ABK Egypt + partners) via 5-step wizard + matching engine. Four product lines: personal loans, car loans, mortgages, business loans. Free for users; commission revenue from banks. Three platforms governed by a single constitution: NestJS backend (active), Angular admin dashboard (active), Flutter mobile app (deferred until Figma).

Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md) v29.0.0

**Product scope-lock (v16.0.0 / Principle II):** Platform supports exactly FOUR retail loan categories — `personal`, `car`, `mortgage`, `business`. **The no-payslip product is an income BASIS, not a category.** v15.0.0 shipped it as a fifth category (`fast`, "Fast Loans"); v16.0.0 removed it — the same catalog name is sold against a payslip by one bank and against a grade table by another, so a category duplicates every sellable name and asks the customer to choose between two descriptions of one loan. What the bank reads is `bank_program.programType` (`income_proof` / `income_surrogate`), chosen per program; the applicant is asked the four surrogate facts *as well as* the payslip questions. **No category constrains the program type** — `PROGRAM_TYPE_INVALID_FOR_CATEGORY` is deleted. **No hardcoded capable list either:** `SURROGATE_REQUIRED_CATEGORIES` and `SURROGATE_CAPABLE_CATEGORIES` are both DELETED (not renamed). A category can sell a no-payslip program exactly when its applicants are asked one of the four facts (`question_loan_category`) — admin-configurable on `/questionnaire/categories`, with `personal` + `car` seeded as the default, so widening the product is an admin action, not a release. Removing a category requires a destructive migration that physically wipes registry entry, bank programs, and all applications + cascade (offers / decisions / activities / documents). Ghost / soft-deactivated rows = review block. Adding a FIFTH, or re-introducing no-payslip as a category, requires a constitution amendment (A26).

## Active Technologies
- Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ (same strictness profile) on admin. (002-bank-programs)
- PostgreSQL 16 (Prisma migrations only; `db push` forbidden in production); Redis 7 (rate-limit + future audit-event buffer; NOT used as primary store for bank programs). (002-bank-programs)
- Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ on admin. (003-matching-engine-post)
- Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) · Angular 18 + TypeScript 5.4 · Flutter/Dart 3 (mobile) + NestJS 10, Prisma 5, `class-validator`, `@nestjs/swagger`, `decimal.js` (via `@prisma/client/runtime/library`) · ng-zorro-antd (`nz-*`) + `@angular/localize` on admin · flutter_bloc + Freezed + `auto_route` + `MasrafySelectField` on mobile (010-simple-programs-dbr-calculator)
- PostgreSQL 16 (Prisma migrations only) · Redis 7 (rate limit only; not used by this feature) (010-simple-programs-dbr-calculator)
- Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) · + NestJS 10, Prisma 5, `class-validator`, `@nestjs/swagger`, `decimal.js` (011-surrogate-admin-panel)
- PostgreSQL 16 (Prisma migrations only). Two migrations: `bank_program_value_sources` (011-surrogate-admin-panel)

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
- ng-zorro-antd 18 (`nz-*`) — the ONE UI library, repo-wide. Angular Material is NOT installed; a `mat-*` component in a PR is a review block. Modals/drawers via `NzModalService` / `NzDrawerService` (A34)
- `@angular/localize` (Arabic primary, English secondary)
- No constitutional testing requirements (Principle XXVII placeholder post-v1.2.0).

### Infrastructure

- PostgreSQL 16 (Prisma migrations only — `db push` forbidden in prod)
- Redis 7 (rate limit, lockout sliding-window counters, future refresh-token revoke broadcasts)
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
│   │   └── styles/         # _tokens.scss (#0869C3 base), _material-theme.scss
│   └── tests/              # unit (Vitest) / e2e (Playwright + axe-core)
├── docker/                 # compose.dev.yml, compose.test.yml
├── specs/001-admin-auth-users/   # spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md
└── .specify/               # constitution, scripts, templates
```

## Testing policy (operator decision, 2026-09-06)

**Do not write NEW unit tests.** The existing suites stay and must keep passing — run them as the
regression net and report their counts — but this repo does not grow new ones unless the operator
asks. Nothing constitutional is being waived: Principles XVI and XXVII are already explicit
placeholders ("no constitutional testing requirements").

What replaces them, and what a change is now expected to show instead:

- **The real database.** Migrations applied for real, with the figures every affected program
  quotes captured BEFORE and compared AFTER — a change that claims to move no money proves it.
- **The seeds.** `seed:blueprints` and `seed:sheet-figures` re-run and report 0 written / 0
  refused, which is what proves a migration wrote exactly what the seed would have.
- **A browser.** The screens driven on the running app, with page overflow measured at 0 and the
  console watched, in light, dark and RTL.
- **The checks.** `check:codes`, `check:income-proof`, `check:parent-keys`, `check:questionnaire`, `tsc`, lint, and both
  locale builds with the untranslated-id count measured against a worktree of HEAD.

If a change makes an existing test wrong, UPDATE that test — do not add a parallel one.

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
# Empty database? The full, ordered seed run (banks → questionnaire → catalog →
# programs → build → blueprints → sheet-figures) is in docs/fresh-install.md.
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
- **V — Matching Engine Is IP** (global pool v10.0.0; category assignment v12.0.0; **scoring removed v25.0.0**): pure module, zero HTTP deps, `match(profile, programs[]) → MatchResult[]`, always `passedChecks[]` + `failedChecks[]`, match reasons as error codes never English. **There is no approval score** — probability, tiers, `ScoringWeightSet`, the factor breakdown and the `ScoringEngineVersion` registry are all gone (v25.0.0); reintroducing any of them, under any name, needs an amendment (A33). It was a weighted sum of admin-typed figures never once compared against a bank decision — v13.0.0 had already had to reword it from "Guarantee Approval" to "% match", which is the admission. **Order is the applicant's priority, computed once and frozen**: `rankOffers(offers, priority)` sorts by the key their `priority` answer names → `bankIsFeatured` → `programCode` lexical (deterministic last resort); apply persists the result as `bank_offer.rankIndex` (Int, 0-based, dense, written at creation, never updated — A6) and every persisted read is `orderBy rankIndex asc`. Persisted, not recomputed, for the reason `bankIsFeatured`/`rateBasis` are frozen (Principle I) — re-sorting later rewrites what the customer was shown, and all of an application's offers share an identical `createdAt`, so there is no other key. **`fastest_approval` = partner bank, then fewest documents**: it is the `_ =>` DEFAULT of all four mobile priority mappers and the fallback for an unanswered (optional) `priority_factor`, so it is the *common* answer, and its only key used to be the deleted score; enum member retained for historical rows, an arm with no sort key = review block. **Preview uses the same key chain** — `/v1/matching/preview` persists nothing so has no `rankIndex`, but a comparator of its own devising there = review block (the `isQuestionVisible` lesson, applied to order). `bank_offer.engineVersion` survives and reads `MATCHING_ENGINE_VERSION` from code. Questions + answer options are **pure content** (label + order — NO scoring/eligibility fields) and **carry NO `category` column — one GLOBAL question pool** with a single versioned snapshot. (v12.0.0) Each question is **assigned to one or more loan categories** via the `question_loan_category` join table (many-to-many — one question can serve several), so the chosen category filters BOTH which *programs* match and which of the pool's *questions* are asked — never which *questionnaire* is served (there is one). Assignment is authoritative (assigned to nothing = asked by nobody), lives only in the join table, and is **frozen into the snapshot** (a pre-v12 snapshot carries none → reads as all categories). `GET /v1/questionnaire?category=` narrows the snapshot (unknown value → `VALIDATION_FAILED`, never a silent fallback) and apply scopes required-question enforcement to the same set through the same shared visibility rule. **(v29.0.0) A SECOND, narrower axis: the catalog program name the applicant picked.** `?programNameKey=` serves the category's asked set intersected with the questions a program behind that name can be quoted from, plus a CORE every quote needs — one program asks 3 questions and another 15, on EITHER income basis (a payslip program reads facts through `loanLimits.maxLoanByFact` exactly as a no-payslip one reads them through its calculation). Still ONE pool and ONE snapshot: a per-request projection, **read LIVE and never frozen** (its inputs are bank-program rows and `surrogate_product_ask`, not questionnaire content, and a frozen copy goes stale in the ceiling-RAISING direction), derived by ONE shared pure `questionnaire/validation/question-scope.ts` that serve, apply and preview all call, from the programme set `matchesRequestedScope` selects for the same request. What a programme reads comes from `effectiveIncomeRule` + its cap table, never the raw column. CORE = no bound fact ∨ reserved fact ∨ a money/obligation code ∨ no product asks the fact — all four from existing constants, the last one being what stops one tick un-asking a question for every other name. Gate-closed to a fixpoint both ways with the post-condition asserted. A served question the programme reads is REQUIRED. `programNameKey` narrows what is ASKED and REQUIRED, **never what may be ANSWERED**, so every installed app build keeps applying. **Eligibility gating dropped for MVP** (no salary/age/DBR/loan-amount/max-loan): every active program in the chosen category is returned, ordered as above, in BOTH preview and apply — limits and DBR shape the AMOUNT, never whether a program is listed.
- **VI — PII Protection**: encrypt at rest; logs never carry PII; documents in S3 with presigned URLs; audit log append-only.
- **VII — Observability**: `X-Correlation-Id` everywhere; `/health/live` + `/health/ready`; structured JSON logs (Pino); discrete business events.
- **VIII — Brand**: `#0869C3` azure blue primary. Use tokens, never raw hex.

### Backend

- **IX — Feature Modules**: organize by domain (`auth/`, `users/`, etc.). `common/` MUST NOT import from features.
- **X — Repository Pattern**: services NEVER touch Prisma directly. Use `*.repository.ts`.
- **XI — Prisma Migrate Only**: `db push` forbidden in prod. Named migrations; indexes on FKs + hot WHERE/ORDER BY.
- **XII — DTO vs Entity**: `class-validator` DTOs; Prisma types stay in repositories. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- **XIII — Dual Auth (v3.0.0)**: JWT-only across both API surfaces — HMAC removed platform-wide. Admin JWT (15 min access + 7-day refresh httpOnly cookie). **Customer JWT** on `/api/v1/*` — 15 min access + 30-day refresh, response-body strings (not cookies), stored ONLY in `flutter_secure_storage`. Server-side refresh rotation + reuse detection: replaying a rotated refresh token revokes the session family. Separate signing keys `CUSTOMER_JWT_ACCESS_SECRET` / `CUSTOMER_JWT_REFRESH_SECRET`; bcrypt cost ≥ 12 with `select: false`. Two registration paths, both LITE at OTP/provider then completed via the mandatory profile-completion step (Principle XXXVII): PHONE-signup (mobile+OTP → lite row → firstName+lastName+birthday+password) and SOCIAL (provider → lite row, no password → mobile+OTP+firstName+lastName+birthday). **SOCIAL = Google only (v11.0.0)** — Apple sign-in removed platform-wide (no `/auth/social/apple`, no `/auth/apple/login`, no `APPLE_BUNDLE_ID`, no `sign_in_with_apple`; `SocialProvider` = `GOOGLE`). A second provider needs an amendment. Profile photo + National ID are optional, uploadable any time, never gating completeness (v9.0.0); only National ID is required at the select-offer commitment point (v9.1.0 — profile photo dropped from the gate, optional everywhere). NO guest mode; `Application.isGuest`, `mobileClientId`, and the claim endpoint are removed from code and MUST NOT be reintroduced. Login lockout: 10 failures / 15 min → 30 min. Forgot-password PHONE-only.
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

### Flutter (Mobile — v3.0.0)

- **XXVIII — Clean Architecture + Cubit/Freezed (skeleton)**: data/domain/presentation per feature; customer JWT access + refresh tokens only in `flutter_secure_storage` (no HMAC, no shared-secret); Dio bearer interceptor + silent refresh on 401; `auto_route` v9+; design tokens in `MasrafyColorTheme` (`#0869C3` azure).
- **XXX — Three-Layer Feature Architecture**: `masrafy-app/lib/features/<name>/{data,domain,presentation}`. Models stay in data; entities returned by repositories; `Either<Failure, T>` from every repo method.
- **XXXI — Cubit + Freezed State Management**: one cubit per screen by default; multi-field forms use `updateField(FieldEnum, Object)` with exhaustive switch; cubits are orchestration-only (data logic on the Freezed state); cross-feature cubit sharing forbidden.
- **XXXII — Per-Flow Page Library Pattern**: `presentation/pages/<flow>/<flow>.imports.dart` owns flow's imports; screen files are `part of` it; flow-local widgets under `<flow>/widgets/`; feature-shared widgets under `pages/widgets/`; one widget per file.
- **XXXIII — Shared Widget Reuse**: `masrafy-app/lib/core/widgets/<category>/` is the only home for cross-feature widgets; sheet/dialog/picker/app-bar surfaces extend their mandated base; naming `Masrafy[Action][ModalKind][Sheet|Dialog]`. **Value selection (single/multi) uses the shared instant tap-to-select bottom sheet** (`MasrafySelectField<T>` trigger → `showMasrafySingleSelectSheet`/`showMasrafyMultiSelectSheet`, one `MasrafySelectOption<T>`) — NO inline/floating/overlay/accordion or native dropdowns; kebab/filter/period menus exempt (v8.1.0, A36).
- **XXXIV — Shape-Matched Shimmer**: every async screen renders a shimmer skeleton mirroring the layout; centered spinner on first-load of content-bearing screens = review block; shimmer re-fires on every reload, not only first load.
- **XXXV — Cross-Feature Sub-Feature Reuse**: cubit + state + widgets shared across ≥2 features lives at `masrafy-app/lib/core/features/<concern>/`; promote on second use; each consumer gets a fresh `getIt<>()` cubit.
- **XXXVI — One Screen, One File (v3.1.0)**: every navigable screen ships as exactly one public widget in its own `*_page.dart` (or `_dialog.dart` / `_sheet.dart` / `_picker.dart`) file. Private `_`-prefixed leaf helpers used by only that screen MAY co-exist below the page class. Helpers reused by ≥2 screens → promote per XXXIII. Page files are UI-only (no datasource calls, no token signing).

### Cross-Platform (added v4.0.0)

- **XXXVII — Mandatory Profile Completeness (v4.0.0, narrowed v9.0.0, NON-NEGOTIABLE)**: account unusable (questionnaire + matching + apply gated, backend `PROFILE_INCOMPLETE`) until complete: mobile+verified, firstName, lastName, birthday (PHONE also passwordHash). Profile photo (`profilePhotoKey`) and National ID front+back are OPTIONAL for completeness — never required to complete the profile or reach any gated surface; upload any time via the existing endpoints. National ID (front+back) IS required at the **select-offer commitment point** (non-XXXVII gate, v9.1.0) — 409 `NATIONAL_ID_REQUIRED`; profile photo is NOT gated there (v9.1.0, dropped `PROFILE_PHOTO_REQUIRED` throw); `POST /v1/apply` requires no documents; the mobile docs screen pre-checks via `GET /v1/profile/documents/status`. Age DERIVED from `birthday`, never stored. Photos/ID, when uploaded, follow Principle VI.

## Anti-Patterns (Binding — see constitution Appendix)

- **A1** Hardcoded bank logic
- **A2** English errors to clients
- **A3** Float for money
- **A4** PII in logs
- **A5** Direct Prisma in services
- **A6** Mutable BankOffer after match
- **A7** Schema via `db push`
- **A8** Leaking Prisma types through controllers
- **A9** Reserved — was "Skipping HMAC in mobile tests", retired v3.0.0 (HMAC removed)
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
- **A23** JWT access/refresh token outside `flutter_secure_storage` (restated v3.0.0)
- **A24** Reserved — was "Approval probability without documented weights", retired v25.0.0 (approval scoring removed platform-wide; no weights left to document)
- **A25** Half-updated dependents (cross-surface drift) — Principle XXIX
- **A26** FIFTH retail loan category without amendment / ghost rows after removal / **re-introducing no-payslip as a category or as a hardcoded capable-category list** (Principle II scope-lock, v1.5.0 → v1.6.0 → v1.7.0 → v15.0.0 added `fast` → v16.0.0 removed it). An amendment must carry: Prisma enum value + migration, every surface's category list (backend `ALL_LOAN_CATEGORIES`, Angular `LOAN_CATEGORIES`, Flutter `LoanCategory`), the questionnaire's question set for it, catalog assignments, a colour token, and labels in every locale — in ONE change (A25)
- **A27** Money / amount input without `MoneyInputDirective` (`appMoneyInput`)
- **A28** Mobile datasource/repository/usecase/cubit method with >2 params NOT promoted to a typed `<Name>Request` DTO (Principle XXX, v1.8.1)
- **A29** Multiple route-level widgets in one page file (Principle XXXVI, v3.1.0)
- **A30** Reserved — was "National ID collected at apply instead of profile completion", retired v9.0.0 (National ID timing no longer gated; Principle XXXVII narrowed)
- **A31** Storing age instead of deriving from `birthday`, **or accepting `age` on any customer request body / assuming a placeholder age** — apply / preview / calculator derive it via `CustomerProfileCompletenessService.getApplicantAge()`; only the ADMIN simulator DTO carries an explicit sample `age` (Principle XXXVII, v4.0.0; extended v11.0.0)
- **A32** Proceeding past an incomplete profile (Principle XXXVII, v4.0.0; narrowed v9.0.0) — profile photo/National ID are no longer completeness fields, must not be added back into this gate
- **A33** Hand-typed questionnaire codes / adding scoring or eligibility fields back onto `Question`/`QuestionOption` / reintroducing eligibility gates into preview or apply / **reintroducing an approval score, probability, tier, match percentage or any per-program answer-weighting table under any name without an amendment (v25.0.0)** / **reintroducing a `category` field on `Question`/`QuestionGroup`/`QuestionnaireVersion`, or a per-category questionnaire (a second pool / one snapshot per category) — there is ONE pool and ONE snapshot; per-category question scoping is legal but lives ONLY in `question_loan_category` (v12.0.0), must be frozen into the snapshot (never re-derived at read time), and a category-filtered read must fail loudly on an unknown category instead of returning the whole pool** / **freezing the PROGRAM-NAME axis into the snapshot, deriving it anywhere but the one shared `question-scope.ts`, reading what a programme needs off the raw `incomeAssumption` column instead of `effectiveIncomeRule`, a narrowed set that is not gate-closed over `enabledWhen`, a hand-typed core list instead of the existing money/obligation/reserved constants, a name-filtered read that falls back to the whole set on an unknown name, or REJECTING an answer to a question the category asks because the picked name did not need it (v29.0.0)** / preview and apply deriving the same engine input differently (visibility, surrogate facts, or order — one shared function each) / **ordering persisted offers by anything but `bank_offer.rankIndex asc`, re-deriving an offer's position at read time, a `rankOffers` arm with no sort key of its own, or a sparse/duplicated `rankIndex` within one application (v25.0.0)** (Principle V, v6.0.0; global pool v10.0.0; category assignment v12.0.0; scoring removed v25.0.0)
- **A34** Modal/dialog/sheet backdrop that dims only the content panel, not the full viewport — usually a `position: fixed` scrim trapped inside a containing-block ancestor (`transform`/`filter`/`contain`, e.g. `section.page`'s `app-page-rise`). Use `NzModalService`/`NzDrawerService` or render the scrim as a root-level sibling; shared backdrop tokens (Angular Clean Code Structure, v4.1.1)
- **A35** Gradient hero with a hardcoded `height`/`expandedHeight` literal that clips content (use content-sized `MasrafyGradientHeader.expandedHeightFor(...)` → sliver `expandedHeight` + static `heightInPixels`, ~180px `minHeight` floor), a collapsed toolbar that ellipsis-truncates the title (use `FittedBox(scaleDown)`), a hero hugging content with no breathing space, or a static (non-collapsing) hero on a scrollable screen. Scrollable screens host the hero in `MasrafySliverGradientHeaderDelegate` (`SliverPersistentHeader(pinned)` + `CustomScrollView` w/ `BouncingScrollPhysics`), collapsing to a compact toolbar (`heading4` title centred on the back-button row, subtitle faded); a button-driven `PageView` wizard keeps the static header ONLY for non-scrolling steps — a step whose form scrolls hosts its OWN per-step collapsing sliver hero (each `PageView` child = its own `CustomScrollView` + `SliverPersistentHeader(pinned)`; a single `NestedScrollView` over the PageView is forbidden — shared offset pre-collapses short steps), the `bottom` progress bar fading with the hero on collapse (Principle XXXIII, v5.1.0; clarified v5.1.1, v5.1.2)
- **A36** Dropdown / floating-overlay / accordion / native `DropdownButton`/`DropdownMenu` / value-picking `PopupMenuButton` used for form-field value selection instead of the shared instant tap-to-select bottom sheet (`MasrafySelectField<T>` trigger + `showMasrafySingleSelectSheet`/`showMasrafyMultiSelectSheet`, one `MasrafySelectOption<T>`; row tap applies + closes, long lists `showSearch: true`); caller-owned `openField`/`toggleField` accordion plumbing for selects forbidden; kebab/filter/period menus exempt (Principle XXXIII, v8.1.0)

## Recent Changes

Full notes (rationale, verification evidence, "not done" lists) live in [docs/CHANGELOG.md](docs/CHANGELOG.md) — read the specific entry only when working on that area. One-line index, newest first:

- 2026-09-25 v30.5.1 — the two dead lookup lists go: "Units owned" (`unit_count_owned`, with ABK's never-firing +10% multi-unit adjustment and the compound product's uplift) and the retired "Unit ownership", both with their switched-off questions; `check:question-scope` and `check:questionnaire` green again.
- 2026-09-24 v30.5.0 — every question checked against its readers and the bank sheets: no-payslip names ask debts, duration and employment type again; employment type no longer dropped on payslip names; mortgage term to 300; net-income wording; duplicate "لواء" grades retired; used-car model year required; `check:questionnaire` guards seven invariants.
- 2026-09-24 v30.4.2 — a car applicant is asked every debt they tick (car loan, mortgage, card were counted as zero), and car insurance / new-or-used / club branch / existing-bank questions leave car: nothing there reads them.
- 2026-09-24 v30.4.1 — the auto product stops asking a car buyer about a business and a compound: its four always-pass sheet conditions and three of their questions are removed; home ownership stays for the financed-share table.
- 2026-09-21 v30.3.0 — I-Score becomes program-level policy: every programme can state a bureau-score table, payslip ones included. (DBR was already on all 71.)
- 2026-09-15 v30.2.1 — step ② of the auto-loan product leads with the plan table, and the frame around it stops shouting over it.
- 2026-09-14 v30.2.0 — the plans card is three tabs, and its table header has nothing in it that can be pressed.
- 2026-09-14 v30.1.0 — a car finance plan is ONE LINE on screen, not five collapsed tables.
- 2026-09-14 v30.1.1 — one column per figure, and the exceptions said once.
- 2026-09-13 v30.0.0 — a car finance PLAN is a row, the product states five of them once, and the five Suez Canal down-payment tiers become ONE programme.
- 2026-09-13 v29.1.0 — a surrogate product states the loan duration once, and a bank program that states none reads it.
- 2026-09-10 v29.0.0 — every program asks only its own questions, payslip and no-payslip alike.
- 2026-09-09 v28.0.0 — the conditions the sheets print stop being prose in `notes` and start refusing, and the exemption lives in the ANSWER because it cannot live in a gate…
- 2026-09-09 v27.1.0 — the two Suez Canal auto products are ONE product with two ways, and a second column may belong to one way.
- 2026-09-08 v27.0.0 — a down payment is proof of income, and the share of a car's price a bank finances finally caps the loan.
- 2026-09-07 v26.2.1 — a compound is priced in ONE class, and the class board finally says so: the cards stop being checkboxes.
- 2026-09-07 v26.2.0 — I-Score is a TIER TABLE the surrogate product states once, and the debt-burden cap for its figure too; a bank program overrides either.
- 2026-09-07 v26.1.0 — the bank-program wizard is five steps, not eight, and three refusals that blocked Continue in silence now say what is wrong.
- 2026-09-06 v26.0.0 — every surrogate bank program picks exactly ONE way, no product exempt; the choice moves to its own step BEFORE the amounts; and I-Score becomes statab…
- 2026-09-06 v25.1.0 — the wizard's income step is one card of three labelled bands, and the table of "other money the bank counts" stops asking what percentage of a contrac…
- 2026-09-05 v25.0.0 — the match percentage is deleted, and what the customer was shown is stored as an ORDER instead of re-derived from a score.
- 2026-09-05 v25.0.0 — the two ABK doctor sheets become two PRODUCTS, and the applicant's own pick is what tells them apart.
- 2026-09-05 v24.0.0 — the two ABK doctor sheets quote their own figures, to their own applicant: Giza is re-tiered, the cap reads where the doctor PRACTISES, and one answer…
- 2026-09-04 v23.1.0 — step ③ names the catalog name instead of printing its slug, a bank programme keeps the name the bank gave it, and every focus ring that was invisible…
- 2026-09-04 v23.0.2 — step ③ of a product names the bank programmes under it instead of printing their codes.
- 2026-09-04 v23.1.0 — a share of a unit is a NUMBER the applicant types, not a yes/no over a list, and the ceiling is scaled by it.
- 2026-09-04 v23.0.1 — the doctors product is named after the profession, and the product grid is ordered by the name on the card.
- 2026-09-03 v23.0.0 — what a no-payslip product ASKS is picked from the question pool, per loan type, and membership becomes a table.
- 2026-09-03 v22.1.0 — the amount each answer carries is typed beside the answers, on every surrogate product.
- 2026-09-03 v22.0.0 — a no-payslip product is SEEDED, not created: the admin's only lifecycle action on one is ON / OFF, and OFF stops it being used anywhere.
- 2026-09-03 v21.0.0 — a no-payslip product is PICKED from a library of real products, not assembled from a shape; picking one builds everything it asks; and the raw step bu…
- 2026-09-01 v20.4.0 — a product's ways are picked where the product is created: the shape cards go multi-select, and a ceiling may be keyed by a plain choice.
- 2026-09-01 v20.3.0 — the six gaps between `docs/surrogate-income-templates-implementation-spec.md` and the code, closed.
- 2026-08-31 v20.2.0 — surrogate products move ONTO the program catalog: one section, one sidebar item, and the Surrogate chip stops filtering names and starts listing calcu…
- 2026-08-29 v20.1.0 — a list is loaded by PASTING it: one request, one transaction, one questionnaire publish. The compound lists are back on, and an untick has somewhere t…
- 2026-08-28 v20.0.0 — a no-payslip product is AUTHORED by answering three plain questions; the graph editor becomes Advanced, and it is one-way.
- 2026-08-27 v19.1.0 — an add/edit form is a SIDE SHEET, not a modal; a form too big for a sheet gets its own SCREEN.
- 2026-08-26 v19.0.0 — a surrogate product AUTHORS what it asks: the list, the question and the fact, from its own screen. The compound demo is deleted.
- 2026-08-25 v18.4.0 — a no-payslip product is a ROW, not a copy: `surrogate_product` archetypes, and the compound lists move onto the product that reads them.
- 2026-08-24 v18.3.0 — the compound-class board's tick is a real checkbox: unticking takes the compound out of its class and leaves it in none.
- 2026-08-23 v18.2.0 — three compound classes instead of five, and a board that says where each compound is priced.
- 2026-08-23 v18.1.7 — a code-review pass over the compound-owner product: five live defects in the rule engine and its two screens, plus the review's reuse and convention f…
- 2026-08-23 v18.1.6 — "The whole calculation, step by step" numbers its lines in a grid column and says what each one reads.
- 2026-08-23 v18.1.5 — the group rail is one segmented control, and a figure carries its unit inside the field.
- 2026-08-23 v18.1.4 — step 1 of the program-name screen fits a screen, and its Save works for the first time.
- 2026-08-23 v18.1.3 — `/program-catalog/:key` is three steps, and the loan-type assignment is ONE screen instead of four tab clicks.
- 2026-08-23 v18.1.2 — "How the income is worked out" is grouped by what the operator has to DECIDE, and the section is styled by tokens that exist.
- 2026-08-23 v18.1.1 — the collateral DEMO is two products, and the retired one is deleted rather than left live.
- 2026-08-22 v18.1.0 — the second column: a bank may lend more to a customer it already has, and the applicant is who says so.
- 2026-08-19 v18.0.0 — a rule may output a borrowing CEILING instead of an income: collateral products (compound ownership, club membership) are DATA.
- 2026-08-17 v17.0.0 — a catalog program name states exactly ONE income proof; every surrogate program under it reads that one, and a bank changes only the AMOUNTS.
- 2026-08-16 v16.5.0 — a catalog name states ONE income basis per loan type, not a set: radios, and a seed that converges on one.
- 2026-08-16 v16.4.1 — the catalog name's income BASIS is back on Add and Edit program name; its ENFORCEMENT stays gone.
- 2026-08-16 v16.4.0 — the stored income BASIS on a catalog name is DELETED; the bank's own program is the only place the basis is stated, and the catalog REPORTS it.
- 2026-08-15 v16.3.0 — the operator-facing surrogate-fact surfaces are DELETED: the per-name fact tick-list and the Manage values "Income facts" rail.
- 2026-08-15 v16.2.0 — the surrogate income FACT registry is DATA: an operator adds one on Manage values.
- 2026-08-15 v16.1.0 — the income basis is STORED on the catalog name, per loan category, and the API enforces the pairing.
- 2026-08-14 v16.0.0 — `fast` removed; no-payslip is an income BASIS, not a loan category.
- 2026-08-14 v15.1.0 — surrogate-CAPABLE ≠ surrogate-REQUIRED.
- 2026-08-14 v15.0.0 — fifth loan category `fast` = "Fast Loans", the no-payslip product.
- 011-surrogate-admin-panel: Added Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) · +…
- 2026-08-06 v14.0.0 — Principle V: every question type is scoreable.
- 2026-08-06 v13.0.0 — Principle V: the score is normalised over the questions the applicant was ASKED

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
