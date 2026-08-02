# Contract — Admin API

All routes: prefix `/api/admin`, admin JWT (`JwtAuthGuard` + `RolesGuard`), envelope `{ success, data, pagination? }`, OpenAPI at `/api/docs`. Money is decimal **strings**.

---

## Bank lending policy

### `GET /admin/banks/:bankId/policy`

Roles: `super_admin`, `analyst` (read).

```jsonc
{ "success": true, "data": {
  "policyDefaults": {
    "eligibility": { "ageMin": 21, "ageMax": 60, "minMonthlyIncomeEGP": "5000",
                     "dbrCapPercent": "50.0000",
                     "dbrBands": [ { "upToIncomeEGP": "5000", "capPercent": "30.0000" },
                                   { "upToIncomeEGP": null,   "capPercent": "50.0000" } ] },
    "tenor": { "minMonths": 6, "maxMonths": 84 },
    "maxUnsecuredExposureEGP": "3000000"
  },
  "updatedAt": "2026-07-30T10:00:00Z", "updatedBy": "stf_…"
} }
```

`policyDefaults: null` when unset (FR-006).

### `PUT /admin/banks/:bankId/policy`

Roles: `super_admin`. Body = the `policyDefaults` shape, every key optional. Full replace (not a patch) so removing a key is expressible.

Errors: `DBR_BANDS_INVALID`, `DBR_BAND_CAP_OUT_OF_RANGE`, `PROGRAM_RANGE_INVALID`, `NOT_FOUND`.
Audit: `bank_policy_updated` with a before/after diff. Existing programs untouched (FR-007).

---

## Program catalog defaults

### `GET /admin/platform-enumerations/program_name/:key/defaults`

```jsonc
{ "success": true, "data": {
  "defaults": { "personal": { "tenor": { "minMonths": 6, "maxMonths": 72 }, … } } } }
```

### `PUT /admin/platform-enumerations/program_name/:key/defaults`

Roles: `super_admin`. Body: `{ "defaults": { "<category>": { …partial sub-configs… } } }`. Full replace.

Errors: `CATALOG_DEFAULTS_CATEGORY_UNKNOWN`, `DBR_BANDS_INVALID`, `PROGRAM_RANGE_INVALID`, `VALIDATION_FAILED`, `NOT_FOUND`.
Audit: `program_catalog_defaults_updated`.

---

## Prefill

### `GET /admin/bank-programs/prefill?bankId=&programNameKey=&category=`

Roles: `super_admin`, `analyst`.

```jsonc
{ "success": true, "data": {
  "values": {
    "tenor": { "minMonths": 6, "maxMonths": 72 },
    "loanLimits": { "perCurrency": { "EGP": { "minAmount": "20000", "maxAmount": "500000" } } },
    "eligibility": { "ageMin": 25, "ageMax": 60, "minMonthlyIncomeEGP": "15000",
                     "dbrCapPercent": "50.0000", "dbrBands": [ … ], "skipDbrCheck": false,
                     "requiresCollateral": false },
    "pricing": { "currentEffectiveRatePercent": "24.0000", "isVariableRate": false },
    "fees": { "adminFeePercent": "1.5000", "stampDutyEGP": "50.00" },
    "requiredDocuments": ["SIGNED_APPLICATION","VALID_NID"]
  },
  "origin": {
    "tenor.maxMonths": "CATALOG",
    "eligibility.ageMin": "CATALOG",
    "eligibility.ageMax": "BANK_POLICY",
    "pricing.currentEffectiveRatePercent": "CATALOG",
    "fees.stampDutyEGP": "EMPTY"
  }
} }
```

Merge order: bank policy → catalog defaults (catalog wins). `origin` is per leaf path and drives the "inherited / edited" markers (FR-010). Response only — nothing is created, and matching never calls this (FR-021b).

Errors: `PREFILL_TARGET_INVALID`, `NOT_FOUND`.

---

## Bank program create / update / duplicate

### `POST /admin/bank-programs` · `PATCH /admin/bank-programs/:id`

Unchanged routes. Body changes:

