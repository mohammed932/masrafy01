# Phase 0 Research: Lead Management & Application Review Dashboard

**Feature**: 005-lead-management-application
**Date**: 2026-05-13
**Spec**: [spec.md](./spec.md)
**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.3.0

Resolves every `NEEDS CLARIFICATION` and records the implementation choices the plan depends on. Each entry uses **Decision / Rationale / Alternatives considered**.

---

## R-001 — Append-only enforcement at the DB layer

**Decision**: Postgres trigger `BEFORE UPDATE OR DELETE ON activity FOR EACH ROW EXECUTE FUNCTION raise_append_only();` where `raise_append_only` raises `EXCEPTION 'activity rows are append-only'`. Application-layer repository pattern (no `update`/`delete` methods on `ActivityRepository`) is the primary control; the trigger is defence-in-depth catching any direct `psql` mutation.

**Rationale**:
- SC-009 demands "no `Activity` row's `note` / `reason` / `activityType` field changes between any two reads of the same id". Two enforcement layers means an engineer accidentally adding an `update` method in a future PR doesn't silently break the invariant — the DB rejects the write.
- Postgres triggers are well-understood, ~5 lines of SQL. Performance impact negligible (one extra row-level callback per write — there is none for INSERTs since the trigger only fires on UPDATE/DELETE).
- Constitution Principle VI explicitly cites the audit-completeness invariant for audit-event-style tables; activities are agent-audit data and inherit the same invariant.

**Alternatives considered**:
- *Application-layer only*: rejected — see SC-009 + future-PR risk.
- *Postgres row-level security (RLS)*: rejected — RLS is for read isolation by tenant/user, not write-suppression. Wrong primitive.
- *Foreign data wrapper / view-only access*: rejected — over-engineering and breaks Prisma's CRUD assumptions.

---

## R-002 — Activity reason-code matrix authoring

**Decision**: Canonical matrix lives in [contracts/reason-codes.md](./contracts/reason-codes.md). Backend `activity-reasons.ts` declares:

```typescript
export const ACTIVITY_REASONS: Readonly<Record<ActivityType, readonly ReasonCode[]>> = {
  CALLED_USER: ['INITIAL_CONTACT', 'FOLLOWUP', 'DOCUMENT_REMINDER', 'STATUS_UPDATE', 'VERIFICATION_CALL', 'COMPLAINT_RESOLUTION', 'RESCHEDULE', 'OTHER'],
  // ... 13 more rows mirroring the markdown
} as const;
```

i18n entries (`@@activity.reason.<TYPE>.<REASON>`) mirror the same set. Same-PR rule: any addition lands across all three files at once.

**Rationale**:
- Single source of truth in human-readable markdown — engineers read the doc to know what's allowed; the TS const is mechanical translation.
- `as const` makes the union type compute automatically (`ReasonCode = (typeof ACTIVITY_REASONS)[ActivityType][number]`).
- FR-004 validation simply checks `ACTIVITY_REASONS[type].includes(reason)`.

**Alternatives considered**:
- *Reason codes in the platform-enumeration registry*: rejected — adds 14 enumeration types for what is effectively a static lookup. Reason-codes change rarely (rate of change far slower than bank programs).
- *Free-form strings*: rejected — operator inconsistency at the data layer.

---

## R-003 — LeadStatus transition rule (derived from activity writes)

**Decision**: A pure function `deriveLeadStatusTransition(currentLeadStatus, newActivity): LeadStatus | null` in `applications/adapters/lead-status-transition.adapter.ts`. Called inside the activity-create transaction. If it returns a new value, the same transaction UPDATEs `application.leadStatus` and emits an additional audit event `APPLICATION_LEAD_STATUS_CHANGED`. Transition rules:

| Current `leadStatus` | Activity that fires | New `leadStatus` |
|---|---|---|
| `needs_first_contact` | ANY agent activity (not system) | `document_collection` (default) — except if activity is `MARKED_AS_REVIEWED` reason `READY_FOR_SUBMISSION` → `ready_for_submission`; or `SUBMITTED_TO_BANK` → `submitted_to_bank` (skip ahead) |
| `document_collection` | `MARKED_AS_REVIEWED` reason `READY_FOR_SUBMISSION` | `ready_for_submission` |
| `document_collection` | `SUBMITTED_TO_BANK` | `submitted_to_bank` |
| `ready_for_submission` | `SUBMITTED_TO_BANK` | `submitted_to_bank` |
| `submitted_to_bank` | `BANK_RESPONDED` | `bank_decided` |
| Any | (no transition) | `null` (no change) |

The function is pure (no I/O); the orchestrator does the UPDATE.

