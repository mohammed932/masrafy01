# Contract — Matching provenance and no-figure reasons

What changes inside the engine, and what a changed offer looks like on the wire.

---

## 1. Income resolution — `income_surrogate` programs only

Today (`quote.ts:138-142`) any declared salary > 0 wins outright, and the program's stored
`combinationRule` never executes — the questionnaire binds `monthly_income` as a required NUMERIC,
so a submitted application always carries one. After this change:

```text
programType = income_proof       → unchanged. Declared salary, exactly as today. (SC-009)
programType = income_surrogate   → resolveAssumedIncome(profile, rule, eligibility)
                                    ├─ no surrogate figure          → declared salary   (origin: 'declared')
                                    ├─ combinationRule greater_of   → max(surrogate, declared)
                                    ├─ combinationRule lesser_of    → min(surrogate, declared)
                                    └─ absent                       → surrogate replaces declared
```

`resolveAssumedIncome` returns `IncomeResolution` (data-model §2) instead of a bare `Decimal`. The
per-strategy arithmetic is copied unchanged — FR-004 protects the maths from income to installment,
and this changes only which income enters it.

**The declared baseline is the RAW declared salary.** `applyCompanyTypeAdjustment` (the
`eligibility.commercialBankIncomePercent` haircut, `80.0000` / `90.0000` on real programs) is NOT
applied in the quote path, preserving `quote.ts:129-137`'s invariant. This matters because
`income_surrogate` is not a niche type in the seeded data: every business-category program and the
doctor / professional / pharmacy archetypes carry it with `strategy: 'declared'`, so inheriting the
haircut would move their live figures and break SC-009 (research R4).

**The three programs that carry real tables are re-typed by this feature** — `ABK-MILITARY`,
`ABK-PROFESSORS`, `ABK-DOCTORS-PRACTICE` were left at the `income_proof` default, so the branch above
would never have fired for them.

**DBR** (FR-012): when `origin` is surrogate-derived and the rule carries `dbrCapPercentOverride`,
`resolveDbrCap` uses it and reports `dbrCapSource: 'rule_override'`; otherwise the program's own
scalar/band resolution applies unchanged, reported as `program_default`. The applied value is echoed
on the offer, in the check panel, and in the simulator (FR-012, FR-027).

---

## 2. New unavailable reasons

`FiguresUnavailableReason` gains two members, mapped through the existing `reasonToCheckCode`
(`engine.service.ts:277-291`):

| Reason | Raised when | `reasonToCheckCode` |
|---|---|---|
| `SURROGATE_FACT_MISSING` | The rule's fact is absent from the profile — not asked, or skipped (FR-020) | `monthly_income` |
| `SURROGATE_NO_MATCHING_ROW` | The fact was answered but no key matched / the value fell in no band (FR-031, edge case) | `monthly_income` |

The program is still returned and still ranked (FR-022, FR-024) — eligibility gating stays out of
matching (A33). It renders with the reason, never with a zero.

`NO_RECOGNISED_INCOME` keeps its current meaning for every other cause.

---

## 3. Offer payload — two new fields

`GET /api/v1/applications/:id` and the admin offer views gain:

```jsonc
{
  "programCode": "ABK-MILITARY",
  "monthlyInstallmentEGP": "8250.00",
  "incomeOrigin": "surrogate_over_declared",
  "incomeSurrogateStrategy": "byMilitaryGrade",
  "dbrPercent": "44.20",
  "dbrCapPercent": "45.0000"
}
```

| Field | Values |
|---|---|
| `incomeOrigin` | `declared` · `surrogate` · `declared_over_surrogate` · `surrogate_over_declared` · `null` (offers created before this feature) |
| `incomeSurrogateStrategy` | the strategy token, or `null` |

Both are **frozen at creation and never updated**, for the same reason `bankIsFeatured` and
`rateBasis` are frozen on the same row: editing the program's table later must not rewrite what an
immutable offer meant (Principle I, A6). (This clause originally cited `approvalUsedDefault` as its
precedent; that column was removed with approval scoring in v25.0.0 — the rule it illustrated is
unchanged, so the citation moves to two columns that are still there.)

`null` on a historical offer means "recorded before provenance existed", not "declared". Readers
must render the absence, not assume a value.

---

## 4. Preview / simulator parity

| Surface | Income path | Facts source |
|---|---|---|
| `POST /api/v1/matching/preview` | same `quoteProgram` | shared answers→profile mapper |
| `POST /api/admin/matching/simulate` | same `quoteProgram` | shared mapper + admin sample `age` |
| `POST /api/admin/bank-programs/:code/income-rule/check` | same `quoteProgram`, draft rule overlaid | admin sample body |

One mapper, one quote function, three entry points. `test/unit/rule-check-simulator-parity.spec.ts`
asserts identical figures across the sample matrix (FR-030, SC-007).
