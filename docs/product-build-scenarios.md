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
   Amount · Who can't get it**.

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

### Step 4 — Who can't get it

1. Click **Who can't get it**.
2. Click **+ Add a rule** five times, and set each rule:

| # | First box (question) | Second box | Figure | Message (last box) | On / Off |
| --- | --- | --- | --- | --- | --- |
| 1 | How many months ago did you sign the contract? | is less than | 18 | the contract is too new | nothing to pick: turns **On** once you type the figure |
| 2 | How much have you paid for the unit so far? | is less than a % of another answer | 30 % of **What is the contract price of the unit?** | paid is below the minimum | nothing to pick: turns **On** once you type the figure |
| 3 | What is the contract price of the unit? | is less than | 1,000,000 | the unit price is below the minimum | nothing to pick: turns **On** once you type the figure |
| 4 | How long has your business been running? | tick **Less than a year** and **One to two years** | — | the business is too new | **Off** |
| 5 | Do you have a valid commercial register and tax card? | tick **No, or only one of them** | — | register and tax card needed | **Off** |

A number rule has no switch. It reads **Off until a number is typed** and turns **On** by itself
when you type the figure. Leave the figure empty to let each bank type its own. A rule with ticked
answers (4 and 5) has an **On / Off** switch: set it as in the table.

3. Click **Save changes**.

The live product's fifth method (down payment × %) was removed from the database on 2026-11-14: no
bank used it and no sheet states a percentage. The seed (`product-blueprints.ts`) still lists it.

## Doctors — In Practice

One method: years in practice, by ranges. The live product stores **no amounts** (each bank types its
own), one rule (government-hospital doctors are turned away, off by default), and asks four income
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

### Step 4 — Who can't get it

1. Click **Who can't get it**.
2. Click **+ Add a rule**.
3. First box: **Do you work at a private hospital or a government one?**
4. Tick **A government hospital** (the answer that is turned away).
5. Leave the switch **Off** — on the live product each bank turns it on for itself.
6. Message: **One of this program's conditions isn't met by your answers.**
7. Click **Save changes**.

Each bank's own figures (its amounts, its highest loan) are set on its own program, not on the
product.
