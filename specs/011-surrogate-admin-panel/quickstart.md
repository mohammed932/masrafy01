# Quickstart — Income-Surrogate Rule Builder

Configure a bank's own grade table, verify it on screen, and see a customer get that figure.
~10 minutes on a seeded local stack.

## 0. Stack up

```bash
docker compose -f docker/compose.dev.yml up -d postgres redis

cd backend
nvm use && npm install
npx prisma migrate dev                # bank_program_value_sources, bank_offer_income_origin
npx prisma db seed                    # programs + questionnaire pool (incl. the 3 new questions)
npm run start:dev                     # http://localhost:3000  · docs /api/docs

cd ../admin
npm install && npm start              # http://localhost:5173
```

## 1. Type the bank's table (Story 1)

1. `Banks → Programs →` open an **income-surrogate personal** program (seed: `ABK-MILITARY`, the
   Egyptian Armed Forces program — re-typed from the `income_proof` default by this feature; the
   other two table-carrying seeds are `ABK-PROFESSORS` and `ABK-DOCTORS-PRACTICE`). The rule section
   appears only for this combination (FR-001).
2. **Income assumption → Method →** *By military grade*. A key table replaces the old placeholder.
3. Add a row per grade. The key comes from the `military_grade` registry dropdown — never free
   text (FR-006). Type the monthly income the bank assigns.
4. Try to save with an empty table → refused, `INCOME_RULE_EMPTY`. Add a duplicate grade → refused
   naming the key. Type `0` as an income → refused naming the row.
5. Switch the method to *By years in practice* → you are warned first, then the grade table is
   cleared (FR-011). Bands are entered as EDGES: `0 · 5 · 8 · ∞`, one income each. A gap or an
   overlap is unrepresentable rather than merely rejected.

## 2. Check it before anyone sees it (Story 3)

Below the table, in the same tab order:

1. Sample applicant → grade `senior_officer`, obligations `3,000`, amount `500,000`, tenor `60`.
2. **Check** → the panel shows, in place, with no navigation and nothing saved (FR-029):
   surrogate income · DBR % applied and where it came from · affordable installment · estimated
   loan · qualifies.
3. Edit a table income WITHOUT saving and check again — the panel uses what is on screen (FR-028).
4. Enter a grade with no row → "no row matched", not a zero (FR-031).
5. Run the same applicant through `Matching simulator` → identical figures (FR-030, SC-007).

## 3. Ask the customer (Story 2)

```bash
# The three new questions are seeded into the ONE global pool, assigned to `personal`.
curl -s localhost:3000/api/v1/questionnaire?category=personal | jq '.data.groups[].questions[].code'
```

Then in the mobile app (or via the API):

1. Answer `employment_status = government_employee` → the military-grade question becomes visible.
2. Pick `senior_officer`. The option codes ARE the registry keys the admin picked from (FR-017).
   (A government employee is also asked `academic_rank` — one gate serves both facts; skip it.)
3. Submit. The offer's income equals the table row; `incomeOrigin` records which side won.

```bash
curl -s localhost:3000/api/v1/applications/<id> \
  | jq '.data.offers[] | {programCode, monthlyInstallmentEGP, incomeOrigin, incomeSurrogateStrategy}'
```

Skip the grade question instead → the program is still listed and still ranked, with
`SURROGATE_FACT_MISSING` in plain Arabic or English. Never a zero, never hidden (FR-020, FR-022).

## 4. Block a guessed number (Story 4)

1. Beside any income, flip the marker to **we estimated this**.
2. Save → succeeds; the program stays editable (FR-034).
3. Toggle the program on → refused with `PROGRAM_HAS_ESTIMATED_VALUES`, listing **every** estimated
   path (FR-033).
4. On an already-live program, mark a number estimated and save → it is switched off in the same
   action and the reason is recorded (FR-035).
5. `Banks → Waiting for the bank` lists it with its bank, the fields concerned, and how long it has
   been waiting (FR-036).
6. Flip the marker back to **the bank stated this** → the program switches on.

## 5. Verify nothing else moved

```bash
cd backend
npm test -- income-rule-bands income-rule-normalize surrogate-fact-resolution \
            value-source-gate rule-check-simulator-parity
npm test                    # full suite — income_proof offers must be unchanged (SC-009)
```

Manual checks:

- The pre-change offer baseline (captured before Phase 2 landed) still matches for every
  `income_proof` program AND for the `income_surrogate` programs carrying `strategy: 'declared'` —
  business category, doctors, professionals, pharmacies. The declared salary must NOT have been
  haircut by `commercialBankIncomePercent` (SC-009, research R4).
- An existing single-number program (`byBankStatementPercent`, seed `salesfloor-egp-2026`) keeps its
  value and its output with no admin action (FR-015).
- Open a program whose type is NOT `income_surrogate` but which carries a rule, save an unrelated
  field, and confirm the rule is still stored afterwards — ignored and reported, never deleted
  (FR-001 edge case).
- Programs seeded before this feature carry `valueSources = {}`, stay live, and never appear on the
  waiting list (FR-037).
- Toggle the admin to Arabic — the table, the bands and the check panel read right-to-left with no
  physical-direction spacing (FR-044, SC-011); every row action works from the keyboard alone
  (FR-046).
