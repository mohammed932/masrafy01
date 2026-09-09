# Questions per no-payslip product

_Written 2026-09-09, then re-checked and acted on the same day._

**Status.** The survey below is current. Four of the defects it found have been FIXED (the
questionnaire seed and the three mobile apply mappers); two turned out to be **errors in the first
draft of this document** and are corrected in place; the rest are open and marked so. The
"Defects" section at the foot is the ledger.

Every one of the 13 surrogate products in the library is listed below with the questions it
reads, taken from the live question pool behind **http://localhost:5173/questionnaire/questions**.
Each row says whether the question **already exists** (then: its exact code, type, loan types,
required flag, gate and bounds as stored) or whether it **must be created** (then: the proposed
wording, and what else has to change before the answer reaches a figure — an ask row alone does
nothing).

"Reads" is taken in the wide sense. A product reaches an applicant's answers three ways, and all
three are listed:

1. **through its FACTS** — `surrogate_product_ask` → `surrogate_fact` → `boundQuestionId`. This is
   the calculation itself, and the only path the product screen shows.
2. **through the programme's ELIGIBILITY and PRICING** — `employment_status`, `job_tenure`,
   `salary_transfer` and the money questions, which the mobile app folds into the request body and
   the engine checks against every bank programme under the product.
3. **through the platform pipeline** — obligations, I-Score, the bank axes, additional income, the
   car pair. Read for every programme, listed once.

## How to read this

- **Source of truth.** Product rows and ask rows come from `platform_enumeration` (type
  `surrogate_product`) and `surrogate_product_ask` on `masrafy_dev`; question rows come from
  `question` / `question_option` / `question_loan_category`; each programme's eligibility from
  `bank_program.eligibility`; the shape of each calculation from
  `backend/src/bank-programs/blueprints/product-blueprints.ts`; the body mapping from
  `masrafy-app/…/personal_apply_mapper.dart` and `car_apply_mapper.dart`.
- **Loan types** are abbreviated **P** personal · **C** car · **M** mortgage · **B** business.
- **`required`** is one global column on the question. There is no per-product required flag, so a
  required question is required of every applicant it is visible to, in every loan type it is
  assigned to.
- **A gate** is `question.enabledWhen` — the question is only shown when that parent option is
  picked.
- **Employment codes.** The applicant answers `employment_status` in detailed codes
  (`government_employee` · `private_sector_employee` · `business_owner_company_owner` ·
  `freelancer` · `retired`); the engine folds them to `salaried` / `self_employed` / `retired`
  before comparing with a programme's `acceptedEmploymentTypes`. "Salaried only" below means the
  first two codes pass; "self-employed only" means the third and fourth.
- **New questions are proposals, not decisions.** Each carries the cost of asking it, because every
  question here is asked of everybody in its loan types, not only of the applicant who is buying
  the product.

## Platform questions every product already depends on

Read for **every** programme below and not repeated per product, except where a programme's own
setting makes one of them decisive.

### The money and the debts

| Code | Asks | Type | Loan types | Req. | Read as |
|---|---|---|---|---|---|
| `amount_requested` | How much do you need? | NUMERIC | P C M B | yes | the requested amount |
| `repayment_period_months` | Over how many months do you want to pay it back? | NUMERIC | P C M B | yes | the tenor, 6–120 |
| `monthly_income` | How much money comes in each month? | NUMERIC | P C M B | yes | the DECLARED salary. On a no-payslip programme the rule's figure **replaces** it when the rule resolves; when the rule states nothing the declared salary still carries the quote; a `higher`/`lower` `combinationRule` on the name compares the two; a CEILING product never meets it |
| `current_loans` | Do you pay back any loans right now? | MULTI_SELECT | P C M | yes | gates the five itemised debts below; `none` skips them. Six active options; two legacy `yes` / `no` rows are inactive |
| `obligation_personal_loan` | How much is your personal loan each month? | NUMERIC | P C M | yes | gate `current_loans = personal_loan` |
| `obligation_car_loan` | How much is your car loan each month? | NUMERIC | P C M | yes | gate `current_loans = car_loan` — also the auto cross-sell's fact |
| `obligation_mortgage` | How much is your mortgage each month? | NUMERIC | P C M | yes | gate `current_loans = mortgage` |
| `obligation_other` | How much are your other payments each month? | NUMERIC | P C M | yes | gate `current_loans = other` |
| `credit_card_total_limit` | What is the total credit limit of ALL your credit cards? | NUMERIC | P C M | yes | gate `current_loans = credit_cards`; 5% of it is counted as a monthly debt — also the card cross-sell's fact |
| `current_installments` | Your total monthly commitments | NUMERIC | P C M B | yes | the lump-sum fallback, used only when the snapshot predates the itemised debts |
| `i_score` | Your I-Score, if you know it | NUMERIC | P C M B | no | the I-Score multiplier — **all 10 rule-bearing products** carry the four I-Score steps; blank multiplies by 100% |

### Eligibility and pricing — folded into the request body by the app

| Code | Asks | Type | Loan types | Req. | Read as |
|---|---|---|---|---|---|
| `employment_status` | What kind of work do you do? | SINGLE_SELECT | P C M | yes | `employmentType` → `acceptedEmploymentTypes`, the self-employed age / income floors, `dbrCapPercentByEmploymentType`, and the rate cascade. Also the **gate** on `military_grade` and `academic_rank` |
| `job_tenure` | How long have you been in this job? | SINGLE_SELECT | P C M | yes | `monthsInJob` → `minMonthsInJob`, mapping the four buckets to 3 · 9 · 24 · 48 months. **Fixed 2026-09-09**: the car and mortgage mappers passed `null` and reported every applicant at the 24-month fallback, and the shared helper's own bucket labels matched no option code, so its arms were dead. All three wizards now read the answer through one helper |
| `salary_transfer` | How does your pay reach the bank? | SINGLE_SELECT | P C M | yes | `salaryTransferType` → `acceptedSalaryTransferTypes` and the rate cascade. No surrogate programme restricts it today |
| `priority_factor` | What matters most to you? | SINGLE_SELECT | P C M B | no | the order the offers are shown in (`rankOffers`); unanswered = fastest approval |
| `prior_rejection` | Has a bank ever said no to you? | SINGLE_SELECT | P C M B | no | `hasPreviousRejection` on personal; the car app hardcodes `false`; **the engine reads the flag nowhere** |
| `loan_purpose` | What will you use the money for? | SINGLE_SELECT | P | no | `loanPurpose` on the profile; **read by nothing** |

