# Is the current matching flow strong? — plain-language review

**Date:** 2026-08-05
**Reviewed:** the live code in `backend/src/scoring/`, `backend/src/matching/`, `backend/src/matching-preview/`, `backend/src/applications/`

---

## Short answer

The **admin setup** you built is good. The **scoring math** is weak.

Right now the system does not calculate "how likely is this bank to approve me".
It calculates "how well do this customer's answers match what the admin *typed in* for this bank".

Those are two different things. The screen says "87% approval probability", but nothing in the
system has ever compared that number to a real bank decision.

---

## How it works today (in words)

1. Admin writes questions once, in one global list.
2. Admin ticks which loan categories ask each question (personal / car / mortgage / business).
3. For each bank program, admin ticks which of those questions this program cares about,
   gives each ticked question a **weight** (all weights must add up to 100),
   and gives each possible answer a **score** from 0 to 100.
4. When a customer answers, the score is:

   ```
   for each question the customer answered:
       add  (question weight / 100)  ×  (score of the answer they picked / 100)
   ```

   Best possible answer everywhere = 100%.

That is the whole engine. No income check, no age check, no debt check.

---

## The problems, simplest first

### Problem 1 — Two tick-boxes that don't talk to each other

You have two separate tick-box screens:

- Screen A: "which categories ask this question?"
- Screen B: "which questions does this bank program score on?"

**Nothing checks that they agree.**

Example:

- Question `own_property` is ticked for **mortgage** only.
- A **car loan** program's admin ticks `own_property` and gives it weight **30**.
- A car-loan customer is never shown that question.
- So that answer is missing → it adds **0**.
- That car program can now never score above **70%**, no matter how perfect the customer is.

Nobody is told. No error, no warning. It just quietly loses 30 points forever.

Same thing happens backwards: if someone opens the category screen and unticks
`mortgage` from a question, every mortgage program that was scoring on that question
silently loses its weight. Nothing re-checks the saved weight sets.

**Where in code:** `backend/src/scoring/scoring.service.ts:63` — the comment literally says
"no category filter". The program's own category is loaded 40 lines below and never used.

---

### Problem 2 — Programs are graded on different-sized exams, then compared

The bottom of the fraction is always 100. The top only counts questions the customer
*actually answered and was actually shown*.

Weight disappears whenever:

- a question was hidden by branching logic ("only ask this if they said yes above"),
- a question was optional and skipped,
- a question isn't asked in this category (Problem 1),
- the question is multi-select, number, or text (Problem 3).

Result:

| | Bank A | Bank B |
|---|---|---|
| Questions it scores on | 3 (all asked) | 6 (only 3 asked) |
| Perfect customer scores | 100% | ~50% |

Bank B looks worse than Bank A for reasons that have nothing to do with the customer.
The ranking is not a fair comparison.

**Fix:** divide by the weight of the questions that were *actually asked*, not by a flat 100.
Note: that changes the formula, so per the constitution (A33) it needs an amendment, not just a PR.

---

### Problem 3 — The most important numbers never affect the score

Only **single-choice** questions score. Confirmed in
`backend/src/matching-preview/matching-preview.service.ts:152` and
`backend/src/applications/applications.service.ts:466` — everything else is thrown away
before scoring.

So these four never touch the score:

- monthly income
- how much they want to borrow
- how many months
- existing monthly debts

They are used to calculate the instalment amount, and that's all.

In real credit decisions those four are the *main* thing. Today they count for nothing.
Multi-select answers are the same — you ask them, you show them, they score zero.

**Cheap fix:** turn income into a single-choice question with brackets
("under 10k / 10–20k / 20–50k / 50k+"). Then it can carry weight.
Still limited — brackets can't express a *relationship* like "debt ÷ income", only a level.

---

### Problem 4 — A loan the customer cannot get can rank first

There is no eligibility check anywhere. `matching-preview.service.ts:212` sets
`eligible: true` for every single program, always.

The code to check income, age and debt burden already exists
(`backend/src/matching/pipeline/eligibility-checker.ts`, `dbr.ts`) — it is just not called.

So a customer earning 8,000 EGP can be shown a program with a 25,000 EGP minimum salary,
sitting at the top of the list, labelled **"excellent — 87%"**.

