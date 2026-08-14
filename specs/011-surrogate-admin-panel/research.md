# Phase 0 — Research: Income-Surrogate Rule Builder

Every decision below was taken against code that already exists, not against a blank page. File
references are the evidence.

---

## R1 — Where the rule is stored

**Decision**: Keep it in the existing `bank_program.incomeAssumption` JSONB. Define ONE canonical
self-describing shape, write it on every save, and produce it from legacy rows with a pure
`normalizeIncomeAssumption()` read-time upgrade. No migration.

```jsonc
{
  "strategy": "byMilitaryGrade",
  "keyTable":  [{ "key": "general", "incomeEGP": "40000" }],   // key-based methods
  "bands":     [{ "fromInclusive": "0", "toExclusive": "5", "incomeEGP": "12000" }], // range methods
  "scalar":    { "value": "30.0", "unit": "percent" },          // single-number methods
  "dbrCapPercentOverride": "45",
  "requiredDocuments": ["military_id"],
  "combinationRule": "greater_of"
}
```

**Rationale**: FR-014 asks for one self-describing object per program so a new method needs no
storage change. `ScoringWeightSet.weights` already solved the identical problem with
`normalizeWeights` legacy-upgrade-on-read (constitution v8.0.0: "legacy single-level rows upgrade
on read"), and that precedent shipped without a migration. Three seeded programs already carry the
legacy shapes (`abk-egypt-2026.ts:83` `incomeTable`, `:110` `rankIncomeMap`, `:121`
`gradeIncomeMap`), so FR-015 / SC-009 are satisfied by the normalizer, not by leaving two readers
in the engine.

**Legacy conversion, exactly**:

| Legacy | Canonical | Note |
|---|---|---|
| `rankIncomeMap` / `gradeIncomeMap` | `keyTable` rows, registry order | Key set unchanged. |
| `incomeTable` `[{minYears,maxYears,incomeEGP}]` (years strategies) | `bands` with `toExclusive = maxYears + 1` | Years are integers, so inclusive `maxYears` and exclusive `maxYears + 1` select identically. |
| `incomeTable` with `minCDValueEGP` (value strategy) | `bands` with `toExclusive` = next row's `fromInclusive`, last row `null` | Ascending rows are already gapless in the seed. |
| `carInstallmentMultiplier` / `carLoanAmountPercent` / `creditCardLimitMultiplier` / `bankStatementPercent` / `cdIncomePercent` | `scalar` | Values byte-identical; FR-015. |

**Alternatives rejected**:

- *A `surrogate_rule` table with a `surrogate_rule_row` child.* Buys referential integrity nothing
  reads: the rule is only ever loaded whole, with its program, inside the quote loop. It would
  also make `BankProgramSnapshot` a join instead of a row read, for zero query benefit.
- *A second JSONB column.* Two columns meaning "how income is derived" is exactly the drift
  FR-002 forbids in flag form; the same argument applies to storage.
- *A data migration rewriting the three legacy rows.* Rejected because a normalizer is needed
  anyway for any row written before deploy finishes, and having both means two truths.

---

## R2 — How a questionnaire answer reaches the rule

**Decision**: A code constant, `backend/src/matching/pipeline/surrogate-fact-bindings.ts`, mapping
each in-scope fact to its question code, expected question type, and (for choice facts) its
registry enumeration type. Publish emits warnings when a binding does not resolve.

**Rationale**: A33 blocks adding a scoring / eligibility / profile-mapping field back onto
`Question` or `QuestionOption`, and constitution v6.0.0 specifically deleted
`Question.profileField`. `money-field-bindings.ts:1-22` records this reasoning verbatim for the four
economic figures and has shipped. Surrogate facts are the same kind of binding and get the same
treatment, including the same accepted residual limit: renaming a bound code is a code change.

**The bindings**:

| Fact | Question code | Type | Registry | Lands on |
|---|---|---|---|---|
| Military grade | `military_grade` | SINGLE_SELECT | `military_grade` | `employment.militaryGrade` |
| Academic rank | `academic_rank` | SINGLE_SELECT | `professor_rank` | `employment.professorRank` |
| Years in practice | `years_in_practice` | NUMERIC | — | `employment.yearsInPractice` |
| Credit-card total limit | `credit_card_total_limit` | NUMERIC | — | `assets.creditCardLimitEGP` |

**Note on the fourth**: `credit_card_total_limit` is NOT a new question. It already exists
(`money-field-bindings.ts:125`) as the card-limit answer feeding the 5% obligation discount. The
same stated figure feeds `assets.creditCardLimitEGP` — one fact, two uses, asked once. Asking a
second card-limit question would ask the applicant the same thing twice, which
`money-field-bindings.ts:98-103` already calls out as the wrong move.

**Accepted limit on the fourth (added post-analysis)**: that question is itself branched — it is only
visible when `current_loans` includes `credit_cards` (`seed-questionnaire.ts:403`, `:445`). An
applicant who holds a card but did not declare card debt is therefore never asked, and
`byCreditCardLimit` resolves to `SURROGATE_FACT_MISSING`. That is the correct FR-020 outcome, not a
bug, but it caps how often that one method produces a figure and is why SC-003's matrix is scoped to
the facts a customer is actually asked.

**Codes are generated from labels, so the labels are load-bearing (added post-analysis)**:
`slug.util.ts:6-15` derives a question's immutable `code` from its ENGLISH LABEL, and A33 forbids
hand-typing codes. A label of "Your military grade" yields `your_military_grade`, which no binding
constant matches, so the fact would silently never bind (publish would warn, and nothing else would
break loudly). The seed's own `SeedQuestion` carries an explicit `code` field, so the two are
reconciled by naming the questions such that the slug IS the binding constant — `military_grade`,
`academic_rank`, `years_in_practice` — and by asserting that equality in a test rather than trusting
it.

**Alternatives rejected**:

- *A `surrogateFact` column on `Question`.* A33 review block.
- *A naming convention on `code` (`surrogate_*`).* A33 explicitly bans deriving bindings from a
  naming convention, and it silently rebinds when a code is edited.
- *A new admin screen to map fact → question.* Adds a second place where the mapping lives while
  the engine still needs a code-side default; the clarification session already ruled out new
  staff screens.

---

## R3 — Choice option codes ARE registry keys

**Decision**: The two SINGLE_SELECT facts are seeded with option codes equal to the active
`professor_rank` / `military_grade` members, and publish validates the equality, warning (never
blocking) on drift or on a dead key still referenced by a saved table.

**Rationale**: FR-017 requires the two sides not to drift. The admin picks table keys from
`app-tier-key-picker`, which reads the same registry
(`admin/src/app/features/bank-programs/tier-key-picker/tier-key-picker.component.ts:83`). Making the
customer's option codes the same list by construction is the only way a rename cannot silently
break the match — matching by label would break on the ar/en pair alone.

**Alternatives rejected**: free-text answers (the engine's map lookup would never hit — spec AS-1.9
demands fail-closed); a translation layer from option code → registry key (a third list to keep in
step, which is the drift FR-017 exists to prevent).

---

## R4 — `quote.ts` step 3 never runs the combination rule (defect)

**Decision**: On `income_surrogate` programs only, delegate income resolution to
`resolveAssumedIncome`, which already implements `greater_of` / `lesser_of` / replace. Leave
`income_proof` untouched.

**Evidence**: `quote.ts:138-142` takes the declared salary whenever it is `> 0` and only falls back
to `resolveAssumedIncome` when it is not. But `monthly_income` is a bound, required NUMERIC question
(`money-field-bindings.ts:28`), so a submitted application ALWAYS carries a declared salary > 0.
The stored `combinationRule` (`income-resolver.ts:22-29`) has therefore never executed in the apply
path. A perfectly configured grade table would still be ignored for every real applicant even after
Story 1 and Story 2 ship.

**Rationale**: The spec's edge case is explicit — "Applicant has both a declared salary and a
surrogate result → the program's existing combination rule decides which is used". FR-004 protects
the maths that turns income into an installment; this changes which income enters that maths, on
programs whose whole purpose is that the declared figure is not the operative one.

**Blast radius**: zero for `income_proof` (the branch is gated on `programType`, which is already on
the snapshot — `bank-program-snapshot.mapper.ts:22`). For `income_surrogate` programs the figure
changes only where a rule is configured AND the fact was answered; before this feature no rule
could be configured for five of the ten methods and no fact was ever asked. SC-009 is verified by
re-running the seeded set.

**The company-type haircut is NOT inherited (added post-analysis)**: `resolveAssumedIncome` runs
`applyCompanyTypeAdjustment` on the declared baseline (`income-resolver.ts:37-40`), applying
`eligibility.commercialBankIncomePercent` — a real configured value: `80.0000` on
`abk-egypt-2026.ts:98`, `90.0000` on `program-baselines.ts:143`. `quote.ts:129-137` deliberately does
NOT apply it ("two screens quoting the same person must show the same number"), and today the
haircut is effectively dead in the quote path because the resolver is only reached when the declared
salary is 0, where the multiplication is a no-op.

Delegating naively would therefore silently haircut the declared baseline on every
`income_surrogate` program — and that population is much larger than the four targets: every
business-category program plus the doctor / professional / pharmacy archetypes are seeded
`income_surrogate` with `strategy: 'declared'` (`seed-bank-programs.ts:71-88`, `:247`). **Decision**:
the new branch takes the surrogate resolution and the RAW declared figure as its baseline;
`applyCompanyTypeAdjustment` is not applied in the quote path, preserving `quote.ts`'s stated
invariant and SC-009 for those programs. The adjustment stays available to any caller that wants a
bank's internal recognition percentage, but the customer-facing quote does not use it.

**Alternatives rejected**: applying the combination rule to every program type (would change
`income_proof` offers — SC-009 violation); leaving the short-circuit and documenting that
`combinationRule` is dead (ships a UI control that does nothing, which is the exact class of defect
this feature exists to remove); inheriting the haircut because the resolver happens to apply it
(changes live figures on the largest slice of surrogate programs for a reason unrelated to this
feature).

---

## R5 — The resolver returns provenance, not a bare number

**Decision**: `resolveAssumedIncome` returns
`{ incomeEGP, origin: 'declared' | 'surrogate' | 'declared_over_surrogate' | 'surrogate_over_declared', strategy, unresolvedReason? }`.
The arithmetic inside each strategy is copied unchanged.

**Rationale**: Three requirements need the same fact and none of them can derive it from a number:
the offer must record which side won and why (spec edge case), the check panel must say "no row
matched" rather than showing zero (FR-031), and the DBR override must apply only when the income
actually came from the surrogate (FR-012). Returning `Decimal` alone forces each caller to
re-derive it, and A33's "deriving an answer's score in more than one place" reasoning applies with
equal force here.

**Alternatives rejected**: a separate `explainAssumedIncome()` for the panel — two functions that
must agree is precisely what v14.0.0 collapsed into one `answerScoreFor`.

---

## R6 — Bands are edges-only and half-open `[from, to)`

**Decision**: Store `fromInclusive` + `toExclusive` (`null` = open-ended last band), Decimal
strings; the admin edits EDGES, not pairs, so a gap or overlap cannot be expressed. Validation
mirrors `WEIGHTS_NUMERIC_BANDS_INVALID`'s rule set: ordered, gapless, last band open-ended,
Decimal comparison.

**Rationale**: Constitution v14.0.0 shipped exactly this for numeric answer scoring and recorded
the reason — "edges only → gaps/overlaps unrepresentable rather than merely validated"
(`admin/src/app/shared/ui/score-bands-editor.component.ts`). FR-007 / FR-008 ask for the same
guarantees; inventing a second band idiom would leave the platform with two, and A33 already
requires Decimal edge comparison for the scoring bands.

**Difference from the scoring bands**: income bands need NOT cover −∞…+∞. A years-in-job table that
starts at 0 and runs open-ended upward is complete; a value table may legitimately start above zero
(below the bank's floor the rule yields nothing, which FR-020 requires to be a stated reason, not a
zero). So: gapless BETWEEN the first and last edge, open-ended at the top, and a value below the
first edge resolves to `unresolvedReason: 'no_matching_band'`.

**Alternatives rejected**: reusing `app-score-bands-editor` verbatim (its cell is a 0–100 score, not
an EGP money input, and A27 requires `appMoneyInput` on money); keeping the legacy inclusive
`[minYears, maxYears]` pair (allows an admin to type `0–5` and `5–10`, double-covering year 5).

---

## R7 — The check panel overlays and re-quotes

**Decision**: `POST /api/admin/bank-programs/:programCode/income-rule/check` takes the on-screen
(unsaved) `incomeAssumption`, a sample fact, an age, an amount and a tenor. The service loads the
saved program snapshot, overlays the draft `incomeAssumption`, synthesises an `ApplicantProfile`,
and calls the SAME `quoteProgram` the simulator calls. Nothing is written.

**Rationale**: FR-030 requires the panel and the simulator to agree on 100% of inputs (SC-007). The
only structural way to guarantee that is one code path; any second implementation of "income →
DBR → affordable installment → max loan" is a divergence waiting to happen — v13.0.0 recorded the
same lesson when preview and apply derived the asked set differently. FR-028 (evaluate what is on
screen) forces the config into the request body rather than a program-id-only dry run.

**Alternatives rejected**: extending `POST /admin/matching/simulate` with a program-config override
(it fans out over every program in a category; the panel is about ONE program and would have to
filter the result, and the override would leak into a customer-shaped DTO); a client-side
calculation in Angular (duplicates the pipeline in a second language — SC-007 becomes untestable).

---

## R8 — Value-source markers are a sparse path map

**Decision**: New `bank_program.valueSources` JSONB, defaulting `{}`. Keys are dot-paths into the
program's own config (`incomeAssumption.keyTable.general.incomeEGP`,
`pricing.baseRatePercent`); the only stored value is `"team_estimated"`. An absent path means
bank-stated.

