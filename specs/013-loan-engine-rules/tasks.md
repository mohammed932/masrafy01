# Tasks: Loan Engine rules tab

**Input**: Design documents from `/specs/013-loan-engine-rules/`
**Prerequisites**: plan.md, spec.md, research.md (R1–R8), data-model.md, contracts/loan-engine-admin-api.md, quickstart.md

**Tests**: NOT generated. Under the repo testing policy (CLAUDE.md, 2026-09-06), no new unit tests are written. Proof is given instead by the before/after figures on the real DB, the seeds, `check:*`, a browser pass and both locale builds (quickstart.md). If a change makes an existing test wrong, UPDATE that test.

**Paths**: repo-relative. `backend/` = NestJS service, `admin/` = Angular dashboard. Flutter (`masrafy-app/`) is NOT touched (research R4).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 = per-answer effects, US2 = eligibility conditions, US3 = try an answer

---

## Phase 1: Setup (baseline before any code)

**Purpose**: capture the figures the whole feature is measured against. Nothing in Phase 2 may start before this.

- [X] T001 Add a `PARITY_OUT` env override for the `OUT` constant in `backend/scripts/quote-preview-apply-parity.ts`, keeping the 012 baseline path as the default.
- [X] T002 Start a scratch backend build on :3100 (as in 012: `tsc --outDir <scratchpad>/build/src` + `tsconfig-paths` with a scratch tsconfig). Then run `PARITY_API=http://localhost:3100/api PARITY_OUT=../specs/013-loan-engine-rules/parity-baseline.json npx tsx scripts/quote-preview-apply-parity.ts --write` from `backend/`.
- [X] T003 [P] Capture `npm run quote:surrogate`, `quote:car-plans`, `quote:iscore` and `check:question-scope -- --report` into `specs/013-loan-engine-rules/baseline/{surrogate,car-plans,iscore,scope}-before.txt`.

---

## Phase 2: Foundational (blocking prerequisites for US1 and US2)

**Purpose**: widen the band key (R1 / data-model §1) so the six number operators compile without loss. Moves NO money: no stored row uses the new edges.

**⚠️ CRITICAL**: US1 and US2 both depend on this phase.

- [X] T004 Widen `FactGridKey` in `backend/src/matching/pipeline/fact-grid.ts` to `{ fromInclusive? | fromExclusive?, toExclusive? | toInclusive? }`. Update `keyMatchesAnswer` so each edge is strict or inclusive as named. Make `validateFactGrid` refuse two keys on one edge, a band with no edge, `from > to`, and `from = to` unless both edges are inclusive. The "matches nothing" read of stored half-typed cells stays unchanged.
- [X] T005 [P] Apply the same widened band predicate in `backend/src/matching/pipeline/max-loan-by-fact.ts`, reusing `keyMatchesAnswer` or a shared helper rather than a copy.
- [X] T006 [P] Make `backend/src/matching/pipeline/product-needed-facts.ts` accept `fromExclusive` / `toInclusive` as a `number` read, so the 012 shape check classifies the new bands correctly.
- [X] T007 [P] Add a shared, pure criterion converter in `backend/src/matching/pipeline/criterion.ts`. It maps operator criteria (`{op:'lt'|'lte'|'gte'|'gt'|'between'|'eq', a, b?}` | `{option}` | `{answered:true}`) to and from `FactGridKey` per the R1 table, and the round-trip must be lossless. It throws a typed problem (`both_edges` | `empty_band` | `shape`) for the service to map.
- [X] T008 Mirror the widened band key in any admin-side TypeScript type that models fact-grid cells (search `admin/src/app` for `toExclusive`, e.g. `admin/src/app/shared/**/fact-grid*.ts`), so `tsc` stays clean. The existing editors keep writing only `fromInclusive` / `toExclusive`.
- [X] T009 Run `npx tsc --noEmit` in `backend/` and `admin/` and `npx vitest run` in `backend/` (expect 1608/1608; update any test made wrong). Re-run T003 into `*-after.txt` and diff: it must be byte-identical. Re-run the parity script without `--write`: 0 differences against `parity-baseline.json`.

**Checkpoint**: number criteria are expressible end to end in the engine, with zero money moved.

