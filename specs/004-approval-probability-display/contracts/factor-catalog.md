# Factor Catalog — Baseline Version `1.1.0-init`

This is the seeded factor catalog for the initial registry row written by the feature-004 migration. Every entry carries:

- **code** — stable identifier persisted in `bank_offer.approvalFactors[*].code`. Never renamed; deprecated only by MAJOR engine bump.
- **labelAr / labelEn** — localized sentences rendered in the admin detail "Why this score?" panel and in any future mobile UI. Sourced from the offer's own engine version, never the active engine's.
- **default impact** — the value in `weightsConfig.weights[code]` at version `1.1.0-init`. Real impact on an offer is computed by the pipeline against the applicant profile; this column is what the engine adds when the factor's condition triggers.

Three special-purpose codes (`BASE`, `CLAMP_MIN`, `CLAMP_MAX`) live in `weightsConfig.weights` but NOT in `factorCatalog` — they configure the engine, never appear in `approvalFactors`. Two synthetic markers (`CLAMPED_TO_FLOOR`, `CLAMPED_TO_CEILING`) appear in `approvalFactors` only when the engine clamps; they DO live in `factorCatalog`.

---

## Positive factors (impact > 0)

| Code | Default impact | AR | EN |
|---|---|---|---|
| `HAS_CD_AT_ABK` | +15 | لديك وديعة لدى البنك التجاري العربي | You have a certificate of deposit at ABK |
| `BANKERS_PROGRAM` | +20 | برنامج خاص بالعاملين بالقطاع المصرفي | Eligible for the bankers' program segment |
| `PENSIONS_PROGRAM` | +15 | برنامج خاص بأصحاب المعاشات | Eligible for the pensions program segment |
| `LONG_TENURE` | +10 | خبرة طويلة في الوظيفة الحالية | Long tenure at your current job |
| `PAYROLL_TRANSFER` | +10 | تحويل الراتب موثق | Salary-transfer is verified |
| `CLAMPED_TO_FLOOR` | (synthetic) | تم رفع النتيجة للحد الأدنى | Score lifted to the minimum |

## Negative factors (impact < 0)

| Code | Default impact | AR | EN |
|---|---|---|---|
| `PREVIOUS_REJECTION` | −30 | رفض سابق مسجل | Previous rejection on file |
| `HIGH_DBR` | −20 | نسبة دين مرتفعة | High debt-burden ratio |
| `NOT_CAT_A` | −15 | ليس من فئة الشركات أ | Employer is not Cat-A |
| `AGE_NEAR_MIN` | −10 | العمر قريب من الحد الأدنى | Age is close to the program's minimum |
| `INCOME_NEAR_MIN` | −10 | الدخل قريب من الحد الأدنى | Income is close to the program's minimum |
| `CLAMPED_TO_CEILING` | (synthetic) | تم خفض النتيجة للحد الأقصى | Score capped at the maximum |

---

## Configuration values (NOT in `factorCatalog`)

| Key | Value | Purpose |
|---|---|---|
| `BASE` | 70 | Starting score before any factor adjustments. |
| `CLAMP_MIN` | 10 | Lower bound after factor accumulation; below this triggers `CLAMPED_TO_FLOOR`. |
| `CLAMP_MAX` | 95 | Upper bound; above this triggers `CLAMPED_TO_CEILING`. |

---

## Threshold table (lives in `weightsConfig.thresholds`)

| Tier | Lower bound (inclusive) | Upper bound (exclusive) |
|---|---|---|
| `excellent` | 80 | (no upper bound; clamped at 95 by `CLAMP_MAX`) |
| `good` | 60 | 80 |
| `moderate` | 40 | 60 |
| `low` | 20 | 40 |
| `very_low` | 0 | 20 |

Boundary semantics: inclusive on the upper-tier side. `score === 80 → excellent`, `score === 60 → good`, etc. (R-005.)

---

## Bumping the catalog

Per FR-011a + R-004:

- **Adding a new factor code**: MINOR bump. New `weightsConfig` row carries the additional `factorCatalog` entry plus a new `weights[<CODE>]` value. Old offers ignore the new code (their stored factor lists never reference it). Activation endpoint promotes the new row when the operator is ready.
- **Removing a factor code**: MAJOR bump. The new `weightsConfig` row drops the entry from `weights` AND from `factorCatalog`. Old offers carrying the removed code render with the **previous version's catalog** (per FR-020 + edge case 7) plus a "Deprecated in v\<active>" badge.
- **Renaming a factor's AR/EN sentence (no impact change)**: PATCH bump if semantically equivalent (e.g., typo fix). The semantic-equivalence call is documented in the version's `description` and called out in the PR.
- **Changing a factor's `weights[<CODE>]` value**: MINOR bump. Old offers keep their original `impact` (the pipeline stamped it at score-time); new offers use the new value.
- **Changing a threshold**: MAJOR bump. Same score now falls in a different tier; pill colors change for new offers; old offers keep their original tier label.

---

## Validation invariants

1. Every code in `weights` (except `BASE`, `CLAMP_MIN`, `CLAMP_MAX`) MUST have a matching entry in `factorCatalog`. Enforced by Zod schema at write time.
2. Every code stored in any `bank_offer.approvalFactors` row's `positive[]` or `negative[]` (under any historical version) MUST be present in that offer's `engineVersion.weightsConfig.factorCatalog`. Enforced by the boot integrity check.
3. `CLAMPED_TO_FLOOR` and `CLAMPED_TO_CEILING` are reserved code names; they MUST be in every version's `factorCatalog` so the synthetic marker can localize regardless of active version. The migration's seed snapshot includes them.
