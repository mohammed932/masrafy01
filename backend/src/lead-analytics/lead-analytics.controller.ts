import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { LeadAnalyticsService } from './lead-analytics.service';

@ApiTags('Admin · Lead analytics')
@ApiBearerAuth()
@Controller('admin/lead-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadAnalyticsController {
  constructor(private readonly service: LeadAnalyticsService) {}

  @Get('activity-summary')
  @Roles('super_admin', 'sales_manager', 'analyst')
  @ApiOperation({ summary: 'Aggregate activity by agent + activity type within a window' })
  async activitySummary(
    @CurrentUser() user: JwtPayload,
    @Query('windowDays', new DefaultValuePipe(30), ParseIntPipe) windowDays: number,
  ) {
    const data = await this.service.getActivitySummary(user.sub, windowDays);
    return { success: true, data };
  }
}
