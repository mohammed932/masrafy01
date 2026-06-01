import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { deriveAge } from '../age.util';

/**
 * Egyptian mobile phone — accepts +20 prefix or local 0 prefix; we
 * canonicalise to E.164 in the service before storing. Loose regex so the
 * UI can present a cleaner formatter without rejecting whitespace.
 */
const PHONE_REGEX = /^[+\d][\d\s\-]{8,19}$/;

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
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional({ description: 'Derived from birthday — never stored (Principle XXXVII).' })
  age?: number;
  @ApiProperty() locale!: string;
  @ApiProperty() isVerified!: boolean;
  @ApiProperty({ description: 'True once the mandatory profile is complete (Principle XXXVII).' })
  profileComplete!: boolean;
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

export interface CustomerProfileRow {
  id: string;
  phone: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
  birthday: Date | null;
  locale: string;
  isVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

/**
 * Shared customer-profile mapper. Age is derived from `birthday` here and
 * never stored (Principle XXXVII). `profileComplete` is computed by the
 * caller via `CustomerProfileCompletenessService`.
 */
export function mapCustomerProfile(
  row: CustomerProfileRow,
  profileComplete: boolean,
): CustomerProfileResponseDto {
  const age = deriveAge(row.birthday);
  return {
    id: row.id,
    phone: row.phone ?? '',
    email: row.email ?? undefined,
    firstName: row.firstName,
    lastName: row.lastName,
    age: age ?? undefined,
    locale: row.locale,
    isVerified: row.isVerified,
    profileComplete,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : undefined,
  };
}
