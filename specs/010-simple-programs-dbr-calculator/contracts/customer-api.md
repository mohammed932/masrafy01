# Contract — Customer (Mobile) API

All routes: prefix `/api/v1`, customer JWT (15 min access), envelope `{ success, data }`, money as decimal **strings** (Principle I). No guest access (Principle XIII). Profile-completeness gate unchanged (Principle XXXVII).

---

## `GET /v1/questionnaire`

Returns the active global snapshot. **Additive** change: each question carries its type and, where relevant, its rules. Old clients that ignore the new keys keep working; the current app already parses all four type strings.

```jsonc
{ "success": true, "data": {
  "versionNumber": 7,
  "groups": [ { "code": "financials", "titleAr": "…", "titleEn": "…", "displayOrder": 1,
    "questions": [
      { "code": "employment_status", "type": "SINGLE_SELECT", "questionAr": "…", "questionEn": "…",
        "isRequired": true, "displayOrder": 1,
        "options": [ { "code": "salaried", "labelAr": "…", "labelEn": "…" } ] },

      { "code": "amount_requested", "type": "NUMERIC", "questionAr": "…", "questionEn": "…",
        "isRequired": true, "displayOrder": 2, "options": [],
        "numeric": { "minValue": "1000", "maxValue": "20000000", "step": "1000",
                     "unitAr": "جنيه", "unitEn": "EGP" } },

      { "code": "preferred_banks", "type": "MULTI_SELECT", "…": "…",
        "options": [ … ] },

      { "code": "employer_name", "type": "TEXT", "…": "…", "options": [],
        "text": { "maxLength": 120 } }
    ] } ] } }
```

---

## `POST /v1/matching/preview`

Answers become type-aware; the response gains figures. Existing fields keep their names.

**Request**

```jsonc
{ "category": "personal",
  "answers": [
    { "questionCode": "employment_status",  "optionCode": "salaried" },
    { "questionCode": "preferred_banks",    "optionCodes": ["abk", "cib"] },
    { "questionCode": "employer_name",      "textValue": "Acme Egypt" },
    { "questionCode": "amount_requested",   "numericValue": "500000" },
    { "questionCode": "repayment_period_months", "numericValue": "60" },
    { "questionCode": "monthly_income",     "numericValue": "20400" },
    { "questionCode": "current_installments", "numericValue": "2000" }
  ] }
```

Exactly one value key per answer, matching the question's type (R8).

The applicant **age is never in the body**: it is derived from the authenticated
customer's `birthday` (Principle XXXVII / A31), which is why this endpoint is
profile-complete-gated. That is what makes a previewed tenor equal the one apply
returns — the age-at-maturity rule sees the same number on both paths.

**Response**

```jsonc
{ "success": true, "data": { "category": "personal", "matches": [ {
  "bankProgramId": "bp_…", "programCode": "ABK-PL-PAYROLL", "bankName": "ABK Egypt",
  "bankIsFeatured": true, "programFriendlyName": "Payroll Loan",
  "requiredDocuments": ["SIGNED_APPLICATION","VALID_NID"],
  "figures": {
    "offeredAmountEGP": "285000.00",
    "cashToCustomerEGP": "280725.00",
    "totalFeesEGP": "4275.00",
    "monthlyInstallmentEGP": "6931.42",
    "effectiveTenorMonths": 60,
    "effectiveRatePercent": "24.0000",
    "totalPayableEGP": "415885.20",
    "totalCostOfCreditEGP": "135160.20",
    "dbrPercent": "39.87",
    "bindingConstraint": "dbr_affordability",
    "fees": { "adminFeeEGP": "4275.00", "stampDutyEGP": "50.00", "lifeInsuranceEGP": "0.00" }
  },
  "figuresUnavailableReason": null,
  "rejectionReasons": []
} ],
"disclaimerCode": "INDICATIVE_ESTIMATE_NOT_AN_OFFER",
"suggestions": [] } }
```

- `figures: null` + `figuresUnavailableReason` (reason code list in [error-codes.md](./error-codes.md)) when a program cannot be quoted. The program is still listed and still ordered (FR-024).
- **Order** (v25.0.0): `matches` arrives ranked, and the client renders it as received — there is no score to re-sort by. The apply path freezes `rankOffers(offers, priority)` on each row as `bank_offer.rankIndex` and reads back by it; preview persists nothing, so it has no `rankIndex` and applies the same key chain in memory — installment ascending with unquotable programs last, then partner bank (`bankIsFeatured`), then `programCode`.
- `bindingConstraint` explains any reduction (FR-023).
- `monthlyInstallmentEGP` is computed on offered amount **plus** financed fees; `cashToCustomerEGP` is what the customer receives (FR-022a).
- Preview figures equal the figures returned by `POST /v1/apply` for the same answers (FR-025 / SC-004).