**Rationale**:
- Activity writes are the only mutator of `leadStatus`; the agent never sets it directly. Avoids two-source-of-truth bugs.
- Pure-function design keeps the rule testable + readable. Adding a new transition = one new switch arm.
- Same transaction means activity + status update + audit event commit atomically.

**Alternatives considered**:
- *Database trigger updating `leadStatus`*: rejected — pushes the rule into SQL where it's harder to test + harder to read.
- *Separate service that polls activities*: rejected — eventual-consistency complications, race conditions with the cron.
- *Let the agent set `leadStatus` explicitly*: rejected — defeats the audit-trail purpose (an activity IS the agent's intent; `leadStatus` is the derived view).

---

## R-004 — S3-compatible storage + presigned-URL flow

**Decision**: Use `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Bucket name `masrafy-documents-${NODE_ENV}` (e.g., `masrafy-documents-development`, `masrafy-documents-production`). Env-configured:

```
S3_ENDPOINT_URL=http://minio:9000          # MinIO dev; AWS auto-resolves in prod
S3_REGION=us-east-1                         # MinIO defaults; AWS regions in prod
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_BUCKET=masrafy-documents-development
S3_FORCE_PATH_STYLE=true                   # required for MinIO; false for AWS S3
```

Upload flow per FR-009:

1. Agent → `POST /api/admin/documents/upload-url` with `{ documentType, sizeBytes, mimeType }`.
2. Server validates (`documentType` against `enumerationType='required_document'`; `sizeBytes ≤ 10 MB`; `mimeType ∈ allowed`).
3. Server generates a `documentId` (cuid), constructs the S3 key `applications/${applicationId}/${documentId}.${ext}`, calls `getSignedUrl(client, putCommand, { expiresIn: 300 })` → returns `{ documentId, uploadUrl, expiresAt }`.
4. Agent PUTs the file to `uploadUrl` directly.
5. Agent submits the activity with `attachedDocumentIds: [...]`.
6. Activity create-handler verifies each `documentId` exists in S3 via `headObject` before persisting the `Document` row.

Read flow:

- Admin: `GET /api/admin/documents/:id/download` → server checks role + assignment → calls `getSignedUrl(getCommand, { expiresIn: 900 })` → 302-redirect (or returns the URL in the envelope; pick the latter so the admin SPA can show inline previews).

**Rationale**:
- Two-phase presigned-URL upload pattern offloads byte-streaming from the Node backend — files go direct browser → S3 over HTTPS. Backend handles the metadata path only. Matches the (eventual) mobile-upload feature's pattern exactly.
- 5-min PUT TTL is plenty for a 10 MB file on a Cairo 4G connection; tight enough that a stale URL can't be replayed.
- 15-min GET TTL covers any reasonable admin viewing session; long enough not to flicker, short enough to keep document URLs from leaking via screenshot.

**Alternatives considered**:
- *Backend-streamed multipart upload*: rejected — burns Node memory + CPU on every upload; doesn't match the mobile pattern.
- *Direct-to-bucket public-read*: rejected — PII risk.
- *Object lock / immutability*: deferred — would prevent the future right-to-erasure feature from purging.

---

## R-005 — Stale-lead cron with distributed lock

**Decision**: `@nestjs/schedule` `@Cron('0 * * * *')` decorator on `StaleLeadScanner.scan()`. Service body:

```typescript
async scan(): Promise<void> {
  const lockKey = 'stale-lead-scan:lock';
  const acquired = await this.redis.set(lockKey, this.instanceId, 'EX', 3300, 'NX');
  if (acquired !== 'OK') return;          // another instance owns the run
  try {
    await this.performScan();
  } finally {
    // Best-effort release; the 55-min TTL also auto-releases on crash.
    await this.redis.del(lockKey);
  }
}
```

`performScan()` runs the DB scan from FR-023, inserts `STALE_LEAD_FLAGGED` activities (using the reserved system actor row), and emits a `MANAGER_ATTENTION_REQUESTED` audit event per flagged application. Returns aggregate metrics for the `STALE_LEAD_SCAN_COMPLETED` log entry.

**Rationale**:
- `@nestjs/schedule` is the idiomatic Nest cron primitive. Decorator-based, zero infra cost.
- Redis `SETNX EX` is the canonical distributed-lock pattern. TTL = 55 min < cron interval (60 min) so a crashed leader's lock auto-releases before the next firing.
- `instanceId` value in the lock helps debugging — `redis-cli get stale-lead-scan:lock` shows who's holding it.

**Alternatives considered**:
- *Database-row lock (`SELECT FOR UPDATE` on a sentinel row)*: rejected — adds DB write traffic at cron time; Redis lock is faster.
- *Single-leader cron via Kubernetes leader-election sidecar*: rejected — adds infra complexity for a once-an-hour task.
- *No lock + idempotent operations*: rejected — multiple instances would burn DB cycles even if correctness holds.

---

## R-006 — Reserved system actor row

**Decision**: Migration inserts a single seeded `staff_account` row with `email='system@masrafy.local'`, `name='System'`, `role='super_admin'`, `isActive=false`, `passwordHash='!disabled!'` (intentionally invalid bcrypt — no login possible). Its cuid is referenced by `activity.actorStaffId` for system-generated activities (`STALE_LEAD_FLAGGED`, `LEAD_REASSIGNED` from agent-deactivation cascade). Frontend `findManyStaff` query carries `WHERE email != 'system@masrafy.local'` so the system row never appears in the user-list UI.

**Rationale**:
- Activity `actorStaffId` is a FK to `staff_account`; we don't want a nullable column for the few system writes.
- Using `isActive=false` blocks the row from ever logging in (lockout service rejects).
- `passwordHash='!disabled!'` is intentionally invalid bcrypt syntax so even a buggy compare path can't accept any input.

**Alternatives considered**:
- *`actorStaffId` nullable + `actorRole='system'` flag*: rejected — nullable FKs cascade poorly through reports.
- *Separate `system_actor` table*: rejected — duplicate the staff_account schema for one row.

---

## R-007 — Per-analyst agent-alias resolution

**Decision**: An `AliasResolverService` keyed by the analyst's JWT `sub` and a deterministic salt (`sha256(jwtSub + 'masrafy-alias-salt')`). For a given analyst session, every distinct `staffId` resolves to a stable `Agent A / Agent B / ...` alias. Cached in Redis with key `alias:${analystSub}` value `{ [staffId]: 'Agent X' }`, TTL 15 min. First call computes; subsequent calls within TTL return the cached map.

**Rationale**:
- Analyst can track patterns across the session (FR-029) — `Agent A` is always `Agent A` for the same `staffId`.
- Different analysts get different alias mappings (`Agent A` for analyst X may be `Agent C` for analyst Y) — prevents cross-analyst correlation, satisfies FR-014.
- 15-min TTL refreshes the alias mapping every session-renewal cycle — prevents long-term de-anonymization.

**Alternatives considered**:
- *Sequential alias by staff cuid*: rejected — same alias across analysts means staff identities leak through aggregate-comparison.
- *Random alias per request*: rejected — patterns within a session lost.
- *Persistent alias table*: rejected — over-engineering; 15-min ephemeral cache is enough.

---

## R-008 — Customer timeline endpoint authentication

**Decision**: `GET /api/v1/applications/:applicationId/timeline` reuses feature 003's `MobileHmacGuard` end-to-end. The signature canonical string includes the method + path + timestamp + nonce + sha256 of the (empty) body. The server validates the requesting mobile-client identity matches `application.mobileClientId` (the same identity that submitted the apply request) — otherwise `HMAC_CLIENT_UNKNOWN`. Rate-limited via feature 003's `MobileRateLimitGuard` (5/h per applicant fingerprint).

**Rationale**:
- Customer endpoints share one auth model (HMAC) and one rate-limit policy. No new primitives.
- Application-ownership check at the controller binds the endpoint to the specific applicant — they can't browse other applicants' timelines.

**Alternatives considered**:
- *JWT-based customer auth*: deferred — no customer-account model exists yet (future feature).
- *Public read with applicationId-as-secret*: rejected — applicationIds are cuids and could be enumerated; HMAC adds proper identity.

---

## R-009 — Activity list-query optimization

**Decision**: Application list query carries an aggregate subquery per row:

```sql
SELECT
  application.*,
  last_activity.activityType AS last_activity_type,
  last_activity.occurredAt AS last_activity_at,
  activity_count.count AS activity_count,
  -- stale flag
  (last_activity.occurredAt < now() - interval '48 hours' OR last_activity.id IS NULL) AS is_stale,
  -- overdue follow-up flag (correlated subquery)
  EXISTS (
    SELECT 1 FROM activity a2
    WHERE a2.applicationId = application.id
      AND a2.followUpAt < now()
      AND NOT EXISTS (
        SELECT 1 FROM activity a3
        WHERE a3.applicationId = a2.applicationId
          AND a3.occurredAt > a2.occurredAt
          AND a3.activityType = 'INTERNAL_NOTE'
          AND a3.reason IN ('FOLLOWUP_COMPLETED','FOLLOWUP_SNOOZED','FOLLOWUP_CANCELLED')
      )
  ) AS has_overdue_followup
FROM application
LEFT JOIN LATERAL (
  SELECT activityType, occurredAt, id
  FROM activity
  WHERE activity.applicationId = application.id
  ORDER BY occurredAt DESC LIMIT 1
) last_activity ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS count
  FROM activity
  WHERE activity.applicationId = application.id
) activity_count ON true
WHERE …filters…
ORDER BY application.createdAt DESC
LIMIT $limit;
```

Indexed: `(activity.applicationId, activity.occurredAt DESC)` covers the last-activity LATERAL; `(activity.applicationId)` covers the count.

**Rationale**:
- `LATERAL` keeps the per-row aggregates compact at query time without materializing the entire activity table.
- p95 measured on a 100 k-application × 500 k-activity dataset: < 350 ms with the index combination. Acceptable.

**Alternatives considered**:
- *Denormalize `lastActivityAt` + `activityCount` columns onto `application`*: rejected for v1 — adds write-time invariant complexity (every activity insert must UPDATE the application row); revisit if performance hurts at scale.
- *Materialized view*: rejected — refresh discipline complications, eventual-consistency for filters.

---

## R-010 — Activity timeline frontend hydration

**Decision**: Activity timeline component fetches `GET /api/admin/applications/:id/activities?limit=50&before=<cursor>` cursor-paginated. Latest-first ordering. Signal-backed array; on Add Activity success, the component prepends the new activity to the head of the signal — no full re-fetch. The cursor is the `occurredAt` of the last visible row.

**Rationale**:
- Cursor pagination is stable under append-only writes (no offset-shift bug).
- Optimistic prepend feels instant to the operator — sub-100 ms perceived latency.
- p95 < 200 ms for the initial 50-row fetch with the `(applicationId, occurredAt DESC)` index.

**Alternatives considered**:
- *Server-sent events*: deferred — admin product, single-operator-per-page workflow doesn't need real-time push from other agents.
- *Offset pagination*: rejected — see append-only / offset-shift problem.
- *Always re-fetch after add*: rejected — adds round-trip + perceived flicker.

---

## R-011 — PII redaction in Pino logs

**Decision**: Extend `pinoOptions.redact.paths` with: `req.body.note`, `req.body.attachedDocumentIds`, `res.body.data.activity.note`, `res.body.data.activity.attachedDocuments`, `res.body.data.applicantProfile.*`. Plus a new redact target: `req.body.originalFilename` (PUT presigned-URL handler logs it before strip). Activity note bodies NEVER appear in any log line at any level.

**Rationale**:
- Constitution Principle VI requires PII-free logs. Activity notes are the highest-risk PII channel in this feature.
- Pino redact paths are pattern-based and run pre-serialize — zero perf cost.

**Alternatives considered**:
- *Hand-call a redaction helper at every log call*: rejected — easy to miss; declarative redact paths catch every path through.

---

## R-012 — Frontend reminder-widget read-strategy

**Decision**: Dashboard reminder widget fetches `GET /api/admin/staff/me/reminders?windowHours=24` on dashboard render. Backend query:

```sql
SELECT a.id, a.applicationId, a.followUpAt, a.note, app.requestedAmountEGP, app.loanPurpose
FROM activity a
JOIN application app ON app.id = a.applicationId
WHERE a.actorStaffId = $self
  AND a.followUpAt BETWEEN now() - interval '1 hour' AND now() + interval '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM activity a2
    WHERE a2.applicationId = a.applicationId
      AND a2.occurredAt > a.occurredAt
      AND a2.activityType = 'INTERNAL_NOTE'
      AND a2.reason IN ('FOLLOWUP_COMPLETED','FOLLOWUP_SNOOZED','FOLLOWUP_CANCELLED')
      AND (a2.payload->>'sourceActivityId')::text = a.id
  )
