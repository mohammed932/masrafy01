# Phase 1 Data Model — Simple Program Setup, Banded DBR & Loan Calculator

Prisma models are at `backend/prisma/schema.prisma`. Three migrations, in this order.

---

## Migration 1 — `add_bank_policy_and_catalog_defaults`

### `Bank` (existing) — one new column

| Field | Type | Notes |
|---|---|---|
| `policyDefaults` | `Json?` | Optional lending policy; prefill only, never read at match time (FR-021b). Shape below. |

```jsonc
// Bank.policyDefaults — every key optional
{
  "eligibility": {
    "ageMin": 21, "ageMax": 60,
    "minMonthlyIncomeEGP": "5000",
    "dbrCapPercent": "50.0000",
    "dbrBands": [ { "upToIncomeEGP": "5000", "capPercent": "30.0000" },
                  { "upToIncomeEGP": null,   "capPercent": "50.0000" } ]
  },
  "tenor": { "minMonths": 6, "maxMonths": 84 },
  "maxUnsecuredExposureEGP": "3000000"
}
```

Validation: same validators as the program sub-configs, in partial mode; `dbrBands` per R1 rules. Audited via `AuditEvent` with new type `bank_policy_updated`.

### `PlatformEnumeration` (existing) — one new column

| Field | Type | Notes |
|---|---|---|
| `defaults` | `Json` `@default("{}")` | Populated only for `type = 'program_name'`. Keyed by loan category. |

```jsonc
// PlatformEnumeration.defaults for a program_name member
{
  "personal": {
    "tenor": { "minMonths": 6, "maxMonths": 72 },
    "loanLimits": { "perCurrency": { "EGP": { "minAmount": "20000", "maxAmount": "500000" } } },
    "eligibility": { "ageMin": 25, "ageMax": 60, "minMonthlyIncomeEGP": "15000",
                     "dbrCapPercent": "50.0000", "dbrBands": [ … ] },
    "pricing": { "currentEffectiveRatePercent": "24.0000" },
    "fees": { "adminFeePercent": "1.5000", "stampDutyEGP": "50.00" },
    "requiredDocuments": ["SIGNED_APPLICATION", "VALID_NID", "BANK_STATEMENT_6M"]
  }
}
```

Rules: every top-level key MUST be one of the member's `categories`; each sub-object validated by the matching sub-config DTO in partial mode; unknown keys rejected (`whitelist` + `forbidNonWhitelisted`). Audited as `program_catalog_defaults_updated`.

### Seed

`seed-program-catalog-defaults.ts` — idempotent, fills defaults for the archetypes named in FR-004 (payroll, high-end payroll, salaried coded, salaried un-coded, self-employed income proof, doctors, university professors, affluent, elite, secured CD/TD, property, membership surrogate, mobile-bill surrogate, educational, bankers). Values are the FABMISR figures from the source plan §9, marked as starting points, not policy truth.

---

## Migration 2 — `question_types_typed_answers`

### `Question` (existing) — type rules become real

| Field | Type | Notes |
|---|---|---|
| `type` | `QuestionType` | Already exists; all four values now valid end to end. |
| `numericMinValue` | `Decimal?` `@db.Decimal(18,2)` | NUMERIC only. |
| `numericMaxValue` | `Decimal?` `@db.Decimal(18,2)` | NUMERIC only; MUST be ≥ min. |
| `numericStep` | `Decimal?` `@db.Decimal(18,2)` | NUMERIC only; > 0. |
| `numericUnitAr` / `numericUnitEn` | `String?` `@db.VarChar(24)` | Display unit ("جنيه" / "EGP", "شهر" / "months"). |
| `textMaxLength` | `Int?` | TEXT only; 1…2000. |

**No binding field on `Question`.** A33 forbids reintroducing scoring or eligibility fields on `Question`/`QuestionOption`, and v6.0.0 specifically removed `Question.profileField`/`systemRole`. Which answer feeds which economic input is therefore a **code constant**, not a column:

```ts
// backend/src/matching/pipeline/money-field-bindings.ts — mirrored by the app mappers
export const MONEY_FIELD_BINDINGS = {
  requested_amount:     'amount_requested',
  tenor_months:         'repayment_period_months',
  monthly_income:       'monthly_income',
  existing_obligations: 'current_installments',
} as const;
```

Publish-time validation compares these question codes against the snapshot and warns per missing/inactive code (`MONEY_FIELD_BINDING_MISSING`), which is what makes FR-048/FR-049 checkable without a new column.

Constraints (service-layer, typed errors):

- Choice types MUST have ≥2 active options; NUMERIC/TEXT MUST have none.
- NUMERIC/TEXT/MULTI_SELECT MUST NOT appear in any weight set (R9).
- A code named in `MONEY_FIELD_BINDINGS` MUST resolve to an active NUMERIC question at publish time, else a warning naming the binding.
- `enabledWhen` still references an option code, so it may only depend on a choice question.

The numeric/text rule fields are **content** (bounds, unit, length) — no scoring, no eligibility — so A33 stays satisfied.

### `ApplicationAnswer` (existing) — typed values

