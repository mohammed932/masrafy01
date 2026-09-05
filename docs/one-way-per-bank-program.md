# One way per bank program

## Context

A surrogate-income product may state several **ways** to reach the figure. `compound_owner` now
states five (class table · down-payment bracket · share of everything paid · unit type · share of the
down payment), because four banks sell the same guarantee off four different mechanisms.

Nothing makes a bank program pick one. A program fills whatever way slots it likes and the compiled
rule folds every filled way with `minOf(skipUnset)` — two filled ways silently become "the lower of
the two". On the live database all four compound programs already fill exactly one way, so the rule the
operator wants **holds by convention and is unenforced**. Two consequences today:

- A program can be created that quotes the lower of two mechanisms no sheet pairs, and nothing says so.
- `amounts: 'catalog'` is worse. Inheritance is **whole-key**: `effectiveIncomeRule` deletes the bank's
  `stepParams` and assigns the catalog's entire map, with no per-slot merge anywhere. `compound_owner`'s
  catalog defaults fill **four** way heads, so a catalog-amounts bank would quote
  `min(class table, down-payment bands, 15% of paid, unit-type table)`. Latent only because all 13
  surrogate programs are `amounts: 'own'` — measured, not assumed.

Outcome wanted: when a bank program selects a surrogate product, it selects **exactly one way**, types
figures for that way only, and quotes off it.

### The exception this must not break

`auto_loan_crosssell` is a two-way product where **one program legitimately fills both**:
App. A §4 — *"Income = 3 × the car instalment **or** 10% of the auto loan, whichever is less."*
`ABK-PER-AUTO_XSELL_OTHER` and `ABK-PER-AUTO_XSELL_ABK` both store `primary` + `alt` today, and spec
§10.2 keeps that case in the rule on purpose ("Keep `minOf` for the genuine same-unit cases").

A global rule would also refuse `npm run seed:sheet-figures` and break **nine named tests** whose whole
subject is several ways at once — including `blueprint-sheet-figures.spec.ts` *"takes the LOWER when a
bank fills two ways"*, which is spec acceptance case §13.9, a bank sheet rather than a fixture. The
`skipUnset` flag and `emitBasis`'s `minOf`+`coalesce` pair exist **specifically** to make it work.

Both products carry `combine: 'lower'`, so the existing field cannot tell the two situations apart.

**Decided with the operator:** declared **per product**; chosen **per bank program**; the other ways'
figures **deleted on save**; changing the way later is allowed and **warns first**, naming what is lost.

## Approach

### 0. This plan lands in the repo

Copied to **`docs/one-way-per-bank-program.md`**, beside
`docs/surrogate-income-templates-implementation-spec.md`, which it extends (§4 Q2, §10.2).

**BUILT. What follows is the plan as approved; the section at the foot records where the build
disagreed with it and why.**

### 1. The product declares that its ways are alternatives

`ProductTemplate` gains one optional field in
[product-template.ts](backend/src/matching/pipeline/product-template.ts):

```ts
waysAre?: 'exclusive' | 'combined'
```

- **Absent reads as `'combined'`** — every stored template predates the field and today's behaviour
  folds all filled ways. Absence must not change a stored meaning (§5.4).
- `compound_owner` declares `'exclusive'`; `auto_loan_crosssell` declares nothing.
- Refused by `validateTemplate` on a one-way template (new `ways_are_not_applicable`), matching the
  posture of the neighbouring `skip_unset_not_applicable` / `branch_on_not_applicable`: a flag that
  decides nothing reads as a constraint somebody trusts.
- `combine` is **kept** on exclusive products, as defence in depth rather than policy: with `combine`
  absent `emitBasis` emits a bare `coalesce`, so a row that somehow holds two ways (a hand-edited blob,
  a figure written before the refusal shipped) would quote the FIRST way silently, where
  `minOf(skipUnset)` quotes the lower. It orphans nothing either way — no program stores a
  `basis_combine` entry — so this is a behaviour choice, not a migration constraint.

### 2. The bank program names its way

`IncomeAssumptionConfig` gains `wayId?: string` — the way's **slot id** (`primary` · `alt` ·
`alt__<fact>`), never an index: indexes are positional and reordering is forbidden, while a slot id is
already the prefix every figure is filed under.

