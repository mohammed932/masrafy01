import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

/**
 * Query for `GET /admin/bank-programs/prefill` (FR-008).
 *
 * `category` is the only required input — a bare category still returns a fully
 * shaped response with every leaf marked `EMPTY`, so the form can call prefill
 * as soon as the category is known and refine it as bank / program name arrive.
 */
export class PrefillQueryDto {
  @ApiProperty({ example: 'personal' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  category!: string;

  @ApiPropertyOptional({ description: 'Bank whose lending policy forms the lower prefill layer.' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  bankId?: string;

  @ApiPropertyOptional({
    description: 'Predefined program (`program_name` enumeration key) — the winning layer.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  programNameKey?: string;
}
