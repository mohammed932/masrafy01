# Tasks: BankProgram Management — Tiered Loan Product Configuration

**Feature**: 002-bank-programs · **Branch**: `002-bank-programs`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/) · **Quickstart**: [quickstart.md](./quickstart.md)

## Conventions

- Checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path` (strict per `/speckit.tasks` template).
- `[P]` = parallelizable with other `[P]` tasks in the same phase (different files, no incomplete-task dependencies).
- `[USx]` story labels appear ONLY on user-story phase tasks (Phases 3–7).
- File paths are absolute-from-repo-root.
- Constitution v1.3.0 + spec FRs control acceptance — every task description names its FR / SC anchor where relevant.
- Testing is OPTIONAL per Principles XVI + XXVII (v1.2.0 placeholders). Only the cascade-evaluator Vitest suite is queued — developer discretion per research.md R15.

---

## Phase 1 — Setup

**Goal**: Lay down the branch-level scaffolding that does not yet touch user-story code paths. Two tiny tasks; both parallelizable.

- [X] T001 [P] Verify branch + base state: confirm `002-bank-programs` branch is current, `git status` clean before edits, Prisma client regenerable, infra running per [quickstart.md §1–§3](./quickstart.md). Log baseline to a one-line note in the commit message of the first foundational migration.
- [X] T002 [P] Bootstrap the design-pipeline folder skeleton: create `specs/002-bank-programs/design/{01-list-page,02-detail-view,03-create-drawer,04-clone-modal,05-delete-confirmation}/` with a placeholder `README.md` inside each documenting the screen's purpose, target user roles, and the constitutional Principle XXIII contract (promax pre + impec post artifacts MUST land here at PR time).

---

## Phase 2 — Foundational (BLOCKING for all user stories)

**Goal**: Land the cross-story plumbing. Nothing in Phases 3–7 may start until every task here is `[x]`.

**Independent verification of phase completion**: `npm run start:dev` (backend) boots clean with `bank-programs/` + `platform-enumerations/` modules loaded; admin compiles; `prisma migrate dev` applied; no typecheck errors.

### Data model + migrations

- [X] T003 Extend Prisma schema with `BankProgram` model + `BankProgramType` enum in [backend/prisma/schema.prisma](backend/prisma/schema.prisma). Honor field shapes from [data-model.md](./data-model.md) (uuid, programCode unique, currencies string array, JSONB sub-configs, version Int default 1, createdBy/updatedBy uuid FKs to `StaffAccount`).
- [X] T004 Add new `AuditEventType` enum values to [backend/prisma/schema.prisma](backend/prisma/schema.prisma): `BANK_PROGRAM_CREATED`, `BANK_PROGRAM_UPDATED`, `BANK_PROGRAM_TOGGLED`, `BANK_PROGRAM_CLONED`, `BANK_PROGRAM_DELETED`, `BANK_PROGRAM_RATE_UPDATED`, `BANK_PROGRAM_QUALITATIVE_REVIEW_DECIDED` (research.md R6).
- [X] T005 Generate named migration `add_bank_programs` via `npx prisma migrate dev --name add_bank_programs` (Principle XI — migrate only, no db push). Inspect the SQL output before committing.
- [X] T006 Append raw-SQL block to the migration in [backend/prisma/migrations/<timestamp>_add_bank_programs/migration.sql](backend/prisma/migrations/) creating the `searchVector` generated `tsvector` column + GIN index per [data-model.md §Prisma sketch](./data-model.md).
- [X] T007 Run `npx prisma generate` and verify the new Prisma client types in [backend/node_modules/@prisma/client/index.d.ts](backend/node_modules/@prisma/client/index.d.ts).

### Error codes + i18n scaffolding

- [X] T008 [P] Extend backend typed error-code union + central registry in [backend/src/common/error-codes.ts](backend/src/common/error-codes.ts) with the 13 new codes from [contracts/error-codes.md](./contracts/error-codes.md): `BANK_PROGRAM_NOT_FOUND`, `PROGRAM_CODE_ALREADY_IN_USE`, `INVALID_VARIABLE_RATE_CONFIGURATION`, `INVALID_QUALITATIVE_REVIEW_CEILING`, `QUALITATIVE_REVIEW_CEILING_BELOW_BASE`, `DERIVATION_ARITHMETIC_MISMATCH`, `CONFLICT_STALE_DATA`, `BANK_PROGRAM_HAS_OFFERS`, `UNKNOWN_ENUMERATION_KEY`, `DEPRECATED_ENUMERATION_KEY`, `ENUMERATION_REGISTRY_UNAVAILABLE`, `SEED_RATE_VERIFICATION_FAILED`, `SEED_REQUIRES_SUPER_ADMIN`.
- [X] T009 [P] Add Arabic translations for all 13 codes to [admin/src/i18n/error-codes.ar-EG.json](admin/src/i18n/error-codes.ar-EG.json) per [contracts/error-codes.md](./contracts/error-codes.md).
- [X] T010 [P] Add English translations for all 13 codes to [admin/src/i18n/error-codes.en-US.json](admin/src/i18n/error-codes.en-US.json).
- [X] T011 [P] Reserve i18n message IDs for all bank-program-feature UI strings in [admin/src/i18n/messages.ar-EG.xlf](admin/src/i18n/messages.ar-EG.xlf) and [admin/src/i18n/messages.en-US.xlf](admin/src/i18n/messages.en-US.xlf) (placeholder structure — concrete strings land as section components ship).

### PlatformEnumeration stub (research.md R4)

- [X] T012 Create `PlatformEnumerationRepository` interface + `EnumerationType` + `EnumerationMember` types in [backend/src/platform-enumerations/platform-enumerations.repository.ts](backend/src/platform-enumerations/platform-enumerations.repository.ts).
- [X] T013 Implement in-memory stub `InMemoryPlatformEnumerationRepository` seeded at boot (salary categories, transfer types, employment types, loan purposes, property types, city tiers, professor ranks, military grades, product categories, customer-program tiers, performance tiers, company types, required documents, currencies) in [backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts). Fail-fast at boot if any required enumeration type is empty.
- [X] T014 Wire `PlatformEnumerationsModule` with a DI provider that resolves to the stub today (interface swap point for future feature 003) in [backend/src/platform-enumerations/platform-enumerations.module.ts](backend/src/platform-enumerations/platform-enumerations.module.ts).
- [X] T015 Add admin signal-cache `PlatformEnumerationsService` (loads + caches enumeration members; emits `available` signal; refreshes on stale) in [admin/src/app/core/platform-enumerations/platform-enumerations.service.ts](admin/src/app/core/platform-enumerations/platform-enumerations.service.ts).

### Validators + cascade evaluator skeleton

- [X] T016 [P] Implement custom `@DecimalRange(min, max, { precision, scale })` class-validator decorator at [backend/src/common/decorators/decimal-range.decorator.ts](backend/src/common/decorators/decimal-range.decorator.ts) (R1 — Decimal end-to-end without floats).
- [X] T017 [P] Implement `@ValidDerivationChain()` cross-field class-validator decorator at [backend/src/common/decorators/valid-derivation-chain.decorator.ts](backend/src/common/decorators/valid-derivation-chain.decorator.ts) enforcing FR-008s arithmetic guard within ±0.0001 %.
- [X] T018 [P] Define cascade evaluator types + frozen-order constants in [backend/src/bank-programs/cascade/cascade.types.ts](backend/src/bank-programs/cascade/cascade.types.ts) (FR-008b/c/d frozen orders, `CascadeResult`, `RateBandValue`, `DerivationChain`, `ApplicantContext`).

### DTOs

- [X] T019 Sub-config DTO files in [backend/src/bank-programs/dto/sub-configs/](backend/src/bank-programs/dto/sub-configs/): `tenor-config.dto.ts`, `loan-limits-config.dto.ts`, `pricing-config.dto.ts`, `eligibility-config.dto.ts`, `performance-criteria-config.dto.ts`, `income-assumption-config.dto.ts`, `fees-config.dto.ts`, `derivation.dto.ts` — each with `class-validator` decorators per the validation rules in [data-model.md](./data-model.md).
- [X] T020 Top-level request DTOs in [backend/src/bank-programs/dto/](backend/src/bank-programs/dto/): `create-bank-program.dto.ts`, `update-bank-program.dto.ts` (extends create + adds `version`), `list-bank-programs.query.ts`, `clone-bank-program.dto.ts`, `toggle-bank-program.dto.ts`.
- [X] T021 Response DTOs in [backend/src/bank-programs/dto/](backend/src/bank-programs/dto/): `bank-program.response.dto.ts` (full admin shape) + `bank-program-list-row.response.dto.ts` (list-row reduction).
- [X] T022 Mobile response DTO `mobile-bank-program.response.dto.ts` in [backend/src/bank-programs/dto/](backend/src/bank-programs/dto/) — explicit allowlist of fields per research.md R5; ZERO field reuse from the admin DTO.

### Repositories + module wiring

- [X] T023 Implement `BankProgramRepository` at [backend/src/bank-programs/bank-programs.repository.ts](backend/src/bank-programs/bank-programs.repository.ts) — covers `findManyPaged`, `findByProgramCode`, `findById`, `create`, `updateWithVersion` (compare-and-swap returning `null` on version mismatch), `toggleWithVersion`, `delete`, `countOffersReferencing`. Hydrates Decimal-as-string from JSONB.
- [X] T024 Implement `BankProgramAuditRepository` at [backend/src/bank-programs/audit/bank-program-audit.repository.ts](backend/src/bank-programs/audit/bank-program-audit.repository.ts) for the 7 new event types (R6). Writes through the existing `AuditEvent` table from feature 001.
- [X] T025 Wire `BankProgramsModule` at [backend/src/bank-programs/bank-programs.module.ts](backend/src/bank-programs/bank-programs.module.ts): exports for `BankProgramsService` + `BankProgramsMobileService` + `BankProgramRepository`; imports `PlatformEnumerationsModule`. Register in [backend/src/app.module.ts](backend/src/app.module.ts).
- [X] T026 Register the admin lazy-loaded route shell at [admin/src/app/features/bank-programs/bank-programs.routes.ts](admin/src/app/features/bank-programs/bank-programs.routes.ts) + add the navigation entry to the existing sidebar component at [admin/src/app/features/shell/sidebar.component.ts](admin/src/app/features/shell/sidebar.component.ts) gated by `canMatchFn` (auth + role).
- [X] T027 Add `BankProgramsApiService` (HttpClient adapter) at [admin/src/app/features/bank-programs/bank-programs.api.service.ts](admin/src/app/features/bank-programs/bank-programs.api.service.ts) — methods: `list(query)`, `getByCode(code)`, `create(payload)`, `update(code, payload)`, `toggle(code, body)`, `clone(code, body)`, `delete(code, headers)`. Returns typed signals where stateful; pure promises otherwise.

**Phase 2 done when**: Backend boots, admin compiles, migration applied, error codes + translations seeded, PlatformEnumeration stub returns active members, all DTO types exported, repositories instantiable in a unit harness, lazy admin route resolves to an empty placeholder.

---

## Phase 3 — User Story US1: Admin creates a new bank program from scratch (P1)

**Story goal** (spec.md US1): An admin completes the multi-section drawer form and persists a new bank program with every required tier configuration. The program is visible to the matching engine within one cycle.

**Independent test criteria**: Sign in as admin → click "Add bank program" → complete each section with a known-good salaried-only personal loan (50,000–1,500,000 EGP, 24 % rate, 36-month max) → save → confirm the program is returned by `GET /api/admin/bank-programs?search=<programCode>` AND that a follow-up create with the same `programCode` is rejected `PROGRAM_CODE_ALREADY_IN_USE`. Acceptance scenarios 1, 2, 3, 4, 7, 8 from spec.md US1.

### Design pipeline (Principle XXIII)

- [X] T028 [US1] Run `ui-ux-pro-max` for screen 03-create-drawer and save the design output to [specs/002-bank-programs/design/03-create-drawer/promax.md](specs/002-bank-programs/design/03-create-drawer/promax.md). Cover: drawer width (720 px per research.md R11), section accordion vs always-expanded, sticky footer, validation-error chrome, RTL.

### Backend

- [X] T029 [US1] Implement `BankProgramsService.create()` at [backend/src/bank-programs/bank-programs.service.ts](backend/src/bank-programs/bank-programs.service.ts) — orchestrates: registry-availability check (throw `ENUMERATION_REGISTRY_UNAVAILABLE` on stub fail), tier-key validation against `PlatformEnumerationRepository.isActiveMember()` (throw `UNKNOWN_ENUMERATION_KEY` / `DEPRECATED_ENUMERATION_KEY`), variable-rate consistency check (FR-011a → `INVALID_VARIABLE_RATE_CONFIGURATION`), qualitative-review ceiling rules (FR-003a → `INVALID_QUALITATIVE_REVIEW_CEILING` or `QUALITATIVE_REVIEW_CEILING_BELOW_BASE`), derivation arithmetic (FR-008s → `DERIVATION_ARITHMETIC_MISMATCH`), repository.create within a single Prisma transaction.
- [X] T030 [US1] Implement `BankProgramsController` POST endpoint at [backend/src/bank-programs/bank-programs.controller.ts](backend/src/bank-programs/bank-programs.controller.ts) for `POST /api/admin/bank-programs` per [contracts/openapi.yaml](./contracts/openapi.yaml). Guarded by JWT + `adminOrSuperAdminGuard` from feature 001. Returns 201 + the canonical envelope.
- [X] T031 [US1] Emit `BANK_PROGRAM_CREATED` audit event in the service create path via `BankProgramAuditRepository` with `{ programCode, friendlyName, bankName, productCategory, active }` payload + actor + correlationId (Principle VII).
- [X] T032 [US1] Surface OpenAPI annotations on the controller method via `@nestjs/swagger` decorators reflecting [contracts/openapi.yaml](./contracts/openapi.yaml) shape. Verify at `/api/docs`.

### Admin form drawer

- [X] T033 [US1] Implement the form drawer host component `BankProgramFormDrawer` at [admin/src/app/features/bank-programs/form/bank-program-form.drawer.ts](admin/src/app/features/bank-programs/form/bank-program-form.drawer.ts). Side-drawer pattern (`panelClass: 'side-drawer'`, 720 px width). Owns the typed Reactive Form root + submit state + section validity signals. Two modes: `create` (no preload) + `edit` (preload payload — used in Phase 5).
- [X] T034 [US1] [P] Implement `IdentitySectionComponent` at [admin/src/app/features/bank-programs/form/sections/identity-section.component.ts](admin/src/app/features/bank-programs/form/sections/identity-section.component.ts) — programCode (locked in edit mode), bankName, friendlyName (+ Arabic), programType, productCategory, currencies, active toggle.
- [X] T035 [US1] [P] Implement `TenorSectionComponent` at [admin/src/app/features/bank-programs/form/sections/tenor-section.component.ts](admin/src/app/features/bank-programs/form/sections/tenor-section.component.ts) — min/max months + tier override editors keyed by salary category + employment type.
- [X] T036 [US1] [P] Implement `LoanLimitsSectionComponent` at [admin/src/app/features/bank-programs/form/sections/loan-limits-section.component.ts](admin/src/app/features/bank-programs/form/sections/loan-limits-section.component.ts) — per-currency min/max editor, full set of tier overrides (CD tier, property type, city tier, transfer type, salary category, employment type, performance tier, top-up, LTV, qualitativeReviewMaxEGP, otherCitiesMaxEGP).
- [X] T037 [US1] [P] Implement `PricingSectionComponent` at [admin/src/app/features/bank-programs/form/sections/pricing-section.component.ts](admin/src/app/features/bank-programs/form/sections/pricing-section.component.ts) — `isVariableRate` toggle + base / current effective rate (conditional REQUIRED per FR-011a) + tier-map editors for every cascade level (rate by tenor / transferType / downPaymentPercent / customerProgramTier / assetValueBand / loanAmountBand / seniority / employmentType / tenorAndCustomerType) + buyout fields + fee-waiver fields + insurance-waiver fields.
- [X] T038 [US1] [P] Implement `EligibilitySectionComponent` at [admin/src/app/features/bank-programs/form/sections/eligibility-section.component.ts](admin/src/app/features/bank-programs/form/sections/eligibility-section.component.ts) — every flag + wealth gates (`minBankStatementBalanceEGP`, `minAssetsValueEGP`) + `requiresQualitativeReview` (gates loan-limits qualitative-review ceiling) + `requiresNoDocuments`.
- [X] T039 [US1] [P] Implement `PerformanceCriteriaSectionComponent` at [admin/src/app/features/bank-programs/form/sections/performance-criteria-section.component.ts](admin/src/app/features/bank-programs/form/sections/performance-criteria-section.component.ts) — collapsible (only buyout + cross-sell programs need it).
- [X] T040 [US1] [P] Implement `IncomeAssumptionSectionComponent` at [admin/src/app/features/bank-programs/form/sections/income-assumption-section.component.ts](admin/src/app/features/bank-programs/form/sections/income-assumption-section.component.ts) — strategy switcher (`@switch` on `strategy()` signal); only the active strategy's table is rendered (Acceptance Scenario US1 #4 + #8). Switching strategy clears the prior strategy's table.
- [X] T041 [US1] [P] Implement `FeesSectionComponent` at [admin/src/app/features/bank-programs/form/sections/fees-section.component.ts](admin/src/app/features/bank-programs/form/sections/fees-section.component.ts).
- [X] T042 [US1] [P] Implement `DocumentsSectionComponent` at [admin/src/app/features/bank-programs/form/sections/documents-section.component.ts](admin/src/app/features/bank-programs/form/sections/documents-section.component.ts) — multi-select of required document enumeration members + free-form notes + operator tips.
- [X] T043 [US1] Implement `TierKeyPickerComponent` at [admin/src/app/features/bank-programs/tier-key-picker/tier-key-picker.component.ts](admin/src/app/features/bank-programs/tier-key-picker/tier-key-picker.component.ts) — bound to the `PlatformEnumerationsService` signal; renders disabled "enumerations unavailable, retry shortly" state when registry-unavailable (Edge Case + FR-010b).
- [X] T044 [US1] Implement derivation editor (inline within rate-band-map rows in the pricing section) — `{ value, derivation?: { sourceRatePercent, deltaPercent, reason } }`. Live arithmetic preview validates client-side; server enforces.
- [X] T045 [US1] Wire the drawer submit → `BankProgramsApiService.create()`. On 201 → close drawer, refresh list, fire localized success toast. On 4xx → map error code to localized message via the error-code helper from feature 001 and attach to the relevant FormControl (FR-013).
- [X] T046 [US1] Add the "Add bank program" CTA + drawer-opening logic to [admin/src/app/features/bank-programs/list/bank-programs-list.page.ts](admin/src/app/features/bank-programs/list/bank-programs-list.page.ts) (component itself lands in Phase 4; this task touches the file's CTA wiring slot only — protect from merge collision with T056 by landing T056 first or by isolating the CTA into a stub here).
- [X] T047 [US1] Run `impec polish` on the create-drawer post-implementation and save the polish notes to [specs/002-bank-programs/design/03-create-drawer/impec.md](specs/002-bank-programs/design/03-create-drawer/impec.md). Fix every Critical / Should-Fix item in-place; defer Nice-to-Have to a follow-up note.

**Phase 3 done when**: Acceptance Scenarios 1, 2, 3, 4, 7, 8 from spec.md US1 pass end-to-end via [quickstart.md §8](./quickstart.md). `POST /api/admin/bank-programs` returns 201 + envelope or the relevant 4xx code with the offending field surfaced.

---

## Phase 4 — User Story US2: Staff list, search, view, and inspect bank programs (P1)

**Story goal** (spec.md US2): Internal staff browse, search, filter, paginate, and open any program in plain-language detail with cascade preview + what-if pane. Role-gating hides write actions for viewers.

**Independent test criteria**: Seed five programs spanning income-assumption strategies + sign in as each role (viewer / admin / super_admin) + confirm: viewer sees zero write actions; admin sees create / edit / clone / toggle (no delete); super_admin sees all actions; opening a program renders each tier rule in plain Arabic (or English); search + filter narrow the list as expected; pagination metadata accurate. Acceptance scenarios 1, 2, 3, 4, 5, 6, 7 from spec.md US2 + SC-017 / SC-027 from the cascade-preview's deterministic resolution.

### Design pipeline

- [X] T048 [US2] [P] Run `ui-ux-pro-max` for screen 01-list-page and save to [specs/002-bank-programs/design/01-list-page/promax.md](specs/002-bank-programs/design/01-list-page/promax.md). Cover: row density, role-gated action menu, deprecated-key badges, empty state, mobile/responsive behaviour.
- [X] T049 [US2] [P] Run `ui-ux-pro-max` for screen 02-detail-view and save to [specs/002-bank-programs/design/02-detail-view/promax.md](specs/002-bank-programs/design/02-detail-view/promax.md). Cover: section layout, cascade-preview affordance, what-if pane on the right rail, derivation-chip styling, RTL.

### Backend

- [X] T050 [US2] Implement `BankProgramsService.list()` at [backend/src/bank-programs/bank-programs.service.ts](backend/src/bank-programs/bank-programs.service.ts) — filters (bankName, active, productCategory, employmentType), search (tsvector + GIN per research.md R9), pagination (page + pageSize + totalCount). Annotates each row with `deprecatedKeyCount` derived from registry membership at fetch time (FR-010c).
- [X] T051 [US2] Implement `BankProgramsService.findOne()` at the same service — single-program detail with full sub-configs + `deprecatedKeys[]` populated against the live registry (FR-010c).
- [X] T052 [US2] Implement `BankProgramsController` GET endpoints for `GET /api/admin/bank-programs` + `GET /api/admin/bank-programs/:programCode` per [contracts/openapi.yaml](./contracts/openapi.yaml). All three roles permitted (FR-038).
- [X] T053 [US2] Implement the full cascade evaluator at [backend/src/bank-programs/cascade/cascade.evaluator.ts](backend/src/bank-programs/cascade/cascade.evaluator.ts) — pure function consuming `BankProgramConfig` + `ApplicantContext` per research.md R2. Returns `CascadeResult { value, matchedLevel, derivationChain?, trace[] }`. Honors FR-008o.1 (down-payment floor-to-≤), FR-008p.1 (asset-value / loan-amount floor-to-≤), FR-005c.1 (wealth-gate AND), FR-008b/c/d frozen orders. Pure, deterministic, no I/O.

### Admin list page

- [X] T054 [US2] Implement `BankProgramsListPage` at [admin/src/app/features/bank-programs/list/bank-programs-list.page.ts](admin/src/app/features/bank-programs/list/bank-programs-list.page.ts) — Material `mat-table` with paginator, role-gated action menu, filter chips, search input with debounce (`toSignal(controlValueChanges.pipe(debounceTime(250)))`), deprecated-key badge per row.
- [X] T055 [US2] Add empty state + deprecated-key banner UI to the list page — "No programs match these filters" with a "Clear filters" affordance (Edge Case from spec.md).
- [X] T056 [US2] Wire the "Add bank program" CTA on the list page (consumes Phase 3's drawer component). Resolves the T046 protection note.

### Admin detail page

- [X] T057 [US2] Implement `BankProgramDetailPage` at [admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts](admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts) — section-by-section read-only render with plain-Arabic / plain-English tier descriptors (FR-017, FR-034); role-gated edit / clone / toggle / delete buttons; deprecated-key banner (FR-010c).
- [X] T058 [US2] [P] Implement `CascadePreviewComponent` at [admin/src/app/features/bank-programs/detail/cascade-preview.component.ts](admin/src/app/features/bank-programs/detail/cascade-preview.component.ts) — renders the FR-008f cascade-trace from a static config + an applicant context. Reused by detail view + by the what-if pane below.
- [X] T059 [US2] [P] Implement `DerivationChipComponent` at [admin/src/app/features/bank-programs/detail/derivation-chip.component.ts](admin/src/app/features/bank-programs/detail/derivation-chip.component.ts) — renders a tier-band's derivation chain as a chip with hover-card explaining `value = sourceRatePercent + deltaPercent · "reason"` (FR-008s, used in the cascade preview).
- [X] T060 [US2] Implement the "Try a sample applicant" what-if pane (FR-033e + research.md R12) inline on the detail page. Pure-client cascade evaluation via a TypeScript port of the backend's cascade module — same frozen order, same floor-rules — shared via a types-only contract so the two implementations never drift. No matching-engine call.

### Polish

- [X] T061 [US2] Run `impec polish` on the list page and save to [specs/002-bank-programs/design/01-list-page/impec.md](specs/002-bank-programs/design/01-list-page/impec.md).
- [X] T062 [US2] Run `impec polish` on the detail view and save to [specs/002-bank-programs/design/02-detail-view/impec.md](specs/002-bank-programs/design/02-detail-view/impec.md).

**Phase 4 done when**: [quickstart.md §6 + §7](./quickstart.md) pass; SC-017 + SC-027 + SC-029 deterministic-resolution verified manually against the what-if pane on at least one sales-floor program.

---

## Phase 5 — User Story US3: Admin edits and toggles existing programs (P2)

**Story goal** (spec.md US3): Admin updates a program's fields (except programCode), toggles active/inactive, and never silently overwrites another admin's concurrent edit. Edits do NOT mutate existing bank offers.

**Independent test criteria**: With three programs in the system, edit program #1's rate from 24 → 25, verify the detail view reflects 25 % and that any pre-existing `BankOffer` rows from program #1 still report 24 % (FR-020, SC-005). Toggle program #2 inactive → the matching candidate list no longer returns it (SC-008). Open the same program in two browser tabs, edit + save tab 2 first, then attempt to save tab 1 → receive `CONFLICT_STALE_DATA` + current version (SC-018). Acceptance scenarios 1, 2, 3, 4, 6 from spec.md US3.

### Backend

- [X] T063 [US3] Implement `BankProgramsService.update()` at [backend/src/bank-programs/bank-programs.service.ts](backend/src/bank-programs/bank-programs.service.ts) — re-runs every validation from T029 + version compare-and-swap via `BankProgramRepository.updateWithVersion()` (research.md R14). On version mismatch return `CONFLICT_STALE_DATA` envelope with current persisted version (FR-021). Refuses programCode mutation (FR-019) — silently ignores any submitted programCode on update.
- [X] T064 [US3] Implement `BankProgramsService.toggle()` — increments version (R14) + flips active flag + emits `BANK_PROGRAM_TOGGLED`. Same version-conflict guard.
- [X] T065 [US3] Implement `BankProgramsController` PATCH + toggle endpoints per [contracts/openapi.yaml](./contracts/openapi.yaml). JWT + adminOrSuperAdminGuard.
- [X] T066 [US3] Implement structural diff for `BANK_PROGRAM_UPDATED` payload at [backend/src/bank-programs/audit/bank-program-diff.ts](backend/src/bank-programs/audit/bank-program-diff.ts) — scoped to top-level + sub-config field paths (R6). Returns `Array<{ fieldPath: string, before, after }>`.
- [X] T067 [US3] Emit `BANK_PROGRAM_RATE_UPDATED` in addition to `BANK_PROGRAM_UPDATED` when the diff touches `pricing.baseRatePercent` OR `pricing.currentEffectiveRatePercent` (FR-031). Distinct payload `{ programCode, beforeEffectiveRate, afterEffectiveRate, isVariableRate, operatorNote? }`.

### Admin

- [X] T068 [US3] Wire edit-mode preload in `BankProgramFormDrawer` from T033 — service.getByCode() → patch the form root → keep `version` in a hidden FormControl. ProgramCode FormControl `disabled` in edit mode (FR-019).
- [X] T069 [US3] Add the in-row active toggle affordance to the list page from T054 (Material slide-toggle). Calls `BankProgramsApiService.toggle(code, { active, version })`. On `CONFLICT_STALE_DATA` show a localized toast with a "Reload" action that re-fetches the row.
- [X] T070 [US3] Localized stale-data toast + reload affordance shared across edit-save and toggle paths in [admin/src/app/features/bank-programs/shared/stale-data-toast.helper.ts](admin/src/app/features/bank-programs/shared/stale-data-toast.helper.ts).
- [X] T071 [US3] Run `impec polish` on edit-mode drawer surface (re-uses 03-create-drawer artifact; add an `impec-edit.md` companion note to [specs/002-bank-programs/design/03-create-drawer/](specs/002-bank-programs/design/03-create-drawer/)).

**Phase 5 done when**: [quickstart.md §9 + §10 (toggle portion)](./quickstart.md) pass; SC-005, SC-009, SC-018 verified by a 100-iteration concurrent-save probe (developer-discretion script).

---

## Phase 6 — User Story US4: Admin clones an existing program (P2)

**Story goal** (spec.md US4): Admin uses an existing program as a deep-copy template. The system prompts for a new programCode, copies every sub-config, opens the new program in edit mode, and keeps the two programs independent post-clone.

**Independent test criteria**: Clone `ABK-01` to `ABK-21` → confirm every sub-field matches the source; navigate to the new program's edit page; save with a tweak; re-open `ABK-01` and confirm it is unchanged (SC-013-adjacent independence guarantee). Acceptance scenarios 1, 2, 3, 4 from spec.md US4.

### Design pipeline

- [X] T072 [US4] Run `ui-ux-pro-max` for screen 04-clone-modal and save to [specs/002-bank-programs/design/04-clone-modal/promax.md](specs/002-bank-programs/design/04-clone-modal/promax.md). Cover: code-input affordance, source-program preview, double-submit guard, success navigation.

### Backend

- [X] T073 [US4] Implement `BankProgramsService.clone()` at the bank-programs service — fetches source, deep-copies every sub-config via structured-clone, persists with the new programCode, emits `BANK_PROGRAM_CLONED { sourceProgramCode, newProgramCode }`. Rejects with `PROGRAM_CODE_ALREADY_IN_USE` on duplicate.
- [X] T074 [US4] Implement `BankProgramsController` clone POST endpoint per [contracts/openapi.yaml](./contracts/openapi.yaml).

### Admin

- [X] T075 [US4] Implement `CloneProgramDialog` at [admin/src/app/features/bank-programs/clone/clone-program.dialog.ts](admin/src/app/features/bank-programs/clone/clone-program.dialog.ts) — MatDialog with newProgramCode input, source preview, submit. Busy state on the submit button while the request is in flight (Edge Case — Acceptance Scenario 4 in spec.md US4: double-click does NOT create two clones).
- [X] T076 [US4] On 201 success → close dialog → navigate to the new program's detail page in edit mode (re-uses Phase 3's drawer).
- [X] T077 [US4] Run `impec polish` on the clone modal and save to [specs/002-bank-programs/design/04-clone-modal/impec.md](specs/002-bank-programs/design/04-clone-modal/impec.md).

**Phase 6 done when**: [quickstart.md §10 (clone portion)](./quickstart.md) passes; SC-004 (clone in under 30 seconds) verified informally.

---

## Phase 7 — User Story US5: Super_admin deletes a program; mobile read-only API exposes active programs (P3)

**Story goal** (spec.md US5): super_admin permanently deletes a program when no `BankOffer` references it; otherwise the platform refuses with `BANK_PROGRAM_HAS_OFFERS`. Separately, the mobile API surfaces the active-only catalog in a reduced shape via HMAC-signed requests.

**Independent test criteria**: As super_admin attempt to delete a program with offers → blocked with offer count; delete a program without offers → succeeds; as admin attempt direct DELETE → 403; via a curl client with HMAC, `GET /api/mobile/v1/bank-programs` returns ONLY active programs with the reduced shape; `GET /api/mobile/v1/bank-programs/<inactive-code>` returns 404 (no leakage). Acceptance scenarios 1, 2, 3, 4, 5 from spec.md US5 + SC-006 / SC-008.

### Design pipeline

- [X] T078 [US5] Run `ui-ux-pro-max` for screen 05-delete-confirmation and save to [specs/002-bank-programs/design/05-delete-confirmation/promax.md](specs/002-bank-programs/design/05-delete-confirmation/promax.md). Cover: double-confirmation (type-the-program-code), copy that surfaces offer count on the blocked path, RTL.

### Backend — delete

- [X] T079 [US5] Implement `BankProgramsService.delete()` — checks `countOffersReferencing(programCode)`; if > 0 throws `BANK_PROGRAM_HAS_OFFERS { programCode, offerCount }`; else deletes the row in a transaction + emits `BANK_PROGRAM_DELETED`.
- [X] T080 [US5] Implement `BankProgramsController` DELETE endpoint with the required `X-Confirm-Program-Code` header (FR-028 double-confirmation) per [contracts/openapi.yaml](./contracts/openapi.yaml). Guarded by JWT + `superAdminOnlyGuard` from feature 001.

### Admin — delete

- [X] T081 [US5] Implement `DeleteProgramDialog` at [admin/src/app/features/bank-programs/delete/delete-program.dialog.ts](admin/src/app/features/bank-programs/delete/delete-program.dialog.ts) — surface offer-count refusal + type-the-program-code-to-confirm input. On `BANK_PROGRAM_HAS_OFFERS` show count + suggest "Deactivate instead" with a button that triggers the toggle path from Phase 5.
- [X] T082 [US5] Run `impec polish` on the delete dialog and save to [specs/002-bank-programs/design/05-delete-confirmation/impec.md](specs/002-bank-programs/design/05-delete-confirmation/impec.md).

### Backend — mobile read-only API

- [X] T083 [US5] Implement `BankProgramsMobileService` at [backend/src/bank-programs/bank-programs.mobile.service.ts](backend/src/bank-programs/bank-programs.mobile.service.ts) — `listActive()` + `getActiveByCode()`; both filter `active = true` and map through the explicit allowlist (research.md R5). Computes `displayRateRange`, `displayMinEGP / displayMaxEGP`, `displayMinMonths / displayMaxMonths` from the cascade min/max + program currency.
- [X] T084 [US5] Implement `BankProgramsMobileController` at [backend/src/bank-programs/bank-programs.mobile.controller.ts](backend/src/bank-programs/bank-programs.mobile.controller.ts) — `GET /api/mobile/v1/bank-programs` + `GET /api/mobile/v1/bank-programs/:programCode`. Protected by the existing HMAC request-signing middleware (Principle XIII; consult feature 001 for the canonical middleware reference — if not yet wired, scaffold the middleware at [backend/src/common/middleware/hmac-request-signing.middleware.ts](backend/src/common/middleware/hmac-request-signing.middleware.ts) using timestamp + nonce + Redis nonce store).
- [X] T085 [US5] Mobile inactive-program 404 — `getActiveByCode` returns the platform `NOT_FOUND` envelope when the program is inactive OR missing; ZERO existence leakage (FR-030, SC-008).

### Backend — opt-in catalog seeds (super_admin only, not auto)

- [X] T086 [US5] [P] Create the ABK Egypt 20-program catalog file at [backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts](backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts) — every program as a `CreateBankProgramInput` + an `expectedRates` map (FR-033a + FR-033c). Programs: Self-Employed & Professionals, Compound Owner, CD Holders, Auto Cross-Sell Other Bank, Auto Cross-Sell At ABK, Credit Card Cross-Sell, Doctors Clinic Owners, Doctors In Practice, Bankers, University Professors, Egyptian Armed Forces, Salaried Without Salary Transfer, Wealth Program, Payroll/STL/ITL programs (Cat A/B/C), Tuition Finance, Pensions, Football Player, Buyout, Secured Loans, Clubs Membership.
- [X] T087 [US5] [P] Create the `salesfloor-egp-2026` catalog file at [backend/src/bank-programs/seeds/catalogs/salesfloor-egp-2026.ts](backend/src/bank-programs/seeds/catalogs/salesfloor-egp-2026.ts) — 4 products from spec.md Appendix (SF-BLUE-PLUS, SF-SELF-EMP, SF-HIGH-END, SF-AUTO) + expectedRates. SF-AUTO embeds derivation chains for the >4M car asset-value band per FR-008s.
- [X] T088 [US5] [P] Create the `bank-nxt-2026` competitor catalog stub at [backend/src/bank-programs/seeds/catalogs/bank-nxt-2026.ts](backend/src/bank-programs/seeds/catalogs/bank-nxt-2026.ts) — minimal placeholder (one program e.g., salaried_lt_5y vs salaried_gt_5y) demonstrating the `rateByTenorAndCustomerType` dimension.
- [X] T089 [US5] Implement `SeedService` at [backend/src/bank-programs/seeds/seed.service.ts](backend/src/bank-programs/seeds/seed.service.ts) — iterates the catalog entries inside a single transaction; idempotent (skip on existing programCode); after-insert verifier compares each persisted `baseRate` / `currentEffectiveRate` against `expectedRates` (FR-033c); mismatch → rollback + `SEED_RATE_VERIFICATION_FAILED { catalogName, mismatches: [...] }`.
- [X] T090 [US5] Implement `SeedAbkController` at [backend/src/bank-programs/seeds/seed-abk.controller.ts](backend/src/bank-programs/seeds/seed-abk.controller.ts) — `POST /api/admin/bank-programs/seeds/abk` (super_admin only, throttle 5/day per actor).
- [X] T091 [US5] Implement `SeedCompetitorController` at [backend/src/bank-programs/seeds/seed-competitor.controller.ts](backend/src/bank-programs/seeds/seed-competitor.controller.ts) — `POST /api/admin/bank-programs/seeds/competitor/:catalogName` with whitelist (`bank-nxt-2026`, `salesfloor-egp-2026`); unknown name → 404 + `BANK_PROGRAM_NOT_FOUND`-style typed code (or a dedicated `UNKNOWN_SEED_CATALOG` — add to error-codes if you adopt). Super_admin only.

**Phase 7 done when**: [quickstart.md §10 (delete portion) + §11](./quickstart.md) pass; SC-006 (delete blocked with offer count) + SC-008 (mobile never returns inactive) verified manually; ABK seed run reports all 20 created on a fresh DB; salesfloor seed correctly resolves the SF-AUTO derivation chains.

---

## Phase 8 — Polish & Cross-Cutting Concerns

**Goal**: Round-trip verifications + the optional Vitest scaffold + final RTL / WCAG passes.

- [X] T092 [P] Add Vitest unit suite at [backend/src/bank-programs/cascade/cascade.evaluator.spec.ts](backend/src/bank-programs/cascade/cascade.evaluator.spec.ts) (developer-discretion per research.md R15). Cover: every FR-008b cascade level matched in turn; FR-008o.1 floor-to-≤ for down-payment (5 sampled applicants 20–70 %); FR-008p.1 floor-to-≤ for asset-value (single-band + applicant-below); FR-005c.1 wealth-gate AND with null-handling; FR-003a uplift gated by qualitative-review badge; FR-008s derivation arithmetic guard. ~30 cases.
- [X] T093 [P] Run [quickstart.md](./quickstart.md) end-to-end on a fresh local environment: §1 → §14. Record any drift to a polish-followup file.
- [X] T094 [P] OpenAPI lint pass on [contracts/openapi.yaml](./contracts/openapi.yaml) (e.g., `npx @redocly/cli lint contracts/openapi.yaml`) and reconcile any structural issues against the controllers.
- [X] T095 [P] Audit-event payload schema freeze: declare TypeScript types for each new event payload at [backend/src/audit/payloads/bank-program.payloads.ts](backend/src/audit/payloads/bank-program.payloads.ts) and wire `AuditEventRepository.write()` to validate via class-validator before persisting (Principle VI — no PII).
- [X] T096 [P] RTL spot-check pass across all 5 new screens at 360 / 768 / 1280 widths. Capture any layout drift in [specs/002-bank-programs/design/rtl-followups.md](specs/002-bank-programs/design/rtl-followups.md).
- [X] T097 [P] WCAG 2.2 AA audit (axe-DevTools manual run + keyboard-only walkthrough) across all 5 new screens. Critical findings get a follow-up task in the impec polish notes of the relevant screen.
- [X] T098 [P] Confirm role-gating end-to-end: viewer × write actions = blocked at the API AND the UI; admin × delete = blocked at both; super_admin × delete = allowed (SC-003 verified manually).
- [X] T099 [P] Locale-formatting verification (SC-014): sample 10 monetary fields in Arabic mode + 10 in English mode; confirm currency symbol + digit grouping + RTL bidi behaviour.
- [X] T100 Document the cascade evaluator's pure-module extraction contract (types-only export surface) at [backend/src/bank-programs/cascade/README.md](backend/src/bank-programs/cascade/README.md) so the future matching feature can import it without circular dependency on `bank-programs/`.

---

## Dependency graph

```
Phase 1 (Setup) ─┐
                 ├─→ Phase 2 (Foundational) ─→ Phase 3 (US1 P1)
                 │                          ─→ Phase 4 (US2 P1)
                 │                          ─→ Phase 5 (US3 P2)  (depends on Phase 3 — reuses drawer)
                 │                          ─→ Phase 6 (US4 P2)
                 │                          ─→ Phase 7 (US5 P3)
                 └─→ Phase 8 (Polish, runs continuously alongside Phases 3–7)
