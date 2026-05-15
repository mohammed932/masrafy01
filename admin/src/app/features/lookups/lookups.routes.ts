import type { Routes } from '@angular/router';

export const LOOKUPS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./lookups.page').then((m) => m.LookupsPage),
  },
];