Errors: `ANSWER_TYPE_MISMATCH`, `ANSWER_OUT_OF_RANGE`, `ANSWER_TOO_LONG`, `ANSWER_REQUIRED`, `MONEY_FIGURE_MISSING`, `UNKNOWN_QUESTION_CODE`, `UNKNOWN_OPTION_CODE`, `QUESTIONNAIRE_NOT_PUBLISHED`.

---

## `POST /v1/apply`

Unchanged route and response envelope. The economic fields (`requestedAmountEGP`, `preferredTenorMonths`, `employment.monthlyNetSalaryEGP`, `obligations.existingMonthlyObligationsEGP`) MUST now carry the values from the bound number answers — the app's bucket-to-guess maps are deleted (FR-042). A missing bound answer fails with `MONEY_FIGURE_MISSING` rather than defaulting to zero (FR-044).

`age` is **removed from the request body** — it is derived from the authenticated
customer's `birthday` server-side (Principle XXXVII / A31) and persisted on the
application as the snapshot the engine priced on. A client that still sends it
is rejected with 422 `VALIDATION_FAILED` by the global `forbidNonWhitelisted` validation.

Offer payloads gain the same `figures` block plus the DBR audit fields (`dbrCapPercent`, `dbrBandIndex`).

---

## `POST /v1/calculator/quote` — NEW

Two modes. Program-scoped when `bankProgramId` is present, otherwise generic with a configured representative rate (FR-030).

**Cost mode** — "what will it cost"

```jsonc
{ "mode": "cost", "bankProgramId": "bp_…",
  "amountEGP": "300000", "tenorMonths": 60 }
```

```jsonc
{ "success": true, "data": {
  "mode": "cost", "programCode": "ABK-PL-PAYROLL", "isRepresentativeRate": false,
  "effectiveRatePercent": "24.0000",
  "amountEGP": "300000.00", "cashToCustomerEGP": "295500.00", "totalFeesEGP": "4500.00",
  "monthlyInstallmentEGP": "7296.23", "tenorMonths": 60,
  "totalPayableEGP": "437773.80", "totalCostOfCreditEGP": "142273.80",
  "fees": { "adminFeeEGP": "4500.00", "stampDutyEGP": "50.00", "lifeInsuranceEGP": "0.00" },
  "clamped": { "amount": false, "tenor": false },
  "limits": { "minAmountEGP": "20000.00", "maxAmountEGP": "500000.00",
              "minTenorMonths": 6, "maxTenorMonths": 84 },
  "disclaimerCode": "INDICATIVE_ESTIMATE_NOT_AN_OFFER" } }
```

**Affordability mode** — "what can I afford"

```jsonc
{ "mode": "affordability", "bankProgramId": "bp_…",
  "monthlyIncomeEGP": "20400", "existingObligationsEGP": "2000", "tenorMonths": 60 }
```

```jsonc
{ "success": true, "data": {
  "mode": "affordability", "programCode": "ABK-PL-PAYROLL",
  "recognisedIncomeEGP": "17340.00", "dbrCapPercent": "40.0000", "dbrBandIndex": 2,
  "maxAffordableAmountEGP": "285000.00", "monthlyInstallmentEGP": "6931.42",
  "tenorMonths": 60, "bindingConstraint": "dbr_affordability",
  "disclaimerCode": "INDICATIVE_ESTIMATE_NOT_AN_OFFER" } }
```

Rules:

- Inputs outside a program's limits are clamped to the limit and the clamp is reported in `clamped` (FR-029).
- `isRepresentativeRate: true` in generic mode, with the rate returned so the app can state it (FR-030).
- Fees are always itemised (FR-031).
- The applicant age is **not a request field**: it is derived from the authenticated customer's `birthday` (Principle XXXVII / A31) and drives the age-at-maturity tenor shortening, so the endpoint is `CustomerJwtGuard` + `CustomerProfileCompleteGuard` gated and a lite profile gets `PROFILE_INCOMPLETE`. An assumed age would quote a term apply would then cut.
- Persists nothing. Rate-limited by the existing throttler (Principle XV).

Errors: `CALCULATOR_INPUT_INVALID`, `CALCULATOR_PROGRAM_INACTIVE`, `PROGRAM_MISCONFIGURED`, `BANK_PROGRAM_NOT_FOUND`.

---

## `GET /v1/bank-programs/:id`

Unchanged, plus `limits` (min/max amount, min/max tenor), `dbr` (`capPercent` or the resolved band table), and the itemised fee schedule, so the program detail screen can open the calculator pre-scoped (FR-032).
