# Questions ↔ calculation: link + effect, and preview/apply parity

> Arabic version: [plan.ar.md](plan.ar.md). Status: **rev 2 (2026-10-03, after full audit of 71 programs + 86 questions)** — draft for operator review, no code yet.

## Context

**Question raised:** do the answers really drive the quote? For example on an auto loan. And how can a question an admin adds be linked to the calculation?

**How it works today:**
- **The engine reads FACT KEYS, never question codes.** A question reaches the calculation in one of two ways:
  1. **Hardcoded code constants.**
     - Money: `amount_requested`, `repayment_period_months`, `monthly_income`, `current_installments`.
     - Debts: `current_loans` plus the `obligation_*` codes.
     - `employment_status`.
     - Four legacy surrogate facts.
     - These live in `money-field-bindings.ts` and `surrogate-fact-bindings.ts`.
  2. **A `surrogate_fact` row** (a `platform_enumeration` row) whose `boundQuestionId` points at the question.
     - `surrogateFactsFromAnswers` turns the answer into `profile.surrogateFacts[key]`.
     - Fact grids, cap tables, plan tables, gates and income rules then read that key: `rateByFact`, `maxLoanByFact`, `ltvCeilingByFact`, `minAmountByFact`, `min/maxMonthsByFact`, `fact:<key>`, `additionalIncome`, I-Score.
  - **Car loans:** `car_price` and `car_down_payment` produce the derived `car_down_payment_percent`. That figure keys the financed-share, rate and term plans. `car_model_year` produces the derived `car_age_years`, which drives the vehicle-age refusal and the term limit.
- **The gap:** the new-question and questionnaire-editor screens have **no way to bind** a question to a fact. v16.3.0 removed the operator binding screens. A question created there is validated and stored, and is used for visibility, but **no figure ever reads it**. The binding exists today only through the surrogate product's ask board or the unguarded `PUT admin/enumerations/:id/bound-question`.
- **Second gap (an A33 violation):**
  - Apply takes amount, tenor, salary, employment type, months in job and salary transfer from the **request body**.
  - Preview reads amount, tenor and income from the **answers**, and hardcodes `employmentType: 'salaried'` and `monthsInJob: 0`.
  - So `dbrCapPercentByEmploymentType` never applies in preview.
  - Car names with no amount question show no figures in preview but do show them at apply.

**Outcome (operator-approved scope: "Link + effect" + "fix parity"):**
- An admin authoring a question can bind it to a calculation fact.
- They can then jump straight to the table that uses it.
- Every question shows what reads it, or "affects no figure".
- Preview and apply derive the applicant's inputs through ONE shared function.

**Order:** **Step P (prep) → B → A → C**, each its own PR.
- B moves money, so it needs before/after figures against an unchanged engine.
- A changes no engine input and needs no migration.
- C is the data fixes, which use A's screens and guards.

---

## Clarifications

### Session 2026-10-03

- Q: When does feature 012 count as done, given C1/C2 need operator figures? → A: Done = A + B + C3. C1 and C2 move to a follow-up that starts when `operator-worksheet.md` is filled in.
- Q: How strict is the bind-time shape check when linking an existing figure? → A: Full A2 is required before A is done — choice keys ⊆ option codes, `unknownKeys` in the meta, and an unknown shape that has readers is refused. Proven over HTTP.

---

## Audit of all programs and questions (dev DB, read-only, 2026-10-03)

**Caveat:** the dev DB is **4 migrations behind** the code:
- `remove_unit_count_lists`
- `program_name_question_exclusion`
- `gated_question_follows_trigger_group`
- `program_name_question_addition`

Because of that, `check:question-scope` and `check:questionnaire` crash (`Unknown field optIn`). The audit used SELECT queries run through the real `fact-readers.ts` / `effectiveIncomeRule` / `effectivePlan*` functions. Re-run it after Step P.

**Programs: 71 active.**

| Category | Income proof | Surrogate |
|---|---|---|
| Personal | 21 | 18 |
| Car | 11 | 4 |
| Mortgage | 10 | 0 |
| Business | 0 | 7 |

