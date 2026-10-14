# Auto Loan — surrogate implementation plan

**Companion to:** [`auto-loan-master-review.md`](./auto-loan-master-review.md) (what the sources say).
This document is **how to build it**: sliced into independently shippable features, in dependency order.

**Reviewed against:** `backend/` + `admin/` at `predefined_surrogate_programs` (`a5205a7`), constitution v30.0.0.
**Status:** plan for review. Nothing implemented.

---

## 0. Read this first — two findings that reshape the slicing

### 0.1 Most of the auto book is **not** surrogate, and forcing it in would be wrong

"Surrogate" in this codebase is a precise thing: `programType: 'income_surrogate'`, a
`surrogate_product` row holding a calculation, and a quote priced off a figure **derived from
something other than a payslip**. Measured against that, the auto sources split three ways:

| Source programme | Income basis | Surrogate? |
|---|---|---|
| SCB 60/50/40/30/20% DP | Down payment ÷ 36 ÷ 10% | ✅ **Yes** — exists as `down_payment_income` |
| SCB Green Power · Micro Mobility | Demonstrated savings ÷ 36 ÷ 10% (or ÷ 60 ÷ 20%) | ✅ **Yes** — exists, same product, `alt` way |
| SCB **Semi-Covered** | None — eligibility column reads *"Not Required"* throughout | ✅ **Yes, new** — a **ceiling** product |
| CAE **Secured Against Deposits** | None — *"Minimum Income: Waived · DBR: Not Applicable"* | ✅ **Yes, new** — a **ceiling** product |
| CAE New / Used / EV auto (20–50% DP) | *"Minimum Income: Waived, to be validated as per **income validation policy (IVP)**"* | ❌ No — income is validated, only the *threshold* is waived |
| CAE Doctor Auto Loan (0719) | Syndicate card + income documents, relaxed ≤ 3 MEGP | ❌ No — **confirm**, but the page lists income documents |
| ADIB × 3 grids | Employee / business owner, home + work verification | ❌ No |
| HDB E2–E6 · S2–S5 · Luxury | *"DBR 50% **of income**"* | ❌ No |

**So: two new surrogate products, not twelve.** The rest is bank-programme data on payslip
programmes. That is not a disappointment — §0.2 is where the real product-layer work is.

> Putting a payslip programme behind a surrogate product would trip `PROGRAM_NAME_INCOME_PROOF_MISMATCH`
> at save (v17.0.0) — the platform already refuses this. The rule is not advisory.

### 0.2 The mechanism gap: **plan tables cannot be inherited without an income rule**

This is the finding that decides the plan, and the codebase already half-admits it.

`planDefaults` (the five plan grids from v30.0.0) and `tenorDefaults` reach a bank programme
through exactly one seam — `effectiveProgramNameRule` in `matching/pipeline/income-rule-inherit.ts`:

```ts
if (product !== undefined) {
  if (!product.active || product.deprecatedAt !== null)
    return { withheld, productKey, ...tenor, ...plans };   // retired → still carries plans
  if (product.rule !== undefined)
    return { rule, productKey, ...tenor, ...plans };       // active + rule → carries plans
}
const rule = own ?? undefined;
return rule === undefined ? undefined : { rule };          // ← no tenorDefaults, NO planDefaults
```

An **active product holding plan tables but no calculation falls through to the last line and its
plans are dropped.** A payslip catalog name with no product at all returns `undefined`. Either way:

> **A payslip auto programme cannot inherit product plan tables today. At all.**

`CatalogRuleResolution`'s own docblock names this gap and argues it has no reader:

> *"…a real if narrow gap, stated rather than papered over — for a product that has typed a
> duration but holds no calculation yet… Nothing inherits in that window, and nothing quotes
> either: the rule is what makes a program quote at all, so the gap has no reader."*

**The auto book is that reader.** ADIB, HDB and CAE sell the *same plan shape* — deposit tier →
rate, financed share, term, floor — with different figures. Without this, the DP-tier table is
retyped once per bank per programme (ADIB alone: 3 grids × 4 deposits × 4 terms × 2 insurance
states), and the "predefined programs" idea does not reach the payslip half of the book at all.

