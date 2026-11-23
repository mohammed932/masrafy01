import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Criterion } from '@/matching/pipeline/criterion';

const DECIMAL = /^\d{1,12}(\.\d{1,4})?$/;

/** One answer a case reads: a question's fact and what its answer must be. */
export class ProgramCaseCriterionDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(64) factKey!: string;

  /** The operator's vocabulary (`criterion.ts`): one option, or a number comparison. */
  @ApiProperty({ type: Object }) @IsObject() criterion!: Criterion;
}

/** The figures a case states. A blank figure is left to the program. */
export class ProgramCaseEffectsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DECIMAL) ratePercent?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DECIMAL) ltvCeilingPercent?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DECIMAL) minAmountEGP?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(DECIMAL) maxAmountEGP?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) minMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) maxMonths?: number;
}

/** One case: every answer must match; the first matching case in the list is applied. */
export class ProgramCaseDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) id!: string;

  @ApiProperty({ type: [ProgramCaseCriterionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => ProgramCaseCriterionDto)
  allOf!: ProgramCaseCriterionDto[];

  @ApiProperty({ type: ProgramCaseEffectsDto })
  @ValidateNested()
  @Type(() => ProgramCaseEffectsDto)
  effects!: ProgramCaseEffectsDto;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() refuse?: boolean;
}
