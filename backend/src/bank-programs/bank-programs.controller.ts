import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../common/decorators/current-user.decorator';
import { ok, okPaginated } from '../common/pagination/paginated.response.dto';
import { CreateBankProgramDto } from './dto/create-bank-program.dto';
import { UpdateBankProgramDto } from './dto/update-bank-program.dto';
import { ToggleBankProgramDto } from './dto/toggle-bank-program.dto';
import { ListBankProgramsQuery } from './dto/list-bank-programs.query';
import { PendingBankConfirmationQuery } from './dto/pending-bank-confirmation.query';
import { DuplicateBankProgramDto } from './dto/duplicate-bank-program.dto';
import { IncomeRuleCheckDto } from './dto/income-rule-check.dto';
import { BankProgramsService } from './bank-programs.service';
import { BankProgramNotFoundException } from '../common/errors/domain.exceptions';

interface ActorCtx {
  id: string;
  sourceIp: string | null;
}

@ApiTags('bank-programs-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bank-programs')
export class BankProgramsController {
  constructor(private readonly service: BankProgramsService) {}

  @Get()
  @ApiOperation({ summary: 'List bank programs (paginated, filterable, searchable)' })
  @ApiResponse({ status: 200, description: 'Paginated list of bank programs.' })
  async list(@Query() query: ListBankProgramsQuery) {
    const result = await this.service.list(query);
    return okPaginated(
      result.rows,
      result.pagination.page,
      result.pagination.pageSize,
      result.pagination.totalCount,
    );
  }

  /**
   * Declared BEFORE `@Get(':programCode')` on purpose. Nest matches routes in
   * declaration order, and `:programCode` would otherwise swallow this path and
   * answer with `BANK_PROGRAM_NOT_FOUND` for a program called
   * "pending-bank-confirmation" — a 404 that looks like a data problem and is really
   * a routing one.
   */
  @Get('pending-bank-confirmation')
  @ApiOperation({
    summary: 'Programs held back by a number the team estimated (FR-036)',
    description:
      'Every program with at least one team-estimated value, with the fields concerned and how ' +
      'long it has been waiting. Programs that existed before this feature carry an empty map ' +
      'and never appear (FR-037) — they stay live and are reviewed once, deliberately.',
  })
  @ApiResponse({ status: 200, description: 'Paginated waiting list.' })
  @ApiResponse({ status: 422, description: 'VALIDATION_FAILED' })
  async pendingBankConfirmation(@Query() query: PendingBankConfirmationQuery) {
    const result = await this.service.pendingBankConfirmation({
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    return okPaginated(
      result.rows,
      result.pagination.page,
      result.pagination.pageSize,
      result.pagination.totalCount,
    );
  }

  @Get(':programCode')
  @ApiOperation({ summary: "Fetch a single bank program's full configuration" })
  @ApiResponse({ status: 200, description: 'Bank program detail.' })
  @ApiResponse({ status: 404, description: 'BANK_PROGRAM_NOT_FOUND' })
  async findOne(@Param('programCode') programCode: string) {
    const program = await this.service.findOne(programCode);
    return ok(program);
  }

  @Post()
  @Roles('super_admin', 'sales_manager')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new bank program (admin or super_admin)' })
  @ApiResponse({ status: 201, description: 'Program created.' })
  @ApiResponse({ status: 409, description: 'PROGRAM_CODE_ALREADY_IN_USE' })
  @ApiResponse({
    status: 422,
    description:
      'INVALID_VARIABLE_RATE_CONFIGURATION | INVALID_QUALITATIVE_REVIEW_CEILING | QUALITATIVE_REVIEW_CEILING_BELOW_BASE | DERIVATION_ARITHMETIC_MISMATCH | UNKNOWN_ENUMERATION_KEY | DEPRECATED_ENUMERATION_KEY | VALIDATION_FAILED',
  })
  @ApiResponse({ status: 503, description: 'ENUMERATION_REGISTRY_UNAVAILABLE' })
  async create(
    @Body() body: CreateBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.create(body, this.actor(user, req));
    return ok(program);
  }

  @Post(':programCode')
  @Roles('super_admin', 'sales_manager')
  async update(
    @Param('programCode') programCode: string,
    @Body() body: UpdateBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.update(
      programCode,
      body,
      this.actor(user, req),
    );
    return ok(program);
  }

  @Post(':programCode/income-rule/check')
  @Roles('super_admin', 'sales_manager')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Run a sample applicant against the ON-SCREEN income rule (persists nothing)',
    description:
      'Feature 011 / FR-026 – FR-031. The draft rule travels in the BODY so unsaved edits are ' +
      'what gets evaluated (FR-028). Nothing is written: no application, no lead, no offer ' +
      '(FR-029). Overlays the draft on the saved program snapshot and calls the SAME ' +
      'quoteProgram the matching simulator calls, which is what makes agreement with the ' +
      'simulator structural rather than asserted (FR-030 / SC-007). A resolved income of null ' +
      'is a STATED reason, never a zero (FR-031). `qualifies` is derived from the quote figures ' +
      'alone — no eligibility rule is consulted (FR-027, A33).',
  })
  @ApiResponse({ status: 200, description: 'Check result — figures, or a stated reason.' })
  @ApiResponse({ status: 404, description: 'BANK_PROGRAM_NOT_FOUND' })
  @ApiResponse({
    status: 422,
    description:
      'INCOME_RULE_EMPTY | INCOME_RULE_INCOME_INVALID | INCOME_RULE_DUPLICATE_KEY | ' +
      'INCOME_RULE_UNKNOWN_KEY | INCOME_RULE_BANDS_INVALID | INCOME_RULE_DBR_OVERRIDE_INVALID | ' +
      'VALIDATION_FAILED — the same codes the save path raises, so an unsaveable rule cannot ' +
      'appear to work here.',
  })
  async checkIncomeRule(
    @Param('programCode') programCode: string,
    @Body() body: IncomeRuleCheckDto,
  ) {
    const result = await this.service.checkIncomeRule(programCode, body);
    return ok(result);
  }

