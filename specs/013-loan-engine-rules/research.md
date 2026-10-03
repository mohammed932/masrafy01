# Research — 013 Loan Engine rules

The engine already has most of what the request asks for. The gaps are listed per decision. Paths are under `backend/src/` unless stated otherwise.

## What exists today (the facts the decisions rest on)

| Need | Existing mechanism | Where |
|---|---|---|
| Per-answer figure | Fact grid `{axes, cells:[{keys, value}], onNoMatch}` | `matching/pipeline/fact-grid.ts:57-92`, resolver `:196-259` |
| Number range | Band key `{fromInclusive?, toExclusive?}`, half-open only | `fact-grid.ts:135-150` |
| Choice / multi-choice | `{key}` cell; a multi-pick matches if any pick is a key, and the first row in order wins | `fact-value.ts:39-55` |
| Text | `presence` answer, matched only by the reserved key `answered` | `fact-value.ts:36` |
| Refusal with reason | Product-rule gate → `unavailable.reason = 'PRODUCT_RULE_GATE_FAILED'` + `gateReasonCode` (closed list `GATE_REASON_CODES`) | `matching/pipeline/product-rule.ts:278-385`, `quote.ts:556-577` |
| Mobile shows the reason | `figures_unavailable_reason.dart`, ARB strings per gate code | `masrafy-app/lib/features/matching/presentation/mappers/` |
| Which column each effect lives in | `factSurfacesOfProgram` | `matching/pipeline/fact-readers.ts:321-392` |
| Seed safety | `seed:sheet-figures` never overwrites a figure an operator typed | `bank-programs/demo-figures/sheet-figures.plan.ts:6-12` |

**The gaps:**
1. Band keys cannot say "at most X", "more than X" or "equals X".
2. Conditions exist only inside no-payslip product templates. Their structure is seed-owned and not authorable, and the 44 payslip programs have none.
3. Three readers have no admin editor at all: `loanLimits.maxLoanByFact` on the bank form, `tenor.maxVehicleAgeYearsByFact`, and `incomeAssumption.additionalIncome`.
4. No screen shows one question's effects across programs.

---

## R1 — Number criteria (FR-003)

- **Decision:** extend the band key with one alternative per edge:
  - `{ fromInclusive? | fromExclusive?, toExclusive? | toInclusive? }`.
  - At most one key per edge. If both are given, the cell is invalid (the validator refuses it).
  - The admin's six operators compile to exactly one shape:

| Operator | Stored key |
|---|---|
| less than X | `{toExclusive: X}` |
| at most X | `{toInclusive: X}` |
| at least X | `{fromInclusive: X}` |
| more than X | `{fromExclusive: X}` |
| between A and B (inclusive) | `{fromInclusive: A, toInclusive: B}` |
| equals X | `{fromInclusive: X, toInclusive: X}` |

- **Rationale:**
  - It is additive. Every stored cell keeps its meaning, because the two new fields are absent from all existing rows, so no money moves. That has to be proven with before/after figures, not asserted.
  - One predicate serves grids, `maxLoanByFact` and conditions alike (`keyMatchesAnswer`).
  - The admin reads the key back as the operator that produced it, with a lossless round-trip.
- **Alternatives rejected:**
  - *Compile "at most X" to `toExclusive: X + ε`.* An ε on a Decimal money figure is an invented number (Principle I), and "+1" assumes integer answers, which income is not.
  - *A free expression language (`x > 5 && x <= 9`).* Unbounded, can't be validated against the shape check from 012 A2, and gives the operator a programming surface.

## R2 — Text criteria (FR-005)

- **Decision:** text supports only **answered**, plus the fallback row, which covers "not answered". No comparison of the text itself.
- **Rationale:**
  - Free text can hold PII (Principle VI). A rule that reads it makes the engine a PII consumer and the audit log a PII store.
  - Arabic/Latin spelling, diacritics and typos make "equals" unreliable. A bank refusing someone over a spelling would be invisible.
  - If the value matters, the question should be a choice. The Loan Engine screen says so and links to the question editor.
- **Alternatives rejected:** case-folded / normalised equality, and "contains". Both are rejected for the PII reason alone.

## R3 — Multi-choice "what each choice affects" (FR-004)

- **Decision:**
  - One row per option, plus a fallback row.
  - With several picks, **the first row in the operator's order that matches wins**. The editor makes the order visible and draggable, and states this rule in one line.
- **Rationale:** this is the engine's existing behaviour (`fact-value.ts:39-55`), shared by every table. Changing it would re-price every live multi-select table.
- **Alternatives rejected:** sum, max or min across picks. Each is a new semantic that touches every existing multi-select grid, so it needs its own before/after proof. It is out of scope and listed as a follow-up.

## R4 — Eligibility conditions on any program (FR-006/7/8)

- **Decision:** a new nullable JSONB column **`bank_program.conditions`**, holding a list of conditions:
  - Each condition is `{ id, anyOf: [ { factKey, key } ], reasonCode }`, where `key` is a `FactGridKey`, so it is the same predicate as R1.
  - Evaluated in `quoteProgram` before any figure is computed. All conditions must pass (AND); a condition passes if any of its criteria matches (OR).
  - A failure yields the existing `unavailable.reason = 'PRODUCT_RULE_GATE_FAILED'`, `gateId = 'condition:<id>'`, `gateReasonCode = reasonCode`.
  - Unanswered → not matched → fails. FR-008 makes the question required wherever that can happen.
