# New or used for every car loan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** one "Is the car new or used?" question for every car loan (payslip and no-payslip), payslip's New Car + Used Car merged into one Car Loan name, and each car bank program saying what it finances.

**Architecture:** a `car_condition` question (+ fact) gates the fuel (new) and model-year (used) questions through the existing show-when rules; `bank_program.carCondition` (`new`/`used`/`any`) is one more rule in the shared `match-gate.ts`; a migration moves the 13 programs on `new_car`/`used_car` to a new `car_loan` name and switches the old names off.

**Spec:** `docs/superpowers/specs/2026-11-29-new-or-used-for-every-car-loan-design.md`

## Global Constraints

- **No commits** — the operator commits (memory: no-commit-without-ask). The plan has no commit steps.
- No NEW unit tests; proof = real DB, seeds re-run 0 written, `check:engine` cases, e2e, both locale builds.
- Banks are data: no bank or program code named in engine paths. Typed errors in all locales. Arabic targets for every string.
- Old names are switched off, never deleted. Program codes do not change (seeds keep finding their rows).

## Review Focus

- A customer who has not answered "new or used" yet: no program is hidden for it.
- A bank with a new program and a used program under Car Loan: the form allows it; two "Both" are refused.
- New Car / Used Car history: applications filed under the old names still read.
- A no-payslip car product answers "Used" → model year asked, fuel not; "New" → the reverse.
- Seeds on a fresh database produce exactly what the migration did (re-run 0 written).

---

### Task 1: Data and engine

**Files:** `prisma/schema.prisma`, migration `20261129090000_car_condition`, bank-program DTO / repository / snapshot mapper / response, `bank-programs.service.ts` (name rule), `matching/pipeline/match-gate.ts`, matching types.

- [ ] `bank_program.carCondition varchar(8)` nullable; DTO `carCondition?: 'new'|'used'|'any'` (`@IsIn`), refused off a car program (`VALIDATION_FAILED`); snapshot field.
- [ ] Name rule: two car programs at one bank under one name are allowed when their `carCondition`s are `new` and `used`; anything else stays `BANK_PROGRAM_NAME_TAKEN`.
- [ ] match-gate: new enforced rule `car_condition` — hides a program whose `carCondition` is `new`/`used` when the applicant answered `car_condition` (from `profile.surrogateFacts.car_condition`) with the other one. Unanswered hides nothing.
- [ ] Run `check:engine` (Part I added in Task 3) — this task verified by tsc + vitest + `check:engine` staying green.

### Task 2: The question, the name, the migration and the seeds

**Files:** same migration, `prisma/seed-questionnaire.ts`, `src/questionnaire/car-questions.ts`, `prisma/data/program-catalog-matrix.ts`, `prisma/seed-bank-programs.ts`, `src/bank-programs/demo-figures/{sheet-programs,adib-programs}.ts`, `src/bank-programs/seeds/catalogs/salesfloor-egp-2026.ts`.

- [ ] Migration: question `car_condition` "Is the car new or used?" / "هل السيارة جديدة أم مستعملة؟" (options `new` جديدة, `used` مستعملة; required; in the car group before `car_category`) + its `surrogate_fact`; `car_fuel_type.enabledWhen` = car_condition equals new; `car_model_year.enabledWhen` = equals used.
- [ ] Migration: program name `car_loan` "Car Loan" / "قرض سيارة" (car, payslip); the 13 programs move to it with `carCondition` new/used from their old name; other car programs `any`; ticks and order of the two old names merged onto it; every car name ticks `car_condition`; `new_car` off (no loan type left), `used_car` leaves car (keeps personal).
- [ ] Seeds converge on the same: the questionnaire seed defines the question and gates; car names tick all seven car questions (`carQuestionCodesFor` loses its two special cases); the catalog matrix lists `car_loan: ['car']` and `used_car: ['personal']`; seeded programs on the old keys write `programNameKey: 'car_loan'` + `carCondition` (codes unchanged).
- [ ] Run migrate, `seed:questionnaire` (republishes), build, `seed:catalog`, `seed:programs`, `seed:sheet-figures` twice → second run 0 written / 0 refused; `check:questionnaire`, `check:question-scope`, `check:parent-keys` clean (or HEAD's findings only).
- [ ] Served check: `car_loan` serves car_condition → category → brand → (fuel | model year) → price → down payment; a no-payslip car name serves car_condition too.

### Task 3: check:engine Part I

**Files:** `scripts/check-engine.ts`

- [ ] Fixtures on their own TESTING bank: a payslip used-only and a payslip new-only program under one name (proves the name rule), a no-payslip program with `any`.
- [ ] Cases: Used answer → the new-only program hidden (`NOT_ELIGIBLE`, rule `car_condition`), the used-only quoted; New → the reverse; unanswered → both listed; `any` quoted either way; served order per answer; a second `any` beside them refused `BANK_PROGRAM_NAME_TAKEN`.
- [ ] Run `check:engine` — Expected: all pass, twice.

### Task 4: Admin

**Files:** bank-program form (Program step), detail page, matching simulator rule label, `bank-programs.types.ts`, xlf.

- [ ] Car programs: "Finances: New cars / Used cars / Both" (radio, default Both), saved as `carCondition`; detail page shows it; the simulator names the hidden rule "New or used doesn't match".
- [ ] tsc, Arabic build untranslated count = HEAD, lint parity.

### Task 5: Tests, docs

**Files:** `admin/e2e/{car-pricing,auto-loan,catalog-v36,product-defaults}.spec.ts`, guide artifact, `docs/CHANGELOG.md`, `CLAUDE.md`, `docs/fresh-install.md`.

- [ ] e2e moved to `car_loan` + the new question; car-pricing gains the Finances choice and a run per kind.
- [ ] Run the four specs light + dark — Expected: pass.
- [ ] Guide: the two paths become one question; CHANGELOG v37.1.0; CLAUDE.md index; fresh-install.
