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
    loadComponent: () =>
      import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'auth',
    canActivate: [authGuardFn],
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
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
    loadChildren: () =>
      import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