- **What all 71 read:** amount, tenor, income, obligations (DBR), age, and I-Score. I-Score comes through the shared `i_score_class` table: no score counts 85%, scores 300–520 count 60%, 521–625 count 90%, and 626 and above count 100%.
- **44 programs read nothing else.** That includes the 8 bank car payslip programs (they read **no car answer at all**), all 10 mortgage programs and all 7 business programs.
- **Programs that read more:**
  - 3 CAE car programs: `car_origin`, `car_dealer`, `car_price`/`car_down_payment` → down-payment %, and `car_fuel_type` (EV) / `car_model_year` (used).
  - 4 `car_buyers_program` programs: down payment, savings, green buyer, home ownership, origin, fuel.
  - About 20 personal programs (compound, doctors, professors, teachers, CDs, cross-sell, card, club, coding, armed forces).
- **No program reads a fact that is impossible to answer, and none reads a fact its category doesn't ask.**

**Questions: 86 (80 active).**

| Class | Count | Meaning |
|---|---|---|
| Engine input (hardcoded code) | 14 | money, debts, `employment_status`, bank-relationship multi-selects |
| App-body only | 10 | `priority_factor` (order only), `job_tenure`, `salary_transfer`, `business_age`, `prior_rejection`, 5 mortgage-detail questions — **inert for figures today**: eligibility is skipped (`skipEligibility: true`) and `rateByTransferType` only has the `none` row |
| Linked to a fact a program reads | 40 | includes `i_score` (read via the shared table) |
| Linked, nothing reads it | 3 | all inactive |
| Gate only | 4 | `additional_income`, `owns_compound_unit`, `club_membership`, `salary_bank` |
| **Dead (affects nothing)** | **15** | 12 active: `needs_consultant`, `needs_assistance`, `loan_purpose`, `financing_purpose`, `activity_type`, `governorate`, `active_account`, `business_account`, `employer_approved`, `registered`, `tax_registration`, `salary_bank_name` |

**Gaps found → where the plan handles them:**

| # | Gap | Handled in |
|---|---|---|
| G1 | Preview hardcodes `salaried`, so the quote differs from apply on **4 programs**: CAE-PER-COMPOUND_OWNER (DBR 50/40), CAE-CAR-NEW_CAR and CAE-CAR-USED_CAR (self-employed 60 months), ABK-PER-PL_TO_CARD (self-employed 84 months) | B |
| G2 | Car product-only names quote at apply but not in preview (no `amount_requested` derivation) | B |
| G3 | The admin cannot link a question to the calculation; 12 active questions change no figure | A + C2 |
| G4 | Reject-on-no-match tables keyed on **optional** questions refuse the quote when the question is left blank: `car_origin` (CAE max-loan, car_buyers rate), `car_fuel_type` / `car_dealer` (CAE-CAR-EV term). (`loan_is_topup` ← `existing_bank_loans` was listed here but is a derived bank axis: a blank answer reads the new-to-bank column, not a refusal.) | C3 |
| G5 | `military_grade` offers 3 legacy options (`officer`, `senior_officer`, `general`) with no row in ABK-PER-ARMED_FORCES's grade table, so they get no grade income | C1 |
| G6 | `existing_bank_relationships` → `bank_relationship` axis: nothing reads it | A (flag only) |
| G7 | HSBC-PER-PROFESSIONAL `byBankStatementPercent` reads a body-only balance that no question asks | not in scope (operator), listed as a follow-up |
| G8 | Small leftovers: `compound_tier_a` row unreachable; `down_payment_income` asks `obligation_personal_loan` / `obligation_other` facts its rule never reads | flagged by A's Used-by panel; no change |

---

## Step P — Prep (no code)
- Run `npx prisma migrate dev` on the dev DB (4 pending migrations) and `npx prisma generate`.
- Re-run `check:question-scope`, `check:questionnaire` and `check:money`.
- Re-run the audit queries and confirm the numbers above still hold now that the opt-in rows and exclusions are real.

---

## B — One shared function for applicant inputs (preview = apply)

**What actually moves money (from the audit):**
- Only **`employmentType`** changes a quote today (G1, 4 programs), along with the **car-amount derivation** in preview (G2).
- `monthsInJob` and `salaryTransferType` are carried through the same function for correctness, but change no figure, because eligibility is skipped and the transfer-type rate tables only have the `none` row.
- The before/after capture must therefore prove: those 4 programs move in **preview only**, product-only car names gain preview figures, and **every other program is unchanged** in both preview and apply.

