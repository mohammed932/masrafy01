import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { CustomerNotFoundException } from '@/common/errors/domain.exceptions';
import { ok } from '@/common/pagination/paginated.response.dto';
import { CustomerAccountRepository } from './customer-account.repository';
import { AdminCustomerAccountsService } from './admin-customer-accounts.service';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { deriveAge } from './age.util';

/**
 * Admin read-only access to customer accounts. Used by the admin
 * dashboard's `/customers` feature (PR #3 admin half). Roles:
 *   - super_admin, sales_manager, analyst can list + view detail
 *   - sales_agent excluded (not in their workflow)
 */
@ApiTags('Admin · Customers')
@ApiBearerAuth('BearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'sales_manager', 'analyst')
@Controller('admin/customers')
export class AdminCustomerAccountsController {
  constructor(
    private readonly repo: CustomerAccountRepository,
    private readonly admin: AdminCustomerAccountsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List customer accounts (paginated, searchable)' })
  async list(
    @Query('q') q?: string,
    @Query('pageSize', new DefaultValuePipe(25), ParseIntPipe) pageSize = 25,
    @Query('pageIndex', new DefaultValuePipe(0), ParseIntPipe) pageIndex = 0,
  ) {
    const size = Math.min(Math.max(pageSize, 1), 100);
    const page = Math.max(pageIndex, 0);
    const result = await this.repo.list({ q, pageSize: size, pageIndex: page });
    return {
      success: true as const,
      data: result.rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        nameSplitNeedsReview: r.nameSplitNeedsReview,
        locale: r.locale,
        isActive: r.isActive,
        isVerified: r.isVerified,
        createdAt: r.createdAt.toISOString(),
        lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
        applicationCount: r.applicationCount,
      })),
      pagination: {
        pageIndex: page,
        pageSize: size,
        total: result.total,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Customer detail with embedded applications + support history' })
  async detail(@Param('id') id: string) {
    const row = await this.repo.detail(id);
    if (!row) throw new CustomerNotFoundException({ id });
    return ok({
      id: row.id,
      phone: row.phone,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      nameSplitNeedsReview: row.nameSplitNeedsReview,
      age: deriveAge(row.birthday) ?? null,
      locale: row.locale,
      isActive: row.isActive,
      isVerified: row.isVerified,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      applications: row.applications.map((a) => ({
        id: a.id,
        loanPurpose: a.loanPurpose,
        status: a.status,
        requestedAmountEGP: a.requestedAmountEGP.toString(),
        createdAt: a.createdAt.toISOString(),
        userProceededAt: a.userProceededAt?.toISOString() ?? null,
      })),
      supportRequests: row.supportRequests.map((s) => ({
        id: s.id,
        channel: s.channel,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        resolvedAt: s.resolvedAt?.toISOString() ?? null,
      })),
    });
  }

  @Patch(':id/status')
  @Roles('super_admin') // tighter than the class-level read roles (method overrides via getAllAndOverride)
  @ApiOperation({ summary: 'Activate / deactivate a customer account (super_admin)' })
  async setStatus(
    @Param('id') id: string,
    @Body() body: UpdateCustomerStatusDto,
    @CurrentUser() actor: JwtPayload,
    @CorrelationId() correlationId: string,
    @Req() req: Request,
  ) {
    const result = await this.admin.setActive(id, body.isActive, {
      actorId: actor.sub,
      sourceIp: this.readClientIp(req),
      correlationId,
    });
    return ok(result);
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
