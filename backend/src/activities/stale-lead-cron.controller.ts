// Dev-only manual trigger for the stale-lead scanner. Registered inside
// ActivitiesModule.controllers ONLY when NODE_ENV !== 'production' so the
// endpoint is physically absent from the prod surface area.

import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { StaleLeadScanner, type StaleLeadScanResult } from './stale-lead-scanner';

@ApiTags('Admin · Cron (dev-only)')
@ApiBearerAuth()
@Controller('admin/cron')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaleLeadCronController {
  constructor(private readonly scanner: StaleLeadScanner) {}

  @Post('stale-leads')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Manually trigger the stale-lead scan (dev only)' })
  async triggerStaleLeadScan(): Promise<{ success: true; data: StaleLeadScanResult }> {
    const result = await this.scanner.scan();
    return { success: true, data: result };
  }
}
