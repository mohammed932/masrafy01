import type { Routes } from '@angular/router';

/**
 * Lazy-loaded feature routes for the BankProgram Management surface (feature 002).
 * Role gating via `roleGuardFn` is applied at the parent `/bank-programs` mount in app.routes.ts
 * — all four roles (super_admin, sales_manager, sales_agent, analyst) may read; write
 * actions are gated per-row inside the list component via `*can="['super_admin', 'sales_manager']"`.
 */
export const BANK_PROGRAMS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./list/bank-programs-list.page').then((m) => m.BankProgramsListPage),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./form/bank-program-form.page').then((m) => m.BankProgramFormPage),
  },
  {
    path: ':programCode/edit',
    loadComponent: () =>
      import('./form/bank-program-form.page').then((m) => m.BankProgramFormPage),
  },
  {
    path: ':programCode',
    loadComponent: () =>
      import('./detail/bank-program-detail.page').then((m) => m.BankProgramDetailPage),
  },
];
