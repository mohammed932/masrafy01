import type { Routes } from '@angular/router';

/**
 * Program catalog — CRUD for the `program_name` enumeration (predefined loan
 * program names, scoped per loan category). Super-admin only; lazy-loaded.
 */
export const PROGRAM_CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./program-catalog.page').then((m) => m.ProgramCatalogPage),
  },
];