**Rationale**: FR-032 covers every number an admin types, but FR-037 requires every pre-existing
program to keep working and to be reported once rather than switched off. A sparse map where
absence = stated gives that for free on deploy: the default `{}` marks nothing estimated, so no
live program goes dark. Storing both states explicitly would need a backfill over every numeric
path of every program, and would make "a new field nobody has marked yet" indistinguishable from
"estimated".

**Enforcement points**:

- `POST …/toggle` with `active: true` → scan; any entry ⇒ reject `PROGRAM_HAS_ESTIMATED_VALUES`
  with `meta.paths` listing **all** of them (FR-033 — names every value, not the first).
- `PUT …/:code` that introduces an entry on an `active` program ⇒ set `active = false` in the SAME
  transaction, write an `AuditEvent` naming the paths and the editor (FR-035, FR-038).
- Save is never blocked by an estimate (FR-034).
- `GET …/pending-bank-confirmation` → every program with a non-empty map, with bank, paths, and
  `waitingSince` (the audit event's timestamp of the first still-standing marker) (FR-036).

**Alternatives rejected**: a `value_source` child table keyed by (programId, path) — a row per
number, read on every activation, for data that is never queried across programs except by the one
list endpoint; a per-field `{value, source}` wrapper inside each config blob — rewrites every DTO,
every form control and the engine's readers, and breaks the seeded shapes for no gain.

---

## R9 — Where the "no figure" reason surfaces

**Decision**: Two new `FiguresUnavailableReason` values — `SURROGATE_FACT_MISSING` (the applicant
was never asked, or skipped) and `SURROGATE_NO_MATCHING_ROW` (answered, but no key/band matched) —
mapped through the existing `reasonToCheckCode` switch (`engine.service.ts:277-291`) and localized
in ar + en on both admin and mobile.

**Rationale**: FR-020 forbids a substituted default, FR-022 requires the program to still be listed
with a plain-language reason, and FR-031 requires the panel to say "no row matched" rather than
zero. `NO_RECOGNISED_INCOME` already exists and is already localized, but it cannot distinguish "we
never asked you" from "your grade isn't in this bank's table" — and those two lead to different
admin actions (assign the question to the category vs. add the row).

**Alternatives rejected**: reusing `NO_RECOGNISED_INCOME` for both (loses the distinction the admin
needs); hiding programs that cannot produce a figure (FR-022 and the constitution's no-eligibility-
gating rule both forbid it).

---

## R10 — Offer provenance is frozen, not derived

**Decision**: Two nullable columns on `bank_offer` — `incomeOrigin` and `incomeSurrogateStrategy` —
written at creation, never updated.

**Rationale**: The `approvalUsedDefault` column (schema.prisma:466-470) records the identical
argument in the identical situation: "Must be persisted, not derived: configuring the program later
would silently rewrite the meaning of an immutable offer (Principle I)". An offer produced from a
grade table must still say so after the admin edits that table, and `BankOffer` is immutable
post-creation (A6).

**Alternatives rejected**: recomputing from the program's current rule at read time (rewrites
history); stuffing it into `cascadeTrace` JSON (that blob explains the pricing/tenor/limit cascade;
income provenance is a different axis and would not be queryable).

