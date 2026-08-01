---

description: "Task list for 010-simple-programs-dbr-calculator"
---

# Tasks: Simple Program Setup, Banded DBR & Loan Calculator

**Input**: Design documents from `/specs/010-simple-programs-dbr-calculator/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: INCLUDED. Not a blanket TDD mandate — the spec makes them load-bearing (SC-004 preview↔offer parity, SC-006 band-boundary correctness) and [research.md#r13](./research.md) fixes the targeted set. Note: the backend currently has **no test runner at all** (no jest/vitest dependency, no `test` script), so Phase 1 installs one.

**Organization**: grouped by user story. P1 phases are sequenced by real dependency (numbers → figures → setup), not by story number.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1…US7 mapping to spec.md user stories
- Paths are repo-relative and exact

## Path Conventions

- Backend: `backend/src/`, `backend/prisma/`, `backend/test/`
- Admin: `admin/src/app/features/`, `admin/src/i18n/`
- Mobile: `masrafy-app/lib/`, `masrafy-app/test/`

## Story → Phase Map

| Phase | Story | Priority | Why here |
|---|---|---|---|
| 3 | US3 question types | P1 | supplies the real numbers every figure depends on |
| 4 | US2 figures in results | P1 | consumes US3's numbers; `quote.ts` is reused by US4/US7 |
| 5 | US1 program setup | P1 | prefill + Essentials/Advanced; works on catalog defaults alone |
| 6 | US5 banded DBR | P2 | needs the band editor host from US1 |
| 7 | US4 calculator | P2 | reuses `quote.ts` from US2 |
| 8 | US6 bank lending policy | P3 | second prefill layer |
| 9 | US7 numeric simulator | P3 | reuses `quote.ts` |
| 10 | US1 prune (gated) | P1 scope, last | destructive; runs only once nothing reads the pruned fields |

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: test runner and scaffolding this feature's verification depends on

- [X] T001 Add Vitest to the backend: `vitest` + `@vitest/coverage-v8` devDependencies and `"test": "vitest run"`, `"test:watch": "vitest"` scripts in `backend/package.json` (Vitest over Jest because the repo already runs TypeScript through `tsx`/esbuild — no `ts-jest` transform to maintain)
- [X] T002 Create `backend/vitest.config.ts` resolving the `@/` path alias from `backend/tsconfig.json` and including `backend/test/**/*.spec.ts`
- [X] T003 [P] Create `backend/test/` with `unit/`, `integration/` subfolders and a `backend/test/helpers/decimal.ts` exposing `expectDecimalEqual(actual, expected)` that compares 2-dp strings (Principle I — never float compare)
- [X] T004 [P] Add `"test": "vitest run"` to `admin/package.json` plus `admin/vitest.config.ts` (jsdom environment) so the band-editor validation tests can run
- [X] T005 [P] Update [quickstart.md](./quickstart.md) test commands to the Vitest invocations added in T001/T004

**Checkpoint**: `npm test` runs (zero tests) on backend and admin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: shared contracts every story below references

**⚠️ CRITICAL**: no story phase may start until this phase is complete

- [X] T006 Add all 17 new error codes from [contracts/error-codes.md](./contracts/error-codes.md) to `backend/src/common/errors/error-codes.ts` with their HTTP status entries in the same file's status map
- [X] T007 [P] Add the matching Arabic strings for all 17 codes to `admin/src/i18n/error-codes.ar-EG.json` (Principle III same-PR rule)
- [X] T008 [P] Add the matching English strings for all 17 codes to `admin/src/i18n/error-codes.en-US.json`
- [X] T009 [P] Add ARB entries for the customer-reachable codes (`ANSWER_TYPE_MISMATCH`, `ANSWER_OUT_OF_RANGE`, `ANSWER_TOO_LONG`, `ANSWER_REQUIRED`, `MONEY_FIGURE_MISSING`, `CALCULATOR_INPUT_INVALID`, `CALCULATOR_PROGRAM_INACTIVE`) plus the 6 reason codes and `INDICATIVE_ESTIMATE_NOT_AN_OFFER` to `masrafy-app/lib/l10n/intl_ar.arb` and `masrafy-app/lib/l10n/intl_en.arb`
- [X] T010 Add `bank_policy_updated` and `program_catalog_defaults_updated` to the `AuditEventType` enum in `backend/prisma/schema.prisma` and generate the migration `add_policy_audit_event_types`
- [X] T011 [P] Add the `DbrBand` / `DbrSetting` interfaces and the `BindingConstraint` union (`requested_amount | program_max | dbr_affordability | tenor_max | age_at_maturity`) plus the `Quote` interface from [data-model.md](./data-model.md) to `backend/src/matching/types.ts`
- [X] T012 [P] Create `backend/src/matching/pipeline/money-field-bindings.ts` exporting the frozen `MONEY_FIELD_BINDINGS` map from [research.md#r2](./research.md) — a code constant, never a `Question` column (A33)
- [X] T013 [P] Add a `FiguresUnavailableReason` union (the 6 reason codes) to `backend/src/matching/types.ts`

**Checkpoint**: shared types, codes and i18n in place — stories can proceed in parallel

---

## Phase 3: User Story 3 — All four question types work end to end (Priority: P1) 🎯 MVP part 1

**Goal**: admin can build single-choice, multi-choice, text and number questions; the customer answers each with the right control; answers store their real values; the four money figures come from number answers instead of bucket guesses.

**Independent Test**: build one question of each type, publish, answer all four in the app, and confirm each stored value is exact and visible to admins — with no bucket midpoint anywhere.

### Tests for User Story 3

- [X] T014 [P] [US3] Answer-validation matrix test (4 types × correct/incorrect payload → expected error code) in `backend/test/unit/questionnaire-answer-validation.spec.ts`
- [X] T015 [P] [US3] Number-bounds test (below min, above max, off step, exact bounds inclusive) in `backend/test/unit/questionnaire-numeric-bounds.spec.ts`
- [X] T016 [P] [US3] Question-rule validation test (choice type with <2 options, NUMERIC with options, max<min, step≤0) in `backend/test/unit/question-type-rules.spec.ts`
- [X] T017 [P] [US3] Scoreability test: a weight set naming a MULTI_SELECT/TEXT/NUMERIC question is rejected, and existing single-choice scores are byte-identical in `backend/test/unit/scoring-type-guard.spec.ts`
- [X] T018 [P] [US3] Legacy-snapshot test: a snapshot without `type` keys reads as SINGLE_SELECT and previously stored answers stay readable in `backend/test/integration/questionnaire-legacy-snapshot.spec.ts`

### Implementation for User Story 3

- [X] T019 [US3] Add `numericMinValue`, `numericMaxValue`, `numericStep`, `numericUnitAr`, `numericUnitEn`, `textMaxLength` to `Question` and `selectedOptionCodes String[] @default([])` to `ApplicationAnswer` in `backend/prisma/schema.prisma`, then create migration `question_types_typed_answers`
- [X] T020 [US3] Add `NumericRulesDto` and `TextRulesDto` and wire them into `CreateQuestionDto` / `UpdateQuestionDto` in `backend/src/questionnaire/dto/questionnaire.dto.ts` (co-locate root DTO + nested payload classes in this one file)
- [X] T021 [US3] Widen `SubmittedAnswerDto` in `backend/src/questionnaire/dto/questionnaire.dto.ts` to the four exclusive value shapes (`optionCode` | `optionCodes[]` | `textValue` | `numericValue` as decimal string) with a custom "exactly one value key" validator
- [X] T022 [US3] Enforce the per-type rules from [contracts/questionnaire.md](./contracts/questionnaire.md) in `backend/src/questionnaire/questionnaire.service.ts`, throwing `QUESTION_TYPE_RULES_INVALID` with `meta.field`
- [X] T023 [US3] Persist the new rule fields and read them back in `backend/src/questionnaire/questionnaire.repository.ts`
- [X] T024 [US3] Include `type`, `numeric` and `text` blocks in the published snapshot builder in `backend/src/questionnaire/questionnaire.service.ts`, and treat a missing `type` as SINGLE_SELECT on read (FR-045)
- [X] T025 [US3] Add publish-time warnings in `backend/src/questionnaire/questionnaire.service.ts`: for each `MONEY_FIELD_BINDINGS` entry whose question code is missing, inactive, or not NUMERIC, return `{ code: 'MONEY_FIELD_BINDING_MISSING', meta }` in the publish response `warnings[]` without failing the publish
- [X] T026 [US3] Validate submitted answers against the published question's type in `backend/src/questionnaire/questionnaire.service.ts` — `ANSWER_TYPE_MISMATCH`, `ANSWER_OUT_OF_RANGE` (with `meta.min/max/step`), `ANSWER_TOO_LONG`, `ANSWER_REQUIRED` (skipping questions hidden by `enabledWhen`)
- [X] T027 [US3] Write typed answers (`selectedOptionCodes`, `textValue`, `numericValue`, plus `selectedOptionCode`/`selectedOptionId` for single choice) in `backend/src/applications/application.repository.ts`
- [X] T028 [US3] Filter `GET /admin/scoring/questions` to SINGLE_SELECT only and reject non-scoreable references with `QUESTION_TYPE_NOT_SCOREABLE` in `backend/src/scoring/scoring.service.ts`
- [X] T029 [US3] Exclude `textValue` from logs and from any calc trace in `backend/src/applications/pii-masker.ts` (Principle VI — free text may carry PII)
- [X] T030 [US3] Add the four NUMERIC questions (codes per [research.md#r2](./research.md), with units and bounds) and deactivate the superseded bucket questions in `backend/prisma/seed-questionnaire.ts`
- [X] T031 [P] [US3] Add the type picker and the per-type rule fields (options list / unit+min+max+step / max length) to `admin/src/app/features/questionnaire/questionnaire-editor.page.ts` using typed reactive forms, signals and `@if`/`@for` (Principles XVII–XXII)
- [X] T032 [P] [US3] Extend `admin/src/app/features/questionnaire/questionnaire.api.service.ts` with the new question payload fields and surface publish `warnings[]` as a non-blocking notice
- [ ] T033 [P] [US3] Render multi-picked answers, text and numbers in the applicant-answers view under `admin/src/app/features/applications/`
- [ ] T034 [P] [US3] Parse `numeric` and `text` rule blocks in `masrafy-app/lib/features/questionnaire/data/models/response/questionnaire_snapshot_model.dart` and expose them on `masrafy-app/lib/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart`
- [ ] T035 [US3] Change the answer store in `masrafy-app/lib/features/questionnaire/presentation/pages/dynamic/questionnaire_state.dart` from `Map<String,String>` to a typed answer value (single code / code list / text / decimal string) and update `questionnaire_cubit.dart` accordingly
- [ ] T036 [US3] Render all four controls in `masrafy-app/lib/features/questionnaire/presentation/pages/dynamic/questionnaire_step.dart` — single pick via `MasrafySelectField` + `showMasrafySingleSelectSheet`, multi pick via the existing `masrafy_multi_select_field.dart` + sheet (A36: no dropdowns), text via `masrafy_text_field/masrafy_text_field.dart`, number via T037's field
- [ ] T037 [P] [US3] Create `masrafy-app/lib/core/widgets/input_controls/masrafy_number_field.dart` — bounded numeric entry showing the question's unit, emitting a decimal **string**, enforcing min/max/step client-side without doing money arithmetic
- [ ] T038 [US3] Enforce required-question blocking for every type in `masrafy-app/lib/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart`
- [ ] T039 [US3] Delete the bucket→number maps (`_amountEgp`, `_incomeEgp`, `_installmentsEgp`, `_tenorMonths`) and read the bound number answers instead in `masrafy-app/lib/features/questionnaire/presentation/pages/personal/personal_apply_mapper.dart`
- [ ] T040 [P] [US3] Same removal in `masrafy-app/lib/features/questionnaire/presentation/pages/car/car_apply_mapper.dart`
- [ ] T041 [P] [US3] Same removal in `masrafy-app/lib/features/questionnaire/presentation/pages/mortgage/mortgage_apply_mapper.dart`
- [ ] T042 [P] [US3] Same removal in `masrafy-app/lib/features/questionnaire/presentation/pages/business/business_apply_mapper.dart`
- [ ] T043 [US3] Strip the now-unused representative-value helpers from `masrafy-app/lib/features/questionnaire/presentation/mappers/apply_mapping.dart` and raise `MONEY_FIGURE_MISSING` instead of defaulting to zero (FR-044)
- [ ] T044 [P] [US3] Widget test: each type renders its control and a number outside bounds is blocked, in `masrafy-app/test/features/questionnaire/questionnaire_step_test.dart`

**Checkpoint**: an admin-built number question reaches the engine with the customer's exact figure

---

## Phase 4: User Story 2 — Customer sees real money in the results list (Priority: P1) 🎯 MVP part 2

**Goal**: every result card carries installment, offered amount, cash received, fees, totals, and the reason for any reduction — identical to what the submitted offer will say.

**Independent Test**: run the questionnaire, confirm each card shows figures, then submit and confirm the offer figures match string for string.

### Tests for User Story 2

- [ ] T045 [P] [US2] Money identity test: `presentValue(amortize(P,i,n),i,n) ≈ P` over 50 random triples, plus the zero-rate branch, in `backend/test/unit/quote-identities.spec.ts`
- [ ] T046 [P] [US2] Fee-financing test: installment computed on offered amount **plus** financed fees; `cashToCustomerEGP = offered − financed fees`; totals consistent, in `backend/test/unit/quote-fees.spec.ts`
- [ ] T047 [P] [US2] Binding-constraint test: one profile per value of `bindingConstraint` returns that value, in `backend/test/unit/quote-binding-constraint.spec.ts`
- [ ] T048 [P] [US2] Parity test over 10 golden profiles: `POST /v1/matching/preview` figures equal `POST /v1/apply` offer figures as strings (SC-004), in `backend/test/integration/preview-offer-parity.spec.ts`
- [ ] T049 [P] [US2] Reason-code test: a program that cannot be quoted is still listed with `figures: null` and the right `figuresUnavailableReason`, in `backend/test/integration/preview-unquotable.spec.ts`

### Implementation for User Story 2

- [ ] T050 [US2] Create `backend/src/matching/pipeline/quote.ts` — pure `quoteProgram(profile, program, opts)` composing `runCascade` → `calculateFees` → `calculateEffectiveLoanAmount` → `calculateMonthlyInstallment` → `calculateDbr` / `calculateMaxLoanFromDbr`, returning the `Quote` from [data-model.md](./data-model.md) with `bindingConstraint` and no DB or HTTP imports (Principle V)
- [ ] T051 [US2] Add tenor shortening for age at maturity to `backend/src/matching/pipeline/quote.ts` per [research.md#r11](./research.md), reporting `bindingConstraint: 'age_at_maturity'` or the `AGE_AT_MATURITY` reason when no tenor fits
- [ ] T052 [US2] Refactor `backend/src/matching/engine.service.ts` to build its offer from `quoteProgram()` instead of its inline fee/PMT/DBR sequence, keeping the existing `Offer` shape and `passedChecks`/`failedChecks` behaviour
- [ ] T053 [US2] Derive an `ApplicantProfile` from submitted typed answers via `MONEY_FIELD_BINDINGS` in `backend/src/matching-preview/matching-preview.service.ts`, throwing `MONEY_FIGURE_MISSING` when a bound answer is absent
- [ ] T054 [US2] Call `quoteProgram()` per program in `backend/src/matching-preview/matching-preview.service.ts` and return the additive `figures` block, `figuresUnavailableReason`, and `disclaimerCode` per [contracts/customer-api.md](./contracts/customer-api.md)
- [ ] T055 [US2] Add the `figures` response DTO to `backend/src/questionnaire/dto/questionnaire.dto.ts` (or the preview DTO file that owns `PreviewMatchesDto`) with Swagger annotations, money as strings
- [ ] T056 [US2] Include the same `figures` block plus `dbrCapPercent` / `dbrBandIndex` in the offer payload in `backend/src/applications/dto/apply-response.dto.ts` and `backend/src/applications/applications.service.ts`
- [ ] T057 [P] [US2] Parse `figures` and `figuresUnavailableReason` in `masrafy-app/lib/features/questionnaire/data/models/response/preview_match_model.dart` and expose them on `masrafy-app/lib/features/questionnaire/domain/entities/preview_match_entity.dart`
- [ ] T058 [US2] Show monthly payment, offered amount, cash received and total cost on `masrafy-app/lib/features/offers/presentation/pages/results/widgets/match_offer_card.dart`, with the reduction label when `bindingConstraint` is not `requested_amount`
- [ ] T059 [P] [US2] Render the reason text instead of figures when `figures` is null, in the same card widget
- [ ] T060 [P] [US2] Itemise admin fee / insurance / stamp duty on `masrafy-app/lib/features/offers/presentation/pages/offer_details/widgets/offer_fees_card.dart` and add the three-line cash/payment/fees summary to `masrafy-app/lib/features/offers/presentation/pages/widgets/match_summary_card.dart`
- [ ] T061 [P] [US2] Add the persistent indicative-estimate disclaimer to `masrafy-app/lib/features/offers/presentation/pages/results/match_results_page.dart` and the offer detail page, from the ARB key added in T009
- [ ] T062 [P] [US2] Shape-matched shimmer for the figure areas while a preview loads, in `masrafy-app/lib/features/offers/presentation/pages/results/` (Principle XXXIV)

**Checkpoint**: results screen shows money, and preview and offer agree

---

## Phase 5: User Story 1 — Admin sets up a bank program in a few minutes (Priority: P1) 🎯 MVP part 3

**Goal**: pick bank + predefined program + category → prefilled form → adjust Essentials → save. Duplicate for the next one.

**Independent Test**: create a program touching ≤8 fields in under 3 minutes and confirm it produces offers identical to a hand-filled equivalent.

### Tests for User Story 1

- [ ] T063 [P] [US1] Prefill precedence test: catalog default beats bank policy; `origin` is `CATALOG`/`BANK_POLICY`/`EMPTY` per leaf, in `backend/test/integration/prefill-precedence.spec.ts`
- [ ] T064 [P] [US1] Copy-on-save immunity test: editing catalog defaults or bank policy after save leaves the saved program's figures unchanged (SC-008), in `backend/test/integration/prefill-copy-on-save.spec.ts`
- [ ] T065 [P] [US1] Range validation test: inverted or empty amount / tenor / age range → `PROGRAM_RANGE_INVALID` with `meta.field`, in `backend/test/unit/program-range-validation.spec.ts`
- [ ] T066 [P] [US1] Duplicate test: `POST /admin/bank-programs/:id/duplicate` returns a DRAFT copy with every value carried and a fresh code, in `backend/test/integration/bank-program-duplicate.spec.ts`

### Implementation for User Story 1

- [ ] T067 [US1] Add `defaults Json @default("{}")` to `PlatformEnumeration` in `backend/prisma/schema.prisma` and create migration `add_catalog_defaults`
- [ ] T068 [US1] Add `defaults` to the enumeration DTOs in `backend/src/platform-enumerations/dto/enumeration.dto.ts`, validating each category key against the member's `categories` (`CATALOG_DEFAULTS_CATEGORY_UNKNOWN`) and each sub-config with the partial-mode program validators
- [ ] T069 [US1] Persist and read `defaults` in `backend/src/platform-enumerations/postgres-platform-enumerations.repository.ts` and mirror it in `backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts`
- [ ] T070 [US1] Add `GET`/`PUT .../program_name/:key/defaults` per [contracts/admin-api.md](./contracts/admin-api.md) to `backend/src/platform-enumerations/admin-platform-enumerations.controller.ts` and `platform-enumerations-admin.service.ts`, auditing `program_catalog_defaults_updated`
- [ ] T071 [US1] Create `backend/src/bank-programs/prefill/prefill.service.ts` — merges bank policy then catalog defaults per leaf and returns `{ values, origin }` ([research.md#r5](./research.md)); reads only through repositories (Principle X)
- [ ] T072 [US1] Add `GET /admin/bank-programs/prefill` to `backend/src/bank-programs/bank-programs.controller.ts` with a `PrefillQueryDto`, throwing `PREFILL_TARGET_INVALID` for an unserved category or unknown bank/member
- [ ] T073 [US1] Add range validation (amount / tenor / age) raising `PROGRAM_RANGE_INVALID` to `backend/src/bank-programs/validation/cross-config.validators.ts`
- [ ] T074 [US1] Add `POST /admin/bank-programs/:id/duplicate` to `backend/src/bank-programs/bank-programs.controller.ts` + `bank-programs.service.ts`, producing a DRAFT with a new `programCode`, `friendlyName`, `friendlyNameAr`
- [ ] T075 [US1] Create `backend/prisma/seed-program-catalog-defaults.ts` — idempotent defaults for the FR-004 archetypes using the §9 figures, and register a `seed:catalog-defaults` script in `backend/package.json`
- [ ] T076 [US1] Run the `promax` skill for the catalog-defaults editor and the Essentials/Advanced form before implementing them (Principle XXIII, A17)
- [ ] T077 [US1] Add the per-category defaults editor to `admin/src/app/features/program-catalog/program-catalog.page.ts` (typed reactive form per category, signals, `@if`/`@for … track`)
- [ ] T078 [P] [US1] Add the defaults endpoints to `admin/src/app/features/lookups/lookups.api.service.ts`
- [ ] T079 [US1] Regroup `admin/src/app/features/bank-programs/form/bank-program-form.page.ts` into an Essentials group (rate, tenor range, amount range, min income, DBR, fees, required documents, active) and a collapsed Advanced group, with no Advanced field required (FR-012)
- [ ] T080 [US1] Call the prefill endpoint on bank + program-name + category selection in the same form page, and render each field's origin badge from `origin` (FR-010)
- [ ] T081 [P] [US1] Add `prefill` and `duplicate` calls to `admin/src/app/features/bank-programs/bank-programs.api.service.ts` and the matching types to `bank-programs.types.ts`
- [ ] T082 [P] [US1] Add a Duplicate action to `admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts` opening the form as a DRAFT copy
- [ ] T083 [P] [US1] Vitest: Essentials-only submit produces a valid payload and origin badges reflect the `origin` map, in `admin/tests/unit/bank-program-form.spec.ts`
- [ ] T084 [US1] Run the `impec` skill over the two new admin surfaces after first implementation (Principle XXIII)

**Checkpoint**: a program is created from prefill in minutes; MVP (US3+US2+US1) is demoable

---

## Phase 6: User Story 5 — Admin configures DBR by income band (Priority: P2)

**Goal**: DBR as a single cap or a small income-band table, resolved from recognised income, editable wherever DBR appears.

**Independent Test**: configure bands, run two applicants either side of a boundary, and confirm the caps and amounts differ correctly.

### Tests for User Story 5

- [ ] T085 [P] [US5] Boundary test: income exactly 5 000 / 10 000 / 20 000 / 30 000 resolves the inclusive-upper band; 30 001 resolves the open band, in `backend/test/unit/dbr-band-resolution.spec.ts`
- [ ] T086 [P] [US5] Fallback test: no `dbrBands` → scalar cap and `bandIndex: null`; single-band table behaves as a flat cap, in the same spec file
- [ ] T087 [P] [US5] Modifier-ordering test: declared 20 400 with an 85% income assumption → recognised 17 340 → cap 40%, not 45%, in `backend/test/unit/dbr-modifier-ordering.spec.ts`
- [ ] T088 [P] [US5] Validator test: unordered, gapped, duplicate-bound, missing-terminator and out-of-range tables all raise `DBR_BANDS_INVALID` with `meta.index`, in `backend/test/unit/dbr-band-validation.spec.ts`

### Implementation for User Story 5

- [ ] T089 [US5] Add pure `resolveDbrCap(cfg, recognisedIncome) → { capPercent, bandIndex }` to `backend/src/matching/pipeline/dbr.ts` with inclusive upper bounds
- [ ] T090 [US5] Accept `bandIndex`-aware caps in `calculateDbr` / `calculateMaxLoanFromDbr` callers inside `backend/src/matching/pipeline/quote.ts` so both the cap check and the max-loan derivation use the resolved band
- [ ] T091 [US5] Add the shared band validator (ascending, gapless, single trailing `null`, cap 1–100, decimal strings) to `backend/src/bank-programs/validation/cross-config.validators.ts`, reused by the program, catalog-defaults and bank-policy paths
- [ ] T092 [US5] Add optional `dbrBands` to `EligibilityConfigDto` in `backend/src/bank-programs/dto/sub-configs/eligibility-config.dto.ts` and to `EligibilityConfig` in `backend/src/matching/types.ts`
- [ ] T093 [US5] Record `dbrCapPercent` and `dbrBandIndex` on created offers in `backend/src/applications/applications.service.ts` and `application.repository.ts` (FR-021), keeping `BankOffer` immutable after creation
- [ ] T094 [US5] Create `admin/src/app/features/bank-programs/shared/dbr-band-editor/dbr-band-editor.component.ts` — standalone, signals, typed `FormArray`, flat-vs-banded toggle, add/remove/reorder rows, inline validation mirroring T091, design tokens only (Principles XVII–XXIV)
- [ ] T095 [US5] Mount the band editor in the Essentials group of `admin/src/app/features/bank-programs/form/bank-program-form.page.ts`, replacing the bare `dbrCapPercent` input
- [ ] T096 [P] [US5] Mount the same editor in the catalog-defaults editor at `admin/src/app/features/program-catalog/program-catalog.page.ts` (depends on T077)
- [ ] T097 [P] [US5] Show the resolved band table on `admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts`
- [ ] T098 [P] [US5] Vitest for the band editor's validation states in `admin/tests/unit/dbr-band-editor.spec.ts`

**Checkpoint**: banded DBR drives quoted amounts; flat-cap programs unchanged

---

## Phase 7: User Story 4 — Customer uses a standalone loan calculator (Priority: P2)

**Goal**: cost mode and affordability mode, program-scoped or generic, reachable from results and program detail.

**Independent Test**: open the calculator with no application in progress and confirm the figures match what the results screen gives for the same inputs.

### Tests for User Story 4

- [ ] T099 [P] [US4] Cost-mode test: figures equal `quoteProgram()` for the same program and inputs, in `backend/test/integration/calculator-cost-mode.spec.ts`
- [ ] T100 [P] [US4] Affordability-mode test: max amount respects the resolved DBR cap and reports the binding constraint, in `backend/test/integration/calculator-affordability.spec.ts`
- [ ] T101 [P] [US4] Clamp test: out-of-range amount or tenor is clamped to the program limit and reported in `clamped`, in the same integration folder

### Implementation for User Story 4

- [ ] T102 [US4] Create `backend/src/calculator/dto/calculator.dto.ts` with the mode-discriminated request DTO (money as decimal strings) and the response DTO from [contracts/customer-api.md](./contracts/customer-api.md), root DTO and nested payload classes co-located in this one file
- [ ] T103 [US4] Create `backend/src/calculator/calculator.service.ts` — resolves the program (or the configured representative rate), clamps inputs to limits, delegates to `quoteProgram()`, persists nothing
- [ ] T104 [US4] Add the platform representative-rate setting (env-validated via the existing Zod schema in `backend/src/infra/`) consumed by `calculator.service.ts` for generic mode
- [ ] T105 [US4] Create `backend/src/calculator/calculator.controller.ts` with `POST /v1/calculator/quote` under the customer JWT guard and the existing throttler, plus `backend/src/calculator/calculator.module.ts` registered in `backend/src/app.module.ts`
- [ ] T106 [US4] Extend `GET /v1/bank-programs/:id` in `backend/src/bank-programs/bank-programs.mobile.service.ts` + `dto/mobile-bank-program.response.dto.ts` with `limits`, `dbr` and the itemised fee schedule so the calculator can open pre-scoped
- [ ] T107 [US4] Run the `promax` skill for the calculator screen before implementing it, then `impec` after (Principle XXIII)
- [ ] T108 [US4] Create the mobile data layer: `masrafy-app/lib/features/calculator/data/models/request/calculator_quote_request.dart`, `.../data/models/response/calculator_quote_model.dart`, `.../data/datasources/calculator_remote_datasource.dart`, `.../data/repositories/calculator_repository_impl.dart` (single typed request DTO per Principle XXX / A28)
- [ ] T109 [US4] Create the mobile domain layer: `masrafy-app/lib/features/calculator/domain/entities/calculator_quote_entity.dart`, `.../domain/repositories/calculator_repository.dart` returning `Either<Failure, T>`, `.../domain/usecases/calculator_usecase.dart`
- [ ] T110 [US4] Create `masrafy-app/lib/features/calculator/presentation/pages/calculator/cubit/calculator/calculator_cubit.dart` + `calculator_state.dart` (Freezed, `updateField` with exhaustive switch, 300 ms debounce before each server call)
- [ ] T111 [US4] Create `masrafy-app/lib/features/calculator/presentation/pages/calculator/calculator_page.dart` — one route-level widget (Principle XXXVI), collapsing sliver gradient hero via `MasrafySliverGradientHeaderDelegate` (A35), mode switch, `masrafy_number_field.dart` inputs, itemised fee rows, shimmer while quoting (Principle XXXIV), and the indicative-estimate disclaimer
- [ ] T112 [P] [US4] Register the calculator route in `masrafy-app/lib/core/router/router.dart` and regenerate `router.gr.dart`
- [ ] T113 [P] [US4] Add calculator entry points from `masrafy-app/lib/features/offers/presentation/pages/results/match_results_page.dart` and the offer/program detail page, passing the program id so it opens scoped
- [ ] T114 [P] [US4] Widget test: cubit calls the server (never computes money locally) and clamps are surfaced, in `masrafy-app/test/features/calculator/calculator_page_test.dart`

**Checkpoint**: calculator works standalone and program-scoped, with server-authoritative figures

---

## Phase 8: User Story 6 — Bank lending policy (Priority: P3)

**Goal**: record a bank's general lending numbers once; programs inherit them as starting values.

**Independent Test**: save a policy, start a new program for that bank, and see the policy values as the starting point.

### Tests for User Story 6

- [ ] T115 [P] [US6] Policy round-trip test: `PUT` then `GET` returns the stored shape; a bank without a policy returns null and prefill still works, in `backend/test/integration/bank-policy.spec.ts`
- [ ] T116 [P] [US6] Audit + isolation test: a policy edit writes `bank_policy_updated` and changes no existing program, in the same spec file

### Implementation for User Story 6

- [ ] T117 [US6] Add `policyDefaults Json?` to `Bank` in `backend/prisma/schema.prisma` and create migration `add_bank_policy_defaults`
- [ ] T118 [US6] Create `backend/src/banks/dto/bank-policy.dto.ts` with the partial policy shape from [data-model.md](./data-model.md), reusing the band validator (T091) and range validator (T073)
- [ ] T119 [US6] Add `GET`/`PUT /admin/banks/:bankId/policy` to `backend/src/banks/banks.controller.ts` + `banks.service.ts` + `banks.repository.ts` as a full replace, emitting `bank_policy_updated` with a before/after diff via `backend/src/audit/`
- [ ] T120 [US6] Wire the bank-policy layer into `backend/src/bank-programs/prefill/prefill.service.ts` as the lower-priority layer with `origin: 'BANK_POLICY'` (completes T071)
- [ ] T121 [US6] Add a Lending Policy panel to `admin/src/app/features/banks/bank-detail.page.ts` hosting the shared band editor, and extend `banks.api.service.ts` + `banks.types.ts`
- [ ] T122 [P] [US6] Assert in `backend/test/integration/prefill-precedence.spec.ts` (from T063) that catalog defaults override the bank policy once both layers exist

**Checkpoint**: prefill has both layers; program-level values still win at match time

---

## Phase 9: User Story 7 — Admin numeric simulator (Priority: P3)

**Goal**: run a sample applicant against active programs and see every figure plus what bound it.

**Independent Test**: simulate one applicant and trace every number to a configured value; confirm nothing is persisted.

### Tests for User Story 7

- [ ] T123 [P] [US7] Simulation test: response rows carry recognised income, rate, DBR cap + band, offered amount, installment and binding constraint, and no application or lead row is created, in `backend/test/integration/admin-simulate.spec.ts`
- [ ] T124 [P] [US7] Misconfiguration test: a program with no rate or empty amount limits is reported as `misconfigured` naming the missing setting, in the same spec file

### Implementation for User Story 7

- [ ] T125 [US7] Extend the simulate request with the `applicant` block in `backend/src/questionnaire/dto/questionnaire.dto.ts` (`PreviewMatchesDto` neighbours) per [contracts/admin-api.md](./contracts/admin-api.md)
- [ ] T126 [US7] Return `figures`, `figuresUnavailableReason` and `misconfigured` per row from `backend/src/matching-preview/matching-preview.service.ts` when called through `backend/src/matching-preview/admin-matching.controller.ts`, persisting nothing
- [ ] T127 [US7] Detect and report misconfiguration (missing rate, empty amount limits, empty tenor range) in `backend/src/matching/pipeline/quote.ts` and surface it as `PROGRAM_MISCONFIGURED` for single-program calls
- [ ] T128 [US7] Add the applicant-input form and the figures/trace table to `admin/src/app/features/questionnaire/matching-simulator.page.ts` (typed reactive form, `appMoneyInput` on money fields per A27)
- [ ] T129 [P] [US7] Run `promax` before and `impec` after the simulator surface changes (Principle XXIII)

**Checkpoint**: ops can verify a program's numbers before customers see them

---

## Phase 10: Destructive prune (US1 scope, runs last)

**Purpose**: remove the settings matching no longer reads (FR-015a–d). Gated: nothing here starts until Phases 3–9 are merged and no code reads a pruned field.

**⚠️ Requires**: a captured `pg_dump` of `bank_program`, explicit product-owner go-ahead, and a release note flagged data-destroying.

- [ ] T130 [US1] Grep-verify no remaining reader of any pruned key across `backend/src`, `admin/src`, `masrafy-app/lib`, and record the result in the PR description
- [ ] T131 [US1] Reduce `backend/src/matching/pipeline/eligibility-checker.ts` to the surviving checks (currency, amount range, tenor range, age range, minimum income), keeping the `passedChecks`/`failedChecks` return shape
- [ ] T132 [US1] Remove the pruned fields from `backend/src/bank-programs/dto/sub-configs/eligibility-config.dto.ts` and delete `backend/src/bank-programs/dto/sub-configs/performance-criteria-config.dto.ts`
- [ ] T133 [US1] Remove `EligibilityConfig` pruned members and the whole `PerformanceCriteriaConfig` from `backend/src/matching/types.ts`, and drop `performanceCriteria` from `BankProgramSnapshot` hydration in `backend/src/bank-programs/bank-programs.repository.ts`
- [ ] T134 [P] [US1] Remove the pruned fields from the seed catalogs `backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts`, `bank-nxt-2026.ts`, `salesfloor-egp-2026.ts`, `base.ts`
- [ ] T135 [US1] Create the destructive migration `prune_unused_eligibility_settings` in `backend/prisma/migrations/` — log the affected-program count, then `eligibility = eligibility - ARRAY[<pruned keys>]` and `performance_criteria = NULL` per [data-model.md](./data-model.md)
- [ ] T136 [P] [US1] Remove the pruned fields from `admin/src/app/features/bank-programs/form/sections/eligibility-section.component.ts`, `bank-program-form.page.ts`, `bank-programs.types.ts` and `detail/bank-program-detail.page.ts`
- [ ] T137 [P] [US1] Migration test: pruned keys absent, kept keys intact, affected count reported, in `backend/test/integration/prune-migration.spec.ts`
- [ ] T138 [US1] Confirm no Advanced field remains that the engine ignores (FR-015d) and note the verification in the PR

**Checkpoint**: the form only shows settings that change an offer

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T139 [P] Update `backend/src/**` OpenAPI annotations so `/api/docs` documents the prefill, policy, catalog-defaults, calculator and extended preview/simulate contracts
- [ ] T140 [P] Verify RTL and LTR rendering of the band editor, Essentials/Advanced form, catalog defaults and simulator (Principle IV; logical CSS only, no `margin-left/right`)
- [ ] T141 [P] Confirm every new user-visible string is localized on all three surfaces and that no English text can reach a client (Principles III/IV, A2/A20)
- [ ] T142 Measure preview p95 with ~150 active programs against the 500 ms target from plan.md; if exceeded, profile the per-program loop before adding caching
- [ ] T143 [P] Confirm no `textValue` appears in logs or the calc trace (Principle VI, A4)
- [ ] T144 Run the full [quickstart.md](./quickstart.md) verification, slice by slice, and fix any drift between docs and behaviour
- [ ] T145 [P] Add a constitution `Recent Changes` entry and update `CLAUDE.md` if any principle text needs amending (notably the pending Angular Material vs ng-zorro drift noted in plan.md)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 Setup**: no dependencies
- **Phase 2 Foundational**: after Setup — blocks all story phases
- **Phase 3 (US3)**: after Phase 2. Supplies typed numeric answers
- **Phase 4 (US2)**: after Phase 3 (needs real numbers) — T053 consumes T035/T039–T043
- **Phase 5 (US1)**: after Phase 2; independent of US3/US2 apart from shared error codes
- **Phase 6 (US5)**: after Phase 2 for the resolver; T095/T096 need T079/T077 from Phase 5
- **Phase 7 (US4)**: after Phase 4 — `quote.ts` (T050) is the dependency
- **Phase 8 (US6)**: after Phase 5 — completes `prefill.service.ts` (T120 finishes T071)
- **Phase 9 (US7)**: after Phase 4 — reuses `quote.ts` and the figures DTO
- **Phase 10 Prune**: after Phases 3–9 merged; gated on backup + go-ahead
- **Phase 11 Polish**: after the desired stories are complete

### Story independence

- **US3** fully independent once Phase 2 lands
- **US1** independent (prefill degrades to catalog-only without US6)
- **US5** independent for the engine; its editor mounts need US1's form
- **US2** depends on US3 for honest numbers — it *can* be demoed against hand-posted numeric answers if US3 slips
- **US4**, **US7** depend on US2's `quote.ts` only
- **US6** extends US1's prefill; no other story blocks on it

### Within each story

Tests → schema/migration → DTO/validation → service → controller → admin UI → mobile UI. Never a mobile task before its contract exists.

---

## Parallel Examples

```bash
# Phase 2 — all i18n files at once
Task: "T007 Arabic error strings in admin/src/i18n/error-codes.ar-EG.json"
Task: "T008 English error strings in admin/src/i18n/error-codes.en-US.json"
Task: "T009 ARB entries in masrafy-app/lib/l10n/intl_{ar,en}.arb"
Task: "T011 DbrSetting + Quote types in backend/src/matching/types.ts"
Task: "T012 MONEY_FIELD_BINDINGS in backend/src/matching/pipeline/money-field-bindings.ts"

# Phase 3 — all US3 tests before implementation
Task: "T014 answer-validation matrix spec"
Task: "T015 numeric-bounds spec"
Task: "T016 question-rule validation spec"
Task: "T017 scoreability guard spec"
Task: "T018 legacy-snapshot spec"

# Phase 3 — the four apply mappers (separate files)
Task: "T040 car_apply_mapper.dart"
Task: "T041 mortgage_apply_mapper.dart"
Task: "T042 business_apply_mapper.dart"

# Phase 6 — band tests in parallel
Task: "T085 boundary resolution"
Task: "T086 scalar fallback"
Task: "T087 modifier ordering"
Task: "T088 validator rejection cases"
```

---

## Implementation Strategy

### MVP (three P1 stories)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 (US3) — **stop and validate**: a number question carries 500 000, not 300 000
3. Phase 4 (US2) — **stop and validate**: results show money, and preview equals offer
4. Phase 5 (US1) — **stop and validate**: a program is created from prefill in under 3 minutes
5. Demo. This is a complete, honest product slice: correct inputs, visible figures, fast setup

### Incremental delivery after MVP

6. Phase 6 (US5) banded DBR — the biggest accuracy gain per line of code
7. Phase 7 (US4) calculator — the most visible customer addition
8. Phase 8 (US6) bank policy — removes the remaining repeated typing
9. Phase 9 (US7) simulator — the ops safety net
10. Phase 10 prune — last, gated, irreversible
11. Phase 11 polish

### Parallel team split

After Phase 2: Dev A takes US3 → US2 (the dependency chain); Dev B takes US1 → US6; Dev C takes US5's engine work then US4. US7 goes to whoever finishes first. Phase 10 is a single coordinated PR, not parallel work.

---

## Notes

- 145 tasks. Test tasks are included because SC-004 and SC-006 cannot be claimed without them, not as a blanket TDD rule.
- Money crosses every boundary as a decimal **string**; the app never does money arithmetic (Principle I).
- `promax` before and `impec` after every new admin surface — skipping is A17.
- Phase 10 deletes data. Backup, go-ahead, release note. No exceptions.
- Commit per task or per logical group; stop at any checkpoint to validate a story on its own.