This is the one most likely to damage trust, because the customer will apply and get rejected.

**Suggested middle ground:** keep showing every program (that was the MVP decision),
but flag the ones that fail a basic check: "your salary is below this bank's minimum".
Honest, and doesn't remove anything from the list.

---

### Problem 5 — The percentage is a guess, presented as a fact

The number comes from weights an admin typed. It has never been checked against
what banks actually approved or rejected.

You already store real outcomes (applications, offers, decisions). Nobody reads them back
to see whether an "85%" program actually approves 85% of the time.

Until that loop exists, the number is an internal ranking score — it should not be
worded to the customer as a probability of approval.

---

### Problem 6 — A brand-new program looks *rejected*

`backend/src/scoring/weighted-approval.service.ts:50-53`: if a program has no saved weights
yet, its score is **0**, which lands in the **`very_low`** tier.

A program nobody has configured yet is indistinguishable from a program that
strongly rejects this customer. It should show as *not rated*, or be left out of the list.

---

### Small extra one

The preview screen accepts answers to any question in the pool, without checking the
category (`matching-preview.service.ts:129`). The real apply flow does check
(`questionnaire.service.ts:527`). Two paths, two behaviours — worth aligning.

---

## What to do, in order

| # | Fix | Effort | Needs constitution amendment? |
|---|---|---|---|
| 1 | Block/warn when a program scores on a question its category doesn't ask | Small | No |
| 2 | Show unconfigured programs as "not rated" instead of "very low" | Very small | No |
| 3 | Warn on the category screen when unticking would break saved weight sets | Small | No |
| 4 | Flag (don't hide) programs the customer clearly fails on salary / age / debt | Medium | No — it's a label, not a filter |
| 5 | Add income / debt as bracketed single-choice questions so they carry weight | Medium | No |
| 6 | Divide by the weight actually asked, so programs are comparable | Small code, big meaning | **Yes** (A33) |
| 7 | Record answers next to real bank decisions, so weights can be tuned from evidence later | Medium | No |

Items 1, 2 and 3 remove silent wrongness and need no permission from the constitution.
Item 6 is the one that turns the score into a fair comparison.
Item 7 is what would eventually make the word "probability" true.

---

## Resolution — v25.0.0

**Date:** 2026-09-05 · constitution amendment **v25.0.0**

**The score is gone.** Not re-weighted, not re-normalised, not renamed — removed platform-wide.
Both scoring systems went: the rule-based scorer this review examined
(`matching/pipeline/approval-probability.ts`) and the two-level admin-weighted one that replaced it
(`scoring/`, `matching/scoring/`, `ScoringWeightSet`), together with the `ScoringEngineVersion`
registry, `/admin/scoring/*` and `/admin/scoring-versions/*`, the five `bank_offer.approval*`
columns, the `ApprovalTier` enum, 11 error codes, the admin weights editor, approval pill, tier
chips and "Why this score?" panel, and the mobile "% match" on all four surfaces.

**Problem 5 is why.** It was filed here as the fifth problem, "simplest first" — and it was in fact
the only one that could not be fixed by fixing the score. Problems 1, 2, 3 and 6 are all defects
*inside* a mechanism; Problem 5 says the mechanism has no ground truth. Every subsequent amendment
made the number more defensible without making it more true: v13.0.0 fixed the denominator, v14.0.0
made every question type scoreable, and v13.0.0 also had to reword the mobile label from
"Guarantee Approval" to "% match" — which is this review's own point, conceded in the product's
own words.

**What replaced it is an order, not a smaller score.** `rankOffers(offers, priority)` sorts by the
key the applicant's own `priority` answer names, and the apply path freezes that output on each row
as `bank_offer.rankIndex` (Int, 0-based, dense per application, never updated — Principle I / A6).
That function was already in the code; the score used to override it, so somebody who asked for the
lowest monthly payment was shown the highest-scoring offer first. Anti-pattern **A24** is retired
(reserved, not renumbered); **A33** now blocks reintroducing a score, a tier, or a per-program
answer-weighting table under any name without a constitution amendment.

### Item by item, against the list above

| # | Fix | Status |
|---|---|---|
| 1 | Block/warn when a program scores on a question its category doesn't ask | **Died with the feature.** Shipped as a warning in v13.0.0 (per-row "not asked" tag + summary panel, warn never block); removed in v25.0.0 with the editor that hosted it. Nothing scores on a question now. |
| 2 | Show unconfigured programs as "not rated" instead of "very low" | **Died with the feature.** Shipped in v13.0.0 as `usedDefault`, persisted on the offer (`approvalUsedDefault`) precisely so configuring a program later could not rewrite an immutable offer's meaning. The column was dropped in v25.0.0 — there is no rating to be absent. |
| 3 | Warn on the category screen when unticking would break saved weight sets | **Died with the feature, never built.** It was still open at v14.0.0 ("There is no warning on that screen yet"). There are no saved weight sets to break. Unticking a category still has real consequences — see below. |
| 4 | Flag (don't hide) programs the customer clearly fails on salary / age / debt | **STILL OPEN.** Never about the score, and untouched by its removal. `eligibility-checker.ts` and `dbr.ts` still exist and are still not consulted on the customer path: apply calls the engine with `skipEligibility: true`, the preview never calls `checkEligibility` at all, and every preview row still carries a hardcoded `rejectionReasons: []`. What the customer sees is *less* misleading than when this was written — there is no "excellent — 87%" pill over a loan they cannot get — but the program is still listed with nothing saying their salary is below the bank's minimum. Constitution Principle V still records eligibility gating as dropped for MVP, so this remains a deliberate gap, not an oversight. |
| 5 | Add income / debt as bracketed single-choice questions so they carry weight | **Dead, and re-doing it now would break pricing.** Read the proposal as written: its stated purpose is *"Then it can carry weight"* — a workaround for the scorer accepting only single-choice answers. v14.0.0 removed the limitation instead (every type became scoreable, and numeric answers scored off a band table), which made the workaround unnecessary; v25.0.0 then removed scoring altogether, which makes it moot. It is now actively harmful: `monthly_income` and `current_installments` are two of the four money bindings, the quote needs an exact figure for the instalment and the DBR, and a missing one is refused with `MONEY_FIGURE_MISSING` rather than defaulted. Turning either into a bracket would break the arithmetic that survived. The review's own caveat — brackets express a level, never a relationship like debt ÷ income — points the same way. |
| 6 | Divide by the weight actually asked, so programs are comparable | **Done, then removed.** It shipped as constitution **v13.0.0** with the A33 amendment this row correctly predicted it would need, and it worked: `Σ_answered(weight × score÷100) ÷ Σ_asked(weight)` made programs comparable and stopped a mortgage-only question capping a car program below 100% forever. It was removed in v25.0.0 with everything else. A fair comparison between two guesses is still a comparison between two guesses — which is the sense in which this item was always downstream of Problem 5. |
| 7 | Record answers next to real bank decisions, so weights can be tuned from evidence later | **STILL OPEN, and now the only route back.** The "so weights can be tuned" clause is void; the work itself is not. A33 names this explicitly as what it would take to earn an approval number back: real decisions recorded against the answers that preceded them, then backtested. Until that loop exists, any new score is the same unbacked claim wearing a different name. Nothing in v25.0.0 built it. |

### The "small extra one" — fixed

The preview accepting answers to any question in the pool without checking the category was fixed in
**v13.0.0** and is still fixed: `MatchingPreviewService` scopes to the requested category exactly as
`resolveAnswers` does, and both paths derive visibility through the one shared `isQuestionVisible`.
The asked set no longer feeds a denominator, but it is still load-bearing — it scopes required-question
enforcement, it rejects an answer to a question this category does not ask, and it is the signal for
whether a snapshot was serving the itemised-debt flow.

### What this review got right that is worth keeping

Problem 1 diagnosed a specific silent failure: two tick screens that never validated each other. The
scoring half of that is gone, but **the shape recurs** and the platform now has three answers to it
rather than none. Publish reports a surrogate fact whose question is asked by no category at all.
The bank-program form asks the per-category version of the question — does *this* program's category
ask the fact its income method reads — at the moment the method is picked. And at quote time an
absent fact is `SURROGATE_FACT_MISSING` with a stated reason, never a substituted zero. All three
follow this review's rule: report it before a customer meets it, and never silently substitute a
number.

Walkthrough of what the questionnaire does now:
[questions-and-weights-flow.md](questions-and-weights-flow.md).
