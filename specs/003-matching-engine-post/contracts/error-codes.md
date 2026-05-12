# Error Codes Contract — Feature 003 Matching Engine

**Feature**: 003-matching-engine-post
**Constitution**: Principle III (typed errors end-to-end). Same-PR rule = backend `error-codes.ts` + admin `error-codes.{ar-EG,en-US}.json` + Flutter ARB (deferred).

Envelope on failure: `{ success: false, code, meta? }`. NEVER include English prose for the client. Translation is the dashboard / mobile client's job via the central error-code helper.

---

## New endpoint-level error codes

| Code | HTTP | Source FR | `meta` shape | Arabic message | English message |
|---|---|---|---|---|---|
| `NO_MATCHING_PROGRAMS` | 200 | FR-040, US3 | `{ primaryReason, details: [{ programCode, failedChecks }], suggestions: [...] }` | لم تتطابق أي برامج بنكية مع طلبك. | No bank programs matched your request. |
| `INCOME_TOO_LOW` | 422 | FR-055 | `{ minRequiredEGP: string }` | الدخل المُعلن أقل من الحد الأدنى المطلوب لأي برنامج. | Declared income is below the minimum required by every program. |
| `AGE_NOT_ELIGIBLE` | 422 | FR-055 | `{ youngestMinAge: number, oldestMaxAge: number }` | عمرك خارج النطاق المقبول لأي برنامج. | Your age is outside every program's accepted range. |
| `DBR_EXCEEDED` | 422 | FR-031, FR-055 | `{ computedDBR: string, capPercent: string, maxLoanAvailableEGP: string }` | نسبة عبء الديون تتجاوز الحد المسموح به في كل البرامج. | Debt-burden ratio exceeds every program's cap. |
| `TENOR_OUT_OF_RANGE` | 422 | FR-055 | `{ requestedTenor: number, minTenor: number, maxTenor: number }` | المدة المطلوبة خارج النطاق المسموح به. | Requested tenor is outside every program's range. |
| `AMOUNT_OUT_OF_RANGE` | 422 | FR-055 | `{ requestedAmount: string, lowestMin: string, highestMax: string }` | المبلغ المطلوب خارج النطاق المسموح به. | Requested amount is outside every program's range. |
| `CURRENCY_NOT_SUPPORTED` | 422 | FR-009, FR-055 | `{ requested: string, supportedAcrossPrograms: string[] }` | لا يوجد برنامج يدعم العملة المطلوبة. | No program supports the requested currency. |
| `MISSING_CD_RECORD` | 422 | FR-014, FR-055 | `{ field: "cdAtABKValueEGP" }` | بيانات شهادة الإيداع مطلوبة لاحتساب الدخل. | CD record is required for income computation on this program. |
| `MISSING_CAR_LOAN_RECORD` | 422 | FR-015/016, FR-055 | `{ field: "autoLoanAtOtherBankEGP" \| "carInstallmentEGP" }` | بيانات قرض السيارة مطلوبة لاحتساب الدخل. | Car-loan record is required for income computation on this program. |
| `MISSING_BANK_STATEMENT` | 422 | FR-018, FR-055 | `{ field: "bankStatementBalanceEGP" }` | رصيد كشف الحساب مطلوب لاحتساب الدخل. | Bank-statement balance is required for income computation on this program. |
| `INCOME_LOOKUP_FAILED` | 422 | FR-012/013, FR-055 | `{ strategy: string, lookupKey: string }` | لا توجد قيمة دخل مطابقة لرتبتك في الجدول. | No income value found for your rank/grade in the program's lookup table. |
| `MATCHING_ENGINE_ERROR` | 500 | FR-055 | `{ correlationId: string }` | حدث خطأ داخلي أثناء معالجة الطلب. | Internal error during matching. |
| `IDEMPOTENCY_KEY_MISMATCH` | 409 | FR-044, FR-055 | `{ idempotencyKey: string }` | مفتاح الاستجابة الفريد مطابق لطلب آخر بمحتوى مختلف. | Same idempotency key used with a different payload. |
| `RATE_LIMITED` | 429 | FR-066, FR-055 | `{ bucket: "hmac_client" \| "applicant_fingerprint", retryAfterSeconds: number }` | عدد محاولات كبير. الرجاء المحاولة لاحقاً. | Too many submissions. Please wait and try again. |
| `UNAUTHENTICATED` | 401 | feature 001 | `{}` | يجب تسجيل الدخول أولاً. | You need to sign in. |
| `FORBIDDEN` | 403 | feature 001 | `{}` | ليس لديك صلاحية لتنفيذ هذا الإجراء. | You do not have permission to do that. |