| Field | Type | Notes |
|---|---|---|
| `selectedOptionCodes` | `String[]` `@default([])` | Canonical for both choice types; single-choice writes one element. |
| `selectedOptionId` / `selectedOptionCode` | unchanged | Still written for single-choice so the scorer and existing readers are untouched. |
| `textValue` | `String?` `@db.VarChar(2000)` | Now used. Never logged (Principle VI). |
| `numericValue` | `Decimal?` `@db.Decimal(18,2)` | Now used. Source of the four money figures. |

`@@unique([applicationId, questionId])` unchanged — one row per question (R8).

Exactly one value shape MUST be present, matching the question's type. Violation → `ANSWER_TYPE_MISMATCH`.

### `QuestionnaireVersion.snapshot` — shape extension

Each question in the frozen snapshot gains `type`, and, when relevant, `numeric: { min, max, step, unitAr, unitEn }` and `text: { maxLength }`. Old snapshots without these keys read as single-choice (FR-045).

### Seed

`seed-questionnaire.ts` adds four NUMERIC questions whose codes are the ones `MONEY_FIELD_BINDINGS` names (R2 table) and deactivates the superseded bucket questions. Existing answers stay readable.

---

## Migration 3 — `prune_unused_eligibility_settings` (DESTRUCTIVE)

Preconditions: operator-captured `pg_dump` of `bank_program`; explicit product-owner go-ahead; release note flagged data-destroying (FR-015c).

Steps:

1. Report `count(*)` of `bank_program` rows holding any pruned key (logged, not silent).
2. `UPDATE bank_program SET eligibility = eligibility - ARRAY[<pruned keys>], performance_criteria = NULL;`
3. Same PR: remove the fields from `EligibilityConfigDto`, `PerformanceCriteriaConfigDto`, `EligibilityConfig` / `PerformanceCriteriaConfig` types, `eligibility-checker.ts`, the admin form + detail page, and the seed catalogs.

Pruned and kept lists: see [research.md#r4](./research.md). `PerformanceCriteriaConfig` disappears entirely; `BankProgram.performanceCriteria` stays as a nullable column for one release, then drops.

---

## New value objects (no table)

### `DbrSetting`

```ts
interface DbrBand { upToIncomeEGP: string | null; capPercent: string }
interface DbrSetting { dbrCapPercent: string; dbrBands?: DbrBand[] }
```

Attachable to `Bank.policyDefaults`, `PlatformEnumeration.defaults[category]`, and `bank_program.eligibility`. Only the last is read by matching.

Validation (one shared validator, three hosts): ≥1 band · bounds strictly ascending · exactly one `null` bound, last · `capPercent` ∈ [1,100] · decimal strings.

### `Quote` (engine output, persisted only inside an offer)

| Field | Type | Meaning |
|---|---|---|
| `offeredAmountEGP` | Decimal | after program max + DBR affordability |
| `cashToCustomerEGP` | Decimal | offered amount − financed fees |
| `totalFeesEGP` | Decimal | admin + insurance + stamp duty (+ collateral) |
| `monthlyInstallmentEGP` | Decimal | computed on offered amount **plus** financed fees (FR-022a) |
| `effectiveTenorMonths` | int | after program cap and age-at-maturity shortening |
| `effectiveRatePercent` | Decimal | after fee/insurance waiver penalties |
| `totalPayableEGP` | Decimal | installment × tenor |
| `totalCostOfCreditEGP` | Decimal | total payable − cash to customer |
| `dbrPercent` | Decimal | (installment + obligations) ÷ recognised income × 100 |
| `dbrCapPercent` | Decimal | resolved cap |
| `dbrBandIndex` | int \| null | which band resolved (null = scalar) |
| `bindingConstraint` | enum | `requested_amount` \| `program_max` \| `dbr_affordability` \| `tenor_max` \| `age_at_maturity` |
| `recognisedIncomeEGP` | Decimal | after the program's income assumption |

`Quote` is a pure return value; the persisted `BankOffer` keeps its current columns plus the DBR band audit fields (FR-021) and stays immutable after creation (Principle I).

### `PrefillDraft`

`{ values: Partial<BankProgramConfigs>, origin: Record<string, 'BANK_POLICY' | 'CATALOG' | 'EMPTY'> }` — response only, never stored (R5).

---

## Entity relationships (unchanged except where noted)

```text
Bank 1──n BankProgram          # + Bank.policyDefaults (prefill only)
PlatformEnumeration(program_name) ··· BankProgram.friendlyName   # + defaults (prefill only, no FK)
QuestionGroup 1──n Question 1──n QuestionOption
Question 1──n ApplicationAnswer n──1 Application
BankProgram 1──n ScoringWeightSet          # single-choice questions only (R9)
Application 1──n BankOffer                 # + DBR band audit fields
```

## State transitions

- **BankProgram**: `DRAFT → ACTIVE → INACTIVE` unchanged. Duplicate (FR-013) creates a `DRAFT` copy with a fresh `programCode`.
- **QuestionnaireVersion**: unchanged publish/rollback; publishing now additionally warns on unrenderable types and missing money bindings (FR-049).
- **ScoringWeightSet**: unchanged (`DRAFT → ACTIVE`, atomic archive+activate, direct admin save).
