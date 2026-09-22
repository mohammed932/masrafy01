import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';
import { FactGridDto } from './fact-grid.dto';

/** Spec anchor: FR-007. Percentages 7,4; flat fees 13,2. */
export class FeesConfigDto {
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4 })
  adminFeePercent!: string;

  @IsOptional() @IsString() @MaxLength(200) adminFeeDisplay?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  adminFeeRangeMin?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4, nullable: true })
  adminFeeRangeMax?: string;

  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4 })
  stampDutyPercent!: string;

  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4 })
  lifeInsurancePercent!: string;

  @IsBoolean()
  lifeInsuranceMandatory!: boolean;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  lifeInsuranceMinLoanEGP?: string;

  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4 })
  latePaymentFeePercent!: string;

  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4 })
  payoffCashPercent!: string;

  @DecimalRange({ min: '0', max: '100', precision: 7, scale: 4 })
  payoffBuyoutPercent!: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  collateralReplacementFeeEGP?: string;

  @IsOptional()
  @DecimalRange({ min: '0', max: '99999999999.99', precision: 13, scale: 2, nullable: true })
  collateralDecreaseFeeEGP?: string;

  /**
   * Comprehensive cover the bank REQUIRES on the car, as a percent of the car's price paid
   * every policy year — stated against the deposit the applicant is putting down.
   *
   * The table IS the rule and there is no threshold anywhere in code: a bank demanding cover
   * below half the price states a row for `[0, 50)` and none above it. See
   * `matching/pipeline/car-insurance.ts`.
   *
   * It is a DISCLOSURE, not a charge — it reaches no total, no principal and no instalment,
   * which is why it sits here beside the other costs rather than on `loanLimits` beside the
   * things that cap what the bank will lend.
   *
   * `@ValidateIf`, not `@IsOptional()`: that one skips `null` as well as absent, so
   * `carInsuranceRateByFact: null` would slip the pipe and the service would read `.axes` off
   * it and throw an untyped 500. Same defect and same fix as `ltvCeilingByFact`.
   */
  @ValidateIf((_, value) => value !== undefined)
  @ValidateNested()
  @Type(() => FactGridDto)
  carInsuranceRateByFact?: FactGridDto;
}
