# Car finance plans — rate, term and financed share, defaulted on the product

## Context

`/program-catalog/products/down_payment_income` is the surrogate product **"Car Buyers — Down Payment or Savings"**. Suez Canal Bank sells seven car programmes off it. The ask:

> add all tenor plans — if user pay 20% the interest rate will be 10%, if he pay 30% it will be 9% — and also for chinese cars and green cars. Add default values for tenors in the surrogate program page, and every bank program can change these values, but changes scoped only to the bank program, not global.

A **plan** is one row: *"20% down → 10% rate, 6–60 months, we finance 80%"*, with its own rate column for Chinese cars and for green (electric/hybrid) cars. Defaults live on the product page; every bank programme may take its own copy, scoped to that programme.

### Operator decisions (asked and answered 2026-09-13)

1. Rate depends on **down-payment share × car type** — two axes.
2. **"Green car" = a new fuel question** (petrol/diesel · hybrid · fully electric), not an extra option on the existing country-of-build question.
3. **All five down-payment programmes merge into one.**
4. **Each plan states its own loan length.**
5. **Product-page changes reach live programmes** that have not taken their own copy.

### Most of this is already built

| Thing | Where | State |
|---|---|---|
| N-axis table keyed by applicant answers → one figure | `backend/src/matching/pipeline/fact-grid.ts` | **Shipped.** ≤4 axes, ≤400 cells, half-open bands, `null` = explicit wildcard, most-specific-first, `onNoMatch` |
| Rate grid | `pricing.rateByFact` → `cascade.evaluator.ts:99-134`, **first** in `PRICING_CASCADE_ORDER` | Shipped |
| Longest-term grid | `tenor.maxMonthsByFact` → `quote.ts:320-345` (a clamp, not a cascade level) | Shipped |
| Down-payment share as an axis | `car_down_payment_percent` — engine-derived per quote, asks nothing of the questionnaire | Shipped |
| Country of build (incl. `china`), model year, insurance, new/used, home ownership | `car_origin`, `car_model_year`, `car_insurance`, `vehicle_condition`, `home_ownership` | Shipped |
| Grid editor + pure rules + 15-reason validator | `fact-grid-editor.component.ts`, `fact-grid.rules.ts`, `fact-grid.validator.ts` | Shipped |
| Financed-share cap | `loanLimits.ltvCeilingPercent` → `ltv-ceiling.ts` → binding `ltv_ceiling` | Shipped — **one number only** |
| Live product→programme inheritance | `tenorDefaults` + `tenor-inherit.ts` (commit `2096b39`) | Shipped — the shape to copy |

### Genuinely missing

1. No fuel-type question or fact.
2. No product-level defaults for any grid.
3. `ltvCeilingPercent` is a scalar, so one programme cannot state a share per step.
4. No per-plan minimum **amount** (the merge needs it) or minimum **months**.

---

## Design

### D1 — One product column, and inheritance carried by an explicit selector

```prisma
// platform_enumeration, surrogate_product rows only — beside tenorDefaults
planDefaults  Json?   // { rateByFact?, minMonthsByFact?, maxMonthsByFact?, ltvByFact?, minAmountByFact? }
```

One column, not five. Commit `2096b39` is the measured cost of adding one: schema comment, migration, a `Set…Dto`, a `PUT` route, a service method with its own audit payload, an abstract + Postgres + in-memory repository triple, two response DTO fields, an admin API method, a `*Dirty` flag, a sequential write and an `absorb()` seed — about twelve touch points. Five tables edited on one card in one sitting should pay that once, and a sixth grid later then costs no migration.

**Inheritance is an explicit stored selector, never absence.** New optional `plansSource?: 'product' | 'own'` on the programme; **absent reads as `'own'`**, copied verbatim from `inheritsCatalogAmounts` (`income-rule-inherit.ts:121-128`).

This overturns the obvious "blank inherits" design, and the reason is decisive. `tenor-inherit.ts:70-76` says `maxMonthsByFact` stays bank-only because *"a blank grid there is a stated 'this bank does not cap by that', not 'nobody has said yet'"* — and it is right. The `tenorDefaults` precedent does **not** transfer: absent `tenor.minMonths`/`maxMonths` was an **unreachable** state before that change (both were required), so it could be given a new meaning for free. Absent `maxMonthsByFact` is reachable **today** and already means something on live rows. Overloading it would mean that the day an operator types a product table, every programme under it silently starts reading a ceiling it never had.

`plansSource` is not a second authority about the grids — it does not describe them, it selects **whose** apply. Same category as `incomeAssumption.amounts`, which this repo already ships and already documents.

| state | meaning |
|---|---|
| `plansSource` absent / `'own'`, field absent | **unchanged** — "this bank does not price/cap/finance by the deposit" |
| `'own'`, field present, a cell blank | refused (`CELL_VALUE_INVALID`) — a plan with no rate prices nobody |
| `'own'`, all grids absent | the **explicit opt-out**: a bank that means "I do not cap by the deposit" while its product does can now say so |
| `'product'` | the four fields are omitted on save; the snapshot mapper fills them |

