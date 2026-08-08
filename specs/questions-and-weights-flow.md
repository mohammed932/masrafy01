# Questions and weights — how the whole thing fits together

**Date:** 2026-08-06 · reflects constitution **v14.0.0**

A plain-language walkthrough of how a question becomes a score. Read top to bottom.

---

## The one-paragraph version

There is **one list of questions** for the whole product. Each question is ticked for the loan
categories that should ask it. Separately, each **bank program** ticks which of those questions it
cares about and says how much each one matters and how good each possible answer is. When a
customer answers, every program grades that customer using its own ticks — and only over the
questions the customer was actually shown.

Three different people can touch three different screens, and none of them see each other's work.
That is why most of the confusing behaviour in this system comes from the *gaps between* the
screens, not from any one screen.

---

## The three things an admin sets

| # | What | Where | Stored in |
|---|---|---|---|
| 1 | The questions themselves | Questionnaire → **Questions** | `question`, `question_option`, `question_group` |
| 2 | Which categories ask each question | Questionnaire → **Loan categories** | `question_loan_category` |
| 3 | Which questions a bank program scores on, and how much | Bank program → **Scoring** | `scoring_weight_set.weights` (JSON) |

**1 and 2 are global.** They are the same for every bank.
**3 is per bank program.** Twenty programs = twenty independent opinions about the same questions.

```
                    ┌──────────────────────────┐
                    │   ONE global question    │
                    │   pool  (screen 1)       │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
    ┌─────────▼──────────┐              ┌───────────▼────────────┐
    │ WHICH CATEGORIES   │              │ WHICH QUESTIONS EACH   │
    │ ASK IT (screen 2)  │              │ PROGRAM SCORES ON      │
    │                    │              │ (screen 3, per program)│
    │ decides what the   │              │ decides what counts    │
    │ CUSTOMER SEES      │              │ toward the SCORE       │
    └────────────────────┘              └────────────────────────┘
              │                                     │
              └──────────────┬──────────────────────┘
                             │
                    these two must overlap.
              Nothing forced them to, before v13.0.0.
```

---

## Part 1 — Authoring a question

A question has:

- a **code** — auto-generated from the wording, never hand-typed. It is the permanent identity;
  everything downstream (weights, answers, bindings) refers to the question by code.
- a **type** — one of four:

| Type | Customer sees | How a bank scores it |
|---|---|---|
| `SINGLE_SELECT` | pick one option | the picked option's score |
| `MULTI_SELECT` | pick several | the picked options' scores, combined by the bank's chosen rule |
| `NUMERIC` | type a number | the score of the range (band) the number falls in |
| `TEXT` | type free text | a flat score for having answered at all |

- a **group** and a **display order** — the group becomes one step in the mobile wizard.
- **required or optional**.
- optionally an **`enabledWhen` rule** — branching. "Only show this question if question X was
  answered with option Y." A question whose rule doesn't match is not shown, not required, not
  stored, and not scored.

### Every type scores — since v14.0.0

Until v14.0.0 only single-choice questions could score, which meant **income, existing debts,
requested amount and loan term — all `NUMERIC` — contributed nothing to the match.** They were
collected and used to calculate the instalment, the DBR and the maximum affordable amount, but they
did not move the percentage at all. That was the single biggest gap in match quality, and it is
closed.

The formula did not change. What changed is that each type now has a way to turn one answer into one
score from 0 to 100:

