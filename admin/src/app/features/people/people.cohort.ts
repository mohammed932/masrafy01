import type { StaffRole } from '@core/auth/auth.types';

/**
 * The two cohorts of the People directory. `staff` = internal StaffAccount rows
 * (super_admin only); `customers` = CustomerAccount rows created by mobile
 * signups. One nav entry, one search box, two cohorts.
 */
export type Cohort = 'staff' | 'customers';

export const COHORTS: readonly Cohort[] = ['staff', 'customers'];

/** Roles allowed to see each cohort — mirrors the backend `@Roles(...)` sets. */
const COHORT_ROLES: Readonly<Record<Cohort, readonly StaffRole[]>> = {
  staff: ['super_admin'],
  customers: ['super_admin', 'sales_manager', 'analyst'],
};

export function cohortAllowed(cohort: Cohort, role: StaffRole | null): boolean {
  return role !== null && COHORT_ROLES[cohort].includes(role);
}

export function visibleCohorts(role: StaffRole | null): readonly Cohort[] {
  return COHORTS.filter((c) => cohortAllowed(c, role));
}

const STORAGE_KEY = 'masrafy.people.cohort';

/**
 * Last cohort the operator looked at. Persisted so collapsing two nav entries
 * into one loses nothing: a super_admin who lives in Staff lands back in Staff.
 * Best-effort — a blocked/absent localStorage just falls back to the default.
 */
export function readLastCohort(): Cohort | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'staff' || saved === 'customers' ? saved : null;
  } catch {
    return null;
  }
}

export function writeLastCohort(cohort: Cohort): void {
  try {
    localStorage.setItem(STORAGE_KEY, cohort);
  } catch {
    // best-effort
  }
}

/**
 * Where `/people` lands: the remembered cohort when the role still allows it,
 * otherwise Customers (the higher-traffic operational cohort), otherwise the
 * first cohort the role can see.
 */
export function defaultCohort(role: StaffRole | null): Cohort {
  const remembered = readLastCohort();
  if (remembered && cohortAllowed(remembered, role)) return remembered;
  if (cohortAllowed('customers', role)) return 'customers';
  return visibleCohorts(role)[0] ?? 'customers';
}
