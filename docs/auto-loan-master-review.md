# Auto Loan — source review and feature split

**Sources:** `~/Downloads/final Auto loan/` (ADIB · Suez Canal · Crédit Agricole sheet photos,
`Auto_Finance_Master_HDB_ADIB_Suez_Canal_Reviewed.docx`) and the attached
`ffffffffffffffffffffffAutoloan.html` prototype.
**Reviewed against:** `backend/` + `admin/` at `predefined_surrogate_programs` (`a5205a7`), constitution v30.0.0.
**Status:** for review. Nothing here has been implemented.

---

## 0. What the folder actually contains

| Item | What it is | Banks | Already in the repo? |
|---|---|---|---|
| `ffffffffffffffffffffffAutoloan.html` | Self-contained credit-officer prototype: user calculator + admin policy editor. ~550 lines of JS, no backend. | SCB, CAE | **No** — it is a parallel engine (§4) |
| `Auto_Finance_Master_..._Reviewed.docx` | 12-section written master: calculation logic, HDB/ADIB/SCB tables, decision-engine rules | HDB, ADIB, SCB | Partly |
| `adib/` (3 photos) | Three ADIB rate grids + used-car age rules (Arabic) | ADIB | **No programmes seeded** |
| `scb/` (4 photos) | SCB "Updated Assets Product Awareness" deck: surrogate programs, Privé tiers, Green Finance | SCB | Mostly (v27–v30) |
| `credi/` (36 photos) | **Two** printed CAE guides: *Auto Loans Product Guide* (~p1–28) and *Electric Vehicles Product Guide* (p29–36) | CAE | **No auto programmes seeded** |

The `credi` folder is the largest source and appears in **neither** the DOCX nor the prototype's
program tables in full — it is the single biggest body of un-modelled policy here.

---

## 1. The one calculation everything agrees on

Both the DOCX (§1) and the prototype implement the same five steps, and the backend already
implements all five:

```
1. Income          → payslip, or surrogate (down payment ÷ 36 ÷ 10%)
2. Capacity        → income × DBR cap (50%)
3. Net capacity    → capacity − existing obligations
4. Reverse PMT     → max finance amount from net capacity, rate, tenor
5. Program clamp   → min(DBR-derived, LTV/max-loan/tenor/age caps)
```

`backend/src/matching/pipeline/` covers this end to end: `pmt.ts` (`maxPrincipalRaw`, both
reducing and flat), `dbr.ts`, `ltv-ceiling.ts`, `quote.ts`. The DOCX §12's closing rule —
*"Return the lower of (a) DBR-derived maximum finance and (b) program/LTV maximum finance"* —
is exactly what `quote.ts` does with `bindingConstraint`.

**The DOCX's own critical distinction is already honoured:** *"A program's stated Down Payment is
an eligibility/LTV constraint. It is not automatically the final financing amount."* The
prototype **violates this** (§4.1).

---

## 2. What the sources add that the repo does not have

Ranked by how much money each moves.

### 2.1 Max loan is tiered by car origin — CAE (**moves money, silently**)

Every CAE auto page states the same table:

| Origin | Max loan |
|---|---|
| Luxury | 10,000,000 |
| European / Japanese / Korean | 7,000,000 |
| Others (incl. Chinese) | 4,000,000 |

The prototype **flattens this to a single 7,000,000** and its admin note says so explicitly
(*"Max loan is no longer tied to this brand/origin selector"*). A customer buying a 4M-tier car
would be quoted up to 7M. The repo can express this today — `loanLimits.maxLoanByFact` keyed on
`car_origin` — so this is **seed data, not a mechanism**.

### 2.2 Used-car age eligibility is per origin, and has two forms (**refusal, not a cap**)

CAE (p22), "end to end":

| Origin | Max car age |
|---|---|
| Luxury | 12 years back |
| European / Japanese / Korean | 8 years back |
| Others | 8 years, Chinese via Mansour & Ghabbour; **5 years** other Chinese |

ADIB states the same idea as a **derived** rule: *manufacture year + financing tenor ≤ 14 years*
(German/Japanese/American) or **≤ 13** (Korean/French/Spanish/Italian/Czech), and **≤ 7** for
Chinese. CAE states it as *"maximum loan tenor is calculated from manufacturing date."*

This is an **age-at-maturity rule for the car**, structurally identical to the applicant's
`maxAge` at maturity that `quote.ts` already clamps on — but there is no car-side equivalent.
`tenor.maxMonthsByFact` keyed on `(car_origin, car_model_year)` covers the *tabulated* form
(v30.0.0 already ships the grid and the axes); the *derived* form (`year + tenor ≤ N`) does not
exist and cannot be tabulated without one row per model year per origin.

