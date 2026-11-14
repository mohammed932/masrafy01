# Product build scenarios

Name every product `TESTING …`. The figures are examples. Labels below are exactly as on screen.

## How to (once)

| Do | Steps | Why |
|---|---|---|
| New question | Questions → **+ Question** → wording → answer type (**One choice** / **Number** …) → answers or limits → **Save question** | what the applicant will be asked |
| New product | Program catalog → **New product** → **Blank** → name → **Create and continue** | the container for questions + calculation |
| Add questions to it | **Questions** tab → **Add a question** → tick → **Done** | only ticked questions can be used in the calculation |
| Finish | **Figures** tab → fill in → **Save changes** → **Check and go live** tab → **Try it with sample answers** → **Work it out** → **Go live** | banks start from these amounts; going live makes it sellable |

**Groups** (**Put the answers in groups**) appear only on a question whose answers come from a list
(Governorate, Which compound). A question you make yourself uses **One column for each answer**.

## The Calculation tab, label by label

| What you do | Label on screen | Why |
|---|---|---|
| Pick the main question | **Which question decides the income?** → **Question** | the answer the figure comes from |
| How a number gives the figure | **A figure for each range** · **A percentage of the answer** · **A multiple of the answer** · **The answer divided by a figure** | how a typed number becomes money |
| Per answer or per class *(new)* | **One figure for each answer** · **One figure for each class** | class = one price for a whole group of answers |
| Open the extras | **More options** | everything below is optional |
| Borrowing limit *(new)* | tick **It is a borrowing limit, not an income** → **This ceiling was worked out at a DBR of** | the figure is a max loan, not an income |
| Extra ways | tick **Other ways to reach the figure** → **Way 2** opens → **How** + **Which question does it read?** · for more: **Add another way** (button under the last way) | a bank may price by another answer |
| How banks use the ways | **How a bank uses these ways** → **Each bank picks one of them** / **Every bank uses all of them** | one way per bank, or all of them |
| If all are used | **If a bank fills in more than one way** → **Take the lowest** / **Take the highest** | safest (lowest) or most generous (highest) |
| Second column | tick **A second column** → **Which question splits the columns?** → **One column for each answer** / **Put the answers in groups** | different amounts per kind of customer |
| Groups | **Add a group** → **Which group is each answer in?** | share one column across several answers |
| Bonus | tick **A bonus percentage when something is true** → **Which question?** → **Earns the bonus** / **Does not** | reward one answer with a % on top |
| Conditions | **Conditions the customer must meet** → **Add a condition** → **What is measured** → **Must be** → **What the customer is told when they do not meet it** | refuse customers who fail a rule |

In **How** (other ways) the options read: **One figure for each answer** · **One figure for each range of a number** ·
**A percentage of a number the customer states** · **A multiple of a number the customer states** ·
**A number the customer states, divided by a figure the bank states**.

In **Must be**: **At least what the bank states** · **At most what the bank states** · **Between the bank's two figures** ·
**At least a percentage of another figure** · **One of the answers the bank accepts**.

---

## 1. Pharmacy owner
**New questions:** Years open (Number) · Monthly sales (Number) · Own or rent (One choice: Own / Rent)
**Questions tab:** the 3 above + Governorate

**Calculation tab**
1. **Which question decides the income?** → Years open → **A figure for each range** — *years open sets the income*
2. **More options** → tick **A second column** → **Which question splits the columns?** → Governorate → **Put the answers in groups** → **Add a group** ×2: Big cities, Rest → place Cairo, Alexandria, Giza in Big cities — *big cities earn more*
3. Tick **Other ways to reach the figure** → in **Way 2**: **How**: **A percentage of a number the customer states** → Monthly sales → **How a bank uses these ways**: **Each bank picks one of them** — *a bank may use sales instead*

**Figures:** 0–5 → 20k / 15k · 5–10 → 30k / 20k · 10+ → 40k / 28k · sales 15% — *starting amounts for every bank*
**Try it:** 6 yrs Cairo → **30,000** · 6 yrs Aswan → **20,000** — *proves the setup gives the right money*

## 2. Private school teacher
**New questions:** Stage (One choice: Primary / Preparatory / Secondary) · School type (One choice: International / Local) · Years teaching (Number)
**Questions tab:** the 3 above

**Calculation tab**
1. **Which question decides the income?** → Stage — *stage sets the income*
2. **More options** → tick **A second column** → School type → **One column for each answer** → tick both — *international schools pay more*

**Figures:** Primary 18k / 10k · Preparatory 21k / 12k · Secondary 25k / 14k — *starting amounts for every bank*
**Try it:** Secondary + International → **25,000** — *proves the setup gives the right money*

## 3. Engineer
**New questions:** Years of experience (Number) · Specialty (One choice: High demand / General) · Syndicate years (Number)
**Questions tab:** the 3 above

**Calculation tab**
1. **Which question decides the income?** → Years of experience → **A figure for each range** — *experience sets the income*
2. **More options** → tick **A second column** → Specialty → **One column for each answer** → tick both — *high-demand specialties earn more*
3. **Conditions the customer must meet** → **Add a condition** → **What is measured**: Syndicate years → **Must be**: **At least what the bank states** — *too new to the syndicate = refused*

