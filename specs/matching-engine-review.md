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
