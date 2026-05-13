# Quickstart: Approval Probability Display (Feature 004)

**Audience**: Masrafy operators + developers verifying a fresh environment.
**Prerequisites**: Features 001 + 002 + 003 shipped; infra running per [feature 003 quickstart §1–§3](../003-matching-engine-post/quickstart.md).

End-to-end walkthrough from migration → signed apply → ranked offers with structured probability → admin list pill + tier filter → "Why this score?" detail panel → analyst view → engine-version promotion → backfill verification. Steps marked **dev** are infrastructure; **operator** are dashboard / API flows.

---

## §1 · Apply the feature-004 migration (dev)

```bash
cd backend
npx prisma migrate dev --name approval_probability_display
npx prisma generate
```

The migration:

- adds 4 columns to `bank_offer` and backfills historical rows to `engineVersion='1.0.0-legacy'` with empty factor lists,
- creates `scoring_engine_version` with the partial unique index `WHERE deactivatedAt IS NULL`,
- seeds the initial registry row `version='1.1.0-init'` from current `SCORING_WEIGHTS`,
- creates empty `bank_offer_decision` table for the future bank-decision feed,
- adds `SCORING_ENGINE_VERSION_PROMOTED` to `AuditEventType`.

Confirm the seed:

```sql
SELECT version, activatedAt, deactivatedAt
FROM scoring_engine_version
ORDER BY activatedAt DESC;
-- expect exactly one row: 1.1.0-init, activatedAt=now(), deactivatedAt=NULL
```

## §2 · Boot the backend (dev)

```bash
cd backend && npm run start:dev      # http://localhost:3000
cd admin   && npm start              # http://localhost:5173
```

If the registry has zero active rows (manual mishap), boot fails with `SCORING_VERSION_NO_ACTIVE`. The migration's seed row protects against this on first run.

## §3 · Submit Golden Scenario #1 with structured probability (Postman / curl)