**B1. New pure module `backend/src/matching/pipeline/applicant-inputs.ts`**
- Function: `applicantInputsFrom({ answers, served, category, fallback? })`. It returns:
  - `inputs`;
  - `missingServedMoneyCodes`;
  - `source` per field: answer | derived | body | default.
- Precedence: **answer → derivation → body fallback → default.**
  - Derivation means amount = `car_price − car_down_payment` when only car figures were asked, mirroring the app's `MoneyFigures.fromAnswers`.
- Answer→value tables copied from the Flutter `*_apply_mapper.dart` files:
  - `employment_status` → `government_employee` / `private_employee` / `business_owner` / `freelancer` / `retired`;
  - `job_tenure` → 3/9/24/48 months, default 24;
  - `business_age` → 6/18/48 months;
  - `salary_transfer` → `none` when the answer is `no_salary_transfer`.
- These tables live as code constants next to `EMPLOYMENT_TYPE_QUESTION_CODE` in `money-field-bindings.ts`. New constants: `JOB_TENURE_QUESTION_CODE`, `BUSINESS_AGE_QUESTION_CODE`, `SALARY_TRANSFER_QUESTION_CODE`. This is A33-compliant: a code constant, not a Question column.
- Default employment type per category: `business_owner` for business, `salaried` otherwise. That is per category, not per bank, so Principle II holds.
- Tenor is clamped to 6–360. If it was not asked, it stays `undefined` and the programme maximum applies.

**B2. Apply** (`backend/src/applications/applications.service.ts`, `buildProfile` ~891–982)
- Build the answer maps once by extracting them from `resolveSurrogateFacts`.
- Call `applicantInputsFrom` with the DTO body as `fallback`.
- Feed the result into `buildProfile`, the persisted `requestedAmountEGP` / `preferredTenorMonths`, and the `APPLICATION_CREATED` audit payload.
- Leave the DTO unchanged, so installed builds keep applying.
- Log one event when an answer overrides a different body value. The event carries field names only, with no amounts and no PII.

**B3. Preview** (`backend/src/matching-preview/matching-preview.service.ts`)
- Replace `resolveMoneyInputs` (366–386) and the hardcoded employment block in `buildProfile` (488–536) with the shared function.
- Return `MONEY_FIGURE_MISSING` only when a **served** money question is unanswered.
- Make `MoneyInputs.tenorMonths` optional.

**B4. Flutter**
- Update the comments in the 4 `*_apply_mapper.dart` files to say they mirror `applicant-inputs.ts` (A25).
- `business_apply_mapper.dart` reads `employment_status` when it is asked, instead of always sending `business_owner`. The answer wins on both sides.

**B5. Error codes:** none new.

---

## A — "Use in calculation" on the question, plus a "Used by" readout

**Reuse rather than rebuild:**
- `planAttach` in `backend/src/bank-programs/asks/product-ask-plan.ts`: reuse-first binding, with the key equal to the question code, plus the reserved / taken / blueprint refusals.
- `surrogateFactReaders` in `postgres-platform-enumerations.repository.ts:751`.
- `neededFacts` in `product-needed-facts.ts`.
- Existing error codes:
  - `SURROGATE_FACT_KEY_TAKEN`;
  - `SURROGATE_FACT_KEY_RESERVED`;
  - `SURROGATE_FACT_AMBIGUOUS_FOR_QUESTION`;
  - `SURROGATE_FACT_QUESTION_INACTIVE`;
  - `SURROGATE_FACT_QUESTION_TYPE_INVALID`;
  - `ENUMERATION_IN_USE`.
- **Do NOT call** the unguarded `PUT enumerations/:id/bound-question`. It stays as the repair tool, and `blueprint.service.ts:188` depends on it.

**A1. Planner** (`product-ask-plan.ts`)
- Split `planAttach` into `planBindFact` (type check, reuse-first, refusals, create fact, bind) plus the existing ask and category steps. Behaviour is unchanged; update its existing spec rather than adding one.
- Add `planLinkExisting`. It refuses when the key is reserved, the fact is bound elsewhere, the question already has a fact, a blueprint conflicts, or the shape does not match.
- Add `planUnlink`. It returns `ENUMERATION_IN_USE` while anything reads the fact or a product asks it. It deletes the row only when this flow created it and nothing reads it.

