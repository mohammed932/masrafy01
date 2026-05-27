import { HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attach a fresh UUID v4 as X-Correlation-Id to every outgoing backend request.
 * Backend echoes it in the response + binds it to log lines for the request.
 * Skips third-party absolute URLs (e.g. S3 presigned uploads) so unsigned
 * headers don't break their CORS contract.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) {
    return next(req);
  }
  const cloned: HttpRequest<unknown> = req.clone({
    setHeaders: { 'X-Correlation-Id': uuidv4() },
  });
  return next(cloned);
};
