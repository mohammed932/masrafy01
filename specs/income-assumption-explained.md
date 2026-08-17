# Income assumption — what this section is, in plain English

Where it lives: the bank-program wizard, **step 5 "Eligibility"**, block titled *Income assumption*.

- Admin UI: [income-assumption-section.component.ts](../admin/src/app/features/bank-programs/form/sections/income-assumption-section.component.ts)
- Method list: [bank-programs.types.ts:281](../admin/src/app/features/bank-programs/bank-programs.types.ts#L281) (`incomeMethodGroups`)
- Engine: [income-resolver.ts](../backend/src/matching/pipeline/income-resolver.ts)
- Types: [types.ts:222](../backend/src/matching/types.ts#L222) onward (`INCOME_ASSUMPTION_STRATEGIES`, `IncomeAssumptionConfig`)
- Legacy upgrade on read: [income-rule-normalize.ts](../backend/src/matching/pipeline/income-rule-normalize.ts)

---

## 1. The problem it solves

Normal loan: the bank reads your payslip. Monthly income = the number on the payslip. Everything else (how much you can borrow, your installment) is computed from that.

Some loans have **no payslip**. A taxi driver, an army officer, a doctor with their own clinic, a business owner. The bank still needs one number — "assumed monthly income" — before it can lend anything.

So the bank uses a **substitute fact** plus its own lookup table. Example, an actual ABK-style rule:

> "Tell us your military grade. We assume a Major earns 20,000 EGP a month."

The *Income assumption* section is where an admin types that bank's substitute rule into the system.

**It only matters for programs marked `income_surrogate`** (step 1 of the wizard: "sold without a payslip"). An `income_proof` program just uses the declared salary.

---

## 2. One worked example, end to end

Program: `ABK-MILITARY`, no payslip, sold to army officers.

**Admin fills in:**

- Method = `By military grade`
- A key table appears. Rows are the `military_grade` registry values:

| Key (grade) | Assumed monthly income (EGP) |
|---|---|
| `lieutenant` | 12,000 |
| `major` | 20,000 |
| `colonel` | 35,000 |

**Applicant applies.** In the questionnaire they answer "military grade = Major".

**Engine runs:**

1. `surrogateFactsFromAnswers` puts `major` on the applicant profile.
2. `resolveAssumedIncome` sees `strategy: 'byMilitaryGrade'` → `lookupKey('major', config)`.
3. Table row found → **income = 20,000 EGP**, `origin: 'surrogate'`, `matchedRow: { key: 'major' }`.
4. That 20,000 goes into the DBR check → installment cap → max loan → the offer the customer sees.

The offer stores where the number came from (`origin`, `strategy`), because an offer is immutable (Principle I) and "20,000" alone doesn't say whether it was a payslip or a table.

---

## 3. The three shapes a method can have

Every method is one of three editor shapes (`IncomeMethodShape` in `bank-programs.types.ts`):

### a) Key table — `keyTable`
Answer is a **choice**. Table maps each choice to an income.

`By military grade`, `By academic rank`, and every registry fact bound to a `SINGLE_SELECT` question.

```
major → 20,000
colonel → 35,000
```

Miss behaviour: applicant answered but no row for it → `no_matching_row` (fails closed, never guesses).

### b) Bands — `bands`
Answer is a **number**. Half-open ranges `[from, to)`, ordered, last one open-ended.

`By years in job`, `By years in practice`, `By CD value`, `By total deposits`, and registry facts bound to `NUMERIC` questions.

```
[0, 3)   → 8,000
[3, 10)  → 15,000
[10, ∞)  → 25,000
```

Edges only, so gaps and overlaps are impossible to type — same idiom as the v14.0.0 scoring bands.

Miss: value below the first edge → `no_matching_band`.

### c) Scalar — `scalar { value, unit }`
One number plus a unit; the arithmetic is hardcoded per method.

| Method | Arithmetic |
|---|---|
| `By credit card limit` | `limit × multiplier` (default 0.1) |
| `By car installment` | `installment × multiplier` (default 4) |
| `By car loan amount` | `loan × percent ÷ 100 ÷ 12` |
| `By bank statement %` | `balance × percent ÷ 100` |

Example: card limit 200,000 × 0.1 → **20,000 EGP/month**.

### d) `declared` — no shape at all
"Believe the salary the applicant typed." No table, nothing to configure. **This is why the section looks empty when `Declared` is picked** — that is correct, not a bug.

Note `declared` is legitimately used on `income_surrogate` programs: every seeded business program plus the doctor / professional / pharmacy archetypes carry `programType: income_surrogate` with `strategy: 'declared'` — a self-employed person states their income and there is no payslip behind it.

---

## 4. How the picker is grouped (what the operator sees)

`incomeMethodGroups()` returns three groups:

| Group | Contains | Meaning |
|---|---|---|
| **Reads an answer the customer gives** | By military grade, By academic rank, By years in practice, By credit card limit, + every registry fact | The figure comes from a questionnaire answer |
| **Reads a figure from documents** | By years in job, By CD value, By total deposits, By car installment, By car loan amount, By bank statement % | The figure comes from a document/profile field |
| **No rule** | Declared | Use the stated salary |

The four "built-in" fact methods and the operator-added registry facts sit in **one** group on purpose — to the operator they're the same thing. The four keep their own strategy tokens only because live offers froze them.

---

## 5. Adding a new fact is an admin action, not a release (v16.2.0)

Strategy token `fact:<key>` names a row in the `surrogate_fact` registry (Manage values → Income facts).

- Registry row is bound to a **question** (`boundQuestionId`, SINGLE_SELECT or NUMERIC only).
- Editor shape is derived from the bound question's type.
- For a choice fact, the key-table keys are the **bound question's own option codes** — so the keys the bank picks and the answers the customer picks are one list by construction.

`resolveRegistryFact` ([income-resolver.ts:368](../backend/src/matching/pipeline/income-resolver.ts#L368)) is the generic form of the four hand-written methods. `fact:` is checked **before** the built-in switch so a fact key colliding with a built-in token can never be shadowed.

---

## 6. Declared salary vs surrogate figure — who wins

`decide()` in [income-resolver.ts:109](../backend/src/matching/pipeline/income-resolver.ts#L109):

| Surrogate | Declared salary | Result |
|---|---|---|
| miss | present | **declared** wins — a broken table must not blank out a program |
| hit | absent | **surrogate** wins |
| hit | present, no `combinationRule` | **surrogate replaces declared** (that is the point of a surrogate program) |
| hit | present, `greater_of` | `max(surrogate, declared)` |
| hit | present, `lesser_of` | `min(surrogate, declared)` |
| miss | absent | income = **0**, `origin: 'none'`, plus the reason |

Important: `incomeEGP` is 0 when unresolved, so callers must read `origin`, never test the number. "Earns nothing" and "we couldn't work it out" are different facts with the same digits.

### The four miss reasons

| Reason | Means | Admin fix |
|---|---|---|
| `fact_not_answered` | Applicant carries no value for the fact | Is the question asked for this loan category? |
| `no_matching_row` | Answered, but the key table has no row for that answer | Add the row |
| `no_matching_band` | Answered, but the number falls outside every band | Extend the bands |
| `rule_unconfigured` | The program never configured a table at all | Configure the method |

---

## 7. DBR cap override

`dbrCapPercentOverride` on the rule applies **only when the income actually came from the rule** (`origin` is `surrogate` or `surrogate_over_declared`).

Reason: a surrogate figure is the bank's own estimate of capacity, so a bank may cap it tighter than a payslip it has physically seen. If the applicant's declared salary ended up winning, the program's normal cap applies.

---

## 8. The Check panel

[income-rule-check.component.ts](../admin/src/app/features/bank-programs/form/sections/income-rule/income-rule-check.component.ts) → `POST admin/bank-programs/:programCode/income-rule/check`.

- It's a **simulator**. You invent a fake applicant (age, declared salary, existing monthly payments, amount wanted, term) and see what the rule produces.
- It sends the **on-screen draft including unsaved edits** — so you can mistype an income, see the wrong figure, and fix it without saving.
- Nothing is stored.
- It reports: assumed income, DBR cap used (and whether from the rule or the program), installment, estimated loan, qualifies yes/no, and which row/band the income traced to.

**Why the button is grey:** `[disabled]="form.invalid || pending() || !programCode()"`. A program that has never been saved has no `programCode`, and the check needs the program's own rate, fees and limits to compute an installment. Save once → it turns on.

Also: with method = `Declared` and sample salary = `0`, the result is `origin: 'none'` — no income at all. Put a real salary in the sample.

---

## 9. Storage

Everything lives in **one JSONB blob** on the bank program (`incomeAssumption`). No column per method, no migration for a new method — a new method is a new `strategy` token and nothing else.

Money is a **Decimal string at every hop** — admin form → DTO → JSONB → resolver, which constructs the `Decimal` (Principle I / A3). Never a float.

Legacy blobs (`rankIncomeMap`, `gradeIncomeMap`, `incomeTable`, the five scalar keys) are upgraded **on read** by `normalizeIncomeAssumption`, not by a data migration — same precedent as `normalizeWeights` in v8.0.0. The conversion is required to be output-identical (FR-015 / SC-009).

---

## 10. Save-time validation

`validateIncomeRule` rejects with typed 422 codes:

| Code | When |
|---|---|
| `INCOME_RULE_EMPTY` | Method needs a table, table is empty |
| `INCOME_RULE_INCOME_INVALID` | Income value ≤ 0 or not a Decimal |
| `INCOME_RULE_DUPLICATE_KEY` | Same key twice in a key table |
| `INCOME_RULE_UNKNOWN_KEY` | Key not in the registry / not an option of the bound question |
| `INCOME_RULE_BANDS_INVALID` | Bands unordered, overlapping, or gapped |
| `INCOME_RULE_DBR_OVERRIDE_INVALID` | Override outside a sane percent range |
| `INCOME_RULE_FACT_UNAVAILABLE` | `fact:<key>` names a fact the registry can't serve |

`requiredDocuments` is checked against the program's own document list and reported as a **warning**, never a block.

---

## 11. Open questions worth discussing

1. **Is `declared` on an `income_surrogate` program confusing?** It means "no payslip, but also no table — just trust the stated number." Seven seeded programs do this deliberately. But an operator seeing the empty section may think the program is misconfigured. Would a one-line "this program has no substitute rule — the applicant's own figure is used" affordance help, or does the hint already say it?

2. **The read-only program detail page still renders nothing about the income rule** (noted as outstanding in v16.0.0/v16.2.0). So a rule can only be inspected by opening the edit wizard.

3. **`warnings[]` is still read by no screen** — same outstanding item.

4. **Check needs a saved program.** Should it fall back to a sample rate/fee set so a brand-new program can be tested before first save?

5. **`combinationRule` is carried by no seeded or stored program.** It executes correctly but has never been exercised in production data — is it a real bank behaviour we expect, or dead configuration surface?
