# Phase 1 Data Model: Approval Probability Display Enhancement

**Feature**: 004-approval-probability-display
**Date**: 2026-05-13
**Spec**: [spec.md](./spec.md)
**Research**: [research.md](./research.md)

Persistent-data shapes for the four-column extension to `bank_offer`, the new `scoring_engine_version` registry, and the empty-but-pre-wired `bank_offer_decision` placeholder.

All timestamps are `TIMESTAMPTZ`. All primary keys are `cuid()` `VARCHAR(30)` consistent with feature 001 / 002 / 003. JSONB blobs are validated at the application layer (DTO + Zod schemas); the DB only enforces JSON shape, not the inner contract.

---

## Entity Diff Overview

| Entity | Status | Notes |
|---|---|---|
| `bank_offer` | **EXTENDED** | +4 columns: `approvalScore`, `approvalTier`, `approvalFactors`, `engineVersion` |
| `ScoringEngineVersion` | **NEW** | Registry of past + active engine versions with full weight snapshot |
| `BankOfferDecision` | **NEW (empty placeholder)** | Pre-wired for the future bank-decision feed |
| `AuditEvent` | **EXTENDED (existing enum + payload only)** | One new value in `AuditEventType`; new payload schema documented below |

No changes to: `Application`, `BankProgram`, `StaffAccount`, `RefreshToken`, `SignInAttempt`, `PlatformEnumeration`.

---

## 1. `bank_offer` — Column Additions

Existing columns are not modified. Four new columns added below the existing block:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `approvalScore` | `INTEGER` | NOT NULL, range [0, 100] (app-validated; no DB CHECK) | Indexed for list-sort and tier-filter |
| `approvalTier` | `"ApprovalTier"` enum | NOT NULL | New enum (see below) |
| `approvalFactors` | `JSONB` | NOT NULL | Shape `{ positive: Factor[], negative: Factor[], legacy?: boolean }` where `Factor = { code: string; impact: number }` |
| `engineVersion` | `VARCHAR(32)` | NOT NULL | Indexed; references `scoring_engine_version.version` (logical FK, not enforced at DB level) |

### New enum `ApprovalTier`

```prisma
enum ApprovalTier {
  excellent
  good
  moderate
  low
  very_low
}
```

### New indexes on `bank_offer`

```sql
CREATE INDEX idx_bank_offer_approval_score ON bank_offer ("approvalScore");
CREATE INDEX idx_bank_offer_engine_version ON bank_offer ("engineVersion");
```

`approvalScore` index drives:
- The admin list filter (`tier=high|medium|needs_coaching` predicates evaluated on the bestoffer subquery, R-009).
- The analytics distribution histogram (`GROUP BY approvalScore / 10`, R-011).
- Per-program score retrievals for the cascade-trace inspector (future use).

`engineVersion` index drives the offline replay tool: `SELECT * FROM bank_offer WHERE engineVersion = '1.1.0'`.

### `approvalFactors` JSONB shape (Zod-validated at write time)

```typescript
interface ApprovalFactorsJson {
  positive: Array<{ code: string; impact: number }>;  // each impact > 0
  negative: Array<{ code: string; impact: number }>;  // each impact < 0
  legacy?: true;                                       // only set on backfilled rows
}
```

Within each array entries are sorted by `Math.abs(impact)` desc (FR-003). Clamp markers (`CLAMPED_TO_FLOOR`, `CLAMPED_TO_CEILING`) ride in the `positive` array with their derivation impact (R-007).

### Backfill rule (FR-013, R-003)

Single migration UPDATE statement maps every existing row deterministically:

| Source | Target |
|---|---|
| `approvalProbabilityPercent` (Decimal) | `approvalScore` (rounded to nearest int) |
| `approvalProbabilityPercent` clipped to threshold table | `approvalTier` (CASE expression) |
| (no source) | `approvalFactors = '{"positive":[],"negative":[],"legacy":true}'` |
| (no source) | `engineVersion = '1.0.0-legacy'` |

The migration sets the columns to NOT NULL *after* the UPDATE completes.

---

## 2. `ScoringEngineVersion` — New Table

Registry of every engine ever activated. One row per version. Exactly one row has `deactivatedAt IS NULL` at any time (FR-009, R-002).

```prisma
model ScoringEngineVersion {
  id                   String        @id @default(cuid()) @db.VarChar(30)
  version              String        @unique @db.VarChar(32)            // semver, e.g. "1.1.0", "2.0.0"
  description          String?       @db.VarChar(1000)
  weightsConfig        Json                                              // see R-004 for shape
  activatedAt          DateTime      @default(now()) @db.Timestamptz(6)
  deactivatedAt        DateTime?     @db.Timestamptz(6)                  // null → active
  activatedByStaffId   String?       @db.VarChar(30)                     // null for seed-inserted rows
  createdAt            DateTime      @default(now()) @db.Timestamptz(6)

  activatedByStaff     StaffAccount? @relation("ScoringVersionActivator", fields: [activatedByStaffId], references: [id], onDelete: SetNull)

  @@map("scoring_engine_version")
}
```

