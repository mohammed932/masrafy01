import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { CustomerProfileCompletenessService } from '@/customer-auth/customer-profile-completeness.service';
import { ForbiddenException } from '@/common/errors/domain.exceptions';
import { ok } from '@/common/pagination/paginated.response.dto';
import { CalculatorService } from './calculator.service';
import { CalculatorQuoteDto } from './dto/calculator.dto';

/** What `CustomerJwtGuard` attaches — the customer id is the JWT `sub`. */
type CustomerAuthedRequest = Request & { user?: { sub?: string } };

/**
 * Loan calculator. JWT-gated AND profile-complete-gated: the age-at-maturity
 * rule prices the tenor off the customer's DERIVED age (Principle XXXVII / A31),
 * and a complete profile always carries a `birthday`. Gating here is what makes
 * a calculator figure agree with the offer the same customer later gets from
 * apply — an ungated calculator would have to assume an age and quote a term
 * apply would then shorten. Persists nothing.
 */
@ApiTags('Mobile · Calculator')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/calculator')
@UseGuards(CustomerJwtGuard, CustomerProfileCompleteGuard)
export class CalculatorController {
  constructor(
    private readonly service: CalculatorService,
    private readonly completeness: CustomerProfileCompletenessService,
  ) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60 * 60 * 1000 } })
  @ApiOperation({
    summary: 'Cost of a given loan, or the largest loan a given income supports',
  })
  async quote(
    @Body() dto: CalculatorQuoteDto,
    @Req() req: CustomerAuthedRequest,
  ): Promise<{ success: true; data: unknown }> {
    const age = await this.completeness.getApplicantAge(this.requireCustomerId(req));
    return ok(await this.service.quote(dto, age));
  }

  private requireCustomerId(req: CustomerAuthedRequest): string {
    const sub = req.user?.sub;
    if (!sub) throw new ForbiddenException();
    return sub;
  }
}
