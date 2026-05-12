import type { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'self-password',
  },
  {
    path: 'change-password',
    loadComponent: () =>
      import('./forced-change.page').then((m) => m.ForcedChangePage),
  },
  {
    path: 'self-password',
    loadComponent: () =>
      import('./self-change.page').then((m) => m.SelfChangePage),
  },
];