```

**Strict hard-dependencies**:

- Phase 2 BLOCKS Phases 3–7. No user-story task may start until every T003–T027 is `[x]`.
- Phase 5 reuses the form drawer from Phase 3 (T033). Phase 5 cannot start until T033 + T045 are `[x]`.
- Phase 4 may start in parallel with Phase 3 (different files: list + detail vs drawer + form).
- Phase 6 may start in parallel with Phase 5 (clone is service-layer additive).
- Phase 7 may start in parallel with Phases 4–6 (delete + mobile + seeds are additive paths).

**Soft dependencies** (will compile in either order, but feel cleaner if sequenced):

- T053 (full cascade evaluator) is foundational for T060 (what-if pane). If you want to ship US2 incrementally, T060 can be deferred to Phase 8 polish.
- T086–T088 (seed catalog files) are pure data; they may be written by a different operator in parallel with the rest of Phase 7.

---

## Parallel execution windows (`[P]` clusters)

**Within Phase 2**:
- T008 + T009 + T010 + T011 (error codes + translations + i18n scaffolding) — 4 parallel files.
- T016 + T017 + T018 (validators + cascade types) — 3 parallel files.

**Within Phase 3 (US1 form sections)**:
- T034 + T035 + T036 + T037 + T038 + T039 + T040 + T041 + T042 (9 section components) — all parallelizable; the parent drawer (T033) must land first to host them.

**Within Phase 4**:
- T048 + T049 (two promax design docs) — parallel.
- T058 + T059 (cascade-preview + derivation-chip) — parallel.

**Within Phase 7 (catalogs)**:
- T086 + T087 + T088 (3 catalog files) — fully parallel.

**Within Phase 8**:
- T092–T099 — 8 parallel tasks; only T100 is sequential (depends on T053 + T092 landing).

---

## Implementation strategy

**MVP scope (≈ 1 PR)**: Phases 1 + 2 + Phase 3 (US1) only.
- Outcome: an admin can create a brand-new program; the list page renders a minimal "first program created" view; no edit / clone / toggle / delete / mobile yet.
- Sufficient to demo the spec's core value (configuration without code) to stakeholders.
- Risk: a stakeholder may want to see the cascade preview in action before they sign off. Mitigate by including the trace renderer (T053 + T058 from Phase 4) in the MVP if scope budget allows.

**Incremental delivery cadence** (recommended):

| Increment | Phases | What ships |
|---|---|---|
| MVP | 1, 2, 3 | Create only; bare list page |
| Increment 1 | 4 | List + filter + search + detail view + cascade preview + what-if pane |
| Increment 2 | 5 | Edit + toggle + version-conflict UX |
| Increment 3 | 6 | Clone |
| Increment 4 | 7 | Delete + mobile read-only API + opt-in seeds |
| Hardening | 8 | Vitest, lints, RTL spot-checks, a11y audit |

Each increment is a complete, demoable PR. Operators can start using new capabilities immediately; the matching feature (separate spec) can begin consuming `BankProgramRepository.loadActiveCatalog()` starting at Increment 1.

---

## Validation checklist

Format check on the task list: every checkbox follows `- [ ] T### [P?] [USx?] description path`.

- Setup tasks (T001–T002): no story labels. ✓
- Foundational tasks (T003–T027): no story labels. ✓
- US1 phase tasks (T028–T047): `[US1]` label. ✓
- US2 phase tasks (T048–T062): `[US2]` label. ✓
- US3 phase tasks (T063–T071): `[US3]` label. ✓
- US4 phase tasks (T072–T077): `[US4]` label. ✓
- US5 phase tasks (T078–T091): `[US5]` label. ✓
- Polish tasks (T092–T100): no story labels. ✓

Total tasks: **100**. Story breakdown: Setup 2, Foundational 25, US1 20, US2 15, US3 9, US4 6, US5 14, Polish 9.

Story independence verified — each user story phase has its own service-layer + controller + admin-surface + design-pipeline closure; phases 4–7 can be reordered relative to each other (except Phase 5's reuse of the Phase 3 drawer).
