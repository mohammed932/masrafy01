import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

/**
 * Body for `POST /admin/bank-programs/:programCode/duplicate` (FR-013).
 *
 * Everything else is copied from the source program, so an admin setting up a
 * bank's 12–14 near-identical programs supplies only what MUST be unique
 * (SC-007). The copy is created INACTIVE — it is a draft until reviewed.
 */
export class DuplicateBankProgramDto {
  @ApiPropertyOptional({
    description: 'Code for the copy. Generated from bank + category when omitted.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  programCode?: string;

  @ApiProperty({ maxLength: 120 })
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  friendlyName!: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  friendlyNameAr?: string;
}
