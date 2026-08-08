import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { CustomerProfileCompletenessService } from '@/customer-auth/customer-profile-completeness.service';
import { ForbiddenException } from '@/common/errors/domain.exceptions';
import { ok } from '@/common/pagination/paginated.response.dto';
import { MatchingPreviewService } from './matching-preview.service';
import { PreviewMatchesDto } from '@/questionnaire/dto/questionnaire.dto';

/** What `CustomerJwtGuard` attaches — the customer id is the JWT `sub`. */
type CustomerAuthedRequest = Request & { user?: { sub?: string } };

/**
 * Mobile matching preview. Constitution v4.0.0: JWT-gated + profile-complete
 * (no guest). Runs the new approval-probability scoring over active programs.
 * The applicant age is DERIVED from the caller's `birthday` (Principle XXXVII /
 * A31) — never read from the body — so a previewed tenor and installment match
 * what apply later produces for the same customer.
 */
@ApiTags('Mobile · Matching')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/matching')
@UseGuards(CustomerJwtGuard, CustomerProfileCompleteGuard)
export class MatchingPreviewController {
  constructor(
    private readonly service: MatchingPreviewService,
    private readonly completeness: CustomerProfileCompletenessService,
  ) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Rank active programs by approval probability for the submitted answers' })
  async preview(
    @Body() dto: PreviewMatchesDto,
    @Req() req: CustomerAuthedRequest,
  ): Promise<{ success: true; data: unknown }> {
    const age = await this.completeness.getApplicantAge(this.requireCustomerId(req));
    const result = await this.service.preview({
      category: dto.category,
      answers: dto.answers,
      age,
      programNameKey: dto.programNameKey,
    });
    return ok(result);
  }

  private requireCustomerId(req: CustomerAuthedRequest): string {
    const sub = req.user?.sub;
    if (!sub) throw new ForbiddenException();
    return sub;
  }
}
