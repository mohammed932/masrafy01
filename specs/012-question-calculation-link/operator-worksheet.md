# Operator worksheet — feature 012, part C

> Two decisions in part C need figures only you, the operator, can give. **Engineering does not invent bank figures** (Principle II, Banks Are Data). Fill in the blanks below. Each filled row then becomes:
> - one link on the question's "Use in calculation" panel, and
> - one table edit, on the bank programme or product (or a seed entry where the row is seed-owned).
>
> For each one, every affected programme's figures are captured before and after, using `scripts/quote-preview-apply-parity.ts`.
>
> Arabic headings are given beside the English ones.

---

## C1 — Old military grades · الرتب العسكرية القديمة

**The problem:**
- `military_grade` offers 10 options. Three of them are legacy: `officer`, `senior_officer` and `general`.
- ABK-PER-ARMED_FORCES has a grade table with **no row** for these three. An applicant who picks one of them gets no grade income.

**The table as it stands today** (ABK-PER-ARMED_FORCES, `stepParams.primary.keyTable`):

| Grade option | Monthly income the bank assumes (EGP) |
|---|---|
| grade_major_general | 75,000 |
| grade_brigadier_general | 60,000 |
| grade_colonel | 45,000 |
| grade_lt_colonel | 40,000 |
| grade_major | 30,000 |
| grade_captain | 28,000 |
| grade_first_lieutenant | 18,000 |

**Please fill in:** for each legacy option, say EITHER which grade above it equals, OR its own figure.

| Legacy option | Equals grade… (أو) | …or its own figure (EGP) |
|---|---|---|
| `officer` | | |
| `senior_officer` | | |
| `general` | | |

---

## C2 — Questions whose answer changes no figure · أسئلة لا تؤثر على أي رقم

There are 12 active questions that today are stored and shown, but **no programme reads them**.

For each row, do ONE of the following:
- name the effect and the programmes, then fill in the figures; OR
- write **info only** (معلومات فقط). The question stays as lead information, and the "Used by" panel labels it "Affects no figure".

**What "Effect" can be** (the "What should it affect?" tiles on the question panel):
- rate table
- loan cap
- financed share
- smallest loan
- shortest term
- longest term
- extra income (number questions only)
- condition / income rule

**Programmes per loan type:**

| Loan type | Programmes |
|---|---|
| personal | 39 |
| mortgage | 10 |
| business | 7 |

| # | Question (code) | Asked in | Options | Suggested effect | Programmes | Figures per option | Decision |
|---|---|---|---|---|---|---|---|
| 1 | `employer_approved` — Is the place you work at on the banks' approved list? | personal, mortgage | yes, no, not_sure | rate table or loan cap | | | |
| 2 | `active_account` — Do you have a bank account you use? | personal, mortgage | yes, no | rate table | | | |
| 3 | `salary_bank_name` — Which bank do you receive your salary through? | personal, mortgage | 15 banks | rate table (bank-relationship pricing) | | | |
| 4 | `governorate` — Which governorate is the place in? | mortgage | 27 governorates | loan cap by city tier (reuses the governorate → tier filing, like `practice_governorate`) | | | |
| 5 | `business_account` — Do you have a bank account for the business? | business | yes, no | rate table | | | |
| 6 | `activity_type` — What kind of work does your business do? | business | trade, services, restaurants_cafes, manufacturing, technology, other | loan cap or rate table | | | |
| 7 | `registered` — Is your business officially registered? | business | yes, no, registration_in_progress | condition, or loan cap | | | |
| 8 | `tax_registration` — Do you have a tax card or commercial register? | business | yes, no | condition, or loan cap | | | |
| 9 | `loan_purpose` — What will you use the money for? | personal | 7 purposes | probably **info only** | | | |
| 10 | `financing_purpose` — What will the business use the money for? | business | 6 purposes | probably **info only** | | | |
| 11 | `needs_consultant` — Do you want help from a loan expert? | personal, mortgage, business | yes, no | probably **info only** (lead routing) | | | |
| 12 | `needs_assistance` — Do you want help getting your papers ready? | mortgage | yes, no | probably **info only** (lead routing) | | | |

### Things to know before you choose

- **"condition" can refuse an applicant.** A condition, or a table the bank sets to *refuse when nothing matches*, refuses anyone who leaves the question blank. Feature 012 (C3) makes such a question **required** under every programme name that reads it. Rows 7 and 8 would then become required for those names.
- **One question answers one figure.** If two banks price the same answer differently, they both read the same figure, and each bank's table holds its own numbers.
- **Linking alone changes no quote.** Nothing moves until a bank table states figures. That is why a link, on its own, changes no quote.
