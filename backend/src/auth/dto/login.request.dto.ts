import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password!: string;
}