### 2.3 Tenor cap differs by employment segment — CAE 50% DP (**moves money**)

CAE "50% DP New car": *Employed: max **84** months. Self Employed: max **60** months.*
The repo has `tenor.maxMonthsByEmploymentType` already — again seed data, not mechanism.

### 2.4 The I-Score multiplier table is **published here and contradicts what is seeded**

The prototype ships a real table; the repo ships estimates.

| Prototype (`RV_MULT`) | Repo (`sheet-figures.ts`, all `team_estimated`) |
|---|---|
| N/A → **85%** | *(no such row — `coalesce` falls back to 100%)* |
| Below 521 → **60%** | `[0, 550)` → 80% |
| 521–625 → **90%** | `[550, 700)` → 100% |
| Above 625 → **100%** | `[700, ∞)` → 110% |

Three differences, each consequential:

1. **The edges move** (521/625 vs 550/700).
2. **Nothing is ever uplifted** — the prototype's best band is 100%, the repo's is 110%.
3. **"N/A" is a row a band table cannot hold.** A band keys on a *number*; "no score" is not a
   number. It is expressible today with no engine change — `iscore_band` already compiles to
   `coalesce [iscore_band, {const:'100'}]`, so the fallback constant becomes `'85'`.

`sheet-figures.ts:188` records *"no bank has published one (§10.10)"*. If these figures are the
bank's, that comment and the `team_estimated` markers on all three come off. **This needs a
source confirmation before it is treated as a quotation** — the prototype is an internal tool,
not a bank sheet, and it is the only place these four numbers appear.

### 2.5 SCB Privé — HNW / UHNW raise the ceiling (**not modelled at all**)

`scb/…(1).jpeg` and `…(3).jpeg`:

| Segment | Definition | Surrogate auto max | Green Power max | EV Cars max | Micro Mobility max |
|---|---|---|---|---|---|
| Standard | — | 5,000,000 | 1,000,000 | — | 1,000,000 |
| HNW | AUM 20–50M, annual income ≥ 6M, + "Exceptional Type" | 9,000,000 | 2,000,000 | 9,000,000 | 2,000,000 |
| UHNW | AUM 50M+ | 9,000,000 | 4,000,000 | 9,000,000 | 4,000,000 |

There is **no wealth-tier fact** in `car-details.ts` or the registry. `maxLoanByFact` could key on
one once a question exists. Note the DOCX §10 quotes the **Privé** figures as if they were the
standard ones — the standard sheet says max 1M for Green Power. **The DOCX is wrong here.**

### 2.6 A third SCB Green programme exists: **Electric Vehicles — Cars** (200K–9M)

Seeded today: `SCB-CAR-GREEN_POWER`, `SCB-CAR-MICRO_MOBILITY`. The Privé table names a third,
*Electric Vehicles loan — Electric Cars*, min 200,000, max 9,000,000. It is absent from the
standard eligibility sheet, so it may be Privé-only — worth confirming.

### 2.7 ADIB: three rate grids, priced on axes the repo has (**no ADIB programme exists**)

All three are `pricing.rateByFact` grids in the repo's existing shape. ADIB Egypt **is already
seeded as a bank** (`seed-banks.ts:47`) with no auto programme.

**(a) Home + work verification** — employee and business owner priced identically:

| DP | 1–2y w/ins | 1–2y no ins | 3–5y w/ins | 3–5y no ins | 6–7y w/ins | 6–7y no ins | 8–10y w/ins | 8–10y no ins |
|---|---|---|---|---|---|---|---|---|
| 30% | 15.09 | 15.76 | 14.29 | 14.96 | 15.29 | 16.03 | 16.31 | 17.11 |
| 40% | 14.18 | 14.86 | 12.81 | 13.46 | 13.67 | 14.38 | 14.54 | 15.32 |
| 50% | 13.69 | 14.35 | 12.32 | 12.97 | 13.13 | 13.84 | 13.97 | 14.74 |
| 60% | — | 13.55 | — | 12.19 | — | 12.98 | — | 13.81 |

Axes: `car_down_payment_percent` × `tenor_months` × `car_insurance`. **All three exist.**
The 60% row has no insured column at all — a `reject` cell, not a blank.