Note the inconsistency the code already has: a **retired** product carries its plans; an **active
rule-less** one does not. That asymmetry is not defended anywhere — it falls out of the branch order.

**S1 closes it.** Everything in Phase 2 depends on it.

---

## 1. Where each kind of fact lives

Worth fixing in one table before slicing, because the repo authors these in four different places
and putting a figure in the wrong one is the most common way this work goes wrong.

| Layer | Holds | Authored in | Changing it… |
|---|---|---|---|
| **Blueprint** (code) | The product's *shape*: asks, template mechanism, cap structure, suggested bands | `blueprints/product-blueprints.ts` → `npm run seed:blueprints` | needs a deploy; **never** overwrites a product that already holds a calculation |
| **Product figures** | `stepParams` (incl. `iscore_band`), `capDefaults`, `tenorDefaults`, `planDefaults` | `demo-figures/sheet-figures.ts` → `seed:sheet-figures`, **and** the admin product screen | moves **live quotes** for every inheriting programme |
| **Bank programme** | Rate, fees, limits, tenor, eligibility, documents, its own grids | `demo-figures/sheet-programs.ts` → `seed:sheet-figures`, **and** the wizard | moves that programme only |
| **Questionnaire** | Questions, options, category assignment | `prisma/seed-questionnaire.ts` → `seed:questionnaire` | cuts a new snapshot |

**`planDefaults` is not in `ProductBlueprint`.** Verified: the type carries `asks`, `template`,
`cap`, `suggestedBands` and no plan/tenor/DBR defaults. So a new auto product needs **both** a
blueprint entry (shape) and a `sheet-figures.ts` entry (numbers). S2 covers the consequence.

---

## 2. Feature slices

Sized S / M / L. Every slice is independently shippable and independently verifiable.

### Phase 1 — mechanism (nothing else depends on data)

---

#### **S1 · Plan defaults inherit without an income rule** — M — *blocks all of Phase 2*

**Problem.** §0.2. A payslip programme cannot read a product's plan tables.

**Change.** A third arm on `CatalogRuleResolution` — a resolution that carries `productKey`,
`tenorDefaults` and `planDefaults` but **no `rule`**.

```ts
export type CatalogRuleResolution =
  | { rule; productKey?; tenorDefaults?; planDefaults? }
  | { withheld: 'surrogate_product_retired'; productKey; rule?; tenorDefaults?; planDefaults? }
  | { productKey; tenorDefaults?; planDefaults? };        // NEW — plans only, no calculation
```

`effectiveProgramNameRule` returns it when a product is active, holds no rule, **and** holds at
least one default. `catalogRuleOf` must answer `undefined` on this arm — a programme must not
start reading a calculation that is not there.

**Why a third arm and not a nullable `rule`.** The two existing arms are discriminated by which
key is present, and every reader (`catalogRuleOf`, `catalogTenorOf`, `catalogPlansOf`,
`productKeyOf`) is a one-line accessor over that union. A nullable `rule` collapses the
discriminant and makes "withheld" and "never had one" indistinguishable at the type level — and
those two must stay distinguishable, because one refuses a quote (`SURROGATE_PRODUCT_RETIRED`)
and the other is the normal state of a payslip product.

**The blast radius is one function.** `catalogPlansOf` / `catalogTenorOf` already read
`resolution?.x` and work unchanged. `bank-program-snapshot.mapper.ts` already merges plans on
three lines. **No call site moves.**

**Also fix, in the same change.** `programNameIncomeRules()` must return a row for a name whose
product holds plans and no rule — today it may skip it, in which case the third arm is never
reached. Verify before assuming.

**Acceptance**
- A payslip programme on a catalog name whose product states `planDefaults` and `plansSource: 'product'` quotes off the product's grids.
- A programme with `plansSource: 'own'` under the same product is **byte-identical** to before.
- A product with neither rule nor defaults still returns `undefined` — no empty resolution.
- `catalogRuleOf` returns `undefined` on the new arm (assert it; a programme reading a rule that is not there is the failure mode).
- `quote:rates`, `quote:surrogate`, `quote:car-plans` **byte-identical** before/after (nothing opts in yet).

