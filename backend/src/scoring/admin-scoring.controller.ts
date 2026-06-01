import { Body, Controller, Get, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { ok } from '@/common/pagination/paginated.response.dto';
import { ScoringService } from './scoring.service';
import { parseCategory } from '@/questionnaire/category.util';
import {
  CreateScoringFactorDto,
  RejectWeightsDto,
  UpsertWeightsDraftDto,
} from './dto/scoring.dto';

/**
 * Admin approval-scoring: factors (read/seed) + per-bank weight sets via the
 * two-person maker-checker flow (Constitution V v4.1.0). Approver MUST differ
 * from the maker; weights MUST sum to 100; activate+archive is atomic.
 */
@ApiTags('Admin · Scoring weights')
@ApiBearerAuth()
@Controller('admin/scoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager')
export class AdminScoringController {
  constructor(private readonly service: ScoringService) {}

  @Get('factors/:category')
  @ApiOperation({ summary: 'List active scoring factors for a category' })
  async factors(@Param('category') category: string) {
    return ok(await this.service.listFactors(parseCategory(category)));
  }

  @Post('factors')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a scoring factor (super_admin)' })
  async createFactor(@Body() dto: CreateScoringFactorDto) {
    return ok(await this.service.createFactor(dto));
  }

  @Get('programs/:programId/weights')
  @ApiOperation({ summary: 'Active + draft/pending weight sets for a program' })
  async weights(@Param('programId') programId: string) {
    return ok(await this.service.getProgramWeights(programId));
  }

  @Post('programs/:programId/weights/draft')
  @ApiOperation({ summary: 'Create/update the DRAFT weight set (maker)' })
  async draft(
    @Param('programId') programId: string,
    @Body() dto: UpsertWeightsDraftDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ok(await this.service.upsertDraft(programId, dto, user.sub));
  }

  @Post('programs/:programId/weights/submit')
  @ApiOperation({ summary: 'Submit DRAFT → PENDING_APPROVAL (maker; weights must sum to 100)' })
  async submit(
    @Param('programId') programId: string,
    @CurrentUser() user: JwtPayload,
    @CorrelationId() correlationId: string,
    @Ip() ip: string,
  ) {
    return ok(await this.service.submit(programId, user.sub, { sourceIp: ip ?? null, correlationId }));
  }

  @Post('weights/:setId/approve')
  @ApiOperation({ summary: 'Approve PENDING → ACTIVE (checker ≠ maker; atomic activate+archive)' })
  async approve(
    @Param('setId') setId: string,
    @CurrentUser() user: JwtPayload,
    @CorrelationId() correlationId: string,
    @Ip() ip: string,
  ) {
    return ok(await this.service.approve(setId, user.sub, { sourceIp: ip ?? null, correlationId }));
  }

  @Post('weights/:setId/reject')
  @ApiOperation({ summary: 'Reject PENDING → REJECTED with reason (checker)' })
  async reject(
    @Param('setId') setId: string,
    @Body() dto: RejectWeightsDto,
    @CurrentUser() user: JwtPayload,
    @CorrelationId() correlationId: string,
    @Ip() ip: string,
  ) {
    return ok(await this.service.reject(setId, user.sub, dto, { sourceIp: ip ?? null, correlationId }));
  }

  @Get('programs/:programId/weights/history')
  @ApiOperation({ summary: 'All weight sets for a program (newest first)' })
  async history(@Param('programId') programId: string) {
    return ok(await this.service.history(programId));
  }

  @Get('weights/pending')
  @ApiOperation({ summary: 'Inbox of PENDING_APPROVAL weight sets (checker)' })
  async pending() {
    return ok(await this.service.pendingInbox());
  }
}
