import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Forgot-password flow (PHONE customers only) — feature 008.
 *  1. caller hits `/auth/otp/request` purpose=FORGOT_PASSWORD
 *  2. caller hits `/auth/otp/verify`  purpose=FORGOT_PASSWORD → returns
 *     passwordResetToken (only for PHONE customers; SOCIAL = same envelope
 *     shape with no token, per FR-024 no-enumeration rule)
 *  3. caller hits `/auth/password/reset` with this DTO
 */
export class PasswordResetDto {
  @ApiProperty()
  @IsString()
  @Length(20, 128)
  passwordResetToken!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}

/**
 * Authenticated password change (PHONE customers only) — feature 008.
 * SOCIAL customers do not have a password and the controller rejects them.
 */
export class PasswordChangeDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}
