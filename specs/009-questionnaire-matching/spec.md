# Feature 009 — Dynamic Questionnaire & Matching Engine

**Status:** Backend foundation shipped (Phases 1–5 core); admin/mobile/eligibility pending.
**Constitution alignment:** II (4-category scope-lock), V v4.1.0 (engine IP + admin-editable questionnaire/weights + maker-checker), III (typed errors), IV (Arabic-first), VI (PII), XIII/XXXVII (JWT-gated, no guest — reconciled with v4.0.0).

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
- `POST /v1/matching/preview` → ranked matches by approval probability.

**Admin (JwtAuthGuard + Roles):**
- `admin/questionnaire/*` — group/question/option CRUD, `tree/:category`,
  `versions/:category/publish|history`, `versions/:category/rollback/:versionId`.
- `admin/scoring/*` — `factors/:category` (+ create), `programs/:id/weights`,
  `weights/draft`, `weights/submit`, `weights/:setId/approve|reject`,
  `weights/pending`, `programs/:id/weights/history`. Maker-checker enforced
  (checker ≠ maker, weights sum 100, atomic activate+archive, audited).

## 5. Approval probability (shipped — `src/matching/scoring/approval-probability.scorer.ts`)
Pure: `computeProbability(weights, subScores)=Σ(subScore×weight)/100`; `tierFor`
(excellent ≥.80 / good ≥.60 / moderate ≥.40 / low ≥.20 / very_low); `computeDbrComfort`
(COMPUTED); `defaultWeights` fallback (no ACTIVE set ⇒ equal split, nothing unscored).

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
