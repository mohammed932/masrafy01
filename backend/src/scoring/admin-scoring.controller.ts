import { Body, Controller, Get, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { ScoringService } from './scoring.service';
import { parseCategory } from '@/questionnaire/category.util';
import { SaveWeightsDto } from './dto/scoring.dto';

/**
 * Admin approval-scoring: per-bank-program per-answer points, saved directly
 * (Constitution V — no maker-checker). Weights are keyed by `optionCode` with no
 * sum constraint; saving atomically archives the prior ACTIVE set.
 */
@ApiTags('Admin · Scoring weights')
@ApiBearerAuth()
@Controller('admin/scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager')
export class AdminScoringController {
  constructor(private readonly service: ScoringService) {}

  @Get('questions/:category')
  @ApiOperation({ summary: 'List the category questions with their answers (points per answer)' })
  async questions(@Param('category') category: string) {
    return ok(await this.service.listWeightableOptions(parseCategory(category)));
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
