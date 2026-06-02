import type { Routes } from '@angular/router';

/**
 * Feature 009 admin routes — scoring-weight maker-checker (Constitution V).
 * Mounted at `/scoring-approvals` (app.routes.ts), separate from the
 * `/questionnaire` tree so the two sidebar entries keep distinct path prefixes
 * and only one nav tab is ever active.
 */
export const SCORING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./scoring-approvals.page').then((m) => m.ScoringApprovalsPage),
  },
  {
    path: 'weights/:category/:programId',
    loadComponent: () =>
      import('./scoring-weights-editor.page').then((m) => m.ScoringWeightsEditorPage),
  },
];