**(b) Luxury car**, home + work, uninsured only: 40% → 14.52 / 13.14 / 14.02 / 14.93;
50% → 14.02 / 12.64 / 13.48 / 14.35 across 1–2 / 3–5 / 6–7 / 9–10 years.

**(c) Home verification only** (condition: qualification or occupation printed on the ID card),
mandatory insurance: 30% → 15.77 / 14.36 / 15.37; 40% → 16.48 / 15.06 / 16.14;
50% → 16.03 / 14.61 / 15.65; 60% → 14.46 / 13.08 / 13.96 across 1–2 / 3–5 / 6–7 years.

Note (c) is **not monotonic** — 40% DP is dearer than 30% and 50%. That is what the sheet prints;
it is not a transcription slip, and any validator that assumes a rate falls as the deposit rises
will refuse it.

**The verification regime is the axis that separates (a) from (c)**, and no fact expresses it.
The sheet also carries a waiver: *"programs of 50% or more may waive the work check provided the
occupation is on the back of the ID card."*

### 2.8 HDB is entirely absent from the repo

DOCX §2 — nine programmes across two customer types, keyed on a code the bank prints (E2/E3/E5/E6,
S2/S3/S4/S5, Luxury):

| Type | Program | DP | Financing | Insurance |
|---|---|---|---|---|
| Employee | E2 / E3 / E5 / E6 | 31 / 41 / 50 / 40% | 69 / 59 / 50 / 60% | Mandatory / Mandatory / None / None |
| Self-Employed | S2 / S3 / S4 / S5 | 30 / 40 / 50 / 40% | 70 / 60 / 50 / 60% | Mandatory / Mandatory / None / None |
| Luxury | Luxury | 25% | 75% | As per policy |

All at 50% DBR. **No rate is published for any of them** — the same hole the SCB card has, where
the repo used `team_estimated` placeholders.

Structurally this is *one* programme per customer type with an `ltvCeilingByFact` grid keyed on
`(employment_status, car_insurance)` — not nine programmes. E5/E6 and S4/S5 differ **only** by
insurance, which is exactly what makes them grid rows rather than cards.

### 2.9 Secured-against-deposit products (**neither bank modelled**)

- **SCB Semi-Covered** (`scb/…PM.jpeg`): up to 100% of the CD amount where 90% of the loan is
  secured and the rest treated unsecured; secured portion up to 90% from collateral; may drop to
  80% for semi-annual/annual payment. No DP, no age/service/salary minimum — the whole eligibility
  column reads "Not Required".
- **CAE Secured Against Deposits** (p2–3, codes 0706/0707/0730): financing % keyed on **payment
  frequency**, which is an axis nothing in the repo has:

  | Frequency | Financing | Security margin |
  |---|---|---|
  | Monthly | 95% of pledged deposit | 5% |
  | Quarterly | 90% | 10% |
  | Semi-annual | 85% | 15% |
  | Annual | 80% | 20% |

  Tenor: TDs & CDs up to 5 years → 25 KEGP; up to 7 years → 100 KEGP. Minimum income, business
  seniority, DBR, internal verification: **all waived**.

  A DBR-waived product does not fit the quote pipeline's central assumption. This is the one item
  here that is a genuine **engine** question, not a data question.

### 2.10 Smaller rules with no home

| Rule | Source | Notes |
|---|---|---|
| **Ban on sale** | SCB: N/A at 60%, YES at 50/40/30/20 | Already recorded as a known gap in `sheet-programs.ts` notes |
| **Insurance mandatory per DP tier** | SCB: N/A at 60/50/40, YES at 30/20 | Same note records the over-demand that the v30 merge forced |
| **Mileage ceiling** | CAE p24: reject if > 40,000 km/yr economy, > 100,000 km/yr luxury | No `car_mileage` fact |
| **Evaluation certificate** | CAE p24: 30-day validity, 7 acceptance criteria (motor, interior, body, gearbox, airbags/ABS/EBD, chassis, km) | Document, not a figure |
| **Vendor coding** | CAE p24: 1 yr in business, external verification required, 50 KEGP paid-in capital | Vendor registry — out of scope |
| **Restricted sectors under self-employed** | CAE p22: anti-insecticide/pesticides, offshore recruitment, general supplies, mobile accessories/café/coiffure | `restrictedProfession` exists |
| **NID-specification external check** | CAE p14/p22: Blank / Housewife / Student / Without job → business external investigation | Not a refusal — a document trigger |
| **Dealer identity** | Both banks: Chinese cars 60 mo, **84 mo via Ghabbour & Mansour** | `car_origin` has `china`; **no dealer fact** |
| **Profession-specific auto programme** | CAE p26: *Doctor Auto Loan* (0719), syndicate-card validated, ≤ 3 MEGP relaxed docs | The repo has doctor *personal* products, not auto |

