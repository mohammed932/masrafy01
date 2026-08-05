import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LoanCategory } from '@prisma/client';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { QuestionnaireService } from './questionnaire.service';
import { parseCategory } from './category.util';

/**
 * Mobile-facing questionnaire fetch. JWT-gated, no guest (v4.0.0), and
 * profile-complete-gated (Principle XXXVII) like matching + apply: an incomplete
 * profile gets PROFILE_INCOMPLETE.
 *
 * Returns the single active published snapshot. The question POOL stays global —
 * one canonical list, one version — but each question is assigned to one or more
 * loan categories in the dashboard, so `?category=` narrows the snapshot to the
 * questions that category actually asks. Omitting it returns the whole pool
 * (the pre-assignment behaviour), which keeps an older client working.
 */
@ApiTags('Mobile · Questionnaire')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/questionnaire')
@UseGuards(CustomerJwtGuard, CustomerProfileCompleteGuard)
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Get()
  @ApiOperation({ summary: 'Active questionnaire snapshot, narrowed to a loan category' })
  @ApiQuery({
    name: 'category',
    enum: LoanCategory,
    required: false,
    description: 'Omit to receive every question in the pool',
  })
  async getActive(@Query('category') category?: string): Promise<{ success: true; data: unknown }> {
    // An unknown value is rejected rather than silently ignored: falling back to
    // the full pool would ask the applicant questions their category never asks.
    const parsed = category === undefined ? undefined : parseCategory(category);
    const snapshot = await this.service.activeSnapshot(parsed);
    return ok(snapshot);
  }
}
