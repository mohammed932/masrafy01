import type { Routes } from '@angular/router';

/**
 * Feature 010 admin routes — the GLOBAL question pool. Two tabs over ONE pool:
 * `questions` authors it (one library, v32.1.0 — the `?basis=` split of v31.8.0 is gone), and
 * `engine-rules` (the "Fixed questions" tab) lists the fixed questions, split by side (Income
 * proof / Surrogate), and
 * lets only answers' wording change (v30.12.0, narrowed v30.13.0, split v30.16.0 — the path is
 * kept so links survive). Role gating applied at the parent mount in app.routes.ts.
 *
 * `categories` — the Loan categories tab — is gone (v32.0.0): a question carries no loan type,
 * and which questions a program asks is set on the program's own page in the Program catalog.
 * The path redirects so an old bookmark lands on the questions rather than on the 404.
 *
 * The tabs are ROUTES rather than panels so a deep link (and the browser's back button) lands
 * on the tab the admin was actually on.
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
      { path: 'categories', redirectTo: 'questions' },
      {
        path: 'engine-rules',
        loadComponent: () =>
          import('./engine-rules/engine-rules.page').then((m) => m.EngineRulesPageComponent),
      },
    ],
  },
];
