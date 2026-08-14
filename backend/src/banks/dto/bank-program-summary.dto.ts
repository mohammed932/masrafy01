/**
 * One row of `GET /admin/banks/:id/programs`.
 *
 * The bank detail page shows a bank's shelf of products, so it needs the three
 * numbers a reviewer actually compares between programs — headline rate, EGP
 * ceiling, tenor — not just a name and a toggle. All three are flattened out of
 * the program's JSONB config here so the page never has to fetch each program's
 * detail endpoint to render a list.
 */
export class BankProgramSummaryDto {
  id!: string;
  programCode!: string;
  friendlyName!: string;
  friendlyNameAr?: string | null;
  /** Predefined catalog archetype this program instantiates. */
  programNameKey?: string | null;
  productCategory!: string;
  /**
   * How this program establishes the income it lends against. On the shelf because it
   * changes what the rate beside it MEANS — the same 24% against an assumed income is a
   * different product from 24% against a payslip — and the page could not show it before.
   */
  programType!: 'income_proof' | 'income_surrogate';
  active!: boolean;
  isShariaCompliant!: boolean;
  version!: number;

  /** Headline rate: the fixed base rate, or the current effective rate when variable. */
  ratePercent?: string | null;
  isVariableRate!: boolean;
  minAmountEGP?: string | null;
  maxAmountEGP?: string | null;
  minMonths?: number | null;
  maxMonths?: number | null;
  updatedAt!: string;
}
