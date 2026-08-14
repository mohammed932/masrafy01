---
description: "Task list — Income-Surrogate Rule Builder (Admin)"
---

# Tasks: Income-Surrogate Rule Builder (Admin)

**Input**: Design documents from `/specs/011-surrogate-admin-panel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)

**Tests**: INCLUDED. plan.md § Testing names the unit specs, `contracts/admin-bank-programs.md` § 2 names
`test/unit/rule-check-simulator-parity.spec.ts` as the FR-030 / SC-007 guarantee, and quickstart.md § 5
runs them by name. Constitution XVI/XXVII add no further requirement.

**Organization**: Grouped by user story. US1 and US2 are both P1 and both required for a customer-visible
result; US3 and US4 are P2 safety nets.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3 / US4

## Path Conventions

- Backend: `backend/src/…`, `backend/prisma/…`, tests `backend/test/unit/…`
- Admin: `admin/src/app/…`, i18n `admin/src/i18n/…`, tests `admin/tests/…`
- Mobile: `masrafy-app/lib/…`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The design gate that Principle XXIII makes non-deferrable, plus the typed-error surfaces
that Principle III requires in the SAME PR as the codes.

- [X] T001 Run the `promax` skill for the two new admin surfaces (rule-builder section + waiting-list page) BEFORE any component is written, and record the resulting pattern/token/anti-pattern decisions in `specs/011-surrogate-admin-panel/design-notes.md` (Principle XXIII, A17 — blocking)
- [X] T002 [P] Add the 11 new codes to `backend/src/common/errors/error-codes.ts` with their HTTP statuses per `contracts/admin-bank-programs.md` § 5: `INCOME_RULE_EMPTY`, `INCOME_RULE_INCOME_INVALID`, `INCOME_RULE_DUPLICATE_KEY`, `INCOME_RULE_UNKNOWN_KEY`, `INCOME_RULE_BANDS_INVALID`, `INCOME_RULE_DBR_OVERRIDE_INVALID`, `VALUE_SOURCE_PATH_UNKNOWN` (422), `PROGRAM_HAS_ESTIMATED_VALUES` (409), `SURROGATE_FACT_BINDING_MISSING` (422 warning payload), `SURROGATE_FACT_MISSING`, `SURROGATE_NO_MATCHING_ROW` (200 unavailable reasons)
- [X] T003 [P] Add ar-EG + en-US messages for all 11 codes in `admin/src/i18n/error-codes.ar-EG.json` and `admin/src/i18n/error-codes.en-US.json` (Principle III same-PR rule, A2 — no English to clients)
- [X] T004 [P] Add the two customer-visible reason strings to `masrafy-app/lib/l10n/intl_ar.arb` and `masrafy-app/lib/l10n/intl_en.arb` using the exact ar/en wording in `contracts/questionnaire-bindings.md` § 4 (`SURROGATE_FACT_MISSING`, `SURROGATE_NO_MATCHING_ROW`; FR-023, FR-025)
- [X] T071 **Capture the pre-change offer baseline BEFORE any engine task runs** — seed a clean stack and write the produced offers for the full seeded program set (installment, rate, tenor, max loan, per program per sample applicant) to `specs/011-surrogate-admin-panel/baseline-offers.json`, covering `income_proof` AND the `income_surrogate` + `strategy: 'declared'` population (business category, doctors, professionals, pharmacies). Without this snapshot SC-009 becomes unverifiable the moment T016 lands (SC-009)

**Checkpoint**: design decisions recorded, error vocabulary exists on all three surfaces, SC-009
baseline frozen on disk.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The engine must read ONE canonical rule shape, return provenance instead of a bare
`Decimal`, and honour the combination rule on surrogate programs, before any story can be observed.
Splitting these leaves half-wired code that no story can test.

**⚠️ CRITICAL**: no user story work starts until this phase is complete.

- [X] T005 Add the two additive columns in `backend/prisma/schema.prisma`: `BankProgram.valueSources Json @default("{}")` and `BankOffer.incomeOrigin String? @db.VarChar(32)` + `BankOffer.incomeSurrogateStrategy String? @db.VarChar(32)`, each with the doc-comment rationale from data-model.md §3 / §4 (Principle I / A6 — provenance frozen, not derived)
- [X] T006 Generate the two named migrations from T005 with `npx prisma migrate dev --name bank_program_value_sources` then `--name bank_offer_income_origin`, verify both are additive-only with no backfill and commit the SQL under `backend/prisma/migrations/` (Principle XI — no `db push`)
- [X] T007 Extend `backend/src/matching/types.ts`: `IncomeAssumptionStrategy` token union, canonical `IncomeAssumptionConfig` (`keyTable` / `bands` / `scalar` / `dbrCapPercentOverride` / `requiredDocuments` / `combinationRule`) as a union with the legacy shapes, and the new `IncomeResolution` interface exactly as data-model.md § 1–2 specifies
- [X] T008 Add `SURROGATE_FACT_MISSING` and `SURROGATE_NO_MATCHING_ROW` to `FiguresUnavailableReason` in `backend/src/matching/types.ts` and map both to `monthly_income` in `reasonToCheckCode` in `backend/src/matching/engine.service.ts` (research R9; program stays listed and ranked — FR-022, FR-024)
- [X] T009 [P] Create the pure legacy→canonical upgrade-on-read `normalizeIncomeAssumption()` in `backend/src/matching/pipeline/income-rule-normalize.ts`, covering every row in research.md R1's conversion table (`rankIncomeMap`/`gradeIncomeMap` → `keyTable`; years `incomeTable` → `bands` with `toExclusive = maxYears + 1`; value `incomeTable` → `bands` chained on the next row's `fromInclusive`, last `null`; the five scalar keys → `scalar`) — no migration, no behaviour change (FR-015)
- [X] T010 [P] Create the pure half-open `[fromInclusive, toExclusive)` band lookup in `backend/src/matching/pipeline/income-rule-bands.ts` using `Decimal.gte`/`lt` only (never `Number`), returning the matched band or a `no_matching_band` miss for a value below the first edge (Principle I, research R6)
- [X] T011 [P] Create `backend/src/matching/pipeline/surrogate-fact-bindings.ts` with `SURROGATE_FACT_BINDINGS` + frozen `SURROGATE_FACT_SPECS` (questionCode, type, registry, profile path) exactly as data-model.md § 5, modelled on the sibling `money-field-bindings.ts` (A33 — no field on `Question`/`QuestionOption`)
- [X] T012 [P] Unit-test the normalizer in `backend/test/unit/income-rule-normalize.spec.ts`: every legacy shape round-trips to canonical, the three seeded legacy programs produce byte-identical figures, and an already-canonical blob is idempotent (FR-015, SC-009)
- [X] T013 [P] Unit-test bands in `backend/test/unit/income-rule-bands.spec.ts`: edge inclusivity at `from`, exclusivity at `to`, open-ended last band, value below the first edge ⇒ `no_matching_band`, Decimal precision preserved (FR-007, FR-031)
- [X] T014 Rewrite `resolveAssumedIncome` in `backend/src/matching/pipeline/income-resolver.ts` to return `IncomeResolution` (income, `origin`, `strategy`, `unresolvedReason`, `dbrCapPercent`, `dbrCapSource`), reading through T009's normalizer and T010's band lookup for the six table methods, with the per-strategy arithmetic COPIED UNCHANGED, and with the declared baseline left **RAW** — `applyCompanyTypeAdjustment` is NOT applied on the quote path, because `quote.ts:129-137` excludes it and every business-category / doctor / professional / pharmacy seed is `income_surrogate` with `strategy: 'declared'`, so inheriting the 80–90% haircut would move their live figures (research R4, SC-009) — depends on T007, T009, T010
- [X] T015 Accept the per-rule `dbrCapPercentOverride` in `resolveDbrCap` in `backend/src/matching/pipeline/dbr.ts`, applied ONLY when the recognised income is surrogate-derived, reporting `dbrCapSource: 'rule_override'` vs `'program_default'` (FR-012) — depends on T007
- [X] T016 Fix the step-3 short-circuit in `backend/src/matching/pipeline/quote.ts`: for `programType === 'income_surrogate'` delegate to `resolveAssumedIncome` so the stored `combinationRule` finally executes, thread `IncomeResolution` into the DBR call (T015) and out of the quote result, and raise `SURROGATE_FACT_MISSING` / `SURROGATE_NO_MATCHING_ROW` when `origin === 'none'` — those two WIN over the existing `income ≤ 0 ⇒ NO_RECOGNISED_INCOME` check, which keeps its meaning for every other cause; `income_proof` keeps today's declared-salary path byte-for-byte (research R4, contracts/matching-provenance.md § 1, SC-009) — depends on T014, T015, T008
- [X] T017 Unit-test the engine rewiring in `backend/test/unit/surrogate-income-resolution.spec.ts`: `income_proof` output unchanged against `baseline-offers.json`, the `income_surrogate` + `strategy: 'declared'` population unchanged too (no `commercialBankIncomePercent` haircut applied), `greater_of` / `lesser_of` / replace each selected on an `income_surrogate` program with a declared salary > 0, unanswered fact ⇒ `SURROGATE_FACT_MISSING` with income never zero-substituted, unmatched key/band ⇒ `SURROGATE_NO_MATCHING_ROW`, and **result ordering identical to the baseline** (FR-020, FR-024, SC-008, SC-009) — depends on T016, T071
- [X] T072 Re-type the three mis-typed catalog seeds in `backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts` — `ABK-MILITARY`, `ABK-PROFESSORS`, `ABK-DOCTORS-PRACTICE` carry surrogate tables while inheriting `programType: 'income_proof'` from `catalogs/base.ts:18`; set `programType: 'income_surrogate'` on each so the type-gated rule section reaches the only rows worth editing, and re-run the seed to confirm idempotence (spec Context row 1, research "Open items" 4) — depends on T016

**Checkpoint**: the engine reads one canonical rule, says where the income came from, no figure in
`baseline-offers.json` has moved, and the three table-carrying programs are typed such that the rule
section will reach them. User stories can now proceed.

---

## Phase 3: User Story 1 — Admin types the bank's own table (Priority: P1) 🎯 MVP

**Goal**: Every method the engine can execute has a working entry form; the six TABLE methods stop
falling through to a placeholder, and an empty or malformed table cannot be saved.

**Independent Test**: Configure a `military_grade` key table on `ABK-MILITARY` (re-typed by T072), run the existing
admin simulator with a sample applicant carrying that grade, and confirm the resolved income equals the
table row.

### Backend — save path

- [X] T018 [US1] Add the nested row DTOs to `backend/src/bank-programs/dto/sub-configs/income-assumption-config.dto.ts` — `strategy` (`@IsIn` the token set), `keyTable` (`key` + `incomeEGP` string), `bands` (`fromInclusive`, nullable `toExclusive`, `incomeEGP`), `scalar` (`value` + `unit`), `dbrCapPercentOverride`, `requiredDocuments`, `combinationRule` — money as Decimal STRINGS, root DTO and nested payload classes in this ONE file (Principle I, XII) — depends on T007
- [X] T019 [US1] Create `backend/src/bank-programs/validation/income-rule.validator.ts` implementing every deep cross-field rule from data-model.md § 1 with its exact error code and meta: `INCOME_RULE_EMPTY`, `INCOME_RULE_INCOME_INVALID` (`{index|key, incomeEGP}`), `INCOME_RULE_DUPLICATE_KEY` (`{key}`), `INCOME_RULE_UNKNOWN_KEY` (`{key, registry}`), `INCOME_RULE_BANDS_INVALID` (`{index, reason: 'unordered'|'gap'|'overlap'|'last_band_not_open'}`), `INCOME_RULE_DBR_OVERRIDE_INVALID` — placed beside `dbr-bands.validator.ts` (FR-008 – FR-010)
- [X] T020 [US1] Resolve key validity against the platform registry in T019 by injecting `PlatformEnumerationsRepository` (`backend/src/platform-enumerations/platform-enumerations.repository.ts`) for the `professor_rank` / `military_grade` types, failing CLOSED with `INCOME_RULE_UNKNOWN_KEY` when a key is not an ACTIVE member (FR-006, AS-1.9) — depends on T019
- [X] T021 [US1] Wire the validator into create + update in `backend/src/bank-programs/bank-programs.service.ts`, strip configuration belonging to a method other than the selected `strategy` before persistence, and — on a non-`personal` or non-`income_surrogate` program — **keep the stored rule as-is, ignore it for matching, and report it in `data.warnings` naming the program's type. NEVER delete it**: three seeded programs carry a table while typed `income_proof`, so a strip would destroy them on the first unrelated save. Also emit the non-blocking `requiredDocuments` gap warning against the program's document list (FR-001, FR-011, FR-013, contracts/admin-bank-programs.md § 1) — depends on T019
- [X] T022 [US1] Return the CANONICAL shape outward: normalize on read in `backend/src/bank-programs/bank-programs.repository.ts` and expose it through `backend/src/bank-programs/dto/bank-program.response.dto.ts` so the admin form never sees a legacy blob, and confirm `backend/src/bank-programs/bank-program-snapshot.mapper.ts` carries the normalized rule into the quote (Principle X, A8) — depends on T009
- [X] T023 [P] [US1] Unit-test the save rules in `backend/test/unit/income-rule-validator.spec.ts`: empty table per method, duplicate key, income `0` and negative, unordered / gapped / overlapping / closed-last bands each naming the offending index, unknown registry key, out-of-range DBR override, other-method config stripped, and a rule on a non-surrogate program SURVIVING the save with a warning rather than being deleted (SC-002, FR-001 edge case) — depends on T019, T020, T021

### Admin — the editors (T001 gate must be complete)

- [X] T024 [P] [US1] Mirror the canonical rule shape in `admin/src/app/features/bank-programs/bank-programs.types.ts` (no `any`, Principle XXI) — depends on T007
- [X] T025 [P] [US1] Create `admin/src/app/features/bank-programs/form/sections/income-rule/income-key-table.component.ts` — standalone, signals, typed `FormArray` of `{key, incomeEGP}` row groups, key chosen through the existing `admin/src/app/features/bank-programs/tier-key-picker/tier-key-picker.component.ts` (never free text, fails closed when the registry is unreachable), income via `appMoneyInput`, `@for … track`, add/remove/reorder operable by keyboard alone, empty state saying what to do next (FR-006, FR-045, FR-046, A27, A36)
- [X] T026 [P] [US1] Create `admin/src/app/features/bank-programs/form/sections/income-rule/income-bands-editor.component.ts` — EDGES-ONLY editor modelled on `admin/src/app/shared/ui/score-bands-editor.component.ts` so gaps and overlaps are unrepresentable, last band open-ended, EGP income cells via `appMoneyInput`, and an `incomeBandsErrorFor()` helper mirroring the backend's `INCOME_RULE_BANDS_INVALID` reasons (FR-007, FR-008, research R6)
- [X] T027 [US1] Replace the "next increment" placeholder in `admin/src/app/features/bank-programs/form/sections/income-assumption-section.component.ts` with type-driven rendering: key table for `byProfessorRank`/`byMilitaryGrade`, bands for `byYearsInJob`/`byYearsInPractice`/`byCDValue`/`byTotalDeposits`, the existing single-number inputs for the four scalar methods, plus the `dbrCapPercentOverride`, `requiredDocuments` and `combinationRule` controls — one level of nesting inside the existing section rhythm, `section.styles.scss` tokens only, visible labels on every control (FR-005, FR-040 – FR-042) — depends on T025, T026
- [X] T028 [US1] Confirm-then-clear on method change in the same component: warn the admin BEFORE the previous method's table is discarded, using `NzModalService` (never a scrim trapped inside `section.page` — A34), and clear on confirm; also clear when the program type moves away from `income_surrogate` (FR-011, spec edge case) — depends on T027
- [X] T029 [US1] Surface row-level validation on blur, not only on save, naming the offending row, and map every new code through the shared error-code service rather than per-component strings (FR-043, A22) — depends on T027
- [X] T030 [US1] Send + receive the canonical rule in `admin/src/app/features/bank-programs/bank-programs.api.service.ts` via `HttpClient` only (A21, Principle XXVI) — depends on T024
- [X] T031 [P] [US1] Add every new admin string to `admin/src/i18n/messages.ar-EG.xlf` with `i18n=@@bank_programs.income.*` ids and verify the table, the bands and the section read correctly right-to-left with logical CSS only (FR-044, A19, A20, SC-011)
- [X] T032 [P] [US1] Unit-test the band-edge error mapping in `admin/tests/income-bands-editor.spec.ts`, asserting the admin's `incomeBandsErrorFor()` and the backend validator agree on every reason token — depends on T026

**Checkpoint**: all ten methods configurable; no program can be saved with a method whose configuration
is empty, duplicated, negative, or gapped. Four real bank programs become configurable.

---

## Phase 4: User Story 2 — The customer is actually asked the question (Priority: P1)

**Goal**: The fact the rule reads is asked in the normal questionnaire, travels with the application,
and produces a real figure — or a stated reason, never a zero.

**Independent Test**: Publish a questionnaire containing the grade question, answer it as a customer,
submit, and confirm the offer's income equals the configured table row for that grade; a customer who
answers nothing gets `SURROGATE_FACT_MISSING`, not a silent zero.

- [X] T033 [US2] Seed the three new questions into the ONE global pool in `backend/prisma/seed-questionnaire.ts` — English labels **"Military grade"** (SINGLE_SELECT), **"Academic rank"** (SINGLE_SELECT), **"Years in practice"** (NUMERIC 0–60 integer, unit years), chosen so `slugify(label)` IS the binding constant (`slug.util.ts:6-15` derives the code from the label; "Your military grade" would yield `your_military_grade` and never bind) — assigned to `personal` ONLY through `question_loan_category`; both SINGLE_SELECTs gated `{ questionCode: 'employment_status', operator: 'equals', optionCode: 'government_employee' }` (ONE optionCode — `enabledWhen` takes no list) and both NOT required; `years_in_practice` ungated and not required; do NOT re-seed the pre-existing `credit_card_total_limit` (data-model.md § 6, research R11, A33 — no `category` column, no hand-typed codes, one pool, one snapshot)
- [X] T034 [US2] Make the SINGLE_SELECT option codes EQUAL the active `military_grade` / `professor_rank` registry members in the same seed, generated from the registry rather than hand-typed, so the admin's table keys and the customer's answers are one list by construction (FR-017, research R3, A33 — no hand-typed codes) — depends on T033
- [X] T035 [US2] Create the ONE shared answers→surrogate-facts mapper (e.g. `backend/src/matching/pipeline/surrogate-facts-from-answers.ts`) reading `SURROGATE_FACT_SPECS`, writing `employment.militaryGrade`, `employment.professorRank`, `employment.yearsInPractice`, `assets.creditCardLimitEGP`, passing numeric answers through EXACTLY with no bucket approximation, and leaving an unanswered fact `undefined` rather than defaulted (FR-018, FR-020) — depends on T011
- [X] T036 [US2] Consume that single mapper in BOTH `backend/src/applications/applications.service.ts#buildProfile` and `backend/src/matching-preview/matching-preview.service.ts#buildProfile`, replacing the empty `assets: {}` construction, so preview and apply cannot derive the facts differently (FR-019, A33 — the v13.0.0 `isQuestionVisible` lesson) — depends on T035
- [X] T037 [US2] Emit the publish/tree binding warnings in `backend/src/questionnaire/questionnaire.service.ts` as a sibling of `MONEY_FIELD_BINDING_MISSING` — `SURROGATE_FACT_BINDING_MISSING` with reason `missing_or_inactive` | `wrong_type` | `option_codes_drifted` | `not_assigned_to_personal`, plus the `dead_registry_key` case for a saved `keyTable` key no longer in the registry — warnings only, publish never blocked (FR-021, contracts/questionnaire-bindings.md § 2) — depends on T011
- [X] T038 [US2] Persist the frozen provenance at offer creation — write `incomeOrigin` and `incomeSurrogateStrategy` from the quote's `IncomeResolution` through `backend/src/applications/application.repository.ts`, set once and never updated (Principle I, A6, research R10) — depends on T016, T006
- [X] T039 [US2] Expose the two frozen fields on every offer-returning surface (application detail, saved offers, admin offer views) rendering `null` as "recorded before provenance existed" rather than assuming `declared` (contracts/matching-provenance.md § 3) — depends on T038
- [X] T040 [P] [US2] Add `SurrogateFacts.fromAnswers` to `masrafy-app/lib/features/questionnaire/presentation/mappers/apply_mapping.dart`, returning a typed request payload fragment (Principle XXX, A28 — no >2-param method) — depends on T033
- [X] T041 [US2] Replace the empty `const AssetsPayload()` in `masrafy-app/lib/features/questionnaire/presentation/pages/personal/personal_apply_mapper.dart` with the real facts + employment fields from T040, omitting an unanswered fact entirely rather than sending zero (FR-019, FR-020) — depends on T040
- [X] T042 [US2] Render the two new unavailable reasons on the mobile result surfaces from the T004 ARB strings, keeping the existing indicative-estimate disclaimer and the existing "{pct}% match" wording, with the program still listed and still ranked (FR-022 – FR-024)
- [X] T043 [US2] Show the binding + dead-key warnings to admins on the program view / questionnaire tree so a misconfigured rule is reported BEFORE a customer meets it, naming the missing question or dead key (FR-021, AS-2.6) — depends on T037
- [X] T044 [P] [US2] Unit-test the customer half in `backend/test/unit/surrogate-fact-resolution.spec.ts`: answer → profile path per fact, numeric pass-through exactness, unasked vs skipped both ⇒ `SURROGATE_FACT_MISSING`, dead registry key ⇒ reported not silently resolved, and PREVIEW/APPLY parity over the same answer set (FR-018 – FR-021, SC-008) — depends on T036
- [X] T073 [P] [US2] Assert the bindings actually resolve, in `backend/test/unit/surrogate-binding-codes.spec.ts`: every `SURROGATE_FACT_SPECS` question code EXISTS and is ACTIVE in the freshly seeded pool, equals `slugify` of its own English label, carries the specified type, is assigned to `personal`, and (for the two selects) has option codes equal to the active registry members — the failure mode this guards is a silent non-bind that only a publish warning would reveal (FR-016, FR-017, U1) — depends on T033, T034
- [X] T074 [US2] Run the SC-003 matrix as `backend/test/unit/surrogate-applicant-matrix.spec.ts`: 10 sample applicants spanning the four ASKED facts (military grade, academic rank, years in practice, credit-card limit) against configured rules, each produced figure traced to exactly one table row or band, plus the skip case per fact yielding a stated reason (SC-003 as narrowed by FR-016) — depends on T036, T033

