# Contract — Admin Bank Programs (surrogate rule, check, activation gate, waiting list)

Base: `/api/admin/bank-programs` · Admin JWT (existing guard) · envelope `{ success, data }` ·
OpenAPI at `/api/docs`. All money is a Decimal STRING; no floats cross the wire (Principle I).

---

## 1. `POST /` and `PUT /:programCode` — the rule rides on the program body

`incomeAssumption` gains the canonical shape; `valueSources` is a new sibling of the config blobs.

```jsonc
{
  "programType": "income_surrogate",
  "productCategory": "personal",
  "incomeAssumption": {
    "strategy": "byMilitaryGrade",
    "keyTable": [
      { "key": "officer",        "incomeEGP": "15000" },
      { "key": "senior_officer", "incomeEGP": "25000" },
      { "key": "general",        "incomeEGP": "40000" }
    ],
    "dbrCapPercentOverride": "45",
    "requiredDocuments": ["military_id"],
    "combinationRule": "greater_of"
  },
  "valueSources": {
    "incomeAssumption.keyTable.general.incomeEGP": "team_estimated"
  },
  "version": 7
}
```

Range method instead of a key table:

```jsonc
"incomeAssumption": {
  "strategy": "byYearsInPractice",
  "bands": [
    { "fromInclusive": "0",  "toExclusive": "5",  "incomeEGP": "12000" },
    { "fromInclusive": "5",  "toExclusive": "8",  "incomeEGP": "30000" },
    { "fromInclusive": "8",  "toExclusive": null, "incomeEGP": "45000" }
  ]
}
```

### Rejections (422 unless stated)

| Code | Meta | Requirement |
|---|---|---|
| `INCOME_RULE_EMPTY` | `{ strategy }` | FR-009 — method selected, table empty |
| `INCOME_RULE_INCOME_INVALID` | `{ index \| key, incomeEGP }` | FR-010 — income ≤ 0 or unparseable |
| `INCOME_RULE_DUPLICATE_KEY` | `{ key }` | FR-006 |
| `INCOME_RULE_UNKNOWN_KEY` | `{ key, registry }` | FR-006 / AS-1.9 — not an active registry member |
| `INCOME_RULE_BANDS_INVALID` | `{ index, reason: 'unordered' \| 'gap' \| 'overlap' \| 'open_band_not_last' \| 'edge_not_decimal' }` | FR-008 — names the offending band. A CLOSED last band is legal (it means the rule yields nothing above that edge); only an OPEN band with rows after it is rejected, because those rows are unreachable |
| `INCOME_RULE_DBR_OVERRIDE_INVALID` | `{ value }` | FR-012 |
| `VALUE_SOURCE_PATH_UNKNOWN` | `{ path }` | R8 — path on neither the incoming nor the stored program's numeric allow-list. A path that WAS markable and no longer is (row deleted, method switched) is stale, not unknown: it is pruned with the number it described |
| `VALUE_SOURCE_VALUE_INVALID` | `{ path, value }` | R8 — the path is markable but the value is not `team_estimated` |

### Server-side normalisation (not errors)

- Configuration belonging to a method other than `strategy` is **stripped** before persistence
  (FR-011) — the admin is warned client-side before the switch clears it.
- On a non-personal or non-`income_surrogate` program, any rule configuration is **kept as stored,
  ignored by matching, and reported in `data.warnings`** (FR-001, edge case). It is NEVER deleted:
  three seeded programs carry a table while typed `income_proof`, and a strip would destroy them on
  the first unrelated save. The warning names the program's type so the fix is visible (re-type the
  program, or clear the rule deliberately).
- Absent `dbrCapPercentOverride` ⇒ the program's own DBR resolution applies, and the applied value
  is echoed wherever a figure is shown (FR-012).

### Side effect — estimate on a live program (FR-035)

If the request introduces a `team_estimated` entry while the stored row has `active = true`, the
program is saved with `active = false` **in the same transaction**, and an `AuditEvent`
(`bank_program.deactivated_by_estimate`, editor id, paths) is written. The response carries
`data.deactivatedByEstimate: true` so the UI can say why.

---

## 2. `POST /:programCode/income-rule/check` — the in-place check panel

FR-026 – FR-031. Persists nothing: no application, no lead, no offer.

**Request** — the ON-SCREEN draft, not the stored rule:

```jsonc
{
  "incomeAssumption": { "strategy": "byMilitaryGrade", "keyTable": [ ... ] },
  "sample": {
    "age": 34,
    "militaryGrade": "senior_officer",
    "declaredMonthlySalaryEGP": "0",
    "existingMonthlyObligationsEGP": "3000",
    "requestedAmountEGP": "500000",
    "tenorMonths": 60
  }
}
```