  @Post(':programCode/duplicate')
  @Roles('super_admin')
  @HttpCode(201)
  @ApiOperation({ summary: 'Duplicate a program into a new inactive draft (FR-013)' })
  @ApiResponse({ status: 201, description: 'Draft copy created.' })
  @ApiResponse({ status: 404, description: 'BANK_PROGRAM_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'PROGRAM_CODE_ALREADY_IN_USE' })
  async duplicate(
    @Param('programCode') programCode: string,
    @Body() body: DuplicateBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.duplicate(programCode, body, this.actor(user, req));
    return ok(program);
  }

  @Post(':programCode/toggle')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: 'Toggle a program active/inactive' })
  @ApiResponse({ status: 200, description: 'Toggled.' })
  @ApiResponse({ status: 409, description: 'CONFLICT_STALE_DATA' })
  async toggle(
    @Param('programCode') programCode: string,
    @Body() body: ToggleBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const program = await this.service.toggle(
      programCode,
      body.active,
      body.version,
      this.actor(user, req),
    );
    return ok(program);
  }

  @Delete(':programCode')
  @Roles('super_admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a bank program (super_admin only)' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 409, description: 'BANK_PROGRAM_HAS_OFFERS' })
  async delete(
    @Param('programCode') programCode: string,
    @Headers('x-confirm-program-code') confirmHeader: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<void> {
    if (!confirmHeader || confirmHeader !== programCode) {
      throw new BankProgramNotFoundException({ programCode });
    }
    await this.service.deleteByCode(programCode, this.actor(user, req));
  }

  private actor(user: JwtPayload, req: Request): ActorCtx {
    return {
      id: user.sub,
      sourceIp: this.readClientIp(req),
    };
  }

  private readClientIp(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? null;
    }
    return req.ip ?? null;
  }
}
