# Phase 1 — Data Model: Income-Surrogate Rule Builder

Two additive migrations. Everything else is JSONB shape on columns that already exist.

---

## 1. Surrogate Rule — `bank_program.incomeAssumption` (JSONB, existing column)

One self-describing object per program (FR-014). Canonical shape written on every save; legacy
shapes upgraded on read by `normalizeIncomeAssumption()` (research R1).

```ts
type IncomeAssumptionStrategy =
  | 'declared'
  | 'byYearsInJob' | 'byYearsInPractice'          // range methods (years)
  | 'byCDValue'    | 'byTotalDeposits'            // range methods (EGP value)
  | 'byProfessorRank' | 'byMilitaryGrade'         // key methods
  | 'byCarInstallment' | 'byCarLoanAmount'
  | 'byCreditCardLimit' | 'byBankStatementPercent'; // scalar methods

interface IncomeAssumptionConfig {
  strategy: IncomeAssumptionStrategy;

  /** Key methods only. Order = registry display order. */
  keyTable?: Array<{ key: string; incomeEGP: string }>;

  /** Range methods only. Half-open [fromInclusive, toExclusive); last band toExclusive = null. */
  bands?: Array<{ fromInclusive: string; toExclusive: string | null; incomeEGP: string }>;

  /** Scalar methods only. `unit` documents the arithmetic the resolver applies. */
  scalar?: { value: string; unit: 'percent' | 'multiplier' };

  /** FR-012 — DBR % used when the recognised income CAME FROM this rule. */
  dbrCapPercentOverride?: string;

  /** FR-013 — `required_document` registry keys this method demands. Warning only. */
  requiredDocuments?: string[];

  /** How a surrogate figure combines with a declared salary. Absent = replace. */
  combinationRule?: 'greater_of' | 'lesser_of';
}
```

### Field rules (enforced in `validation/income-rule.validator.ts`, service layer)

| Rule | Applies to | Error code |
|---|---|---|
| Strategy in the known set | all | `VALIDATION_FAILED` (DTO `@IsIn`) |
| Selected method's configuration present and non-empty | key + range | `INCOME_RULE_EMPTY` (FR-009) |
| Every `incomeEGP` > 0, Decimal-parseable | key + range | `INCOME_RULE_INCOME_INVALID` (FR-010) |
| Keys unique within the table | key | `INCOME_RULE_DUPLICATE_KEY` (FR-006) |
| Keys are ACTIVE members of the method's registry type | key | `INCOME_RULE_UNKNOWN_KEY` (FR-006, AS-1.9) |
| Bands ordered, gapless, last `toExclusive === null`, Decimal edges | range | `INCOME_RULE_BANDS_INVALID` (FR-008) |
| No configuration belonging to another method is persisted | all | stripped on save (FR-011) — the admin was warned before the switch cleared it |
| Rule present only when `programType = income_surrogate` AND `productCategory = personal` | all | **ignored by matching and reported — NEVER deleted** (FR-001, edge case) |
| `dbrCapPercentOverride` in (0, 100] when present | all | `INCOME_RULE_DBR_OVERRIDE_INVALID` |

`declared` carries no configuration. Scalar methods keep their current single value — FR-015 means
an existing `carInstallmentMultiplier: '4'` reads back identically through the normalizer.

**Why "ignored, never deleted"**: three seeded programs carry a table while typed `income_proof`
(`abk-egypt-2026.ts:77-122` against `catalogs/base.ts:18`). A strip-on-save rule would have destroyed
those tables the first time an admin pressed Save on an unrelated field, and the correct fix for a
mis-typed program is to change its type, not to lose its configuration. The rule is therefore read
past and reported, and the mis-typed seeds are re-typed by this feature.

### Method → shape → fact