### Bank axes, other income, the car pair

| Code | Asks | Type | Loan types | Req. | Read as |
|---|---|---|---|---|---|
| `existing_bank_relationships` | Which of these banks do you already use? | MULTI_SELECT | P **C** M | no | the `bank_relationship` derived fact (NTB / X-SELL); no product carries it as a column yet |
| `existing_bank_loans` | Do you already have a loan with any of these banks? | MULTI_SELECT | P **C** M | no | the `loan_is_topup` derived fact — the second column on the doctors' cap and on the compound product |
| `existing_bank_products` | Do you hold a card or a deposit with any of these banks? | MULTI_SELECT | P **C** M | no | the `holds_other_product` derived fact — read by no product's column yet |
| `additional_income` | Do you get money from anywhere else? | SINGLE_SELECT | P C M | no | gates the four sources below |
| `rental_income_monthly` · `cd_returns_monthly` · `fixed_allowances_monthly` · `variable_allowances_monthly` | rent · certificate returns · fixed allowances · variable allowances, per month | NUMERIC ×4 | P C M | no | gate `additional_income = yes`; weighted by the per-BANK `additionalIncome` policy, applied after the rule and before the debt-burden band. Only `ABK-PER-DOCTORS_PRACTICE` states a policy today |
| `car_price` | What is the car's price? | NUMERIC | **C** | yes | the LTV ceiling and the rate cascade, on every car programme |
| `car_down_payment` | How much will you pay up front? | NUMERIC | **C** | yes | the same, and the down-payment product's own fact |

The three bank-axis questions were **not assigned to `car`** until 2026-09-09, so every SCB car
programme read the standard column of any axis it used. That was never a wrong figure — an
unanswered axis answers "standard", never "not answered" — but a top-up or cross-sell column could
not fire on a car loan at all. All three are now assigned to `car` as well; all three are optional,
so an applicant who skips them is quoted exactly as before.

Age is never asked: it is derived from the profile's birthday (A31).

---

## 1. `armed_forces_grades` — Egyptian Armed Forces

| | |
|---|---|
| Works out | a monthly income |
| Catalog name | `armed_forces_no_payslip` — "Armed Forces" (P, no-payslip) |
| Bank programmes | `ABK-PER-ARMED_FORCES` (ABK Egypt) — **salaried only**, 3 months in job |
| Mechanism | a table keyed by the applicant's grade |

### Questions it reads through its fact — exists

| Code | Asks | Type | Loan types | Req. | Gate | Notes |
|---|---|---|---|---|---|---|
| `military_grade` | Military grade | SINGLE_SELECT | P C | no | **`employment_status = government_employee`** | 10 options: Major General · Brigadier General · Officer · Colonel · Senior Officer · General · Lieutenant-Colonel · Major · Captain · First Lieutenant |

### Platform questions its programme makes decisive

| Code | Why it matters here |
|---|---|
| `employment_status` | the programme accepts `salaried` only — a `freelancer` or `business_owner_company_owner` answer fails `employment_type` before the grade is read |
| `job_tenure` | `minMonthsInJob 3` — only `less_than_6_months` (mapped to 3) and above pass; every bucket passes |

### To create

None.

### Worth knowing

- **The gate is right here, and that is not the same answer as for the professors' rank.** The armed
  forces are the state, so an officer answers `government_employee` or is answering wrongly — the
  gate names the whole population and spares every other applicant a question about a military
  grade. `academic_rank` carried the identical gate and lost it (see product 2).
- The list still carries three ungraded legacy rows (`officer`, `senior_officer`, `general`) beside
  the seven named grades, all ten active. They are keys some bank's table may be filed under, so
  they were added, never renamed.

---

## 2. `academic_rank_table` — University Professors

| | |
|---|---|
| Works out | a monthly income, plus a maximum-loan table |
| Catalog name | `university_professors` — "University Professors" (P, no-payslip) |
| Bank programmes | `ABK-PER-PROFESSORS` (ABK Egypt) — **salaried only** |
| Mechanism | a table keyed by academic rank, split into two columns by university type |

### Questions it reads through its facts — all exist

| Code | Asks | Type | Loan types | Req. | Gate | Options |
|---|---|---|---|---|---|---|
| `academic_rank` | Academic rank | SINGLE_SELECT | P C | no | none — **gate removed 2026-09-09** | Dean · Professor & Section Head · Professor · Assistant Professor · Lecturer · Assistant Teacher · Junior Staff |
| `is_the_university_government_or_private` | Is the university government or private? | SINGLE_SELECT | P C | no | — | Government · Private. Helper: "Institutes are not included." |

### Platform questions its programme makes decisive

| Code | Why it matters here |
|---|---|
| `employment_status` | salaried only; and the gate on the rank question |

### To create

None.

### Worth knowing

- **FIXED.** This question used to carry the grade question's gate,
  `employment_status = government_employee`. A professor at a **private** university answers
  "Private company job", is salaried, passes this programme's `acceptedEmploymentTypes` — and was
  never shown the one question the product reads, so it answered `fact_not_answered` for exactly the
  applicant the second column exists to price. `enabledWhen` holds ONE option code, so "government
  or private employee" is not expressible as a gate; the gate is now none, which is the posture
  `years_in_practice` already took. Cost: one more optional question for every personal and car
  applicant, carrying its own "Skip this if it does not apply" helper.
- ABK's own sheet publishes one figure per rank for both university types, and the stored programme
  agrees — both columns hold 12,000 / 20,000 / 30,000 / 40,000 / 50,000 / 75,000 / 100,000, checked
  row by row. So a Dean is 100,000 either way; the column is read, it simply holds one sheet's
  figures twice. The column exists because another sheet prints two.

---

## 3. `doctors_clinic_owner` — Doctors, Clinic Owners