- **Rationale:**
  - **Program-level policy, like I-Score since v30.3.0.** It works for payslip programs, which have no product rule to carry a gate.
  - **Refused, not hidden.** That is the operator's decision. Principle V forbids hiding programs, not stating a refusal, and v28.0.0 established refusing conditions.
  - **No new mobile surface:** the app already renders `PRODUCT_RULE_GATE_FAILED` + `gateReasonCode` in both locales (v28 added 11 tests for it). So **no Flutter ARB change, and no new error code.**
  - **OR across questions** is how v28 learned to write exemptions ("does not apply to me" lives in the answer). Here it is direct: "≥ 2 years in business OR has a guarantor".
- **Guard (A33):** a criterion's `factKey` must be a `surrogate_fact` bound to a question. The question must not be an engine input: no amount, term, income, debts, employment type, age, I-Score or platform car facts. Salary, age, DBR, amount and max-loan gates stay forbidden (A33). The guard reuses `questionLockReason(...) === 'engine'` and `isReservedFactKey`, never a hand-typed list.
- **Alternatives rejected:**
  - *Put gates into each payslip program's `incomeAssumption`.* Payslip programs have no product rule, and inventing one per program would be a template per bank (Principle II smell).
  - *Revive `EligibilityConfig` / turn off `skipEligibility`.* That drops programs, which the operator rejected, and it reads profile fields, not answers.
  - *A new unavailable reason, `PROGRAM_CONDITION_FAILED`.* It adds a code to backend, admin and Flutter (A25) for no difference the customer can see.

## R5 — Where each effect is written (FR-002)

The Loan Engine writes into exactly the column the engine reads (`factSurfacesOfProgram`):

| Effect (tile) | Column on `bank_program` | Shape written by Loan Engine |
|---|---|---|
| Rate table | `pricing.rateByFact` | single-axis fact grid |
| Loan cap | `loanLimits.maxLoanByFact` | single-axis (`factKey` only, no `columnFactKey`) |
| Financed share | `loanLimits.ltvCeilingByFact` | single-axis fact grid |
| Smallest loan | `loanLimits.minAmountByFact` | single-axis fact grid (can only raise the floor) |
| Shortest / longest term | `tenor.minMonthsByFact` / `tenor.maxMonthsByFact` | single-axis fact grid |
| Extra income | `incomeAssumption.additionalIncome.sources[]` | `{factKey, percent}`, NUMERIC questions only |
| Condition | `conditions` (new) | R4 |

**Read-only cases**, each with a link to the screen that owns it:
- a grid with more than one axis, or one this question shares with another;
- a grid the program inherits from a product plan (`plansFromProduct`);
- a `maxLoanByFact` with a `columnFactKey`;
- the income rule's structure.

**Rationale:** a question-centric editor must never become a second, divergent copy of the program form. It writes the same fields through the same validators (`validateFactGrid`, the 012 A2 shape check), so the bank-program form and the Loan Engine are two views of one row.

## R6 — Write API and concurrency (FR-009)

- **Decision:**
  - One write per (question, program, effect): `PUT /api/admin/loan-engine/questions/:questionCode/programs/:programCode/effects/:effect`, carrying the program's `version`. A mismatch returns 409 `CONFLICT_STALE_DATA` (existing code).
  - Condition writes go to `PUT …/programs/:programCode/conditions` (the whole list).
  - Audit: `BANK_PROGRAM_UPDATED` with a diff of the touched path.
  - The repository owns the JSONB merge (Principle X). It replaces only the touched path.
- **New error code:** `LOAN_ENGINE_RULE_INVALID` (422, meta `{programCode, effect, row?, problem}`), where `problem` is one of:

| `problem` value | Meaning |
|---|---|
| `both_edges` | both keys given for one edge |
| `empty_band` | a band with no edge |
| `unknown_option` | a key that is not one of the question's options |
| `engine_input` | a condition criterion reads an engine input (R4) |
| `shape` | wrong criterion kind for the question type |
| `read_only_surface` | the target is one of R5's read-only cases |
| `not_linked` | the question has no figure yet (link it first, feature 012) |

  It is admin-only, so no ARB, following the `SURROGATE_FACT_KEY_TAKEN` precedent. It goes in backend `error-codes.ts`, `domain.exceptions.ts`, and both admin JSONs.
- **Alternative rejected:** an atomic bulk write across programs. "Copy these rows to …" is a UI convenience that issues one write per program, each audited separately. Atomicity across banks buys nothing, because each bank's figures are its own.

## R7 — "Try an answer" (Story 3)

- **Decision:** reuse `POST /api/admin/matching/simulate` (`matching-preview/admin-matching.controller.ts:24`) with the sample answer.
- **Unsaved edits:** the simulate DTO gains optional `programOverrides: {programCode, path, value}[]`, applied in memory only and **admin-only**. The override goes through the same validators as the write, so the preview cannot price a row the save would refuse.
- **Rationale:** one engine path for preview, apply and the admin simulator (A33, FR-010).

## R8 — Placement and UI pipeline

- **Decision:**
  - A new lazy route `/loan-engine` with a sidebar entry under Questionnaire. It is standalone, signals-based, `inject()`, typed reactive forms and ng-zorro, with logical CSS and tokens.
  - Layout: a question list on the left (search, loan-type filter, class chip from 012); on the right, the question header, the effects × programs matrix, and the row editor in an `NzDrawerService` side sheet (v19.1.0: forms are side sheets).
  - The 012 panel's "What should it affect?" tiles keep navigating, but now land on `/loan-engine?question=<code>&effect=<id>`.
  - `ui-ux-pro-max` runs before the design and `impec` after (Principle XXIII).
- **Rationale:** this is the screen the operator asked for. The 012 tiles become shortcuts into it rather than a parallel entry point.

## No open NEEDS CLARIFICATION
Both product decisions were taken on 2026-10-04 (spec Clarifications). Everything else above is resolved by existing code and the constitution.
