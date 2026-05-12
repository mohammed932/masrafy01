import { IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';

export class TenorConfigDto {
  @IsInt()
  @Min(1)
  @Max(480)
  minMonths!: number;

  @IsInt()
  @Min(1)
  @Max(480)
  maxMonths!: number;

  /** Keys validated against `salary_category` enumeration at service layer. */
  @IsOptional()
  @IsObject()
  maxMonthsBySalaryCategory?: Record<string, number>;

  /** Keys validated against `employment_type` enumeration at service layer. */
  @IsOptional()
  @IsObject()
  maxMonthsByEmploymentType?: Record<string, number>;
}
