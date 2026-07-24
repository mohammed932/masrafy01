import { Body, Controller, Get, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { ScoringService } from './scoring.service';
import { SaveWeightsDto } from './dto/scoring.dto';

/**
 * Admin approval-scoring: per-bank-program two-level weights, saved directly
 * (Constitution V — no maker-checker). The admin ticks which global questions a
 * program scores on (assignment = weight-set membership, Feature 010), gives
 * each a weight (sum 100) + per-answer scores (0–100); saving atomically
 * archives the prior ACTIVE set.
 */
@ApiTags('Admin · Scoring weights')
@ApiBearerAuth()
@Controller('admin/scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager')
export class AdminScoringController {
  constructor(private readonly service: ScoringService) {}

  @Get('questions')
  @ApiOperation({ summary: 'List the global question pool with answers (for assign + score)' })
  async questions() {
    return ok(await this.service.listWeightableOptions());
  }

  @Get('programs/:programId/weights')
  @ApiOperation({ summary: 'Active weight set for a program' })
  async weights(@Param('programId') programId: string) {
    return ok(await this.service.getProgramWeights(programId));
  }

  @Post('programs/:programId/weights')
  @ApiOperation({ summary: 'Save per-answer points (direct; keyed by optionCode, no sum)' })
  async save(
    @Param('programId') programId: string,
    @Body() dto: SaveWeightsDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    return ok(
      await this.service.saveWeights(programId, dto, user.sub, {
        sourceIp: ip ?? null,
      }),
    );
  }

  @Get('programs/:programId/weights/history')
  @ApiOperation({ summary: 'All weight sets for a program (newest first)' })
  async history(@Param('programId') programId: string) {
    return ok(await this.service.history(programId));
  }
}
