import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { BanksService, type ActorCtx } from './banks.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { ToggleBankDto } from './dto/toggle-bank.dto';
import { ListBanksQuery } from './dto/list-banks.query';

class LogoUploadRequestDto {
  contentType!: string;
}
class LogoUploadConfirmDto {
  key!: string;
}

@ApiTags('banks-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/banks')
export class BanksController {
  constructor(private readonly service: BanksService) {}

  private actor(user: JwtPayload, req: Request): ActorCtx {
    return {
      id: user.sub,
      sourceIp: req.ip ?? null,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List banks (paginated, filterable, searchable)' })
  async list(@Query() query: ListBanksQuery) {
    const result = await this.service.list(query);
    return okPaginated(result.rows, result.pagination.page, result.pagination.pageSize, result.pagination.totalCount);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Bank detail + linked programs count' })
  async findOne(@Param('id') id: string) {
    const { bank } = await this.service.findById(id);
    return ok(bank);
  }

  @Get(':id/programs')
  @ApiOperation({ summary: 'List programs linked to a bank' })
  async listPrograms(@Param('id') id: string) {
    const rows = await this.service.listPrograms(id);
    return ok(rows);
  }

  @Post()
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a bank (super_admin)' })
  @ApiResponse({ status: 201 })
  async create(
    @Body() dto: CreateBankDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const bank = await this.service.create(dto, this.actor(user, req));
    return ok(bank);
  }

  @Patch(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Edit a bank (super_admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBankDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const bank = await this.service.update(id, dto, this.actor(user, req));
    return ok(bank);
  }

  @Patch(':id/toggle')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Toggle active flag (super_admin)' })
  async toggle(
    @Param('id') id: string,
    @Body() dto: ToggleBankDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const bank = await this.service.toggle(id, dto, this.actor(user, req));
    return ok(bank);
  }

  @Delete(':id')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete a bank (super_admin). Refuses if programs exist.' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    await this.service.remove(id, this.actor(user, req));
    return ok({ id });
  }

  @Post(':id/logo/request-upload')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Request a presigned PUT URL for a bank logo (super_admin)' })
  async requestLogoUpload(@Param('id') id: string, @Body() dto: LogoUploadRequestDto) {
    const presigned = await this.service.requestLogoUpload(id, dto.contentType);
    return ok(presigned);
  }

  @Post(':id/logo/confirm-upload')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Confirm uploaded logo + bind to bank (super_admin)' })
  async confirmLogoUpload(
    @Param('id') id: string,
    @Body() dto: LogoUploadConfirmDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const bank = await this.service.confirmLogoUpload(id, dto.key, this.actor(user, req));
    return ok(bank);
  }
}
