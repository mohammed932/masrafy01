import { IsDateString, IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Principle XXXVII — mandatory profile completion (both registration paths).
 * The profile photo is uploaded BEFORE this call via the customer-scoped
 * presign endpoint; National ID is optional at signup (enforced at apply time).
 * This DTO carries only the scalar profile fields. `password` is required for
 * PHONE customers (first completion) and MUST be omitted for SOCIAL customers.
 */
export class CustomerCompleteProfileDto {
  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @Length(1, 60)
  firstName!: string;

  @ApiProperty({ example: 'Hassan' })
  @IsString()
  @Length(1, 60)
  lastName!: string;

  @ApiProperty({ example: '1995-04-21', description: 'ISO date; age (18–80) derived, never stored.' })
  @IsDateString()
  birthday!: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com', description: 'Optional contact email.' })
  @IsOptional()
  @IsEmail()
  @Length(1, 254)
  email?: string;

  @ApiPropertyOptional({ minLength: 12, maxLength: 128, description: 'PHONE customers only.' })
  @IsOptional()
  @IsString()
  @Length(12, 128)
  password?: string;
}
