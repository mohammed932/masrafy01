import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { QuestionnaireService } from './questionnaire.service';
import { parseCategory } from './category.util';

/**
 * Mobile-facing questionnaire fetch. Constitution v4.0.0: JWT-gated (no guest).
 * Returns the active published snapshot for a category (Spec §5.2).
 */
@ApiTags('Mobile · Questionnaire')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1/questionnaire')
@UseGuards(CustomerJwtGuard)
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  @Get(':category')
  @ApiOperation({ summary: 'Active questionnaire snapshot for a loan category' })
  async getActive(@Param('category') category: string): Promise<{ success: true; data: unknown }> {
    const snapshot = await this.service.activeSnapshot(parseCategory(category));
    return ok(snapshot);
  }
}