**200** — resolved:

```jsonc
{
  "success": true,
  "data": {
    "resolvedIncomeEGP": "25000.00",
    "origin": "surrogate",
    "dbrCapPercent": "45.0000",
    "dbrCapSource": "rule_override",
    "affordableInstallmentEGP": "8250.00",
    "estimatedLoanAmountEGP": "412000.00",
    "qualifies": true,
    "matchedRow": { "key": "senior_officer" }
    // `qualifies` = the affordable installment covers the installment the requested
    // amount implies at this program's rate and term. No eligibility rule is
    // consulted (FR-027, A33). Always false when the income is unresolved.
  }
}
```

**200** — nothing matched (FR-031: a stated reason, never a zero income):

```jsonc
{
  "success": true,
  "data": {
    "resolvedIncomeEGP": null,
    "origin": "none",
    "unresolvedReason": "no_matching_row",
    "dbrCapPercent": "45.0000",
    "dbrCapSource": "rule_override",
    "affordableInstallmentEGP": null,
    "estimatedLoanAmountEGP": null,
    "qualifies": false,
    "unavailableReason": "SURROGATE_NO_MATCHING_ROW"
  }
}
```

Validation errors are the same codes as §1 — the panel checks a real rule, so an unsaved rule that
could not be saved does not silently "work" here.

**Parity guarantee (FR-030 / SC-007)**: the handler overlays the draft on the stored
`BankProgramSnapshot` and calls the same `quoteProgram` that `POST /api/admin/matching/simulate`
calls. Verified by `test/unit/rule-check-simulator-parity.spec.ts` over the sample matrix.

---

## 3. `POST /:programCode/toggle` — activation gate

Body unchanged (`{ active, version }`).

**409 when going live with estimates** (FR-033 — every path, not the first):

```jsonc
{
  "success": false,
  "code": "PROGRAM_HAS_ESTIMATED_VALUES",
  "meta": {
    "paths": [
      "incomeAssumption.keyTable.general.incomeEGP",
      "pricing.baseRatePercent"
    ]
  }
}
```

`active: false` is never blocked. Saving is never blocked (FR-034).

---

## 4. ~~`GET /pending-bank-confirmation`~~ — REMOVED

FR-036 (the waiting-list screen) and its endpoint were **cut after review**. The endpoint, the
`PendingBankConfirmationRowDto`, the `waitingSince` audit replay and the admin screen are gone; the
`bank_program.value_sources` column, the marker UI and the activation refusal below all stay.

Why: the queue had no workflow attached to it — no assignee, no due date, no reminder, no outbound
mail — so the chasing it was meant to drive happened in email regardless, while the machinery behind
its one derived number (`waitingSince`, reconstructed from add/remove/re-add audit history) was the
most expensive and most defect-prone part of the feature. The property with actual teeth is
§3: a program carrying an unconfirmed number cannot go live. That is retained in full.

`BANK_PROGRAM_VALUE_SOURCE_CHANGED` is still emitted (FR-038) as append-only history, but nothing
reads it at request time. FR-037 still holds and now means only that a pre-existing program carries
`valueSources = {}`, reads as fully bank-stated, and stays live on deploy.

---

## 5. New error codes (Principle III — same PR, all three surfaces)

| Code | HTTP | ar-EG + en-US in `admin/src/i18n/error-codes.*.json` | Flutter ARB |
|---|---|---|---|
| `INCOME_RULE_EMPTY` | 422 | yes | no (admin-only) |
| `INCOME_RULE_INCOME_INVALID` | 422 | yes | no |
| `INCOME_RULE_DUPLICATE_KEY` | 422 | yes | no |
| `INCOME_RULE_UNKNOWN_KEY` | 422 | yes | no |
| `INCOME_RULE_BANDS_INVALID` | 422 | yes | no |
| `INCOME_RULE_DBR_OVERRIDE_INVALID` | 422 | yes | no |
| `VALUE_SOURCE_PATH_UNKNOWN` | 422 | yes | no |
| `VALUE_SOURCE_VALUE_INVALID` | 422 | yes | no |
| `PROGRAM_HAS_ESTIMATED_VALUES` | 409 | yes | no |
| `SURROGATE_FACT_BINDING_MISSING` | 422 (warning payload) | yes | no |
| `SURROGATE_FACT_MISSING` | 200 (unavailable reason) | yes | **yes** |
| `SURROGATE_NO_MATCHING_ROW` | 200 (unavailable reason) | yes | **yes** |
