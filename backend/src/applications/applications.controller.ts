/**
 * Applications mobile controller — POST /v1/applications/apply.
 * Constitution Principle III: validation errors use error codes via the global filter.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { ApplyRequestDto } from './dto/apply.dto';
import { SelectOfferDto } from './dto/select-offer.dto';
import { MobileRateLimitGuard } from './guards/mobile-rate-limit.guard';
import { CustomerJwtGuard } from '@/customer-auth/guards/customer-jwt.guard';
import { CustomerProfileCompleteGuard } from '@/customer-auth/guards/customer-profile-complete.guard';
import { ForbiddenException } from '@/common/errors/domain.exceptions';

interface MobileAuthedRequest extends Request {
  customerId?: string;
}

@ApiTags('Applications')
@ApiBearerAuth('CustomerBearerAuth')
@Controller('v1')
@UseGuards(CustomerJwtGuard)
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post('apply')
  @UseGuards(MobileRateLimitGuard, CustomerProfileCompleteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit loan-match application (gated on a complete profile — Principle XXXVII)' })
  @ApiResponse({ status: 200, description: 'Match result envelope' })
  @ApiResponse({ status: 400, description: 'Validation error (typed code in body)' })
  @ApiResponse({ status: 401, description: 'Customer JWT missing or invalid' })
  @ApiResponse({ status: 409, description: 'Idempotency key/body mismatch' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async apply(
    @Body() dto: ApplyRequestDto,
    @Req() req: MobileAuthedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<unknown> {
    const customerId = this.requireCustomerId(req);
    const sourceIp = req.ip ?? null;
    return this.service.apply(dto, {
      idempotencyKey: idempotencyKey?.trim() || undefined,
      payloadHash: null,
      sourceIp,
      customerId,
    });
  }

  @Post('applications/:applicationId/select-offer')
  @UseGuards(MobileRateLimitGuard, CustomerProfileCompleteGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Applicant selects one matched offer and proceeds' })
  @ApiResponse({ status: 200, description: 'User-proceed gate recorded' })
  @ApiResponse({ status: 400, description: 'Validation error (typed code)' })
  @ApiResponse({ status: 401, description: 'Customer JWT missing or invalid' })
  @ApiResponse({ status: 403, description: 'Customer does not own this application' })
  @ApiResponse({ status: 404, description: 'Application or bank offer not found' })
  @ApiResponse({
    status: 409,
    description:
      'Already proceeded, status mismatch, offer not for application, or required documents missing (NATIONAL_ID_REQUIRED / PROFILE_PHOTO_REQUIRED)',
  })
  async selectOffer(
    @Param('applicationId') applicationId: string,
    @Body() dto: SelectOfferDto,
    @Req() req: MobileAuthedRequest,
  ): Promise<unknown> {
    const customerId = this.requireCustomerId(req);
    const data = await this.service.selectOffer({
      applicationId,
      bankOfferId: dto.bankOfferId,
      customerId,
      sourceIp: req.ip ?? null,
    });
    return { success: true, data };
  }

  @Get('applications')
  @UseGuards(CustomerProfileCompleteGuard)
  @ApiOperation({ summary: "List the customer's own applications (Applications screen)" })
  @ApiResponse({
    status: 200,
    description: 'Applications the customer has proceeded with, newest first',
  })
  @ApiResponse({ status: 401, description: 'Customer JWT missing or invalid' })
  async listMine(@Req() req: MobileAuthedRequest): Promise<unknown> {
    const customerId = this.requireCustomerId(req);
    return this.service.listMine(customerId);
  }

  private requireCustomerId(req: MobileAuthedRequest): string {
    const user = (req as Request & { user?: { sub?: string } }).user;
    const sub = user?.sub;
    if (!sub) throw new ForbiddenException();
    return sub;
  }
}
