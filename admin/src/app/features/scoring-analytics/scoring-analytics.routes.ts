import type { Routes } from '@angular/router';

/**
 * Lazy-loaded route for the analyst distribution + per-tier accuracy view.
 * Role gating applied at the parent `/scoring-analytics` mount.
 */
export const SCORING_ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./scoring-analytics.page').then((m) => m.ScoringAnalyticsPage),
  },
];
