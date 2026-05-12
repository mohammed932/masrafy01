import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { DecimalRange } from '../../../common/decorators/decimal-range.decorator';

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
}