**Files** · `matching/pipeline/income-rule-inherit.ts` · `bank-programs/bank-program-snapshot.mapper.ts` (assert only) · `platform-enumerations/postgres-platform-enumerations.repository.ts`

---

#### **S2 · Blueprints can declare plan and tenor defaults** — S — *depends on S1*

**Problem.** §1. A blueprint states the shape; the numbers live only in `sheet-figures.ts`. A new
auto product therefore cannot ship as a **library** entry an operator picks — the half that makes
it quote arrives from a separate seed.

**Change.** `ProductBlueprint` gains optional `planDefaults?` and `tenorDefaults?`, written by
`blueprint-plan.ts` **on create only** — the same rule the rest of the seed already follows
(`planSeedAction` answers `skip` for a product that already holds a calculation, so an operator's
own figures are never overwritten on a re-run).

**Boundary to hold.** Blueprints declare **structure and a defensible default**, never a bank's
published figure. A rate a bank prints belongs in `sheet-figures.ts` with a `team_estimated`
marker or a real source. If a blueprint default would be a made-up rate, leave it out.

**Acceptance** · `seed:blueprints` reports the new defaults written on create, **0 written** on a re-run · an existing product's figures are untouched by a second run.

**Files** · `blueprints/product-blueprint.types.ts` · `blueprints/blueprint-plan.ts` · `blueprints/blueprint-seed-plan.ts`

---

#### **S3 · Two new facts: verification regime · dealer** — S — *independent*

Both are grid axes the auto sheets key on and neither exists.

| Fact | Options | Read by |
|---|---|---|
| `verification_regime` | `home_and_work` · `home_only` · `none` | ADIB's three rate grids (§2.7 of the review) |
| `car_dealer` | `ghabbour_mansour` · `other_authorized` · `individual_seller` | Chinese tenor overlay (60 vs 84 mo) · CAE used-car Chinese age split (5 vs 8 yrs) |

Both are **platform facts** in `VEHICLE_FACT_KEYS` (which puts them in `RESERVED_FACT_KEYS` for
free), both **optional**, both in the `car` category.

**Optional is not laziness — it is required.** The `car` category also sells the two Green
Finance programmes. A required question about a dealership would refuse a solar applicant. The
same argument `car_fuel_type`'s docblock already makes. Safe because a grid states a **wildcard
row** and `specificity()` ranks named axes higher, so a skipped answer is still priced.

**Verified before proposing:** `car_origin`'s eleven options are inline `question_option` rows and
`enumerationParentKeys()` reads `platform_enumeration` only — so **`via: 'parentClass'` will not
work on them.** Dealer must be its own axis with one cell per (origin, dealer) pair, exactly as
v30.0.0 found for origin.

**Also:** teach `factsReadByLoanLimits` / `factsReadByTenor` about both, or they are invisible to
the narrowing rule, `check:question-scope`, the fact-delete guard and the untick guard at once.

**Acceptance** · both answerable and reaching a grid · `check:question-scope` clean · `check:parent-keys` clean · an applicant skipping both is still priced by a wildcard row.

**Files** · `prisma/seed-questionnaire.ts` · `matching/pipeline/car-details.ts` · `matching/pipeline/fact-question-eligibility.ts`

---

### Phase 2 — the surrogate products (depends on S1 + S2)

---

#### **S4 · `deposit_secured_ceiling` — a new ceiling blueprint** — M — *depends on S2*

The one genuinely new surrogate product in the sources, and it serves **two banks**.

**Both sheets state the same mechanism:** the loan is a percentage of a pledged deposit, and the
percentage is keyed by an answer.

- **CAE** (codes 0706 / 0707 / 0730): Monthly 95% · Quarterly 90% · Semi-annual 85% · Annual 80%, keyed on **payment frequency**. Income, business seniority, DBR and internal verification all waived.
- **SCB Semi-Covered**: up to 100% of the CD where 90% of the loan is secured; may drop to 80% for semi-annual/annual payment. Eligibility column reads *"Not Required"* throughout.