---

## 3. Backend features to implement

Ordered so that each item is shippable on its own. Effort is relative, not calendar.

### B1 — Seed the CAE auto programmes *(data only, no new mechanism)* — **M**

`demo-figures/sheet-programs.ts` + `sheet-figures.ts`. The CAE guide's programmes, each with its
bank code:

| Programme | Codes | DP | Financing | Tenor |
|---|---|---|---|---|
| New car 20% DP | 0704 (S-Emp) | 20% | 80% | 6–84 |
| New car 40% DP | 0709 / 0710 | 40% | 60% | 6–84 |
| New car 40% DP "envelop" | 0709-1 / 0710-1 | 40% | 60% | 6–84 |
| New car 50% DP | — | 50% | 50% | Emp 6–84 · S-Emp 6–60 |
| New car 50% DP "Easy envelop" | 0716-1 / 0715-1 | 50% | 50% | 6–84 |
| Used car 40% & 50% DP | — | 40/50% | 60% | 6–84 from manufacture date |
| Doctor auto loan | 0719 | — | — | 6–84 |
| EV auto loan 35% DP | — | 35% | **65%** | 6–84 |
| EV auto loan 40% DP | — | 40% | 60% | 6–84 |
| EV auto loan 50% DP | 0731 / 0732 | 50% | 50% | 6–84 |
| Secured against deposits | 0706 / 0707 / 0730 | — | by frequency | ≤ 84 |

Uses: `loanLimits.maxLoanByFact` (§2.1), `tenor.maxMonthsByEmploymentType` (§2.3),
`ltvCeilingPercent`, `ageMin` 21 (new) / **25** (used), `dbrCapPercent` 50.
**All existing fields.** `minAmountEGP` 15,000 throughout.

> The prototype's `CAE-P-PU` (Pick-up & Small Trucks, 40% DP, max 800,000, 60 mo) appears in the
> prototype only — I did not find its page in the 36 photos. Confirm before seeding.

### B2 — Seed the ADIB rate grids *(data only)* — **M**

Three `pricing.rateByFact` grids per §2.7 on `car_down_payment_percent` × `tenor_months` ×
`car_insurance`. Blocked on **B5** (verification-regime fact) for grid (c), and on a rate-basis
decision: ADIB is Islamic, so these are profit rates — `rateBasis` is already a field (v20.3.0),
but whether a murabaha profit rate prices as `reducing` needs a product answer.

### B3 — Seed HDB *(data only)* — **S**

Two programmes (employee, self-employed) + one luxury, each with `ltvCeilingByFact` keyed on
`(employment_status, car_insurance)` per §2.8. **Every rate is a `team_estimated` placeholder** —
the DOCX publishes none. Tag with `valueSources` exactly as the SCB card was.

### B4 — Car age-at-maturity clamp *(new engine rule)* — **M**

`manufacture_year + tenor_years ≤ N`, N per origin (14 / 13 / 7). A pure clamp beside the
applicant's own age-at-maturity clamp in `quote.ts`, composed by `min` with
`tenor.maxMonthsByFact`. New config, suggested `tenor.maxVehicleAgeAtMaturityYears?: FactGridConfig`
keyed on `car_origin`, reading `car_model_year`.

**Why not a grid:** tabulating it needs one row per (origin × model year) and the table goes stale
every January — the same "clock in disguise" argument that `seed-questionnaire.ts:357` already
makes when it explains why `model_year` became a number.

Refusal reuses `VEHICLE_NOT_ELIGIBLE`, whose sentence already covers model year. **No new error code.**

### B5 — Verification-regime fact *(new question + fact)* — **S**

ADIB's three grids differ only by what the bank checks. Suggested `verification_regime`:
`home_and_work` · `home_only` · `none`, with the ID-card waiver (`occupation_on_id`) as a second
optional question. Platform fact, `RESERVED_FACT_KEYS`, `car` category, **optional** — same
argument as `car_fuel_type` (a required one would refuse every Green Finance applicant over a
question about a home visit).

### B6 — Dealer / vendor fact *(new question + fact)* — **S**

`car_dealer`: `ghabbour_mansour` · `other_authorized` · `individual_seller`. Both banks' Chinese
overlay (60 vs 84 months) and CAE's used-car Chinese age split (5 vs 8 years back) key on it, and
neither is expressible today. Feeds `tenor.maxMonthsByFact` and the §2.2 age table as a second axis.

