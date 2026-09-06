# Quickstart: Lead Management & Application Review Dashboard (Feature 005)

**Audience**: Masrafy operators + developers verifying a fresh environment.
**Prerequisites**: Features 001 + 002 + 003 + 004 shipped; infra running per [feature 004 quickstart §1–§2](../004-approval-probability-display/quickstart.md).

End-to-end walkthrough from migration → MinIO bring-up → first agent activity → list filter triage → assign lead → customer timeline check → stale-lead cron → analyst aggregate. Steps marked **dev** are infrastructure; **operator** are dashboard / API flows.

---

## §1 · Bring up MinIO + apply migration (dev)

Update `docker/compose.dev.yml` to include MinIO:

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  ports:
    - "9000:9000"
    - "9001:9001"
  volumes:
    - minio_data:/data
```

```bash
docker compose -f docker/compose.dev.yml up -d postgres redis minio
# Create the dev bucket
docker exec masrafy_minio_dev mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec masrafy_minio_dev mc mb local/masrafy-documents-development --ignore-existing
```

Update `backend/.env`:

```
S3_ENDPOINT_URL=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_BUCKET=masrafy-documents-development
S3_FORCE_PATH_STYLE=true
```

Apply the migration:

```bash
cd backend && npx prisma migrate dev --name lead_management_activity && npx prisma generate
```

Verify:

```sql
SELECT enum_range(NULL::"LeadStatus");
-- {needs_first_contact,document_collection,ready_for_submission,submitted_to_bank,bank_decided}

SELECT id, email FROM staff_account WHERE email = 'system@masrafy.local';
-- 1 row, isActive=false
```

## §2 · Start backend + admin (dev)

```bash
cd backend && npm run start:dev          # http://localhost:3000
cd admin   && npm start                  # http://localhost:5173
```

Boot log should show `[StaleLeadScanner] cron registered (0 * * * *)`.

> **v25.0.0** — this step used to also wait for `Active scoring engine version: 1.1.0-init` (from
> feature 004). That line will never print again: approval scoring, the `scoring_engine_version`
> table and the registry that logged it are all deleted, so a runbook holding for it hangs on a
> boot that is in fact healthy.

## §3 · Seed two agents + assign one application (operator, super_admin)

Sign in as `ops@masrafy.local` (super_admin). Sidebar → **Users** → **Create user**:

- Name: `Agent A`, email: `agent.a@masrafy.local`, role: `sales_agent`, password: `dev-password-12!`
- Repeat for `Agent B` (`agent.b@masrafy.local`).

Submit a fixture apply via curl (per [feature 003 quickstart §6](../003-matching-engine-post/quickstart.md#6--submit-golden-scenario-1)) so an application exists.

Sidebar → **Applications** → click any row → opens the detail page. From the detail header, open the action menu → **Assign / Reassign** → pick Agent A → submit. Verify the activity timeline now shows a `LEAD_REASSIGNED` entry. Verify `application.leadStatus` is still `needs_first_contact`:

```sql
SELECT id, "leadStatus", "assignedAgentStaffId" FROM application WHERE id = '<applicationId>';
```

## §4 · Log first agent activity (operator, sales_agent)

Sign out, sign in as `agent.a@masrafy.local`. Sidebar → **Applications** — only the assigned application shows. Click → detail page loads.

Click **Add Activity** in the header. Modal opens:

- Activity type: `Called user`
- Reason: `Initial contact`
- Note: `أبلغت العميل أن الطلب قيد المراجعة في البنك التجاري العربي`
- Duration: 12 min
- Outcome: `User confirmed`
- Follow-up: tomorrow 10:00 AM

Save. The timeline updates < 1 s — new entry at the top. `application.leadStatus` flips from `needs_first_contact` to `document_collection`:

```sql
SELECT "leadStatus" FROM application WHERE id = '<applicationId>';
-- document_collection
```

Check audit:

```sql
SELECT "eventType", "correlationId" FROM audit_event
WHERE "eventType" IN ('APPLICATION_ACTIVITY_LOGGED', 'APPLICATION_LEAD_STATUS_CHANGED')
ORDER BY "occurredAt" DESC LIMIT 5;
```

Two rows share the same `correlationId` — the activity log + the status transition.

## §5 · Attach documents via WhatsApp (operator, sales_agent)

In the modal, pick Activity type: `Received documents`, source `Via WhatsApp`. Click **Attach Documents** — drag two JPGs + one PDF (all < 10 MB). The frontend:

1. Calls `POST /api/admin/documents/upload-url` per file → receives presigned PUT URLs.
2. PUTs each file directly to MinIO.
3. Submits the activity with `attachedDocumentIds: [...]`.

Verify:

```sql
SELECT "documentType", status, "uploadedBySource", "uploadedByContext"
FROM document WHERE "applicationId" = '<applicationId>';
-- All 3 rows: status='uploaded', uploadedBySource='whatsapp', uploadedByContext='agent_on_behalf'
```

MinIO console at `http://localhost:9001` (login `minioadmin/minioadmin`) shows the three S3 objects under `masrafy-documents-development/applications/<applicationId>/`.

