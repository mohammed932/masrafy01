# Implementation Plan: Loan Engine rules tab

**Branch**: `013-loan-engine-rules` (`SPECIFY_FEATURE`; work on `hotfixes/new-calculations`) | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-loan-engine-rules/spec.md`

## Summary

The operator wants one place, a **Loan Engine** tab, to state how each question's answer moves a bank program's quote. That covers number criteria (range, less than, at most, at least, more than, equals), text criteria, a figure per choice, and conditions that make an applicant eligible or not.

The engine already has almost every primitive: fact grids, half-open number bands, per-option keys, `answered` for text, and refusing gates with translated reasons (research §"What exists"). This feature:

1. **Widens the band key** with `fromExclusive` / `toInclusive`, so the six number operators compile losslessly. Existing rows move no money.
2. **Adds `bank_program.conditions`.** These are per-program eligibility conditions that any program can carry, payslip ones included. A failure is the existing `PRODUCT_RULE_GATE_FAILED` + `gateReasonCode`: shown as refused, never hidden (Principle V). A question a condition reads becomes required (012 C3).
3. **Adds a question-centric admin API and screen** that write into exactly the columns the engine reads, through the existing validators. The program form and the Loan Engine stay two views of one row.
4. **Extends the admin simulate endpoint** with in-memory overrides, so an operator can try an answer before saving.

Two product decisions were made on 2026-10-04: rules are **per bank program** (Principle II), and a failed condition **shows the program as refused**. Neither needs a constitution amendment.

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) on the backend; Angular 18 + TypeScript 5.4 on the admin. No Flutter change.
**Primary Dependencies**: NestJS 10, Prisma 5, `class-validator`, `@nestjs/swagger`, `decimal.js` · ng-zorro-antd, `@angular/localize`
**Storage**: PostgreSQL 16. One Prisma migration (`bank_program_conditions`: one nullable JSONB column). Everything else is a JSON-shape widening.
**Testing**: Repo policy (2026-09-06): no new unit tests. Existing suites stay green; any that become wrong are updated. Proof comes from the real DB, seeds, browser and `check:*` (quickstart.md).
**Target Platform**: Admin web dashboard plus backend API. The customer API and mobile app are unchanged.
**Project Type**: Web service + admin web app (monorepo: `backend/`, `admin/`).
**Performance Goals**: The detail read covers ≤ 80 questions × ~71 programs. It is one DB read of active programs (as `questionUsageInputs` does today), with no N+1. A condition adds one O(criteria) predicate pass per program to `quoteProgram`.
**Constraints**:
- **Money:** Decimal only (I).
- **Banks Are Data:** no per-bank branches (II).
- **Programs are never hidden:** refused, not filtered (V).
- **No salary / age / DBR / amount gates:** A33.
- **Free text is never compared:** VI.
- **One engine path** for preview, apply and simulate: A33 / FR-010.
**Scale/Scope**: 71 active programs, 80 questions, 7 effects plus conditions. One new admin route, five endpoints.

## Constitution Check

*GATE: checked before Phase 0, re-checked after Phase 1. Result: **PASS, no violations.***

| Principle / AP | How this design complies |
|---|---|
| I Money is Decimal | Every value and band edge is a Decimal string. R1 rejects ε-compilation precisely because it would invent a figure. |
| II Banks Are Data | Rules are per program, with no platform-wide rule and no `programCode` branch. Conditions are data on the row. |
| III Typed Errors | One new admin-only code, `LOAN_ENGINE_RULE_INVALID` (backend + both admin JSONs, no ARB: `SURROGATE_FACT_KEY_TAKEN` precedent). Reused codes: `CONFLICT_STALE_DATA`, `SURROGATE_FACT_SHAPE_MISMATCH`, `PRODUCT_RULE_GATE_FAILED`. |
| IV Arabic-first | `@@lengine.*` ids with ar-EG targets, logical CSS only, RTL verified. |
| V Matching engine | Pure predicate in `fact-grid.ts`, and conditions evaluated inside `quoteProgram`. **Refused, never dropped.** Order is untouched (`rankIndex`). Questions stay pure content: nothing is added to `Question` or `QuestionOption`. The question scope stays derived in `question-scope.ts` via `mustAnswerQuestionCodes`. |
| VI PII | Text answers are matched only as `answered`, so no free text is read by a rule or written to the audit log. |
| IX / X / XII | A new `bank-programs/loan-engine/` sub-module: controller + service + repository. The service never touches Prisma. DTOs use class-validator, and Prisma types stay in the repository. |
| XI Migrate only | One named migration, nullable, no backfill. |
| XIII / XIV / XV | Admin JWT, roles as in the contract, `/api/admin/` envelope, OpenAPI decorators, existing throttler. |
| XVII–XXVI Angular | Standalone, signals, `@if`/`@for track`, `inject()`, typed reactive forms, ng-zorro only, `NzDrawerService` side sheet (A34), `appMoneyInput` (A27), tokens only, lazy route plus functional guard, `HttpClient` only. |
| XXIII UI pipeline | `ui-ux-pro-max` before the design, `impec` after the first implementation. |
| XXIX / A25 | `FactReaderProgramRow.conditions` is REQUIRED, so every reader (scope, usage, delete guard, quote) is updated in the same change. 012's question panel tiles are re-pointed at the new screen in the same change. |
| A33 | No eligibility filter returns: conditions refuse with a reason. Engine inputs (money, debts, employment, age, I-Score, platform car facts) cannot be a condition criterion. Preview and apply use the same call. |

**Re-check after Phase 1:** data-model.md and contracts/ add only the column, a JSON widening and admin endpoints. Still PASS.

## Project Structure

### Documentation (this feature)

```text
specs/013-loan-engine-rules/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R8 decisions
├── data-model.md        # band-key widening, bank_program.conditions, read model
├── quickstart.md        # verification runbook (repo testing policy)
├── contracts/
│   └── loan-engine-admin-api.md
└── tasks.md             # /speckit.tasks — not created here
```

### Source Code

```text
backend/
├── prisma/
│   ├── schema.prisma                                   # + bank_program.conditions Json?
│   └── migrations/<ts>_bank_program_conditions/
├── scripts/
│   ├── check-question-scope.ts                         # OPTIONAL_REFUSAL covers conditions
│   └── quote-preview-apply-parity.ts                   # + PARITY_OUT override
└── src/
    ├── matching/pipeline/
    │   ├── fact-grid.ts                                # FactGridKey widening + keyMatchesAnswer + validateFactGrid
    │   ├── max-loan-by-fact.ts                         # same predicate for the cap table
    │   ├── product-needed-facts.ts                     # band shapes accept the new edges
    │   ├── program-conditions.ts                       # NEW pure evaluator (conditions → pass | gate_failed)
    │   ├── fact-readers.ts                             # FactReaderProgramRow.conditions; surface 'condition'
    │   └── quote.ts                                    # evaluate conditions → PRODUCT_RULE_GATE_FAILED
    ├── bank-programs/loan-engine/                      # NEW sub-module
    │   ├── loan-engine.controller.ts                   # /api/admin/loan-engine/*
    │   ├── loan-engine.service.ts                      # criterion ⇄ FactGridKey, validation, audit
    │   ├── loan-engine.repository.ts                   # reads + the conditions write (version compare-and-swap)
    │   └── dto/loan-engine.dto.ts
    ├── matching-preview/                               # simulate: programOverrides (in-memory)
    ├── platform-enumerations/postgres-platform-enumerations.repository.ts  # SELECT conditions in every reader query
    └── common/errors/{error-codes.ts,domain.exceptions.ts}                # LOAN_ENGINE_RULE_INVALID

