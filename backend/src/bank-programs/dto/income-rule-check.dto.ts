import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncomeAssumptionConfigDto } from './sub-configs/income-assumption-config.dto';

/**
 * Feature 011 / FR-026 – FR-031 — the admin rule-check body.
 *
 * Runs a SAMPLE applicant against the rule that is ON SCREEN, including unsaved
 * edits, and persists nothing: no application, no lead, no offer (FR-028, FR-029).
 * The draft therefore travels in the body — a program-code-only dry run could only
 * ever evaluate the STORED rule, which is the one thing the panel exists not to do.
 *
 * Root DTO and the nested sample class live in this ONE file (payload co-location).
 *
 * **A31 note.** This carries an explicit sample `age`, exactly as `SimulateMatchesDto`
 * does. A31 forbids `age` on any CUSTOMER request body — age is derived from the
 * verified `birthday` — and that intent is fully honoured here: this is an ADMIN
 * dry-run surface with no customer to derive from. A31's text names only the
 * simulator DTO because it predates a second admin dry-run body; recorded in
 * plan.md Complexity Tracking § 5 rather than assumed covered.
 */

/** Decimal string: optional sign, digits, optional fraction. No exponents. */
const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

export class IncomeRuleCheckSampleDto {
  @ApiProperty({ example: 34, description: "Sample applicant's age (admin-side, A31)." })
  @IsInt()
  @Min(18)
  @Max(80)
  age!: number;

  // --- the ten facts a rule can read ---------------------------------------
  //
  // Every one optional: the panel checks ONE method at a time, and requiring the
  // other nine would make the form unusable. An absent fact is what produces
  // `SURROGATE_FACT_MISSING`, which is a result the admin needs to be able to
  // reproduce deliberately (FR-031).

  @ApiPropertyOptional({ example: 'senior_officer' })
  @IsOptional()
  @IsString()
  militaryGrade?: string;

  @ApiPropertyOptional({ example: 'assistant_professor' })
  @IsOptional()
  @IsString()
  professorRank?: string;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  yearsInPractice?: number;

  @ApiPropertyOptional({ example: 96 })
  @IsOptional()
  @IsInt()
  @Min(0)
  monthsInJob?: number;

  @ApiPropertyOptional({ example: '150000' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING)
  creditCardLimitEGP?: string;

  @ApiPropertyOptional({ example: '500000' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING)
  cdValueEGP?: string;

  @ApiPropertyOptional({ example: '750000' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING)
  totalDepositsEGP?: string;

  @ApiPropertyOptional({ example: '200000' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING)
  bankStatementBalanceEGP?: string;

  @ApiPropertyOptional({ example: '4000' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING)
  carInstallmentEGP?: string;

  @ApiPropertyOptional({ example: '300000' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING)
  carLoanAmountEGP?: string;

  /**
   * A registry FACT's sample answer — an option code for a choice fact, a decimal
   * string for a numeric one.
   *
   * One field for every operator-defined fact, rather than a named field each: the set
   * is data now, so a DTO field per fact would be the release this feature removes. The
   * ten above stay named because live offers carry the built-in method tokens that read
   * them (Principle I).
   *
   * Which fact this value belongs to is the RULE's own `fact:<key>` strategy, so no key
   * travels with it: sending a value for a fact the rule does not read would let the
   * panel show a figure produced by something the admin cannot see on screen.
   */
  @ApiPropertyOptional({ example: 'senior_officer', description: 'Sample answer for a fact rule.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  factValue?: string;

  /**
   * Sample answers for a STEP PIPELINE, by fact key — a compound rule reads ten of them,
   * and the single `factValue` above cannot say which of the ten it is.
   *
   * Values are read exactly as the resolver reads an answer: a clean decimal string is a
   * NUMBER, anything else is an option code (`sampleFactValue`). An absent key is what
   * reproduces `SURROGATE_FACT_MISSING`, which the admin needs to be able to trigger
   * deliberately.
   *
   * `factValue` is kept, not replaced: it is the whole form for a single-fact rule, and
   * asking an operator to type a key for a rule that reads exactly one fact would be a
   * step backwards for the eleven methods that shipped first.
   */
  @ApiPropertyOptional({
    type: Object,
    example: { compound_unit_type: 'apartment', compound_unit_price: '3000000' },
  })
  @IsOptional()
  @IsObject()
  facts?: Record<string, string>;

  // --- the economics the quote needs ---------------------------------------

  /**
   * Optional, and `'0'` is a meaningful value rather than a missing one: checking
   * what a rule produces for an applicant who declared NO salary is the primary case
   * for a surrogate program, and it is also how the admin sees the combination rule's
   * effect by contrast.
   */
  @ApiPropertyOptional({ example: '0' })
  @IsOptional()
  @IsString()
  @Matches(DECIMAL_STRING)
  declaredMonthlySalaryEGP?: string;

  @ApiProperty({ example: '3000' })
  @IsString()
  @Matches(DECIMAL_STRING)
  existingMonthlyObligationsEGP!: string;

  @ApiProperty({ example: '500000' })
  @IsString()
  @Matches(DECIMAL_STRING)
  requestedAmountEGP!: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  @Max(360)
  tenorMonths!: number;
}

export class IncomeRuleCheckDto {
  /**
   * The ON-SCREEN draft (FR-028). Validated with the SAME validator the save path
   * runs, so a rule that could not be saved does not silently "work" here — the
   * panel's whole promise is that what it shows is what a customer would get.
   */
  @ApiProperty({ type: () => IncomeAssumptionConfigDto })
  @ValidateNested()
  @Type(() => IncomeAssumptionConfigDto)
  incomeAssumption!: IncomeAssumptionConfigDto;

  @ApiProperty({ type: () => IncomeRuleCheckSampleDto })
  @ValidateNested()
  @Type(() => IncomeRuleCheckSampleDto)
  sample!: IncomeRuleCheckSampleDto;
}

/** Response shape (data-model § 7). Money as decimal strings (Principle I). */
export interface IncomeRuleCheckResponseDto {
  /**
   * `null` when nothing resolved — read `unresolvedReason`. NEVER `'0'`: a zero is
   * a figure, and showing one where the rule produced nothing is the exact defect
   * FR-031 exists to prevent.
   */
  resolvedIncomeEGP: string | null;
  origin: string;
  unresolvedReason?: string;
  dbrCapPercent: string;
  dbrCapSource: 'program_default' | 'rule_override';
  affordableInstallmentEGP: string | null;
  estimatedLoanAmountEGP: string | null;
  /**
   * TRUE when the affordable installment covers the installment the requested amount
   * implies at this program's own rate and term.
   *
   * Derived from the quote's own figures ONLY. No eligibility rule — minimum income,
   * age, employment type — is consulted, because eligibility gating stays out of
   * matching and this panel must not become the one place it returns (FR-027, A33).
   * Always false when the income is unresolved.
   */
  qualifies: boolean;
  unavailableReason?: string;
  /** The single configured value the figure traced to (FR-030). */
  matchedRow?: { key: string } | { fromInclusive: string; toExclusive: string | null };
}
