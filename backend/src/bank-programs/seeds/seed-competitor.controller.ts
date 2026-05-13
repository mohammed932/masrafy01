import { Controller, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { CorrelationId } from '../../common/decorators/correlation-id.decorator';
import { ok } from '../../common/pagination/paginated.response.dto';
import { SeedService } from './seed.service';
import { BankProgramNotFoundException } from '../../common/errors/domain.exceptions';

const ALLOWED = ['bank-nxt-2026', 'salesfloor-egp-2026'] as const;
type Allowed = (typeof ALLOWED)[number];

@ApiTags('bank-programs-seeds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bank-programs/seeds/competitor')
export class SeedCompetitorController {
  constructor(private readonly seeds: SeedService) {}

  @Post(':catalogName')
  @Roles('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Seed a competitor catalog (super_admin only; OFF by default)' })
  async seed(
    @Param('catalogName') catalogName: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ) {
    if (!ALLOWED.includes(catalogName as Allowed)) {
      throw new BankProgramNotFoundException({ programCode: catalogName });
    }
    const result = await this.seeds.seedCompetitor(catalogName as Allowed, {
      id: user.sub,
      sourceIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null,
      correlationId,
    });
    return ok(result);
  }
}
