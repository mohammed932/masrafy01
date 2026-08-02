# Feature Specification: Simple Program Setup, Banded DBR & Loan Calculator

**Feature Branch**: `010-simple-programs-dbr-calculator`
**Created**: 2026-07-30
**Status**: Draft
**Input**: User description: "check current implementation for banks and bank programs and pre defined programs and DBR and loan calculator and add missing parts or edit already exist one as i wanna experience to be simple and easy as it is MVP" — assessed against the *Bank Programs & Loan Matching (MVP Plan) v3/v4* document.

## Context: What Exists Today

Findings from the current implementation. This feature extends what exists; it does not replace it.

| Area | Today | Gap this feature closes |
|---|---|---|
| **Banks** | Full issuer management (Arabic/English name, logo, website, featured flag, display order, notes). | No bank-level lending policy, so every program re-enters the same bank-wide numbers by hand. |
| **Bank programs** | One record per bank offering, carrying seven configuration blocks (identity, tenor, loan limits, pricing, eligibility, performance criteria, income assumption, fees) — roughly 80 configurable fields on one very long create/edit form. | Program setup is a long data-entry exercise. A handful of fields actually change an offer; the rest are refinements presented with equal weight. No prefill, no duplicate, no "essentials only" path. |
| **Predefined programs** | A Program Catalog of predefined program **names**, category-agnostic (one name is pickable under any loan category), replacing free-text naming. | Names only — no default numbers. Picking "Doctors" or "Payroll" prefills nothing. |
| **DBR** | One flat cap percentage per program, plus a "skip DBR" toggle. Matching computes the debt-burden ratio and, when the requested amount breaks the cap, derives the largest affordable amount instead of rejecting. | Real bank policy sets the cap **by income band** (e.g. 30% under 5K rising to 50% above 30K). One flat number overstates affordability at low incomes and understates it at high ones. |
| **Loan calculator** | Installment, affordability (largest amount within DBR), fees and total-cost math already exist and run when an applicant submits an application. | Nothing exposes that math on its own. The matching **preview** returns approval likelihood with a blank installment and no amount, so customers see a ranked list with no money in it. The admin simulator likewise returns likelihood only — no figures, no explanation of how a figure was reached. |
| **Question types** | Four types are defined (single choice, multiple choice, text, number) and answer storage already has unused text and number columns. Only **single choice** works end to end: the admin builder has no type picker, answer submission accepts exactly one option code, and scoring awards points per option code only. | Multiple choice, text and number questions cannot be built, answered, stored or scored. Because no question can hold a real number, the money figures come from **hard-coded guesses per bucket** in the app (a "150k–500k" answer becomes 300,000), so a customer asking for 500,000 is quoted the payment for 300,000. |
| **Question rendering in the app** | Already server-driven: the four category pages are thin wrappers over one shared view that loads and renders the published questionnaire. That view already recognises all four types but renders only single choice and silently skips the rest. | The shared view renders three of the four types as nothing. Each category also keeps a small code-side mapper holding the bucket-to-number guesses. |

Requested amount, preferred tenor, declared income and existing obligations already reach the engine at submission time — but as bucket approximations, not as figures the customer stated.

## Clarifications

### Session 2026-07-30

