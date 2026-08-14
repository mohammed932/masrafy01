# Contract — Questionnaire bindings for surrogate facts

The customer half of the loop. Nothing here adds a field to `Question` or `QuestionOption` (A33) and
nothing here introduces a second pool or a per-category snapshot (A33).

---

## 1. `GET /api/v1/questionnaire?category=personal` — payload shape unchanged

The three new questions arrive as ordinary pool questions inside the ONE global snapshot, narrowed
by their frozen `categories`. No new question type, no new field, no client change beyond rendering
what it already renders.

```jsonc
{
  "success": true,
  "data": {
    "version": 12,
    "groups": [{
      "code": "employment",
      "questions": [
        {
          "code": "military_grade",
          "type": "SINGLE_SELECT",
          // The code is the SLUG OF THE ENGLISH LABEL (slug.util.ts) — "Military grade",
          // not "Your military grade", or the binding constant would never match.
          "labelAr": "الرتبة العسكرية", "labelEn": "Military grade",
          // `enabledWhen` carries ONE optionCode plus an operator — never a list.
          "enabledWhen": { "questionCode": "employment_status", "operator": "equals", "optionCode": "government_employee" },
          "options": [
            { "code": "officer",        "labelAr": "ضابط",      "labelEn": "Officer" },
            { "code": "senior_officer", "labelAr": "ضابط أقدم", "labelEn": "Senior Officer" },
            { "code": "general",        "labelAr": "لواء",       "labelEn": "General" }
          ]
        },
        { "code": "years_in_practice", "type": "NUMERIC", "numeric": { "min": "0", "max": "60", "unit": "years", "integerOnly": true } }
      ]
    }]
  }
}
```

**Option codes ARE registry keys** (FR-017). `officer` / `senior_officer` / `general` are the active
members of the `military_grade` platform enumeration — the same list the admin's
`app-tier-key-picker` offers when typing the table. A rename on one side is therefore visible on the
other as a publish warning, never as a silent non-match.

**Gate coverage (accepted)**: `academic_rank` carries the same
`employment_status equals government_employee` gate, because no employment option separates a soldier
from a professor and `enabledWhen` cannot hold two options. Both questions are optional, so a
government employee answers the one that applies and skips the other — which is
`SURROGATE_FACT_MISSING`, not a zero. `years_in_practice` is ungated (its population spans
`freelancer` and `business_owner_company_owner`). Splitting the employment options is a later change
(research R11).

---

## 2. `POST /api/admin/questionnaire/versions/publish` — new warnings

Publishing NEVER fails on a surrogate binding, exactly as it never fails on a money binding
(`questionnaire.service.ts:399-401`): a half-renamed binding must not lock the pool.

```jsonc
{
  "success": true,
  "data": {
    "version": 13,
    "warnings": [
      { "code": "SURROGATE_FACT_BINDING_MISSING",
        "meta": { "fact": "academic_rank", "questionCode": "academic_rank", "reason": "missing_or_inactive" } },
      { "code": "SURROGATE_FACT_BINDING_MISSING",
        "meta": { "fact": "military_grade", "questionCode": "military_grade",
                  "reason": "option_codes_drifted", "unknown": ["colonel"] } }
    ]
  }
}
```

`GET /api/admin/questionnaire/tree` returns the same warnings without publishing, via the existing
`bindingWarnings()` (FR-021: reported to admins BEFORE a customer meets it).

`reason` values: `missing_or_inactive` · `wrong_type` · `option_codes_drifted` · `not_assigned_to_personal`.

---

## 3. `POST /api/v1/applications/apply` — the facts finally travel

Body shape is unchanged; the mobile mapper stops sending an empty asset set (FR-019).

```jsonc
{
  "category": "personal",
  "employment": {
    "employmentType": "government_employee",
    "monthlyNetSalaryEGP": "9000",
    "monthsInJob": 96,
    "militaryGrade": "senior_officer",     // ← from the answer, was never sent
    "yearsInPractice": 11                  // ← idem
  },
  "assets": {
    "creditCardLimitEGP": "150000"         // ← from the pre-existing card-limit question
  },
  "questionnaireAnswers": [ ... ]
}
```

Mapping is done ONCE, in a shared helper read by both the apply path
(`applications.service.ts#buildProfile`) and the preview path
(`matching-preview.service.ts#buildProfile`). Preview and apply deriving the same input differently
is a review block (A33, the v13.0.0 `isQuestionVisible` lesson).

**Unanswered ⇒ absent, never zero.** A skipped or unasked fact is omitted from the body; the field
stays `undefined` on the profile and the quote reports `SURROGATE_FACT_MISSING`. No default, no
substitution (FR-020, AS-2.4 / AS-2.5).

**Numeric facts pass through exactly** (FR-018) — no bucket-to-midpoint approximation, the same rule
feature 010 applied to the four money answers.

---

## 4. Customer-facing wording (FR-023, FR-025)

Both new reasons ship in `masrafy-app/lib/l10n/intl_{ar,en}.arb` and in
`admin/src/i18n/error-codes.{ar-EG,en-US}.json`, alongside the existing `NO_RECOGNISED_INCOME`
strings.

| Reason | en-US | ar-EG |
|---|---|---|
| `SURROGATE_FACT_MISSING` | "This program needs a detail we haven't asked you for yet, so no figures can be shown." | «هذا البرنامج يحتاج بيانًا لم نسألك عنه بعد، لذا لا يمكن عرض أرقام.» |
| `SURROGATE_NO_MATCHING_ROW` | "This bank's table doesn't cover your answer, so no figures can be shown." | «جدول هذا البنك لا يغطي إجابتك، لذا لا يمكن عرض أرقام.» |

Every surrogate-derived figure keeps the existing indicative-estimate disclaimer and the existing
"{pct}% match" wording (v13.0.0) — this feature introduces no guarantee language and no new ranking
(FR-023, FR-024).
