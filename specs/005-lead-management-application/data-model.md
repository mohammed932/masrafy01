# Phase 1 Data Model: Lead Management & Application Review Dashboard

**Feature**: 005-lead-management-application
**Date**: 2026-05-13
**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

Persistent-data shapes for the `Activity` table, `Document` table, `LeadStatus` enum, `Application` extension, and the new `AuditEventType` values. All timestamps `TIMESTAMPTZ`. All primary keys `cuid()` `VARCHAR(30)` consistent with features 001–004.

---

## Entity Diff Overview

| Entity | Status | Notes |
|---|---|---|
| `Activity` | **NEW** | Append-only chronological log; FK to `Application` + `StaffAccount` |
| `Document` | **NEW** | File attachment metadata; FK to `Application`; S3 key + audit fields |
| `Application` | **EXTENDED** | +3 columns: `assignedAgentStaffId`, `assignedAt`, `leadStatus` |
| `StaffAccount` | **EXTENDED (back-relation only)** | Adds `assignedLeads Application[]` + `activitiesAuthored Activity[]` + `documentsUploaded Document[]` |
| `AuditEvent` | **EXTENDED (enum only)** | +4 values: `APPLICATION_ACTIVITY_LOGGED`, `DOCUMENT_UPLOADED`, `APPLICATION_REASSIGNED`, `MANAGER_ATTENTION_REQUESTED` |
| `LeadStatus` | **NEW (enum)** | 5 values driving the agent-workflow lifecycle |

No changes to: `BankProgram`, `BankOffer`, `ScoringEngineVersion`, `BankOfferDecision`, `RefreshToken`, `SignInAttempt`, `PlatformEnumeration`.

---

## 1. `Activity` — New Table

Append-only audit log of every action taken against an application by an agent (or the system).

```prisma
model Activity {
  id                   String          @id @default(cuid()) @db.VarChar(30)
  applicationId        String          @db.VarChar(30)
  actorStaffId         String          @db.VarChar(30)
  actorRole            String          @db.VarChar(32)         // 'super_admin' | 'sales_manager' | 'sales_agent' | 'system'
  activityType         String          @db.VarChar(48)
  reason               String          @db.VarChar(64)
  note                 String?         @db.VarChar(2000)
  durationMinutes      Int?
  outcomeFlags         String[]        @db.VarChar(48)
  followUpAt           DateTime?       @db.Timestamptz(6)
  attachedDocumentIds  String[]        @db.VarChar(30)
  meta                 Json?                                   // type-specific extras (reassignment from/to, BANK_RESPONDED outcome, etc.)
  correlationId        String          @db.VarChar(36)
  occurredAt           DateTime        @default(now()) @db.Timestamptz(6)

  application          Application     @relation("ApplicationActivities", fields: [applicationId], references: [id], onDelete: Cascade)
  actorStaff           StaffAccount    @relation("ActivityActor", fields: [actorStaffId], references: [id], onDelete: Restrict)

  @@index([applicationId, occurredAt(sort: Desc)], name: "idx_activity_application_occurred")
  @@index([actorStaffId, occurredAt(sort: Desc)], name: "idx_activity_actor_occurred")
  @@index([followUpAt], name: "idx_activity_followup", where: "\"followUpAt\" IS NOT NULL")
  @@index([activityType, reason], name: "idx_activity_type_reason")
  @@map("activity")
}
```

### Append-only enforcement (R-001)

Migration appends:

```sql
CREATE OR REPLACE FUNCTION raise_append_only_activity()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'activity rows are append-only; UPDATE/DELETE forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_append_only_guard
  BEFORE UPDATE OR DELETE ON activity
  FOR EACH ROW EXECUTE FUNCTION raise_append_only_activity();
```

### Activity types

Enumerated as TypeScript union in `activities.types.ts`. Validated against the `contracts/reason-codes.md` matrix in the service layer (FR-004). String stored in DB for flexibility — enum at DB level would require migration on every new type.