- Q: Where do the real numbers for the money math come from? → A: All four question types (single choice, multiple choice, text, number) must work end to end. Number questions supply the real figures the customer states; bucket guesses in app code are retired.
- Q: Does the mobile app build its question screens from the server, or stay hand-built? → A: Keep the current arrangement (no new renderer). Corrected finding: the app is **already** server-driven — the four category pages are thin wrappers over one shared view that renders the published questionnaire, and it already parses all four types but renders only single choice. So the work is to render the other three types in that one shared view. What stays code-side is the small per-category mapper that says which answer is the loan amount, the months, the salary and the current payments.
- Q: What happens to program settings that matching no longer uses? → A: Delete them and their saved values (destructive migration). Kept because they are still used: DBR cap and skip-DBR, the collateral flag, the bank-staff income percentages, the age range, and the minimum income. Everything else in the eligibility and performance-history blocks goes.
- Q: What is included in the monthly payment shown to the customer? → A: Fees are added to the loan and the payment is worked out on that total (today's behaviour). Every quote shows three lines: cash the customer receives, monthly payment, and total fees.
- Q: Where can DBR be set? → A: In all three places — bank lending policy, predefined program default, and the bank program — using one shared band editor. Bank and catalog values only prefill; the program's own value is what the engine uses.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin sets up a bank program in a few minutes (Priority: P1)

An operations admin adds a program for a bank. They pick the bank, a predefined program name from the catalog, and the loan category. The form opens already filled — inherited from the bank's lending policy, then refined by the predefined program's defaults. The admin reviews an **Essentials** section (interest rate, tenor range, amount range, minimum income, DBR, fees, required documents), adjusts what differs, and saves. Everything else lives in an **Advanced** section that can be left untouched.

**Why this priority**: This is the daily bottleneck and the "simple and easy" the request asks for. 20+ programs × ~80 fields is why onboarding a bank is slow. Delivers value with no other story shipped.

**Independent Test**: Create a program for an existing bank using only the Essentials section, save, and confirm it is active and produces offers identical to a hand-filled equivalent.

**Acceptance Scenarios**:

1. **Given** a bank with a saved lending policy and a predefined program name carrying defaults for the personal category, **When** the admin picks bank + program name + category on a new program, **Then** the form is pre-filled with merged values and each field shows whether it is inherited or edited.
2. **Given** a pre-filled form, **When** the admin changes only the interest rate and saves, **Then** every other inherited value is kept and the audit record lists the fields the admin overrode.
3. **Given** a saved program, **When** the bank's lending policy is later changed, **Then** the saved program's own numbers stay unchanged (values are copied at save time, never re-resolved).
4. **Given** an existing program, **When** the admin duplicates it, **Then** a draft copy opens with all values carried over, requiring a new program name before saving.
5. **Given** Essentials complete and Advanced untouched, **When** the admin saves, **Then** the save succeeds with no validation error demanding an Advanced field.
6. **Given** the settings removal has run, **When** the admin opens any program, **Then** no setting is shown that the engine ignores, and every remaining setting changes an offer.

---

### User Story 2 - Customer sees real money in the results list (Priority: P1)

A customer finishes the questionnaire and reaches the results. Each matched program now shows the estimated monthly installment, the amount that program can lend, the tenor used and the total cost — alongside the approval likelihood shown today. Where the requested amount exceeds what a program allows, the card shows the lower amount and says why.

**Why this priority**: A comparison marketplace whose comparison screen shows no installments cannot be compared. The math exists; only the wiring and presentation are missing. Equal weight to Story 1 — one fixes the admin side, the other the customer side.

**Independent Test**: Run the questionnaire against seeded programs and confirm every result card carries an installment, offered amount, tenor and total cost, matching the figures the same customer gets after submitting.

**Acceptance Scenarios**:

1. **Given** a completed questionnaire with a requested amount and tenor, **When** the customer views results, **Then** each program shows monthly installment, offered amount, tenor in months, total amount payable and total cost of credit.
2. **Given** a requested amount above a program's maximum, **When** results render, **Then** that card shows the program's maximum as the offered amount, labelled as reduced to the program's limit.
3. **Given** a requested amount whose installment would breach the program's DBR cap, **When** results render, **Then** the card shows the largest amount within the cap, labelled as adjusted for affordability, and is neither hidden nor rejected.
4. **Given** an applicant whose affordable amount falls below a program's minimum, **When** results render, **Then** the program still appears (no eligibility gating) with a plain-language reason instead of figures.
5. **Given** identical inputs, **When** the customer submits the application, **Then** the offer figures equal the preview figures.
6. **Given** any screen showing figures, **When** it renders, **Then** a persistent disclaimer states the figures are indicative estimates from self-reported data, not a credit offer.

---

### User Story 3 - All four question types work end to end (Priority: P1)

An admin builds a question and picks its type: single choice, multiple choice, text, or number. A number question can carry a unit, a minimum, a maximum, and a step. The customer sees the right control for each type — one-pick list, multi-pick list, free text box, or number box. The answer is saved with its real value. Number answers feed the money math directly, so the loan amount, months, salary and current monthly payments are the customer's own figures, not a bucket guess.

The app already builds its question screens from the published questionnaire, so no new renderer is introduced: the one shared view gains the three missing controls. Admins can add questions and change wording, helper text, options and number bounds, and customers see it without an app update. The one code-side piece that remains is the short per-category mapper naming which answers are the loan amount, the months, the salary and the current payments — changing *that* set needs an app update.

**Why this priority**: Every figure in Stories 1 and 2 is only as good as its input. While the app converts buckets to guessed numbers, a customer asking for 500,000 is quoted the payment for 300,000 — the comparison is wrong no matter how correct the engine is. Also unlocks the multiple-choice and text questions the admin builder already promises.

**Independent Test**: Build one question of each type, publish, answer all four as a customer, and confirm each answer is stored with its real value and shown back correctly in the admin's view of that application.

**Acceptance Scenarios**:

1. **Given** the question builder, **When** the admin creates a question, **Then** they can pick any of the four types, and the fields shown adapt (options list for the two choice types; unit, minimum, maximum and step for number; maximum length for text).
1a. **Given** an admin adds a question of any type and publishes, **When** a customer starts the questionnaire, **Then** the question appears with the right control and no app update is needed.
2. **Given** a published number question with a minimum and maximum, **When** the customer types a value outside the range, **Then** they are blocked with a message naming the allowed range, in their language.
3. **Given** a published multiple-choice question, **When** the customer picks two options and submits, **Then** both picks are stored and both are visible in the admin's view of the application.
4. **Given** a published text question, **When** the customer answers, **Then** the text is stored and shown to admins, and is never used in the money math or the approval score.
5. **Given** number questions for loan amount, months, monthly salary and current monthly payments, **When** the customer answers them, **Then** the money math uses those exact values and no bucket guess is applied anywhere.
6. **Given** an existing published questionnaire made only of single-choice questions, **When** this change ships, **Then** it keeps working unchanged and already-saved answers stay readable.
7. **Given** a question marked required, **When** the customer leaves it empty, **Then** they cannot continue, whatever its type.
8. **Given** a required number question the customer has not answered, **When** results are requested, **Then** the missing figure is reported as missing rather than replaced with a default.

---

### User Story 4 - Customer uses a standalone loan calculator (Priority: P2)

A customer opens a calculator. In "what will it cost" mode they set an amount and a tenor and see the monthly installment, total payable and total cost of credit. In "what can I afford" mode they enter monthly income and existing monthly obligations and see the maximum amount and installment they can carry. Opened from a specific program, it uses that program's rate, tenor limits, amount limits, fees and DBR.

**Why this priority**: High-visibility, self-contained, and the most common pre-application question. Depends only on math that already exists.

**Independent Test**: Open the calculator with no application in progress, change amount and tenor, and confirm the installment updates and matches what the results screen produces for the same inputs.

**Acceptance Scenarios**:

1. **Given** cost mode with an amount, tenor and program, **When** any input changes, **Then** installment, total payable and total cost of credit update without a page reload.
2. **Given** affordability mode with income and obligations, **When** the customer submits, **Then** the maximum affordable amount, its installment, and the DBR percentage used are shown.
3. **Given** an amount or tenor outside the selected program's limits, **When** the customer sets it, **Then** the input is constrained to the program's limits and the applied limit is stated.
4. **Given** the generic (no program) calculator, **When** it opens, **Then** it states the representative rate used and that program-specific rates differ.
5. **Given** a calculator result, **When** it renders, **Then** the fee components included in the figures are itemised (administrative fee, insurance, stamp duty) rather than folded in silently.

---

### User Story 5 - Admin configures DBR by income band (Priority: P2)

An admin opens the DBR setting for a bank or a program and chooses either a single cap (today's behaviour) or a small table of income bands, each with its own cap. Bands ascend; the last is open-ended. Matching picks the band from the income it recognises for the applicant.

**Why this priority**: DBR is the biggest single driver of the amount quoted. Without banding, quoted amounts are wrong across most of the income distribution. Small change, large numeric impact.

**Independent Test**: Configure a banded DBR, run two applicants either side of a band boundary, and confirm caps and resulting amounts differ correctly.

**Acceptance Scenarios**:

1. **Given** bands of 30% ≤5,000, 35% ≤10,000, 40% ≤20,000, 45% ≤30,000, 50% above, **When** recognised income is exactly 10,000, **Then** the 35% cap applies (upper bound inclusive).
2. **Given** the same table, **When** recognised income is 30,001, **Then** the 50% cap applies.
3. **Given** a program with a single flat cap and no band table, **When** matching runs, **Then** behaviour is unchanged from today.
4. **Given** an admin entering bands out of order, with a gap, or without an open-ended final band, **When** they save, **Then** the save is rejected with a message naming the offending band.
5. **Given** a program that inherits DBR from the bank policy and then overrides it, **When** matching runs, **Then** the program's own table is used.
6. **Given** an offer, **When** an admin inspects it, **Then** the record shows which income band resolved and the cap it produced.

---

### User Story 6 - Bank lending policy as the single source of shared numbers (Priority: P3)

A super admin records a bank's general lending policy once: age range, minimum income, DBR (flat or banded), tenor range, minimum months in job, and maximum total unsecured exposure. Programs for that bank inherit these as starting values.

**Why this priority**: Enables Story 1's prefill and removes repeated entry, but Story 1 can ship on predefined-program defaults alone — so this is the lower-priority half of the pair.

**Independent Test**: Save a bank policy, start a new program for that bank, and confirm the policy values appear as the starting point.

**Acceptance Scenarios**:

1. **Given** a bank with no policy recorded, **When** an admin creates a program, **Then** prefill falls back to the predefined program's defaults and the form remains usable.
2. **Given** a bank policy and a predefined program default for the same field, **When** prefill runs, **Then** the predefined program's value wins and each value's origin is shown.
3. **Given** a bank policy edit, **When** saved, **Then** the change is audited and existing programs are untouched.

---

### User Story 7 - Admin verifies a program with a numeric simulation (Priority: P3)

An admin enters a sample applicant (income, obligations, requested amount, tenor, age, employment) and sees, per program, the recognised income, the DBR band and cap applied, the resolved rate, the offered amount, the installment, and which limit bound the result.

**Why this priority**: The safety net for Stories 1 and 4 — how an admin catches a mistyped rate or band before customers see it. Valuable but not customer-facing.

**Independent Test**: Simulate one applicant against a seeded program and confirm every figure traces to a configured value.

**Acceptance Scenarios**:

1. **Given** a sample applicant, **When** the admin runs a simulation, **Then** each program row shows offered amount, installment, rate, DBR used, and the binding constraint (requested amount, program maximum, or affordability).
2. **Given** a simulation, **When** it completes, **Then** nothing is persisted as an application or lead.
3. **Given** a program whose configuration cannot produce a figure (missing rate, empty amount limits), **When** the simulation runs, **Then** it is flagged as misconfigured with the missing setting named.

---

### Edge Cases

- Recognised income is zero or missing → no affordability figure; the program is listed with an explanatory note, never an installment of zero.
- Existing obligations already exceed the DBR allowance → affordable amount is zero; the card states obligations consume the whole allowance.
- Interest rate configured as zero → installment is amount ÷ tenor; no division-by-zero.
- Requested tenor exceeds the program maximum → clamped to the maximum, and the clamp is disclosed.
- Age plus tenor exceeds the bank's maximum age at maturity → tenor shortened to fit and the shortening disclosed; if no permitted tenor remains, no figures for that program.
- Program amount limits inverted (minimum above maximum) → save rejected.
- A saved program still holding values for a removed setting at migration time → the values are dropped and the count of affected programs is reported, not silently swallowed.
- DBR band table with one band → treated as a flat cap.
- A predefined program name serving several categories → defaults are per category; a category the name does not serve is not offered.
- Deactivating or deleting a predefined program name that programs were created from → existing programs unaffected (values were copied); the name stops appearing for new programs.
- A currency requested that the program does not list → no figures for that program, with the currency mismatch stated.
- Rounding: figures round for display only; identical inputs always yield identical displayed figures across calculator, preview and submitted offer.

## Requirements *(mandatory)*

### Functional Requirements

**Predefined programs (catalog with defaults)**

- **FR-001**: Each predefined program name MUST be able to carry default lending values per loan category (all four are offered; a category left empty prefills nothing) — interest rate, tenor range, amount range, minimum income, minimum months in job, age range, DBR setting, fee percentages, and required documents.
- **FR-002**: Predefined program defaults MUST be editable by an admin with catalog permission, and every edit MUST be audited with the editor's identity.
- **FR-003**: Predefined program defaults MUST be optional per field; a name with no defaults MUST behave exactly as the name-only catalog behaves today.
- **FR-004**: The system MUST ship seeded defaults for the archetypes already in use (payroll, salaried, self-employed with income proof, doctors, university professors, affluent, secured-by-deposit, property-related, membership and mobile-bill surrogates, educational, bankers), so a fresh install has usable prefill.

**Bank lending policy**

- **FR-005**: A bank MUST be able to record one lending policy: age range, minimum income, DBR setting, tenor range, minimum months in job, and maximum total unsecured exposure.
- **FR-006**: The bank lending policy MUST be optional; banks without one MUST remain fully usable.
- **FR-007**: Bank policy edits MUST be audited and MUST NOT alter any already-saved program.

**Program setup experience**

- **FR-008**: When an admin selects bank + predefined program name + loan category on a new program, the system MUST return a merged starting set of values in which the predefined program's defaults override the bank policy's.
- **FR-009**: Merged values MUST be copied into the program on save, so the program is thereafter self-contained and never re-resolves inherited values.
- **FR-010**: Each pre-filled field MUST show its origin (bank policy, predefined program, or admin override) while the form is open.
- **FR-011**: The program form MUST separate an **Essentials** group — interest rate, tenor range, amount range, minimum income, DBR, fees, required documents, active flag — from an **Advanced** group holding every other setting, with Advanced collapsed by default.
- **FR-012**: Saving MUST succeed with only Essentials completed; no Advanced field may be mandatory.
- **FR-013**: Admins MUST be able to duplicate an existing program into a new draft carrying all values, requiring only a new name and identifier.
- **FR-014**: Program create and edit MUST reject a save whose amount range, tenor range, or age range is inverted or empty, naming the offending field.
- **FR-015**: A program MUST be creatable end to end without opening the Advanced group, and the result MUST produce offers.
- **FR-015a**: Program settings that matching no longer reads MUST be removed from the program record, the admin form, and stored data. The removal list is: accepted employment types, accepted loan purposes, accepted salary-transfer types, accepted company types, minimum months in job, the self-employed age and income variants, and every "requires …" flag except the collateral flag (deposit, car loan at this bank, car loan elsewhere, credit card elsewhere, compound property, club membership, existing loan, verification, qualitative review, no-documents), minimum bank-statement balance, minimum declared assets, credit-card holding months, competitor-card-unsecured flag, and the whole performance-history block (months on book, bucket-1 and bucket-2 history, required current-loan status).
- **FR-015b**: Settings that MUST be kept because they are still used: DBR cap and skip-DBR, the collateral flag (it drives fees), the two bank-staff income percentages (they drive recognised income), the age range (it shortens tenor), and the minimum income (it selects the DBR band and is shown to the customer).
- **FR-015c**: The removal MUST be a named, reviewed migration, MUST be preceded by a database backup, MUST require an explicit go-ahead from the product owner before it is run, and MUST be listed in the release notes as data-destroying.
- **FR-015d**: After removal, no program may show a setting the engine ignores; the Advanced group MUST contain only settings that change an offer.

**DBR**

- **FR-016**: DBR MUST be configurable either as one cap percentage or as an ordered table of income bands, each band an upper bound plus a cap percentage, with the final band open-ended.
- **FR-017**: Band upper bounds MUST be inclusive, and bands MUST be validated as ascending, gapless, and terminated by an open-ended band.
- **FR-018**: Matching MUST resolve the applicable cap from the applicant's recognised income before computing affordability.
- **FR-019**: Cap percentages MUST be constrained to 1–100.
- **FR-020**: Existing flat-cap programs MUST keep working with no admin migration action, and the existing "skip DBR" behaviour MUST be preserved where used.
- **FR-021**: Every produced offer MUST record the income band that resolved, the cap applied, and the resulting affordability figure.
- **FR-021a**: The same DBR editor MUST be usable in three places — bank lending policy, predefined program default, and bank program — with identical validation rules in each.
- **FR-021b**: Matching MUST read DBR from the bank program only. Bank-policy and predefined-program values MUST act purely as prefill and MUST never be consulted at match time.

**Question types (end to end)**

- **FR-037**: All four question types — single choice, multiple choice, text, number — MUST be creatable in the admin builder, answerable by the customer, stored with their real values, and readable back by admins.
- **FR-038**: A number question MUST support an optional unit label, minimum, maximum, and step, and MUST reject an answer outside those bounds with a message naming the allowed range.
- **FR-039**: A text question MUST support a maximum length and MUST never contribute to the money math or the approval score.
- **FR-040**: A multiple-choice question MUST store every option the customer picked.
- **FR-041**: The approval score MUST keep its current rule — points per picked option, weights adding to 100 across the questions a program scores on. Multiple-choice, text and number questions MUST NOT be assignable to a program's score (a multi-pick answer has no single picked score, and changing the formula would need a constitution amendment), and MUST NOT change any existing score.
- **FR-042**: The four figures used by the money math — loan amount, number of months, monthly salary, current monthly loan payments — MUST come from number questions, and the bucket-to-guessed-number conversion MUST be removed from the apps.
- **FR-043**: A required question MUST block submission when unanswered, for every type.
- **FR-044**: A number answer needed by the money math that is missing MUST be reported as missing; no default value may be substituted.
- **FR-045**: Questionnaires already published with single-choice questions only MUST keep working unchanged, and answers already saved MUST stay readable.
- **FR-046**: Every new validation message for question types MUST be available in Arabic and English.
- **FR-047**: The app's shared questionnaire view MUST render every one of the four types with the matching control, and MUST reflect admin edits to wording, helper text, options and number bounds — and admin-added questions — without an app update.
- **FR-048**: The four money figures MUST be bound to question codes in one declared place per category, and a missing or renamed bound question MUST surface as a clear configuration error to admins rather than a silent zero in a quote.
- **FR-049**: Publishing MUST warn the admin, naming the question, when a published question is of a type the app cannot render or is bound to a money figure that no longer exists.

**Figures in results**

- **FR-022**: Matching results MUST include, per program, the monthly installment, offered amount, tenor used, total amount payable, total cost of credit, effective rate, and itemised fees — in addition to the approval likelihood shown today.
- **FR-022a**: Fees MUST be added to the loan and the monthly installment MUST be worked out on that total. Every quote MUST show three plain figures: the cash the customer receives, the monthly payment, and the total fees added — so the difference between the loan asked for and the cash received is never hidden.
- **FR-022b**: The affordability check MUST use the same installment the customer is shown, so a quote can never be presented that breaks its own DBR cap.
- **FR-023**: When the offered amount is below the requested amount, results MUST state which constraint reduced it: the program's maximum, or affordability under DBR.
- **FR-024**: Programs that cannot produce figures MUST still be listed (eligibility gating stays out of matching), with a plain-language reason in place of figures.
- **FR-025**: Preview figures and submitted-application figures MUST be identical for identical inputs.
- **FR-026**: Every screen showing figures MUST carry a disclaimer that they are indicative estimates from self-reported data, not a credit offer.

**Loan calculator**

- **FR-027**: Customers MUST be able to compute, for a given amount and tenor, the monthly installment, total payable, and total cost of credit.
- **FR-028**: Customers MUST be able to compute, from monthly income and existing monthly obligations, the maximum amount they can borrow and its installment, using the applicable DBR cap.
- **FR-029**: The calculator MUST be openable against a specific program, in which case that program's rate, limits, fees and DBR apply, and inputs MUST be constrained to that program's limits with any clamp disclosed.
- **FR-030**: The generic calculator (no program selected) MUST state the representative rate used and that program rates differ.
- **FR-031**: Calculator output MUST itemise the fee components folded into the figures.
- **FR-032**: The calculator MUST be reachable from the results list and from a program's detail view, and MUST work with no application in progress.
- **FR-033**: All customer-facing labels and messages MUST be available in Arabic and English.

**Admin simulation**

- **FR-034**: Admins MUST be able to run a sample applicant against active programs and see, per program, recognised income, resolved rate, DBR band and cap, offered amount, installment, and the binding constraint.
- **FR-035**: Simulations MUST persist nothing.
- **FR-036**: Programs whose configuration cannot produce figures MUST be reported as misconfigured, naming the missing setting.

### Key Entities

- **Predefined Program (catalog entry)**: A reusable program archetype — name (Arabic/English), usable under any loan category, plus optional per-category default lending values used only as prefill.
- **Bank Lending Policy**: One optional record per bank holding the bank's general lending numbers; used only as prefill and as the lower-priority layer of the merge.
- **Bank Program**: An individual bank's offering. Role unchanged; gains an income-banded DBR option and self-contained copied values, and its settings are regrouped into Essentials and Advanced for editing purposes only.
- **DBR Setting**: Either one cap percentage or an ordered set of (income upper bound, cap percentage) bands with an open-ended final band. Attachable to a bank policy, a predefined program default, or a bank program.
- **Question**: A questionnaire item with a type (single choice, multiple choice, text, number), its wording in Arabic and English, whether it is required, and type-specific rules — options for the choice types; unit, minimum, maximum and step for number; maximum length for text.
- **Answer**: A customer's response to one question, holding the picked option(s), the typed text, or the entered number, whichever the question's type calls for.
- **Calculation Result**: A non-persisted set of figures for one program and one set of applicant inputs — recognised income, DBR band and cap, offered amount, tenor, installment, fees, total payable, total cost, and the binding constraint.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin who has done it once can create a complete, offer-producing bank program in under 3 minutes, touching at most 8 fields.
- **SC-002**: At least 80% of a newly created program's values come from prefill rather than typing.
- **SC-003**: 100% of programs on a customer results screen show a monthly installment and an offered amount, or a stated reason why they cannot.
- **SC-004**: Preview figures and submitted-offer figures match exactly for 100% of test applicants (10 golden profiles).
- **SC-005**: Customers reach an installment figure from the calculator in under 30 seconds and 3 inputs or fewer.
- **SC-006**: DBR band resolution is correct at every band boundary, verified at exact-boundary incomes on both flat-cap and banded programs.
- **SC-007**: Onboarding a bank's full program set (12–14 programs) takes under one working hour, down from a day.
- **SC-008**: No saved program depends on live inheritance — changing a bank policy or a predefined program's defaults changes no existing program's figures.
- **SC-009**: Every offer figure traces to its inputs (income basis, band, cap, resolved rate, binding constraint) from the admin record, with no manual recomputation.
- **SC-010**: Zero guessed figures remain: every amount, tenor, salary and obligation used in a quote is the value the customer entered, verifiable by comparing the answer record to the quote for 10 test applicants.
- **SC-011**: An admin can build, publish and see in the app a working question of each of the four types without developer help.

## Assumptions

- **No new questionnaire renderer is built.** The app's existing shared, server-driven view is extended with the three missing controls; the four thin category wrappers stay as they are. Accepted residual limit: which answers feed the money math is declared in code per category, so changing that binding needs an app update.
- **Scope is a refactor of what exists**, not a rewrite: the current program record, matching engine, installment and affordability math, program catalog, and bank management are kept and extended.
- **Categories stay at four** (personal, car, mortgage, business) per the constitution's scope lock. Credit cards are a separate math path in the source plan and are **out of scope** here.
- **Only new-money applications** are supported. Top-up, buyout and cross-sell purposes are excluded — they depend on credit-bureau and per-bank history the platform cannot verify.
- **Eligibility gating stays out of matching**, per the current constitution: every active program in the chosen category is returned and ranked by approval likelihood. Program limits and DBR shape the *amount* shown, never whether a program is listed.
- **Figures use the recognised income the engine already derives** (declared income adjusted by the program's configured income assumption). No new income-derivation methods (statement forensics, new imputed grids, obligation-inverse) are introduced.
- **Calculator inputs come from number questions**: amount, months, salary and current monthly payments are asked as number questions inside the existing questionnaire flow — no extra screen is added, and the existing bucket-to-guess conversion is retired. The standalone calculator collects them on its own screen and may prefill from the customer's last application.
- **The calculator is for signed-in customers only**, consistent with the platform's no-guest rule. A public pre-login calculator is out of scope.
- **Employer tiering, verification workflow tracking, and guarantors stay out of scope**; where a program's numbers depend on employer tier, the lowest tier is assumed and the customer is told a better tier may apply.
- **The representative rate used by the generic calculator** is a configured platform value reviewed by ops, not an average computed from live programs.
- **Existing data mostly survives**: current flat DBR caps keep working untouched, and banded DBR and prefill are additive. The one exception is deliberate: the settings listed in FR-015a are deleted along with their saved values, which is irreversible without a backup.
- **Deleting unused settings is accepted as a one-way door.** If a later feature reintroduces eligibility gating, those numbers must be re-entered from the banks' policy documents. Chosen anyway to keep the MVP form short and honest.
- **All figures are in EGP.**
