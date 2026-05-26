import type { Routes } from '@angular/router';

export const CUSTOMERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./customers-list.page').then((m) => m.CustomersListPage),
  },
];