---

## Phase 3: User Story 1 — Per-answer effects for one question (Priority: P1) 🎯 MVP

**Goal**: an operator states, per bank program, one figure per answer criterion for rate / cap / financed share / smallest loan / shortest term / longest term / extra income, from a question-centric screen.

**Independent Test**: quickstart §4. `PUT …/effects/rate` with "1–100 → 22, >100 → 19" on one payslip program. Simulate 1 / 100 / 100.01 / 150 → 22 / 22 / 19 / 19. Every other program equals the baseline. Restoring with `rows: []` returns the program to the baseline.

### Backend

- [X] T010 [US1] Add the `LOAN_ENGINE_RULE_INVALID` code in `backend/src/common/errors/error-codes.ts`: 422, meta `{programCode, effect, row?, problem}`, where `problem` is one of `both_edges | empty_band | unknown_option | engine_input | shape | read_only_surface | not_linked`. Add `LoanEngineRuleInvalidException` in `backend/src/common/errors/domain.exceptions.ts`.
- [X] T011 [P] [US1] Add `LOAN_ENGINE_RULE_INVALID` to `admin/src/i18n/error-codes.en-US.json` and `admin/src/i18n/error-codes.ar-EG.json`. These are admin-only (no ARB, following the `SURROGATE_FACT_KEY_TAKEN` precedent). Run `npm run check:codes` in `backend/`: +1, in sync.
- [X] T012 [P] [US1] Create the class-validator DTOs in `backend/src/bank-programs/loan-engine/dto/loan-engine.dto.ts`: `CriterionDto` (a discriminated union validated by `op` / `option` / `answered`, with Decimal strings validated by regex), `EffectRowDto`, `PutEffectRowsDto {expectedVersion, rows[], onNoMatch?}`, an `effect` param enum, and the response interfaces `LoanEngineQuestionSummary`, `LoanEngineQuestionDetail`, `EffectState` and `EffectRow` (data-model §4).
- [X] T013 [US1] Create `backend/src/bank-programs/loan-engine/loan-engine.repository.ts` (Principle X). It needs:
  - `listQuestions(category?)`, built on `questionUsageInputs()` from `postgres-platform-enumerations.repository.ts`;
  - `programsForCategories(categories)`, returning active programs with `id, programCode, bank name, category, version, pricing, loanLimits, tenor, incomeAssumption` and whether their plans come from a product;
  - `replaceProgramPath(programId, path, value, expectedVersion)`, which writes one JSONB path inside a transaction, refuses a stale `version` with `CONFLICT_STALE_DATA`, and returns the before and after values for the audit.
- [X] T014 [US1] Create `backend/src/bank-programs/loan-engine/loan-engine.service.ts`.
  - **Detail read:** for each program and each effect (R5 table), it builds an `EffectState`.
    - It is editable only when the column is absent, or is a single-axis grid on this question's fact.
    - Otherwise it is read-only: `multi_axis`, `other_fact`, `inherited_plan`, or `two_axis_cap` for a `maxLoanByFact` with a `columnFactKey`.
    - Rows come back through the T007 converter, so the client never sees storage shapes.
  - **Effect write:**
    - Resolve the question → bound fact (`not_linked` if there is none).
    - Check the criterion kind against the question type: NUMERIC → op; choice → `option` ∈ option codes, else `unknown_option`; TEXT → `answered` only. `extra_income` is NUMERIC-only.
    - Convert the rows to a single-axis grid. For `cap`, convert to the `maxLoanByFact` shape. For `extra_income`, upsert `{factKey, percent}` into `additionalIncome.sources`.
    - Validate the result with `validateFactGrid` and the 012 A2 shape check.
    - Write it through the repository.
    - Audit `BANK_PROGRAM_UPDATED` with `changes.<path>` (figures only).
    - An empty `rows` deletes the grid or the source.
- [X] T015 [US1] Create `backend/src/bank-programs/loan-engine/loan-engine.controller.ts` with `@Controller('admin/loan-engine')`:
  - `GET questions?category=&search=` (an unknown category → `VALIDATION_FAILED`);
  - `GET questions/:questionCode`;
  - `PUT questions/:questionCode/programs/:programCode/effects/:effect`.
  - Roles: reads for `super_admin` + `sales_manager`, writes for `super_admin`. Swagger `@ApiResponse` lists every error code from the contract.
