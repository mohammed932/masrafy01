# Phase 0 Research: Approval Probability Display Enhancement

**Feature**: 004-approval-probability-display
**Date**: 2026-05-13
**Spec**: [spec.md](./spec.md)
**Constitution**: [constitution.md](../../.specify/memory/constitution.md) v1.3.0

This document resolves every `NEEDS CLARIFICATION` from `/speckit.clarify` and records the technology / pattern choices the implementation plan depends on. Each entry uses **Decision / Rationale / Alternatives considered**.

---

## R-001 — Where the ScoringConfig is loaded relative to the engine

**Decision**: The matching orchestrator (`applications.service.ts`) loads the active `ScoringConfig` from the `scoring-versions` registry **before** invoking the pure engine. The config is passed as a value-object parameter to `EngineService.run({ profile, programs, scoringConfig, correlationId })`. Nothing inside `src/matching/` imports from `src/scoring-versions/` or from any Prisma / NestJS-runtime module.

**Rationale**:

- Preserves Principle V (engine purity). The existing ESLint boundary rule from feature 003 already forbids `@nestjs/*` and Prisma runtime imports inside `src/matching/`; this design keeps that rule green.
- `ScoringConfig` is a pure data type (`{ weights, thresholds, factorCatalog, version }`). Constructing it requires DB access; consuming it does not.
- A single read per apply request (`scoringVersionsRepo.findActive()`) is amortized across the entire engine run — typically < 1 ms — and the result is captured for the lifetime of the request so concurrent activations cannot rewrite an in-flight engine.

**Alternatives considered**:

- *Pass the registry into the engine and let the engine load*: rejected — couples the pure pipeline to infrastructure, breaks the existing boundary.
- *Hard-code the weights in the engine and ignore the registry at runtime*: rejected — defeats the entire point of versioning.
- *Cache the active config in a module-level singleton refreshed on activation*: deferred — premature optimization. A per-request lookup is < 1 ms; cache invalidation across replicas needs a Redis pub-sub or similar that we don't need yet.

---

## R-002 — Single-active-version enforcement

**Decision**: Three-layered enforcement of FR-009 (exactly one `scoring_engine_version` row has `deactivatedAt IS NULL`):

1. **DB layer**: Postgres partial unique index `CREATE UNIQUE INDEX scoring_engine_version_active_unique ON scoring_engine_version ((1)) WHERE "deactivatedAt" IS NULL`. The index makes a second active row physically impossible regardless of application logic.
2. **Transaction layer**: activation endpoint runs in a `SERIALIZABLE` transaction. The body does (a) deactivate current active (`UPDATE SET deactivatedAt = now() WHERE deactivatedAt IS NULL`), (b) activate target version (`UPDATE SET activatedAt = now(), deactivatedAt = null WHERE version = $1`), (c) emit audit event, (d) commit. Postgres serialization-failure errors (`40001`) bubble up as `SCORING_VERSION_CONCURRENT_PROMOTION` (FR-029).
3. **Boot layer**: backend startup hook reads `scoringVersionsRepo.findActive()`; if zero rows, throw `SCORING_VERSION_NO_ACTIVE` and refuse to serve `/apply`. The `0001_admin_auth_users_init`-style seed migration guarantees `1.1.0-init` exists at deploy time.

**Rationale**: defence-in-depth. Any single layer can be silently bypassed (a hand-run SQL on the DB, a developer running migrations without seeding, a future refactor that subtly downgrades isolation). All three must fail for the invariant to break.

**Alternatives considered**:

- *Singleton ApplicationConfig table*: rejected — same invariant, more boilerplate, no DB-level guarantee.
- *Application-level mutex (Redis lock)*: rejected — adds infra dependency on the apply hot path, doesn't survive replica failover.

---

## R-003 — Backfill strategy for historical `bank_offer` rows

**Decision**: Single Prisma migration with a CTE-style `UPDATE` derives the four new columns deterministically from the existing `approvalProbabilityPercent` Decimal and a server-side `CASE` expression mapping that score to the FR-006 threshold table. JSONB `approvalFactors` set to a constant tombstone `'{"positive": [], "negative": [], "legacy": true}'`. `engineVersion` set to literal `'1.0.0-legacy'`.