- `eligibility` **loses** the pruned keys (see [research.md#r4](../research.md)) — sending one now fails `forbidNonWhitelisted` with `VALIDATION_FAILED`.
- `eligibility.dbrBands` optional, validated per R1.
- `performanceCriteria` removed from the payload entirely.
- Essentials/Advanced is a UI grouping only; no Advanced field is required (FR-012).

Errors added: `DBR_BANDS_INVALID`, `DBR_BAND_CAP_OUT_OF_RANGE`, `PROGRAM_RANGE_INVALID`.

### `POST /admin/bank-programs/:id/duplicate`

Roles: `super_admin`. Body: `{ "programCode": "ABK-PL-DOC-2", "friendlyName": "…", "friendlyNameAr": "…" }`.
Returns the new `DRAFT` program with every other value copied (FR-013).
Errors: `PROGRAM_CODE_ALREADY_IN_USE`, `NOT_FOUND`.

---

## Numeric simulator

### `POST /admin/matching/simulate`

Roles: `super_admin`, `sales_manager`, `analyst`. Existing route, **extended** body — answers stay, applicant figures are added so the response can carry numbers (FR-034).

```jsonc
{ "category": "personal",
  "answers": [ { "questionCode": "employment_status", "optionCode": "salaried" },
               { "questionCode": "monthly_income", "numericValue": "20400" } ],
  "applicant": { "age": 34, "requestedAmountEGP": "300000", "preferredTenorMonths": 60,
                 "monthlyNetSalaryEGP": "20400", "existingMonthlyObligationsEGP": "2000",
                 "currency": "EGP" } }
```

```jsonc
{ "success": true, "data": { "category": "personal", "matches": [ {
  "programCode": "ABK-PL-PAYROLL", "bankName": "ABK Egypt", "programFriendlyName": "Payroll Loan",
  "approvalProbability": 78, "approvalTier": "good", "usedDefaultWeights": false,
  "figures": {
    "recognisedIncomeEGP": "17340.00", "dbrCapPercent": "40.0000", "dbrBandIndex": 2,
    "offeredAmountEGP": "285000.00", "cashToCustomerEGP": "280725.00", "totalFeesEGP": "4275.00",
    "monthlyInstallmentEGP": "6931.42", "effectiveTenorMonths": 60,
    "effectiveRatePercent": "24.0000", "totalPayableEGP": "415885.20",
    "totalCostOfCreditEGP": "135160.20", "dbrPercent": "39.87",
    "bindingConstraint": "dbr_affordability"
  },
  "figuresUnavailableReason": null,
  "misconfigured": null
} ] } }
```

Persists nothing (FR-035). A program that cannot produce figures returns `figures: null` plus either `figuresUnavailableReason` (a reason code) or `misconfigured: { missing: ["pricing.currentEffectiveRatePercent"] }` (FR-036).

Errors: `PROGRAM_MISCONFIGURED` only when the caller asked for a single program explicitly; in list mode misconfiguration is reported per row, not as a request failure.

---

## Questionnaire builder (type-aware)

### `POST /admin/questionnaire/questions` · `PATCH /admin/questionnaire/questions/:id`

Body gains, all optional and type-checked against `type`:

```jsonc
{ "groupId": "grp_…", "type": "NUMERIC", "questionAr": "…", "questionEn": "…",
  "displayOrder": 3, "isRequired": true,
  "numeric": { "minValue": "1000", "maxValue": "20000000", "step": "1000",
               "unitAr": "جنيه", "unitEn": "EGP" },
  "text": null }
```

No binding field is accepted — the money bindings are code constants (A33; see [questionnaire.md](./questionnaire.md)).

Errors: `QUESTION_TYPE_RULES_INVALID`, `QUESTION_GROUP_NOT_FOUND`.

### `POST /admin/questionnaire/versions/publish`

Response gains `warnings[]` (publish still succeeds):

```jsonc
{ "success": true, "data": { "versionNumber": 7, "warnings": [
  { "code": "MONEY_FIELD_BINDING_MISSING", "meta": { "binding": "existing_obligations" } } ] } }
```

### `GET /admin/scoring/questions`

Returns **single-choice questions only** — multi-choice, text and number are not scoreable (R9). A weight set naming one is rejected with `QUESTION_TYPE_NOT_SCOREABLE`.