It also dissolves the sharpest hazard. `down_payment_income` serves **two** catalog names — `auto_down_payment_income` and `green_finance_savings` (Green Power, a solar install; Micro Mobility, an e-bike). Both were verified on the live database. Under blank-inherits, a car-price LTV table on the product would reach a solar loan. Under an explicit selector, a Green programme never opts in, so it never inherits, and the defaults can safely live on the product row where the operator asked for them.

New pure `backend/src/matching/pipeline/plan-inherit.ts`, mirroring `tenor-inherit.ts` symbol for symbol: `PlanDefaults`, `effectivePlans(program, plansSource, productDefault)` returning the **SAME object** when nothing is inherited, `asPlanDefaults(blob)` reading malformed as **absent** and never throwing, and `catalogPlansOf(resolution)` beside `catalogRuleOf` / `catalogTenorOf`. It rides both arms of `CatalogRuleResolution` and merges on one line in `toBankProgramSnapshot`, so all four callers stay untouched — plus the fifth direct reader, `bank-programs.mobile.service.ts:80-82`.

### D2 — Three new grids, three new value kinds, no new error codes

| Grid | Home | Reader | `onNoMatch` |
|---|---|---|---|
| `pricing.rateByFact` | exists | `cascade.evaluator.ts:99-134` | `reject` → `NO_RATE_FOR_ANSWER` |
| `tenor.maxMonthsByFact` | exists | `quote.ts:320-345` | `reject` → `VEHICLE_NOT_ELIGIBLE` |
| **`tenor.minMonthsByFact`** | new | step 1b, composed `Math.max(tenor.minMonths ?? 0, planMin)` into `resolveTenor` — the floor only ever **rises** | `reject` → `VEHICLE_NOT_ELIGIBLE` |
| **`loanLimits.ltvByFact`** | new | `ltv-ceiling.ts`, read at `quote.ts:653-658` — **grid first, scalar as fallback** | `reject` → `VEHICLE_NOT_ELIGIBLE` |
| **`loanLimits.minAmountByFact`** | new | `quote.ts:660` — raises the floor, never lowers it | `useFallback` → the programme's own `minAmountEGP` |

`FactGridValueKind` gains `'sharePercent'` (`0 < n ≤ 100`), `'amountEGP'` (`> 0`). **Not** reused `'ratePercent'` for the share: that kind allows up to `999.9999` and `ltvCeilingFor` silently answers `null` above 100, so a share typed as a rate would save cleanly, render correctly and **cap nothing**. Two places only — `valueValid` in `fact-grid.validator.ts:73-79` and its mirror in `fact-grid.rules.ts:81-87` — plus the editor's unit affix and three new entries in the `grids` tuple at `bank-programs.service.ts:659-686`.

`ltvCeilingFor` gets a **new sibling** `ltvByFactFor` rather than being rewritten, so its existing tests and the scalar path stay byte-identical.

**No new error code.** `VEHICLE_NOT_ELIGIBLE` already reads *"This bank does not finance a car of that model year, origin, or at that down payment"* / *"هذا البنك لا يموّل سيارة بسنة الصنع أو بلد المنشأ أو الدفعة المقدمة المذكورة"* — word for word the refusal a renter putting 20% down deserves. `BELOW_PROGRAM_MIN_AMOUNT` covers the raised floor. `check:codes` stays at **225** (measured). No new `BINDING_CONSTRAINTS` member: the share cap already reports `ltv_ceiling`, already labelled at `simulation-labels.ts:28`.

**`factsReadBy*` must learn the new grids** — `factsReadByLoanLimits` walks `ltvByFact` and `minAmountByFact`, `factsReadByTenor` walks `minMonthsByFact` (`fact-readers.ts:159-183`). Not optional: an axis no reader reports is invisible to `narrowingScopeFor`, `check:question-scope`, the fact-delete guard and the ask-untick guard **at once** — the exact hazard that file's header claims to close.

### D3 — The green-car question

New `car_fuel_type` in `seed-questionnaire.ts` beside `CAR_ORIGIN_Q`, group `vehicle_financing`, **SINGLE_SELECT, optional**. Optional because the `car` category also sells the two Green Finance programmes — a required fuel question would refuse a solar applicant for a question about an engine. Option codes **stated, not slugged** (they key bank grids; a reworded label must not move a column):

| code | en | ar |
|---|---|---|
| `petrol_diesel` | Petrol or diesel | بنزين أو ديزل |
| `hybrid` | Hybrid | هجينة |
| `electric` | Fully electric | كهربائية بالكامل |