**This fits the existing template layer exactly** — `group: 'ceiling'`, `outputKind: 'maxAmount'`,
the shape `compound_owner` already uses:

```
primary: { kind: 'shareOf', fact: 'pledged_free_amount' }
column:  { fact: 'payment_frequency', branches: [monthly, quarterly, semi_annual, annual] }
```

**Reuse, don't mint.** `pledged_free_amount` and `pledged_months_since_issue` already exist on the
`pledged_collateral_share` blueprint. Only `payment_frequency` is new.

**Do not merge it into `pledged_collateral_share`.** That one is `group: 'income'` — it derives a
monthly income from a share of the pledge, then runs the whole DBR cascade. This one is
`group: 'ceiling'` and **bypasses DBR entirely**. Same collateral, opposite arithmetic. One
product cannot hold both without `outputKind` meaning two things.

**No engine change is needed — checked, and this is worth knowing before anyone proposes one.**
The obvious worry is that these sheets state *no DBR at all* while `quoteProgram` checks one, so
a `dbrApplies: false` flag looks necessary. It is not. `product-rule-ceiling.ts` already converts
a ceiling into the currency the pipeline speaks:

```
installmentAtCeiling = PMT(ceiling, rate, tenor)
recognisedIncome     = installmentAtCeiling × 100 ÷ baselineDbrPercent
```

and the round trip is **lossless** — feeding that income back through `calculateMaxLoanFromDbr`
with zero obligations returns the ceiling to the cent, which the golden vectors already assert.
So `template.output.baselineDbrPercent` is the whole mechanism: the product states the cap the
bank calibrated its share against, and the deposit share quotes exactly.

**S4 is therefore pure data** — a blueprint, a question and two programmes. **Seeding
`dbrCapPercent: '100'` would still be wrong** (a fabricated figure frozen onto an immutable
`bank_offer`, Principle I / A6); `baselineDbrPercent` is a stated policy input, not a guess.

**One narrower question remains.** With obligations, the conversion returns
`ceiling − PV(obligations)`. For a *fully secured* facility a bank may intend the deposit to cover
the exposure and ignore other debts entirely. The sheets say *"Minimum Income: Waived · DBR: Not
Applicable"* — which reads as *no income threshold test*, not *obligations ignored*. Deducting is
the conservative reading and the safer default. **Confirm, but it does not block the slice** — it
changes one figure, not the shape.

**Acceptance** · `seed:blueprints` creates it, re-run writes 0 · a 1,000,000 CD with no obligations quotes **exactly** 950,000 monthly / 800,000 annual (the lossless round trip) · a withheld frequency answers a stated reason, never a zero or a silent top row · `check:income-proof` clean.

**Files** · `blueprints/product-blueprints.ts` · `prisma/seed-questionnaire.ts` (`payment_frequency`) · `demo-figures/sheet-programs.ts` — **no engine file**

---

#### **S5 · SCB completion: Privé tiers + EV Cars** — S — *depends on S3 pattern*

Three gaps on a product that already exists.

1. **`wealth_tier` fact** (`standard` · `hnw` · `uhnw`) → `loanLimits.maxLoanByFact` raising the surrogate ceiling 5M → 9M and Green 1M → 2M/4M.
2. **`SCB-CAR-EV_CARS`** — the third Green programme (200K–9M) the Privé table names, absent from the standard sheet. **Confirm it is not Privé-only before seeding.**
3. **The DOCX §10 figures are Privé, not standard** — the standard sheet says Green Power max **1M**. Whatever is seeded must match the sheet, not the DOCX.

**Blocked on a product decision, and it is not a small one.** `wealth_tier` is **self-declared by
the applicant** and **verified by the bank from AUM**. A self-declared UHNW answer lifting a quoted
ceiling from 5M to 9M is a number the branch will not honour — and on this platform it freezes onto
an immutable offer.

**Recommendation: quote the standard ceiling and *disclose* the Privé tier** — a line on the offer
saying a higher tier exists for qualifying customers — rather than letting the answer raise the cap.
That keeps the quote true and still surfaces the product. **Do not build until this is answered.**

---

#### **S6 · CAE auto book** — M — *depends on S1, S3*

