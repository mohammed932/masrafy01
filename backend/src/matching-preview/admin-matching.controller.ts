import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { PreviewMatchesDto } from '@/questionnaire/dto/questionnaire.dto';
import { MatchingPreviewService } from './matching-preview.service';

/**
 * Admin matching simulator. Runs the SAME full engine + per-bank weighted
 * approval scoring as the customer preview (`MatchingPreviewService`), but
 * admin-JWT-gated — lets ops test "what would programs decide for applicant X"
 * (eligibility + installment + fees + approval %) without creating a real
 * application. Read-only: persists nothing.
 */
@ApiTags('Admin · Matching simulator')
@ApiBearerAuth()
@Controller('admin/matching')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'analyst')
export class AdminMatchingController {
  constructor(private readonly service: MatchingPreviewService) {}

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run full matching + approval scoring for a sample applicant (no persistence)' })
  async simulate(@Body() dto: PreviewMatchesDto): Promise<{ success: true; data: unknown }> {
    const result = await this.service.preview({ category: dto.category, answers: dto.answers });
    return ok(result);
  }
}
