# Surrogate products → the questions each one needs

_Audit of the real database on 2026-09-10 (active questionnaire **v174**). Read-only. Every row below was queried, not read from code: `surrogate_product_ask` → `surrogate_fact.boundQuestionId` → `question` (+ `question_loan_category`, `enabledWhen`), crossed with the facts each product's compiled `incomeRule` reads and each bank programme's `loanLimits.maxLoanByFact` / `maxLoanAdjustments`._

## 1. How the mobile app asks today

`Home (loan type) → Loan setup: income basis (payslip / no payslip) → program name → GET /v1/questionnaire?category=<loan type> → apply`.

- The questionnaire is narrowed by **loan type only**. The picked program name and income basis are sent only on `POST /v1/apply`, where they narrow which **programmes** are matched — never which questions are shown.
- A question is shown when it is assigned to the loan type (`/questionnaire/categories`) and its `enabledWhen` gate (if any) is satisfied by an earlier answer.
- So a `personal` + no-payslip applicant who picks *Compound Owner* is asked the shared personal questions, the compound pack (behind "Do you own a unit in a compound? = Yes"), AND every other surrogate product's personal questions. The cross-product ones are REQUIRED with a "does not apply to me" answer (v28.0.0 decision), so they cost one tap each.

## 2. Shared questions every no-payslip applicant answers

### Personal (and car unless marked P-only)

| Group | Question (code) | Required | Gate |
|---|---|---|---|
| Work & income | What kind of work do you do? (`employment_status`) | yes | — |
| | How long have you been in this job? (`job_tenure`) | yes | — |
| | How much money comes in each month? (`monthly_income`) | yes | — |
| | How does your pay reach the bank? (`salary_transfer`) | yes | — |
| | Same bank for salary? (`salary_bank`) → which bank (`salary_bank_name`) | no | `salary_bank = a_specific_bank` |
| | Bank account you use? (`active_account`) · Employer on approved list? (`employer_approved`) | no | — |
| | Money from anywhere else? (`additional_income`) → rent / CD returns / fixed / variable allowances | no | `additional_income = yes` |
| Commitments | Do you pay back any loans right now? (`current_loans`, multi) | yes | — |
| | Monthly figure per picked loan type (`obligation_personal_loan` / `_car_loan` / `_mortgage` / `_other`) | yes | `current_loans` ⊇ that type |
| | Total monthly commitments (`current_installments`) | yes | — |
| | Your I-Score, if you know it (`i_score`) | no | — |
| Financing | How much do you need? (`amount_requested`) · Over how many months? (`repayment_period_months`) | yes | — |
| | What will you use the money for? (`loan_purpose`) — P-only | no | — |
| Bank relationships | Loan with any of these banks? (`existing_bank_loans`) → fact `loan_is_topup` | no | — |
| | Card or deposit with any of these banks? (`existing_bank_products`) → fact `holds_other_product` | no | — |
| | Which banks do you already use? (`existing_bank_relationships`) → fact `bank_relationship` (read by no rule today) | no | — |
| Preferences | Loan expert? (`needs_consultant`) · Bank ever said no? (`prior_rejection`) · What matters most? (`priority_factor`) | no | — |

### Cross-product questions asked of EVERY personal (and car) applicant — one tap each, with an "I don't / not me" answer

| Question (code) | Required | Loan types | Serves |
|---|---|---|---|
| Do you own a unit in a compound? (`owns_compound_unit`) | yes | personal | gate of the compound pack |
| Are you a member of a sporting club? (`club_membership`) | yes | personal, car | gate of club branch (payslip-lane cap) |
| How long has your business been running? (`business_months`) | yes | personal, car | CAE compound + all 7 SCB car conditions |
| Valid commercial register and tax card? (`self_employed_licence`) | yes | personal, car | same |
| Private hospital or government one? (`hospital_sector`) | yes | personal, car | Doctors — In Practice |
| Which governorate do you work in? (`practice_governorate`) | yes | personal, car | Doctors — Clinic Owners cap |
| Academic rank (`academic_rank`) · Government or private university? (`is_the_university_government_or_private`) | no | personal, car | University Professors |
| Military grade (`military_grade`) | no | personal, car (only if `employment_status = government_employee`) | Armed Forces |
| Years in practice (`years_in_practice`) | no | personal, car | both doctor products |
| Which stage do you teach? · International or national school? | no | personal, car | Teachers |
| How is your employer coded at the bank? (`how_is_your_employer_coded_at_the_bank`) | no | all four | payslip-lane cap |
| Certificate/deposit you would pledge · months since issued | no | personal, car | CDs Holder |