| | |
|---|---|
| Works out | a monthly income, plus a maximum-loan table |
| Catalog name | `doctors_clinic_owner` (P, no-payslip) |
| Bank programmes | `ABK-PER-DOCTORS_CLINIC` (ABK Egypt) — **self-employed only**, 36 months in job, age 32+ |
| Mechanism | bands on years in practice, split by the CITY TIER the governorate is filed under; cap keyed by that tier × new-loan/top-up |

### Questions it reads through its facts — all exist

| Code | Asks | Type | Loan types | Req. | Bounds / options |
|---|---|---|---|---|---|
| `years_in_practice` | Years in practice | NUMERIC | P C | no | 0–60 years. Bands are half-open: 3–5 · 5–8 · 8–11 · 11–14 · 14–20 · 20+ |
| `practice_governorate` | Which governorate do you work in? | SINGLE_SELECT | P C | **yes** | all 27 governorates, each filed under one of three city tiers |
| `existing_bank_loans` | Do you already have a loan with any of these banks? | MULTI_SELECT | P M | no | drives the cap's second column (`loan_is_topup`) |

### Platform questions its programme makes decisive

| Code | Why it matters here |
|---|---|
| `employment_status` | self-employed only — `business_owner_company_owner` or `freelancer` pass, a salaried doctor fails `employment_type` |
| `job_tenure` | `minMonthsInJob 36` — only `more_than_3_years` (mapped to 48) passes; the `1_to_3_years` bucket maps to 24 and fails |

### To create

| Proposed | Type | Where | Why the note asks for it | What else is needed |
|---|---|---|---|---|
| *Is your clinic in a main area, a prime polyclinic, or coded on Vezeeta?* | SINGLE_SELECT | P C, gated on a "do you own a clinic?" answer | The programme note says clinic location is a bank condition with "no list and no source data" | a list of location classes, a `choice` gate on the template, and a reason code — and the bank has not supplied the list |

### Worth knowing

- `practice_governorate` is **required of every personal and car applicant on the platform**, not
  only of doctors. That was a deliberate call: an unanswered governorate sends the cap to its
  `onNoMatch`, which is the best cell in the table.
- It is a **second** question, not the mortgage `governorate` — that one asks where the property is,
  and the two answers legitimately differ.
- The retired `owns_practice` question (inactive) is what used to tell this product from
  `doctors_in_practice`. It is gone on purpose: the applicant now picks the catalog name instead.
- "Minimum 3 years in business" is enforced twice: by the band floor (the lowest edge is 3, and a
  value under every band is a stated refusal) and by `minMonthsInJob 36` against the tenure bucket.

---

## 4. `doctors_in_practice` — Doctors, In Practice

| | |
|---|---|
| Works out | a monthly income |
| Catalog name | `doctors_in_practice` (P, no-payslip) |
| Bank programmes | `ABK-PER-DOCTORS_PRACTICE` (ABK Egypt) — **salaried only**, 36 months in job; the one programme with an `additionalIncome` policy |
| Mechanism | bands on years in practice. No column, no cap — the sheet prints neither |

### Questions it reads through its fact — exists

| Code | Asks | Type | Loan types | Req. | Bounds |
|---|---|---|---|---|---|
| `years_in_practice` | Years in practice | NUMERIC | P C | no | 0–60 years, same edges, figures half the clinic-owner's at every band |

### Platform questions its programme makes decisive

| Code | Why it matters here |
|---|---|
| `employment_status` | salaried only — the opposite of the clinic owner |
| `job_tenure` | `minMonthsInJob 36` — only `more_than_3_years` passes |
| `additional_income` + the four sources | this programme weights rent, certificate returns and allowances (transcribed from the Arabic COMPOUND sheet, every percentage marked an estimate) |

### To create

| Proposed | Type | Where | Why | What else is needed |
|---|---|---|---|---|
| *Do you work at a private hospital or a government one?* | SINGLE_SELECT | P C | The sheet is "private hospitals only, not governmental" and the note says the platform has no field for the exclusion | a `choice` gate with the private option as the allow-list, plus a reason code — `GATE_NOT_MET` would serve. `employment_status = government_employee` is **not** a proxy: a government-hospital doctor is salaried and passes today |

### Worth knowing

- `years_in_practice` is shared with the clinic-owner product, so **neither product owns it** — that
  is what stops one product being retired and taking the other's only axis with it.
- Nothing enforces which of the two doctor programmes is really the applicant's. The two catalog
  names, and the opposite `acceptedEmploymentTypes` on the two programmes, are the whole defence.

---

## 5. `card_limit_share` — PL Cross Sell to Credit Card

| | |
|---|---|
| Works out | a monthly income |
| Catalog name | `pl_to_card` — "Personal Loan against a Credit Card" (P, no-payslip) |
| Bank programmes | `ABK-PER-PL_TO_CARD` (ABK Egypt) — all employment types, self-employed from 25 |
| Mechanism | a share of the card limit |

### Questions it reads through its fact — exists

| Code | Asks | Type | Loan types | Req. | Gate | Bounds |
|---|---|---|---|---|---|---|
| `credit_card_total_limit` | What is the total credit limit of ALL your credit cards? | NUMERIC | P C M | yes | `current_loans = credit_cards` | 0–20,000,000 EGP |

### Platform questions its programme makes decisive

| Code | Why it matters here |
|---|---|
| `current_loans` | the applicant must tick **Credit cards**, or the limit question is never shown and the product answers `fact_not_answered` |

### To create

| Proposed | Type | Where | Why | What else is needed |
|---|---|---|---|---|
| *How long have you held the card with the highest limit?* | NUMERIC (months) | P C M, gated on `current_loans = credit_cards` | The note says multiple cards cannot be combined and the bank reads the highest-limit card **that meets the holding period** — the platform asks for one combined total, so neither the single-card rule nor the holding period is enforced | a fact, an ask, and an `atLeast` condition on the template; and the limit question itself would have to change from a total to a per-card figure, which moves a figure every obligations calculation reads |

### Worth knowing