- a **number** falls into a band the bank defined ("0–4,999 earns 20, 5,000–14,999 earns 60,
  15,000 and up earns 100")
- **several picks** are combined by a rule the bank chooses per question — their average, their
  total (capped at 100), the best one, or the worst one
- **free text** earns a flat score for being answered. It is deliberately *not* matched against
  keywords: Arabic spelling and diacritics defeat it, an applicant can game it once they guess it,
  and it would bury a bank's judgement in a regex nobody backtests.

### Publish freezes a snapshot

Editing questions changes the **draft**. Customers never read the draft. Publishing writes an
immutable **snapshot** — a frozen copy of every active question with its wording, type, order,
required flag, `enabledWhen` rule, its **assigned categories**, and its options.

That snapshot is what the mobile app downloads, and what an application records as "this is the
questionnaire that was put in front of this customer". Change a question tomorrow and yesterday's
applications still read correctly.

---

## Part 2 — Which categories ask the question

A question is joined to one or more of the four categories (`personal`, `car`, `mortgage`,
`business`) in the `question_loan_category` table. Many-to-many: one question can serve several.

- Assigned to nothing = **parked**. Nobody is ever asked it. The admin screen flags these.
- The assignment is **frozen into the snapshot** at publish, not looked up fresh at read time.
  Otherwise re-ticking a category today would silently rewrite what an old application was asked.
- A snapshot published before this feature existed carries no categories at all, and reads as
  "asked for every category".

> **Absent and empty are opposites, and it matters.** A snapshot from before this feature has no
> `categories` key at all → asked for everything. A parked question in a current snapshot has
> `categories: []`, written deliberately → asked by nobody. Code that tests "is the list non-empty"
> instead of "is the key present" collapses the two. That exact slip shipped in the preview path and
> is pinned down now by `test/integration/preview-asked-set-parity.spec.ts`.

This assignment decides **which questions a customer sees**. It does *not* decide which
questionnaire is served — there is only ever one.

---

## Part 3 — What a bank program sets

Open a program's scoring editor and you go through four steps.

### Step 1 — Pick the questions

Tick the questions this program scores on. **The tick list is the whole global pool**, not just the
questions your category asks — deliberately, so you can configure a question before its category
assignment catches up.

Any question your program's category does *not* ask carries a small **"not asked"** tag, whether or
not you have ticked it — so you can see the problem before you pick, not after. Tick one anyway and
a warning panel appears above the list naming them. It warns; it never blocks.

> There is no separate "assignment" table. **The set of questions you ticked *is* the set of keys in
> the saved `questionWeights` object.** Untick a question and its key disappears.

### Step 2 — Say how much each one matters

Give each ticked question a **weight**. The weights must add up to exactly **100**. A budget bar at
the top shows how much you have left; save is blocked until it lands on 100.

"Distribute evenly" splits 100 across your ticked questions.

### Step 3 — Say how good each answer is

Score from 0 to 100, where 100 is the ideal answer for this bank and 0 the worst. **The control
follows the question's type**, and the screen says which type it is on every row:

| Type | What you fill in |
|---|---|
| pick one | a score per option |
| pick several | a score per option, plus **how several picks count**: their average (default), added up and capped at 100, the best pick only, or the worst pick only |
| number | a **band table**. You type the boundaries; each band starts exactly where the previous one ended, the first covers everything below the first boundary and the last everything above — so gaps and overlaps cannot be typed at all. Entering the step seeds three bands from the question's own published range. |
| free text | one score for "answered" |

Choosing the multi-pick rule is a real decision, not a formality: "which income sources do you
have" wants **added up**, "which of these debts do you hold" wants **the worst pick**, "which
certifications do you hold" wants **the best pick**. One fixed rule would push you into distorting
option scores to fake the semantics.

### Step 4 — Review and save

Saving runs these checks, in this order:

| Check | Fails when | Error |
|---|---|---|
| Codes exist | you reference a deleted question or option | `WEIGHTS_UNKNOWN_OPTION` |
| Rule matches the type | option scores on a number, bands on a dropdown, an unknown multi-pick rule | `WEIGHTS_RULE_TYPE_MISMATCH` |
| Bands are sane | bands overlap, leave a gap, run out of order, or don't reach −∞ / +∞ | `WEIGHTS_NUMERIC_BANDS_INVALID` |
| Every weighted question can earn | a question carries weight but no option scores / no bands / no text score | `WEIGHTS_MISSING_RULE` |
| Scores in range | any score — option, band, or text — is outside 0–100 | `WEIGHTS_ANSWER_SCORE_OUT_OF_RANGE` |
| Weights sum to 100 | the budget bar isn't on 100 | `WEIGHTS_QUESTION_WEIGHT_SUM_INVALID` |

`WEIGHTS_MISSING_RULE` exists because the alternative is invisible: a question with weight and no way
to score it spends its share of the denominator and can never earn any of it back, so the program is
capped below 100% with nothing on screen to explain why. That was legal before v14.0.0.

A save **archives the previous ACTIVE set and activates a new numbered version in one transaction**,
and writes the editor's admin ID to the audit log. Nothing is edited in place — you can always see
what the scoring was on any given day.

A program with **no ACTIVE set** has never been configured. It scores 0 — but it is now flagged
`usedDefault` and shows as **"Not rated yet"**, not as a bad match.

### What actually gets stored

One JSON blob per version:

```jsonc
{
  "questionWeights": {              // ← ticking a question adds its key here
    "income_monthly":  40,          //    these must total exactly 100
    "income_sources":  25,
    "own_property":    20,
    "employer_name":   15
  },
  "answerScores": {                 // ← 0–100 per option, both choice types
    "income_sources": { "salary": 100, "rental": 60, "freelance": 20 },
    "own_property":   { "yes": 100, "no": 0 }
  },
  "multiSelectRules": {             // ← how several picks combine
    "income_sources": { "aggregation": "AVERAGE" }
  },
  "numericBands": {                 // ← half-open [from, to), gapless, −∞…+∞
    "income_monthly": [
      { "from": null,    "to": "5000",  "score": 20 },
      { "from": "5000",  "to": "15000", "score": 60 },
      { "from": "15000", "to": null,    "score": 100 }
    ]
  },
  "textRules": {                    // ← what answering at all earns
    "employer_name": { "answeredScore": 100 }
  }
}
```

Band edges are **strings**, not numbers: they are money, and money never travels as a float
(Principle I). `[from, to)` is half-open — 5,000 belongs to the band that *starts* at 5,000, never to
the one that ends there — so no value can be claimed by two bands.

Older rows are upgraded when read. A pre-v8 row stored just the option map, and equal weights are
synthesised so they still total 100; a pre-v14 row carries no rule maps and reads with them empty.
Neither needed a migration.

---

## Part 4 — What happens when a customer answers

```
customer picks a category
        │
        ▼
 download the published snapshot, narrowed to that category
        │
        ▼
 answer questions  (branching hides some as they go)
        │
        ├──────────────► PREVIEW  (live, nothing saved)
        │                POST /v1/matching/preview
        │
        └──────────────► APPLY    (persists an application + immutable offers)
                         POST /v1/applications/apply
```

Both paths do the same three things:

**1. Work out what was actually asked.**
Active + assigned to this category + visible after branching. This list is the single most important
thing in the whole flow — it is the denominator of the score.

**2. Route the answers.**
Every answer goes to the scorer, each as the kind it is — one pick, several picks, a number, or
"there was text here". The four bound numeric answers — requested amount, term, monthly income,
existing instalments — *also* go to the **quote**, producing the instalment, the DBR and the maximum
affordable amount. That is two jobs for one answer, not double counting: one prices the loan, the
other grades the applicant. Both paths use the same mapper, so neither can drift from the other.

**3. Score every active program the applicant asked about, and rank by score.**

"Asked about" is a pair: the loan category, and — when the app's Home screen offered one under that
category — the catalog program name they picked. Both narrow the list of programs; neither touches
the score itself.

Preview and apply must agree here. They used to build "what was asked" differently — preview read
the whole pool, apply narrowed by category — and since v13.0.0 that difference would move the
number, so both now run the same rule.

---

## Part 5 — The maths

```
              Σ over ANSWERED  ( question weight × answer score ÷ 100 )
score  =      ────────────────────────────────────────────────────────
                     Σ over ASKED  ( question weight )
```

Then `× 100` and rounded to a whole number.

Three rules follow from that, and they are the whole point of the v13.0.0 change:

1. **A question the customer was never shown leaves both halves.** It cannot drag the program down.
2. **A question they were shown but skipped stays in the bottom half and adds nothing to the top.**
   Skipping costs you.
3. **An answer to a question that was not asked is ignored entirely.**

Nothing asked, or no weight on anything asked → **0**, never an error.

### Tiers

| Score | Tier |
|---|---|
| 80–100 | excellent |
| 60–79 | good |
| 40–59 | moderate |
| 20–39 | low |
| 0–19 | very_low |

### Worked examples

All of these use the same program:

```
income_band    weight 40    high 100 · mid 60 · low 20
job_tenure     weight 35    over_3y 100 · one_to_3y 55 · under_6m 10
own_property   weight 25    yes 100 · no 0
                     ───
              total  100
```

**A. Perfect customer, everything asked**

```
top    = 40×(100/100) + 35×(100/100) + 25×(100/100)  = 40 + 35 + 25 = 100
bottom = 40 + 35 + 25                                              = 100
score  = 100 / 100 = 1.00                                          → 100%   excellent
```

**B. Mixed answers, everything asked**

```
picks: income_band=low(20) · job_tenure=over_3y(100) · own_property=yes(100)

top    = 40×0.20 + 35×1.00 + 25×1.00 = 8 + 35 + 25 = 68
bottom = 100
score  = 0.68                                       → 68%    good
```

**C. They skipped `own_property` (it WAS asked, optional)**

```
top    = 40×1.00 + 35×1.00 = 75      ← own_property earns nothing
bottom = 40 + 35 + 25      = 100     ← but still costs its 25
score  = 0.75                        → 75%    good

Skipping cost exactly 25 points — its weight, no more.
```

**D. `own_property` is mortgage-only and this is a car loan**

```
The customer is never shown it. It leaves BOTH halves.

top    = 40×1.00 + 35×1.00 = 75
bottom = 40 + 35           = 75      ← the 25 is gone from here too
score  = 1.00                        → 100%   excellent
```

> **D is the bug that v13.0.0 fixed.** Before, the bottom was always a flat 100, so this program
> scored 75% for a *flawless* customer and could never rank first — silently, forever, with nothing
> anywhere in the admin to reveal it.

**E. Program was never configured**

```
No ACTIVE weight set → bottom = 0 → score 0, flagged "not rated"
Shown as "Not rated yet", NOT as very_low.
```

**F. A mixed-type program (v14.0.0)**

```
income_monthly   weight 40   bands: <5,000 → 20 · 5,000–15,000 → 60 · 15,000+ → 100
income_sources   weight 25   salary 100 · rental 60 · freelance 20   (AVERAGE)
own_property     weight 20   yes 100 · no 0
employer_name    weight 15   answered → 100
                       ───
                 total  100

answers: income_monthly = 9,000 · income_sources = salary + freelance
         own_property = no    · employer_name = "شركة النيل"

income_monthly   9,000 lands in the middle band → 60    40 × 0.60 = 24
income_sources   (100 + 20) ÷ 2 = 60                    25 × 0.60 = 15
own_property     no → 0                                 20 × 0.00 =  0
employer_name    answered → 100                         15 × 1.00 = 15
                                                                    ──
top = 54 · bottom = 100 · score = 0.54                → 54%   moderate
```

Switch `income_sources` to **added up** and the same two picks score `min(100, 120) = 100`, taking
the total to 64%. Switch it to **the worst pick** and they score 20, dropping it to 44%. Same answers,
same weights — the rule the bank chose is doing real work.

### Why the "impact" numbers add up

Each offer stores a breakdown of what each answer contributed. It divides by the **same bottom
number** the score did, so the parts always sum to the whole.

Example B (bottom = 100):

```
income_band  low       40 × 20  ÷ 100  =   8
job_tenure   over_3y   35 × 100 ÷ 100  =  35
own_property yes       25 × 100 ÷ 100  =  25
                                          ──
                                          68  ✓ matches the 68% shown
```

Example D (bottom = 75):

```
income_band  high      40 × 100 ÷ 75   =  53
job_tenure   over_3y   35 × 100 ÷ 75   =  47
                                          ───
                                          100 ✓ matches the 100% shown
```

---

## Part 6 — The rules that trip people up

**The two tick screens don't validate each other.** Ticking a question in the scoring editor that
your category doesn't ask now shows a warning, but still saves. Since v13.0.0 it no longer damages
the score — it just means you configured something with no effect.

**Unticking a category is invisible from the scoring side.** Removing `mortgage` from a question
quietly removes it from every mortgage program's denominator. The score stays fair; the weight you
set simply stops applying. There is no warning on that screen yet.

**A question can be weighted and still earn nothing — but no longer silently.** Weight with no rule
for the type is now rejected on save (`WEIGHTS_MISSING_RULE`), and so is an option map with no
entries. What is still legal, and still costs the applicant, is a band table with a hole in it at
save time — impossible to type in the admin editor, possible in a hand-edited row.

**"Roll back to an older version" records no actor.** Every other questionnaire mutation audits who
did it. `POST versions/rollback/:versionId` takes no user and writes no audit event, so re-activating
a different snapshot for every future applicant is the one change in this area with nobody's name on
it.

**Weights sum to 100, but the *effective* budget is usually less.** If you weight six questions and
only four are asked, the maths runs over those four. The bar on screen still has to read 100.

**A question code is forever.** Renaming a question's wording is fine. The code is generated once
and referenced by every weight set and every stored answer.

**Four question codes are bound to the money engine by name** — requested amount, term, monthly
income, existing instalments. Renaming one of those codes is a code change, not an admin change; the
admin screen shows a binding warning if one goes missing.

**Money answers now do both — if the bank bands them.** A numeric question still earns nothing until
someone gives it a band table. A program that has never opened the scoring editor since v14.0.0 has
no bands on its money questions, so those questions carry no weight and the score is exactly what it
was before. Nothing was silently re-scored.

**Nothing has ever been checked against a real bank decision.** Every weight and every answer score
is somebody's judgement. That is why the mobile app now says "match", not "approval" — the label
becomes an approval claim only once outcomes are recorded and backtested.

---

## Where to look in the code

| Thing | File |
|---|---|
| The formula + the per-type answer score | `backend/src/matching/scoring/approval-probability.scorer.ts` |
| Answer → scorer mapping (shared by preview + apply) | `backend/src/matching/scoring/answer-to-selected.ts` |
| Band table control (admin) | `admin/src/app/shared/ui/score-bands-editor.component.ts` |
| Scoring one program | `backend/src/scoring/weighted-approval.service.ts` |
| Weight save + validation | `backend/src/scoring/scoring.service.ts` |
| Questions, publish, snapshot | `backend/src/questionnaire/questionnaire.service.ts` |
| Branching rule (shared) | `backend/src/questionnaire/validation/question-visibility.ts` |
| Type rules | `backend/src/questionnaire/validation/question-type-rules.ts` |
| Money bindings | `backend/src/matching/pipeline/money-field-bindings.ts` |
| Live preview | `backend/src/matching-preview/matching-preview.service.ts` |
| Apply + persist offers | `backend/src/applications/applications.service.ts` |
| Question editor (admin) | `admin/src/app/features/questionnaire/questionnaire-editor.page.ts` |
| Category assignment (admin) | `admin/src/app/features/questionnaire/question-categories.page.ts` |
| Scoring editor (admin) | `admin/src/app/features/questionnaire/scoring-weights-editor.page.ts` |
| Worked-example tests | `backend/test/unit/asked-weight-denominator.spec.ts` |
| Per-type scoring tests | `backend/test/unit/{numeric-band-scoring,multi-select-aggregation,text-presence-scoring}.spec.ts` |

Related: [matching-engine-review.md](matching-engine-review.md) — what is still weak and why.