### Car applicants additionally

`car_price` (req), `car_down_payment` (req), `home_ownership` (req), `unit_approved_compound` (req), `model_year`, `vehicle_condition`, `wants_insurance`, `total_savings`, `green_buyer_type` (optional); plus, behind `current_loans ⊇ car_loan`: `car_loan_original_tenor`, `car_loan_instalments_paid`, `car_loan_down_payment`, `how_much_was_the_car_loan_when_it_started`.

## 3. Per product

Legend — **State**: ✓ = active, in v174, assigned to every loan type the product's catalog name is sold in, gate parent asked there too. **Reads** = which stored rule step / condition / cap table consumes the answer.

### 3.1 Compound Owner (`compound_owner`) — name `compound_owner_4` · personal · 5 programmes

Programmes: `ABK-PER-COMPOUND_OWNER` (way `alt__unit_paid_to_date`), `ABK-PERSONAL-7110` (same way), `CAE-PER-COMPOUND_OWNER` (same way), `EGB-PER-COMPOUND_OWNER` (way `primary`), `FAB-PER-COMPOUND_OWNER` (way `alt`).

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| Do you own a unit in a compound? (`owns_compound_unit`) | choice | yes | — | personal | gate of the 8 below | ✓ |
| Which compound is your unit in? (`which_compound_is_your_unit_in`, 71 options) | choice | no | owns=yes | personal | `primary` class table (EGB) | ✓ |
| What kind of unit do you own? (`what_kind_of_unit_do_you_own`) | choice | no | owns=yes | personal | `alt__owned_unit_type` way; ABK cap tables ×2 | ✓ |
| What is the contract price of the unit? (`what_is_the_contract_price_of_the_unit`) | number | no | owns=yes | personal | condition `unitworthenough` (ABK-7110, EGB); base of `paidenough` | ✓ |
| How much was the down payment on the unit? (`how_much_was_the_down_payment_on_the_unit`) | number | no | owns=yes | personal | `alt` band way (FAB) + `alt__unit_down_payment` share | ✓ |
| How much have you paid for the unit so far? (`how_much_have_you_paid_for_the_unit_so_far`) | number | no | owns=yes | personal | `alt__unit_paid_to_date` way (ABK ×2, CAE); condition `paidenough` | ✓ |
| How many months ago did you sign the contract? (`how_many_months_ago_did_you_sign_the_contract`) | number | no | owns=yes | personal | condition `ownedlongenough` (ABK ×2) | ✓ |
| What percentage of the unit do you own? (`what_percentage_of_the_unit_do_you_own`) | number | **yes** | owns=yes | personal | `share` (stated %) on every programme | ✓ |
| **Do you own more than one unit? (`do_you_own_more_than_one_unit`)** | choice | no | owns=yes | personal | `ABK-PER-COMPOUND_OWNER` cap adjustment **+10 % when "more than one"** | **✗ INACTIVE — not in v174. See GAP 1** |
| How long has your business been running? (`business_months`) | choice | yes | — | personal, car | condition `businessoldenough` (CAE) | ✓ |
| Valid commercial register and tax card? (`self_employed_licence`) | choice | yes | — | personal, car | condition `selfemployedpapers` (CAE) | ✓ |
| Loan with any of these banks? (`existing_bank_loans`) → `loan_is_topup` | multi | no | — | P, C, M | new-loan / top-up column on `primary` and `alt__owned_unit_type`; ABK cap columns | ✓ |
| Card or deposit with any of these banks? (`existing_bank_products`) → `holds_other_product` | multi | no | — | P, C, M | X-SELL column on the FAB down-payment band way | ✓ |
| I-Score (`i_score`) | number | no | — | all | I-Score tier multiplier | ✓ |

