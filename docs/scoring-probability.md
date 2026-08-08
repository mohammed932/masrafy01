# Match Score — How It Is Calculated

Masrafy's matching engine turns a customer's questionnaire answers into a
**match score** (0–100%) for each bank program, using a **two-level weighted
model** (Constitution Principle V).

> The number is a *fit score against the bank's own configured preferences* — it
> has never been compared to a real bank decision, which is why the mobile app
> words it "{pct}% match score", not "approval probability".

## The two things an admin sets, per bank program

| Concept | Range | Meaning |
|---|---|---|
| **Question weight** | the program's weights sum to **100** | How much *this question matters* to this bank. |
| **Answer score** | **0–100** | How good the *customer's actual answer* is for that one question. 100 = ideal, 0 = worst. |

They are independent. A score is **not** a slice of the question's weight —
every answer inside a question may score 100 if the bank likes them all equally.

> Weight decides the **ceiling** a question can contribute.
> The answer's score decides **how much of that ceiling** the customer earns.

## Formula

```
              Σ over ANSWERED questions ( weight × score / 100 )
match score = ──────────────────────────────────────────────────
                    Σ over ASKED questions ( weight )
```

Result is clamped to 0..1, then `Math.round(× 100)` for display.

### The denominator is the ASKED set, not a flat 100

**Asked** = the question is active **and** assigned to the customer's loan
category **and** still visible after branching. There is no question-type
filter — every type scores.

This matters twice:

- Two programs weighting **different** question sets are still comparable —
  each is judged only on what this customer was actually shown.
- A program that puts weight on a question this customer's category never asks
  loses it from **both** sides of the fraction, so a misconfiguration can't cap
  that program below 100% forever.

| Situation | Numerator | Denominator |
|---|---|---|
| Asked + answered | earns `weight × score/100` | counted |
| Asked + skipped | earns **0** | **counted** (skipping costs you) |
| Asked + answered, but bank configured no score for it | earns **0** | **counted** |
| Not asked | ignored | **not** counted |

Nothing asked, or no weight on anything asked → score **0**, never `NaN`.

## One answer → one 0–100 score, by question type

| Type | How the score is derived |
|---|---|
| `SINGLE_SELECT` | the picked option's score |
| `MULTI_SELECT` | the picked options' scores combined by the program's `aggregation`: `AVERAGE` (default) · `SUM_CAPPED` (sum, capped at 100) · `MAX` · `MIN`. A picked option the bank never scored counts as 0. |
| `NUMERIC` | the score of the band the value falls in — half-open `[from, to)`, ordered and gapless, `null` edge = ±∞, Decimal comparison (no floats) |
| `TEXT` | **presence only** — `answeredScore` if non-blank, nothing if blank. Keyword/regex scoring is forbidden. |

Unknown option codes and unparseable values degrade to 0 — a bad row can cost a
program points, but can never fail a match request.

## Worked example — all 3 questions asked

Program weights: Income 50, Employment 30, Housing 20 (sum = 100).
All three are asked, all three answered.

| Question | Weight | Answer score | Earns |
|---|---|---|---|
| Income | 50 | 80 | 50 × 0.80 = **40** |
| Employment | 30 | 100 | 30 × 1.00 = **30** |
| Housing | 20 | 50 | 20 × 0.50 = **10** |
| **Sum** | **100** | | **80** |

`80 ÷ 100 = 0.80` → **80%**

## Worked example — one question not asked

Same program. The customer picked **car**, and `housing_status` is only
assigned to `mortgage`, so it is never asked.

| Question | Weight | Asked? | Answer score | Earns | In denominator |
|---|---|---|---|---|---|
| Income | 50 | yes | 80 | **40** | 50 |
| Employment | 30 | yes | 100 | **30** | 30 |
| Housing | 20 | **no** | — | 0 | **0** |
| | | | | **70** | **80** |

`70 ÷ 80 = 0.875` → **88%** — not 70%. The unasked question left both sides.

## Worked example — asked but skipped

Same as above, but `housing_status` **is** asked (mortgage) and the customer
skips it:

`70 ÷ 100 = 0.70` → **70%**. The weight stays in the denominator and earns
nothing. Answering more always improves the match.

## Tiers

`tierFor(probability)` — thresholds live in code, not admin data:

| Score | Tier |
|---|---|
| ≥ 80% | `excellent` |
| ≥ 60% | `good` |
| ≥ 40% | `moderate` |
| ≥ 20% | `low` |
| < 20% | `very_low` |

## Not rated

A program with **no ACTIVE weight set** scores 0 and is flagged `usedDefault`,
persisted on the offer as `bank_offer.approvalUsedDefault`. The mobile app
renders **"Not rated yet"** — never "0% match" and never `very_low`. An
unconfigured program must not read as a bad fit.

## Save-time rules (admin editor)

- Question weights must total **exactly 100**; each answer score must be **0–100**.
- Every weighted question needs a rule for its type, or the save is rejected
  (`WEIGHTS_MISSING_RULE`) — otherwise it would eat denominator weight it can
  never earn back.
- Numeric bands must be ordered and gapless (`WEIGHTS_NUMERIC_BANDS_INVALID`);
  a rule of the wrong type is rejected (`WEIGHTS_RULE_TYPE_MISMATCH`).
- Saving is direct (no maker-checker); the editor's id is audited and the
  archive+activate is atomic.
- Legacy single-level rows (v6/v7) are upgraded on read with equal question
  weights — no migration.

## Code map

| What | Where |
|---|---|
| Formula, per-type scoring, tiers | [`approval-probability.scorer.ts`](../backend/src/matching/scoring/approval-probability.scorer.ts) — `computeProbability`, `answerScoreFor`, `bandFor`, `tierFor` |
| Rounding, `usedDefault`, factor breakdown | [`weighted-approval.service.ts`](../backend/src/scoring/weighted-approval.service.ts) |
| Answer → `SelectedAnswer` (shared by preview + apply) | [`answer-to-selected.ts`](../backend/src/matching/scoring/answer-to-selected.ts) |
| Asked-set derivation (shared, so preview and apply can't drift) | [`question-visibility.ts`](../backend/src/questionnaire/validation/question-visibility.ts) |

## Deeper docs

- [specs/questions-and-weights-flow.md](../specs/questions-and-weights-flow.md) — end-to-end admin → customer walkthrough
- [specs/weights-and-scoring-reference.md](../specs/weights-and-scoring-reference.md) — storage shapes, edge cases, invariants, tests