Then a `surrogate_fact` row in `upsertCarFacts` (sort 126, fact key **= question code**), `CAR_FUEL_TYPE_FACT_KEY` in `VEHICLE_FACT_KEYS` (`car-details.ts:104-109`) — which puts it in `RESERVED_FACT_KEYS` for free, so `check:question-scope` keeps it asked and no operator can repoint or delete it. Mobile needs nothing.

**Optional is safe here because of the wildcard row.** The rate grid states, per band, a wildcard cell `[dpBand, null]` plus `[dpBand, 'hybrid']` and `[dpBand, 'electric']`. `specificity()` (`fact-grid.ts:188-194`) ranks stated axes highest, so the named cells always beat the wildcard regardless of declaration order, and an applicant who skipped the fuel question still matches the wildcard and still gets a price instead of falling to `onNoMatch`.

**Chinese cars need no new question** — `car_origin` already carries `china`.

**One cell per origin code — `via: 'parentClass'` does NOT work here, verified.** `enumerationParentKeys()` (`postgres-platform-enumerations.repository.ts:930-943`) builds its map from `platform_enumeration` rows only, and `car_origin`'s eleven options are inline `question_option` rows. Queried: `china`/`japan`/`korea` exist as enumeration rows **not at all**; the only two lists carrying parent keys are `governorate` (27) and `compound` (71). A `parentClass` axis would resolve `undefined` for every applicant and the grid would fall silently to `onNoMatch`. Same for fuel: **do not model "green" as a parent class.**

### D4 — Merging the five programmes

The four standard tiers are identical apart from `ltvCeilingPercent` (40/50/60/70) and their notes — confirmed field by field against the stored rows, including `eligibility`, `pricing`, `fees`, `tenor`, `performanceCriteria`, `valueSources` and the income arithmetic. `SCB-CAR-DP20` differs in three ways, and a naive merge breaks two of them:

| DP20 has | Naive merge does | Fix |
|---|---|---|
| `minAmountEGP: '1000000'` (others `100000`) | Quotes a 500,000 loan the bank will not write | **`minAmountByFact`** — one cell, band `[20,30)` → `1000000` |
| `cond__homeowned: {applies: true}` — a programme-wide gate | **Refuses a renter putting 60% down**, whom the bank accepts | Gate **deleted**; the rule becomes a second axis on `ltvByFact` — the `[20,30)` band has rows only for `owned_by_me` / `owned_by_relative`, so `reject` binds **in that band alone**. `home_ownership` is a bound fact, required in `car`, with options `owned_by_me` / `owned_by_relative` / `rented_or_other` — all verified |
| `car_insurance_policy` in `requiredDocuments` | Demands insurance of every applicant | **Not fixable** — see Stated losses |

**Survivor: a fresh code `SCB-CAR-DOWN_PAYMENT`; all five are deleted.** Renaming `SCB-CAR-DP60` is wrong three ways: `programCode` is **immutable through the API** (`bank-programs.service.ts:1439`, FR-019), so a bad name could never be corrected again; the code would say `DP60` on a programme financing up to 80%, and `bank_offer.programCode` freezes that lie onto every future offer; and it inherits `version 3` and a `createdAt` belonging to a different product while still orphaning the other four tiers' audit rows. The v25.0.0 rule — *"fresh keys, never a rename … because a key is what [live readers] address"* — reuses a key only when a **live** reader would be stranded, and **nothing live addresses a `programCode`**: every reader of one (`bank_offer.programCode`, `application.noMatchSummary.details[].programCode`, `audit_event.payload`) is a frozen historical record, which keeps meaning exactly what it meant *because* the five codes retire. `auto_down_payment_income` and `down_payment_income` survive untouched — those **are** addressed, live.

**Three things the collapse must do or it is unsafe:**

1. **Keep a fallback `ltvCeilingPercent` scalar on the merged row.** This was nearly a catastrophe. `ltvCeilingFor` returns `null` when the scalar is absent, and `null` means **no clamp at all** (`quote.ts:655-659`) — so between `migrate deploy` and the new build going live, the **old** build, which cannot read a grid, would quote the entire car price with no down payment required and freeze it onto immutable offers (Principle I / A6). Not a wrong number — an unbounded one. The merged row carries **both** the grid and a conservative `'40'` (the lowest share, so the fallback under-quotes), the new reader takes the grid **first**, and the migration's end-state assertion checks the scalar is still there.
2. **Insert it `active = false`; flip it live after the build.** With the scalar in place the window quotes a number, and one scalar share is wrong for four of the five tiers. Inactive, `engine.service.ts:81` skips it and the applicant gets `APPLICATION_NO_MATCH` — **nothing wrong is quoted.** The doctors direction (v25.0.0) applied here. It costs a real outage on one product for the length of one build. *(Check `assertActivatable` first: the SCB rows carry seven `team_estimated` markers and are live with them, so the FR-033 gate is narrower than its comment implies — confirm before relying on the flip.)*
3. **Emit five `BANK_PROGRAM_DELETED` audit events before the delete.** `audit_event.bankProgramId` is `ON DELETE SET NULL` and is the **only** FK into `bank_program`, so the payload is the only surviving record. The event type already exists and its own writer deliberately sets `bankProgramId: null` because the row is about to go. Without this, deletion is the one programme lifecycle event with no audit record, on a table whose Principle VI contract is append-only.