| Strategy | Shape | Fact read (`ApplicantProfile` path) | Registry |
|---|---|---|---|
| `byMilitaryGrade` | `keyTable` | `employment.militaryGrade` | `military_grade` |
| `byProfessorRank` | `keyTable` | `employment.professorRank` | `professor_rank` |
| `byYearsInJob` | `bands` (years) | `employment.monthsInJob ÷ 12` | — |
| `byYearsInPractice` | `bands` (years) | `employment.yearsInPractice` | — |
| `byCDValue` | `bands` (EGP) | `assets.cdAtABKValueEGP` | — |
| `byTotalDeposits` | `bands` (EGP) | `assets.totalDepositsAtABKValueEGP` | — |
| `byCarInstallment` | `scalar` multiplier | `assets.carInstallmentEGP` | — |
| `byCarLoanAmount` | `scalar` percent | `assets.autoLoanAtOtherBankEGP ?? autoLoanAtABKEGP` | — |
| `byCreditCardLimit` | `scalar` multiplier | `assets.creditCardLimitEGP` | — |
| `byBankStatementPercent` | `scalar` percent | `assets.bankStatementBalanceEGP` | — |

`byCDValue` and `byTotalDeposits` move from the legacy percent-of-value arithmetic to bands ONLY
where an admin configures bands; a legacy row keeps its `scalar` percent and its exact current
output (FR-015). Both shapes are legal for these two strategies and the resolver branches on which
is present.

---

## 2. Rule Resolution — engine return value (no storage)

```ts
interface IncomeResolution {
  incomeEGP: Decimal;                    // 0 when unresolved — callers must check `origin`
  origin: 'declared' | 'surrogate' | 'declared_over_surrogate' | 'surrogate_over_declared' | 'none';
  strategy: IncomeAssumptionStrategy;
  /** Set only when origin = 'none'. Never a substituted default (FR-020). */
  unresolvedReason?: 'fact_not_answered' | 'no_matching_row' | 'no_matching_band' | 'rule_unconfigured';
  /** The DBR cap actually applied, and where it came from (FR-012, FR-027). */
  dbrCapPercent: Decimal;
  dbrCapSource: 'program_default' | 'rule_override';
}
```

Replaces the bare `Decimal` returned by `resolveAssumedIncome` today. Arithmetic per strategy is
unchanged (research R5).

**The declared baseline is RAW.** `applyCompanyTypeAdjustment` (the
`eligibility.commercialBankIncomePercent` haircut, configured at `80.0000` /`90.0000` on real
programs) is NOT applied in the quote path. `quote.ts:129-137` deliberately excludes it, and every
business-category plus doctor / professional / pharmacy seed is `income_surrogate` with
`strategy: 'declared'` — inheriting the haircut would move their live figures for a reason unrelated
to this feature (research R4, SC-009).

---

## 3. Value Source Marker — `bank_program.valueSources` (NEW JSONB column)

```prisma
model BankProgram {
  // …
  /// Sparse map of config dot-path → 'team_estimated'. An ABSENT path is
  /// bank-stated, which is why every pre-existing program stays live on deploy
  /// (FR-037). Read on activation: a non-empty map blocks going live (FR-033).
  valueSources Json @default("{}")
}
```

```ts
type ValueSourceMap = Record<string, 'team_estimated'>;
```

| Property | Value |
|---|---|
| Key | Dot-path into the program's own config, e.g. `incomeAssumption.keyTable.general.incomeEGP`, `pricing.baseRatePercent`, `fees.adminFeePercent` |
| Allowed paths | Validated against a code-owned allow-list that is **exhaustive over the program's numeric fields** — the rule's incomes and band edges, `pricing.*`, `fees.*`, `loanLimits.*`, `tenor.*`, `eligibility.*` thresholds, `performanceCriteria.*`, `derivation.*`. Derived from the DTO shape rather than hand-picked, because a number outside the list cannot be marked and therefore can never block going live (FR-032). An unknown path is rejected (`VALUE_SOURCE_PATH_UNKNOWN`) so a stale path can never silently block activation forever |
| Absent path | Bank-stated (the two-state marker of FR-032; only the non-default state is stored) |
| Migration | `bank_program_value_sources` — add column, default `{}`, no backfill |