- [X] T016 [US1] Register the controller, service and repository in `backend/src/bank-programs/bank-programs.module.ts`. Confirm the routes don't collide with existing `admin/bank-programs/:programCode` routes.
- [X] T017 [US1] Verify over HTTP on the scratch :3100 build, following quickstart §4 steps 1–7:
  - the boundary sweep for all six operators;
  - the stale `version` → 409;
  - the `both_edges`, `unknown_option` and `read_only_surface` refusals;
  - restore, then re-run the parity script: 0 differences.

  Record the results for the CHANGELOG.

### Admin

- [X] T018 [US1] Run the `ui-ux-pro-max` skill for the `/loan-engine` screen before writing any template (Principle XXIII). Layout per R8: the question list (search, loan-type filter, 012 class chip); the question header; an effects × programs matrix; the row editor in an `NzDrawerService` side sheet. **Deviation (2026-10-04):** the `ui-ux-pro-max` skill is not installed in this environment; the screen follows the house patterns instead (the questionnaire editor layout, `app-form-drawer` side sheets, shared tokens).
- [X] T019 [P] [US1] Create `admin/src/app/features/loan-engine/loan-engine.api.service.ts`, with `HttpClient` only and typed models mirroring T012's response interfaces.
- [X] T020 [US1] Create `admin/src/app/features/loan-engine/loan-engine.page.ts`. It is standalone and OnPush, uses signals and `inject()`, and uses `@if` / `@for track`. It contains the question list, the selected question with the matrix (one row per program, one cell per effect, showing the row count, a read-only reason chip with a link to the owning screen, or "Add"), and a "Link it first" action for an unlinked question that calls 012's `PUT /api/admin/bank-programs/question-facts/:questionCode`. It honours `?question=&effect=`, and is read-only for `sales_manager`. All copy goes through `$localize` with `@@lengine.*` ids, using logical CSS and tokens only.
- [X] T021 [US1] Create `admin/src/app/features/loan-engine/effect-rows.sheet.ts`, opened through `NzDrawerService` (A34).
  - The criterion builder depends on the question type:
    - NUMERIC: an operator select (less than / at most / at least / more than / between / equals) plus value input(s) with `appMoneyInput` (A27);
    - choice: one fixed row per option;
    - TEXT: "answered".
  - Also: the figure per row, with the unit from the contract; a fallback row (`onNoMatch`); draggable row order, with a one-line "first matching row wins" note and an overlap warning.
  - It uses typed reactive forms, and saves with `expectedVersion`. On save it shows server errors via `ErrorCodeService`; on 409 it shows a reload prompt.
- [X] T022 [US1] Add the lazy route `/loan-engine` in `admin/src/app/app.routes.ts` with the existing functional admin guard, and a sidebar entry under Questionnaire in `admin/src/app/features/shell/sidebar.component.ts`.
- [X] T023 [US1] Re-point the "What should it affect?" tiles in `admin/src/app/features/questionnaire/question-calculation.component.ts` to `/loan-engine?question=<code>&effect=<id>`. Update the "Opens the table where…" line to name the Loan Engine screen.
- [X] T024 [US1] Add ar-EG targets for every new `@@lengine.*` id in `admin/src/i18n/messages.ar-EG.xlf`, using `<x/>` placeholders. Build `development-ar`; the untranslated count must equal the HEAD worktree's (368).

**Checkpoint**: US1 is shippable alone. An operator can state per-answer figures for any program from one screen.

---

## Phase 4: User Story 2 — Eligibility conditions on any program (Priority: P1)

**Goal**: any bank program, payslip ones included, can carry conditions. A failed condition shows the program as refused with a reason code in BOTH preview and apply. A question a condition reads becomes required.

**Independent Test**: quickstart §5. A condition `business_months = over_24` OR `has_guarantor = yes`, with reason `BUSINESS_TOO_NEW`. The three answer pairs give refused / quotes / quotes, and preview equals apply. A criterion on `monthly_income` → 422 `engine_input`. The served questionnaire requires both questions. Restore → baseline.

