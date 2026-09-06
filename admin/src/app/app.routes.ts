import type { Routes } from '@angular/router';
import { authGuardFn } from './core/guards/auth.guard.fn';
import { mcpGuardFn } from './core/guards/mcp.guard.fn';
import { roleGuardFn } from './core/guards/role.guard.fn';

/**
 * Lazy-only route table (Principle XXV). US1 fills in /login, /auth/change-password,
 * /auth/self-password. /dashboard is the operations desk (features/shell/dashboard).
 * /users lands in US3.
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
      import('./features/shell/dashboard/dashboard.page').then((m) => m.DashboardPage),
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
  // Legacy paths — surrogate products were their own top-level section and are now the
  // catalog's `products/` subtree. Every shape is listed rather than one wildcard: Angular
  // cannot carry a `:key` through a `**` redirect, and a bookmark to one product's
  // calculation is exactly the link worth keeping alive.
  { path: 'surrogate-products', pathMatch: 'full', redirectTo: 'program-catalog/products' },
  { path: 'surrogate-products/new', redirectTo: 'program-catalog/products/new' },
  {
    path: 'surrogate-products/:key/calculation',
    redirectTo: 'program-catalog/products/:key/calculation',
  },
  // The by-hand "add an ask" screen is gone; the product's own page is where its asks are
  // read now, so an old bookmark lands there rather than nowhere.
  { path: 'surrogate-products/:key/asks/new', redirectTo: 'program-catalog/products/:key' },
  { path: 'surrogate-products/:key', redirectTo: 'program-catalog/products/:key' },
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
    // Dynamic questionnaire — tab shell: `questions` (pool builder) +
    // `categories` (which loan categories ask each question, v12.0.0).
    path: 'questionnaire',
    canActivate: [authGuardFn],
    canMatch: [mcpGuardFn, roleGuardFn(['super_admin', 'sales_manager'])],
    loadChildren: () =>
      import('./features/questionnaire/questionnaire.routes').then((m) => m.QUESTIONNAIRE_ROUTES),
  },
  {
    // Admin matching simulator — full pricing engine, read-only.
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
