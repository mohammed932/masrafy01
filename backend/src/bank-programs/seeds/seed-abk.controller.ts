import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/pagination/paginated.response.dto';
import { SeedService } from './seed.service';

@ApiTags('bank-programs-seeds')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bank-programs/seeds/abk')
export class SeedAbkController {
  constructor(private readonly seeds: SeedService) {}

  @Post()
  @Roles('super_admin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Seed the ABK Egypt 17-program catalog (super_admin only)' })
  async seed(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const result = await this.seeds.seedAbk({
      id: user.sub,
      sourceIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null,
    });
    return ok(result);
  }
}
