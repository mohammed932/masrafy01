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
    // People — Staff + Customers under one nav entry, one search box, two
    // cohort segments (`/people/staff`, `/people/customers`). Per-cohort role
    // gates live in PEOPLE_ROUTES; this gate is the union of the two.
    path: 'people',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'analyst'])],
    loadChildren: () => import('./features/people/people.routes').then((m) => m.PEOPLE_ROUTES),
  },
  // Legacy paths — the two rosters merged into the People directory.
  { path: 'users', pathMatch: 'full', redirectTo: 'people/staff' },
  { path: 'customers', pathMatch: 'full', redirectTo: 'people/customers' },
  // Legacy paths — the flat program list is gone; programs live under their bank.
  // Bare list → registry; deep program links → the kept flat program pages.
  { path: 'bank-programs', pathMatch: 'full', redirectTo: 'banks' },
  { path: 'bank-programs/new', redirectTo: 'banks/programs/new' },
  { path: 'bank-programs/:programCode/edit', redirectTo: 'banks/programs/:programCode/edit' },
  { path: 'bank-programs/:programCode', redirectTo: 'banks/programs/:programCode' },
  {
    path: 'applications',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'sales_agent', 'analyst'])],
    loadChildren: () =>
      import('./features/applications/applications.routes').then((m) => m.APPLICATIONS_ROUTES),
  },
  {
    path: 'banks',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager', 'sales_agent', 'analyst'])],
    loadChildren: () => import('./features/banks/banks.routes').then((m) => m.BANKS_ROUTES),
  },
  {
    path: 'lookups',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin'])],
    loadChildren: () => import('./features/lookups/lookups.routes').then((m) => m.LOOKUPS_ROUTES),
  },
  {
    // Program catalog — CRUD for predefined loan program names (program_name enum).
    path: 'program-catalog',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin'])],
    loadChildren: () =>
      import('./features/program-catalog/program-catalog.routes').then(
        (m) => m.PROGRAM_CATALOG_ROUTES,
      ),
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
    // Feature 009 — per-program scoring weights (direct save, v5.0.0).
    path: 'scoring',
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
      import('./features/questionnaire/matching-simulator.page').then(
        (m) => m.MatchingSimulatorPage,
      ),
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
