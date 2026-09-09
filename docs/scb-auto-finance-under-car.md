# Suez Canal Bank auto finance under `car` — down payment and savings as income

_Design record, and what was built. Approved and implemented 2026-09-08. Extends [surrogate-income-templates-implementation-spec.md](surrogate-income-templates-implementation-spec.md) (§2 rule 1, §10.2) and [one-way-per-bank-program.md](one-way-per-bank-program.md)._

_Every load-bearing claim below was verified in the code at `e41e692`; line numbers are from that commit._

## Context

Operator supplied a master reference (Appendix A below) covering auto finance at three banks. Two parts of it are
surrogate-income mechanisms the platform does not have today:

- **Suez Canal Bank unsecured DP programs** — the DOWN PAYMENT is the income proof: `income = DP ÷ 36 ÷ 10% = DP ÷ 3.6`,
  then the ordinary reverse-DBR, then the finance amount is capped by the program's LTV (60/50/40/30/20% DP → 40/50/60/70/80%
  finance), then clamped to min/max (100K–5M; 1M–5M on the 20% program; 9M for Privé).
- **Suez Canal Green Finance** — income from DEMONSTRATED SAVINGS: instalment buyers `savings ÷ 36 ÷ 10%`, cash buyers
  `savings ÷ 60 ÷ 20%`; two products (Green Power Loan 6–120 mo, Micro Mobility 6–84 mo), 100K–1M.

HDB and ADIB are payslip products with DP × tenor × insurance rate grids; the reference itself says they must not ship
until §8 conflicts are resolved with the bank.

Goal of this plan: fit the SCB mechanisms into the existing surrogate-product system (blueprints → template → compiled
steps → bank `stepParams`), under the `car` loan category, with the LTV/DP constraint the reference's §1 describes.

## Operator decisions (asked 8 Sep 2026)

1. **Banks:** Suez Canal Bank only. HDB / ADIB stay out (their sheets conflict; the reference says do not ship) — recorded as open items.
2. **Green Finance:** included; BOTH Green Power Loan and Micro Mobility sold under the `car` category.
3. **Car price / down payment:** car applicants TYPE exact numbers (two NUMERIC questions replace the two range questions in the car flow; mortgage keeps its range question).
4. **SCB rate:** the slides state none → seed a placeholder rate marked `team_estimated`.
5. Privé (9M), Semi-Covered (CD-secured split), EV cars: not in scope — stated in "Not done".

## What exists today, and what is missing (verified against the code)

