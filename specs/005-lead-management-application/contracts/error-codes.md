# Feature 005 — Error Codes

7 new codes. Per Constitution Principle III each lands in three files in the same PR:

1. `backend/src/common/errors/error-codes.ts`
2. `admin/src/i18n/error-codes.ar-EG.json`
3. `admin/src/i18n/error-codes.en-US.json`

---

## New codes

### `ACTIVITY_FORBIDDEN_NOT_ASSIGNED` (403)

- **When**: `sales_agent` tries to log activity / read timeline of an application not assigned to them.
- **Meta**: `{ applicationId }`.
- **AR**: `هذا الطلب غير مُعيَّن إليك.`
- **EN**: `This application is not assigned to you.`

### `INVALID_ACTIVITY_REASON` (422)

- **When**: `reason` value is not in the canonical matrix for the supplied `activityType` (per [reason-codes.md](./reason-codes.md)).
- **Meta**: `{ activityType, reason, allowedReasons: string[] }`.
- **AR**: `سبب النشاط غير صالح لنوع النشاط المختار.`
- **EN**: `Selected reason is not valid for this activity type.`

### `REASON_DETAILS_REQUIRED` (422)

- **When**: `reason='OTHER'` and `note` is empty/blank.
- **Meta**: none.
- **AR**: `الرجاء كتابة تفاصيل السبب في حقل الملاحظات.`
- **EN**: `Please provide details in the note field when using the "Other" reason.`

### `DURATION_REQUIRED_FOR_CALL` (422)

- **When**: `activityType='CALLED_USER'` and `durationMinutes` is null/zero.
- **Meta**: none.
- **AR**: `الرجاء إدخال مدة المكالمة بالدقائق.`
- **EN**: `Please record the call duration in minutes.`

### `FOLLOWUP_IN_PAST` (422)

- **When**: `followUpAt` is in the past.
- **Meta**: `{ followUpAt }`.
- **AR**: `موعد المتابعة يجب أن يكون في المستقبل.`
- **EN**: `The follow-up reminder must be set in the future.`

### `FILE_TOO_LARGE` (413)

- **When**: presigned-URL request with `sizeBytes > 10 485 760`.
- **Meta**: `{ maxSizeBytes: 10485760, sizeBytes }`.
- **AR**: `حجم الملف أكبر من الحد المسموح (10 ميغابايت).`
- **EN**: `File exceeds the 10 MB limit.`

### `FILE_TYPE_NOT_ALLOWED` (415)

- **When**: presigned-URL request with `mimeType` outside `{image/jpeg, image/png, image/heic, application/pdf}`.
- **Meta**: `{ mimeType, allowedTypes: ['image/jpeg','image/png','image/heic','application/pdf'] }`.
- **AR**: `نوع الملف غير مدعوم. الأنواع المسموحة: JPG / PNG / HEIC / PDF.`
- **EN**: `Unsupported file type. Allowed: JPG, PNG, HEIC, PDF.`

---

## HTTP-status summary

| Code | HTTP | Surface |
|---|---|---|
| `ACTIVITY_FORBIDDEN_NOT_ASSIGNED` | 403 | `POST /api/admin/applications/:id/activities`, `GET /api/admin/applications/:id` |
| `INVALID_ACTIVITY_REASON` | 422 | `POST /api/admin/applications/:id/activities` |
| `REASON_DETAILS_REQUIRED` | 422 | same |
| `DURATION_REQUIRED_FOR_CALL` | 422 | same |
| `FOLLOWUP_IN_PAST` | 422 | same |
| `FILE_TOO_LARGE` | 413 | `POST /api/admin/documents/upload-url` |
| `FILE_TYPE_NOT_ALLOWED` | 415 | same |

---

## Audit-event types (NEW)

- `APPLICATION_ACTIVITY_LOGGED`
- `DOCUMENT_UPLOADED`
- `APPLICATION_REASSIGNED`
- `MANAGER_ATTENTION_REQUESTED`
- `APPLICATION_LEAD_STATUS_CHANGED`

Payload schemas in [data-model.md §5](../data-model.md#5-auditevent--enum--payload-extensions).
