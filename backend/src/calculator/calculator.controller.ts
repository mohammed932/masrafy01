import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { CalculatorService } from './calculator.service';
import { CalculatorQuoteDto } from './dto/calculator.dto';

/**
 * Loan calculator. JWT-gated but deliberately NOT profile-complete-gated: a
 * customer may run the numbers before committing to an application, and the
 * calculator persists nothing about them (Principle XXXVII covers the gated
 * surfaces — questionnaire, matching, apply — not read-only arithmetic).
 */
@ApiTags('Mobile · Calculator')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/calculator')
@UseGuards(CustomerJwtGuard)
export class CalculatorController {
  constructor(private readonly service: CalculatorService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60 * 60 * 1000 } })
  @ApiOperation({
    summary: 'Cost of a given loan, or the largest loan a given income supports',
  })
  async quote(@Body() dto: CalculatorQuoteDto): Promise<{ success: true; data: unknown }> {
    return ok(await this.service.quote(dto));
  }
}
