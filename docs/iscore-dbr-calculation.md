# How I-Score and DBR shape an offer

The engine applies I-Score first and DBR second, in `backend/src/matching/pipeline/quote.ts`.

## The order

1. **Monthly income.** On a payslip programme it's the salary the customer declared. On a no-payslip programme it's the income the product works out from its own answers, not the declared salary.
2. **× the I-Score factor.** The customer's score picks a row from the programme's own I-Score table, else its product's, else the **shared table** — the I-Score classes on **Manage values**, each with its income percentage. The income is multiplied by that row's percentage. A 0% class counts no income, so the programme offers nothing.
3. **+ other money the bank counts** (rent, certificate returns, allowances), if the programme has any.
4. **The DBR cap is chosen against the income after I-Score.** If the I-Score moved the figure, the cap is looked up again, so a customer carried into a higher income band gets that band's cap.
5. **Maximum monthly instalment = income × DBR − existing monthly instalments.** If the requested amount gives a bigger instalment, the loan amount is reduced to fit. The programme isn't refused.

## Worked example

Income 10,000 EGP, I-Score 701, programme DBR 60%.

The shared I-Score table (Manage values → I-Score classes):

| Class | I-Score | Income counted |
|---|---|---|
| متعثر Defaulted | 300–399 | 0% (no loan) |
| مخاطر مرتفعة High Risk | 400–520 | 50% |
| غير مرضي Unsatisfactory | 521–625 | 80% |
| مرضي Satisfactory | 626–700 | 100% |
| جيد جدًا Very Good | 701–750 | 110% |
| ممتاز Excellent | 751–850 | 120% |

A score below 300 reads as Defaulted and one above 850 as Excellent.

| Step | Figure |
|---|---|
| Income | 10,000 |
| I-Score 701 → Very Good, 110% | 10,000 × 110% = **11,000** |
| DBR 60% | 11,000 × 60% = **6,600** a month for all instalments |
| Less existing instalments (e.g. 1,000) | **5,600** maximum for the new loan's instalment |

## Four cases where the result differs

- **The programme or its product states its own table.** That table wins over the shared one.
- **I-Score left blank.** The question is optional; no answer means 100% and the income stays 10,000.
- **A "Caps by kind of applicant" row wins over the flat DBR.** If the Salaried row says 50%, a salaried customer is capped at 50%: 11,000 × 50% = 5,500. The full order is: the calculation's own override, then the per-applicant-type row, then the income bands, then the flat cap.
- **The final instalment can still be lower** once the programme's maximum term, the customer's age at the last instalment, and the programme's maximum loan amount are applied.
