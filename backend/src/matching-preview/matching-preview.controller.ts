import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { MatchingPreviewService } from './matching-preview.service';
import { PreviewMatchesDto } from '@/questionnaire/dto/questionnaire.dto';

/**
 * Mobile matching preview. Constitution v4.0.0: JWT-gated + profile-complete
 * (no guest). Runs the new approval-probability scoring over active programs.
 */
@ApiTags('Mobile · Matching')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/matching')
@UseGuards(CustomerJwtGuard, CustomerProfileCompleteGuard)
export class MatchingPreviewController {
  constructor(private readonly service: MatchingPreviewService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60 * 60 * 1000 } })
  @ApiOperation({ summary: 'Rank active programs by approval probability for the submitted answers' })
  async preview(@Body() dto: PreviewMatchesDto): Promise<{ success: true; data: unknown }> {
    const result = await this.service.preview({ category: dto.category, answers: dto.answers });
    return ok(result);
  }
}
