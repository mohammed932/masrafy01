import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/** A new ready method: its two names, the way itself, and its default figures. */
export class CreateMethodTemplateDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelEn!: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelAr!: string;

  @ApiProperty({
    type: Object,
    description: 'The way: `TemplateMechanism` (kind, fact, column, own groups).',
  })
  @IsObject()
  mechanism!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: "Default figures by column: '' = the first column, else the branch key.",
  })
  @IsOptional()
  @IsObject()
  figures?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    description: "Own groups' members per question: `{ fact: [{ valueId, code, group }] }`.",
  })
  @IsOptional()
  @IsObject()
  placements?: Record<string, unknown>;
}

/** An edit: any of the four, the key never changes. */
export class UpdateMethodTemplateDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelEn?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  labelAr?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  mechanism?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  figures?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  placements?: Record<string, unknown>;
}

export interface MethodTemplateDto {
  key: string;
  labelEn: string;
  labelAr: string;
  mechanism: Record<string, unknown>;
  figures: Record<string, unknown>;
  placements: Record<string, unknown>;
  source: string;
  sortOrder: number;
  updatedAt: string;
  /** The products with a way linked to it — what a save rewrites, and what blocks a delete. */
  usedBy: Array<{ key: string; labelEn: string; labelAr: string }>;
}

/** A save, and what it did to the products linked to the method. */
export interface MethodTemplateSavedDto extends MethodTemplateDto {
  propagation: {
    updated: string[];
    refused: Array<{ key: string; code: string; meta?: Record<string, unknown> }>;
  };
}
