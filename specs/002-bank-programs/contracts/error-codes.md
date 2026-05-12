# Error Codes Contract — Feature 002 BankProgram Management

**Feature**: 002-bank-programs
**Constitution**: Principle III (typed errors end-to-end) — same-PR rule: backend `error-codes.ts` + admin `error-codes.{ar-EG,en-US}.json` + (deferred) Flutter ARB.

Envelope on failure (per Principle XIV):

```json
{
  "success": false,
  "code": "ERROR_CODE_NAME",
  "meta": { /* code-specific structured context */ }
}
```

NEVER include free-text English in the response. Translation is the dashboard's job, via the error-code-to-message helper.

---

## New error codes introduced by this feature

| Code | HTTP | Source FR | `meta` shape | Arabic message | English message |
|---|---|---|---|---|---|
| `BANK_PROGRAM_NOT_FOUND` | 404 | FR-014 / FR-017 / FR-030 | `{ programCode?: string, id?: string }` | لم يتم العثور على برنامج البنك | Bank program not found |
| `PROGRAM_CODE_ALREADY_IN_USE` | 409 | FR-012, FR-023 | `{ programCode: string }` | رمز البرنامج مستخدم بالفعل | This program code is already in use |
| `INVALID_VARIABLE_RATE_CONFIGURATION` | 422 | FR-011a | `{ field: 'currentEffectiveRate' \| 'baseRate', reason: string }` | إعداد المعدل المتغير غير صالح | Variable-rate configuration is invalid |
| `INVALID_QUALITATIVE_REVIEW_CEILING` | 422 | FR-003a (a) | `{ field: 'qualitativeReviewMaxEGP' }` | لا يمكن تعيين سقف المراجعة النوعية دون تفعيل المراجعة النوعية في معايير الأهلية | `qualitativeReviewMaxEGP` requires `requiresQualitativeReview = true` on eligibility |
| `QUALITATIVE_REVIEW_CEILING_BELOW_BASE` | 422 | FR-003a (b) | `{ qualitativeReviewMaxEGP: string, maxEGP: string }` | يجب أن يكون سقف المراجعة النوعية أكبر من الحد الأقصى الأساسي | `qualitativeReviewMaxEGP` must be strictly greater than `maxEGP` |
| `DERIVATION_ARITHMETIC_MISMATCH` | 422 | FR-008s (d) | `{ fieldPath: string, value: string, sourceRatePercent: string, deltaPercent: string }` | لا يتطابق اشتقاق المعدل مع القيمة المخزنة | Derivation chain arithmetic does not match the stored value |
| `CONFLICT_STALE_DATA` | 409 | FR-021 | `{ submittedVersion: number, currentVersion: number }` | تم تعديل البرنامج بواسطة مستخدم آخر — يرجى إعادة التحميل | This program was changed by someone else; please reload |
| `BANK_PROGRAM_HAS_OFFERS` | 409 | FR-027 | `{ programCode: string, offerCount: number }` | لا يمكن حذف هذا البرنامج لأنه يحتوي على عروض مرتبطة — قم بإلغاء التفعيل بدلاً من الحذف | Cannot delete: this program has bank offers; deactivate instead |
| `UNKNOWN_ENUMERATION_KEY` | 422 | FR-010 | `{ enumerationType: string, offendingKey: string, activeMembers: string[] }` | المفتاح المحدد غير معترف به في سجل التعدادات | Unknown enumeration key for this dimension |
| `DEPRECATED_ENUMERATION_KEY` | 422 | FR-010c | `{ enumerationType: string, deprecatedKey: string }` | المفتاح المحدد تم إيقافه — يرجى تحديث الإعداد | This enumeration key has been deprecated |
| `ENUMERATION_REGISTRY_UNAVAILABLE` | 503 | FR-010 (fail-closed) | `{}` | سجل التعدادات غير متاح — يرجى المحاولة لاحقاً | Enumeration registry unavailable; retry shortly |
| `SEED_RATE_VERIFICATION_FAILED` | 422 | FR-033c | `{ catalogName: string, mismatches: Array<{ programCode: string, expected: string, actual: string }> }` | فشل التحقق من معدلات البذرة — تم التراجع | Seed rate verification failed; the seed was rolled back |
| `SEED_REQUIRES_SUPER_ADMIN` | 403 | FR-033a, FR-033b | `{ endpoint: string }` | عملية البذرة تتطلب صلاحيات المسؤول الأعلى | Seed operations require super_admin role |

---

## Reused error codes from feature 001

These already exist; this feature reuses them unchanged:

| Code | HTTP | Reuse context |
|---|---|---|
| `UNAUTHENTICATED` | 401 | every admin endpoint without a valid JWT |
| `FORBIDDEN` | 403 | viewer attempting write actions, admin attempting delete, role mismatch |
| `VALIDATION_FAILED` | 422 | generic DTO validation (min > max, negative months, etc.) — surfaces field-level errors via the existing `meta.fields` shape |
| `INTERNAL_ERROR` | 500 | uncaught server-side failures |
| `RATE_LIMIT_EXCEEDED` | 429 | when an actor exceeds the throttle bucket |
| `NOT_FOUND` | 404 | mobile endpoint for an inactive program (FR-030 — no leakage) |

---

## Translation deliverables

Same PR MUST update:

1. `backend/src/common/error-codes.ts` — add new codes to the typed union + the central message map (only used for backend logs; user-facing translations live on the client).
2. `admin/src/i18n/error-codes.ar-EG.json` — Arabic messages for all 13 new codes.
3. `admin/src/i18n/error-codes.en-US.json` — English messages for all 13 new codes.
4. (Deferred) Flutter ARB — when the mobile client is built; the backend mobile API returns the typed code envelope ready for the Flutter client to translate.
