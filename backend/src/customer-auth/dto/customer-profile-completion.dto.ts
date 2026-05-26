import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * SOCIAL Complete-Profile flow (feature 008) — mobile-binding for the
 * authenticated lite social customer. Uses Customer JWT (not a verified-
 * mobile-token) per research R6.
 *
 *  1. `POST /v1/auth/profile/mobile-request-otp` — body: { phone }
 *  2. `POST /v1/auth/profile/mobile-verify-otp` — body: { otpId, code }
 *
 * Email + age are NOT collected here — they're held client-side and written
 * atomically with the loan-application submission (FR-009d hybrid).
 */
export class ProfileMobileRequestOtpDto {
  @ApiProperty({ example: '+201001234567' })
  @IsString()
  @Matches(/^[+\d][\d\s\-]{8,19}$/)
  phone!: string;
}

export class ProfileMobileVerifyOtpDto {
  @ApiProperty()
  @IsString()
  @Length(20, 64)
  otpId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
