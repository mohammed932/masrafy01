import type { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./users-list.page').then((m) => m.UsersListPage),
  },
];
