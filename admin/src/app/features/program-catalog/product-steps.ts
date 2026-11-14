/**
 * The no-payslip product wizard's steps, in order (v33.3.0) — ONE list for the two pages that
 * draw the rail: `new-product.page.ts` (step 1 only, the rest locked until the product exists)
 * and `surrogate-product-detail.page.ts` (every step, add and edit alike).
 */
export function productStepLabels(): string[] {
  // One or two words each (v36.1.0): the rail names a step only while every name fits, and
  // the long names left the operator reading bare numbers. Amount and "Who can't get it" are
  // the one calculation, split where an operator splits it (v36.2.0).
  return [
    $localize`:@@spd.step_name2:Name`,
    $localize`:@@spd.step_asks2:Questions`,
    $localize`:@@spd.step_amount:Amount`,
    $localize`:@@spd.step_rules:Who can't get it`,
    // Try & go live — hidden for now (operator, 2026-11-14).
  ];
}

/** The step a freshly created product opens on: "What it asks" (1-based, for `?step=`). */
export const FIRST_BUILD_STEP_PARAM = 2;
