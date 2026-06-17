import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TenorConfigDto } from './sub-configs/tenor-config.dto';
import { LoanLimitsConfigDto } from './sub-configs/loan-limits-config.dto';
import { PricingConfigDto } from './sub-configs/pricing-config.dto';
import { EligibilityConfigDto } from './sub-configs/eligibility-config.dto';
import { PerformanceCriteriaConfigDto } from './sub-configs/performance-criteria-config.dto';
import { IncomeAssumptionConfigDto } from './sub-configs/income-assumption-config.dto';
import { FeesConfigDto } from './sub-configs/fees-config.dto';

const PROGRAM_TYPES = ['income_proof', 'income_surrogate'] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

export class CreateBankProgramDto {
  /**
   * Optional — auto-generated server-side from bank + category when omitted
   * (A33: codes are never hand-typed). A supplied value still validates.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9_-]{3,32}$/, { message: 'programCode must match ^[A-Z0-9_-]{3,32}$' })
  programCode?: string;

  @IsString() @MinLength(1) @MaxLength(80) bankName!: string;
  @IsOptional() @IsString() @MaxLength(30) bankId?: string;
  @IsString() @MinLength(1) @MaxLength(120) friendlyName!: string;
  @IsOptional() @IsString() @MaxLength(120) friendlyNameAr?: string;

  @IsIn(PROGRAM_TYPES) programType!: ProgramType;

  /** Resolves to `product_category` enumeration; validated at service layer. */
  @IsString() productCategory!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  currencies!: string[];

  /** Feature 008: Sharia / Islamic banking flag. Pricing semantics + UI labels shift. */
  @IsOptional() @IsBoolean() isShariaCompliant?: boolean;

  @IsOptional() @IsString() @MaxLength(4000) operatorNotes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  operatorTips?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  requiredDocuments?: string[];

  @ValidateNested() @Type(() => TenorConfigDto) tenor!: TenorConfigDto;
  @ValidateNested() @Type(() => LoanLimitsConfigDto) loanLimits!: LoanLimitsConfigDto;
  @ValidateNested() @Type(() => PricingConfigDto) pricing!: PricingConfigDto;
  @ValidateNested() @Type(() => EligibilityConfigDto) eligibility!: EligibilityConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PerformanceCriteriaConfigDto)
  performanceCriteria?: PerformanceCriteriaConfigDto;

  @ValidateNested()
  @Type(() => IncomeAssumptionConfigDto)
  incomeAssumption!: IncomeAssumptionConfigDto;
  @ValidateNested() @Type(() => FeesConfigDto) fees!: FeesConfigDto;
}
