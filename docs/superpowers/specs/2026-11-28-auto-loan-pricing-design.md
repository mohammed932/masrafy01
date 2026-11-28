# Auto loan pricing — design

Date: 2026-11-28 · Status: draft for approval · Scope: car loans only

## Intent

A car loan in Egypt is priced the way the banks' own cards print it: **by how much the customer
puts down, then by what kind of car it is**. The admin must be able to enter a bank's car offer
in a few minutes, on one screen, with nothing hardcoded — every figure, band, category and
brand is data the admin can change. The customer answers a short, obvious set of questions.

The operator's words: "very simple UI and dynamic, nothing static", "do not add options that
are not needed", "think as a human from a data-entry / control perspective".

## The customer's flow

1. **New or used** — the program name they picked ("New Car" / "Used Car"); each is its own flow.
2. **Category** — American, European, Korean, Japanese, Chinese.
3. **Brand** — only the brands of that category.
4. **Fuel** (new cars only) — gas or electric.
5. **Car price** and **down payment** (an amount; the percentage is worked out).
6. **Model year** (used cars only).
7. **Term**.

No models, no countries: category → brand is the whole car identity.

## The admin's model (per bank program)

One card on a car program: **Pricing by down payment**.

**Rows = down-payment bands.** A band is one value or a range, e.g. "from 20%", "20–30%",
"50% and above". Each row holds the figures for that band:

| Figure | Example | Notes |
|---|---|---|
| Rate | 18% | required |
| Longest term | 5 years | |
| Insurance required | yes, 3% a year | the bank requires comprehensive cover at this band |
| Interest-free years | 2 | a loan whose term is within these years costs 0%; a longer term pays the row's rate |
| Oldest car (used only) | 3 years old | the car's age when the loan is taken (2026, "3 years" → model 2023 or newer) |

A figure left blank in a row is "not stated" (the program's default applies, or none).

**Exceptions** change figures for one kind of car. An exception picks **one** of: a category
(Chinese), a brand (BMW), or electric — and sets any figures, either for every band or for
chosen bands. Examples: "Chinese → longest term 5 years", "BMW → rate 9%", "Electric → longest
term 5 years".

**How they stack (per figure):** each figure is taken from the most specific exception that
states it — **brand, then electric, then category, then the row**. So for a BMW with "BMW → rate
9%" and "European → longest 7 years", the rate is 9% and the term 7 years. A Chinese electric
car with both a Chinese and an Electric term takes the Electric one. (Builder's call, recorded.)

That is the whole pricing surface. The amount range, DBR, fees and documents stay where they are
on the program and are untouched.

## What changes in what exists

- **Car list** becomes two levels: **Category → Brand**. The 5 categories are list values (the
  admin can rename, add or remove one); brands are filed under them. Countries and models leave
  the car flow: the country level (`car_country`) is replaced by `car_category`, and the model
  level and question (`car_model`, `what_model_is_the_car`) are removed. The seed maps the 150
  seeded brands to categories by where they come from (US → American; Germany, France, Italy,
  UK, Sweden, Spain, Czechia, Romania, Netherlands, Croatia → European; Korea → Korean; Japan →
  Japanese; China (and Speranza, Chery-based) → Chinese). Brands from other countries (India,
  Malaysia, Russia, Vietnam, Taiwan) are filed under the nearest category by the builder and
  listed in the seed for the admin to move.
- **Questions:** a new `car_category` question replaces `car_origin` in the car flow; the brand
  question's answers follow the category (the existing nested-answers serving); `car_fuel_type`
  stays but offers only **Gas** and **Electric**; `car_model_year` is asked on used cars only.
- **The plans-by-down-payment table** is the base of the new card: it already prices by deposit
  band with exceptions keyed on an answer. It is simplified to the figures above, gains
  "interest-free years", and its exceptions are limited to category / brand / electric.
- **Cases** (`bank_program.cases`) are removed from the car program form: the exceptions cover
  them. The engine support can stay for other uses or be removed — builder's call, nothing else
  uses it.
- **Old car questions** that no car program reads under the new flow (origin, dealer, engine
  size, use, total km, guarantor, assembly, km per year, car class, job on ID, insurance wanted,
  model) are retired from the car flow; seeded programs and demo data keyed on them
  (ADIB used car, Credit Agricole car tables, the Nested car demo) are re-keyed to category /
  brand or rebuilt in the new card.
- **Bank defaults on the product page** (Auto products) use the same card, so a new bank
  program starts from the product's pricing table.

## Engine

- Bands and exceptions resolve per figure: deposit band first, then the most specific exception
  that states the figure (brand > electric > category > the row).
- **Oldest car**: a used car older than the figure is refused (stated refusal, hidden from the
  customer by the match gate as today).
- **Insurance required**: disclosed with the offer as today (premium = price × rate per year).
- **Interest-free years**: when the term is within the free years, the loan is priced at 0%
  (instalment = financed amount ÷ months); otherwise the row's rate applies to the whole term.

## Approaches considered

- **A — one pricing table per program (chosen).** Rows by down payment with the figures, plus
  category / brand / electric exceptions. Builds on the existing deposit table; the whole deal on
  one screen.
- B — a base rate plus a list of rules (Cases). Less to build, but bands scatter across rules and
  the admin cannot see the deal at a glance.
- C — a separate pricing screen outside the program form. Most visual, but a second place to look
  and keep in sync.

The operator chose A.

## Goals / non-goals / anti-goals

- Goals: one card, one table, data-driven everything; new and used flows; category → brand;
  exceptions for category, brand, electric; used-car age limit; e2e tested; /impeccable review.
- Non-goals: models, countries, trims, colours; per-model pricing; other loan types.
- Anti-goals: any figure, band, category or brand fixed in code; a screen with options the admin
  does not need; more than one place to enter a car program's pricing.

## Decisions recorded

- **Interest-free years** — the operator: "it is dynamic" (the years are the admin's per band and
  per exception). Meaning settled by the builder as: within the free years the whole loan is 0%,
  longer terms pay the rate. A split-rate form ("first N years free, then the rate") is a later
  extension of the same figure, not built now.
- **New and used are separate bank programs** (separate catalog names, New Car / Used Car), so
  the card shows Fuel exceptions on New only and Oldest car on Used only.
- **Product Bank defaults are copied when a bank program is created** (as built in v36.3.0), not
  inherited live.
- **Oldest car is the age now**, from the operator's example; the end-of-loan car-age column
  (`maxCarAgeAtEndYearsByFact`) leaves the car card, and the one seeded program using it (ADIB)
  is converted to an age-now figure.
- **Re-keyed seed and demo programs may quote differently**: they are development data; the
  builder rebuilds them in the new card and reports the figures before and after.
- **Retired car questions are switched off, not deleted**, so stored answers on old applications
  keep their history; installed app builds that still send them are accepted (an answer to an
  inactive question is ignored, as today).

## Left to the builder

The exact screen layout (within the /impeccable review), the migration of existing car data and
seeds, the category of brands from countries outside the five, whether the Cases engine stays.
Verification follows the repo policy: real database before/after figures, seeds re-run with 0
written, check scripts, both locale builds, and e2e for the new flow in light / dark / RTL.
