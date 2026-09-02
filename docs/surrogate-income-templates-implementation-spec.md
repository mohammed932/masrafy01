# Surrogate ("no-payslip") income programs — implementation spec

**Audience:** Claude Code, working in the Masrafy repo (NestJS backend · Angular 18 admin · Flutter mobile).
**Status:** revised after a second pass over the source sheets. §10 now contains eleven findings, four
of which change the design — read §10 first, and do not start P1 until §10.1, §10.2, §10.3 and §10.4
have answers. §10.5 and §10.6 need answers from the banks and change every quoted figure.
**Inputs this spec is derived from:** `surrogate-programs-design.md` (design decision record),
`compound-classes-and-lists.md`, five HTML prototypes (armed forces, compound owner, teachers,
club membership, PL-to-card), ten ABK program sheets, four unlabelled Arabic policy sheets.

---

## 1. What we are building, in one paragraph

A no-payslip loan has no salary slip, so each bank guesses the customer's income its own way. Today an
operator builds that guess step by step in a rule builder — pick an operation, wire step 3 back to
steps 1 and 2. That is programming. We are adding a **template layer**: the operator picks *how the
figure is worked out* from a fixed list of shapes, ticks a few extras, and types the numbers. Those
picks **compile to the operations the engine already has**. The calculation engine does not change,
no new operation is added, and the old step editor stays available behind *Advanced*.

Alongside it, two pieces of plumbing the first real product (compound owner) cannot ship without:
a **two-list lookup setup** (classes + hundreds of compounds) and a **paste-a-list / CSV import**.

---

## 2. Ground rules — do not violate these

1. **No engine change.** Every template compiles to existing operations in
   `backend/src/matching/pipeline/product-rule.ts`. If a shape cannot be expressed with the existing
   operations, it does not go in the template list — it goes in §10 as a decision.
2. **No bank names, no bank numbers, in a template.** One product is sold by many banks. A bank's
   real figure may appear as grey placeholder text beside an empty field; it is never saved as part
   of the template. (Hardcoding a bank into shared code is a Principle II / A1 violation.)
3. **`incomeRule` stays the source of truth for the engine.** The template is stored alongside it and
   compiled into it in the same transaction. Nothing downstream
   (`effectiveProgramNameRule`, `effectiveIncomeRule`, the snapshot mapper, the engine) is touched.
4. **Bilingual everywhere.** Every list value and question needs an English and an Arabic label.
   The sheets are mixed English/Arabic; the mobile app is bilingual.
5. **A save must never silently orphan a bank's typed figure.** See the key-stability rules in §5.4.
   This is the single most dangerous failure mode in the whole feature.
6. **Verify file paths before editing.** Paths quoted below come from the design record and were
   accurate when it was written; confirm each one exists before relying on it.

---

## 3. Vocabulary

| Term | Meaning |
|---|---|
| **Product** | The surrogate program shape, e.g. "compound owner". Bank-agnostic. One product, many banks. |
| **Bank program** | One bank's configuration of that product — its figures, its caps, its terms. |
| **Template** | The saved answers to the three questions in §4, on the product. |
| **Path** | One "way to reach the figure". A product may declare several; each bank fills only the ones it uses. |
| **Column** | A second axis on a path — new customer vs existing, city, employment type, school type. |
| **Figure** | A number a bank types into a cell. Lives in the bank program's `stepParams`, keyed by step id. |
| **Income output** | Rule produces a monthly income → DBR → installment capacity → max loan. |
| **Ceiling output** | Rule produces a loan amount directly. Needs `baselineDbrPercent` to convert back. |

---

## 4. The operator-facing form (three questions)

### Question 1 — How does this bank work out the income? (pick one)

| # | Shape (operator wording) | Keyed by | Output |
|---|---|---|---|
| S1 | A table by job grade or rank | a choice answer | income |
| S2 | A table by years of experience | a number answer, banded | income |
| S3 | A share of a figure the customer tells us | a number answer | income |
| S4 | A multiple of a figure the customer tells us | a number answer | income |
| S5 | A ceiling from an asset's class | a choice answer, via its parent class | ceiling |
| S6 | A ceiling from an amount bracket | a number answer, banded | ceiling |
| S7 | A ceiling that is a share of what's already been paid | a number answer | ceiling |

### Question 2 — Does anything else apply? (tick any)

- [ ] **A second column** — city, employment type, school type, or one of the three distinct
      relationship questions (§10.3 — *new loan vs top-up*, *holds another product*, *known to the bank*
      are not the same question and must not share one)
- [ ] **Another way to reach the figure** → pick a second shape from Q1
  - [ ] …and take the **lower** of the two  ( / take the higher)
      — only when both sides are in the **same unit**. A maximum loan amount keyed by an answer is not
      a second path; it is program config (§10.2)
- [ ] **Adjust by I-Score**
- [ ] **Add a bonus %** when something is true (e.g. more than one unit → +10%)
      → and declare what it lifts: **the income** or **the maximum loan** (§10.4 — worth up to 50% of
      the quote, and the sheets mean the maximum loan more often than first reading suggests)
- [ ] **Halve on joint ownership** — same scope question
- [ ] **Conditions the customer must meet** (owned ≥ N months, paid ≥ X%, answer must be one of…)

### Question 3 — What are the numbers?

The matching grid appears; the operator types the figures. For a **ceiling** product one extra field
is mandatory and must not be lost from the friendly form
(the raw editor already has it at `product-rule-builder.component.ts:341`):

```
This ceiling was worked out at a DBR of  [ 50 ] %      ← ceiling products only
```

Blank means "use the program's own cap", which is the correct default.

---

## 5. Backend — template schema, compiler, key stability

### 5.1 Schema (TypeScript, store as JSON)

```ts
type TemplateVersion = 1;

interface SurrogateTemplate {
  version: TemplateVersion;
  output: 'income' | 'ceiling';
  baselineDbrPercent: number | null;      // ceiling only; null = use program cap
  paths: TemplatePath[];                  // 1..n; ids are stable forever (see 5.4)
  combine: 'coalesce' | 'min' | 'max';    // coalesce when each bank fills exactly one path
  splitBy: ColumnAxis | null;             // the "second column"
  iScore: { enabled: boolean; questionKey: string } | null;
  adjustments: Adjustment[];              // declared order; I-Score is emitted LAST regardless
  conditions: Condition[];
  advancedOverride: boolean;              // true once the operator edits raw steps — one-way
}

interface ColumnAxis {
  questionKey: string;                    // e.g. customer_relationship, city_tier, employment_type
  columns: { key: string; labelEn: string; labelAr: string }[];
}

type TemplatePath =
  | { id: number; kind: 'choiceTable';  questionKey: string }                       // S1
  | { id: number; kind: 'bandTable';    questionKey: string; bands: Band[] }         // S2, S6
  | { id: number; kind: 'shareOf';      questionKey: string }                        // S3, S7
  | { id: number; kind: 'multipleOf';   questionKey: string }                        // S4
  | { id: number; kind: 'parentTable';  questionKey: string };                       // S5

interface Band { key: string; min: number; max: number | null; }   // min inclusive, max EXCLUSIVE

type Adjustment = {
  kind: 'upliftPercent' | 'sharePercent';   // +10% multi-unit · 50% joint ownership
  scope: 'income' | 'maxLoan';              // MANDATORY — see §10.4, worth up to 50% of the quote
  whenQuestionKey: string;
  whenValue: string;
};

type Condition =
  | { kind: 'numberGte';   questionKey: string }                 // owned ≥ N months
  | { kind: 'numberBetween'; questionKey: string }
  | { kind: 'sharePercentGte'; numeratorKey: string; denominatorKey: string } // paid ≥ X% of price
  | { kind: 'choiceIn';    questionKey: string }
  | { kind: 'numberByKey'; questionKey: string; keyedByQuestionKey: string };
```

Threshold values for `Condition` are **bank figures**, not template data — they live in the bank
program's `stepParams` like every other number.

### 5.2 Compile table — friendly block → existing operation

| Template block | Compiles to |
|---|---|
| `choiceTable` | `factChoiceTable` |
| `parentTable` | `factParentTable` |
| `bandTable` | `factNumber` → `bandTable` |
| `shareOf` | `factNumber` → `percentOf` |
| `multipleOf` | `factNumber` → `multiply` |
| `splitBy` | one copy of the path per column + `pickByFact` |
| `combine: 'min' \| 'max'` | `minOf` / `maxOf` |
| `combine: 'coalesce'` | `coalesce` |
| `iScore` | `factNumber` → `bandTable` → `coalesce [ …, {const:'100'} ]` → `percentOf` |
| `upliftPercent` | `upliftPercent` + `pickByFact` |
| `sharePercent` | `percentOf` + `pickByFact` |
| `numberGte` | gate `kind:'number'`, `op:'gte'` |
| `numberBetween` | gate `kind:'number'`, `op:'between'` |
| `sharePercentGte` | `percentOf` + gate `number gte` |
| `choiceIn` | gate `kind:'choice'`, `op:'in'` |
| `numberByKey` | gate `kind:'numberByKey'` |
| `baselineDbrPercent` | `output.baselineDbrPercent` — the **only** DBR field the template writes |

