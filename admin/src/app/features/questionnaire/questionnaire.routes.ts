import type { Routes } from '@angular/router';

/**
 * Feature 009 admin routes — questionnaire overview + tree editor.
 * Role gating applied at the parent mount in app.routes.ts. Scoring-weight
 * approvals live under their own `/scoring-approvals` mount (SCORING_ROUTES) so
 * the two sidebar destinations never share a path prefix (single active tab).
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
