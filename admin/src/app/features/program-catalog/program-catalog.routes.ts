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
    // Authoring a question is its own SCREEN, not a dialog over the name: the form
    // branches on the answer type, grows a list of answers and can hold twenty fields.
    // Declared before `:key` so the intent is on the page — a leaf route matches the
    // whole remaining URL, so a three-segment path could not resolve as a name anyway.
    path: ':key/questions/new',
    loadComponent: () => import('./new-question.page').then((m) => m.NewQuestionPage),
  },
  {
    // The catalog KEY, not the id: it is stable, human-readable, and already the
    // value every other surface (`bank_program.programNameKey`) stores.
    path: ':key',
    loadComponent: () => import('./program-name-detail.page').then((m) => m.ProgramNameDetailPage),
  },
];
