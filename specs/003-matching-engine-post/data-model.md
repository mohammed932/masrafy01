# Phase 1 Data Model: Matching Engine

**Feature**: 003-matching-engine-post
**Date**: 2026-05-12
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

Entity shapes, indexes, audit-payload schemas, and Prisma schema sketch.

---

## Entity inventory

| Entity | Purpose | Storage |
|---|---|---|
| `Application` | Top-level submission record (Postgres row + JSONB profile/summary) | `application` table |
| `BankOffer` | Immutable snapshot of a matched program's offer | `bank_offer` table |
| `IdempotencyRecord` | 1 h cache record keyed by client + key | Redis (JSON string) |
| `ApplicationAuditEvent` | Six new event-type values extending feature 001's `audit_event` | existing `audit_event` table |
| `ApplicationArchive` | Cold-tier JSONL.gz in S3 | object storage |
| `ScoringWeights` | Named constants for approval probability (FR-034) | code config, not DB |

---

## `Application` — top-level entity

### Fields

| Field | Type | Constraints | Source |
|---|---|---|---|
| `id` | `uuid` | PK | server-generated |
| `applicantUserId` | `uuid?` | nullable for guest submissions | FR-042 (`isGuest`) |
| `mobileClientId` | `varchar(64)` | NOT NULL | from HMAC header `X-Client-Id` |
| `submissionCorrelationId` | `varchar(36)` | NOT NULL | feature 001 interceptor |
| `idempotencyKey` | `varchar(128)?` | nullable | FR-044 |
| `payloadHash` | `char(64)?` | nullable; sha256-hex | FR-044 |
| `status` | `enum ApplicationStatus` | NOT NULL, default `draft` (transient) | FR-041, clarification 4 |
| `priority` | `enum ApplicationPriority` | NOT NULL | FR-042 |
| `requestedAmountEGP` | `Decimal(13, 2)` | NOT NULL, ≥ 5,000 | FR-042 |
| `requestedCurrency` | `varchar(3)` | NOT NULL, default `EGP` | FR-042, FR-009 |
| `preferredTenorMonths` | `int` | NOT NULL, 6–360 | FR-042 |
| `loanPurpose` | `varchar(64)` | NOT NULL | FR-042 |
| `age` | `int` | NOT NULL, 18–75 | FR-042 |
| `isGuest` | `boolean` | NOT NULL, default `true` | FR-042 |
| `applicantProfile` | `jsonb` | NOT NULL, full DTO snapshot | FR-041 |
| `summary` | `jsonb` | NOT NULL on `matched`/`no_match` | FR-041 |
| `noMatchSummary` | `jsonb?` | nullable; populated only on `no_match` | FR-047 |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | audit |
| `archivedAt` | `timestamptz?` | nullable | FR-063 |
| `erasedAt` | `timestamptz?` | nullable | FR-064 |
| `coldTierKey` | `varchar(256)?` | nullable; S3 object key when archived | FR-063 |
| `engineDurationMs` | `int?` | nullable | FR-057 |
| `programsCheckedCount` | `int` | NOT NULL, default 0 | FR-045 |
| `eligibleProgramsCount` | `int` | NOT NULL, default 0 | FR-045 |

### Status enum

```text
draft       // transient — never visible to operator queries (FR-041, clarification 4)
matched     // engine produced 1+ eligible offers
no_match    // engine produced 0 eligible offers
archived    // moved to cold tier (FR-063); rows still present + queryable but list excludes
erased      // PII zeroed (FR-064); tombstone fields preserved
```

### Priority enum

```text
lowest_installment | lowest_interest | fastest_approval | least_paperwork
```

### Indexes

| Index | Columns | Purpose |
|---|---|---|
| `application_pkey` | `id` | PK |
| `application_status_created_at_idx` | `(status, createdAt DESC)` partial WHERE `status IN ('matched', 'no_match')` | list filter; excludes `draft`/`archived`/`erased` (FR-050) |
| `application_user_idx` | `(applicantUserId, createdAt DESC)` partial WHERE `applicantUserId IS NOT NULL` | "my applications" future |
| `application_correlation_idx` | `submissionCorrelationId` | trace lookup |
| `application_idempotency_idx` | `(mobileClientId, idempotencyKey)` partial UNIQUE WHERE `idempotencyKey IS NOT NULL` | dedupe within window |
| `application_purpose_idx` | `loanPurpose` | list filter |