---

## R11 — Which surface asks, and in which category

**Decision**: The four fact questions are seeded into the ONE global pool and assigned to the
`personal` category only, via `question_loan_category`. The personal apply mapper stops sending an
empty `AssetsPayload`. The other three mappers are untouched.

**Rationale**: FR-001 confines surrogate rules to personal loans, and constitution v12.0.0 puts
per-category scoping exclusively in the join table. The empty payload is the bug FR-019 names —
`personal_apply_mapper.dart:55` sends `const AssetsPayload()`, so `creditCardLimitEGP` never leaves
the phone even though the question is answered.

**Preview parity**: `matching-preview.service.ts:404` builds `assets: {}` too. Both paths get the
same mapping from the same helper, because v13.0.0's `isQuestionVisible` lesson is explicit —
preview and apply deriving the same thing differently is a review block.

**The branching gate is coarser than the facts (added post-analysis)**: `Question.enabledWhen` holds
ONE `optionCode` plus an operator (`seed-questionnaire.ts:130-131`, `:273`) — not a list — and
`EMPLOYMENT_OPTIONS` (`:152-158`) offers only `government_employee`, `private_sector_employee`,
`business_owner_company_owner`, `freelancer`, `retired`. There is no option distinguishing a soldier
from a professor, and no way to gate one question on two options.

