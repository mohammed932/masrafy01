import { IsInt, IsObject, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { FactGridDto } from './fact-grid.dto';

export class TenorConfigDto {
  @IsInt()
  @Min(1)
  @Max(480)
  minMonths!: number;

  @IsInt()
  @Min(1)
  @Max(480)
  maxMonths!: number;

  /** Keys validated against `employment_type` enumeration at service layer. */
  @IsOptional()
  @IsObject()
  maxMonthsByEmploymentType?: Record<string, number>;

  /**
   * A term ceiling the bank states against the applicant's own answers — the car's model
   * year, the country it was built in, the share they are putting down.
   *
   * Read by `quote.ts` as a CLAMP beside the age-at-maturity one, composing by `min`, and
   * deliberately NOT as a `TENOR_CASCADE_ORDER` level: that cascade is first-match-wins, so
   * a level would make a vehicle ceiling REPLACE `maxMonthsByEmploymentType` rather than
   * compose with it, and a bank that caps the self-employed at 84 months means that as well
   * as, not instead of, "this car is too old for ten years".
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => FactGridDto)
  maxMonthsByFact?: FactGridDto;
}
