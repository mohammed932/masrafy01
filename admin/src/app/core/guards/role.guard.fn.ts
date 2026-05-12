import { CanMatchFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import type { StaffRole } from '../auth/auth.types';

/**
 * Factory returning a functional `canMatchFn` that admits only signed-in users
 * whose role is in `allowed`. Insufficient role redirects to /dashboard (the
 * route never matches, so the unauthorised state is not even rendered).
 */
export function roleGuardFn(allowed: ReadonlyArray<StaffRole>): CanMatchFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.role();
    if (role && allowed.includes(role)) return true;
    return router.createUrlTree(['/dashboard']);
  };
}
