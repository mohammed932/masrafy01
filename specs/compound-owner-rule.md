# Compound Ownership Guarantee — how the income is worked out

Source of truth: `COMPOUND_RULE` in `backend/prisma/seed-collateral-products.ts:195-410`.
Conversion: `backend/src/matching/pipeline/product-rule-ceiling.ts`.
Evaluator: `backend/src/matching/pipeline/product-rule.ts`.

## What the product is

Not a salary product. It reads what the customer **owns**, derives a **borrowing ceiling**, then
converts that ceiling back into a "recognised income" so the rest of the engine (DBR cap,
obligations, affordability shrink loop, fees) runs unchanged.

- `strategy: 'steps'` — a step pipeline, not one of the eleven built-in income methods.
- `output: { kind: 'maxAmount', from: 'ceiling', baselineDbrPercent: '50' }`.
- The **catalog name owns the structure** (`steps` / `gates` / `output`). A **bank owns only
  `stepParams`** — the figures. Structure is merged on every read, so a bank can never run
  yesterday's pipeline.

---

## The chain, in four blocks

### A. What the customer has already paid

Customer answers only — no bank figure in it.

```
price       = answer  "unit contract price"          (compound_unit_price)
dpPct       = answer  "share of price paid"          (compound_dp_percent)
dpAmount    = price × dpPct%                         ← cash handed to the developer
monthsOwned = answer  "months since contract"        (compound_months_since_purchase)
```

### B. The ceiling — four alternatives, each bank fills exactly ONE

Closed by `coalesce` into `capBasis`: **the first configured alternative wins**. A bank leaves the
other three blank, and a blank one is skipped (`rule_unconfigured`) — not a refusal.

| # | step(s) | how it derives | seeded bank |
|---|---|---|---|
| 1 | `capByUnitType` + `capByUnitTypeTopUp` → `capByUnitTypeForSegment` | table keyed by unit type; `pickByFact` on the derived `bank_relationship` fact picks the column (`ntb` → standard, `xsell` → top-up) | **ABK**: 2M / 3M / 4M · existing customer 3M / 3.5M / 4.5M |
| 2 | `capByCompoundClass` | `factParentTable`: compound **name** → its `parentKey` **class** → table of five rows | **EG Bank**: AA 6M · AB 5M · A 4M · B 3M · C 2M |
| 3 | `capByPaidBand` + `capByPaidBandXsell` → `capByPaidBandForSegment` | band table over `dpAmount`, same segment pick | **FABMISR**: paid 250k–500k → 750k · 500k–1M → 1M · 1M–1.5M → 1.25M · 1.5M+ → 1.5M (cross-sell one tier up) |
| 4 | `capByPaidPercent` | percentage of `dpAmount` | **CAE**: 50% |

A bank that sells no second column leaves the top-up blank and `pickByFact` falls back to the
first column. Same when the applicant skips the "which banks do you already use?" question —
quoted as new-to-bank, never refused.

### C. Two policy multipliers

```
multiUnitPct   = table on "owns another unit"     || 100
afterMultiUnit = capBasis × multiUnitPct%

jointPct       = table on "sole or shared"        || 100
ceiling        = afterMultiUnit × jointPct%        ← the answer
```

`|| 100` is `{ const: '100' }` in the structure. A bank with no such policy multiplies by 1, and
the optional question can be skipped without a `fact_not_answered` refusal.

### D. Ten gates — they refuse, they never change the amount