### Engine

- [X] T025 [US2] Add the `conditions Json?` column to the `BankProgram` model in `backend/prisma/schema.prisma`, with the data-model §2 doc comment. Create the migration `backend/prisma/migrations/<timestamp>_bank_program_conditions/migration.sql` (`ALTER TABLE … ADD COLUMN "conditions" JSONB`, nullable, no backfill). Run `npx prisma migrate dev` and `npx prisma generate`.
- [X] T026 [US2] Add the `ProgramCondition` / `ConditionCriterion` types to `backend/src/matching/types.ts` and the program definition the engine reads. Carry `conditions` through `backend/src/bank-programs/bank-program-snapshot.mapper.ts` (`toBankProgramSnapshot`) and every place that loads programs for the engine (`backend/src/matching/engine.service.ts` inputs, `backend/src/applications/application.repository.ts`). Normalise null to `[]`.
- [X] T027 [US2] Create the pure evaluator `backend/src/matching/pipeline/program-conditions.ts`: `evaluateProgramConditions(conditions, facts) → {ok:true} | {ok:false, conditionId, reasonCode}`. ALL conditions must pass and ANY criterion passes a condition. An unanswered criterion does not match. Matching uses `keyMatchesAnswer` only.
- [X] T028 [US2] Call the evaluator in `quoteProgram` in `backend/src/matching/pipeline/quote.ts`, before the income and amount steps. On failure, return the existing unavailable outcome: `reason: 'PRODUCT_RULE_GATE_FAILED'`, `gateId: 'condition:<id>'` and `gateReasonCode`, mirroring `quote.ts:556-577`. The program stays listed and `rankIndex` is unaffected. Preview and apply share this one call (FR-010).
- [X] T029 [US2] Make `FactReaderProgramRow.conditions` REQUIRED in `backend/src/matching/pipeline/fact-readers.ts`, and add the surface `'condition'` with `refusesWhenUnanswered: true` in `factSurfacesOfProgram`. Also make `factReaders` (the delete guard) count condition reads, so a fact read only by a condition cannot be deleted. This is the 012 Q3 drift risk; update `factReaders` in the same change.
- [X] T030 [US2] SELECT `conditions` in every program query that feeds `FactReaderProgramRow`: `backend/src/platform-enumerations/postgres-platform-enumerations.repository.ts` (`questionUsageInputs`, `narrowingScopeFor` / `mustAnswerQuestionCodes`, the reader scans) and `backend/scripts/check-question-scope.ts`. `tsc` must name every caller.
- [X] T031 [US2] Extend `OPTIONAL_REFUSAL` in `backend/scripts/check-question-scope.ts` so a fact read by a condition counts as a refusal-when-unanswered (FR-008).
- [X] T032 [US2] Re-run T009's proof: `tsc`, vitest, the T003 captures byte-identical, parity 0 differences. With the column applied and empty, no money and no required set may move. Run `npm run seed:blueprints` and `npm run seed:sheet-figures`: 0 written / 0 refused.

### API

- [X] T033 [US2] Add `PutProgramConditionsDto` to `backend/src/bank-programs/loan-engine/dto/loan-engine.dto.ts`: `{expectedVersion, conditions: [{id (slug, unique), reasonCode (∈ GATE_REASON_CODES), anyOf: [{questionCode, criterion}] (≥1)}]}`.
- [X] T034 [US2] Implement `putConditions(programCode, dto, actor)` in `backend/src/bank-programs/loan-engine/loan-engine.service.ts`.
  - Resolve each `questionCode` → bound fact (`not_linked`).
  - Refuse an engine input via `questionLockReason(...) === 'engine'` / `isReservedFactKey` → `engine_input` (A33).
  - Validate the criterion kind against the question type (`shape` / `unknown_option`).
  - Convert through T007 and write `conditions` via the repository with `expectedVersion`.
  - Audit `BANK_PROGRAM_UPDATED` `changes.conditions`.
  - Return the program names whose served questionnaire now requires the read questions.
  
  Add `programs[].conditions` (only the ones that read this fact) to the T014 detail read.
