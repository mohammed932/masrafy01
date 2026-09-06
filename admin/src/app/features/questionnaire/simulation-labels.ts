/**
 * Localized label for the simulator's binding-constraint enum.
 *
 * ONE home for both surfaces (result card + offer drawer): the same code must
 * not read one way in the list and another in the drill-down (A25). Codes are
 * mapped explicitly rather than de-underscored at render time — a generated
 * `AGE_AT_MATURITY` → "Age At Maturity" is untranslated English shown to an
 * Arabic-first admin (A2 / A20).
 *
 * Figures-unavailable reasons are NOT here: they are error codes with entries in
 * `error-codes.{ar-EG,en-US}.json`, read through `ErrorCodeService` (A22).
 */

/** Which reduction shaped the quoted amount / term (FR-023). */
export function bindingConstraintLabel(constraint: string): string {
  switch (constraint) {
    case 'dbr_affordability':
      return $localize`:@@sim.binding.dbr:Debt burden ceiling`;
    case 'program_max':
      return $localize`:@@sim.binding.program_max:Program maximum`;
    case 'age_at_maturity':
      return $localize`:@@sim.binding.age:Age at maturity`;
    case 'tenor_max':
      return $localize`:@@sim.binding.tenor:Maximum term`;
    case 'tenor_min':
      return $localize`:@@sim.binding.tenor_min:Minimum term`;
    case 'requested_amount':
      return $localize`:@@sim.binding.requested:Nothing — the full request was priced`;
    default:
      return constraint;
  }
}