**Decision**: gate both SINGLE_SELECT facts on `government_employee`, mark both NOT required, and
leave `years_in_practice` ungated and optional (its population is split across `freelancer` and
`business_owner_company_owner`, which one gate cannot express). A government employee is therefore
asked both their military grade and their academic rank, and skips the one that does not apply —
which FR-020 already defines as a stated reason, not a zero. Adding employment options instead would
ripple into the scoring points on every category's `employment_status`, the employment-type mapper
and three other questionnaires, for a cosmetic gain; that is a later, separate change.

**Alternatives rejected**: assigning the facts to all four categories (asks a mortgage applicant
their army rank for nothing); a personal-only questionnaire (A33 review block — one pool, one
snapshot); splitting `government_employee` into military / academic / civil options in this feature
(cross-questionnaire blast radius, no benefit to the figure produced).

---

## Open items carried into tasks (not blocking)

1. **Principle XXIII gate**: `promax` before designing the rule section and the waiting-list page,
   `impec` after first implementation. Non-negotiable (A17).
2. **Required-document warning (FR-013)**: the method declares codes; the admin sees a
   non-blocking warning when the program's `requiredDocuments` lacks them. Uses the existing
   `required_document` registry — no new vocabulary.
3. **Six of the ten facts stay configurable but unasked** — certificate value, total deposits, car
   installment, car loan amount, bank-statement balance (and any future addition). Their profile
   fields already exist on the apply DTO (`assets.cdAtABKValueEGP`,
   `assets.totalDepositsAtABKValueEGP`, …); what is missing is a question, and adding five is a
   separate increment. The rule builder configures and CHECKS them fully; a customer who was never
   asked yields `SURROGATE_FACT_MISSING` per FR-020. FR-016 and SC-003 were narrowed to say this
   explicitly rather than promising coverage this increment does not deliver.

4. **The three programs that carry legacy tables are mis-typed** — `ABK-MILITARY`,
   `ABK-PROFESSORS` and `ABK-DOCTORS-PRACTICE` (`abk-egypt-2026.ts:77-122`) inherit
   `programType: 'income_proof'` from `catalogs/base.ts:18` and were never re-typed. A type-gated
   rule section would hide exactly the rows this feature exists to edit, and a strip-on-save rule
   would delete them. Both are addressed: the seeds are re-typed, and non-matching configuration is
   IGNORED AND REPORTED, never deleted.