```sql
ALTER TABLE bank_offer
  ADD COLUMN "approvalScore" INTEGER,
  ADD COLUMN "approvalTier" "ApprovalTier",
  ADD COLUMN "approvalFactors" JSONB,
  ADD COLUMN "engineVersion" VARCHAR(32);

UPDATE bank_offer
SET
  "approvalScore"  = ROUND("approvalProbabilityPercent")::int,
  "approvalTier"   = CASE
                       WHEN "approvalProbabilityPercent" >= 80 THEN 'excellent'::"ApprovalTier"
                       WHEN "approvalProbabilityPercent" >= 60 THEN 'good'::"ApprovalTier"
                       WHEN "approvalProbabilityPercent" >= 40 THEN 'moderate'::"ApprovalTier"
                       WHEN "approvalProbabilityPercent" >= 20 THEN 'low'::"ApprovalTier"
                       ELSE 'very_low'::"ApprovalTier"
                     END,
  "approvalFactors" = '{"positive":[],"negative":[],"legacy":true}'::jsonb,
  "engineVersion"   = '1.0.0-legacy'
WHERE "engineVersion" IS NULL;

ALTER TABLE bank_offer
  ALTER COLUMN "approvalScore"  SET NOT NULL,
  ALTER COLUMN "approvalTier"   SET NOT NULL,
  ALTER COLUMN "approvalFactors" SET NOT NULL,
  ALTER COLUMN "engineVersion"   SET NOT NULL;

CREATE INDEX idx_bank_offer_approval_score ON bank_offer ("approvalScore");
CREATE INDEX idx_bank_offer_engine_version ON bank_offer ("engineVersion");
```

**Rationale**: pure SQL is the fastest path; SC-002 caps at 60 s for a 100 k-row table. Single bulk `UPDATE` plus immediate `SET NOT NULL` keeps the column tightly typed afterwards. The `legacy: true` flag in `approvalFactors` is what the detail panel keys off to render the "factors unavailable for offers pre-v1.1.0" notice (FR-021).

**Alternatives considered**:

- *Per-row backfill in a TypeScript script*: rejected — orders of magnitude slower; risks timeout on production-scale tables.
- *Default-value columns + lazy backfill on next read*: rejected — leaves the schema in two states forever, complicates analytics.
- *Skip backfill, treat NULL as legacy*: rejected — every read path forever carries `if (engineVersion === null)` branches; tightening the column up-front is cheaper.

---

## R-004 — `weightsConfig` JSONB shape