| Type | Meaning |
|---|---|
| `CALLED_USER` | Phone call (requires `durationMinutes`) |
| `SENT_WHATSAPP` | Outbound WhatsApp message |
| `SENT_EMAIL` | Outbound email |
| `RECEIVED_DOCUMENTS` | Document attached via any channel (FR-008) |
| `REVIEWED_DOCUMENTS` | Document verification action |
| `REQUESTED_MORE_DOCS` | Asked the customer for missing/replacement docs |
| `UPDATED_APPLICANT_INFO` | Correction to applicant profile |
| `MARKED_AS_REVIEWED` | Operator-signal that the application is ready for next step |
| `INTERNAL_NOTE` | Free-form internal note (includes follow-up completion / snooze / cancel) |
| `STATUS_CHANGE` | Application status (engine-outcome) transition recorded for audit |
| `SUBMITTED_TO_BANK` | Sent the application to the bank; reason = bank code |
| `BANK_RESPONDED` | Bank decision recorded |
| `LEAD_REASSIGNED` | Manager assigned/reassigned the lead |
| `STALE_LEAD_FLAGGED` | System-actor flag (FR-023) |

### `meta` JSONB shape (per type)

```jsonc
// LEAD_REASSIGNED
{ "fromAgentId": "cl...", "toAgentId": "cl...", "reassignReason": "rebalance" }

// BANK_RESPONDED
{ "bankCode": "ABK-PAYROLL-CAT-A", "outcome": "approved" | "rejected" | "needs_more_info" | "conditional" | "counter_offer", "outcomeNote": "..." }

// INTERNAL_NOTE with reason FOLLOWUP_COMPLETED|SNOOZED|CANCELLED
{ "sourceActivityId": "cl..." }   // links back to the original reminder activity
```

Validated at the service layer via Zod schemas keyed by `activityType`.

### Validation rules

- `note` ≤ 2 000 chars; required when `reason='OTHER'` (FR-036).
- `durationMinutes` required + non-zero when `activityType='CALLED_USER'` (FR-037); null for other types (FR-005).
- `outcomeFlags` ≤ 3 entries.
- `followUpAt` strictly in the future at write time (FR-019, FR-038); ≤ 2 years out hard cap.
- `attachedDocumentIds` only allowed on types `RECEIVED_DOCUMENTS` / `REVIEWED_DOCUMENTS` / `REQUESTED_MORE_DOCS` (FR-007).
- `reason` must appear in `ACTIVITY_REASONS[activityType]` (FR-004; `INVALID_ACTIVITY_REASON`).
- `correlationId` MUST be the same value used in the `APPLICATION_ACTIVITY_LOGGED` audit event for this write.

---

## 2. `Document` — New Table

```prisma
model Document {
  id                   String          @id @default(cuid()) @db.VarChar(30)
  applicationId        String          @db.VarChar(30)
  documentType         String          @db.VarChar(64)            // validates against PlatformEnumeration enumerationType='required_document'
  s3Key                String          @unique @db.VarChar(256)
  status               String          @db.VarChar(24)            // 'uploaded' | 'verified' | 'rejected' | 'erased'
  uploadedByContext    String          @db.VarChar(24)            // 'agent_on_behalf' | 'user' (future mobile)
  uploadedBySource     String          @db.VarChar(24)            // 'whatsapp' | 'email' | 'in_person' | 'mobile_app' | 'courier' | 'other'
  uploadedByStaffId    String?         @db.VarChar(30)            // null for future mobile uploads
  originalFilename     String          @db.VarChar(255)
  mimeType             String          @db.VarChar(48)
  sizeBytes            Int
  createdAt            DateTime        @default(now()) @db.Timestamptz(6)
  verifiedAt           DateTime?       @db.Timestamptz(6)
  verifiedByStaffId    String?         @db.VarChar(30)
  erasedAt             DateTime?       @db.Timestamptz(6)

  application          Application     @relation("ApplicationDocuments", fields: [applicationId], references: [id], onDelete: Cascade)
  uploadedByStaff      StaffAccount?   @relation("DocumentUploader", fields: [uploadedByStaffId], references: [id], onDelete: SetNull)
  verifiedByStaff      StaffAccount?   @relation("DocumentVerifier", fields: [verifiedByStaffId], references: [id], onDelete: SetNull)

  @@index([applicationId, documentType, status], name: "idx_document_application_type_status")
  @@index([uploadedByStaffId, createdAt(sort: Desc)], name: "idx_document_uploader_created")
  @@map("document")
}
```