### Indexes on `scoring_engine_version`

```sql
-- Single-active-version invariant — enforced at DB level (R-002 layer 1)
CREATE UNIQUE INDEX scoring_engine_version_active_unique
  ON scoring_engine_version ((1))
  WHERE "deactivatedAt" IS NULL;

-- Lookup by version (already covered by @unique on `version`, but explicit for review)
-- @unique on `version` produces the index automatically.

-- Most-recent activation lookup
CREATE INDEX idx_scoring_engine_version_activated
  ON scoring_engine_version ("activatedAt" DESC);
```

### `weightsConfig` shape (R-004)

```jsonc
{
  "weights": {
    "BASE": 70,
    "PREVIOUS_REJECTION": -30,
    "AGE_NEAR_MIN": -10,
    "HIGH_DBR": -20,
    "INCOME_NEAR_MIN": -10,
    "NOT_CAT_A": -15,
    "HAS_CD_AT_ABK": 15,
    "LONG_TENURE": 10,
    "PAYROLL_TRANSFER": 10,
    "BANKERS_PROGRAM": 20,
    "PENSIONS_PROGRAM": 15,
    "CLAMP_MIN": 10,
    "CLAMP_MAX": 95
  },
  "thresholds": {
    "excellent": 80,
    "good": 60,
    "moderate": 40,
    "low": 20
  },
  "factorCatalog": {
    "PAYROLL_TRANSFER": { "labelAr": "تحويل الراتب موثق", "labelEn": "Payroll transfer verified" },
    "HAS_CD_AT_ABK":    { "labelAr": "لديك وديعة لدى البنك التجاري العربي", "labelEn": "You have a CD at ABK" }
    // ... 10 more (see R-004 for full list)
  },
  "legacy": false
}
```

### Validation rules

- `version` must match semver pattern `\d+\.\d+\.\d+(-[a-z0-9\-]+)?` (enforced by the activation endpoint, NOT the DB).
- `weightsConfig` must validate against the Zod schema `ScoringWeightsConfigSchema` at write time.
- Every key in `weightsConfig.weights` (except `BASE`, `CLAMP_MIN`, `CLAMP_MAX`) must also appear in `weightsConfig.factorCatalog` (paired entries enforce localization completeness).
- `activatedAt <= now()` and (`deactivatedAt IS NULL` OR `deactivatedAt >= activatedAt`).
- The string `"1.0.0-legacy"` is RESERVED — never inserted into the registry. It exists only as a `bank_offer.engineVersion` value for backfilled rows.

### State diagram

```
[draft (never inserted)]
        |  (Prisma migration / future-feature INSERT)
        v
[inactive (deactivatedAt = activatedAt)] <----+
        |                                     |
        |  activation endpoint                |  next activation
        v                                     |
[active (deactivatedAt = NULL)] -------(deactivate previous + activate this)
                                              ^
                                              |
                                              +---- the partial unique index
                                                    forbids two simultaneously active
```

### Invariants

1. Exactly one `(deactivatedAt IS NULL)` row at any time — enforced via partial unique index + SERIALIZABLE transaction (R-002).
2. A version stamped on a `bank_offer` row MUST exist in the registry (logical FK only — no DB-level FK because the registry row may pre-date the FK relation by hours during migration). The integrity check lives in `application.repository.ts` boot validation.
3. Every weight key referenced in any historical `bank_offer.approvalFactors` MUST be present in the matching version's `factorCatalog`. Validated by the same boot check.
4. Adding a new row to the registry does NOT promote it; insertion + activation are explicit separate steps.

---

## 3. `BankOfferDecision` — New (Empty) Table

Provisioned ahead of the future bank-decision-feed feature. Empty at launch. The analytics view LEFT JOINs against it.

```prisma
model BankOfferDecision {
  id                  String           @id @default(cuid()) @db.VarChar(30)
  bankOfferId         String           @unique @db.VarChar(30)
  outcome             DecisionOutcome
  recordedAt          DateTime         @default(now()) @db.Timestamptz(6)
  decisionLatencyMs   Int?

  bankOffer           BankOffer        @relation("BankOfferDecisionFor", fields: [bankOfferId], references: [id], onDelete: Cascade)

  @@index([recordedAt(sort: Desc)], name: "idx_bank_offer_decision_recorded")
  @@index([outcome], name: "idx_bank_offer_decision_outcome")
  @@map("bank_offer_decision")
}

enum DecisionOutcome {
  approved
  rejected
  withdrawn
}
```

