# Questions and answers — how the questionnaire fits together

**Date:** 2026-08-06, rewritten 2026-09-05 · reflects constitution **v25.0.0**

A plain-language walkthrough of how a question reaches a customer and what their answer does. Read
top to bottom.

> **Why the filename still says "weights".** It does not describe the contents any more. The path is
> kept on purpose: CLAUDE.md's v14.0.0 changelog entry links this document by path from a historical
> record that must not be rewritten, and a moved file would turn that entry into a dead link.
>
> **What changed, and it is most of the document.** Constitution **v25.0.0** removed approval
> scoring platform-wide — the score, its tiers, the per-program weight sets, the answer scores, the
> `scoring_weight_set` table, the whole `/admin/scoring/*` surface and the weights editor. There is
> no third screen and no third thing an admin sets. The two Parts that covered per-program weights
> and the scoring editor, the maths Part with its worked examples and its tier table, and the
> weights half of the "rules that trip people up" section are all deleted rather than corrected —
> they described a mechanism, not a mistake in one.
>
> The reason is stated once and not repeated below: the number was a weighted sum of figures an
> admin typed, and it was never once compared against a bank's actual decision. v13.0.0 had already
> had to reword it on mobile from "Guarantee Approval" to "% match", which was the admission.
> **A33 now blocks reintroducing a score, a tier, or a per-program answer-weighting table under any
> name without a constitution amendment** — earning that number back needs the outcome loop (real
> decisions recorded against the answers that preceded them), not another editor. See
> [matching-engine-review.md](matching-engine-review.md), which is the review this removal came out
> of, and its dated Resolution section.

---

## The one-paragraph version

There is **one list of questions** for the whole product. Each question is ticked for the loan
categories that should ask it. When a customer picks a category they are served that one published
snapshot, narrowed to their category and then narrowed again by branching as they go. Their answers
do two things: four bound number answers **price** the loan, and the rest are **stored** as the
record of what was asked and answered. Nothing grades the customer.

What the customer sees on the results screen is an **order**, not a score, and they chose the
ordering themselves — one of the questions asks what matters most to them.

---

## The two things an admin sets

| # | What | Where | Stored in |
|---|---|---|---|
| 1 | The questions themselves | Questionnaire → **Questions** | `question`, `question_option`, `question_group` |
| 2 | Which categories ask each question | Questionnaire → **Loan categories** | `question_loan_category` |

**Both are global.** They are the same for every bank. There is no per-bank-program opinion about a
question any more; a bank program's own configuration is about money — its rate cascade, its DBR
bands, its income rule and its limits — and lives on the bank-program screens.

```
                    ┌──────────────────────────┐
                    │   ONE global question    │
                    │   pool  (screen 1)       │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │ WHICH CATEGORIES ASK IT  │
                    │ (screen 2)               │
                    │                          │
                    │ decides what the         │
                    │ CUSTOMER SEES            │
                    └────────────┬─────────────┘
                                 │
                          publish freezes it
                                 │
                    ┌────────────▼─────────────┐
                    │  the snapshot the        │
                    │  customer answers        │
                    └──────────────────────────┘
```

---

## Part 1 — Authoring a question

A question has:

- a **code** — auto-generated from the wording, never hand-typed (A33). It is the permanent
  identity; everything downstream (stored answers, surrogate-fact bindings, the money bindings)
  refers to the question by code.
- a **type** — one of four: `SINGLE_SELECT` (pick one), `MULTI_SELECT` (pick several),
  `NUMERIC` (type a number), `TEXT` (type free text).
- a **group** and a **display order** — the group becomes one step in the mobile wizard.
- **required or optional**. `isRequired` is one global column, so a question required of one
  category is required of every category that asks it. That is a real constraint on design, not an
  oversight: it is why "where do you practise?" had to be a second question rather than a reword of
  the mortgage question "where is the property?" — one answer cannot be true of both.
- optionally an **`enabledWhen` rule** — branching. "Only show this question if question X was
  answered with option Y." A question whose rule does not match is not shown, not required, and not
  stored.

A question carries **no scoring and no eligibility fields**. It is pure content — wording, type,
order — and A33 makes adding either back a review block.

