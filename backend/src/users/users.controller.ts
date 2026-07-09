import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { McpGuard } from '@/auth/guards/mcp.guard';
import { ok, okPaginated } from '@/common/pagination/paginated.response.dto';
import { PaginationQueryDto } from '@/common/pagination/pagination.query.dto';
import { UsersService, type ActionContext } from './users.service';
import { CreateStaffRequestDto } from './dto/create-staff.request.dto';
import { UpdateStaffRequestDto } from './dto/update-staff.request.dto';
import { ResetPasswordRequestDto } from './dto/reset-password.request.dto';
import { toStaffSummaryDto } from './dto/staff-account.response.dto';

@ApiTags('admin-users')
@ApiBearerAuth('BearerAuth')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard, McpGuard)
@Roles('super_admin')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List staff accounts (super_admin)' })
  async list(@Query() query: PaginationQueryDto) {
    const result = await this.users.list({ page: query.page, pageSize: query.pageSize });
    return okPaginated(
      result.rows.map(toStaffSummaryDto),
      query.page,
      query.pageSize,
      result.total,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create staff account (super_admin)' })
  async create(
    @Body() body: CreateStaffRequestDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ) {
    const created = await this.users.create(body, this.ctx(actor, req));
    return ok(toStaffSummaryDto(created));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one staff account (super_admin)' })
  async getById(@Param('id') id: string) {
    const row = await this.users.getById(id);
    return ok(toStaffSummaryDto(row));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update staff account (super_admin)' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStaffRequestDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ) {
    const updated = await this.users.update(id, body, this.ctx(actor, req));
    return ok(toStaffSummaryDto(updated));
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset another user’s password (super_admin)' })
  async resetPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordRequestDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req: Request,
  ): Promise<void> {
    await this.users.resetPassword(id, body.newPassword, this.ctx(actor, req));
  }

  // ---- Internals ----------------------------------------------------------

  private ctx(actor: JwtPayload, req: Request): ActionContext {
    return {
      actorId: actor.sub,
      sourceIp: this.readClientIp(req),
    };
  }

  private readClientIp(req: Request): string | null {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      const first = xff.split(',')[0]?.trim();
      if (first && first.length > 0) return first;
    }
    return req.ip ?? null;
  }
}
