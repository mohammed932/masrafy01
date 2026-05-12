import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Conditional shape: when JWT.mcp=true the controller ignores currentPassword.
 * Server-side branching reads `mcp` from the JWT, NEVER from the body, so a
 * client cannot opt out of verifying its current password.
 */
export class PasswordChangeRequestDto {
  @ApiProperty({ required: false, maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}