**A new optional field needs four edits, not one**, or it is silently dropped — the
`dbrCapPercentByEmploymentType` / `maxLoanByFact` / `additionalIncome` trap, three times over:

1. [income-assumption-config.dto.ts](backend/src/bank-programs/dto/sub-configs/income-assumption-config.dto.ts)
   — `forbidNonWhitelisted: true` rejects an undeclared field at the pipe.
2. `stripForeignMethodConfig`'s `keep` object
   ([income-rule.validator.ts](backend/src/bank-programs/validation/income-rule.validator.ts)) — it
   **rebuilds** the config rather than deleting from it, so an omitted field persists as nothing while
   the screen shows a choice the database never took. This is exactly how `additionalIncome` was
   silently discarded on every save.
3. `IncomeAssumptionConfig` in [types.ts](backend/src/matching/types.ts).
4. `normalizeIncomeAssumption` ([income-rule-normalize.ts](backend/src/matching/pipeline/income-rule-normalize.ts)),
   which runs after the strip in `persistableIncomeAssumption`.

Guard it with a DTO-metadata regression test, copying
[dbr-cap-by-employment-dto.spec.ts](backend/test/unit/dbr-cap-by-employment-dto.spec.ts) — the test that
exists because that field was unreachable for two versions.

**Why stored and not derived.** The repo's posture is that a fact derivable from the rule is never
stored (`optionalStepIds`: *"a stored 'optional' flag beside a coalesce would be a second statement of
the same fact, free to disagree"*). Deriving the way from "which head has figures" fails three ways,
one fatally:

- **Fatal:** a bank on `amounts: 'catalog'` stores **no `stepParams` at all** — `stripInheritedAmounts`
  deletes the whole key at persist, so the row is `{strategy, amounts, policy}`. There is nothing local
  to derive from, and it is precisely the case that needs a choice (the catalog fills four).
- The wizard must render the picker *before* any figure exists.
- "Which box did you type in" is a consequence; "which way does this bank sell" is a decision. Storing
  the decision is what lets the save refuse the figures that contradict it.

### 3. Enforced at save, beside the rule that already counts ways

The *at-least-one* half already exists: the `coalesce_empty` loop
([income-rule.validator.ts:456-493](backend/src/bank-programs/validation/income-rule.validator.ts#L456-L493))
refuses a program that declines every derivation. The *at-most-one* half belongs beside it, and must
**reuse that loop's recursive `reaches` helper, never `isStepConfigured` directly** — the file documents
why: `isStepConfigured` answers `true` unconditionally for `pickByFact`, and `compound_owner`'s way
heads all sit behind picks, so a naive check reads every way as filled and refuses all four live
programs.

Gated on **`figuresRequired === true`**, which is already the "bank completeness vs catalog structure"
axis. That single gate exempts, for free: the catalog name write, the raw step editor, the template
compile, `seed:blueprints` and `seed:sheet-figures` (all four pass `figuresRequired: false`). It does
apply to the admin rule-CHECK endpoint, which is correct — the panel must not reassure an operator
about a configuration the save is about to refuse.

| condition | outcome |
|---|---|
| exclusive product, ≥2 ways, no `wayId` | **new code** `PROGRAM_INCOME_WAY_REQUIRED` (422), meta `{productKey, wayIds}` |
| figures present for a way that is not the chosen one | **new code** `PROGRAM_INCOME_WAY_CONFLICT` (422), meta `{wayId, alsoFilled, count}` |
| `wayId` names no way of this product | `PRODUCT_RULE_INVALID` reason `way_unknown` |
| `wayId` on a combined product | `PRODUCT_RULE_INVALID` reason `way_not_applicable` |
| chosen way blank and nothing else filled | already `coalesce_empty` — no new rule |

**Why two new codes and not four reasons.** `PRODUCT_RULE_INVALID` renders as *"This product's
calculation steps are not complete: {reason}"* — the raw token is interpolated, there is no per-reason
dictionary anywhere, and `check:codes` checks codes only, so a 25th reason would silently ship the
English token `way_not_chosen` into the Arabic UI (Principle III / A2). The two conditions an operator
actually hits get real sentences and different actions ("pick one" → the picker; "clear these" → names
which). The two that only a hand-built request can reach stay reasons, where the existing rawness is
pre-existing debt rather than new debt. Both new codes need entries in `error-codes.ts`, both
dictionaries (227 → 229) and a typed exception in `domain.exceptions.ts`; `count` goes in the meta
because the message reads as a count and an interpolated array renders `"ABK-1,CIB-2 program(s)"`.

**The engine changes nothing.** `emitBasis`'s `minOf(skipUnset)` + `coalesce` over exactly one filled
way already returns that way's figure — `reduceRefs` skips the unset members, folds the one that
resolved, and the coalesce returns it. The invariant lives where it can be explained to an operator.

**No grandfather flag.** The two shapes this repo uses — an `opts` skip computed from `existing` vs
`dto` (`assertProgramNameKey`, `assertIncomeProofMatchesName`) and the same refusal re-run
ungrandfathered in `assertActivatable` — are deliberately **not** needed here, because the backfill in
§7 makes every existing row compliant before the refusal ships. Stated rather than assumed: the
migration RAISEs if it finds a row it cannot make compliant, which is the signal to add the flag.

### 4. Persist strips the ways the program did not choose

One pure helper beside the template's other slot functions:

```
wayOwnedSlots(template, wayId) → the way head, its column variants (`<head>__<branch>`), its pick slot
```

**A way is not one slot, and this is the trap.** With `secondColumn` set — `compound_owner` has one —
`emitMechanism` returns the *pick* id, so `basis_combine`'s members are `primary_pick`, `alt_pick`,
`alt__<fact>_pick`, and a way counts as filled when **either** column is. FABMISR stores `alt` **and**
`alt__top_up`: one way, two columns. An enforcement that counted `stepParams` keys would refuse the one
program that is already correct.

Applied in `persistableIncomeAssumption` ([bank-programs.service.ts](backend/src/bank-programs/bank-programs.service.ts)),
the single place the persisted blob is built, as a fifth stage after `stripCatalogStructure`. Dropped:
every other way's head, columns and pick. **Kept:** `cond__*` and `cond__*__bound`, `share` / `share_on`
/ `uplift` / `uplift_on`, the I-Score slots, `src__*`, `basis*`. Also drop the matching
`valueSources` markers, whose paths embed the slot id — an estimated-value marker pointing at a slot
that no longer holds a figure is the same dangling-marker class `20260823130000` had to re-root.

This is what makes "delete on save" true rather than decorative: a stored figure nothing reads is the
drift `unknown_param_key` already exists to refuse.

### 5. Catalog inheritance is pruned to the chosen way

In [income-rule-inherit.ts](backend/src/matching/pipeline/income-rule-inherit.ts), `effectiveIncomeRule`
prunes the inherited map to `wayOwnedSlots(...) ∪ {non-way slots}` when the program names a way.
`amounts: 'catalog'` then means *"use the catalog's figures for my way"* — the only reading that matches
a sheet. The catalog's **conditions still arrive**: that is the existing documented bargain ("a bank on
`amounts: 'catalog'` has said sell this product as the catalog configures it") and this change must not
quietly revoke it.

### 6. Admin — a prerequisite fix, then the choice where the figures are

#### 6a. The wizard cannot see a product's rule at all — fix this first

Measured, not inferred: **all eight linked catalog names carry `incomeRule = NULL`**, because the rule
lives on the surrogate product since v18.4.0. The backend says so on the way out — `incomeRule: null`
plus the rule under `surrogateProduct.incomeRule`
([bank-programs.service.ts:2088-2107](backend/src/bank-programs/bank-programs.service.ts#L2088-L2107)).
The catalog page does the fallback
([program-name-detail.page.ts:2617-2620](admin/src/app/features/program-catalog/program-name-detail.page.ts#L2617-L2620));
**the wizard does not**, at all seven read sites (`bank-program-form.page.ts:3863, 4007, 4452, 4455,
4458, 4552, 4575`).

Consequence today, on every one of the 13 surrogate programs: `catalogProof()` is `null`, so step 5
renders the "nobody has said what this name reads its income from" blocker, and `ruleSteps()` is
empty — the figures editor never mounts. No way picker can render until this is fixed, and a bank
cannot currently edit a surrogate program's figures in the wizard either. A pre-existing defect, and
the prerequisite: one `?? ` fallback mirroring the catalog page, best behind a small shared helper so
the two cannot drift again.

#### 6b. The picker belongs inside the editor's *alternative* group, not on a card grid

The step-5 catalog-vs-own **cards no longer exist** — commit `3ed237f` replaced them with a status
strip, and its comment is the design rule this must respect: *"NOT a choice any more. The operator does
not pick 'whose amounts' up front and then go looking for an editor: the catalog's figures are already
in the grid below, and touching one is what makes them this bank's."* A second up-front picker would
re-introduce exactly what was removed.

So the choice goes where the ways already are.
[product-rule-editor.component.ts](admin/src/app/shared/income-rule/product-rule-editor.component.ts)
already owns every piece: `coalesceMembers().alternatives` enumerates the ways from `steps` alone,
`titleFor()` names each one from its op + fact ("A table keyed by the answer: …", "A percentage of an
earlier figure"), `activeDerivation` already reports which way is live, unfilled ways already collapse
reading **"Not used by this bank"**, and the group hint already says *"Fill in exactly one. The rest are
other banks' ways of working the same figure out."* — copy that is currently advisory and becomes true.

- On `variant="program"` with an **exclusive** product, each alternative row carries a native radio in
  one shared group, following the `.rate-basis-opt` pattern (`bank-program-form.page.ts:774-814`):
  real `<input type="radio">` bound to the control, the consequence written out, the focus ring on the
  label because the label is the target. `activeDerivation` stops inferring the first reaching candidate
  and reports the **chosen** way.
- Only the chosen way's figures are open; the rest collapse with their existing "Not used by this bank"
  state. One additive input (`wayId` + a `wayPicked` output), in the style of the existing additive
  `onlyKeyedBy` / `layout` inputs. A **combined** product renders exactly as today — no radios.
- Switching after figures exist opens a confirmation that **names the figures that will be dropped**,
  the repo's "state the consequence" pattern, not "are you sure".
- **No new endpoint.** `steps` alone yields the ways, their ops and their facts; labels come from the
  `surrogate_fact` registry the admin already loads. (The friendly mechanism vocabulary —
  `MECHANISM_LABELS` — lives only on the authoring page and is keyed off `templateSpec`, which the
  wizard's response does not carry, so `titleFor()` is the right namer here.)

#### 6c. Two client gates, and one of them currently short-circuits

- `productRuleHasError`
  ([income-rule.rules.ts:177](admin/src/app/shared/income-rule/income-rule.rules.ts#L177)) is the Save
  gate and already carries a byte-for-byte copy of the server's `reaches` recursion; the new rule must
  be mirrored there or Save enables on a rule the server refuses — and must not out-refuse it either
  (the v22.1.0 dead-Save bug).
- `incomeRuleError` (`bank-program-form.page.ts:4509`) returns `false` early when
  `amounts === 'catalog'`. "A way must be chosen" is true **regardless of whose figures they are**, so
  that early return has to let the way check through, or the one case that needs a choice most (the
  catalog fills four) is the one case the client never gates.

#### 6d. Deliberately out of scope

The read-only program detail page cannot name a way: it fetches `stepParams` only and prints raw step
ids today (`bank-program-detail.page.ts:853-926`, its own comment says why). Naming the way there means
fetching the catalog rule on that page — a separate change, listed here so it is a decision rather than
an omission. The catalog product screen is unchanged: the catalog states every way; only a PROGRAM
narrows.

#### 6e. i18n

Reuse the existing vocabulary rather than minting synonyms — `product_rule.group.alternatives`
(*طرق احتساب الرقم*), `product_rule.group.alternatives_hint_program`, `product_rule.step.not_used`
(*غير مستخدم في هذا البنك*), `product_rule.active_derivation`. New ids get Arabic targets with the
`<x id="…"/>` placeholder **element** — a literal `{$INTERPOLATION}` is legal XLIFF that silently drops
the value, the defect the v23.0.0 pass caught on nine units.

### 7. Data: declare, backfill, assert

- `compound_owner` gets `waysAre: 'exclusive'` in
  [product-blueprints.ts](backend/src/bank-programs/blueprints/product-blueprints.ts).
- The four compound programs in
  [sheet-programs.ts](backend/src/bank-programs/demo-figures/sheet-programs.ts) state their `wayId`
  (ABK `alt__unit_paid_to_date` · CAE `alt__unit_paid_to_date` · FAB `alt` · EGB `primary`), or
  `seed:sheet-figures` starts failing at site 1.
- One data-only migration backfills `wayId` for every program of an exclusive product from its single
  filled way head — computed the way `programFigureKeysUnderProduct` already computes it (two hops,
  product → names → programs, counting only keys that hold a figure) — and **RAISEs rather than
  commits** if any such program fills two heads. Measured now: none do. It lands in the same change as
  the refusal, or a correct existing program becomes unsavable (A25).
- Nothing frozen is touched: 675 historical offers exist and **none** carries an `incomeOrigin`.
- The mobile app has no reference to `stepParams`, `wayId` or `basis_combine` — nothing to change.

## Verification

- **Unit** — `waysAre` validation both directions; `wayOwnedSlots` (columns and pick belong to the way,
  `cond__*` / `share*` / `src__*` / `basis*` do not); the four new refusals; the engine returning the
  chosen way's figure unchanged; `auto_loan_crosssell` still taking the lower of its two ways; a DTO
  metadata test proving `wayId` survives the pipe **and** `stripForeignMethodConfig`.
- **Nothing regressed** — the nine multi-way tests named above and the golden slot list in
  `product-blueprints.spec.ts` must pass **untouched**: this adds no slot and renames none.
- **Real database, over HTTP** — per compound program: save unchanged (accepted), save with a second
  way's figure (`PROGRAM_INCOME_WAY_CONFLICT` naming the slot), save with `wayId` cleared
  (`PROGRAM_INCOME_WAY_REQUIRED`), switch the way (warned, then only the new way's figures stored, and
  the old way's `valueSources` markers gone). Re-quote all four and confirm the figures measured today —
  FAB 750,000 · ABK 3,000,000 · CAE 500,000 · EGB 6,000,000 — then restore every row.
- **Catalog inheritance** — put one program on `amounts: 'catalog'` with a `wayId`, confirm it inherits
  that way only and still receives the catalog's conditions, then restore it to `own`.
- **Seeds** — `seed:blueprints` and `seed:sheet-figures` re-run and write nothing (both are idempotent
  and both pass `figuresRequired: false`, so neither may start refusing).
- **Checks** — `check:codes` (229 in sync across backend and both dictionaries), `check:income-proof`,
  `check:parent-keys`, full backend suite, admin suite, both locale builds, ar-EG untranslated count at
  or under baseline.
- **Browser** — first that §6a is fixed: open the wizard on a real surrogate program and confirm the
  income step renders the product's ways instead of the "nobody has said what this reads its income
  from" blocker (it does not today). Then the radios in light, dark and RTL with page overflow measured
  at 0; the switch warning naming real figures; a keyboard and screen-reader pass on the group (native
  radio semantics, arrow-key traversal, a visible focus ring on the label, the consequence bound by
  `aria-describedby`).

## Order of work

1. **§6a** — the wizard's `surrogateProduct.incomeRule` fallback. Nothing else is testable in a browser
   until it lands, and it is a live defect on its own.
2. **§1 + §2** — `waysAre` and `wayId`, all four field edits, DTO metadata test.
3. **§7 migration + seed data** — so every existing row is compliant before any refusal exists.
4. **§3 + §4 + §5** — the refusals, the persist strip, the inheritance prune.
5. **§6b–§6e** — the picker, the two client gates, the copy.
6. **§0** — the doc lands in `docs/`, updated with whatever the build taught us.

---

## What the build changed

Five departures. Three were found by exercising the thing rather than by reading it.

### 1. `waysAre` rides on the COMPILED RULE, not only on the form

The plan put `waysAre` on `ProductTemplate` and left the reading of it unstated. It cannot be read
from there: the two places that act on it hold an `IncomeAssumptionConfig` and never a template —
`validateIncomeRule` is handed the effective config, and `effectiveIncomeRule` runs inside
`toBankProgramSnapshot`. Reaching back to `templateSpec` from either would be a second read of one
fact, free to disagree; and a calculation authored through the raw step editor has no template at
all, so it would answer nothing.

So `compileTemplate` emits `waysAre: 'exclusive'` onto the rule, where it is STRUCTURE and travels
with the steps: `mergeProductRuleStructure` carries it, `stripCatalogStructure` takes it off a bank
row. Emitted only when exclusive, so every template stored before the field existed still compiles
byte-identically (§5.4) — pinned by a test.

The same reasoning moved `wayOwnedSlots` off the template. New pure
`matching/pipeline/product-rule-ways.ts` derives the ways from the rule — safe by construction,
since the rule is what `waySlot` / `emitMechanism` produced — and the admin mirrors it in
`shared/income-rule/product-rule-ways.ts`.

### 2. The persist strip is GONE. The refusal is the whole mechanism

§3 and §4 as written cannot both hold, and the conflict is structural rather than a matter of
ordering: `persistableIncomeAssumption` produces the very object `runCrossConfigChecks` validates,
so anything the strip removed was gone before the validator could refuse it. Measured, not reasoned
about — `PROGRAM_INCOME_WAY_CONFLICT` answered **200 OK** over HTTP until the strip came back out.

Given the two, the REFUSAL is the one worth keeping. It names the boxes and lets the operator
decide; a silent strip destroys figures a bank typed and says nothing, which is the posture
`PRODUCT_TEMPLATE_ORPHANS_FIGURES` already rejects one level up ("REFUSED rather than reconciled").
The deletion still happens — in the EDITOR, on the confirmation that names what is lost — and the
server refuses whatever is left over, so no orphan can be stored either way.

`stripUnchosenWays` survives as the shared narrowing §5 needs, where there is nobody to refuse: the
catalog fills four heads and a bank on `amounts: 'catalog'` must receive one. `valueSources` needed
no code — `pruneValueSources` walks the persisted `stepParams` by key, so a marker on a slot the
save does not carry stops being a markable path in the same write.

### 3. §6a's fix unmasked a live data-loss bug in the wizard

The `surrogateProduct.incomeRule` fallback landed as planned. It then made `adoptCatalogProof`
reachable for the first time — and `applyInitial` patches `programNameKey` before it patches the
rule, so on an EDIT LOAD the picker's subscription fired with the form's default `declared` still in
the strategy control. The adopt read the name's real proof, saw a change, and flipped a live program
onto CATALOG amounts, replacing the figures it quotes off with the catalog's.

Latent for exactly as long as the wizard could not resolve a linked name's proof (`incomeRule` alone
is NULL on all eight linked names, so `proof` was always `undefined` and the adopt returned early).
Found in a browser within a minute of the fix landing: FABMISR's program opened showing four of the
catalog's ways as its own, three of them flagged. Closed with a `hydrating` guard — the same class of
fix v23.1.0 applied to the friendly-name seeding two lines above it.

### 4. The picker's own findings (`impec`, measured through a canvas)

- **Two of the five radio labels were word for word the same.** `titleFor` names the OP, and three of
  the six mechanisms read their number through a shared `factNumber` step, so the compound
  guarantee's ways came out as "A table of ranges" and "A percentage of an earlier figure" twice.
  Survivable while these were rows to fill (the flow list separates them by ordinal); not survivable
  when they ARE the choice — the two identical ones are 15% of everything paid and a share of the
  down payment, which differ by real money on one applicant. New `wayTitleFor` gives each a whole
  phrase naming the fact ("A percentage of: How much have you paid for the unit so far?"), scoped to
  ways so nothing else grows a longer title.
- **`.grp-hint` measured 3.54:1 in LIGHT mode** (5.24:1 dark, which is why a dark-only review passes
  it) at 12px/400 — and it is the sentence bound to every radio by `aria-describedby`. Moved to
  secondary: **5.71:1 / 8.91:1**.
- **The qualifier repeated on all five rows** ("split by Topping up a loan from this bank") — a
  property of the PRODUCT stated once per option. Dropped on way rows.
- **"Not used by this bank" ×4** said what four unchecked radios already say. Replaced with the one
  state they cannot: a way this program does not sell that STILL holds figures — the row the server
  would name in `PROGRAM_INCOME_WAY_CONFLICT`. Warning carried by a dot, ink at primary (`--color-warning`
  on its own wash measures 2.53:1).
- **Cancelling the switch left NO radio checked.** A radio moves on click before any handler runs, and
  clearing only the clicked one leaves the group empty — which reads as "this program sells no way at
  all". `syncRadios` restores the group from the model.

Passing and recorded: focus reachable by real Tab with the ring on the LABEL
(`rgb(8,105,195) solid 2px` light, `rgb(91,165,232) solid 2px` dark, offset −2px); one tab stop for
the group; arrow-key traversal opens the same confirmation and cancel restores; accent 4.96:1 /
7.12:1; titles 13.9:1 / 16.97:1; page overflow **0** at 1440 in light, dark and forced RTL; no page
errors.

### 5. The migration writes the flag as well as the backfill

`waysAre` is authored in `product-blueprints.ts`, and `seed:blueprints` skips any product that
already holds a calculation — a promise to the operator that a re-seed will not undo their figures.
So neither the form nor the compiled rule reaches an already-seeded database on its own, and code and
row would disagree permanently. `20260904120000_program_income_way` writes it into both blobs by key;
the flag adds no step and renames none, so that is exactly equivalent to a recompile and
`blueprint:retemplate` is not needed.

## Verified

- **Refusals, over HTTP against the real database** — unchanged save accepted; a second way's figure
  → `PROGRAM_INCOME_WAY_CONFLICT {wayId: alt, alsoFilled: [alt__unit_paid_to_date], count: 1}`; no
  way named → `PROGRAM_INCOME_WAY_REQUIRED` listing all five; an unknown way → `way_unknown`; a way
  named on the COMBINED product → `way_not_applicable`; and `ABK-PER-AUTO_XSELL_ABK` still saving
  with BOTH its ways filled. Every row restored afterwards.
- **Switching** stores the new way's figures only (`stepParams: ['alt__unit_paid_to_date']`), and the
  program restores byte-identically.
- **Each bank quotes off its own mechanism** on one applicant (paid 1,000,000 · down payment 600,000
  · unit 2,000,000 · owns 100%): FAB 1,000,000 (down-payment bracket) · ABK 150,000 (15% of
  everything paid) · CAE 500,000 (50%) · EGB 2,000,000 (class table). Four ways, four figures, no
  folding.
- **Catalog inheritance** — EGB put on `amounts: 'catalog'` with `wayId: alt__unit_paid_to_date`
  quotes **150,000**, that ONE way's default, where before this change it would have folded all four
  catalog heads with `minOf`. The catalog's conditions still arrive. Restored to `own`.
- **Migration** applied: four compound programs named their way (FAB `alt` — one way, two columns —
  ABK and CAE `alt__unit_paid_to_date`, EGB `primary`), the cross-sell untouched, no RAISE.
- **Seeds** — `seed:blueprints` writes 0 and publishes 0×; `seed:sheet-figures` settles at 0 written
  / 0 REFUSED.
- **Checks** — `check:codes` 229 in sync, `check:income-proof` clean (13 programs across 8 names),
  `check:parent-keys` clean. Backend 1478 → **1524**, admin 235 → **252**. Both locales build;
  ar-EG untranslated **421 = baseline**, none of them new. Lint at baseline on every touched file.

## Not done, stated

- The read-only program detail page still cannot name a way (§6d, unchanged): it fetches
  `stepParams` only and prints raw step ids.
- The Arabic targets were verified by the `development-ar` build reporting no new untranslated id and
  no placeholder mismatch — the check this repo relies on. The strings were not seen RENDERING in an
  Arabic browser session: RTL was measured with `dir=rtl` forced on the English bundle, because the
  ar dev server cannot authenticate against a backend whose CORS allows `:5173` only.
- Only `compound_owner` declares `waysAre`. Any future product whose ways are alternatives has to say
  so, and nothing detects one that forgets — a product with two ways no sheet pairs still folds them.
