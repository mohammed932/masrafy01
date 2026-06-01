import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Two-step PHONE signup (Constitution v4.0.0).
 *  1. `POST /v1/auth/signup/phone/start` → DTO `CustomerSignupPhoneStartDto`
 *     (mobile + locale) — sends OTP via `customer-otp.service`.
 *  2. (caller calls `POST /v1/auth/otp/verify` with purpose=SIGNUP — returns
 *      a `verifiedMobileToken`.)
 *  3. `POST /v1/auth/signup/phone/verify` → DTO `CustomerSignupPhoneVerifyDto`
 *     (verifiedMobileToken only) — creates a LITE PHONE customer + issues
 *     tokens. firstName/lastName/birthday/photo/National ID/password are then
 *     collected by `POST /v1/auth/profile/complete` (Principle XXXVII).
 */
const LOCALES = ['ar', 'en'] as const;

export class CustomerSignupPhoneStartDto {
  @ApiProperty({ example: '+201001234567' })
  @IsString()
  @Matches(/^[+\d][\d\s\-]{8,19}$/)
  phone!: string;

  @ApiProperty({ enum: LOCALES, default: 'ar' })
  @IsString()
  locale!: (typeof LOCALES)[number];
}

export class CustomerSignupPhoneVerifyDto {
  @ApiProperty()
  @IsString()
  @Length(20, 128)
  verifiedMobileToken!: string;

  @ApiPropertyOptional({ enum: ['ar-EG', 'en-US'], default: 'ar-EG' })
  @IsOptional()
  @IsString()
  locale?: string;
}