### State transitions

| From | Action | To | Side effect |
|---|---|---|---|
| any | save with markers, `active = false` | saved | none — estimates never block saving (FR-034) |
| `active = false`, map non-empty | toggle on | REFUSED | `PROGRAM_HAS_ESTIMATED_VALUES`, `meta.paths` = every path (FR-033) |
| `active = true`, map empty | save adding a marker | `active = false` | same transaction; `AuditEvent` `bank_program.deactivated_by_estimate` with editor + paths (FR-035, FR-038) |
| `active = false`, map non-empty | remove last marker, toggle on | `active = true` | allowed |
| any | marker added or removed | — | `AuditEvent` `bank_program.value_source_changed` (FR-038) |

`waitingSince` on the list endpoint = the timestamp of the oldest still-standing marker, read from
those audit events (FR-036). No new column. **Fallback**: a marker that arrived without an audit
event (import, backfill, direct seed) has no timestamp — the endpoint then reports the program's
`updatedAt` and flags `waitingSinceEstimated: true`, rather than emitting `null` and letting the UI
read "0 days".

---

## 4. Offer Provenance — `bank_offer` (NEW columns)

```prisma
model BankOffer {
  // …
  /// Which income the quote actually ran on. Frozen at match time: editing the
  /// program's rule later must not rewrite an immutable offer (Principle I / A6),
  /// the same reason `approvalUsedDefault` is persisted rather than derived.
  incomeOrigin            String? @db.VarChar(32)
  /// The surrogate method that produced it, when one did.
  incomeSurrogateStrategy String? @db.VarChar(32)
}
```

Migration `bank_offer_income_origin` — two nullable columns, no backfill, no index (always read
with the row).

---

## 5. Surrogate Fact Bindings — code constant (no storage)

`backend/src/matching/pipeline/surrogate-fact-bindings.ts`, sibling of `money-field-bindings.ts`.

```ts
export const SURROGATE_FACT_BINDINGS = {
  military_grade:    'military_grade',
  academic_rank:     'academic_rank',
  years_in_practice: 'years_in_practice',
  credit_card_limit: 'credit_card_total_limit',   // pre-existing question, reused
} as const;

export const SURROGATE_FACT_SPECS = Object.freeze({
  military_grade:    { questionCode: 'military_grade',    type: 'SINGLE_SELECT', registry: 'military_grade',  path: 'employment.militaryGrade' },
  academic_rank:     { questionCode: 'academic_rank',     type: 'SINGLE_SELECT', registry: 'professor_rank',  path: 'employment.professorRank' },
  years_in_practice: { questionCode: 'years_in_practice', type: 'NUMERIC',       registry: null,             path: 'employment.yearsInPractice' },
  credit_card_limit: { questionCode: 'credit_card_total_limit', type: 'NUMERIC', registry: null,             path: 'assets.creditCardLimitEGP' },
});
```

**Publish-time validation** (warnings, never a hard block — mirrors `MONEY_FIELD_BINDING_MISSING`):

| Condition | Warning meta |
|---|---|
| Bound code missing or inactive in the pool | `{ fact, questionCode, reason: 'missing_or_inactive' }` |
| Bound question is the wrong type | `{ fact, questionCode, reason: 'wrong_type', type }` |
| SINGLE_SELECT option codes ⊄ active registry members | `{ fact, questionCode, reason: 'option_codes_drifted', unknown: [...] }` |
| A saved `keyTable` references a key no longer in the registry | `{ programCode, key, reason: 'dead_registry_key' }` (FR-021, edge case) |

---

## 6. Questionnaire additions (seed data, no schema change)

Three new questions in the ONE global pool, assigned to `personal` via `question_loan_category`
(A33: assignment lives only there).

**Codes come from the English label** — `slug.util.ts:6-15` slugifies it, and A33 forbids hand-typing
codes. The labels below are therefore chosen so that the generated slug IS the binding constant. A
label of "Your military grade" would produce `your_military_grade` and the fact would never bind.

