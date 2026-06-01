import type { Routes } from '@angular/router';

/**
 * Feature 009 admin routes — questionnaire overview + scoring-weight approvals.
 * Role gating applied at the parent mount in app.routes.ts. The full tree editor
 * (groups/questions/options) is a follow-up screen.
 */
export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./questionnaire-overview.page').then((m) => m.QuestionnaireOverviewPage),
  },
  {
    path: 'approvals',
    loadComponent: () =>
      import('./scoring-approvals.page').then((m) => m.ScoringApprovalsPage),
  },
];
