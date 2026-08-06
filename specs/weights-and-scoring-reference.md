# Weights & Scoring — engineering reference

**Date:** 2026-08-06 · reflects constitution **v14.0.0** (Principle V, Anti-Pattern A33)

Contract-level reference: the formula, the stored shape, the per-type rules, the validation, the API
surface, and the edge cases. For the plain-language walkthrough of how a question becomes a score,
read [questions-and-weights-flow.md](questions-and-weights-flow.md) instead — this file is the
"what exactly does the code guarantee" companion to it.

---

## 1. The formula

```
                Σ_answered ( questionWeight × answerScore ÷ 100 )
probability  =  ─────────────────────────────────────────────────      clamped to 0..1
                        Σ_asked ( questionWeight )

score        =  Math.round(probability × 100)          // 0..100 integer, shown to users
tier         =  tierFor(probability)                   // from the UNROUNDED probability
```

Lives in code (PR-reviewed, Principle V): [approval-probability.scorer.ts:288](../backend/src/matching/scoring/approval-probability.scorer.ts#L288).
Everything the formula consumes — weights, scores, bands, aggregation, presence score — is admin
**DATA** in `scoring_weight_set.weights`.

**Denominator = the weight the program placed on questions this applicant was ASKED** (v13.0.0), not
a flat 100. Consequences:

- Programs that score on different question sets stay comparable.
- Weight on a question the applicant's category never asks leaves **both** sides of the fraction, so
  a misconfigured assignment can no longer cap a program below 100% forever.
- An asked-but-skipped question keeps its weight in the denominator and earns nothing → skipping
  costs points.
- An answer to a question that was not asked is ignored outright.

No eligibility gating anywhere (dropped for MVP). Every active program in the category is returned,
ranked by probability, in both preview and apply.

---

## 2. Two independent assignment axes

| Axis | Decides | Where set | Stored in |
|---|---|---|---|
| **Category assignment** | which questions the customer is ASKED | Questionnaire → Loan categories | `question_loan_category` (frozen into the snapshot on publish) |
| **Program assignment** | which questions a program SCORES on | Bank program → Scoring wizard | the key set of `weights.questionWeights` (no join table) |

The two are set on different screens by potentially different people. Their **intersection** is what
actually moves a score. The admin editor warns when a program weights a question outside its own
category's asked set (warn, never block).

---

## 3. Storage

### `scoring_weight_set` ([schema.prisma:1047](../backend/prisma/schema.prisma#L1047))

| Column | Notes |
|---|---|
| `bankProgramId` | one program, many versions |
| `status` | `ScoringWeightSetStatus` — only `ACTIVE` / `ARCHIVED` are used post-v5.0.0; `DRAFT`/`PENDING_APPROVAL`/`REJECTED` are maker-checker leftovers |
| `versionNumber` | `@@unique([bankProgramId, versionNumber])` |
| `weights` | `Json` — the blob below |
| `createdBy` | editing staff id (audited) |
| `approvedBy` / `approvedAt` | set to the same editor / now — direct save, no second person |

Save is atomic: `updateMany(ACTIVE → ARCHIVED)` + `create(ACTIVE)` in one transaction
([scoring.repository.ts:39](../backend/src/scoring/scoring.repository.ts#L39)). Never mutate an
ACTIVE set in place (A33).

### The `weights` blob

```jsonc
{
  // questionCode → weight. THIS KEY SET IS THE PROGRAM'S ASSIGNMENT. Sums to exactly 100 (±0.1).
  "questionWeights": { "monthly_income": 40, "other_income_sources": 25, "employer_name": 15, "marital_status": 20 },

  // SINGLE_SELECT + MULTI_SELECT: questionCode → optionCode → score 0..100
  "answerScores": {
    "marital_status":       { "single": 60, "married": 100, "divorced": 70 },
    "other_income_sources": { "salary": 100, "rental": 70, "freelance": 40 }
  },

  // MULTI_SELECT only: how several picks combine. Absent → AVERAGE.
  "multiSelectRules": { "other_income_sources": { "aggregation": "AVERAGE" } },

  // NUMERIC only: ordered, gapless, non-overlapping half-open [from, to). Edges are DECIMAL STRINGS.
  "numericBands": {
    "monthly_income": [
      { "from": null,    "to": "5000",  "score": 20 },
      { "from": "5000",  "to": "15000", "score": 60 },
      { "from": "15000", "to": null,    "score": 100 }
    ]
  },

  // TEXT only: what a non-blank answer earns. Presence only.
  "textRules": { "employer_name": { "answeredScore": 100 } }
}
```

Types: [`SaveWeightsPayload`](../backend/src/scoring/dto/scoring.dto.ts#L14) ·
[`ProgramScoring`](../backend/src/matching/scoring/approval-probability.scorer.ts#L79).

### Persisted on the offer ([schema.prisma:452](../backend/prisma/schema.prisma#L452))

| Column | Meaning |
|---|---|
| `approvalProbabilityPercent` | `Decimal(5,2)` — the 0..100 score |
| `approvalTier` | `ApprovalTier` enum |
| `approvalFactors` | `Json` — the contribution breakdown (§9) |
| `approvalUsedDefault` | `true` when the program had no ACTIVE set → render "Not rated", never `very_low` |

`BankOffer` is immutable after creation (Principle I / A6). The score is written once, before the row
exists — which is why `approvalUsedDefault` had to be persisted: configuring the program later must
not retroactively rewrite what an existing offer meant.

---

## 4. One answer → one 0..100 score, per type

All four types are scoreable since v14.0.0
([`SCOREABLE_TYPES`](../backend/src/questionnaire/validation/question-type-rules.ts#L26)). Only this
derivation is type-aware; the formula in §1 is untouched.

| Type | Rule read | Score | `null` (nothing scored) when |
|---|---|---|---|
| `SINGLE_SELECT` | `answerScores[q][opt]` | the picked option's score | option not in the map |
| `MULTI_SELECT` | `answerScores[q]` + `multiSelectRules[q].aggregation` | picked scores combined (below) | question absent from `answerScores`, or nothing picked |
| `NUMERIC` | `numericBands[q]` | score of the band containing the value | no bands, unparseable value, or no band matches |
| `TEXT` | `textRules[q].answeredScore` | `answeredScore` if non-blank | no rule, or blank |

[`answerScoreFor`](../backend/src/matching/scoring/approval-probability.scorer.ts#L181) — never
throws. Unparseable values and unknown codes degrade to 0/`null`, so a bad row can cost a program
points but can never fail a match request. `null` and 0 behave identically in the numerator; the
weight stays in the denominator either way.

### MULTI_SELECT aggregation

| Mode | Result over picked scores | Use for |
|---|---|---|
| `AVERAGE` **(default)** | mean | "how good are your income sources on average" |
| `SUM_CAPPED` | `min(100, Σ)` | "more good things is better, up to a point" |
| `MAX` | best pick | "your strongest source is what counts" |
| `MIN` | worst pick | "your weakest link is what counts" |

An option the program never scored counts as **0**, not as a gap — it was offered and the applicant
picked it, so it is a real (worthless) choice. Absent aggregation → `AVERAGE`, the only mode that
cannot change the meaning of a legacy row (with one pick every mode agrees).

### NUMERIC bands

- Half-open **`[from, to)`** — two adjacent bands can never both claim an edge value.
- `from: null` = −∞, `to: null` = +∞. Edges are **Decimal strings** (money/rates — Principle I, no floats).
- Compared with `Decimal` (`lessThan` / `greaterThanOrEqualTo`), first match wins
  ([`bandFor`](../backend/src/matching/scoring/approval-probability.scorer.ts#L216)).
- Bands can peak in the middle (an ideal tenor, a healthy DBR) — not just worst→best.

### TEXT

Presence only. Keyword/regex/pattern scoring on free text is **forbidden** (A33). Non-blank →
`answeredScore`; blank → nothing, exactly like a skip.

---

## 5. The asked set

**Asked = active + assigned to the applicant's loan category + visible after branching.** No type
filter since v14.0.0.

Two paths derive it, and they must agree or the same answers would score differently before and
after apply (A25):

| Path | Reads | Derivation |
|---|---|---|
| **Apply** (`POST /v1/apply`) | LIVE question rows | [`resolveAnswers(answers, category)`](../backend/src/questionnaire/questionnaire.service.ts#L535) → `{ resolved, askedQuestionCodes }` |
| **Preview** (`/matching-preview`) | FROZEN snapshot | [`resolveSelectedOptions`](../backend/src/matching-preview/matching-preview.service.ts#L146) |

Shared modules keep them honest:

- [`question-visibility.ts`](../backend/src/questionnaire/validation/question-visibility.ts) — the one
  branching rule. A question with no `enabledWhen` is visible; a rule pointing at a question not in
  scope is **dangling** and never hides its target (hiding on an unevaluable rule would silently drop
  the question from both the questionnaire and the denominator).
- [`answer-to-selected.ts`](../backend/src/matching/scoring/answer-to-selected.ts) — the one
  normalised-answer → `SelectedAnswer` mapping.
- [`weighted-approval.service.ts`](../backend/src/scoring/weighted-approval.service.ts) — the one
  place that turns answers + an ACTIVE set into a score.

Snapshot `categories` semantics — **absent ≠ empty**:

| Frozen value | Meaning |
|---|---|
| key absent (pre-v12) | asked by every category |
| `[]` (v12+, explicit) | **parked** — asked by nobody |

Testing `.length > 0` conflates the two and lets a parked question into preview's asked set while
apply excludes it.

`askedQuestionCodes` is recorded **before** validation, so a skipped optional question still counts
against the applicant. Preview forces `isRequired: false` (partial answer sets are the point); apply
enforces required questions, scoped to the same category set.

Mid-questionnaire the preview's asked set **grows** as the applicant answers — correct, because a
branch only becomes asked once its trigger is picked.

---

## 6. Edge cases

| Situation | Behaviour |
|---|---|
| Asked, answered, program weights it, rule present | contributes `weight × score ÷ 100` |
| Asked, **skipped** | weight stays in denominator, earns 0 |
| Asked, answered, program **doesn't** weight it | no effect either side |
| **Not asked**, program weights it | dropped from **both** sides (v13.0.0) |
| Not asked, but answered anyway | ignored |
| Weighted question with **no rule** for its type | rejected on save (`WEIGHTS_MISSING_RULE`); a pre-v14 row that slipped through earns 0 while still costing its weight |
| Numeric value in a band **hole** | earns 0 (impossible to save such bands since v14.0.0) |
| No ACTIVE weight set | `probability = 0`, `usedDefault = true` → "Not rated yet", **not** `very_low` |
| Nothing asked, or zero weight on everything asked | `0`, never `NaN` |
| Malformed/negative/`NaN` score in the blob | clamped into `0..100` |

### Tiers ([`tierFor`](../backend/src/matching/scoring/approval-probability.scorer.ts#L328))

| probability | tier |
|---|---|
| ≥ 0.80 | `excellent` |
| ≥ 0.60 | `good` |
| ≥ 0.40 | `moderate` |
| ≥ 0.20 | `low` |
| < 0.20 | `very_low` |

---

## 7. Save validation

[`ScoringService.saveWeights`](../backend/src/scoring/scoring.service.ts#L146) runs, in order:
`assertKnownStructure` → `assertAnswerScoresInRange` → `assertQuestionWeightsSumTo100`, then the
atomic archive+activate, then an `SCORING_WEIGHTS_SAVED` audit event (actor = editor, `bankProgramId`
linked, `weightSetId` + `versionNumber` in the payload).

| Rule | Error code | HTTP |
|---|---|---|
| Every referenced question/option code exists in the global pool | `WEIGHTS_UNKNOWN_OPTION` | 422 |
| Each rule block sits on a question of the matching type (`answerScores` → choice types, `multiSelectRules` → `MULTI_SELECT`, `numericBands` → `NUMERIC`, `textRules` → `TEXT`); aggregation is one of the four | `WEIGHTS_RULE_TYPE_MISMATCH` | 422 |
| Every **weighted** question carries a usable rule for its own type | `WEIGHTS_MISSING_RULE` | 422 |
| Bands ordered, gapless, non-overlapping, −∞…+∞ | `WEIGHTS_NUMERIC_BANDS_INVALID` | 422 |
| Every score finite and within `[0, 100]` — option scores, band scores, text presence score | `WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE` | 422 |
| Each weight in `[0, 100]` and all weights sum to exactly 100 (±0.1 for decimal noise) | `WEIGHTS_QUESTION_WEIGHT_SUM_INVALID` | 422 |

`QUESTION_TYPE_NOT_SCOREABLE` is **retired but retained** (nothing throws it since v14.0.0).

Every code has Arabic + English strings in
[error-codes.ar-EG.json](../admin/src/i18n/error-codes.ar-EG.json) /
[error-codes.en-US.json](../admin/src/i18n/error-codes.en-US.json) — same PR, Principle III.

### Band rejection reasons

`WEIGHTS_NUMERIC_BANDS_INVALID` carries `{ questionCode, reason, index? }`:

`no_bands` · `malformed_band` · `unparseable_from` · `unparseable_to` · `empty_or_reversed_band` ·
`first_band_must_open_at_minus_infinity` · `only_the_first_band_may_open_at_minus_infinity` ·
`band_after_an_unbounded_band` · `gap_before_band` · `overlapping_band` ·
`last_band_must_close_at_plus_infinity` · `only_the_last_band_may_close_at_plus_infinity`

Full coverage is **required**, not warned about: an uncovered value earns nothing while still costing
the question's full weight, penalising the applicant for a hole in the config.

---

## 8. Admin API

Base `/api/admin/scoring` · JWT + roles `super_admin`, `sales_manager`
([admin-scoring.controller.ts](../backend/src/scoring/admin-scoring.controller.ts)).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/questions` | whole global pool, every type, with options + numeric bounds/unit + text max length + each question's `categories` |
| `GET` | `/programs/:programId/weights` | ACTIVE set, normalised to the current shape |
| `POST` | `/programs/:programId/weights` | save (direct, archives prior ACTIVE) |
| `GET` | `/programs/:programId/weights/history` | all sets, newest first |

`GET /questions` is deliberately **not** filtered to the program's category — an admin may weight a
question before its category assignment catches up. Each question carries `categories` so the editor
can warn instead of forbidding.

---

## 9. Factor breakdown

[`buildFactorBreakdown`](../backend/src/scoring/weighted-approval.service.ts#L88) → `ApprovalFactors`
persisted on the offer:

```
impact = Math.round(weight × answerScore ÷ denominator)     // same denominator the score used
```

- Only answers inside the asked set; zero-impact rows omitted; sorted biggest-first; `negative: []`.
- Uses **`answerScoreFor`** — the same function the formula used. Deriving it twice is how a breakdown
  starts disagreeing with the score it explains, and there are now four type-specific derivations to
  disagree about.
- `factorCode`: a single pick keeps its **option** code (unchanged pre-v14, so existing offers and the
  admin factor catalog still read the same); the other three types have no single option to name and
  are labelled by **question** code.

---

## 10. Reading legacy rows

[`normalizeWeights`](../backend/src/matching/scoring/approval-probability.scorer.ts#L124) — no DB
migration was ever needed for the shape changes:

| Stored shape | Read as |
|---|---|
| v14 (`questionWeights` + `answerScores` + any rule maps) | as-is, rule maps defaulted to `{}` |
| v8–v13 (`questionWeights` + `answerScores`, no rule maps) | as-is; its NUMERIC/TEXT/MULTI questions score 0 until an admin adds rules |
| v6/v7 (`{ questionCode: { optionCode: points } }`) | `answerScores` = that map; equal question weights synthesised summing to 100 |
| anything else / non-object | `emptyScoring()` |

Shape detection tests for the **presence** of the `questionWeights` / `answerScores` keys, not
truthiness — a v8 row saved with weights but no scores would otherwise fall into the legacy branch and
read the literal string `"questionWeights"` as a question code.

---

## 11. Admin UI

- **Wizard**, four steps ([scoring-weights-editor.page.ts](../admin/src/app/features/questionnaire/scoring-weights-editor.page.ts),
  route `/scoring/weights/:programId`): ① pick the scored questions → ② share 100% of importance
  (with "Distribute evenly"; entering step 2 on an all-zero budget auto-spreads and says so) →
  ③ score every answer, **controls chosen by question type** → ④ review + save.
- Step 3 renders per type: option score sliders (both choice types) · aggregation select
  (`MULTI_SELECT`) · [`app-score-bands-editor`](../admin/src/app/shared/ui/score-bands-editor.component.ts)
  (`NUMERIC`) · a single presence score (`TEXT`).
- The bands editor edits **edges only** (row 1 opens at −∞, last closes at +∞, each row starts where
  the previous ended) → gaps and overlaps are *unrepresentable*, not merely validated. Client mirror
  [`scoreBandsErrorFor`](../admin/src/app/shared/ui/score-bands-editor.component.ts#L24) returns
  `NO_BANDS | EDGE_MISSING | NOT_ASCENDING`; the host gates its own save on the same verdict. Server
  re-checks regardless.
- Per-row **"not asked"** tag + a summary warning when a weighted question's `categories` exclude the
  program's own category — warn, never block.

### Customer-facing wording (mobile)

`{pct}% match` / `{pct}% match score`, and **"Not rated yet"** when `usedDefault`
([intl_en.arb:653](../masrafy-app/lib/l10n/intl_en.arb#L653)). Never "guarantee" and never
"probability of approval" — the number has never been compared to a real bank decision.

---

## 12. Worked example

Program weights (personal): `monthly_income 40`, `other_income_sources 25`, `employer_name 15`,
`marital_status 20` → 100. Rules as in §3.

Applicant (personal) is asked all four, answers three:

| Question | Answer | Rule → score |
|---|---|---|
| `monthly_income` (NUMERIC) | `12000` | band `[5000, 15000)` → **60** |
| `other_income_sources` (MULTI) | `salary` + `freelance` | `AVERAGE(100, 40)` → **70** |
| `employer_name` (TEXT) | `"ABK"` | presence → **100** |
| `marital_status` (SINGLE) | *skipped* | — |

```
denominator = 40 + 25 + 15 + 20                     = 100
numerator   = 40×0.60 + 25×0.70 + 15×1.00 + 0       = 24 + 17.5 + 15 = 56.5
probability = 0.565    → score 57   → tier moderate
factors     = income 24 · other_income 18 · employer 15   (sums to 57 ✓)
```

**Same program, now also weighting a car-only question.** Weights `monthly_income 32`,
`other_income_sources 20`, `employer_name 12`, `marital_status 16`, `car_type 20`. A *personal*
applicant is never asked `car_type`:

```
denominator = 100 − 20 (car_type not asked)         = 80
numerator   = 32×0.60 + 20×0.70 + 12×1.00           = 19.2 + 14 + 12 = 45.2
probability = 45.2 / 80 = 0.565 → score 57          ← identical, as it should be
```

Pre-v13.0.0 this divided by a flat 100 → **45%**, and no screen said why. That is the defect the
asked-weight denominator fixed.

---

## 13. Invariants (A33 — review blocks)

1. Never mutate an ACTIVE weight set in place.
2. No hardcoded question weights or answer scores; no hand-typed questionnaire codes.
3. No scoring or eligibility fields on `Question` / `QuestionOption` — they are pure content.
4. No eligibility gates in preview or apply.
5. Probability by **no** formula other than §1 — not a flat-100 denominator, not scoring an unasked
   question, not omitting an asked-but-unanswered question from the denominator, not letting preview
   and apply derive the asked set differently.
6. Assigned question weights sum to 100; every answer score in `0..100`.
7. No `category` column on `Question`/`QuestionGroup`/`QuestionnaireVersion`; no per-category
   questionnaire. One pool, one snapshot; per-category scoping lives **only** in
   `question_loan_category`, frozen into the snapshot, and a category-filtered read fails loudly on an
   unknown category.
8. No keyword/regex scoring of free text.

---

## 14. Code map

| Concern | File |
|---|---|
| Formula, tiers, per-type score, bands, normalisation | [backend/src/matching/scoring/approval-probability.scorer.ts](../backend/src/matching/scoring/approval-probability.scorer.ts) |
| Answer → `SelectedAnswer` (shared by both paths) | [backend/src/matching/scoring/answer-to-selected.ts](../backend/src/matching/scoring/answer-to-selected.ts) |
| The single scoring entry point + factor breakdown | [backend/src/scoring/weighted-approval.service.ts](../backend/src/scoring/weighted-approval.service.ts) |
| Save validation, weightable questions, history | [backend/src/scoring/scoring.service.ts](../backend/src/scoring/scoring.service.ts) |
| Atomic archive + activate | [backend/src/scoring/scoring.repository.ts](../backend/src/scoring/scoring.repository.ts) |
| Admin endpoints | [backend/src/scoring/admin-scoring.controller.ts](../backend/src/scoring/admin-scoring.controller.ts) |
| Payload shape + OpenAPI example | [backend/src/scoring/dto/scoring.dto.ts](../backend/src/scoring/dto/scoring.dto.ts) |
| Scoreable types, content rules | [backend/src/questionnaire/validation/question-type-rules.ts](../backend/src/questionnaire/validation/question-type-rules.ts) |
| Branch visibility (shared) | [backend/src/questionnaire/validation/question-visibility.ts](../backend/src/questionnaire/validation/question-visibility.ts) |
| Asked set — apply | [backend/src/questionnaire/questionnaire.service.ts](../backend/src/questionnaire/questionnaire.service.ts) (`resolveAnswers`) |
| Asked set — preview | [backend/src/matching-preview/matching-preview.service.ts](../backend/src/matching-preview/matching-preview.service.ts) |
| Score written onto offers | [backend/src/applications/applications.service.ts](../backend/src/applications/applications.service.ts) (`applyPerBankScoring`) |
| Admin wizard | [admin/src/app/features/questionnaire/scoring-weights-editor.page.ts](../admin/src/app/features/questionnaire/scoring-weights-editor.page.ts) |
| Band control + client mirror | [admin/src/app/shared/ui/score-bands-editor.component.ts](../admin/src/app/shared/ui/score-bands-editor.component.ts) |

## 15. Tests

| Spec | Covers |
|---|---|
| [asked-weight-denominator.spec.ts](../backend/test/unit/asked-weight-denominator.spec.ts) | denominator = asked weight, skips, unasked weight, mixed types |
| [numeric-band-scoring.spec.ts](../backend/test/unit/numeric-band-scoring.spec.ts) | `[from, to)` edges, ±∞, Decimal comparison |
| [multi-select-aggregation.spec.ts](../backend/test/unit/multi-select-aggregation.spec.ts) | all four modes, unscored picks, default |
| [text-presence-scoring.spec.ts](../backend/test/unit/text-presence-scoring.spec.ts) | presence only, blank = skip |
| [scoring-type-guard.spec.ts](../backend/test/unit/scoring-type-guard.spec.ts) | rule/type mismatch + missing rule |
| [question-type-rules.spec.ts](../backend/test/unit/question-type-rules.spec.ts) | content rules per type |
| [preview-asked-set-parity.spec.ts](../backend/test/integration/preview-asked-set-parity.spec.ts) | preview and apply derive the same asked set |
| [matching-preview-typed-answers.spec.ts](../backend/test/integration/matching-preview-typed-answers.spec.ts) | all four types reach the scorer |
| [questionnaire-category-assignment.spec.ts](../backend/test/integration/questionnaire-category-assignment.spec.ts) | category scoping + parked questions |
| [questionnaire-legacy-snapshot.spec.ts](../backend/test/integration/questionnaire-legacy-snapshot.spec.ts) | pre-v12 snapshot with no frozen `categories` |

---

## Appendix — stale comments spotted while writing this

Two doc comments still describe the pre-v14.0.0 single-type world; the code beneath them is correct.

1. [questionnaire.service.ts:~532](../backend/src/questionnaire/questionnaire.service.ts#L532) —
   *"Non-scoreable codes are left in — a weight set can only name SINGLE_SELECT questions, so the
   scorer's intersection drops them anyway."*
2. [matching-preview.service.ts:~131](../backend/src/matching-preview/matching-preview.service.ts#L131) —
   *"Only SINGLE_SELECT carries an answer score (R9), so multi-pick / text / number answers are
   validated and then dropped from the scoring input"* — contradicted ~35 lines below by the
   `toSelectedAnswer` call it now makes.
