# Quickstart: Matching Engine (Feature 003)

**Audience**: Masrafy operators + developers verifying a fresh environment.
**Prerequisites**: Features 001 + 002 shipped; infra running per [feature 002 quickstart §1–§3](../002-bank-programs/quickstart.md).

End-to-end walkthrough from boot → signed apply request → ranked offers → admin inspection → 14 golden-scenario regression run. Steps marked **dev** are infrastructure; **operator** are dashboard / API flows.

---

## §1 · Bring up infrastructure (dev)

```bash
docker compose -f docker/compose.dev.yml up -d postgres redis
```

## §2 · Apply migrations (dev)

```bash
cd backend
npx prisma migrate dev --name add_matching_engine
npx prisma generate
```

The migration creates `application` + `bank_offer` + extends `AuditEventType`.

## §3 · Seed bank programs (operator)

If you haven't seeded feature 002's programs, sign in as super_admin → sidebar → **Bank programs** → **Seed ABK Egypt 2026** (or `POST /api/admin/bank-programs/seeds/abk`). 20 programs land.

## §4 · Configure HMAC client secret (dev)

For local development a single mobile-client identity is provisioned via env:

```bash
# backend/.env
MOBILE_CLIENT_ID=dev
MOBILE_CLIENT_SECRET=dev-secret-please-change
```

In production this becomes a feature-005 mobile-client registry. For now the env var is the source.

## §5 · Start backend + admin (dev)

```bash
cd backend && npm run start:dev          # http://localhost:3000
cd admin && npm start                    # http://localhost:5173
```

OpenAPI at `http://localhost:3000/api/docs`.

## §6 · Submit Golden Scenario #1 (Postman / curl)

Government employee, Cat-A payroll, with CD at ABK. Builds the canonical signed request.

```bash
BODY='{
  "age": 35,
  "loanPurpose": "personal",
  "requestedAmountEGP": "200000.00",
  "requestedCurrency": "EGP",
  "preferredTenorMonths": 48,
  "priority": "lowest_installment",
  "isGuest": true,
  "employment": {
    "employmentType": "salaried",
    "monthlyNetSalaryEGP": "15000.00",
    "monthsInJob": 48,
    "salaryTransferType": "payroll_cat_a",
    "companyName": "Ministry of Finance",
    "companyType": "cat_a",
    "previousBankRejection": false
  },
  "obligations": {
    "existingMonthlyObligationsEGP": "0.00",
    "hasCurrentLoan": false
  },
  "assets": {
    "cdAtABKValueEGP": "80000.00",
    "totalDepositsAtABKValueEGP": "80000.00",
    "creditCardLimitEGP": "0.00",
    "ownsCompoundProperty": false
  }
}'

TS=$(date +%s)
NONCE=$(uuidgen)
BODY_SHA=$(printf '%s' "$BODY" | shasum -a 256 | cut -d ' ' -f 1)
SIG_INPUT="POST\n/api/v1/apply\n${TS}\n${NONCE}\n${BODY_SHA}"
SIG=$(printf "$SIG_INPUT" | openssl dgst -sha256 -hmac "$MOBILE_CLIENT_SECRET" | cut -d ' ' -f 2)

curl -X POST http://localhost:3000/api/v1/apply \
  -H "content-type: application/json" \
  -H "X-Client-Id: $MOBILE_CLIENT_ID" \
  -H "X-Timestamp: $TS" \
  -H "X-Nonce: $NONCE" \
  -H "X-Signature: $SIG" \
  -d "$BODY"
```

Expected response (200):

```json
{
  "success": true,
  "data": {
    "applicationId": "...",
    "matchedOffers": [
      { "programCode": "ABK-PAYROLL-CAT-A", "effectiveRatePercent": "22.5000", "monthlyInstallmentEGP": "...", "...": "..." },
      { "programCode": "ABK-CD-HOLDERS",    "effectiveRatePercent": "24.0000", "monthlyInstallmentEGP": "...", "...": "..." },
      { "programCode": "ABK-SALARIED-NO-XFER","effectiveRatePercent": "27.0000", "...": "..." }
    ],
    "summary": { "totalProgramsChecked": 20, "eligiblePrograms": 3, "bestInstallmentEGP": "...", "bestRatePercent": "22.5000" }
  }
}
```

The first offer is the lowest installment (priority ordering).

## §7 · Idempotency check

Re-issue the EXACT same request with `Idempotency-Key: golden-1` header. Same `applicationId`, same offers, ZERO new database rows. Verify by querying:

```sql
SELECT count(*) FROM application WHERE created_at > now() - interval '5 minutes';
-- Should be 1, not 2
```

Same key with a different body → 409 `IDEMPOTENCY_KEY_MISMATCH`.

## §8 · Rate-limit verification

Loop 6 submissions with the same applicant fingerprint (same nationalId) but different bodies — the 6th onward returns 429 `RATE_LIMITED` with `meta.bucket = "applicant_fingerprint"`. Reset by waiting 1 h or `FLUSHDB` on Redis dev.