Audit:

```sql
SELECT "eventType", payload->'documentType' FROM audit_event
WHERE "eventType" = 'DOCUMENT_UPLOADED'
ORDER BY "occurredAt" DESC LIMIT 3;
```

Three rows, all share the same `correlationId` as the parent activity.

## §6 · Mark ready + submit to bank (operator, sales_agent)

Add activity → `Reviewed documents` → reason `Verified ready`. Then **Mark Ready for Bank Submission** button in the header (now visible because `leadStatus=document_collection` and at least one doc is `uploaded`). Confirms with an activity of type `MARKED_AS_REVIEWED` + reason `READY_FOR_SUBMISSION`. `leadStatus` flips to `ready_for_submission`.

Add activity → `Submitted to bank` → reason `ABK-PAYROLL-CAT-A` (dynamic reason from the active BankProgram catalog). `leadStatus` → `submitted_to_bank`.

Add activity → `Bank responded` → reason `Approved` → outcome flag `User confirmed`. `leadStatus` → `bank_decided`.

## §7 · Customer timeline endpoint (HMAC, curl)

Reuse feature 003's signing setup. Hit:

```bash
curl http://localhost:3000/api/v1/applications/<applicationId>/timeline \
  -H "X-Client-Id: $MOBILE_CLIENT_ID" \
  -H "X-Timestamp: $TS" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIG" \
  -H "X-Body-SHA256: $(printf '' | shasum -a 256 | cut -d ' ' -f 1)"
```

Expected response — milestone-only, no notes, no agent names:

```json
{
  "success": true,
  "data": {
    "applicationId": "...",
    "milestones": [
      { "code": "MILESTONE_NEEDS_FIRST_CONTACT", "occurredAt": "...", "localizedLabelCode": "milestone.needs_first_contact" },
      { "code": "MILESTONE_DOCUMENT_COLLECTION",  "occurredAt": "...", "localizedLabelCode": "milestone.document_collection" },
      { "code": "MILESTONE_READY_FOR_SUBMISSION", "occurredAt": "...", "localizedLabelCode": "milestone.ready_for_submission" },
      { "code": "MILESTONE_SUBMITTED_TO_BANK",    "occurredAt": "...", "localizedLabelCode": "milestone.submitted_to_bank" },
      { "code": "MILESTONE_BANK_DECIDED",         "occurredAt": "...", "localizedLabelCode": "milestone.bank_decided", "outcome": "approved" }
    ]
  }
}
```

## §8 · List filter triage (operator, sales_manager)

Sign in as `sales_manager`. Sidebar → **Applications**. Filter chips visible: `Needs first contact`, `Stale`, `Recently contacted`, `Pending follow-up today`, `Document collection in progress`, `Ready for bank submission`, `Submitted to bank`. Each chip shows a count.

