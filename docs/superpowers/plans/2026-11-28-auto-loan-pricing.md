# Auto Loan Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Car loans are priced from one simple card per bank program — rows by down payment, a few figures per row, exceptions for a category, a brand or electric — over a car list that is just Category → Brand.

**Architecture:** The card is a thin editor over the engine's existing fact grids (`pricing.rateByFact`, `tenor.maxMonthsByFact`, `fees.carInsuranceRateByFact`, `tenor.maxVehicleAgeYearsByFact`) plus one new grid, `pricing.interestFreeYearsByFact`. Every grid the card writes uses the same four axes in this order — down payment, brand, fuel, brand-via-category — and exceptions are stored as one cell per band, so the engine's existing specificity order (earlier axes weigh more; `fact-grid.ts` `specificity`) already gives **brand > electric > category > the row** with no change to resolution. The car list moves from country → brand → model to category → brand.

**Tech Stack:** NestJS 10 + Prisma 5 (backend), Angular 18 + ng-zorro (admin), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-11-28-auto-loan-pricing-design.md`

## Global Constraints

- No NEW unit tests (CLAUDE.md "Testing policy"); proof is the real database, seeds re-run with 0 written, check scripts (`check:engine` gains cases), both locale builds, and e2e. An existing test made wrong by a change is UPDATED.
- Money and percentages are `Decimal` / decimal strings (Principle I). Banks are data (Principle II): no bank, brand or category named in code paths that price.
- Admin: standalone components, signals, `@if/@for … track`, typed reactive forms, `inject()`, ng-zorro only, tokens only, logical CSS only, every string `i18n`/`$localize` with an Arabic target in `messages.ar-EG.xlf`.
- UI is reviewed with `/impeccable` (read `craft-floor.md` before UI edits). "Very simple; no option that is not needed."
- Categories are list VALUES (`car_category`: american, european, korean, japanese, chinese) — renamable, addable, removable on the Car list page; nothing keys on the five by name.
- Bands: "one value or a range" — a band is a lower edge with an optional upper edge (`fromInclusive`, `toExclusive`), stored on the `car_down_payment_percent` axis.
- Figures per row: **Rate** (required), **Longest term** (entered in years, stored in months), **Insurance** (% a year), **Interest-free years**, **Oldest car** (years old). Rate is always shown; the other four are columns the admin adds with one click ("+ Longest term", …) and removes by clearing them.
- Exceptions: kind ∈ {category, brand, electric}; applies to all bands or chosen bands; sets any of the figures. Stacking per figure: brand > electric > category > row.
- Interest-free: when the loan's term (months) ≤ years × 12, the loan is priced at 0%.
- Oldest car: the car's age now (`car_age_years`, from `car_model_year`) greater than the figure → refused (`VEHICLE_NOT_ELIGIBLE`), as `maxVehicleAgeYearsByFact` does today.

## Review Focus

- A down payment exactly on a band edge (e.g. 20% with bands "10–20" and "from 20") falls in the upper band only — half-open bands; pinned in Task 1's `check:engine` cases.
- A brand exception for all bands plus a category exception for one band, both setting the rate — the brand wins on every band; pinned in Task 1.
- An electric exception on a Used program (fuel never asked) never matches and quotes the row; pinned in Task 1.
- A term one month over the interest-free years pays the full rate, not a blend; pinned in Task 1.
- An admin deletes a band that exceptions point at — the exceptions' cells for that band go with it, none are left orphaned; pinned in Task 4's rules (`carPricingToGrids`) and Task 7's e2e.

---

### Task 1: Engine — interest-free years and the stacking proof

**Files:**
- Modify: `backend/src/matching/types.ts` (PricingConfig gains `interestFreeYearsByFact?: FactGridConfig`)
- Modify: `backend/src/bank-programs/dto/sub-configs/pricing-config.dto.ts` (validated like `rateByFact`)
- Modify: `backend/src/matching/pipeline/quote.ts` (after the term is settled, before pricing)
- Modify: `backend/src/matching/pipeline/plan-inherit.ts` (`PlanDefaults` + `PLAN_SLOTS` gain `interestFreeYearsByFact` and `maxVehicleAgeYearsByFact`; `effectivePlanPricing` / `effectivePlanTenor` merge them)
- Modify: `backend/src/matching/pipeline/fact-readers.ts` (`factsReadByPricing` reads the new grid)
- Modify: `backend/src/bank-programs/dto/program-name-income-rule.dto.ts` + `bank-programs.service.ts` (plan-defaults DTO and validation slots gain the two grids: `['interestFreeYearsByFact','years']`, `['maxVehicleAgeYearsByFact','years']`)
- Modify: `backend/scripts/check-engine.ts` (new "Part G — car pricing card")

**Interfaces:**
- Produces: `PricingConfig.interestFreeYearsByFact?: FactGridConfig`; `PlanDefaults.interestFreeYearsByFact`, `PlanDefaults.maxVehicleAgeYearsByFact`; the axis convention `[{factKey:'car_down_payment_percent'},{factKey:'what_brand_is_the_car'},{factKey:'car_fuel_type'},{factKey:'what_brand_is_the_car',via:'parentClass'}]` (exported from `plan-inherit.ts` as `CAR_PRICING_AXES`).

- [ ] **Step 1: Add Part G to `check-engine.ts`** — a TESTING car program (`TESTING-CAR-PRICING`) whose grids use `CAR_PRICING_AXES`: bands 10–20 (rate 20, interest-free 0), 20–50 (rate 18, insurance 3), from 50 (rate 15, interest-free 2); exceptions: BMW all bands rate 9; European band 20–50 longest term 84; electric all bands longest term 60; Chinese all bands oldest car 3. Cases with exact expectations:
  - 15% down Toyota → rate 20
  - 20% down Toyota → rate 18 (edge → upper band)
  - 25% down BMW → rate 9, term ≤ 84 (brand rate, category term)
  - 25% down BYD electric → term ≤ 60 (electric beats Chinese)
  - 25% down BYD electric on a Used program (no fuel answer) → row figures
  - 60% down, 24 months → effective rate 0, instalment = financed ÷ 24
  - 60% down, 25 months → rate 15
  - Chinese car 4 years old → `VEHICLE_NOT_ELIGIBLE`; 3 years old → quotes
- [ ] **Step 2: Run** `npm run check:engine` — Expected: Part G interest-free and stacking cases FAIL (grid unknown), all other parts pass.
- [ ] **Step 3: Implement** the type, DTO, plan-defaults slots and readers; in `quote.ts` resolve `interestFreeYearsByFact` with the same facts as `rateByFact`; when matched and `effectiveTenorMonths <= value × 12`, price the loan at rate 0 (the instalment, totals and DBR all read the 0% rate; record `cascadeTrace.interestFree = true`).
- [ ] **Step 4: Run** `npx tsc --noEmit`, `npm run check:engine`, `npx vitest run` — Expected: tsc clean; check:engine all passed incl. Part G; vitest all pass (update any test the new slot list breaks).
- [ ] **Step 5: Commit** `feat(engine): interest-free years; car pricing axes`.

### Task 2: Car list becomes Category → Brand

**Files:**
- Create: `backend/prisma/migrations/2026112809xxxx_car_list_categories/migration.sql`
- Modify: `backend/prisma/data/car-list.data.ts` (exports `CAR_CATEGORIES` (5 rows) and `CAR_BRANDS` with `parentKey` = a category; models and countries removed)
- Modify: `backend/prisma/seed-questionnaire.ts` (`CAR_LIST_LEVELS` = category, brand; new `CAR_CATEGORY_Q` code `car_category` "What kind of car is it?" / "ما فئة السيارة؟", `optionsFromEnum: 'car_category'`; `CAR_MODEL_Q` removed; `car_fuel_type` offers `petrol_diesel` labelled "Gas" / "بنزين" and `electric` "Electric" / "كهربائية", `hybrid` switched off; fact `car_category` added)
- Modify: `admin/src/app/features/car-list/car-list.page.ts` (root level `car_category`)

**Interfaces:**
- Produces: list types `car_category` (root) and `car_brand` (`parentTypeKey: 'car_category'`); question `car_category` mirroring `car_category`; brand answers carry `parentCode` = a category key.

- [ ] **Step 1: Migration** — create type `car_category` with the five values; set `car_brand.parentTypeKey = 'car_category'`; re-file every brand by its old country (US → american; germany, france, italy, uk, sweden, spain, czechia, romania, netherlands, croatia → european; korea → korean; japan → japanese; china, egypt → chinese; india, malaysia, vietnam, taiwan, russia, other_origin → the nearest by the seed file); delete `car_model` values and type and switch off `what_model_is_the_car`; switch off `car_origin` and drop it from car names' ticks; delete `car_country` values and type; switch off the `hybrid` fuel option and relabel the other two; republish is done by the next questionnaire seed run.
- [ ] **Step 2: Capture before** — record every live car program's quote for a fixed answer set (the `check:engine` Part C/F output) to `scratchpad/car-before.txt`.
- [ ] **Step 3: Seed data + seed-questionnaire** as listed above; `seedCarList` creates category before brand.
- [ ] **Step 4: Run** `npx prisma migrate deploy`, `npm run seed:questionnaire` twice — Expected: second run adds 0 car-list values; `car_category` question has 5 answers; brand question 150 answers each with a category `parentCode`; `check:parent-keys` clean.
- [ ] **Step 5: Car list page** shows two columns (Category, Brand); `e2e/car-cases.spec.ts` car-list tests updated to Category → Brand (no Model column). Run that spec — Expected: pass in light and dark.
- [ ] **Step 6: Commit** `feat(car): car list is category → brand`.

### Task 3: The car questions each car name asks

**Files:**
- Modify: `backend/prisma/seed-questionnaire.ts` (ticks + order for car names)
- Create: `backend/prisma/migrations/2026112810xxxx_car_flow_questions/migration.sql`

**Interfaces:**
- Consumes: `car_category`, `what_brand_is_the_car`, `car_fuel_type`, `car_model_year`, `car_price`, `car_down_payment` questions.

- [ ] **Step 1:** On every catalog name offered under `car`, tick `car_category` and `what_brand_is_the_car` and order them first: category, brand, fuel, price, down payment, model year (`program_name_question_addition` / `_order`). Fuel is ticked only on `new_car`; model year only on `used_car` (the names are data rows; the seed reads them by key once, at first run, like the existing car ticks).
- [ ] **Step 2: Run** `npm run seed:questionnaire`; `GET /api/admin/questionnaire/served?programNameKey=new_car` and `…=used_car` — Expected: new_car serves category, brand (`optionsDependOn: car_category`), fuel; used_car serves category, brand, model year, no fuel.
- [ ] **Step 3: Run** `npm run check:questionnaire` and `check:question-scope` — Expected: no new findings.
- [ ] **Step 4: Commit** `feat(car): new and used car flows ask category → brand`.

### Task 4: The pricing card (admin component + rules)

**Files:**
- Create: `admin/src/app/shared/ui/car-pricing/car-pricing.rules.ts`
- Create: `admin/src/app/shared/ui/car-pricing/car-pricing-card.component.ts`

**Interfaces:**
- Produces:
  - `type CarFigure = 'rate' | 'maxYears' | 'insurance' | 'interestFreeYears' | 'oldestCar'`
  - `interface CarBand { from: string; to: string | null }`
  - `interface CarException { kind: 'category' | 'brand' | 'electric'; value: string | null; bands: 'all' | number[]; figures: Partial<Record<CarFigure, string>> }`
  - `interface CarPricing { bands: CarBand[]; rows: Array<Partial<Record<CarFigure, string>>>; exceptions: CarException[] }`
  - `carPricingFromGrids(grids: PlanDefaults | null): CarPricing | null` (null when the grids are not in the card's shape — the form then keeps them untouched and says so)
  - `carPricingToGrids(p: CarPricing): PlanDefaults` — writes `rateByFact`, `maxMonthsByFact` (years × 12), `carInsuranceRateByFact`, `interestFreeYearsByFact`, `maxVehicleAgeYearsByFact`, each with `CAR_PRICING_AXES`, `onNoMatch: 'reject'` for rate and `'useFallback'` for the rest; an exception on "all bands" is written once per band; a figure no row and no exception states produces no grid
  - `carPricingProblem(p): string | null` — overlapping bands, a band with no rate, an exception with no value or no figure
  - `<app-car-pricing-card [pricing] [categories] [brands] (pricingChange)>`

- [ ] **Step 1: Run `/impeccable`** (Operate mode) to shape the card: one table (Down payment | Rate | added columns), "+ Add a band", "+ Longest term / Insurance / Interest-free years / Oldest car" column chips, then an "Exceptions" list where each line reads as a sentence ("Brand BMW · all bands → Rate 9%") with a small inline editor (kind, value with search, bands, figures). No tabs, no axes, no "together with".
- [ ] **Step 2: Implement** the rules and the component to the interfaces above.
- [ ] **Step 3: Verify the round trip** in the browser on a scratch page or the form (Task 5): build bands + exceptions, save, reload — the card shows exactly what was entered; `carPricingToGrids(carPricingFromGrids(g))` deep-equals `g` for the seeded demo after Task 6.
- [ ] **Step 4: Commit** `feat(admin): car pricing card`.

### Task 5: Use the card on car programs and on Auto products

**Files:**
- Modify: `admin/src/app/features/bank-programs/form/bank-program-form.page.ts` (car programs: the Money step shows Loan amount, the car pricing card, Fees; the plans card, the plans editor, the base-rate box and the Cases card are not shown on car programs; the card's grids are posted in place of the plan grids)
- Modify: `admin/src/app/features/program-catalog/product-studio.page.ts` (Bank defaults step's plans table → the car pricing card)
- Modify: `admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts` (the Cases card → "Pricing by down payment": the bands as a small table and the exceptions as sentences)

**Interfaces:**
- Consumes: Task 4's component and rules; Task 1's plan-default slots.

- [ ] **Step 1:** Wire the card; a program whose grids `carPricingFromGrids` cannot read shows a one-line note and keeps them as they are.
- [ ] **Step 2:** `/impeccable` polish pass on the Money step, the Bank defaults step and the detail page (light, dark, RTL, phone).
- [ ] **Step 3: Run** `npx tsc --noEmit -p tsconfig.app.json`, the Arabic build (`ng build --configuration development-ar`, untranslated count ≤ HEAD), `e2e/product-defaults.spec.ts` — Expected: clean, ≤ HEAD, pass (spec updated to the new card).
- [ ] **Step 4: Commit** `feat(admin): car programs priced from one card`.

### Task 6: Seeds and demo data on the new model

**Files:**
- Modify: `backend/prisma/seed-bank-programs.ts` (`NESTED_CAR_DEMO` → "Car pricing demo": bands 10–20 / 20–50 / from 50, exceptions BMW rate, European term, Chinese oldest car, interest-free on the top band)
- Modify: `backend/src/bank-programs/demo-figures/sheet-programs.ts`, `adib-programs.ts` (car grids re-keyed from `car_origin` / car class / km to `CAR_PRICING_AXES`; ADIB's end-of-loan age → `maxVehicleAgeYearsByFact`)
- Modify: `backend/scripts/check-engine.ts` Part F expectations that read retired questions

- [ ] **Step 1:** Rebuild the seeds; run `npm run build`, `seed:programs`, `seed:sheet-figures`, `seed:blueprints` — Expected: first run writes the changes, second run 0 written / 0 refused.
- [ ] **Step 2: Capture after** and diff against `car-before.txt`; list every program whose figures moved in the CHANGELOG entry.
- [ ] **Step 3: Run** `npm run check:engine`, `check:codes`, `check:money`, `check:parent-keys` — Expected: all clean.
- [ ] **Step 4: Commit** `chore(seed): car programs on the pricing card`.

### Task 7: End to end, docs, verification

**Files:**
- Create: `admin/e2e/car-pricing.spec.ts`
- Modify: `admin/e2e/car-cases.spec.ts` (the Cases test is replaced by car-pricing; car-list tests kept, updated in Task 2)
- Modify: `docs/CHANGELOG.md`, `CLAUDE.md` (index line), `docs/fresh-install.md` (seed table)

- [ ] **Step 1: Write `car-pricing.spec.ts`** (TESTING data, deleted in `finally`): the admin opens a TESTING copy of a Used car program, builds bands 10–20 rate 20 / from 20 rate 16, adds "Brand BMW · all bands → Rate 9%", "Chinese · all bands → Oldest car 3", deletes the first band (its exception cells go too), saves; the simulator with Used Car: Toyota 25% → 16%; BMW 25% → 9%; BYD model year (now − 4) → hidden; then a New Car TESTING program with "Electric → Longest term 5 years" quotes an electric car at 60 months at most; the served Used Car questionnaire asks category → brand → model year, no fuel; overflow 0.
- [ ] **Step 2: Run** `car-pricing.spec.ts`, `car-cases.spec.ts`, `product-defaults.spec.ts`, `auto-loan.spec.ts` in light and dark — Expected: all pass.
- [ ] **Step 3: Full battery** — `npx vitest run`, `check:engine`, `check:codes`, `check:questionnaire`, `check:parent-keys`, `check:money`, tsc both sides, both locale builds — Expected: green; findings that pre-date this work listed as such.
- [ ] **Step 4: Docs** — CHANGELOG entry (what changed, figures before/after, verification), CLAUDE.md index line, fresh-install seed table.
- [ ] **Step 5: Commit** `test(e2e): car pricing card` and push when the operator asks.