### Publish freezes a snapshot

Editing questions changes the **draft**. Customers never read the draft. Publishing writes an
immutable **snapshot** — a frozen copy of every active question with its wording, type, order,
required flag, `enabledWhen` rule, its **assigned categories**, and its options.

That snapshot is what the mobile app downloads, and what an application records as "this is the
questionnaire that was put in front of this customer". Change a question tomorrow and yesterday's
applications still read correctly.

Publishing is also where the platform reports what is **bound but broken** — a money binding whose
question has gone missing, or a surrogate fact whose question is inactive, wrongly typed, asked by
no category at all, or whose option codes have drifted from the registry the bank's table is keyed
by. These are **warnings on a successful publish**, never a refusal: publish knows nothing about
which bank programs exist, so it can report a broken binding but must not hold the questionnaire
hostage to one.

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
> instead of "is the key present" collapses the two, and that exact slip has shipped once already.
> The same absent-vs-empty rule is why the publish-time binding check tests for an empty array
> rather than a falsy one.

This assignment decides **which questions a customer sees**. It does *not* decide which
questionnaire is served — there is only ever one, and A33 forbids a second pool or a per-category
snapshot.

It also decides something less obvious: **which categories can sell a no-payslip program**. That
capability is derived from whether a category's applicants are asked one of the surrogate facts —
there is no hardcoded capable-category list (both were deleted in v16.0.0, and A26 blocks
reintroducing one). Widening the no-payslip product to a new category is a tick on this screen, not
a release.

---

## Part 3 — What happens when a customer answers

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
Active + assigned to this category + visible after branching. Preview and apply must agree here, and
they are held to it structurally: both call the same `isQuestionVisible`, and preview scopes to the
requested category exactly as apply does. They used to derive it differently — preview read the
whole pool — and that difference is the kind of drift A33 names.

The asked set is still load-bearing after the score's removal, in three places:

- **Required-question enforcement** is scoped to it. A question that was hidden by branching is not
  required, because it was not asked.
- **An answer to a question this category does not ask is rejected**, not ignored — storing it would
  record an answer to something the applicant was never shown.
- **It is the "was this snapshot serving the itemised-debt flow?" signal.** A snapshot that predates
  the itemised debt questions yields no such code, which routes obligations down the stated
  lump-sum fallback instead of inventing an itemisation nobody was asked for.

**2. Route the answers.**
Four bound number answers — requested amount (`amount_requested`), term
(`repayment_period_months`), monthly income (`monthly_income`) and existing instalments
(`current_installments`) — go to the **quote**, producing the instalment, the DBR and the maximum
affordable amount. Choice and number answers also feed the **surrogate facts** a no-payslip
program's income rule reads. Both paths use the same mappers, so neither can drift from the other.

> **Four question codes are bound to the money engine by name.** Renaming one of those codes is a
> code change, not an admin change; publish reports a binding warning if one goes missing. The
> mobile side mirrors the same four in its `*_apply_mapper.dart` files.

**3. Quote every active program the applicant asked about, and order the results.**

"Asked about" is a pair: the loan category, and — when the app's Home screen offered one under that
category — the catalog program name they picked. Both narrow which programs are considered.

There is **no eligibility gate** in either path: every active program in scope is returned. A
program that cannot be priced is still listed, carrying a stated reason rather than a blank.

---

## Part 4 — The order

The results are ordered by the applicant's own answer to the priority question, through one
function — `rankOffers(offers, priority)` — which is the single authority on offer order.

| Priority | Sorted by |
|---|---|
| `lowest_installment` | monthly instalment ascending |
| `lowest_interest` | effective rate ascending |
| `fastest_approval` | partner bank first, then fewest required documents |
| `least_paperwork` | fewest required documents, then partner bank |

Every arm then falls through the same two tiebreaks — partner bank (`bankIsFeatured`), then
`programCode` — so the order is total and deterministic across runs.

Two details are worth knowing because they are easy to get wrong:

