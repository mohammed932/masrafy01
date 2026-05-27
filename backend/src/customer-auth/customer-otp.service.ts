import { Inject, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OtpPurpose } from './dto/enums';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { OtpChallengeRepository } from './otp-challenge.repository';
import { SMS_GATEWAY, type SmsGateway } from './sms/sms-gateway.interface';

/**
 * Customer OTP service — feature 008.
 *
 * Spec FR-016 / FR-017 / FR-018 / FR-019 / FR-020:
 *  * Purposes allowed: SIGNUP, PROFILE_MOBILE, FORGOT_PASSWORD, MOBILE_CHANGE.
 *  * LOGIN purpose → rejected with `OTP_PURPOSE_LOGIN_FORBIDDEN` (FR-017).
 *  * 6-digit code, 5-min TTL.
 *  * Per-mobile rate limits: 3 active in 15 min, 5 in 1 hour, 20 in 24 hours.
 *  * 60-sec resend lock.
 *  * Code bcrypt-hashed at rest (cost 10), never logged.
 */
@Injectable()
export class CustomerOtpService {
  private readonly logger = new Logger(CustomerOtpService.name);
  private static readonly CODE_LEN = 6;
  private static readonly CODE_TTL_MS = 5 * 60 * 1000;
  private static readonly BCRYPT_COST = 10;
  private static readonly RESEND_LOCK_MS = 60 * 1000;
  private static readonly ACTIVE_15M_MAX = 3;
  private static readonly HOURLY_MAX = 5;
  private static readonly DAILY_MAX = 20;

  constructor(
    private readonly otpRepo: OtpChallengeRepository,
    @Inject(SMS_GATEWAY) private readonly sms: SmsGateway,
  ) {}

  /**
   * Issue an OTP. Throws domain exceptions on rate-limit / forbidden purpose.
   * Returns the challenge metadata the client uses for verification.
   */
  async issue(args: {
    phone: string;
    purpose: OtpPurpose;
    locale: 'ar' | 'en';
    customerId?: string | null;
    correlationId: string;
  }): Promise<{
    otpId: string;
    expiresInSeconds: number;
    resendAvailableInSeconds: number;
    maskedPhone: string;
  }> {
    if ((args.purpose as string) === 'LOGIN') {
      throw new DomainException(ERROR_CODES.OTP_PURPOSE_LOGIN_FORBIDDEN);
    }

    const now = new Date();

    // 60-sec resend lock — look at the most recent issuance for the phone.
    const last = await this.otpRepo.findMostRecentForPhone(args.phone);
    if (last && now.getTime() - last.createdAt.getTime() < CustomerOtpService.RESEND_LOCK_MS) {
      const retryAfter =
        CustomerOtpService.RESEND_LOCK_MS - (now.getTime() - last.createdAt.getTime());
      throw new DomainException(ERROR_CODES.OTP_RATE_LIMITED, {
        retryAfterSeconds: Math.ceil(retryAfter / 1000),
      });
    }

    // Active codes in last 15 min.
    const since15m = new Date(now.getTime() - 15 * 60 * 1000);
    const active15m = await this.otpRepo.countActiveForPhone(args.phone, since15m);
    if (active15m >= CustomerOtpService.ACTIVE_15M_MAX) {
      throw new DomainException(ERROR_CODES.OTP_RATE_LIMITED, {
        retryAfterSeconds: 15 * 60,
      });
    }

    // Hourly + daily caps.
    const since1h = new Date(now.getTime() - 60 * 60 * 1000);
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [hourly, daily] = await Promise.all([
      this.otpRepo.countSentForPhone(args.phone, since1h),
      this.otpRepo.countSentForPhone(args.phone, since24h),
    ]);
    if (hourly >= CustomerOtpService.HOURLY_MAX) {
      throw new DomainException(ERROR_CODES.OTP_RATE_LIMITED, { retryAfterSeconds: 60 * 60 });
    }
    if (daily >= CustomerOtpService.DAILY_MAX) {
      throw new DomainException(ERROR_CODES.OTP_RATE_LIMITED, { retryAfterSeconds: 24 * 60 * 60 });
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, CustomerOtpService.BCRYPT_COST);
    const expiresAt = new Date(now.getTime() + CustomerOtpService.CODE_TTL_MS);

    const row = await this.otpRepo.create({
      customerId: args.customerId ?? null,
      phone: args.phone,
      purpose: args.purpose,
      codeHash,
      expiresAt,
    });

    await this.sms.sendOtp({
      phone: args.phone,
      code,
      locale: args.locale,
      purpose: args.purpose,
      correlationId: args.correlationId,
    });

    this.logger.log({
      msg: 'otp_issued',
      otpId: row.id,
      purpose: args.purpose,
      correlationId: args.correlationId,
    });

    return {
      otpId: row.id,
      expiresInSeconds: Math.floor(CustomerOtpService.CODE_TTL_MS / 1000),
      resendAvailableInSeconds: Math.floor(CustomerOtpService.RESEND_LOCK_MS / 1000),
      maskedPhone: maskPhone(args.phone),
    };
  }

  /**
   * Verify a code against an active OTP. On success, marks the row consumed
   * (returns the row + its phone + purpose so callers can branch). On
   * mismatch, decrements attempts and throws OTP_INVALID. On 0 attempts,
   * throws OTP_ATTEMPTS_EXCEEDED.
   */
  async verify(args: {
    otpId: string;
    code: string;
    purpose: OtpPurpose;
  }): Promise<{ phone: string; customerId: string | null }> {
    const row = await this.otpRepo.findById(args.otpId);
    if (!row) throw new DomainException(ERROR_CODES.OTP_INVALID);
    // Prisma enum + local enum share identical string values — compare as strings.
    if ((row.purpose as string) !== (args.purpose as string)) {
      throw new DomainException(ERROR_CODES.OTP_INVALID);
    }
    if (row.consumedAt) throw new DomainException(ERROR_CODES.OTP_CONSUMED);
    if (row.expiresAt.getTime() < Date.now()) throw new DomainException(ERROR_CODES.OTP_EXPIRED);
    if (row.attemptsLeft <= 0) throw new DomainException(ERROR_CODES.OTP_ATTEMPTS_EXCEEDED);

    const ok = await bcrypt.compare(args.code, row.codeHash);
    if (!ok) {
      await this.otpRepo.decrementAttempts(row.id);
      throw new DomainException(ERROR_CODES.OTP_INVALID);
    }

    await this.otpRepo.consume(row.id);
    return { phone: row.phone, customerId: row.customerId };
  }

  private generateCode(): string {
    const max = 10 ** CustomerOtpService.CODE_LEN;
    const n = crypto.randomInt(0, max);
    return n.toString().padStart(CustomerOtpService.CODE_LEN, '0');
  }
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return '••••';
  return `${phone.slice(0, 3)}••••••${phone.slice(-4)}`;
}