- The question deliberately asks for the **total across every card at every bank** because the
  obligations engine counts 5% of that total as a monthly commitment. Asking for one card's limit
  instead would move that figure, so the single-card rule cannot be closed by rewording this
  question.
- The old `minimumCreditCardHoldingMonths` eligibility check compares against `monthsInJob`, not a
  card-holding figure — a mislabelled read that predates this product.

---

## 6. `auto_loan_crosssell` — PL Cross Sell to Auto Loan

| | |
|---|---|
| Works out | a monthly income |
| Catalog name | `pl_to_auto_loan` — "Personal Loan against a Car Loan" (P, no-payslip) |
| Bank programmes | `ABK-PER-AUTO_XSELL_ABK`, `ABK-PER-AUTO_XSELL_OTHER` (ABK Egypt) — all employment types |
| Mechanism | ONE way with two terms — a multiple of the car instalment **or** a share of the original loan, whichever is lower. A bank fills both halves |

### Questions it reads through its facts — all exist

| Code | Asks | Type | Loan types | Req. | Gate | Bounds |
|---|---|---|---|---|---|---|
| `obligation_car_loan` | How much is your car loan each month? | NUMERIC | P C M | yes | `current_loans = car_loan` | 0–5,000,000 EGP |
| `how_much_was_the_car_loan_when_it_started` | How much was the car loan when it started? | NUMERIC | P C | no | `current_loans = car_loan` | 0–20,000,000. Helper: "The amount financed, not what is left to pay." |

### Platform questions its programmes make decisive

| Code | Why it matters here |
|---|---|
| `current_loans` | the applicant must tick **Car loan**, or neither fact question is shown |

### To create

| Proposed | Type | Where | Why | What else is needed |
|---|---|---|---|---|
| *How many instalments have you already paid on the car loan?* | NUMERIC (count) | P C, gated on `current_loans = car_loan` | The sheet requires the existing loan to be **past half its tenor with at least 12 paid months** | a fact, an ask, and an `atLeast` condition — the "half the tenor" half also needs the original tenor, which nothing asks |
| *What was the down payment on the car when you bought it?* | NUMERIC (EGP or %) | P C, same gate | The sheet requires the original loan to have been booked with **40% down** | a fact, an ask, and an `atLeastShareOf` condition against the original loan amount |
| *(none — do not ask)* | | | The sheet's last condition, "the new instalment must not exceed 50% of the existing car instalment", is computed **after** the rule from figures the platform already has | it is an engine change, not a question |

### Worth knowing

- The instalment is bound to the **obligation** question rather than asked again, so the figure the
  bank prices off and the figure the debt-burden subtracts cannot disagree.
- The two ABK programmes differ in whether the existing loan is ABK's own or another bank's. Nothing
  asks that: `existing_bank_loans` would answer it, and it is not assigned to this product as a
  column.

---

## 7. `pledged_collateral_share` — Liabilities Cross Sell (CDs Holder)

| | |
|---|---|
| Works out | a monthly income, plus a maximum-loan table banded by the pledged amount |
| Catalog name | `cds_holder` — "Certificate & Deposit Holders" (P, no-payslip) |
| Bank programmes | `ABK-PER-CDS_HOLDER` (ABK Egypt) — all employment types, self-employed from 25 |
| Mechanism | a share of the pledged amount, gated on how long it has been held |

### Questions it reads through its facts — all exist

| Code | Asks | Type | Loan types | Req. | Bounds |
|---|---|---|---|---|---|
| `how_much_is_the_certificate_or_deposit_you_would_pledge` | How much is the certificate or deposit you would pledge? | NUMERIC | P C | no | 0–100,000,000. Helper: "The free amount — what is not already pledged against something else." |
| `how_many_months_ago_was_it_issued` | How many months ago was it issued? | NUMERIC | P C | no | 0–600. Drives the `heldlongenough` condition → `GATE_NOT_MET` |

### Platform questions its programme makes decisive

None beyond the shared set.

### To create

None. Both open items on this sheet are shape problems, not missing questions:

- the cap "before three months, a maximum of 10% of the certificate" is a **second figure on one cap
  row**, which the cap table cannot hold — the months question that would key it already exists;
- the income floor "the lesser of 50,000 and 10% of total deposits" needs a **total deposits** figure
  and a `minOf` against a constant. Total deposits is close to the existing `total_savings` question
  (car only today); widening that question to P and C would supply the figure without a new one.

---

## 8. `down_payment_income` — Car Buyers, Down Payment or Savings

| | |
|---|---|
| Works out | a monthly income |
| Catalog names | `auto_down_payment_income` — "Auto Loan — Down Payment as Income" (C, no-payslip) · `green_finance_savings` — "Green Finance" (C, no-payslip) |
| Bank programmes | `SCB-CAR-DP60` · `DP50` · `DP40` · `DP30` · `DP20` on way `primary`; `SCB-CAR-GREEN_POWER` · `SCB-CAR-MICRO_MOBILITY` on way `alt` (all Suez Canal Bank). All employment types; 6 months in job; income floor 6,000 salaried / 15,000 self-employed on the five, 50,000 on the Green pair |
| Mechanism | two exclusive ways. Way 1: the down payment ÷ a divisor the bank types (the sheet prints 3.6 = 36 months × 10%). Way 2: total savings ÷ a divisor, split into two columns by how the buyer pays (instalments ÷ 3.6, cash ÷ 12) |

### Questions it reads through its facts — all exist

| Code | Asks | Type | Loan types | Req. | Bounds / options |
|---|---|---|---|---|---|
| `car_down_payment` | How much will you pay up front? | NUMERIC | **C** | **yes** | 0–50,000,000 EGP. Helper: "The amount, not a percentage — some banks read it as proof of your income." |
| `total_savings` | How much have you saved in total? | NUMERIC | **C** | no | 0–100,000,000 EGP. Helper: "Cash, deposits and certificates you can show statements for." |
| `green_buyer_type` | Are you paying in instalments or in cash? | SINGLE_SELECT | **C** | no | `instalment_buyer` Paying in instalments · `cash_buyer` Paying cash |

### Platform questions its programmes make decisive

