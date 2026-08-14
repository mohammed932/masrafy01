# Feature Specification: Income-Surrogate Rule Builder (Admin)

**Feature Branch**: `011-surrogate-admin-panel`
**Created**: 2026-08-13
**Status**: Draft
**Input**: User description: "check the current implementation and find a way to implement the surrogate in current admin panel — make code clean, logic smooth, and the UI follow the current soul of the admin" — assessed against the *Surrogate Admin Panel — Design* document.

## Context: What Exists Today

Findings from reading the current implementation. **This feature is not greenfield.** The surrogate engine already runs; what is missing is the admin's ability to feed it and the customer's ability to answer it. Two of the design document's headline proposals are already done, and one of its core assumptions is wrong.

| Area | Today | Gap this feature closes |
|---|---|---|
| **Program type** | `income_proof` / `income_surrogate` is a first-class program type on every bank program. | The column is correct; **the data is not.** The three programs that actually carry a surrogate table (armed forces, university staff, doctors in practice) inherit the default type `income_proof` and were never re-typed, so a type-gated rule section would hide the very rows this feature exists to edit. They must be re-typed as part of this feature. |
| **The "Income-surrogate program" checkbox** | **Already removed.** The admin form derives surrogate mode from the program-type dropdown (`incomeSurrogateActive` is a `computed()` off `identity.programType`), with an in-code note that a second flag would drift. | None. The design document's "remove the checkbox" instruction is stale. |
| **Surrogate calculation** | **Already built and running.** Ten strategies resolve a monthly income from a fact about the applicant: years in job, years in practice, professor rank, military grade, certificate value, total deposits, car installment, car loan amount, credit-card limit, bank-statement balance. The result is combined with any declared salary by a per-program rule (use the greater, use the lesser, or replace). | None to the maths. The engine is correct and stays as it is. |
| **Admin entry for the rule** | **Half-built.** The method dropdown lists all ten strategies, but only the four single-number methods (car-installment multiplier, car-loan percent, credit-card multiplier, bank-statement percent) have an input. The six **table** methods — rank, military grade, years in job, years in practice, certificate value, total deposits — fall through to a placeholder reading *"Detailed strategy tables (years bands, rank/grade maps, CD bands) land in the next increment."* | **The admin cannot type a table at all.** An admin can pick "by military grade", save, and ship a program whose grade table is empty — so it silently produces no income. This is the primary gap. |
| **The fact the rule reads** | The application request already accepts `professorRank`, `militaryGrade`, `yearsInPractice` and `creditCardLimitEGP`. | **Nothing ever sends them.** No questionnaire question asks for a rank, a grade, years in practice or a card limit, and every category's answer mapper submits an empty assets payload. The customer-side half of the loop does not exist, so today every table method resolves to nothing and falls back to a declared salary the applicant does not have. |
| **Tier-key picker** | A component already exists that renders a dropdown of registry-managed keys (ranks, grades, employment types) and fails closed when the registry is unreachable. Its own comment says it was built for "tier-map editors in the next increment". | None — it is the intended building block, currently unused. |
| **Program lifecycle** | One on/off switch (`active`). No draft / pending-review / paused / archived states. | The design document assumes a four-state lifecycle. Not needed: "cannot go live" maps cleanly onto "cannot be switched on". |
| **Marking guessed numbers** | Does not exist in any form. The bank source files mark guesses with an emoji in a spreadsheet; nothing carries into the system. | Whole capability is new. |
| **Verifying a rule before saving** | An admin simulator exists that runs a sample applicant against programs, but it lives on a separate screen and cannot be reached while editing the rule. | No way to check a table while typing it. A mistyped rank income is discovered by a customer. |

**The one-line summary**: the engine can calculate, the admin cannot configure, and the customer is never asked. This feature joins the three.

## Clarifications

### Session 2026-08-13

