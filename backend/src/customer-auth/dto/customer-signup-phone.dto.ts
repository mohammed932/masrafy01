import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Two-step PHONE signup (feature 008).
 *  1. `POST /v1/auth/signup/phone/start` → DTO `CustomerSignupPhoneStartDto`
 *     (mobile + locale) — sends OTP via `customer-otp.service`.
 *  2. (caller calls `POST /v1/auth/otp/verify` with purpose=SIGNUP — returns
 *      a `verifiedMobileToken`.)
 *  3. `POST /v1/auth/signup/phone/complete` → DTO
 *     `CustomerSignupPhoneCompleteDto` (verifiedMobileToken + name + email +
 *     password + age) — creates the PHONE customer.
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

export class CustomerSignupPhoneCompleteDto {
  @ApiProperty()
  @IsString()
  @Length(20, 128)
  verifiedMobileToken!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @Length(3, 320)
  email?: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;

  @ApiProperty({ minimum: 18, maximum: 80 })
  @IsInt()
  @Min(18)
  @Max(80)
  age!: number;
}
