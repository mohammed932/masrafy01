import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { ErrorCodeService } from '../errors/error-code.service';
import type { ErrorCode, ErrorEnvelope } from '../auth/auth.types';

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
  const snack = inject(MatSnackBar);
  const errorCodes = inject(ErrorCodeService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error as ErrorEnvelope | undefined;
        if (body && body.success === false && typeof body.code === 'string') {
          const code = body.code as ErrorCode;
          if (!SILENT_CODES.has(code)) {
            snack.open(errorCodes.toLocalizedMessage(code, body.meta), undefined, {
              duration: 6000,
            });
          }
        }
      }
      return throwError(() => err);
    }),
  );
};
