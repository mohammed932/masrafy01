/**
 * Admin scoring-versions endpoints:
 *   GET  /api/admin/scoring-versions/:version  — read a registered version (incl. factorCatalog)
 *   POST /api/admin/scoring-versions/:version/activate — promote (Phase 6 / US5)
 *
 * Constitution Principle XIII: JWT + RolesGuard. Read is open to all 4 roles
 * (the admin detail panel reads the offer's engine catalog regardless of role).
 * Activation is super_admin-only — wired in Phase 6 (T059).
 */
import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { ScoringEngineVersionService } from './scoring-versions.service';

@ApiTags('Admin · Scoring')
@ApiBearerAuth()
@Controller('admin/scoring-versions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScoringVersionsController {
  constructor(private readonly service: ScoringEngineVersionService) {}

  @Get(':version')
  @Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
  @ApiOperation({ summary: 'Read a registered scoring engine version' })
  async getByVersion(@Param('version') version: string): Promise<unknown> {
    const config = await this.service.getConfigByVersion(version);
    return {
      success: true,
      data: {
        version: config.version,
        thresholds: config.thresholds,
        factorCatalog: config.factorCatalog,
        legacy: config.legacy,
      },
    };
  }

  @Post(':version/activate')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Activate (promote) a registered scoring engine version' })
  async activate(
    @Param('version') version: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<unknown> {
    const result = await this.service.activate(version, {
      id: user.sub,
      sourceIp: (req.ip ?? null) as string | null,
      correlationId,
    });
    return { success: true, data: result };
  }
}
