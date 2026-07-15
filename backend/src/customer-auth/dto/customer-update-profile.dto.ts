import { IsEmail, IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `PATCH /api/v1/auth/profile` — post-completion scalar edits for an
 * already-complete customer. Every field is optional; only supplied fields are
 * written (partial update). This endpoint NEVER touches phone (immutable for
 * PHONE accounts), birthday (immutable once set — Principle XXXVII), or
 * password (its own dedicated flow). `POST /profile/complete` remains the
 * onboarding-only completion path.
 */
export class UpdateCustomerProfileDto {
  @ApiPropertyOptional({ example: 'Ahmed' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Hassan' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @ApiPropertyOptional({ example: 'ahmed@example.com', description: 'Optional contact email (unique).' })
  @IsOptional()
  @IsEmail()
  @Length(1, 254)
  email?: string;

  @ApiPropertyOptional({ example: 'cairo', description: 'Egyptian governorate slug.' })
  @IsOptional()
  @IsString()
  @Length(1, 60)
  governorate?: string;

  @ApiPropertyOptional({ example: 'Nasr City' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  city?: string;

  @ApiPropertyOptional({ example: '12 Tahrir St' })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  address?: string;
}
