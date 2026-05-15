import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

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
  @ApiProperty() sortOrder!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
