import type { Routes } from '@angular/router';

/**
 * Feature 009 admin routes — per-program scoring weights (Constitution V v5.0.0,
 * direct save). Mounted at `/scoring` (app.routes.ts); reached from a bank
 * program's detail page. No maker-checker / approvals inbox.
 */
export const SCORING_ROUTES: Routes = [
  {
    path: 'weights/:programId',
    loadComponent: () =>
      import('./scoring-weights-editor.page').then((m) => m.ScoringWeightsEditorPage),
  },
];
