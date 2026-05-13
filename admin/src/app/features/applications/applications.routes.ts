import type { Routes } from '@angular/router';

/**
 * Lazy-loaded routes for the Applications feature (feature 003 + 004 surface).
 * Role guard applied at the parent `/applications` mount in app.routes.ts —
 * sales_manager / sales_agent / analyst / super_admin all read.
 */
export const APPLICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./list/applications-list.page').then((m) => m.ApplicationsListPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./detail/application-detail.page').then((m) => m.ApplicationDetailPage),
  },
];
