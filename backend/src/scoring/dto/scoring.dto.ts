import { IsEnum, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LoanCategory, ScoringFactorKind } from '@prisma/client';

export class CreateScoringFactorDto {
  @ApiProperty({ enum: LoanCategory }) @IsEnum(LoanCategory) category!: LoanCategory;
  @ApiProperty() @IsString() @Length(1, 64) code!: string;
  @ApiPropertyOptional({ enum: ScoringFactorKind, default: 'DIRECT' })
  @IsOptional()
  @IsEnum(ScoringFactorKind)
  kind?: ScoringFactorKind;
  @ApiProperty() @IsString() @Length(1, 200) labelAr!: string;
  @ApiProperty() @IsString() @Length(1, 200) labelEn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 500) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 64) sourceQuestionCode?: string;
}

export class UpsertWeightsDraftDto {
  @ApiProperty({
    description: 'Map of factorCode → points; must sum to exactly 100.',
    example: { salary_level: 20, debt_burden: 30, salary_transferred: 30, job_stability: 20 },
  })
  @IsObject()
  weights!: Record<string, number>;
}

export class RejectWeightsDto {
  @ApiProperty() @IsString() @Length(1, 500) reason!: string;
}