**Already there (reuse):**
- Reverse-DBR: `calculateMaxLoanFromDbr` / `maxPrincipalRaw` in [pmt.ts](backend/src/matching/pipeline/pmt.ts) + [dbr.ts](backend/src/matching/pipeline/dbr.ts); rate basis per program ([rate-basis.ts](backend/src/matching/pipeline/rate-basis.ts)); DBR cap 50% = `eligibility.dbrCapPercent`; self-employed age/salary overrides already on `EligibilityConfigDto`.
- The surrogate-product system: blueprint → template → compiled steps → per-bank `stepParams` ([product-blueprints.ts](backend/src/bank-programs/blueprints/product-blueprints.ts), [product-template.ts](backend/src/matching/pipeline/product-template.ts), [product-rule.ts](backend/src/matching/pipeline/product-rule.ts)); `auto_loan_crosssell` is the closest analogue; `secondColumn` + `pickByFact` gives a per-answer column (buyer type).
- Cap composition in [quote.ts:389-470](backend/src/matching/pipeline/quote.ts#L389-L470): flat max → `maxLoanByFact` → adjustments → collateral ceiling → clamp, with `bindingConstraint` precedence.
- `ApplicantProfile.carDetails {carValueEGP, downPaymentEGP}` ([types.ts:76-79](backend/src/matching/types.ts#L76-L79)) and `loanLimits.ltvCeilingPercent` / `minDownPaymentPercent` on the DTO ([loan-limits-config.dto.ts:205-210](backend/src/bank-programs/dto/sub-configs/loan-limits-config.dto.ts#L205-L210)).
- Seeds: `seed:blueprints`, `seed:sheet-figures` (`program()` factory in [sheet-programs.ts](backend/src/bank-programs/demo-figures/sheet-programs.ts), `CATALOG_FIGURES` / `PROGRAM_NAMES` in [sheet-figures.ts](backend/src/bank-programs/demo-figures/sheet-figures.ts)), `seed-banks.ts`, `seed-questionnaire.ts` (`upsertIScoreFact` pattern for platform-owned facts), document-key migration pattern (`20260905090100_doctor_documents`).

**Missing (this change):**
1. **No division op.** `STEP_OPS` has no `divide`; `DP ÷ 36 ÷ 10%` as two `percentOf` steps rounds per step and lands on 138,888.90, not the bank's 138,888.89.
2. **No exact car price / down payment.** Car flow asks two RANGE questions; the mobile mapper guesses midpoints — and its DP bucket keys (`less_than_20`, `20_40`) do not even match the seed codes, so `downPaymentEGP` posts 0 today. No `car_price` / `car_down_payment` fact exists.
3. **LTV is dead config.** `ltvCeilingPercent` / `minDownPaymentPercent` have no engine reader, no wizard control, and the wizard's full-replacement PUT ([bank-program-form.page.ts:6574-6672](admin/src/app/features/bank-programs/form/bank-program-form.page.ts#L6574-L6672)) wipes them. No `ltv_ceiling` binding, no required-down-payment output; `bindingConstraint` is not persisted and not shown on mobile.
4. **Preview never builds `carDetails`** ([matching-preview.service.ts:437-478](backend/src/matching-preview/matching-preview.service.ts#L437-L478)); apply does — preview/apply divergence. `computeDownPaymentPercent` ([cascade-adapter.ts:91-101](backend/src/matching/pipeline/cascade-adapter.ts#L91-L101)) is float math.
5. **No SCB bank row, no car-category catalog name, no SCB document keys** (`down_payment_receipt`, `price_quotation`, `bod_auditors_declaration`, `auto_loan_application`, `home_ownership_contract`, `performa_invoice`); `program()` hardcodes `productCategory: 'personal'`.
6. Not modelled anywhere: car insurance requirement, ban-on-sale, service waiver by I-Score, per-employment documents, post-approval documents, Privé segment, Semi-Covered split.

## Design

Merged from three independent design passes (minimal-engine / sheet-faithful / data-safety). The two adversarial critics could not run (session limit); the load-bearing claims below were verified directly in the code instead — each is cited.

### D1. Division: ONE new op `divide`, ONE new mechanism `dividedBy`, the bank types the sheet's own divisor

- **Engine** — [product-rule.ts](backend/src/matching/pipeline/product-rule.ts): add `'divide'` to `STEP_OPS` (:121-136) and an `OPS.divide` entry that mirrors `multiply` (:711-720) exactly: `configuredFactor` first, then `firstRef`, then `scalingFactor` (factor from `params.scalar.value` OR a second input ref, second wins, :822-842); a divisor that is `≤ 0` or non-finite → `{ ok: false, reason: 'rule_unconfigured' }` (fails closed, never Infinity/NaN); result `round2(input.div(divisor))`. Add `'divide'` to the scalar branch of `isStepConfigured` (:1164-1172). `scalar.unit` stays `'percent' | 'multiplier'` — `divide` stores `'multiplier'` (the unit is inert at runtime; ~12 sites pin that union and the editor labels by op). No new `ValueRef`, no new gate, no `StepParams` change.
- **Template** — [product-template.ts](backend/src/matching/pipeline/product-template.ts): `TEMPLATE_MECHANISMS` += `'dividedBy'` (:86-93); union member `{ kind: 'dividedBy'; fact: string }`; `collectNumericFacts` includes it (:751-761); `mechanismStep` gains `case 'dividedBy': return { id, op: 'divide', of: { step: sourceSlot(fact) } }` (:818-833). **Single step per mechanism** — `mechanismStep`, `emitMechanism`, `waysOfRule`, `optionalStepIds`, `neededStepIds`, `stripUnchosenWays` and their admin mirrors are all untouched, and every stored template compiles byte-identically (§5.4). Mapping-table comment (:41-60) gets the row "a number the customer states ÷ a figure the bank states → factNumber → divide".
- **Figures** — SCB DP programs: `stepParams.primary.scalar.value = '3.6'` (the reference itself prints "= Down Payment ÷ 3.6"). Green: `primary` = `3.6` (instalment), `primary__cash_buyer` = `12` (60 × 20%). Editor hint: "e.g. 3.6 = 36 months of saving × 10% of income".
- **Rounding proof** (ROUND_HALF_EVEN, one `round2` in the step, one at the answer, :525-527 / :1105): 500,000 ÷ 3.6 = 138,888.888… → **138,888.89** (the bank's own figure); I-Score `percentOf ×100÷100` leaves it; 36,000 ÷ 3.6 = **10,000.00**; 36,000 ÷ 12 = **3,000.00**. Every "months × rate%" pair is one terminating decimal, so no reciprocal approximation ever enters the blob.
- **Validation** — [income-rule.validator.ts](backend/src/bank-programs/validation/income-rule.validator.ts): add `case 'divide'` to the scalar-figure check (:869-887, `bad_scalar` on `≤ 0`, no figure required when a second ref is present); arity is the existing 1+ default (:775-781). No new `PRODUCT_RULE_INVALID` reason, no new error code — `check:codes` stays at 220.
- **Rejected**: (a) two ops `divide` + `grossUpPercent` with a two-step mechanism ("36 months" and "10%" as two boxes) — reads like the sheet, but the inner step is neither a pick ref nor a way slot, so `optionalStepIds` (:1325-1346) and `waysOfRule` ([product-rule-ways.ts:98-135](backend/src/matching/pipeline/product-rule-ways.ts#L98-L135)) would need chain-following on backend AND admin, and a bank filling only the instalment column would otherwise be refused `unconfigured_step` for the blank cash gross step (verified); dividing first also lands on 138,888.90. (b) `constant` steps for 36 and 10 — stored as `valueEGP`, labelled EGP. (c) `shareOf` with reciprocal `27.7777777777777778%` — exact only if typed to ≥ 8 decimals, unverifiable against the sheet, and Green needs two such literals.

### D2. LTV cap, `ltv_ceiling` binding, required down payment — frozen on the offer

- **Where** — [quote.ts](backend/src/matching/pipeline/quote.ts): after the collateral block closes (:462) and before the cash clamp (:464). New pure helper `ltvCeilingFor(loanLimits, carDetails): Decimal | null` in a new `pipeline/ltv-ceiling.ts`: `null` unless `ltvCeilingPercent` parses, `0 < pct ≤ 100`, `carDetails` present and `carValueEGP > 0`; else `round2(carValue × pct ÷ 100)`. `if (ltvCap !== null && ltvCap.lessThan(programMax)) { programMax = ltvCap; noteConstraint('ltv_ceiling'); }`. Lowering `programMax` is what makes the reference's `MIN(DBR max, LTV max)` and the min/max clamp fall out of existing code: request clamp (:467-470), `BELOW_PROGRAM_MIN_AMOUNT` (:482-494), `maxAffordableAmountEGP` (:615-617). **Absent-by-default**: no `carDetails` or no LTV → exact no-op; never a zero cap; never `PROGRAM_MISCONFIGURED`.
- **Types** — [types.ts](backend/src/matching/types.ts): snapshot `LoanLimitsConfig` gains `ltvCeilingPercent?: string; minDownPaymentPercent?: string` (:177-210; the DTO already has both, the engine type does not); `BINDING_CONSTRAINTS` += `'ltv_ceiling'` (:879-903), `BINDING_PRECEDENCE.ltv_ceiling = 5` beside `collateral_ceiling` (quote.ts:98-118); `Quote` += `ltvCeilingEGP?: Decimal`, `requiredDownPaymentEGP?: Decimal` = `max(0, carValueEGP − cashToCustomerEGP)` at assemble (:698-736), set only when `carDetails` is present (fees are financed on top, so the pre-fee cash leg is what pays the dealer); `Offer` += `bindingConstraint`, `requiredDownPaymentEGP: Decimal | null`; `MATCHING_ENGINE_VERSION` `'2.0.0' → '2.1.0'` (:1098; no test pins it).
- **Persist** — `bank_offer` gains `bindingConstraint String? @db.VarChar(32)` and `requiredDownPaymentEGP Decimal? @db.Decimal(13,2)` (nullable, frozen at creation, **no backfill**, `null` = recorded before the column — the `rateBasis`/`collateralCeilingEGP` posture). Carried by [engine.service.ts:222-266](backend/src/matching/engine.service.ts#L222-L266) `buildOffer`, [applications.service.ts](backend/src/applications/applications.service.ts) `toOfferInput` (:642-683) / `toOfferDto` (:692-733) / `PersistedOfferRow`, `CreateBankOfferInput` in [application.repository.ts:78-96](backend/src/applications/application.repository.ts#L78-L96), the apply/list offer DTOs, and `PreviewFigures` + `toPreviewFigures` in [matching-preview.service.ts](backend/src/matching-preview/matching-preview.service.ts) (:55-80, :484-506; `bindingConstraint` is already there).
- **`minDownPaymentPercent`** — engine reads `ltvCeilingPercent` only. The field stays on the DTO (deprecated in its comment); the wizard **carries the stored value through** instead of wiping it; the detail page ([bank-program-detail.page.ts:1464-1475](admin/src/app/features/bank-programs/detail/bank-program-detail.page.ts#L1464-L1475)) derives `100 − LTV` when its own value is absent. No pair-sum refusal (a new code for a field nothing reads). Seeds write LTV only.
- **Float fix** — `computeDownPaymentPercent` ([cascade-adapter.ts:91-101](backend/src/matching/pipeline/cascade-adapter.ts#L91-L101)) → Decimal `dp.div(price).mul(100).toDecimalPlaces(4)`, `.toNumber()` once at the numeric `ApplicantContext` boundary.

### D3. Exact car numbers: two NUMERIC questions, two platform facts, one shared derivation

- **Questions** — [seed-questionnaire.ts](backend/prisma/seed-questionnaire.ts) CAR config (:1075-1152): `car_price` (group `vehicle_financing`, replaces `vehicle_price` :1094-1102; "What is the car's price?" / "ما سعر السيارة؟"; `numeric { minValue:'10000', maxValue:'50000000', unitEn:'EGP', unitAr:'جنيه' }`, **no `step`** — `answer-validation.ts:214-216` refuses off-step values and a dealer price is exact; required) and `car_down_payment` (group `financing_info`, replaces `DOWN_PAYMENT_Q` at :1107 in CAR only; "How much will you pay up front?" / "كم ستدفع مقدمًا؟"; helper "In pounds — some banks read your down payment as proof of income." / "بالجنيه — بعض البنوك تعتبر الدفعة المقدمة دليلاً على الدخل."; `numeric { minValue:'0', maxValue:'50000000', … }`; required). Mortgage keeps `DOWN_PAYMENT_Q` (:1039) → `down_payment` becomes mortgage-only by the per-run assignment rewrite (:1551-1556); `vehicle_price` is deactivated by the sweep (:1568). Frozen snapshots untouched.
- **Facts** — new `upsertCarFacts()` beside `upsertIScoreFact` (:1596-1637), called at :1572: platform-owned (`surrogateProductKey` null) `surrogate_fact` rows `car_price` ("Car price" / "سعر السيارة") and `car_down_payment` ("Car down payment" / "الدفعة المقدمة للسيارة"), bound by question code, idempotent. Seed, not migration — the question ids exist only after the seed runs (the I-Score precedent). Add both keys to `RESERVED_FACT_KEYS` ([fact-question-eligibility.ts:41](backend/src/matching/pipeline/fact-question-eligibility.ts#L41)) so an operator cannot author or delete them.
- **One shared helper (A33)** — new pure `pipeline/car-details.ts`: `CAR_PRICE_FACT_KEY`, `CAR_DOWN_PAYMENT_FACT_KEY`, `carDetailsFrom(byKey, body?): CarDetails | undefined` — both numeric facts present → answers win; else body fallback; else `undefined` (never 0). Called from `applications.service.ts buildProfile` (:933-938, fallback `dto.carDetails`) and `matching-preview.service.ts buildProfile` (:437-478, no body). Preview and apply now apply LTV identically.
- **Mobile** — [car_apply_mapper.dart](masrafy-app/lib/features/questionnaire/presentation/pages/car/car_apply_mapper.dart): read the two numeric answers, drop `_vehiclePriceEgp` / `_downPaymentPct` (:81-95, the DP=0 defect goes with them), `carDetails: null` when either is unanswered. `requestedAmountEGP` stays the bound `amount_requested` (the ask is the customer's; the engine now reports the DP gap). `MONEY_FIELD_BINDINGS` is **not** extended (all-category bindings with publish-time validation; car figures belong to the fact registry). [seed-demo-applications.ts:495-513](backend/prisma/seed-demo-applications.ts#L495-L513) answers `vehicle_price`/`down_payment` for car → answer the two numeric codes instead (A25).

### D4. Products, names, programs, seeds, documents

- **Blueprints** — [product-blueprints.ts](backend/src/bank-programs/blueprints/product-blueprints.ts), appended, group `income`, `iScore: true`, no bank names, no figures:
  - `down_payment_income` — "Down Payment as Income" / "الدفعة المقدمة كدخل"; asks `[{ kind:'platformFact', factKey:'car_down_payment', alsoAskIn:[car] }]`; `primary: { kind:'dividedBy', fact:'car_down_payment' }`, `conditions: []`. Slots: `primary`, `src__car_down_payment` (+ 4 I-Score).
  - `savings_income` — "Savings as Income" / "المدخرات كدخل"; asks are **`bindQuestion`** over two questions authored in the CAR seed config (the seed's sweep deactivates every question not in its pool and the `skip` path of `seed:blueprints` never reactivates — [blueprint-seed.command.ts:136-141](backend/src/bank-programs/blueprints/blueprint-seed.command.ts#L136-L141); a blueprint-minted question would be switched off by the next `prisma:seed`): `total_savings` (NUMERIC, optional, "How much have you saved in total?" / "كم إجمالي مدخراتك؟", 0–100,000,000, EGP) and `green_buyer_type` (SINGLE_SELECT, optional, "Are you paying in instalments or cash?" / "هل تشتري بالتقسيط أم نقدًا؟", options `instalment_buyer` "Paying in instalments"/"بالتقسيط", `cash_buyer` "Paying cash"/"نقدًا" — explicit codes, because `pickByFact` branches are validated against the bound question's option codes). Template `primary: { kind:'dividedBy', fact:'total_savings' }`, `secondColumn: { fact:'green_buyer_type', branches:['instalment_buyer','cash_buyer'] }` (instalment first = bare slot; unanswered → first configured column). Slots: `primary`, `primary__cash_buyer`, `primary_pick`, `src__total_savings` (+ I-Score). `sharedBlueprintFactKeys()` unchanged.
- **Catalog names** — `PROGRAM_NAMES` in [sheet-figures.ts:449-515](backend/src/bank-programs/demo-figures/sheet-figures.ts#L449-L515), all `categories: [car]` (the command writes `incomeBases ['no_payslip']` per category): `auto_down_payment_income` "Auto Loan — Down Payment as Income" / "قرض سيارة — الدفعة المقدمة كدخل" → `down_payment_income`; `green_finance_savings` "Green Finance" / "التمويل الأخضر" → `savings_income`. **Amended at build time, and the doc is corrected here rather than left to disagree with the code:** this section specified TWO Green names, `green_power_loan` and `micro_mobility`, "so the applicant picks the product they are buying". One shipped. The two Green programmes differ only in maximum tenor (120 vs 84 months) and in what is being bought, which the programme's own `friendlyName` already says on the offer; a second catalog name would have split one calculation across two picks with nothing on either to tell an applicant which is theirs — the failure §10.7-as-superseded names. Splitting later is additive (a new name, one programme re-filed), so the cheaper direction was taken first. The "personal only" comment above `PROGRAM_NAMES` was corrected 2026-09-08.
- **Catalog figures** — two `CATALOG_FIGURES` entries following the `auto_loan_crosssell` precedent (:303-312, one sheet → figures on both catalog and program): `down_payment_income: { primary: divisor('3.6'), iscore_band: iscoreTiers() }`, `savings_income: { primary: divisor('3.6'), primary__cash_buyer: divisor('12'), iscore_band }`, `estimated: I_SCORE_ESTIMATED`; new `divisor = v => ({ scalar: { value: v, unit: 'multiplier' } })` beside `times`/`percent` (:302-303).
- **Bank** — [seed-banks.ts:38-56](backend/prisma/seed-banks.ts#L38-L56) += `{ nameEnglish: 'Suez Canal Bank', nameArabic: 'بنك قناة السويس', displayOrder: 14 }` (`seed:sheet-figures` refuses a missing bank and never creates one).
- **Programs** — [sheet-programs.ts](backend/src/bank-programs/demo-figures/sheet-programs.ts): `Input` gains `productCategory?: LoanCategory` (factory :183 → `?? 'personal'`) and `ltvCeilingPercent?: string` (→ `loanLimits`, :189-194); `const SCB = 'Suez Canal Bank'`. Seven entries, all `income_surrogate`, `productCategory 'car'`, `wayId 'primary'`, `amounts 'own'`, `dbrCapPercent '50'`, `rateBasis 'reducing'` (noted as unstated), placeholder `ratePercent '24'` + `adminFeePercent '1'` with `estimated: ['pricing.baseRatePercent','fees.adminFeePercent', ...ESTIMATED_FEES]` (markable numeric leaves, [value-sources.validator.ts:68-140](backend/src/bank-programs/validation/value-sources.validator.ts#L68-L140)):

  | code | name key | LTV | min–max | tenor | stepParams | notes carry |
  |---|---|---|---|---|---|---|
  | `SCB-CAR-DP60` | `auto_down_payment_income` | 40 | 100K–5M | 6–84 | `primary: divisor('3.6')` | no insurance, no ban on sale |
  | `SCB-CAR-DP50` | ″ | 50 | ″ | ″ | ″ | ban on sale; service waiver by I-Score |
  | `SCB-CAR-DP40` | ″ | 60 | ″ | ″ | ″ | ban on sale; service waiver by I-Score |
  | `SCB-CAR-DP30` | ″ | 70 | ″ | ″ | ″ | ban on sale |
  | `SCB-CAR-DP20` | ″ | 80 | 1M–5M | ″ | ″ | car insurance required; ban on sale; home owned by customer / 1st-degree relative |
  | `SCB-CAR-GREEN_POWER` | `green_power_loan` | — | 100K–1M | 6–120 | `primary: divisor('3.6'), primary__cash_buyer: divisor('12')` | unit owners in approved compounds |
  | `SCB-CAR-MICRO_MOBILITY` | `micro_mobility` | — | 100K–1M | 6–84 | ″ | ″ |

  Eligibility per sheet: DP programs `ageMin 21 / ageMax 60 / ageMinSelfEmployed 25 / ageMaxSelfEmployed 65`, `minMonthlyIncomeEGP '6000' / SelfEmployed '15000'`, `minMonthsInJob 6` (the 24-month self-employed floor has no field → notes); Green `ageMin 25`, `minMonthlyIncomeEGP '50000'`. Documents: DP programs `['national_id','price_quotation','down_payment_receipt']`; Green `['national_id','home_ownership_contract','proforma_invoice','price_quotation']`. Application form, BOD declaration, CR/tax card for self-employed, post-approval cheques/contract → notes.
- **Migrations** (house style: WHY · WHY-A-MIGRATION-NOT-THE-SEED · WHERE-IN-THE-LIST · NO-FIGURE-MOVES · IDEMPOTENT, `DO $$` end-state assertion):
  1. `<ts>_scb_auto_documents` — `INSERT … ON CONFLICT ("type","key") DO NOTHING` for `required_document` rows `price_quotation` ("Price quotation" / "عرض سعر السيارة"), `down_payment_receipt` ("Down payment receipt" / "إيصال الدفعة المقدمة"), `home_ownership_contract` ("Home ownership contract" / "عقد ملكية الوحدة"), `proforma_invoice` ("Proforma invoice" / "فاتورة مبدئية"), `sortOrder 12–15`; `RAISE EXCEPTION` unless all four exist. Mirror in [in-memory-platform-enumerations.repository.ts:316-341](backend/src/platform-enumerations/in-memory-platform-enumerations.repository.ts#L316-L341). Before any seed: `validateAgainstRegistry` is a hard 422.
  2. `<ts>_bank_offer_binding_required_dp` — `ALTER TABLE "bank_offer" ADD COLUMN "bindingConstraint" VARCHAR(32), ADD COLUMN "requiredDownPaymentEGP" DECIMAL(13,2);` no backfill, `RAISE NOTICE` with the (legitimately zero) count.

### D5. Admin
- **Wizard, money step** ([bank-program-form.page.ts](admin/src/app/features/bank-programs/form/bank-program-form.page.ts)): `ltvCeilingPercent` control in the `loanLimits` group (:3984-3999), rendered on `#card-amount` (:909) when `productCategorySignal()` is `car` or `mortgage`, percent input with derived caption "= {100 − LTV}% minimum down payment"; `payloadFromForm` (:6597-6611) sends `ltvCeilingPercent` and passes the loaded `minDownPaymentPercent` through unchanged (closes the wipe); hydrate on load (:6740-6746); review line beside the amounts (:4987). No new wizard step — [wizard-step-plan.spec.ts](admin/tests/wizard-step-plan.spec.ts) stays 5/4.
- **Mirrors** ([bank-programs.types.ts](admin/src/app/features/bank-programs/bank-programs.types.ts)): `STEP_OPS` += `'divide'` (:559-574); `STEP_OP_SHAPE.divide = 'scalar'` (:675-690); `TemplateMechanismKind` / `TemplateMechanism` += `dividedBy` (:999-1013).
- **Product template page** ([product-template.page.ts](admin/src/app/features/program-catalog/product-template.page.ts)): `MECHANISM_FACT_TYPE.dividedBy = 'NUMERIC'` (:67-76), `MECHANISM_ORDER` append (:86-93), `MECHANISM_LABELS` "A number the customer states, divided by a figure the bank states", `MECHANISM_EXAMPLES` "e.g. down payment ÷ 3.6 (36 months × 10%) → 138,888.89 a month" (:1976-2000).
- **Rule editor** ([product-rule-editor.component.ts](admin/src/app/shared/income-rule/product-rule-editor.component.ts)): `titleFor` "An earlier figure divided by a bank figure" (:2845-2870); `wayTitleFor` include `divide` → "{fact} ÷ a figure the bank states" (:2884-2905); `unitFor` `divide → '÷'` (:3120-3137); `setScalar` `divide → 'multiplier'` (:2789); `valueKinds` treat `divide` like `multiply` (:2196-2201); hint "e.g. 3.6 = 36 months × 10%". `figure-write.ts`, `income-rule.rules.ts`, `figure-slots.ts`, `catalog-defaults.ts` key off `STEP_OP_SHAPE` — verify only.
- `blueprint-copy.ts`: entries for both blueprints. `simulation-labels.ts` (:15-32): `ltv_ceiling` "Share of the car price this program finances" — and the two pre-existing fallthroughs `collateral_ceiling` / `program_max_by_fact`. Simulator drawer: `requiredDownPaymentEGP` row.
- Every new `@@id` gets an Arabic `<target>` in `admin/src/i18n/messages.ar-EG.xlf`; untranslated count measured against a HEAD worktree.

### D6. Mobile
- Mapper as D3. `OfferModel` ([apply_result_model.dart](masrafy-app/lib/features/matching/data/models/response/apply_result_model.dart)), `OfferEntity`, `MatchResultsArgs` ([match_results_args.dart](masrafy-app/lib/features/offers/presentation/models/match_results_args.dart)): `bindingConstraint: String?`, `requiredDownPaymentEGP`.
- [match_offer_card.dart:110-134](masrafy-app/lib/features/offers/presentation/pages/results/widgets/match_offer_card.dart#L110-L134): after the collateral caption, `offer_required_down_payment` "You pay EGP {amount} up front" / "تدفع {amount} جنيه مقدمًا" when non-null; one "limited by" caption keyed by binding: `offer_bound_ltv` "Capped at this program's share of the car price" / "محدود بنسبة تمويل البرنامج من سعر السيارة", `offer_bound_dbr` "Capped by what your income supports" / "محدود بما يسمح به دخلك", `offer_bound_program_max`, `offer_bound_program_row`, `offer_bound_collateral`; `requested_amount`/unknown → no line. ARB en + ar, regenerate `l10n/generated`.
- [figures_unavailable_reason.dart:41-50](masrafy-app/lib/features/matching/presentation/mappers/figures_unavailable_reason.dart#L41-L50): add `NO_MAX_LOAN_FOR_ANSWER` and `SURROGATE_PRODUCT_RETIRED` with ARB sentences (small pre-existing mirror gap; the new surrogate car programs can hit the second).

### D7. Tests to UPDATE (no new spec files — CLAUDE.md policy)
- `test/unit/product-blueprints.spec.ts` GOLDEN (:285-353) += `down_payment_income: ['primary','src__car_down_payment']`, `savings_income: ['primary','primary__cash_buyer','primary_pick','src__total_savings']`; forbidden-bank-name list += `'suez'`, `'scb'`; shared-fact set unchanged.
- `one-way-every-product.spec.ts` :31 `7 → 9` single-way; :69 `13 → 20` surrogate, payslip stays 4. `iscore-every-product.spec.ts` :23 `9 → 11`.
- `product-rule-ops.spec.ts` :131 extend the scaling-ops case to `divide` (500000 ÷ 3.6 → '138888.89'; second-input divisor; `0` → `rule_unconfigured`). `product-rule-validation.spec.ts` :281 include a `divide` `bad_scalar` case. `product-template-compile.spec.ts` add `dividedBy` to the shape-decides-ids cases; `product-template-validation.spec.ts` if it enumerates `TEMPLATE_MECHANISMS`.
- `engine-quote-parity.spec.ts` copied-field list += the two new offer fields. `sheet-figures-plan.spec.ts`, `blueprint-plan.spec.ts`, `blueprint-seed-plan.spec.ts` `it.each` pick the blueprints up — run and fix fixtures. Mobile `figures_unavailable_reason_test.dart` passes once the two ARB sentences exist.

### D8. Deploy / run order
`npx prisma migrate deploy` → `npm run build` → `npm run seed:banks` → `npm run seed:questionnaire` → `npm run seed:blueprints` → `npm run seed:sheet-figures -- --dry` → `npm run seed:sheet-figures`. Re-run steps 5–7: `0 created / 0 written / 0 refused`. Admin `ng build` both locales; `flutter gen-l10n && flutter analyze`.

### D9. Risks → closure
- Byte-stability: single-step mechanism, GOLDEN lists for the 9 existing products literally unchanged, `--dry` fingerprints + before/after simulator diff on real rows.
- LTV moving an existing program: `SELECT count(*) FROM bank_program WHERE "loanLimits" ? 'ltvCeilingPercent'` before deploy (expect 0); helper null-safe.
- Seed order: `platformFact car_down_payment` resolves only after `seed:questionnaire`; out of order → `seed:blueprints` reports `missingFacts` and writes nothing.
- Wizard wipe of LTV/minDP: closed in `payloadFromForm`; verified by re-open on the detail page.
- Two readings of `scalar.unit` for `divide`: `setScalar` writes `'multiplier'`, runtime ignores unit.
- Pre-existing hazard, observed not fixed: the seed sweep also deactivates blueprint-minted questions on other products (`auto_loan_amount`, compound facts) and `skip` never revives them — the new questions dodge it by living in the seed; recorded as follow-up.

## Verification (CLAUDE.md testing policy — real DB, seeds, browser, checks)

- **Before**: capture quotes of all 14 existing surrogate programs (same applicant set used in v26.2.0) → must be byte-identical after. Capture `npm run check:codes` (220), backend test count (~1527), admin (364), ar-EG untranslated ids (362 warnings / 339 ids).
- **Migrations**: `npx prisma migrate deploy` (document keys; any new column) — guards pass; re-apply is a no-op.
- **Seeds, in deploy order**: `npm run seed:banks` (Suez Canal Bank appears) → `npm run seed:questionnaire` (car price + DP numeric questions, facts bound, old bucket questions deactivated, version published) → `npm run build && npm run seed:blueprints` (2 new products created; re-run 0 written / 0 published) → `npm run seed:sheet-figures` (2 names created, 7 programs created, re-run 0 written / 0 refused / "identical").
- **Worked figures through the real stored rows** (`effectiveIncomeRule` → `evaluateProductRule` → `quoteProgram`): DP 500,000 → income **138,888.89**; savings 36,000 instalment → **10,000**; savings 36,000 cash → 36,000 ÷ 60 ÷ 20% = **3,000**; LTV: price 1,000,000, DP 400,000 on the 40%-DP program → cap **600,000**, required DP 400,000; on the 60%-DP program → cap **400,000**, required DP 600,000 (binding `ltv_ceiling`); short-tenor case (12 mo, 20% program) → DBR binds (`dbr_affordability`), required DP > 20%.
- **Checks**: `check:codes` (unchanged or +N with both dictionaries), `check:income-proof`, `check:parent-keys`, `tsc`, lint at parity, both locale builds with untranslated count at HEAD parity (all new ids carry ar targets).
- **Browser** (light / dark / real ar-EG bundle): product card + calculation screen for both new products; bank-program wizard on one SCB program (LTV control on the money step round-trips through a reload); overflow 0 at 1440/1024/720; no console errors beyond the 401 session probe.
- **Mobile**: `flutter analyze`; car flow renders the two numeric questions; offer card shows the required-down-payment line and the binding line.

## What was built (2026-09-08)

Everything in the Design section above, with three findings the build added.

**Engine.** One new op `divide` in [product-rule.ts](../backend/src/matching/pipeline/product-rule.ts)
(mirrors `multiply`; a divisor `≤ 0` or non-finite is `rule_unconfigured`, never Infinity) and one
new mechanism `dividedBy` in [product-template.ts](../backend/src/matching/pipeline/product-template.ts),
compiling to a single step so every stored template recompiles byte-identically. New pure
[ltv-ceiling.ts](../backend/src/matching/pipeline/ltv-ceiling.ts) and
[car-details.ts](../backend/src/matching/pipeline/car-details.ts). `quote.ts` caps `programMax`
after the collateral block; `ltv_ceiling` joins `BINDING_CONSTRAINTS` at precedence 5;
`ltvCeilingEGP` and `requiredDownPaymentEGP` join the quote, and `bindingConstraint` +
`requiredDownPaymentEGP` are frozen on `bank_offer`. `MATCHING_ENGINE_VERSION` 2.0.0 → 2.1.0.

**Verified against the real database, not read.** All **29** pre-existing programs were quoted
through the real read path (repository → snapshot mapper → `quoteProgram`) for four applicants
before and after; **0 figures moved**. `SELECT count(*) … loanLimits ? 'ltvCeilingPercent'` was
**0** before deploy, which is why the cap is a no-op for every program that predates it. The seven
SCB programmes quote: down payment 500,000 → **138,888.89** (the bank's own worked example);
Green instalment 36,000 → **10,000.00**, cash buyer → **3,000.00**; LTV caps **400,000 / 500,000 /
600,000 / 700,000** on the 60/50/40/30% tiers, each binding `ltv_ceiling` with the required down
payment reported (600,000 / 500,000 / 400,000 / 300,000); the 20% tier answers
`BELOW_PROGRAM_MIN_AMOUNT` against its own 1,000,000 floor, listed with a stated reason rather than
filtered. Both seeds re-run **0 written / 0 refused**. `check:codes` **220** (no new codes),
`check:income-proof` clean at **21** surrogate programmes across 11 names, `check:parent-keys`
clean. Backend **1550** tests, admin **364**, `flutter analyze` clean. Arabic build **362**
untranslated warnings = exact HEAD parity, with all 10 new ids carrying targets.

**Three things the build found.**

1. **The questionnaire seed switched off 16 blueprint-minted questions**, the hazard recorded at
   v24.0.0 and v25.0.0 — `seed:blueprints` `skip`s a product that already holds a calculation and
   never revives them. Repaired by reactivating exactly the questions a live `surrogate_product_ask`
   row points at, derived from that table and never hand-typed. The two new car questions and the
   Green pair dodge it by living in the seed's own pool, which is why they are authored there and
   bound by the blueprint rather than minted by it.
2. **An `/impec` pass on the new LTV field found four defects**, all fixed: no validator at all (an
   out-of-range share posted and was refused by the DTO at the END of a five-step wizard), a
   full-width box with proportional digits beside a sibling percent field constrained to 11rem with
   tabular figures, a live derived hint with no `aria-describedby` or live region, and the hint set
   in tertiary ink — 3.83:1 on this ground in light mode, under AA for a line that states the
   consequence of the number being typed.
3. **Backticks inside an HTML comment in the inline template** terminated the template literal and
   produced three errors pointing at the `@Component` decorator. Recorded because the error names
   the wrong place.

## Not done, stated

- ADIB and HDB programs (reference §2–§3 conflict; "do not ship"); vehicle origin / model-year age rules; inquiry-type rate tables; DP × tenor × insurance rate grids.
- Privé tiers (9M / 2M / 4M, HNW/UHNW), Semi-Covered (CD-secured split, non-monthly patterns), EV cars.
- Car insurance requirement, ban-on-sale, home-ownership condition, service waiver by I-Score, 24-month self-employed service floor, per-employment document lists, external business verification, address-match rule — all as program notes; no reader, no field.
- Post-approval documents (contract, cheque-date authorisation, semi-annual cheques) — notes.
- Mortgage LTV (engine reads `carDetails` only; mortgage keeps its range question by operator decision).
- `minDownPaymentPercent`, `eligibleCarPriceMinEGP`, `eligibleDownPaymentPercent` — carried, deprecated, unread.
- Real SCB rate, fees and rate basis — placeholders marked `team_estimated`; `reducing` assumed.
- `requestedAmountEGP` defaulting to `price − DP` in the car flow (UX policy; the offer now reports the DP gap).
- Adversarial critique pass did not run (session limit); replaced by direct verification of each load-bearing claim, cited above.
- The seed-sweep / `skip` deactivation hazard for blueprint-minted questions on other products.

## Amendment (2026-09-09) — ONE product, two ways

D4 above shipped the two mechanisms as two products, and the operator asked why a bank program could not simply pick which of the two it sells, the way a compound program picks one of five derivations. Answered, then asked again — so: merged.

**What kept them apart was one field's placement, not the arithmetic.** `ProductTemplate.secondColumn` lived on the PRODUCT and `emitMechanism` applied it to every way. Merged as-was, the Green split (instalment ÷ 3.6, cash ÷ 12) would have landed on the down-payment way too: five programmes asked for a cash-buyer divisor their sheet does not print, and a blank one still counts the way as filled (`filledWayIds`), so a cash-buying applicant would have been quoted NOTHING by those five, silently. Buyer type cannot be a third *way* either — `wayId` is the bank's frozen pick, buyer type is the applicant's answer.

**Engine: `TemplateMechanism.column`** ([product-template.ts](backend/src/matching/pipeline/product-template.ts)) — a way's OWN second column, same `{ fact, branches, branchOn? }` shape, same slot ids a product-level column would give that way (`<head>__<branch>`, `<head>_pick`). `emitMechanism` reads `mechanism.column ?? template.secondColumn`; a template stating both is refused (`column_on_way_and_product`), so this is a choice between one and none. Absent means "no column of its own" and a product-level `secondColumn` still reaches every way — every stored template recompiles byte-identically (§5.4). Admin mirror carries `column` through the friendly form (`wayGroup`'s hidden `column` control; a "Split into columns by …" line on the way row) so a save of the form cannot delete it.

**Product:** `down_payment_income` survives (five programmes already file under its `primary`; the key is what `surrogateProductKey`, `surrogate_product_ask.productId` and the registry address). `primary: dividedBy car_down_payment` · `alternatives: [dividedBy total_savings, column green_buyer_type]` · `waysAre: 'exclusive'` · `iScore`. Slots: `primary` · `alt` · `alt__cash_buyer` · `alt_pick` · `basis` · `src__car_down_payment` · `src__total_savings` (+ I-Score). Label "Car Buyers — Down Payment or Savings" / "مشترو السيارات — الدفعة المقدمة أو المدخرات". `savings_income` is deleted. Both catalog names stay (`auto_down_payment_income`, `green_finance_savings` → the one product) — the applicant still picks what they are buying; only the admin board goes 2 cards → 1.

**Migration `20260909090000_auto_product_one_two_ways`** — data half, in one `DO` block that exits early on a fresh database: guards on both rows' exact stored shape; the two Green programmes' figures RENAMED `primary → alt`, `primary__cash_buyer → alt__cash_buyer`, `wayId primary → alt` (through the NAME join, never by hardcoded code); asks moved (insert-only, then the retired row's deleted); the Green name re-linked; the merged product's `templateSpec` and `incomeRule` written as the compiler's own output (pasted, so there is no window in which the Green programmes name a way their product does not have — the doctors precedent accepted that window; this one did not have to), its `stepParams` = its own ∪ the savings product's renamed; label; savings row deleted after asserting nothing points at it; end state asserted.

**Verified against the real database:** all 21 surrogate programmes quoted through `effectiveIncomeRule → evaluateProductRule` for three applicants before and after — **63 rows, figures identical**, the only diff being the product column on the six Green rows (138,888.89 / 10,000.00 / 3,000.00 exactly as on 09-08); `SCB-CAR-DP60`'s row byte-identical; `seed:blueprints` 0 created · 10 unchanged · 0 refused · 0 published; `seed:sheet-figures` 0 written, both names `reuse → down_payment_income`, **all 7 SCB programmes "identical to what is stored"** — the proof the migration wrote exactly what the seed would have; `check:income-proof` and `check:parent-keys` clean. Backend 1541 tests (9 fewer: the retired product's per-blueprint cases), admin 364, ar-EG untranslated 362 = parity with the one new id translated.

**Not done, stated:** the friendly form can CARRY a per-way column but not author one — a product needing one is seeded from the library; no browser was driven, so the merged card, the "Split into columns by" line and the bank wizard's way picker on the merged product are unmeasured.

## Appendix A — source reference (verbatim from operator, 8 Sep 2026)

# Auto Finance & Surrogate Income — Master Reference

**Banks covered:** Housing & Development Bank (HDB) · Abu Dhabi Islamic Bank (ADIB) · Suez Canal Bank (SCB)

> **Status warning.** Two of the ADIB sheets contradict each other on both rates and vehicle-age rules. Nothing in Section 3 should be shipped until Section 8 (Conflicts) is resolved with the bank. HDB figures have no source sheet — unverified.

## 1. Core calculation logic

| Step | Formula |
|---|---|
| 1. Maximum DBR | `Max DBR = Monthly Income × 50%` |
| 2. Existing obligations | `Available Installment = Max DBR − Existing Monthly Obligations` |
| 3. Reverse calculation | Treat `Available Installment` as the maximum monthly payment; solve for principal using the program's rate and tenor |
| 4. Down payment | `Required Down Payment = Car Price − Final Finance Amount` |
| 5. Program constraint | Final amount must satisfy **both** DBR capacity **and** the program's LTV / DP, tenor, vehicle-age and documentation rules |

**Final answer = MIN(DBR-derived maximum, program/LTV maximum), then clamped to the program's min/max loan limits.**

Annuity: `PMT = PV × i / (1 − (1 + i)^−n)`; `PV = PMT × (1 − (1 + i)^−n) / i`.

> Open question: sheets quote a "ربح" (profit) percentage; flat vs reducing-balance not stated (~1.8× installment difference at 60 months).

### 1.2 Critical distinction
A program's stated **Down Payment is an eligibility / LTV constraint, not the final financing amount.** DBR capacity can push the final finance amount *below* the LTV ceiling, increasing the down payment the customer actually pays.

## 2. HDB (unverified — no source sheet)

| Customer Type | Program | Down Payment | Bank Financing | Insurance | DBR |
|---|---|---|---|---|---|
| Employee | E2 | 31% | 69% | Mandatory | 50% |
| Employee | E3 | 41% | 59% | Mandatory | 50% |
| Employee | E5 | 50% | 50% | None | 50% |
| Employee | E6 | 40% | 60% | None | 50% |
| Self-Employed | S2 | 30% | 70% | Mandatory | 50% |
| Self-Employed | S3 | 40% | 60% | Mandatory | 50% |
| Self-Employed | S4 | 50% | 50% | None | 50% |
| Self-Employed | S5 | 40% | 60% | None | 50% |
| Luxury Cars | Luxury | 25% | 75% | As per policy | 50% |

Missing: profit rates, tenors, min/max, vehicle-age, eligibility.

## 3. ADIB — used car programs (two contradictory cards)

### 3.1 Card A — flat rate per DP, no tenor dimension
A1 (home+work inquiry, mandatory insurance): 30% → 15.29% · 40% → 13.79% · 50% → 13.29%
A2 (home+work inquiry, no insurance): 40% → 14.46% (blue sheet only) · 50% → 13.95% · 60% → 13.16%
A3 (no work inquiry, mandatory insurance): 40% → 16.07% (good i-Score required) · 50% → 15.62%

### 3.2 Card B — DP × tenor band, insurance / no-insurance columns
B1 Home+work inquiry (waiver: at ≥50% DP work inquiry dropped if job on back of NID)

| DP | 1–2 yrs (ins / no ins) | 3–5 yrs | 6–7 yrs | 8–10 yrs |
|---|---|---|---|---|
| 30% | 15.09% / 15.76% | 14.29% / 14.96% | 15.29% / 16.03% | 16.31% / 17.11% |
| 40% | 14.18% / 14.86% | 12.81% / 13.46% | 13.67% / 14.38% | 14.54% / 15.32% |
| 50% | 13.69% / 14.35% | 12.32% / 12.97% | 13.13% / 13.84% | 13.97% / 14.74% |
| 60% | — / 13.55% | — / 12.19% | — / 12.98% | — / 13.81% |

B2 Luxury (no insurance): 40% → 14.52 / 13.14 / 14.02 / 14.93 · 50% → 14.02 / 12.64 / 13.48 / 14.35 (columns 1–2 / 3–5 / 6–7 / 9–10 yrs)
B3 Home inquiry only, mandatory insurance (qualification on NID): 30% → 15.77 / 14.36 / 15.37 · 40% → 16.48 / 15.06 / 16.14 · 50% → 16.03 / 14.61 / 15.65 · 60% → 14.46 / 13.08 / 13.96 (1–2 / 3–5 / 6–7 yrs). Non-monotonic (40% priced above 30%) — verify.

### 3.3 Vehicle-age rules — two versions
V1 (blue): German/Japanese/American from model 2015, 3 yrs, mfg year + tenor ≤ 14 · Korean/French/Czech/Spanish/Italian (excl. Chinese) from 2016, 3 yrs, ≤ 13 · Chinese (50% DP, home+work only) 2020 → 3 yrs, 2023 → 4 yrs, ≤ 7.
V2 (grey): G/J/A 2016 → 4 yrs, up to 2017 → 5 yrs · Others 2017 → 3, 2018 → 4, up to 2019 → 5 · Chinese 2022 → 3, 2023 → 4, up to 2024 → 5. Not reconcilable.

## 4. Suez Canal Bank — unsecured surrogate income auto loans

Five programs: 60% / 50% / 40% / 30% / 20% DP, plus Semi-Covered (secured against CD).

### 4.1 Eligibility
| Item | 60/50/40/30% DP | 20% DP | Semi-Covered |
|---|---|---|---|
| Segment | All customers, salaried and non-salaried | Same, home owned by customer or 1st-degree relative | — |
| Min age | Salaried 21 · Self-employed 25 | Same | Same |
| Max age | Salaried 60 (65 if contract extended) · Self-employed 65 at maturity | Same | Same |
| Min service | Salaried 6 mo · Self-employed 24 mo | Same | Not required |
| Service waiver | At 40% and 50% DP only: waived if I-Score shows regular repayment last 6 months | — | — |
| Min net salary | Salaried 6,000 · Self-employed 15,000 | Same | Not required |

### 4.2 Criteria
| Item | Standard DP programs | 20% DP | Semi-Covered |
|---|---|---|---|
| LTV | 60% DP → 40% · 50% → 50% · 40% → 60% · 30% → 70% | 80% | Secured + unsecured split |
| Loan amount | Min 100K · Max 5M | Min 1M · Max 5M | Up to 100% of CD; 90% secured, rest unsecured |
| Payment | Monthly | Monthly | Monthly/quarterly/semi/annual secured; monthly unsecured |
| Tenor | 6–84 months | Same | Same |
| Car insurance | 60/50/40% → N/A | Required | N/A |
| Ban on sale | 60% → N/A; 50/40/30% → Yes | Yes | N/A |

### 4.3 Surrogate income formula
```
Monthly Savings          = Down Payment ÷ 36
Surrogate Monthly Income = Monthly Savings ÷ 10%  = Down Payment ÷ 3.6
```
Bank's own example: DP 500,000 → 13,888.89 savings → **138,888.89 income** → Max DBR 69,444.44 − obligations → reverse-calc.

### 4.4 External business verification
Salaried: waived if profession + employer on back of NID; else social insurance matching NID profession. Self-employed: valid Commercial Register + Tax Card; external verification if documents disagree.

### 4.5 Documentation
Pre-approval (all): standard auto loan application · valid NID copy · BOD & external bank auditors declaration · price quotation · down payment receipt. Collateral lien form: Semi-Covered only.
Post-approval (all): auto loan contract · client authorization to fill cheque dates · semi-annual cheques.
Footnotes: CR + Tax ID for self-employed in all programs; home address must match NID + I-Score or NID + driving licence, else utility bill ≤ 3 months or external verification.

### 4.6 Privé tier (HNW = AUM 20–50M, income ≥ 6M; UHNW = AUM 50M+)
| Program | HNW min | HNW max | UHNW min | UHNW max |
|---|---|---|---|---|
| 60/50/40/30% DP | 100,000 | 9,000,000 | 100,000 | 9,000,000 |
| 20% DP | 1,000,000 | 9,000,000 | 1,000,000 | 9,000,000 |

## 5. Suez Canal Bank — Green Finance
Green Power Loan (green energy for residential unit owners in approved compounds) · Micro Mobility (golf cars, scooters, e-bikes for unit owners).

| Item | Green Power Loan | Micro Mobility |
|---|---|---|
| Segment | Unit owners in pre-approved compounds, delivered units | Same |
| Min age | 25 | 25 |
| Max age | 60 / 65 professions & self-employed | Same |
| Min net salary | 50,000 | 50,000 |
| Loan amount | 100K–1M | 100K–1M |
| Tenor | 6–120 months | 6–84 months |

### 5.2 Savings-based income
```
Instalment buyers:  Income = (Total savings ÷ 36) ÷ 10%
Cash buyers:        Income = (Total savings ÷ 60) ÷ 20%
```
Example: instalment buyer, 36,000 savings → 1,000/month → **10,000 income**.

### 5.3 Privé Green limits
| Program | HNW min | HNW max | UHNW min | UHNW max |
|---|---|---|---|---|
| Green Power Loan | 100,000 | 2,000,000 | 100,000 | 4,000,000 |
| EV — Electric Cars | 200,000 | 9,000,000 | 200,000 | 9,000,000 |
| EV — Micro Mobility | 100,000 | 2,000,000 | 100,000 | 4,000,000 |

### 5.4 Green documentation
Program-specific: home ownership contract copy. Common: NID · application · cheque-date authorization · loan agreement · semi-annual cheques · CR + Tax ID (self-employed) · performa invoice + dealer quotation.

## 6. Decision engine — required logic
1 bank → 2 customer type → 3 vehicle (fuel, origin, model year) → 4 eligible programs by DP / insurance / vehicle age / tenor / documents → 5 surrogate income per bank formula → 6 Max DBR 50% → 7 minus obligations → 8 reverse-calc → 9 LTV/DP cap + min/max → 10 `MIN(DBR max, LTV max)` → 11 required DP + reason.

### 6.1 Which constraint binds
SCB capacity = `DP ÷ 7.2` per month (13.9% of DP). Long tenors → LTV binds; short tenors (e.g. 12 mo on 20% DP) → DBR binds hard. UI should say which bound.

## 7. Prototype gap analysis (`Autoloan.html`)
Needs: rate lookup by (DP × tenor band × insurance) · insurance as user choice · vehicle origin · model year + `mfg + tenor ≤ N` · inquiry type · customer segment (employee / self-employed / luxury / HNW / UHNW) · per-segment min/max · rate basis flag.

## 8. Conflicts
1 two ADIB rate cards · 2 two ADIB vehicle-age sets · 3 rate basis unknown · 4 non-monotonic B3 · 5 HDB no sheet · 6 Green limits (corrected above) · 7 EV product only in Privé · 8 ADIB 40% no-ins row · 9 cashback tiering · 10 luxury tenor label.