### 3.2 Doctors — Clinic Owners (`doctors_clinic_owner`) — name `doctors_clinic_owner` · personal · `ABK-PER-DOCTORS_CLINIC`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| Which governorate do you work in? (`practice_governorate`, 27) | choice | yes | — | personal, car | cap rows by city tier (`onNoMatch: reject`) | ✓ |
| Years in practice (`years_in_practice`) | number | no | — | personal, car | `primary` band table (skipped → no quote from this programme) | ✓ |
| `existing_bank_loans` → `loan_is_topup` | multi | no | — | P, C, M | cap column new-loan / top-up | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.3 Doctors — In Practice (`doctors_in_practice`) — name `doctors_in_practice` · personal · `ABK-PER-DOCTORS_PRACTICE`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| Private hospital or government one? (`hospital_sector`) | choice | yes | — | personal, car | condition `privatehospitalonly` | ✓ |
| Years in practice (`years_in_practice`) | number | no | — | personal, car | `primary` band table | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.4 Armed Forces (`armed_forces_grades`) — name `armed_forces_no_payslip` · personal · `ABK-PER-ARMED_FORCES`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| Military grade (`military_grade`, 10 grades) | choice | no | `employment_status = government_employee` | personal, car | `primary` grade table | ✓ — note: an officer must answer "Government job" to see it |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.5 University Professors (`academic_rank_table`) — name `university_professors` · personal · `ABK-PER-PROFESSORS`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| Academic rank (`academic_rank`, 7) | choice | no | — | personal, car | `primary` rank table | ✓ |
| Is the university government or private? (`is_the_university_government_or_private`) | choice | no | — | personal, car | second column | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.6 PL Cross Sell to Credit Card (`card_limit_share`) — name `pl_to_card` · personal · `ABK-PER-PL_TO_CARD`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| Do you pay back any loans right now? (`current_loans`) | multi | yes | — | P, C, M | gate | ✓ |
| Total credit limit of ALL your cards (`credit_card_total_limit`) | number | yes | `current_loans ⊇ credit_cards` | P, C, M | `primary` share; also the payslip programme `EGB-PER-PL_TO_CARD` cap | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.7 PL Cross Sell to Auto Loan (`auto_loan_crosssell`) — name `pl_to_auto_loan` · personal · `ABK-PER-AUTO_XSELL_ABK`, `ABK-PER-AUTO_XSELL_OTHER`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| `current_loans` | multi | yes | — | P, C, M | gate (`car_loan`) | ✓ |
| How much is your car loan each month? (`obligation_car_loan`) | number | yes | `current_loans ⊇ car_loan` | P, C, M | `primary` (×3 instalment) | ✓ |
| How much was the car loan when it started? (`how_much_was_the_car_loan_when_it_started`) | number | no | same | personal, car | `alt` (10 % of loan), lower of the two | ✓ |
| Over how many months was the car loan taken? (`car_loan_original_tenor`) | number | yes | same | personal, car | condition `paidenoughofterm` (≥ half the tenor) | ✓ |
| How many instalments have you already paid? (`car_loan_instalments_paid`) | number | yes | same | personal, car | conditions `paidenoughmonths`, `paidenoughofterm` | ✓ |
| What did you pay up front on that car? (`car_loan_down_payment`) | number | yes | same | personal, car | condition `bookedwithdownpayment` | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.8 Certificate & Deposit Holders (`pledged_collateral_share`) — name `cds_holder` · personal · `ABK-PER-CDS_HOLDER`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| How much is the certificate or deposit you would pledge? (`how_much_is_the_certificate_or_deposit_you_would_pledge`) | number | no | — | personal, car | `primary` share + cap bands | ✓ (asked of everyone; no "I hold none" gate) |
| How many months ago was it issued? (`how_many_months_ago_was_it_issued`) | number | no | — | personal, car | condition `heldlongenough` | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.9 Teachers — Predefined Limit (`school_stage_ceiling`) — name `teachers_predefined` · personal · `CAE-PER-TEACHERS_PREDEFINED`

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| Which stage do you teach? (`which_stage_do_you_teach`) | choice | no | — | personal, car | `primary` stage table | ✓ |
| Is the school international or national? (`is_the_school_international_or_national`) | choice | no | — | personal, car | second column; also the payslip cap `CAE-PER-TEACHERS_STANDARD` | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.10 Car Buyers — Down Payment or Savings (`down_payment_income`) — names `auto_down_payment_income` + `green_finance_savings` · car · 7 SCB programmes

