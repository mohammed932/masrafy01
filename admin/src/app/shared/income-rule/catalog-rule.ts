/**
 * The rule a catalog program name actually quotes on.
 *
 * Pure, and shared, because the two screens that ask this question got different answers.
 * Since v18.4.0 a no-payslip name takes its calculation from a SURROGATE PRODUCT and its own
 * `incomeRule` column is NULL — that NULL is what makes the link a link rather than a fork.
 * The backend says both halves on the way out (`incomeRule` plus `surrogateProduct.incomeRule`)
 * and the catalog name's page reads both; the bank-program wizard read only the first, at seven
 * sites, so on every one of the 13 live surrogate programs it saw a name that states nothing:
 * step 5 rendered the "nobody has said what this name reads its income from" blocker and the
 * figures editor never mounted at all. A bank could not edit its own figures in the wizard.
 *
 * The PRODUCT wins where both are present, matching `effectiveProgramNameRule` on the server:
 * a linked name's own rule is grandfathered legacy data, and the product is the thing the
 * operator was looking at when they edited it.
 */

import type {
  IncomeAssumptionConfig,
  ProgramNameIncomeRule,
} from '@features/bank-programs/bank-programs.types';

export function catalogRuleOf(
  data: ProgramNameIncomeRule | null | undefined,
): IncomeAssumptionConfig | null {
  return data?.surrogateProduct?.incomeRule ?? data?.incomeRule ?? null;
}
