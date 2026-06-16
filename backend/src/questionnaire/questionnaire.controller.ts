import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { QuestionnaireService } from './questionnaire.service';
import { parseCategory } from './category.util';

/**
 * Mobile-facing questionnaire fetch. JWT-gated, no guest (v4.0.0), and
 * profile-complete-gated (Principle XXXVII) like matching + apply: an incomplete
 * profile gets PROFILE_INCOMPLETE. Returns the active published snapshot.
 */
@ApiTags('Mobile · Questionnaire')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/questionnaire')
@UseGuards(CustomerJwtGuard, CustomerProfileCompleteGuard)
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Get(':category')
  @ApiOperation({ summary: 'Active questionnaire snapshot for a loan category' })
  async getActive(@Param('category') category: string): Promise<{ success: true; data: unknown }> {
    const snapshot = await this.service.activeSnapshot(parseCategory(category));
    return ok(snapshot);
  }
}
