import type { Routes } from '@angular/router';

/**
 * Banks workspace routes. The `/banks` mount (app.routes.ts) gates all roles
 * (super_admin, sales_manager, sales_agent, analyst) for read; write actions
 * are gated per-row inside the list/detail/form components.
 *
 * IA: the registry (`''`) lists banks; pressing a bank drills into its detail
 * page (`:bankId`), which holds that bank's programs. Program create/edit/detail
 * keep flat `programs/*` paths (programCode is globally unique). The `programs/*`
 * routes MUST precede `:bankId` so a UUID never shadows them.
 */
export const BANKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./banks-list.page').then((m) => m.BanksListPage),
  },
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
  {
    path: ':bankId',
    loadComponent: () => import('./bank-detail.page').then((m) => m.BankDetailPage),
  },
];
