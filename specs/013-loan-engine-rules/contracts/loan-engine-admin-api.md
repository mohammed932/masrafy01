# Contract — Loan Engine admin API

- Base: `/api/admin/loan-engine`.
- Admin JWT. The envelope is `{ success, data }` / `{ success: false, code, meta? }` (Principle XIV).
- DTOs use `class-validator` with `whitelist` + `forbidNonWhitelisted`.
- Who can call what:

| Role | Access |
|---|---|
| `super_admin` | read + write |
| `sales_manager` | read only |

## GET `/questions?category=&search=`
- **Returns:** `LoanEngineQuestionSummary[]`, every active question in the pool. Unlinked ones come back with `factKey: null`.
- **Errors:** an unknown `category` → 422 `VALIDATION_FAILED`. It never falls back to every category.

## GET `/questions/:questionCode`
- **Returns:** `LoanEngineQuestionDetail` (data-model §4).
- **Which programs are listed:** every active program in the question's loan types, including ones that don't read it yet, so the operator can start one.
- **Errors:** 404 `QUESTION_NOT_FOUND`.

## PUT `/questions/:questionCode/programs/:programCode/effects/:effect`

```json
{
  "expectedVersion": 7,
  "rows": [
    { "criterion": { "op": "between", "a": "1", "b": "100" }, "value": "22" },
    { "criterion": { "op": "gt", "a": "100" }, "value": "19" }
  ],
  "onNoMatch": "useFallback"
}
```

- **`effect`:** one of `rate | cap | financed_share | min_amount | min_term | max_term | extra_income`.
- **`onNoMatch`:**

| Effect | Allowed values |
|---|---|
| `cap` | `useProgramMax` / `reject` |
| `extra_income` | absent |
| everything else | `useFallback` / `reject` |

- **`value`:** a Decimal string. Its unit depends on the effect:

| Effect | Unit |
|---|---|
| `rate` | % |
| `financed_share` | % |
| `extra_income` | % (percent counted) |
| `cap` | EGP |
| `min_amount` | EGP |
| `min_term` / `max_term` | months |

- **`200`:** `{ program: <updated program slice for this question>, changed: boolean }`.
- **Errors:**

| Status | Code | When |
|---|---|---|
| 404 | `QUESTION_NOT_FOUND` / `BANK_PROGRAM_NOT_FOUND` | unknown question or program |
| 409 | `CONFLICT_STALE_DATA` | `expectedVersion` differs |
| 422 | `LOAN_ENGINE_RULE_INVALID` | meta `{programCode, effect, row?, problem}`; `problem: 'not_linked'` when the question has no figure yet (link it first via 012's `PUT /api/admin/bank-programs/question-facts/:questionCode`) |
| 422 | `SURROGATE_FACT_SHAPE_MISMATCH` | the 012 A2 check on option keys |

- **Audit:** `BANK_PROGRAM_UPDATED`, `changes.{path}` before/after (figures only, no PII).

## PUT `/programs/:programCode/conditions`

```json
{
  "expectedVersion": 7,
  "conditions": [
    {
      "id": "min_business_age",
      "reasonCode": "BUSINESS_TOO_NEW",
      "anyOf": [
        { "questionCode": "business_months", "criterion": { "option": "over_24" } },
        { "questionCode": "has_guarantor",  "criterion": { "option": "yes" } }
      ]
    }
  ]
}
```

- This replaces the program's whole list.
- `questionCode` is resolved server-side to its bound `factKey`. The client never sends fact keys.
- **Errors:** as for the effect write, plus:
  - `problem: 'engine_input'` when a criterion reads an engine input;
  - `VALIDATION_FAILED` for an unknown `reasonCode`, or a duplicate `id`.
- **Side effect:** the served questionnaire for names under this program now requires the read questions. This is a live projection, so no questionnaire publish is needed.

## POST `/api/admin/matching/simulate` (existing, widened)
- **New optional field:** `programOverrides: [{ programCode, effect | 'conditions', questionCode, body }]`, where `body` is the PUT body above.
- Overrides are validated exactly as the PUT and applied in memory only. Nothing is persisted.
- **Response:** unchanged. Per-program figures, or `unavailable` with `reason` / `gateId` / `gateReasonCode`.

## Customer API
**No change.** A failed condition reaches the app as the existing `PRODUCT_RULE_GATE_FAILED` + `gateReasonCode`, which `figures_unavailable_reason.dart` already renders. No ARB change.
