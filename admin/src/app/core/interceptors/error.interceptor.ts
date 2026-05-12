import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService, SKIP_ERROR_INTERCEPTOR } from '../auth/auth.service';
import type { ErrorCode, ErrorEnvelope } from '../auth/auth.types';

/**
 * Code-driven routing per contracts/error-codes.md Failure-Mode Routing table.
 *
 *   AUTH_TOKEN_EXPIRED  → call /auth/refresh, retry original ONCE with the
 *                          new bearer; on refresh failure → clear + /login.
 *   AUTH_REFRESH_INVALID
 *   AUTH_TOKEN_INVALID
 *   AUTH_TOKEN_MISSING  → clear + /login (preserve intended URL).
 *   MUST_CHANGE_PASSWORD → /auth/change-password.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_ERROR_INTERCEPTOR)) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) return throwError(() => err);
      const code = readCode(err);
      if (!code) return throwError(() => err);

      if (code === 'AUTH_TOKEN_EXPIRED') {
        return from(auth.refresh()).pipe(
          switchMap((newToken) => {
            const retried: HttpRequest<unknown> = req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` },
            });
            return next(retried);
          }),
          catchError((refreshErr: unknown) => {
            auth.clear();
            void router.navigate(['/login'], { queryParams: { next: router.url } });
            return throwError(() => refreshErr);
          }),
        );
      }

      switch (code) {
        case 'AUTH_REFRESH_INVALID':
        case 'AUTH_TOKEN_INVALID':
        case 'AUTH_TOKEN_MISSING':
          auth.clear();
          void router.navigate(['/login'], { queryParams: { next: router.url } });
          break;
        case 'MUST_CHANGE_PASSWORD':
          void router.navigate(['/auth/change-password']);
          break;
        default:
          break;
      }
      return throwError(() => err);
    }),
  );
};

function readCode(err: HttpErrorResponse): ErrorCode | null {
  const body = err.error as ErrorEnvelope | undefined;
  if (body && body.success === false && typeof body.code === 'string') {
    return body.code as ErrorCode;
  }
  return null;
}