**Figures:** 0–5 → 20k / 13k · 5–10 → 32k / 20k · 10+ → 45k / 28k · condition 2 — *starting amounts for every bank*
**Try it:** 12 yrs High demand → **45,000** · 1 syndicate year → **refused** — *proves the setup gives the right money*

## 4. Rental income
**New questions:** Monthly rent (Number) · Unit type (One choice: Residential / Commercial) · Months left on lease (Number)
**Questions tab:** the 3 above

**Calculation tab**
1. **Which question decides the income?** → Monthly rent → **A percentage of the answer** — *part of the rent counts as income*
2. **More options** → tick **A second column** → Unit type → **One column for each answer** → tick both — *commercial rent counts less*
3. **Conditions the customer must meet** → **Add a condition** → Months left on lease → **At least what the bank states** — *a lease about to end = refused*

**Figures:** Residential 60% · Commercial 50% · condition 6 — *starting amounts for every bank*
**Try it:** 20,000 Residential → **12,000** — *proves the setup gives the right money*

## 5. Farmer
**New questions:** Land size (Number, feddans) · Export contract (One choice: Yes / No) · Main crop (One choice)
**Questions tab:** the 3 above + Governorate

**Calculation tab**
1. **Which question decides the income?** → Land size → **A figure for each range** — *land size sets the income*
2. **More options** → tick **A second column** → Governorate → **Put the answers in groups** → **Add a group** ×3: Delta, Upper Egypt, New lands → place the governorates — *regions earn differently*
3. Tick **A bonus percentage when something is true** → **Which question?**: Export contract → **Earns the bonus**: Yes → **Does not**: No — *export contracts earn more*

**Figures:** 0–5 → 15k / 12k / 9k · 5–20 → 30k / 24k / 18k · 20+ → 50k / 40k / 30k · bonus 10% — *starting amounts for every bank*
**Try it:** 10 feddans Gharbia → **30,000** · with export contract → **33,000** — *proves the setup gives the right money*

## 6. Freelancer
**New questions:** Monthly transfers from abroad (Number) · Years freelancing (Number)
**Questions tab:** the 2 above + Total savings

**Calculation tab**
1. **Which question decides the income?** → Total savings → **The answer divided by a figure** — *savings spread over 36 months*
2. **More options** → tick **Other ways to reach the figure** → in **Way 2**: **How**: **A multiple of a number the customer states** → Transfers — *transfers are a second way*
3. **How a bank uses these ways**: **Every bank uses all of them** → **If a bank fills in more than one way**: **Take the lowest** — *use both, take the safer figure*

**Figures:** ÷ 36 · × 0.7 — *starting amounts for every bank*
**Try it:** savings 720,000 + transfers 30,000 → **20,000** — *proves the setup gives the right money*

## 7. Club member (a borrowing limit)
**New questions:** Club tier (One choice: Tier A / Tier B) · Membership type (One choice: Working / Affiliate) · Membership years (Number)
**Questions tab:** the 3 above

**Calculation tab**
1. **Which question decides the income?** → Club tier — *the club tier sets the limit*
2. **More options** → tick **It is a borrowing limit, not an income** → **This ceiling was worked out at a DBR of**: 50 — *it is a max loan, not an income*
3. Tick **A second column** → Membership type → **One column for each answer** → tick both — *working members borrow more*
4. **Conditions the customer must meet** → **Add a condition** → Membership years → **At least what the bank states** — *new members = refused*

**Figures:** Tier A 1,500,000 / 800,000 · Tier B 800,000 / 400,000 · condition 3 — *starting amounts for every bank*
**Try it:** Tier A Working, 5 yrs → **1,500,000** · 2 yrs → **refused** — *proves the setup gives the right money*

## 8. Compound Owner (like the live one)
**New questions:** none. They already exist.
**Questions tab:** Owns a compound unit · Which compound · Kind of unit · Paid so far · Down payment · Contract price · Months since signing · Owned share %

**Calculation tab**
1. **Which question decides the income?** → Which compound → **One figure for each class** — *one price per compound class, not per compound*
2. **More options** → tick **It is a borrowing limit, not an income** → **This ceiling was worked out at a DBR of**: 50 — *it is a max loan, not an income*
3. Tick **Other ways to reach the figure** → **Way 2** opens; press **Add another way** 3 times for Ways 3–5: — *banks price compounds in different ways*
   - Way 2 — **How**: **One figure for each range of a number** → Down payment
   - Way 3 — **How**: **A percentage of a number the customer states** → Paid so far
   - Way 4 — **How**: **One figure for each answer** → Kind of unit
   - Way 5 — **How**: **A percentage of a number the customer states** → Down payment
4. **How a bank uses these ways**: **Each bank picks one of them** — *each bank uses its own way*
5. **Conditions the customer must meet** → **Add a condition** ×3: — *refuse risky owners*
   - Months since signing → **At least what the bank states**
   - Paid so far → **At least a percentage of another figure** → **A share of**: Contract price
   - Contract price → **At least what the bank states**

**Figures:** AA 6m · AB 5m · A 4m · B 3m · C 2m · Other 2m · conditions 12 / 30% / 2,000,000 — *starting amounts for every bank*
**Try it:** Mivida, 24 months, paid 3m of 8m → **6,000,000** · Al Rehab → **2,000,000** · 6 months → **refused** — *proves the setup gives the right money*

**Not possible on the screens:** the New loan / Top-up column and scaling by owned share. Use **Copy** if you need them.
