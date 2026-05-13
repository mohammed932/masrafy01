# Feature 004 — Error Codes

Four new codes ship in this feature. Per Constitution Principle III (Typed Errors End-to-End) every code lands in three files in the same PR:

1. `backend/src/common/errors/error-codes.ts` — the canonical enum + HTTP-status map.
2. `admin/src/i18n/error-codes.ar-EG.json` — Arabic message.
3. `admin/src/i18n/error-codes.en-US.json` — English message.

The catalog also covers a payload-key extension to one EXISTING code (`NO_MATCHING_PROGRAMS` from feature 003) — no new code, but the `meta.suggestions` array now optionally carries `tier`-bucketed counts (see "Existing-code payload extensions" below).

---

## New codes

### `SCORING_VERSION_CONCURRENT_PROMOTION` (409)

- **When**: Two `super_admin` operators race the activation endpoint. SERIALIZABLE transaction A commits first; transaction B receives Postgres `40001` (serialization_failure) and is rejected with this code.
- **Meta**: none.
- **AR**: `محاولة تنشيط متزامنة لإصدار آخر — أعد المحاولة بعد لحظات.`
- **EN**: `Another promotion is in progress. Please retry in a moment.`
- **Status**: `409 Conflict`

### `SCORING_VERSION_NOT_FOUND` (404)

- **When**: The `:version` path parameter to the activation endpoint does not match any row in `scoring_engine_version`. Also surfaced by the boot-time integrity check if a persisted `bank_offer.engineVersion` does not exist in the registry.
- **Meta**: `{ version: string }`.
- **AR**: `الإصدار المطلوب غير موجود في سجل المحرك.`
- **EN**: `Requested scoring engine version is not registered.`
- **Status**: `404 Not Found`

### `SCORING_VERSION_NO_ACTIVE` (503)

- **When**: Boot-time integrity check finds zero rows with `deactivatedAt IS NULL`. The backend refuses to serve `/api/v1/apply` until an operator activates a version. Triggered only by misconfiguration / botched migration.
- **Meta**: none.
- **AR**: `لا يوجد إصدار نشط للمحرك. تواصل مع المشرف الأعلى.`
- **EN**: `No active scoring engine version. Contact a super-admin.`
- **Status**: `503 Service Unavailable`

### `ANALYTICS_WINDOW_TOO_LARGE` (400)

- **When**: `GET /api/admin/scoring-analytics?windowDays=N` where `N > 180`.
- **Meta**: `{ maxDays: 180 }`.
- **AR**: `النطاق الزمني المطلوب أكبر من الحد المسموح (180 يوماً). استخدم مستودع البيانات للنطاقات الأكبر.`
- **EN**: `Requested window exceeds the 180-day cap. Use the data warehouse for larger ranges.`
- **Status**: `400 Bad Request`

---

## Existing-code payload extensions

### `NO_MATCHING_PROGRAMS` (200) — payload only

Feature 003 returns this code with `meta.suggestions` already. Feature 004 ADDS an optional `tierBucketCounts` field describing how many programs would unlock at each tier if the applicant fixed a given factor. UI-only enhancement; client may ignore it. No behavioral change.

```jsonc
{
  "success": false,
  "code": "NO_MATCHING_PROGRAMS",
  "meta": {
    "primaryReason": "INCOME_TOO_LOW",
    "details": [ ... ],
    "suggestions": [
      {
        "code": "INCREASE_INCOME_THRESHOLD",
        "magnitude": 20,
        "programsUnlocked": 6,
        "tierBucketCounts": { "excellent": 0, "good": 2, "moderate": 4 }  // NEW (optional)
      }
    ]
  }
}
```

---

## HTTP-status summary

| Code | HTTP | Surface |
|---|---|---|
| `SCORING_VERSION_CONCURRENT_PROMOTION` | 409 | `POST /api/admin/scoring-versions/:version/activate` |
| `SCORING_VERSION_NOT_FOUND` | 404 | activation endpoint + boot integrity check |
| `SCORING_VERSION_NO_ACTIVE` | 503 | `POST /api/v1/apply` (fail-closed if registry empty) |
| `ANALYTICS_WINDOW_TOO_LARGE` | 400 | `GET /api/admin/scoring-analytics` |

---

## Audit-event types

`SCORING_ENGINE_VERSION_PROMOTED` (NEW) — see [data-model.md §4](../data-model.md) for the payload schema.