Verified: `car_origin`'s options are inline `question_option` rows, so `via: 'parentClass'` will
**not** work on them — one cell per (origin, dealer) pair, exactly as v30.0.0 found for origin.

### B7 — Wealth-tier fact + SCB Privé ceilings — **S**

`wealth_tier`: `standard` · `hnw` · `uhnw`. Then `maxLoanByFact` on the four SCB programmes per
§2.5, plus the third Green programme (§2.6) if confirmed.

**Caution:** this is a fact the applicant *self-declares* and the bank *verifies from AUM*. A
self-declared UHNW answer raising a ceiling from 5M to 9M is a quote the branch will not honour.
Recommend it reads as a **non-binding upper tier** — quote the standard ceiling and say the Privé
one exists — rather than as a cap input. Needs a product decision.

### B8 — Ban-on-sale and per-tier insurance — **S**

Both are recorded in `SCB-CAR-DOWN_PAYMENT`'s own notes as gaps the v30 merge could not state.
Both are per-**plan** facts on a programme whose plans are now rows. The honest fix is a
plan-level `requirements` column beside the existing five plan grids — same `FactGridConfig`
shape, `valueKind` a new `'flag'`.

Until then they stay prose in `notes`, which is where they are.

### B9 — Deposit-secured products *(engine question)* — **L**

§2.9. Blocked on a decision, not on code: a product with **no DBR, no income and no age** does not
pass through `quote.ts`'s central path, and forcing it through by seeding a 100% DBR cap would put
a fabricated figure on an immutable `bank_offer`. Two options:

- **(a)** A `collateralOnly` programme flag that short-circuits the income cascade and quotes
  `pledged_amount × financingPercent`, binding a new `pledged_deposit_ceiling`.
- **(b)** Leave it out and say so.

Recommend **(a)**, but scoped as its own change — it is the only item in this document that
touches the quote pipeline's shape rather than its inputs.

### B10 — Mileage fact — **XS**

`car_mileage_per_year`, numeric, optional. CAE refuses above 40,000 (economy) / 100,000 (luxury).
Reuses `VEHICLE_NOT_ELIGIBLE`.

### B11 — I-Score table reconciliation — **XS, blocked on a source**

§2.4. If the prototype's figures are the bank's: change three band edges, three percentages, the
`coalesce` fallback from `'100'` to `'85'`, and drop nine `team_estimated` markers. If they are
the prototype author's estimates, change nothing and record it.

**Do not implement on the strength of the prototype alone.** These four numbers multiply every
surrogate quote on the platform.

---

## 4. The prototype — read it as a spec, not as a reference implementation

It is a useful statement of intent and a poor engine. Three defects, one of which the DOCX itself
warns against.

### 4.1 It quotes the down payment as final — the DOCX says not to

`rvEvalProgram`: `dp = price × prog.dpMin; finance = price − dp`. The DP is **always exactly** the
programme's percentage and the financed amount follows from it. DBR is then checked as a
pass/fail on the result.

The DOCX §12 closes with the opposite instruction, verbatim: *"A program's stated Down Payment is
an eligibility/LTV constraint. It is not automatically the final financing amount. DBR capacity and
the reverse installment calculation can reduce the final finance amount."*

The backend already does the correct thing. **Do not port this.**

### 4.2 Its Chinese overlay is a CAE rule applied to both banks

`rvEffectiveMaxTenor` applies the 60/84-month Chinese cap to whichever programme is selected. The
rule appears in the *General Condition* of every **CAE** page. No SCB sheet states it. Applying it
to SCB is a hardcoded cross-bank rule — Principle II / A1 in this repo.

### 4.3 Deliberate simplifications its own admin notes disclose

- Max loan flattened off the origin table (§2.1) — *"no longer tied to this brand/origin selector."*
- Green Power / Micro Mobility **excluded from the engine entirely** — *"Use a dedicated
  savings-based calculator."* The repo quotes both today.
- Rate, DBR cap and admin fee are **global**, one set for all banks and programmes. The repo holds
  all three per programme.

### 4.4 What it gets right and is worth taking

