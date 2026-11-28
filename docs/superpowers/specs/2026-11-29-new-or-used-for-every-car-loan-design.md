# New or used, the same way for every car loan

**Date:** 2026-11-29 · **Status:** for approval

## Why

Today the choice exists only for payslip customers, through two program names (New Car, Used Car).
A no-payslip customer (a freelancer) is never asked, though banks treat new and used cars
differently (age limits, electric offers). The operator: "go with the reasonable one" — one rule
for everyone.

## What the customer sees

1. Loan setup: Auto Loan → with or without payslip → program. Payslip shows **one** name,
   **Car Loan** (قرض سيارة), instead of New Car + Used Car. No-payslip names stay as they are.
2. First car question, on every car program: **"Is the car new or used?"** (جديدة / مستعملة), required.
3. New → gas or electric. Used → the model year. Then category, brand, price, down payment.
4. Offers: only programs that finance that kind of car.

## What the operator sees

- On a car bank program's first step: **"Finances: New cars / Used cars / Both"** (default Both).
- A bank may keep a new-car program and a used-car program under the same name (e.g. ADIB's two),
  as long as they finance different kinds. Two "Both", or a "Both" beside either, is refused.
- The pricing card is unchanged. The Oldest car column only ever applies to used cars (a new car's
  age is not asked).

## Data and engine

- `bank_program.carCondition`: `new` | `used` | `any` (car programs only; others null). Shown to
  the customer only when it matches the answer — one more rule in the shared `match-gate.ts`
  (hidden programs listed in the simulator with the reason, as today). An unanswered question
  hides nothing (as the other rules).
- Question `car_condition` (options `new`, `used`), ticked on every car name; `car_fuel_type`
  asked when it is `new`, `car_model_year` when it is `used` (the existing show-when rules).
- One-program-per-name-per-bank becomes per name, bank and kind for car programs.

## Migration (existing databases)

- New program name `car_loan` "Car Loan" / "قرض سيارة" (car, payslip). The 13 programs on
  `new_car` / `used_car` move to it; `carCondition` = `new` / `used` from the name they left.
- Every other car program: `carCondition = any`.
- `new_car` and `used_car` are switched off, not deleted: old applications still name them.
- Ticks and question order of the two old names are merged onto `car_loan`.
- Seeds produce the same result on a fresh database (re-run → 0 written).

## Not changing

Pricing card, Loan Engine, the quote itself. The mobile app needs no code change for the flow
(it renders what the backend serves, follow-ups included); its brand-by-category filter is a
separate gap.

## Tests

check:engine cases: payslip and no-payslip, new and used — the question order, the hiding by
kind, oldest car only on used, gas/electric only on new. e2e: the program step's "Finances"
choice and a simulator run per kind. Seeds re-run 0 written. Nothing committed without the
operator.
