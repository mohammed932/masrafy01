import type { Routes } from '@angular/router';
import { authGuardFn } from './core/guards/auth.guard.fn';
import { mcpGuardFn } from './core/guards/mcp.guard.fn';
import { roleGuardFn } from './core/guards/role.guard.fn';

/**
 * Lazy-only route table (Principle XXV). US1 fills in /login, /auth/change-password,
 * /auth/self-password. /dashboard is a placeholder until the first dashboard
 * widget lands (a later spec). /users lands in US3.
 */
export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'auth',
    canActivate: [authGuardFn],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'dashboard',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn],
    loadComponent: () =>
      import('./features/shell/dashboard-placeholder.component').then(
        (m) => m.DashboardPlaceholderComponent,
      ),
  },
  {
    path: 'users',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin'])],
    loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: 'bank-programs',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'sales_agent', 'analyst'])],
    loadChildren: () =>
      import('./features/bank-programs/bank-programs.routes').then((m) => m.BANK_PROGRAMS_ROUTES),
  },
  {
    path: 'applications',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'sales_agent', 'analyst'])],
    loadChildren: () =>
      import('./features/applications/applications.routes').then((m) => m.APPLICATIONS_ROUTES),
  },
  {
    path: 'customers',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'analyst'])],
    loadChildren: () =>
      import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
  },
  {
    path: 'lead-analytics',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'analyst'])],
    loadChildren: () =>
      import('./features/lead-analytics/lead-analytics.routes').then(
        (m) => m.LEAD_ANALYTICS_ROUTES,
      ),
  },
  {
    path: 'banks',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'sales_agent', 'analyst'])],
    loadChildren: () =>
      import('./features/banks/banks.routes').then((m) => m.BANKS_ROUTES),
  },
  {
    path: 'lookups',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin'])],
    loadChildren: () =>
      import('./features/lookups/lookups.routes').then((m) => m.LOOKUPS_ROUTES),
  },
  {
    // Feature 009 — dynamic questionnaire (overview + tree editor).
    path: 'questionnaire',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager'])],
    loadChildren: () =>
      import('./features/questionnaire/questionnaire.routes').then((m) => m.QUESTIONNAIRE_ROUTES),
  },
  {
    // Feature 009 — scoring-weight maker-checker (own prefix → single active nav tab).
    path: 'scoring-approvals',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager'])],
    loadChildren: () =>
      import('./features/questionnaire/scoring.routes').then((m) => m.SCORING_ROUTES),
  },
  {
    // Admin matching simulator — full engine + approval scoring, read-only.
    path: 'matching-simulator',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'analyst'])],
    loadComponent: () =>
      import('./features/questionnaire/matching-simulator.page').then((m) => m.MatchingSimulatorPage),
  },
  {
    // Throwaway: NG-ZORRO install verification. Removed in PR 2 (shell migration).
    path: 'nz-demo',
    loadComponent: () => import('./features/nz-demo/nz-demo.page').then((m) => m.NzDemoPage),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