**Decision**: A self-contained snapshot per row carrying everything the engine + UI need to reproduce a score and localize a factor:

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
    "PREVIOUS_REJECTION":  { "labelAr": "رفض سابق مسجل", "labelEn": "Previous rejection on file" },
    "AGE_NEAR_MIN":        { "labelAr": "العمر قريب من الحد الأدنى", "labelEn": "Age near the minimum" },
    "HIGH_DBR":            { "labelAr": "نسبة دين مرتفعة", "labelEn": "High debt-burden ratio" },
    "INCOME_NEAR_MIN":     { "labelAr": "الدخل قريب من الحد الأدنى", "labelEn": "Income near the minimum" },
    "NOT_CAT_A":           { "labelAr": "ليس من فئة الشركات أ", "labelEn": "Employer not Cat-A" },
    "HAS_CD_AT_ABK":       { "labelAr": "لديك وديعة لدى البنك التجاري العربي", "labelEn": "You have a CD at ABK" },
    "LONG_TENURE":         { "labelAr": "خبرة طويلة في الوظيفة الحالية", "labelEn": "Long tenure at current job" },
    "PAYROLL_TRANSFER":    { "labelAr": "تحويل الراتب موثق", "labelEn": "Payroll transfer verified" },
    "BANKERS_PROGRAM":     { "labelAr": "برنامج خاص بالعاملين بالقطاع المصرفي", "labelEn": "Bankers program segment" },
    "PENSIONS_PROGRAM":    { "labelAr": "برنامج خاص بأصحاب المعاشات", "labelEn": "Pensions program segment" },
    "CLAMPED_TO_FLOOR":    { "labelAr": "تم رفع النتيجة للحد الأدنى", "labelEn": "Score lifted to floor" },
    "CLAMPED_TO_CEILING":  { "labelAr": "تم خفض النتيجة للحد الأقصى", "labelEn": "Score capped at ceiling" }
  },
  "legacy": false
}
```

**Rationale**:

- One row, one source of truth — replay a 6-month-old offer with a single registry read.
- AR + EN side-by-side keeps Constitution Principle III green: missing translations are visible during PR review (factor code present, label key missing → fails JSON-schema check in CI).
- `legacy: true` is the field the detail panel keys off (FR-021); set only on the `1.0.0-legacy` row, false on every other row.
- `CLAMPED_TO_FLOOR` / `CLAMPED_TO_CEILING` are part of the catalog so the detail page localizes them like any other factor.

**Alternatives considered**:

- *Three separate columns* (`weights`, `thresholds`, `factorCatalog`): rejected — JSONB blob keeps the row self-contained and survives schema evolution without migrations.
- *Factor labels in i18n XLF files only*: rejected — XLF labels can't reproduce historical offers if a code is removed in a future engine version. The catalog must travel with the row.

---

## R-005 — Tier classification boundary semantics

**Decision**: Inclusive on the upper-tier side. Implementation in the pipeline:

```ts
function classifyTier(score: number, thresholds: Thresholds): ApprovalTier {
  if (score >= thresholds.excellent) return 'excellent';
  if (score >= thresholds.good) return 'good';
  if (score >= thresholds.moderate) return 'moderate';
  if (score >= thresholds.low) return 'low';
  return 'very_low';
}
```

**Rationale**:

- Matches the clarified rule (Session 2026-05-13): `score === 80 → excellent`, `score === 60 → good`, etc.
- The four threshold numbers from the `weightsConfig.thresholds` block are the cut points; everything else falls through to `very_low`.
- A pure function, ≤ 6 lines, lives inside `src/matching/pipeline/approval-probability.ts`. Easy to verify against the offline `match.checks.ts` script from feature 003.

**Alternatives considered**:

- *Lookup table*: rejected for 5 buckets; the `if` chain is clearer.
- *Inclusive on the lower-tier side* (`score === 80 → good`): rejected — clashes with the clarified convention; would confuse operators reading "80% = excellent" pills against the spec table.

---

## R-006 — `ApprovalProbabilityResult` engine output shape

**Decision**: The pure pipeline emits a typed `ApprovalProbabilityResult` value:

```ts
export interface FactorImpact {
  code: string;       // e.g. 'PAYROLL_TRANSFER', 'PREVIOUS_REJECTION'
  impact: number;     // signed integer; positive in `.positive[]`, negative in `.negative[]`
}

