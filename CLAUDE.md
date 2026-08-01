# masrafy01 Development Guidelines

Auto-generated from feature plans + constitution. Last updated: 2026-07-30

## Project Identity

**Masrafy** (internally "Credit Match") — Egyptian fintech loan comparison marketplace. Connects users with 20+ bank loan programs (ABK Egypt + partners) via 5-step wizard + matching engine. Four product lines: personal loans, car loans, mortgages, business loans. Free for users; commission revenue from banks. Three platforms governed by a single constitution: NestJS backend (active), Angular admin dashboard (active), Flutter mobile app (deferred until Figma).

Constitution: [.specify/memory/constitution.md](.specify/memory/constitution.md) v10.0.0

**Product scope-lock (v1.7.0 / Principle II):** Platform supports exactly four retail loan categories — `personal`, `car`, `mortgage`, `business`. Removing a category requires a destructive migration that physically wipes registry entry, bank programs, and all applications + cascade (offers / decisions / activities / documents). Ghost / soft-deactivated rows = review block. Adding a fifth requires a constitution amendment (A26).

## Active Technologies
- Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ (same strictness profile) on admin. (002-bank-programs)
- PostgreSQL 16 (Prisma migrations only; `db push` forbidden in production); Redis 7 (rate-limit + future audit-event buffer; NOT used as primary store for bank programs). (002-bank-programs)
- Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ on admin. (003-matching-engine-post)
- Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) · Angular 18 + TypeScript 5.4 · Flutter/Dart 3 (mobile) + NestJS 10, Prisma 5, `class-validator`, `@nestjs/swagger`, `decimal.js` (via `@prisma/client/runtime/library`) · ng-zorro-antd (`nz-*`) + `@angular/localize` on admin · flutter_bloc + Freezed + `auto_route` + `MasrafySelectField` on mobile (010-simple-programs-dbr-calculator)
- PostgreSQL 16 (Prisma migrations only) · Redis 7 (rate limit only; not used by this feature) (010-simple-programs-dbr-calculator)

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
- **V — Matching Engine Is IP** (v8.0.0; global pool v10.0.0): pure module. Formula + tiers in code (PR-reviewed). **Two-level weighted** approval `probability = Σ_question(questionWeight÷100 × pickedAnswerScore÷100)` (clamped 0..1; per program the ASSIGNED question weights sum to **100** and each answer score is **0–100**, so max achievable = 100%). Questions + answer options are **pure content** (label + order — NO scoring/eligibility fields) and (v10.0.0) **carry NO category — one GLOBAL question pool**. **One GLOBAL questionnaire** (single versioned snapshot): every applicant answers the same pool; the chosen loan category filters only which *programs* match, never which *questions* are asked. Per bank program, the admin **selects which questions it scores on** (checkbox in the per-program editor) — assignment IS the `questionWeights` key set (no join table) — plus the weights + answer scores, all admin-editable DATA stored in `ScoringWeightSet.weights` as `{ questionWeights: {questionCode→weight}, answerScores: {questionCode→optionCode→score} }` (legacy single-level rows upgrade on read). **Direct admin save** (no maker-checker; editor ID audited; atomic archive+activate). No ACTIVE set (no assigned questions) → score 0. **Eligibility gating dropped for MVP** (no salary/age/DBR/loan-amount/max-loan): every active program in the chosen category returned ranked by probability, in BOTH preview and apply (apply runs the engine with `skipEligibility`).
- **VI — PII Protection**: encrypt at rest; logs never carry PII; documents in S3 with presigned URLs; audit log append-only.
- **VII — Observability**: `X-Correlation-Id` everywhere; `/health/live` + `/health/ready`; structured JSON logs (Pino); discrete business events.
- **VIII — Brand**: `#0869C3` azure blue primary. Use tokens, never raw hex.

### Backend

