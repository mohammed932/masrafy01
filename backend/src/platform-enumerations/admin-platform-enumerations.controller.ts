import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { PlatformEnumerationsAdminService } from './platform-enumerations-admin.service';
import {
  CreateEnumerationDto,
  EnumerationRowDto,
  UpdateEnumerationDto,
} from './dto/enumeration.dto';

@ApiTags('Admin · Platform enumerations')
@ApiBearerAuth()
@Controller('admin/enumerations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class AdminPlatformEnumerationsController {
  constructor(private readonly service: PlatformEnumerationsAdminService) {}

  @Get('types')
  @ApiOperation({ summary: 'List enumeration types with member counts' })
  async listTypes() {
    const data = await this.service.listTypes();
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List enumeration members (optionally filtered by type)' })
  async list(@Query('type') type?: string): Promise<{ success: true; data: EnumerationRowDto[] }> {
    const rows = await this.service.listAll({ type });
    return {
      success: true,
      data: rows.map((r) => this.project(r)),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new enumeration member' })
  async create(
    @Body() body: CreateEnumerationDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    const created = await this.service.create(body, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    return { success: true, data: this.project(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update label / active / deprecate / sort order' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateEnumerationDto,
    @CurrentUser() user: JwtPayload,
    @Ip() ip: string,
  ) {
    const updated = await this.service.update(id, body, {
      staffId: user.sub,
      sourceIp: ip ?? null,
    });
    return { success: true, data: this.project(updated) };
  }

  private project(row: {
    id: string;
    type: string;
    key: string;
    labelAr: string;
    labelEn: string;
    active: boolean;
    deprecatedAt: Date | null;
    systemOnly: boolean;
    parentKey: string | null;
    categories: string[];
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): EnumerationRowDto {
    return {
      id: row.id,
      type: row.type,
      key: row.key,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      active: row.active,
      deprecatedAt: row.deprecatedAt?.toISOString() ?? null,
      systemOnly: row.systemOnly,
      parentKey: row.parentKey,
      categories: row.categories,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
