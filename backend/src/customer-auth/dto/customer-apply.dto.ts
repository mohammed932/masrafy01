import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
  IsObject,
  IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyOfferSelectionDto {
  @ApiProperty()
  @IsString()
  @Length(10, 64)
  bankProgramId!: string;

  @ApiProperty({ default: 'EGP' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ minimum: 6, maximum: 360 })
  @IsInt()
  @Min(6)
  @Max(360)
  tenorMonths!: number;
}

export class ApplyDocumentsDto {
  @ApiProperty()
  @IsString()
  @Length(10, 64)
  nationalIdFrontUploadId!: string;

  @ApiProperty()
  @IsString()
  @Length(10, 64)
  nationalIdBackUploadId!: string;
}

export class ApplyProfileCompletionDto {
  @ApiPropertyOptional({ description: 'SOCIAL customers may supply email if currently null.' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ minimum: 18, maximum: 80 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(80)
  age?: number;
}

/**
 * `POST /v1/applications/apply` (feature 008) — single atomic submission.
 *
 * Auth: Customer JWT (Constitution v3.0.0 / Principle XIII — JWT-only).
 *
 * PHONE customers: profileCompletion is omitted (their profile is already
 *   complete from signup).
 * SOCIAL customers: profileCompletion carries email (if customer.email is
 *   null) + age (always; SOCIAL.age is null until first apply).
 */
export class ApplyRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ApplyProfileCompletionDto)
  profileCompletion?: ApplyProfileCompletionDto;

  @ApiProperty({ type: ApplyOfferSelectionDto })
  @ValidateNested()
  @Type(() => ApplyOfferSelectionDto)
  offerSelection!: ApplyOfferSelectionDto;

  @ApiProperty({ description: 'Full questionnaire payload as a JSON object.' })
  @IsObject()
  questionnaire!: Record<string, unknown>;

  @ApiProperty({ type: ApplyDocumentsDto })
  @ValidateNested()
  @Type(() => ApplyDocumentsDto)
  documents!: ApplyDocumentsDto;
}