`SCB-CAR-DP60/50/40/30/20` (way `primary`), `SCB-CAR-GREEN_POWER`, `SCB-CAR-MICRO_MOBILITY` (way `alt`).

| Question (code) | Type | Req | Gate | Loan types | Reads | State |
|---|---|---|---|---|---|---|
| What is the car's price? (`car_price`) | number | yes | — | car | LTV cap on the 5 DP programmes | ✓ |
| How much will you pay up front? (`car_down_payment`) | number | yes | — | car | `primary` ÷ 3.6 (DP programmes); LTV required-down-payment | ✓ |
| How much have you saved in total? (`total_savings`) | number | no | — | car | `alt` ÷ 3.6 / ÷ 12 (Green) | ✓ |
| Paying in instalments or in cash? (`green_buyer_type`) | choice | no | — | car | `alt` column (Green) | ✓ |
| Do you own the home you live in, or a close relative? (`home_ownership`) | choice | yes | — | car | condition `homeowned` (DP20 only) | ✓ |
| Is your home in a finished, bank-approved compound? (`unit_approved_compound`) | choice | yes | — | car | condition `unitinapprovedcompound` (Green ×2) | ✓ |
| `business_months` · `self_employed_licence` | choice | yes | — | personal, car | conditions on all 7 | ✓ |
| `i_score` | number | no | — | all | tiers | ✓ |

### 3.11 Cap-only products — no catalog name, read by PAYSLIP programmes under `private_sector`

These three appear on the no-payslip board but their only readers are `income_proof` programmes; their questions belong to the payslip lane.

| Product | Question (code) | Req | Gate | Loan types | Reader |
|---|---|---|---|---|---|
| Club Membership (`club_branch_cap`) | Are you a member of a sporting club? (`club_membership`) → Which club branch? (`which_club_branch_is_your_membership_at`) | yes / no | `club_membership = yes` | personal, car | `FAB-PER-CLUB_MEMBERSHIP` cap |
| Salaried — Company Coding (`company_coding_cap`) | How is your employer coded at the bank? (`how_is_your_employer_coded_at_the_bank`) | no | — | all four | `ABK-PER-SALARIED_CODING` cap |
| Teachers — Standard (`school_type_cap`) | International or national school? (shared with 3.9) | no | — | personal, car | `CAE-PER-TEACHERS_STANDARD` cap |

## 4. Gaps

### GAP 1 — "Do you own more than one unit?" is switched off while a bank programme still reads it

- Fact `unit_count_owned` (blueprint `compound_owner`, template `uplift`, `scope: maxLoan`). Reader: `ABK-PER-COMPOUND_OWNER.loanLimits.maxLoanAdjustments` = **+10 % of the ceiling when the answer is "More than one unit"**.
- Its ask row on `compound_owner` was **detached (tombstoned) on 2026-09-03 18:22** by a super-admin on the product's step ①. The detach was allowed because the blueprint-ask path only checks the product's own rule, not bank programmes' cap tables/adjustments (`product-ask-plan.ts`, step 2 of `planDetach`).
- The next `seed:questionnaire` then switched the question off (not in the seed pool, and the v28 revive skips detached asks). It is absent from v174.
- Effect: the +10 % can never fire; ABK compound owners with two units are quoted the single-unit ceiling. No error is raised anywhere.