**Checkpoint**: a customer answering a grade question receives the configured figure; skipping it yields
a stated reason. US1 + US2 together close the loop.

---

## Phase 5: User Story 3 — Admin checks the rule before anyone else sees it (Priority: P2)

**Goal**: A sample applicant can be run against the on-screen rule, in place, without saving.

**Independent Test**: Enter a sample applicant against a table, confirm every displayed figure traces to
a configured value, change one row WITHOUT saving and confirm the panel's output changes.

- [X] T045 [US3] Create `backend/src/bank-programs/dto/income-rule-check.dto.ts` — nested `incomeAssumption` draft DTO reusing T018's classes plus the `sample` payload (explicit admin-side `age`, the ten fact fields, obligations, requested amount, tenor) in ONE file, money as strings (data-model.md § 7; A31 permits a sample age on an ADMIN dry-run DTO — recorded in plan.md Complexity Tracking § 5 because A31's text names only the simulator DTO) — depends on T018
- [X] T046 [US3] Implement the check in `backend/src/bank-programs/bank-programs.service.ts`: validate the draft with T019's validator, load the saved `BankProgramSnapshot`, OVERLAY the draft `incomeAssumption`, synthesise an `ApplicantProfile` from `sample`, call the SAME `quoteProgram` the simulator calls, and persist NOTHING — returning `resolvedIncomeEGP: null` + `unresolvedReason` + `unavailableReason` instead of a zero when nothing matched, plus `matchedRow`, `dbrCapPercent` and `dbrCapSource`. Derive `qualifies` from the quote's own figures ONLY — true when the affordable installment covers the installment the requested amount implies at this program's rate and term, false whenever the income is unresolved — and consult NO eligibility rule, so gating does not re-enter through the panel (FR-026 – FR-031, A33, research R7) — depends on T016, T019
- [X] T047 [US3] Add `POST /api/admin/bank-programs/:programCode/income-rule/check` to `backend/src/bank-programs/bank-programs.controller.ts` behind the existing admin JWT guard, with full `@nestjs/swagger` decorators and the `{ success, data }` envelope (Principle XIII, XIV) — depends on T046
- [X] T048 [US3] Write `backend/test/unit/rule-check-simulator-parity.spec.ts` asserting the check endpoint and `POST /api/admin/matching/simulate` produce IDENTICAL figures across the sample matrix (income, DBR %, installment, loan amount, qualify outcome), including the no-match case (FR-030, SC-007) — depends on T046
- [X] T049 [US3] Create `admin/src/app/features/bank-programs/form/sections/income-rule/income-rule-check.component.ts` — sample-applicant panel directly below the table, in the SAME tab order, typed reactive form, result rendered IN PLACE with no navigation and no full-screen blocking state, "no row matched" stated instead of a zero, and the applied DBR % shown with its source (FR-026 – FR-031, FR-046, FR-047) — depends on T027, T047
- [X] T050 [US3] Send the ON-SCREEN draft (including unsaved edits) from the panel through `bank-programs.api.service.ts`, never the stored rule (FR-028, AS-3.2) — depends on T049
- [X] T051 [P] [US3] Add the panel's ar-EG/en-US strings to `admin/src/i18n/messages.ar-EG.xlf`, keep any motion brief and directional, and suppress it under `prefers-reduced-motion` (FR-025, FR-048)

