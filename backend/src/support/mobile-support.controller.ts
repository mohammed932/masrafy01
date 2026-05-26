import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { MobileHmacGuard } from '@/applications/guards/mobile-hmac.guard';
import { CorrelationId } from '@/common/decorators/correlation-id.decorator';
import { OptionalCustomerJwtGuard } from '@/customer-auth/guards/optional-customer-jwt.guard';
import { ok } from '@/common/pagination/paginated.response.dto';
import { SupportService } from './support.service';
import {
  CreateSupportRequestDto,
  SupportContactResponseDto,
  SupportRequestResponseDto,
} from './dto/support.dto';

type MobileSupportRequest = Request & {
  mobileClientId?: string;
  customerId?: string;
};

@ApiTags('Mobile · Support')
@Controller('v1/support')
@UseGuards(MobileHmacGuard, OptionalCustomerJwtGuard)
export class MobileSupportController {
  constructor(private readonly svc: SupportService) {}

  @Get('contact')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Mobile-facing support contact info (singleton config row)' })
  async contact(): Promise<{ success: true; data: SupportContactResponseDto }> {
    const data = await this.svc.getMobileContact();
    return ok(data);
  }

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  @ApiOperation({
    summary: 'Customer-initiated support request',
    description:
      'Logs the customer\'s "Need Help" tap with the channel they chose. Customer JWT is optional — guest applications can still raise a ticket.',
  })
  async create(
    @Body() body: CreateSupportRequestDto,
    @Req() req: MobileSupportRequest,
    @CorrelationId() correlationId: string,
  ): Promise<{ success: true; data: SupportRequestResponseDto }> {
    if (!req.mobileClientId) {
      throw new Error('HMAC guard did not attach mobileClientId');
    }
    const data = await this.svc.createMobileRequest({
      channel: body.channel,
      applicationId: body.applicationId,
      note: body.note,
      customerId: req.customerId ?? null,
      mobileClientId: req.mobileClientId,
      ctx: { sourceIp: req.ip ?? null, correlationId },
    });
    return ok(data);
  }
}
