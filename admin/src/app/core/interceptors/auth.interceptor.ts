import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService, SKIP_AUTH_INTERCEPTOR } from '../auth/auth.service';

const ADMIN_PATH_PREFIX = '/api/admin/';

/**
 * Attaches `Authorization: Bearer <accessToken>` from the AuthService signal
 * to every outbound request whose URL targets the admin API — except those
 * marked with SKIP_AUTH_INTERCEPTOR (refresh call uses the cookie only).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH_INTERCEPTOR)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const token = auth.accessToken();
  if (!token) return next(req);
  if (!req.url.includes(ADMIN_PATH_PREFIX)) return next(req);
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