| Code | Why it matters here |
|---|---|
| `car_price` | with `car_down_payment`, the LTV cap (40 / 50 / 60 / 70 / 80% of the price) and the required down payment reported on the offer |
| `employment_status` | picks the salaried or self-employed income floor and age band (21–60 vs 25–65) |
| `job_tenure` | `minMonthsInJob 6` on all seven. **Fixed 2026-09-09** — the car mapper now sends the answer, so "Less than 6 months" (3) fails the floor where it used to pass at the 24-month fallback |
| `monthly_income` | the `minMonthlyIncomeEGP` floor (6,000 / 15,000 / 50,000) is checked against the RULE's figure, not the declared salary — a salaried applicant's down payment under 21,600 (6,000 × 3.6) fails it on the five |

### To create

| Proposed | Type | Where | Why the sheet asks for it | What else is needed |
|---|---|---|---|---|
| *Do you own the home you live in, or does a first-degree relative?* | SINGLE_SELECT | C | The **20% down-payment** programme requires the home to be owned by the applicant or a first-degree relative. Not expressible today | a fact, an ask, a `choice` gate on the template with an allow-list, and a reason code |
| *Is your unit in a delivered, pre-approved compound?* | SINGLE_SELECT | C | Both **Green Finance** programmes are sold only to owners of a delivered unit in a pre-approved compound. Neither the compound list nor delivery status is a field | a fact, an ask, a gate — and the compound list already exists (`which_compound_is_your_unit_in`), so this is closer to widening that question to `car` and adding a delivery question beside it |
| *How many months has your business been running?* | NUMERIC (months) | P C M | Every SCB programme requires **24 months in business** for a self-employed applicant, and the platform states one service floor per programme, so only the salaried 6 months is enforced | a fact, an ask, an `atLeast` condition, and a reason code — this is the `business_years` question the v18.1.0 design record describes and which **does not exist in the pool** |
| *Do you have a valid commercial register and tax card?* | SINGLE_SELECT | P C M | The same sheets require both of a self-employed applicant | as above — the `self_employed_licence` question from the same design record, also **absent from the pool** |
| *(none — do not ask)* | | | Car insurance, ban on sale, the address-match rule and the I-Score service waiver are all programme conditions with no reader; the waiver in particular is *conditional* ("waived when the I-Score shows regular repayment"), and a condition applies whenever the bank fills its figure — there is no "unless" | an engine change, not a question |

### Worth knowing

- The five down-payment programmes and the two Green ones sit on **one** product and pick their way
  with `wayId`. The buyer-type column lives on the savings way only, so the five never ask for a
  cash-buyer divisor their sheet does not print.
- `total_savings` and `green_buyer_type` are authored in the questionnaire seed and only **bound** by
  the blueprint. A blueprint-minted question is switched off by the next `prisma:seed`, which is why
  they live where they do.
- `vehicle_condition` and `model_year` are asked of every car applicant and read by nothing on any
  programme — they are not this product's, but they sit in the same step.

---

## 9. `compound_owner` — Compound Owner

| | |
|---|---|
| Works out | a borrowing CEILING, not an income |
| Catalog name | `compound_owner_4` — "Compound Owner" (P, no-payslip) |
| Bank programmes | `EGB-PER-COMPOUND_OWNER` (way `primary`; income floor 10,000 / 25,000) · `FAB-PER-COMPOUND_OWNER` (way `alt`; 10,000 / 15,000) · `ABK-PER-COMPOUND_OWNER`, `CAE-PER-COMPOUND_OWNER` (way `alt__unit_paid_to_date`; CAE caps debt burden at 50% salaried / 40% self-employed) · `ABK-PERSONAL-7110` (legacy row on the same name, way `alt__unit_paid_to_date`, **salaried only**, 6 months, floor 5,000) |
| Mechanism | five exclusive ways to one ceiling: by compound class · banded by the down payment · a share of everything paid to date · by unit type · a share of the down payment. Plus a second column by new-loan/top-up, an uplift for owning more than one unit, a share by the percentage owned, and three conditions |

### Questions it reads through its facts

| Code | Asks | Type | Loan types | Req. | Bounds / notes |
|---|---|---|---|---|---|
| `which_compound_is_your_unit_in` | Which compound is your unit in? | SINGLE_SELECT | P C M | no | **71 active** options — 70 real compounds plus the "not listed" catch-all; each filed under one of six classes, and 58 of the 71 sit in the catch-all. Six `verify_*` test rows exist but are inactive, so they are served to nobody |
| `what_kind_of_unit_do_you_own` | What kind of unit do you own? | SINGLE_SELECT | P C M | no | Apartment · Twin or town house · Villa |
| `how_much_have_you_paid_for_the_unit_so_far` | How much have you paid for the unit so far? | NUMERIC | P C M | no | 0–100,000,000 EGP |
| `how_much_was_the_down_payment_on_the_unit` | How much was the down payment on the unit? | NUMERIC | P C M | no | 0–500,000,000. "The contract payment only" |
| `what_is_the_contract_price_of_the_unit` | What is the contract price of the unit? | NUMERIC | P C M | no | 0–200,000,000. Read by the `paidenough` and `unitworthenough` conditions |
| `how_many_months_ago_did_you_sign_the_contract` | How many months ago did you sign the contract? | NUMERIC | P C M | no | 0–600. Read by `ownedlongenough` → `CONTRACT_TOO_NEW` |
| `what_percentage_of_the_unit_do_you_own` | What percentage of the unit do you own? | NUMERIC | P C M | **yes** | 0–100. "Enter 100 if you own it on your own." Scales the ceiling |
| `do_you_own_more_than_one_unit` | Do you own more than one unit? | SINGLE_SELECT | P C M | no | **INACTIVE, and its ask row is detached** — see below |
| `existing_bank_loans` | loan with any of these banks | MULTI_SELECT | P M | no | the second column (`loan_is_topup`) |
| `current_loans` · `repayment_period_months` | — | — | — | — | **operator-added asks that the rule reads nowhere** |

### Platform questions its programmes make decisive

| Code | Why it matters here |
|---|---|
| `employment_status` | CAE's 50 / 40 debt-burden split and every programme's self-employed income floor; `ABK-PERSONAL-7110` refuses the self-employed outright |
| `existing_bank_products` | **should** be FABMISR's column (X-SELL = holds a card with limit ≥ 100,000) and is not — see below |

