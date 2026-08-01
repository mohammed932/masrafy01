# Contract — New Typed Error Codes

Principle III: adding a code is a **same-PR** change across four files.

1. `backend/src/common/errors/error-codes.ts` (code + HTTP status map)
2. `admin/src/i18n/error-codes.ar-EG.json`
3. `admin/src/i18n/error-codes.en-US.json`
4. `masrafy-app/lib/l10n/app_*.arb` (only for codes the app can receive)

No English strings cross the API boundary; clients render from the code.

| Code | HTTP | Raised when | Meta | Surfaces |
|---|---|---|---|---|
| `DBR_BANDS_INVALID` | 422 | band table not ascending, has a gap, has no open-ended final band, duplicate bound, or a cap outside 1–100 | `{ index, reason }` | admin |
| `DBR_BAND_CAP_OUT_OF_RANGE` | 422 | a single cap outside 1–100 (also covers the scalar) | `{ index, capPercent }` | admin |
| `PROGRAM_RANGE_INVALID` | 422 | amount / tenor / age range inverted or empty (FR-014) | `{ field }` | admin |
| `PREFILL_TARGET_INVALID` | 400 | prefill asked for a category the `program_name` member does not serve, or an unknown bank / member | `{ field }` | admin |
| `CATALOG_DEFAULTS_CATEGORY_UNKNOWN` | 422 | defaults contain a category outside the member's `categories` | `{ category }` | admin |
| `ANSWER_TYPE_MISMATCH` | 400 | submitted value shape does not match the question's type | `{ questionCode, expectedType }` | mobile + admin |
| `ANSWER_OUT_OF_RANGE` | 400 | number answer outside `[min,max]` or off `step` | `{ questionCode, min, max, step }` | mobile + admin |
| `ANSWER_TOO_LONG` | 400 | text answer over `textMaxLength` | `{ questionCode, maxLength }` | mobile |
| `ANSWER_REQUIRED` | 400 | required question unanswered, any type (FR-043) | `{ questionCode }` | mobile |
| `QUESTION_TYPE_RULES_INVALID` | 422 | choice type with <2 options, NUMERIC/TEXT with options, max < min, step ≤ 0, or bounds on the wrong type | `{ field }` | admin |
| `QUESTION_TYPE_NOT_SCOREABLE` | 422 | a weight set references a MULTI_SELECT / TEXT / NUMERIC question (R9) | `{ questionCode, type }` | admin |
| `MONEY_FIELD_BINDING_MISSING` | 422 | publish-time warning: a code-declared money binding resolves to no active NUMERIC question (FR-048/FR-049) | `{ binding, questionCode }` | admin |
| `MONEY_FIGURE_MISSING` | 422 | a quote was requested but a bound number answer is absent — never substituted with a default (FR-044) | `{ binding }` | mobile + admin |
| `CALCULATOR_INPUT_INVALID` | 400 | calculator amount/tenor/income/obligations missing, non-decimal, or negative | `{ field }` | mobile |
| `CALCULATOR_PROGRAM_INACTIVE` | 409 | program-scoped quote requested for a non-ACTIVE program | `{ programCode }` | mobile |
| `PROGRAM_MISCONFIGURED` | 422 | simulate/quote cannot produce figures: no rate, empty amount limits, or empty tenor range (FR-036) | `{ programCode, missing }` | admin |

## Reason codes (not errors)

Returned inside a 200 response when a program is listed without figures (FR-024). Rendered as plain text by the client, same i18n files.

| Reason | Meaning |
|---|---|
| `NO_RECOGNISED_INCOME` | recognised income is zero or unknown |
| `OBLIGATIONS_EXCEED_ALLOWANCE` | existing payments already consume the DBR allowance |
| `BELOW_PROGRAM_MIN_AMOUNT` | affordable amount is under the program's minimum |
| `AGE_AT_MATURITY` | no permitted tenor keeps the applicant inside the age limit |
| `CURRENCY_NOT_OFFERED` | program does not list the requested currency |
| `PROGRAM_MISCONFIGURED` | program cannot produce a figure (admin-visible detail) |

## `bindingConstraint` values

Not errors — they explain a reduced figure (FR-023): `requested_amount`, `program_max`, `dbr_affordability`, `tenor_max`, `age_at_maturity`.