### 5.3 Emission order (fixed, non-negotiable)

```
1. gates (conditions)
2. each path, in ascending path.id
3. per-path column pick (pickByFact) — inside the path, before combine
4. combine (coalesce | minOf | maxOf)
5. product adjustments, in declared order
6. I-Score multiplier            ← ALWAYS LAST
7. output (income | ceiling + baselineDbrPercent)
```

**Why the order is fixed:** `percentOf` rounds to 2 decimals at every step
(`product-rule.ts:547-556`). Multiplication commutes; the rounding does not. I-Score + joint-50% +
multi-unit-10% applied in different sequences differ by piastres. Same template must always produce
the same figure, to the piastre.

**Why I-Score must live inside the rule and not as a program-level multiplier:** DBR bands are chosen
against the income the rule returns (`income-resolver.ts:125`; for ceilings, re-resolved at
`quote.ts:418`). If I-Score were applied outside the rule, `resolveDbrCap` would have already picked
a band from the un-multiplied income, and a customer near a band edge would get the wrong cap.

**I-Score fallback is mandatory.** The customer question is optional and stored as a **number** (not a
named band) so a bureau feed can replace the typed answer later with no re-work. If unanswered the
multiplier is **100%** — via the `coalesce [ …, {const:'100'} ]` above. Without that fallback a missing
answer kills the whole quote. Each bank's band table must also **cover every score**: lowest row open
below, highest row open above, no gaps. Enforce at save, the same way scoring bands already are.

### 5.4 Key stability — the dangerous part

Every cell a bank fills has a hidden key (a step id in `stepParams` / `valueSources`). Three rules:

1. **Keys are derived from the shape, deterministically, never randomly.**
   `figureKey = t{templateVersion}.p{path.id}.{columnKey|'_'}.{rowKey}`
   `rowKey` is the choice value key, the band key, or `'_'` for single-value paths.
2. **`path.id` is assigned once and never reused or renumbered.** New path = `max(existing ids) + 1`.
   Deleting a path does **not** free its id.
3. **A save that would orphan a figure is refused**, and the error names every bank program that
   would lose numbers. Adding a path: allowed. Removing a path nobody filled: allowed. Removing a
   path a live bank filled: **refused**. Reordering paths: **never** (that is what ids prevent).

Implement rule 3 as a pre-save diff: compute the key set for the old template and the new one, and
for each bank program on that product, list keys present in `stepParams` that the new key set does
not contain. Non-empty → 409 with the program names.

### 5.5 Storage

- One new **nullable JSON column** beside `incomeRule` on `platform_enumeration`, populated only on
  `surrogate_product` rows. Suggested name `incomeRuleTemplate`.
- `incomeRule` continues to hold the compiled result. Both written in the **same transaction**.
- `advancedOverride: true` (operator edited raw steps) → the friendly form is switched off for that
  product, the screen says so plainly, and re-picking a template creates a **new** product rather
  than overwriting. One-way by design; do not attempt to keep the two in sync.

### 5.6 Validation & warnings

- **Refuse at save:** a bank program with every path blank (would quote nothing); an I-Score table
  with a gap or an unbounded end missing; a band table with gaps or overlaps; a ceiling product with
  neither `baselineDbrPercent` nor a program cap.
- **Warn, do not refuse:** "2 classes have no row in this bank's table."
  `validateStepFigures` deliberately does not validate parent keys
  (`income-rule.validator.ts:565-568`) — a stale key would block a save that a lookup fix elsewhere
  makes valid. Keep that behaviour; surface the gap as a warning on the product screen instead. A
  hand-edited or stale class key currently saves clean and only surfaces as `no_matching_row` on a
  real customer.
- **Warn:** any compound with no class (see §8.4 — treat as an outage, not a note).

---

## 6. Admin UI

Screens to build (Angular 18 admin):

1. **"Start from…" list** when creating a surrogate product — the seven shapes of Q1, named by *how
   the figure is worked out*. No bank names, no numbers in the list itself.
2. **The template form, saved and reopenable.** Not a one-shot wizard — the operator must be able to
   come back and change it (subject to §5.4).
3. **Per-bank figure grid.** Rows = the path's keys (grades, bands, classes). Columns = the
   `splitBy` columns, or one unnamed column. A blank cell means "this bank does not use this way".
   Show the shape badge per path (`category · direct limit`, `numeric range · income+DBR`, `% formula`)
   — the prototypes do this and it reads well.
4. **Advanced** — the existing step-by-step editor (`product-rule-builder.component.ts`), reachable
   but clearly marked one-way.
5. **Check panel** — reuse the existing one; it is how the acceptance tests in §13 get run by hand.

Reference behaviour for the grid and the check panel: the five HTML prototypes. Their state model
(`policy → segments → brackets × regions`, plus `iscoreBands`) maps onto this spec as
policy = bank program, segment = path, region = column, bracket = row. Their calculation order was:

```
table cell → × I-Score → + other income (capped) → × DBR cap → − obligations → tenor → max loan
```

and their max-loan maths (useful for reproducing sheet figures by hand):

```
flat:      loan = installment × months ÷ (1 + annualRate × months/12)
reducing:  loan = installment × (1 − (1 + i)^−months) ÷ i,   i = annualRate ÷ 12
```

Note the prototypes' bands are **half-open**: `value >= min && value < max`. Keep that convention and
say so on screen (§10.7).

---

## 7. Lookup lists — classes and compounds

Two lists joined by a parent link. This is the whole point of the design:

| List | Rows | Read by |
|---|---|---|
| `compound_class` | ~6 — AA · AB · A · B · C · Other | **the bank's table** — 6 rows, whatever the compound count |
| `compound` | hundreds — every compound in Egypt, each filed under one class | **the customer's dropdown** |

The customer picks *Mivida* by name. The bank's table is keyed by *class*. So adding a compound next
month touches **no bank's table**. `factParentTable` walks the answer up to its class and reads the
bank's row for that class.

What a bank fills in — six rows:

| Class | New customer | Existing customer |
|---|---|---|
| AA | 6,000,000 | 7,000,000 |
| AB | 5,000,000 | 5,500,000 |
| A | 4,000,000 | 4,500,000 |
| B | 3,000,000 | 3,500,000 |
| C | 2,000,000 | 2,500,000 |
| Other | 2,000,000 | 2,000,000 |

Existing screens: `product-fact.page.ts` ("Add something it asks") writes, in one run — class list →
classes → compound list → each compound **with its class** → the question → the fact. It asks for the
class list up front deliberately, because `resolveParentKey` refuses to create a filed-under value
with no parent; a compound is *born filed*. `parent-class-board.component.ts` moves compounds between
classes afterwards (priced here / priced elsewhere, search, move one or all-listed in one write).

**Read §10.1 before creating a single class.** The list above is one global classification, but every
bank publishes its own — EGBank has five categories, ABK has a binary "high end" list, FABMISR has
none. §10.1 gives the granularity rule that makes one global list serve all of them, and the
non-destructive procedure for splitting a class later. Getting the granularity wrong on day one is the
most expensive mistake available in this feature, because class keys are immutable and figures are
keyed by them.

---

## 8. Bulk import (blocker — ship it with this feature, not after)

There is **no CSV import and no paste-a-list** anywhere in the lookups or product screens today.
The only options are one FormArray row at a time inside the create-a-fact form (then one POST per
row), or one drawer per value afterwards. For "every compound in Egypt" that is not workable.

Build it on the values panel of a list.

**Format:** three columns, `labelEn , labelAr , classKeyOrLabel`. Accept pasted TSV/CSV and an
uploaded `.csv` (UTF-8 with BOM tolerated — Excel in Arabic locales writes it).

```
Mivida,ميفيدا,AA
Palm Hills,بالم هيلز,AA
Mountain View,ماونتن فيو,AB
Hyde Park,هايد بارك,AB
```

**Behaviour:**
- Dry-run preview first: N to create, N to update, N unchanged, N rejected — with the reason per
  rejected row and its line number. Nothing is written until the operator confirms.
- Unknown class → **default to `Other`**, flagged in the preview. Never leave a row unfiled (§8.4).
- Duplicate English label within the file, or already existing → update the Arabic label and class,
  do not create a second row.