| Behaviour | Why it is worth having |
|---|---|
| **Admin fee capitalized into the financed amount** before PMT | `adminFeePercent` exists on the programme but the fee is reported, not financed. Whether ADIB's *"admin fees, cash-back gift 5,000–70,000"* is financed changes the instalment. **Needs a product answer.** |
| **Reverse-from-installment cross-check** (`pv()`) | Solves PMT backwards from a quoted instalment to the implied loan, DP and LTV. `maxPrincipalRaw` already exists — this is an admin *screen*, not engine work. See **A4**. |
| **Program-fit scan across every DP tier** | Its best idea: scan all tiers and name the lowest DP the customer clears. v30.0.0 merged the five SCB tiers into one programme with plan grids, so the platform now answers this *within* a quote — but nothing **shows** it. See **A3**. |
| Rounding the reversed loan to the nearest 500 EGP | *"A bank doesn't reject an application over a few EGP of floating-point noise."* Correct, and worth copying into A4. |

---

## 5. Admin features to implement

Mode is **Operate** throughout (impeccable): the operator is in a task, scanability and
consistency outrank expression, and brand lives in precise details. Every screen below uses the
existing token set in `admin/src/styles/` — no new colour, no raw hex, no raw px (A18, A27,
Principle XXIV). Per Principle XXIII, `ui-ux-pro-max` runs **before** any new screen is designed
and `impeccable` runs **after** first implementation.

### A1 — Rate grid editor: reject-cell and non-monotonic support — **S**

`shared/ui/fact-grid-editor.component.ts` exists and already edits `rateByFact`. Two gaps ADIB
exposes:

- **A blank cell and a refused cell are different statements.** ADIB's 60% DP row has *no* insured
  column — that is "not sold", not "not filled in". Today a blank falls to `onNoMatch`. The editor
  needs a third cell state whose glyph is not an empty box.
- **Non-monotonic rates must save without a fight** (§2.7c). If a validator or an advisory assumes
  rate falls as deposit rises, it will flag a correct table. Verify before seeding.

*Design:* reuse the three-state vocabulary already shipped on the class board (v26.2.1) — bare ink
for the verb, no tick-box disc. A refused cell reads as a struck cell at `--text-tertiary` with an
`aria-label` saying *not sold at this deposit*, never as `disabled` (a disabled cell leaves the tab
order and its reason is announced to nobody — the exact defect v23.0.0 fixed on the ask board).

### A2 — Three-axis grid rendering — **M**

ADIB's grid is DP × tenor × insurance. The editor renders **two** axes as a table with a second
value column (v25.1.0). A third axis today renders as stacked editors.

*Design:* **do not build an N-column table.** v25.1.0's own reasoning holds — forking the key-match,
re-key, reorder and delete paths per column on the one control that edits live figures is how the
columns come to disagree. Render the third axis as a **segmented rail above the table** (the
`app-rail-tabs` `appearance="segmented"` already shipped in v25.1.0), one axis value on stage, with
the count of filled cells per segment visible on the rail so an operator can see at a glance that
the uninsured column has four rows and the insured one has three.

### A3 — Plan-row breakdown inside the existing simulator — **M**

**Most of the prototype's program-fit screen already exists.** `features/questionnaire/matching-simulator.page.ts`
lets an operator answer the questionnaire as a sample applicant and returns one quote per programme
with the instalment, the effective rate, the max affordable amount, the rejection reasons and the
binding constraint — rendered through `bindingConstraintLabel` in `simulation-labels.ts`. Do not
build a second one.

What it **cannot** show is the prototype's one distinctive idea: `SimulationMatch` carries one row
per *programme*, and since v30.0.0 the five SCB deposit tiers are one programme with plan grids. So
the operator sees *a* quote and not **which plan row the deposit landed in**, nor what the
neighbouring rows would have quoted — which is exactly the question *"what deposit should this
customer put down?"*

*Scope:* extend `SimulationFigures` with the resolved plan row (the matched cell of each of the
five plan grids and its axis values), and render it as a nested table under the matched programme.

*Design:*
- Reuse `app-income-key-table`'s row vocabulary — this is a **table**, and `overflow-x: auto` on
  the wrapper is mandatory (ui-ux-pro-max: *Responsive → Table Handling*, Medium).
- Reuse `bindingConstraintLabel` verbatim. A second set of labels for the same closed enum is how
  the two come to disagree.
- The matched row is marked by **ink and a word**, never by fill alone (ui-ux-pro-max:
  *Charts & Data → relying on color alone*; the prototype pairs `✔`/`✘` glyphs *with* colour,
  which is the correct pattern).
- Figures take `--font-mono` and `tabular-nums`; money inputs use `MoneyInputDirective` (A27).

### A4 — Offer cross-check panel — **S**

The prototype's best screen: type a bank's quoted instalment, tenor and rate; get the implied loan,
down payment, LTV, total interest and total payable, checked against the selected programme's
limits.

