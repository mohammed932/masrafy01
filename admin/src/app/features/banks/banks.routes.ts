import type { Routes } from '@angular/router';

export const BANKS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./banks-list.page').then((m) => m.BanksListPage),
  },
];