### Lifecycle

```text
[ created ] → status = draft (transient inside transaction)
            → engine runs → status = matched | no_match (single transaction commit)

[ matched/no_match ] → 24-month archival → status = archived (live DB row deleted, cold-tier row exists)

[ matched/no_match/archived ] → erasure request → status = erased
                                                  (PII zeroed; tombstone fields preserved)
```

---

## `BankOffer` — immutable snapshot

### Fields

| Field | Type | Constraints | Source |
|---|---|---|---|
| `id` | `uuid` | PK | server-generated |
| `applicationId` | `uuid` | FK → application.id, NOT NULL, cascade-on-archive | FR-041 |
| `programCode` | `varchar(32)` | NOT NULL | feature 002 |
| `programVersion` | `int` | NOT NULL, version of source program at match time | FR-046 |
| `bankName` | `varchar(80)` | NOT NULL | snapshotted |
| `programFriendlyName` | `varchar(120)` | NOT NULL | snapshotted |
| `currency` | `varchar(3)` | NOT NULL | FR-009 |
| `effectiveRatePercent` | `Decimal(7, 4)` | NOT NULL | FR-019 |
| `monthlyInstallmentEGP` | `Decimal(13, 2)` | NOT NULL | FR-026 |
| `requestedLoanAmountEGP` | `Decimal(13, 2)` | NOT NULL | FR-042 |
| `effectiveLoanAmountEGP` | `Decimal(13, 2)` | NOT NULL | FR-021 |
| `requestedTenorMonths` | `int` | NOT NULL | FR-042 |
| `effectiveTenorMonths` | `int` | NOT NULL | FR-022 |
| `feesBreakdown` | `jsonb` | NOT NULL | FR-027 |
| `approvalProbabilityPercent` | `Decimal(5, 2)` | NOT NULL, 10–95 | FR-033 |
| `requiredDocuments` | `text[]` | NOT NULL | feature 002 |
| `matchReasons` | `text[]` | NOT NULL | FR-037 |
| `cascadeTrace` | `jsonb` | NOT NULL | FR-025 |
| `qualitativeReviewBadge` | `boolean` | NOT NULL, default `false` | FR-007 |
| `selfDeclared` | `boolean` | NOT NULL, default `false` | FR-006 / FR-024 |
| `maxLoanAvailableEGP` | `Decimal(13, 2)?` | nullable; populated when DBR-bound | FR-032 |
| `createdAt` | `timestamptz` | NOT NULL, default `now()` | audit |

### Indexes

| Index | Columns | Purpose |
|---|---|---|
| `bank_offer_pkey` | `id` | PK |
| `bank_offer_application_idx` | `(applicationId)` | detail page join |
| `bank_offer_program_created_idx` | `(programCode, createdAt DESC)` | analytics future |
| `bank_offer_currency_idx` | `(currency)` | multi-currency reports |

### Immutability

- Repository exposes only `create()` + `findByApplicationId()` — no `update()` / `delete()` methods (FR-046).
- Per Constitution Principle I (Anti-pattern A6): edits to source `BankProgram` NEVER mutate `BankOffer`. SC-005 binds.
- Erasure (FR-064) is the ONLY post-creation mutation; performed via raw SQL UPDATE within the erasure service that zeroes scalar fields + replaces JSONB blobs with tombstone shapes. Audit-event row `data.erasure.completed` accompanies.

### Tombstone shape (post-erasure)

After erasure, a `BankOffer` row retains only:
- `id`, `applicationId`, `programCode`, `effectiveRatePercent`, `createdAt`, `bankName`, `programFriendlyName`
- Everything else is set to `'ERASED'` / `0.00` / `[]` / `{}` / `null` as appropriate.

A new `erasedAt` column is added to enable filtering tombstones from live queries.

---

## `IdempotencyRecord` — Redis cache

### Shape

```text
Key: mobile:idempotency:{mobileClientId}:{idempotencyKey}
Value: {
  payloadHash: sha256-hex,
  applicationId: uuid,
  createdAt: ISO-8601
}
TTL: 3600 seconds (1 hour)
```

