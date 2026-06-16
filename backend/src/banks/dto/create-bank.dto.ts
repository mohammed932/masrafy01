import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Bank create payload.
 * - `nameArabic` + `nameEnglish` required (`nameEnglish` unique). Logo + website + notes optional.
 */
export class CreateBankDto {
  @ApiProperty({ example: 'البنك الأهلي الكويتي - مصر' })
  @IsString() @MinLength(1) @MaxLength(120)
  nameArabic!: string;

  @ApiProperty({ example: 'ABK Egypt' })
  @IsString() @MinLength(1) @MaxLength(120)
  nameEnglish!: string;

  @ApiProperty({ required: false, example: 'https://www.abkegypt.com' })
  @IsOptional() @IsString() @MaxLength(500)
  websiteUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsInt() @Min(0)
  displayOrder?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Phase-1 partner-bank flag. Boosts this bank in mobile ranking ties.',
  })
  @IsOptional() @IsBoolean()
  isFeatured?: boolean;
}