- Import in **one transaction** (or batched with a rollback), not N sequential POSTs.
- Cap the file size and row count; report progress for large files.
- Export the same shape, so an operator can round-trip.

### 8.4 "Other" must be a real class, not "left unfiled"

A compound with no class makes `factParentTable` answer `no_matching_row`, which **stops the rule** —
and only `rule_unconfigured` is skippable. So every bank keying off class would quote **nothing** for
that customer. `Other / uncategorised` must be a real class that new compounds default into. The
server already refuses to create a compound with no class, but the class board can unfile one on
purpose and warns on screen when any are unfiled — **treat that warning as an outage, not a note**.

---

## 9. DBR — where it fits (mostly it does not)

DBR is a **bank setting**, not part of the calculation's shape. Every sheet says *DBR: 50%*, and that
already has a home. The template layer touches exactly one field: `baselineDbrPercent` on ceiling
products (§4, Q3). Nothing else about DBR moves — the cap belongs to the bank program, because two
banks selling the same product cap differently.

How the cap is decided today, most specific first (`backend/src/matching/pipeline/dbr.ts:86`):

| Order | Setting | Meaning | Settable today? |
|---|---|---|---|
| 1 | `dbrCapPercentOverride` on the rule | this product's own cap; used only when income came from the rule | Yes |
| 2 | `dbrCapPercentByEmploymentType` | 50% salaried / 40% self-employed | **No — unreachable, see below** |
| 3 | `dbrBands` | cap changes with income | Yes — wizard step 5 |
| 4 | `dbrCapPercent` | plain single number | Yes — wizard step 5 |

**Separate small fix (do it, but as its own change):** `dbrCapPercentByEmploymentType` is read by the
engine (`quote.ts:422`, `income-resolver.ts:379`) but is **not on `eligibility-config.dto.ts`**, so
`forbidNonWhitelisted: true` rejects it on the wire; there is no admin editor; and the only seed that
ever wrote it (`seed-collateral-products.ts`) was deleted. A sheet saying *"DBR 50% salaried / 40%
self-employed"* cannot be entered at all today — and CAE's compound sheet says exactly that. Fix =
add the field to the DTO + a two-row editor beside `dbrBands` in wizard step 5.

---

## 10. Findings from a second pass — read this section before writing any code

Each item below is a finding with the evidence behind it, then the decision it forces. Items 10.1 to
10.4 change the design; 10.5 to 10.8 are data questions that change the numbers; 10.9 to 10.11 are
the carried-over blockers.

---

### 10.1 The classification is **per bank**, not global — the biggest risk in the design

The two-list design (§7) assumes one global classification of compounds. The sheets do not agree with
that assumption:

| Bank | How it classifies the same compounds |
|---|---|
| EGBank | five published categories AA · AB · A · B · C, with C as the catch-all |
| ABK | one binary list — *"high end compounds"* (Emaar, New Giza, Sodic…), approved by Retail Risk |
| FABMISR | no class at all — "prime developer compounds", then priced by down-payment bracket |
| CAE | no class at all — priced off the amount paid |

So *Mivida* is `AA` to EGBank and *"high end"* to ABK. The parent link on a value is a property of the
**value**, which makes it global — one compound, one class, all banks. Under the current design, the
two banks cannot both be right.

**This does not need a per-bank parent axis, and it must not get one.** The fix is a rule about
granularity:

> The global class list must be at least as fine as the finest classification any bank publishes, and
> every bank's own grouping must be expressible as a **union of whole global classes**.

ABK is then served by filling the villa figure against `AA` and `AB` and the apartment figure against
`A`, `B`, `C` — its binary grouping is a union of global classes, so nothing is lost. This works today
with `factParentTable`, no new mechanism.

**What this costs, and what must be built to make it safe:** the day a bank arrives whose grouping
*cuts across* a global class — it treats half of `B` as premium — that class has to be **split**. A
split removes a class row, which orphans every figure that every other bank has typed against it, and
§5.4 correctly refuses that save. So splitting needs a documented, non-destructive procedure, and the
admin must support it:

1. **Add** the new finer classes. Never rename or delete the old one yet.
2. Re-file the affected compounds onto the new classes (the class board already does bulk moves).
3. Each bank fills the new rows. Show the "N classes have no row in this bank's table" warning from
   §5.6 until they do.
4. Only when no bank has a figure left against the old class, retire it.

Between steps 1 and 4 both classes exist and are priced, and no customer sees a blank card. Write this
into the operator documentation and build the warning in step 3 first — without it, step 4 gets done
early and banks silently quote nothing.

**The same problem, worse, for city tiers.** ABK Doctors (Clinic Owners) tiers cities as *Cairo & Alex*
versus *other*. The Arabic DOCTOR sheet tiers eight governorates — Cairo, Giza, Alexandria, Assiut,
Minya, Qalyubia, Gharbia, Dakahlia — versus other. Neither tiering is a union of the other's classes,
because "other" means different sets. A global `city_tier` question with two options therefore cannot
serve both banks. The city list must be the **governorates themselves** (27 rows, granular), with the
tier as the parent class, sized so both groupings are unions of whole classes — which for these two
banks means at least three classes: `Cairo/Giza/Alex`, `Assiut/Minya/Qalyubia/Gharbia/Dakahlia`,
`Other`. Then ABK fills the same figure against classes 2 and 3, and the Arabic bank fills the same
figure against classes 1 and 2. Do **not** create a two-option `city_tier` question; it will have to be
rebuilt within one bank of shipping.

**Decision required:** confirm the granularity rule, and agree that the global class list is owned by
whoever adds banks — not by whichever bank was configured first.

---

### 10.2 Most "take the lower" cases are a max-loan cap keyed by an answer — build that, not a second rule

This is the mixed income-plus-ceiling gap flagged in the first pass, now resolved with evidence. Reading the sheets again, the
second table is almost always printed **under the heading "Loan Amount — Maximum"**, not under the
income calculation. It is the program's maximum loan, keyed by a customer answer:

| Sheet | Rule produces | Second table, and where the sheet prints it |
|---|---|---|
| ABK 2 Compound Owner | ceiling — 15% of paid | max loan by **property type × NTB/Top-up**, under *Loan Amount* |
| ABK 3 CDs Holder | income — 30% of free collateral | max loan by **CD tier**, under *Loan Amount* |
| ABK 7 Doctors (Clinic Owners) | income — table by years | max loan by **city × NTB/Top-up**, under *Loan Amount* |
| Arabic DOCTOR | income — years × governorate tier | مبلغ التمويل by **years × governorate tier** |
| Arabic PROFESSOR | income — degree × university type | مبلغ التمويل by **degree × university type** |
| Arabic COMPOUND | income — share of paid | مبلغ التمويل by **unit price bracket** |
| Arabic SALARIED | (real payslip, no rule) | max loan by **company coding CAT A/B/C** |
| CAE Teachers, standard | (real income + DBR) | ceiling by **school type** |
| FABMISR Al Ahly club | (real income + DBR) | ceiling by **branch** |

Nine sheets, one mechanism. **Recommendation: option (a) — add a fact-keyed maximum loan to the bank
program's eligibility config and apply it in `quote.ts` after the DBR-derived loan.** Reasons:

1. It is where the banks put it. A cap on the loan amount is not part of guessing the income.
2. It covers the three cases the template layer cannot reach at all: `Arabic SALARIED` and the two
   real-income-plus-ceiling products (CAE teachers, FABMISR club) have **no surrogate rule** to hang a
   second path on.
3. It collapses several template paths into program config. ABK 2 stops being "two ways, take the
   lower" and becomes one rule (15% of paid) plus a cap table — fewer template keys, less §5.4 risk.
4. `minOf` inside the rule cannot express it anyway when the two sides are in different units. A
   ceiling can be converted to an income-equivalent, but that conversion needs the rate and tenor,
   which the rule does not have — that is exactly why the engine does it downstream at step 3b
   (`quote.ts:418`). Trying to do it inside the rule would mean handing the rule a tenor.

**Why taking the minimum downstream is mathematically safe:** the map from income to loan amount is
monotonically increasing (installment = income × DBR − obligations; loan = installment × the annuity
factor for the chosen rate and tenor). Under a monotonic map, `min` commutes with the map, so capping
the loan afterwards gives the same answer as capping the income beforehand. No ordering trap here.

**Keep `minOf` for the genuine same-unit cases** — ABK 4 (income is the lower of 3 × the car
instalment and 10% of the auto loan) is income versus income and belongs inside the rule.

**Shape of the new field:**

