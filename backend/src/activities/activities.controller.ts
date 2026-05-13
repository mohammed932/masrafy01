import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Headers,
  Ip,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { ActivitiesService } from './activities.service';
import { CreateActivityRequestDto } from './dto/create-activity.request.dto';
import type { ActivityActorRole } from './activities.types';

@ApiTags('Admin · Applications · Activities')
@ApiBearerAuth()
@Controller('admin/applications/:applicationId/activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivitiesController {
  constructor(private readonly service: ActivitiesService) {}

  @Post()
  @Roles('super_admin', 'sales_manager', 'sales_agent')
  @ApiOperation({ summary: 'Log an activity against an application' })
  async create(
    @Param('applicationId') applicationId: string,
    @Body() body: CreateActivityRequestDto,
    @CurrentUser() user: JwtPayload,
    @Headers('x-correlation-id') correlationIdHeader: string | undefined,
    @Ip() ip: string,
  ) {
    const correlationId = correlationIdHeader && correlationIdHeader.length > 0
      ? correlationIdHeader
      : randomUUID();
    const out = await this.service.createActivity({
      applicationId,
      request: body,
      actor: { staffId: user.sub, role: user.role as ActivityActorRole },
      correlationId,
      sourceIp: ip ?? null,
    });
    return { success: true, data: out };
  }

  @Get()
  @Roles('super_admin', 'sales_manager', 'sales_agent', 'analyst')
  @ApiOperation({ summary: 'List activities for an application (newest first)' })
  async list(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit?: number,
  ) {
    const rows = await this.service.listForApplication(
      applicationId,
      { role: user.role as ActivityActorRole },
      { cursor, limit },
    );
    return {
      success: true,
      data: { activities: rows },
      pagination: {
        nextCursor: rows.length === limit ? (rows[rows.length - 1]?.id ?? null) : null,
      },
    };
  }
}
