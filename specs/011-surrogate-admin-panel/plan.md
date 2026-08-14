# Implementation Plan: Income-Surrogate Rule Builder (Admin)

**Branch**: `011-surrogate-admin-panel` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-surrogate-admin-panel/spec.md`

## Summary

Three halves of one loop are joined. The surrogate income engine already runs
(`backend/src/matching/pipeline/income-resolver.ts`, ten strategies); the admin cannot type the
six TABLE methods (rank, grade, years-in-job, years-in-practice, certificate value, total deposits) because the
form falls through to a placeholder; and no questionnaire question ever asks the fact those methods
read, so every table method resolves to nothing for every customer alive.

Technical approach:

1. **One self-describing rule object** (FR-014). `BankProgram.incomeAssumption` JSONB gains a
   canonical `{ strategy, keyTable | bands | scalar, dbrCapPercentOverride?, requiredDocuments?,
   combinationRule }` shape, written on every save and produced from legacy rows by a pure
   read-time `normalizeIncomeAssumption()` (the `normalizeWeights` precedent — no migration, no
   behaviour change for the three seeded legacy programs).
2. **Bands are edges-only, half-open `[from, to)`**, exactly the v14.0.0 numeric-scoring-band
   idiom, so gaps and overlaps are unrepresentable rather than merely validated. The admin editor
   is a new `app-income-bands-editor` modelled on the shipped `app-score-bands-editor`; key tables
   finally wire the built-but-unused `app-tier-key-picker` to the `professor_rank` /
   `military_grade` registry.
3. **Surrogate facts bind by CODE CONSTANT**, not by a column — `surrogate-fact-bindings.ts` beside
   the existing `money-field-bindings.ts`. A33 forbids profile-mapping fields on
   `Question`/`QuestionOption`; the money bindings already solved this exact problem the same way.
   Publish emits `SURROGATE_FACT_BINDING_MISSING` warnings (sibling of
   `MONEY_FIELD_BINDING_MISSING`), and choice facts are validated to carry option codes that ARE
   the registry keys the admin picked from (FR-017).
4. **Two engine defects fixed, no formula touched.** `quote.ts` step 3 short-circuits on any
   declared salary > 0, so on an `income_surrogate` program the stored `combinationRule` has never
   run (the questionnaire binds `monthly_income` as required, so declared is always > 0). And
   `resolveAssumedIncome` returns a bare `Decimal`, losing which side won. Both are corrected for
   `income_surrogate` programs only; `income_proof` behaviour is byte-identical (SC-009). The
   resolver's `applyCompanyTypeAdjustment` haircut is deliberately NOT inherited into the quote path
   — `income_surrogate` covers every business-category program plus the doctor / professional /
   pharmacy archetypes (all `strategy: 'declared'`), so inheriting it would move their live figures
   (research R4).

8. **Three mis-typed seeds are re-typed.** `ABK-MILITARY`, `ABK-PROFESSORS` and
   `ABK-DOCTORS-PRACTICE` carry surrogate tables while inheriting `programType: 'income_proof'` from
   `catalogs/base.ts:18`. Without re-typing, the type-gated rule section would hide the only rows
   worth editing. And because a mis-typed program must not lose its data, non-matching rule
   configuration is **ignored and reported, never stripped** (FR-001 edge case).
5. **Provenance is frozen on the offer** (`bank_offer.incomeOrigin`, `incomeSurrogateStrategy`) —
   the `approvalUsedDefault` precedent: an immutable offer must not have its meaning rewritten by
   a later config change (Principle I).
6. **Value-source markers** are a sparse `BankProgram.valueSources` JSONB map of dot-path →
   `team_estimated` (absent = bank-stated, so every pre-existing program is stated by construction,
   FR-037). Activation reads it; a marker set on a live program deactivates in the same
   transaction with an audit event.
7. **The rule check panel overlays and re-quotes.** It builds the saved program's snapshot with
   the on-screen `incomeAssumption` overlaid, synthesises an applicant, and calls the same
   `quoteProgram` the simulator calls — agreement with the simulator (FR-030) is structural, not
   a duplicated formula.

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) ·
Angular 18 + TypeScript 5.4 · Flutter/Dart 3
**Primary Dependencies**: NestJS 10, Prisma 5, `class-validator`, `@nestjs/swagger`, `decimal.js`
(via `@prisma/client/runtime/library`) · ng-zorro-antd (`nz-*`) + `@angular/localize` on admin ·
flutter_bloc + Freezed + `MasrafySelectField` on mobile
**Storage**: PostgreSQL 16 (Prisma migrations only). Two migrations: `bank_program_value_sources`
(one JSONB column, defaulted `{}`), `bank_offer_income_origin` (two nullable varchar columns). The
rule itself needs NO migration — it lives in the existing `bank_program.incomeAssumption` JSONB.
**Testing**: Vitest/Jest unit + integration under `backend/test/`; the pure pipeline modules
(`income-resolver`, new `income-rule-normalize`, new `surrogate-fact-bindings`) are unit-tested
directly, matching `test/unit/numeric-band-scoring.spec.ts` and `asked-weight-denominator.spec.ts`
**Target Platform**: Linux server (backend), evergreen browsers (admin dashboard), iOS/Android
(mobile questionnaire)
**Project Type**: Web service + Angular admin dashboard + Flutter mobile app (three surfaces, one
constitution)
**Performance Goals**: No new per-quote cost — the surrogate lookup is an in-memory map/band scan
already inside the existing quote loop. The rule-check endpoint is one program, one quote (<50 ms
server time). Activation's estimate scan is a single JSONB read on a row already loaded.
**Constraints**: `income_proof` programs must produce byte-identical offers before and after
(SC-009). Every money value is `Decimal`, never float (Principle I). Nothing may be added to
`Question`/`QuestionOption` (A33). Result ordering is untouched (FR-024). Eligibility gating stays
out of matching (FR-022 / A33).
**Scale/Scope**: ~20 bank programs. Three carry a real surrogate table and are the editing targets
(`ABK-MILITARY`, `ABK-PROFESSORS`, `ABK-DOCTORS-PRACTICE` — all three re-typed from the
`income_proof` default). A much larger set is ALREADY typed `income_surrogate` with
`strategy: 'declared'` — every business-category program plus the doctor / professional / pharmacy
archetypes — which is why the engine change is scoped so carefully (research R4). 10–15 rows per
rank/grade table; one admin form section, one new admin page (waiting list), 3 new questionnaire
questions (a 4th fact reuses `credit_card_total_limit`), 1 mobile mapper touched.

## Constitution Check

*GATE: evaluated before Phase 0, re-evaluated after Phase 1 design.*

| Principle / Anti-Pattern | Verdict | How this design complies |
|---|---|---|
| **I — Money is Decimal** | PASS | Band edges and incomes are `Decimal` end to end; the admin sends strings, the DTO keeps strings, the resolver constructs `Decimal`. Band comparison uses `Decimal.gte/lt`, never `Number`. `BankOffer` stays immutable — provenance is written at creation, never updated. |
| **II — Banks Are Data** | PASS | No `if (programId === …)`. The rule is per-program DATA in `incomeAssumption`; the resolver switches on `strategy`, which is a generic method token, not a bank identity. |
| **III — Typed Errors** | PASS | New codes shipped in the SAME PR across `backend/src/common/errors/error-codes.ts`, `admin/src/i18n/error-codes.{ar-EG,en-US}.json`, and the Flutter ARB (for the two customer-visible unavailable reasons). No English strings to clients. |
| **IV — Arabic-First** | PASS | Every new admin string carries an `i18n=@@…` id with an ar-EG translation; the bands/key table use logical CSS (`margin-inline-*`, `padding-inline-*`) only. Tested LTR + RTL. |
| **V — Matching Engine Is IP** | PASS | The probability formula, the asked-weight denominator, the tiers and `answerScoreFor` are untouched. This feature changes only which INCOME the quote runs on, and the change is confined to `income_surrogate` programs. Weights, questions and bands stay admin DATA. The check panel's `qualifies` is derived from the quote's own installment figures only — no eligibility rule is consulted, so gating does not re-enter through the panel (FR-027, A33). |
| **VI — PII Protection** | PASS | Military grade and academic rank are already pass-through categorical in `pii-masker.ts`; no new PII field is logged. The rule-check endpoint takes a synthetic sample applicant, never a real one, and persists nothing. |
| **VII — Observability** | PASS | Marker changes and estimate-forced deactivations emit discrete `AuditEvent`s with editor id; correlation id flows through the existing filter. |
| **VIII — Brand** | PASS | Tokens only; the section reuses `section.styles.scss`. |
| **IX — Feature Modules** | PASS | Backend work lands in `bank-programs/`, `matching/`, `questionnaire/`, `applications/`. `common/` imports nothing from features. |
| **X — Repository Pattern** | PASS | `valueSources` and the offer provenance columns are read/written through `BankProgramRepository` / `ApplicationRepository`; services touch no Prisma client. |
| **XI — Prisma Migrate Only** | PASS | Two named migrations, both additive (`bank_program_value_sources`, `bank_offer_income_origin`). No `db push`. No index needed on either — both are read with the row. |
| **XII — DTO vs Entity** | PASS | `IncomeAssumptionConfigDto` gains nested `class-validator` DTOs; deep cross-field rules (bands ordered/gapless, key uniqueness, income > 0) live in a service-layer validator beside `dbr-bands.validator.ts`. |
| **XIII — Dual Auth** | PASS | Admin endpoints behind the existing admin JWT guard; no customer-auth change. |
| **XIV — API Contract** | PASS | `{ success, data }` envelope, `/api/admin/…` prefix, OpenAPI decorators on every new endpoint. |
| **XV — Rate Limiting** | PASS | Inherits the global throttler; the rule-check endpoint is admin-only and stateless. |
| **XVII–XXII, XXIV–XXVI (Angular)** | PASS | Standalone components, signals, `@if`/`@for … track`, `inject()`, typed reactive forms (`FormArray` of typed row groups), `HttpClient` via the existing api service, tokens only, no `any`. |
| **XXIII — UI UX Skill Pipeline** | **ACTION REQUIRED** | `promax` MUST run before the rule-builder section and the waiting-list page are designed; `impec` MUST run after first implementation. Recorded as gate tasks in `tasks.md`, not deferrable (A17). |
| **XXVIII–XXXVI (Flutter)** | PASS | Mobile change is confined to the personal-category apply mapper plus the shared `apply_mapping.dart` helper — no new screen, no new widget, so the page-library and one-screen-one-file rules are not engaged. Choice facts render through the existing `MasrafySelectField` sheet (A36 satisfied by reuse). |
| **A27 — MoneyInputDirective** | PASS | Every income input in the table and every band edge in EGP uses `appMoneyInput`. |
| **A31 — no `age` on customer bodies** | PASS (recorded) | The rule-check DTO is ADMIN-side and carries an explicit sample age, exactly as `SimulateMatchesDto` does. A31's text names only the simulator DTO, so the second admin dry-run surface is recorded in Complexity Tracking §5 rather than assumed covered. |
| **A33 — no mapping fields on Question** | PASS | Surrogate facts bind via the code constant `surrogate-fact-bindings.ts`. Nothing is added to `Question`/`QuestionOption`, no `category` field is reintroduced, and the per-question category assignment continues to live only in `question_loan_category`. Renaming a bound question code stays a code change — the same accepted residual limit feature 010 recorded. |
| **A1 / A3 / A5 / A8 / A15 / A18 / A19 / A20** | PASS | No bank branching, no floats, no Prisma in services, no Prisma types through controllers, no `any`, no raw hex, no physical-direction CSS, no hardcoded user strings. |

**Gate result**: PASS with one binding action (Principle XXIII skill pipeline). No violations
requiring justification — Complexity Tracking is empty.

*Post-Phase-1 re-evaluation*: unchanged. The design added no new project, no new state machine
(FR-039 honoured — activation stays the single `active` boolean), and no second surrogate flag
(FR-002 — `incomeSurrogateActive` remains a `computed()` off `programType`).

## Project Structure

### Documentation (this feature)

```text
specs/011-surrogate-admin-panel/
├── plan.md              # This file
├── research.md          # Phase 0 — 11 decisions, each with rejected alternatives
├── data-model.md        # Phase 1 — rule shape, markers, offer provenance, bindings
├── quickstart.md        # Phase 1 — configure a grade table end to end in 10 minutes
├── contracts/
│   ├── admin-bank-programs.md      # rule save, rule check, activation gate, waiting list
│   ├── questionnaire-bindings.md   # publish warnings + customer questionnaire payload
│   └── matching-provenance.md      # offer provenance + no-figure reasons (ar/en)
├── checklists/
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                       # +bank_program.valueSources, +bank_offer.incomeOrigin/incomeSurrogateStrategy
│   ├── migrations/                         # bank_program_value_sources, bank_offer_income_origin
│   └── seed-questionnaire.ts               # +3 surrogate-fact questions (personal category)
├── src/bank-programs/seeds/catalogs/
│   └── abk-egypt-2026.ts                   # the ONLY home of the legacy rule rows (incomeTable,
│                                           # rankIncomeMap, gradeIncomeMap) — rewritten canonical
│                                           # AND re-typed income_surrogate (they inherit
│                                           # income_proof from catalogs/base.ts:18)
├── src/
│   ├── matching/
│   │   ├── types.ts                        # IncomeAssumptionConfig → canonical + legacy union; +IncomeResolution
│   │   └── pipeline/
│   │       ├── income-resolver.ts          # returns {incomeEGP, origin, strategy, reason} — arithmetic untouched
│   │       ├── income-rule-normalize.ts    # NEW — pure legacy→canonical upgrade-on-read
│   │       ├── income-rule-bands.ts        # NEW — pure half-open [from,to) band lookup (Decimal)
│   │       ├── surrogate-fact-bindings.ts  # NEW — fact → question code + type + registry type
│   │       ├── quote.ts                    # step 3 honours combinationRule on income_surrogate; DBR override
│   │       └── dbr.ts                      # resolveDbrCap accepts the per-rule override
│   ├── bank-programs/
│   │   ├── dto/sub-configs/income-assumption-config.dto.ts   # nested row DTOs
│   │   ├── dto/{create,update}-bank-program.dto.ts           # +valueSources
│   │   ├── dto/income-rule-check.dto.ts     # NEW — admin dry-run body
│   │   ├── validation/income-rule.validator.ts               # NEW — rows, bands, keys, income > 0
│   │   ├── validation/value-sources.validator.ts             # NEW — path allow-list + estimate scan
│   │   ├── bank-programs.service.ts         # activation gate, forced deactivation, rule check
│   │   ├── bank-programs.repository.ts      # valueSources read/write
│   │   └── bank-programs.controller.ts      # POST …/income-rule/check, GET …/pending-bank-confirmation
│   ├── questionnaire/questionnaire.service.ts                # surrogate binding publish warnings
│   ├── applications/applications.service.ts                  # answers → employment/assets surrogate facts
│   ├── matching-preview/matching-preview.service.ts          # same mapping (preview/apply parity)
│   └── common/errors/error-codes.ts                          # 6 new codes
└── test/unit/                               # income-rule-bands, income-rule-normalize,
                                             # surrogate-fact-resolution, value-source-gate,
                                             # rule-check-simulator-parity