Reuse the signed-request setup from [feature 003 quickstart §4–§6](../003-matching-engine-post/quickstart.md#4--configure-hmac-client-secret-dev). Submit the Cat-A government-payroll profile with `requestedAmountEGP: "200000.00"`.

Expected response — note the new `approvalProbability` object on every matched offer:

```json
{
  "success": true,
  "data": {
    "applicationId": "...",
    "correlationId": "...",
    "summary": { "totalProgramsChecked": 20, "eligiblePrograms": 3, ... },
    "matchedOffers": [
      {
        "programCode": "ABK-PAYROLL-CAT-A",
        "effectiveRatePercent": "22.5000",
        "monthlyInstallmentEGP": "...",
        "approvalProbability": {
          "score": 88,
          "tier": "excellent",
          "tierLabelCode": "approval.tier.excellent",
          "factors": {
            "positive": [
              { "code": "PAYROLL_TRANSFER", "impact": 10 },
              { "code": "LONG_TENURE", "impact": 10 }
            ],
            "negative": [
              { "code": "NOT_CAT_A", "impact": -15 }
            ]
          },
          "engineVersion": "1.1.0-init"
        },
        "requiredDocuments": ["..."],
        "...": "..."
      },
      "..."
    ]
  }
}
```

Verify on the DB that the new columns persisted:

```sql
SELECT programCode, approvalScore, approvalTier, approvalFactors->'positive', approvalFactors->'negative', engineVersion
FROM bank_offer
WHERE applicationId = '<applicationId>'
ORDER BY approvalScore DESC;
```

Every row carries `engineVersion='1.1.0-init'`; tier matches the threshold table (≥ 80 → `excellent`, etc.).

## §4 · Admin list — pill + tier filter (operator)

Sign in as `sales_manager`. Sidebar → **Applications**. Each row carries a colored pill showing the best-offer score and tier. Pill colors derive from token mapping:

| Tier | Pill background | Pill text |
|---|---|---|
| `excellent` | `--color-success` | white |
| `good` | `--color-success` (muted) | dark |
| `moderate` | `--color-warning` | dark |
| `low` | `--color-warning` (muted) | dark |
| `very_low` | `--color-error` | white |
| (no match) | `--color-surface-muted` | dimmed dash |

Click the filter chip **High probability leads** → only rows where best-offer tier = `excellent`. Switch to **Needs coaching** → rows where tier ∈ {moderate, low, very_low} OR status = no_match. The URL serializes the selection (`?tier=high`); paste the URL in a new tab and the filter persists.

## §5 · Admin detail — "Why this score?" expander (operator)

Click any application from §4. On the detail page each matched offer renders the structured probability prominently. Click the chevron next to the score → the "Why this score?" panel expands:

- Positive factors render with a green up-arrow + plain-language sentence + `+<impact>`.
- Negative factors render with a red down-arrow + sentence + `<impact>` (already-signed integer).
- Sorted by `|impact|` desc — biggest mover first.
- Toggle the dashboard locale to Arabic; every sentence localizes from the OFFER's engine `weightsConfig.factorCatalog`.

If you open the detail page of a backfilled offer (`engineVersion='1.0.0-legacy'`), the panel shows the legacy notice instead of an empty list: "Detailed factors unavailable for offers produced before engine version 1.1.0".

## §6 · Analyst view (operator, role: analyst)

Sign in as `analyst`. Sidebar → **Scoring analytics**. The page renders:

- A 10-point-bucket histogram of approval scores across all matched offers in the chosen window (default 30 days).
- A 5-row tier-accuracy table. Because `bank_offer_decision` is empty at launch, every `approvalRate` shows `—`.

Try `?windowDays=400`. Expected response: `400 { success: false, code: "ANALYTICS_WINDOW_TOO_LARGE", meta: { maxDays: 180 } }`. The page renders a notice instead of the histogram.

## §7 · Promote a new engine version (operator, role: super_admin)

(Optional — exercises FR-011b.) Inserts a fresh `scoring_engine_version` row via a manual SQL `INSERT` (the activation endpoint flips activeness; row CREATION happens via deploy migrations or future tooling per FR-011c). Then activate via the API:

```sql
INSERT INTO scoring_engine_version (id, version, description, weightsConfig, activatedAt, deactivatedAt, createdAt)
VALUES (
  'cl' || substring(md5(random()::text), 1, 28),
  '1.2.0-test',
  'Local test: PAYROLL_TRANSFER bumped from +10 to +12',
  jsonb_set(
    (SELECT weightsConfig FROM scoring_engine_version WHERE version = '1.1.0-init'),
    '{weights,PAYROLL_TRANSFER}', '12'::jsonb
  ),
  now(),
  now(),  -- inactive on insert
  now()
);
```

Sign in as `super_admin`. Hit the activation endpoint:

```bash
curl -X POST http://localhost:3000/api/admin/scoring-versions/1.2.0-test/activate \
  -H "Authorization: Bearer <super_admin access token>"
```

Expected: `200 { success: true, data: { previousVersion: "1.1.0-init", newVersion: "1.2.0-test", activatedAt: "..." } }`.

Verify:

```sql
-- exactly one active row
SELECT version FROM scoring_engine_version WHERE deactivatedAt IS NULL;
-- 1.2.0-test
```

Audit event:

```sql
SELECT payload FROM audit_event
WHERE eventType = 'SCORING_ENGINE_VERSION_PROMOTED'
ORDER BY occurredAt DESC LIMIT 1;
-- payload contains previousVersion, newVersion, weightsDiff, bumpKind: 'minor'
```

## §8 · Concurrent-promotion race (developer-discretion)

Open two terminals, hit the activation endpoint simultaneously with two different versions (after inserting both into the registry). Exactly one returns `200`; the other returns `409 SCORING_VERSION_CONCURRENT_PROMOTION`. The partial unique index + SERIALIZABLE transaction enforce the single-active invariant.

## §9 · Re-run the apply scenario under the new engine

Re-submit Golden Scenario #1. The response now stamps `engineVersion='1.2.0-test'` and `PAYROLL_TRANSFER` carries `impact: 12` instead of `10`. Old offers from §3 retain their original `engineVersion='1.1.0-init'` and original impact `10` — historical scores are immutable.

## §10 · Backfill verification

Pick any pre-feature-004 offer (e.g., from a previous quickstart run, or seed one before applying the migration):

```sql
SELECT id, approvalScore, approvalTier, approvalFactors, engineVersion
FROM bank_offer
WHERE engineVersion = '1.0.0-legacy'
LIMIT 3;
```

Expected:

- `approvalScore` is an integer matching `ROUND(approvalProbabilityPercent)`.
- `approvalTier` matches the threshold table (e.g., score 88 → `excellent`).
- `approvalFactors = {"positive": [], "negative": [], "legacy": true}`.
- `engineVersion = '1.0.0-legacy'`.

The admin detail page for any of these offers shows the legacy notice in the "Why this score?" panel.

## §11 · Boundary checks (developer-discretion)

- Insert an offer with `approvalScore=80`, expect `approvalTier=excellent` (inclusive on upper-tier side per R-005).
- Insert one with `approvalScore=79`, expect `approvalTier=good`.
- Insert one with `approvalScore=0`, expect `approvalTier=very_low`.

## §12 · Performance check (load test)

Spin Vegeta / k6 against `POST /api/v1/apply` with 50 RPS for 60 s using pre-signed requests. Confirm p95 stays at the feature-003 budget (≤ 800 ms end-to-end). Structured `approvalProbability` payload adds ≤ 1 KB per offer; payload-size delta is negligible.

Then hit `GET /api/admin/scoring-analytics?windowDays=30` 10×. Confirm p95 < 2 s on a 100 k-row `bank_offer`.

---

## Acceptance summary

| User story | Sections |
|---|---|
| US1 (mobile API consumer — structured payload) | §3 |
| US2 (admin pill + tier filter) | §4 |
| US3 (admin detail "Why this score?") | §5 |
| US4 (analyst distribution + accuracy) | §6 |
| US5 (engineer version bump) | §7, §8, §9 |
| Constitutional gates | §5 (RTL + a11y via promax/impec), §3 (PII-free factors), §11 (boundary), §12 (perf) |

If any section fails, log the failure to `specs/004-approval-probability-display/quickstart-failures.md` (create on demand) with the step, expected, observed, and a curl-output excerpt. Findings feed into the impec polish pass on the affected screen.