**A2. Bind-time shape check** (`product-needed-facts.ts`)
- This is the counterpart of v16.2.0's save-time check.
- Add `factShapeAcrossReaders(factKey, inputs[])`, reusing the existing `Collector`.
- Add `shapeFitsQuestion`:
  - choice keys must be a subset of the option codes (class-read axes are skipped, as in `validateFactGrid`);
  - a numeric shape requires a NUMERIC question;
  - an unknown shape that has readers is refused.
- **Required for A to be done** (Clarification 2026-10-03): a check on question type alone is not enough. `SURROGATE_FACT_SHAPE_MISMATCH` meta must carry `unknownKeys` (the table keys that no option code matches), and the refusal must be shown over HTTP. If no unbound active fact exists on dev, create a throwaway fact for the test and delete it afterwards.

**A3. `fact-readers.ts`**
- Add `factSurfacesOfProgram(row)`, which returns, per fact key, the surfaces that read it: income rule, additional income, cap, cap adjustment, financed share, min amount, rate grid, max/min term, vehicle age, car cover.
- Rebuild `factReaders` on top of it. Its output must be **byte-identical** to today's, because the delete guard depends on it.

**A4. Repository** (`backend/src/platform-enumerations/postgres-platform-enumerations.repository.ts`)
- Extract the reader scans and the plan merge into a private loader.
- Add `questionUsage()`. Per pool question it returns:
  - the bound fact;
  - the readers: programme id / code / bank, product, own-vs-inherited;
  - the product asks;
  - `isEngineInput`, computed from `questionLockReason === 'engine'`, I-Score and the B1 constants.
- Add `bindableFactCandidates()`: unbound, unreserved facts with their shape and reader count. Not cached.

**A5. Service:** `backend/src/bank-programs/asks/question-fact-link.service.ts`
- Read everything, plan, then execute through the existing `runAttachStep` cases.
- Add the create source `'question_link'` (`surrogate_fact` only) in `platform-enumerations-admin.service.ts`.
- Audit under the existing `boundQuestion` key.
- No questionnaire publish is needed, because narrowing is read live.

**A6. Routes** (`bank-programs.controller.ts`, declared before `:programCode`, class-validator DTOs)

| Route | Who | Purpose |
|---|---|---|
| `GET admin/bank-programs/question-facts` | super_admin, sales_manager | Bulk summary |
| `GET …/question-facts/:questionCode` | super_admin, sales_manager | Detail + candidates |
| `PUT …/question-facts/:questionCode` `{ factKey? }` | super_admin | No key: create a fact from the code. Key: link an existing fact |
| `DELETE …/question-facts/:questionCode` | super_admin | Unlink |

- When the target is a surrogate **product**, the UI calls the existing `PUT surrogate-products/:key/asks/:questionCode` so that step ① stays consistent. It uses the same `planBindFact`.

**A7. New error codes**
- Add `QUESTION_FACT_ALREADY_LINKED` (409) and `SURROGATE_FACT_SHAPE_MISMATCH` (422, meta `{factKey, questionCode, expected, unknownKeys}`).
- Files: `backend/src/common/errors/error-codes.ts`, `domain.exceptions.ts`, and both `admin/src/i18n/error-codes.{ar-EG,en-US}.json`.
- These codes are admin-only, so no Flutter ARB change (same precedent as `SURROGATE_FACT_KEY_TAKEN`).

**A8. Admin UI**
- New component `admin/src/app/features/questionnaire/question-calculation.component.ts`: standalone, signals, OnPush, ng-zorro, logical CSS, tokens.
  - **① Link:** "create a calculation figure from this question" (shows the key it will create, with live refusals) or "this answers an existing figure" (an `nz-select` of candidates).
  - **② What should it affect?** These tiles **only navigate**; the effect choice is not stored. Each opens the real table editor with the axis pre-filled as a draft. Tiles are disabled by the type × effect matrix: TEXT allows "answered" only; additional income and I-Score need NUMERIC.

    | Effect | Destination |
    |---|---|
    | Rate grid | Product plan `rateByFact`, or bank form `card-pricing` |
    | Max-loan cap | Bank form `card-amount` |
    | Financed share / min amount / min term | Product plan only (the bank form has no editor for these) |
    | Max term | Product plan or bank form vehicle grid |
    | Additional income | Bank form calculation step |
    | Condition / income rule | Product step ②, disabled with a reason where the rule is seed-owned |

  - **③ Used by:** grouped by where it is read, with links. Each question gets one class, the same classes the audit used:
    - Engine input
    - Calculation (with its readers)
    - Gate only
    - App-only (no figure)
    - Linked, nothing reads it (e.g. `existing_bank_relationships`, G6)
    - **Affects no figure**
  - **Warning:** when a reject-on-no-match table reads the question and it is optional, show "Leaving this blank refuses the quote on <programmes>" (G4; enforced by C3).
