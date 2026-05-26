import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Egyptian mobile phone — accepts +20 prefix or local 0 prefix; we
 * canonicalise to E.164 in the service before storing. Loose regex so the
 * UI can present a cleaner formatter without rejecting whitespace.
 */
const PHONE_REGEX = /^[+\d][\d\s\-]{8,19}$/;

const LOCALES = ['ar-EG', 'en-US'] as const;

export class CustomerSignupRequestDto {
  @ApiProperty({ example: '+201001234567' })
  @IsString()
  @Matches(PHONE_REGEX)
  phone!: string;

  @ApiProperty({ example: 'Ahmed Hassan' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @Length(3, 320)
  email?: string;

  @ApiPropertyOptional({ enum: LOCALES, default: 'ar-EG' })
  @IsOptional()
  @IsIn(LOCALES as readonly string[])
  locale?: (typeof LOCALES)[number];
}

export class CustomerLoginRequestDto {
  @ApiProperty()
  @IsString()
  @Matches(PHONE_REGEX)
  phone!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 128)
  password!: string;
}

export class CustomerRefreshRequestDto {
  @ApiProperty()
  @IsString()
  @Length(20, 1024)
  refreshToken!: string;
}

export class CustomerLogoutRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class CustomerProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() phone!: string;
  @ApiPropertyOptional() email?: string;
  @ApiProperty() name!: string;
  @ApiProperty() locale!: string;
  @ApiProperty() isVerified!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiPropertyOptional() lastLoginAt?: string;
}

export class CustomerAuthEnvelopeDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() accessTokenExpiresIn!: number;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() refreshTokenExpiresIn!: number;
  @ApiProperty({ type: CustomerProfileResponseDto }) customer!: CustomerProfileResponseDto;
}

export const PHONE_REGEX_EXPORTED = PHONE_REGEX;

export interface CustomerJwtPayload {
  sub: string;
  typ: 'customer';
}

/** Marker only — used by Swagger and the optional-JWT guard. */
export class ApplicationClaimRequestDto {
  @ApiPropertyOptional({
    description:
      'Forces claim even if the request would otherwise be rejected for ownership mismatch. Reserved — not honoured today.',
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
