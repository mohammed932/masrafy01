import type { Routes } from '@angular/router';

/** Ready methods (v37.0.0): the list, and one method to add or change. */
export const READY_METHODS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./ready-methods.page').then((m) => m.ReadyMethodsPage),
  },
  {
    // `new` is a key too: the edit page reads it as "add one".
    path: ':key',
    loadComponent: () => import('./ready-method-edit.page').then((m) => m.ReadyMethodEditPage),
  },
];
