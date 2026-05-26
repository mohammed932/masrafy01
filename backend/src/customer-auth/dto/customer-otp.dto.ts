import { IsIn, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const PHONE_REGEX = /^[+\d][\d\s\-]{8,19}$/;
const PURPOSES = ['SIGNUP', 'PROFILE_MOBILE', 'FORGOT_PASSWORD', 'MOBILE_CHANGE'] as const;
const LOCALES = ['ar', 'en'] as const;

export class OtpRequestDto {
  @ApiProperty({ example: '+201001234567' })
  @IsString()
  @Matches(PHONE_REGEX)
  phone!: string;

  @ApiProperty({ enum: PURPOSES })
  @IsString()
  @IsIn(PURPOSES as readonly string[])
  purpose!: (typeof PURPOSES)[number];

  @ApiProperty({ enum: LOCALES, default: 'ar' })
  @IsString()
  @IsIn(LOCALES as readonly string[])
  locale!: (typeof LOCALES)[number];
}

export class OtpVerifyDto {
  @ApiProperty()
  @IsString()
  @Length(20, 64)
  otpId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @ApiProperty({ enum: PURPOSES })
  @IsString()
  @IsIn(PURPOSES as readonly string[])
  purpose!: (typeof PURPOSES)[number];
}

export class OtpRequestResponseDto {
  @ApiProperty() otpId!: string;
  @ApiProperty() maskedPhone!: string;
  @ApiProperty() expiresInSeconds!: number;
  @ApiProperty() resendAvailableInSeconds!: number;
}

export class OtpVerifyResponseDto {
  @ApiProperty() verifiedMobileToken?: string;
  @ApiProperty() passwordResetToken?: string;
  @ApiProperty() phone?: string;
  @ApiProperty() expiresInSeconds?: number;
}
