import type { Routes } from '@angular/router';

/**
 * Lazy-loaded feature routes for the BankProgram Management surface (feature 002).
 * Role gating via `roleGuardFn` is applied at the parent `/bank-programs` mount in app.routes.ts
 * — all three roles (SUPER_ADMIN, ADMIN, VIEWER) may read; write actions are gated per-row
 * inside the list component via `*can="['ADMIN', 'SUPER_ADMIN']"`.
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