`maxPrincipalRaw` already does the arithmetic in `pmt.ts`. `POST /v1/calculator/quote` exists but
runs the **forward** direction (amount → instalment) for customers — this is the reverse, for an
operator holding a bank's quote and asking what it implies. Neither replaces the other.

*Design:*
- It is a **read-out, not a form that saves** — no Save button, no dirty state, nothing persisted.
- The prototype renders it as an offer slip with a `total` and a `grand` row. That hierarchy is
  right; render it as a `<dl>` with the three tiers already in the token scale
  (`--text-sm` rows, `--text-lg` on the instalment, `--text-xl` on total payable).
- The verdict line sits at the **foot** and states the failure in words —
  *"DP 18% is below this program's 20% minimum"* — never a bare red border
  (ui-ux-pro-max: *Forms → Errors near field*, and impeccable Operate: every component ships
  default/hover/focus/active/disabled/loading/error).
- Round the reversed loan to the nearest 500 EGP and **say so on screen**, or the operator will
  read a rounding as an error.

### A5 — Verification-regime + dealer controls in the wizard — **S**

B5 and B6 add two facts; both become grid axes and neither needs its own wizard step. They land as
rows in the existing **Requirements** card (step ④) and as pickable axes in the grid editor's fact
list. **No new step** — v26.1.0 collapsed eight steps to five precisely because a step that owns
one control is not a step.

### A6 — HDB / ADIB programme authoring — **XS**

No new screen. Both banks are seeded (`seed-banks.ts`), the wizard's five steps already carry every
field B2 and B3 need, and the grid editor covers the rate tables once **A1** lands.

### A7 — Estimate marking on a sheet with no published rate — **XS**

HDB publishes no rate at all and ADIB publishes no DBR. The `valueSources` / `team_estimated`
mechanism exists and the product screen renders it. Verify the marker is visible on the **bank
programme** wizard too, not only on the product screen — an operator typing a placeholder rate into
a bank card should see it marked as an estimate in the same breath.

### A8 — Design-system compliance notes for all of the above

Non-negotiable, and each has bitten this repo before:

| Rule | Why it is listed |
|---|---|
| `--text-tertiary` is **3.83:1** on a card in light mode | Any figure or reason an operator must *read* takes `--text-secondary`. Recorded in `DESIGN_SYSTEM.md` and re-found in v22.0.0, v23.1.0, v25.1.0, v26.2.1. |
| `outline: none` + a bare `--focus-halo` is a **1.24:1** indicator | v23.1.0 fixed 13 sites. New controls use the house pattern: `outline: var(--focus-ring-width) solid var(--focus-ring-color)` + offset. |
| Logical properties only | `margin-inline-start`, never `margin-left` (A19). Every screen here must be driven in **RTL** with page overflow measured at 0. |
| 44×44px minimum touch target under `@media (hover: none)` | ui-ux-pro-max priority 2, CRITICAL. |
| No new `nz-icon` patch inside a shell that projects content | v19.1.0: `NzIconDirective` resolves the **nearest** patch service, so a shell's patch shadows every form rendered inside it. Draw new glyphs as inline SVG. |
| Verify tokens exist before using them | v18.1.2 found six `var()` references to tokens no palette defines — invalid at computed-value time, so the rule silently paints nothing. |
| Errors after `touched`, not on load | ui-ux-pro-max Angular stack, and a focusable error summary linked to each invalid field for any multi-field save (Forms/Accessibility, **High**). |

---

## 6. Contradictions between sources — resolve before implementing

| # | Conflict | A says | B says | Suggested resolution |
|---|---|---|---|---|
| 1 | SCB Green Finance max loan | DOCX §10: 2M HNW / 4M UHNW | SCB standard sheet: max **1M** | DOCX quotes the **Privé** table as standard. Trust the sheet; treat DOCX §10 as the Privé tier. |
| 2 | ADIB used-car age | Photo 1: German/Jap/American from 2015, 3 yrs, year+tenor ≤ 14 | Photo 2: from model 2016 → 4 yrs, up to 2017 → 5 yrs | Two vintages of one sheet. **Get the current one** — this decides refusals. |
| 3 | ADIB luxury top tenor band | DOCX §4: 8–10 years | Photo 3: **9–10** years | Photo is the primary source. Confirm whether 8-year terms are sold at all. |
| 4 | I-Score multipliers | Prototype: 60/85/90/100 at 521/625 | Repo: 80/100/110 at 550/700, all estimates | §2.4 / B11. **Blocked on a source.** |
| 5 | CAE max loan | Prototype: flat 7M | CAE guide: 10M / 7M / 4M by origin | Guide wins. §2.1. |
| 6 | Chinese tenor overlay scope | Prototype: both banks | CAE guide: CAE General Condition only | Per-programme, never global. §4.2. |
| 7 | CAE pick-up programme | Prototype: 40% DP, max 800K, 60 mo | Not found in the 36 photos | Confirm before seeding. |
| 8 | SCB min service waiver | Sheet: waived at 40%/50% DP on 6 months' clean I-Score | 12 months otherwise | Conditional waiver — no field expresses it. Already a recorded gap. |