**Checkpoint**: a mistyped table income is visible before saving, and the panel agrees with the simulator
by construction.

---

## Phase 6: User Story 4 — Guessed numbers can never go live (Priority: P2)

**Goal**: Every number an admin types carries a two-state source marker; one estimate blocks going live,
never saving, and every blocked program appears on one list.

**Independent Test**: Mark one income estimated, attempt to switch the program on, confirm refusal naming
that path, confirm it appears on the waiting list, flip the marker back and confirm it switches on.

- [X] T052 [US4] Create `backend/src/bank-programs/validation/value-sources.validator.ts` — a code-owned allow-list that is **exhaustive over the program's numeric fields**, derived from the config DTO shape rather than hand-picked: `incomeAssumption.keyTable.<key>.incomeEGP`, `incomeAssumption.bands.<index>.{fromInclusive,toExclusive,incomeEGP}`, `incomeAssumption.scalar.value`, `pricing.*`, `fees.*`, `loanLimits.*`, `tenor.*`, `eligibility.*` thresholds, `performanceCriteria.*`, `derivation.*`. A number outside the list cannot be marked and therefore could never block going live, so partial coverage silently exempts whatever it omits. Rejects an unknown path with `VALUE_SOURCE_PATH_UNKNOWN`; the estimate scan returns EVERY entry (research R8, FR-032)
- [X] T053 [US4] Add `valueSources` to `backend/src/bank-programs/dto/create-bank-program.dto.ts` and `update-bank-program.dto.ts` as a sparse `Record<string, 'team_estimated'>`, and read/write it in `backend/src/bank-programs/bank-programs.repository.ts` — absent path means bank-stated, so every pre-existing program stays live on deploy (FR-032, FR-037, Principle X) — depends on T006, T052
- [X] T054 [US4] Enforce the activation gate in `backend/src/bank-programs/bank-programs.service.ts`: `POST /:programCode/toggle` with `active: true` and a non-empty map ⇒ 409 `PROGRAM_HAS_ESTIMATED_VALUES` with `meta.paths` listing ALL paths; `active: false` and every save stay unblocked (FR-033, FR-034, FR-039 — no new lifecycle states) — depends on T053
- [X] T055 [US4] Force deactivation in the SAME transaction when an update introduces an estimate on a live program: set `active = false`, return `data.deactivatedByEstimate: true`, and write the `bank_program.deactivated_by_estimate` `AuditEvent` with the editor id and the paths (FR-035, FR-038, Principle VII) — depends on T053
- [X] T056 [US4] Write a `bank_program.value_source_changed` `AuditEvent` on every marker add/remove with editor identity and timestamp (FR-038) — depends on T053
- [X] T057 [US4] Add `GET /api/admin/bank-programs/pending-bank-confirmation` to the controller + service: every program with a non-empty map, with `bankName`, `friendlyName`, `active`, `estimatedPaths`, `waitingSince` (the oldest still-standing marker's audit timestamp), `waitingSinceEstimated` and `waitingDays`, paginated in the standard envelope with OpenAPI decorators. A marker with no audit event (import, backfill, direct seed) reports the program's `updatedAt` with `waitingSinceEstimated: true` — never `null`, which the UI would render as "0 days waiting" (FR-036, contracts/admin-bank-programs.md § 4) — depends on T056
- [X] T058 [P] [US4] Unit-test the gate in `backend/test/unit/value-source-gate.spec.ts`: save with estimates succeeds, toggle-on refused naming EVERY path (not the first), live program + new estimate ⇒ deactivated + audited in one transaction, last marker removed ⇒ toggle-on allowed, unknown path rejected, `{}` program never appears on the list (FR-033 – FR-037, SC-004) — depends on T054, T055, T057
- [X] T059 [P] [US4] Create `admin/src/app/features/bank-programs/value-source/value-source-marker.component.ts` — a two-state stated/estimated control visible WITHOUT opening anything, with resting/hover/focus/active/disabled appearances from the token set (FR-032, FR-042, A18)
- [X] T060 [US4] Attach the marker beside every number the admin types on a bank program (income rows, band incomes, pricing, fees) and send the resulting sparse map with the save (FR-032) — depends on T059, T030
- [X] T061 [US4] Create `admin/src/app/features/bank-programs/pending-bank-confirmation/pending-bank-confirmation.page.ts` (the waiting list) with a lazy functional-guard route at `banks/programs/pending-bank-confirmation` in `admin/src/app/app.routes.ts` plus a nav entry, using the existing list/table/skeleton components and an empty state that carries the FR-037 "existing programs reviewed once" copy (FR-036, FR-045, Principle XXV, T001 design gate) — depends on T057
- [X] T062 [US4] Show the refusal in the UI naming EVERY estimated path when toggle-on is rejected, and state the reason when a save force-deactivates a live program (FR-033, FR-035, A22) — depends on T054, T055
- [X] T063 [P] [US4] Add the marker + waiting-list ar-EG/en-US strings to `admin/src/i18n/messages.ar-EG.xlf`, direction-neutral spacing, RTL verified (FR-025, FR-044, A19, A20)
- [X] T075 [US4] Produce the one-off review of programs that existed before this feature (FR-037): a script or documented query listing every program with `valueSources = {}` and at least one numeric field, written to `specs/011-surrogate-admin-panel/pre-existing-programs-review.md` for the team to walk once — they stay LIVE and never appear on the waiting list, which is exactly why they need a deliberate one-time pass rather than an empty-state sentence — depends on T053

**Checkpoint**: no program holding a team-estimated number can reach a customer, and the team has one
list of what to ask each bank for.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T064 Run the `impec` skill over the rule-builder section, the check panel, the marker and the waiting-list page after first implementation, and apply its findings (Principle XXIII, A17 — mandatory, not deferrable) — depends on T027, T049, T061
- [X] T065 Rewrite the legacy rule rows into the canonical shape in `backend/src/bank-programs/seeds/catalogs/abk-egypt-2026.ts` — the ONLY file holding them (`incomeTable` on `ABK-DOCTORS-PRACTICE`, `rankIncomeMap` on `ABK-PROFESSORS`, `gradeIncomeMap` on `ABK-MILITARY`); `backend/prisma/seed-bank-programs.ts` writes only `{ strategy: 'declared' }` and needs no rule change. Confirm the produced offers match `baseline-offers.json` (FR-015, SC-009) — depends on T009, T071
- [X] T066 [P] Regenerate the ARB output for mobile (`masrafy-app/lib/l10n/generated`) and confirm both new reasons render in ar + en with the existing disclaimer (FR-025) — depends on T004, T042
- [X] T067 [P] Verify `/api/docs` documents the two new endpoints and the extended program body, all money as strings (Principle XIV) — depends on T047, T057
- [X] T068 Accessibility + RTL sweep across all four new surfaces: every row action reachable by keyboard alone, **all five states (resting, hover, focus, active, disabled) visibly distinct on every new control** (FR-042), **any motion brief, directional and suppressed under `prefers-reduced-motion` on the editors and the waiting list, not only the check panel** (FR-048), no physical-direction CSS, no raw hex or raw pixel value outside `_tokens.scss`, no control whose only label is a placeholder (FR-040 – FR-048, SC-010, SC-011, A18, A19)
- [X] T069 Run the named specs then the FULL backend suite — `npm test -- income-rule-normalize income-rule-bands income-rule-validator surrogate-income-resolution surrogate-fact-resolution surrogate-binding-codes surrogate-applicant-matrix value-source-gate rule-check-simulator-parity` then `npm test` — with every offer in `baseline-offers.json` reproduced exactly, `income_proof` and `strategy: 'declared'` surrogate programs alike (quickstart.md § 5, SC-009)
- [X] T070 Walk quickstart.md end to end on a seeded local stack (§1 table → §2 check → §3 customer figure → §4 estimate block → §5 verification), confirming SC-001 – SC-011 and recording any deviation in the spec — depends on all prior phases

---

## Dependencies & Execution Order

> **T071 – T075 were added after the `/speckit.analyze` pass.** Their IDs sit outside phase order;
> each is placed in the phase it belongs to and carries explicit dependencies. T071 must run FIRST of
> all — before any engine task — because it captures the baseline SC-009 is measured against.

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T001 BLOCKS every admin component task (A17). T071 BLOCKS
  T014/T016/T017/T065/T069 — once the engine changes, the baseline can no longer be taken.
- **Foundational (Phase 2)**: needs T002 (codes), T005/T006 (columns) and T071 (baseline). BLOCKS all
  four stories. T072 (re-type the three seeds) closes the phase — without it US1 has no program whose
  rule section renders.
- **US1 (Phase 3)** and **US2 (Phase 4)**: both P1, both start after Phase 2, and can run in parallel —
  US1 is admin-side save + editors, US2 is questionnaire + mobile + provenance. They meet only at the
  canonical shape settled in T007/T009.
- **US3 (Phase 5)**: needs T027 (the section that hosts the panel) and T016/T019.
- **US4 (Phase 6)**: needs T006 (column) and T030 (the save path it rides on); otherwise independent of
  US2 and US3.
- **Polish (Phase 7)**: after the stories being shipped are complete.

### User Story Dependencies

- **US1 (P1)**: independent after Phase 2. Testable through the existing admin simulator.
- **US2 (P1)**: independent after Phase 2, but delivers no *configured* figure until US1 ships a table —
  its own independent test seeds one rule directly, so the two can be verified separately.
- **US3 (P2)**: hosted inside US1's section — sequence after US1.
- **US4 (P2)**: independent of US2 and US3; touches the same save path as US1 (T030 ↔ T060).

### Parallel Opportunities

- Phase 1: T002, T003, T004 together (three different surfaces); T071 runs on its own, first.
- Phase 2: T009, T010, T011 together; then T012, T013 together.
- Phase 3: T024, T025, T026 together; T023, T031, T032 together.
- Phase 4: T040 (mobile) alongside T037/T038 (backend); T044, T073 together after T036.
- Phase 6: T059 and T052 together; T058 and T063 together.
- Two developers: one takes US1 + US3 (admin/save axis), the other US2 + US4 (customer/provenance axis).

---

## Parallel Example: User Story 1

```bash
# Editors and types, three different files, no shared state:
Task: "Mirror the canonical rule shape in admin/src/app/features/bank-programs/bank-programs.types.ts"
Task: "Create admin/.../income-rule/income-key-table.component.ts"
Task: "Create admin/.../income-rule/income-bands-editor.component.ts"

# Then the verification set:
Task: "Unit-test save rules in backend/test/unit/income-rule-validator.spec.ts"
Task: "Add new admin strings to admin/src/i18n/messages.ar-EG.xlf"
Task: "Unit-test band-edge error mapping in admin/tests/income-bands-editor.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 Setup — the `promax` gate, the error vocabulary, and the SC-009 baseline (T071, first).
2. Phase 2 Foundational — one canonical rule shape, provenance-returning resolver, three seeds
   re-typed. **Blocks everything.**
3. Phase 3 US1 — the six TABLE methods become configurable.
4. **STOP and VALIDATE**: configure a grade table, verify through the existing admin simulator, confirm
   an empty/duplicate/negative/gapped table cannot be saved (SC-002).
5. Shippable: the defect where an admin can save a method with no configuration is gone, and four bank
   programs are configurable. No customer result changes yet.

### Incremental Delivery

1. Setup + Foundational → engine coherent, `income_proof` unmoved (SC-009).
2. + US1 → admin can configure every method (SC-001, SC-002, SC-006).
3. + US2 → customers get real figures or stated reasons (SC-003, SC-008). **The loop closes here — US1
   alone changes no customer's result.**
4. + US3 → mistyped numbers caught before saving (SC-005, SC-007).
5. + US4 → guessed numbers cannot reach a customer (SC-004).
6. Polish → `impec`, RTL/keyboard, full suite, quickstart walkthrough (SC-010, SC-011).

### Notes

- [P] = different files, no dependency on an incomplete task.
- Every money value crosses the wire as a Decimal STRING and is compared with `Decimal` methods only
  (Principle I, A3).
- No formula is rewritten: T014/T016 change WHICH income enters the maths, never the maths (FR-004).
  The declared baseline stays RAW — the `commercialBankIncomePercent` haircut is not inherited into
  the quote path (research R4).
- A rule on a program whose type hides it is IGNORED and REPORTED, never deleted (T021).
- Nothing is added to `Question` / `QuestionOption`, and no `category` column is reintroduced (A33).
- Commit per task or per logical group; stop at any checkpoint to validate a story on its own.