| Code (= slug of label) | English label | Type | Options / bounds | Category |
|---|---|---|---|---|
| `military_grade` | "Military grade" | SINGLE_SELECT | option codes = active `military_grade` registry keys | `personal` |
| `academic_rank` | "Academic rank" | SINGLE_SELECT | option codes = active `professor_rank` registry keys | `personal` |
| `years_in_practice` | "Years in practice" | NUMERIC | 0–60, integer, unit `years` | `personal` |

`credit_card_total_limit` already exists and is not re-seeded. It is itself branched behind
`current_loans` including `credit_cards`, so a card holder who declared no card debt is never asked
(research R2 — accepted).

**Branching.** `enabledWhen` holds ONE `optionCode` plus an operator
(`{ questionCode, operator: 'equals' | 'not_equals', optionCode }`) — not a list — and
`EMPLOYMENT_OPTIONS` has no option separating a soldier from a professor. So:

| Question | Gate | Required |
|---|---|---|
| `military_grade` | `employment_status equals government_employee` | no |
| `academic_rank` | `employment_status equals government_employee` | no |
| `years_in_practice` | ungated (its population spans `freelancer` + `business_owner_company_owner`) | no |

A government employee is asked both selects and skips the one that does not apply. An applicant who
is not asked, or who skips, is `SURROGATE_FACT_MISSING` — identical outcomes, never a default
(FR-020, AS-2.4/2.5). Splitting the employment options is deliberately deferred (research R11).

---

## 7. Rule Check — request/response only, persists nothing (FR-029)

```ts
interface IncomeRuleCheckRequest {
  incomeAssumption: IncomeAssumptionConfig;   // the ON-SCREEN draft (FR-028)
  sample: {
    age: number;                              // admin-side sample age — A31 permits it here
    militaryGrade?: string; professorRank?: string;
    yearsInPractice?: number; monthsInJob?: number;
    creditCardLimitEGP?: string; cdValueEGP?: string;
    totalDepositsEGP?: string; bankStatementBalanceEGP?: string;
    carInstallmentEGP?: string; carLoanAmountEGP?: string;
    declaredMonthlySalaryEGP?: string;
    existingMonthlyObligationsEGP: string;
    requestedAmountEGP: string; tenorMonths: number;
  };
}

interface IncomeRuleCheckResponse {
  resolvedIncomeEGP: string | null;           // null ⇒ read `unresolvedReason` (FR-031)
  origin: IncomeResolution['origin'];
  unresolvedReason?: IncomeResolution['unresolvedReason'];
  dbrCapPercent: string;
  dbrCapSource: 'program_default' | 'rule_override';
  affordableInstallmentEGP: string | null;
  estimatedLoanAmountEGP: string | null;
  /**
   * TRUE when `affordableInstallmentEGP` covers the installment the sample's
   * requested amount implies at the program's own rate and term. Derived from
   * the quote's own figures ONLY — no eligibility rule (minimum income, age,
   * employment type) is consulted, because eligibility gating stays out of
   * matching and the check panel must not become the one place it returns
   * (FR-027, A33). Always FALSE when the income is unresolved.
   */
  qualifies: boolean;
  unavailableReason?: FiguresUnavailableReason;
  matchedRow?: { key: string } | { fromInclusive: string; toExclusive: string | null };
}
```

Produced by overlaying the draft on the saved snapshot and calling the same `quoteProgram` the
simulator calls (research R7), which is what makes FR-030 / SC-007 structural.

---

## Entity relationships

```text
Bank ──< BankProgram ──┬── incomeAssumption (JSONB)  ← the Surrogate Rule (§1)
                       ├── valueSources     (JSONB)  ← Value Source Markers (§3)
                       └── scoringWeightSets          (untouched by this feature)

QuestionnaireVersion ──< snapshot.groups[].questions[]
        ▲ bound by CODE ONLY (§5) — never by a column (A33)
        │
Application ──< BankOffer ── incomeOrigin, incomeSurrogateStrategy (§4, frozen)
```