**Close it through the admin (no code) — order matters:**
1. `/questionnaire/questions` → un-park **Do you own more than one unit?** (it keeps its gate `owns_compound_unit = yes` and its `personal` assignment). This publishes a new version.
2. `/program-catalog/products/compound_owner` step ① → tick the question → the ask is revived, so future seed runs keep it live. (Step 1 must come first: attaching a parked question is refused with `SURROGATE_FACT_QUESTION_INACTIVE`.)
3. Verify: `npm run quote:surrogate` before/after — only `ABK-PER-COMPOUND_OWNER` may move, and only for an applicant answering "More than one unit".

Alternative, if ABK no longer wants the uplift: remove the adjustment from `ABK-PER-COMPOUND_OWNER` in the bank-programme wizard; then nothing reads the fact and "off" is honest.

Known hole, NOT fixed here (code): detaching a blueprint ask should refuse while any bank programme still reads the fact (`fact_still_read` already exists for the delete path). Recorded for a later change.

### Observations (not gaps — decisions the operator may want to revisit)

1. **Car applicants answer six REQUIRED questions no car programme reads**: `hospital_sector`, `practice_governorate`, `club_membership`, plus optional `academic_rank`, `military_grade`, `years_in_practice`, school ×2, university, pledged ×2. They are `personal, car` because the blueprints say `alsoAskIn: [personal, car]`; every product reading them is sold under `personal` only. Narrowing them to `personal` is a data change on `/questionnaire/categories` (no code) — but `seed:blueprints` would then report `drift` lines for those asks.
2. **Optional facts that a programme's calculation needs**: `academic_rank`, `years_in_practice`, `military_grade`, the two CD questions, `which_stage_do_you_teach`, `total_savings`. Skipping one gives `fact_not_answered` for THAT programme only (listed with a reason, never a zero). Acceptable under today's "asked of everyone" model; would become required under a per-programme questionnaire.
3. `existing_bank_relationships` (fact `bank_relationship`) is asked but read by no rule since FABMISR's X-SELL column moved to `holds_other_product`.
4. `governorate` (mortgage) is bound to fact `property_governorate`, read by nothing.
5. Every fact-bound question that IS active is in v174 — snapshot and live table agree (checked code by code).

## Appendix — queries used (psql, read-only)

```sql
-- products
SELECT key, "labelEn", active, "templateSpec" IS NOT NULL, "incomeRule" IS NOT NULL
FROM platform_enumeration WHERE type='surrogate_product' ORDER BY key;

-- asks → facts → questions (+ active, required, categories, gate)
SELECT p.key, f.key, a.source, a."detachedAt", q.code, q.type, q."isActive", q."isRequired",
  (SELECT string_agg(qc.category::text, ',') FROM question_loan_category qc WHERE qc."questionId"=q.id),
  q."enabledWhen"
FROM surrogate_product_ask a
JOIN platform_enumeration p ON p.id=a."productId"
JOIN platform_enumeration f ON f.id=a."factId"
LEFT JOIN question q ON q.id=f."boundQuestionId" ORDER BY p.key, f.key;

-- facts each product's compiled rule reads
SELECT p.key, string_agg(DISTINCT x.f, ',')
FROM platform_enumeration p, LATERAL (SELECT jsonb_path_query(p."incomeRule", 'strict $.**.fact') #>> '{}' AS f) x
WHERE p.type='surrogate_product' GROUP BY p.key;

-- bank programme cap tables / adjustments
SELECT "programCode", "programType", "loanLimits"->'maxLoanByFact', "loanLimits"->'maxLoanAdjustments'
FROM bank_program WHERE "loanLimits" ? 'maxLoanByFact' OR jsonb_array_length(COALESCE("loanLimits"->'maxLoanAdjustments','[]'))>0;

-- questions in the active snapshot
SELECT g->>'code', q->>'code', q->'categories', q->'enabledWhen'
FROM questionnaire_version v, jsonb_array_elements(v.snapshot->'groups') g, jsonb_array_elements(g->'questions') q
WHERE v."isActive";
```
