import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LoanCategory } from '@prisma/client';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { asLoanCategory } from '@/common/loan-category.util';
import { ok } from '@/common/pagination/paginated.response.dto';
import { ProgramOptionsService } from './program-options.service';
import type { ProgramOptionsResponseDto } from './dto/program-options.response.dto';

/**
 * Mobile selection-wizard read: which income bases, and which catalog names on
 * each, a customer can actually be matched against right now.
 *
 * Customer-JWT only, deliberately WITHOUT `CustomerProfileCompleteGuard` even
 * though `v1/questionnaire` and `v1/matching` stack it. This endpoint replaces the
 * `v1/platform-enumerations/program_name` read the Home screen already made on the
 * same guard, and it is a browse, not a submit — the Principle XXXVII gate stays
 * exactly where it is, on the questionnaire and on apply, so moving it one screen
 * earlier is not this feature's call to make.
 */
@ApiTags('Mobile · Program options')
@ApiBearerAuth('CustomerBearerAuth')
@UseGuards(CustomerJwtGuard)
@Controller('v1/program-options')
export class ProgramOptionsController {
  constructor(private readonly service: ProgramOptionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Income bases and catalog names available for a loan category',
    description:
      'Derived from active bank programs. Both income bases are always returned; a zero count means no bank sells this category that way.',
  })
  @ApiQuery({ name: 'category', enum: LoanCategory, required: true })
  async list(
    @Query('category') rawCategory?: string,
  ): Promise<{ success: true; data: ProgramOptionsResponseDto }> {
    // Required and validated up front. An unknown or missing value is a typed
    // rejection, never a silent fallback to "every category" — the same rule
    // `GET /v1/questionnaire` follows, and for the same reason: a lenient read
    // would return a picker the customer's choice does not apply to.
    const category = asLoanCategory(rawCategory);
    if (!category) {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        field: 'category',
        value: rawCategory ?? null,
      });
    }
    return ok(await this.service.forCategory(category));
  }
}