### To create

| Proposed | Type | Where | Why | What else is needed |
|---|---|---|---|---|
| *In which year did you sign the contract?* | NUMERIC or SINGLE_SELECT | P C M | FABMISR's minimum unit price varies by contract year (2024+ 3M · 2023 2.5M · 2022 2M · 2021 1.5M · before 2021 1M). One bound is configurable, so the earliest floor applies to everyone and the rest is prose in the programme notes | a fact, an ask, and a **band-keyed condition bound** — the condition compares against one figure today |
| *Do you hold a credit card with a limit of at least 100,000 at this bank?* | — | — | FABMISR's second column is X-SELL, which spec §10.3 says is a **different question** from new-loan/top-up. Its figures are filed in the top-up column so the grid is complete, and they are being read as the wrong axis | **not a new question** — `existing_bank_products` already answers it and already derives `holds_other_product`. What is missing is the product carrying that fact as a second column, plus the ≥100,000 limit condition |
| *(none — reword nothing)* | | | "Applicants owning apartments in high-end compounds take the villa cap row" is a row **swap** the cap table cannot express; the class and the unit type are both already asked | a cap-table change |

### Worth knowing

1. **The multi-unit uplift is off by operator decision, not by accident.** The template declares
   `uplift { fact: unit_count_owned, whenOption: unit_more_than_one, scope: maxLoan }`, and it
   currently applies to nobody: `do_you_own_more_than_one_unit` is inactive and the
   `unit_count_owned` ask is **tombstoned** — `detachedAt` 2026-09-03, `detachedBy` a real admin
   account. The first draft of this document called that collateral damage and proposed reviving it.
   It is the opposite: a blueprint ask is tombstoned rather than deleted precisely so that
   `seed:blueprints` cannot put it back, and the question left the seed's own pool in the same
   change. Reviving it is an operator's call on this product's screen, not a repair — so nothing
   here touched it. What is worth flagging is only that the blueprint still declares an uplift that
   reads a fact no live ask serves, and no screen says so.
2. **Eight compound questions are asked of car and mortgage applicants for nothing.** All the unit
   questions are assigned to P, C and M, but the catalog name is `personal` only, so no car or
   mortgage applicant can ever be quoted from them — and one of the eight
   (`what_percentage_of_the_unit_do_you_own`) is **required**, so every car and mortgage applicant
   must answer a question about a compound unit they may not own. Open: the fix is either to widen
   the catalog name or to narrow the questions, and that is a product decision.
3. `current_loans` and `repayment_period_months` were ticked onto this product by an operator. The
   rule reads neither. They are harmless but they make the product's ask list read as if the
   calculation depends on the tenor.
4. The six `verify_*` compound rows are **already inactive** and have no registry row behind them,
   so they are served to nobody — the mirrored-list sync had deactivated them. The first draft of
   this document reported them as live options, which was an artefact of querying the option table
   without filtering on `isActive`. Harmless orphans; nothing to fix.

---

## 10. `school_stage_ceiling` — Teachers, Predefined Limit

| | |
|---|---|
| Works out | a borrowing CEILING |
| Catalog name | `teachers_predefined` — "Teachers — Predefined Limit" (P, no-payslip) |
| Bank programmes | `CAE-PER-TEACHERS_PREDEFINED` (Crédit Agricole Egypt) — **salaried only** |
| Mechanism | a table keyed by the stage taught, split into two columns by school type |

### Questions it reads through its facts — all exist

| Code | Asks | Type | Loan types | Req. | Options |
|---|---|---|---|---|---|
| `which_stage_do_you_teach` | Which stage do you teach? | SINGLE_SELECT | P C | no | Primary · Preparatory · Secondary |
| `is_the_school_international_or_national` | Is the school international or national? | SINGLE_SELECT | P C | no | International · National. Helper names the American diploma, the international Bachelor and IGCSE |

### Platform questions its programme makes decisive

| Code | Why it matters here |
|---|---|
| `employment_status` | salaried only |

### To create

| Proposed | Type | Where | Why | What else is needed |
|---|---|---|---|---|
| *What subject do you teach?* | SINGLE_SELECT | P C | The predefined limit **excludes** military, commercial, agriculture, hospitality and special-needs subjects and school types, and the note says there is no field for it | a list of subjects, a fact, an ask, a `choice` gate used as an allow-list, and a reason code. The exclusion mixes subjects with school types, so one list may not cover it |

### Worth knowing

- The sheet waives the income check entirely; the engine still subtracts the applicant's existing
  debts from the ceiling, which is a stated assumption rather than the sheet's instruction.
- The debt-burden percentage is **not stated on the sheet** ("as per retail risk policy"), which is
  what the product's `DBR_PERCENT_UNCONFIRMED` open question records.

---

## 11. `company_coding_cap` — Salaried, Company Coding

| | |
|---|---|
| Works out | **nothing** — it only caps the loan. Each bank states the maximum on its own programme |
| Catalog name | none. A cap-only product cannot be linked to a catalog name (`SURROGATE_PRODUCT_CAP_ONLY`) |
| Bank programmes | none |

### Questions it reads through its fact — exists

| Code | Asks | Type | Loan types | Req. | Options |
|---|---|---|---|---|---|
| `how_is_your_employer_coded_at_the_bank` | How is your employer coded at the bank? | SINGLE_SELECT | **P C M B** | no | CAT A · CAT B · CAT C. Helper: "Your bank can tell you. Leave it if you do not know." |

### To create

None.

### Worth knowing

- This is the only surrogate question assigned to **all four** loan types, which is right for a cap
  that any salaried programme can apply.
- No programme uses it yet, so the answer is collected and read by nothing.

---

## 12. `school_type_cap` — Teachers, Standard

| | |
|---|---|
| Works out | nothing — a cap only |
| Catalog name | none |
| Bank programmes | none |

### Questions it reads through its fact — exists

| Code | Asks | Type | Loan types | Req. |
|---|---|---|---|---|
| `is_the_school_international_or_national` | Is the school international or national? | SINGLE_SELECT | P C | no |

