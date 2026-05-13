# Feature Specification: Lead Management & Application Review Dashboard

**Feature Branch**: `005-lead-management-application`
**Created**: 2026-05-13
**Status**: Draft
**Input**: User description: "Operational core of Masrafy — admin dashboard where sales agents see incoming applications, manage the customer relationship, track every interaction (call / WhatsApp / email / in-person / mobile-app channel), attach documents received via any channel, set follow-up reminders, and coordinate submission to banks. Agent-mediated workflow (the proven approach for Egyptian/MENA markets where customers prefer human contact). Append-only Activity records create a complete audit trail."

## Background

Features 001–004 shipped the foundation: admin auth, the BankProgram registry, the matching engine, and the approval-probability display. What they DIDN'T ship is the day-to-day workflow that sales agents actually use. Today an agent receiving a `/api/v1/apply` submission has nowhere to:

- log the WhatsApp conversation that follows the application;
- attach documents the customer sent through any channel;
- set a follow-up reminder;
- mark the application "ready for ABK submission";
- track outcomes for performance management.

Compounding the problem: most loan submissions in the Egyptian retail market go through agent-mediated channels (WhatsApp, phone) rather than self-service uploads. Without a system that captures every interaction REGARDLESS of channel, the platform's audit trail is half-empty and the customer experience is fragmented.

This feature ships the operational layer that turns the dashboard into the single source of truth for every applicant interaction:

- **Activity records** — append-only chronological log on every application, each with type / reason / note / outcome / optional duration / optional follow-up / optional document attachments.
- **Channel-aware document attachment** — agents drop in files received via any channel; the system stamps `uploadedByContext='agent_on_behalf'` + `uploadedBySource ∈ {whatsapp,email,in_person,mobile_app,courier}`.
- **Follow-up reminders** — per-agent reminders that surface in a dashboard widget, on the queue page, and as a notification badge.
- **Stale-lead / overdue-follow-up indicators** on the application list so managers triage at a glance.
- **Manager view** — same activity timeline + ability to filter by agent for performance review.
- **Analyst view** — anonymized counts and aggregate patterns (no PII access).
- **Customer-facing status labels** (mobile) — simplified view of where their application stands without exposing agent-internal notes.

## Clarifications

### Session 2026-05-13 (initial)