export interface ApprovalProbabilityResult {
  score: number;                              // clamped 0..100
  tier: 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';
  factors: { positive: FactorImpact[]; negative: FactorImpact[] };
  // engineVersion is added by the orchestrator AFTER the pipeline returns
  // (the pure module knows nothing about the registry).
}
```

`tierLabelCode` is a derived projection of `tier` (`approval.tier.<tier>`); not stored on the entity, computed by the response mapper. Same for the `engineVersion` stamp — assigned by `applications.service.ts` from the `ScoringConfig.version` value object before persistence.

**Rationale**:

- The pure pipeline stays pure: no knowledge of i18n codes, no knowledge of registry versions.
- The orchestrator owns response mapping. Tests for the pipeline assert exact factor lists; tests for the orchestrator assert envelope shape.
- Sorting (FR-003: by `|impact|` desc) lives in the pipeline so any consumer of `ApprovalProbabilityResult` sees the same ordering.

**Alternatives considered**:

- *Include `tierLabelCode` + `engineVersion` in the pipeline output*: rejected — pollutes the pure layer with presentation concerns and registry knowledge.
- *Emit a flat `{ code, impact }[]` and let the orchestrator partition into positive/negative*: rejected — clients consume positive/negative separately and prefer ready-to-render arrays; the pipeline partitioning is essentially free.

---

## R-007 — Clamp marker insertion (FR-004)

**Decision**: When the raw computed score is clamped at floor or ceiling, the pipeline appends a synthetic factor to the appropriate array:

```ts
if (rawScore < weights.CLAMP_MIN) {
  factors.positive.push({ code: 'CLAMPED_TO_FLOOR', impact: weights.CLAMP_MIN - rawScore });
} else if (rawScore > weights.CLAMP_MAX) {
  factors.positive.push({ code: 'CLAMPED_TO_CEILING', impact: rawScore - weights.CLAMP_MAX });
  // semantics: the clamp REDUCED the apparent score; the marker's positive sign tracks that
  // the floor/ceiling rule itself improved (or capped) the displayed value
}
```

**Rationale**: keeps the structured response self-describing. Downstream consumers (admin detail panel, future Flutter app) can render a special tag for clamp markers — the catalog entries `CLAMPED_TO_FLOOR` + `CLAMPED_TO_CEILING` localize them. Detecting clamping no longer requires re-running the calculation.

**Alternatives considered**:

- *Carry a separate `clamped: 'floor' | 'ceiling' | null` field*: rejected — duplicates information; clients still need a way to surface it visually and would re-implement label lookup.
- *Quietly clamp without marker*: rejected — the operator loses the ability to explain "why is this offer's score exactly 95?" without DB forensics.

---

## R-008 — Admin list endpoint shape extension

**Decision**: `GET /api/admin/applications` extends each row's projection with a `bestOffer` summary block:

```jsonc
{
  "id": "cl...",
  "status": "matched",
  "requestedAmountEGP": "200000.00",
  ...,
  "bestOffer": {
    "score": 92,
    "tier": "excellent",
    "tierLabelCode": "approval.tier.excellent"
  }
}
```

When `status === 'no_match'` OR the application has zero bank offers, `bestOffer: null`. Computed at query time via a subquery / window function joining `application` → `bank_offer ORDER BY approvalScore DESC LIMIT 1`. Indexed on `bank_offer.approvalScore` so the per-row fetch is O(log n).

**Rationale**: avoids an N+1 by pulling the best-offer fields in the same response — the list page renders without a per-row offers fetch. Repository method `findManyAdminWithBestOffer` lives in `application.repository.ts`.

**Alternatives considered**:

- *Materialized view of (applicationId → bestOfferScore, bestOfferTier)*: rejected — adds refresh discipline; the subquery is already cheap because of the existing FK index plus the new `approvalScore` index.
- *Client fetches offers separately per row*: rejected — N+1 antipattern, fails SC-009-style performance budgets.

---

## R-009 — Tier-filter query plan

**Decision**: The three filter buckets translate to predicates on the `bestOffer` projection from R-008:

| Filter | SQL predicate |
|---|---|
| `tier=high` | `best_offer.approvalTier = 'excellent'` |
| `tier=medium` | `best_offer.approvalTier = 'good'` |
| `tier=needs_coaching` | `(best_offer.approvalTier IN ('moderate','low','very_low')) OR (application.status = 'no_match')` |

The predicate operates on the subquery result, so it's effectively a HAVING-style filter. Indexed on `(bank_offer.applicationId, approvalScore DESC)` to keep the best-offer lookup fast.

**Rationale**: deterministic, indexable, matches the URL-shareable `?tier=` query parameter (FR-018).

**Alternatives considered**:

- *Denormalize `bestOfferTier` onto the `application` row*: rejected for v1 — adds a write-time invariant (best offer may change if offers are added/edited later). Defer until performance shows the subquery hurts.

---

## R-010 — Activation endpoint contract + audit

**Decision**: `POST /api/admin/scoring-versions/:version/activate`

- Guards: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('super_admin')`.
- Body: empty (`{}`); the version identifier comes from the URL path.
- Throttler: existing admin throttler bucket (writes are rare; no new tier).
- Service flow (SERIALIZABLE transaction):
  1. `SELECT * FROM scoring_engine_version WHERE version = $1 FOR UPDATE` — if no row → `SCORING_VERSION_NOT_FOUND` (404).
  2. `UPDATE scoring_engine_version SET deactivatedAt = now() WHERE deactivatedAt IS NULL` — gets previous active row id for the audit payload.
  3. `UPDATE scoring_engine_version SET activatedAt = now(), deactivatedAt = null WHERE version = $1`.
  4. Compute weights-diff summary (top 5 weight changes by absolute delta) for the audit payload.
  5. `auditWriter.write({ eventType: 'SCORING_ENGINE_VERSION_PROMOTED', actorId, payload: { previousVersion, newVersion, weightsDiff } })` inside the same transaction.
  6. On Postgres `40001` (serialization failure) → `SCORING_VERSION_CONCURRENT_PROMOTION` (409).