```ts
maxLoanByFact?: {
  questionKey: string;                    // the answer that selects the row
  columnQuestionKey?: string;             // optional second axis (NTB / Top-up)
  rows: { rowKey: string; columnKey?: string; maxLoanEGP: number }[];
  onNoMatch: 'useProgramMax' | 'reject';  // must be explicit — see below
}
```

`onNoMatch` matters: a compound in `Other`, or a governorate nobody tiered, must not silently become
"no cap" (a quote far above policy) or "cap zero" (a blank card). Default `useProgramMax`.

Two DTO consequences: add it to `eligibility-config.dto.ts` (`forbidNonWhitelisted: true` will reject
it otherwise — the same trap that made `dbrCapPercentByEmploymentType` unreachable, §9), and surface it
in the wizard beside the existing single max-loan field.

---

### 10.3 "New customer versus existing" is three different questions — do not collapse them

The second column is labelled differently on every sheet, and the labels are not synonyms:

| Sheet | Column labels | What it actually asks |
|---|---|---|
| ABK 2, ABK 7 | NTB / Top-up | is this a **new loan** or a **top-up of an existing loan** |
| FABMISR compound | NTB / X-SELL | does the customer already **hold another product** (there, a card with ≥ 100K limit) |
| EGBank compound (design record's example) | New / Existing customer | is the customer **known to the bank** at all |
| CAE teachers | International / National | school type — unrelated axis |
| Arabic PROFESSOR | Government / Private | university type — unrelated axis |
| Arabic DOCTOR | Major / Other governorates | city tier — unrelated axis |

A customer who holds a card but has no loan is **X-SELL** to FABMISR, **existing** to EGBank, and
**NTB** to ABK — the same person reads the wrong row in two of the three banks if one shared question
is used. FABMISR's X-SELL tier additionally carries a **condition** (the card must have a limit of at
least 100,000), which a bare column label loses entirely.

**Decision:** model these as separate questions — `loan_is_topup`, `holds_other_product`,
`is_existing_customer` — and let each bank's template pick which one is its column axis. Cheap now,
very expensive later, because changing a template's `splitBy` changes every figure key (§5.4).

---

### 10.4 Some adjustments act on the **cap**, not on the income — and one of them is worth 50%

Two ABK 2 lines that the first pass filed as in-rule adjustments are, read literally, adjustments to
the loan amount:

- *"Program loan amounts can be increased by 10% in case applicants provide more than one residential
  unit"* — **loan amounts**, i.e. the cap.
- *"Applicants owning apartments in high end compounds will be eligible for Villas maximum loan
  amount"* — explicitly the **maximum loan amount**, i.e. the cap row is swapped.

Whether an adjustment lifts the income, the cap, or both changes the answer whenever the other side
binds. Worked, with the ABK figures — a villa owner who has paid 20,000,000, so 15% = 3,000,000, and
the Villa NTB cap is 4,000,000:

| Interpretation | Result |
|---|---|
| +10% on both sides | min(3,300,000 · 4,400,000) = **3,300,000** |
| +10% on the cap only | min(3,000,000 · 4,400,000) = **3,000,000** |

A 300,000 difference on one applicant. The high-end override is worse: an Emaar apartment owner who
has paid 20,000,000 gets a cap of 2,000,000 (Apartment) or 4,000,000 (Villa) — **2,000,000 versus
3,000,000 final**, a 50% swing on whether one sheet line is applied to the cap.

**Decision:** every adjustment must declare its scope — `income` or `maxLoan` — and the admin form must
show which. Ask ABK to confirm the two lines above; do not infer them. Note that when an adjustment is
applied to *both* sides it commutes with `min`, so ordering is only ambiguous when the scope is.

---

### 10.5 The Arabic COMPOUND income formula — four readings, and the one question that settles it

The sheet writes, with a blank for the answer:

```
age 21–35:   اجمالي المدفوع / 12% / 48  =  ..........
age 35–65:   اجمالي المدفوع / 10% / 48  =  ..........
```

Three numbers and a result, with no operators. Worked out for a customer aged 30 who has paid
1,500,000, and for a fully-paid 5,000,000 unit, at the sheet's own 25% declining rate and a 50% DBR:

| Reading | Income, 1.5M paid | Implied loan, 96mo | Income, 5M paid | Implied loan, 96mo |
|---|---|---|---|---|
| **R1** paid × 12% ÷ 48 (literal) | 3,750 | 77,567 | 12,500 | 258,556 |
| **R2** paid ÷ 12% ÷ 48 | 260,417 | 5,386,594 | 868,056 | 17,955,313 |
| **R3** paid × 12% ÷ 12 (annual yield, monthly) | 15,000 | 310,268 | 50,000 | 1,034,226 |
| **R4** loan = paid × 12% × 4 years (no income step) | — | 720,000 | — | 2,400,000 |

Test each against the sheet's own finance table — *2M–5M unit → 1,000,000 · 5M–15M → 1,500,000 ·
above 15M → 2,000,000* — and against the sheet's own minimum, 30% of the unit value paid:

- **R1 is not credible.** A loan of 77,567 against a 1,500,000 stake, and the finance cap could never
  bind on any customer. A bank does not print a cap table that nothing can reach.
- **R2 is not credible.** An assumed income of 260,417 per month, and the cap binds for literally every
  applicant, which makes the income step pointless.
- **R3 fits the table remarkably well.** A fully paid 5,000,000 unit yields 1,034,226 against a cap of
  1,000,000 — the cap starts binding at exactly the top of its own bracket. That is what a coherent
  policy looks like. But it leaves the `48` unexplained.
- **R4 also fits** and explains the `48` as months (12% per year × 4 years = 48% of the amount paid),
  and it makes the program a pure ceiling product with no income step — which would then need
  `baselineDbrPercent` (§4, Q3). But it does not explain the *"احتساب الدخل"* (income calculation)
  heading the formula sits under.

R3 and R4 are both defensible and give answers 720,000 apart on the same applicant. **Do not pick one.**
Ask the bank exactly one question, which discriminates between all four:

> *A customer aged 30 has paid 1,500,000 towards a 5,000,000 unit. What monthly income do you assume
> for him, and what loan amount does he get?*

R1 → ~3,750 / ~78,000. R2 → ~260,000 / capped at 1,000,000. R3 → 15,000 / ~310,000.
R4 → no income figure quoted / 720,000. Any answer identifies the reading unambiguously. Get the
answer in writing before this program is configured; a bank sheet transcribed wrongly by a factor of
four is a regulatory problem, not a bug.

Also note this rule is **age-banded** (12% under 35, 10% over), so the income path needs an age-band
column, not a flat share. Age is derived from the national ID the app already collects, so it is a
derived fact, not a new question.

---

### 10.6 Rate type is worth 22–29% of the loan amount

The four Arabic sheets say `DEC` — declining balance. The ten ABK sheets print a bare percentage with
no basis stated. The prototypes default to **flat**. The same instalment produces very different loans:

| Tenor | Flat, 25% | Declining, 25% | Declining is higher by |
|---|---|---|---|
| 36 months | 205,714 | 251,510 | 22.3% |
| 60 months | 266,667 | 340,700 | 27.8% |
| 84 months | 305,455 | 395,075 | 29.3% |
| 120 months | 320,000 · (96mo) 413,690 | 439,574 | 28.2% |

(installment 10,000 per month in every row)

So mislabelling the basis misquotes the customer by roughly a quarter of the loan — in the direction of
offering more than the bank will approve, if flat sheets are treated as declining. **Confirm the
platform stores a rate basis per bank program.** If it does not, that is a prerequisite for this
feature, not an enhancement: every acceptance test in §13 that ends in a loan amount is meaningless
without it. Confirm the basis for each ABK program too — the sheets do not say, and 25.5% flat and
25.5% declining are different products.

---

### 10.7 Band edges — half-open, and the banks band differently

The sheets print overlapping bands: `3–5`, `5–8`, `8–11`. The prototypes resolve this as
**minimum inclusive, maximum exclusive**, so exactly 5 years lands in `5–8`. Adopt that, enforce it in
the band editor (no gaps, no overlaps, lowest row open below, highest open above), and print the
convention on the screen so no operator has to guess.

Two things not to "fix": ABK Doctors bands as `8–11 / 11–14 / 14–20 / 20+` while the Arabic DOCTOR
sheet bands as `8–12 / 12–15 / >15`. Different banks, not a transcription error. And ABK's two doctor
programs use the same bands with different figures (clinic owners 30K–300K, in-practice 15K–150K) —
also correct, they are two programs.

---

### 10.8 The four Arabic sheets are a **fifth** bank, not one of the four already seeded

