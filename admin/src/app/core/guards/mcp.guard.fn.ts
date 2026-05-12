import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Forced-password-change router. When the authenticated user has
 * mustChangePassword=true, every match attempt for a route that is NOT the
 * forced-change page redirects to /auth/change-password.
 */
export const mcpGuardFn: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.mustChangePassword()) {
    return true;
  }
  const path = '/' + segments.map((s) => s.path).join('/');
  if (path === '/auth/change-password') {
    return true;
  }
  return router.createUrlTree(['/auth/change-password']);
};
