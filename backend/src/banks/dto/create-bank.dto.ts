import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Bank create payload.
 * - `code` is uppercased on the server; format `[A-Z][A-Z0-9_]{1,39}`.
 * - `nameArabic` + `nameEnglish` required. Logo + website + notes optional.
 */
export class CreateBankDto {
  @ApiProperty({ example: 'ABK_EGYPT', description: 'Immutable. A-Z, 0-9, _. 2-40 chars.' })
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[A-Z][A-Z0-9_]{1,39}$/, { message: 'BANK_CODE_INVALID_FORMAT' })
  code!: string;

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
}
