import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { CurrentUser, type JwtPayload } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { OnboardingService } from './onboarding.service';
import {
  CreateOnboardingScreenDto,
  OnboardingScreenResponseDto,
  ReorderOnboardingScreensDto,
  UpdateOnboardingScreenDto,
} from './dto/onboarding.dto';

@ApiTags('Admin · Onboarding')
@ApiBearerAuth('BearerAuth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
@Controller('admin/onboarding-screens')
export class AdminOnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'List all onboarding screens (active + inactive)' })
  async list(): Promise<{ success: true; data: OnboardingScreenResponseDto[] }> {
    const data = await this.svc.listAdmin();
    return ok(data);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a new onboarding screen' })
  async create(
    @Body() body: CreateOnboardingScreenDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: OnboardingScreenResponseDto }> {
    const data = await this.svc.create({
      body,
      actorStaffId: user.sub,
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
    return ok(data);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an onboarding screen' })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateOnboardingScreenDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: OnboardingScreenResponseDto }> {
    const data = await this.svc.update({
      id,
      body,
      actorStaffId: user.sub,
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
    return ok(data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an onboarding screen' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<void> {
    await this.svc.delete({
      id,
      actorStaffId: user.sub,
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
  }

  @Patch('reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder onboarding screens (batch)' })
  async reorder(
    @Body() body: ReorderOnboardingScreensDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: OnboardingScreenResponseDto[] }> {
    const data = await this.svc.reorder({
      body,
      actorStaffId: user.sub,
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
    return ok(data);
  }
}
