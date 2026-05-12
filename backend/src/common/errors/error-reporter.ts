import { Injectable, Logger } from '@nestjs/common';
import type { ErrorCode } from './error-codes';

/**
 * Backend-side error reporter scaffold (T158).
 *
 * Disabled by default. Replace `dispatch()` with a real SDK call once the
 * team picks one. Pino redact paths already strip PII before lines reach
 * any sink; this class adds a structured per-error event that an SDK can
 * forward.
 */
export interface BackendErrorContext {
  code?: ErrorCode;
  correlationId?: string;
  actorId?: string | null;
  /** Free-form structured context. Constitution VI: no PII or credentials. */
  extras?: Record<string, string | number | boolean>;
}

@Injectable()
export class ErrorReporter {
  private readonly enabled = false;
  private readonly log = new Logger(ErrorReporter.name);

  report(err: unknown, ctx: BackendErrorContext = {}): void {
    if (!this.enabled) return;
    this.dispatch(err, ctx);
  }

  private dispatch(err: unknown, ctx: BackendErrorContext): void {
    this.log.error({
      msg: 'error_reported',
      code: ctx.code,
      correlationId: ctx.correlationId,
      actorId: ctx.actorId,
      extras: ctx.extras,
      // Stack only — message could contain leaked context. Truncate.
      stack: err instanceof Error ? (err.stack ?? '').slice(0, 4000) : undefined,
    });
  }
}
