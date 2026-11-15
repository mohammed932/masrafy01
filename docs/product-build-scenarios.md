# Product build scenarios

Click-by-click steps to rebuild two live no-payslip products (Compound Owner and Doctors — In
Practice) from scratch. Words in **bold** are
exactly what you click or see on screen.

## Create the product (both products start like this)

1. Open **Program catalog**.
2. Click **+ New product**.
3. Pick **Blank**.
4. Type the English name and the Arabic name. Use a name that isn't taken, e.g. "Compound Owner 2".
5. Click **Create**. The product page opens. Its steps are along the top: **Name · Questions ·
   Amount**.

Nothing is saved until you click **Save changes** (top right). Leave a duplicate as **Draft**.

## Compound Owner

### Step 1 — Name

The names were typed when you created it; change them here if needed.

### Step 2 — Questions

1. Click **Questions** (a new product opens here).
2. Click **+ Add questions**. A panel opens on the side.
3. For each question below, type a word from it in the search box, then click **Add** on its row:
   - Do you own a unit in a compound?
   - Which compound is your unit in?
   - What kind of unit do you own?
   - How much have you paid for the unit so far?
   - How much was the down payment on the unit?
   - What is the contract price of the unit?
   - How many months ago did you sign the contract?
   - What percentage of the unit do you own?
   - How long has your business been running?
   - Do you have a valid commercial register and tax card?
4. Click **Done**. The **Added** tab now shows 10.

### Step 3 — Amount

1. Click **Amount**.
2. At the top, under "What does the amount mean?", click **The biggest loan they can get**. This is
   what makes the share checkbox and the debt-burden line appear further down.

**Shortcut — surrogate methods.** Each of the four methods below is also a surrogate method. Instead of
building one by hand, choose it in **Use a surrogate method** (shown on an empty method) and its
questions, columns, groups and amounts are filled in; then skip to the next method:

| Method | Pick in "Use a surrogate method" |
| --- | --- |
| 1 | By compound class (new loan or top-up) |
| 2 | By down payment on the unit (holds a product here or not) |
| 3 | A share of what was paid for the unit |
| 4 | By kind of unit (new loan or top-up) |

For methods 2–4, click **+ Add another method (some banks work it out differently)** (or **+ Method**)
first to get an empty method. The steps below are the same thing by hand.

**Method 1: by compound**

1. Click **+ Pick questions**.
2. Tick **Which compound is your unit in?**
3. Tick **Topping up a loan from this bank** (last group, "We work these out ourselves").
4. Click **Done**.
5. Click **One amount per group**.
6. Type the amounts:

| Group | A new loan | A top-up of a loan here |
| --- | --- | --- |
| Class AA | 6,000,000 | 7,000,000 |
| Class AB | 5,000,000 | 5,500,000 |
| Class A | 4,000,000 | 4,500,000 |
| Class B | 3,000,000 | 3,500,000 |
| Class C | 2,000,000 | 2,500,000 |
| Other | 2,000,000 | 2,000,000 |

**Method 2: by down payment**

1. Click **+ Add another method (some banks work it out differently)**. "Method 2" opens.
2. Click **+ Pick questions**.
3. Tick **How much was the down payment on the unit?**
4. Tick **Holds a card or deposit here**.
5. Click **Done**.
6. Click **By ranges**.
7. Click **+ Add a range** three times (4 rows in all).
8. Type the ranges and amounts:

| From | To | Holds nothing else here | Holds a card or deposit here |
| --- | --- | --- | --- |
| 250,000 | 500,000 | 750,000 | 1,250,000 |
| 500,000 | 1,000,000 | 1,000,000 | 1,500,000 |
| 1,000,000 | 1,500,000 | 1,250,000 | 1,750,000 |
| 1,500,000 | (leave empty = and up) | 1,500,000 | 2,000,000 |

**Method 3: a share of what they paid**

1. Click **+ Method**. "Method 3" opens.
2. Click **+ Pick questions**.
3. Tick **How much have you paid for the unit so far?**
4. Click **Done**.
5. Click **% of it**.
6. Type **15** in the box.

**Method 4: by kind of unit**

1. Click **+ Method**. "Method 4" opens.
2. Click **+ Pick questions**.
3. Tick **What kind of unit do you own?**
4. Tick **Topping up a loan from this bank**.
5. Click **Done**.
6. Type the amounts:

| Kind of unit | A new loan | A top-up of a loan here |
| --- | --- | --- |
| Apartment | 2,000,000 | 3,000,000 |
| Twin / Town house | 3,000,000 | 3,500,000 |
| Villa | 4,000,000 | 4,500,000 |

**Then, still on Amount**

1. Next to "Banks use" click **one method each**.
2. Tick **Pay only the share of the unit they own**. Next to "from" pick **What percentage of the
   unit do you own?**
3. Click **+ Loan limits (optional) …**.
4. In "A monthly payment can take up to … % of their income" type **50**.

Click **Save changes**.

The live product's fifth method (down payment × %) was removed from the database on 2026-11-14: no
bank used it and no sheet states a percentage. The seed (`product-blueprints.ts`) still lists it.

## Doctors — In Practice

One method: years in practice, by ranges. The live product stores **no amounts** (each bank types its
own), and asks four income
questions that the bank programs count as extra income.

### Step 1 — Name

Nothing to do: the names were typed when you created it.

### Step 2 — Questions

1. Click **Questions** (a new product opens here).
2. Click **+ Add questions**.
3. Search and click **Add** on each:
   - Years in practice
   - Do you work at a private hospital or a government one?
   - How much rent do you collect each month?
   - How much do your certificates or deposits pay you each month?
   - How much do you get in fixed allowances each month?
   - How much do you get in allowances that change month to month?
4. Click **Done**. The **Added** tab now shows 6.

### Step 3 — Amount

1. Click **Amount**.
2. Under "What does the amount mean?" leave **A salary we count for them** (the default).

**Shortcut:** in **Use a surrogate method** choose **By years in practice** — it fills steps 3–7.

3. Click **+ Pick questions**.
4. Tick **Years in practice**.
5. Click **Done**.
6. Click **By ranges**.
7. Leave the amounts empty: each bank sets them, as on the live product. (A range with no amount
   is not saved, so there is nothing else to type. If you do want default amounts, make these
   ranges — they are the ones the bank sheet prints — and type an amount in each.)

| From | To |
| --- | --- |
| 3 | 5 |
| 5 | 8 |
| 8 | 11 |
| 11 | 14 |
| 14 | 20 |
| 20 | (leave empty = and up) |

Click **Save changes**.

Each bank's own figures (its amounts, its highest loan) are set on its own program, not on the
product.

"Who can't get it" (the rules that turn a customer away) is hidden on the product page for now.
The live products' rules stay stored and are not touched by a save.

Surrogate methods are managed under **Surrogate methods** in the sidebar (add, change, delete). A pick is
a copy: changing a surrogate method later does not change a product that already used it.
