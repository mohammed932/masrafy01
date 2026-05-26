import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

/**
 * Bank update payload. `code` is IMMUTABLE — not present here.
 * Includes `version` for optimistic concurrency.
 */
export class UpdateBankDto {
  @ApiProperty() @IsInt() version!: number;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  nameArabic?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  nameEnglish?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(500)
  websiteUrl?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @ApiProperty({ required: false }) @IsOptional() @IsInt() @Min(0)
  displayOrder?: number;

  @ApiProperty({ required: false }) @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    description: 'Phase-1 partner-bank flag. Boosts this bank in mobile ranking ties.',
  })
  @IsOptional() @IsBoolean()
  isFeatured?: boolean;
}
