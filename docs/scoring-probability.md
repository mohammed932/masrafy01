# Approval Scoring — How Probability Is Calculated

Masrafy's matching engine turns a customer's questionnaire answers into an
**approval probability** (0–100%) for each bank program, using a **two-level
weighted model** (Constitution Principle V).

## The two axes (they don't compete)

| Concept | Range | Meaning | Set by |
|---|---|---|---|
| **Question weight** | all questions sum to **100** | How *much this question matters* to the decision — its share of the whole. | Admin, per program |
| **Answer score** | **0–100** per answer | How *good the customer's chosen answer is* for that one question. 100 = ideal, 0 = worst. | Admin, per program |

- **Weight** = the *importance* of a question.
- **Score** = the *quality* of the specific answer the customer picked.

They are independent: every answer inside a question can be 100 if you want.
Scores are **not** a split of the question's weight.

## Formula

```
probability = Σ over answered questions ( questionWeight / 100 × pickedAnswerScore / 100 )
            (clamped to the 0..1 range)
```

Per-question contribution:

```
contribution = (weight / 100) × (score / 100)
```

A question contributes **at most its own weight** (when the picked answer scores 100).
Because all weights sum to 100, the sum of every question's maximum contribution is
`Σ weight / 100 = 100 / 100 = 1.0 = 100%`. That is why perfect answers everywhere
produce exactly 100%.

> **weight decides the ceiling each question can contribute; the picked answer's
> score decides how much of that ceiling the customer actually gets.**

## Worked example (3 questions)

| Question | Weight | Picked answer score | Contribution |
|---|---|---|---|
| Income | 50 | 80 | 0.50 × 0.80 = **0.40** |
| Employment | 30 | 100 | 0.30 × 1.00 = **0.30** |
| Age | 20 | 50 | 0.20 × 0.50 = **0.10** |
| **Total** | **100** | — | **0.80 → 80% approval** |

## Example from the editor

Question `needs_consultant`, weight **5%**:

| Picked answer | Answer score | Contribution added |
|---|---|---|
| Yes | 55 | 0.05 × 0.55 = **2.75%** |
| No | 32 | 0.05 × 0.32 = **1.60%** |
| (best possible) | 100 | 0.05 × 1.00 = **5.00%** (the question's full weight) |

## Notes

- No ACTIVE weight set for a program → probability **0**.
- Question weights **must total exactly 100** to save; each answer score must be **0–100**.
- Legacy single-level weight sets are upgraded on read with equal question weights.
- Reference implementation:
  - `computeProbability()` — `backend/src/matching/scoring/approval-probability.scorer.ts`
  - `WeightedApprovalService` — `backend/src/scoring/weighted-approval.service.ts`
