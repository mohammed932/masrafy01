# Quickstart — Simple Program Setup, Banded DBR & Loan Calculator

How to run this feature locally and prove each slice works. Money figures below are examples, not policy.

## 1. Bring the stack up

```bash
docker compose -f docker/compose.dev.yml up -d postgres redis

cd backend
nvm use && npm install
npx prisma migrate dev                 # applies the three feature migrations in order
npx prisma db seed                     # idempotent super_admin
npx ts-node prisma/seed-questionnaire.ts        # global pool + the 4 number questions
npx ts-node prisma/seed-program-catalog-defaults.ts   # archetype defaults (FR-004)
npm run start:dev                      # http://localhost:3000, docs at /api/docs

cd ../admin && npm install && npm start # http://localhost:5173
```

Mobile: `cd masrafy-app && flutter pub get && flutter run` (points at the local API via the existing dev config).

> The third migration (`prune_unused_eligibility_settings`) is **destructive**. Locally it is fine. Before any shared environment: take a `pg_dump` of `bank_program`, get the product owner's go-ahead, and note it in the release notes (FR-015c).

## 2. Verify each slice

### Question types end to end (Story 3, P1)

1. Admin → Questionnaire. Create four questions, one per type. For the number one set unit `EGP`, min 1 000, max 20 000 000, step 1 000, binding `requested_amount`.
2. Publish. Expect a warning if any of the four money bindings is unclaimed.
3. App → start the personal questionnaire. Expect: one-pick sheet, multi-pick sheet, text field, number field with the unit shown.
4. Enter 500 000 in the amount field. Admin → Applications → the answer record shows `500000.00`, not a bucket.
5. Admin → Scoring weights. The multi-choice, text and number questions are **absent** from the assignable list (R9).

**Fails if**: a type renders as nothing; a number answer lands as a bucket midpoint; a non-single-choice question is assignable.

### Figures in results (Story 2, P1)

1. Complete the questionnaire in the app with amount 500 000, tenor 60, income 20 400, obligations 2 000.
2. Results list: every card shows monthly payment, offered amount, cash received, total fees, total cost, and the disclaimer.
3. Submit the application. Compare the offer figures to the preview figures — they must match string for string (SC-004).
4. Set the amount above a program's maximum. That card shows the maximum with `bindingConstraint: program_max`.

```bash
curl -s localhost:3000/api/v1/matching/preview -H 'Authorization: Bearer <customer>' \
  -H 'content-type: application/json' -d '{"category":"personal","answers":[
    {"questionCode":"amount_requested","numericValue":"500000"},
    {"questionCode":"repayment_period_months","numericValue":"60"},
    {"questionCode":"monthly_income","numericValue":"20400"},
    {"questionCode":"current_installments","numericValue":"2000"}]}' | jq '.data.matches[0].figures'
```

**Fails if**: `monthlyInstallmentEGP` is `null`; preview and offer differ; a program vanishes instead of showing a reason.

### Banded DBR (Story 5, P2)

1. Admin → a bank program → Essentials → DBR → switch to bands. Enter 30/≤5 000, 35/≤10 000, 40/≤20 000, 45/≤30 000, 50/open.
2. Save. Then try an out-of-order band → expect `DBR_BANDS_INVALID` naming the index.
3. Simulate income exactly 10 000 → cap 35% (inclusive upper bound). Income 30 001 → 50%.
4. Simulate income 20 400 on a program whose income assumption applies 85% → recognised 17 340 → cap **40%**, not 45%. This is the ordering bug the feature exists to prevent.

```bash
curl -s localhost:3000/api/admin/matching/simulate -H 'Authorization: Bearer <admin>' \
  -H 'content-type: application/json' -d '{"category":"personal","answers":[],
  "applicant":{"age":34,"requestedAmountEGP":"300000","preferredTenorMonths":60,
  "monthlyNetSalaryEGP":"20400","existingMonthlyObligationsEGP":"2000","currency":"EGP"}}' \
  | jq '.data.matches[] | {programCode, dbr: .figures.dbrCapPercent, band: .figures.dbrBandIndex}'
```

**Fails if**: the band resolves off the declared income instead of the recognised income; a flat-cap program changes behaviour.

### Simple program setup (Story 1, P1)

1. Admin → Bank → Lending policy. Fill age 21–60, min income 5 000, DBR bands, tenor 6–84. Save.
2. Admin → Program Catalog → "Doctors" → Defaults → personal. Fill rate 24%, amount 20 000–500 000, tenor 6–72. Save.
3. Admin → Bank Programs → New. Pick the bank, "Doctors", personal. The form opens filled; each field shows `BANK_POLICY` / `CATALOG`.
4. Change only the rate. Save. Count the fields you touched — target ≤8 and under 3 minutes (SC-001).
5. Edit the bank policy afterwards. Reopen the saved program: its numbers are unchanged (SC-008).
6. Duplicate the program. A `DRAFT` copy opens needing only a new code and name.

**Fails if**: prefill is empty for a seeded archetype; a saved program moves when the policy changes; Advanced is required to save.

### Loan calculator (Story 4, P2)

1. App → Calculator. Cost mode: amount 300 000, tenor 60 → payment, total payable, total cost, itemised fees.
2. Affordability mode: income 20 400, obligations 2 000 → max amount, its payment, the DBR% used.
3. Open the calculator from a program detail. Enter an amount above the program max → clamped, with the limit stated.
4. Generic mode (no program) → the representative rate is stated as representative.

**Fails if**: the app computes anything itself (figures must come from the server); a clamp happens silently; fees are folded in without itemisation.

### Prune (Story 1 scenario 6, P1, gated)

```bash
cd backend && npx prisma migrate dev --name prune_unused_eligibility_settings
```

Expect: a logged count of affected programs; pruned keys gone from `bank_program.eligibility`; `dbrCapPercent`, `skipDbrCheck`, `requiresCollateral`, both bank-income percentages, `ageMin`/`ageMax`, `minMonthlyIncomeEGP` intact; the admin form no longer shows any pruned field; posting a pruned key returns `VALIDATION_FAILED`.

## 3. Targeted tests

Backend and admin both run **Vitest** (`npm test` → `vitest run`); the backend had no test runner before this feature.

```bash
cd backend
npm test                            # every spec in backend/test/
npm test -- dbr                     # band boundaries + scalar fallback
npm test -- quote                   # PMT/PV identity, fee financing, binding constraint
npm test -- parity                  # preview ↔ offer, 10 golden profiles
npm test -- questionnaire-answer     # 4 types × right/wrong payload
npm test -- prefill                 # catalog beats policy; copy-on-save immunity
npm run test:watch                  # watch mode

cd ../admin && npm test             # band editor validation, Essentials-only save
cd ../masrafy-app && flutter test   # per-type controls, no local money math
```

## 4. Order of work

Follow the slices in this order — each is independently demoable:

1. Question types + typed answers (backend → admin builder → app shared view → mappers)
2. `quote.ts` + figures in preview and apply (parity test is the gate)
3. Banded DBR (resolver → validator → shared editor in three hosts)
4. Prefill: bank policy → catalog defaults → merge endpoint → Essentials/Advanced form + duplicate
5. Calculator (backend endpoint → app screen)
6. Numeric simulator, then the prune migration last, once nothing reads the pruned fields

Before building any of the three new admin surfaces, run the `promax` skill; after the first implementation, run `impec` (Principle XXIII, A17).