- **IX — Feature Modules**: organize by domain (`auth/`, `users/`, etc.). `common/` MUST NOT import from features.
- **X — Repository Pattern**: services NEVER touch Prisma directly. Use `*.repository.ts`.
- **XI — Prisma Migrate Only**: `db push` forbidden in prod. Named migrations; indexes on FKs + hot WHERE/ORDER BY.
- **XII — DTO vs Entity**: `class-validator` DTOs; Prisma types stay in repositories. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
- **XIII — Dual Auth (v3.0.0)**: JWT-only across both API surfaces — HMAC removed platform-wide. Admin JWT (15 min access + 7-day refresh httpOnly cookie). **Customer JWT** on `/api/v1/*` — 15 min access + 30-day refresh, response-body strings (not cookies), stored ONLY in `flutter_secure_storage`. Server-side refresh rotation + reuse detection: replaying a rotated refresh token revokes the session family. Separate signing keys `CUSTOMER_JWT_ACCESS_SECRET` / `CUSTOMER_JWT_REFRESH_SECRET`; bcrypt cost ≥ 12 with `select: false`. Two registration paths, both LITE at OTP/provider then completed via the mandatory profile-completion step (Principle XXXVII): PHONE-signup (mobile+OTP → lite row → firstName+lastName+birthday+password) and SOCIAL (provider → lite row, no password → mobile+OTP+firstName+lastName+birthday). Profile photo + National ID are optional, uploadable any time, never gating completeness (v9.0.0); only National ID is required at the select-offer commitment point (v9.1.0 — profile photo dropped from the gate, optional everywhere). NO guest mode; `Application.isGuest`, `mobileClientId`, and the claim endpoint are removed from code and MUST NOT be reintroduced. Login lockout: 10 failures / 15 min → 30 min. Forgot-password PHONE-only.
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
- **A24** Approval probability without documented weights
- **A25** Half-updated dependents (cross-surface drift) — Principle XXIX
- **A26** Fifth retail loan category without amendment / ghost rows after removal (Principle II scope-lock, v1.5.0 → v1.6.0 → v1.7.0)
- **A27** Money / amount input without `MoneyInputDirective` (`appMoneyInput`)
- **A28** Mobile datasource/repository/usecase/cubit method with >2 params NOT promoted to a typed `<Name>Request` DTO (Principle XXX, v1.8.1)
- **A29** Multiple route-level widgets in one page file (Principle XXXVI, v3.1.0)
- **A30** Reserved — was "National ID collected at apply instead of profile completion", retired v9.0.0 (National ID timing no longer gated; Principle XXXVII narrowed)
- **A31** Storing age instead of deriving from `birthday` (Principle XXXVII, v4.0.0)
- **A32** Proceeding past an incomplete profile (Principle XXXVII, v4.0.0; narrowed v9.0.0) — profile photo/National ID are no longer completeness fields, must not be added back into this gate
- **A33** Mutating ACTIVE weight set in place / hardcoded question weights or answer scores / hand-typed questionnaire codes / adding scoring or eligibility fields back onto `Question`/`QuestionOption` / reintroducing eligibility gates into preview or apply / probability by any formula other than `Σ_question(questionWeight÷100 × pickedAnswerScore÷100)` / assigned-question weights not summing to 100 / answer score outside 0–100 / **reintroducing a `category` field on `Question`/`QuestionGroup`/`QuestionnaireVersion` or a per-category questionnaire (questions are one GLOBAL pool; category filters programs, not questions)** (Principle V, v6.0.0; two-level weights v8.0.0; global pool v10.0.0)
- **A34** Modal/dialog/sheet backdrop that dims only the content panel, not the full viewport — usually a `position: fixed` scrim trapped inside a containing-block ancestor (`transform`/`filter`/`contain`, e.g. `section.page`'s `app-page-rise`). Use `NzModalService`/`NzDrawerService` or render the scrim as a root-level sibling; shared backdrop tokens (Angular Clean Code Structure, v4.1.1)
- **A35** Gradient hero with a hardcoded `height`/`expandedHeight` literal that clips content (use content-sized `MasrafyGradientHeader.expandedHeightFor(...)` → sliver `expandedHeight` + static `heightInPixels`, ~180px `minHeight` floor), a collapsed toolbar that ellipsis-truncates the title (use `FittedBox(scaleDown)`), a hero hugging content with no breathing space, or a static (non-collapsing) hero on a scrollable screen. Scrollable screens host the hero in `MasrafySliverGradientHeaderDelegate` (`SliverPersistentHeader(pinned)` + `CustomScrollView` w/ `BouncingScrollPhysics`), collapsing to a compact toolbar (`heading4` title centred on the back-button row, subtitle faded); a button-driven `PageView` wizard keeps the static header ONLY for non-scrolling steps — a step whose form scrolls hosts its OWN per-step collapsing sliver hero (each `PageView` child = its own `CustomScrollView` + `SliverPersistentHeader(pinned)`; a single `NestedScrollView` over the PageView is forbidden — shared offset pre-collapses short steps), the `bottom` progress bar fading with the hero on collapse (Principle XXXIII, v5.1.0; clarified v5.1.1, v5.1.2)
- **A36** Dropdown / floating-overlay / accordion / native `DropdownButton`/`DropdownMenu` / value-picking `PopupMenuButton` used for form-field value selection instead of the shared instant tap-to-select bottom sheet (`MasrafySelectField<T>` trigger + `showMasrafySingleSelectSheet`/`showMasrafyMultiSelectSheet`, one `MasrafySelectOption<T>`; row tap applies + closes, long lists `showSearch: true`); caller-owned `openField`/`toggleField` accordion plumbing for selects forbidden; kebab/filter/period menus exempt (Principle XXXIII, v8.1.0)

## Recent Changes
- 010-simple-programs-dbr-calculator: Added Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) · Angular 18 + TypeScript 5.4 · Flutter/Dart 3 (mobile) + NestJS 10, Prisma 5, `class-validator`, `@nestjs/swagger`, `decimal.js` (via `@prisma/client/runtime/library`) · ng-zorro-antd (`nz-*`) + `@angular/localize` on admin · flutter_bloc + Freezed + `auto_route` + `MasrafySelectField` on mobile
- 2026-07-24 (v10.0.0): MAJOR — Principle V: **questionnaire is now ONE GLOBAL question pool** (feature 010). `category` dropped from `Question`/`QuestionGroup`/`QuestionnaireVersion` (globally-unique `code`; single global versioned snapshot). Loan category filters only which **programs** match, never which **questions** are asked. Each bank program **assigns which questions it scores on** (checkbox in the per-program scoring editor) — assignment IS the `questionWeights` key set (no join table); weights sum 100 over ASSIGNED questions. Migration `global_question_pool_merge_by_code` merges duplicate-code rows across old categories into one canonical row (options unioned), re-points `application_answer` + weight-set refs, drops the `category` columns. Admin: 4-category questionnaire tabs → one global pool builder (overview page deleted, `/questionnaire` route → editor); scoring editor gains assign checkbox + "Distribute evenly" and drops `:category` from its route (`/scoring/weights/:programId`). Backend endpoints drop the category param (`GET /admin/questionnaire/tree`, `versions/publish|history`, `GET /admin/scoring/questions`, customer `GET /v1/questionnaire`); `seed-questionnaire` emits the merged global pool + per-program category pre-assignment. Constitution v10.0.0; A33 extended. No new error codes.
- 2026-07-13 (v9.1.0): MINOR — Select-offer document gate narrowed: **profile photo dropped, only National ID front+back required** at the select-offer commitment point. Backend `assertSelectOfferDocuments()` no longer throws `PROFILE_PHOTO_REQUIRED` (National ID check only); profile photo now optional EVERYWHERE. Mobile `ApplyDocumentsPage`/`ApplyDocumentsCubit` drop the photo tile + `photo*` state fields (CTA unlocks on both ID sides); `SelectOfferState.needsDocuments` matches `NATIONAL_ID_REQUIRED` only. `PROFILE_PHOTO_REQUIRED` error code + ARB/JSON strings retained but unused. Principle XXXVII Rule 3 parenthetical + Principle XIII prose reworded; constitution v9.1.0.
- 2026-07-11 (v9.0.1): PATCH — Principle XXXVII Rule 3 parenthetical updated: the non-XXXVII document gate is ratified at the **select-offer commitment point** — `selectOffer()` requires profile photo + National ID front/back via `assertSelectOfferDocuments` (409 `NATIONAL_ID_REQUIRED` checked first, then new `PROFILE_PHOTO_REQUIRED`); `POST /v1/apply` NO LONGER requires any document, so matched offers browse freely. `hasNationalId`/`assertNationalId` absorbed into the completeness service's `getProfileDocumentsStatus()` + `assertSelectOfferDocuments()` (one predicate feeds gate + status endpoint); new lightweight `CustomerAccountRepository.findProfilePhotoKey()`. New mobile endpoint `GET /v1/profile/documents/status` → `{ profilePhoto, nationalIdFront, nationalIdBack }` so the docs screen pre-checks uploaded items. Same-PR (Principle III): `PROFILE_PHOTO_REQUIRED` (409) in `error-codes.ts` + admin en-US/ar-EG JSONs + Flutter ARB `auth_profile_photo_required`.
- 2026-07-11 (v9.0.0): MAJOR — Principle XXXVII narrowed: profile photo (`profilePhotoKey`) and National ID front+back REMOVED from the mandatory profile-completeness contract. COMPLETE now = mobile+`mobileVerifiedAt`, firstName, lastName, birthday, (PHONE only) `passwordHash` — photo/ID are fully optional and never block reaching Home, the questionnaire, matching, or `/applications/apply`. `customer-auth-mobile.service.ts#completeProfile()` no longer throws `PROFILE_INCOMPLETE` for a missing photo; `CustomerProfileCompletenessService.evaluate()` drops its `profilePhotoKey` check (single source of truth for the `/me` `profileComplete` flag + `CustomerProfileCompleteGuard`). Upload endpoints (`CustomerProfileDocumentsController`) unchanged; the pre-existing apply-time National ID check (`assertNationalId`/`NATIONAL_ID_REQUIRED`) is unaffected and lives outside this Principle. Rule 3 rewritten (photo/ID optional, not gating); Rules 1/2 narrowed; Rationale + Enforcement reworded. Principle XIII registration-path prose updated. Anti-Pattern A30 retired (slot reserved, like A9); A32 reworded to the narrowed field list.
- 2026-06-27 (v8.1.0): MINOR — Principle XXXIII extended: **bottom sheet is the default value-selection control** on mobile. Inline/floating/overlay/accordion dropdowns (incl. the removed `MasrafyExpandableSelect`), native `DropdownButton`/`DropdownMenu`, and value-picking `PopupMenuButton`s are banned for form-field selection; use a `MasrafySelectField<T>` trigger opening the shared **instant tap-to-select** `showMasrafySingleSelectSheet`/`showMasrafyMultiSelectSheet`, with one `MasrafySelectOption<T>` model. 33 questionnaire selects (mortgage/car/business) + the profile governorate picker migrated; per-cubit `openField`/`toggleField` accordion plumbing removed; the canonical sheet dropped its Save/Cancel footer. Kebab/filter/period controls exempt. New Anti-Pattern A36.
- 2026-06-17 (v8.0.0): MAJOR — Principle V → **two-level weighted** model. Per bank program: each QUESTION a weight (all sum to **100**), each ANSWER a **score 0–100**; `probability = Σ_question(questionWeight÷100 × pickedAnswerScore÷100)` (max achievable = 100% by construction). Reverses v7.0.0's per-question ≤100 single-level points. `ScoringWeightSet.weights` → `{ questionWeights, answerScores }`; legacy rows upgrade on read (equal question weights), no DB migration; `seed-questionnaire.ts` emits the new shape. Error codes `WEIGHTS_POINTS_OUT_OF_RANGE`/`WEIGHTS_QUESTION_OVER_BUDGET` removed, `WEIGHTS_QUESTION_WEIGHT_SUM_INVALID`/`WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE` added. Admin editor: top weight-budget bar (must total 100) + per-question weight input + per-answer score sliders + live gauge. A33 reworded.
- 2026-06-17 (v7.0.0): MAJOR — Principle V per-bank points now capped **per question**: the points across one question's options must sum to **≤ 100** (a percentage budget; each answer 1–100), reversing v6.0.0's "no sum constraint". Scoring formula UNCHANGED (`Σ(picked points)/maxAchievablePoints`). New error code `WEIGHTS_QUESTION_OVER_BUDGET` (422); admin weights editor (accordion, first question open) shows a per-question total/budget, validates the ≤100 cap, and blocks save when any question is over; pre-existing over-cap weight sets surface as over-budget and must be adjusted. A33 extended.
- 2026-06-17 (v6.0.0): MAJOR — Principle V matching/scoring simplified to MVP. Questions + answer options are now **pure content**; dropped `Question.systemRole`/`isScored`/`profileField`, `QuestionOption.numericMin/Max`/`numericPoint`/`scoreValue`/`profileValue`, and the `QuestionSystemRole` enum (destructive migration `drop_eligibility_and_repoint_scoring_to_options`; stale weight rows reset). Approval `probability = Σ(points[questionCode][optionCode])/maxAchievablePoints`; per-bank points assigned per **answer option**, stored nested in `ScoringWeightSet.weights` (no sum constraint). **Eligibility gating dropped everywhere** (preview + apply); every active program returned ranked by probability (apply runs the engine with `skipEligibility`). `answer-to-profile.ts` deleted; matching-preview no longer runs the engine. Admin builder strips all engine fields; weights editor is points-per-answer. Error codes `OPTION_MISSING_SCORE_VALUE`/`WEIGHTS_MUST_SUM_TO_100` removed, `WEIGHTS_UNKNOWN_QUESTION`→`WEIGHTS_UNKNOWN_OPTION`. A33 rewritten.
- 2026-06-17 (v5.1.2): PATCH — Wizard hero rule clarified (A35 / Principle XXXIII): a button-driven `PageView` wizard step whose form scrolls MUST host its OWN per-step collapsing sliver hero (each `PageView` child = its own `CustomScrollView` + `SliverPersistentHeader(pinned)`); a single `NestedScrollView` over the PageView is forbidden (shared offset leaves short steps pre-collapsed). Static header only for non-scrolling steps; the `bottom` progress bar fades with the hero on collapse. First applied to the mortgage questionnaire (per-step `MortgageStepScaffold`); `MasrafySliverGradientHeaderDelegate` extended to forward `bottom`.
- 2026-06-17 (v5.1.1): PATCH — Gradient hero height is now **content-sized**, not a fixed ≤240 bound: callers compute it via `MasrafyGradientHeader.expandedHeightFor(context, …)` (`TextPainter` measure) → sliver `expandedHeight` + static `heightInPixels`, with a ~180px `minHeight` floor, so it grows for long/two-line titles and never clips. Collapsed toolbar title shows in full via `FittedBox(scaleDown)` (no ellipsis). A35 reworded.
- 2026-06-17 (v5.1.0): MINOR — Principle XXXIII extended with the **Gradient hero header** rule: single shared `MasrafyGradientHeader`; expanded height bounded ≤ 240 logical px (compact band, ~210–230); mandatory breathing space between hero and content sheet; scrollable screens MUST host the hero as a collapsing sliver (`MasrafySliverGradientHeaderDelegate` + `SliverPersistentHeader(pinned)` in a `CustomScrollView` with `BouncingScrollPhysics`), collapsing to a compact toolbar (smaller `heading4` title centred on the back-button row, subtitle faded, gradient + glass back button preserved); non-scrollable `PageView` wizards keep the static header. New Anti-Pattern A35.
- 2026-06-16 (v5.0.0): MAJOR — Principle V matching/scoring simplified for MVP. Approval `probability = Σ(option.scoreValue × questionWeight)/100` over a category's scored questions (`Question.isScored`); per-bank-program weights keyed by `questionCode`, sum=100. Removed the `ScoringFactor`/`scoringFactorCode` layer + COMPUTED `debt_burden` from the probability (DBR = eligibility gate + max-loan only). Replaced two-person maker-checker with **direct admin save** (editor ID audited; atomic archive+activate); equal-split code default retained. Per-option `scoreValue` + internal mapping fields stripped from the customer questionnaire payload. A33 rewritten.
- 2026-06-02 (v4.1.1): PATCH — Angular Clean Code Structure: modal/dialog/sheet backdrops MUST dim the full viewport (sidebar + top bar + content), not just the content panel. Prefer `NzModalService`/`NzDrawerService` (portal to body); a hand-rolled `position: fixed` scrim must NOT sit inside a containing-block ancestor (`transform`/`filter`/`contain` — e.g. `section.page`'s `app-page-rise`) and must use shared backdrop tokens. New Anti-Pattern A34.
- 2026-06-02 (v4.1.0): MINOR — Principle V extended for Dynamic Questionnaire & Matching. Questionnaire (questions/options/branching/order) + per-bank scoring weights + per-option `scoreValue` are admin-editable DATA; formula/tiers/COMPUTED factors stay code (≥90% tests). Weight changes → in-dashboard two-person maker-checker (checker ≠ maker, weights sum 100, atomic activate+archive, audited). Questionnaire published as immutable versioned snapshots. Customer endpoints JWT-gated (no guest, per v4.0.0). Anti-Pattern A33. Feature `00X-questionnaire-matching`.
- 2026-06-02 (v4.0.0): MAJOR — Principle XIII registration model redefined (lite row post-OTP/provider + mandatory profile-completion step for BOTH paths; the upfront / loan-request-popup model removed). New Principle XXXVII (Mandatory Profile Completeness, NON-NEGOTIABLE). Data model: `name`→`firstName`+`lastName`; `age Int`→`birthday DateTime` (age derived, never stored); new `profilePhotoKey`; `passwordHash` nullable (SOCIAL). National ID collected at profile completion as two customer-linked Document rows (not at apply). Guest plumbing (`Application.isGuest`, `mobileClientId`, claim flow) removed from code. Anti-Patterns A30/A31/A32. Principle VI guest sentence replaced with profile-photo/National-ID PII coverage.
- 2026-05-28 (v3.1.0): MINOR — Principle XXXVI added (Mobile, NON-NEGOTIABLE): One Screen, One File. Every navigable screen lives in its own `*_page.dart` (or `_dialog.dart` / `_sheet.dart` / `_picker.dart`) file with exactly one public route-level widget. Private leaf helpers may co-exist below; cross-screen helpers promote per XXXIII. Page files are UI-only. Anti-Pattern A29 enforces. Pre-v3.1.0 multi-class files (`phone_signup_pages.dart`, `forgot_password_pages.dart`, `complete_profile_pages.dart`) flagged as tech debt.
- 2026-05-28 (v3.0.0): MAJOR — Principle XIII redefined. HMAC-SHA256 signing model REMOVED platform-wide. Mobile API (`/api/v1/*`) is JWT-only — customer access (15 min) + refresh (30 days) with server-side rotation + reuse detection. Principle XXVIII Network bullet replaced (Dio + bearer interceptor + silent refresh on 401, no HMAC interceptor). Brand primary `#06152D` (deep navy) → `#0869C3` (azure blue) — same MAJOR bump bundled the two redefinitions. Anti-pattern A9 retired (slot reserved). A23 restated to cover JWT tokens in secure storage instead of HMAC secret.
- 2026-05-28 (v2.0.0): MAJOR restructuring. Constitution split into 4 explicit Parts (Cross-Platform / Backend NestJS / Admin Angular / Mobile Flutter). Two new normative sub-sections added: **NestJS Clean Code Structure** (file layout, single-responsibility, ValidationPipe + Zod env, transactional writes, OpenAPI, no magic strings, path aliases) and **Angular Clean Code Structure** (feature-folder layout, smart/presentational split, Signals + new control flow, inject() DI, typed reactive forms, design tokens, logical CSS, functional guards + lazy routes, one-concern-per-service, path aliases). No principle removed or redefined. Pilot100 Flutter alignment maintained.
- 2026-05-27 (v1.8.1): Principle XXX extended with the **method-arity rule** — Flutter datasource / repository / usecase / cubit methods taking >2 params MUST accept a single typed `<Name>Request` DTO (not separate named/positional params). Anti-Pattern A28 enforces it. Pilot100-aligned. Two-or-fewer params remain named. PATCH bump.
- 2026-05-26 (v1.8.0): Principle XIII rewritten. Guest mode REMOVED platform-wide; every reachable in-app feature now requires HMAC + customer JWT. v1.7.0 24-hour claim endpoint deleted. Two registration paths codified: PHONE-signup (fully upfront) + SOCIAL sign-in (lite + mandatory loan-request popup). Mobile + `mobileVerifiedAt` immutable on first OTP-verified write; email + age (SOCIAL) atomic with first loan submission. Login lockout 10/15min → 30min. Forgot-password PHONE-only. Feature 008-mobile-auth-apply ratifies this model.
- 2026-05-25 (v1.7.0): Constitution scope-lock widened to FOUR retail loan categories — added `business` alongside `personal`/`car`/`mortgage`. Principle XIII extended with customer-facing mobile auth (`/api/v1/auth/*` — customer JWT layered on HMAC, 15 min access + 30-day refresh, separate signing keys). A26 rewritten to bound at a FIFTH category. Mobile user-journey Phase 1 backend + admin alignment begins here (PRs #0–#7 per plan `this-is-the-gourney-frolicking-papert.md`).
- 003-matching-engine-post: Added Node.js 22 LTS + TypeScript 5.6+ (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) on backend; Angular 18 + TypeScript 5.4+ on admin.


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
