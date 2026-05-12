# Tasks: Matching Engine — POST /api/v1/apply with Ranked Offers

**Feature**: 003-matching-engine-post · **Branch**: `003-matching-engine-post`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/) · **Quickstart**: [quickstart.md](./quickstart.md)

## Conventions

- Checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path` (strict per `/speckit.tasks`).
- `[P]` = parallelizable with other `[P]` tasks in the same phase.
- `[USx]` story labels appear ONLY on user-story phase tasks (Phases 3–7).
- File paths are absolute-from-repo-root.
- Constitution v1.3.0 + spec FRs control acceptance.
- Testing is OPTIONAL per Principles XVI + XXVII (v1.2.0 placeholders). Vitest engine + integration suites queued in Polish phase — developer discretion per research R12.

---

## Phase 1 — Setup

**Goal**: Branch-level scaffolding. Two parallel tasks.

- [ ] T001 [P] Verify branch + base state: confirm `003-matching-engine-post` branch is current, `git status` clean before edits, Prisma client regenerable, infra running per [quickstart.md §1–§3](./quickstart.md). Log baseline to commit message of the first foundational migration.
- [ ] T002 [P] Bootstrap the design-pipeline folder skeleton: ensure `specs/003-matching-engine-post/design/{01-applications-list,02-application-detail,03-no-match-insight}/` each contain a placeholder `README.md` documenting screen purpose, target user roles, Principle XXIII contract.

---

## Phase 2 — Foundational (BLOCKING for all user stories)

**Goal**: Cross-story plumbing. Nothing in Phases 3–7 may start until every task here is `[x]`.

**Independent verification**: backend boots clean, `prisma migrate dev` applied, error codes + AR/EN translations land, HMAC middleware + nonce store + rate-limit guard wired, ESLint engine-boundary rule active, no typecheck errors.

### Data model + migrations

- [ ] T003 Extend Prisma schema with `Application` + `BankOffer` models + `ApplicationStatus` + `ApplicationPriority` enums in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) per [data-model.md](./data-model.md).
- [ ] T004 Add 6 new `AuditEventType` enum values to [backend/prisma/schema.prisma](backend/prisma/schema.prisma): `APPLICATION_CREATED`, `APPLICATION_MATCHED`, `APPLICATION_NO_MATCH`, `APPLICATION_RATE_LIMITED`, `MATCHING_ENGINE_RUN`, `DATA_ERASURE_COMPLETED`.
- [ ] T005 Generate named migration `add_matching_engine` via `npx prisma migrate dev --name add_matching_engine`. Inspect SQL output before commit.
- [ ] T006 Add partial-index SQL fragments to the migration: `idx_application_status_created` WHERE `status IN ('matched', 'no_match')`, `idx_application_user` WHERE `applicantUserId IS NOT NULL`, `idx_application_idempotency` UNIQUE WHERE `idempotencyKey IS NOT NULL`. Append to [backend/prisma/migrations/<timestamp>_add_matching_engine/migration.sql](backend/prisma/migrations/).
- [ ] T007 Run `npx prisma generate` and verify the new client types in [backend/node_modules/@prisma/client/index.d.ts](backend/node_modules/@prisma/client/index.d.ts).

### Error codes + i18n scaffolding

- [ ] T008 [P] Extend backend typed error-code registry in [backend/src/common/errors/error-codes.ts](backend/src/common/errors/error-codes.ts) with 16 endpoint-level codes from [contracts/error-codes.md](./contracts/error-codes.md): `NO_MATCHING_PROGRAMS`, `INCOME_TOO_LOW`, `AGE_NOT_ELIGIBLE`, `DBR_EXCEEDED`, `TENOR_OUT_OF_RANGE`, `AMOUNT_OUT_OF_RANGE`, `CURRENCY_NOT_SUPPORTED`, `MISSING_CD_RECORD`, `MISSING_CAR_LOAN_RECORD`, `MISSING_BANK_STATEMENT`, `INCOME_LOOKUP_FAILED`, `MATCHING_ENGINE_ERROR`, `IDEMPOTENCY_KEY_MISMATCH` (+ keep existing `RATE_LIMITED`, `UNAUTHENTICATED`, `FORBIDDEN` references).
- [ ] T009 [P] Add typed `DomainException` subclasses to [backend/src/common/errors/domain.exceptions.ts](backend/src/common/errors/domain.exceptions.ts): `NoMatchingProgramsException`, `IncomeTooLowException`, `AgeNotEligibleException`, `DbrExceededException`, `TenorOutOfRangeException`, `AmountOutOfRangeException`, `CurrencyNotSupportedException`, `MissingRecordException`, `IncomeLookupFailedException`, `MatchingEngineErrorException`, `IdempotencyKeyMismatchException`.
- [ ] T010 [P] Add Arabic translations for all 16 endpoint codes to [admin/src/i18n/error-codes.ar-EG.json](admin/src/i18n/error-codes.ar-EG.json) per [contracts/error-codes.md](./contracts/error-codes.md).
- [ ] T011 [P] Add English translations to [admin/src/i18n/error-codes.en-US.json](admin/src/i18n/error-codes.en-US.json).
- [ ] T012 [P] Reserve i18n message IDs for application-list + detail strings in [admin/src/i18n/messages.ar-EG.xlf](admin/src/i18n/messages.ar-EG.xlf) and [admin/src/i18n/messages.en-US.xlf](admin/src/i18n/messages.en-US.xlf).

### Engine module skeleton + boundary enforcement

- [ ] T013 Create the `matching/` module directory tree at [backend/src/matching/](backend/src/matching/) per the structure block in [plan.md](./plan.md). Drop empty `.gitkeep` placeholders inside `engine/`, `engine/eligibility/`, `engine/income/`, `engine/tier-resolution/`, `suggestions/`, `pii-mask/`.
- [ ] T014 Add ESLint boundary rule at [backend/.eslintrc.matching-boundary.json](backend/.eslintrc.matching-boundary.json) per research R3: forbid imports from `@nestjs/*`, `@/applications/*`, `@/auth/*`, `@/common/*`, `@/audit/*`, `winston`, `pino`, `console.*` inside `matching/`. Allow `@prisma/client` (Decimal type only), `@/bank-programs/cascade/cascade.evaluator`, `@/bank-programs/cascade/cascade.types`, `node:crypto`. Wire into the existing `.eslintrc` `overrides` array.
- [ ] T015 Implement `matching.types.ts` at [backend/src/matching/types.ts](backend/src/matching/types.ts) declaring `ApplicantProfile`, `MatchResult`, `Offer`, `Suggestion`, `CascadeTrace`, `FeesBreakdown` per [data-model.md](./data-model.md) entity shapes. Types-only file; no runtime imports.
- [ ] T016 Implement `scoring-weights.ts` at [backend/src/matching/scoring-weights.ts](backend/src/matching/scoring-weights.ts) per [contracts/scoring-weights.md](./contracts/scoring-weights.md). Named constants with rationale comments. Frozen `as const` export.

### PII masking + applicant fingerprint

- [ ] T017 [P] Implement PII masking helpers at [backend/src/matching/pii-mask/mask.ts](backend/src/matching/pii-mask/mask.ts) per research R8: `maskNationalId`, `maskPhone`, `maskEmail`, `maskName`, `fingerprintApplicant` (sha256). Pure functions, no DI.
- [ ] T018 [P] Implement admin-side PII pipe at [admin/src/app/core/pii-mask/pii-mask.pipe.ts](admin/src/app/core/pii-mask/pii-mask.pipe.ts) mirroring the backend's masking rules for staff-side rendering parity.

### HMAC signature guard + applicant rate-limit guard

- [ ] T019 Implement `HmacSignatureGuard` at [backend/src/applications/guards/hmac-signature.guard.ts](backend/src/applications/guards/hmac-signature.guard.ts) per research R6: verify `X-Client-Id` + `X-Timestamp` + `X-Nonce` + `X-Signature` headers; reconstruct signature base `{method}\n{path}\n{ts}\n{nonce}\n{sha256(body)}`; constant-time HMAC-SHA256 compare; ±5 min clock-skew tolerance; Redis nonce store at `mobile:nonce:{clientId}:{nonce}` with 5 min TTL. Reject with `UNAUTHENTICATED` on mismatch / replay.
- [ ] T020 Provision HMAC client secret bootstrap: env var `MOBILE_CLIENT_ID` + `MOBILE_CLIENT_SECRET` in [backend/.env.example](backend/.env.example); env-schema validation in [backend/src/infra/env/env.schema.ts](backend/src/infra/env/env.schema.ts). Document in [quickstart.md §4](./quickstart.md).
- [ ] T021 Implement `ApplicantRateLimitGuard` at [backend/src/applications/guards/applicant-rate-limit.guard.ts](backend/src/applications/guards/applicant-rate-limit.guard.ts) per research R9: two Redis sliding-window buckets (`mobile:rate:client:{hashed-id}` 30/hr, `mobile:rate:applicant:{fingerprint}` 5/hr); single MULTI pipeline; bypass when serving from idempotency cache. Reject with `RATE_LIMITED` + `meta.bucket`.

### Idempotency cache repository

- [ ] T022 Implement `IdempotencyRepository` at [backend/src/applications/idempotency.repository.ts](backend/src/applications/idempotency.repository.ts) per research R11: `get(clientId, key)` → `{ payloadHash, applicationId, createdAt } | null`; `set(clientId, key, payloadHash, applicationId)` with 1 h TTL via Redis `SETEX`. Inject `RedisService` from feature 001 infra.

### Audit + repositories

- [ ] T023 Extend `AuditEventRepository` at [backend/src/audit/audit-event.repository.ts](backend/src/audit/audit-event.repository.ts) to accept the 6 new event types; add typed payload helpers from [data-model.md](./data-model.md) § Audit Payload Schemas.
- [ ] T024 Implement `ApplicationRepository` at [backend/src/applications/applications.repository.ts](backend/src/applications/applications.repository.ts): `create`, `findById`, `findManyPaged(filters)`, `updateStatus`, `archive` (sets status = `archived`, populates `archivedAt` + `coldTierKey`), `erase` (sets status = `erased`, zeroes scalars + JSONB tombstones).
- [ ] T025 Implement `BankOffersRepository` at [backend/src/applications/bank-offers.repository.ts](backend/src/applications/bank-offers.repository.ts) — insert-only: `createMany(offers)`, `findByApplicationId(id)`, `eraseByApplicationId(id)` (tombstone rewrite). No `update` method.

### Module wiring

- [ ] T026 Wire `MatchingModule` at [backend/src/matching/matching.module.ts](backend/src/matching/matching.module.ts): zero controllers, exports the pure engine entry + suggestions helper for DI convenience. Register in [backend/src/app.module.ts](backend/src/app.module.ts).
- [ ] T027 Wire `ApplicationsModule` at [backend/src/applications/applications.module.ts](backend/src/applications/applications.module.ts): imports `AuthModule` (for JWT/role guards on admin endpoints), `AuditModule`, `MatchingModule`, `BankProgramsModule` (read-only consumer). Register in [backend/src/app.module.ts](backend/src/app.module.ts).

### Admin shell — applications route

- [ ] T028 Register the admin lazy-loaded route shell at [admin/src/app/features/applications/applications.routes.ts](admin/src/app/features/applications/applications.routes.ts) + add navigation entry to [admin/src/app/features/shell/sidebar.component.ts](admin/src/app/features/shell/sidebar.component.ts) gated by `canMatchFn` (all three roles).
- [ ] T029 Implement `ApplicationsApiService` at [admin/src/app/features/applications/applications.api.service.ts](admin/src/app/features/applications/applications.api.service.ts): `list(query)`, `getById(id)`. Returns typed envelopes from [contracts/openapi.yaml](./contracts/openapi.yaml).

**Phase 2 done when**: Backend boots, admin compiles, migration applied, error codes + translations seeded, HMAC + idempotency + rate-limit guards instantiable, ESLint boundary rule active, lazy admin route resolves to an empty placeholder.

---

## Phase 3 — User Story US1: Applicant submits + receives ranked offers (P1)

**Story goal** (spec.md US1): Applicant submits the full 5-step-wizard profile via `POST /api/v1/apply`; the engine evaluates every active program, persists immutable offer snapshots, returns ranked offers.

**Independent test criteria**: Submit Golden Scenario #1 (government employee, Cat-A payroll, CD at ABK, 200,000 EGP / 48 mo / lowest_installment) via signed request. Response includes ≥ 3 matched offers, ABK-CD-HOLDERS present, lowest-installment offer first. Engine `match()` reproduces the same outputs in isolation.

### Engine — pipeline core

- [ ] T030 [US1] [P] Implement PMT calculator at [backend/src/matching/engine/pmt.ts](backend/src/matching/engine/pmt.ts) per research R2: `Prisma.Decimal` arithmetic, banker's rounding, zero-rate special case.
- [ ] T031 [US1] [P] Implement DBR + max-loan-binary-search at [backend/src/matching/engine/dbr.ts](backend/src/matching/engine/dbr.ts) per FR-031 + FR-032.
- [ ] T032 [US1] [P] Implement fees + waivers + penalties at [backend/src/matching/engine/fees.ts](backend/src/matching/engine/fees.ts) per FR-027/028/029/030.
- [ ] T033 [US1] [P] Implement approval-probability scorer at [backend/src/matching/engine/approval-probability.ts](backend/src/matching/engine/approval-probability.ts) per FR-033 + research R13. Consumes `scoring-weights.ts`.
- [ ] T034 [US1] [P] Implement ranking at [backend/src/matching/engine/ranking.ts](backend/src/matching/engine/ranking.ts) per FR-039: 4 priority sort rules + deterministic tie-break (rate → approval% → program createdAt).

### Engine — eligibility modules

- [ ] T035 [US1] [P] Eligibility: employment-type at [backend/src/matching/engine/eligibility/employment-type.ts](backend/src/matching/engine/eligibility/employment-type.ts) — returns `MATCH_EMPLOYMENT_OK` / `EMPLOYMENT_TYPE_NOT_ACCEPTED`.
- [ ] T036 [US1] [P] Eligibility: age at [backend/src/matching/engine/eligibility/age.ts](backend/src/matching/engine/eligibility/age.ts) — handles self-employed-specific bounds.
- [ ] T037 [US1] [P] Eligibility: income-minimum at [backend/src/matching/engine/eligibility/income.ts](backend/src/matching/engine/eligibility/income.ts) — applies self-employed minimum + Cat-A income haircut (commercial vs public bank).
- [ ] T038 [US1] [P] Eligibility: tenure at [backend/src/matching/engine/eligibility/tenure.ts](backend/src/matching/engine/eligibility/tenure.ts) — months-in-job + per-salary-category overrides.
- [ ] T039 [US1] [P] Eligibility: loan-purpose at [backend/src/matching/engine/eligibility/loan-purpose.ts](backend/src/matching/engine/eligibility/loan-purpose.ts).
- [ ] T040 [US1] [P] Eligibility: transfer-type at [backend/src/matching/engine/eligibility/transfer-type.ts](backend/src/matching/engine/eligibility/transfer-type.ts) — payroll / STL / ITL / none.
- [ ] T041 [US1] [P] Eligibility: currency at [backend/src/matching/engine/eligibility/currency.ts](backend/src/matching/engine/eligibility/currency.ts) per FR-009.
- [ ] T042 [US1] [P] Eligibility: required-flags at [backend/src/matching/engine/eligibility/required-flags.ts](backend/src/matching/engine/eligibility/required-flags.ts) — 11 boolean checks (requiresCD, requiresAutoLoanAtABK, requiresAutoLoanAtOtherBank, requiresCreditCardAtOtherBank, requiresCompoundProperty, requiresCollateral, requiresClubMembership, requiresExistingLoan, requiresFRMUVerification, requiresQualitativeReview, requiresNoDocuments) — emits one error code per failing flag.
- [ ] T043 [US1] [P] Eligibility: wealth-gate at [backend/src/matching/engine/eligibility/wealth-gate.ts](backend/src/matching/engine/eligibility/wealth-gate.ts) — AND combination of `minBankStatementBalanceEGP` + `minAssetsValueEGP` per FR-005c.1.
- [ ] T044 [US1] [P] Eligibility: performance-criteria at [backend/src/matching/engine/eligibility/performance-criteria.ts](backend/src/matching/engine/eligibility/performance-criteria.ts) — MOB / BKT-1 / BKT-2 / current-loan-status, applicant-declared evidence per FR-006.
- [ ] T045 [US1] [P] Eligibility: no-documents at [backend/src/matching/engine/eligibility/no-documents.ts](backend/src/matching/engine/eligibility/no-documents.ts) per FR-008.

### Engine — income strategies

- [ ] T046 [US1] [P] Income strategy: declared at [backend/src/matching/engine/income/declared.ts](backend/src/matching/engine/income/declared.ts) per FR-010.
- [ ] T047 [US1] [P] Income strategy: by-years (job / practice) at [backend/src/matching/engine/income/by-years.ts](backend/src/matching/engine/income/by-years.ts) per FR-011.
- [ ] T048 [US1] [P] Income strategy: by-professor-rank at [backend/src/matching/engine/income/by-professor-rank.ts](backend/src/matching/engine/income/by-professor-rank.ts) per FR-012.
- [ ] T049 [US1] [P] Income strategy: by-military-grade at [backend/src/matching/engine/income/by-military-grade.ts](backend/src/matching/engine/income/by-military-grade.ts) per FR-013.
- [ ] T050 [US1] [P] Income strategy: by-cd-value at [backend/src/matching/engine/income/by-cd-value.ts](backend/src/matching/engine/income/by-cd-value.ts) per FR-014 (combination rule `lesser_of`/`greater_of`).
- [ ] T051 [US1] [P] Income strategy: by-car-installment at [backend/src/matching/engine/income/by-car-installment.ts](backend/src/matching/engine/income/by-car-installment.ts) per FR-015.
- [ ] T052 [US1] [P] Income strategy: by-car-loan-amount at [backend/src/matching/engine/income/by-car-loan-amount.ts](backend/src/matching/engine/income/by-car-loan-amount.ts) per FR-016.
- [ ] T053 [US1] [P] Income strategy: by-credit-card-limit at [backend/src/matching/engine/income/by-credit-card-limit.ts](backend/src/matching/engine/income/by-credit-card-limit.ts) per FR-017.
- [ ] T054 [US1] [P] Income strategy: by-bank-statement-percent at [backend/src/matching/engine/income/by-bank-statement-percent.ts](backend/src/matching/engine/income/by-bank-statement-percent.ts) per FR-018.
- [ ] T055 [US1] Income dispatcher at [backend/src/matching/engine/income/resolve-income.ts](backend/src/matching/engine/income/resolve-income.ts) — discriminator switch over `IncomeAssumptionStrategy`. Depends on T046–T054.

### Engine — tier resolution

- [ ] T056 [US1] [P] Tier resolution: rate via cascade evaluator at [backend/src/matching/engine/tier-resolution/resolve-rate.ts](backend/src/matching/engine/tier-resolution/resolve-rate.ts) — imports `evaluatePricing` from feature 002's cascade evaluator (types-only re-export pattern; runtime call). Honors FR-019/020/023.
- [ ] T057 [US1] [P] Tier resolution: loan-limit at [backend/src/matching/engine/tier-resolution/resolve-loan-limit.ts](backend/src/matching/engine/tier-resolution/resolve-loan-limit.ts) — `evaluateLoanLimit` cascade per FR-021.
- [ ] T058 [US1] [P] Tier resolution: tenor at [backend/src/matching/engine/tier-resolution/resolve-tenor.ts](backend/src/matching/engine/tier-resolution/resolve-tenor.ts) — `evaluateTenor` cascade per FR-022; clamps `preferredTenor` to `maxMonths`.
- [ ] T059 [US1] Tier resolution: buyout-rate at [backend/src/matching/engine/tier-resolution/resolve-buyout-rate.ts](backend/src/matching/engine/tier-resolution/resolve-buyout-rate.ts) per FR-024 — `original + delta` clamped to floor.

### Engine — result mapping + entry point

- [ ] T060 [US1] Result mapper at [backend/src/matching/engine/result-mapper.ts](backend/src/matching/engine/result-mapper.ts) — assembles `MatchResult` (eligible / failedChecks / offer / cascadeTrace) per FR-036/037.
- [ ] T061 [US1] Engine entry point `match()` at [backend/src/matching/engine/match.ts](backend/src/matching/engine/match.ts) — runs the 12-step pipeline per research R4 for each program; collects results; calls `ranking.ts`. Depends on T030–T060.

### Applications service — DTOs + controller + persistence

- [ ] T062 [US1] Sub-config DTOs at [backend/src/applications/dto/sub-dtos/](backend/src/applications/dto/sub-dtos/): `employment.dto.ts`, `obligations.dto.ts`, `assets.dto.ts`, `mortgage-details.dto.ts`, `car-details.dto.ts` per FR-042.
- [ ] T063 [US1] Top-level apply DTO at [backend/src/applications/dto/apply.request.dto.ts](backend/src/applications/dto/apply.request.dto.ts) — full applicant profile + `class-validator` decorators (age 18-75, requestedAmountEGP ≥ 5000, tenor 6-360, priority enum, conditional mortgage/car details).
- [ ] T064 [US1] Apply response DTO at [backend/src/applications/dto/apply.response.dto.ts](backend/src/applications/dto/apply.response.dto.ts) per [contracts/openapi.yaml](./contracts/openapi.yaml).
- [ ] T065 [US1] Implement `ApplicationsService.submit()` at [backend/src/applications/applications.service.ts](backend/src/applications/applications.service.ts) — orchestrates the FR-041 single-transaction flow: insert application (status `draft`) → fetch active programs → call `match()` → persist offers via `BankOffersRepository.createMany` → update status → emit `APPLICATION_CREATED` + `APPLICATION_MATCHED` (or `APPLICATION_NO_MATCH`) + `MATCHING_ENGINE_RUN` audit events with correlation id → commit. Roll back on engine failure.
- [ ] T066 [US1] Implement `ApplicationsController.submit()` at [backend/src/applications/applications.controller.ts](backend/src/applications/applications.controller.ts) — `POST /api/v1/apply` guarded by `HmacSignatureGuard` (T019) + `ApplicantRateLimitGuard` (T021). Returns `MatchSuccessEnvelope` per [contracts/openapi.yaml](./contracts/openapi.yaml).
- [ ] T067 [US1] Surface OpenAPI annotations on the controller via `@nestjs/swagger` decorators reflecting [contracts/openapi.yaml](./contracts/openapi.yaml). Verify at `/api/docs`.

**Phase 3 done when**: Quickstart §6 passes — Golden Scenario #1 returns ≥ 3 ranked offers with deterministic ordering. Audit events visible in the audit table.

---

## Phase 4 — User Story US2: Staff browses + inspects applications (P1)

**Story goal** (spec.md US2): Internal staff list applications with filters, open detail, see PII-masked profile + ranked offers + failed-checks breakdown + audit timeline.

**Independent test criteria**: Sign in as viewer, navigate to `/applications`, filter by status `matched`, open application from US1, confirm offer cards + cascade trace + failed-checks section + audit timeline render with PII masked. Re-test as admin (write CTAs hidden are out-of-scope here).

### Design pipeline

- [ ] T068 [US2] [P] Run `ui-ux-pro-max` for screen 01-applications-list and save to [specs/003-matching-engine-post/design/01-applications-list/promax.md](specs/003-matching-engine-post/design/01-applications-list/promax.md). Cover: row density, status chips, primary-failure-reason chip for no-match rows, masked-name treatment, RTL.
- [ ] T069 [US2] [P] Run `ui-ux-pro-max` for screen 02-application-detail and save to [specs/003-matching-engine-post/design/02-application-detail/promax.md](specs/003-matching-engine-post/design/02-application-detail/promax.md). Cover: masked-profile layout, offer-card stack, cascade-trace stepper inside cards, failed-checks expandable section, audit-timeline drawer, RTL.

### Backend admin endpoints

- [ ] T070 [US2] List query DTO at [backend/src/applications/dto/list-applications.query.ts](backend/src/applications/dto/list-applications.query.ts) — page, pageSize, status, loanPurpose, createdAfter, createdBefore, applicationId.
- [ ] T071 [US2] Detail response DTO at [backend/src/applications/dto/application-detail.response.dto.ts](backend/src/applications/dto/application-detail.response.dto.ts) per [contracts/openapi.yaml](./contracts/openapi.yaml) `ApplicationDetail` schema.
- [ ] T072 [US2] Implement `ApplicationsService.list()` at [backend/src/applications/applications.service.ts](backend/src/applications/applications.service.ts) — paginated query via `ApplicationRepository.findManyPaged`. Status filter excludes `draft`/`archived`/`erased` (FR-050).
- [ ] T073 [US2] Implement `ApplicationsService.getById()` — fetches application + offers + audit-event rows for the timeline. Applies PII masking via `pii-mask.service.ts` wrapping [backend/src/matching/pii-mask/mask.ts](backend/src/matching/pii-mask/mask.ts).
- [ ] T074 [US2] Implement `ApplicationsAdminController` at [backend/src/applications/applications.admin.controller.ts](backend/src/applications/applications.admin.controller.ts) — `GET /api/admin/applications` + `GET /api/admin/applications/:id`. JWT-guarded; all three roles permitted (read-only).

### Admin pages

- [ ] T075 [US2] Implement `ApplicationsListPage` at [admin/src/app/features/applications/list/applications-list.page.ts](admin/src/app/features/applications/list/applications-list.page.ts) — Material `mat-table` + paginator + filter chips (status, loan purpose, date range) + search by application id + status chips + masked-name column.
- [ ] T076 [US2] Implement `ApplicationDetailPage` at [admin/src/app/features/applications/detail/application-detail.page.ts](admin/src/app/features/applications/detail/application-detail.page.ts) — masked-profile panel + offer-card stack + failed-checks section + audit-timeline drawer.
- [ ] T077 [US2] [P] Implement `OfferCardComponent` at [admin/src/app/features/applications/detail/offer-card.component.ts](admin/src/app/features/applications/detail/offer-card.component.ts) — bank, program, rate, installment, fees breakdown, approval probability, required documents chips, match-reasons chips, cascade-trace stepper, qualitative-review badge + self-declared badge.
- [ ] T078 [US2] [P] Implement `FailedChecksComponent` at [admin/src/app/features/applications/detail/failed-checks.component.ts](admin/src/app/features/applications/detail/failed-checks.component.ts) — expandable per-program rows with failed-check error-code chips (translated via the error-code helper).
- [ ] T079 [US2] [P] Implement `AuditTimelineComponent` at [admin/src/app/features/applications/detail/audit-timeline.component.ts](admin/src/app/features/applications/detail/audit-timeline.component.ts) — reverse-chronological event list with correlation-id copy affordance.

### Polish

- [ ] T080 [US2] Run `impec polish` on the list page and save to [specs/003-matching-engine-post/design/01-applications-list/impec.md](specs/003-matching-engine-post/design/01-applications-list/impec.md).
- [ ] T081 [US2] Run `impec polish` on the detail page and save to [specs/003-matching-engine-post/design/02-application-detail/impec.md](specs/003-matching-engine-post/design/02-application-detail/impec.md).

**Phase 4 done when**: Quickstart §10 passes — list, detail, masked profile, offer cards, failed-checks, audit timeline all render correctly in both Arabic + English.

---

## Phase 5 — User Story US3: No-match response with suggestions (P2)

**Story goal** (spec.md US3): When zero programs match, respond with structured `NO_MATCHING_PROGRAMS` envelope including primary reason, per-program failure breakdown, and ranked suggestions.

**Independent test criteria**: Submit Golden Scenario #5 (age 19, no income, 1M EGP). Response is `NO_MATCHING_PROGRAMS` with `meta.primaryReason = AGE_NOT_ELIGIBLE`, `meta.details[].failedChecks` populated per program, `meta.suggestions[]` ordered descending by `programsUnlocked`. Admin detail page renders the same suggestions on the no-match insight surface.

### Suggestions engine

- [ ] T082 [US3] [P] Trigger matrix at [backend/src/matching/suggestions/trigger-matrix.ts](backend/src/matching/suggestions/trigger-matrix.ts) per FR-047a — failure-cluster → suggestion-codes map.
- [ ] T083 [US3] [P] Unlock counter at [backend/src/matching/suggestions/unlock-counter.ts](backend/src/matching/suggestions/unlock-counter.ts) per research R10 — binary search per hypothetical adjustment; re-runs eligibility against the program list; returns `(suggestedValue, programsUnlocked)`.
- [ ] T084 [US3] Suggestions entry `suggest()` at [backend/src/matching/suggestions/suggest.ts](backend/src/matching/suggestions/suggest.ts) — orchestrates trigger-matrix + unlock-counter; emits ordered `Suggestion[]` per FR-047. Depends on T082 + T083.

### Service + response shape

- [ ] T085 [US3] No-match response DTO at [backend/src/applications/dto/no-match.response.dto.ts](backend/src/applications/dto/no-match.response.dto.ts) — `{ success: false, code: NO_MATCHING_PROGRAMS, meta: { primaryReason, details, suggestions } }`.
- [ ] T086 [US3] Wire no-match branch into `ApplicationsService.submit()`: when engine returns zero eligible, call `suggest()`, persist `noMatchSummary` JSONB on the application row, emit `APPLICATION_NO_MATCH` audit event with `primaryReason` + `suggestionCount`, return 200 + no-match envelope. Update [backend/src/applications/applications.service.ts](backend/src/applications/applications.service.ts).

### Admin no-match insight

- [ ] T087 [US3] Design pipeline: run `ui-ux-pro-max` for screen 03-no-match-insight and save to [specs/003-matching-engine-post/design/03-no-match-insight/promax.md](specs/003-matching-engine-post/design/03-no-match-insight/promax.md). Cover: primary-reason callout, suggestion cards with unlock-count badge, "would unlock N programs" CTA copy, RTL.
- [ ] T088 [US3] Implement `NoMatchInsightComponent` at [admin/src/app/features/applications/detail/no-match-insight.component.ts](admin/src/app/features/applications/detail/no-match-insight.component.ts) — renders the primary-reason banner + suggestion cards on the detail page when `application.status === 'no_match'`.
- [ ] T089 [US3] Run `impec polish` and save to [specs/003-matching-engine-post/design/03-no-match-insight/impec.md](specs/003-matching-engine-post/design/03-no-match-insight/impec.md).

**Phase 5 done when**: Quickstart §9 passes — no-match envelope returns with structured suggestions; admin detail shows the insight surface.

---

## Phase 6 — User Story US4: Idempotent re-submission (P2)

**Story goal** (spec.md US4): Same idempotency key + same body within 1 hour returns cached `applicationId` + cached offers; same key + different body → 409 `IDEMPOTENCY_KEY_MISMATCH`.

**Independent test criteria**: Submit signed request with `Idempotency-Key: foo-123`. Receive offers. Re-submit same body + key → same applicationId, zero new audit events, zero new offer rows. Submit different body + same key → 409.

- [ ] T090 [US4] Wire idempotency lookup into `ApplicationsService.submit()` BEFORE engine run: compute `payloadHash = sha256(canonicalJson(body))`; `idempotencyRepository.get(clientId, key)` → cache hit with matching hash returns cached `applicationId` + re-fetched offers via `BankOffersRepository.findByApplicationId`; hash mismatch throws `IdempotencyKeyMismatchException`. Cache miss falls through to engine run. Update [backend/src/applications/applications.service.ts](backend/src/applications/applications.service.ts).
- [ ] T091 [US4] On engine-run success persist the cache entry: `idempotencyRepository.set(clientId, key, payloadHash, applicationId)` with 1 h TTL.
- [ ] T092 [US4] Wire `ApplicantRateLimitGuard` bypass: when the request matches a fresh idempotency cache hit, do NOT consume bucket capacity (FR-067). Hook a `req.idempotentReplay` flag into the guard.

**Phase 6 done when**: Quickstart §7 passes — idempotent re-submission returns identical content with zero database side-effects.

---

## Phase 7 — User Story US5: Offline-fixture engine invocation (P3)

**Story goal** (spec.md US5): Developer imports `match()` from the engine module, calls it with fixture programs + profile, returns the same `MatchResult[]` shape — zero NestJS / Prisma / HTTP imports.

**Independent test criteria**: `npx tsx backend/src/matching/match.checks.ts` runs all 14 golden scenarios from spec Appendix; each prints `✓` with matched programs + best-offer rate or `✗` with divergence. Dependency-graph audit confirms zero forbidden imports.

- [ ] T093 [US5] Build the 14 golden-scenario fixtures at [backend/src/matching/match.checks.ts](backend/src/matching/match.checks.ts) — inline `BankProgram` array (copy from feature 002 seed catalogs) + applicant profiles per spec Appendix. Each scenario asserts expected programs matched + the engine-computed `best offer` per `lowest_installment` priority.
- [ ] T094 [US5] Dependency-graph audit script at [backend/scripts/audit-engine-deps.ts](backend/scripts/audit-engine-deps.ts) — parses `backend/src/matching/**/*.ts` import statements; fails CI if any forbidden import slips through ESLint. Used by SC-019.
- [ ] T095 [US5] Engine README at [backend/src/matching/README.md](backend/src/matching/README.md) — extraction contract; type-only export surface; dependency-graph rules; runbook for adding a new eligibility / income strategy.

**Phase 7 done when**: `npx tsx backend/src/matching/match.checks.ts` exits 0 with all 14 scenarios green; the dependency-graph audit reports zero violations.

---

## Phase 8 — Polish & Cross-Cutting Concerns

**Goal**: Retention + erasure, optional Vitest, OpenAPI lint, RTL + WCAG audits, performance check.

### Retention + erasure

- [ ] T096 Implement `ArchiveScheduler` at [backend/src/applications/retention/archive.scheduler.ts](backend/src/applications/retention/archive.scheduler.ts) per research R7 + FR-063 — daily cron at 02:00 Africa/Cairo; selects applications older than 24 months; streams to S3; transitions status to `archived`; emits audit event.
- [ ] T097 Implement `ColdTierWriter` at [backend/src/applications/retention/cold-tier-writer.ts](backend/src/applications/retention/cold-tier-writer.ts) — JSONL.gz writer + manifest append + atomic upload + read-back verification.
- [ ] T098 Implement `ErasureService` at [backend/src/applications/retention/erasure.service.ts](backend/src/applications/retention/erasure.service.ts) per FR-064 — `eraseApplication(applicationId)`: zero scalar PII + replace JSONB blobs with tombstones in both tiers; emit `data.erasure.completed` per FR-065.
- [ ] T099 Implement erasure CLI at [backend/scripts/erase-application.ts](backend/scripts/erase-application.ts) for operator-triggered erasure (verified via support flow upstream).

### Testing (developer-discretion)

- [ ] T100 [P] Vitest engine suite at [backend/src/matching/engine/match.spec.ts](backend/src/matching/engine/match.spec.ts) — all 14 golden scenarios + per-strategy income + cascade-floor rules + PMT precision + DBR monotonicity + approval-probability weight isolation + ranking tie-break (~40 cases).
- [ ] T101 [P] Vitest suggestions suite at [backend/src/matching/suggestions/suggest.spec.ts](backend/src/matching/suggestions/suggest.spec.ts) — every FR-047a trigger row + unlock-counter convergence + ordering by `programsUnlocked`.
- [ ] T102 [P] Vitest integration suite at [backend/src/applications/applications.service.spec.ts](backend/src/applications/applications.service.spec.ts) — single-transaction commit / rollback (mock Prisma transaction), idempotency hit / miss / mismatch, HMAC + nonce replay, audit-event payload shape + PII-free assertion.

### Audit + observability

- [ ] T103 [P] Audit payload schema freeze at [backend/src/audit/payloads/application.payloads.ts](backend/src/audit/payloads/application.payloads.ts) — typed payload contracts for the 6 new event types; runtime validation via `class-validator` at write time.
- [ ] T104 [P] OpenAPI lint pass on [contracts/openapi.yaml](contracts/openapi.yaml) (`npx @redocly/cli lint`); reconcile structural issues against the controllers.

### Quickstart + accessibility + performance

- [ ] T105 [P] Run [quickstart.md](./quickstart.md) end-to-end §1 → §14 on a fresh local environment. Record any drift to [specs/003-matching-engine-post/quickstart-failures.md](specs/003-matching-engine-post/quickstart-failures.md).
- [ ] T106 [P] RTL spot-check across 3 new screens at 360 / 768 / 1280 widths. Capture drift in [specs/003-matching-engine-post/design/rtl-followups.md](specs/003-matching-engine-post/design/rtl-followups.md).
- [ ] T107 [P] WCAG 2.2 AA audit (axe-DevTools manual + keyboard-only walkthrough) across the 3 screens. Critical findings feed into the screen's impec polish notes.
- [ ] T108 [P] Performance check (Vegeta / k6 against `/api/v1/apply` at 50 RPS for 60 s): verify p95 < 800 ms end-to-end + engine p95 < 500 ms (read from `MATCHING_ENGINE_RUN` durationMs). Record results in [specs/003-matching-engine-post/perf-results.md](specs/003-matching-engine-post/perf-results.md).
- [ ] T109 [P] Role-gating end-to-end (SC-003 + SC-012): viewer × write actions blocked at UI + API; admin / super_admin × `/api/admin/applications/*` allowed; mobile endpoint rejects without HMAC.

---

## Dependency graph

```
Phase 1 (Setup) ─┐
                 ├─→ Phase 2 (Foundational) ─→ Phase 3 (US1 P1)  ──┐
                 │                          ─→ Phase 4 (US2 P1)  ──┼─→ Phase 6 (US4 P2)
                 │                          ─→ Phase 5 (US3 P2)  ──┘
                 │                          ─→ Phase 7 (US5 P3)
                 └─→ Phase 8 (Polish — alongside Phases 3–7)
```

**Strict hard-dependencies**:

- Phase 2 BLOCKS Phases 3–7. Every T003–T029 must be `[x]` before any user-story task starts.
- Phase 5 (US3 suggestions) reuses the engine from Phase 3. T082–T084 can be drafted in parallel with Phase 3 but require T061 (engine entry) to test.
- Phase 6 (US4 idempotency) reuses `ApplicationsService.submit()` from Phase 3 — T090 depends on T065.
- Phase 7 (US5 offline engine) reuses everything from Phase 3 — T093 depends on T061.

**Soft dependencies**: design-pipeline tasks (T068/T069/T087) MAY land before backend work in the same phase per Principle XXIII (promax precedes implementation).

---

## Parallel execution windows

**Within Phase 2**:
- T008–T012 (error codes + translations + xlf scaffolding) — 5 parallel files.
- T017 + T018 (PII masking helpers backend + admin) — 2 parallel.
- T024 + T025 (repositories) — 2 parallel.

**Within Phase 3 (US1 engine fan-out)**:
- T030–T034 (PMT / DBR / fees / approval / ranking) — 5 parallel.
- T035–T045 (11 eligibility modules) — 11 parallel.
- T046–T054 (9 income strategies) — 9 parallel.
- T056–T058 (3 tier resolvers) — 3 parallel.
- Note: T055 (income dispatcher) blocks on T046–T054; T061 (engine entry) blocks on all of the above.

**Within Phase 4**:
- T068 + T069 (2 promax) — parallel.
- T077 + T078 + T079 (3 detail-page sub-components) — parallel.
- T080 + T081 (2 impec) — parallel.

**Within Phase 8**:
- T100 + T101 + T102 (3 Vitest suites) — parallel.
- T103 + T104 — parallel.
- T105–T109 — parallel.

---

## Implementation strategy

**MVP scope (≈ 1 PR)**: Phases 1 + 2 + Phase 3 (US1).
- Outcome: signed mobile applicants get ranked offers; admin sees raw data via OpenAPI / `/api/docs`.
- Sufficient to demo the engine end-to-end to stakeholders.
- Defers admin pages, no-match suggestions, idempotency, retention.

**Incremental delivery cadence**:

| Increment | Phases | What ships |
|---|---|---|
| MVP | 1, 2, 3 | Apply endpoint + engine + offer persistence; admin via OpenAPI only |
| Increment 1 | 4 | Admin applications list + detail + offer cards + failed-checks + audit timeline |
| Increment 2 | 5 | No-match suggestions engine + admin insight surface |
| Increment 3 | 6 | Idempotency cache + rate-limit bypass for replays |
| Increment 4 | 7 | Offline engine sanity script + dependency-graph audit |
| Hardening | 8 | Retention + erasure + Vitest + RTL + WCAG + load test |

Each increment is a complete demoable PR.

---

## Validation checklist

Format: every checkbox follows `- [ ] T### [P?] [USx?] description path`.

- Setup tasks (T001–T002): no story labels. ✓
- Foundational tasks (T003–T029): no story labels. ✓
- US1 phase tasks (T030–T067): `[US1]` label. ✓
- US2 phase tasks (T068–T081): `[US2]` label. ✓
- US3 phase tasks (T082–T089): `[US3]` label. ✓
- US4 phase tasks (T090–T092): `[US4]` label. ✓
- US5 phase tasks (T093–T095): `[US5]` label. ✓
- Polish tasks (T096–T109): no story labels. ✓

Total: **109 tasks**. Breakdown: Setup 2 · Foundational 27 · US1 38 · US2 14 · US3 8 · US4 3 · US5 3 · Polish 14.

Story independence: each user-story phase has its own service-layer + controller + admin-surface (where applicable) + design-pipeline closure. Phases 4–7 can be reordered relative to each other; Phase 6 + Phase 7 depend on the engine entry from Phase 3.
