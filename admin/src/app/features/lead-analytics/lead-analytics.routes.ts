import type { Routes } from '@angular/router';

export const LEAD_ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./lead-analytics.page').then((m) => m.LeadAnalyticsPage),
  },
];
