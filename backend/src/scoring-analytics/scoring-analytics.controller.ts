/**
 * GET /api/admin/scoring-analytics?windowDays=N
 * JWT + RolesGuard, open to super_admin / sales_manager / analyst.
 */
import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { ScoringAnalyticsService } from './scoring-analytics.service';

@ApiTags('Admin · Scoring')
@ApiBearerAuth()
@Controller('admin/scoring-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'analyst')
export class ScoringAnalyticsController {
  constructor(private readonly service: ScoringAnalyticsService) {}

  @Get()
  @ApiOperation({ summary: 'Distribution + per-tier accuracy over a windowed look-back' })
  async getAnalytics(
    @Query('windowDays', new DefaultValuePipe(30), ParseIntPipe) windowDays: number,
  ): Promise<unknown> {
    const data = await this.service.getAnalytics(windowDays);
    return { success: true, data };
  }
}