---

## 7. Suggested order

**Phase 1 — data on existing mechanisms (no engine change, no migration)**
B1 (CAE) · B3 (HDB) · §2.1 origin ceilings · §2.3 per-segment tenor. Gated on A1 for the grids.

**Phase 2 — the two facts that unlock the ADIB grids**
B5 (verification regime) · B6 (dealer) · then B2 (ADIB rates) · A5.

**Phase 3 — the engine rule the used-car market needs**
B4 (car age at maturity) · B10 (mileage).

**Phase 4 — operator-facing**
A3 (plan-fit panel) · A4 (offer cross-check) · A2 (three-axis rendering).

**Phase 5 — decisions first, code second**
B7 (Privé — self-declared wealth) · B8 (ban on sale, per-tier insurance) · B9 (deposit-secured) ·
B11 (I-Score). **Each is blocked on an answer, not on effort.**

---

## 8. Open questions for the product owner

1. **Are the prototype's I-Score multipliers a bank's table, or the author's estimate?** This
   multiplies every surrogate quote on the platform.
2. **Is the administrative fee financed or paid upfront?** The prototype capitalizes it; the
   backend reports it. It changes the instalment on every quoted loan.
3. **Which ADIB used-car age sheet is current** (conflict 2)?
4. **HDB rates** — the DOCX publishes none. Are there real ones, or does HDB ship on placeholders?
5. **Privé** — should a self-declared HNW/UHNW answer raise a quoted ceiling, or only disclose that
   a higher tier exists (B7)?
6. **Deposit-secured products** — in scope for this cycle (B9), or explicitly deferred?
7. **ADIB rate basis** — do the murabaha profit rates price on the reducing annuity?
8. **CAE pick-up & small trucks** — real programme, or prototype-only (conflict 7)?

---

## 9. What is already done, and should not be rebuilt

For anyone reading this alongside the prototype and concluding the platform needs an auto engine:

- The **five-step calculation** (DOCX §1) — `matching/pipeline/`, complete, both rate bases.
- The **SCB surrogate formula** `DP ÷ 36 ÷ 10%` (DOCX §8) — live, quoted at 138,888.89 from a
  500,000 deposit in `npm run quote:surrogate`.
- **All five SCB down-payment tiers** — merged into `SCB-CAR-DOWN_PAYMENT` with plan tables
  (v30.0.0), quoting 10/9/8/7/6% by deposit, verified 13/13 by `npm run quote:car-plans`.
- **Green Power (6–120) and Micro Mobility (6–84)** — seeded, with the savings-based income
  formula the prototype declines to model.
- **Every vehicle question the sheets key on** — `car_price`, `car_down_payment`, `car_origin`,
  `car_fuel_type`, `car_model_year`, `car_insurance`, `vehicle_condition`, plus the engine-derived
  `car_down_payment_percent` and `tenor_months`.
- **Every grid the auto sheets need** — `rateByFact`, `maxMonthsByFact`, `minMonthsByFact`,
  `ltvCeilingByFact`, `minAmountByFact`, `maxLoanByFact`, `maxMonthsByEmploymentType`.
- **LTV ceiling as a real clamp** with `bindingConstraint` and `requiredDownPaymentEGP` frozen on
  the offer (v27.0.0), and surfaced in the admin matching simulator.
- **A matching simulator** — `features/questionnaire/matching-simulator.page.ts` — answering
  "what would this applicant be quoted, and why not more?" per programme (see **A3**).
- **All four banks seeded**: ADIB Egypt, Housing & Development Bank, Crédit Agricole Egypt,
  Suez Canal Bank.

The gap is **catalogue coverage** (three banks' auto books unseeded), **four facts**
(verification regime, dealer, wealth tier, mileage), **one engine rule** (car age at maturity),
and **one structural question** (deposit-secured products). It is not an engine.