No logo appears on any of them, but they are internally one set — identical layout, the same
`RATE x% DEC / FEES 2% DEC` box, the same document vocabulary — covering five products: compound,
doctor, professor, banker, salaried. And the compound sheet rules out all four known banks:

| Bank | Its compound rule | Arabic sheet |
|---|---|---|
| ABK | 15% of paid · purchase ≥ 18 months · rate 25.5% | 30% of unit value paid · ≥ 1 year · rate 25% DEC |
| EGBank | category AA–C · min paid 20/30/40% by unit price · min unit price by contract year | finance by unit price bracket · flat 30% paid rule |
| FABMISR | down-payment brackets · min age 30 · min DP 250,000 | age 21–65 · no DP floor |
| CAE | 50% of amount paid | share of paid, but age-banded 12%/10% |

**Do not seed these under a guessed name.** Ask whoever supplied the photographs; the attribution takes
one message and a wrong one contaminates every quote that bank makes. Distinctive detail if you need
to identify it: a *Banker* program at 20.5% for 1–5 years and 21.5% for 5–12 years, 12-year maximum
tenor, and quarterly / semi-annual / annual instalments alongside the monthly one — an unusual
combination.

Two internal contradictions on those sheets to resolve at the same time:

- **SALARIED rate box** reads `RATE > 5 YEAR : 23% DEC` and `RATE 5 < 8 YEAR : 24% DEC`. Those bands
  overlap and the cheaper rate is on the longer tenor, which is backwards from every other sheet in the
  set. Almost certainly `≤ 5 years → 23%`, `5–8 years → 24%`, but confirm rather than assume.
- **BANKER** allows a monthly instalment *plus two of* (quarterly, semi-annual, annual). The platform
  models one instalment stream. That is out of scope for this feature but it must be recorded, because
  a banker's DBR is computed against a payment pattern we cannot represent.

---

### 10.9 Lookup-list decisions (carried over, still open)

**Reuse or re-author.** Migration `20260827090000` deactivated `compound` and `compound_category` — off
every picker, off the values rail, label and parent axis intact. Their values were to be deleted by
`seed-collateral-products.ts#pruneRetiredDemoProducts`; that file was deleted the same day, so **the
prune never ran**. On any database where the old seed ran, 9 compounds and 3 classes are still there,
invisible. Either reactivate and reuse, or author fresh and clear the strays. `enumeration-type-edit.drawer.ts`
exposes neither `active` nor `onValuesRail`, so **reactivating is not an admin action today** — it needs
a small screen change or a one-off SQL step.

**Name collision.** A fresh list called "Compound" mints the key `compound_2`, because `uniqueSlug`
checks all type definitions and `definitions()` deliberately returns inactive kinds too. Keys are
**immutable**, so `compound_2` is permanent and appears in every bank's stored configuration.

**Five classes or three.** v18.2.0 deliberately collapsed AA/AB/A/B/C to A/B/C, arguing that "AA above
AB above A" is not an ordering anyone can infer unaided. §10.1 settles this: go back to **five plus
Other**, because the granularity rule requires the global list to be at least as fine as EGBank's
published list, and EGBank publishes five. Set `sortOrder` explicitly (AA = 1 … Other = 6) — the class
board derives tier ranking from it and will otherwise show creation order.

---

### 10.10 Data that is simply missing, and which bank it blocks

| Missing | Blocks |
|---|---|
| DBR % for CAE Teachers (both products — the sheet says only "as per retail risk policy") | the standard teacher product quotes 0 until filled |
| DBR % for FABMISR Al Ahly club | same |
| FABMISR compound: two illegible lines — *"Clear I-Score: 500K"* and *"Income will be derived according to down payment within 6 months"* | do not encode either; confirm with FAB risk |
| EGBank PL-to-card maximum tenor (not legible) | the tenor cap falls back to the program default |
| Rate basis (flat or declining) on all ten ABK sheets | every loan figure — §10.6 |
| Real I-Score band tables per bank | the design record's 80% / 100% / 110% is an illustration, not a bank's table. The prototypes all carry a single 100% "Standard" row, i.e. no bank has supplied one yet. |

None of these block building the feature. All of them block a bank going live, so collect them in
parallel with P1.

---

### 10.11 Additional-income weighting is required by a live sheet, not hypothetical

The first pass filed *"other income accepted, up to X% of the assumed income"* as a future gap. The
Arabic COMPOUND sheet asks for considerably more than that:

- rents counted at **50%**, conditional on the date being valid
- certificate (CD) returns counted at **75%**
- fixed allowances **100%**, variable allowances **75%**
- total additional income may not exceed **100% of the basic income**

That is a weighted-source table plus a cap, and the platform has neither. The prototypes have a single
`additionalIncomeCapPct` field, which covers only the last line. **Decision:** either scope the weighted
table into this feature, or accept that this bank's compound program will over- or under-state income
for any applicant with rental income — and record which. If it is added later, remember the cap is a
percentage of the **I-Score-adjusted** figure, not the raw table value.

---

## 11. Known gaps to keep out of scope

| | What a sheet asks for | Where we stand |
|---|---|---|
| 1 | *"Income is waived — no DBR check"* (predefined-limit products) | The engine still reduces a ceiling by existing debts; the prototypes do not. **Assumption taken: keep reducing it** — a loan the customer cannot pay is not one we should show. Flagged, not hidden. Affects CAE Teachers Predefined Limit (codes 0760-22/23) most directly. |
| 2 | *Other income accepted, up to X% of the assumed income* | **Escalated out of this table — see §10.11.** A live sheet needs weighted sources (rents 50%, CD returns 75%, allowances 100/75) plus the cap, not just the cap. Needs a decision, not a shrug. |
| 3 | *DBR 50% salaried / 40% self-employed* | Engine handles it; field unreachable. Separate small fix — §9. |
| 3b | *Max tenor 10 years salaried / 7 years self-employed* | Age limits already vary by employment type; tenor does not. |
| 4 | *New instalment must not exceed 50% of the existing car instalment* | Conditions can compare figures inside the calculation, but the new instalment is computed **after** it. Not expressible. |
| 5 | *No late payment in the last 6 / 12 months* | Fields exist and arrive from the app, but only the eligibility check reads them, and that check is skipped on the customer path today. |
| 6 | *Additional income rules* — merged into item 2 above and §10.11. |
| 8 | *Instalment patterns other than monthly* (BANKER: monthly plus two of quarterly / semi-annual / annual) | The platform models one instalment stream. A banker's DBR is computed against a pattern we cannot represent. Out of scope, but do not silently quote that program as monthly-only. |
| 7 | *Prohibited occupations list* — Arabic COMPOUND sheet | An eligibility exclusion list, not an income calculation. Separate feature. |

---

## 12. Housekeeping to fix along the way (small, but the screens look broken)

- `/surrogate-products` empty state tells the operator to run `npm run seed:surrogate-products` — a
  deleted script. Two more dead references: `product-rule-editor.component.ts:180` (`seed:collateral`)
  and `seed-program-catalog.ts:444`.
- Migration `20260827090000` calls a cleanup function in a file that no longer exists, so it never runs.
- `productRuleHasError` in `shared/income-rule/income-rule.rules.ts:183` is never called — dead code.
- **Adding what a product asks is create-only.** No way to fix a typo in a question, no way to delete
  one. `setBoundQuestion` has exactly one caller, inside that create. Add edit + delete.
- After adding an asked thing, the screen returns to *"How the income is worked out"* while its own
  comment says *"What it asks"* — off-by-one in the step number.
- Two names for one thing: `credit_card_total_limit` and `credit_card_limit`. Pick one.

---

## 13. Acceptance tests

Run each through the existing **Check** panel and match by hand against the sheet.

**Compile correctness**
1. Every shape S1–S7 built from the template list produces an `incomeRule` that passes the existing
   save-time validation **with no change to that validation**.
2. Same template, adjustments ticked in different orders → identical figure, to the piastre.
3. Removing a path no bank filled → allowed. Removing one a live bank filled → refused, error names
   that bank's programs.
4. *Advanced* on a product → friendly form switches off, screen says so, and going back to a template
   creates a **new** product.

**Worked figures**
5. **Armed forces (S1).** Major → 30,000 income → DBR 50% → 15,000/month capacity.
6. **Professors, ABK (S1).** Dean → 100,000. Junior staff → 12,000.
7. **PL-to-card, ABK (S3).** Competitor card limit 60,000 → income 30,000 → DBR 50% → 15,000/month.
8. **Compound, EGBank (S5 + parent walk).** Pick *Mivida* → class AA → 6,000,000.
9. **Compound, ABK (S7 + S5, min).** Paid 20,000,000 → 15% = 3,000,000; Villa NTB ceiling 4,000,000
   → result **3,000,000** (the lower).
