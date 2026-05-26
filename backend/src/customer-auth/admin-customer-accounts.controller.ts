import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { CustomerNotFoundException } from '@/common/errors/domain.exceptions';
import { ok } from '@/common/pagination/paginated.response.dto';
import { CustomerAccountRepository } from './customer-account.repository';

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
  constructor(private readonly repo: CustomerAccountRepository) {}

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
        name: r.name,
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
      name: row.name,
      locale: row.locale,
      isActive: row.isActive,
      isVerified: row.isVerified,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      applications: row.applications.map((a) => ({
        id: a.id,
        loanPurpose: a.loanPurpose,
        status: a.status,
        leadStatus: a.leadStatus,
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
}