Pick a row, right-click → **Assign / Reassign**. Verify reassignment activity logged with `fromAgentId=<Agent A>`, `toAgentId=<Agent B>`.

## §9 · Reminders widget (operator, sales_agent)

Sign in as `agent.a@masrafy.local`. Dashboard home — the "Reminders due today" widget shows the follow-up logged in §4. Click → opens the application detail page. Mark Completed → new `INTERNAL_NOTE` activity logged with reason `FOLLOWUP_COMPLETED`, source-activity-id in `meta`.

## §10 · Stale-lead cron (manual trigger, super_admin)

Manually invoke the scanner (cron runs hourly; this triggers it now for verification):

```bash
docker exec masrafy_backend_dev curl -X POST http://localhost:3000/api/admin/cron/stale-leads \
  -H "Authorization: Bearer <super_admin access token>"
```

(Endpoint exists only in dev profile; production relies on `@nestjs/schedule`.)

Verify:

```sql
SELECT "activityType", "actorRole", "actorStaffId"
FROM activity
WHERE "activityType" = 'STALE_LEAD_FLAGGED'
ORDER BY "occurredAt" DESC LIMIT 5;
```

Rows show `actorRole='system'` and `actorStaffId='clsysactor00000000000000000000'`.

Verify idempotency — invoke a second time within the same hour:

```sql
SELECT COUNT(*) FROM activity WHERE "activityType" = 'STALE_LEAD_FLAGGED';
-- Same count as before
```

Redis lock:

```bash
docker exec masrafy_redis_dev redis-cli get stale-lead-scan:lock
# Empty after the scan completes (or holds the instance-id if a run is in progress)
```

## §11 · Analyst aggregate (operator, analyst)

Sign in as `analyst.a@masrafy.local`. Sidebar → **Lead analytics**. Page renders aggregate table — every agent name replaced with `Agent A / Agent B / ...`. Same alias for the same agent within the session; new login = new mapping.

Try `?windowDays=400`. Response: `400 { success: false, code: "ANALYTICS_WINDOW_TOO_LARGE", meta: { maxDays: 180 } }` (re-used from feature 004's analytics surface).

Verify the analyst CANNOT see note bodies:

```bash
curl http://localhost:3000/api/admin/applications/<applicationId> \
  -H "Authorization: Bearer <analyst access token>" | jq '.data.activities[0].note'
# null
```

## §12 · Append-only safety check (developer-discretion)

Try to UPDATE an activity directly:

```sql
UPDATE activity SET note = 'tampered' WHERE id = '<activityId>';
-- ERROR: activity rows are append-only; UPDATE/DELETE forbidden
```

And DELETE:

```sql
DELETE FROM activity WHERE id = '<activityId>';
-- ERROR: activity rows are append-only; UPDATE/DELETE forbidden
```

## §13 · Performance check (load test)

```bash
vegeta attack -duration=60s -rate=20 -targets=targets-activities.txt | vegeta report
```

Where `targets-activities.txt` contains pre-signed activity-create requests. Confirm:

- Activity create p95 < 250 ms
- Timeline read p95 < 200 ms (200-activity application)
- Application list with aggregates p95 < 350 ms (1 000 rows)
- Presigned-URL request p95 < 100 ms

---

## Acceptance summary

| User story | Sections |
|---|---|
| US1 (agent activity logging) | §4, §5, §6 |
| US2 (manager triage + reassignment) | §8 |
| US3 (analyst aggregates) | §11 |
| US4 (customer milestone timeline) | §7 |
| US5 (stale-lead cron) | §10 |
| Constitutional gates | §5 (PII redaction in audit), §11 (anonymization), §12 (append-only at DB layer) |

If any section fails, log to `specs/005-lead-management-application/quickstart-failures.md` with step / expected / observed.