- Response: `{ success: true, data: { previousVersion, newVersion, activatedAt } }`.

**Rationale**: matches the spec FR-011b/c + FR-028 + FR-029 contract exactly. Single endpoint, single transaction, single audit event. No background jobs.

**Alternatives considered**:

- *Optimistic concurrency via row version stamps*: rejected — SERIALIZABLE plus the partial unique index makes optimistic locking redundant.
- *Synchronous webhook to flush in-process config caches across replicas*: deferred — no cross-replica cache exists yet (per R-001 we read per-request).

---

## R-011 — Analytics query plan

**Decision**: Two aggregate queries served by `GET /api/admin/scoring-analytics?windowDays=N`:

1. **Distribution histogram** (10-point buckets `[0,9]`, `[10,19]`, ..., `[90,100]`):

   ```sql
   SELECT (approvalScore / 10) AS bucket, COUNT(*) AS count
     FROM bank_offer
     WHERE createdAt >= now() - $1::interval
       AND erasedAt IS NULL
     GROUP BY 1 ORDER BY 1;
   ```

2. **Per-tier accuracy** (left-joins the `bank_offer_decision` placeholder):

   ```sql
   SELECT bo.approvalTier AS tier,
          COUNT(*) AS offer_count,
          COUNT(bod.id) AS decision_count,
          AVG(CASE WHEN bod.outcome = 'approved' THEN 1.0 ELSE 0.0 END) AS approval_rate
     FROM bank_offer bo
     LEFT JOIN bank_offer_decision bod ON bod.bankOfferId = bo.id
     WHERE bo.createdAt >= now() - $1::interval
       AND bo.erasedAt IS NULL
     GROUP BY bo.approvalTier;
   ```

3. Window cap: if `windowDays > 180` → `ANALYTICS_WINDOW_TOO_LARGE` (FR-023a / FR-031a). Default 30 days.

**Rationale**:

- Both queries hit the new `approvalScore` index + the existing `bank_offer.createdAt` index.
- `bank_offer_decision` is empty at launch; the LEFT JOIN returns zero `decision_count` → `approval_rate` renders as `—` per FR-024.
- 180-day window keeps the aggregate scan bounded.

**Alternatives considered**:

- *Pre-aggregated materialized view refreshed nightly*: rejected — over-engineering for the projected scale; ship the live aggregate and revisit if it ever exceeds 2 s p95.
- *Use Postgres' `width_bucket`*: equivalent SQL, slightly less readable; chose explicit integer division for clarity.

---

## R-012 — Same-PR i18n parity (Principle III)

**Decision**: PR checklist requires every new code added to `backend/src/common/errors/error-codes.ts` to have a corresponding key in BOTH `admin/src/i18n/error-codes.ar-EG.json` and `admin/src/i18n/error-codes.en-US.json`, AND every new `@@role.X` / `@@approval.tier.X` / `@@analytics.X` i18n id to have an `<trans-unit>` in `messages.ar-EG.xlf`. The 4 new error codes plus the 4 tier labels plus the 12-entry baseline factor catalog (per R-004) plus the analytics-page strings ship in a single i18n PR-section.

**Rationale**: same-PR rule is constitutional. A future linter check (out of scope for this feature) can grep the codes file against the JSONs to enforce parity automatically.

**Alternatives considered**:

- *Separate i18n PR after backend ships*: rejected — violates Principle III; clients receive untranslated codes during the window.

