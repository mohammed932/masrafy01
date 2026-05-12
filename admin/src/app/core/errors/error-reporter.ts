import { Injectable, inject } from '@angular/core';
import { ErrorCodeService } from './error-code.service';
import type { ErrorCode } from '../auth/auth.types';

/**
 * Disabled-by-default error reporter scaffold (T158).
 *
 * Wired but inert until `NG_SENTRY_DSN` (or equivalent build-time env) is
 * present. Replace the `dispatch()` body with a real SDK call (Sentry,
 * Bugsnag, etc.) when the team chooses one. Keep the public surface stable.
 *
 * Constitution VI: NEVER include PII, raw error messages with secrets, or
 * tokens in the reported payload. Always go through ErrorCodeService for
 * user-visible strings.
 */
export interface ErrorReportContext {
  code?: ErrorCode;
  correlationId?: string;
  route?: string;
  /** Free-form structured context. MUST NOT contain PII or credentials. */
  extras?: Record<string, string | number | boolean>;
}

@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly enabled = false; // toggle via env-driven build-time replacement when an SDK lands

  report(err: unknown, ctx: ErrorReportContext = {}): void {
    if (!this.enabled) return;
    this.dispatch(err, ctx);
  }

  /** Localised user-facing summary, never the raw error message. */
  userMessage(code: ErrorCode, meta?: Record<string, unknown>): string {
    return this.errorCodes.toLocalizedMessage(code, meta);
  }

  private dispatch(_err: unknown, _ctx: ErrorReportContext): void {
    // Placeholder: integrate Sentry / Bugsnag / OpenTelemetry SDK here.
    // Until then, this is a noop so the rest of the app can call
    // ErrorReporter without changes when the SDK is added.
  }
}