### Validation rules

- `documentType` MUST exist in `PlatformEnumeration` with `enumerationType='required_document'` and `deprecatedAt IS NULL`. Else `UNKNOWN_ENUMERATION_KEY` or `DEPRECATED_ENUMERATION_KEY`.
- `sizeBytes` ≤ 10 485 760 (10 MB). Rejected at presigned-URL request step (FR-039).
- `mimeType` ∈ `{image/jpeg, image/png, image/heic, application/pdf}` (FR-040).
- `status` lifecycle: `uploaded` → `verified` (by an agent) | `rejected` (by an agent) | `erased` (future right-to-erasure). Only `verified` doc rows count toward the document-progress fraction on the list page.
- `originalFilename` is PII-stripped before persistence — strip any substring matching the applicant's first/last name (case-insensitive) and substitute with `_redacted_`.

---

## 3. `LeadStatus` Enum + `Application` Column Additions

```prisma
enum LeadStatus {
  needs_first_contact      // default — application persisted, no agent action yet
  document_collection      // agent has logged at least one non-system activity
  ready_for_submission     // MARKED_AS_REVIEWED reason READY_FOR_SUBMISSION
  submitted_to_bank        // SUBMITTED_TO_BANK fired
  bank_decided             // BANK_RESPONDED fired
}

model Application {
  // existing fields from feature 003 stay untouched ...

  // Feature 005 additions:
  assignedAgentStaffId String?       @db.VarChar(30)
  assignedAt           DateTime?     @db.Timestamptz(6)
  leadStatus           LeadStatus    @default(needs_first_contact)

  assignedAgent        StaffAccount? @relation("AssignedLeads", fields: [assignedAgentStaffId], references: [id], onDelete: SetNull)
  activities           Activity[]    @relation("ApplicationActivities")
  documents            Document[]    @relation("ApplicationDocuments")

  @@index([assignedAgentStaffId, leadStatus], name: "idx_application_agent_lead_status")
  @@index([leadStatus, createdAt(sort: Desc)], name: "idx_application_lead_status_created")
}
```

### `leadStatus` transition (R-003)

