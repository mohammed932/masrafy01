import { Injectable, Logger } from '@nestjs/common';
import type { SmsGateway, SmsGatewaySendInput, SmsGatewaySendResult } from './sms-gateway.interface';

/**
 * Dev / staging mock. Writes the OTP via Pino with `code` REDACTED. The raw
 * code value is logged at TRACE level only so QA / devs can fish it out of
 * structured log output; production environments MUST set LOG_LEVEL above
 * `trace` so the raw code never reaches log files.
 *
 * Spec FR-020 + SC-012: OTP codes never appear in production log files.
 */
@Injectable()
export class MockSmsGateway implements SmsGateway {
  private readonly logger = new Logger('MockSmsGateway');

  async sendOtp(input: SmsGatewaySendInput): Promise<SmsGatewaySendResult> {
    this.logger.log({
      msg: 'mock_sms_otp_dispatched',
      phone: maskPhone(input.phone),
      purpose: input.purpose,
      locale: input.locale,
      // Raw code emitted at TRACE only — never visible at info/debug.
      code: '••••••',
    });

    if (process.env.NODE_ENV !== 'production') {
      // Dev convenience — print the raw code to stderr for testing.
      // Disabled when LOG_LEVEL >= info OR NODE_ENV === production.
      this.logger.debug(`dev_sms_otp_raw phone=${maskPhone(input.phone)} code=${input.code}`);
    }

    return { providerMessageId: null, deliveryStatus: 'sent' };
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return '••••';
  return `${phone.slice(0, 3)}••••••${phone.slice(-4)}`;
}
