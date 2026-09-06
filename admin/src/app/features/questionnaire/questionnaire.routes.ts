import type { Routes } from '@angular/router';

/**
 * Feature 010 admin routes — the GLOBAL question pool. Two tabs over ONE pool:
 * `questions` authors it, `categories` assigns each question to the loan
 * categories that ask it (many-to-many — a question can serve several). Role
 * gating applied at the parent mount in app.routes.ts.
 *
 * The tabs are ROUTES rather than panels so a deep link (and the browser's back
 * button) lands on the tab the admin was actually on, and so the 2 400-line pool
 * editor is not re-instantiated when the assignment tab is opened.
 */
export const QUESTIONNAIRE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./questionnaire-shell.page').then((m) => m.QuestionnaireShellPage),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'questions' },
      {
        path: 'questions',
        loadComponent: () =>
          import('./questionnaire-editor.page').then((m) => m.QuestionnaireEditorPage),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./question-categories.page').then((m) => m.QuestionCategoriesPage),
      },
    ],
  },
];
