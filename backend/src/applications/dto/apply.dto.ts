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
import { BankProgramType, LoanCategory } from '@prisma/client';
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

// `age` is deliberately absent: it is DERIVED from the authenticated customer's
// `birthday` server-side (Principle XXXVII / A31). A client sending it gets a
// 422 `VALIDATION_FAILED` from the global ValidationPipe (`forbidNonWhitelisted`).
export class ApplyRequestDto {
  @IsString()
  loanPurpose!: string;

  @IsDecimalString({ min: 5000, max: 50_000_000, scale: 2, allowZero: false })
  requestedAmountEGP!: string;

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

  /**
   * Catalog program-name archetype the applicant picked on top of `category`
   * (a `program_name` key from `GET /v1/platform-enumerations/program_name`).
   * When set, only programs instantiating THIS archetype are matched.
   *
   * Optional, and its absence is meaningful rather than lax: null means "every
   * program in the category", which is what every pre-catalog client sends and
   * what the admin simulator wants. Validated against the registry (active +
   * assigned to `category`) — an unknown or wrongly-scoped key is a typed
   * rejection, never a silently-ignored filter that would return the whole
   * category and read as a successful narrow.
   *
   * Requires `category`: an archetype is offered UNDER categories, so with no
   * category there is nothing to validate the assignment against.
   */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  programNameKey?: string;

  /**
   * The income basis the applicant said they can prove — the bank's own
   * `bank_program.programType`. `income_proof` matches only programs that read a
   * payslip; `income_surrogate` only programs that work the income out some other
   * way.
   *
   * Optional, and absent means "both bases", which is exactly what every client
   * built before the income-type step sent and was served. Unlike the other two
   * scope axes there is no unclassified program to fall through the filter:
   * `programType` is NOT NULL on the model, so the two values partition the whole
   * active set.
   *
   * A value with no active program behind it is NOT a typed rejection — it falls
   * into the existing no-match response. The client only ever offers a basis it
   * saw as available on `GET /v1/program-options`, so the only way to get here is
   * a stale client racing an operator, and "no offers" is the honest answer to
   * that, not an error the customer can act on.
   */
  @IsOptional()
  @IsEnum(BankProgramType)
  programType?: BankProgramType;

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