- Q: Who supplies the fact the rule reads (army rank, years in practice, credit-card limit)? → A: **The customer, in the app.** These become normal questionnaire questions answered by the customer; no new staff screen and no agent-entered path. The bank verifies on paper at its own stage.
- Q: Which of the three rule families do we build now? → A: **Income-producing rules only.** Rules that yield a monthly income, after which the existing debt-burden and affordability maths run unchanged. Rules that yield a loan amount directly (asset tier, balance tier, down-payment tier) and rules that yield a maximum installment (percent of existing installment, buyout formula) are **out of scope**.
- Q: What happens to a program that still contains a number the team invented rather than took from the bank? → A: **Mark each number, block, and list.** Every number carries a source marker (bank-stated or team-estimated); a program holding any estimated number cannot be switched on; all such programs appear together on one "waiting for the bank" list.
- Q: A customer fits several surrogate programs at once — how are they ordered? → A: **Unchanged.** Results keep today's ordering by match score. This feature adds no new ranking rule.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin types the bank's own table (Priority: P1)

An operations admin opens a personal-loan program whose type is income-surrogate and reaches the income-rule section. They pick the method the bank actually uses — say "by military grade" — and a table appears. They add a row per grade, picking the grade from a managed list and typing the monthly income the bank assigns to it. For a years-based method they instead type bands ("5 to 8 years → 30,000"), with the last band open-ended. They save, and the program now produces that income for that applicant.

**Why this priority**: Without it the other stories have nothing to operate on. It is also the single defect most likely to reach a customer today, because the form lets an admin pick a table method and save an empty table with no warning. Delivers value alone: four real bank programs (armed forces, university staff, doctors, engineers) become configurable the day it ships.

**Independent Test**: Configure a grade table on one program, run the existing admin simulator with a sample applicant carrying that grade, and confirm the resolved income equals the table row.

**Acceptance Scenarios**:

1. **Given** an income-surrogate personal-loan program, **When** the admin picks a rank-based or grade-based method, **Then** a table appears where each row is a key chosen from the managed list plus a monthly income, and the same key cannot be used twice.
2. **Given** a years-based method, **When** the admin adds bands, **Then** each band is a from-year, a to-year and a monthly income, bands must ascend, must not overlap, must leave no gap, and the last band must be open-ended.
3. **Given** a value-based method (certificate value, deposits), **When** the admin adds bands, **Then** the same ascending, gapless, open-ended-last rules apply to the value ranges.
4. **Given** a table method with no rows, **When** the admin tries to save, **Then** the save is refused and the message names the empty table.
5. **Given** a table row with an income of zero or below, **When** the admin tries to save, **Then** the save is refused naming that row.
6. **Given** an admin switches from one method to another, **When** the switch happens, **Then** the previous method's table is cleared rather than silently retained, and the admin is told it will be cleared before it happens.
7. **Given** a program is not income-surrogate or not a personal loan, **When** the admin views the form, **Then** no surrogate rule section is shown and no surrogate values are saved.
8. **Given** an existing program configured with one of the four single-number methods, **When** this change ships, **Then** it keeps working with its current values untouched.
9. **Given** the managed key list is unreachable, **When** the table renders, **Then** the picker fails closed with a stated reason instead of accepting free text that the engine would never match.

---

### User Story 2 - The customer is actually asked the question (Priority: P1)

A customer choosing a personal loan is asked, inside the normal questionnaire, the fact the bank's rule depends on — their military grade, their academic rank, their years in practice, or their credit-card limit. The answer travels with the application, the rule reads it, and the customer gets a real figure instead of a program that quietly produces nothing.

**Why this priority**: Equal weight to Story 1 and useless without it. Today this half is entirely absent: no question asks for these facts and every category's mapper submits an empty assets payload, so a perfectly configured rank table resolves to nothing for every customer alive. A feature that ships Story 1 alone changes no customer's result.

**Independent Test**: Publish a questionnaire containing a grade question, answer it as a customer, submit, and confirm the produced offer's income equals the configured table row for that grade — and that the same customer answering nothing gets the documented no-figure outcome, not a silent zero.

**Acceptance Scenarios**:

