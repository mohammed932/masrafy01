import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import type { ProgramDefaultsDto } from '@/bank-programs/dto/program-defaults.dto';

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export class CreateEnumerationDto {
  @ApiProperty({ minLength: 1, maxLength: 48 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 48)
  type!: string;

  @ApiProperty({ minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9][A-Za-z0-9_-]*$' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  @Matches(KEY_PATTERN, { message: 'key must be alphanumeric / underscore / hyphen' })
  key!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelAr!: string;

  @ApiProperty({ minLength: 1, maxLength: 160 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 160)
  labelEn!: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  parentKey?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Loan categories a `program_name` member serves (e.g. ["personal","car"]).',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  @ArrayUnique()
  categories?: string[];

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateEnumerationDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  labelAr?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  labelEn?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @Length(0, 64)
  parentKey?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Loan categories a `program_name` member serves (e.g. ["personal","car"]).',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 64, { each: true })
  @ArrayUnique()
  categories?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  deprecate?: boolean;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class EnumerationRowDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() key!: string;
  @ApiProperty() labelAr!: string;
  @ApiProperty() labelEn!: string;
  @ApiProperty() active!: boolean;
  @ApiProperty({ nullable: true }) deprecatedAt!: string | null;
  @ApiProperty() systemOnly!: boolean;
  @ApiProperty({ nullable: true }) parentKey!: string | null;
  @ApiProperty({ type: [String] }) categories!: string[];
  /** Feature 010 — per-category prefill defaults; `{}` for non-`program_name` members. */
  @ApiProperty() defaults!: Record<string, unknown>;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

// --- Feature 010: predefined-program catalog defaults (FR-001 … FR-004) -----

/**
 * Body of `PUT /admin/enumerations/program_name/:key/defaults`.
 *
 * FULL REPLACE, not a patch, so removing a category or a leaf is expressible.
 * Each key MUST be a loan category the member already serves (`categories[]`) —
 * otherwise `CATALOG_DEFAULTS_CATEGORY_UNKNOWN` (validated at the service layer,
 * which is where the member row is available).
 */
export class UpdateCatalogDefaultsDto {
  /**
   * Validated per category at the service layer (`validateProgramDefaults`) rather
   * than with `@ValidateNested({ each: true })` — `each` iterates arrays and Sets,
   * not the string-keyed record this is. The service layer is also where the
   * member's `categories[]` is available for the unknown-category check.
   */
  @ApiProperty({
    description: 'Per-category partial program values. Every leaf optional (FR-003).',
    example: { personal: { tenor: { minMonths: 6, maxMonths: 72 } } },
  })
  @IsObject()
  defaults!: Record<string, unknown>;
}

export class CatalogDefaultsResponseDto {
  @ApiProperty({ type: [String] }) categories!: string[];
  @ApiProperty() defaults!: Record<string, ProgramDefaultsDto>;
}
