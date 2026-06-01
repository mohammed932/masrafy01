/**
 * POST /api/v1/apply — mobile request DTO.
 *
 * Money fields are decimal strings (Constitution Principle I + A3) — never JS numbers.
 * Enum strings are validated against the platform enumeration registry at application
 * time; here we keep them as @IsString and let the matching engine surface typed
 * NO_MATCHING_PROGRAMS reasons. Idempotency-Key arrives via HTTP header, not body.
 *
 * Spec-question → DTO mapping (Phase 1 stakeholder questionnaire):
 *   Q: "Type of financing?"            → `loanPurpose`
 *   Q: "Amount needed?"                → `requestedAmountEGP`
 *   Q: "Repayment tenor bucket?"       → `preferredTenorMonths` (UI maps <5y → 48 / 5–7y → 72 / >7y → 96 by default)
 *   Q: "Job type?"                     → `employment.employmentType` (government_employee | private_employee | business_owner | freelancer; legacy salaried/self_employed kept active)
 *   Q: "Monthly salary?"               → `employment.monthlyNetSalaryEGP`
 *   Q: "Salary transfer?"              → `employment.salaryTransferType`
 *   Q: "Current loans?"                → `obligations.hasCurrentLoan` + `obligations.existingMonthlyObligationsEGP`
 *   Q: "Credit card used amount?"      → `assets.creditCardUsedEGP` (see AssetsDto)
 *   Q: "Rejected before?"              → `obligations.hasPreviousRejection`
 *   Q: "Most important factor?"        → `priority` (lowest_installment | lowest_interest | fastest_approval | least_paperwork)
 *
 * Phase 2 (NOT in this DTO yet):
 *   - "Company accredited by banks?" — resolved engine-side via salary_category.
 *   - "Which bank receives your salary?" — not modeled.
 *   - Credit-card product line — separate flow.
 */
import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsIn,
  Min,
  Max,
  ValidateNested,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsArray } from 'class-validator';
import { LoanCategory } from '@prisma/client';
import { APPLICATION_PRIORITIES, type ApplicationPriority } from '../../matching/types';
import { IsDecimalString } from '../../common/validators/is-decimal-string.validator';
import { SubmittedAnswerDto } from '@/questionnaire/dto/questionnaire.dto';

export class EmploymentDto {
  @IsString()
  employmentType!: string;

  @IsDecimalString({ min: 0, max: 100_000_000, scale: 2 })
  monthlyNetSalaryEGP!: string;

  @IsInt()
  @Min(0)
  monthsInJob!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  yearsInPractice?: number;

  @IsOptional()
  @IsString()
  professorRank?: string;

  @IsOptional()
  @IsString()
  militaryGrade?: string;

  @IsString()
  salaryTransferType!: string;

  @IsString()
  companyName!: string;

  @IsString()
  companyType!: string;

  @IsOptional()
  @IsIn(['public', 'commercial'])
  bankCategory?: 'public' | 'commercial';
}

export class ObligationsDto {
  @IsDecimalString({ min: 0, max: 100_000_000, scale: 2 })
  existingMonthlyObligationsEGP!: string;

  @IsBoolean()
  hasCurrentLoan!: boolean;

  @IsOptional()
  @IsDecimalString({ min: 0, max: 100, scale: 4 })
  currentLoanRatePercent?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  monthsOnBookCurrentLoan?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bkt1HitWithinMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bkt2HitWithinMonths?: number;

  @IsBoolean()
  hasPreviousRejection!: boolean;
}

export class AssetsDto {
  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  cdAtABKValueEGP?: string;

  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  totalDepositsAtABKValueEGP?: string;

  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  bankStatementBalanceEGP?: string;

  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  declaredAssetsValueEGP?: string;

  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  creditCardLimitEGP?: string;

  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  autoLoanAtOtherBankEGP?: string;

  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  autoLoanAtABKEGP?: string;

  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  carInstallmentEGP?: string;

  @IsOptional()
  @IsBoolean()
  ownsCompoundProperty?: boolean;

  @IsOptional()
  @IsBoolean()
  clubMembership?: boolean;
}

export class MortgageDetailsDto {
  @IsDecimalString({ min: 0, scale: 2 })
  propertyValueEGP!: string;

  @IsDecimalString({ min: 0, scale: 2 })
  downPaymentEGP!: string;

  @IsString()
  propertyType!: string;

  @IsBoolean()
  isCompound!: boolean;

  @IsString()
  constructionStage!: string;
}

export class CarDetailsDto {
  @IsDecimalString({ min: 0, scale: 2 })
  carValueEGP!: string;

  @IsDecimalString({ min: 0, scale: 2 })
  downPaymentEGP!: string;
}

export class ApplyRequestDto {
  @IsInt()
  @Min(18)
  @Max(75)
  age!: number;

  @IsString()
  loanPurpose!: string;

  @IsDecimalString({ min: 5000, max: 50_000_000, scale: 2, allowZero: false })
  requestedAmountEGP!: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @IsIn(['EGP', 'USD', 'EUR', 'GBP'])
  requestedCurrency?: string;

  @IsInt()
  @Min(6)
  @Max(360)
  preferredTenorMonths!: number;

  @IsEnum(APPLICATION_PRIORITIES)
  priority!: ApplicationPriority;

  // Feature 009 — dynamic questionnaire (optional; persisted as application_answer
  // rows + application.category/questionnaireVersionId when supplied).
  @IsOptional()
  @IsEnum(LoanCategory)
  category?: LoanCategory;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  questionnaireVersionId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmittedAnswerDto)
  questionnaireAnswers?: SubmittedAnswerDto[];

  @IsOptional()
  @IsString()
  nationalId?: string;

  @ValidateNested()
  @Type(() => EmploymentDto)
  employment!: EmploymentDto;

  @ValidateNested()
  @Type(() => ObligationsDto)
  obligations!: ObligationsDto;

  @ValidateNested()
  @Type(() => AssetsDto)
  assets!: AssetsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MortgageDetailsDto)
  mortgageDetails?: MortgageDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CarDetailsDto)
  carDetails?: CarDetailsDto;
}