1. **Given** a published questionnaire with a question bound to a surrogate fact, **When** the customer answers it, **Then** the answer reaches the rule and the resolved income appears in the resulting offer.
2. **Given** a surrogate fact asked as a choice question, **When** the customer picks an option, **Then** the option identifiers are the same managed keys the admin picked from, so a rename on one side cannot silently break the match.
3. **Given** a surrogate fact asked as a number question, **When** the customer enters a value, **Then** the entered figure is used exactly, with no bucket approximation.
4. **Given** a customer who is not asked the fact (the question is not assigned to their loan category), **When** matching runs, **Then** programs depending on that fact produce no figure and say so in plain language, and are neither hidden nor shown with a zero.
5. **Given** a customer who skips an optional surrogate question, **When** matching runs, **Then** the outcome is identical to case 4 — never a substituted default.
6. **Given** a rule whose bound question has been deleted or renamed, **When** an admin views the program, **Then** the program is reported as misconfigured naming the missing question, before any customer meets it.
7. **Given** any surrogate figure shown to a customer, **When** it renders, **Then** it carries the existing indicative-estimate disclaimer; it is never presented as a bank decision.

---

### User Story 3 - Admin checks the rule before anyone else sees it (Priority: P2)

While still editing the table, the admin types a sample applicant — a grade, a tenor — into a small panel below it and immediately sees what the rule produces: the surrogate income, the debt-burden percentage applied, the affordable installment, the estimated loan, and whether the applicant would qualify. A wrong number in the table is obvious on the spot.

**Why this priority**: The safety net that makes Story 1 trustworthy, but Story 1 delivers value without it. It is also the cheapest way to catch a mistyped income before it becomes a customer-facing quote.

**Independent Test**: Enter a sample applicant against a saved table and confirm every displayed figure traces to a configured value, and that changing one table row changes the panel's output without saving.

**Acceptance Scenarios**:

1. **Given** a filled table and a sample applicant, **When** the admin runs the check, **Then** the panel shows the surrogate income, the debt-burden percentage used, the affordable installment, the estimated loan amount and a qualify / does-not-qualify outcome.
2. **Given** an unsaved edit to a table row, **When** the admin runs the check, **Then** the check uses the edited value, so it tests what is on screen rather than what is stored.
3. **Given** a sample applicant whose value matches no row, **When** the check runs, **Then** it states that no row matched rather than showing a zero income.
4. **Given** any check, **When** it completes, **Then** nothing is saved — no application, no lead, no offer.
5. **Given** the same inputs, **When** the same applicant is later run through the existing admin simulator, **Then** the figures agree.

---

### User Story 4 - Guessed numbers can never go live (Priority: P2)

Beside each number the admin types sits a small marker: *the bank stated this* or *we estimated this*. A program holding any estimated number cannot be switched on — it saves and stays editable, but customers never see it. One page lists every program blocked this way, so the team knows exactly what to ask each bank for.

**Why this priority**: Converts a spreadsheet emoji and a paragraph of disclaimer into something the system enforces. High value, but a program with correct numbers ships fine without it — hence P2, not P1.

**Independent Test**: Mark one income in a table as estimated, attempt to switch the program on, confirm it is refused naming that value, confirm the program appears on the waiting list, then change the marker to bank-stated and confirm it switches on.

**Acceptance Scenarios**:

1. **Given** any number the admin types on a bank program, **When** it is entered, **Then** it carries a source marker and the marker is visible without opening anything.
2. **Given** a program with at least one estimated number, **When** the admin tries to switch it on, **Then** the attempt is refused and the message names every estimated value.
3. **Given** the same program, **When** the admin saves it switched off, **Then** the save succeeds — estimated values never block editing, only going live.
4. **Given** a program that is already live, **When** an admin changes one of its numbers to estimated and saves, **Then** the program is switched off in the same action and the reason is recorded, so an estimate can never sit live.
5. **Given** any program blocked by an estimate, **When** the team opens the waiting list, **Then** the program appears with its bank, the estimated fields named, and how long it has been waiting.
6. **Given** programs that existed before this change, **When** it ships, **Then** they keep working unchanged and are listed once for review rather than switched off in bulk.
7. **Given** a marker change, **When** it is saved, **Then** the change is recorded with who made it and when.

---

### Edge Cases