admin/
├── src/app/features/bank-programs/
│   ├── form/sections/income-assumption-section.component.ts  # placeholder → real editors
│   ├── form/sections/income-rule/
│   │   ├── income-key-table.component.ts    # NEW — registry key + income rows
│   │   ├── income-bands-editor.component.ts # NEW — edges-only bands (score-bands-editor sibling)
│   │   └── income-rule-check.component.ts   # NEW — in-place sample-applicant panel
│   ├── value-source/value-source-marker.component.ts         # NEW — stated / estimated toggle
│   ├── pending-bank-confirmation/pending-bank-confirmation.page.ts  # NEW — the waiting list
│   ├── bank-programs.types.ts / .api.service.ts              # canonical shape + 2 endpoints
│   └── tier-key-picker/tier-key-picker.component.ts          # finally wired (no change)
└── src/i18n/                                # messages.{ar-EG,en-US}.xlf, error-codes.*.json

masrafy-app/
└── lib/features/questionnaire/presentation/
    ├── mappers/apply_mapping.dart           # +SurrogateFacts.fromAnswers
    └── pages/personal/personal_apply_mapper.dart   # empty AssetsPayload → real facts
```

**Structure Decision**: The existing three-surface layout is used unchanged. No new module, no new
package: the rule is data on a model that already exists, the editor is a section in a form that
already exists, and the customer question is a row in a pool that already exists. The only genuinely
new admin route is the waiting list (`/banks/programs/pending-bank-confirmation`), which is a list
page under the feature folder that owns bank programs.

## Complexity Tracking

No constitutional violation requires justification — the table is intentionally empty.

Five residual limits are recorded rather than solved.

1. **Renaming a bound question code is a CODE change**, because the binding is a code constant (A33
   forbids storing it on `Question`) — the precedent set by feature 010. Publish-time warnings name
   the broken binding so the failure is loud, not silent.
2. **A33 keeps codes generated from labels** (`slug.util.ts`), so the three new questions' English
   labels are load-bearing: they are named such that the slug IS the binding constant, and a test
   asserts the equality rather than trusting it.
3. **One branching gate serves two facts.** `enabledWhen` holds a single `optionCode` and
   `EMPLOYMENT_OPTIONS` has no soldier/professor distinction, so a government employee is asked both
   `military_grade` and `academic_rank` and skips the one that does not apply. Splitting the
   employment options would ripple into every category's scoring points and the employment-type
   mapper for a cosmetic gain (research R11).
4. **Six of the ten facts stay configurable but unasked** (certificate value, total deposits, car
   installment, car loan amount, bank-statement balance). FR-016 and SC-003 were narrowed to say so;
   the rule builder configures and checks them fully, and an unasked fact is a stated reason, never a
   zero.
5. **A31's wording names one admin DTO** ("the admin simulator keeps an explicit sample `age` on its
   own DTO"). This feature adds a SECOND admin-side DTO carrying a sample age — the rule-check body.
   The intent A31 protects (no `age` on any CUSTOMER request body) is fully honoured; the anti-pattern
   text simply predates a second admin dry-run surface. Recorded here rather than diluted, and worth
   one sentence in a future constitution touch-up.
