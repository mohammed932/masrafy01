# Tasks: Lead Management & Application Review Dashboard

**Branch**: `005-lead-management-application`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md)
**Contracts**: [openapi.yaml](./contracts/openapi.yaml) · [error-codes.md](./contracts/error-codes.md) · [reason-codes.md](./contracts/reason-codes.md)
**Quickstart**: [quickstart.md](./quickstart.md)

Total: **92 tasks** across 8 phases. Tests intentionally NOT generated (constitution v1.2.0 dropped XVI + XXVII). MVP scope = Phases 1 + 2 + 3 (US1 — activity logging end-to-end). All later phases compose on top.

Story labels: [US1] agent activity logging (P1) · [US2] manager triage + reassign (P1) · [US3] analyst aggregates (P2) · [US4] customer milestone timeline (P3) · [US5] stale-lead cron (P2).

`[P]` = parallelizable: touches different files than any other in-flight task in the same phase. Cross-phase ordering still applies.

---

## Phase 1 — Setup

- [X] T001 Pull develop and merge into 005-lead-management-application: `git fetch origin && git merge --no-ff origin/develop` from repo root; resolve any conflict.
- [X] T002 Install new backend dependencies in `backend/package.json`: `npm i @nestjs/schedule @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` and commit `package-lock.json`.
- [X] T003 Add MinIO service to `docker/compose.dev.yml` per [quickstart.md §1](./quickstart.md#1--bring-up-minio--apply-migration-dev) (image `minio/minio:latest`, ports 9000/9001, named volume `minio_data`).
- [X] T004 Bring up MinIO + create the dev bucket: `docker compose -f docker/compose.dev.yml up -d minio && docker exec masrafy_minio_dev mc mb local/masrafy-documents-development --ignore-existing` (use commands from quickstart §1).
- [X] T005 Add S3-compatible env vars to `backend/.env.example` (`S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`) and extend `backend/src/infra/env/env.schema.ts` Zod schema with the same keys.

---

## Phase 2 — Foundational (blocking prerequisites)

- [X] T006 Add `LeadStatus` Prisma enum to `backend/prisma/schema.prisma` per [data-model.md §3](./data-model.md#3-leadstatus-enum--application-column-additions): `needs_first_contact | document_collection | ready_for_submission | submitted_to_bank | bank_decided`.
- [X] T007 Add 5 new values to `AuditEventType` in `backend/prisma/schema.prisma`: `APPLICATION_ACTIVITY_LOGGED`, `DOCUMENT_UPLOADED`, `APPLICATION_REASSIGNED`, `MANAGER_ATTENTION_REQUESTED`, `APPLICATION_LEAD_STATUS_CHANGED`.
- [X] T008 Add `Activity` model to `backend/prisma/schema.prisma` per [data-model.md §1](./data-model.md#1-activity--new-table) including the 4 indexes (`idx_activity_application_occurred`, `idx_activity_actor_occurred`, `idx_activity_followup` partial, `idx_activity_type_reason`).
- [X] T009 Add `Document` model to `backend/prisma/schema.prisma` per [data-model.md §2](./data-model.md#2-document--new-table) including the 2 indexes.
- [X] T010 Extend `Application` model in `backend/prisma/schema.prisma` with `assignedAgentStaffId` (nullable), `assignedAt` (nullable), `leadStatus LeadStatus @default(needs_first_contact)` + 2 indexes (`idx_application_agent_lead_status`, `idx_application_lead_status_created`); add `assignedAgent` + `activities` + `documents` back-relations.
- [X] T011 Add `StaffAccount` back-relations to `backend/prisma/schema.prisma`: `assignedLeads`, `activitiesAuthored`, `documentsUploaded`, `documentsVerified`.
- [X] T012 Generate the migration: `cd backend && npx prisma migrate dev --name lead_management_activity --create-only`. Open `migration.sql` and append the trigger SQL from [data-model.md §1](./data-model.md#append-only-enforcement-r-001) + the system-actor INSERT from [data-model.md §4](./data-model.md#reserved-system-actor-r-006). Wrap the file in `BEGIN; ... COMMIT;`.
- [X] T013 Apply the migration + regenerate Prisma client: `npx prisma migrate dev && npx prisma generate`.
- [X] T014 [P] Add 7 new error codes to `backend/src/common/errors/error-codes.ts` per [contracts/error-codes.md](./contracts/error-codes.md): `ACTIVITY_FORBIDDEN_NOT_ASSIGNED`, `INVALID_ACTIVITY_REASON`, `REASON_DETAILS_REQUIRED`, `DURATION_REQUIRED_FOR_CALL`, `FOLLOWUP_IN_PAST`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED` + their HTTP-status map entries.
- [X] T015 [P] Add 7 corresponding exception classes to `backend/src/common/errors/domain.exceptions.ts`: `ActivityForbiddenNotAssignedException`, `InvalidActivityReasonException`, `ReasonDetailsRequiredException`, `DurationRequiredForCallException`, `FollowupInPastException`, `FileTooLargeException`, `FileTypeNotAllowedException`.
- [X] T016 [P] Add AR translations for the 7 codes to `admin/src/i18n/error-codes.ar-EG.json` per [contracts/error-codes.md](./contracts/error-codes.md).
- [X] T017 [P] Add EN translations to `admin/src/i18n/error-codes.en-US.json`.
- [X] T018 [P] Extend `ErrorCode` union in `admin/src/app/core/auth/auth.types.ts` with the 7 new codes.
- [X] T019 [P] Create `backend/src/activities/activities.types.ts` exporting `ActivityType` + `ReasonCode` unions per [reason-codes.md](./contracts/reason-codes.md).
- [X] T020 [P] Create `backend/src/activities/activity-reasons.ts` with `ACTIVITY_REASONS: Readonly<Record<ActivityType, readonly ReasonCode[]>>` `as const` mirroring the matrix; export a `validateActivityReason(type, reason)` helper returning typed boolean.
- [X] T021 Create empty backend module shells: `backend/src/activities/activities.module.ts`, `backend/src/documents/documents.module.ts`, `backend/src/lead-analytics/lead-analytics.module.ts`. Each is `@Module({})` for now.
- [X] T022 Register the 3 new modules under `imports:` of `backend/src/app.module.ts`.
- [X] T023 Add `ScheduleModule.forRoot()` to `backend/src/app.module.ts` imports so cron decorators register at boot.
- [X] T024 Extend Pino redact paths in `backend/src/common/pino/pino.config.ts` per [research.md R-011](./research.md#r-011--pii-redaction-in-pino-logs): `req.body.note`, `req.body.attachedDocumentIds`, `req.body.originalFilename`, `res.body.data.activity.note`, `res.body.data.activity.attachedDocuments`, `res.body.data.applicantProfile.*`.

**Phase 2 checkpoint**: schema migrated · append-only trigger live · system-actor seeded · 7 error codes round-trip AR/EN · 3 module shells wired · cron module registered · Pino redaction extended.

---

## Phase 3 — User Story 1 (P1): Sales Agent Logs Activity

**Goal**: a `sales_agent` opens an assigned application's detail page, clicks **Add Activity**, picks type + reason, optionally attaches documents (via S3-compatible presigned PUT) + optionally sets a follow-up reminder, and saves. Activity persists; audit events fire with shared `correlationId`; `leadStatus` transitions per the adapter; timeline updates within 1 s.

**Independent test**: [quickstart.md §4–§6](./quickstart.md#4--log-first-agent-activity-operator-sales_agent). Sign in as a `sales_agent`, log activities across all activity types (with + without attachments + with + without follow-up); verify timeline updates, audit events fire, `leadStatus` transitions match the adapter table.

### 3.1 Documents module (S3-compatible upload pipeline)

- [X] T025 [US1] Create `backend/src/documents/s3-storage.client.ts` — wraps `@aws-sdk/client-s3` `S3Client` constructed from env (endpoint, region, credentials, forcePathStyle). Exposes `getPresignedPutUrl(key, contentType, ttlSec)` + `getPresignedGetUrl(key, ttlSec)` + `headObject(key)` helpers.
- [X] T026 [US1] Create `backend/src/documents/documents.repository.ts` — Prisma access for `Document`: `create`, `findById`, `findManyByApplication`, `markVerified(id, by)`, `markRejected(id, by)`. NO `update` for `s3Key` after create (immutability).
- [X] T027 [US1] Create `backend/src/documents/documents.service.ts` — `requestUploadUrl({ applicationId, documentType, mimeType, sizeBytes, actor })`: validates `documentType` against `PlatformEnumeration` registry, validates file size + mime, generates a cuid `documentId`, computes the S3 key (`applications/<applicationId>/<documentId>.<ext>`), returns `{ documentId, uploadUrl, expiresAt }`. Throws `FileTooLargeException` / `FileTypeNotAllowedException` / `UnknownEnumerationKeyException`. Plus `getDownloadUrl(documentId, requester)` with role-gated access check.
- [X] T028 [US1] Create `backend/src/documents/dto/request-upload-url.dto.ts` (class-validator) + `dto/document.response.dto.ts` (Swagger).
- [X] T029 [US1] Create `backend/src/documents/documents.controller.ts` — `@Controller('admin/documents')` + JWT + RolesGuard. `POST upload-url` (super_admin / sales_manager / sales_agent) returns presigned PUT. `GET :id/download` (same roles + analyst can NOT) returns presigned GET URL. Register controller + repository + service + S3 client in `documents.module.ts`.
- [X] T030 [US1] Helper `stripPiiFromFilename(filename, applicantName): string` in `backend/src/documents/filename-pii.ts` — strips substrings matching first/last name (case-insensitive) and replaces with `_redacted_`. Called by the activity-create handler before persisting `originalFilename`.

### 3.2 Activities module (activity-create flow)

- [X] T031 [US1] Create `backend/src/activities/activities.repository.ts` — Prisma access for `Activity`. Exposes `create(input, tx?)`, `findManyByApplication(applicationId, opts)`, `findById(id)`, `findRemindersForStaff(staffId, windowHours)`. NO `update` / `delete` methods (append-only at the API layer; trigger is the DB layer).
- [X] T032 [US1] Create `backend/src/applications/adapters/lead-status-transition.adapter.ts` — pure function `deriveLeadStatusTransition(currentLeadStatus, newActivity): LeadStatus | null` implementing the matrix from [research.md R-003](./research.md#r-003--leadstatus-transition-rule-derived-from-activity-writes).
- [X] T033 [US1] Create `backend/src/activities/activities.service.ts` — `createActivity({ applicationId, activityType, reason, note?, durationMinutes?, outcomeFlags?, followUpAt?, attachedDocumentIds?, actor })`. Single transaction: validates role + assignment (FR-012), validates reason via `validateActivityReason`, validates type-specific rules (`DURATION_REQUIRED_FOR_CALL`, `REASON_DETAILS_REQUIRED`, `FOLLOWUP_IN_PAST`), verifies each `documentId` exists in S3 via `headObject` and a Document row exists for the same application, inserts the activity, runs `deriveLeadStatusTransition` → optionally UPDATEs `application.leadStatus`, emits `APPLICATION_ACTIVITY_LOGGED` audit + per-document `DOCUMENT_UPLOADED` audit + `APPLICATION_LEAD_STATUS_CHANGED` audit (when transition fired), all sharing one `correlationId`.
- [X] T034 [US1] Create `backend/src/activities/dto/create-activity.request.dto.ts` (class-validator + class-transformer) + `dto/activity.response.dto.ts` (Swagger).
- [X] T035 [US1] Create `backend/src/activities/activities.controller.ts` — `@Controller('admin/applications/:applicationId/activities')` + JWT + RolesGuard. `POST /` (super_admin / sales_manager / sales_agent). `GET /` cursor-paginated read (all 4 roles; note bodies stripped for analyst). Register controller + repository + service in `activities.module.ts`.
- [X] T036 [US1] Add `ActivityFilterByRoleInterceptor` (or in-controller branching) that strips `note` + `attachedDocuments` from the response when `req.user.role === 'analyst'`.
- [X] T037 [US1] Wire `applications.service.ts` to call `deriveLeadStatusTransition` inside the activity transaction. The activity service is the orchestrator; applications module holds the adapter and the UPDATE.
- [X] T038 [US1] Extend `backend/src/applications/applications.module.ts` to export `ApplicationRepository` so the activity service can read assignment + leadStatus inside its transaction.

### 3.3 Admin UI — application-detail action surface

- [X] T039 [US1] [P] **promax** pre-design for the Add Activity modal: 8-field layout (type → reason → note → attach → duration → outcome flags → follow-up → save/cancel), reason dropdown auto-loads per type, file picker with per-file `documentType` dropdown + source selector, follow-up DateTime picker. Write to `specs/005-lead-management-application/design/promax-add-activity-modal.md`.
- [X] T040 [US1] [P] **promax** pre-design for the application-detail action header per FR-010b: 4 visible primary CTAs + Action menu carrying the long-tail verbs. Write to `specs/005-lead-management-application/design/promax-action-header.md`.
- [X] T041 [US1] [P] **promax** pre-design for the activity timeline component: chronological list, icon per activity type, color-coded chips, expandable rows, filter chip row, search box. Write to `specs/005-lead-management-application/design/promax-activity-timeline.md`.
- [X] T042 [US1] Create `admin/src/app/features/applications/api/applications.api.service.ts` additions — `createActivity(applicationId, body)`, `listActivities(applicationId, opts)`, `requestUploadUrl(body)`, `getDownloadUrl(documentId)`. Typed return shapes matching [openapi.yaml](./contracts/openapi.yaml).
- [X] T043 [US1] Create `admin/src/app/features/applications/detail/components/activity-timeline.component.ts` — standalone OnPush. Inputs: `applicationId`, current user role. Signal-backed activity list with cursor-paginated fetch. Filter chip row + AR/EN-aware activity-type/reason labels. Expand-on-click row template.
- [X] T044 [US1] Create `admin/src/app/features/applications/detail/components/add-activity.dialog.ts` — standalone OnPush dialog. Typed reactive form. Activity-type dropdown grouped by category. Reason dropdown reactively repopulates on type-change via `ACTIVITY_REASONS` (TypeScript const synced to backend). Conditional fields per type (duration only for `CALLED_USER`; attachments only for receipt/review types). Drag-and-drop + multi-file picker; per-file type + source dropdowns. Follow-up DateTime picker. Outcome multi-select (≤ 3). Save calls `requestUploadUrl` per file → PUTs to S3 → submits the activity. "Save & Add Another" keeps the modal open with the form reset; "Save" closes.
- [X] T045 [US1] Create `admin/src/app/features/applications/detail/components/activity-attachments-uploader.component.ts` — standalone component inside the Add Activity dialog handling the file picker + per-file type selector + PUT-to-S3 progress.
- [X] T046 [US1] Update `admin/src/app/features/applications/detail/application-detail.page.ts` to render the action header (FR-010b) + timeline component. Header CTAs: Add Activity (always when user can write), Attach Documents (alias opens Add Activity scoped to receive type), Assign / Reassign (manager/super_admin), Mark Ready for Bank Submission (conditional on leadStatus + verified docs), Action menu carrying internal-note / request-more / mark-as-reviewed / etc.
- [X] T047 [US1] Wire `applications-list.page.ts` row-click → navigate to `/applications/:id` (replace any inline action buttons per FR-010a; the list page never carries inline action buttons).

### 3.4 i18n + polish

- [X] T048 [US1] [P] Add ~50 new i18n units to `admin/src/i18n/messages.ar-EG.xlf`: 14 `@@activity.type.<TYPE>` labels, ~60 `@@activity.reason.<TYPE>.<REASON>` labels (per [reason-codes.md](./contracts/reason-codes.md)), Add Activity dialog strings, timeline filter chips, attachment uploader strings, leadStatus labels (5), milestone labels (5). All in AR + EN.
- [X] T049 [US1] [P] Type-check both projects: `cd backend && npx tsc --noEmit && cd ../admin && npx tsc --noEmit -p tsconfig.app.json` both exit 0.
- [X] T050 [US1] [P] **impec** post-implementation polish pass on the Add Activity modal + timeline + action header: audit color contrast (timeline color-coded chips), RTL flow (modal in Arabic), keyboard nav (Tab order through 8 fields), reduced-motion. Write to `specs/005-lead-management-application/design/impec-us1.md`.
- [X] T051 [US1] Run quickstart §4–§6 end-to-end; record divergence in `specs/005-lead-management-application/quickstart-failures.md`.

**Phase 3 checkpoint**: agent activity logging end-to-end. MVP shippable here.

---

## Phase 4 — User Story 2 (P1): Manager Triage + Reassign

**Goal**: `sales_manager` sees all applications with last-activity + count + stale + overdue-follow-up indicators. Filter chips work + serialize to URL. Reassign action logs `LEAD_REASSIGNED` activity for both agents.

**Independent test**: [quickstart.md §8](./quickstart.md#8--list-filter-triage-operator-sales_manager). Seed 30 applications across the filter buckets; exercise each chip; reassign one lead; confirm both agents' timelines reflect the action.

- [ ] T052 [US2] Extend `backend/src/applications/application.repository.ts` `findManyAdmin` with the LATERAL aggregate from [research.md R-009](./research.md#r-009--activity-list-query-optimization): last-activity (type + occurredAt), activity count, stale flag, overdue-follow-up flag. Indexes from Phase 2 cover the LATERAL.
- [ ] T053 [US2] Extend the `?tier=...` filter map in `admin-applications.controller.ts` with 7 new chips: `needs_first_contact`, `stale`, `recent`, `followup_today`, `docs_in_progress`, `ready_for_submission`, `submitted_to_bank`. Each translates to a Prisma where-predicate per FR-021.
- [ ] T054 [US2] Add `POST /api/admin/applications/:id/assign` to `admin-applications.controller.ts` (super_admin / sales_manager only). Accepts `{ toAgentStaffId, reason, notes? }`. Inside a single transaction: validates target staff exists + role in `{sales_agent, sales_manager, super_admin}`; UPDATEs `application.assignedAgentStaffId` + `assignedAt`; creates `LEAD_REASSIGNED` activity (with `meta = { fromAgentId, toAgentId, reassignReason }`); emits `APPLICATION_REASSIGNED` audit event sharing the activity's correlationId.
- [ ] T055 [US2] [P] **promax** pre-design for the list filter chip row + last-activity column + stale/overdue indicators. Write to `specs/005-lead-management-application/design/promax-list-triage.md`.
- [ ] T056 [US2] Update `admin/src/app/features/applications/list/applications-list.page.ts` to render 7 new filter chips + last-activity column + stale indicator (red dot) + overdue-follow-up indicator (clock icon). Filter selection serializes to `?filter=`.
- [ ] T057 [US2] Create `admin/src/app/features/applications/detail/components/lead-assign.dialog.ts` — standalone OnPush. Typed reactive form. Loads active staff list filtered to non-analyst roles via `UsersApiService.list({ excludeRole: ['analyst'] })`. Reason dropdown maps to `AssignLeadRequest.reason` enum. Notes textarea ≤ 500 chars.
- [ ] T058 [US2] Update `applications.api.service.ts` with `assignLead(applicationId, body)`. Application-detail header **Assign / Reassign** CTA opens the dialog (visible only to super_admin / sales_manager).
- [ ] T059 [US2] [P] Add i18n entries for the 7 filter chips + assign-dialog strings + last-activity column header + stale + overdue indicators.
- [ ] T060 [US2] [P] **impec** post-implementation polish pass on list filter row + assign dialog. Write to `specs/005-lead-management-application/design/impec-us2.md`.
- [ ] T061 [US2] Run quickstart §8 end-to-end; record divergence.

**Phase 4 checkpoint**: manager triage workflow shippable.

---

## Phase 5 — User Story 3 (P2): Analyst Aggregates

**Goal**: `analyst` opens a Lead Analytics page; sees per-(agent alias, activityType) aggregates over a chosen window. Same alias for same agent across the session; different across analysts. Note bodies / document filenames not present.

**Independent test**: [quickstart.md §11](./quickstart.md#11--analyst-aggregate-operator-analyst). Seed 100 applications with 500 activities across 4 agents; sign in as analyst; verify aggregate counts match a direct SQL aggregate; confirm aliasing is session-consistent.

- [ ] T062 [US3] Create `backend/src/lead-analytics/alias-resolver.service.ts` — `getAliasMap(analystSub): Promise<Record<string, string>>`. Reads from Redis key `alias:${analystSub}` (TTL 15 min). Cache miss: queries distinct `actorStaffId` from `activity`, deterministically maps via `sha256(jwtSub + 'masrafy-alias-salt')` to ordered aliases `Agent A / Agent B / ...`. Writes back to Redis.
- [ ] T063 [US3] Create `backend/src/lead-analytics/lead-analytics.repository.ts` — `aggregateActivityByAgent(windowDays, options)` runs the per-(staffId, activityType) `GROUP BY` SQL with COUNT + SUM(durationMinutes) for `CALLED_USER`. Returns raw `staffId` rows (aliasing happens in the service).
- [ ] T064 [US3] Create `backend/src/lead-analytics/lead-analytics.service.ts` — `getActivitySummary(analystSub, windowDays)`. Validates `windowDays ≤ 180` (else `AnalyticsWindowTooLargeException`). Queries repo, then maps `staffId` → alias via `AliasResolverService`.
- [ ] T065 [US3] Create `backend/src/lead-analytics/lead-analytics.controller.ts` — `@Controller('admin/lead-analytics')` + JWT + RolesGuard + `@Roles('super_admin', 'sales_manager', 'analyst')`. `GET activity-summary?windowDays=N`. Returns `{ windowDays, rows: [{ agentAlias, activityType, count, totalDurationMinutes? }] }`. Register controller + service + repository + alias-resolver in `lead-analytics.module.ts`.
- [ ] T066 [US3] Create `backend/src/lead-analytics/dto/activity-summary.response.dto.ts` Swagger schema.
- [ ] T067 [US3] [P] **promax** pre-design for the Lead Analytics page (table layout, window-preset chips, alias chips, count formatting, empty-state copy). Write to `specs/005-lead-management-application/design/promax-lead-analytics.md`.
- [ ] T068 [US3] Create `admin/src/app/features/lead-analytics/lead-analytics.routes.ts` lazy route gated by `roleGuardFn(['super_admin', 'sales_manager', 'analyst'])`; register in `app.routes.ts`.
- [ ] T069 [US3] Create `admin/src/app/features/lead-analytics/lead-analytics.api.service.ts` — typed `getActivitySummary(windowDays)`.
- [ ] T070 [US3] Create `admin/src/app/features/lead-analytics/components/agent-activity-table.component.ts` — standalone OnPush Material table. Columns: agent alias, activity type, count, total duration (CALLED_USER only — render `—` for others).
- [ ] T071 [US3] Create `admin/src/app/features/lead-analytics/lead-analytics.page.ts` — page composes the window-picker chips (reuse pattern from feature 004 scoring-analytics) + table.
- [ ] T072 [US3] Add a sidebar nav entry "Lead analytics" gated by `*can="['super_admin', 'sales_manager', 'analyst']"` in `admin/src/app/features/shell/sidebar.component.ts`.
- [ ] T073 [US3] Update `admin-applications.controller.ts` analyst projection: strip `note` + `attachedDocuments` from activities; replace `actorStaffId` with `actorAlias` resolved via `AliasResolverService` shared via `ScoringAnalyticsModule` or duplicated in `lead-analytics.module.ts` (cleanly importable).
- [ ] T074 [US3] [P] Add i18n entries for the analytics page title + table columns + alias display.
- [ ] T075 [US3] [P] **impec** post-implementation polish pass on the Lead Analytics page. Write to `specs/005-lead-management-application/design/impec-us3.md`.
- [ ] T076 [US3] Run quickstart §11 end-to-end; record divergence.

**Phase 5 checkpoint**: analyst report renders aggregates with session-consistent anonymization.

---

## Phase 6 — User Story 5 (P2): Stale-Lead Cron

**Goal**: hourly cron flags applications without activity in 48 h. Multi-instance safe via Redis distributed lock. Idempotent.

**Independent test**: [quickstart.md §10](./quickstart.md#10--stale-lead-cron-manual-trigger-super_admin). Seed 5 applications with activity 49 h old; trigger manually; verify each gets a `STALE_LEAD_FLAGGED` activity (system actor) + `MANAGER_ATTENTION_REQUESTED` audit event. Re-run within 1 h → no new flags.

- [ ] T077 [US5] Create `backend/src/activities/stale-lead-scanner.ts` — `@Injectable()` class with `@Cron(CronExpression.EVERY_HOUR)` decorator on `scan()`. Implements the Redis `SETNX EX 3300` lock from [research.md R-005](./research.md#r-005--stale-lead-cron-with-distributed-lock). Service body: query applications matching FR-023 predicate, create `STALE_LEAD_FLAGGED` activity (authored by the system actor `clsysactor00000000000000000000`), emit `MANAGER_ATTENTION_REQUESTED` audit per row, log `STALE_LEAD_SCAN_COMPLETED` with metrics.
- [ ] T078 [US5] Add a dev-only manual-trigger endpoint `POST /api/admin/cron/stale-leads` in `activities.controller.ts` (gated by `@Roles('super_admin')`); body invokes `StaleLeadScanner.scan()` synchronously. Wire under `if (process.env.NODE_ENV !== 'production')` guard so it's absent in prod.
- [ ] T079 [US5] [P] Type-check backend: `cd backend && npx tsc --noEmit` exit 0.
- [ ] T080 [US5] Run quickstart §10 end-to-end (manual trigger → verify activity + audit + idempotency).

**Phase 6 checkpoint**: stale-lead detection live + multi-instance-safe.

---

## Phase 7 — User Story 4 (P3): Customer Milestone Timeline

**Goal**: `GET /api/v1/applications/:applicationId/timeline` HMAC-gated endpoint returns milestone-only stream derived from `leadStatus` transitions. No agent identities, no notes, no document filenames.

**Independent test**: [quickstart.md §7](./quickstart.md#7--customer-timeline-endpoint-hmac-curl). HMAC-sign + curl the endpoint; verify 5 milestone entries; verify no PII leak.

- [ ] T081 [US4] Add `GET /api/v1/applications/:applicationId/timeline` endpoint to `backend/src/applications/applications.controller.ts` (HMAC-guarded via the existing `MobileHmacGuard` from feature 003). Validates that `req.mobileClientId` matches `application.mobileClientId` else `HMAC_CLIENT_UNKNOWN`.
- [ ] T082 [US4] Create `backend/src/applications/customer-timeline.service.ts` — `buildTimeline(applicationId)`. Queries `AuditEvent` rows of type `APPLICATION_LEAD_STATUS_CHANGED` for the application (single indexed query). Maps each to a `MILESTONE_*` entry. Adds the `MILESTONE_NEEDS_FIRST_CONTACT` entry from `application.createdAt` as the synthetic first entry (no audit event fires for the initial state). For `MILESTONE_BANK_DECIDED`, looks up the latest `BANK_RESPONDED` activity to extract the outcome.
- [ ] T083 [US4] Create response DTO `backend/src/applications/dto/customer-timeline.response.dto.ts` matching `CustomerTimelineResponse` from openapi.yaml.
- [ ] T084 [US4] Run quickstart §7 end-to-end (HMAC-sign + curl + verify response shape).

**Phase 7 checkpoint**: customer-facing endpoint shipped; Flutter client integration unblocked.

---

## Phase 8 — Polish & Cross-Cutting

- [ ] T085 Reminders widget — backend: add `GET /api/admin/staff/me/reminders?windowHours=N` to `users.controller.ts` (or new staff-self controller). Query per [research.md R-012](./research.md#r-012--frontend-reminder-widget-read-strategy). Returns `{ activityId, applicationId, followUpAt, applicationSummary: { requestedAmountEGP, loanPurpose } }`.
- [ ] T086 Reminders widget — frontend: create `admin/src/app/features/shell/reminders-widget.component.ts` standalone OnPush. Renders on dashboard home. Each row links to `/applications/:id`. Mark Completed / Snoozed / Cancelled buttons call `createActivity` with `INTERNAL_NOTE` + appropriate reason + `meta.sourceActivityId`.
- [ ] T087 [P] **promax** + **impec** for reminders widget — combined doc in `specs/005-lead-management-application/design/promax-impec-reminders-widget.md`.
- [ ] T088 Run quickstart §9 (reminders widget) + §13 (perf check) end-to-end.
- [ ] T089 Final lint pass: `cd backend && npx eslint src --max-warnings 0` + `cd admin && npx eslint src --max-warnings 0` both exit 0.
- [ ] T090 Final type-check pass: `cd backend && npx tsc --noEmit` + `cd admin && npx tsc --noEmit -p tsconfig.app.json` both exit 0.
- [ ] T091 Run full quickstart §1–§13; log any failures to `specs/005-lead-management-application/quickstart-failures.md`.
- [ ] T092 Commit + push the branch: `git add -A && git commit -m "feat(005-lead-management): …" && git push -u origin 005-lead-management-application`.

---

## Dependency graph

```
Phase 1 ──► Phase 2 ──► Phase 3 (US1) ──┬─► Phase 4 (US2)
                                        ├─► Phase 5 (US3)
                                        ├─► Phase 6 (US5)
                                        └─► Phase 7 (US4)
                                                  │
                                                  └─► Phase 8 (Polish)
```

Phases 4 / 5 / 6 / 7 are independent siblings — each consumes Phase 3's persisted Activity + Document tables. Pick MVP scope = 1 + 2 + 3 to ship. Add the rest in any order.

---

## Parallel-execution windows (per phase)

| Phase | Parallel windows |
|---|---|
| Phase 2 | T014–T020 (different files); T016+T017+T018 (i18n only) |
| Phase 3.1 | T025–T030 mostly sequential (same module); T028 + T030 parallel |
| Phase 3.3 | T039–T041 (3 promax docs) parallelizable to each other AND parallel to backend work T031–T038 |
| Phase 3.4 | T048 (i18n) parallel to T049 (typecheck) parallel to T050 (impec) |
| Phase 4 | T055 (promax) parallel to backend T052–T054; T059 + T060 parallel |
| Phase 5 | T067 (promax) parallel to backend T062–T066; T074 + T075 parallel |
| Phase 7 | T081–T084 mostly sequential (single endpoint chain) |
| Phase 8 | T085 (backend) parallel to T087 (promax/impec doc) |

---

## Implementation strategy

- **MVP scope**: Phases 1 + 2 + 3 (51 tasks). Agent activity logging end-to-end — the platform's operational core lights up.
- **Manager-tier next**: Phase 4 (US2). Triage UI + reassign unblocks team-scale operation.
- **Analyst loop**: Phase 5 (US3). Reporting closes the feedback model.
- **Operational guard-rail**: Phase 6 (US5). Stale-lead cron eliminates "ghost lead" failure mode.
- **Customer-side surface**: Phase 7 (US4). Endpoint exists; Flutter client integrates on its own timeline.
- **Polish**: Phase 8 (reminders widget + final QA).

Land Phases 4 → 5 → 6 → 7 → 8 in priority order. Each phase is a separate PR.

---

## Notes

- Tests intentionally NOT generated (constitution v1.2.0 dropped XVI + XXVII). Manual walkthrough of [quickstart.md](./quickstart.md) replaces automated verification.
- `promax` (pre-design) + `impec` (post-implementation) tasks are explicit per Principle XXIII. 5 promax + 5 impec entries cover the new screens / components. Skipping either is a review block — design docs under `specs/005-lead-management-application/design/` capture both passes for traceability.
- Same-PR i18n parity: every new error code / i18n key lands in `ar-EG` AND `en-US` files in the same task that introduces the code (T014↔T016↔T017↔T018; T020↔T048).
- Engine purity: tasks T031–T038 keep `src/matching/**` import-free from the new modules. ESLint engine-boundary rule (extended in feature 004) blocks the reverse.
- Append-only enforcement: T012 (DB trigger) + T031 (repository with no `update*`/`delete*` methods on `Activity`). Two layers (R-001).
- Single distributed-lock invariant for the cron: T077 implements the `SETNX EX 3300` pattern (R-005). Test the duplicate-instance guarantee in T080.
- The customer-timeline endpoint (T081–T084) reuses feature 003's `MobileHmacGuard` + `MobileRateLimitGuard` verbatim — no new guard classes.
