import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { catchError, throwError } from 'rxjs';
import { ErrorCodeService } from '../errors/error-code.service';
import type { ErrorCode, ErrorEnvelope } from '../auth/auth.types';

/**
 * Opt out of the toast for a single request, mirroring `SKIP_ERROR_INTERCEPTOR`.
 *
 * For speculative reads only — a probe the caller expects to fail sometimes and
 * degrades on its own (the dashboard's dry run against an unpublished
 * questionnaire). Never set it on a request a user explicitly triggered: they
 * would get silence instead of a reason.
 */
export const SKIP_TOAST_INTERCEPTOR = new HttpContextToken<boolean>(() => false);

/**
 * Surfaces localized toasts for error codes the error-interceptor routes
 * NON-silently. Per contracts/error-codes.md Failure-Mode Routing, password
 * policy codes and auth-redirect codes are excluded — those surface as form
 * errors or trigger navigation only.
 */
const SILENT_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
  'AUTH_REFRESH_INVALID',
  'MUST_CHANGE_PASSWORD',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'PASSWORD_BREACHED',
  'PASSWORD_ON_COMMON_LIST',
  'PASSWORD_REUSES_RESET_VALUE',
  'INVALID_CURRENT_PASSWORD',
  'DUPLICATE_ENTRY',
  'VALIDATION_FAILED',
]);

export const toastInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_TOAST_INTERCEPTOR)) {
    return next(req);
  }
  const notification = inject(NzNotificationService);
  const errorCodes = inject(ErrorCodeService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as ErrorEnvelope | undefined;
        if (body && body.success === false && typeof body.code === 'string') {
          const code = body.code as ErrorCode;
          if (!SILENT_CODES.has(code)) {
            notification.error(errorCodes.toLocalizedMessage(code, body.meta), '', {
              nzDuration: 6000,
            });
          }
        }
      }
      return throwError(() => err);
    }),
  );
};
