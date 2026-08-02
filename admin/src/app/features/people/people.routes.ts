import { inject } from '@angular/core';
import { Router, type CanMatchFn, type Routes } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { type Cohort, cohortAllowed, defaultCohort } from './people.cohort';

/**
 * Resolves which cohort `/people…` opens, before the shell is built — so there
 * is no flash of a cohort-less directory and no second navigation.
 *
 * Runs on the PARENT route because `canMatch` is skipped on routes that carry
 * `redirectTo`, so a redirect-only child could not decide this. The remaining
 * segments tell us what was asked for:
 *   - nothing (`/people`)               → the remembered / default cohort
 *   - a cohort this role cannot open    → the same fallback, rather than
 *                                         bouncing the operator to /dashboard
 *   - an allowed cohort                 → match, and let the child render
 */
const resolveCohortMatchFn: CanMatchFn = (_route, segments) => {
  const role = inject(AuthService).role();
  // Unauthenticated: do not match, so no redirect can loop back here.
  if (role === null) return false;

  const requested = segments[0]?.path as Cohort | undefined;
  if (requested !== undefined && cohortAllowed(requested, role)) return true;

  return inject(Router).createUrlTree(['/people', defaultCohort(role)]);
};

/** Per-cohort gate — defence in depth behind the backend's `@Roles(...)`. */
const cohortMatchFn =
  (cohort: Cohort): CanMatchFn =>
  () =>
    cohortAllowed(cohort, inject(AuthService).role());

export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    canMatch: [resolveCohortMatchFn],
    loadComponent: () => import('./people-directory.page').then((m) => m.PeopleDirectoryPage),
    children: [
      {
        path: 'staff',
        canMatch: [cohortMatchFn('staff')],
        loadComponent: () => import('../users/staff-roster.page').then((m) => m.StaffRosterPage),
      },
      {
        path: 'customers',
        canMatch: [cohortMatchFn('customers')],
        loadComponent: () =>
          import('../customers/customer-roster.page').then((m) => m.CustomerRosterPage),
      },
      // Junk trailing segments (`/people/staff/x`). Customers is readable by
      // every role that reaches this route table.
      { path: '**', redirectTo: 'customers' },
    ],
  },
];
