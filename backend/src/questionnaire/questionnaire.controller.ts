import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { QuestionnaireService } from './questionnaire.service';

/**
 * Mobile-facing questionnaire fetch. JWT-gated, no guest (v4.0.0), and
 * profile-complete-gated (Principle XXXVII) like matching + apply: an incomplete
 * profile gets PROFILE_INCOMPLETE. Returns the single active published snapshot —
 * ONE global questionnaire (Feature 010); the loan category only decides which
 * programs get matched, not which questions get asked.
 */
@ApiTags('Mobile · Questionnaire')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/questionnaire')
@UseGuards(CustomerJwtGuard, CustomerProfileCompleteGuard)
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Get()
  @ApiOperation({ summary: 'Active global questionnaire snapshot' })
  async getActive(): Promise<{ success: true; data: unknown }> {
    const snapshot = await this.service.activeSnapshot();
    return ok(snapshot);
  }
}