### D5 — Admin

**One editor, not three.** The rate, term and share tables all key on the same down-payment bands. Three independent grid editors let an operator add a 25% plan to the rate table and not to the LTV table — a plan that prices but does not cap, with nothing on screen saying so.

So: a new `admin/src/app/shared/ui/plan-rows-editor.component.ts` whose **rows are a `computed()` over the grids, and the grids are the state**. Every keystroke writes through `planGridsFrom()` back into the four `FactGridConfig`s. There is nothing stored to round-trip and nothing to drift, which is what lets this hold **by construction** rather than by a spec the testing policy forbids. New pure `plan-rows.rules.ts`: `planRowsFrom(grids, productGrids)` (returns `null` unless every present grid leads with the `car_down_payment_percent` axis — so ADIB's three-axis card opens on the free-form editor exactly as today), `planGridsFrom(table)` as the **only** writer, `planRowsErrorFor` (blocking, = `factGridErrorFor` over each projected grid and nothing more), and `planRowsAdviceFor` (advisory: band gaps, overlaps, deposit% + financed% ≠ 100). Blocking-vs-advisory is load-bearing — anything beyond the server's own checks would out-refuse it, the `productRuleHasError` defect this repo has already shipped once.

The car-type axis breaks the naive one-table design (it applies to the rate only), so it is a per-table switch — **"Price electric and hybrid cars differently"**, off by default. On, it emits three rate columns; off, one. Switching on copies the single rate into all three (the `stateOwnTenor` copy precedent); switching off keeps the base column.

**Product page** (`surrogate-product-detail.page.ts`), step ②, inserted at `:1143` — between the duration card and the max-loan grid. Order argument in the house voice: the cap, the duration and the plans are all read live; the grid below is a copy taken once. Plans last of the three because they are the most specific. Copy the `tenorDefaults` mechanics exactly, every one of which was a measured bug: plain signals seeded in `absorb()` (**never** `toSignal(control.valueChanges)`), own `plansDirty` flag **read before the first write** in `save()`, a **fourth** sequential write with the `undefined | null | value` contract, reader count off `names[].programs[]` (a new `followsPlans` beside `ownTenor`), and a clear-blocked warning said **before** the server has to — clearing while programmes read it is refused (`SURROGATE_PRODUCT_PLANS_IN_USE`, the `SURROGATE_PRODUCT_TENOR_IN_USE` precedent, +1 code in both dictionaries).

**Bank wizard**, new `#card-plans` on the money step between the tenor card and `#card-pricing`. Three states transposed from the duration row (`:1131-1231`):
- **A — inheriting**: the product's plans read-only **as text**, a chip, and one button "Set this bank's own plans" with `aria-describedby` on the statement. **No inputs at all** — never disabled ones: `.disable()` drops a control out of group validity.
- **B — own**: the editor plus "Back to the product's plans", which **clears** and sets `plansSource: 'product'`.
- **C — no product default**: the card does not render. Today's world, byte-identical.
- Plus a third verb in state A — **"This bank states no plans"** — which is the explicit opt-out D1 requires.

`toggles.rateGrid` is **deleted**; the free-form grid editor moves into the plans card as a disclosure shown when `planRowsFrom()` returns `null`. One field, two editors, **one home on screen**. `toggles.vehicleGrid` survives, narrowed, and its label drops "or the deposit". `signalIssues('money')` swaps its `rateGrid` clause for `plans`; there is **no** `plansUnanswered` — plans are optional today and stay optional.

**Three carry-list fixes, one of them a latent live bug.** `TENOR_KEYS_EDITED_HERE` must gain `minMonthsByFact` or the first wizard save deletes a seeded one. And **`loanLimits` has no carry list at all** — `payloadFromForm:7110-7127` hand-enumerates seven keys, so `maxByCDTier`, `maxByPropertyType`, `maxByTransferType`, `maxByEmploymentType`, `maxTopUpEGP` and `otherCitiesMaxEGP` are deleted on every wizard save. Latent on this database (a `jsonb_object_keys` census shows no row carrying any of the six), real in principle, and `ltvByFact` + `minAmountByFact` must not become the seventh and eighth. Convert `loanLimits` to `carriedKeysOf`, carried keys spread **first**.

**Gates**: `promax` before the card (it is a new surface), `impec` after (Principle XXIII / A17). Tokens only (A18), logical properties only (A19), `@if`/`@for … track` (A12/A13), `inject()` (A14), signals (A11), typed forms (A16), no `any` (A15) — declare the new fields on the admin config types rather than copying the `as { rateByFact?: … }` cast at `:7297-7299`.

**Contrast, where AA is at risk.** `--text-tertiary` does **not** clear AA in light mode: 3.83:1 on a card, 3.64:1 on the page, 3.28:1 on muted. Three places on this card will be tempted into it and must not go: the inherited read-only cells (the most load-bearing text on the card — it is the number this programme quotes → `--text-primary`), the band hint and advice panel (runs somebody must read → `--text-secondary`), and the chip on muted. An inherited column is marked by chip **text**, never by a tint alone (1.4.1). Each cell input needs a **unique** accessible name with its plan number and column — the lesson already recorded in the fact-grid editor, where four axes over six rows announced twenty-four boxes all called "From, inclusive". Blocking error `role="alert"`; the advice panel `role="status"`. 44px touch targets under `@media (hover: none)`. The table scrolls in its own box; page overflow measured at 0.

**i18n**: every new `@@id` carries an `ar` target, and the target must use the `<x/>` placeholder element — a literal `{$INTERPOLATION}` is legal XLIFF that silently drops the value. Reworded sources (`bank_programs.toggle.vehicle_grid`, `spd.reach`, `spd.cap_rule`) mint new trans-units, so their `ar` targets must be re-supplied.

### D6 — Migrations

Two, not one — if the second aborts on a guard the first has already landed and is harmless; as one file a `RAISE` would roll back the column too and leave a half-deployed build.

1. **`<ts>_surrogate_product_plan_defaults`** — `ALTER TABLE "platform_enumeration" ADD COLUMN "planDefaults" JSONB;`. Additive, nullable, **no backfill**. Prose header in the house style: why additive; why nothing is backfilled (measured, **0 of 12** products carry it, and every share the sheets publish belongs to a **named bank**, so seeding one bank's table as a shared default would hand every other bank a policy it never published — Principle II / A1, the argument `capDefaults`' own header makes); why a column and not a key in `incomeRule` (that blob is `IncomeAssumptionConfig`, read by the income resolver) and not `capDefaults` (copied once — one column would mean two mechanisms); and the closing proof that no quote moves, since `plansSource` is absent everywhere and absent reads as `'own'`.
2. **`<ts>_scb_down_payment_one_programme`** — the destructive half, one `DO $$`:
   - `RAISE NOTICE` and return if no tier exists (fresh database, or already collapsed); `RAISE EXCEPTION` if the count is not 0 or 5.
   - **Implement the guard the service only pretends to have**: `RAISE EXCEPTION` if any `bank_offer.programCode` names one of the five. `bank-programs.repository.ts:390-394` is a stub returning `0` with a comment saying *"this method returns 0 until that model exists"* — `bank_offer` has **675 rows**. `BANK_PROGRAM_HAS_OFFERS` is a live wire code whose counter has never counted anything, so today an admin can delete a programme out from under 27 immutable offers. Do not inherit the stub's optimism. *(Worth fixing separately — it is one query.)*
   - Guard the exact stored shape: every tier on `wayId: 'primary'` with the `3.6` divisor; the five shares exactly `80/70/60/50/40`; **one** distinct value across `eligibility`/`pricing`/`fees`/`tenor`/`performanceCriteria`/`valueSources`/`maxAmountEGP` (a hand-edit on one tier is exactly what must not be silently discarded); and the three known distinctions exactly where expected.
   - Insert the survivor **inactive**, with the plan tables written **here** rather than left to the seed — the v27.1.0 precedent (*"pasted, so there is NO window in which … the doctors precedent accepted that window; this one did not have to"*).
   - Write the five `BANK_PROGRAM_DELETED` events, then delete.
   - Assert the end state: exactly one programme under `auto_down_payment_income`; the survivor linked, on `tenor = '{}'`, and **still carrying `ltvCeilingPercent`**.
   - Scope every `pg_catalog` query to `public` — a leftover `public_shadow011` Prisma shadow schema in this container returns a ghost `scoring_weight_set` FK that does not exist in `public`.

### D7 — Seeds (same commit, and not only for the proof)

**The seed is the resurrection vector.** `sheet-figures.command.ts` iterates `SHEET_PROGRAMS` and `planProgram` returns `{kind:'create'}` on `stored === null`. **There is no delete anywhere in that command.** Leave the four in the seed file and the very next `seed:sheet-figures` re-creates them — live, active, quoting, with new cuids and no audit lineage. The collapse would silently undo itself on the next deploy.

So `sheet-programs.ts:1172-1351` collapses to one entry; `Input` gains `ltvByFact?` / `minAmountByFact?` / `minMonthsByFact?` beside the existing `rateByFact?`; `SCB_DP20_DOCUMENTS`' eleven-line docblock is **rewritten, not silently deleted** — it records a real decision about §4.2's three readings of insurance.

`sheet-figures.ts`: `CATALOG_FIGURES` for `down_payment_income` gains `planDefaults` beside `tenorDefaults`, written by `sheet-figures.command.ts` with the same idempotent compare. The merged programme is seeded with `plansSource: 'product'` and states none of its own, so it reads the product's — the mechanism demonstrating itself.

**The proof** is `seed:sheet-figures` reporting **0 written / 0 refused** and `SCB-CAR-DOWN_PAYMENT` "identical to what is stored" — that is what catches a one-byte disagreement between the migration's INSERT and the seed's DTO. One hole to know about: `unchanged` is only reported for codes *in the seed file*, so it does **not** prove the four are gone. Pair it with `SELECT count(*) FROM bank_program WHERE "programCode" LIKE 'SCB-CAR-DP%'` — must be 0.

Seeded figures (the operator's illustration; no slide publishes a rate, so every cell is marked `team_estimated`):

| Down payment | Finances | Term | Rate: petrol/other | Chinese | Electric/hybrid | Floor |
|---|---|---|---|---|---|---|
| 20–30% | 80% *(home owned by self or relative only)* | 6–60 | 10% | 12% | 9% | 1,000,000 |
| 30–40% | 70% | 6–72 | 9% | 11% | 8% | 100,000 |
| 40–50% | 60% | 6–84 | 8% | 10% | 7% | 100,000 |
| 50–60% | 50% | 6–84 | 7% | 9% | 6% | 100,000 |
| 60%+ | 40% | 6–84 | 6% | 8% | 5% | 100,000 |

### D8 — Mobile

Nothing required. The fuel question rides the existing snapshot; `VEHICLE_NOT_ELIGIBLE` and `BELOW_PROGRAM_MIN_AMOUNT` are already mapped; `bindingConstraint` and `requiredDownPaymentEGP` already reach the offer card. Run `flutter analyze`.

### D9 — Tests to update (repo policy: no new spec files)

- `quote.spec.ts` — the new clamps, the band-scoped refusal (renter at 25% down rejected, same renter at 60% down priced), and a **regression case proving a programme with none of the new grids is byte-identical**.
- `catalog-income-rule-inheritance.spec.ts` — `asPlanDefaults` malformed-reads-as-absent, and the **identity assertion** (`expect(effectivePlans(own, …)).toBe(own)`).
- `fact-readers.spec.ts` — the new grids' axes are reported.
- `one-way-every-product.spec.ts:71-78` — `20 → 16` surrogate, and the comment naming "five down-payment tiers" is now wrong.
- **`scripts/check-sheet-conditions.ts:71-133`** — six cases name `SCB-CAR-DP20/30/40/60`. The DP20-vs-DP30 pair at `:109-120` is the **executable proof of per-tier gate scoping** and cannot be rewritten after a collapse; it is replaced by a band-scoped pair against the merged programme (renter at 25% refused, renter at 60% priced), which is the same property one level down.
- `sheet-figures-plan.spec.ts`, `blueprint-plan.spec.ts`, `blueprint-seed-plan.spec.ts`, `value-source-gate.spec.ts`, `engine-quote-parity.spec.ts` — run and fix fixtures.
- `admin/tests/` — the new value kinds; `wizard-step-plan.spec.ts` stays 5/4 (no new step).

### D10 — Run order and verification

**Fix the harness first — it is currently lying.** `scripts/quote-rates.ts:162-181` never selects `tenorDefaults` and builds its `LinkedProduct` without it. `2096b39` updated `quote-surrogate-programmes.ts` and missed this one; `scripts/` is outside the `tsc` include, so the missing required field never failed to compile. Measured just now: **all six inheriting Suez Canal programmes report `PROGRAM_MISCONFIGURED` with `cascadeMaxTenor: undefined`**, while they quote correctly in production. Two lines. Lands first, in its own commit.

**Before** (baselines already captured to the scratchpad for `quote:surrogate` and `quote:rates`; `check:codes` **225**, `check:income-proof` clean at 21 across 11, `check:parent-keys` clean at 98, `check:question-scope` 1 pre-existing PARKED):

```sql
\copy (SELECT row_to_json(p) FROM bank_program p WHERE p."programCode" LIKE 'SCB-CAR-DP%') TO 'before-scb-rows.json';
SELECT "id","programCode","version","createdAt" FROM bank_program WHERE "programCode" LIKE 'SCB-CAR-DP%';  -- the id↔code map: without it the 19 audit rows can never be re-linked
\copy (SELECT row_to_json(a) FROM audit_event a WHERE a."bankProgramId" IN (SELECT id FROM bank_program WHERE "programCode" LIKE 'SCB-CAR-DP%')) TO 'before-scb-audit.json';
SELECT count(*) FROM bank_offer WHERE "programCode" LIKE 'SCB-CAR-DP%';                  -- 0
SELECT count(*) FROM application WHERE "noMatchSummary"::text LIKE '%SCB-CAR-DP%';       -- 0
SELECT "programCode", md5(concat_ws('|', tenor::text, "loanLimits"::text, pricing::text,
       eligibility::text, "incomeAssumption"::text, fees::text, "valueSources"::text,
       array_to_string("requiredDocuments",','))) FROM bank_program ORDER BY 1;          -- the "moved no other figure" proof
```
The fingerprint uses the same eight fields `programFingerprint` compares, so a row whose hash is unchanged is a row the seed will also call identical.

**Run order** (migration before build, so the window must quote nothing rather than something wrong):
```
migrate deploy → build → seed:banks → seed:questionnaire → seed:blueprints
→ seed:sheet-figures --dry → seed:sheet-figures → seed:questionnaire
→ reactivate the questions live surrogate_product_ask rows point at
→ flip SCB-CAR-DOWN_PAYMENT active
```
The second `seed:questionnaire` and the reactivation step are the standing v24/v25/v29 hazard: `seed:questionnaire` deactivates every question outside its own pool and `seed:blueprints` does not revive them. Derive the set from `surrogate_product_ask`, never hand-typed.

**After**:
- `quote:rates` and `quote:surrogate` diffed against the captures: **every row outside the five is byte-identical**; the merged one reproduces DP60/50/40/30's figures band for band. The doc's own worked figures re-run: price 1,000,000 / DP 400,000 → cap 600,000; DP 600,000 → 400,000 with `ltv_ceiling` binding.
- The merged programme quoted across 20/25/30/35/40/50/60/70% down × petrol/chinese/electric × owner/renter, matching the D7 table cell for cell.
- The three refusals fired for real: renter at 25% → `VEHICLE_NOT_ELIGIBLE`; 20%-down applicant asking 500,000 → `BELOW_PROGRAM_MIN_AMOUNT`; an unpriced combination → `NO_RATE_FOR_ANSWER`. All **listed with a reason**, never filtered.
- Inheritance proved both ways: change the product's table → the merged programme follows; press "Set this bank's own" → it stops following.
- Seeds re-run 0 written / 0 refused; `SELECT count(*) … LIKE 'SCB-CAR-DP%'` = 0.
- `check:codes` 226 (the one new product-clear code), `check:income-proof`, `check:parent-keys`, `check:question-scope` (no `HIDDEN`/`UNBOUND` for `car_fuel_type`), `check:conditions`, `tsc` both sides, lint at HEAD parity per file, both locale builds with untranslated at HEAD parity.
- **Browser**: the Plans card and the wizard's three-state row in light, dark and the real `ar-EG` bundle at 1440/1024/720, overflow 0, console watched.

---

## Stated losses and risks

1. **Car insurance cannot be band-scoped.** `requiredDocuments` is one array per programme. The merged programme either demands `car_insurance_policy` of everyone or of no one. Recommendation: **keep it**, and say so in the notes — the existing docblock prefers the over-demand to the silent drop ("a document demanded of an applicant whose bank never asked for it is a refusal at the branch, and one quietly dropped is a loan that cannot complete"). This is the one cost of merging all five that cannot be engineered away. Side effect: it is the only programme on this database requiring that document, so dropping it would make the enumeration value deletable and `20260912090100_car_insurance_document` look like dead work.
2. **Ban-on-sale and the 12-month service waiver** live in `operatorNotes` and differ per tier (60% has no ban; 50/40 alone waive service on I-Score). Merged, the note must say "applies at 50/40/30/20 but not 60" in a field that describes one programme — a documentation loss, not a quoting loss, but the shape of a note nobody trusts.
3. **The five become one offer.** A customer who saw five Suez Canal cards — the "put more down, borrow more, here is what each costs" comparison the platform rendered for free — now sees one, priced at the plan their deposit lands in. This is what was asked for and it matches the mental model, but it is a visible product change, and restoring it later means a grouping affordance on the offers list, not an undelete.
4. **Deleting four rows is irreversible.** There is no down migration in this repo and no programme-version history table; `bank_offer.programVersion` has nothing to resolve against. The 19 `audit_event.bankProgramId` values are nulled inside the delete transaction and cannot be re-pointed even under the same code, because a re-created row mints a new cuid. The payloads survive as text; the relation does not. Capture the id↔code map first.
5. **Every seeded figure is an illustration.** No Suez Canal slide publishes a rate; all are `team_estimated`.
6. **`team_estimated` markers on grid cells are addressed by INDEX.** `walkMarkable` walks arrays by index, so `pricing.rateByFact.cells.0.value` is valid with no validator change — but a key table walks by row KEY *specifically* to survive reordering, and a grid cell has no key. Inserting a cell shifts what the FR-033 activation gate thinks is a guess. Pre-existing since `rateByFact` shipped; this is the first change to put figures there in bulk.
7. **The editor's term-coverage panel will look like an error.** `REACHABLE_TENOR_MONTHS` is 6…120 in six-month steps, so a plan capped at 60 reports 66…120 uncovered — true, and reads as a fault. One sentence on the panel.
8. **A name with plans but no income rule cannot be inherited from.** `effectiveProgramNameRule` returns `undefined` with neither a product nor an own rule, and the repository then drops the name from the map. `planDefaults` threads into the three existing `return`s and the final guard is **left alone** — such a name quotes nothing whatever its table says, so the gap has no reader. Written on the type rather than papered over.

## Two pre-existing defects found while planning, worth their own commits

- **`countOffersReferencing` returns a hardcoded `0`** (`bank-programs.repository.ts:390-394`) on a comment saying `bank_offer` does not exist yet. It has 675 rows. So `BANK_PROGRAM_HAS_OFFERS` — a live wire code, documented on the controller — has never once fired, and an admin can delete a programme out from under its immutable offers.
- **`loanLimits` is not carried through a wizard save**, so six optional fields are deleted on any edit. Latent on this database; a seed or API write of `maxByTransferType` would be lost by the next save.

---

## What was built (2026-09-13)

Everything in the Design section above, with five deliberate deviations and two findings.

**Engine.** Three new grids — `loanLimits.ltvCeilingByFact` (read first by a new `ltvByFactFor`
sibling in `ltv-ceiling.ts`, with `ltvCeilingPercent` kept as its fallback),
`loanLimits.minAmountByFact` and `tenor.minMonthsByFact`, the last two composed by `max` so they
only ever RAISE. Two new value kinds (`sharePercent`, `amountEGP`), two `valueValid` branches.
New pure `plan-inherit.ts` mirroring `tenor-inherit.ts`; the merge is three lines in
`toBankProgramSnapshot` and every caller was untouched. **No new op, no new error code**
(`check:codes` 225, unchanged) and no new binding constraint.

**Inheritance is an explicit selector.** `platform_enumeration.planDefaults` +
`bank_program.plansSource`, absent reading as `'own'`. Blank-inherits was rejected: a blank
`maxMonthsByFact` already means "this bank does not cap by that", and `down_payment_income` is
sold under a second catalog name that finances a solar install and an e-bike.

**The merge kept both harms out.** The 20% tier's 1,000,000 floor became a `minAmountByFact`
cell; its `cond__homeowned` gate was deleted and re-expressed as a second axis on the financed
share, so the refusal binds in the 20–30% band alone instead of refusing a renter putting 60%
down. The car-insurance document could not be band-scoped and is now demanded of everyone —
stated in the programme's notes and in **Stated losses** above.

**Verified against the real database, not read.** The additive half was a proven no-op twice.
After the merge, **311 rate rows and 48 surrogate rows byte-identical** — only the header counts
moved. `npm run quote:car-plans` lands **13/13** through the real read path, including the
band-scoped refusal in both directions and the origin-outranks-fuel ordering. Inheritance proved
both ways on live rows. Seeds re-run 0 written / 0 refused.

### Deviations from the plan

1. **The migration deletes; the seed creates.** The plan had the migration paste the survivor to
   avoid a window. The window here is "no programme behind the name", which quotes NOTHING — the
   acceptable direction — and it removes any chance of the migration and the seed disagreeing by
   a byte about seven fields of prose. The seed's "identical to what is stored" is then trivially
   true because the seed wrote it.
2. **Five grid editors on the product page, not one fused plan-rows control.** The fused design's
   safety value — that a plan added to one table and missing from another is invisible — is
   covered by a band-mismatch advisory (`role="status"`, never a gate). The fused editor remains
   the better UX and is not built.
3. **`minMonthsByFact` is implemented but not seeded.** Every tier on this card starts at 6
   months, which is already the product's `tenorDefaults.minMonths`; a table saying 6 five times
   would shadow that floor if it ever moved.
4. **`plansSource` is its own column on `bank_program`**, not a key inside a blob: the four tables
   live in three different JSON columns, so a key in any one of them would be a statement about
   the other two made in the wrong place.
5. **The wizard has no editor for the three new grids.** A bank can inherit them or state its own
   scalar `ltvCeilingPercent`; authoring its own financed-share, floor or term-floor table is a
   seed edit. Only the rate and vehicle grids have an editor today.

### Found while building

- **`scripts/quote-rates.ts` never selected `tenorDefaults`**, so it reported all six inheriting
  Suez Canal programmes as `PROGRAM_MISCONFIGURED` while they quoted correctly in production.
  `2096b39` updated its sibling and missed it; `scripts/` is outside the `tsc` include, so the
  missing required field never failed to compile. Fixed first, in its own right — the before/after
  evidence for this change rested on it.
- **`countOffersReferencing` returns a hardcoded `0`** on a comment saying `bank_offer` does not
  exist yet. It has 675 rows, so `BANK_PROGRAM_HAS_OFFERS` has never fired and a programme can be
  deleted out from under its immutable offers. The collapse migration implements the guard itself
  rather than trusting the stub; fixing it at the source is one query and a separate change.

**Not done, stated:** no browser was driven (no browser tool in this session), so the Plans card,
the wizard's three-state row and every contrast figure are unmeasured in light, dark and RTL.
