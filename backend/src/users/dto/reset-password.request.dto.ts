import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ResetPasswordRequestDto {
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}