- `admin/src/app/features/program-catalog/new-question.page.ts`
  - The link choice is held until save. Save creates the question, then links it.
  - If linking fails, the question still exists: show the error in the panel with a retry, and stay on the page.
- `admin/src/app/features/questionnaire/questionnaire-editor.page.ts`
  - The panel works live on the expanded row.
  - Each row gets a chip from the bulk summary.
- Deep-link receivers:
  - `bank-programs/form/bank-program-form.page.ts` reads `?step=&card=&grid=&axis=` and calls `goTo(...)`. It pre-fills the axis only if the table is empty, as a draft only.
  - `program-catalog/surrogate-product-detail.page.ts` reads `?step=2&plan=&axis=` and opens that plan slot.
  - Both pages refresh the `surrogate_fact` registry on load.
- For sales_manager the panel is read-only.
- i18n ids are `@@qcalc.*` and `@@qusage.*`, with ar-EG targets and `<x/>` placeholders.
- Run `ui-ux-pro-max` before building and `impec` after (Principle XXIII).

**A9. Changelog rationale (no amendment needed)**
- v16.3.0 deleted ticks that nothing ever read.
- This change writes only `boundQuestionId`, which is exactly what the engine reads.
- The effect choice is navigation, not a stored claim.
- "Used by" is derived live from the same reader functions the guards use.
- v23.0.0 already reopened creating facts through `product_ask`.
- The binding stays off `Question` (A33), and there are no hand-typed codes.

---

## C — Data fixes and guards from the audit

**Scope of done:** only C3 is part of feature 012's definition of done. C1 and C2 are a **follow-up** that starts when the operator fills in `operator-worksheet.md` (which replaces the `dead-questions-worksheet.md` named below). Until then, the Used-by panel shows the 12 C2 questions as "Affects no figure", and the 3 legacy C1 grades still get no grade income.

**C1. `military_grade` legacy options (G5): map to grades (operator decision)**
- Add rows for `officer`, `senior_officer` and `general` to the `military_grade` list, and add their income figures to ABK-PER-ARMED_FORCES's grade table (`armed_forces_grades` product rule / program `stepParams`).
- **Needs from the operator:** which existing grade each one equals, or the EGP figure for each. Without that, nothing is written.
- Delivery: a named Prisma data migration plus the same change in the seed, so `seed:blueprints` / `seed:sheet-figures` re-run with 0 written.
- Capture ABK-PER-ARMED_FORCES figures for every grade before and after. Only the 3 legacy grades may change, going from "no grade income" to the stated figure.

**C2. Link the 12 dead questions (G3): operator decision — "link them"**
- Each one is linked through A's screen, which binds a fact. Its figures are then typed into the program or product table the operator names.
- Engineering does not invent figures (Banks Are Data). The deliverable is a **worksheet** in `specs/012-question-calculation-link/dead-questions-worksheet.md`, which the operator fills in. For each question it shows:
  - code, type, options and categories;
  - candidate effect (see below);
  - candidate programmes;
  - blank figure cells.
- Candidate effects to pre-fill:

  | Question(s) | Candidate effect |
  |---|---|
  | `employer_approved`, `active_account`, `business_account` | Rate / cap tables |
  | `governorate` | Mortgage cap by city tier, reusing `parentKeyByValue` like `practice_governorate` |
  | `activity_type`, `registered`, `tax_registration` | Business cap / rate tables |
  | `salary_bank_name` | Bank-relationship rate |
  | `loan_purpose`, `financing_purpose`, `needs_consultant`, `needs_assistance` | Likely lead/CRM-only. The worksheet asks the operator to confirm a figure or mark it "info only" |

- Once filled in, each row becomes one link plus one table edit through the admin, or a seed entry if the program is seed-owned. Every affected program's figures are captured before and after.