### To create

None — and this is the point worth keeping: the question is **shared** with
`school_stage_ceiling`, so it belongs to the platform rather than to either product. Deleting one
product cannot take the other's axis away.

Its `DBR_PERCENT_UNCONFIRMED` open question is the same missing percentage as the predefined
product's.

---

## 13. `club_branch_cap` — Club Membership

| | |
|---|---|
| Works out | nothing — a cap only |
| Catalog name | none |
| Bank programmes | none |

### Questions it reads through its fact — exists

| Code | Asks | Type | Loan types | Req. | Options |
|---|---|---|---|---|---|
| `which_club_branch_is_your_membership_at` | Which club branch is your membership at? | SINGLE_SELECT | P C | no | New Cairo · Sheikh Zayed · Main |

### To create

| Proposed | Type | Where | Why | What else is needed |
|---|---|---|---|---|
| *Do you hold a membership at this club?* | SINGLE_SELECT | P C | The branch question is asked of every personal and car applicant with no gate, so somebody with no membership is asked which branch theirs is at | a gate on the branch question (`enabledWhen`), which is cheaper than a fact and an ask — the answer would gate visibility, not a figure |

### Worth knowing

- Adding a branch is more rows on the list, never more code.
- The debt-burden percentage is missing here too, and no bank programme exists.

---

## Consolidated: questions to create

Ordered by how many products would read them.

