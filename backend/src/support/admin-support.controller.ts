import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupportChannel, SupportStatus } from './dto/enums';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { SupportService } from './support.service';
import {
  AssignSupportRequestDto,
  SupportContactResponseDto,
  SupportRequestResponseDto,
  UpdateSupportConfigDto,
} from './dto/support.dto';

@ApiTags('Admin · Support')
@ApiBearerAuth('BearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/support')
export class AdminSupportController {
  constructor(private readonly svc: SupportService) {}

  @Get('requests')
  @Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
  @ApiOperation({ summary: 'List support requests (paginated, filterable)' })
  async list(
    @Query('status') status?: SupportStatus,
    @Query('channel') channel?: SupportChannel,
    @Query('assignedStaffId') assignedStaffId?: string,
    @Query('pageSize', new DefaultValuePipe(25), ParseIntPipe) pageSize = 25,
    @Query('pageIndex', new DefaultValuePipe(0), ParseIntPipe) pageIndex = 0,
  ) {
    const size = Math.min(Math.max(pageSize, 1), 100);
    const page = Math.max(pageIndex, 0);
    const result = await this.svc.listAdmin({
      status,
      channel,
      assignedStaffId,
      pageIndex: page,
      pageSize: size,
    });
    return {
      success: true as const,
      data: result.rows,
      pagination: { pageIndex: page, pageSize: size, total: result.total },
    };
  }

  @Get('requests/:id')
  @Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
  @ApiOperation({ summary: 'Support request detail' })
  async detail(@Param('id') id: string) {
    const data = await this.svc.detailAdmin(id);
    return ok(data);
  }

  @Patch('requests/:id/assign')
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: 'Assign a support request to a staff agent' })
  async assign(
    @Param('id') id: string,
    @Body() body: AssignSupportRequestDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: SupportRequestResponseDto }> {
    const data = await this.svc.assignAdmin({
      id,
      staffId: body.staffId,
      actorStaffId: user.sub,
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
    return ok(data);
  }

  @Patch('requests/:id/resolve')
  @Roles('super_admin', 'sales_manager', 'sales_agent')
  @ApiOperation({ summary: 'Mark a support request as resolved' })
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: SupportRequestResponseDto }> {
    const data = await this.svc.resolveAdmin({
      id,
      actorStaffId: user.sub,
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
    return ok(data);
  }

  @Get('config')
  @Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
  @ApiOperation({ summary: 'Read support config singleton' })
  async getConfig(): Promise<{ success: true; data: SupportContactResponseDto }> {
    const data = await this.svc.getConfigAdmin();
    return ok(data);
  }

  @Put('config')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update support config singleton (super_admin only)' })
  async updateConfig(
    @Body() body: UpdateSupportConfigDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: SupportContactResponseDto }> {
    const data = await this.svc.updateConfigAdmin({
      actorStaffId: user.sub,
      patch: {
        phone: body.phone,
        email: body.email,
        whatsappUrl: body.whatsappUrl,
        hoursAr: body.hoursAr,
        hoursEn: body.hoursEn,
      },
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
    return ok(data);
  }
}