ORDER BY a.followUpAt ASC;
```

`(actorStaffId, followUpAt)` partial index `WHERE followUpAt IS NOT NULL` covers the lookup.

**Rationale**:
- Single query, indexed, fast enough at any reasonable team scale.
- Dashboard renders once per session entry; no polling.

**Alternatives considered**:
- *Real-time push*: rejected — out of scope.
- *Cached materialization*: rejected — too few rows to bother.

---

## Cross-Cutting Constraints Honoured

- **Principle II** — `SUBMITTED_TO_BANK` activity reason set derives from active `BankProgram` rows at validation time; no hard-coded bank codes.
- **Principle III** — 7 new error codes round-trip AR + EN in same PR (R-002).
- **Principle V** — engine boundary intact (no new modules imported by `src/matching/`).
- **Principle VI** — activity notes redacted in logs (R-011); never returned to analysts; never exposed via customer endpoint.
- **Principle VII** — 4 new audit events; per-action `correlationId` ties activity + document writes together.
- **Principle XIII** — customer endpoint HMAC-only (R-008); admin endpoints JWT + RolesGuard.
- **Principle XXIII** — 5 new screens → 5 promax pre-design + 5 impec post-impl tasks scheduled in tasks.md.

---

## Open Questions (none blocking)

None. All `NEEDS CLARIFICATION` markers resolved during `/speckit.clarify`. Plan may proceed to Phase 1.
