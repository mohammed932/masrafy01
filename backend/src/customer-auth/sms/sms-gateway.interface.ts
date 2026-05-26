/**
 * Abstract SMS gateway. Implementations (feature 008):
 *  - `MockSmsGateway` — dev only; writes the OTP via Pino with code redacted.
 *  - `<EgyptianVendor>SmsGateway` — production (vendor selection is an ops
 *    decision; not in this spec).
 *
 * The gateway MUST mask `code` in every log line (handled by Pino redaction
 * in production; the mock impl does it inline).
 */
export interface SmsGateway {
  /**
   * Dispatches an OTP code. `correlationId` is logged with the request.
   * Returns the provider's message identifier (or `null` for the mock impl).
   */
  sendOtp(input: SmsGatewaySendInput): Promise<SmsGatewaySendResult>;
}

export interface SmsGatewaySendInput {
  phone: string;
  code: string;
  locale: 'ar' | 'en';
  purpose: string;
  correlationId: string;
}

export interface SmsGatewaySendResult {
  providerMessageId: string | null;
  deliveryStatus: 'queued' | 'sent' | 'failed';
}

export const SMS_GATEWAY = Symbol('SmsGateway');