- Q: Are activity records editable after creation? → A: **No.** Append-only (Constitution Principle VI — audit invariant). An agent who logs the wrong reason adds a new "Internal note" activity correcting the record; the original stays as-is. The audit trail tracks the correction.
- Q: When an activity attaches N documents, is that one audit event or N+1? → A: **N+1.** One `APPLICATION_ACTIVITY_LOGGED` event for the activity itself + one `DOCUMENT_UPLOADED` event per attached document. The two are linked by a shared `correlationId` so reviewers can reconstruct the agent action from the audit stream alone.
- Q: Can `sales_manager` reassign an application from one agent to another? → A: **Yes.** Reassignment is an activity of type `LEAD_REASSIGNED` carrying `fromAgentId` + `toAgentId` + reason in the meta. Both agents see the activity in their timeline; the new agent's queue immediately reflects the assignment.
- Q: What's the maximum file size + allowed types for an attached document? → A: 10 MB per file; JPG/PNG/HEIC/PDF. Larger / other types rejected at the presigned-URL request step with `FILE_TOO_LARGE` / `FILE_TYPE_NOT_ALLOWED`. Consistent with the (future) mobile upload feature.
- Q: How does the analyst view "anonymize" activity? → A: `sales_agent.name` → `Agent A / Agent B / ...` (consistent per session so the analyst can still track per-agent patterns); `note` and `attachedDocuments` are hidden entirely; `activityType`, `reason`, `outcome`, `durationMinutes` remain visible as categorical data.
- Q: How does the agent-workflow lifecycle interact with the existing `ApplicationStatus` enum from feature 003? → A: **Two independent state machines.** Existing `ApplicationStatus` (engine-outcome: `draft`/`matched`/`no_match`/`archived`/`erased`) stays untouched. A NEW enum `LeadStatus` (`needs_first_contact`/`document_collection`/`ready_for_submission`/`submitted_to_bank`/`bank_decided`) with its own `application.leadStatus` column captures the agent-workflow lifecycle. The customer-timeline endpoint maps activities + leadStatus transitions to customer milestones; the admin-list filter buckets operate on `leadStatus`. The engine never touches `leadStatus`; the activity service never touches `ApplicationStatus`. Clear ownership boundary.
- Q: Storage backend for activity-attached documents? → A: **S3-compatible** object storage, env-configured. Production: AWS S3 (or any S3-API-compatible service — Wasabi, Digital Ocean Spaces). Dev: MinIO single-container in `docker/compose.dev.yml`. Single SDK (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`); endpoint + bucket + region + credentials all sourced from env. Presigned PUT URLs expire in 5 minutes; presigned GET URLs (admin reads) expire in 15 minutes. Same code surface on dev + production — env swap only.
- Q: Cron scheduler for the hourly stale-lead scan (FR-023)? → A: **`@nestjs/schedule`** with a Redis-backed distributed lock. `@Cron('0 * * * *')` fires on every backend instance; each tries `SETNX stale-lead-scan:lock <instanceId> EX 3300` (55-minute TTL — shorter than the 60-minute interval so a crashed leader releases cleanly); only the lock-holder runs the scan. Zero new dependencies (Redis already in the stack). Multi-instance ready from day one without duplicate-run waste.
- Q: Document-type enumeration source? → A: **Reuse `enumerationType = 'required_document'`** from the platform-enumeration registry seeded in feature 002. Single canonical list shared by (a) bank-program `requiredDocuments` checklist, (b) agent attach-document dropdown, (c) future mobile-app upload. Adding a new document type = one INSERT into the enumeration registry; every consumer picks it up via the existing in-memory hydration. Avoids two-list drift entirely.
- Q: Where does the canonical activity-type / reason-code matrix live (since the original brief stopped before delivering the formal table)? → A: **`specs/005-lead-management-application/contracts/reason-codes.md`** (authored during `/speckit.plan`). Backend `activity-reasons.ts` declares a `Readonly<Record<ActivityType, readonly ReasonCode[]>>` const that mirrors the doc; i18n entries (AR/EN labels per reason-code) mirror it too. Same-PR rule: any update to the matrix lands across all three files at once. Validation (FR-004) reads from the TypeScript const; UI dropdown bindings consume the same const.
- Q: Action surface — where do agents actually take actions on a lead? → A: **Dedicated application-detail page** at `/applications/:id` (existing route from feature 004). Every row in the list page is clickable → opens the same detail screen. The detail screen is the single action surface and contains: applicant profile (PII-masked per role), matched offers from feature 003/004 (with the "Why this score?" panel), the **activity timeline** (chronological), an **Add Activity** primary CTA in the page header, an **Attach Documents** secondary CTA (opens the same modal as Add Activity scoped to document types), an **Assign / Reassign** menu (visible to `sales_manager` + `super_admin` only), a **Mark Ready for Bank Submission** button (visible when the lead is in `document_collection` state with all required docs verified), and an **Action menu** carrying every secondary verb (status change, internal note, request more docs, etc.). All actions create new activity rows append-only. The list page never carries inline action buttons — all action gravity sits on the detail screen so the operator's mental model is "open the lead, do everything from inside it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sales Agent Logs Activity (Priority: P1)

A `sales_agent` opens the Applications list, clicks a row → the dedicated application-detail screen at `/applications/:id` loads. From this single screen they see: the masked applicant profile, the matched offers (with the feature-004 "Why this score?" panel embedded per offer), the chronological **activity timeline**, and the action header. After a WhatsApp conversation they click **Add Activity** in the header, pick `Sent WhatsApp` from the activity-type dropdown; the reason dropdown auto-populates with WhatsApp-relevant options; they pick `Status update`, type a short Arabic note ("أبلغت العميل أن الطلب قيد المراجعة في البنك التجاري العربي"), optionally set a follow-up reminder for tomorrow 10:00 AM, and save. The activity appears at the top of the timeline within 1 second. The agent's dashboard reminder widget now carries the follow-up. Every other agent verb (Attach Documents, Assign / Reassign visible to managers, Mark Ready for Bank Submission, Internal Note, Request More Docs, …) lives on the same screen — the operator never has to leave the detail page to act.

**Why this priority**: this IS the workflow. Without it, the dashboard is a read-only window onto data the agent can never enrich. Every other story in this spec depends on activities existing.

**Independent Test**: sign in as a `sales_agent`, open an assigned application, log an activity with each combination of (type, reason, follow-up?, attachment?), confirm the timeline updates and the audit log captures `APPLICATION_ACTIVITY_LOGGED` for each. Result: a complete chronological record built from agent input.

**Acceptance Scenarios**:

1. **Given** an assigned application with no prior activity, **When** the agent clicks Add Activity → Called user → Initial contact → adds a note in Arabic → 12 min duration → outcome "User confirmed" → no follow-up, **Then** an activity row appears with the agent's name, timestamp, type icon, reason chip, the note, and a "12 min" duration label; the list-page row updates to show "Called user — just now".
2. **Given** the agent picks activity type `Received documents` with source `WhatsApp` and attaches three files (two JPGs, one PDF), **When** they save, **Then** three Document records persist with `uploadedByContext='agent_on_behalf'` and `uploadedBySource='whatsapp'`; the activity timeline shows the activity with three attachment thumbnails; the document-progress indicator on the list updates (e.g., "3 of 5 documents verified" if these complete the set).
3. **Given** the agent saves an activity with a follow-up reminder for tomorrow at 10:00 AM, **When** the next dashboard render fires, **Then** the reminder appears in the "Reminders due today" widget; on the reminder date the badge count increments; marking the reminder Completed creates a follow-up activity automatically.
4. **Given** an attempted "Other" reason without filling the free-text field, **When** the agent saves, **Then** the form rejects with a localized "Reason details required" error and does NOT persist.

---

### User Story 2 — Sales Manager Triages Team Queue (Priority: P1)

A `sales_manager` opens the Applications list. They see — across ALL agents — rows annotated with the last activity type + timestamp, total activity count, document-collection progress, and visual indicators for stale (> 48 h no activity) and overdue follow-up. They use the filter chips to drill into "Stale" → see 12 leads no one has touched in 48 h; reassign three to a different agent via a single right-click action.

**Why this priority**: makes the platform managed, not just operated. P1 because manager visibility is what enables a team to grow past 1–2 agents.

**Independent Test**: seed a mix of 30 applications across (zero activities), (recent activities), (stale), (overdue follow-up); sign in as `sales_manager`; exercise each filter chip and confirm counts match a direct DB query; reassign one lead and confirm the activity log captures the reassignment for both agents.

**Acceptance Scenarios**:

1. **Given** an application without an `assignedAgentId`, **When** the manager opens the row's action menu and picks Assign → Agent B, **Then** an activity of type `LEAD_REASSIGNED` is logged with `fromAgentId=null`, `toAgentId=<Agent B id>`, the agent's queue updates immediately.
2. **Given** the manager applies the "Stale" filter, **When** the list reloads, **Then** only applications where `MAX(activity.occurredAt) < now() − 48h` (or no activities at all) appear; the chip count matches the row count.
3. **Given** the manager wants to performance-review Agent A, **When** they apply Filter → Agent → Agent A across a 14-day window, **Then** the timeline aggregate shows count + breakdown by activity type for that agent.
4. **Given** a row with an overdue follow-up reminder, **When** the row renders, **Then** a red "Follow-up overdue" indicator appears next to the application code; the row is bumped to the top of the "Pending follow-up today" bucket.

---

### User Story 3 — Analyst Reviews Aggregates (Priority: P2)

An `analyst` opens a Sales Activity report. They see anonymized aggregate patterns — average activities per application before approval, average call duration, distribution of "documents received" by channel, conversion rate of follow-up-reminder completions. Per-row data is rendered with agent identities replaced by `Agent A / Agent B / ...` and note bodies hidden.

**Why this priority**: the analyst loop closes the management feedback model. Less urgent than P1 because v1 has a small team where the manager can eyeball things directly; gets formal later.

**Independent Test**: seed 100 applications with 500 activities across 4 agents; sign in as `analyst`; verify per-activity-type counts match a direct DB aggregate; confirm note bodies + agent names + document attachments are NOT visible.

**Acceptance Scenarios**:

1. **Given** the analyst opens the sales-activity report, **When** the page renders, **Then** the table shows activity-type counts grouped by agent alias (`Agent A`, `Agent B`, …) with consistent aliasing within the session.
2. **Given** the analyst clicks into an aggregate cell (e.g., "Agent A · Called user · 48"), **When** the detail drawer opens, **Then** it shows date / type / reason / duration / outcome columns only — no note bodies, no attached-document filenames, no applicant names.
3. **Given** the analyst attempts to navigate directly to a specific application's detail page (`/applications/:id`), **When** the route resolves, **Then** the page renders with note bodies and attached-document filenames hidden + masked applicant name (matching the analyst-aware projection from feature 003).

---

### User Story 4 — Customer Sees Simplified Status (Priority: P3)

A customer (mobile-app user; future Flutter client) calls `GET /api/v1/applications/:id/timeline`. The response carries a simplified timeline of milestone events — `submitted`, `documents_in_review`, `submitted_to_bank`, `bank_responded` — derived from the activity stream. Internal notes, agent names, and most reasons are hidden. Just the journey.

**Why this priority**: complements US1 from the customer side. P3 because the Flutter client doesn't ship in this feature; the endpoint exists so it lights up the moment the client integrates.

**Independent Test**: HMAC-call the timeline endpoint for an application with a mixed history (5 internal-note activities, 2 status changes, 1 bank submission, 1 bank response); verify the response carries exactly the 4 customer-facing milestone entries with no internal data.

**Acceptance Scenarios**:

1. **Given** an application with mixed activity history, **When** the customer calls the timeline endpoint, **Then** the response shows only `MILESTONE_*` events with `occurredAt` + `localizedLabel` + optional `nextStepHint`. No agent identities, no notes, no document filenames.
2. **Given** an application whose latest activity is `Bank responded → Rejected`, **When** the customer calls the timeline endpoint, **Then** the latest entry's label is the localized "Bank rejected" milestone; the response carries the rejection-reason code (not the agent's note explaining it).
3. **Given** a guest applicant (`isGuest=true`), **When** they call the endpoint, **Then** the response succeeds without revealing the assigned agent.

---

### User Story 5 — System Detects Stale Leads (Priority: P2)

A background job (cron-scheduled, hourly) scans applications with no activity in 48 h and creates a `STALE_LEAD_FLAGGED` activity on each (system-actor). The flag drives the "Stale" filter (US2.2) and emits a `MANAGER_ATTENTION_REQUESTED` audit event so a future digest-email feature can notify managers. The system never auto-reassigns; it just surfaces the problem.

**Why this priority**: managerial-tier feature. P2 because manual triage works at v1 scale (< 100 active leads per agent), but the flag is what makes "Stale" filtering deterministic instead of computed live.

**Independent Test**: seed 5 applications with `activity.occurredAt = now() - 49 h`; run the cron handler once via `npx tsx scripts/scan-stale-leads.ts`; verify each application carries a `STALE_LEAD_FLAGGED` activity authored by the system actor; verify the audit log emits 5 `MANAGER_ATTENTION_REQUESTED` events; verify a SECOND run is a no-op (idempotent).

**Acceptance Scenarios**:

1. **Given** an application whose latest activity is 49 h old, **When** the cron runs, **Then** a `STALE_LEAD_FLAGGED` activity appears with `actorRole='system'`, `reason='no_activity_48h'`, and the audit event fires.
2. **Given** the same application 1 h later (now 50 h since the prior actual-agent activity, but 1 h since the system flag), **When** the cron runs again, **Then** no second flag is added (idempotent — only flags when no agent activity AND no prior flag in the stale window).
3. **Given** an agent adds a fresh activity on a flagged application, **When** the next cron run fires, **Then** the application is no longer stale; the original `STALE_LEAD_FLAGGED` entry remains in the timeline (append-only) but does not trigger a re-flag.

---

### Edge Cases

- **Two agents try to log activity on the same application in parallel**: both succeed; activities are append-only with strict `occurredAt` ordering. Race-condition-safe.
- **Manager reassigns to themselves while still being a manager**: allowed; manager can carry a lead personally. Activity captures the role transition for clarity.
- **Activity with attachments where one upload fails mid-flight**: the activity persists for the documents that uploaded successfully; failed uploads return per-file errors in the response; agent can retry attachment via "Add documents" on the same activity (creates a sibling activity with the additional docs — never edits the original).
- **Agent attempts to log activity on an application that's no longer assigned to them**: rejected with `ACTIVITY_FORBIDDEN_NOT_ASSIGNED`. The list page hides such applications so this only happens via direct URL.
- **Follow-up reminder set in the past**: rejected at form validation with localized "Reminder must be in the future".
- **Follow-up reminder for a date > 6 months out**: allowed with a soft warning ("That's a long reminder. Set anyway?"). Hard cap at 2 years.
- **`STALE_LEAD_FLAGGED` activity itself is the latest activity**: the staleness clock resets from this flag's `occurredAt`. An application flagged 49 h ago is not re-flagged until 48 h after the previous flag (so once a week roughly).
- **Mobile applicant uploads a document after the agent already attached one of the same `documentType`**: both rows are persisted; the timeline shows both attachment events; manager / agent reviews and marks ONE as `verified` (the canonical record).
- **`Other` reason picked but free-text field empty**: form rejects with `REASON_DETAILS_REQUIRED`.
- **Agent deactivated while owning open leads**: the leads transition to "Unassigned" automatically (system activity `LEAD_REASSIGNED` with `fromAgentId=<deactivated>`, `toAgentId=null`, `reason='agent_deactivated'`). A manager must reassign manually.

## Requirements *(mandatory)*

### Functional Requirements

#### Activity Records

- **FR-001**: System MUST persist an `Activity` row for every agent action on an application. Activity rows are append-only — no UPDATE, no DELETE (Constitution Principle VI). Corrections happen by appending a new `Internal note` activity.
- **FR-002**: Each activity carries: `id`, `applicationId`, `actorStaffId` (nullable for system activities), `actorRole` (one of the 4 staff roles or `'system'`), `activityType`, `reason`, `note` (≤ 2000 chars, Arabic + English supported), `durationMinutes` (optional, integer ≥ 0), `outcomeFlags` (array, ≤ 3 entries), `followUpAt` (optional timestamp), `attachedDocumentIds` (string array, may be empty), `occurredAt` (server timestamp), `correlationId` (UUID linking to the audit-event stream).
- **FR-003**: Activity types: `CALLED_USER`, `SENT_WHATSAPP`, `SENT_EMAIL`, `RECEIVED_DOCUMENTS`, `REVIEWED_DOCUMENTS`, `REQUESTED_MORE_DOCS`, `UPDATED_APPLICANT_INFO`, `MARKED_AS_REVIEWED`, `INTERNAL_NOTE`, `STATUS_CHANGE`, `SUBMITTED_TO_BANK`, `BANK_RESPONDED`, `LEAD_REASSIGNED`, `STALE_LEAD_FLAGGED`. Each type has a fixed set of reason codes authored in [contracts/reason-codes.md](./contracts/reason-codes.md) (the canonical matrix). Backend `activity-reasons.ts` declares a `Readonly<Record<ActivityType, readonly ReasonCode[]>>` const mirroring the doc; i18n entries mirror it too. `OTHER` is always present per type with required free-text in the note.
- **FR-004**: Reason codes MUST validate against the activity type at the application layer (Zod schema). Unknown combinations rejected with `INVALID_ACTIVITY_REASON`.
- **FR-005**: For activity type `CALLED_USER`, `durationMinutes` MUST be set (non-zero integer). For other types it MUST be null or zero.
- **FR-006**: For activity type `LEAD_REASSIGNED`, the meta blob MUST carry `fromAgentId` + `toAgentId` (one may be null for assign / unassign). The system computes both from the request — the agent does not supply them.

#### Document Attachment

- **FR-007**: Activities of types `RECEIVED_DOCUMENTS` / `REVIEWED_DOCUMENTS` / `REQUESTED_MORE_DOCS` MAY carry attached documents. Other types MUST NOT.
- **FR-008**: Each attached document creates a `Document` row carrying `applicationId`, `documentType` (validated against `enumerationType = 'required_document'` from the platform-enumeration registry — the same canonical list feature 002's bank-program `requiredDocuments` checklist consumes; rejected with `UNKNOWN_ENUMERATION_KEY` if absent or `DEPRECATED_ENUMERATION_KEY` if soft-deprecated), `s3Key`, `status='uploaded'`, `uploadedByContext='agent_on_behalf'`, `uploadedBySource` ∈ `{whatsapp,email,in_person,mobile_app,courier,other}`, `uploadedByStaffId` (the agent), `originalFilename` (after PII-strip), `mimeType`, `sizeBytes`, `createdAt`.
- **FR-009**: Uploads use a two-phase flow against an S3-compatible bucket (env-configured: AWS S3 / MinIO / Wasabi / DO Spaces). (1) Agent requests a presigned PUT URL → server returns URL (5-minute TTL) + ephemeral document-id. (2) Agent PUTs the file directly to the storage, then submits the activity carrying the document-id list. File size limit: 10 MB. Allowed MIME types: `image/jpeg`, `image/png`, `image/heic`, `application/pdf`. Violations return `FILE_TOO_LARGE` (413) or `FILE_TYPE_NOT_ALLOWED` (415) at the presigned-URL request step. Admin reads use presigned GET URLs (15-minute TTL).
- **FR-010**: After the activity persists, a `DOCUMENT_UPLOADED` audit event MUST fire per attached document, all sharing the activity's `correlationId`.

#### Detail Screen — Single Action Surface

- **FR-010a**: The application-detail page at `/applications/:id` is the SOLE action surface for the lead. The list page MUST NOT carry inline action buttons (no "Add Activity" / "Reassign" / "Attach" rendered inline on a row); every action requires opening the detail screen.
- **FR-010b**: The detail header MUST render every primary action the current user's role permits, in this order (left to right in LTR; right to left in RTL): **Add Activity** (always when user can write), **Attach Documents** (alias for Add Activity scoped to document-receipt types), **Assign / Reassign** (visible only to `sales_manager` + `super_admin`), **Mark Ready for Bank Submission** (visible only when `leadStatus = document_collection` AND every required document for at least one matched program is `verified`), **Action menu** carrying the long-tail verbs (Internal note, Request more docs, Update applicant info, Marked as reviewed with non-`ready_for_submission` reasons, Status change).
- **FR-010c**: Clicking a row in the list page MUST navigate to the detail screen — no in-place expansion, no side drawer. Maintains a single mental model: "click → detail screen → act → back to list".
- **FR-010d**: The detail screen MUST render the activity timeline below the header + offer cards. Timeline updates appear without page reload after a successful Add Activity call (signal-driven re-render).

#### Application Assignment

- **FR-011**: Every application MAY have an `assignedAgentStaffId`. Unset = unassigned. Only `sales_manager` and `super_admin` can assign / reassign. Self-assignment by a `sales_agent` is allowed only if the lead is currently unassigned.
- **FR-012**: A `sales_agent` MUST see only applications where `assignedAgentStaffId = self.id` in their list view. Direct-URL access to non-assigned applications returns `ACTIVITY_FORBIDDEN_NOT_ASSIGNED` (403).
- **FR-013**: A `sales_manager` MUST see all applications regardless of assignment.
- **FR-014**: An `analyst` MUST see all applications with PII masked + agent identity anonymized to per-session aliases.

#### Follow-Up Reminders

- **FR-015**: An activity MAY carry a `followUpAt` timestamp. The agent's reminder widget MUST surface every activity authored-by-self whose `followUpAt` falls in `[now-1h, now+24h]` window as "due today".
- **FR-016**: Marking a reminder Completed creates a new activity of type `INTERNAL_NOTE` with reason `FOLLOWUP_COMPLETED` referencing the source activity in the meta. The original reminder activity stays put (append-only).
- **FR-017**: Marking a reminder Snoozed creates a new activity of type `INTERNAL_NOTE` with reason `FOLLOWUP_SNOOZED` and a NEW `followUpAt` value; the original activity's `followUpAt` is NOT mutated (append-only).
- **FR-018**: Marking a reminder Cancelled creates a new activity of type `INTERNAL_NOTE` with reason `FOLLOWUP_CANCELLED` + a cancellation reason in the note.
- **FR-019**: `followUpAt` MUST be in the future at write time; values up to 2 years out are accepted; values > 6 months trigger a UI confirmation but the API accepts them silently.

#### List + Filter

- **FR-020**: Application list rows carry: last activity (type + occurredAt), total activity count, document-progress fraction, stale indicator (`MAX(activity.occurredAt) < now() − 48h`), overdue-follow-up indicator (any activity with `followUpAt < now()` AND no subsequent `INTERNAL_NOTE` with reason `FOLLOWUP_COMPLETED|SNOOZED|CANCELLED` referencing it).
- **FR-021**: List supports filter chips, driven by `application.leadStatus` (NOT `application.status`): "Needs first contact" (`leadStatus = needs_first_contact` OR zero activities), "Stale" (per FR-020 stale rule), "Recently contacted" (activity in last 4 h), "Pending follow-up today", "Document collection in progress" (`leadStatus = document_collection`), "Ready for bank submission" (`leadStatus = ready_for_submission`), "Submitted to bank" (`leadStatus = submitted_to_bank`).
- **FR-022**: Filter selections serialize to `?filter=needs_first_contact|stale|recent|followup_today|docs_in_progress|ready_for_submission|submitted_to_bank`.

#### Stale-Lead Detection

- **FR-023**: System MUST run a cron job (hourly) that scans applications where `(MAX(activity.occurredAt) < now() − 48h OR no activities) AND status NOT IN ('archived', 'erased') AND leadStatus NOT IN ('submitted_to_bank', 'bank_decided') AND no STALE_LEAD_FLAGGED activity in the last 7 days`, and for each create a `STALE_LEAD_FLAGGED` activity authored by the platform's reserved system actor and emit a `MANAGER_ATTENTION_REQUESTED` audit event.
- **FR-024**: The cron run MUST be idempotent — re-running within the same hour does nothing. Multi-instance safety MUST be enforced via a Redis `SETNX` distributed lock (`stale-lead-scan:lock`, 55-min TTL) so only one backend instance executes the scan per hour even when the platform runs N replicas.

#### Customer Timeline Endpoint

- **FR-025**: `GET /api/v1/applications/:applicationId/timeline` (HMAC-guarded same as `/api/v1/apply`) returns the simplified milestone-only stream. Source is `leadStatus` transitions (not raw activities). Mapping: every change of `application.leadStatus` emits a `MILESTONE_<value>` entry (`MILESTONE_NEEDS_FIRST_CONTACT`, `_DOCUMENT_COLLECTION`, `_READY_FOR_SUBMISSION`, `_SUBMITTED_TO_BANK`, `_BANK_DECIDED`); `BANK_RESPONDED` activity maps to `MILESTONE_BANK_DECIDED` carrying the outcome code. All raw `activity` types other than the milestone-emitting set are filtered OUT.
- **FR-026**: Each milestone entry carries `code`, `occurredAt`, `localizedLabelCode`, optional `outcome` (for `BANK_RESPONDED`), optional `nextStepHint` (for `MILESTONE_BANK_REJECTED` → "consider applying with a guarantor"). NO agent identities, no notes, no document filenames.
- **FR-027**: Customer timeline endpoint MUST verify the request signature against the applicant's mobile-client identity OR the application's `mobileClientId` (the same identity that submitted it). Unauthorized = `HMAC_CLIENT_UNKNOWN`.

#### Analyst Aggregates

- **FR-028**: `GET /api/admin/lead-analytics/activity-summary?windowDays=N` returns per-(agent alias, activityType) counts + total durationMinutes for `CALLED_USER` activities. Window cap shares the feature-004 180-day rule.
- **FR-029**: The endpoint MUST replace `actorStaffId` with a per-session alias generator (`Agent A`, `Agent B`, …) consistent within the analyst's session. Server-side aliasing keyed by the analyst's JWT `sub` + a session-deterministic salt.
- **FR-030**: Note bodies + attached-document filenames MUST NOT appear in the analyst response at any depth.

#### Audit

- **FR-031**: Adding an activity emits `APPLICATION_ACTIVITY_LOGGED` (NEW). For activities carrying attached documents, each document additionally emits `DOCUMENT_UPLOADED` (NEW); all events in a single agent action share the same `correlationId`.
- **FR-032**: Reassignment emits `APPLICATION_REASSIGNED` (NEW) carrying `fromAgentId` + `toAgentId` + reason.
- **FR-033**: Stale-lead detection emits `MANAGER_ATTENTION_REQUESTED` (NEW) carrying `applicationId` + reason `no_activity_48h`.

#### Error Codes (new)

- **FR-034**: `ACTIVITY_FORBIDDEN_NOT_ASSIGNED` (403) — agent tried to act on a lead they don't own.
- **FR-035**: `INVALID_ACTIVITY_REASON` (422) — reason code doesn't belong to the activity type.
- **FR-036**: `REASON_DETAILS_REQUIRED` (422) — `OTHER` reason without free-text note.
- **FR-037**: `DURATION_REQUIRED_FOR_CALL` (422) — `CALLED_USER` activity without `durationMinutes`.
- **FR-038**: `FOLLOWUP_IN_PAST` (422) — `followUpAt` ≤ now().
- **FR-039**: `FILE_TOO_LARGE` (413) — attachment > 10 MB.
- **FR-040**: `FILE_TYPE_NOT_ALLOWED` (415) — MIME outside the allowed set.

### Key Entities

- **Activity**: append-only chronological log entry. PK `cuid`. Fields per FR-002. Indexed `(applicationId, occurredAt DESC)` for timeline reads, `(actorStaffId, occurredAt DESC)` for agent-performance queries, `(followUpAt)` partial index for the reminder lookup.
- **Document**: applicant document persisted by an agent attachment (this feature) OR mobile upload (future). Fields per FR-008. Indexed `(applicationId, documentType, status)`.
- **Application** (extended): adds `assignedAgentStaffId` nullable FK + `assignedAt` timestamp + `leadStatus LeadStatus` column with default `needs_first_contact` (drives the agent-workflow filters; independent of the engine-outcome `status` column from feature 003).
- **LeadStatus** (new enum): `needs_first_contact` (default — application persisted but no agent action yet) → `document_collection` (an activity of type `REQUESTED_MORE_DOCS` or `RECEIVED_DOCUMENTS` has fired) → `ready_for_submission` (an activity of type `MARKED_AS_REVIEWED` with reason `Ready for bank submission` has fired) → `submitted_to_bank` (a `SUBMITTED_TO_BANK` activity has fired) → `bank_decided` (a `BANK_RESPONDED` activity has fired). Transitions are derived from activity writes by a service-layer hook — the agent never directly mutates `leadStatus`; activity emission drives it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of agent actions on an application produce exactly one `Activity` row + the expected audit events. No silent drops.
- **SC-002**: A `sales_agent` cannot read another agent's assigned application via direct URL — backend returns `ACTIVITY_FORBIDDEN_NOT_ASSIGNED` deterministically for any seeded scenario.
- **SC-003**: List filter "Stale" returns the same set as a direct SQL `WHERE (MAX(activity.occurredAt) < now() − 48h OR application has zero activities)` for any seed of 1 000 applications.
- **SC-004**: The hourly stale-lead cron is idempotent — running 10 times in 60 minutes produces exactly one new `STALE_LEAD_FLAGGED` activity per qualifying application.
- **SC-005**: Customer timeline endpoint never returns an agent name, a note body, or a non-system reason code, across any seeded application.
- **SC-006**: Analyst activity-summary endpoint returns per-agent aggregates using session-consistent aliases — `Agent A` for the same `actorStaffId` across every request in one analyst's session.
- **SC-007**: Attachment upload p95 < 2.5 s end-to-end (presigned URL request + S3 PUT + activity submission) for a 5 MB JPG over a typical Egyptian 4G connection.
- **SC-008**: Add Activity modal renders + becomes interactive < 200 ms after click on a typical office-grade laptop (FCP measurement).
- **SC-009**: Append-only invariant — no `Activity` row's `note` / `reason` / `activityType` field changes between any two reads of the same id. Verified by Postgres-level trigger that blocks `UPDATE` / `DELETE` (extra safety on top of the application's "no update path" discipline).
- **SC-010**: 100% of activity-related strings localize in both AR and EN; no English fallback shown to an Arabic-locale operator.

## Assumptions

- The agent-workflow lifecycle is captured in a NEW `LeadStatus` enum + `application.leadStatus` column (defaulting to `needs_first_contact`). The existing `ApplicationStatus` enum from feature 003 stays untouched. Customer-facing milestones derive from `leadStatus` transitions, not from raw `ApplicationStatus`.
- Email + WhatsApp deep integration (auto-syncing inbound channel messages back into the activity timeline) is OUT OF SCOPE — agents log manually for v1. A future feature can attach a WhatsApp Business webhook to auto-create activities.
- Full-text search inside activity notes is OUT OF SCOPE — v1 uses Postgres `ILIKE` on note bodies; a future feature can layer pg_trgm or an external search index.
- Document VERIFICATION workflow (agent marks document as `verified` after reviewing, vs `uploaded` from agent attachment) is part of this spec at the persistence level (FR-008 `status` field) but the verification UI lives in the existing application-detail page's offer-card flow — out of scope for new tasks.
- Customer mobile app (Flutter) consuming the timeline endpoint ships under a separate feature; this spec only delivers the contract.
- The reserved "system" actor (for stale-lead flags + agent-deactivation reassignments) is a special `staff_account` row inserted by the migration with role `super_admin`, `isActive=false`, email `system@masrafy.local`. Filtered out of the user-list page by a `WHERE email != 'system@masrafy.local'` clause.
- WhatsApp / email message-history attachments uploaded by agents are FROZEN at attach time — re-receiving the same file later creates a new Document row (no deduplication on hash). Operator manages naming. Future feature can layer hash-based dedup.
- Analyst aggregates are LIVE queries against `bank_offer` + `Activity` + `Document` — no pre-aggregated tables. If the activity table grows past 1 M rows, a future feature ships materialized views.
- Mobile app upload IS a future feature; the document model is provisioned now so the moment it ships, mobile-uploaded documents land in the same table with `uploadedByContext='user'`.

## Permission Matrix

| Operation | super_admin | sales_manager | sales_agent | analyst |
|---|---|---|---|---|
| List own applications | ✓ | ✓ | ✓ (own) | ✓ (anonymized) |
| List ALL applications | ✓ | ✓ | — | ✓ (anonymized) |
| Read application detail | ✓ | ✓ | ✓ (assigned) | ✓ (PII-masked + anonymized) |
| Add activity | ✓ | ✓ | ✓ (assigned) | — |
| Read activity timeline | ✓ | ✓ | ✓ (assigned) | ✓ (note bodies hidden) |
| Assign / reassign lead | ✓ | ✓ | — (self-assign of unassigned only) | — |
| Run stale-lead cron | ✓ (manual trigger) | — | — | — |
| Mark document `verified` | ✓ | ✓ | ✓ (assigned) | — |
| Customer timeline endpoint | — | — | — | — (HMAC-authed customer only) |
| Analyst activity-summary | ✓ | ✓ | — | ✓ |

## Constitution Alignment

- **Principle I — Decimal for money**: no monetary fields added.
- **Principle II — Banks are data, not code**: BankProgram enumeration drives the `SUBMITTED_TO_BANK` activity's reason set (FR-003); never hard-coded.
- **Principle III — Typed errors end-to-end**: 7 new codes (FR-034 to FR-040) ship with AR + EN translations in the same PR.
- **Principle IV — Arabic-first i18n**: every activity-type icon + reason label + filter chip + customer-facing milestone label ships in both locales.
- **Principle V — Matching engine is the core IP**: untouched. Activities are an orchestration concern, not an engine concern. The activity module imports nothing from `src/matching/`.
- **Principle VI — PII protection**: activity notes contain PII (mentioned customer names, financial details). Note bodies are protected — never logged via Pino (redact path), never returned to analysts, never exposed to customer endpoint.
- **Principle VII — Observability**: 3 new audit events (`APPLICATION_ACTIVITY_LOGGED`, `APPLICATION_REASSIGNED`, `MANAGER_ATTENTION_REQUESTED`) + extended `DOCUMENT_UPLOADED` correlated by per-action `correlationId`.
- **Principle XIII — Dual auth**: customer timeline endpoint uses HMAC (same surface as `/apply`); admin endpoints use JWT + RolesGuard.
- **Principle XIV — API contract envelope**: every new endpoint follows `{ success, data }` shape.
- **Principle XV — Rate limiting**: activity-create endpoint inherits the admin throttler. Customer-timeline endpoint inherits the mobile-client rate-limit (5/h per applicant fingerprint) from feature 003.
- **Principle XXIII — UI UX skill pipeline**: every new screen (Add Activity modal, list filter chips, activity timeline, reminders widget, analyst aggregate view, customer timeline placeholder) MUST invoke `promax` pre-design + `impec` post-implementation. Pipeline-task gating in tasks.md.