- Method selected but its table is empty → save refused (never a program that resolves to nothing in silence).
- Two rows carrying the same key → save refused naming the duplicate.
- Bands that overlap, leave a gap, descend, or lack an open-ended last band → save refused naming the offending band.
- Applicant's value falls in no band → no figure and a stated reason; never zero income, never a fallback to the nearest band.
- Applicant supplies the fact but the program's method reads a different fact → that program produces no figure; other programs are unaffected.
- Applicant has both a declared salary and a surrogate result → the program's existing combination rule decides which is used; the offer records which one won and why.
- Surrogate income resolves below the program's own minimum income → the program is still listed (eligibility gating stays out of matching) with a plain-language reason instead of figures.
- A managed key is deleted from the registry while a saved table still references it → the program is reported as misconfigured naming the dead key; no customer is matched on it in the meantime.
- Every number in a table is marked estimated → the program is blocked and every one of them is named, not just the first.
- Debt-burden override left empty → the platform default applies, and the panel and the offer both state which value was used.
- A non-personal-loan program somehow carries surrogate values (legacy data) → the values are ignored by matching and reported to the admin rather than silently applied. They are **never deleted**: a save that hides a section must not destroy the configuration behind it, because the fix may be to re-type the program rather than to discard its table.
- Admin switches program type away from income-surrogate on a program that has a table → the table is cleared, and the admin is warned before it happens.

## Requirements *(mandatory)*

### Functional Requirements

**Scope boundary**

- **FR-001**: Surrogate rule entry MUST appear only when the program is a personal loan **and** its type is income-surrogate. It MUST NOT appear for car, mortgage or business programs.
- **FR-002**: The system MUST NOT introduce a second flag meaning "this is a surrogate program". Surrogate mode is derived from the program type and from nothing else.
- **FR-003**: Only methods that produce a **monthly income** are in scope. Methods producing a loan amount directly, or a maximum installment, MUST NOT be added by this feature.
- **FR-004**: The maths that turns a resolved income into an installment, an affordable amount and an offer MUST remain unchanged; this feature only supplies the income.

**Entering the rule**

- **FR-005**: Every method the system can execute MUST have a working entry form. No method may be selectable while its configuration is unreachable.
- **FR-006**: Key-based methods (academic rank, military grade) MUST be entered as a table of rows, each row one key plus one monthly income. Keys MUST come from the managed registry list, never free text, and MUST be unique within the table.
- **FR-007**: Range-based methods (years in job, years in practice, certificate value, deposits) MUST be entered as ordered bands, each band a lower bound, an upper bound and a monthly income, with the final band open-ended.
- **FR-008**: Bands MUST be validated as ascending, non-overlapping and gapless, and the save MUST be refused naming the offending band when they are not.
- **FR-009**: A table method saved with no rows MUST be refused.
- **FR-010**: Every monthly income in a table MUST be greater than zero.
- **FR-011**: Changing the method MUST clear the previous method's configuration, and the admin MUST be told before the clearing happens.
- **FR-012**: Each program MUST be able to override the debt-burden percentage used with its surrogate income; left empty, the platform default applies and the applied value MUST be stated wherever a figure is shown.
- **FR-013**: A rule MUST be able to carry the extra documents its method requires, chosen by the admin from the managed document list rather than declared in code, and the admin MUST be warned — not blocked — when those documents are absent from the program's own document list.
- **FR-014**: The rule's stored shape MUST be one self-describing object per program naming the method and its configuration, so adding a method later requires no change to how programs are stored.
- **FR-015**: Existing programs configured with the four already-working single-number methods MUST keep their values and behaviour with no admin action.

**Asking the customer**

