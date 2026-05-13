import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Spec anchor: FR-006. Discriminated union over `strategy`.
 *
 * Boundary validation enforces strategy + presence of at-least-one-table-shape.
 * Deep structural validation of each strategy's table happens in the service layer
 * (where the `@ValidIncomeAssumption()` cross-field check is easier to express
 * than via class-validator).
 */
export type IncomeAssumptionStrategy =
  | 'declared'
  | 'byYearsInJob'
  | 'byYearsInPractice'
  | 'byProfessorRank'
  | 'byMilitaryGrade'
  | 'byCDValue'
  | 'byCarInstallment'
  | 'byCarLoanAmount'
  | 'byCreditCardLimit'
  | 'byBankStatementPercent';

const STRATEGIES: readonly IncomeAssumptionStrategy[] = [
  'declared',
  'byYearsInJob',
  'byYearsInPractice',
  'byProfessorRank',
  'byMilitaryGrade',
  'byCDValue',
  'byCarInstallment',
  'byCarLoanAmount',
  'byCreditCardLimit',
  'byBankStatementPercent',
];

export class IncomeAssumptionConfigDto {
  @IsIn(STRATEGIES)
  strategy!: IncomeAssumptionStrategy;

  @IsOptional()
  @IsArray()
  incomeTable?: Array<{
    minYears?: number;
    maxYears?: number;
    minCDValueEGP?: string;
    assumedIncomeEGP?: string;
    incomeEGP?: string;
  }>;

  @IsOptional() @IsObject() rankIncomeMap?: Record<string, string>;
  @IsOptional() @IsObject() gradeIncomeMap?: Record<string, string>;

  @IsOptional() @IsString() cdIncomePercent?: string;
  @IsOptional() @IsString() cdIncomeMinEGP?: string;
  @IsOptional() @IsString() cdIncomePercentOfDeposits?: string;

  @IsOptional() @IsIn(['lesser_of', 'greater_of']) combinationRule?: 'lesser_of' | 'greater_of';

  @IsOptional() @IsString() carInstallmentMultiplier?: string;
  @IsOptional() @IsString() carLoanAmountPercent?: string;
  @IsOptional() @IsString() creditCardLimitMultiplier?: string;
  @IsOptional() @IsString() bankStatementPercent?: string;
}
