import {
  HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { v4 as uuidv4 } from 'uuid';

/**
 * Attach a fresh UUID v4 as X-Correlation-Id to every outgoing request.
 * Backend echoes it in the response + binds it to log lines for the request.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const cloned: HttpRequest<unknown> = req.clone({
    setHeaders: { 'X-Correlation-Id': uuidv4() },
  });
  return next(cloned);
};