10. **Compound, FABMISR (S6, two columns).** Down payment 1,200,000 → NTB 1,250,000 / X-SELL 1,750,000.
11. **CDs holder, ABK (S6).** CD 6,000,000 → 1,500,000. Same CD less than 3 months after issuance →
    10% of the CD = 600,000.
12. **Doctors clinic owners, ABK (S2).** Exactly 5 years → the `5–8` row → 60,000 (proves the
    half-open convention).

**I-Score**
13. Score answered → multiplier applied. Score **not** answered → 100%, quote unchanged.
14. **Band edge, I-Score before DBR.** Set `dbrBands` so the cap changes at 50,000. Applicant with a
    46,000 table figure and a 110% multiplier → 50,600, which must land in the **upper** band. If it
    picks the lower band, I-Score was applied after the cap was chosen.
15. A bank's I-Score table with a gap → refused at save.

**Lookups and import**
16. Import 300 compounds from CSV → dry-run preview correct, one transaction, zero unfiled.
17. A compound whose class column is blank or unknown → lands in **Other**, flagged in the preview.
18. A compound in **Other** still gets a quote, not a blank card.
19. The class board's unfiled warning reads clean after import.
20. A bank program missing a row for one class → **warning** on the product screen, save still allowed.

**Max-loan cap keyed by an answer (§10.2)**
21. **ABK 7 Doctors (Clinic Owners), the mixed case end to end.** 12 years in practice → income
    120,000 → DBR 50% → 60,000/month capacity → a DBR-derived loan well above 1,500,000; applicant in
    Cairo, NTB → capped at **1,500,000**. Same applicant in Tanta → capped at **500,000**.
22. **Arabic SALARIED — cap with no surrogate rule at all.** Real payslip income, company coded CAT B
    → capped at 1,000,000. Proves the cap works when there is no template to hang a path on.
23. **`onNoMatch`.** An answer with no row in the cap table → falls back to the program maximum, and
    never to "no cap" or to zero. Assert both failure directions explicitly.
24. **Cap versus min, same answer (§10.2).** Configure ABK 2 both ways — as two template paths with
    `minOf`, and as one rule plus a cap table — and assert the two produce the same figure to the
    piastre. If they diverge, the monotonicity argument has been broken somewhere downstream.

**Per-bank classification (§10.1)**
25. **Two banks, one class list, different groupings.** EGBank prices AA/AB/A/B/C separately; ABK
    prices AA and AB at the villa figure and A/B/C at the apartment figure. Same customer, same
    compound (*Mivida* → AA), both banks quote their own correct figure from the one global list.
26. **Class split procedure.** Add a finer class, re-file compounds onto it, and assert: the save is
    refused while another bank still has a figure on the retiring class, the warning names that bank,
    and no customer receives a blank card at any point in the sequence.

**Adjustment scope (§10.4)**
27. An adjustment declared `income` and the same adjustment declared `maxLoan` produce different
    figures when the other side binds — 3,000,000 versus 3,300,000 on the §10.4 worked case. Assert
    both, so the scope is pinned by a test rather than by whoever configures it.

**Rate basis (§10.6)**
28. The same program, same instalment capacity, flat versus declining → the loan differs by 22–29%
    across 36 to 120 months. Assert the platform stores and applies the basis per bank program; a test
    that passes under either basis is not testing anything.

---

## Appendix A — ABK Egypt programs (from the ten sheets)

Common to all ABK sheets unless stated: DBR 50%; stamp duty 0.50%; life insurance 0.50% per year
(optional); late payment 4.00% + loan rate; pay-off 12% cash / 15% buy-out; documents = application,
NID copy, utility bill. Where a sheet says *"additional 2% added if waiving admin fees and stamp duty
for tenors 3 years and above"*, that is a pricing rule, not an income rule.

### 2 — Compound Owner
Tenor 1–7 y · Age min 21 salaried / 25 self, max 60 salaried / 65 self · Loan min 15,000 ·
Rate 25.5% (+2% waiver rule) · Admin 2.50%.
Criteria: 15% of (down payment + honoured instalments); contract under customer's name; property
purchase date not less than 18 months.

| Type | NTB | Top-up |
|---|---|---|
| Apartment | 2,000,000 | 3,000,000 |
| Twin / Town House | 3,000,000 | 3,500,000 |
| Villas | 4,000,000 | 4,500,000 |

Loan amounts +10% if the applicant provides more than one qualifying residential unit. Initial unit
contract verified by FRMU with the developer (ownership, contractual price, paid amount,
delinquencies). The 18-month condition is waived for fully settled / cash units, where ownership must
be at least 6 months. Applicants owning apartments in "high end compounds" (Emaar, New Giza, Sodic
etc., list approved by Retail Risk) get the **Villa** maximum instead of the Apartment row.
Documents also: ownership contract in the customer's name, contractual price, paid-amounts verification.

### 3 — Liabilities Cross Sell (CDs Holder)
Tenor 1–7 y · Age min 21 salaried / 25 self, max 60 / 65 at maturity · Loan min 15,000 ·
Rate 24% · **Admin 0%**.

| CD tier | Max loan |
|---|---|
| Less than 2M | 500,000 |
| Less than 5M | 1,000,000 |
| Less than 10M | 1,500,000 |
| 10M and above | 2,000,000 |

Caps apply only three months after CD issuance; before that, maximum 10% of the CD amount. Day-one
facility for customers holding CDs of at least EGP 1M. Assumed income base = 30% of the collateral's
free amount, with a minimum of 50,000 **or** 10% of total customer deposits, whichever is less.

### 4 — PL Cross Sell to Auto Loan, Other Banks
Tenor 1–7 y · Loan 15,000–400,000 · Rate 26.5% · Admin 2.5%.
Income = 3 × the car instalment **or** 10% of the auto loan amount, **whichever is less**.
Customer's loan should exceed 50% of its tenor with a minimum of 12 paid months; the existing loan at
the other bank booked with at least 40% down payment; good performance (never BKT1 in the last 6
months, never BKT2 in the last 12); the new PL instalment must not exceed 50% of the existing auto loan.

### 5 — PL Cross Sell to Auto Loan at ABK
Tenor 1–7 y · Loan 15,000–750,000 · Rate 26.5% · Admin 2.5%.
Must be current; never hit BKT1 in the last 6 months; never BKT2 in the last 12. PL instalment must
not exceed 50% of the auto loan instalment. Loan amount based on the auto loan program. When
cross-selling, the original program's MCE and tenor are kept — e.g. a cross-sell to a 40%-down-payment
Exotic keeps an 84-month tenor and an MCE of 3 million regardless of the approved tenor.

### 6 — PL Cross Sell to Credit Card, Other Banks
Tenor 6 months – 10 y salaried / 7 y self · Age min 21 salaried / 25 self, max 60 / 65 ·
Loan 15,000–750,000 · Rate 28.5% (admin fee waived for programs priced at 28.5%+ subject to a minimum
tenor of 3 years) · Admin 2.50%.
**Net monthly income = half the competitor bank's credit card limit.** Card must be unsecured and held
by the applicant for at least 6 months per the I-Score report. Multiple cards cannot be combined; use
the card with the highest limit that meets the holding-period condition. Customer must meet ABK-Egypt's
delinquency criteria for all outstanding unsecured.

### 7 — Doctors (Clinic Owners)
Tenor 1–10 y · Age min 32, max 65 at maturity · Loan min 15,000 · Rate 26.5% · Admin 2.50% ·
Minimum 3 years in business.
Max loan: Cairo & Alex — NTB 1.5M, Top-up 2M. Other cities — NTB 500K, Top-up 750K.

| Years in practice | Income |
|---|---|
| 3–5 | 30,000 |
| 5–8 | 60,000 |
| 8–11 | 80,000 |
| 11–14 | 120,000 |
| 14–20 | 180,000 |
| 20+ | 300,000 |

Doctors operating in main areas (New Cairo, Sheikh Zayed, Misr Gedida etc.); in prime polyclinics with
a minimum of one slot per week, verified through the polyclinic call centre; coded in Vezeeta for other
cities. Documents also: valid syndicate ID (كارنية النقابة), medical facility operating license
(رخصة تشغيل منشأة طبية), certificate of professional practice (شهادة مزاولة المهنة).

### 8 — Doctors (In Practice)
Tenor 1–10 y · Age min 21, max 60 at maturity · Loan 15,000–1,000,000 · Rate 30% · Admin 2.50% ·
Minimum 3 years in business · Private hospitals only, not governmental.

| Years in practice | Income |
|---|---|
| 3–5 | 15,000 |
| 5–8 | 30,000 |
| 8–11 | 40,000 |
| 11–14 | 60,000 |
| 14–20 | 90,000 |
| 20+ | 150,000 |

