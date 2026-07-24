import type { Routes } from '@angular/router';

/**
 * Feature 010 admin routes — the single GLOBAL question-pool builder (questions
 * carry no category). Role gating applied at the parent mount in app.routes.ts.
 * Per-program scoring weights (assign + weight + score) live under the
 * `/scoring` mount (SCORING_ROUTES), reached from a bank program's detail page.
 */
export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./questionnaire-editor.page').then((m) => m.QuestionnaireEditorPage),
  },
];
