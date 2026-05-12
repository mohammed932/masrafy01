/**
 * Applications mobile controller — POST /v1/applications/apply.
 * Constitution Principle III: validation errors use error codes via the global filter.
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { ApplyRequestDto } from './dto/apply.dto';
import { MobileHmacGuard } from './guards/mobile-hmac.guard';
import { MobileRateLimitGuard } from './guards/mobile-rate-limit.guard';

interface HmacRequest extends Request {
  mobileClientId?: string;
  rawBodyHashHex?: string;
}

@ApiTags('Applications')
@Controller('v1')
@UseGuards(MobileHmacGuard, MobileRateLimitGuard)
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit loan-match application' })
  @ApiResponse({ status: 200, description: 'Match result envelope' })
  @ApiResponse({ status: 400, description: 'Validation error (typed code in body)' })
  @ApiResponse({ status: 401, description: 'HMAC signature invalid' })
  @ApiResponse({ status: 409, description: 'Idempotency key/body mismatch' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async apply(
    @Body() dto: ApplyRequestDto,
    @Req() req: HmacRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<unknown> {
    const mobileClientId = req.mobileClientId ?? 'unknown';
    const sourceIp = req.ip ?? null;
    const payloadHash = req.rawBodyHashHex ?? null;
    return this.service.apply(dto, {
      mobileClientId,
      idempotencyKey: idempotencyKey?.trim() || undefined,
      payloadHash,
      sourceIp,
    });
  }
}