Eleven programmes (full table in the review, §B1). **All `income_proof`** — no surrogate product,
no blueprint. What they need already exists field-for-field:

| Sheet rule | Field | Status |
|---|---|---|
| Max loan 10M / 7M / 4M by origin | `loanLimits.maxLoanByFact` on `car_origin` | ✅ exists |
| Employed 84 mo · Self-employed 60 mo (50% DP) | `tenor.maxMonthsByEmploymentType` | ✅ exists |
| Financed share 80 / 65 / 60 / 50% | `ltvCeilingPercent` | ✅ exists |
| Age 21 new · **25 used** | `ageMin` | ✅ exists |
| Chinese 60 mo, 84 via Ghabbour & Mansour | `tenor.maxMonthsByFact` on `car_origin` × `car_dealer` | needs **S3** |
| Used-car age 12 / 8 / 8 / 5 yrs back by origin | `tenor.maxMonthsByFact` | ✅ exists (tabulated form) |

**The plan-table question.** If **S1 + S2** land, the four CAE DP tiers state their shape once on a
`cae_auto_plans` product and each programme reads it. If they do not, each programme retypes it.
This slice is the first real test of whether S1 earned its place — **sequence it immediately after**.

**Acceptance** · `seed:sheet-figures` **0 written / 0 refused** on a re-run · `quote:rates` shows each programme priced · a 4M-tier car is not quoted above 4M (the defect the prototype ships) · `quote:car-plans` extended with a CAE case.

---

#### **S7 · ADIB rate grids** — M — *depends on S3*

Three `pricing.rateByFact` grids, axes `car_down_payment_percent` × `tenor_months` × `car_insurance`
(all three exist) plus `verification_regime` from **S3** to separate grid (a) from grid (c).

**Two properties that will break a naive implementation:**

1. **The 60% deposit row has no insured column at all.** That is *"not sold"*, not *"not filled in"* — a **reject** cell, not a blank. A blank falls to `onNoMatch` and quotes something. Needs **A1**.
2. **Grid (c) is not monotonic** — 40% DP is dearer than both 30% and 50%. That is what the sheet prints. Any validator or advisory assuming "rate falls as deposit rises" will refuse a correct table. **Verify `fact-grid.validator.ts` does not assume this before seeding.**

**Blocked on one product answer:** ADIB is Islamic, so these are **profit** rates. `rateBasis`
exists (v20.3.0, `reducing` | `flat`) — but whether a murabaha profit rate prices on the reducing
annuity is a product decision, and it moves every ADIB figure by 22–29%.

**Acceptance** · all three grids save and quote · the 60% insured cell **refuses** rather than quoting · the non-monotonic grid saves without a fight · `quote:rates` covers one case per grid.

---

#### **S8 · HDB** — S — *depends on S1*

Nine sheet rows that are **not nine programmes**. E5/E6 and S4/S5 differ *only* by insurance —
which makes them **rows in an `ltvCeilingByFact` grid** keyed on `(employment_status, car_insurance)`,
not separate cards. Two programmes (employee, self-employed) plus Luxury at 25% DP.

**Every rate is a placeholder** — the DOCX publishes none. Mark all of them `team_estimated` in
`valueSources`, exactly as the SCB card was, and make sure the marker is visible in the **wizard**
(see A7), not only on the product screen.

---

### Phase 3 — engine rules

---

#### **S9 · Car age at maturity** — M — *independent*

`manufacture_year + tenor_years ≤ N`, N per origin (**14** German/Japanese/American · **13**
Korean/French/Spanish/Italian/Czech · **7** Chinese).

**Why not a grid.** Tabulating it needs one row per (origin × model year) and the table goes stale
every January — the same "clock in disguise" argument `seed-questionnaire.ts:357` already makes when
explaining why `model_year` became a number. A derived clamp stays correct with no maintenance.

**Shape.** `tenor.maxVehicleAgeAtMaturityYears?: FactGridConfig` keyed on `car_origin`, reading
`car_model_year`. A pure clamp composed by `min` beside the applicant's own age-at-maturity clamp
in `quote.ts` — **not** a cascade level.

