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
import { CorrelationId } from '../common/decorators/correlation-id.decorator';
import { ok, okPaginated } from '../common/pagination/paginated.response.dto';
import { CreateBankProgramDto } from './dto/create-bank-program.dto';
import { UpdateBankProgramDto } from './dto/update-bank-program.dto';
import { ToggleBankProgramDto } from './dto/toggle-bank-program.dto';
import { ListBankProgramsQuery } from './dto/list-bank-programs.query';
import { BankProgramsService } from './bank-programs.service';
import { BankProgramNotFoundException } from '../common/errors/domain.exceptions';

interface ActorCtx {
  id: string;
  sourceIp: string | null;
  correlationId: string;
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
    @CorrelationId() correlationId: string,
  ) {
    const program = await this.service.create(body, this.actor(user, req, correlationId));
    return ok(program);
  }

  @Post(':programCode')
  @Roles('super_admin', 'sales_manager')
  async update(
    @Param('programCode') programCode: string,
    @Body() body: UpdateBankProgramDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ) {
    const program = await this.service.update(
      programCode,
      body,
      this.actor(user, req, correlationId),
    );
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
    @CorrelationId() correlationId: string,
  ) {
    const program = await this.service.toggle(
      programCode,
      body.active,
      body.version,
      this.actor(user, req, correlationId),
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
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    if (!confirmHeader || confirmHeader !== programCode) {
      throw new BankProgramNotFoundException({ programCode });
    }
    await this.service.deleteByCode(programCode, this.actor(user, req, correlationId));
  }

  private actor(user: JwtPayload, req: Request, correlationId: string): ActorCtx {
    return {
      id: user.sub,
      sourceIp: this.readClientIp(req),
      correlationId,
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