- [X] T035 [US2] Add the route `PUT programs/:programCode/conditions` (super_admin) in `backend/src/bank-programs/loan-engine/loan-engine.controller.ts`, with Swagger error docs.
- [X] T036 [US2] Verify over HTTP (quickstart §5, steps 1–6): simulate AND customer apply for the three answer pairs; preview = apply; the program is never missing; `engine_input` refused; `GET /v1/questionnaire?category=&programNameKey=` shows both questions required; `check:question-scope` clean. Restore with `conditions: []`, re-run the parity script (0 differences), delete the test applications.

### Admin

- [X] T037 [US2] Create `admin/src/app/features/loan-engine/conditions.sheet.ts` (`NzDrawerService`, typed reactive forms). It lists the program's conditions. Each has a reason picker over `GATE_REASON_CODES` (labels from the existing error-code JSONs) and an "any of" list of criteria, each criterion being a question (linked, non-engine) plus a criterion builder reused from T021. It shows the names that will now require the questions before confirming the save.
- [X] T038 [US2] Add a "Conditions" column to the matrix in `admin/src/app/features/loan-engine/loan-engine.page.ts` that opens T037, and add the condition count chip. Add the ar-EG targets for the new `@@lengine.*` ids in `admin/src/i18n/messages.ar-EG.xlf`.

**Checkpoint**: conditions work on any program, refused-not-hidden, in preview and apply alike.

---

## Phase 5: User Story 3 — Try an answer (Priority: P2)

**Goal**: the operator types a sample answer and sees each program's figure or refusal reason, including the effect of their unsaved edits.

**Independent Test**: on one program, unsaved rows "1–100 → 22" plus sample answer 50 → the simulate response shows rate 22 for that program. Nothing is persisted (the program `version` unchanged).

- [X] T039 [US3] Add an optional `programOverrides: [{programCode, target: effect|'conditions', questionCode, body}]` field to `SimulateMatchesDto` in `backend/src/matching-preview/dto/simulate-matches.dto.ts`, validated as admin-only.
- [X] T040 [US3] In the admin simulate path (`backend/src/matching-preview/admin-matching.controller.ts` → `matching-preview.service.ts`), run each override through the SAME validation and conversion as the T014 / T034 writes (expose a pure `applyOverride(programRow, override)` from `loan-engine.service.ts`). Apply them to the in-memory program rows only, then quote through the unchanged engine path. Nothing is written.
- [X] T041 [US3] Create `admin/src/app/features/loan-engine/try-answer.component.ts`. It takes an answer input for the selected question (typed per question type), plus the drawer's unsaved draft as overrides. It calls simulate and shows per-program figures or the refusal reason (`gateReasonCode` via `ErrorCodeService`), comparing saved and draft. Embed it in `loan-engine.page.ts` and in both sheets. Add the ar-EG targets for its ids.
- [X] T042 [US3] Verify over HTTP and in the browser: the unsaved override changes the simulate result; the program `version` is unchanged; an invalid override → 422 `LOAN_ENGINE_RULE_INVALID`, the same as the write would return.

---

## Phase 6: Polish & cross-cutting

- [ ] T043 Run the `impec` skill on `/loan-engine` and both sheets after the first implementation (Principle XXIII), and apply its fixes. **Not done (2026-10-04):** the `impec` audit was not run. A manual pass fixed RTL arrow mirroring, the dark-mode title colour, "1 row" pluralisation and the picker placeholder.
- [ ] T044 Browser pass (quickstart §6): `/loan-engine`, the effect sheet, the conditions sheet and try-an-answer, in light, dark, RTL and the ar-EG build, at 1440 / 1024 / 720. Page overflow 0, console clean, focus visible, full-viewport drawer scrim. The 012 tiles land on the right question and effect. **Partly done (2026-10-04):** light, dark and forced RTL at 1456 px; page overflow 0; console clean after the NG0600 fix; full-viewport scrim; both sheets saved through the UI. Not yet checked: 1024 and 720 px, and the ar-EG build in the browser.
- [X] T045 [P] Full checks battery (`verify-change` skill):
  - `check:codes`, `check:income-proof`, `check:parent-keys`, `check:questionnaire`, `check:question-scope`, `check:money`, `check:conditions`;
  - `tsc` on both; lint ≤ HEAD on the touched files;
  - backend and admin suites green;
  - `development` and `development-ar` builds, with the untranslated count = the HEAD worktree's.
  
  Report `check:questionnaire`'s 5 pre-existing car violations separately if they are still there.