## §9 · No-match scenario

Submit a profile guaranteed to fail (age 19, no income):

```bash
BODY='{
  "age": 19,
  "loanPurpose": "personal",
  "requestedAmountEGP": "1000000.00",
  "preferredTenorMonths": 60,
  "priority": "lowest_installment",
  "isGuest": true,
  "employment": { "employmentType": "salaried", "monthlyNetSalaryEGP": "0", "monthsInJob": 0, "salaryTransferType": "none", "companyName": "n/a", "companyType": "other" },
  "obligations": { "existingMonthlyObligationsEGP": "0", "hasCurrentLoan": false },
  "assets": {}
}'
# ... sign + submit as above
```

Expected (200 with success: false):

```json
{
  "success": false,
  "code": "NO_MATCHING_PROGRAMS",
  "meta": {
    "primaryReason": "AGE_NOT_ELIGIBLE",
    "details": [
      { "programCode": "ABK-PAYROLL-CAT-A", "failedChecks": ["AGE_OUT_OF_RANGE", "INCOME_TOO_LOW", "TRANSFER_TYPE_NOT_ACCEPTED"] },
      "..."
    ],
    "suggestions": [
      { "code": "SUGGEST_GUARANTOR", "magnitude": "0", "programsUnlocked": 0, "displayMeta": { "reason": "AGE_NOT_ELIGIBLE" } }
    ]
  }
}
```

## §10 · Admin inspection (operator)

Sign in to the admin dashboard. Sidebar → **Applications** (new lazy route).

- List page shows the applications from §6 + §9 with status chips (`matched` / `no_match`), date, loan purpose, masked applicant name.
- Click the §6 application. Detail page renders:
  - Applicant profile with PII masked (FR-051)
  - Ranked offer cards (one per matched program)
  - Each card: bank name, program code, effective rate, monthly installment, fees breakdown, approval probability, required documents, match-reasons chips, cascade-trace stepper
  - "Programs not matched (17)" expandable section listing each ineligible program with its failing-check error codes
  - Audit timeline drawer showing `APPLICATION_CREATED`, `MATCHING_ENGINE_RUN`, `APPLICATION_MATCHED` events with correlation IDs

Toggle the dashboard locale to Arabic. RTL flips. Currency renders Egyptian-Arabic conventions. All chips translate.

## §11 · Offline engine smoke (developer-discretion)

```bash
cd backend
npx tsx src/matching/match.checks.ts
```

The script runs all 14 golden scenarios from spec Appendix against fixture programs (loaded inline) — no HTTP, no DB. Each scenario prints `✓` with the matched programs + best-offer rate or `✗` with the divergence.

## §12 · Retention dry-run (developer-discretion)

Set `RETENTION_DAYS=1` env locally; the cron schedule runs the archive job hourly in dev mode. Submit an application, wait 1 hour + 1 minute, observe:
- Application row's `status` → `archived`, `archivedAt` populated, `coldTierKey` populated.
- Live `bank_offer` rows for that application removed.
- Object exists at `s3://masrafy-archive-dev/applications/<yyyy>/<mm>/<applicationId>.jsonl.gz`.
- Audit event `application.archived` emitted.

## §13 · Right-to-erasure dry-run (developer-discretion)

```bash
cd backend
npx tsx scripts/erase-application.ts <applicationId>
```

Verify:
- Application row `status = erased`, `erasedAt` populated, scalar PII fields zeroed, JSONB blobs replaced with tombstone shapes.
- `bank_offer` rows: scalar PII fields zeroed, `erasedAt` populated, JSONB blobs replaced.
- S3 object replaced with `<applicationId>.erased.jsonl.gz` containing tombstone-only content.
- Audit event `data.erasure.completed` emitted with `retentionTier = 'both'`.

## §14 · Performance check (load test)

Spin up Vegeta or k6 against `/api/v1/apply` with 50 RPS for 60 seconds using pre-signed requests. Confirm:

- p95 < 800 ms end-to-end (SC-001)
- p95 engine-only < 500 ms (read from `MATCHING_ENGINE_RUN` audit-event `durationMs` column)
- Zero `MATCHING_ENGINE_ERROR` responses
- Throttler clamps at 30/HMAC-client/hour AND 5/applicant-fingerprint/hour as expected

---

## Acceptance summary

Running all 14 sections exercises every user story:

| User story | Sections |
|---|---|
| US1 (submit + offers) | §6 |
| US2 (admin list + detail) | §10 |
| US3 (no-match + suggestions) | §9 |
| US4 (idempotency) | §7 |
| US5 (offline engine) | §11 |
| Constitutional gates | §10 (RTL + a11y), §13 (PDPL erasure), §12 (retention), §8 (rate limits) |

Plus the 14 golden scenarios via §11 — engine-level + §6 surface-level.

If any section fails, log the failure to `specs/003-matching-engine-post/quickstart-failures.md` (create on demand) with the step, expected, observed, and a curl-output excerpt. Findings feed into the impec polish pass on the affected screen.
