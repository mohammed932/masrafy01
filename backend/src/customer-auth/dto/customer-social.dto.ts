import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SocialGoogleSignInDto {
  @ApiProperty()
  @IsString()
  @Length(20, 4096)
  idToken!: string;
}

export class SocialLoginDto {
  @ApiProperty()
  @IsString()
  @Length(20, 128)
  socialSessionId!: string;
}
