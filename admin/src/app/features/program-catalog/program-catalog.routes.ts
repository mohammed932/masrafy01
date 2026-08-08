import type { Routes } from '@angular/router';

/**
 * Program catalog — the predefined loan program names (`program_name`
 * enumeration).
 *
 * A LIST and a DETAIL, not a tab shell. The shell that used to sit here fanned
 * out to two assignment boards (loan categories, questions), each rendering every
 * name against every category — so configuring one name meant visiting two
 * screens and holding a 16×4 matrix in your head to compare them. Both facts
 * belong to a single name, so they live on that name's own page, opened from its
 * card like every other object in this dashboard.
 *
 * Super-admin only; the role gate lives on `canMatch` at the parent mount in
 * app.routes.ts and covers this whole subtree. Lazy-loaded.
 */
export const PROGRAM_CATALOG_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./program-catalog.page').then((m) => m.ProgramCatalogPage),
  },
  {
    // The catalog KEY, not the id: it is stable, human-readable, and already the
    // value every other surface (`bank_program.programNameKey`) stores.
    path: ':key',
    loadComponent: () => import('./program-name-detail.page').then((m) => m.ProgramNameDetailPage),
  },
];