admin/src/
├── app/app.routes.ts                                   # lazy /loan-engine + sidebar entry
├── app/features/loan-engine/                           # NEW
│   ├── loan-engine.page.ts                             # question list + effects × programs matrix
│   ├── effect-rows.sheet.ts                            # NzDrawer row editor (criterion builder per question type)
│   ├── conditions.sheet.ts                             # per-program conditions (anyOf builder, reason picker)
│   ├── try-answer.component.ts                         # simulate with overrides
│   └── loan-engine.api.service.ts
├── app/features/questionnaire/question-calculation.component.ts  # tiles → /loan-engine?question=&effect=
└── i18n/{messages.ar-EG.xlf,error-codes.ar-EG.json,error-codes.en-US.json}
```

**Structure Decision**: the existing two-project web layout. The backend feature lives as a sub-module of `bank-programs/`, because it writes `bank_program` rows. The admin gets its own `features/loan-engine/` folder, because it is a new top-level screen.

## Delivery order (each its own PR, as in 012)

| Step | Content | Moves money? | Proof |
|---|---|---|---|
| **P** | Capture baselines (quickstart §2), with `PARITY_OUT` added to the parity script | no | baseline files |
| **1** | R1 band widening, plus the `conditions` column (migration) and evaluator, plus `FactReaderProgramRow.conditions` everywhere, plus the C3 extension | **no** (no row uses either yet) | quickstart §3: byte-identical, seeds 0/0 |
| **2** | Loan Engine API (R5/R6), plus simulate overrides (R7), plus the error code | only when an operator writes | quickstart §4–§5 over HTTP, restore to baseline |
| **3** | Admin screen (R8), plus 012 tiles re-pointed; `ui-ux-pro-max` → build → `impec` | no | quickstart §6, locale builds |
| **Docs** | CHANGELOG entries (MINOR per step), CLAUDE.md index lines, and an optional constitution PATCH naming `program-conditions.ts` under Principle V's refusal wording (the operator's call) | — | — |

## Risks
- **Delete guard drift:** `factReaders` must count `conditions`. Otherwise a fact read only by a condition can be deleted, and the condition silently fails for everyone. This is the same two-walk risk as 012 Clarification Q3, which is still open; this feature makes resolving it more valuable.
- **Multi-select semantics:** "first row wins" can surprise an operator who expects effects to add up. Mitigation: visible row order and the one-line rule in the editor. Summing is a follow-up.
- **A condition on a widely served question** makes it required under every name where that program is quoted. The save response returns the names affected, and the sheet shows them before confirm.
- **Inherited product plans** are read-only here. An operator wanting a per-program override must go to the program form, which is unchanged.

## Complexity Tracking

No constitution violations, so nothing to justify.