---

## New positive-side error codes (offer `matchReasons[]`)

Used inside `BankOffer.matchReasons` to explain WHY the program matched. Same translation contract — Arabic + English required.

| Code | When emitted |
|---|---|
| `MATCH_HAS_CD` | Applicant declared a CD record at ABK and the program rewards CD holders |
| `MATCH_PAYROLL_CAT_A` | Applicant's `companyType = cat_a` AND the program's pricing keys include `payroll_cat_a` |
| `MATCH_PAYROLL_CAT_B` | Same pattern, Cat-B |
| `MATCH_PAYROLL_CAT_C` | Same pattern, Cat-C |
| `MATCH_AGE_OK` | Age within range |
| `MATCH_INCOME_OK` | Income ≥ program minimum |
| `MATCH_TENURE_OK` | Months-in-job ≥ minimum |
| `MATCH_DBR_OK` | DBR within cap (or `skipDbrCheck = true`) |
| `MATCH_BANKERS_SEGMENT` | Applicant `companyType ∈ ['commercial_bank', 'public_bank']` AND program is Bankers |
| `MATCH_DOCTORS_PRACTICE` | Years-in-practice strategy resolved successfully |
| `MATCH_DOCTORS_CLINIC` | Clinic-owners program criteria met |
| `MATCH_PROFESSOR_RANK` | Professor-rank lookup succeeded |
| `MATCH_MILITARY_GRADE` | Military-grade lookup succeeded |
| `MATCH_COMPOUND_OWNER` | `ownsCompoundProperty = true` AND program requires it |
| `MATCH_CLUB_MEMBERSHIP` | Applicant carries a matching club-class |
| `MATCH_SECURED_LOAN` | `skipDbrCheck` path (collateral-backed) |
| `MATCH_BUYOUT_ELIGIBLE` | Applicant declared an existing loan + buyout performance gates pass |
| `MATCH_NO_DOCS_PATH` | `requiresNoDocuments = true` AND applicant did NOT upload docs |

---

## Suggestions engine error codes (no-match `meta.suggestions[]`)

Each suggestion carries `{ code, magnitude, programsUnlocked, displayMeta? }`.

| Code | Magnitude meaning | Display meta |
|---|---|---|
| `SUGGEST_REDUCE_AMOUNT` | Suggested loan amount (decimal string EGP) | `{ deltaPercent: string }` |
| `SUGGEST_INCREASE_AMOUNT` | Suggested loan amount (decimal string EGP) | `{ }` |
| `SUGGEST_PAY_DOWN_OBLIGATIONS` | Suggested monthly reduction (decimal string EGP) | `{ currentObligationsEGP: string }` |
| `SUGGEST_EXTEND_TENOR` | Suggested tenor (months) | `{ }` |
| `SUGGEST_REDUCE_TENOR` | Suggested tenor (months) | `{ }` |
| `SUGGEST_GUARANTOR` | n/a (set to "0") | `{ reason: 'AGE_NOT_ELIGIBLE' \| 'INCOME_TOO_LOW' }` |
| `SUGGEST_UPLOAD_RECORD` | n/a | `{ recordType: 'cd' \| 'car_loan' \| 'bank_statement' }` |
| `SUGGEST_LOWER_DBR_TARGET` | Suggested DBR percent | `{ currentDBR: string, currentObligationsEGP: string }` |

---

## Translation deliverables

Same PR MUST update:

1. `backend/src/common/errors/error-codes.ts` — add 16 endpoint-level codes + 18 positive-match codes + 8 suggestion codes.
2. `admin/src/i18n/error-codes.ar-EG.json` — Arabic for all new endpoint-level codes (suggestion codes can fall back to a generic localized string for v1).
3. `admin/src/i18n/error-codes.en-US.json` — English for same.
4. (Deferred) Flutter ARB — when the mobile client ships.