Stored as a JSON string (`SETEX`). On lookup, the cache controller:
- Compares the request's `payloadHash` to the cached one.
- If equal → fetches the cached `applicationId` from Postgres + returns its offers.
- If unequal → returns 409 `IDEMPOTENCY_KEY_MISMATCH` (FR-044).

Cache miss → engine runs normally → on success, `SETEX` is issued.

---

## `ApplicationAuditEvent` — six new event types

Extends feature 001's `AuditEventType` enum:

```prisma
enum AuditEventType {
  // ... feature 001 + 002 values ...
  APPLICATION_CREATED
  APPLICATION_MATCHED
  APPLICATION_NO_MATCH
  APPLICATION_RATE_LIMITED
  MATCHING_ENGINE_RUN
  DATA_ERASURE_COMPLETED
}
```

### Payload schemas

```ts
// APPLICATION_CREATED
interface ApplicationCreatedPayload {
  applicationId: string;
  loanPurpose: string;
  requestedAmountEGP: string;  // decimal as string
  requestedCurrency: string;
  preferredTenorMonths: number;
  priority: string;
  mobileClientId: string;
}

// APPLICATION_MATCHED
interface ApplicationMatchedPayload {
  applicationId: string;
  programsChecked: number;
  eligibleCount: number;
  bestRatePercent: string;
  bestInstallmentEGP: string;
  durationMs: number;
}

// APPLICATION_NO_MATCH
interface ApplicationNoMatchPayload {
  applicationId: string;
  programsChecked: number;
  primaryReason: string;
  suggestionCount: number;
}

// APPLICATION_RATE_LIMITED
interface ApplicationRateLimitedPayload {
  bucket: 'hmac_client' | 'applicant_fingerprint';
  fingerprintHash: string;  // sha256 hex, never raw id
  mobileClientId: string;
}

// MATCHING_ENGINE_RUN
interface MatchingEngineRunPayload {
  applicationId: string;
  programsChecked: number;
  eligibleCount: number;
  durationMs: number;
  primaryFailureReason?: string;
}

// DATA_ERASURE_COMPLETED
interface DataErasureCompletedPayload {
  applicationId: string;
  erasedAt: string;
  retentionTier: 'live' | 'cold' | 'both';
}
```

**No PII** in any payload (Principle VI, FR-045, FR-068).

---

## `ApplicationArchive` — cold-tier object

### Storage layout

```text
S3 bucket: masrafy-archive
  applications/
    2026/
      05/
        manifest.jsonl                  (one line per archived application)
        {applicationId-1}.jsonl.gz
        {applicationId-2}.jsonl.gz
        ...
```

### JSONL.gz content (per file)

Line 1: serialized `Application` row (JSON).
Lines 2..N: one serialized `BankOffer` row per offer.

### Manifest line shape

```ts
interface ArchiveManifestEntry {
  applicationId: string;
  archivedAt: string;
  offerCount: number;
  erased: boolean;
}
```

When erasure occurs after archival, the object is replaced with `.erased.jsonl.gz` containing only tombstone fields; manifest entry's `erased` flag flips to `true`.

---

## `ScoringWeights` — code configuration

Lives at `backend/src/matching/scoring-weights.ts`. NOT a database entity. Single source of truth:

```ts
export const SCORING_WEIGHTS = {
  BASE: 70,
  PREVIOUS_REJECTION: -30,           // Egyptian I-Score history rejection is a strong negative
  AGE_NEAR_MIN: -10,                 // applicants near the program's age floor often fail underwriting
  HIGH_DBR: -20,                     // DBR > 40% historically correlates with default
  INCOME_NEAR_MIN: -10,              // income < 1.2x minimum is brittle to expense shocks
  NOT_CAT_A: -15,                    // Cat-A programs underwrite to that company-tier specifically
  HAS_CD_AT_ABK: 15,                 // collateral signal — CD holder reads as "stable depositor"
  LONG_TENURE: 10,                   // > 36 months in job correlates with stability
  PAYROLL_TRANSFER: 10,              // payroll-transfer programs verify income directly
  BANKERS_PROGRAM: 20,               // Bankers segment historically low default
  PENSIONS_PROGRAM: 15,              // pension income is regulator-backed; very low default
  CLAMP_MIN: 10,                     // never report 0% — always some chance
  CLAMP_MAX: 95,                     // never report 100% — never promise certainty
} as const;
```