| gate | reads | reason code |
|---|---|---|
| `dpPercentFloor` | `dpPct` ≥ bank's flat % | `DOWN_PAYMENT_BELOW_MIN` |
| `dpPercentByPrice` | `dpPct` ≥ `requiredDpPct` (band over `price`) | `DOWN_PAYMENT_BELOW_MIN` |
| `dpAmountFloor` | `dpAmount` ≥ bank's flat amount | `DOWN_PAYMENT_BELOW_MIN` |
| `dpAmountByEmployment` | `dpAmount` ≥ amount for that `employment_status` | `DOWN_PAYMENT_BELOW_MIN` |
| `unitPriceFloorByYear` | `price` ≥ floor for that `compound_contract_year` | `UNIT_PRICE_BELOW_MIN` |
| `ownedForMonths` | `monthsOwned` ≥ min, keyed by "unit fully paid off" | `CONTRACT_TOO_NEW` |
| `ownedForMonthsMax` | `monthsOwned` ≤ max | `CONTRACT_TOO_OLD` |
| `strongestUnitConfirmed` | `compound_best_unit_confirmed` = yes | `MULTI_UNIT_NOT_CONFIRMED` |
| `selfEmployedLicence` | `self_employed_licence` ∈ {yes, not_self_employed} | `SELF_EMPLOYED_DOCS_MISSING` |
| `businessYears` | `business_years` ∈ {two_or_more, not_self_employed} | `BUSINESS_TOO_NEW` |

A gate applies **only** when the bank turned it on (a figure, a table, or `applies: true`).
`expect` is an allow-list, which is how one gate serves both the requirement and the applicant it
does not apply to — "I'm not self-employed" passes.

`requiredDpPct` is not a chain step: it sits past the answer and is read only by the
`dpPercentByPrice` gate.

---

## Ceiling → money

```
installmentAtCeiling = PMT(ceiling, cascadeRate, tenor)
recognisedIncome     = installmentAtCeiling × 100 ÷ baselineDbrPercent      (50)
```

Read it as: the bank calibrated its appetite at 50% debt burden when it set that ceiling, so **the
instalment the ceiling implies IS the debt-burden ceiling**.

- Round trip is lossless — zero obligations and cap == baseline returns the exact ceiling back.
- With obligations it returns `ceiling − PV(obligations)`.
- A bank capping tighter (CAE self-employed 40%) gets `applicable ÷ baseline` = 40/50 → 80% of the
  ceiling, with no third setting to keep in step.
- Rate used is the **cascade** rate, not the fee-penalty-adjusted one: the ceiling is a
  credit-policy figure, decided before anyone waived an admin fee.
- `programMax` is then clamped to the ceiling with `binding: 'collateral_ceiling'`, and the figure
  is frozen onto the offer as `bank_offer.collateralCeilingEGP`.
- `IncomeOrigin` becomes `'ceiling'`, which never meets a declared salary — a payslip must not
  rescue a product whose collateral the bank has not priced.

---

## Worked example — ABK, existing customer

Villa, contract price 10 000 000, paid 30%, owns another unit, sole ownership, owned 24 months.

```
dpAmount 3 000 000
  gate dpPercentFloor    30% ≥ 15%   pass
  gate ownedForMonths    24  ≥ 18    pass
capByUnitType      villa      4 000 000
capByUnitTypeTopUp villa      4 500 000
pickByFact  xsell          →  4 500 000
× multiUnit  110%          →  4 950 000
× joint (none → 100%)      →  4 950 000   = ceiling
clamp maxAmountEGP         →  4 500 000
PMT(4.5M, 25.5%, 84m)      ≈    115 300 / month
recognisedIncome ×100/50   ≈    230 700
```

Same customer at **CAE**: alternative 4 fires instead — 50% × 3 000 000 = **1 500 000**, and a
self-employed applicant takes the 40/50 haircut on top.

---

## Reading the three groups on `/program-catalog/compound_owner`

| group | count | why |
|---|---|---|
| Ways to work the figure out | **2 of 4 set** | catalog defaults fill alternative 1 (both columns) and alternative 4. Alternatives 2 and 3 are deliberately undefaulted: a `factParentTable`'s parent keys are not validated at save, and a band miss is `no_matching_band`, which **stops** the rule rather than skipping the step |
| Adjustments | **0 of 2** | `multiUnitFactor` / `jointFactor`. A neutral all-100 default changes no figure and still turns an optional answer into a requirement, because a *configured* table reads its fact |
| Conditions | **0 of 10** | no gate is ever defaulted — an inherited gate is LIVE for any bank on `amounts: 'catalog'`, i.e. a refusal rule it never chose |