**C3. Required-if-read guard (G4)**
- **Rule:** a question that a **reject-on-no-match** table reads (`onNoMatch: 'reject'` grids, `maxLoanByFact` with reject, and gates) is **required** wherever that program is quoted.
- **Where:** the existing v29 rule "a served question the programme reads is REQUIRED" lives in `question-scope.ts`. Extend its `mustAnswerQuestionCodes` collection in `narrowingScopeFor` (`postgres-platform-enumerations.repository.ts`) so reject tables count. Today only `maxVehicleAgeYearsByFact` adds to `mustAnswer`.
- **Without a programme name:** for a request with no `programNameKey`, the category-wide set is not narrowed, so the rule cannot apply there. Instead, the Used-by panel warns and `check:question-scope` gains an invariant that lists every reject table keyed on a question that is optional category-wide. That extends an existing check; it is not a new test.
- **Effect:** the 3 known cases (`car_origin`, `car_fuel_type`, `car_dealer`) become required on the names that read them, so no silent refusals. Derived bank axes are excluded: a blank `existing_bank_loans` reads the new-to-bank column, so it is **not** a refusal (the audit's fourth G4 case was wrong).
- **Verify:** the served questionnaire for each affected name before and after; quotes unchanged for fully answered applicants.

**Not in scope (follow-ups):**
- **G7:** HSBC-PER-PROFESSIONAL bank-statement balance has no question.
- **Preview order:** preview still hardcodes `priority` / `loanPurpose`.
- **Eligibility config:** eligibility config that is never enforced (MVP).
- **Option retirement:** retiring an option a grid is keyed on.

## Docs
- `docs/CHANGELOG.md` entries: v30.9.0 (B), v30.10.0 (A), v30.11.0 (C), each with rationale, evidence and a "not done" list.
- CLAUDE.md: one-line index entries.
- Optional constitution PATCH, v29.1.2: name `applicant-inputs.ts` as A33's shared function. This is the operator's call.

## Verification (no new unit tests; per the repo testing policy)
- **B, before any code:** capture preview + apply figures over HTTP with a test customer, for **every active programme**. Fields: instalment, rate, max affordable, tenor, rankIndex. Answer sets:
  - government employee, more than 3 years, payroll;
  - private sector, transfer letter;
  - freelancer;
  - retired;
  - business with `business_age`;
  - car product-only (price + down payment, no amount);
  - mortgage.
  - Optional script: `backend/scripts/quote-preview-apply-parity.ts`, following the `scripts/quote-*.ts` precedent.
- **B, after:**
  - Only the 4 G1 programs change, and only in preview, for self-employed answer sets.
  - Product-only car names now quote in preview.
  - The other 67 programs are identical in both preview and apply.
  - Apply with an app-shaped body is identical to before.
  - Preview equals apply per programme.
  - A divergent-body case follows the answers and logs the event.
  - Delete the test applications.
- **A, over HTTP:**
  - Create-from-question works.
  - Link-existing works, and the shape-mismatch refusal fires.
  - Unlink is refused while a grid reads the fact, and the programme JSON is byte-identical afterwards.
  - Reserved and taken keys are refused.
  - `factReaders` output is identical before and after for every key.
- **C:**
  - Armed-forces figures per grade before and after.
  - Each worksheet row's programme figures before and after.
  - The served questionnaire per affected name shows the C3 questions as required.
  - `check:question-scope` lists 0 optional reject-keyed questions.
- **Seeds:** `seed:blueprints` and `seed:sheet-figures` report 0 written / 0 refused.
- **Checks:**
  - `check:codes`, `check:income-proof`, `check:parent-keys`, `check:questionnaire`, `check:question-scope`;
  - `tsc` and lint (≤ baseline);
  - existing suites green (update, don't add);
  - both locale builds, with the untranslated-id count compared against a HEAD worktree.
- **Browser:**
  - Screens: new-question page, editor row, both deep-link targets.
  - Modes: light, dark, RTL and the ar-EG build.
  - Page overflow 0 at 1440 / 1024 / 720, console clean, focus visible.

## Risks / follow-ups
- **Old app builds:** answers-first can change the figures they quote. One case is the old `job_tenure` codes that fell back to 24 months. Call this out in the changelog.
- **Preview ordering:** preview still hardcodes `priority: 'lowest_installment'` and `loanPurpose: 'personal'`, which is another A33 order gap. This is a follow-up.
- **Narrowing:** linking via a product ask makes the question product-scoped. That is the existing ask-board behaviour.
- **Retired options:** retiring an option a grid is keyed on stays unguarded. "Used by" makes it visible; a guard is a follow-up.