- [X] T046 [P] Write the `docs/CHANGELOG.md` entries:
  - v30.12.0 for Phase 2 + US2's engine part (band widening, conditions column; moves no money);
  - v30.13.0 for the US1/US2 API and screen;
  - v30.14.0 for US3, unless shipped together.
  
  Each carries its rationale, verification evidence and a "Not done" list. Add matching one-line index entries to `CLAUDE.md` "Recent Changes" by hand (do NOT run `update-agent-context.sh`: it truncates that list).
- [X] T047 [P] Mark the 012 tiles' navigation change in `specs/012-question-calculation-link/plan.en.md` (A8 "tiles only navigate" now lands on `/loan-engine`). Note in the plan that 012 Clarification Q3 is partly addressed by T029.
- [X] T048 Stop the scratch :3100 server and remove the scratch build. Confirm with the parity script that the dev DB holds no test rows, conditions or applications from T017 / T036 / T042.

---

## Dependencies & Execution Order

### Phase dependencies
- **Phase 1 (Setup)** → blocks everything: the baseline must exist before any code.
- **Phase 2 (Foundational)** → blocks US1 and US2 (both write or read the widened band key).
- **US1 (Phase 3)** and **US2 (Phase 4)**:
  - US2's engine tasks T025–T032 do not depend on US1.
  - US2's API (T033–T035) extends US1's sub-module (T012–T016), so it follows it.
  - US2's admin tasks (T037–T038) reuse T021's criterion builder.
- **US3 (Phase 5)** needs the US1 service (T014) for the shared validation; the condition overrides also need T034.
- **Polish (Phase 6)** comes after the stories that are shipping.

### Within-phase order
- Error code (T010) → DTOs (T012) → repository (T013) → service (T014) → controller (T015) → module (T016) → HTTP proof (T017).
- `ui-ux-pro-max` (T018) before any admin template (T020–T021); `impec` (T043) after.
- Schema + migration (T025) → types / mapper (T026) → evaluator (T027) → quote (T028) → readers (T029–T031) → zero-money proof (T032).

## Parallel Opportunities
- Phase 2: T005, T006 and T007 run in parallel after T004's type is fixed.
- US1: T011, T012 and T019 in parallel; the admin work (T018–T024) can start once T012's response shapes exist, alongside T013–T017.
- US2: the engine track (T025–T032) can run alongside US1's admin track.
- Polish: T045, T046 and T047 in parallel.

```text
# After T004:
T005 max-loan-by-fact.ts   |  T006 product-needed-facts.ts  |  T007 criterion.ts
# US1 once T010 lands:
T011 admin error JSONs      |  T012 DTOs                     |  T019 admin api service
# Across stories:
US1 admin (T018–T024)       |  US2 engine (T025–T032)
```

## Implementation Strategy

### MVP (US1 only)
1. Phase 1 → Phase 2 (zero money moved, proven).
2. Phase 3 → an operator can state "1–100 → X%, above 100 → Y%" for one program (SC-001).
3. **Stop and validate** (T017 + T024), then ship as its own PR.

### Incremental delivery (plan.md "Delivery order")
1. Setup + Foundational + US2's engine part (T025–T032): one PR. Moves no money; byte-identical proof.
2. US1 API + screen: one PR.
3. US2 API + sheet: one PR.
4. US3 try-an-answer: one PR (or folded into 3).

## Notes
- No task adds a unit test. Proof is the T009, T017, T032, T036 and T042 captures.
- Every HTTP proof restores its data and re-runs the parity script to 0 differences.
- Do not run `.specify/scripts/bash/update-agent-context.sh`: it truncated CLAUDE.md's Recent Changes on 2026-10-04.
- Open from 012: Clarification Q3 (one walk vs a parity check between `factReaders` and `factSurfacesOfProgram`). T029 must keep the delete guard and "Used by" in agreement for conditions whichever way it is answered.