Documents also: proof of employment with years of experience.

### 10 — University Professors
Tenor 6 months – 5 y · Age min 21, max 60 at maturity · Loan 15,000–500,000 · Rate 25.5% · Admin 2.50%.

| Position | Income |
|---|---|
| Dean — عميد | 100,000 |
| Professor & Section Head — أستاذ ورئيس قسم | 75,000 |
| Professor — أستاذ | 50,000 |
| Assistant Professor — أستاذ مساعد | 40,000 |
| Teacher — مدرس | 30,000 |
| Assistant Teacher — مدرس مساعد | 20,000 |
| Junior Staff — معيد | 12,000 |

Documents also: stamped and signed letter from the university stating employment grade and date of hiring.

### 11 — Egyptian Armed Forces
Tenor 6 months – 10 y · Age min 21, max 60 at maturity · Loan 15,000–500,000 · Rate 25% ·
**Admin 2%** · Minimum 3 months in business.

| Grade | Assumed income |
|---|---|
| Major General — لواء | 75,000 |
| Brigadier General — عميد | 60,000 |
| Colonel — عقيد | 45,000 |
| Lieutenant-Colonel — مقدم | 40,000 |
| Major — رائد | 30,000 |
| Captain — نقيب | 28,000 |
| First Lieutenant — ملازم أول | 18,000 |

Documents also: military ID; a copy of the armed forces ID bearing "original seen".

### 17 — Football Player
Tenor 1–5 y · Age 21–35 · Loan 15,000–500,000 · Rate 31% · **Admin 1.50%** ·
Minimum 6 months in business.
Must have played for the club for at least 6 months; the club must be a Class 1 club (Egyptian
premier league — الدوري الممتاز). Documents also: a valid contract, verified by FRMU prior to approval.

---

## Appendix B — other banks (as seeded in the prototypes)

### Compound owner — four banks, four mechanisms, one product
| Bank | Mechanism |
|---|---|
| CAE | Loan = **50% of the amount paid to the developer** (a formula, not a table) |
| FABMISR | Ceiling by **down-payment bracket × NTB / X-SELL** |
| EGBank | Ceiling by **compound category AA/AB/A/B/C** |
| ABK | 15% of paid **and** a property-type ceiling — take the lower |

**CAE.** Loan 50,000–3,000,000 · tenor 6–84 months · Employed age 21 / max 60 at maturity, DBR 50%;
Self-employed age 25 / max 65, DBR 40%. Self-employed also: minimum 2 years in business, 100,000
paid-in capital, 6-month credit history, no scoring cut-off exceptions. Owning two units across
different compounds still gives one loan only; joint ownership needs dual approval and the maximum is
shared across owners. Program codes: Employed 0771, Self-Employed 0772.

**FABMISR.** Min age 30 · tenor 6–72 months (84 with product-head sign-off for cross-sell) ·
minimum income salaried 10,000 / self-employed & professional 15,000 · minimum down payment 250,000 ·
property inside prime developer compounds, contract not older than 10 years except cross-sell ·
X-SELL tier requires the client to hold only a credit card with a minimum 100,000 limit ·
FCU verification on the property contract · jointly-owned (husband & wife) accepted at 50% of imputed
income and 50% of the loan amount.

| Down payment paid | NTB | X-SELL |
|---|---|---|
| 250K – 500K | 750,000 | 1,250,000 |
| > 500K – 1M | 1,000,000 | 1,500,000 |
| > 1M – 1.5M | 1,250,000 | 1,750,000 |
| > 1.5M | 1,500,000 | 2,000,000 |

Two lines were not fully legible on the source photo and must be confirmed with FAB risk before use:
*"Clear I-Score: 500K"* and *"Income will be derived according to down payment within 6 months."*

**EGBank.** Loan 100,000–6,000,000 · age 21 / max 60 · tenor 6–84 months · DBR 50% ·
minimum income salaried 10,000 / self-employed & professional 25,000.

| Category | Max loan |
|---|---|
| CAT AA | 6,000,000 |
| CAT AB | 5,000,000 |
| CAT A | 4,000,000 |
| CAT B | 3,000,000 |
| CAT C (catch-all) | 2,000,000 |

Minimum unit price by contract date: 2024+ → 3M; 2023 → 2.5M; 2022 → 2M; 2021 → 1.5M; before 2021 →
1M. Minimum paid share of unit price: 20% for units ≥ 15M (minimum 3 instalments paid, may include the
maintenance deposit); 30% for units ≥ 10M; 40% otherwise. Income = per credit policy where documents
exist, or scorecard + CPV where they do not, whichever is lower. **CAT C is the catch-all** for
compounds not listed in A/B; developers listed nowhere go to the Fraud Department case by case.
(This is the same argument as the `Other` class in §8.4 — do not leave a compound unfiled.)

### PL to card
**ABK** — as Appendix A program 6. **EGBank** — the card limit sets a direct loan ceiling, tiered:

| Competitor card limit | Salaried | Self-employed & professionals |
|---|---|---|
| ≥ 25K (to 100K) | 750,000 | 500,000 |
| ≥ 100K | 1,000,000 | 750,000 |

Requires an unsecured competitor card with a minimum 25,000 limit and good repayment history over at
least 6 months. Income floor as an eligibility gate: salaried 10,000, self-employed & professionals
25,000. Maximum tenor was not legible on the source sheet.

### Teachers — CAE, two products
**(A) Predefined Limit** (codes 0760-22 international / 0760-23 national) — income fully waived,
direct ceiling by stage × school type:

| Stage | International | National |
|---|---|---|
| Primary | 200,000 | 100,000 |
| Preparatory | 400,000 | 200,000 |
| Secondary | 600,000 | 300,000 |

**(B) Teacher standard** (codes 0759-17 / 0759-18) — ceiling by school type (national 500,000,
international 750,000) **and** a real income / DBR check "as per retail risk policy" — take the lower.
The DBR percentage was not shown on the sheet for either product; it must be filled in before the
standard product can quote. International school definition: American diploma, international
Bachelor, or IGSE following an international curriculum. Predefined-Limit excludes certain subjects
(art & music, industrial / agriculture & home economics, manners & religion, physical exercise &
computer, human development, geology & environmental science / psychology / philosophy / geography)
and certain school types (military, commercial, agriculture, hospitality, special needs).

### Club membership — FABMISR (Al Ahly)
Loan 20,000–750,000 · min age 25 · tenor 6–72 months · LOS 3 months · Egyptians and foreigners.
Two checks apply together, **take the lower**: the branch ceiling, and a standard DBR check against
the customer's real declared income.

| Branch | Max loan | Minimum down payment |
|---|---|---|
| New Cairo | 750,000 | 85,500 |
| Sheikh Zayed | 510,000 | 85,500 |
| Main | 160,000 | 256,500 |

Credit card / Murabaha maximum limit 100,000. DBR percentage not shown on the sheet. Adding Zamalek,
Gezira, Heliopolis etc. is more rows, not more code.

---

## Appendix C — the four unlabelled Arabic sheets

**Bank not identified on any of these — see §10.8. Rates are quoted `DEC` (declining balance) — see §10.6.**

### COMPOUND — rate 25% DEC, fees 2% DEC
Documents: national ID; proof of work (employee or business owner); copy of the unit contract; proof
of payment of the last due instalment; utility bill (electricity / water / gas) — a utilities contract
document may be accepted where the customer's details are not clear on the receipts; if the ID address
matches the vehicle licence address shown in I-Score, the utility bill can be waived.

Conditions: age 21–65; all instalments due to date paid, up to the last due instalment; at least 30%
of the unit value paid including the down payment (contract payment); at least one year elapsed since
the unit contract date.

Income calculation, **as written on the sheet** (ambiguous — four candidate readings worked out in §10.5):
- age 21–35: `اجمالي المدفوع / 12% / 48`
- age 35–65: `اجمالي المدفوع / 10% / 48`

Finance amount by unit price: 2M–5M → 1,000,000 · 5M–15M → 1,500,000 · above 15M → 2,000,000.

Prohibited occupations: servant, property guard, butcher, gardener and similar craftsmen and
tradespeople; self-employed lawyer, car broker, car rental, housewife; tourism companies except large
multinationals and hotels affiliated with the police and army; real-estate marketing and security
companies except the major companies and marketers. Loan insurance free, no medical examination.

Additional income: rents 50% of it subject to date validity; certificate returns 75%; additional
income may not exceed 100% of basic income; fixed allowances 100%, variable allowances 75%.
(No structure for this exists — §11 item 6.)

