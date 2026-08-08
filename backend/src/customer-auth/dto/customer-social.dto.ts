import { IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SocialGoogleSignInDto {
  @ApiProperty()
  @IsString()
  @Length(20, 4096)
  idToken!: string;

  /**
   * OAuth access token from the same device sign-in. Used ONLY to read the
   * birthday from the People API when the customer granted the
   * `user.birthday.read` scope — never for identity, which comes from the
   * signature-verified `idToken`. Absent when the scope was declined.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(20, 4096)
  accessToken?: string;
}

export class SocialLoginDto {
  @ApiProperty()
  @IsString()
  @Length(20, 128)
  socialSessionId!: string;
}
