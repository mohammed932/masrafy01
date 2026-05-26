import { IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SocialGoogleSignInDto {
  @ApiProperty()
  @IsString()
  @Length(20, 4096)
  idToken!: string;
}

export class SocialAppleSignInDto {
  @ApiProperty()
  @IsString()
  @Length(20, 4096)
  idToken!: string;

  @ApiPropertyOptional({
    description: "Apple's first-sign-in only payload (name + email).",
  })
  @IsOptional()
  userInfo?: { email?: string; fullName?: string };
}

export class SocialLoginDto {
  @ApiProperty()
  @IsString()
  @Length(20, 128)
  socialSessionId!: string;
}