Mirror in `contracts/scoring-weights.md` for stakeholder review (FR-034).

---

## Prisma schema sketch

```prisma
enum ApplicationStatus {
  draft
  matched
  no_match
  archived
  erased
}

enum ApplicationPriority {
  lowest_installment
  lowest_interest
  fastest_approval
  least_paperwork
}

model Application {
  id                        String              @id @default(cuid()) @db.VarChar(30)
  applicantUserId           String?             @db.VarChar(30)
  mobileClientId            String              @db.VarChar(64)
  submissionCorrelationId   String              @db.VarChar(36)
  idempotencyKey            String?             @db.VarChar(128)
  payloadHash               String?             @db.Char(64)
  status                    ApplicationStatus   @default(draft)
  priority                  ApplicationPriority
  requestedAmountEGP        Decimal             @db.Decimal(13, 2)
  requestedCurrency         String              @default("EGP") @db.VarChar(3)
  preferredTenorMonths      Int
  loanPurpose               String              @db.VarChar(64)
  age                       Int
  isGuest                   Boolean             @default(true)
  applicantProfile          Json
  summary                   Json
  noMatchSummary            Json?
  createdAt                 DateTime            @default(now()) @db.Timestamptz(6)
  archivedAt                DateTime?           @db.Timestamptz(6)
  erasedAt                  DateTime?           @db.Timestamptz(6)
  coldTierKey               String?             @db.VarChar(256)
  engineDurationMs          Int?
  programsCheckedCount      Int                 @default(0)
  eligibleProgramsCount     Int                 @default(0)

  bankOffers                BankOffer[]         @relation("ApplicationBankOffers")

  @@index([status, createdAt(sort: Desc)], name: "idx_application_status_created", where: { status: { in: ["matched", "no_match"] } })
  @@index([applicantUserId, createdAt(sort: Desc)], name: "idx_application_user")
  @@index([submissionCorrelationId], name: "idx_application_correlation")
  @@index([loanPurpose], name: "idx_application_purpose")
  @@unique([mobileClientId, idempotencyKey], name: "idx_application_idempotency")
  @@map("application")
}

model BankOffer {
  id                          String      @id @default(cuid()) @db.VarChar(30)
  applicationId               String      @db.VarChar(30)
  programCode                 String      @db.VarChar(32)
  programVersion              Int
  bankName                    String      @db.VarChar(80)
  programFriendlyName         String      @db.VarChar(120)
  currency                    String      @db.VarChar(3)
  effectiveRatePercent        Decimal     @db.Decimal(7, 4)
  monthlyInstallmentEGP       Decimal     @db.Decimal(13, 2)
  requestedLoanAmountEGP      Decimal     @db.Decimal(13, 2)
  effectiveLoanAmountEGP      Decimal     @db.Decimal(13, 2)
  requestedTenorMonths        Int
  effectiveTenorMonths        Int
  feesBreakdown               Json
  approvalProbabilityPercent  Decimal     @db.Decimal(5, 2)
  requiredDocuments           String[]    @db.VarChar(80)
  matchReasons                String[]    @db.VarChar(80)
  cascadeTrace                Json
  qualitativeReviewBadge      Boolean     @default(false)
  selfDeclared                Boolean     @default(false)
  maxLoanAvailableEGP         Decimal?    @db.Decimal(13, 2)
  createdAt                   DateTime    @default(now()) @db.Timestamptz(6)
  erasedAt                    DateTime?   @db.Timestamptz(6)

  application                 Application @relation("ApplicationBankOffers", fields: [applicationId], references: [id], onDelete: Cascade)

  @@index([applicationId], name: "idx_bank_offer_application")
  @@index([programCode, createdAt(sort: Desc)], name: "idx_bank_offer_program_created")
  @@index([currency], name: "idx_bank_offer_currency")
  @@map("bank_offer")
}
```

---

## Open data-model TODOs

- `ApplicationArchive` writer + manifest schema → finalized at retention-scheduler implementation time.
- Tombstone migration helper — a one-shot Prisma script that takes an applicationId + erases scalar/JSONB fields atomically. Lives in `applications/retention/erasure.service.ts`.
