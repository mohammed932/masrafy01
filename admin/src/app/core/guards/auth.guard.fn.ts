import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Functional auth guard (Principle XXV). Redirects to /login preserving the
 * intended destination as ?next=<url>.
 */
export const authGuardFn: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};
