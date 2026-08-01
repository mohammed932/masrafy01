# Implementation Plan: Simple Program Setup, Banded DBR & Loan Calculator

**Branch**: `010-simple-programs-dbr-calculator` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-simple-programs-dbr-calculator/spec.md`

## Summary

Six slices over the existing bank-program + matching stack, all additive except one deliberate prune:

1. **Question types end to end** (P1) — the four declared types become real: admin type picker + per-type validation rules, typed answer values (multi-pick / text / number), the app's existing shared questionnaire view gains the three missing controls, and the four money figures (amount, months, salary, current payments) come from number answers instead of bucket-to-guess maps in `*_apply_mapper.dart`. Scoring formula untouched: only single-choice questions are assignable to a program's weight set.
2. **Figures in results** (P1) — `MatchingPreviewService` stops returning `monthlyInstallmentEGP: null` and runs the same pure pipeline the apply path runs (cascade → fees → PMT → DBR), so preview and offer agree by construction. Fees are financed into the principal; each quote exposes cash-received / monthly-payment / total-fees.
3. **Program setup simplification** (P1) — `program_name` catalog entries gain per-category default rules; `Bank` gains an optional lending policy; a prefill endpoint merges policy → catalog → admin and the merged values are **copied on save**; the admin form splits into Essentials / Advanced with a duplicate action.
4. **Destructive prune** (P1, gated) — the eligibility and performance-history settings matching no longer reads are removed from DTOs, the form, `EligibilityConfig`, and stored JSONB (FR-015a). Requires backup + explicit go-ahead.
5. **Banded DBR** (P2) — `dbrCapPercent` gains an optional sibling `dbrBands` (ascending, inclusive upper bounds, open-ended terminator), resolved from recognised income by a new pure resolver. One shared band editor reused at bank / catalog / program level; the engine reads the program only.
6. **Loan calculator + numeric simulator** (P2/P3) — one server-side quote endpoint reusing the same pure functions, in cost mode and affordability mode, program-scoped or generic; the admin simulator returns the same figures plus the binding constraint.

Nothing in the approval-probability formula changes. Eligibility gating stays out of matching — program limits and DBR shape the amount, never whether a program is listed.

## Technical Context

**Language/Version**: Node.js 22 LTS + TypeScript 5.6 (`strict`, `noUncheckedIndexedAccess`) · Angular 18 + TypeScript 5.4 · Flutter/Dart 3 (mobile)
**Primary Dependencies**: NestJS 10, Prisma 5, `class-validator`, `@nestjs/swagger`, `decimal.js` (via `@prisma/client/runtime/library`) · ng-zorro-antd (`nz-*`) + `@angular/localize` on admin · flutter_bloc + Freezed + `auto_route` + `MasrafySelectField` on mobile
**Storage**: PostgreSQL 16 (Prisma migrations only) · Redis 7 (rate limit only; not used by this feature)
**Testing**: Jest (backend unit/integration) · Vitest + Playwright (admin) · `package:test` / widget tests (mobile). Constitution Principles XVI / XXVII are placeholders, so tests are targeted rather than coverage-gated: pure money math, band boundaries, and preview↔offer parity are the mandatory ones.
**Target Platform**: Linux container backend · admin SPA · iOS/Android app
**Project Type**: Web service + admin SPA + mobile app (three surfaces, one contract)
**Performance Goals**: preview/quote p95 < 500 ms server-side with ~150 active programs (all math is in-memory pure Decimal after one indexed query); calculator feels immediate via 300 ms debounce on the authoritative server figure
**Constraints**: money is `Decimal` end to end (Principle I) — no client-side float arithmetic for displayed figures, so the app never computes its own installment; every new failure is a typed error code shipped in the same PR across backend + admin ar/en JSON + Flutter ARB (Principle III); Arabic-first with logical CSS on admin (Principle IV)
**Scale/Scope**: ~150 bank programs · 4 loan categories · ~20 questions per published questionnaire · 3 surfaces touched · 1 destructive migration

## Constitution Check

*GATE: evaluated pre-Phase 0, re-evaluated post-Phase 1.*

| Principle | Requirement | Plan compliance |
|---|---|---|
| **I — Money is Decimal** | `Decimal` only; no floats | All new math reuses `pmt.ts` / `dbr.ts` / `fees.ts` Decimal helpers. Number answers arrive as decimal **strings** (`@IsDecimalString`) and are stored in `application_answer.numericValue` (`Decimal(18,2)`). Mobile sends strings; Dart never multiplies money. ✅ |
| **II — Banks are data** | no `if (programId === …)` | DBR bands, catalog defaults and bank policy are JSONB data resolved generically. ✅ |
| **III — Typed errors** | code + same-PR i18n in 3 files | New codes listed in [contracts/error-codes.md](./contracts/error-codes.md); each lands with `error-codes.{ar-EG,en-US}.json` and the Flutter ARB in the same PR. ✅ |
| **IV — Arabic-first** | localize + logical CSS | Number/text controls, band editor, calculator: all strings via `@angular/localize` / ARB; `margin-inline-*` only. ✅ |
| **V — Engine is IP** | pure module; formula in code; A33 | `probability = Σ(questionWeight÷100 × pickedAnswerScore÷100)` unchanged. Number bounds (`min`/`max`/`step`/`unit`) are **content**, not scoring or eligibility fields, so A33 holds. The money-field binding is a **code constant**, never a `Question` column — a stored binding would revive the `Question.profileField` that v6.0.0 deleted (caught in the post-design re-check and corrected). Only single-choice questions stay assignable to a weight set — multi-choice/text/number are not scoreable, because "the picked answer score" is undefined for them and inventing an aggregate would be a new formula (A33). New DBR-band resolver lives in `src/matching/pipeline/`, pure, no DB imports. Eligibility gates are **deleted**, never reintroduced. ✅ |
| **VI — PII** | no PII in logs | Text answers are free text and may contain PII: they are excluded from logs and from the calc trace, and masked by the existing `pii-masker.ts` path on admin reads. ✅ |
| **VII — Observability** | correlation id, business events | Quote and simulate emit existing structured business events; the calc trace records band/cap/binding constraint. ✅ |
| **IX — Feature modules** | domain folders; `common/` imports nothing from features | New code lands in `bank-programs/`, `banks/`, `questionnaire/`, `matching/`, plus a new `calculator/` module. ✅ |
| **X — Repository pattern** | services never touch Prisma | New reads/writes go through `bank-programs.repository.ts`, `banks.repository.ts`, `questionnaire.repository.ts`, `platform-enumerations.repository.ts`, plus a new `calculator` read path that reuses the program repository. ✅ |
| **XI — Prisma migrate only** | named migrations, indexed | Three migrations: `add_bank_policy_and_catalog_defaults`, `question_types_typed_answers`, `prune_unused_eligibility_settings` (destructive). No `db push`. ✅ |
| **XII — DTO vs entity** | `class-validator`, whitelist | All new payloads are DTOs; Prisma types stay in repositories. ✅ |
| **XIV — API contract** | envelope + versioned | New endpoints under `/api/v1/*` (customer) and `/api/admin/*`, `{ success, data }` envelope, documented in OpenAPI. ✅ |
| **XVII–XXVI — Angular** | standalone, signals, new control flow, `inject()`, typed forms, tokens, `HttpClient` | Band editor, Essentials/Advanced form, catalog defaults editor and simulator follow these; money inputs use `appMoneyInput` (A27). ✅ |
| **XXIII — UI pipeline** | `promax` before, `impec` after | Mandatory for the three new admin surfaces (band editor, catalog defaults, simulator) and tracked in tasks. ⚠️ must not be skipped (A17) |
| **XXX–XXXVI — Flutter** | 3 layers, cubit, one-screen-one-file, shared widgets, shimmer, ≤2 params → DTO | Calculator screen is one `*_page.dart` + its cubit; number/text controls become shared `core/widgets/input_controls/` widgets; selection stays the tap-to-select sheet (A36) — no dropdowns; shimmer on the calculator's first load. ✅ |
| **XXXVII — Profile completeness** | untouched | No change to the gate. ✅ |

**Post-Phase-1 re-check**: passed. One violation was found and fixed during the re-check — a `Question.moneyFieldBinding` column in the first data-model draft, which would have reintroduced the profile-mapping field A33 bans; it is now a code constant (`money-field-bindings.ts`). No other gate changed status between the pre-Phase-0 and post-design evaluations.

**Deviations to record**

1. **UI library drift (pre-existing)** — the constitution names Angular Material 18, but the admin app is built on ng-zorro-antd (`nz-*`) repo-wide, including the current program form. This feature follows the existing code rather than mixing libraries; a constitution amendment or a migration decision is owed, but is out of this feature's scope.
2. **Destructive prune** — see Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-simple-programs-dbr-calculator/
├── plan.md              # this file
├── spec.md
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities + migrations
├── quickstart.md        # Phase 1 how-to-run / how-to-verify
├── contracts/
│   ├── admin-api.md         # bank policy, catalog defaults, prefill, simulate
│   ├── customer-api.md      # questionnaire snapshot, preview w/ figures, calculator
│   ├── questionnaire.md      # typed questions + typed answers contract
│   └── error-codes.md        # new typed codes + http status + i18n keys
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks output — NOT created here
```

### Source code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                      # Bank.policyDefaults, PlatformEnumeration.defaults,
│   │                                      # Question numeric/text rules, ApplicationAnswer multi-values
│   ├── migrations/
│   │   ├── <ts>_add_bank_policy_and_catalog_defaults/
│   │   ├── <ts>_question_types_typed_answers/
│   │   └── <ts>_prune_unused_eligibility_settings/     # destructive (FR-015c)
│   └── seed-questionnaire.ts              # emits number questions for the 4 money figures
└── src/
    ├── banks/                             # + lending-policy DTO, service, repository methods
    ├── bank-programs/
    │   ├── dto/sub-configs/eligibility-config.dto.ts   # prune + dbrBands
    │   ├── prefill/                       # NEW merge policy → catalog defaults → draft
    │   ├── validation/cross-config.validators.ts       # band + range validation
    │   └── seeds/catalogs/                # unchanged shape, pruned fields removed
    ├── platform-enumerations/             # + per-category defaults on program_name
    ├── questionnaire/                     # + type-aware create/update, typed answer submit
    ├── matching/
    │   ├── pipeline/dbr.ts                # + resolveDbrCap(bands|scalar, income)
    │   ├── pipeline/quote.ts              # NEW pure: one program + inputs → figures + trace
    │   └── engine.service.ts              # uses resolveDbrCap; unchanged otherwise
    ├── matching-preview/                  # returns figures; admin simulator returns trace
    └── calculator/                        # NEW module: cost mode + affordability mode

admin/src/app/features/
├── banks/                                 # lending-policy panel on bank detail
├── bank-programs/
│   ├── form/                              # Essentials / Advanced split, prefill, duplicate
│   └── shared/dbr-band-editor/            # NEW shared control (3 hosts)
├── program-catalog/                       # per-category defaults editor
└── questionnaire/                         # type picker + per-type rule fields

masrafy-app/lib/
├── core/widgets/input_controls/           # NEW number + text + multi-select controls
└── features/
    ├── questionnaire/presentation/pages/dynamic/   # step renders all 4 types
    ├── questionnaire/presentation/pages/<cat>/     # mappers read number answers, guesses deleted
    ├── offers/presentation/pages/results/          # figures on cards
    └── calculator/                                 # NEW feature (data/domain/presentation)
```

**Structure Decision**: three existing surfaces extended in place — `backend/` (NestJS feature modules + Prisma), `admin/` (Angular standalone features), `masrafy-app/` (Flutter three-layer features). Two new modules only: `backend/src/calculator/` and `masrafy-app/lib/features/calculator/`; everything else is an edit to an existing module, which is what keeps this a refactor rather than a rewrite.

## Complexity Tracking

| Violation | Why needed | Simpler alternative rejected because |
|---|---|---|
| Destructive migration deleting eligibility + performance-history settings (FR-015a) | Product decision, clarified 2026-07-30: matching ignores these settings, so admins fill boxes that change nothing, which is the exact "not simple" the feature targets | Keeping them read-only (the recommended option) was rejected by the product owner — it leaves 30+ dead fields on screen. Mitigations required: backup, explicit go-ahead, named reviewed migration, affected-program count reported, release note flagged data-destroying |
| Two DBR shapes coexisting (`dbrCapPercent` scalar + `dbrBands`) | Existing programs must keep working with no admin action (FR-020) | A single banded shape would force a data migration of every program and a forced admin review pass before matching stays correct |
| Same band editor mounted in three places (bank / catalog / program) | Clarified answer (Q3): prefill layers must be editable where they live | Program-only was simpler but leaves the prefill layers unfillable, defeating slices 3 and 5 |
| Server round-trip for every calculator input change | Principle I forbids float money math on the client, and preview↔offer parity (SC-004) requires one implementation | Client-side estimate rejected: two implementations drift, and a shown figure that differs from the offer is the failure this feature exists to fix. Debounce + shimmer covers the latency |
