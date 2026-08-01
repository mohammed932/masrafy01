# Contract — Typed Questions & Typed Answers

The rules every surface must agree on. Backend is the authority; admin and app validate the same way for immediate feedback but never as the only check.

## Types

| Type | Options | Answer key | Extra rules | Scoreable |
|---|---|---|---|---|
| `SINGLE_SELECT` | ≥2 active | `optionCode` (string) | — | **Yes** |
| `MULTI_SELECT` | ≥2 active | `optionCodes` (string[], ≥1) | every code must belong to the question | No |
| `TEXT` | none | `textValue` (string) | `1 ≤ length ≤ textMaxLength` (default 500, max 2000) | No |
| `NUMERIC` | none | `numericValue` (decimal string) | `minValue ≤ v ≤ maxValue`; `(v − minValue) % step == 0` when `step` set; 2 dp | No |

Only single choice is scoreable — the approval formula needs one picked option score per question, and any aggregate over multiple picks would be a new formula (A33, see [research.md#r9](../research.md)).

## Answer submission shape

```ts
type SubmittedAnswer =
  | { questionCode: string; optionCode: string }
  | { questionCode: string; optionCodes: string[] }
  | { questionCode: string; textValue: string }
  | { questionCode: string; numericValue: string };   // decimal string, never a JS number
```

Exactly one value key. Wrong key for the question's type → `ANSWER_TYPE_MISMATCH`. More than one key → `VALIDATION_FAILED`.

## Money field bindings

Four bindings connect number questions to the engine's economic inputs. They live in **code**, not on `Question` — A33 forbids scoring/eligibility/profile-mapping fields on questions, and v6.0.0 deleted the old `Question.profileField` for exactly this reason.

| Binding (code constant) | Question code | Engine field | Unit | Suggested bounds |
|---|---|---|---|---|
| `requested_amount` | `amount_requested` | `requestedAmountEGP` | EGP | 1 000 … 20 000 000, step 1 000 |
| `tenor_months` | `repayment_period_months` | `preferredTenorMonths` | months | 6 … 120, step 6 |
| `monthly_income` | `monthly_income` | `employment.monthlyNetSalaryEGP` | EGP | 1 000 … 5 000 000 |
| `existing_obligations` | `current_installments` | `obligations.existingMonthlyObligationsEGP` | EGP | 0 … 5 000 000 |

Rules:

- The constant lives once per surface: `backend/src/matching/pipeline/money-field-bindings.ts` and the four app mappers. Renaming a bound question code is a code change (the accepted residual limit in the spec).
- Publishing when a bound code is missing or inactive, or is not `NUMERIC`, emits a **warning** naming the binding (`MONEY_FIELD_BINDING_MISSING`) — publish still succeeds, but quotes for affected applicants return `MONEY_FIGURE_MISSING` rather than a defaulted zero (FR-044).
- `tenor_months` answers are integers; a fractional value fails `ANSWER_OUT_OF_RANGE`.

## Conditional visibility

`enabledWhen` still compares an option code, so a question may only depend on a `SINGLE_SELECT` or `MULTI_SELECT` question (satisfied when any picked code matches). Depending on a text or number question is rejected as `QUESTION_TYPE_RULES_INVALID`.

## Required questions

`isRequired: true` blocks submission when the answer is absent, for every type (FR-043) → `ANSWER_REQUIRED`. A hidden question (its `enabledWhen` is false) is never required.

## Snapshot compatibility

- A published snapshot without `type` reads as `SINGLE_SELECT` (FR-045).
- Stored answers keep `selectedOptionCode` populated for single choice, so the existing scorer and admin answer views are untouched.
- `selectedOptionCodes` is the canonical list for both choice types; single choice writes one element.

## App rendering (existing shared view)

The app's one shared questionnaire view renders per type — one-pick and multi-pick both open the shared tap-to-select bottom sheet (`MasrafySelectField` → `showMasrafySingleSelectSheet` / `showMasrafyMultiSelectSheet`, Principle XXXIII / A36: no dropdowns), text a bounded text field, number a numeric field with the unit shown and the bounds enforced. Unknown future types are skipped, not crashed (existing defensive parse).
