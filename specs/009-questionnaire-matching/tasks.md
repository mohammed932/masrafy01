# Tasks — Feature 009 Dynamic Questionnaire & Matching

Legend: [x] done · [ ] pending

## Phase 1 — Constitution
- [x] T001 Amend Principle V → v4.1.0 (admin-editable questionnaire + weights, maker-checker), Anti-Pattern A33, CLAUDE.md sync.

## Phase 2 — Schema
- [x] T002 Enums + tables (question_group/question/question_option/questionnaire_version/application_answer/scoring_factor/scoring_weight_set); application.category+questionnaireVersionId; bank_program.scoringWeightSets. Migration `20260602130000` applied.

## Phase 3 — Questionnaire backend
- [x] T003 Repository (groups/questions/options/versions).
- [x] T004 Service: slug codegen (immutable codes), enabledWhen validation (no forward refs/dangling), soft-delete dependency guard, publish→snapshot (OPTION_MISSING_SCORE_VALUE guard), history, rollback, draftTree.
- [x] T005 Public `GET /v1/questionnaire/:category` (CustomerJwtGuard).
- [x] T006 Admin CRUD + versioning controller (JwtAuthGuard + Roles).

## Phase 4 — Scoring backend
- [x] T007 Repository (factors + weight-set lifecycle, atomic approve).
- [x] T008 Service maker-checker (draft/submit sum=100/approve checker≠maker/reject) + audit events.
- [x] T009 Admin scoring controller.

## Phase 5 — Matching
- [x] T010 Pure approval-probability scorer (formula/tiers/DBR-comfort/default-weights).
- [x] T011 `POST /v1/matching/preview` (JWT + profile-complete): answer validation + new-scoring ranking.
- [ ] T012 Eligibility hard-gates + installment/fees via feature-003 engine (answer→ApplicantProfile bridge) + rejectionReasons + suggestions.
- [ ] T013 Apply re-check (`PROGRAM_NO_LONGER_MATCHES`) + persist application_answer rows + category + questionnaireVersionId.

## Phase 6 — Admin UI (Angular)
- [ ] T014 Questionnaire editor (overview, tree editor, question detail, branching picker, preview panel, version history) — invoke promax before, impec after (Principle XXIII).
- [ ] T015 Scoring weights maker-checker UI (weights table sum-100 guard, status badge, approval inbox + diff, history).
- [ ] T016 Bank-program editor additions for eligibility thresholds (if flat columns adopted) — currently reuses existing JSON eligibility.

## Phase 7 — Mobile (Flutter)
- [ ] T017 Data/domain/presentation layers (Constitution XXX–XXXVI): models, repo, cubit.
- [ ] T018 Dynamic renderer (QuestionRenderer per type, enabledWhen branching, shape-matched shimmer).
- [ ] T019 Category picker + matches preview + offer detail pages.

## Phase 8 — Spec/tests/seeds
- [x] T020 spec.md + tasks.md.
- [ ] T021 Test harness + ≥90% coverage of scorer + matchers (Principle V).
- [ ] T022 Seeds: scoring factors + first ACTIVE weight sets + initial questionnaire versions per category.
- [ ] T023 Admin i18n + Flutter ARB for new client-visible error codes.