---

## R-013 — ESLint engine-boundary rule (preserve from feature 003)

**Decision**: No change. The existing `no-restricted-imports` block in `backend/.eslintrc.cjs` (added in feature 003) already blocks `@nestjs/*`, Prisma runtime, and infra modules inside `src/matching/`. Add `src/scoring-versions/*` and `src/scoring-analytics/*` to the blocked-patterns list so the engine cannot reach into either new module.

**Rationale**: cheaper to extend the existing rule than create a new boundary. Keeps Principle V enforcement uniform.

**Alternatives considered**: none.

---

## R-014 — `BankOfferDecision` placeholder

**Decision**: Ship the table empty with:

```prisma
model BankOfferDecision {
  id                  String       @id @default(cuid()) @db.VarChar(30)
  bankOfferId         String       @unique @db.VarChar(30)
  outcome             DecisionOutcome
  recordedAt          DateTime     @default(now()) @db.Timestamptz(6)
  decisionLatencyMs   Int?

  bankOffer           BankOffer    @relation(fields: [bankOfferId], references: [id], onDelete: Cascade)

  @@index([recordedAt], name: "idx_bank_offer_decision_recorded")
  @@index([outcome], name: "idx_bank_offer_decision_outcome")
  @@map("bank_offer_decision")
}

enum DecisionOutcome {
  approved
  rejected
  withdrawn
}
```

No write path in this feature. The analyst-page query LEFT JOINs against it; an empty table just produces zero `decision_count` per tier and the UI renders `—`.

**Rationale**: pre-wiring the table now means the future bank-decision-feed feature is a single inserter with no schema work. Indexes are ready for the analytics aggregate.

**Alternatives considered**:

- *Skip the table entirely; ship the analyst view as "Distribution only"*: rejected — leaves a hole the analyst-page UI has to grow around when the feed arrives.

---

## R-015 — Versioned-config caching (deferred)

**Decision**: NO in-process cache for the active scoring config. Each apply request reads the active version fresh from `scoring_engine_version` (1 row, indexed). Activation costs ~ms; the per-request lookup is negligible against the engine's overall budget (≤ 500 ms p95).

**Rationale**: KISS. A cache would require invalidation across replicas (Redis pub-sub or DB LISTEN/NOTIFY), neither of which we need yet. Performance metrics from production will tell us if this ever becomes a hot spot — and when they do, the Redis pub-sub channel exists for free (we already use ioredis).

**Alternatives considered**:

- *In-process LRU with 5-minute TTL*: defers cache invalidation problem. Rejected for v1 because the freshness vs. consistency tradeoff isn't worth the complexity at current scale.
- *Pin the active config at boot, hot-swap via SIGHUP*: rejected — adds operational surface area; activation endpoint becomes a two-phase commit. Premature.

---

## Cross-Cutting Constraints Honoured

- **Principle III** — every new error code maps to a constant in `backend/src/common/errors/error-codes.ts` and a key in `admin/src/i18n/error-codes.{ar-EG,en-US}.json`. Same-PR rule per R-012.
- **Principle V** — engine pipeline imports `ScoringConfig` *type only*; the adapter that bridges to `scoring-versions` lives outside `src/matching/` (per R-001). ESLint boundary updated per R-013.
- **Principle VI** — `approvalFactors` carries categorical codes only; no PII. Analytics page emits aggregates.
- **Principle VII** — `MATCHING_ENGINE_RUN` payload extended with `engineVersion`; new `SCORING_ENGINE_VERSION_PROMOTED` event from R-010.
- **Principle XIII** — `/api/v1/apply` continues to require HMAC; admin endpoints continue to require JWT + role guard.
- **Principle XIV** — envelope unchanged; new endpoints follow `{ success, data }` shape.
- **Principle XXIII** — every new admin screen invokes `promax` pre-design + `impec` post-implementation; 3 pre-design + 3 post-implementation tasks land in tasks.md.

---

## Open Questions (none blocking)

None. All `NEEDS CLARIFICATION` markers from `/speckit.clarify` are resolved. Plan may proceed to Phase 1.
