import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ACTIVITY_NOTE_MAX_CHARS,
  ACTIVITY_OUTCOME_FLAGS_MAX,
} from '../activities.types';

export class AttachedDocumentPayloadDto {
  @ApiProperty({ minLength: 1, maxLength: 30 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  documentId!: string;

  @ApiProperty({ minLength: 1, maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  documentType!: string;

  @ApiProperty({ minLength: 1, maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 256)
  s3Key!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  originalFilename!: string;

  @ApiProperty({ enum: ['whatsapp', 'email', 'in_person', 'mobile_app', 'courier', 'other'] })
  @IsString()
  @IsNotEmpty()
  uploadedBySource!: 'whatsapp' | 'email' | 'in_person' | 'mobile_app' | 'courier' | 'other';
}

export class CreateActivityRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activityType!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ maxLength: ACTIVITY_NOTE_MAX_CHARS })
  @IsOptional()
  @IsString()
  @Length(0, ACTIVITY_NOTE_MAX_CHARS)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 24)
  durationMinutes?: number;

  @ApiPropertyOptional({ type: [String], maxLength: ACTIVITY_OUTCOME_FLAGS_MAX })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(ACTIVITY_OUTCOME_FLAGS_MAX)
  @IsString({ each: true })
  outcomeFlags?: string[];

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  followUpAt?: string;

  @ApiPropertyOptional({ type: [AttachedDocumentPayloadDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachedDocumentPayloadDto)
  attachedDocuments?: AttachedDocumentPayloadDto[];

  @ApiPropertyOptional({
    description: 'For LEAD_REASSIGNED only — see reason-codes.md',
  })
  @IsOptional()
  meta?: Record<string, unknown>;
}