- **FR-016**: Four facts MUST be askable as normal questionnaire questions in this increment — military grade, academic rank, years in practice, and total credit-card limit — each assigned to the loan categories that need it and answerable by the customer with no staff involvement. The remaining facts (certificate value, total deposits, car installment, car loan amount, bank-statement balance) stay **configurable but unasked**: their rules save and validate normally, and an applicant who was never asked yields the stated reason FR-020 requires. Asking them is a later increment, not a defect of this one.
- **FR-017**: A choice-based fact MUST use the same managed keys the admin selects from, so the two sides cannot drift apart.
- **FR-018**: A numeric fact MUST use the customer's entered figure exactly; no bucket-to-representative-value approximation may be applied.
- **FR-019**: The answer MUST travel with the application to the rule; the current behaviour of submitting an empty asset set MUST be corrected.
- **FR-020**: A missing or unanswered fact MUST produce no figure and a stated reason. No default, no zero, and no substituted value may be used in its place.
- **FR-021**: A rule bound to a question that no longer exists MUST be reported to admins as misconfigured, naming the question, and MUST NOT silently resolve to nothing.
- **FR-022**: Programs that cannot produce a figure MUST still be listed to the customer with a plain-language reason — eligibility gating stays out of matching.
- **FR-023**: Every surrogate-derived figure shown to a customer MUST carry the existing indicative-estimate disclaimer and MUST NOT be worded as a bank decision or a guarantee.
- **FR-024**: Result ordering MUST be unchanged. This feature introduces no new ranking rule.
- **FR-025**: All new customer-facing wording MUST be available in Arabic and English.

**Checking before it ships**

- **FR-026**: The admin MUST be able to run a sample applicant against the rule from within the editing screen, without saving and without navigating away.
- **FR-027**: The check MUST show the resolved surrogate income, the debt-burden percentage applied, the affordable installment, the estimated loan amount and the qualify outcome. **"Qualifies" means exactly one thing**: the sample applicant's affordable installment covers the installment the requested amount implies at the program's own rate and term. It MUST NOT consult any eligibility rule (minimum income, age, employment type) — eligibility gating stays out of matching, and the check must not become the one place it returns.
- **FR-028**: The check MUST evaluate what is currently on screen, including unsaved edits.
- **FR-029**: The check MUST persist nothing.
- **FR-030**: The check and the existing admin simulator MUST produce identical figures for identical inputs.
- **FR-031**: A sample value matching no row MUST be reported as no-match, never as a zero income.

**Marking guessed numbers**

- **FR-032**: Every number an admin enters on a bank program MUST carry a source marker with exactly two values: stated by the bank, or estimated by the team. "Every number" is exhaustive — the rule's own incomes and band edges, pricing, fees, loan limits, terms, eligibility thresholds and performance criteria alike. A number that cannot be marked can never block going live, so a partial list would silently exempt whatever it omits.
- **FR-033**: A program holding at least one estimated number MUST NOT be switchable on, and the refusal MUST name every estimated value, not the first.
- **FR-034**: An estimated number MUST NOT block saving or editing — only going live.
- **FR-035**: Changing a live program's number to estimated MUST switch that program off in the same action, with the reason recorded.
- **FR-036**: A single list MUST show every program blocked by an estimate, with its bank, the fields concerned, and how long it has been waiting.
- **FR-037**: Programs that existed before this change MUST keep working; they MUST be reported once for review rather than switched off in bulk.
- **FR-038**: Every marker change MUST be recorded with the editor's identity and the time.
- **FR-039**: The system MUST NOT introduce draft / pending-review / paused / archived states. "Cannot go live" is expressed through the existing on/off switch.

**How it looks and behaves**

- **FR-040**: The rule builder MUST be built from the admin dashboard's existing components, spacing scale, colour tokens and form patterns. It MUST NOT introduce a new visual language, a new table style, or raw colour or spacing values.
- **FR-041**: The rule section MUST sit inside the existing program form's section rhythm at one level of nesting — no panel inside a panel inside a card.
- **FR-042**: Every control MUST have a visible label (never a placeholder standing in for one), and a visible resting, hover, focus, active and disabled appearance.
- **FR-043**: Row-level validation MUST surface as the admin leaves a field, not only on save, and the message MUST name the offending row.
- **FR-044**: The layout MUST work in both Arabic and English reading directions, using direction-neutral spacing throughout.
- **FR-045**: An empty table MUST state what to do next, not merely that it is empty.
- **FR-046**: Adding, removing and reordering rows MUST be possible with a keyboard alone, and the check panel MUST be reachable in the same tab order as the table it belongs to.
- **FR-047**: The check panel's result MUST appear in place, without a page navigation and without a full-screen blocking state.
- **FR-048**: Any motion used MUST be brief and directional, and MUST be suppressed for readers who have asked for reduced motion.

### Key Entities