### DOCTOR — rate 24% DEC, fees 2% DEC
Employees or clinic owners. Covers human medicine, dentistry, laboratories and radiology, medical
centres. Age 21–65. Minimum clinic duration 2 years. Maximum repayment 6 years for clinic owners,
8 years for employees. Documents: national ID, syndicate card, clinic licence approved by the
doctors' syndicate / health affairs directorate.
Governorate tiers — **major**: Cairo, Giza, Alexandria, Assiut, Minya, Qalyubia, Gharbia, Dakahlia.
**Other**: everything else.

| Years of experience | Income, major | Income, other | Finance, major | Finance, other |
|---|---|---|---|---|
| 2–5 | 42,500 | 32,000 | 250,000 | 200,000 |
| 5–8 | 81,000 | 60,000 | 300,000 | 250,000 |
| 8–12 | 134,000 | 100,000 | 500,000 | 350,000 |
| 12–15 | 195,000 | 150,000 | 750,000 | 500,000 |
| above 15 | 320,000 | 240,000 | 2,000,000 | 750,000 |

### PROFESSOR — rate 24% DEC, fees 2% DEC
Documents: national ID, university card, statement of academic degree. All government and private
universities except institutes. Maximum repayment 6 years. Housing verification only. If the academic
degree is stated on the national ID, no separate statement is needed.

| Academic degree | Income, gov | Income, private | Finance, gov | Finance, private |
|---|---|---|---|---|
| معيد — teaching assistant | 12,000 | 20,000 | 200,000 | 250,000 |
| مدرس مساعد — assistant lecturer | 20,000 | 30,000 | 250,000 | 300,000 |
| مدرس — lecturer | 35,000 | 50,000 | 350,000 | 400,000 |
| أستاذ مساعد — assistant professor | 50,000 | 75,000 | 450,000 | 500,000 |
| أستاذ — professor | 100,000 | 150,000 | 600,000 | 750,000 |
| عميد / نائب عميد — dean or vice-dean | 150,000 | 300,000 | 1,000,000 | 1,000,000 |

### BANKER — admin expenses 2%
Documents: national ID; salary certificate or stamped payroll details; 3-month bank statement,
stamped and signed, A + B. No housing or work verification.
The customer may hold a monthly instalment plus 2 of (quarterly / semi-annual / annual) — i.e. three
instalment types, of which monthly is the base. Maximum repayment 12 years.
Interest: 1–5 years → 20.5% · 5–12 years → 21.5%.

### SALARIED — rates 23% DEC (over 5 years) / 24% DEC (5–8 years, as written) · fees 2% DEC
The two rate lines on the sheet overlap oddly ("> 5 YEAR" and "5 < 8 YEAR") — confirm before encoding.
Documents: national ID; stamped payroll details; 3-month bank statement stamped and signed A + B;
housing verification required, which can be skipped with a recent utility bill (water / electricity /
gas); work verification required except for the judiciary, diplomatic corps, police, army and
prosecution. Monthly instalment only. A loan without salary transfer is available only for companies
coded at the bank (A + B + C + D). Maximum repayment 9 years.

| Company coding | Max available |
|---|---|
| CAT A | 6,000,000 |
| CAT B | 1,000,000 |
| CAT C | 500,000 |

---

## Appendix D — implementation order

| Phase | Work | Gate to the next phase |
|---|---|---|
| **P0** | Answer every decision in §10. Confirm the rate basis (§10.6) and get the one COMPOUND-formula question answered (§10.5). Fix the `dbrCapPercentByEmploymentType` DTO gap (§9). Clear the §12 dead references. | Decisions written down, in writing, from the banks where a bank owns the answer |
| **P1** | **The fact-keyed max-loan cap (§10.2)** — DTO field, wizard editor, application in `quote.ts` after the DBR-derived loan, `onNoMatch` explicit. | Tests 21–24. This moves ahead of the template layer: nine of the sheets need it, three of them have no rule to hang a path on, and it removes template paths rather than adding them. |
| **P2** | Template schema, compiler, deterministic keys, orphan-refusal diff, migration + JSON column. Adjustment `scope` (§10.4). Separate relationship questions (§10.3). | Tests 1–4, 13–15, 27. Compiler output passes existing save-time validation unchanged |
| **P3** | Admin: "start from…" list, template form (saved, reopenable), per-bank figure grid, warnings, Advanced one-way. | Tests 5–7, 28 reproduce sheet figures by hand |
| **P4** | Paste-a-list / CSV import with dry-run preview, on the values panel. | Tests 16–17 |
| **P5** | Class list built to the §10.1 granularity rule, `sortOrder` explicit, `Other` real, split procedure documented and warned. Compounds imported. Seed the reference programs from Appendices A–B as data, not code. | Tests 8–12, 18–20, 25–26 |

P4 is not optional and not deferrable: without it, entering every compound in Egypt is one drawer at
a time, and P5 cannot be completed.

Two ordering notes, both from §10. The cap work moved to P1 because it is the mechanism nine sheets
actually describe, and because building the template layer first would encode several products as
"two paths, take the lower" that then have to be un-built. And the class list moved to last, after the
warning in §5.6 exists, because a class list built before that warning can be split destructively with
nothing to stop it.

---

## Appendix E — what was built, and the decisions taken (2026-09-01)

Added after the implementation pass. Everything above is the spec as received; this section
records what is now in the code and which of its open questions were answered.

**Built.**

| § | What | Where |
|---|---|---|
| 10.6 | Rate basis per bank program — `reducing` (default, what every stored program was priced at) or `flat`. Both directions of both formulas live in `pmt.ts`; `dbr.ts` no longer carries its own annuity inverse. Frozen on the offer (`bank_offer.rateBasis`, nullable, no backfill). | `matching/pipeline/rate-basis.ts`, `pmt.ts`, `dbr.ts`, `product-rule-ceiling.ts`, `quote.ts`, migration `20260901090000` |
| 10.3 | Three per-bank axes instead of one: `bank_relationship` (known here), `loan_is_topup`, `holds_other_product`. Each is a bank-listed MULTI_SELECT question and a derived fact; each spells its own branch codes so a template keyed on one cannot be repointed at another. | `matching/pipeline/bank-relationship.ts`, `seed-questionnaire.ts` |
| 8 | Opening a `.csv` fills the paste box (BOM stripped, CRLF normalised) and the values panel writes the same three columns back out. One parser for both, and the export carries no quoter because the parser has none. | `paste-values.form.ts`, `lookup-values-panel.component.ts` |
| 10.1 | Governorates filed under three `city_tier` classes, cut so BOTH banks' groupings are unions of whole classes. A `property_governorate` fact reads it through `factParentTable`. | migrations `20260901120000`, `20260901123000` |
| 10.11 | Weighted additional income: a percentage per source and a ceiling as a share of the basic figure. Applied after the rule (I-Score included) and BEFORE the debt-burden band is chosen, so a figure that crosses a band edge is capped on the band it lands in. | `matching/pipeline/additional-income.ts`, `quote.ts`, `income-assumption-config.dto.ts` |
| 12 | The stale migration comment corrected; "Edit the wording" on a product's ask now deep-links to that question (`/questionnaire/questions?q=<code>`). | `20260827090000/migration.sql`, `questionnaire-editor.page.ts` |

**Decisions taken.**

- **`credit_card_total_limit` vs `credit_card_limit` stay as they are.** They are not two names
  for one thing: the first is a QUESTION code, the second a FACT key, joined by
  `boundQuestionId`. Renaming the fact key would orphan every stored rule that names it —
  the §5.4 failure mode this whole feature exists to prevent — for a cosmetic gain.
- **Additional income does not touch a CEILING product.** A ceiling is what the collateral
  supports, not an opinion about what the applicant earns; rental income does not make a unit
  bigger. Income products only.
- **The additional-income policy is per BANK and never inherited from the catalog.** Two banks
  selling one product weigh rent differently, so it rides on `amounts: 'catalog'` too.

**Found by exercising it, not by reading it.** `stripForeignMethodConfig` whitelists what
survives a save, so the first working policy was silently discarded: the request succeeded, the
screen showed the weights, and the stored program counted none of them. Fixed, then every
refusal (`unknown_fact` · `not_numeric` · `percent_out_of_range` · `cap_out_of_range` ·
`duplicate_source`) exercised over HTTP against a real database.

**Still open, and still needing a bank.** §10.5 (which of the four readings the Arabic COMPOUND
formula means), §10.8 (which bank owns the four unlabelled Arabic sheets), §10.10 (the missing
DBR percentages, FABMISR's two illegible lines, EGBank's PL-to-card tenor, and the rate basis on
each of the ten ABK sheets — the mechanism now exists, the per-sheet answer does not).
