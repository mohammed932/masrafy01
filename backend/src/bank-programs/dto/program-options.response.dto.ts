import { ApiProperty } from '@nestjs/swagger';
import { BankProgramType, LoanCategory } from '@prisma/client';

/**
 * `GET /v1/program-options` — what a customer can actually pick, for one loan
 * category.
 *
 * Answers the two questions the mobile selection wizard asks in order: "can this
 * category be bought without a payslip at all?" and "which catalog names are on
 * offer once I have chosen a basis?". Both are DERIVED from live `bank_program`
 * rows every time — nothing here is declared by an operator on a second screen,
 * which is the third-authority pattern v16.3.0 and v16.4.0 each deleted.
 */

export class ProgramNameOptionDto {
  @ApiProperty({ description: 'Catalog `program_name` key — the value sent back as `programNameKey`' })
  key!: string;

  @ApiProperty() labelAr!: string;
  @ApiProperty() labelEn!: string;

  /** Active programs behind this (category, income basis, name) triple. Always ≥ 1. */
  @ApiProperty({ description: 'How many banks offer this name on this basis' })
  programCount!: number;
}

export class IncomeTypeOptionDto {
  @ApiProperty({ enum: BankProgramType })
  programType!: BankProgramType;

  /** Active programs in this category on this basis. `0` is a real, rendered state. */
  @ApiProperty()
  programCount!: number;

  @ApiProperty({ type: [ProgramNameOptionDto] })
  programNames!: ProgramNameOptionDto[];
}

export class ProgramOptionsResponseDto {
  @ApiProperty({ enum: LoanCategory })
  category!: LoanCategory;

  /**
   * BOTH bases, always, in a stable order — never only the non-empty ones.
   *
   * A basis with `programCount: 0` is the answer "no bank sells this category
   * that way", which the client renders as a disabled card with a reason. Omitting
   * it would leave the app unable to tell that apart from "the API is an older
   * build", and would silently turn a two-choice step into a one-choice step with
   * no explanation.
   */
  @ApiProperty({ type: [IncomeTypeOptionDto] })
  incomeTypes!: IncomeTypeOptionDto[];
}