**No new error code.** `VEHICLE_NOT_ELIGIBLE` reads *"This bank does not finance a car of that model
year, origin, or at that down payment."* — verified in `error-codes.en-US.json:225`, already covers it.

**Acceptance** · a 2015 Japanese car refuses an 84-month term and passes 72 · a Chinese 2022 car caps at 60 months · absent model year does **not** refuse (optional question) · `check:codes` **225, unchanged**.

---

#### **S10 · Mileage** — XS — *independent*

`car_mileage_per_year`, numeric, optional. CAE p24 rejects above 40,000 km/yr (economy) and
100,000 km/yr (luxury). Reuses `VEHICLE_NOT_ELIGIBLE`. Ship with **S6** or not at all — it is a CAE
vendor-coding rule with no other reader.

---

#### **S11 · I-Score reconciliation** — XS — **blocked on a source, do not start**

The prototype publishes 60 / 85 / 90 / 100 at edges 521 / 625. The repo seeds 80 / 100 / 110 at
550 / 700, **all marked `team_estimated`** on a comment saying no bank has published one.

If the prototype's figures are a bank's: three band edges, three percentages, the `coalesce`
fallback `'100'` → `'85'` (which is how the unrepresentable "N/A" row gets a home), and nine
`team_estimated` markers come off.

**These four numbers multiply every surrogate quote on the platform**, and the prototype is the only
place they appear. **Do not implement on its authority alone.**

---

## 3. Admin slices

Mode is **Operate** throughout (impeccable): the operator is in a task; scanability and consistency
outrank expression. Existing tokens only — no new colour, no raw hex, no raw px (A18, A27,
Principle XXIV). Per Principle XXIII, `ui-ux-pro-max` runs **before** each new screen and
`impeccable` **after** first implementation.

| # | Slice | Size | Depends on | Note |
|---|---|---|---|---|
| **A1** | **Reject-cell in the grid editor** | S | — | **Blocks S7.** A blank cell and a refused cell are different statements; today a blank falls to `onNoMatch` and quotes. Third cell state, struck ink at `--text-secondary`, `aria-label` *"not sold at this deposit"*. **Never `disabled`** — a disabled cell leaves the tab order and its reason is announced to nobody (the defect v23.0.0 fixed on the ask board). |
| **A2** | **Third grid axis** | M | A1 | ADIB's grid is DP × tenor × insurance; the editor renders two axes plus a second value column. **Do not build an N-column table** — v25.1.0's reasoning holds: forking key-match / re-key / reorder / delete per column on the one control that edits live figures is how columns come to disagree. Render the third axis as a **segmented rail above the table** (`app-rail-tabs appearance="segmented"`, already shipped), with filled-cell count per segment. |
| **A3** | **Plan defaults on a rule-less product** | S | S1 | The product screen's Plans card assumes a calculation exists. After S1 a product may hold plans and no rule — the card must render, and step ② must not read `invalid` for a product that legitimately has no calculation. |
| **A4** | **Plan-row breakdown in the simulator** | M | S6 | **Most of this exists.** `features/questionnaire/matching-simulator.page.ts` already returns instalment, rate, max affordable, rejection reasons and `bindingConstraint` per programme. What it cannot show is *which plan row the deposit landed in* — since v30.0.0 the five tiers are one programme. Extend `SimulationFigures` with the resolved cell; render as a nested table (`overflow-x: auto` mandatory). **Reuse `bindingConstraintLabel`** — a second set of labels for one closed enum is how the two come to disagree. |
| **A5** | **Offer cross-check panel** | S | — | The prototype's best screen: type a bank's quoted instalment/tenor/rate → implied loan, DP, LTV, total interest, total payable, checked against the programme. `maxPrincipalRaw` already does the arithmetic. `POST /v1/calculator/quote` exists but runs the **forward** direction for customers; neither replaces the other. Read-out only — no Save, nothing persisted. Round to the nearest 500 EGP **and say so on screen**, or the operator reads a rounding as an error. |
| **A6** | **S3's two facts in the wizard** | S | S3 | Rows in the existing **Requirements** card (step ④) and pickable axes in the grid editor. **No new step** — v26.1.0 collapsed eight steps to five precisely because a step owning one control is not a step. |
| **A7** | **Estimate marking in the wizard** | XS | — | HDB publishes no rate, ADIB no DBR. `valueSources` / `team_estimated` exists and the *product* screen renders it. Verify it is visible on the **bank programme** wizard too — an operator typing a placeholder should see it marked in the same breath. |

