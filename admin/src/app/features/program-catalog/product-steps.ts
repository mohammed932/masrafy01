/**
 * The no-payslip product wizard's steps, in order (v33.3.0) — ONE list for the two pages that
 * draw the rail: `new-product.page.ts` (step 1 only, the rest locked until the product exists)
 * and `surrogate-product-detail.page.ts` (every step, add and edit alike).
 */
export function productStepLabels(): string[] {
  // One or two words each (v36.1.0): the rail names a step only while every name fits, and
  // the long names left the operator reading five bare numbers. "Try it" is part of the last
  // step now, beside the switch it decides.
  return [
    $localize`:@@spd.step_name2:Name`,
    $localize`:@@spd.step_asks2:Questions`,
    $localize`:@@spd.step_calc2:Calculation`,
    $localize`:@@spd.step_figures2:Figures`,
    $localize`:@@spd.step_live:Check and go live`,
  ];
}

/** The step a freshly created product opens on: "What it asks" (1-based, for `?step=`). */
export const FIRST_BUILD_STEP_PARAM = 2;
