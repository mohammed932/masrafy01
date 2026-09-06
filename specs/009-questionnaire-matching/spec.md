# Feature 009 — Dynamic Questionnaire & Matching Engine

**Status:** Backend foundation shipped (Phases 1–5 core); admin/mobile/eligibility pending.
**Constitution alignment:** II (4-category scope-lock), V ~~v4.1.0 (engine IP + admin-editable questionnaire/weights + maker-checker)~~ — **now v25.0.0: the questionnaire half stands, the weights half is deleted and maker-checker was already replaced by direct save in v5.0.0** — III (typed errors), IV (Arabic-first), VI (PII), XIII/XXXVII (JWT-gated, no guest — reconciled with v4.0.0).

> **Reconciliation note (vs the original draft):** the original draft made
> `GET /questionnaire/:category` and `POST /matching/preview` **anonymous**. That
> conflicts with constitution **v4.0.0** (guest mode removed). Per decision, these
> endpoints are **JWT-gated** (customer Bearer + profile-complete). No guest mode.
> Per-bank scoring weights required the **v4.1.0** amendment to Principle V
> (maker-checker replacing PR review for weights) — done.

## 1. Goal
Ask each customer 12–18 category-tailored questions (Personal / Mortgage / Car /
Business), run answers through the matching engine, return ranked bank programs.
Questions + per-bank scoring weights + per-option sub-scores are **admin-editable
DATA**; the formula, tier thresholds, and COMPUTED factors stay **code** (Principle V).

## 2. The data/code boundary
| Concern | Where | Who changes |
|---|---|---|
| Questions / options / branching / order | DB (admin) | Ops via dashboard |
| Per-option sub-score (`scoreValue` 0–1) | DB (admin) | Ops (expert-guided) |
| Per-bank weights (sum to 100) | DB (admin, maker-checker) | Two admins |
| Formula `Σ(subScore×weight)/100`, tiers, COMPUTED factors (DBR) | Code | Engineers (PR, ≥90% tests) |

## 3. Data model (shipped — migration `20260602130000`)
`question_group`, `question`, `question_option`, `questionnaire_version`
(immutable published snapshot), `application_answer`, `scoring_factor`,
`scoring_weight_set` + enums `LoanCategory` (lowercase, 4 values),
`QuestionType`, `QuestionSystemRole`, `ScoringFactorKind`, `ScoringWeightSetStatus`.
`application` gained nullable `category` + `questionnaireVersionId`; `bank_program`
gained `scoringWeightSets`. Codes are auto-generated (slugify) + immutable (A33).

## 4. Endpoints (shipped)
**Mobile (CustomerJwtGuard [+ profile-complete on preview]):**
- `GET /v1/questionnaire/:category` → active snapshot.
- `POST /v1/matching/preview` → matches ranked by the applicant's own stated `priority` answer (v25.0.0; there is no approval probability).

**Admin (JwtAuthGuard + Roles):**
- `admin/questionnaire/*` — group/question/option CRUD, `tree/:category`,
  `versions/:category/publish|history`, `versions/:category/rollback/:versionId`.

## ~~5. Approval probability (shipped)~~ — REMOVED (v25.0.0)

> **REMOVED in v25.0.0.** `src/matching/scoring/approval-probability.scorer.ts` is deleted, along
> with `computeProbability`, `tierFor`, the five tiers, `computeDbrComfort`, the `defaultWeights`
> equal-split fallback, the `scoring_weight_set` table and the whole `/admin/scoring/*` surface
> (removed from §4 above). Every weight-set code §7 lists went with them —
> `WEIGHTS_MUST_SUM_TO_100`, `APPROVER_MUST_DIFFER_FROM_MAKER`, `WEIGHT_SET_NOT_DRAFT/PENDING`,
> `WEIGHTS_UNKNOWN_FACTOR`, and `OPTION_MISSING_SCORE_VALUE` with them, none of which is in
> `error-codes.ts` any more — as did §6's "scoring-weights maker-checker" admin-UI deliverable,
> which is not pending work but cancelled work. §3 above stays as written because it is a true
> statement about what migration `20260602130000` created at the time; three of the things it
> created — `scoring_factor`, `scoring_weight_set` and the `ScoringFactorKind` /
> `ScoringWeightSetStatus` enums — have since been dropped again.
>
> Why: the number was never once compared against a bank decision. Both the sub-scores and the
> weights were figures an admin typed, so the output was a measure of agreement with the admin, not
> of what a bank would do — v13.0.0 had already had to reword it on mobile from "Guarantee
> Approval" to "% match", which was the admission in public. A33 now blocks reintroducing a score,
> a tier or a per-program answer-weighting table under any name without a constitution amendment;
> earning it back needs the outcome loop — real bank decisions recorded against the answers that
> preceded them, see [matching-engine-review.md](../matching-engine-review.md) item 7 — not a rewrite.
>
> **What replaced it is an order, not a smaller score.** `rankOffers(offers, priority)` sorts by the
> key the applicant's own `priority` answer names, and the apply path freezes that output on each
> row as `bank_offer.rankIndex` (Int, 0-based, dense per application, never updated —
> Principle I / A6); every read of a persisted offer orders by it. This was always in the code and
> the score used to override it — somebody who asked for the lowest monthly payment was shown the
> highest-scoring offer first.

## 6. Remaining work
- **Eligibility hard-gates + installment/fees** in preview: reuse feature-003
  `EngineService` (map dynamic answers → `ApplicantProfile` via `systemRole`
  numericPoint; needs an answer→profile bridge). Add `rejectionReasons` +
  `suggestions` (LOWER_AMOUNT / EXTEND_TENOR).
- **Apply re-check**: `/v1/applications/apply` re-runs matcher on the chosen
  program → `PROGRAM_NO_LONGER_MATCHES`; persist `application_answer` rows +
  `category` + `questionnaireVersionId`.
- **Admin UI (Angular)**: questionnaire editor (tree, branching picker, preview)
  + scoring-weights maker-checker (sum-100 guard, approval inbox, diff).
- **Mobile (Flutter)**: dynamic renderer (one widget per `QuestionType`,
  `enabledWhen` branching) + matches preview.
- **Tests**: no runner configured in repo (testing dropped from gates v1.2.0);
  add a harness, then ≥90% coverage of the scorer + matchers (Principle V).
- **Seeds**: scoring factors per category + first ACTIVE weight set per program;
  initial questionnaire versions.

## 7. Error codes (shipped)
`QUESTIONNAIRE_NOT_PUBLISHED`, `UNKNOWN_QUESTION_CODE`, `UNKNOWN_OPTION_CODE`,
`OPTION_MISSING_SCORE_VALUE`, `ENABLED_WHEN_INVALID`, `QUESTION_IN_USE`,
`WEIGHTS_MUST_SUM_TO_100`, `APPROVER_MUST_DIFFER_FROM_MAKER`,
`WEIGHT_SET_NOT_DRAFT/PENDING`, `WEIGHTS_UNKNOWN_FACTOR`,
`PROGRAM_NO_LONGER_MATCHES` (reserved for apply re-check). Mirror to admin i18n +
Flutter ARB when surfaced on those clients (Principle III).
