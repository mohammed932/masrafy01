import type { Routes } from '@angular/router';

/**
 * Feature 009 admin routes — questionnaire overview + tree editor.
 * Role gating applied at the parent mount in app.routes.ts. Per-program scoring
 * weights live under the `/scoring` mount (SCORING_ROUTES), reached from a bank
 * program's detail page.
 */
export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./questionnaire-overview.page').then((m) => m.QuestionnaireOverviewPage),
  },
  {
    path: 'edit/:category',
    loadComponent: () =>
      import('./questionnaire-editor.page').then((m) => m.QuestionnaireEditorPage),
  },
];
