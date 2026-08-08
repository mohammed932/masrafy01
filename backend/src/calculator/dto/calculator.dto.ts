/**
 * Calculator DTOs (feature 010, FR-028 … FR-032).
 *
 * One mode-discriminated request rather than two endpoints: both modes take the
 * same program scope, the same tenor, and return the same disclaimer, and the
 * app switches between them on one segmented control.
 *
 * Principle I: every money field crosses the wire as a decimal STRING. A JSON
 * number would round-trip 20 000.10 through a float before validation ever ran.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { IsDecimalString } from '@/common/validators/is-decimal-string.validator';

export const CALCULATOR_MODES = ['cost', 'affordability'] as const;
export type CalculatorMode = (typeof CALCULATOR_MODES)[number];

/** Shown on every response so an estimate is never mistaken for an offer (FR-029). */
export const CALCULATOR_DISCLAIMER_CODE = 'INDICATIVE_ESTIMATE_NOT_AN_OFFER';

export class CalculatorQuoteDto {
  @ApiProperty({ enum: CALCULATOR_MODES })
  @IsIn(CALCULATOR_MODES)
  mode!: CalculatorMode;

  @ApiPropertyOptional({ description: 'Omit for a generic quote at the representative rate.' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  bankProgramId?: string;

  @ApiProperty({ example: 60 })
  @IsInt()
  @Min(1)
  @Max(480)
  tenorMonths!: number;

  // ── cost mode ────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '300000.00', description: 'Required in `cost` mode.' })
  @ValidateIf((o: CalculatorQuoteDto) => o.mode === 'cost')
  @IsDecimalString({ min: 1, scale: 2, allowZero: false })
  amountEGP?: string;

  // ── affordability mode ───────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '100000.00', description: 'Required in `affordability` mode.' })
  @ValidateIf((o: CalculatorQuoteDto) => o.mode === 'affordability')
  @IsDecimalString({ min: 1, scale: 2, allowZero: false })
  monthlyIncomeEGP?: string;

  @ApiPropertyOptional({ example: '40000.00', description: 'Required in `affordability` mode.' })
  @ValidateIf((o: CalculatorQuoteDto) => o.mode === 'affordability')
  @IsDecimalString({ min: 0, scale: 2 })
  existingObligationsEGP?: string;

  /**
   * Total credit LIMIT across every card the caller holds — not the balance and
   * not the minimum payment. Optional: a caller with no cards simply omits it.
   *
   * Kept OUT of `existingObligationsEGP` rather than folded into it by the client,
   * because the two are different quantities: one is already a monthly figure, the
   * other is exposure the server discounts by `CREDIT_CARD_LIMIT_MONTHLY_PERCENT`.
   * Folding it in on the client would put the discount rate in three apps and let
   * the calculator's answer drift from the one apply produces for the same person.
   */
  @ApiPropertyOptional({
    example: '150000.00',
    description:
      'Affordability mode. Total limit across ALL cards; 5% of it counts as a monthly commitment.',
  })
  @IsOptional()
  @IsDecimalString({ min: 0, scale: 2 })
  creditCardTotalLimitEGP?: string;

  /**
   * Generic mode only — the debt-burden cap to apply, as a percentage of income.
   * When `bankProgramId` is set the program's own cap (scalar or band table) is
   * the only source (FR-021b) and sending this is rejected rather than silently
   * ignored: a caller who thinks they set the cap must not be told otherwise.
   */
  @ApiPropertyOptional({ example: '60.0000', description: 'Generic mode only. Defaults to 50%.' })
  @IsOptional()
  @IsDecimalString({ min: 1, max: 100, scale: 4, allowZero: false })
  dbrCapPercent?: string;

  // Age is NOT a field here: it drives the age-at-maturity tenor shortening and
  // is DERIVED from the authenticated customer's `birthday` (Principle XXXVII /
  // A31), so the figures shown here can never disagree with the ones apply
  // produces. A client sending `age` is rejected with 422 `VALIDATION_FAILED`
  // (`forbidNonWhitelisted`).
}

// ---------------------------------------------------------------------------
// Responses — decimal strings out, same as in.
// ---------------------------------------------------------------------------

export class CalculatorFeesDto {
  @ApiProperty() adminFeeEGP!: string;
  @ApiProperty() stampDutyEGP!: string;
  @ApiProperty() lifeInsuranceEGP!: string;
}

export class CalculatorClampedDto {
  @ApiProperty({ description: 'The requested amount hit a program limit.' })
  amount!: boolean;
  @ApiProperty({ description: 'The requested tenor hit a program limit or the age ceiling.' })
  tenor!: boolean;
}

export class CalculatorLimitsDto {
  @ApiProperty() minAmountEGP!: string;
  @ApiProperty() maxAmountEGP!: string;
  @ApiProperty() minTenorMonths!: number;
  @ApiProperty() maxTenorMonths!: number;
}

export class CostQuoteResponseDto {
  @ApiProperty({ enum: ['cost'] }) mode!: 'cost';
  @ApiPropertyOptional() programCode?: string;
  @ApiProperty() isRepresentativeRate!: boolean;
  @ApiProperty() effectiveRatePercent!: string;
  @ApiProperty({ description: 'Booked principal: cash + financed fees.' })
  amountEGP!: string;
  @ApiProperty() cashToCustomerEGP!: string;
  @ApiProperty() totalFeesEGP!: string;
  @ApiProperty() monthlyInstallmentEGP!: string;
  @ApiProperty() tenorMonths!: number;
  @ApiProperty() totalPayableEGP!: string;
  @ApiProperty() totalCostOfCreditEGP!: string;
  @ApiProperty({ type: CalculatorFeesDto }) fees!: CalculatorFeesDto;
  @ApiProperty({ type: CalculatorClampedDto }) clamped!: CalculatorClampedDto;
  @ApiProperty({ type: CalculatorLimitsDto }) limits!: CalculatorLimitsDto;
  @ApiProperty({ example: CALCULATOR_DISCLAIMER_CODE }) disclaimerCode!: string;
}

export class AffordabilityQuoteResponseDto {
  @ApiProperty({ enum: ['affordability'] }) mode!: 'affordability';
  @ApiPropertyOptional() programCode?: string;
  @ApiProperty() isRepresentativeRate!: boolean;
  @ApiProperty() effectiveRatePercent!: string;
  @ApiProperty({ description: 'The income the cap was applied to.' })
  recognisedIncomeEGP!: string;
  @ApiProperty({
    description: 'What the cap was measured against: stated obligations + the card notional below.',
  })
  existingObligationsEGP!: string;
  @ApiProperty({
    description: '5% of the stated total card limit, already inside `existingObligationsEGP`.',
  })
  creditCardMonthlyEGP!: string;
  @ApiProperty() dbrCapPercent!: string;
  @ApiProperty({ nullable: true, type: Number }) dbrBandIndex!: number | null;
  @ApiProperty({ description: 'income × cap ÷ 100 − obligations. Zero when the cap is consumed.' })
  maxMonthlyInstallmentEGP!: string;
  @ApiProperty({ description: 'Present value of that installment over the tenor.' })
  maxAffordableAmountEGP!: string;
  @ApiProperty() monthlyInstallmentEGP!: string;
  @ApiProperty() tenorMonths!: number;
  @ApiProperty({ nullable: true, type: String }) bindingConstraint!: string | null;
  @ApiProperty({ example: CALCULATOR_DISCLAIMER_CODE }) disclaimerCode!: string;
}