**Non-negotiable for every one of the above** — each has bitten this repo before:

- `--text-tertiary` is **3.83:1** on a card in light mode. Anything an operator must *read* takes `--text-secondary`. (Recorded in `DESIGN_SYSTEM.md`; re-found in v22.0.0, v23.1.0, v25.1.0, v26.2.1.)
- `outline: none` + a bare `--focus-halo` is a **1.24:1** indicator. Use the house pattern: `outline: var(--focus-ring-width) solid var(--focus-ring-color)` + offset.
- Logical properties only (A19). Every screen driven in **RTL** with page overflow measured at **0**.
- 44×44px minimum touch target under `@media (hover: none)`.
- No new `nz-icon` patch inside a shell that projects content — `NzIconDirective` resolves the *nearest* patch service, so a shell's patch shadows every form inside it (v19.1.0). Inline SVG.
- **Verify a token exists before using it** — v18.1.2 found six `var()` references to tokens no palette defines; invalid at computed-value time, so the rule silently paints nothing.
- Errors after `touched`, never on load; a focusable error summary linked to each invalid field on any multi-field save (ui-ux-pro-max, Forms/Accessibility, **High**).

---

## 4. Dependency graph

```
S1 plan inheritance ──┬── S2 blueprint defaults ── S4 deposit_secured_ceiling
   (mechanism)        │                                    ↑
                      ├── S6 CAE auto ────────────┐
                      └── S8 HDB                  │
                                                  │
S3 facts ─────────────┬── S6 CAE auto ────────────┤
   (verification,     ├── S7 ADIB grids ──────────┤
    dealer)           └── A6 wizard controls      │
                                                  │
A1 reject-cell ──────── S7 ADIB grids             │
A2 third axis ───────── S7 ADIB grids             │
                                                  │
S9 car age ─────────── independent                │
S10 mileage ────────── ships with S6 ─────────────┘
S5 Privé ───────────── BLOCKED (self-declared wealth)
S11 I-Score ────────── BLOCKED (source)
```

**Critical path:** `S1 → S2 → S6`. Everything else parallelises.

---

## 5. Suggested sequencing

| Sprint | Ships | Proves |
|---|---|---|
| **1** | S1 · A1 | The mechanism, with **zero** behaviour change — all three quote scripts byte-identical. The safest possible first landing. |
| **2** | S2 · S3 · A6 | The library can state plan defaults; the two missing axes are answerable. Still no figure moves. |
| **3** | **S6** · S10 · A3 | First real book on the new mechanism. CAE's eleven programmes quote, and a 4M-tier car stops being quoted at 7M. |
| **4** | S7 · A2 · S8 · A7 | ADIB and HDB. The rate-grid editor earns the third axis. |
| **5** | S9 · A4 · A5 | The used-car age rule, and the two operator screens. |
| **—** | S5 · S11 | **Blocked on an answer, not on effort.** Unblock in §6 order. **S4 is not blocked** — schedule it any time after S2. |

**Sprint 1 is deliberately invisible.** S1 changes what is *possible*, not what is *quoted*. The
proof it worked is that nothing moved — which is also the proof it is safe to build on.

---

## 6. Decisions needed before the blocked slices can start

