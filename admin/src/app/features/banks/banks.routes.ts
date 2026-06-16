import type { Routes } from '@angular/router';

/**
 * Banks workspace routes. The `/banks` mount (app.routes.ts) gates all roles
 * (super_admin, sales_manager, sales_agent, analyst) for read; write actions
 * are gated per-row inside the list/detail/form components.
 *
 * `BanksShellComponent` wraps the two LIST views (Registry | Programs) so the
 * segmented tab bar persists across them. Program drill-downs render full-page
 * as shell siblings — they own their own header + back-link.
 */
export const BANKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./banks-shell.component').then((m) => m.BanksShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'registry' },
      {
        path: 'registry',
        loadComponent: () => import('./banks-list.page').then((m) => m.BanksListPage),
      },
      {
        path: 'programs',
        loadComponent: () =>
          import('../bank-programs/list/bank-programs-list.page').then(
            (m) => m.BankProgramsListPage,
          ),
      },
    ],
  },
  // Program drill-downs render full-page (outside the segmented shell).
  {
    path: 'programs/new',
    loadComponent: () =>
      import('../bank-programs/form/bank-program-form.page').then((m) => m.BankProgramFormPage),
  },
  {
    path: 'programs/:programCode/edit',
    loadComponent: () =>
      import('../bank-programs/form/bank-program-form.page').then((m) => m.BankProgramFormPage),
  },
  {
    path: 'programs/:programCode',
    loadComponent: () =>
      import('../bank-programs/detail/bank-program-detail.page').then(
        (m) => m.BankProgramDetailPage,
      ),
  },
];