- **Surrogate Rule**: The bank's own written method for turning one fact about an applicant into a monthly income. Belongs to exactly one bank program. Holds the method, its configuration (a key table or a set of bands), an optional debt-burden override, and any extra documents the method demands.
- **Rule Row**: One line of a rule. Either a key and an income (rank, grade), or a lower bound, an upper bound and an income (years, values). Rows within one rule are unique by key, or ordered, gapless and open-ended by range.
- **Surrogate Fact**: The single piece of information about the applicant that a rule reads — academic rank, military grade, years in practice, years in job, certificate value, total deposits, credit-card limit, bank-statement balance, car installment, car loan amount. Supplied by the customer as a questionnaire answer.
- **Value Source Marker**: A two-state marker attached to a number on a bank program, recording whether the bank stated it or the team estimated it. Governs whether the program may go live.
- **Rule Check**: A throw-away evaluation of a rule against a sample applicant, showing income, debt-burden percentage, installment, loan amount and outcome. Persists nothing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can configure every one of the in-scope methods end to end with no developer involvement — today five of them cannot be configured at all.
- **SC-002**: Zero programs can be saved in a state where the selected method has no configuration to read. Verified by attempting a save for each method with an empty table.
- **SC-003**: A customer answering a surrogate question receives a figure derived from the configured table, verified across 10 sample applicants spanning every method **asked in this increment** (military grade, academic rank, years in practice, credit-card limit), with each figure traceable to one table row. The configurable-but-unasked methods of FR-016 are verified by the admin check panel instead, not by a customer submission.
- **SC-004**: Zero programs reach a customer holding a number the team invented. Verified by attempting to switch on a program with one estimated value.
- **SC-005**: An admin catches a deliberately mistyped table income using the on-screen check, before saving, in under 60 seconds.
- **SC-006**: Configuring a full rank or grade table (10–15 rows) takes under 5 minutes.
- **SC-007**: The check panel and the existing admin simulator agree on 100% of sample applicants.
- **SC-008**: No applicant ever receives a surrogate figure of zero: an unmatched or unanswered fact yields a stated reason in 100% of cases.
- **SC-009**: Every existing program keeps its current behaviour — verified by comparing offers produced before and after for the full seeded program set.
- **SC-010**: The rule builder introduces no colour, spacing or control style absent from the existing admin dashboard, verified by review against the token set.
- **SC-011**: The rule builder is fully operable by keyboard and reads correctly in both Arabic and English layouts.

## Assumptions

- **The engine is correct and is not rewritten.** The ten strategies, their arithmetic, and the rule combining a surrogate result with a declared salary all stay exactly as they are. This feature supplies configuration and input; it does not change any formula.
- **The design document is treated as a target, not as a description of today.** Three of its items are already resolved and are dropped: removing the surrogate checkbox (already removed), adding a program-type dropdown (already present), and dropping the club-tenure method (that method was never built).
- **The four-state lifecycle is not adopted.** Draft / pending review / active / paused adds states nothing else in the product uses. "Cannot go live" is enforced on the existing on/off switch instead, which is simpler and achieves the same protection.
- **Maker-checker is not reintroduced.** Weight editing moved to direct admin save with the editor recorded; surrogate rules follow the same pattern for consistency.
- **The direct-amount and maximum-installment rule families are deferred**, per the scope decision. The stored rule shape names its method explicitly so those families can be added later without restructuring saved data or re-migrating programs.
- **Value source markers cover the numbers an admin types on a bank program**, with the surrogate rule's own numbers as the strictest case. Programs created before this feature are marked bank-stated and surfaced once for review rather than switched off, so nothing currently live goes dark on deploy.
- **Surrogate facts are asked through the existing questionnaire**, using the question types the questionnaire already supports. No new question type and no new customer screen are introduced.
- **Choice-based facts reuse the managed key registry** that already backs the admin's pickers, so the admin's table keys and the customer's answer options are the same list by construction rather than by convention.
- **Ranking, eligibility gating and the disclaimer rules are untouched.** Every active program in the chosen category is still returned and still ordered by match score.
- **All figures are in EGP**, consistent with the rest of the platform.
- **The signal-based guessing approach stays an internal analysis tool.** Nothing inferred by it is ever presented to a customer as a bank offer.