| # | Question | Blocks | Why it cannot be assumed |
|---|---|---|---|
| 1 | Are the prototype's I-Score multipliers a bank's table or the author's estimate? | S11 | Multiplies **every** surrogate quote on the platform |
| 2 | Is the administrative fee financed or paid upfront? | S6, S7 | The prototype capitalizes it; the backend reports it. Changes the instalment on every quoted loan |
| 3 | Should a self-declared HNW/UHNW answer **raise a quoted ceiling**, or only disclose the tier? | S5 | A self-declared answer lifting 5M → 9M freezes onto an immutable offer the branch will not honour |
| 4 | On a **fully secured** facility, should existing obligations still reduce the amount? | S4 (does **not** block) | `baselineDbrPercent` deducts them today. Deducting is the conservative reading of *"DBR: Not Applicable"* |
| 5 | Do ADIB murabaha **profit** rates price on the reducing annuity? | S7 | Moves every ADIB figure by 22–29% |
| 6 | Which ADIB used-car age sheet is current — photo 1 (2015 / ≤14 yrs) or photo 2 (2016 → 4 yrs)? | S9 | Decides refusals |
| 7 | Are there real HDB rates, or does HDB ship on placeholders? | S8 | Determines whether every figure carries `team_estimated` |
| 8 | Is CAE "Pick-up & Small Trucks" real, or prototype-only? | S6 | Not found in the 36 photos |
| 9 | Is CAE "Doctor Auto Loan" (0719) surrogate or income-proof? | S6 | Decides whether it needs a blueprint at all |

---

## 7. Verification per slice

Per the testing policy in `CLAUDE.md` — **no new unit tests**; existing suites stay and must pass.
What a change is expected to show instead:

**Every slice:**
- `npx tsc --noEmit` both sides · lint at HEAD parity per touched file
- `check:codes` · `check:income-proof` · `check:parent-keys` · `check:question-scope` · `check:conditions`
- Backend + admin suites green, counts reported
- Both locale builds, ar-EG untranslated measured **against a worktree of HEAD**

**Slices that touch figures — the real net:**
- `quote:rates` · `quote:surrogate` · `quote:car-plans` captured **BEFORE**, compared **AFTER**. A slice claiming to move no money proves it byte-for-byte.
- `seed:blueprints` and `seed:sheet-figures` re-run reporting **0 written / 0 refused** — which is what proves a migration wrote exactly what the seed would have.

**Slices that touch a screen:**
- Driven in a browser on the running app: page overflow measured at **0**, console watched, in **light, dark and RTL**.
- Contrast measured through a canvas, not read off a token name. (The harness has been wrong three times in this repo's history — `color-mix` resolving to `color(srgb …)` that an `rgba()` regex cannot parse, a scripted `.focus()` not satisfying `:focus-visible`, an injected probe node getting no component styles. Make the probe **throw** on an unparsed colour rather than guessing.)

**Slice-specific gates worth writing down now:**

| Slice | The one thing that must be measured |
|---|---|
| S1 | All three quote scripts **byte-identical**. Nothing opts in; if a figure moves, the branch order is wrong. |
| S4 | A 1,000,000 CD with no obligations quotes **exactly** 950,000 monthly / 800,000 annual — the lossless round trip. |
| S6 | A 4M-tier car is **not** quoted above 4M — the exact defect the prototype ships. |
| S7 | The 60% insured cell **refuses** rather than quoting, and the non-monotonic grid **saves**. |
| S9 | A 2015 Japanese car refuses 84 months and passes 72; an **absent** model year does not refuse. |

---

## 8. What not to build

Stated so nobody reaches for the prototype as a reference:

- **Do not port the prototype's DP handling.** It sets `finance = price − price × dpMin` and treats the deposit as final. The DOCX's own closing paragraph forbids exactly this, and the backend already does it correctly.
- **Do not apply the Chinese tenor overlay globally.** It appears in the *General Condition* of every **CAE** page and on no SCB sheet. Cross-bank hardcoding is Principle II / A1.
- **Do not build a second program-fit screen.** The matching simulator already answers most of it (A4).
- **Do not force ADIB / HDB / CAE payslip programmes behind a surrogate product.** `PROGRAM_NAME_INCOME_PROOF_MISMATCH` refuses it, correctly.
- **Do not merge deposit-secured into `pledged_collateral_share`.** Same collateral, opposite arithmetic — one is `income`, one is `ceiling`.
- **Do not seed a 100% DBR cap**, and do not add a `dbrApplies: false` flag, to push a deposit-secured product through the pipeline. `baselineDbrPercent` on the template already does it losslessly (S4).