**`fastest_approval` is the majority case, not an edge.** The priority question is optional, and all
four mobile apply mappers default an unmapped answer to it. It used to sort by the approval score
and nothing else; with the score gone, an arm with no sort key of its own would have degraded to
alphabetical-by-programCode without saying so. It now sorts by two things that are actually true —
there is a live channel with partner banks, and fewer documents is less to collect — and A33 makes
a sort-keyless arm a review block. Partner-first rather than documents-first keeps it
distinguishable from `least_paperwork`, which the customer chose *between*.

**On apply, the order is frozen, not re-derived.** `bank_offer.rankIndex` (Int, 0-based, dense
within one application) stores the position `rankOffers` produced, and every read of a persisted
offer orders by it. This is Principle I / A6: the order the customer saw is part of what an
immutable offer means, and re-sorting later — from a changed priority, a bank's featured flag being
toggled, or a re-quote — would rewrite history. It is also simply necessary: all of an application's
offers are written in one transaction, so `createdAt` is identical across them and cannot rank
anything.

**The preview persists nothing**, so it has no `rankIndex`. It applies the same key chain in memory:
instalment ascending, with programs that could not be priced sorted **last** — a null instalment
means "we could not price this yet", not "this one is free" — then partner bank, then `programCode`.

---

## Part 5 — The rules that trip people up

**A question code is forever.** Renaming a question's wording is fine. The code is generated once
and referenced by every stored answer and every binding.

**`isRequired` is global, not per category.** Making a question required makes it required of every
category that asks it. Widening a *required* question into a new category is the sharpest edge here:
apply enforces against the live assignments while the customer is served a frozen snapshot, so it
can refuse every in-flight application in that category until the publish lands.

**Unticking a category is a real change to what is asked, immediately after publish.** It does not
affect stored applications — their snapshot is frozen — but it does silently stop a surrogate fact
from ever being answered, which is why the publish check reports a fact asked by nobody.

**Deactivating a question does not un-ask it.** Stored answers reference it (`application_answer` is
`RESTRICT` on the question), so a question with real answers cannot be hard-deleted, only switched
off — and its code stays reserved.

**A seed can switch questions off behind you.** `prisma:seed` deactivates every question not in its
own pool, and the blueprint seed does not bring them back. Questions created by a product blueprint
have to be re-activated from the rows that reference them, never hand-typed.

**Nothing here has ever been checked against a real bank decision.** That was true of the score, and
it is why the score is gone. It stays true of everything the platform still shows: the figures are
arithmetic on the bank's own published terms, and the order is the customer's own stated preference.
Neither claims to predict what a bank will do.

---

## Where to look in the code

| Thing | File |
|---|---|
| Questions, publish, snapshot, the asked set (`resolveAnswers`) | `backend/src/questionnaire/questionnaire.service.ts` |
| Branching rule (shared by preview + apply) | `backend/src/questionnaire/validation/question-visibility.ts` |
| Per-type answer validation | `backend/src/questionnaire/validation/question-type-rules.ts` |
| Money bindings (the four bound number answers) | `backend/src/matching/pipeline/money-field-bindings.ts` |
| Answers → surrogate facts (shared by preview + apply) | `backend/src/matching/pipeline/surrogate-facts-from-answers.ts` |
| Surrogate fact registry + binding warnings | `backend/src/matching/pipeline/surrogate-fact-registry.ts`, `…/surrogate-fact-bindings.ts` |
| **Offer order — the one authority** | `backend/src/matching/pipeline/ranking.ts` |
| Quoting one program | `backend/src/matching/pipeline/quote.ts` |
| Live preview (in-memory order) | `backend/src/matching-preview/matching-preview.service.ts` |
| Apply + persist offers (writes `rankIndex`) | `backend/src/applications/applications.service.ts` |
| Reading persisted offers back (`orderBy rankIndex asc`) | `backend/src/applications/application.repository.ts` |
| Question editor (admin) | `admin/src/app/features/questionnaire/questionnaire-editor.page.ts` |
| Category assignment (admin) | `admin/src/app/features/questionnaire/question-categories.page.ts` |
| Matching simulator (admin, persists nothing) | `admin/src/app/features/questionnaire/matching-simulator.page.ts` |

Related: [matching-engine-review.md](matching-engine-review.md) — the review that led to the score's
removal, with a dated resolution recording which of its findings died with the feature and which are
still open.