Updated inside the activity-create transaction via the pure adapter function `deriveLeadStatusTransition(currentLeadStatus, newActivity)`. Transition rules in R-003. An additional audit event `APPLICATION_LEAD_STATUS_CHANGED` fires when a transition occurs (re-using the activity's `correlationId`).

---

## 4. `StaffAccount` Back-Relations

Adds three back-relation fields (no DB-column changes):

```prisma
model StaffAccount {
  // ... existing fields ...
  assignedLeads      Application[] @relation("AssignedLeads")
  activitiesAuthored Activity[]    @relation("ActivityActor")
  documentsUploaded  Document[]    @relation("DocumentUploader")
  documentsVerified  Document[]    @relation("DocumentVerifier")
}
```

### Reserved system actor (R-006)

Single seeded row, inserted by the migration:

```sql
INSERT INTO staff_account (
  id, email, emailDisplay, name, passwordHash, role, isActive, mustChangePassword,
  createdAt, updatedAt
) VALUES (
  'clsysactor00000000000000000000',
  'system@masrafy.local', 'system@masrafy.local', 'System',
  '!disabled!', 'super_admin', false, false,
  now(), now()
);
```

`isActive=false` blocks login; the lockout service rejects on any sign-in attempt regardless. The intentionally-invalid `passwordHash` is paranoia layer 2.

---

## 5. `AuditEvent` — Enum + Payload Extensions

### New `AuditEventType` values

```prisma
enum AuditEventType {
  // ... existing ...
  APPLICATION_ACTIVITY_LOGGED
  DOCUMENT_UPLOADED
  APPLICATION_REASSIGNED
  MANAGER_ATTENTION_REQUESTED
  APPLICATION_LEAD_STATUS_CHANGED
}
```

### Payload schemas

```typescript
// APPLICATION_ACTIVITY_LOGGED
interface ApplicationActivityLoggedPayload {
  applicationId: string;
  activityId: string;
  activityType: ActivityType;
  reason: ReasonCode;
  hasAttachments: boolean;
  hasFollowUp: boolean;
  followUpAt?: string;       // ISO if present
  actorRole: 'super_admin' | 'sales_manager' | 'sales_agent' | 'system';
}

// DOCUMENT_UPLOADED
interface DocumentUploadedPayload {
  applicationId: string;
  activityId: string;        // links to the parent activity
  documentId: string;
  documentType: string;
  uploadedBySource: 'whatsapp' | 'email' | 'in_person' | 'mobile_app' | 'courier' | 'other';
  sizeBytes: number;
  mimeType: string;
}

// APPLICATION_REASSIGNED
interface ApplicationReassignedPayload {
  applicationId: string;
  activityId: string;
  fromAgentId: string | null;
  toAgentId: string | null;
  reassignReason: string;
}

// MANAGER_ATTENTION_REQUESTED
interface ManagerAttentionRequestedPayload {
  applicationId: string;
  activityId: string;        // the STALE_LEAD_FLAGGED activity
  reason: 'no_activity_48h';
  hoursSinceLastActivity: number;
  assignedAgentStaffId: string | null;
}

// APPLICATION_LEAD_STATUS_CHANGED
interface ApplicationLeadStatusChangedPayload {
  applicationId: string;
  activityId: string;        // the activity that drove the transition
  fromLeadStatus: LeadStatus | null;
  toLeadStatus: LeadStatus;
}
```

Note bodies, document filenames, applicant PII MUST NOT appear in any audit payload (Principle VI). `AuditEventWriter.redact()` enforces this on top of the payload schemas being categorical-only by design.

---

## Cross-Entity Invariants

1. **Append-only invariant**: any `UPDATE` or `DELETE` against `activity` raises a Postgres exception (R-001). SC-009 verified at the DB level + repository level.
2. **Activity referential integrity**: `activity.attachedDocumentIds` strings MUST reference existing `Document` rows for the same `applicationId`. Enforced application-side (no DB-level FK array constraint; Prisma doesn't support FK arrays).
3. **LeadStatus monotonicity**: legal transitions are forward-only along the chain `needs_first_contact → document_collection → ready_for_submission → submitted_to_bank → bank_decided`. Bypass transitions allowed (e.g., `needs_first_contact → ready_for_submission`) when activity dictates. Backward transitions blocked by the adapter function returning `null` for illegal moves.
4. **Assignment integrity**: `application.assignedAgentStaffId` MUST reference an active `StaffAccount` with role ∈ `{sales_agent, sales_manager, super_admin}` (NOT `analyst`). Enforced in the assignment handler.
5. **Customer timeline filter**: `MILESTONE_*` entries are derived from `APPLICATION_LEAD_STATUS_CHANGED` audit payloads (NOT raw activity rows). The customer-facing layer never reads `activity` directly.
6. **System actor immutability**: `staff_account WHERE email='system@masrafy.local'` is never returned by `findManyStaff` (filtered out at the repository) and never updatable via the admin API (controller-level guard).
7. **Document erasure**: `document.status='erased'` rows still exist in the DB for audit; the S3 object is deleted under the right-to-erasure flow (future feature). The activity that originally attached the document stays put (append-only).

---

## Migration Summary

Single migration `20260513XXXXXX_lead_management_activity`:

1. Create `LeadStatus` enum.
2. Add 5 new values to `AuditEventType`.
3. Create `activity` table + indexes.
4. Create `raise_append_only_activity()` function + `activity_append_only_guard` trigger.
5. Create `document` table + indexes.
6. Add columns `assignedAgentStaffId`, `assignedAt`, `leadStatus` to `application` + indexes.
7. Insert reserved system-actor row into `staff_account`.

Estimated migration runtime on a 10 000-application / 100 000-activity dataset: < 30 s. Dominant cost is the trigger creation (instant). New columns on `application` are NULL by default; backfill to `needs_first_contact` runs as part of the `ALTER` since the column has a default.

---

## Open Questions

None. All shapes derived from spec FR-001 through FR-040 and research R-001 through R-012.