| # | Proposed question | Type | Loan types | Products it serves | Blocked on |
|---|---|---|---|---|---|
| 1 | How many months has your business been running? | NUMERIC | P C M | all 5 SCB down-payment programmes; the CAE compound self-employed conditions | a fact, an ask per product, an `atLeast` condition, a reason code |
| 2 | Do you have a valid commercial register and tax card? | SINGLE_SELECT | P C M | the same set | as above, with a `choice` gate |
| 3 | In which year did you sign the unit contract? | NUMERIC | P C M | `compound_owner` (FABMISR's year-tiered price floor) | a **band-keyed condition bound**, which the engine does not have |
| 4 | Do you own the home you live in, or does a first-degree relative? | SINGLE_SELECT | C | `down_payment_income`, the 20% programme | a gate + reason code |
| 5 | Is your unit in a delivered, pre-approved compound? | SINGLE_SELECT | C | `down_payment_income`, both Green programmes | a gate; the compound list already exists and would need widening to `car` |
| 6 | What subject do you teach? | SINGLE_SELECT | P C | `school_stage_ceiling` | a subject list, a gate used as an allow-list, a reason code |
| 7 | Do you work at a private hospital or a government one? | SINGLE_SELECT | P C | `doctors_in_practice` | a gate + reason code |
| 8 | Is your clinic in a main area, a prime polyclinic, or coded on Vezeeta? | SINGLE_SELECT | P C | `doctors_clinic_owner` | **the bank has not supplied the list** |
| 9 | How many instalments have you paid on the car loan? | NUMERIC | P C | `auto_loan_crosssell` | a condition; the "half the tenor" half also needs the original tenor, which nothing asks |
| 10 | What was the down payment on the car when you bought it? | NUMERIC | P C | `auto_loan_crosssell` | an `atLeastShareOf` condition |
| 11 | How long have you held your highest-limit card? | NUMERIC | P C M | `card_limit_share` | a condition — **and** a change to what the limit question asks, which moves a figure every obligations calculation reads |
| 12 | Do you hold a membership at this club? | SINGLE_SELECT | P C | `club_branch_cap` | nothing — it is a gate on an existing question |

**Reuse instead of creating, in four cases already covered by the pool:**

- FABMISR's X-SELL column → `existing_bank_products` (exists, derives `holds_other_product`). The
  product needs to carry that fact as its column; there is no question to write.
- ABK's "is the existing car loan ours?" → `existing_bank_loans` (exists, derives `loan_is_topup`).
- The CDs income floor's "total deposits" → `total_savings` (exists, `car` only) would supply it if
  widened to personal and car.
- Every "36 months in practice" floor → `job_tenure` already exists and feeds `minMonthsInJob` in
  all three wizards as of 2026-09-09. It does **not** cover "24 months in business": tenure in a
  job and the age of a business are different facts, and a self-employed applicant answering
  `more_than_3_years` is describing their own trading, not a bank's service floor — which is why
  items 1 and 2 above are still needed.

## Active questions in the personal and car pools that reach no product and no engine path

Listed so the survey is complete against the pool, not because they belong to a product.

| Code | Asks | Loan types | Status |
|---|---|---|---|
| `loan_purpose` | What will you use the money for? | P | lands on `profile.loanPurpose`; read by nothing |
| `salary_bank` · `salary_bank_name` | same bank / which bank for the salary | P C M | read by nothing; `salary_transfer` is what the engine uses |
| `employer_approved` | Is the place you work at on the banks' approved list? | P C M | read by nothing |
| `active_account` | Do you have a bank account you use? | P C M | read by nothing |
| `needs_consultant` | Do you want help from a loan expert? | P C M B | read by nothing in matching |
| `prior_rejection` | Has a bank ever said no to you? | P C M B | mapped to `hasPreviousRejection` on personal, hardcoded `false` on car, read by no matching code |
| `wants_insurance` | Do you want car insurance offers? | C | read by nothing — SCB's "car insurance required" condition could be gated on it, but it asks about *offers*, not about *having* insurance |
| `vehicle_condition` · `model_year` | new/used; model year | C | read by nothing since the exact car price replaced the bucket |
| `existing_bank_relationships` · `existing_bank_products` | bank axes | P C M | derived into `bank_relationship` / `holds_other_product`; **no product carries either as a column** — see open defect 8 |

Inactive rows the survey touched, for the record: `owns_practice` (retired with the doctors split),
`vehicle_price` (replaced by `car_price`), `do_you_own_the_unit_with_someone_else` (replaced by the
percentage), `do_you_own_more_than_one_unit` (should be **active** — defect 1), `your_age`
(A31 forbids asking it), `has_credit_card` / `card_usage` / `obligation_credit_card` (superseded by
the total-limit question), and five `test_*` rows.

## Defect ledger

### Fixed 2026-09-09

1. **`academic_rank` was gated on `employment_status = government_employee`.** A private-university
   professor is salaried, passes `ABK-PER-PROFESSORS`, and was never shown the one question that
   product reads. The gate is removed; the question joins `years_in_practice` as an ungated optional
   fact. `military_grade` **keeps** its gate — the armed forces are the state, so there the single
   option code names the whole population.
2. **The three bank-axis questions were not assigned to `car`.** No car programme could read a
   top-up or cross-sell column. All three are now assigned to `car`; all three are optional, so
   nobody who skips them is quoted differently.
3. **The car and mortgage apply mappers never read `job_tenure`.** Both passed `null` and reported
   every applicant at the 24-month fallback, so `minMonthsInJob: 6` on all ten car and three
   mortgage programmes was checked against a constant. Both now send the answer.
4. **The shared `monthsFromTenure` helper matched no option code.** Its arms read `under_6m` /
   `6m_1y` / `1_3y` / `over_3y`; the questionnaire emits `less_than_6_months` /
   `6_months_to_1_year` / `1_to_3_years` / `more_than_3_years`. Every arm was dead, so the helper
   returned its fallback for any input. Personal escaped only because that mapper carried a second,
   correct copy of the map. The labels are fixed, the duplicate is deleted, and all three wizards
   read the one helper.

**Behaviour change to know about.** Fixes 3 and 4 together mean an applicant who answers "Less than
6 months" now maps to 3 months and **fails** the 6-month service floor on all ten car and three
mortgage programmes, where before they passed as if they had been in the job two years. That is the
sheets' actual rule, and it is the first time the answer has reached it.

### Corrected in this document — first draft was wrong

5. **The multi-unit ask was not collateral damage.** A real admin account detached it on
   2026-09-03 and the question left the seed pool in the same change. The tombstone exists so the
   seed cannot revive it; reviving it is an operator decision, so nothing was changed. See product 9.
6. **The six `verify_*` compounds are not live options.** All six are inactive with no registry row.
   The claim came from an option query with no `isActive` filter. See product 9.

### Still open

7. **Eight compound questions are asked in `car` and `mortgage`** where the product is sold only as
   `personal`, and one of the eight is required. Fixing it means widening the catalog name or
   narrowing the questions — a product decision.
8. **FABMISR's X-SELL figures sit in the top-up column.** `existing_bank_products` already derives
   the right fact and is now asked in every relevant loan type, but the compound product does not
   carry it as a second column, so a FABMISR applicant with a card and no ABK loan reads the wrong
   row. Needs a template change, not a question.
9. **`self_employed_licence` and `business_years` do not exist** in the pool, although a design
   record describes them as shipped. Items 1 and 2 of the consolidated create-list are those two.
10. `current_loans` and `repayment_period_months` are operator-attached asks on `compound_owner`
    that the rule reads nowhere.
11. `prior_rejection` and `loan_purpose` are asked, carried on the profile, and read by nothing.
12. Three cap-only products (`company_coding_cap`, `school_type_cap`, `club_branch_cap`) collect
    answers that **no bank programme reads**, because none exists.
13. The blueprint's multi-unit uplift declares a fact no live ask serves, and no screen reports it.

## What was verified after the fixes

Against the real database and the running server, not read:

- `seed:questionnaire` re-run; the diff shows **exactly** the two intended changes (`academic_rank`
  ungated, the three axes gaining `car`) and nothing else moved.
- The run tripped the documented sweep hazard, deactivating **15** blueprint-minted questions.
  Repaired by reactivating exactly the questions a live, non-detached `surrogate_product_ask` row
  points at — derived from that table, never hand-typed. Active questions **70 → 55 → 70**.
- Snapshot republished; the served version carries **70** questions across 10 groups, with 49
  personal / 55 car / 44 mortgage / 16 business, and the three axes present in `car`.
- `seed:blueprints`: 0 created · 0 resumed · 10 unchanged · 3 cap-only · **0 refused** · 0 published.
  It did **not** revive the tombstoned ask.
- `seed:sheet-figures`: **0 written · 0 refused**, 24 programmes "identical to what is stored" — the
  proof that no stored figure moved.
- All **21** surrogate programmes quoted through the real stored rows
  (`effectiveIncomeRule` → `evaluateProductRule`) for three fixed applicants, 63 rows. Every figure
  matches the values this repo already recorded for the same inputs: SCB down payment 500,000 →
  **138,888.89**, Green instalment 36,000 → **10,000**, cash buyer → **3,000**, doctors clinic
  12 years → **120,000** and exactly 5 → **60,000** (the half-open 5–8 row), doctors in practice
  exactly half at **60,000** / **30,000**, auto cross-sell **24,000**, card limit 60,000 →
  **30,000**, armed forces Major → **30,000**, CDs 1,000,000 → **300,000**.
- `check:codes` **220** in sync · `check:income-proof` clean at 21 programmes across 11 names ·
  `check:parent-keys` clean at 98 values.
- Backend **1542** tests, admin **364**, `flutter analyze` clean, `tsc` clean, backend lint
  **100 problems = exact HEAD parity** with none in the touched files.

`test/unit/surrogate-binding-codes.spec.ts` was updated rather than duplicated: its gate case now
asserts `military_grade` alone and lists `academic_rank` with `years_in_practice` as ungated. Its
`seedBlockFor` helper now **strips comments** before matching — the ungated cases test for
`/enabledWhen:/` in the source, and a comment explaining why a gate was removed satisfied that
pattern. The helper's own comment had predicted this trap; writing the explanation is what sprang it.

## Not done

- No browser was driven. The questionnaire admin screens and the mobile car flow were not rendered,
  so the two newly visible questions (`academic_rank` ungated for private-sector applicants, the
  three axes in the car wizard) are unmeasured on a page in light, dark and RTL.
- The mobile app was not run on a device; the mapper change is covered by `flutter analyze` and by
  reading, not by a submitted application.
- No new questions were created. All 12 in the consolidated list remain proposals.
- Nothing was changed on `compound_owner`: not the tombstoned ask, not the loan-type assignments,
  not the FABMISR column.