### Invariants

- `bankOfferId` UNIQUE — one decision per offer; subsequent decisions overwrite (handled by future feature's `UPSERT`).
- `outcome` MUST be one of the enum values.
- `decisionLatencyMs` ≥ 0 (application-validated when the feed lands).

### Out of scope for this feature

- No INSERT / UPDATE / DELETE endpoints on this table.
- No service layer beyond a read-only `BankOfferDecisionRepository.aggregateByTier(windowDays)` consumed by `scoring-analytics/`.

---

## 4. `AuditEvent` — Enum + Payload Extension

### New `AuditEventType` value

```prisma
enum AuditEventType {
  // ... existing values ...
  SCORING_ENGINE_VERSION_PROMOTED
}
```

### Existing event extension: `MATCHING_ENGINE_RUN`

Payload schema is documented (not DB-enforced; JSONB blob). Adds three fields:

```typescript
interface MatchingEngineRunAuditPayload {
  applicationId: string;
  programsCheckedCount: number;
  eligibleProgramsCount: number;
  durationMs: number;
  // NEW in feature 004:
  engineVersion: string;       // e.g. "1.1.0"
  bestOfferScore: number | null;
  bestOfferTier: 'excellent' | 'good' | 'moderate' | 'low' | 'very_low' | null;
}
```

### New event: `SCORING_ENGINE_VERSION_PROMOTED`

```typescript
interface ScoringEngineVersionPromotedAuditPayload {
  previousVersion: string;     // version that was deactivated
  newVersion: string;          // version that was activated
  weightsDiff: Array<{         // top 5 by |delta|; sentinel "+ NEW" or "- REMOVED" for added/dropped factors
    code: string;
    previousValue: number | null;
    newValue: number | null;
    delta: number | 'added' | 'removed';
  }>;
  thresholdChange: boolean;    // true if any threshold value differs between versions
  bumpKind: 'major' | 'minor' | 'patch';  // derived from the semver delta
}
```

`AuditEventWriter.redact()` (existing) covers any future PII leak; factor codes + version strings are categorical so nothing needs redaction.

---

## Cross-Entity Invariants

1. **Active-version invariant**: `COUNT(*) FROM scoring_engine_version WHERE deactivatedAt IS NULL = 1` at all times after the initial `1.1.0-init` seed.
2. **Offer-version reference**: every `bank_offer.engineVersion` value must either equal `'1.0.0-legacy'` (backfilled rows) or exist as a `scoring_engine_version.version`.
3. **Factor-code completeness**: every distinct `code` appearing in `bank_offer.approvalFactors.positive` ∪ `negative` must appear in the matching `scoring_engine_version.weightsConfig.factorCatalog` so the admin detail page never renders an empty label.
4. **Tier-derivation determinism**: `approvalTier` is a pure function of `approvalScore` AND the offer's `engineVersion` (specifically `weightsConfig.thresholds`). Inserting a row with mismatched tier (e.g., score 92 + tier `good`) is forbidden at the application layer.
5. **Audit completeness**: every successful POST `/api/admin/scoring-versions/:version/activate` MUST emit one `SCORING_ENGINE_VERSION_PROMOTED` event in the same transaction. Every successful `POST /api/v1/apply` MUST emit one `MATCHING_ENGINE_RUN` event whose `engineVersion` equals the version captured on every persisted `bank_offer` row of the request.

---

## Migration Summary

Single migration named `20260513XXXXXX_approval_probability_display` does:

1. Create enum `ApprovalTier` (excellent | good | moderate | low | very_low).
2. Create enum `DecisionOutcome` (approved | rejected | withdrawn).
3. Add 4 nullable columns to `bank_offer`.
4. UPDATE all existing `bank_offer` rows with the backfill values per R-003.
5. ALTER the 4 columns to NOT NULL.
6. Create indexes `idx_bank_offer_approval_score`, `idx_bank_offer_engine_version`.
7. Create table `scoring_engine_version`.
8. Create the partial unique index `scoring_engine_version_active_unique`.
9. INSERT the initial registry row `version='1.1.0-init', weightsConfig=<snapshot of SCORING_WEIGHTS + thresholds + baseline factorCatalog>, activatedAt=now(), deactivatedAt=NULL`.
10. Create table `bank_offer_decision` (empty) + its indexes.
11. Add `SCORING_ENGINE_VERSION_PROMOTED` to `AuditEventType` enum.

Estimated migration runtime on a 100 k-row `bank_offer`: < 60 s (SC-002). The single UPDATE statement plus immediate `SET NOT NULL` is the dominant cost; the index creations are sub-second on this row count.

---

## Open Questions

None. All shapes derived from spec FR-001 through FR-031a and research R-001 through R-015.
