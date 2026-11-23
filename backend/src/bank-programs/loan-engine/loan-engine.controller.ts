/**
 * Feature 013 — the Loan Engine admin API. Contract: `specs/013-loan-engine-rules/contracts/`.
 *
 * Its own prefix (`admin/loan-engine`), so no route here competes with
 * `admin/bank-programs/:programCode` for a path segment.
 */
import { Body, Controller, Get, Param, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/pagination/paginated.response.dto';
import {
  LoanEngineEffectParamsDto,
  LoanEngineProgramParamDto,
  LoanEngineQuestionParamDto,
  LoanEngineQuestionsQueryDto,
  PutEffectRowsDto,
  PutProgramConditionsDto,
} from './dto/loan-engine.dto';
import { LoanEngineService, type LoanEngineActor } from './loan-engine.service';

@ApiTags('loan-engine-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/loan-engine')
export class LoanEngineController {
  constructor(private readonly service: LoanEngineService) {}

  @Get('questions')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({
    summary: 'Questions, each with the figure it answers and how many programs read it',
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED (unknown category)' })
  async listQuestions(@Query() query: LoanEngineQuestionsQueryDto) {
    return ok(await this.service.listQuestions(query.category, query.search));
  }

  @Get('rules')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({
    summary: 'Every rule the engine applies, program by program (conditions + answer tables)',
  })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED (unknown category)' })
  async rulebook(@Query() query: LoanEngineQuestionsQueryDto) {
    return ok(await this.service.rulebook(query.category));
  }

  @Get('questions/:questionCode')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: "One question's effects on every active program in its loan types" })
  @ApiResponse({ status: 404, description: 'QUESTION_NOT_FOUND' })
  async questionDetail(@Param() params: LoanEngineQuestionParamDto) {
    return ok(await this.service.questionDetail(params.questionCode));
  }

  @Put('questions/:questionCode/programs/:programCode/effects/:effect')
  @Roles('super_admin')
  @ApiOperation({ summary: "Replace one program's rows for one effect of this question" })
  @ApiResponse({ status: 404, description: 'QUESTION_NOT_FOUND | BANK_PROGRAM_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'CONFLICT_STALE_DATA' })
  @ApiResponse({
    status: 422,
    description:
      'LOAN_ENGINE_RULE_INVALID (meta.problem) | the program-save validators (fact grid, cap table, additional income)',
  })
  async putEffect(
    @Param() params: LoanEngineEffectParamsDto,
    @Body() body: PutEffectRowsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(
      await this.service.putEffect(
        params.questionCode,
        params.programCode,
        params.effect,
        body,
        actorOf(user, req),
      ),
    );
  }

  @Put('programs/:programCode/conditions')
  @Roles('super_admin')
  @ApiOperation({
    summary: "Replace a program's eligibility conditions (refused, never hidden — Principle V)",
  })
  @ApiResponse({ status: 404, description: 'QUESTION_NOT_FOUND | BANK_PROGRAM_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'CONFLICT_STALE_DATA' })
  @ApiResponse({
    status: 422,
    description:
      'LOAN_ENGINE_RULE_INVALID (engine_input | not_linked | shape | unknown_option | empty_band | read_only_surface) | VALIDATION_FAILED (duplicate id, unknown reasonCode)',
  })
  async putConditions(
    @Param() params: LoanEngineProgramParamDto,
    @Body() body: PutProgramConditionsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return ok(await this.service.putConditions(params.programCode, body, actorOf(user, req)));
  }
}

function actorOf(user: JwtPayload, req: Request): LoanEngineActor {
  const forwarded = req.headers['x-forwarded-for'];
  const sourceIp =
    typeof forwarded === 'string' ? (forwarded.split(',')[0]?.trim() ?? null) : (req.ip ?? null);
  return { id: user.sub, sourceIp };
}
