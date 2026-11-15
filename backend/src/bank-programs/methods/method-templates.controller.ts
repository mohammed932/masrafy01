import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { ok } from '../../common/pagination/paginated.response.dto';
import { CreateMethodTemplateDto, UpdateMethodTemplateDto } from './method-templates.dto';
import { MethodTemplatesService } from './method-templates.service';

/** Ready methods (v37.0.0) — the list the product page's "Use a ready method" picks from. */
@ApiTags('bank-programs-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/bank-programs/method-templates')
export class MethodTemplatesController {
  constructor(private readonly service: MethodTemplatesService) {}

  @Get()
  @Roles('super_admin', 'sales_manager')
  @ApiOperation({ summary: 'Every ready method, in list order' })
  async list() {
    return ok(await this.service.list());
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Add a ready method',
    description: 'Validated as a product way. Picking it on a product copies it.',
  })
  @ApiResponse({ status: 409, description: 'METHOD_TEMPLATE_NAME_TAKEN' })
  @ApiResponse({ status: 422, description: 'PRODUCT_TEMPLATE_INVALID' })
  async create(@Body() body: CreateMethodTemplateDto, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.create(body, user?.sub));
  }

  @Put(':key')
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Change a ready method',
    description:
      'Rewrites the method on every product linked to it (the response lists them, and any ' +
      'product whose save refused the change).',
  })
  @ApiResponse({ status: 404, description: 'METHOD_TEMPLATE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'METHOD_TEMPLATE_NAME_TAKEN' })
  @ApiResponse({ status: 422, description: 'PRODUCT_TEMPLATE_INVALID' })
  async update(
    @Param('key') key: string,
    @Body() body: UpdateMethodTemplateDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const forwarded = req.headers['x-forwarded-for'];
    const sourceIp =
      typeof forwarded === 'string' ? (forwarded.split(',')[0]?.trim() ?? null) : (req.ip ?? null);
    return ok(await this.service.update(key, body, { id: user.sub, sourceIp }));
  }

  @Delete(':key')
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Delete a ready method',
    description: 'Refused while a product is linked to it. Never re-seeded once deleted.',
  })
  @ApiResponse({ status: 404, description: 'METHOD_TEMPLATE_NOT_FOUND' })
  @ApiResponse({ status: 409, description: 'METHOD_TEMPLATE_IN_USE' })
  async remove(@Param('key') key: string, @CurrentUser() user: JwtPayload) {
    return ok(await this.service.remove(key, user?.sub));
  }
}
